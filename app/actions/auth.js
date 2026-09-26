'use server'

import { extractUserFromJWT, getTimeUntilExpiry, getTokenExpiry, verifyJWT } from '@/lib/jwt-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { createSSOServiceClient } from '@/lib/sso-service-client'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { cookies, headers } from 'next/headers'
import { z } from 'zod'

/**
 * Cookie name helper — __Host- prefix requires Secure flag, which browsers
 * reject on plain HTTP (localhost dev). Fall back to unprefixed names in dev.
 */
const isSecure = process.env.NODE_ENV === 'production'
const COOKIE_ACCESS = isSecure ? '__Host-sso_access_token' : 'sso_access_token'
const COOKIE_REFRESH = isSecure ? '__Host-sso_refresh_token' : 'sso_refresh_token'
const COOKIE_USER = isSecure ? '__Host-sso_user' : 'sso_user'

/**
 * Retry helper for transient database errors
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise} Result of the function
 */
async function retryOnTransientError(fn, maxRetries = 2, delayMs = 1000) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const errorMsg = error.message || ''
      const isTransient = errorMsg.includes('PGRST002') ||
        errorMsg.includes('503') ||
        errorMsg.includes('Could not query the database') ||
        errorMsg.includes('schema cache')

      if (!isTransient || attempt === maxRetries) {
        throw error
      }

      console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed with transient error, retrying in ${delayMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }
  throw lastError
}

/**
 * Handle SSO Login Action
 */
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
})

/**
 * Translate a rejected/transient SessionIssueRpcOutcome into a
 * { errorMessage, statusCode } pair for the caller.
 */
function describeSessionFailure(outcome) {
  switch (outcome.kind) {
    case 'rejected':
      switch (outcome.code) {
        case 'invalid_credentials':
          return { errorMessage: 'Invalid email or password.', statusCode: 401 }
        case 'account_blocked':
          return { errorMessage: 'Account is disabled or requires verification.', statusCode: 403 }
        default:
          return { errorMessage: 'Login failed.', statusCode: 400 }
      }
    case 'rate_limited':
      return { errorMessage: 'Too many login attempts. Please try again later.', statusCode: 429 }
    case 'timeout':
    case 'unavailable':
      return { errorMessage: 'Login service is temporarily unavailable. Please try again.', statusCode: 503 }
    case 'cancelled':
      return { errorMessage: 'Login was cancelled. Please try again.', statusCode: 409 }
    default:
      return { errorMessage: 'Login failed.', statusCode: 500 }
  }
}

export async function loginAction(email, password) {
  try {
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      return { success: false, error: 'Invalid email or password format', status: 400 }
    }

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('cf-connecting-ip') || '127.0.0.1'

    if (!(await checkRateLimit(`login_${ip}_${parsed.data.email}`, 5, 60000))) {
      return { success: false, error: 'Too many login attempts. Please try again later.', status: 429 }
    }

    const ssoClient = await createSSOServiceClient()

    let outcome
    try {
      // Retry transient database errors automatically (upstream's helper,
      // kept since sso-worker still surfaces PGRST002/503 style failures
      // as thrown errors from the RPC call itself, not as a discriminated
      // outcome kind).
      outcome = await retryOnTransientError(async () => {
        return await ssoClient.login({
          correlationId: crypto.randomUUID(),
          email: parsed.data.email,
          password: parsed.data.password,
        })
      })
    } catch (err) {
      console.error('[SSO Login Action] RPC error:', err)
      const errorMessage = err.message || 'Login failed'
      const statusCode = /PGRST002|503|Could not query the database|schema cache|network|timeout|ECONNREFUSED/.test(errorMessage)
        ? 503
        : 500
      return { success: false, error: statusCode === 503 ? 'The authentication service is temporarily unavailable. Please try again in a few moments.' : errorMessage, status: statusCode }
    }

    if (!outcome || outcome.kind !== 'issued') {
      console.warn('[SSO Login Action] Login not issued:', outcome)
      const { errorMessage, statusCode } = describeSessionFailure(outcome || {})
      return { success: false, error: errorMessage, status: statusCode }
    }

    const accessToken = outcome.session?.accessToken
    const refreshTokenValue = outcome.session?.refreshToken

    if (!accessToken || !refreshTokenValue) {
      console.error('[SSO Login Action] Missing session data:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshTokenValue,
      })
      return { success: false, error: 'Login failed - incomplete response from SSO worker', status: 500 }
    }

    // Verify the JWT token we received
    const verificationResult = await verifyJWT(accessToken)

    if (!verificationResult.valid) {
      console.error('[SSO Login Action] JWT verification failed:', verificationResult.error)
      return { success: false, error: 'Login failed - invalid token received', status: 500 }
    }

    // Extract user data from verified JWT payload
    const user = extractUserFromJWT(accessToken)

    if (!user) {
      return { success: false, error: 'Login failed - invalid token payload', status: 500 }
    }

    // Check if user has super_admin or platform_admin role
    const allowedRoles = ['super_admin', 'platform_admin']
    const hasAdminRole = user.roles?.some(role => allowedRoles.includes(role)) ?? false

    if (!hasAdminRole) {
      return {
        success: false,
        error: 'Access denied. You are not authorized to access the admin dashboard.',
        status: 403
      }
    }

    if (!user.isEmailVerified) {
      console.warn('[SSO Login Action] User email not verified:', user.email)
    }

    // Set cookies
    const cookieStore = await cookies()
    const tokenExpirySeconds = user.expiresAt - Math.floor(Date.now() / 1000)
    const cookieSecure = { httpOnly: true, secure: isSecure, sameSite: 'lax', path: '/' }

    cookieStore.set(COOKIE_ACCESS, accessToken, {
      ...cookieSecure,
      maxAge: Math.max(tokenExpirySeconds, 60),
    })

    cookieStore.set(COOKIE_REFRESH, refreshTokenValue, {
      ...cookieSecure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    cookieStore.set(COOKIE_USER, JSON.stringify({
      id: user.id,
      email: user.email,
      roles: user.roles,
      orgId: user.orgId,
      isEmailVerified: user.isEmailVerified,
    }), {
      ...cookieSecure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log('[SSO Login Action] Successful login:', {
        userId: user.id,
        email: user.email,
        roles: user.roles
      })
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
      },
      expiresAt: user.expiresAt * 1000,
    }
  } catch (error) {
    console.error('[SSO Login Action] Error:', error)
    return { success: false, error: 'An internal error occurred during login', status: 500 }
  }
}

