import { ZOHO_DEFAULTS, readZohoConfig } from './config';
// Background module hosted by the existing sp-dash runtime; no separate deployment.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { bounded, approvedMessage, destinationFor, destinationReady, executeApprovedOperation } from './approved-execution';

const config = z.object({ SUPABASE_URL: z.string().url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) });
function database(env) {
  const parsed = config.parse(env);
  return createClient(parsed.SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(ZOHO_DEFAULTS.requestTimeoutMs) }) },
  });
}
// Invocation-local only: never cache live approver/evidence checks or share readiness
// between requests. Destination writes still enforce their own private boundaries.
export function destinationReadiness(env) {
  const probes = new Map();
  return module => {
    const previous = probes.get(module);
    if (previous && previous.expires > Date.now()) return previous.promise;
    const promise = destinationReady(destinationFor(env, module), module);
    probes.set(module, { promise, expires: Date.now() + ZOHO_DEFAULTS.dependencyTimeoutMs });
    return promise;
  };
}
export async function capabilities(env, ready = destinationReadiness(env)) {
  const disabled = { ready: false, modules: [] };
  if (!readZohoConfig(env).execution || !config.safeParse(env).success ||
    typeof env.ZOHO_APPROVED_QUEUE?.sendBatch !== 'function' || typeof env.ZOHO_APPROVER_AUTHORITY?.checkApprover !== 'function' ||
    typeof env.ZOHO_APPROVER_AUTHORITY?.recordApproval !== 'function' || typeof env.ZOHO_APPROVER_AUTHORITY?.validateApproval !== 'function') return disabled;
  const modules = [];
  for (const module of ['Candidates', 'Job_Openings']) if (await ready(module)) modules.push(module);
  return modules.length ? { version: 1, ready: true, emailPolicy: 'forbidden', approvalRequired: true,
    durableDispatch: true, receiptRecovery: true, modules } : disabled;
}
/** Receipt reads are independent of write policy, approver and current leases.
 * recoveryEnabled is an internal runtime value, derived from its existing background gates.
 */
export function receiptCapabilities(env) {
  if (env.recoveryEnabled !== true || !config.safeParse(env).success || typeof env.ZOHO_APPROVED_QUEUE?.sendBatch !== 'function')
    return { ready: false, modules: [] };
  const modules = ['Candidates', 'Job_Openings'].filter(module => typeof destinationFor(env, module)?.findOperationReceipt === 'function');
  return { ready: modules.length > 0, modules };
}
export async function recoverDispatch(db, queue, modules, now = new Date().toISOString(), readableModules = modules, options = {}) {
  if (!modules.length && !readableModules.length) return;
  const actions = selected => selected.map(module => module === 'Candidates' ? 'provision_candidate' : 'apply_job');
  const checks = await Promise.allSettled([
    modules.length ? db.from('zoho_approved_operations').select('id').in('action', actions(modules)).in('state', ['queued', 'failed']).lt('execution_attempts', 8)
      .gt('expires_at', now).lte('next_attempt_at', now).order('next_attempt_at').order('id').limit(25) : Promise.resolve({ data: [] }),
    readableModules.length ? db.rpc('zoho_schedule_reconciliation', { p_actions: actions(readableModules) }) : Promise.resolve({ data: [] }),
  ]);
  const pending = checks[0].status === 'fulfilled' ? checks[0].value : { error: true };
  const unresolved = checks[1].status === 'fulfilled' ? checks[1].value : { error: true };
  // A paused/unavailable writer must not strand independent committed receipts.
  let receipts = !unresolved.error ? unresolved.data : [];
  if (options.reconcile && receipts.length) {
    const fallback = [], started = Date.now();
    for (let offset=0; offset<receipts.length; offset+=3) {
      if (Date.now()-started>=15000) { fallback.push(...receipts.slice(offset)); break; }
      const group=receipts.slice(offset,offset+3);
      const outcomes=await Promise.allSettled(group.map(row=>bounded(()=>options.reconcile(row.id), Math.max(1,15000-(Date.now()-started)))));
      outcomes.forEach((outcome,index)=>{ if(outcome.status==='rejected')fallback.push(group[index]); });
    }
    receipts=fallback;
  }
  const messages = [
    ...(!pending.error ? pending.data.map(row => ({ body: { operationId: row.id, mode: 'execute' } })) : []),
    ...receipts.map(row => ({ body: { operationId: row.id, mode: 'reconcile' } })),
  ];
  // A failed inline read can return all 100 receipts alongside 25 execution intents.
  // Keep each platform queue request within its 100-message batch limit.
  for (let offset=0; offset<messages.length; offset+=100) await queue.sendBatch(messages.slice(offset,offset+100));
  if (pending.error || unresolved.error) throw new Error('Dispatch recovery storage unavailable');
}
async function operationModule(db, operationId) {
  const { data, error } = await db.from('zoho_approved_operations').select('action').eq('id', operationId).single();
  if (error) throw new Error('Operation scope unavailable');
  if (!data) return null;
  return data.action === 'provision_candidate' ? 'Candidates' : data.action === 'apply_job' ? 'Job_Openings' : null;
}
// This coordinator has no email provider/queue and cannot discover or approve source records.
export const approvedConsumer = {
  async fetch(request, env) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/readiness') return new Response('Not found', { status: 404 });
    return Response.json(await capabilities(env), { headers: { 'Cache-Control': 'no-store' } });
  },
  async queue(batch, env, dependencies = {}) {
    const needsExecution = batch.messages.some(message => { const parsed = approvedMessage.safeParse(message.body); return parsed.success && parsed.data.mode === 'execute'; });
    const ready = destinationReadiness(env);
    const status = needsExecution ? await capabilities(env, ready) : { ready: false, modules: [] };
    const recovery = receiptCapabilities(env);
    if (!status.ready && !recovery.ready) { for (const item of batch.messages) item.retry({ delaySeconds: ZOHO_DEFAULTS.retryDelaySeconds }); return; }
    let db;
    const storage = () => db ??= dependencies.database ? dependencies.database() : database(env);
    for (const message of batch.messages) {
      const parsed = approvedMessage.safeParse(message.body);
      if (!parsed.success) { message.ack(); continue; }
      const modules = parsed.data.mode === 'reconcile' ? recovery.modules : status.modules;
      if (!modules.length) { message.retry({ delaySeconds: ZOHO_DEFAULTS.retryDelaySeconds }); continue; }
      try {
        const module = await operationModule(storage(), parsed.data.operationId);
        if (!module) { message.ack(); continue; }
        if (!modules.includes(module)) { message.retry({ delaySeconds: ZOHO_DEFAULTS.retryDelaySeconds }); continue; }
        await executeApprovedOperation(storage(), parsed.data, env, { ready });
        message.ack();
      } catch {
        console.error(JSON.stringify({ event: 'zoho_approved_retry', messageId: message.id }));
        message.retry({ delaySeconds: ZOHO_DEFAULTS.retryDelaySeconds });
      }
    }
  },
  async scheduled(_controller, env, dependencies = {}) {
    const status = await capabilities(env);
    const recovery = receiptCapabilities(env);
    if (!status.ready && !recovery.ready) return;
    const db = dependencies.database ? dependencies.database() : database(env);
    await recoverDispatch(db, env.ZOHO_APPROVED_QUEUE, status.modules, new Date().toISOString(), recovery.modules,
      { reconcile: operationId => executeApprovedOperation(db, { operationId, mode: 'reconcile' }, env) });
  },
};
