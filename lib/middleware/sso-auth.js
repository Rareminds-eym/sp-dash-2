import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * SSO Authentication middleware - checks SSO session cookies
 * @param {Request} request - Next.js request object
 * @param {Array<string>} requiredRoles - Array of roles that are allowed (optional)
 * @returns {Object} { user, error }
 */
export async function authenticateSSORequest(request, requiredRoles = []) {
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

    // Parse user data from cookie
    let user;
    try {
      user = JSON.parse(ssoUserCookie);
    } catch (e) {
      return {
        error: NextResponse.json({ error: 'Unauthorized - Invalid session' }, { status: 401 }),
        user: null
      };
    }

    // Check if user has required roles (if specified)
    if (requiredRoles.length > 0) {
      const userRoles = user.roles || [];
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        return {
          error: NextResponse.json({ 
            error: 'Forbidden - Insufficient permissions' 
          }, { status: 403 }),
          user: null
        };
      }
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
 * Verify SSO access token with SSO worker
 * @param {string} accessToken - JWT access token
 * @returns {Promise<Object>} { valid, user, error }
 */
export async function verifySSOToken(accessToken) {
  try {
    const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8788';
    
    const response = await fetch(`${ssoWorkerUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Origin': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      },
    });

    if (!response.ok) {
      return {
        valid: false,
        user: null,
        error: 'Invalid token'
      };
    }

    const data = await response.json();
    
    return {
      valid: true,
      user: data.user,
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
