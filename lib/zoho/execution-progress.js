import { z } from 'zod';
const count = z.number().int().nonnegative().safe();
export const executionProgressScope = z.object({ connectionId: z.string().uuid(), module: z.enum(['Candidates', 'Job_Openings']) }).strict();
const snapshot = executionProgressScope.extend({ checkedAt: z.string().datetime({ offset: true }), total: count,
  completed: count, queued: count, processing: count, checking: count, syncing: count.default(0), retrying: count, attention: count,
  overdue: count.default(0), expired: count, exhausted: count, nextRetryAt: z.string().datetime({ offset: true }).nullable(), emailPolicy: z.literal('forbidden') }).strict();

export async function readExecutionProgress(db, input) {
  const scope = executionProgressScope.parse(input);
  const { data, error } = await db.rpc('zoho_execution_progress', { p_connection: scope.connectionId, p_module: scope.module });
  if (error) throw Object.assign(new Error(['PGRST202','42883'].includes(error.code)
    ? 'Execution progress is unavailable. Apply the execution progress migration and retry.'
    : 'Execution progress storage is unavailable. Please retry.'), { executionProgressUnavailable: true });
  const parsed = snapshot.safeParse(data);
  if (!parsed.success) throw Object.assign(new Error('Execution progress could not be verified. Refresh to retry.'), { executionProgressUnavailable: true });
  const result = parsed.data;
  if (result.connectionId !== scope.connectionId || result.module !== scope.module ||
      ['completed','queued','processing','checking','syncing','retrying','attention'].reduce((sum,key)=>sum+result[key],0) !== result.total ||
      result.overdue>result.total-result.completed || result.expired>result.attention || result.exhausted>result.attention)
    throw Object.assign(new Error('Execution progress could not be verified. Refresh to retry.'), { executionProgressUnavailable: true });
  return result;
}
