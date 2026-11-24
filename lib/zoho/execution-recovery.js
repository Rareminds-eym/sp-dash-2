import { z } from 'zod';
import { readZohoConfig } from './config';
import { integrationRuntime } from './runtime';
import { bounded } from './approved-execution';
import { executorStatus } from './executor';

const inputSchema = z.object({ connectionId: z.string().uuid(), module: z.enum(['Candidates', 'Job_Openings']) }).strict();
const unavailable = () => Object.assign(new Error('Execution recovery is unavailable. Restore the background worker and try again.'), { integrationUnavailable: true });

/** Re-dispatch existing approved intents only. SQL claims and destination receipts retain all write fences. */
export async function recoverSourceExecutions(db, env, input, dependencies = {}) {
  const value = inputSchema.parse(input);
  const policy = readZohoConfig(env), queue = env.ZOHO_APPROVED_QUEUE;
  if (!policy.background || typeof queue?.sendBatch !== 'function') throw unavailable();
  const runtime = (dependencies.runtime || integrationRuntime)(env);
  const ready = await (dependencies.status || executorStatus)(runtime.executor, queue);
  const canExecute = ready.ready === true && ready.modules.includes(value.module);
  const action = value.module === 'Candidates' ? 'provision_candidate' : 'apply_job';
  const now = new Date().toISOString();
  const base = () => db.from('zoho_approved_operations')
    .select('id,zoho_staged_records!inner(connection_id)')
    .eq('zoho_staged_records.connection_id', value.connectionId).eq('action', action);
  const results = await Promise.all([
    canExecute ? base().in('state', ['queued', 'failed']).lt('execution_attempts', 8)
      .gt('expires_at', now).lte('next_attempt_at', now).order('next_attempt_at').order('id').limit(25)
      : Promise.resolve({ data: [], error: null }),
    // Receipt reads are safe after expiry, retry exhaustion, or a source pause.
    base().eq('state', 'processing').or(`last_error.eq.OUTCOME_UNKNOWN,lease_expires_at.lte.${now}`)
      .order('next_reconcile_at').order('id').limit(25),
  ]);
  if (results.some(result => result.error || !Array.isArray(result.data))) throw unavailable();
  const messages = results.flatMap((result, index) => result.data.map(row => {
    if (!z.string().uuid().safeParse(row.id).success || row.zoho_staged_records?.connection_id !== value.connectionId) throw unavailable();
    return { body: { operationId: row.id, mode: index === 0 ? 'execute' : 'reconcile' } };
  }));
  let checkedNow = 0, confirmedCompletions = 0;
  const checked = new Set(), started = Date.now();
  if (typeof runtime.reconcileReceipt === 'function') {
    const receipts = messages.filter(message=>message.body.mode==='reconcile');
    for (let offset=0;offset<receipts.length && Date.now()-started<15000;offset+=3) {
      const group = receipts.slice(offset,offset+3);
      const outcomes = await Promise.allSettled(group.map(message=>bounded(
        ()=>runtime.reconcileReceipt(message.body.operationId,db),Math.max(1,15000-(Date.now()-started)))));
      outcomes.forEach((outcome,index)=>{
        if(outcome.status==='fulfilled') {
          checked.add(group[index].body.operationId); checkedNow++;
          if(outcome.value?.state==='completed')confirmedCompletions++;
        }
      });
    }
  }
  const queued = messages.filter(message=>message.body.mode!=='reconcile'||!checked.has(message.body.operationId));
  if (queued.length) {
    try { await queue.sendBatch(queued); }
    catch { throw Object.assign(new Error('Recovery delivery could not be confirmed. Retrying recovery is safe; existing operation IDs prevent duplicate execution.'), { integrationUnavailable: true }); }
  }
  return { retriesScheduled: results[0].data.length, receiptChecksScheduled: results[1].data.length, receiptChecksCheckedNow: checkedNow, confirmedCompletions,
    executionAvailable: canExecute, batchLimit: 25, emailPolicy: 'forbidden' };
}