/**
 * Handle Token Refresh Action
 */
export async function refreshAction() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(COOKIE_REFRESH)?.value

    if (!refreshToken) {
      return { success: false, error: 'No refresh token available', status: 401 }
    }

    const ssoClient = await createSSOServiceClient()
    let outcome
    try {
      // Retry transient database errors automatically (see loginAction).
      outcome = await retryOnTransientError(async () => {
        return await ssoClient.refresh({
          correlationId: crypto.randomUUID(),
          refreshToken,
        })
      })
    } catch (err) {
      console.error('[Token Refresh Action] RPC error:', err)
      cookieStore.delete(COOKIE_REFRESH)
      cookieStore.delete(COOKIE_ACCESS)
      cookieStore.delete(COOKIE_USER)

      const errorMessage = /PGRST002|503|Could not query the database|schema cache/.test(err.message || '')
        ? 'Authentication service temporarily unavailable'
        : (err.message || 'Token refresh failed')
      return { success: false, error: errorMessage, status: 503 }
    }

    if (!outcome || (outcome.kind !== 'rotated' && outcome.kind !== 'overlap')) {
      cookieStore.delete(COOKIE_REFRESH)
      cookieStore.delete(COOKIE_ACCESS)
      cookieStore.delete(COOKIE_USER)
      const statusCode = outcome?.kind === 'rate_limited' ? 429 : 401
      const errorMessage = outcome?.kind === 'rejected' ? 'Session expired. Please log in again.' : 'Token refresh failed'
      return { success: false, error: errorMessage, status: statusCode }
    }

    const newAccessToken = outcome.session?.accessToken
    const newRefreshToken = outcome.session?.refreshToken

    if (!newAccessToken) {
      return { success: false, error: 'No access token in refresh response', status: 500 }
    }

    const verificationResult = await verifyJWT(newAccessToken)
    if (!verificationResult.valid) {
      return { success: false, error: 'Invalid token received from refresh', status: 500 }
    }

    const user = extractUserFromJWT(newAccessToken)
    if (!user) {
      return { success: false, error: 'Invalid token payload received from refresh', status: 500 }
    }

    const tokenExpirySeconds = user.expiresAt - Math.floor(Date.now() / 1000)
    const cookieSecure = { httpOnly: true, secure: isSecure, sameSite: 'lax', path: '/' }

    cookieStore.set(COOKIE_ACCESS, newAccessToken, {
      ...cookieSecure,
      maxAge: Math.max(tokenExpirySeconds, 60),
    })

    if (newRefreshToken) {
      cookieStore.set(COOKIE_REFRESH, newRefreshToken, {
        ...cookieSecure,
        maxAge: 60 * 60 * 24 * 30,
      })
    }

    cookieStore.set(COOKIE_USER, JSON.stringify({
      id: user.id,
      email: user.email,
      roles: user.roles,
      orgId: user.orgId,
      isEmailVerified: user.isEmailVerified,
    }), {
      ...cookieSecure,
      maxAge: 60 * 60 * 24 * 30,
    })

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
      },
      expiresAt: user.expiresAt * 1000,
    }
  } catch (error) {
    console.error('[Token Refresh Action] Error:', error)
    return { success: false, error: 'An error occurred during token refresh', status: 500 }
  }
}

