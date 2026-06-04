import { jwtVerify, createRemoteJWKSet } from 'jose';
import { ssoServiceClient } from './sso-service-client.js';

/**
 * Enhanced JWT Verification Utilities
 * Provides secure JWT verification with JWKS support and caching
 */

// Cache for JWKS to avoid repeated fetches
let jwksCache = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get JWKS from SSO Worker with caching
 * @returns {Promise<Function>} JWKS function for jose library
 */
async function getJWKS() {
  const now = Date.now();
  
  // Return cached JWKS if still valid
  if (jwksCache && now < jwksCacheExpiry) {
    console.log('[JWT] Using cached JWKS');
    return jwksCache;
  }

  try {
    const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8788';
    const jwksUrl = `${ssoWorkerUrl}/.well-known/jwks.json`;
    
    console.log('[JWT] Fetching JWKS from:', jwksUrl);
    
    // Create remote JWKS set
    jwksCache = createRemoteJWKSet(new URL(jwksUrl));
    jwksCacheExpiry = now + JWKS_CACHE_DURATION;
    
    console.log('[JWT] JWKS cache updated from:', jwksUrl);
    return jwksCache;
  } catch (error) {
    console.error('[JWT] Failed to fetch JWKS:', error);
    
    // Try to get JWKS via service client as fallback
    try {
      console.log('[JWT] Trying JWKS via service client fallback...');
      const jwksData = await ssoServiceClient.getJWKS();
      console.log('[JWT] JWKS fetched via service client fallback');
      
      // For fallback, we'll need to create a local JWKS function
      // This is a simplified approach - in production, you might want more robust handling
      jwksCache = createRemoteJWKSet(new URL(`${process.env.SSO_WORKER_URL}/.well-known/jwks.json`));
      jwksCacheExpiry = now + JWKS_CACHE_DURATION;
      
      return jwksCache;
    } catch (fallbackError) {
      console.error('[JWT] JWKS fallback also failed:', fallbackError);
      throw new Error('Failed to fetch JWKS from all sources');
    }
  }
}

/**
 * Verify JWT token with proper signature validation
 * @param {string} token - JWT token to verify
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function verifyJWT(token, options = {}) {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');

    console.log('[JWT] Attempting to verify token...');
    console.log('[JWT] Token length:', cleanToken.length);
    console.log('[JWT] Token starts with:', cleanToken.substring(0, 50) + '...');

    const jwks = await getJWKS();
    
    const verificationOptions = {
      issuer: process.env.SSO_WORKER_URL || 'http://localhost:8788',
      audience: options.audience || 'sp-dash-2',
      clockTolerance: '30s', // Allow 30 second clock skew
      ...options
    };

    console.log('[JWT] Verification options:', verificationOptions);

    const { payload, protectedHeader } = await jwtVerify(cleanToken, jwks, verificationOptions);

    console.log('[JWT] Verification successful');
    console.log('[JWT] Payload:', JSON.stringify(payload, null, 2));

    // Additional validation
    const now = Math.floor(Date.now() / 1000);
    
    // Check token expiry with some tolerance
    if (payload.exp && payload.exp < (now - 30)) {
      throw new Error('Token has expired');
    }

    // Check not before claim
    if (payload.nbf && payload.nbf > (now + 30)) {
      throw new Error('Token not yet valid');
    }

    return {
      valid: true,
      payload,
      protectedHeader,
      error: null
    };
  } catch (error) {
    console.error('[JWT] Verification failed:', error.message);
    console.error('[JWT] Full error:', error);
    return {
      valid: false,
      payload: null,
      protectedHeader: null,
      error: error.message
    };
  }
}

/**
 * Verify JWT token with role-based access control
 * @param {string} token - JWT token to verify
 * @param {Array<string>} requiredRoles - Required roles for access
 * @param {Object} options - Additional verification options
 * @returns {Promise<Object>} Verification result with role check
 */
export async function verifyJWTWithRoles(token, requiredRoles = [], options = {}) {
  const verificationResult = await verifyJWT(token, options);
  
  if (!verificationResult.valid) {
    return verificationResult;
  }

  const { payload } = verificationResult;
  const userRoles = payload.roles || [];

  // Check if user has any of the required roles
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return {
        valid: false,
        payload: null,
        protectedHeader: null,
        error: `Insufficient permissions. Required: ${requiredRoles.join(', ')}, Current: ${userRoles.join(', ')}`
      };
    }
  }

  return verificationResult;
}

/**
 * Decode JWT without verification (for debugging only)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded payload
 */
export function decodeJWT(token) {
  try {
    if (!token) return null;
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');
    
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('[JWT] Decode failed:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token to check
 * @param {number} bufferSeconds - Buffer time in seconds (default: 30)
 * @returns {boolean} True if expired
 */
export function isTokenExpired(token, bufferSeconds = 30) {
  try {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < (now + bufferSeconds);
  } catch (error) {
    return true;
  }
}

/**
 * Get token expiry time in milliseconds
 * @param {string} token - JWT token
 * @returns {number} Expiry time in milliseconds, or 0 if invalid
 */
export function getTokenExpiry(token) {
  try {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return 0;
    
    return payload.exp * 1000; // Convert to milliseconds
  } catch (error) {
    return 0;
  }
}

/**
 * Get time until token expiry in milliseconds
 * @param {string} token - JWT token
 * @returns {number} Time until expiry in milliseconds, or 0 if expired/invalid
 */
export function getTimeUntilExpiry(token) {
  try {
    const expiryTime = getTokenExpiry(token);
    if (!expiryTime) return 0;
    
    const timeUntilExpiry = expiryTime - Date.now();
    return Math.max(timeUntilExpiry, 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Extract user information from JWT payload
 * @param {string} token - JWT token
 * @returns {Object|null} User information or null if invalid
 */
export function extractUserFromJWT(token) {
  try {
    const payload = decodeJWT(token);
    if (!payload) return null;
    
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      orgId: payload.org_id,
      isEmailVerified: payload.email_verified || false,
      membershipStatus: payload.membership_status,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      issuer: payload.iss,
      audience: payload.aud
    };
  } catch (error) {
    console.error('[JWT] User extraction failed:', error);
    return null;
  }
}

/**
 * Clear JWKS cache (useful for testing or when JWKS changes)
 */
export function clearJWKSCache() {
  jwksCache = null;
  jwksCacheExpiry = 0;
  console.log('[JWT] JWKS cache cleared');
}