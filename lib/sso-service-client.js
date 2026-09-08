import 'server-only';

function correlationId() {
  return crypto.randomUUID();
}

function rpcFailure(outcome, operation) {
  if (outcome?.kind === 'rate_limited') {
    return { success: false, error: 'Too many login attempts. Please try again later.', status: 429 };
  }

  if (outcome?.kind === 'rejected') {
    const errors = {
      invalid_credentials: 'Invalid credentials',
      account_blocked: 'Account is blocked',
      absent: 'No active session',
      expired: 'Session expired',
      revoked: 'Session revoked',
      blocked: 'Account is blocked',
      replay_detected: 'Session is no longer valid',
      invalid_request: 'Invalid request',
    };
    const status = outcome.code === 'account_blocked' || outcome.code === 'blocked' ? 403 : 401;
    return { success: false, error: errors[outcome.code] || `${operation} failed`, status };
  }

  const unavailable = outcome?.kind === 'timeout' || outcome?.kind === 'unavailable';
  return {
    success: false,
    error: unavailable ? 'Authentication service is temporarily unavailable' : `${operation} failed`,
    status: unavailable ? 503 : 401,
  };
}

function legacySessionResponse(outcome, acceptedKinds, operation) {
  // Keep compatibility with an older SSO worker during rolling deployments.
  if (outcome?.access_token) return { success: true, ...outcome };

  if (!acceptedKinds.includes(outcome?.kind) || !outcome?.session) {
    return rpcFailure(outcome, operation);
  }

  const { session } = outcome;
  return {
    success: true,
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    user: {
      id: session.identity.subject,
      email: session.identity.email,
    },
    active_org_id: session.identity.organizationId,
  };
}
/**
 * Enhanced SSO Service Client
 * Uses Cloudflare Service Bindings with RPC for direct method calls
 * No HTTP fetch calls - all communication via service binding
 */

/**
 * Get the SSO service binding from Next.js on Cloudflare Pages
 * @returns {Promise<Object>} The SSO service binding
 */
async function getSSOBinding() {
  try {
    // In Next.js on Cloudflare Pages, bindings are accessed via getRequestContext
    // from @cloudflare/next-on-pages/server
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const { env } = getRequestContext();
    return env.SSO;
  } catch (error) {
    console.error('[SSO Service] Failed to get binding:', error.message);
    throw new Error('SSO service binding not available');
  }
}

/**
 * SSO Service Client with RPC support
 */
export class SSOServiceClient {
  constructor(binding) {
    this.binding = binding;
  }

