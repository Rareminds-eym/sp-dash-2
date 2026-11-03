import { z } from 'zod';

const uuid = z.string().uuid();
const base = z.object({ runId: uuid, lease: uuid }).strict();
const envelope = z.object({ version: z.literal(1), iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  keyId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).optional(), ciphertext: z.string().min(24).max(32768).regex(/^[A-Za-z0-9+/=]+$/) }).strict();
const candidate = z.object({ email: z.string().max(320), name: z.string().max(301) }).strict();
const job = z.object({ title: z.string().max(500), company_name: z.string().max(300), department: z.string().max(150),
  location: z.string().max(304), employment_type: z.string().max(100), description: z.string().max(32000),
  source_status: z.string().max(100), application_link: z.string().max(2048) }).strict();
const record = z.object({ externalId: z.string().regex(/^\d{1,40}$/), modified: z.string().datetime({ offset: true }),
  data: z.union([candidate, job]), errors: z.array(z.string().max(500)).max(20) }).strict();
const commands = {
  'quota-reserve': [base.extend({ kind: z.enum(['read','oauth','bulk']) }), 'zoho_reserve_discovery_quota', b => ({ p_run: b.runId, p_lease: b.lease, p_kind: b.kind })],
  'quota-settle': [base.extend({ reservationId: uuid, status: z.number().int().min(0).max(599), retryAfterSeconds: z.number().int().min(0).max(86400) }), 'zoho_settle_discovery_quota', b => ({ p_run: b.runId, p_lease: b.lease, p_reservation: b.reservationId, p_status: b.status, p_retry_after: b.retryAfterSeconds })],
  claim: [z.object({ runId: uuid }).strict(), 'zoho_claim_discovery', b => ({ p_run: b.runId })],
  refresh: [base.extend({ envelope }), 'zoho_refresh_discovery_tokens', b => ({ p_run: b.runId, p_lease: b.lease, p_envelope: b.envelope })],
  'refresh-start': [base.extend({ envelope }), 'zoho_begin_discovery_refresh', b => ({ p_run: b.runId, p_lease: b.lease, p_expected: b.envelope })],
  commit: [base.extend({ page: z.number().int().min(1).max(500000), records: z.array(record).max(20),
    issues: z.array(z.object({ externalId: z.string().regex(/^\d{1,40}$/).nullable(), code: z.literal('SOURCE_SCHEMA_INVALID') }).strict()).max(20), more: z.boolean() })
    .refine(b => b.records.length + b.issues.length <= 20), 'zoho_commit_claimed_discovery',
  b => ({ p_run: b.runId, p_lease: b.lease, p_page: b.page, p_records: b.records, p_issues: b.issues, p_more: b.more })],
  failure: [base.extend({ code: z.enum(['SOURCE_UNAVAILABLE','RATE_LIMITED','AUTH_REVOKED','PERMISSION_DENIED','SOURCE_INVALID']),
    retryAfterSeconds: z.number().int().min(0).max(86400) }), 'zoho_fail_discovery',
  b => ({ p_run: b.runId, p_lease: b.lease, p_code: b.code, p_retry_after: b.retryAfterSeconds })],
  due: [z.object({}).strict(), 'zoho_due_discovery', () => ({})],
  'recover-deferred': [z.object({}).strict(), 'zoho_recover_deferred', () => ({})],
};
async function boundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1048576) { await reader.cancel(); throw new Error('Body limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function stagingAuthority(request, db) {
  const command = commands[new URL(request.url).pathname.slice(1)];
  if (request.method !== 'POST' || !Object.hasOwn(commands, new URL(request.url).pathname.slice(1)))
    return new Response('Not found', { status: 404 });
  let body;
  try { body = command[0].parse(await boundedBody(request)); }
  catch { return Response.json({ error: 'Invalid staging command' }, { status: 400 }); }
  try {
    const result = await db.rpc(command[1], command[2](body));
    if (result.error) return Response.json({ error: 'Staging unavailable' }, { status: result.error.code === '40001' ? 409 : 503 });
    return Response.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Staging unavailable' }, { status: 503 }); }
}
