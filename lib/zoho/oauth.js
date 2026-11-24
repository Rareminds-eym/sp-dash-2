import { matchingRecruitOrganization, refreshSourceLicense } from './source-license';
import { ZOHO_DEFAULTS, readZohoConfig } from './config';
import { z } from 'zod';
import { openTokens, sealTokens, stateHash, tokenKeyring, hasTokenKeyring } from './token-vault';
import { createConnectionQuota } from './source-quota';

export const ZOHO_HOSTS = Object.freeze({
  us: { accounts: 'https://accounts.zoho.com', api: 'https://recruit.zoho.com' },
  in: { accounts: 'https://accounts.zoho.in', api: 'https://recruit.zoho.in' },
  eu: { accounts: 'https://accounts.zoho.eu', api: 'https://recruit.zoho.eu' },
  jp: { accounts: 'https://accounts.zoho.jp', api: 'https://recruit.zoho.jp' },
  cn: { accounts: 'https://accounts.zoho.com.cn', api: 'https://recruit.zoho.com.cn' },
});
const configSchema = z.object({
  ZOHO_CLIENT_ID: z.string().min(1), ZOHO_CLIENT_SECRET: z.string().min(1),
  ZOHO_REDIRECT_URI: z.string().url(), ZOHO_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  ZOHO_TOKEN_ENCRYPTION_KEYS: z.string().optional(), ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID: z.string().optional(),
}).refine(hasTokenKeyring, { message: 'Invalid Zoho encryption configuration' });
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().positive() });
export function oauthConfiguration(env) {
  return configSchema.safeParse({...env,ZOHO_REDIRECT_URI:readZohoConfig(env).redirectUri});
}
async function check(result) {
  if (result.error) throw new Error('Zoho connection storage is unavailable');
  return result.data;
}
/** All external requests are to region allowlists with redirects disabled. */
export class RecruitFailure extends Error {
  constructor(code, retryAfterSeconds = 0) { super('Recruit request failed'); this.code = code; this.retryAfterSeconds = retryAfterSeconds; }
}
function retrySeconds(response) {
  const header = response.headers.get('Retry-After');
  const seconds = header && /^\d+$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(0, seconds)) : 0;
}
export async function recruitJson(url, init, fetcher = fetch, quota) {
  if (!quota) return rawRecruitJson(url, init, fetcher);
  const path = new URL(url).pathname;
  const kind = path === '/oauth/v2/token' ? 'oauth' :
    path === '/recruit/bulk/v2/read' && init?.method?.toUpperCase() === 'POST' ? 'bulk' : 'read';
  const reservation = await quota.reserve(kind);
  if (!reservation?.granted) throw new RecruitFailure('RATE_LIMITED', reservation?.retryAfterSeconds || 60);
  let status = 0; let retry = 0;
  try {
    return await rawRecruitJson(url, init, async (target, options) => {
      const response = await fetcher(target, options); status = response.status; retry = retrySeconds(response);
      return response;
    });
  } finally {
    // Do not discard a reservation when a response/timeout is ambiguous. Its
    // charged rolling-window budget survives; only its concurrency lease ends.
    await quota.settle(reservation.reservationId, status, retry);
  }
}
async function rawRecruitJson(url, init, fetcher = fetch) {
  const target = new URL(url);
  // Only the allowlisted job collection read carries twenty full descriptions.
  // OAuth, metadata, candidates and all other requests keep the smaller limit.
  const jobPage = (init?.method || 'GET').toUpperCase() === 'GET' &&
    target.pathname === '/recruit/v2/Job_Openings' && Object.values(ZOHO_HOSTS).some(host => host.api === target.origin);
  const byteLimit = jobPage ? ZOHO_DEFAULTS.maxJobPageResponseBytes : ZOHO_DEFAULTS.maxProviderResponseBytes;
  let response;
  // Workers supports manual/follow. A redirect is rejected by the non-OK check;
  // credentials must never follow a provider-selected Location.
  try { response = await fetcher(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(ZOHO_DEFAULTS.requestTimeoutMs) }); }
  catch { throw new RecruitFailure('SOURCE_UNAVAILABLE'); }
  if (response.status === 204 || response.status === 304 &&
    (init?.method || 'GET').toUpperCase() === 'GET' && new Headers(init?.headers).has('If-Modified-Since'))
    return { data: [], info: { more_records: false } };
  if (!response.ok) {
    const retry = retrySeconds(response);
    throw new RecruitFailure(response.status === 401 ? 'ACCESS_UNAUTHORIZED' : response.status === 403 ? 'PERMISSION_DENIED' :
      response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'SOURCE_UNAVAILABLE' : 'SOURCE_INVALID', retry);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new RecruitFailure('SOURCE_INVALID');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > byteLimit) { await reader.cancel(); throw new RecruitFailure('SOURCE_INVALID'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new RecruitFailure('SOURCE_INVALID'); }
  if (value?.error) throw new RecruitFailure(value.error === 'invalid_token' ? 'ACCESS_UNAUTHORIZED' :
    ['invalid_grant', 'invalid_code'].includes(value.error) ? 'AUTH_REVOKED' : 'SOURCE_INVALID');
  return value;
}
export function createZohoOAuth(db, variables, fetcher = fetch) {
  const config = configSchema.parse({...variables,ZOHO_REDIRECT_URI:readZohoConfig(variables).redirectUri});
  async function connection(id) {
    const result = await db.from('zoho_connections').select('id,region,source_org_id').eq('id', id).single();
    const row = await check(result);
    if (!row || !ZOHO_HOSTS[row.region]) throw new Error('This Recruit data center is not configured');
    return row;
  }
  async function consumeSource(state, actor, onVerifiedSource) {
    const consumed = await check(await db.rpc('zoho_consume_oauth_state', { p_hash: await stateHash(state), p_actor: actor }));
    if (!consumed?.connectionId) throw new Error('OAuth state expired or was already used');
    const source = z.string().uuid().parse(consumed.connectionId);
    onVerifiedSource(source);
    return source;
  }
  return {
    async start(connectionId, actor, requestOrigin) {
      const row = await connection(connectionId);
      if (new URL(config.ZOHO_REDIRECT_URI).origin !== requestOrigin) throw new Error('OAuth callback origin is not configured for this deployment');
      const state = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await check(await db.from('zoho_oauth_states').insert({ state_hash: await stateHash(state), connection_id: row.id, actor_id: actor, expires_at: new Date(Date.now() + 600000).toISOString() }));
      const target = new URL('/oauth/v2/auth', ZOHO_HOSTS[row.region].accounts);
      target.search = new URLSearchParams({ client_id: config.ZOHO_CLIENT_ID, response_type: 'code', redirect_uri: config.ZOHO_REDIRECT_URI,
        access_type: 'offline', prompt: 'consent', state,
        // Recruit's live consent endpoint requires singular module scope names.
        scope: 'ZohoRecruit.modules.candidate.READ,ZohoRecruit.modules.jobopening.READ,ZohoRecruit.bulk.read,ZohoRecruit.org.READ,ZohoRecruit.settings.fields.read' }).toString();
      return target.href;
    },
    async cancel(state, actor, onVerifiedSource = () => {}) {
      // Consent denial still consumes actor-bound state, without a token exchange.
      return consumeSource(state, actor, onVerifiedSource);
    },
    async complete(state, code, actor, onVerifiedSource = () => {}) {
      // Context comes exclusively from the actor-bound, one-use server state.
      // Preserve it on later provider/configuration failures without exposing tokens.
      const source = await consumeSource(state, actor, onVerifiedSource);
      const row = await connection(source);
      const host = ZOHO_HOSTS[row.region];
      const quota = createConnectionQuota(db, row.id);
      const tokens = tokenSchema.parse(await recruitJson(`${host.accounts}/oauth/v2/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.ZOHO_CLIENT_ID, client_secret: config.ZOHO_CLIENT_SECRET, redirect_uri: config.ZOHO_REDIRECT_URI, code }),
      }, fetcher, quota));
      const organization = await recruitJson(`${host.api}/recruit/v2/org`, { headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` } }, fetcher, quota);
      // Recruit returns the organization ID as zgid (verified against the live
      // India endpoint). Prefer it when present; legacy id-only responses remain
      // supported. An id must never override a conflicting/invalid zgid.
      // Never infer ownership from a company name or coerce numeric JS values.
      const sourceOrg = matchingRecruitOrganization(organization, row.source_org_id);
      if (!sourceOrg) throw new RecruitFailure('ORGANIZATION_MISMATCH');
      const envelope = await sealTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000 }, tokenKeyring(config), row.id);
      await check(await db.rpc('zoho_complete_connection', { p_connection: row.id, p_envelope: envelope, p_actor: actor }));
      // Plan detection must not discard a successful OAuth connection.
      try { await refreshSourceLicense(db, config, row.id, { force:true, organization:sourceOrg }); }
      catch { console.error(JSON.stringify({event:'zoho_license_refresh_unavailable'})); }
      return row.id;
    },
  };
}

