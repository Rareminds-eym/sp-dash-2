import { readZohoConfig, ZOHO_DEFAULTS } from './config';
import { z } from 'zod';
import { matchingJobNoEffect } from './job-no-effect';
import { integrationFailure } from './diagnostics';

const uuid = z.string().uuid();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const approvedMessage = z.object({ operationId: uuid, mode: z.enum(['execute', 'reconcile']).default('execute') }).strict();
const destinationCapability = z.object({
  version: z.literal(1), ready: z.literal(true), emailPolicy: z.literal('forbidden'),
  checksLiveApproval: z.literal(true), checksLiveApprover: z.literal(true),
  idempotentByOperation: z.literal(true), transactionalReceipt: z.literal(true),
  fencesExpiredLeases: z.literal(true), verifiesPostconditions: z.literal(true),
  modules: z.array(z.enum(['Candidates', 'Job_Openings'])).min(1),
});
const grantSchema = z.object({
  claimed: z.literal(true), operationId: uuid, lease: uuid,
  leaseExpiresAt: z.string().datetime({ offset: true }), approvalExpiresAt: z.string().datetime({ offset: true }),
  actorId: uuid, connectionId: uuid, sourceOrgId: z.string().regex(/^\d{1,40}$/), publisherOrganizationId: uuid,
  recordId: uuid, revision: z.number().int().positive(), configRevision: z.number().int().positive(), sourceHash: hash,
  action: z.enum(['provision_candidate', 'apply_job']), module: z.enum(['Candidates', 'Job_Openings']),
  candidateReviewHash: hash.optional(),
  externalId: z.string().regex(/^\d{1,40}$/), data: z.record(z.unknown()), targetId: uuid.nullable(), emailPolicy: z.literal('forbidden'),
}).strict().refine(value => (value.module === 'Candidates') === (value.action === 'provision_candidate'))
  .refine(value => value.module === 'Candidates' ? Boolean(value.candidateReviewHash) : value.candidateReviewHash === undefined);
const receiptSchema = z.object({
  state: z.literal('completed'), operationId: uuid, sourceHash: hash, targetId: uuid, receiptId: uuid,
  emailPolicy: z.literal('forbidden'),
}).strict();
const pendingProjectionSchema = receiptSchema.extend({ state: z.literal('projection_pending'),
  identityOutcome: z.enum(['created','existing_access_preserved']),
  activationState: z.enum(['activation_pending','existing_sign_in_preserved']) }).strict();
const noEffectSchema = z.object({ state: z.literal('not_applied'), operationId: uuid, lease: uuid,
  sourceHash: hash, emailPolicy: z.literal('forbidden') }).strict();

