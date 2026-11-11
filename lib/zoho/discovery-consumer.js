import { readZohoConfig, ZOHO_DEFAULTS } from './config';
// Background module hosted by the existing sp-dash runtime; no separate deployment.
import { z } from 'zod';
import { normalizeRecruitRecord, safeSourceId, MODULES, ZOHO_REGIONS } from './contracts';
import { openTokens, sealTokens, tokenKeyring, hasTokenKeyring } from './token-vault';
import { ZOHO_HOSTS, recruitJson, RecruitFailure } from './oauth';
import { discoveryCommand } from './discovery-client';
import { discoveryStatus } from './discovery-readiness';
import { createDiscoveryQuota } from './source-quota';
import { resolveJobReadSchema } from './job-fields';

const environment = z.object({ ZOHO_CLIENT_ID: z.string().min(1), ZOHO_CLIENT_SECRET: z.string().min(1) });
// Schema names only, scoped by connection, module and credential generation.
// Expiry/eviction affects performance, never organization authority or tokens.
const modificationFields = new Map();
const broadCredentials = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SKILLPASSPORT_SERVICE_ROLE_KEY', 'DATABASE_URL'];
function configured(env) {
  return environment.safeParse(env).success && hasTokenKeyring(env) && !broadCredentials.some(key => env[key] !== undefined) &&
    typeof env.ZOHO_DISCOVERY_AUTHORITY?.fetch === 'function';
}
const claimSchema = z.object({ claimed: z.literal(true), lease: z.string().uuid(),
  run: z.object({ id: z.string().uuid(), module: z.enum(MODULES), page_size: z.number().int().min(1).max(200).default(10), next_page: z.number().int().min(1).max(500000), config_revision: z.number().int().positive(), modified_since: z.string().datetime({ offset: true }).nullable().optional() }),
  source: z.object({ id: z.string().uuid(), region: z.enum(ZOHO_REGIONS), credential_generation: z.number().int().nonnegative() }), envelope: z.unknown() });