/** Private existing-runtime adapter for approved bulk/inventory reads. The
 * refresh marker is persisted before POST; an ambiguous outcome requires an
 * operator reconnect instead of generating another token blindly. */
export async function getConnectionAccessToken(db, env, connectionId, { forceRefresh = false, fetcher = fetch } = {}) {
  const ring = tokenKeyring(env);
  const result = await db.from('zoho_connections').select('id,region,source_org_id,status,credential_generation').eq('id', connectionId).single();
  const connection = await check(result);
  if (!connection || connection.status !== 'connected' || !ZOHO_HOSTS[connection.region]) throw new Error('Connected Recruit source required');
  const stored = await db.from('zoho_connection_secrets').select('envelope,refresh_uncertain').eq('connection_id', connectionId).single();
  const secret = await check(stored);
  if (!secret?.envelope || secret.refresh_uncertain) throw new Error('Credential recovery requires operator reconnect');
  let envelope = secret.envelope;
  let tokens;
  try { tokens = await openTokens(envelope, ring, connectionId); }
  catch { throw new Error('Stored credentials cannot be decrypted; restore the approved read key or reconnect'); }
  if (!forceRefresh && Number.isFinite(tokens.expiresAt) && tokens.expiresAt >= Date.now() + 60000)
    return { connection, accessToken: z.string().min(1).parse(tokens.accessToken) };
  const clientId = z.string().min(1).parse(env.ZOHO_CLIENT_ID);
  const clientSecret = z.string().min(1).parse(env.ZOHO_CLIENT_SECRET);
  const refreshToken = z.string().min(1).parse(tokens.refreshToken);
  const lease = crypto.randomUUID();
  const start = await check(await db.rpc('zoho_begin_connection_refresh', { p_connection: connectionId,
    p_generation: connection.credential_generation, p_expected: envelope, p_lease: lease }));
  if (!start?.acquired) {
    if (start?.changed && start.envelope) {
      tokens = await openTokens(start.envelope, ring, connectionId);
      if (Number.isFinite(tokens.expiresAt) && tokens.expiresAt >= Date.now() + 60000)
        return { connection, accessToken: z.string().min(1).parse(tokens.accessToken) };
    }
    throw new RecruitFailure('SOURCE_UNAVAILABLE', 60);
  }
  const quota = createConnectionQuota(db, connectionId);
  const reservation = await quota.reserve('oauth');
  if (!reservation?.granted) {
    await check(await db.rpc('zoho_cancel_connection_refresh', { p_connection: connectionId, p_generation: connection.credential_generation, p_lease: lease }));
    throw new RecruitFailure('RATE_LIMITED', reservation?.retryAfterSeconds || 60);
  }
  let status = 0; let retry = 0;
  try {
    await check(await db.rpc('zoho_mark_connection_refresh', { p_connection: connectionId,
      p_generation: connection.credential_generation, p_lease: lease }));
    const response = await rawRecruitJson(`${ZOHO_HOSTS[connection.region].accounts}/oauth/v2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    }, async (url, options) => { const response = await fetcher(url, options); status = response.status; retry = retrySeconds(response); return response; });
    const refreshed = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(response);
    tokens = { ...tokens, accessToken: refreshed.access_token, expiresAt: Date.now() + refreshed.expires_in * 1000 };
    envelope = await sealTokens(tokens, ring, connectionId);
    await check(await db.rpc('zoho_finish_connection_refresh', { p_connection: connectionId,
      p_generation: connection.credential_generation, p_lease: lease, p_envelope: envelope }));
    return { connection, accessToken: tokens.accessToken };
  } finally { await quota.settle(reservation.reservationId, status, retry); }
}
