/**
 * Enhanced SSO Service Client
 * Supports both Cloudflare Service Bindings and HTTP fallback
 */

/**
 * SSO Service Client with service binding support
 */
export class SSOServiceClient {
  constructor(options = {}) {
    this.ssoWorkerUrl = options.ssoWorkerUrl || process.env.SSO_WORKER_URL || 'http://localhost:8788';
    this.serviceBinding = options.serviceBinding || null;
    this.origin = options.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Make request to SSO service using service binding or HTTP fallback
   * @param {string} path - API path (e.g., '/auth/login')
   * @param {Object} options - Request options
   * @returns {Promise<Response>}
   */
  async fetch(path, options = {}) {
    const url = new URL(path, this.ssoWorkerUrl);
    
    // Prepare request with default headers
    const requestOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Origin': this.origin,
        ...options.headers,
      },
    };

    try {
      // Try service binding first (faster, more reliable)
      if (this.serviceBinding) {
        console.log('[SSO Service] Using service binding for:', path);
        
        const request = new Request(url.toString(), requestOptions);
        const response = await this.serviceBinding.fetch(request);
        
        // Service binding successful
        return response;
      }
    } catch (error) {
      console.warn('[SSO Service] Service binding failed, falling back to HTTP:', error.message);
    }

    // Fallback to HTTP request
    console.log('[SSO Service] Using HTTP fallback for:', path);
    return fetch(url.toString(), requestOptions);
  }

  /**
   * Login user
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    const response = await this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Login failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      data,
      headers: {
        // SSO worker returns access_token in body, not headers
        accessToken: data.access_token || response.headers.get('X-Access-Token'),
        setCookie: response.headers.get('Set-Cookie'),
      }
    };
  }

  /**
   * Refresh tokens
   * @param {string} refreshToken 
   * @returns {Promise<Object>}
   */
  async refreshTokens(refreshToken) {
    const response = await this.fetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Token refresh failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Verify user token
   * @param {string} accessToken 
   * @returns {Promise<Object>}
   */
  async verifyToken(accessToken) {
    const response = await this.fetch('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Token verification failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get JWKS for token verification
   * @returns {Promise<Object>}
   */
  async getJWKS() {
    const response = await this.fetch('/.well-known/jwks.json', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`JWKS fetch failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Logout user
   * @param {string} accessToken 
   * @returns {Promise<boolean>}
   */
  async logout(accessToken) {
    try {
      const response = await this.fetch('/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[SSO Service] Logout error:', error);
      return false;
    }
  }
}

/**
 * Create SSO service client with environment-based configuration
 * @param {Object} env - Environment object (for Cloudflare Workers)
 * @returns {SSOServiceClient}
 */
export function createSSOServiceClient(env = {}) {
  return new SSOServiceClient({
    ssoWorkerUrl: env.SSO_WORKER_URL || process.env.SSO_WORKER_URL,
    serviceBinding: env.SSO_SERVICE || null, // Cloudflare service binding
    origin: env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL,
  });
}

// Default instance for server-side usage
export const ssoServiceClient = createSSOServiceClient();