  /**
   * Verify user token via RPC
   * @param {string} token - JWT access token
   * @returns {Promise<Object>} Token payload or null
   */
  async verifyToken(token) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    try {
      const payload = await this.binding.verifyToken(token);
      
      if (!payload) {
        return null;
      }

      // Transform RPC response to match expected format
      return {
        user: {
          id: payload.sub,
          email: payload.email,
          orgId: payload.org_id,
          roles: payload.roles || [],
          products: payload.products || [],
          membershipStatus: payload.membership_status,
          isEmailVerified: payload.is_email_verified,
        }
      };
    } catch (error) {
      console.error('[SSO Service] verifyToken error:', error);
      return null;
    }
  }

  /**
   * Get user by ID via RPC
   * @param {string} userId 
   * @returns {Promise<Object|null>}
   */
  async getUser(userId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getUser(userId);
  }

  /**
   * Issue new access token for user (admin action)
   * @param {string} userId 
   * @param {string} orgId 
   * @returns {Promise<Object>}
   */
  async issueAccessToken(userId, orgId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.issueAccessToken(userId, orgId);
  }

  /**
   * List users with filters
   * @param {Object} params 
   * @returns {Promise<Object>}
   */
  async listUsers(params = {}) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.listUsers(params);
  }

  /**
   * Block or unblock user
   * @param {string} userId 
   * @param {boolean} blocked 
   * @returns {Promise<Object>}
   */
  async setUserBlockStatus(userId, blocked) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.setUserBlockStatus(userId, blocked);
  }

  /**
   * Admin verify user's email
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async adminVerifyEmail(userId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.adminVerifyEmail(userId);
  }

  /**
   * Get organization details
   * @param {string} orgId 
   * @returns {Promise<Object|null>}
   */
  async getOrganization(orgId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getOrganization(orgId);
  }

  /**
   * List organizations
   * @param {Object} params 
   * @returns {Promise<Object>}
   */
  async listOrganizations(params = {}) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.listOrganizations(params);
  }

  /**
   * Get organization members
   * @param {string} orgId 
   * @returns {Promise<Object>}
   */
  async getOrganizationMembers(orgId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getOrganizationMembers(orgId);
  }

  /**
   * Update organization
   * @param {string} orgId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async updateOrganization(orgId, data) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.updateOrganization(orgId, data);
  }

  /**
   * Get organization stats
   * @param {string} orgId 
   * @returns {Promise<Object>}
   */
  async getOrganizationStats(orgId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getOrganizationStats(orgId);
  }

  /**
   * Get user memberships
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async getUserMemberships(userId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getUserMemberships(userId);
  }

  /**
   * Update membership status
   * @param {string} membershipId 
   * @param {string} status 
   * @returns {Promise<Object>}
   */
  async updateMembershipStatus(membershipId, status) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.updateMembershipStatus(membershipId, status);
  }

  /**
   * Update membership roles
   * @param {string} membershipId 
   * @param {Array<string>} roles 
   * @returns {Promise<Object>}
   */
  async updateMembershipRoles(membershipId, roles) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.updateMembershipRoles(membershipId, roles);
  }

  /**
   * Get user sessions
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async getUserSessions(userId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getUserSessions(userId);
  }

  /**
   * Revoke session
   * @param {string} sessionId 
   * @returns {Promise<Object>}
   */
  async revokeSession(sessionId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.revokeSession(sessionId);
  }

  /**
   * Revoke all user sessions
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async revokeAllUserSessions(userId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.revokeAllUserSessions(userId);
  }

  /**
   * Get organization invites
   * @param {string} orgId 
   * @returns {Promise<Object>}
   */
  async getOrganizationInvites(orgId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getOrganizationInvites(orgId);
  }

  /**
   * Cancel invite (admin action)
   * @param {string} inviteId 
   * @returns {Promise<Object>}
   */
  async adminCancelInvite(inviteId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.adminCancelInvite(inviteId);
  }

  /**
   * Get user activity
   * @param {string} userId 
   * @param {Object} params 
   * @returns {Promise<Object>}
   */
  async getUserActivity(userId, params = {}) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }

    return await this.binding.getUserActivity(userId, params);
  }

  /**
   * Login user via RPC
   * @param {Object} params - { email, password, ip, ua }
   * @returns {Promise<Object>}
   */
  async login(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    const outcome = await this.binding.login({
      correlationId: correlationId(),
      email: params.email,
      password: params.password,
    });
    return legacySessionResponse(outcome, ['issued'], 'Login');
  }

  /**
   * Refresh session via RPC
   * @param {Object} params - { refresh_token, ip, ua }
   * @returns {Promise<Object>}
   */
  async refresh(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    // The current SSO authority exposes the clean RPC contract. Fall back to
    // the legacy method so dashboard and worker can be deployed independently.
    if (typeof this.binding.refreshCurrentSession === 'function') {
      const outcome = await this.binding.refreshCurrentSession({
        correlationId: correlationId(),
        refreshToken: params.refresh_token,
      });
      return legacySessionResponse(outcome, ['rotated', 'overlap'], 'Token refresh');
    }
    return await this.binding.refresh(params);
  }

  /**
   * Logout user via RPC
   * @param {Object} params - { refresh_token, ip, ua }
   * @returns {Promise<Object>}
   */
  async logout(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    if (typeof this.binding.logoutCurrentSession === 'function') {
      const outcome = await this.binding.logoutCurrentSession({
        correlationId: correlationId(),
        refreshToken: params.refresh_token,
      });
      if (outcome?.kind === 'current_revoked' || outcome?.kind === 'current_already_ended') {
        return { success: true };
      }
      return rpcFailure(outcome, 'Logout');
    }
    return await this.binding.logout(params);
  }

  /**
   * Get sales subscriptions via RPC
   * @param {string} searchParamsStr - URLSearchParams string
   * @returns {Promise<Object>}
   */
  async getSalesSubscriptions(searchParamsStr) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.getSalesSubscriptions(searchParamsStr);
  }

  /**
   * Request password reset via RPC
   * @param {Object} params - { email, redirect_url }
   * @param {string} ip - Client IP address
   * @returns {Promise<Object>}
   */
  async forgotPassword(params, ip) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.forgotPassword(params, ip);
  }

  /**
   * Reset password with token via RPC
   * @param {Object} params - { token, password }
   * @param {string} ip - Client IP address
   * @param {string} ua - User agent
   * @returns {Promise<Object>}
   */
  async resetPassword(params, ip, ua) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.resetPassword(params, ip, ua);
  }

  /**
   * Get JWKS via RPC
   * @returns {Promise<Object>}
   */
  async getJWKS() {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.getJWKS();
  }

  /**
   * Get sales filter metadata (distinct plan types, statuses, client types)
   * @returns {Promise<{planTypes: string[], statuses: string[], clientTypes: string[]}>}
   */
  async getSalesFilterMeta() {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.getSalesFilterMeta();
  }
}

/**
 * Create SSO service client with service binding
 * @returns {Promise<SSOServiceClient>}
 */
export async function createSSOServiceClient() {
  const binding = await getSSOBinding();
  return new SSOServiceClient(binding);
}