export async function discoverPage(runId, env, fetcher = fetch) {
  if (!configured(env)) throw new Error('Restricted discovery configuration required');
  z.string().uuid().parse(runId);
  const command = (name, body) => discoveryCommand(env.ZOHO_DISCOVERY_AUTHORITY, name, body);
  const claimed = await command('claim', { runId });
  if (claimed?.claimed === false) return { done: true };
  const { run, source, envelope, lease } = claimSchema.parse(claimed);
  const quota = createDiscoveryQuota(command, runId, lease);
  if (run.id !== runId) throw new Error('Discovery grant mismatch');
  try {
    const hosts = ZOHO_HOSTS[source.region];
    let tokens = await openTokens(envelope, tokenKeyring(env), source.id);
    let currentEnvelope = envelope;
    let renewed = false;
    async function refresh() {
      renewed = true;
      // SQL serializes refreshes per connection, and returns a newer envelope if
      // another page already renewed these credentials. No process-local lock.
      const start = await command('refresh-start', { runId, lease, envelope: currentEnvelope });
      if (start?.acquired === false && start.changed === true && start.envelope) {
        currentEnvelope = start.envelope;
        tokens = await openTokens(currentEnvelope, tokenKeyring(env), source.id);
        return;
      }
      if (start?.acquired !== true) throw new RecruitFailure('SOURCE_UNAVAILABLE', 30);
      const response = await recruitJson(`${hosts.accounts}/oauth/v2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: tokens.refreshToken }) }, fetcher, quota);
      const refreshed = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(response);
      tokens = { ...tokens, accessToken: refreshed.access_token, expiresAt: Date.now() + refreshed.expires_in * 1000 };
      currentEnvelope = await sealTokens(tokens, tokenKeyring(env), source.id);
      await command('refresh', { runId, lease, envelope: currentEnvelope });
    }
    if (tokens.expiresAt < Date.now() + 60000) await refresh();
    const fieldKey = `${source.id}:${source.region}:${source.credential_generation}:${run.module}`;
    const cachedField = modificationFields.get(fieldKey);
    let modifiedField = cachedField?.expiresAt > Date.now() ? cachedField.name : 'Modified_Time';
    let fields = run.module === 'Candidates' ? 'id,Modified_Time,First_Name,Last_Name,Email' : 'id,Modified_Time,Posting_Title,Client_Name,City,Job_Type,Job_Description,Job_Opening_Status,Application_Link';
    // Recruit's live endpoint rejects converted=both. Read both boolean streams
    // at the same durable page, using its persisted size for both streams.
    // Commit only after BOTH reads succeed, so failure never skips a stream.
    // https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
    // Provider limits/errors must fail this run rather than imply full inventory.
    const endpoint = new URL(`/recruit/v2/${run.module}`, hosts.api);
    const authorizedRead = async (target, conditional = false) => {
      const fetchRead = () => recruitJson(target, { headers: { Authorization: `Zoho-oauthtoken ${tokens.accessToken}`,
      ...(conditional && run.modified_since ? { 'If-Modified-Since': run.modified_since } : {}) } }, async (url, init) => {
        const result = await fetcher(url, init);
        return conditional && run.modified_since && result.status === 304 ? new Response(null, { status: 204 }) : result;
      }, quota);
      try { return await fetchRead(); }
      catch (error) {
        if (!(error instanceof RecruitFailure) || error.code !== 'ACCESS_UNAUTHORIZED' || renewed) throw error;
        await refresh();
        return fetchRead();
      }
    };
    const schema = run.module === 'Job_Openings' ? await resolveJobReadSchema(
      `rest:${fieldKey}:${run.config_revision}`,
      module => authorizedRead(`${hosts.api}/recruit/v2/settings/fields?module=${module}`)) : null;
    const companyField = schema?.companyField || 'Client_Name';
    fields = fields.replace('Client_Name', companyField).replace('Posting_Title',schema?.titleField || 'Posting_Title');
    if(schema && !schema.optionalApplicationLink) fields=fields.split(',').filter(field=>field!=='Application_Link').join(',');
    const pageSchema = z.object({ data: z.array(z.record(z.unknown())).max(run.page_size), info: z.object({ more_records: z.boolean() }) });
    const read = async converted => {
      endpoint.search = new URLSearchParams({ fields: fields.replace('Modified_Time', modifiedField), per_page: String(run.page_size), page: String(run.next_page), converted, approved: 'both', '$state': 'save', sort_by: 'id', sort_order: 'asc' }).toString();
      return pageSchema.parse(await authorizedRead(endpoint.href, true));
    };
    const pages = [];
    for (const converted of ['false', 'true']) {
      let page = await read(converted);
      if (page.data.some(row => safeSourceId(row.id) !== null && row[modifiedField] === undefined)) {
        // Tenant API names can differ from the default. Resolve the original
        // system field from metadata; never guess from arbitrary record keys.
        const metadata = await authorizedRead(`${hosts.api}/recruit/v2/settings/fields?module=${run.module}`);
        const candidates = Array.isArray(metadata.fields) && metadata.fields.filter(field =>
          field.custom_field === false && field.data_type === 'datetime' && field.field_label === 'Modified Time' &&
          typeof field.api_name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(field.api_name));
        if (!candidates || candidates.length !== 1) throw new RecruitFailure('SOURCE_INVALID');
        modifiedField = candidates[0].api_name;
        if (modificationFields.size >= 100) modificationFields.delete(modificationFields.keys().next().value);
        modificationFields.set(fieldKey, { name: modifiedField, expiresAt: Date.now() + 300000 });
        page = await read(converted);
      }
      pages.push({ ...page, data: page.data.map(row => ({ ...row, Modified_Time: row[modifiedField] })) });
    }
    const records = new Map(); const issues = [];
    for (const record of pages.flatMap(page => page.data)) {
      try {
        const normalized = normalizeRecruitRecord(run.module, record, companyField, schema?.titleField);
        const previous = records.get(normalized.externalId);
        // A record can change conversion state between the two reads. Retain
        // its newest observed version, without duplicating a destination action.
        if (!previous || Date.parse(normalized.modified) >= Date.parse(previous.modified)) records.set(normalized.externalId, normalized);
      }
      catch { issues.push({ externalId: safeSourceId(record.id), code: 'SOURCE_SCHEMA_INVALID' }); }
    }
    return await command('commit', { runId, lease, page: run.next_page, records: [...records.values()], issues, more: pages.some(page => page.info.more_records) });
  } catch (error) {
    // The logical retry budget belongs to the database run, not queue deliveries.
    // Storage failures remain retryable; their abandoned lease consumes budget.
    if (!(error instanceof RecruitFailure) && !(error instanceof z.ZodError)) throw error;
    await command('failure', { runId, lease, code: error instanceof RecruitFailure ?
      (error.code === 'ACCESS_UNAUTHORIZED' ? 'AUTH_REVOKED' : error.code) : 'SOURCE_INVALID',
      retryAfterSeconds: error instanceof RecruitFailure ? error.retryAfterSeconds : 0 });
    return { done: true };
  }
}

export const discoveryConsumer = {
  async fetch(request, env) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/readiness') return new Response('Not found', { status: 404 });
    const ready = readZohoConfig(env).discovery && configured(env) &&
      await discoveryStatus(env.ZOHO_DISCOVERY_AUTHORITY, env.ZOHO_DISCOVERY_QUEUE);
    return Response.json({ version: 1, ready, emailPolicy: 'forbidden', stagingOnly: true }, { headers: { 'Cache-Control': 'no-store' } });
  },
  async queue(batch, env) {
    if (!readZohoConfig(env).discovery || !configured(env)) {
      for (const item of batch.messages) item.retry({ delaySeconds: ZOHO_DEFAULTS.retryDelaySeconds }); return;
    }
    for (const message of batch.messages) {
      if (!z.object({ runId: z.string().uuid() }).strict().safeParse(message.body).success) { message.ack(); continue; }
      try {
        const result = await discoverPage(message.body.runId, env);
        if (!result.done) await env.ZOHO_DISCOVERY_QUEUE.send({ runId: result.runId }, { delaySeconds: 10 });
        message.ack();
      } catch {
        console.error(JSON.stringify({ event: 'zoho_discovery_retry', messageId: message.id }));
        message.retry({ delaySeconds: ZOHO_DEFAULTS.retryDelaySeconds });
      }
    }
  },
  async scheduled(_controller, env) {
    if (!readZohoConfig(env).discovery || !configured(env)) return;
    await discoveryCommand(env.ZOHO_DISCOVERY_AUTHORITY, 'recover-deferred', {});
    const pending = z.array(z.object({ id: z.string().uuid(), transport: z.enum(['rest','bulk']).default('rest'), bulkRunId: z.string().uuid().nullable().optional() })).max(10)
      .parse(await discoveryCommand(env.ZOHO_DISCOVERY_AUTHORITY, 'due', { bulkAvailable: env.ZOHO_BULK_AVAILABLE === true }));
    for (const run of pending) {
      if (run.transport === 'bulk' && !run.bulkRunId) throw new Error('Bulk reference missing');
      await env.ZOHO_DISCOVERY_QUEUE.send(run.transport === 'bulk' ? { bulkRunId: run.bulkRunId } : { runId: run.id });
    }
  },
};
