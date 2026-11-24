import { createClient } from '@supabase/supabase-js';
import { skillpassportDbConfig } from '../skillpassport-db-config';

/** Application-owned queue/database access. The embedding service receives only
 * document text and a task type, and returns a vector plus provider metadata. */
export async function processJobIndex(env, dependencies = {}) {
  if (!dependencies.embed && typeof env.EMBEDDING_SERVICE?.embedText !== 'function') throw new Error('JOB_INDEX_PROVIDER_UNAVAILABLE');
  let db;
  const database = () => {
    if (!db) {
      const config = skillpassportDbConfig(env);
      if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) throw new Error('JOB_INDEX_DB_UNCONFIGURED');
      db = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
      });
    }
    return db;
  };
  const readIndexModel = dependencies.readIndexModel || (async () => {
    const result = await database().from('job_index_control').select('model').eq('singleton', true).single();
    if (result.error) throw new Error('JOB_INDEX_DB_UNAVAILABLE');
    return result.data?.model;
  });
  const readCapabilities = dependencies.readCapabilities || (async () => {
    if (typeof env.EMBEDDING_SERVICE?.getCapabilities !== 'function') throw new Error('JOB_INDEX_PROVIDER_UNAVAILABLE');
    let value;
    try {
      value = await env.EMBEDDING_SERVICE.getCapabilities();
      return { model: value.model, dimensions: value.dimensions, task_types: Array.from(value.task_types || []) };
    } finally { value?.[Symbol.dispose]?.(); }
  });
  // The stored index contract is authoritative; provider changes never rotate it
  // implicitly. Check before claiming so configuration errors consume no leases.
  const model = await readIndexModel();
  if (typeof model !== 'string' || !model.trim() || model !== model.trim()) throw new Error('JOB_INDEX_MODEL_UNCONFIGURED');
  const capabilities = await readCapabilities();
  if (capabilities?.model !== model) throw new Error('JOB_INDEX_MODEL_MISMATCH');
  if (capabilities.dimensions !== 1536 || !Array.isArray(capabilities.task_types) ||
    !capabilities.task_types.includes('RETRIEVAL_DOCUMENT')) throw new Error('JOB_INDEX_PROVIDER_INCOMPATIBLE');
  const rpc = dependencies.rpc || (async (name, args) => {
    const result = await database().rpc(name, args);
    if (result.error) throw new Error('JOB_INDEX_DB_UNAVAILABLE');
    return result.data;
  });
  const embed = dependencies.embed || (async text => {
    let value;
    try {
      value = await env.EMBEDDING_SERVICE.embedText(text, 'RETRIEVAL_DOCUMENT');
      return { model: value.model, embedding: Array.from(value.embedding || []) };
    } finally { value?.[Symbol.dispose]?.(); }
  });
  const sleep = dependencies.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  await rpc('reconcile_job_index', { p_model: model });
  const claims = await rpc('claim_job_index', { p_model: model, p_limit: 8 });
  if (!Array.isArray(claims) || claims.length > 8) throw new Error('JOB_INDEX_CLAIM_INVALID');
  const results = [];
  for (let i = 0; i < claims.length; i += 2) {
    await Promise.all(claims.slice(i, i + 2).map(async (claim, offset) => {
      await sleep(offset * 750);
      const result = { id: claim.id, input_hash: claim.input_hash, lease_token: claim.lease_token };
      try {
        const value = await embed(claim.input_text);
        if (value.model !== model) result.error = 'MODEL_MISMATCH';
        else if (!Array.isArray(value.embedding) || value.embedding.length !== 1536 ||
          !value.embedding.every(Number.isFinite) || !value.embedding.some(n => n !== 0)) result.error = 'INVALID_VECTOR';
        else result.embedding = JSON.stringify(value.embedding);
      } catch (error) {
        // Worker RPC errors carry stable prefixes, not provider response bodies.
        const limited = /^RATE_LIMIT_EXCEEDED:/.test(String(error?.message || ''));
        result.error = limited ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE';
        if (limited) {
          const seconds = /Retry after (\d+)s/.exec(String(error.message))?.[1];
          result.retry_after_seconds = Math.max(60, Math.min(86400, Number(seconds) || 60));
        }
      }
      results.push(result);
    }));
    if (i + 2 < claims.length) await sleep(750);
  }
  if (results.length) await rpc('finish_job_index_batch', { p_model: model, p_results: results });
  const status = await rpc('job_index_dispatch_status', { p_model: model });
  if (status?.managed !== true || status.next_attempt_at !== null && !Number.isFinite(Date.parse(status?.next_attempt_at)))
    throw new Error('JOB_INDEX_STATUS_INVALID');
  return status;
}
