/**
 * Enhanced Frontend Authentication Client
 * Handles automatic token refresh, authentication state, and optimized API calls
 */

class AuthClient {
  constructor() {
    this.refreshPromise = null;
    this.isRefreshing = false;
    this.authState = {
      user: null,
      authenticated: false,
      expiresAt: null,
    };
    this.listeners = new Set();
    
    // Initialize auth state from session storage if available
    this.initializeFromStorage();
  }

  /**
   * Initialize auth state from session storage
   */
  initializeFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const storedAuth = sessionStorage.getItem('auth_state');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        if (authData.expiresAt && authData.expiresAt > Date.now()) {
          this.authState = authData;
        } else {
          sessionStorage.removeItem('auth_state');
        }
      }
    } catch (error) {
      console.warn('[AuthClient] Failed to load auth state from storage:', error);
    }
  }

  /**
   * Save auth state to session storage
   */
  saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      if (this.authState.authenticated) {
        sessionStorage.setItem('auth_state', JSON.stringify(this.authState));
      } else {
        sessionStorage.removeItem('auth_state');
      }
    } catch (error) {
      console.warn('[AuthClient] Failed to save auth state to storage:', error);
    }
  }

  /**
   * Add auth state listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of auth state changes
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(callback => {
      try {
        callback({ event, ...data, authState: this.authState });
      } catch (error) {
        console.error('[AuthClient] Listener error:', error);
      }
    });
  }

  /**
   * Make authenticated API request with automatic token refresh
   */
  async fetch(url, options = {}) {
    try {
      // First, try the request
      let response = await this._makeRequest(url, options);

      // If unauthorized, try to refresh token
      if (response.status === 401) {
        console.log('[AuthClient] Received 401, attempting token refresh...');
        
        const refreshed = await this.refreshToken();
        
        if (refreshed) {
          // Retry the original request
          response = await this._makeRequest(url, options);
        } else {
          // Refresh failed, redirect to login
          this.handleAuthFailure();
          return response;
        }
      }

      return response;
    } catch (error) {
      console.error('[AuthClient] Request failed:', error);
      throw error;
    }
  }

  /**
   * Make the actual HTTP request
   */
  async _makeRequest(url, options) {
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  /**
   * Refresh access token with improved error handling
   */
  async refreshToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  async _performRefresh() {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AuthClient] Token refresh successful');
        
        // Update auth state
        this.authState = {
          user: data.user,
          authenticated: true,
          expiresAt: data.expiresAt,
        };
        
        this.saveToStorage();
        this.notifyListeners('tokenRefreshed', { user: data.user, expiresAt: data.expiresAt });
        
        return true;
      } else {
        console.error('[AuthClient] Token refresh failed:', response.status);
        this.handleAuthFailure();
        return false;
      }
    } catch (error) {
      console.error('[AuthClient] Token refresh error:', error);
      this.handleAuthFailure();
      return false;
    }
  }

  /**
   * Login user with enhanced error handling
   */
  async login(email, password) {
    try {
      const response = await fetch('/api/auth/sso-login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('[AuthClient] Login successful');
        
        // Update auth state
        this.authState = {
          user: data.user,
          authenticated: true,
          expiresAt: data.expiresAt,
        };
        
        this.saveToStorage();
        this.notifyListeners('login', { user: data.user });
        
        return { success: true, user: data.user };
      } else {
        const errorMessage = data.error || 'Login failed';
        console.error('[AuthClient] Login failed:', errorMessage);
        
        return { 
          success: false, 
          error: errorMessage,
          status: response.status,
          requiresVerification: data.requiresVerification
        };
      }
    } catch (error) {
      console.error('[AuthClient] Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Logout user with cleanup
   */
  async logout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Clear auth state regardless of response
      this.clearAuthState();
      
      // Always redirect to login
      this.notifyListeners('logout');
      
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return response.ok;
    } catch (error) {
      console.error('[AuthClient] Logout error:', error);
      
      // Still clear state and redirect
      this.clearAuthState();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    try {
      // Return cached state if still valid
      if (this.authState.authenticated && this.authState.expiresAt > Date.now()) {
        return { authenticated: true, user: this.authState.user };
      }

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update auth state
        this.authState = {
          user: data.user,
          authenticated: true,
          expiresAt: data.expiresAt,
        };
        
        this.saveToStorage();
        
        return { authenticated: true, user: data.user };
      } else {
        this.clearAuthState();
        return { authenticated: false, user: null };
      }
    } catch (error) {
      console.error('[AuthClient] Auth check error:', error);
      this.clearAuthState();
      return { authenticated: false, user: null };
    }
  }

  /**
   * Get current auth state
   */
  getAuthState() {
    return { ...this.authState };
  }

  /**
   * Clear auth state
   */
  clearAuthState() {
    this.authState = {
      user: null,
      authenticated: false,
      expiresAt: null,
    };
    
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_state');
    }
  }

  /**
   * Handle authentication failure
   */
  handleAuthFailure() {
    this.clearAuthState();
    this.notifyListeners('authFailure');
    
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * Setup automatic token refresh with smart timing
   */
  setupAutoRefresh() {
    if (typeof window === 'undefined') return;

    // Check token expiry every 30 seconds
    const checkInterval = setInterval(async () => {
      try {
        if (!this.authState.authenticated || !this.authState.expiresAt) {
          return;
        }

        const now = Date.now();
        const timeUntilExpiry = this.authState.expiresAt - now;
        
        // Refresh if token expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          console.log('[AuthClient] Auto-refreshing token...');
          await this.refreshToken();
        } else if (timeUntilExpiry <= 0) {
          // Token has expired
          console.log('[AuthClient] Token expired, clearing state');
          this.handleAuthFailure();
        }
      } catch (error) {
        console.error('[AuthClient] Auto-refresh check failed:', error);
      }
    }, 30 * 1000); // Check every 30 seconds

    // Clear interval on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(checkInterval);
    });

    return checkInterval;
  }

  /**
   * Check if token needs refresh soon
   */
  needsRefresh(bufferMinutes = 5) {
    if (!this.authState.authenticated || !this.authState.expiresAt) {
      return false;
    }

    const now = Date.now();
    const timeUntilExpiry = this.authState.expiresAt - now;
    return timeUntilExpiry < bufferMinutes * 60 * 1000;
  }
}

// Create singleton instance
export const authClient = new AuthClient();

// Setup auto-refresh when module loads
if (typeof window !== 'undefined') {
  authClient.setupAutoRefresh();
}