/**
 * Handle Logout Action
 */
export async function logoutAction() {
  try {
    const cookieStore = await cookies()
    const ssoRefreshToken = cookieStore.get(COOKIE_REFRESH)?.value

    if (ssoRefreshToken) {
      try {
        const ssoClient = await createSSOServiceClient()
        await ssoClient.logout({
          correlationId: crypto.randomUUID(),
          refreshToken: ssoRefreshToken,
          scope: 'current',
        })
      } catch (error) {
        console.error('[Logout Action] SSO Worker logout RPC failed:', error)
      }
    }

    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }

    cookieStore.set(COOKIE_ACCESS, '', cookieOptions)
    cookieStore.set(COOKIE_REFRESH, '', cookieOptions)
    cookieStore.set(COOKIE_USER, '', cookieOptions)

    return { success: true, message: 'Logged out successfully' }
  } catch (error) {
    console.error('[Logout Action] Error:', error)

    // Attempt local cleanup anyway
    try {
      const cookieStore = await cookies()
      const cookieOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      }
      cookieStore.set(COOKIE_ACCESS, '', cookieOptions)
      cookieStore.set(COOKIE_REFRESH, '', cookieOptions)
      cookieStore.set(COOKIE_USER, '', cookieOptions)
    } catch (e) { }

    return { success: false, error: 'Logout failed, but local session cleared', status: 500 }
  }
}

/**
 * Get Session Action
 */
export async function getSessionAction() {
  try {
    const cookieStore = await cookies()
    const ssoAccessToken = cookieStore.get(COOKIE_ACCESS)?.value
    const ssoUserCookie = cookieStore.get(COOKIE_USER)?.value

    if (!ssoAccessToken || !ssoUserCookie) {
      return { authenticated: false, user: null, error: 'No active session' }
    }

    const expiresAt = getTokenExpiry(ssoAccessToken)
    const timeUntilExpiry = getTimeUntilExpiry(ssoAccessToken)

    if (timeUntilExpiry <= 0) {
      return { authenticated: false, user: null, error: 'Token expired' }
    }

    const verificationResult = await verifyJWT(ssoAccessToken)
    if (!verificationResult.valid) {
      return { authenticated: false, user: null, error: 'Invalid token' }
    }

    const user = extractUserFromJWT(ssoAccessToken)
    if (!user) {
      return { authenticated: false, user: null, error: 'Invalid token payload' }
    }

    try {
      const cookieUser = JSON.parse(ssoUserCookie)
      user.membershipStatus = user.membershipStatus || cookieUser.membershipStatus
      user.role = user.roles?.[0] || 'member'
    } catch (e) {
      user.role = user.roles?.[0] || 'member'
    }

    const needsRefresh = timeUntilExpiry < 5 * 60 * 1000
    const shouldRefreshSoon = timeUntilExpiry < 10 * 60 * 1000

    // Log token info server-side only for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Session Action] Token info:', { issuedAt: user.issuedAt, issuer: user.issuer })
    }

    return {
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        roles: user.roles,
        orgId: user.orgId,
        isEmailVerified: user.isEmailVerified,
        membershipStatus: user.membershipStatus,
      },
      expiresAt,
      timeUntilExpiry,
      needsRefresh,
      shouldRefreshSoon
    }
  } catch (error) {
    console.error('[Session Action] Error:', error)
    return { authenticated: false, user: null, error: 'Internal server error' }
  }
}

/**
 * Handle Forgot Password Action
 * Delegates entirely to SSO Worker via RPC — no direct Supabase auth calls.
 */
const forgotPasswordSchema = z.object({
  email: z.string().email().max(255)
})

export async function forgotPasswordAction(email) {
  try {
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      return { error: 'Invalid email format', status: 400 }
    }

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('cf-connecting-ip') || '127.0.0.1'

    if (!(await checkRateLimit(`forgot_${ip}_${parsed.data.email}`, 3, 300000))) { // 3 attempts per 5 minutes
      return { error: 'Too many password reset attempts. Please try again later.', status: 429 }
    }

    const ssoClient = await createSSOServiceClient()
    // Redirect URL is resolved server-side by sso-worker from ALLOWED_APP_URLS,
    // not passed by the caller — ForgotPasswordRpcInput has no such field.
    const outcome = await ssoClient.forgotPassword({
      correlationId: crypto.randomUUID(),
      email: parsed.data.email,
    })

    if (outcome && outcome.kind !== 'succeeded') {
      console.warn('[Forgot Password Action] SSO Worker outcome:', outcome)
    }

    // Always return success to prevent user enumeration
    return {
      success: true,
      message: 'If this email exists in our system, you will receive a password reset link shortly.'
    }
  } catch (error) {
    console.error('[Forgot Password Action] Error:', error)
    // Still return success message to prevent user enumeration
    return {
      success: true,
      message: 'If this email exists in our system, you will receive a password reset link shortly.'
    }
  }
}

