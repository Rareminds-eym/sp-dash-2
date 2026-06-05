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
 * Verify SSO access token with SSO worker using RPC service binding
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Object>} { valid, user, error }
 */
export async function verifySSOToken(accessToken) {
  try {
    const ssoClient = await createSSOServiceClient();
    const userData = await ssoClient.verifyToken(accessToken);
    
    if (!userData || !userData.user) {
      return {
        valid: false,
        user: null,
        error: 'Invalid token'
      };
    }
    
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
