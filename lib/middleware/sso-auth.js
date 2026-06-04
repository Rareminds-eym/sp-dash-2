import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT, verifyJWTWithRoles, isTokenExpired, extractUserFromJWT } from '../jwt-utils.js';
import { createSSOServiceClient } from '../sso-service-client.js';

/**
 * Enhanced SSO Authentication middleware with service binding support
 * @param {Request} request - Next.js request object
 * @param {Array<string>} requiredRoles - Array of roles that are allowed (optional)
 * @param {Object} options - Additional options
 * @returns {Object} { user, error }
 */
export async function authenticateSSORequest(request, requiredRoles = [], options = {}) {
  try {
    const cookieStore = await cookies();
    const ssoAccessToken = cookieStore.get('sso_access_token')?.value;
    const ssoUserCookie = cookieStore.get('sso_user')?.value;

    if (!ssoAccessToken || !ssoUserCookie) {
      return {
        error: NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 }),
        user: null
      };
    }

    // Quick expiry check before expensive verification
    if (isTokenExpired(ssoAccessToken, 30)) {
      return {
        error: NextResponse.json({ error: 'Unauthorized - Token expired' }, { status: 401 }),
        user: null
      };
    }

    // Verify JWT with role-based access control
    const verificationResult = await verifyJWTWithRoles(ssoAccessToken, requiredRoles, {
      audience: options.audience || 'sp-dash-2',
      clockTolerance: '30s'
    });
    
    if (!verificationResult.valid) {
      console.error('[SSO Auth] JWT verification failed:', verificationResult.error);
      
      const statusCode = verificationResult.error.includes('Insufficient permissions') ? 403 : 401;
      return {
        error: NextResponse.json({ 
          error: statusCode === 403 ? 'Forbidden - Insufficient permissions' : 'Unauthorized - Invalid token',
          details: verificationResult.error
        }, { status: statusCode }),
        user: null
      };
    }

    // Extract user data from verified JWT payload
    const user = extractUserFromJWT(ssoAccessToken);
    
    if (!user) {
      return {
        error: NextResponse.json({ error: 'Unauthorized - Invalid token payload' }, { status: 401 }),
        user: null
      };
    }

    // Merge with cookie data for backward compatibility
    try {
      const cookieUser = JSON.parse(ssoUserCookie);
      
      // Enhance user object with cookie data as fallback
      user.orgId = user.orgId || cookieUser.orgId;
      user.membershipStatus = user.membershipStatus || cookieUser.membershipStatus;
    } catch (e) {
      console.warn('[SSO Auth] Failed to parse user cookie, using JWT data only:', e.message);
    }

    // Additional security checks
    if (options.requireEmailVerification && !user.isEmailVerified) {
      return {
        error: NextResponse.json({ 
          error: 'Forbidden - Email verification required',
          requiresVerification: true
        }, { status: 403 }),
        user: null
      };
    }

    return {
      user,
      error: null
    };
  } catch (error) {
    console.error('[SSO Auth] Error:', error);
    return {
      error: NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      user: null
    };
  }
}

/**
 * Verify SSO access token with SSO worker using service binding
 * @param {string} accessToken - JWT access token
 * @param {Object} env - Environment object (for service bindings)
 * @returns {Promise<Object>} { valid, user, error }
 */
export async function verifySSOToken(accessToken, env = {}) {
  try {
    const ssoClient = createSSOServiceClient(env);
    const userData = await ssoClient.verifyToken(accessToken);
    
    return {
      valid: true,
      user: userData.user,
      error: null
    };
  } catch (error) {
    console.error('[SSO Auth] Token verification error:', error);
    return {
      valid: false,
      user: null,
      error: error.message
    };
  }
}

/**
 * Refresh SSO tokens using service binding
 * @param {string} refreshToken - Refresh token
 * @param {Object} env - Environment object (for service bindings)
 * @returns {Promise<Object>} { success, tokens, error }
 */
export async function refreshSSOTokens(refreshToken, env = {}) {
  try {
    const ssoClient = createSSOServiceClient(env);
    const tokenData = await ssoClient.refreshTokens(refreshToken);
    
    return {
      success: true,
      tokens: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token
      },
      error: null
    };
  } catch (error) {
    console.error('[SSO Auth] Token refresh error:', error);
    return {
      success: false,
      tokens: null,
      error: error.message
    };
  }
}

/**
 * Login user using service binding
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} env - Environment object (for service bindings)
 * @returns {Promise<Object>} { success, data, headers, error }
 */
export async function loginWithSSO(email, password, env = {}) {
  try {
    const ssoClient = createSSOServiceClient(env);
    const loginResult = await ssoClient.login(email, password);
    
    return {
      success: true,
      data: loginResult.data,
      headers: loginResult.headers,
      error: null
    };
  } catch (error) {
    console.error('[SSO Auth] Login error:', error);
    return {
      success: false,
      data: null,
      headers: null,
      error: error.message
    };
  }
}

/**
 * Logout user using service binding
 * @param {string} accessToken - Access token
 * @param {Object} env - Environment object (for service bindings)
 * @returns {Promise<boolean>} Success status
 */
export async function logoutWithSSO(accessToken, env = {}) {
  try {
    const ssoClient = createSSOServiceClient(env);
    return await ssoClient.logout(accessToken);
  } catch (error) {
    console.error('[SSO Auth] Logout error:', error);
    return false;
  }
}
