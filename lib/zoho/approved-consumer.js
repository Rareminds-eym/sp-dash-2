// Background module hosted by the existing sp-dash runtime; no separate deployment.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { approvedMessage, destinationFor, destinationReady, executeApprovedOperation } from './approved-execution';

const config = z.object({ SUPABASE_URL: z.string().url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) });
function database(env) {
  const parsed = config.parse(env);
  return createClient(parsed.SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
}
export async function capabilities(env) {
  const disabled = { ready: false, modules: [] };
  if (env.ZOHO_EXECUTION_ENABLED !== 'true' || !config.safeParse(env).success ||
    typeof env.ZOHO_APPROVED_QUEUE?.sendBatch !== 'function' || typeof env.ZOHO_APPROVER_AUTHORITY?.checkApprover !== 'function' ||
    typeof env.ZOHO_APPROVER_AUTHORITY?.recordApproval !== 'function' || typeof env.ZOHO_APPROVER_AUTHORITY?.validateApproval !== 'function') return disabled;
  const modules = [];
  for (const module of ['Candidates', 'Job_Openings']) if (await destinationReady(destinationFor(env, module), module)) modules.push(module);
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
export async function recoverDispatch(db, queue, modules, now = new Date().toISOString(), readableModules = modules) {
  if (!modules.length && !readableModules.length) return;
  const actions = selected => selected.map(module => module === 'Candidates' ? 'provision_candidate' : 'apply_job');
  const checks = await Promise.allSettled([
    modules.length ? db.from('zoho_approved_operations').select('id').in('action', actions(modules)).in('state', ['queued', 'failed']).lt('execution_attempts', 8)
      .lte('next_attempt_at', now).order('next_attempt_at').limit(25) : Promise.resolve({ data: [] }),
    readableModules.length ? db.rpc('zoho_schedule_reconciliation', { p_actions: actions(readableModules) }) : Promise.resolve({ data: [] }),
  ]);
  const pending = checks[0].status === 'fulfilled' ? checks[0].value : { error: true };
  const unresolved = checks[1].status === 'fulfilled' ? checks[1].value : { error: true };
  // A paused/unavailable writer must not strand independent committed receipts.
  const messages = [
    ...(!pending.error ? pending.data.map(row => ({ body: { operationId: row.id, mode: 'execute' } })) : []),
    ...(!unresolved.error ? unresolved.data.map(row => ({ body: { operationId: row.id, mode: 'reconcile' } })) : []),
  ];
  if (messages.length) await queue.sendBatch(messages);
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
    const status = needsExecution ? await capabilities(env) : { ready: false, modules: [] };
    const recovery = receiptCapabilities(env);
    if (!status.ready && !recovery.ready) { for (const item of batch.messages) item.retry({ delaySeconds: 300 }); return; }
    let db;
    const storage = () => db ??= dependencies.database ? dependencies.database() : database(env);
    for (const message of batch.messages) {
      const parsed = approvedMessage.safeParse(message.body);
      if (!parsed.success) { message.ack(); continue; }
      const modules = parsed.data.mode === 'reconcile' ? recovery.modules : status.modules;
      if (!modules.length) { message.retry({ delaySeconds: 300 }); continue; }
      try {
        const module = await operationModule(storage(), parsed.data.operationId);
        if (!module) { message.ack(); continue; }
        if (!modules.includes(module)) { message.retry({ delaySeconds: 300 }); continue; }
        await executeApprovedOperation(storage(), parsed.data, env);
        message.ack();
      } catch {
        console.error(JSON.stringify({ event: 'zoho_approved_retry', messageId: message.id }));
        message.retry({ delaySeconds: 300 });
      }
    }
  },
  async scheduled(_controller, env, dependencies = {}) {
    const status = await capabilities(env);
    const recovery = receiptCapabilities(env);
    if (!status.ready && !recovery.ready) return;
    await recoverDispatch(dependencies.database ? dependencies.database() : database(env), env.ZOHO_APPROVED_QUEUE,
      status.modules, new Date().toISOString(), recovery.modules);
  },
};
