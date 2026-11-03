import { matchingJobNoEffect } from './job-no-effect';
import { createClient } from '@supabase/supabase-js';
import { skillpassportDbConfig } from '../skillpassport-db-config';
import { bounded, currentApprover, currentApproval } from './approved-execution';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const receipt = (value, operationId, sourceHash, target = null) => object(value) && Object.keys(value).length === 6 &&
 value.state === 'completed' && value.operationId === operationId && value.sourceHash === sourceHash &&
 uuid(value.targetId) && (target === null || value.targetId === target) && uuid(value.receiptId) && value.emailPolicy === 'forbidden';

/** Private object hosted inside the existing dashboard Worker, never an HTTP route.
 * SQL independently locks/rechecks the full live grant and commits effect+receipt.
 * No generic opportunity endpoint or notification capability is reachable here.
 */
export function jobDestination(env, dependencies = {}) {
 let client;
 const config = skillpassportDbConfig(env);
 const enabled = () => env.ZOHO_EXECUTION_ENABLED === 'true' && env.ZOHO_JOB_PUBLISHER_ENABLED === 'true' &&
  Boolean(config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) &&
  typeof env.ZOHO_APPROVER_AUTHORITY?.checkApprover === 'function' && typeof env.ZOHO_APPROVER_AUTHORITY?.validateApproval === 'function';
 const db = () => client ??= dependencies.database ? dependencies.database() : createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) } });
 async function rpc(name, args) {
  const result = await bounded(() => db().rpc(name, args), 5000);
  if (result.error) throw new Error('Job authority unavailable');
  return result.data;
 }
 return {
  async capabilities() {
   try {
    if (!enabled() || await rpc('zoho_job_publisher_ready', {}) !== true) return { ready: false, modules: [] };
    return { version: 1, ready: true, emailPolicy: 'forbidden', checksLiveApproval: true, checksLiveApprover: true,
     idempotentByOperation: true, transactionalReceipt: true, fencesExpiredLeases: true, verifiesPostconditions: true, modules: ['Job_Openings'] };
   } catch { return { ready: false, modules: [] }; }
  },
  async executeApprovedOperation(grant) {
   if (!enabled() || !object(grant) || grant.module !== 'Job_Openings' || grant.action !== 'apply_job' || grant.claimed !== true ||
    !uuid(grant.operationId) || !uuid(grant.actorId) || !uuid(grant.lease) || !hash(grant.sourceHash) ||
    !(grant.targetId === null || uuid(grant.targetId)) || grant.emailPolicy !== 'forbidden' ||
    !Number.isFinite(Date.parse(grant.leaseExpiresAt)) || Date.parse(grant.leaseExpiresAt) <= Date.now() ||
    (!Number.isFinite(Date.parse(grant.approvalExpiresAt)) || Date.parse(grant.approvalExpiresAt) < Date.parse(grant.leaseExpiresAt)) ||
    !await currentApprover(env, grant.actorId) || !await currentApproval(env, grant)) throw new Error('Job authority unavailable');
   if (Date.parse(grant.leaseExpiresAt) <= Date.now()) throw new Error('Job lease expired');
   const result = await rpc('zoho_apply_job_operation', { p_grant: grant });
   if (matchingJobNoEffect(result, grant.operationId, grant.sourceHash, grant.lease)) return result;
   if (!receipt(result, grant.operationId, grant.sourceHash, grant.targetId)) throw new Error('Job receipt unavailable');
   return result;
  },
  async findOperationReceipt(reference) {
   if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY || !object(reference) || Object.keys(reference).length !== 3 || reference.readOnly !== true ||
    !uuid(reference.operationId) || !hash(reference.sourceHash)) throw new Error('Job receipt reference unavailable');
   const result = await rpc('zoho_find_job_operation_receipt', { p_operation: reference.operationId, p_source_hash: reference.sourceHash });
   if (result === null) return null;
   if (matchingJobNoEffect(result, reference.operationId, reference.sourceHash)) return result;
   if (!receipt(result, reference.operationId, reference.sourceHash)) throw new Error('Job receipt unavailable');
   return result;
  },
 };
}
