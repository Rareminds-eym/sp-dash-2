import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { extractUserFromJWT, verifyJWT } from './jwt-utils'
import { supabaseAdmin } from './supabase-admin'

const isSecure = process.env.NODE_ENV === 'production'
const COOKIE_ACCESS = isSecure ? '__Host-sso_access_token' : 'sso_access_token'
/**
 * Creates a Supabase client and extracts the user from the SSO JWT.
 * Note: Because sp-dash uses SSO Worker Auth instead of native Supabase Auth,
 * the returned `supabase` client connects anonymously. Database operations on behalf
 * of the user must be performed with `supabaseAdmin` to bypass RLS, or RLS policies
 * must be explicitly designed for anon access (not recommended).
 * 
 * @param {Request} request - The incoming request object
 * @returns {Promise<Object>} Object containing supabase client and user
 */
export async function createRLSClient(request = null) {
  let cookieStore

  if (request) {
    // For API routes - extract cookies from request
    const cookieHeader = request.headers.get('cookie') || ''
    const parsedCookies = parseCookieHeader(cookieHeader)

    cookieStore = {
      getAll() {
        return Object.entries(parsedCookies).map(([name, value]) => ({ name, value }))
      },
      get(name) {
        return parsedCookies[name] ? { name, value: parsedCookies[name] } : undefined
      }
    }
  } else {
    // For server components - use Next.js cookies
    cookieStore = await cookies()
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (cookieStore.set) {
                cookieStore.set(name, value, options)
              }
            })
          } catch {
            // Ignore errors in API routes where we can't set cookies
          }
        },
      },
    }
  )

  // Extract user from SSO JWT
  const ssoToken = cookieStore.get(COOKIE_ACCESS)?.value
  let user = null
  let error = null

  if (ssoToken) {
    const verification = await verifyJWT(ssoToken)
    if (verification.valid) {
      user = extractUserFromJWT(ssoToken)
    } else {
      error = new Error('Invalid SSO token')
    }
  } else {
    error = new Error('No SSO token found')
  }

  return {
    supabase,
    user,
    error
  }
}

/**
 * Helper function to parse cookie header string
 */
function parseCookieHeader(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })

  return cookies
}

/**
 * Middleware helper to ensure user is authenticated
 * Returns user or throws error
 */
export async function requireAuth(request) {
  const { supabase, user, error } = await createRLSClient(request)

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return { supabase, user }
}

/**
 * Get user's role and entity information for authorization checks.
 * Uses supabaseAdmin to bypass RLS since the user is authenticated via SSO JWT.
 */
export async function getUserContext(supabase_unused, user) {
  if (!user) return null

  // Fetch user details from users table using admin client to bypass RLS
  const { data: userData, error } = await supabaseAdmin
    .from('users')
    .select('id, email, firstName, lastName, isActive, metadata, organizationId')
    .eq('email', user.email)
    .maybeSingle()

  if (error || !userData) {
    console.error('Error fetching user context:', error)
    return null
  }

  // Fetch admin role from admin_users table
  const { data: adminUser } = await supabaseAdmin
    .from('admin_users')
    .select('admin_role')
    .eq('id', userData.id)
    .maybeSingle()

  // Fetch organization data if applicable
  let organizationData = null
  if (userData.organizationId) {
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', userData.organizationId)
      .maybeSingle()
    organizationData = orgData
  }

  const userName = userData?.firstName && userData?.lastName
    ? `${userData.firstName} ${userData.lastName}`
    : user.user_metadata?.firstName && user.user_metadata?.lastName
      ? `${user.user_metadata.firstName} ${user.user_metadata.lastName}`
      : user.email.split('@')[0]

  return {
    id: userData.id,
    authId: user.id,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: adminUser?.admin_role || null,
    organizationId: userData.organizationId,
    organization: organizationData,
    isActive: userData.isActive,
    metadata: userData.metadata,
    name: userName
  }
}

/**
 * Check if user has required permission
 */
export async function hasPermission(supabase, userRole, permissionName) {
  // Use admin client since role_permissions might be RLS protected
  const { data: permissions } = await supabaseAdmin
    .from('role_permissions')
    .select(`
      permissions (
        name
      )
    `)
    .eq('role', userRole)

  if (!permissions || permissions.length === 0) {
    return false
  }

  return permissions.some(p => p.permissions?.name === permissionName)
}

/**
 * Get session with full user context.
 * This function is designed for server components (pages).
 * Uses SSO JWT and supabaseAdmin to construct the session.
 */
export async function getSession() {
  const cookieStore = await cookies()
  const ssoToken = cookieStore.get(COOKIE_ACCESS)?.value
  
  if (!ssoToken) return null

  const verification = await verifyJWT(ssoToken)
  if (!verification.valid) return null

  const jwtUser = extractUserFromJWT(ssoToken)
  if (!jwtUser) return null

  // Fetch user data from database bypassing RLS
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, firstName, lastName, role, isActive, organizationId, createdAt, metadata')
    .eq('email', jwtUser.email)
    .maybeSingle()

  if (userError || !userData) {
    return {
      user: {
        id: jwtUser.id,
        email: jwtUser.email,
        firstName: '',
        lastName: '',
        name: jwtUser.email.split('@')[0],
        role: jwtUser.roles?.[0] || 'user',
      }
    }
  }

  // Fetch admin role from admin_users — takes precedence over users.role
  const { data: adminUserData } = await supabaseAdmin
    .from('admin_users')
    .select('admin_role')
    .eq('id', userData.id)
    .maybeSingle()

  let organizationData = null
  if (userData.organizationId) {
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('id', userData.organizationId)
      .maybeSingle()
    organizationData = orgData
  }

  return {
    user: {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      name: `${userData.firstName} ${userData.lastName}`.trim() || jwtUser.email.split('@')[0],
      role: adminUserData?.admin_role || userData.role,
      organizationId: userData.organizationId,
      organization: organizationData,
      isActive: userData.isActive,
    }
  }
}
