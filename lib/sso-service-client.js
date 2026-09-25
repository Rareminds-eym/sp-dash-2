import 'server-only';
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
    // Bindings are accessed via getCloudflareContext from @opennextjs/cloudflare.
    // Works under both `next dev` (local binding simulation) and Cloudflare Pages.
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
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
   * Login user via RPC.
   *
   * Calls the authority `login` method, which returns a discriminated
   * SessionIssueRpcOutcome (`kind: "issued" | "rejected" | "rate_limited" |
   * "timeout" | "unavailable"`), not a flat `{success, error}` shape.
   * Callers must branch on `outcome.kind`.
   *
   * @param {Object} params - { correlationId, email, password, currentRefreshToken? }
   * @returns {Promise<Object>} SessionIssueRpcOutcome
   */
  async login(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.login(params);
  }

  /**
   * Refresh the current session via RPC.
   * @param {Object} params - { correlationId, refreshToken }
   * @returns {Promise<Object>} SessionRotateRpcOutcome
   */
  async refresh(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.refreshCurrentSession({
      correlationId: params.correlationId,
      refreshToken: params.refreshToken,
      operation: 'refresh_current_session',
    });
  }

  /**
   * Logout the current session (or all sessions) via RPC.
   * @param {Object} params - { correlationId, refreshToken, scope? }
   *   scope: "current" (default) or "all"
   * @returns {Promise<Object>} CurrentLogoutRpcOutcome | AllLogoutRpcOutcome
   */
  async logout(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    if (params.scope === 'all') {
      return await this.binding.logoutAllSessions({
        correlationId: params.correlationId,
        refreshToken: params.refreshToken,
        scope: 'all',
      });
    }
    return await this.binding.logoutCurrentSession({
      correlationId: params.correlationId,
      refreshToken: params.refreshToken,
      scope: 'current',
    });
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
   * Admin-provisioned Hybrid subscription activation via RPC.
   * Hybrid is a "contact sales" plan — this bypasses the self-serve catalog
   * gate on the assumption that sales has already negotiated terms. Callers
   * of this method MUST have already verified the requester holds an admin
   * role (super_admin, platform_admin, or rm_admin).
   * @param {Object} params - { organization_id, plan_amount, seat_count, billing_cycle?, features?, notes?, admin_user_id }
   * @returns {Promise<Object>} the created subscription row
   */
  async createHybridSubscription(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.createHybridSubscription(params);
  }

  /**
   * Admin-provisioned creation of a brand-new organization + owner user +
   * Hybrid subscription, in one flow. Same admin-role requirement as
   * createHybridSubscription.
   * @param {Object} params - { org_name, org_type, owner_email, owner_password, owner_name?, owner_phone?,
   *   plan_amount, seat_count, billing_cycle?, features?, notes?, admin_user_id }
   * @returns {Promise<Object>} { organization, owner, subscription }
   */
  async createHybridOrganization(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.createHybridOrganization(params);
  }

  /**
   * List organizations with their most recent subscription (any plan), for
   * the admin org table.
   * @param {Object} params - { search?, plan_code?, status?, page?, limit? }
   * @returns {Promise<Object>} { data, pagination }
   */
  async listOrganizationsWithSubscriptions(params = {}) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.listOrganizationsWithSubscriptions(params);
  }

  /**
   * Preview what deleting an organization would affect (member/subscription
   * counts) before the admin picks soft or hard delete.
   * @param {string} organizationId
   * @returns {Promise<Object>} { organization_id, organization_name, membership_count, subscription_count, has_active_subscription }
   */
  async inspectOrganizationForDeletion(organizationId) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.inspectOrganizationForDeletion(organizationId);
  }

  /**
   * Admin soft-delete: marks the org deleted_at and deactivates its
   * memberships. Reversible, non-destructive. Blocks on an active/pending
   * subscription unless force is true.
   * @param {Object} params - { organization_id, admin_user_id, force? }
   */
  async softDeleteOrganization(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.softDeleteOrganization(params);
  }

  /**
   * Admin hard-delete: irreversibly removes the organization, its
   * subscriptions/transactions, memberships, and any user who is only a
   * member of this org. Blocks on an active/pending subscription unless
   * force is true.
   * @param {Object} params - { organization_id, admin_user_id, force? }
   */
  async hardDeleteOrganization(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.hardDeleteOrganization(params);
  }

  /**
   * Request password reset via RPC.
   * The reset-link redirect URL is resolved server-side by sso-worker
   * (from ALLOWED_APP_URLS) — it is not a caller-supplied parameter.
   * @param {Object} params - { correlationId, email }
   * @returns {Promise<Object>} ForgotPasswordRpcOutcome
   */
  async forgotPassword(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.forgotPassword(params);
  }

  /**
   * Reset password with a reset token via RPC.
   * @param {Object} params - { correlationId, resetToken, password, currentRefreshToken? }
   * @returns {Promise<Object>} ResetPasswordRpcOutcome
   */
  async resetPassword(params) {
    if (!this.binding) {
      throw new Error('SSO service binding not available');
    }
    return await this.binding.resetPassword(params);
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