/**
 * Handle Reset Password Action
 * Delegates token verification and password update to SSO Worker via RPC.
 */
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
})

export async function resetPasswordAction(accessToken, password) {
  try {
    const parsed = resetPasswordSchema.safeParse({ password })
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message, status: 400 }
    }

    if (!accessToken) {
      return { success: false, error: 'Access token is required', status: 400 }
    }

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('cf-connecting-ip') || '127.0.0.1'

    if (!(await checkRateLimit(`reset_${ip}`, 5, 300000))) { // 5 attempts per 5 minutes
      return { success: false, error: 'Too many password reset attempts. Please try again later.', status: 429 }
    }

    // Delegate token verification + password update entirely to SSO Worker
    const ssoClient = await createSSOServiceClient()
    const outcome = await ssoClient.resetPassword({
      correlationId: crypto.randomUUID(),
      resetToken: accessToken,
      password: parsed.data.password,
    })

    if (!outcome || (outcome.kind !== 'succeeded' && outcome.kind !== 'issued')) {
      console.warn('[Reset Password Action] SSO Worker outcome:', outcome)
      const statusCode = outcome?.kind === 'rate_limited' ? 429 : outcome?.kind === 'rejected' ? 400 : 500
      return { success: false, error: 'Failed to reset password. The link may be invalid or expired.', status: statusCode }
    }

    // Clear current session cookies (force re-login)
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }
    cookieStore.set(COOKIE_ACCESS, '', cookieOptions)
    cookieStore.set(COOKIE_REFRESH, '', cookieOptions)
    cookieStore.set(COOKIE_USER, '', cookieOptions)

    return { success: true, message: 'Password updated successfully. Please log in.', requiresRelogin: true }
  } catch (error) {
    console.error('[Reset Password Action] Error:', error)
    return { success: false, error: 'An unexpected error occurred', status: 500 }
  }
}

/**
 * Handle Update Password Action (for logged in users)
 */
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
})

export async function updatePasswordAction(currentPassword, newPassword) {
  try {
    const session = await getSessionAction()
    if (!session.authenticated || !session.user) {
      return { success: false, error: 'You must be logged in to change your password', status: 401 }
    }

    const parsed = updatePasswordSchema.safeParse({ currentPassword, newPassword })
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message, status: 400 }
    }

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('cf-connecting-ip') || '127.0.0.1'
    const ua = headersList.get('user-agent') || 'unknown'

    if (!(await checkRateLimit(`update_pwd_${ip}_${session.user.id}`, 5, 300000))) { // 5 attempts per 5 minutes
      return { success: false, error: 'Too many password update attempts. Please try again later.', status: 429 }
    }

    // Verify current password by making a login request to the SSO worker
    const ssoClient = await createSSOServiceClient()
    const verifyOutcome = await ssoClient.login({
      correlationId: crypto.randomUUID(),
      email: session.user.email,
      password: parsed.data.currentPassword,
    })

    if (!verifyOutcome || verifyOutcome.kind !== 'issued') {
      return { success: false, error: 'Current password is incorrect', status: 400 }
    }

    // Current password is correct, update the password via Supabase Admin
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      session.user.id,
      { password: parsed.data.newPassword }
    )

    if (updateError) {
      console.error('[Update Password Action] Supabase error:', updateError)
      return { success: false, error: updateError.message || 'Failed to update password', status: 400 }
    }

    // Revoke all existing sessions to enforce re-login
    try {
      await ssoClient.revokeAllUserSessions(session.user.id)
    } catch (revokeError) {
      console.error('[Update Password Action] Failed to revoke sessions:', revokeError)
    }

    // Clear current session cookies (force re-login)
    const cookieStore = await cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }
    cookieStore.set(COOKIE_ACCESS, '', cookieOptions)
    cookieStore.set(COOKIE_REFRESH, '', cookieOptions)
    cookieStore.set(COOKIE_USER, '', cookieOptions)

    return { success: true, message: 'Password updated. Please log in again.', requiresRelogin: true }
  } catch (error) {
    console.error('[Update Password Action] Error:', error)
    return { success: false, error: 'An unexpected error occurred', status: 500 }
  }
}
