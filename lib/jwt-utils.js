import 'server-only';
import { jwtVerify, importSPKI, importJWK, importX509 } from 'jose';

/**
 * JWT Verification using jose library
 * Fetches public key from SSO worker's /.well-known/jwks.json
 */

let cachedPublicKey = null;
let cacheTimestamp = 0;
let cachePromise = null; // Promise-based cache for concurrent request safety
const CACHE_TTL = 3600000; // 1 hour

/**
 * Get public key from SSO worker
 * Uses promise-based caching to prevent race conditions in concurrent environments
 */
async function getPublicKey() {
  const now = Date.now();

  // Return cached key if still valid
  if (cachedPublicKey && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPublicKey;
  }

  // If another request is already fetching, wait for it instead of fetching again
  if (cachePromise) {
    return cachePromise;
  }

  // Set up the fetch promise and cache it
  cachePromise = (async () => {
    try {
      let jwks;
      try {
        const { createSSOServiceClient } = await import('@/lib/sso-service-client');
        const ssoClient = await createSSOServiceClient();
        jwks = await ssoClient.getJWKS();
      } catch (rpcError) {
        // Fallback: Fetch JWKS via HTTP if Cloudflare RPC service binding is not available (e.g. standard Next.js dev server)
        const ssoWorkerUrl = process.env.SSO_WORKER_URL || 'http://localhost:8788';
        try {
          const res = await fetch(`${ssoWorkerUrl}/.well-known/jwks.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          jwks = await res.json();
        } catch (httpError) {
          throw new Error(`RPC unavailable (${rpcError.message}), HTTP fetch failed (${httpError.message})`);
        }
      }

      const key = jwks?.keys?.[0];

      if (!key) {
        throw new Error('No keys found in JWKS');
      }

      // Import the public key
      if (key.x5c && key.x5c[0]) {
        // Use certificate if available
        const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
        cachedPublicKey = await importX509(cert, key.alg);
      } else {
        // Otherwise use JWK format
        cachedPublicKey = await importJWK(key, key.alg);
      }
      cacheTimestamp = now;

      return cachedPublicKey;
    } finally {
      // Clear the promise reference so future cache misses can fetch again
      cachePromise = null;
    }
  })();

  return cachePromise;
}

/**
 * Verify JWT token using jose library
 * @param {string} token - JWT token to verify
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function verifyJWT(token, options = {}) {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    const cleanToken = token.replace(/^Bearer\s+/, '');

    try {
      const publicKey = await getPublicKey();
      const verified = await jwtVerify(cleanToken, publicKey);

      return {
        valid: true,
        payload: verified.payload,
        protectedHeader: verified.protectedHeader,
        error: null
      };
    } catch (verError) {
      // In development mode, if signature verification or JWKS fetch fails, fall back to decoding payload if valid and unexpired
      if (process.env.NODE_ENV === 'development') {
        const payload = decodeJWT(cleanToken);
        if (payload && !isTokenExpired(cleanToken)) {
          console.warn('[JWT] Development mode: Accepting decoded payload fallback (JWKS/Signature check failed):', verError.message);
          return {
            valid: true,
            payload,
            protectedHeader: null,
            error: null
          };
        }
      }
      throw verError;
    }
  } catch (error) {
    console.error('[JWT] Verification failed:', error.message);
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
    
    const roles = payload.roles || (payload.role ? [payload.role] : ['admin']);
    return {
      id: payload.sub,
      userId: payload.sub || payload.userId || payload.id,
      email: payload.email,
      roles: roles,
      role: payload.role || roles[0] || 'admin',
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
 * Clear JWKS cache (useful for testing or when JWKS keys are rotated)
 * WARNING: Only call this if you're sure no requests are in-flight, or they may fail
 */
export function clearJWKSCache() {
  cachedPublicKey = null;
  cacheTimestamp = 0;
  cachePromise = null;
  console.log('[JWT] JWKS cache cleared');
}