export async function bounded(operation, milliseconds = ZOHO_DEFAULTS.requestTimeoutMs) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Execution dependency unavailable')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export function destinationFor(env, module) {
  return module === 'Candidates' ? env.ZOHO_CANDIDATE_DESTINATION : env.ZOHO_JOB_DESTINATION;
}
export async function destinationReady(binding, module) {
  if (typeof binding?.capabilities !== 'function' || typeof binding?.executeApprovedOperation !== 'function' ||
    typeof binding?.findOperationReceipt !== 'function') return false;
  try {
    const parsed = destinationCapability.safeParse(await bounded(() => binding.capabilities(), ZOHO_DEFAULTS.dependencyTimeoutMs));
    return parsed.success && parsed.data.modules.includes(module);
  } catch { return false; }
}
export async function currentApprover(env, actor) {
  if (typeof env.ZOHO_APPROVER_AUTHORITY?.checkApprover !== 'function') return false;
  try {
    const result = await bounded(() => env.ZOHO_APPROVER_AUTHORITY.checkApprover(actor), ZOHO_DEFAULTS.dependencyTimeoutMs);
    return result?.allowed === true;
  } catch { return false; }
}
export async function currentApproval(env, grant) {
  if (typeof env.ZOHO_APPROVER_AUTHORITY?.validateApproval !== 'function') return false;
  try {
    const result = await bounded(() => env.ZOHO_APPROVER_AUTHORITY.validateApproval(grant), ZOHO_DEFAULTS.dependencyTimeoutMs);
    return result?.allowed === true;
  } catch { return false; }
}
async function rpc(db, name, args) {
  const result = await db.rpc(name, args);
  if (result.error) throw new Error('Approved execution storage unavailable');
  return result.data;
}
function matchingReceipt(value, operationId, sourceHash, expectedTarget) {
  const parsed = receiptSchema.safeParse(value);
  return parsed.success && parsed.data.operationId === operationId && parsed.data.sourceHash === sourceHash &&
    (expectedTarget === null || parsed.data.targetId === expectedTarget) ? parsed.data : null;
}
async function notePendingProjection(db, value, operationId, sourceHash, expectedTarget, lease) {
  const parsed = pendingProjectionSchema.safeParse(value);
  if (!parsed.success || parsed.data.operationId !== operationId || parsed.data.sourceHash !== sourceHash ||
      (expectedTarget !== null && parsed.data.targetId !== expectedTarget)) return false;
  const noted = await rpc(db, 'zoho_note_candidate_projection_pending', { p_operation: operationId, p_lease: lease,
    p_source_hash: sourceHash, p_target: parsed.data.targetId, p_receipt: parsed.data.receiptId });
  if (noted !== true) throw new Error('Projection phase acknowledgement unavailable');
  return true;
}
async function acknowledge(db, grant, receipt) {
  const result = await rpc(db, 'zoho_complete_operation', { p_operation: grant.operationId, p_lease: grant.lease,
    p_target: receipt.targetId, p_receipt: receipt.receiptId });
  if (result?.completed !== true) throw new Error('Completion acknowledgement unavailable');
  return { state: 'completed' };
}

async function acknowledgeJobNoEffect(db, proof) {
  // The private SQL proof is independently checked by this acknowledgement.
  // An absent receipt, generic exception or caller-supplied reason cannot invoke it.
  const result = await rpc(db, 'zoho_ack_job_no_effect', { p_operation: proof.operationId,
    p_lease: proof.lease, p_source_hash: proof.sourceHash });
  if (result?.reviewRequired !== true) throw new Error('Job review acknowledgement unavailable');
  return { state: 'review_required' };
}

/** Only the private SQL claim supplies write data; queue bodies carry an ID only.
 * A timeout never means not-applied. The destination must independently validate
 * the live grant/approver and atomically persist its effect and operation receipt.
 */
