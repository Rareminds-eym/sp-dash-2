import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Enhanced SSO Service Client
 * Uses Cloudflare Service Bindings with RPC for direct method calls in edge runtime
 * Provides seamless local development fallback when running under standard Next.js dev server (Node.js).
 */

/**
 * Get the SSO service binding from Next.js on Cloudflare Pages
 * @returns {Promise<Object|null>} The SSO service binding or null if running in standard Node.js
 */
async function getSSOBinding() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    return env?.SSO || null;
  } catch (error) {
    // getRequestContext is only available inside edge runtime.
    // In local Node.js dev server (next dev), return null to use local fallback.
    return null;
  }
}

/**
 * Create local Supabase client for authentication database fallback in local dev
 */
function getLocalAuthDb() {
  const url = process.env.SSO_AUTH_SUPABASE_URL || process.env.SKILLPASSPORT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SSO_AUTH_SERVICE_ROLE_KEY || process.env.SKILLPASSPORT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Generate a local development JWT access token
 */
function generateLocalJWT(user) {
  const now = Math.floor(Date.now() / 1000);
  const roles = user.roles || (user.role ? [user.role] : ['super_admin']);
  const payload = {
    sub: user.id || user.userId || 'a822aedd-2ade-4d42-86ff-74775215a5ff',
    userId: user.id || user.userId || 'a822aedd-2ade-4d42-86ff-74775215a5ff',
    email: user.email,
    roles: roles,
    role: roles[0] || 'super_admin',
    org_id: user.organizationId || user.orgId || null,
    is_email_verified: true,
    email_verified: true,
    iat: now,
    exp: now + 30 * 24 * 60 * 60, // 30 days
    iss: process.env.SSO_JWT_ISSUER || 'http://localhost:8787',
    aud: process.env.SSO_JWT_AUDIENCE || 'sp-dash-2'
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodeBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const token = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.local_dev_signature`;
  return token;
}

/**
 * SSO Service Client with RPC support and local dev fallback
 */
export class SSOServiceClient {
  constructor(binding) {
    this.binding = binding;
  }

  /**
   * Verify user token via RPC or fallback
   */
  async verifyToken(token) {
    if (this.binding) {
      try {
        const payload = await this.binding.verifyToken(token);
        if (!payload) return null;
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
        console.error('[SSO Service] verifyToken RPC error:', error);
        return null;
      }
    }

    // Local Dev Fallback: Decode token
    try {
      if (!token) return null;
      const cleanToken = token.replace(/^Bearer\s+/, '');
      const parts = cleanToken.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (!payload) return null;
      return {
        user: {
          id: payload.sub || payload.userId || payload.id,
          email: payload.email,
          orgId: payload.org_id || payload.orgId,
          roles: payload.roles || (payload.role ? [payload.role] : ['super_admin']),
          products: payload.products || [],
          membershipStatus: payload.membership_status || 'active',
          isEmailVerified: payload.is_email_verified ?? payload.email_verified ?? true,
        }
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    if (this.binding) {
      return await this.binding.getUser(userId);
    }
    const db = getLocalAuthDb();
    if (!db) return null;
    const { data } = await db.from('users').select('*').eq('id', userId).maybeSingle();
    return data;
  }

  /**
   * Issue new access token for user (admin action)
   */
  async issueAccessToken(userId, orgId) {
    if (this.binding) {
      return await this.binding.issueAccessToken(userId, orgId);
    }
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    const accessToken = generateLocalJWT({ ...user, organizationId: orgId });
    return { access_token: accessToken };
  }

  /**
   * List users with filters
   */
  async listUsers(params = {}) {
    if (this.binding) {
      return await this.binding.listUsers(params);
    }
    const db = getLocalAuthDb();
    if (!db) return { users: [] };
    let query = db.from('users').select('*');
    if (params.email) query = query.ilike('email', `%${params.email}%`);
    const { data } = await query;
    return { users: data || [] };
  }

  /**
   * Block or unblock user
   */
  async setUserBlockStatus(userId, blocked) {
    if (this.binding) {
      return await this.binding.setUserBlockStatus(userId, blocked);
    }
    const db = getLocalAuthDb();
    if (db) {
      await db.from('users').update({ isActive: !blocked }).eq('id', userId);
    }
    return { success: true };
  }

  /**
   * Admin verify user's email
   */
  async adminVerifyEmail(userId) {
    if (this.binding) {
      return await this.binding.adminVerifyEmail(userId);
    }
    return { success: true };
  }

  /**
   * Get organization details
   */
  async getOrganization(orgId) {
    if (this.binding) {
      return await this.binding.getOrganization(orgId);
    }
    return { id: orgId, name: 'Default Organization' };
  }

  /**
   * List organizations
   */
  async listOrganizations(params = {}) {
    if (this.binding) {
      return await this.binding.listOrganizations(params);
    }
    return { organizations: [] };
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(orgId) {
    if (this.binding) {
      return await this.binding.getOrganizationMembers(orgId);
    }
    return { members: [] };
  }

  /**
   * Update organization
   */
  async updateOrganization(orgId, data) {
    if (this.binding) {
      return await this.binding.updateOrganization(orgId, data);
    }
    return { success: true };
  }

  /**
   * Get organization stats
   */
  async getOrganizationStats(orgId) {
    if (this.binding) {
      return await this.binding.getOrganizationStats(orgId);
    }
    return { totalMembers: 1, activeMembers: 1 };
  }

  /**
   * Get user memberships
   */
  async getUserMemberships(userId) {
    if (this.binding) {
      return await this.binding.getUserMemberships(userId);
    }
    return { memberships: [] };
  }

  /**
   * Update membership status
   */
  async updateMembershipStatus(membershipId, status) {
    if (this.binding) {
      return await this.binding.updateMembershipStatus(membershipId, status);
    }
    return { success: true };
  }

  /**
   * Update membership roles
   */
  async updateMembershipRoles(membershipId, roles) {
    if (this.binding) {
      return await this.binding.updateMembershipRoles(membershipId, roles);
    }
    return { success: true };
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId) {
    if (this.binding) {
      return await this.binding.getUserSessions(userId);
    }
    return { sessions: [] };
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId) {
    if (this.binding) {
      return await this.binding.revokeSession(sessionId);
    }
    return { success: true };
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId) {
    if (this.binding) {
      return await this.binding.revokeAllUserSessions(userId);
    }
    return { success: true };
  }

  /**
   * Get organization invites
   */
  async getOrganizationInvites(orgId) {
    if (this.binding) {
      return await this.binding.getOrganizationInvites(orgId);
    }
    return { invites: [] };
  }

  /**
   * Cancel invite
   */
  async adminCancelInvite(inviteId) {
    if (this.binding) {
      return await this.binding.adminCancelInvite(inviteId);
    }
    return { success: true };
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId, params = {}) {
    if (this.binding) {
      return await this.binding.getUserActivity(userId, params);
    }
    return { activities: [] };
  }

  /**
   * Login user via RPC or local dev fallback
   */
  async login(params) {
    if (this.binding) {
      try {
        if (typeof this.binding.login === 'function') {
          return await this.binding.login(params);
        }
      } catch (error) {
        console.warn('[SSO Service] RPC login failed/unimplemented, falling back to local auth:', error.message);
      }
    }

    // Local Dev Fallback: query user from database
    const db = getLocalAuthDb();
    if (!db) {
      return { success: false, error: 'Database connection not configured', status: 500 };
    }

    const email = params.email?.toLowerCase().trim();
    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user) {
      console.warn('[SSO Client Local Dev] User not found in database:', email);
      return { success: false, error: 'Invalid email or password', status: 401 };
    }

    if (user.is_blocked || user.isActive === false) {
      return { success: false, error: 'Account is disabled', status: 403 };
    }

    // Verify password if password_hash is present
    if (user.password_hash && params.password) {
      try {
        let bcrypt;
        try {
          bcrypt = await import('bcryptjs').then(m => m.default || m);
        } catch {
          bcrypt = null;
        }
        if (bcrypt) {
          const valid = bcrypt.compareSync(params.password, user.password_hash);
          if (!valid) {
            return { success: false, error: 'Invalid email or password', status: 401 };
          }
        }
      } catch (e) {
        console.warn('[SSO Client Local Dev] Bcrypt check skipped:', e.message);
      }
    }

    const roles = user.roles || (user.role ? [user.role] : ['super_admin']);
    const accessToken = generateLocalJWT({ ...user, roles });
    const refreshToken = `local_ref_${user.id}_${Date.now()}`;

    return {
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: roles,
        orgId: user.organizationId || null,
        isEmailVerified: true,
      }
    };
  }

  /**
   * Refresh session via RPC or local fallback
   */
  async refresh(params) {
    if (this.binding) {
      return await this.binding.refresh(params);
    }
    if (!params?.refresh_token) {
      return { error: 'No refresh token provided', status: 401 };
    }
    const accessToken = generateLocalJWT({ id: 'a822aedd-2ade-4d42-86ff-74775215a5ff', email: 'admin@rareminds.in', roles: ['super_admin'] });
    return {
      access_token: accessToken,
      refresh_token: params.refresh_token,
    };
  }

  /**
   * Logout user via RPC or local fallback
   */
  async logout(params) {
    if (this.binding) {
      return await this.binding.logout(params);
    }
    return { success: true };
  }

  /**
   * Get sales subscriptions
   */
  async getSalesSubscriptions(searchParamsStr) {
    if (this.binding) {
      return await this.binding.getSalesSubscriptions(searchParamsStr);
    }
    return { subscriptions: [], totalCount: 0 };
  }

  /**
   * Request password reset
   */
  async forgotPassword(params, ip) {
    if (this.binding) {
      return await this.binding.forgotPassword(params, ip);
    }
    return { success: true, message: 'Password reset link sent' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(params, ip, ua) {
    if (this.binding) {
      return await this.binding.resetPassword(params, ip, ua);
    }
    return { success: true };
  }

  /**
   * Get JWKS
   */
  async getJWKS() {
    if (this.binding) {
      return await this.binding.getJWKS();
    }
    return { keys: [] };
  }

  /**
   * Get sales filter metadata
   */
  async getSalesFilterMeta() {
    if (this.binding) {
      return await this.binding.getSalesFilterMeta();
    }
    return { planTypes: [], statuses: [], clientTypes: [] };
  }
}

/**
 * Create SSO service client with service binding or local dev fallback
 * @returns {Promise<SSOServiceClient>}
 */
export async function createSSOServiceClient() {
  const binding = await getSSOBinding();
  return new SSOServiceClient(binding);
}
