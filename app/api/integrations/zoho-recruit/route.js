import { syncCoordinator, bulkDiscoveryAvailable } from '@/lib/zoho/sync-coordinator';
import { recoverSourceExecutions } from '@/lib/zoho/execution-recovery';
import { readExecutionProgress } from '@/lib/zoho/execution-progress';
import { integrationFailure } from '@/lib/zoho/diagnostics';
import {operatorActions,operatorSnapshot,runOperatorAction,canonicalAdministrationPage} from '@/lib/zoho/operator-actions';
import {operatorHistoryPage} from '@/lib/zoho/operator-history';
import { z } from 'zod';
import { configureJobPolicy, readJobPolicy, readJobSurfacePage } from '@/lib/zoho/job-policy';
import { previewCandidateReview, previewCandidateReviews } from '@/lib/zoho/candidate-review';
import { recordHumanApproval } from '@/lib/zoho/approval-evidence';
import { requireZohoAdmin } from '@/lib/zoho/admin';
import { createZohoControlPlane } from '@/lib/zoho/control-plane';
import { ZOHO_POLICY, scopeSchema, decisionSchema } from '@/lib/zoho/contracts';
import { createZohoOAuth, oauthConfiguration } from '@/lib/zoho/oauth';
import { executorStatus } from '@/lib/zoho/executor';
import { discoveryStatus } from '@/lib/zoho/discovery-readiness';
import { integrationRuntime } from '@/lib/zoho/runtime';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
async function body(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid request');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > ZOHO_POLICY.maxRequestBytes) { await reader.cancel(); throw new RangeError('Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function handle(request) {
  const auth = await requireZohoAdmin(request);
  if (auth.error) return auth.error;
  let service; let selection; let action;
  const view = new URL(request.url).searchParams.get('view');
  try {
    // Lazy import: missing database configuration is an explicit unavailable state.
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    service = createZohoControlPlane(supabaseAdmin);
    const runtime = integrationRuntime(auth.env);
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (view === 'sync') return json({ sync: await syncCoordinator(supabaseAdmin).snapshot(url.searchParams.get('connectionId')) });
      if (view === 'execution_progress') return json({ progress: await readExecutionProgress(supabaseAdmin,
        Object.fromEntries([...url.searchParams].filter(([key])=>key!=='view'))) });
      if(url.searchParams.get('view')==='operator_history'){
        const query=z.object({view:z.literal('operator_history'),connectionId:z.string().uuid(),kind:z.enum(['lifecycle','administration','canonical']),
          historyView:z.enum(['pending','history']),cursor:z.string().max(512).optional()}).strict().parse(Object.fromEntries(url.searchParams));
        const cursor=query.cursor?z.object({timestamp:z.string().datetime({offset:true}),id:z.string().uuid()}).strict().parse(JSON.parse(query.cursor)):null;
        if(query.kind==='canonical')z.literal('pending').parse(query.historyView);
        const page=query.kind==='canonical'?await canonicalAdministrationPage(supabaseAdmin,auth,{connectionId:query.connectionId,cursor}):
          await operatorHistoryPage(supabaseAdmin,{connectionId:query.connectionId,actorId:auth.user.id,kind:query.kind,view:query.historyView,cursor});
        return json({page,emailPolicy:'forbidden'});
      }
      if (url.searchParams.get('view') === 'operations') return json({operations:await operatorSnapshot(supabaseAdmin,url.searchParams.get('connectionId'),auth.env,auth.user.id)});
      if (url.searchParams.get('view') === 'privacy') return json({ privacy: await service.privacy(url.searchParams.get('connectionId')) });
      if (view === 'job_surface') return json({ surface: await readJobSurfacePage(supabaseAdmin,Object.fromEntries([...url.searchParams].filter(([key])=>key!=='view'))) });
      if (view === 'record_window') return json(await service.reviewWindow(Object.fromEntries([...url.searchParams].filter(([key])=>key!=='view'))));
      if (url.searchParams.get('view') === 'job_policy') return json({ policy: await readJobPolicy(supabaseAdmin, url.searchParams.get('connectionId')), emailPolicy: 'forbidden' });
      const historyInput=Object.fromEntries([...url.searchParams].filter(([key])=>key!=='view'));
      if (url.searchParams.get('view') === 'deferred') return json({ deferred: await service.deferred(historyInput) });
      if (url.searchParams.get('view') === 'executions') return json({ executions: await service.executions(historyInput) });
      if (url.searchParams.get('view') === 'runs') {
        const { live, ...cursor } = historyInput;
        if (live !== undefined) z.literal('1').parse(live);
        const [runs, status] = await Promise.all([service.runs(cursor), live === '1'
          ? service.discoveryStatus({ connectionId: cursor.connectionId }) : Promise.resolve({})]);
        return json({ runs, ...status });
      }
      if (url.searchParams.get('view') === 'records') {
        const input = Object.fromEntries([...url.searchParams].filter(([key]) => key !== 'view'));
        return json({ ...await service.reviewPage(input), emailPolicy: 'forbidden' });
      }
      if (view && view !== 'summary') return json({ error: 'Unknown integration view' }, 400);
      return json({ ...await service.summary(), emailPolicy: 'forbidden', capabilities: { oauth: oauthConfiguration({ ...process.env, ...auth.env }).success, discovery: await discoveryStatus(runtime.discovery, auth.env.ZOHO_DISCOVERY_QUEUE), execution: await executorStatus(runtime.executor, auth.env.ZOHO_APPROVED_QUEUE) } });
    }
    const payload = z.object({ action: z.enum([...operatorActions,'configure_sync','rotate_webhook','recover_executions','configure', 'decide', 'connect', 'discover', 'control_discovery', 'review_candidate', 'review_candidates', 'configure_job_policy', 'suppress_source', 'configure_retention', 'cleanup_payloads', 'control_connection']), input: z.unknown() }).strict().parse(await body(request));
    action = payload.action;
    if (action === 'configure_sync') return json({ result: await syncCoordinator(supabaseAdmin).configure(payload.input, auth.user.id) });
    if (action === 'rotate_webhook') return json({ result: await syncCoordinator(supabaseAdmin).rotateWebhook(payload.input, auth.user.id) });
    if (action === 'recover_executions') return json({ result: await recoverSourceExecutions(supabaseAdmin, auth.env, payload.input), emailPolicy: 'forbidden' }, 202);
    if(payload.action==='control_discovery') {
      const result=await service.controlDiscovery(payload.input,auth.user.id);
      let delivery='not_required';
      if(payload.input.command==='resume') {
        delivery='pending';try{await auth.env.ZOHO_DISCOVERY_QUEUE.send({runId:result.runId});delivery='queued';}catch{/* Persisted run is recovered by the existing scheduler. */}
      }
      return json({result:{...result,delivery},emailPolicy:'forbidden'});
    }
    if (operatorActions.includes(payload.action)) return json({result:await runOperatorAction(supabaseAdmin,auth,payload.action,payload.input),emailPolicy:'forbidden'});
    if (['suppress_source', 'configure_retention', 'cleanup_payloads', 'control_connection'].includes(payload.action)) {
      const method = { suppress_source: 'suppress', configure_retention: 'retention', cleanup_payloads: 'cleanup', control_connection: 'connectionControl' }[payload.action];
      return json({ result: await service[method](payload.input, auth.user.id), emailPolicy: 'forbidden' });
    }
    if (payload.action === 'configure_job_policy') {
      const result = await configureJobPolicy(supabaseAdmin, payload.input, auth.user.id);
      return json({ result, emailPolicy: 'forbidden' });
    }
    if (payload.action === 'review_candidates') {
      const reviews = await previewCandidateReviews(supabaseAdmin, auth.env.ZOHO_APPROVER_AUTHORITY, auth.accessToken, payload.input);
      return json({ reviews, emailPolicy: 'forbidden' });
    }
    if (payload.action === 'review_candidate') {
      const review = await previewCandidateReview(supabaseAdmin, auth.env.ZOHO_APPROVER_AUTHORITY, auth.accessToken, payload.input);
      return json({ review, emailPolicy: 'forbidden' });
    }
    if (payload.action === 'discover') {
      if (!await discoveryStatus(runtime.discovery, auth.env.ZOHO_DISCOVERY_QUEUE)) return json({ error: 'Background discovery is disabled or unavailable.' }, 503);
      const result = await service.discover(payload.input, auth.user.id, bulkDiscoveryAvailable(auth.env));
      let delivery = 'pending';
      try {
        await auth.env.ZOHO_DISCOVERY_QUEUE.send(result.transport === 'bulk' ? { bulkRunId: result.bulkRunId } : { runId: result.runId });
        delivery = 'queued';
      } catch { /* The existing runtime's scheduler recovers the persisted run. */ }
      return json({ result: { ...result, delivery }, emailPolicy: 'forbidden' }, 202);
    }
    if (payload.action === 'connect') {
      if (!oauthConfiguration({ ...process.env, ...auth.env }).success) return json({ error: 'Zoho OAuth server secrets and callback are not configured.' }, 503);
      const input = scopeSchema.parse(payload.input);
      return json({ authorizationUrl: await createZohoOAuth(supabaseAdmin, { ...process.env, ...auth.env }).start(input.connectionId, auth.user.id, new URL(request.url).origin) });
    }
    if (payload.action === 'decide') {
      selection = decisionSchema.parse(payload.input);
      const recovered = await service.replayDecision(selection, auth.user.id);
      if (recovered) return json({ result: recovered, emailPolicy: 'forbidden' });
    }
    if (payload.action === 'decide' && payload.input?.decision === 'approve') {
      const status = await executorStatus(runtime.executor, auth.env.ZOHO_APPROVED_QUEUE);
      if (!status.ready) throw Object.assign(new Error('Execution unavailable'), { integrationUnavailable: true });

      const { data: selected, error: selectedError } = await supabaseAdmin.from('zoho_staged_records').select('id,module').eq('connection_id', selection.connectionId).in('id', selection.items.map(item => item.id));
      if (selectedError) throw new Error('Selection unavailable');
      if (selected.length !== selection.items.length) throw Object.assign(new Error('Selection changed'), { code: '40001' });
      if (selected.some(item => !status.modules.includes(item.module))) throw Object.assign(new Error('Execution unavailable'), { integrationUnavailable: true });
      await recordHumanApproval(supabaseAdmin, auth.env.ZOHO_APPROVER_AUTHORITY, auth.accessToken, selection);
    }
    const result = payload.action === 'configure'
      ? await service.configure(payload.input, auth.user.id)
      : await service.decide(payload.input, auth.user.id);
    if (result?.replayed === true) return json({ result, emailPolicy: 'forbidden' });
    if (payload.action === 'decide' && result.decision === 'approve') {
      // The SQL ledger is the durable outbox. Queue publication is an optimization;
      // the background executor's scheduler recovers any missed or partial publication.
      let delivery = 'pending';
      try {
        const { data: operations, error } = await supabaseAdmin.from('zoho_approved_operations').select('id').eq('batch_id', result.approvalId);
        if (error || !operations?.length) throw new Error('Dispatch context unavailable');
        await auth.env.ZOHO_APPROVED_QUEUE.sendBatch(operations.map(operation => ({ body: { operationId: operation.id, mode: 'execute' } })));
        delivery = 'queued';
      } catch { /* Cron recovers the persisted intent; never report creation complete. */ }
      return json({ result: { ...result, delivery }, emailPolicy: 'forbidden' }, 202);
    }
    return json({ result, emailPolicy: 'forbidden' }, 200);
  } catch (error) {
    // Another delivery may have committed while this request checked readiness/evidence.
    // Recover its exact result without replacing a changed manifest or renewing evidence.
    if (selection && service) {
      try {
        const recovered = await service.replayDecision(selection, auth.user.id);
        if (recovered) return json({ result: recovered, emailPolicy: 'forbidden' });
      } catch (lookupError) { error = lookupError; }
    }
    if (error.executionProgressUnavailable) return json({ error: error.message }, 503);
    if (error.integrationUnavailable && action === 'recover_executions') return json({ error: error.message }, 503);
    if (error.integrationUnavailable) return json({ error: 'Silent approved execution is not deployed. Review, hold and reject remain available.' }, 503);
    const reviewRecovery = {
      SOURCE_PAUSED: 'Source is paused. Resume connection in Source privacy, then run fresh discovery before checking accounts.',
      SOURCE_NOT_CONNECTED: 'Connect this source, then run discovery before checking accounts.',
      SOURCE_CONFIG_CHANGED: 'Source configuration changed. Run fresh discovery before checking this record.',
      PAYLOAD_EXPIRED: 'Source review data expired. Run fresh discovery before checking this record.',
    };
    if (Object.hasOwn(reviewRecovery,error.reviewReason)) return json({error:reviewRecovery[error.reviewReason],code:error.reviewReason},error.code==='22023'?422:409);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Invalid integration request' }, 400);
    if (error instanceof RangeError) return json({ error: 'Request too large' }, 413);
    if (error.code === '40001' || error.code === '23505') return json({ error: 'The reviewed selection changed. Refresh and review again.' }, 409);
    if (error.code === '22023') return json({ error: 'This selection is blocked or is not eligible for this decision.' }, 422);
    const requestId = integrationFailure('zoho_route_error', error, { action, view });
    const storageFailure = /^(08|53|57|PGRST)/.test(error?.code || '');
    return json({ error: storageFailure ? 'Integration storage is unavailable. Please retry.' : 'The integration request could not be completed. Please retry.', requestId }, storageFailure ? 503 : 500);
  }
}
export const GET = handle;
export const POST = handle;
