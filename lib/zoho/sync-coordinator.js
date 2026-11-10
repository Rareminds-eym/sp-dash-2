import { z } from 'zod';
import { sourceProcessingEnabled } from './config';
import { hasTokenKeyring } from './token-vault';
import { oauthConfiguration } from './oauth';

const scope = z.object({ connectionId: z.string().uuid(), expectedConfigRevision: z.number().int().positive() });
export const syncPolicySchema = scope.extend({ module: z.enum(['Candidates', 'Job_Openings']), enabled: z.boolean(),
  intervalMinutes: z.number().int().min(5).max(1440), reconciliationDays: z.number().int().min(1).max(30), preferBulk: z.boolean() }).strict();
const credentialSchema = scope.strict();
export function bulkDiscoveryAvailable(env = {}) {
  return sourceProcessingEnabled(env) && ['get', 'put', 'delete'].every(method => typeof env.SKILLPASSPORT_ASSETS?.[method] === 'function') && hasTokenKeyring(env) && oauthConfiguration(env).success;
}
export async function webhookHash(secret) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))), b => b.toString(16).padStart(2, '0')).join('');
}
async function rpc(db, name, args) {
  const result = await db.rpc(name, args);
  if (result.error) throw Object.assign(new Error('Synchronization state unavailable'), { code: result.error.code });
  return result.data;
}
export function syncCoordinator(db) {
  return {
    snapshot(connectionId) { return rpc(db, 'zoho_sync_snapshot', { p_connection: z.string().uuid().parse(connectionId) }); },
    async configure(input, actor) {
      const v = syncPolicySchema.parse(input);
      return rpc(db, 'zoho_configure_sync', { p_connection: v.connectionId, p_module: v.module, p_config: v.expectedConfigRevision,
        p_enabled: v.enabled, p_interval: v.intervalMinutes, p_reconciliation: v.reconciliationDays, p_bulk: v.preferBulk, p_actor: z.string().uuid().parse(actor) });
    },
    async rotateWebhook(input, actor) {
      const v = credentialSchema.parse(input);
      const secret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      await rpc(db, 'zoho_rotate_webhook', { p_connection: v.connectionId, p_config: v.expectedConfigRevision, p_hash: await webhookHash(secret), p_actor: z.string().uuid().parse(actor) });
      return { secret, emailPolicy: 'forbidden' }; // Display once; only its hash is persisted.
    },
  };
}
const hintSchema = z.object({ connectionId: z.string().uuid(), module: z.enum(['Candidates', 'Job_Openings']),
  secret: z.string().regex(/^[A-Za-z0-9_-]{43}$/), externalId: z.string().regex(/^\d{1,40}$/).optional() }).strict();
/** Workflow notifications are hints, never source data or authority to approve. */
export async function acceptSyncWebhook(request, db) {
  const respond = (value, status) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  if (new URL(request.url).search) return respond({ error: 'Use POST body parameters' }, 400);
  const reader = request.body?.getReader();
  if (!reader) return respond({ error: 'Invalid notification' }, 400);
  let bytes = 0; const chunks = [];
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 4096) { await reader.cancel(); return respond({ error: 'Notification too large' }, 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  try {
    const combined = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(combined);
    const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    let input;
    if (type === 'application/json') input = JSON.parse(text);
    else if (type === 'application/x-www-form-urlencoded') {
      const params = new URLSearchParams(text);
      if ([...new Set(params.keys())].some(key => params.getAll(key).length !== 1)) throw new Error('Duplicate parameter');
      input = Object.fromEntries(params);
    } else return respond({ error: 'Unsupported notification format' }, 415);
    const v = hintSchema.parse(input);
    const accepted = await rpc(db, 'zoho_accept_sync_hint', { p_connection: v.connectionId, p_module: v.module, p_hash: await webhookHash(v.secret) });
    if (accepted !== true) return respond({ error: 'Notification authorization failed' }, 401);
    return respond({ accepted: true, stagingOnly: true }, 202);
  } catch (error) {
    return respond({ error: error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError || error.message === 'Duplicate parameter' ? 'Invalid notification' : 'Notification storage unavailable' },
      error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError || error.message === 'Duplicate parameter' ? 400 : 503);
  }
}