export async function executeApprovedOperation(db, input, env, options = {}) {
  const message = approvedMessage.parse(input);
  if (message.mode === 'reconcile') {
    if (env.recoveryEnabled !== true) throw new Error('Receipt recovery disabled');
    return reconcileApprovedOperation(db, message.operationId, env);
  }
  if (!readZohoConfig(env).execution) throw new Error('Approved execution disabled');
  const lease = crypto.randomUUID();
  const claimed = await rpc(db, 'zoho_claim_operation', { p_operation: message.operationId, p_lease: lease });
  if (claimed?.claimed === false) return { state: 'not_claimed' };
  let started = false;
  let stage = 'grant_validation';
  try {
    const grant = grantSchema.parse(claimed);
    if (grant.operationId !== message.operationId || grant.lease !== lease ||
      Date.parse(grant.leaseExpiresAt) <= Date.now() || Date.parse(grant.approvalExpiresAt) < Date.parse(grant.leaseExpiresAt))
      throw new Error('Invalid claimed operation');
    const destination = destinationFor(env, grant.module);
    stage = 'destination_readiness';
    if (!await (options.ready ? options.ready(grant.module) : destinationReady(destination, grant.module))) throw new Error('Execution authority unavailable');
    stage = 'approver_verification';
    if (!await currentApprover(env, grant.actorId)) throw new Error('Execution authority unavailable');
    stage = 'approval_verification';
    if (!await currentApproval(env, grant)) throw new Error('Execution authority unavailable');
    // Recheck immediately before invocation; dependency probes may have consumed the lease.
    if (Date.parse(grant.leaseExpiresAt) <= Date.now()) throw new Error('Execution lease expired');
    started = true;
    stage = 'destination_invocation';
    const result = await bounded(() => destination.executeApprovedOperation(grant));
    const receipt = matchingReceipt(result, grant.operationId, grant.sourceHash, grant.targetId);
    stage = 'receipt_acknowledgement';
    if (receipt) return await acknowledge(db, grant, receipt);
    stage = 'projection_confirmation';
    if (grant.module === 'Candidates' && await notePendingProjection(db, result, grant.operationId, grant.sourceHash, grant.targetId, grant.lease))
      return { state: 'projection_pending' };
    const rejectedJob = grant.module === 'Job_Openings' ? matchingJobNoEffect(result, grant.operationId, grant.sourceHash, grant.lease) : null;
    if (rejectedJob) return await acknowledgeJobNoEffect(db, rejectedJob);
    const notApplied = noEffectSchema.safeParse(result);
    if (notApplied.success && notApplied.data.operationId === grant.operationId && notApplied.data.lease === grant.lease &&
      notApplied.data.sourceHash === grant.sourceHash) {
      await rpc(db, 'zoho_record_execution_outcome', { p_operation: grant.operationId, p_lease: grant.lease, p_outcome: 'NOT_APPLIED' });
      return { state: 'retry_due' };
    }
    throw new Error('Destination outcome requires reconciliation');
  } catch (error) {
    integrationFailure('zoho_execution_attempt_error', error, { action: stage });
    await rpc(db, 'zoho_record_execution_outcome', { p_operation: message.operationId, p_lease: lease,
      p_outcome: started ? 'OUTCOME_UNKNOWN' : 'NOT_APPLIED' });
    return { state: started ? 'reconciliation_required' : 'retry_due' };
  }
}

/** Read receipts only. An absent/unknown receipt never grants another write. */
export async function reconcileApprovedOperation(db, operationId, env) {
  uuid.parse(operationId);
  const result = await db.from('zoho_approved_operations').select('id,state,lease_token,source_hash,action,expected_target_id').eq('id', operationId).single();
  if (result.error || !result.data) throw new Error('Reconciliation context unavailable');
  const row = result.data;
  if (row.state !== 'processing') return { state: 'not_in_flight' };
  const module = row.action === 'provision_candidate' ? 'Candidates' : row.action === 'apply_job' ? 'Job_Openings' : null;
  if (!module || !uuid.safeParse(row.lease_token).success || !hash.safeParse(row.source_hash).success ||
    !uuid.nullable().safeParse(row.expected_target_id).success) throw new Error('Invalid reconciliation context');
  const destination = destinationFor(env, module);
  if (typeof destination?.findOperationReceipt !== 'function') throw new Error('Receipt authority unavailable');
  const found = await bounded(() => destination.findOperationReceipt({ operationId, sourceHash: row.source_hash, readOnly: true }));
  const receipt = matchingReceipt(found, operationId, row.source_hash, row.expected_target_id);
  if (receipt) return acknowledge(db, { operationId, lease: row.lease_token }, receipt);
  if (module === 'Candidates' && await notePendingProjection(db, found, operationId, row.source_hash, row.expected_target_id, row.lease_token))
    return { state: 'projection_pending' };
  const rejectedJob = module === 'Job_Openings' ? matchingJobNoEffect(found, operationId, row.source_hash, row.lease_token) : null;
  if (rejectedJob) return acknowledgeJobNoEffect(db, rejectedJob);
  return { state: 'reconciliation_required' };
}
