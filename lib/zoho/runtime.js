import { bulkDiscoveryAvailable } from './sync-coordinator';
import { ZOHO_DEFAULTS, readZohoConfig, zohoProfileName } from './config';
import {sourceOperationsRuntime} from './source-operations-runtime';
import { createClient } from '@supabase/supabase-js';
import { discoveryConsumer } from './discovery-consumer';
import { approvedConsumer } from './approved-consumer';
import { executeApprovedOperation } from './approved-execution';
import { jobDestination } from './job-destination';
import { stagingAuthority } from './discovery-authority';
import { skillpassportDbConfig } from '../skillpassport-db-config';

export const RECOVERY_CRON = ZOHO_DEFAULTS.recoveryCron;

export function queueNames(env) {
  const {environment}=readZohoConfig(env);
  if (!environment) return null;
  const suffix = environment === 'production' ? '' : `-${environment}`;
  return { discovery: `zoho-recruit-discovery${suffix}`, approved: `zoho-recruit-approved${suffix}` };
}
function enabled(env) {
  return readZohoConfig(env).background && Boolean(queueNames(env));
}
export function discoveryCredential(env) {
  // Configuration guard only: PostgREST verifies the signature and role at use.
  // Refuse accidental service-role/anonymous keys and expired reader credentials.
  try {
    const parts = env.ZOHO_DISCOVERY_DB_TOKEN.split('.');
    if (parts.length !== 3) return false;
    const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return claims.role === 'zoho_discovery' && Number.isSafeInteger(claims.exp) && claims.exp * 1000 > Date.now() + 60000 &&
      typeof env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' && env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;
  } catch { return false; }
}
function database(env) {
  const config = skillpassportDbConfig(env);
  if (!config.SUPABASE_URL || !discoveryCredential(env)) throw new Error('Restricted discovery database unavailable');
  return createClient(config.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${env.ZOHO_DISCOVERY_DB_TOKEN}` },
        fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(ZOHO_DEFAULTS.requestTimeoutMs) }) } });
}

/** Local capabilities, not public HTTP routes or additional service deployments.
 * The hosting runtime is trusted and already holds database credentials. Passing
 * these narrow objects to modules does not sandbox the hosting runtime itself.
 */
export function integrationRuntime(env, dependencies = {}) {
  const active = enabled(env);
  const policyProfile=active?zohoProfileName(env):'blocked';
  const sourceOperations=sourceOperationsRuntime({...env,ENVIRONMENT:policyProfile},dependencies.sourceOperations);
  let db;
  const storage = () => (db ??= dependencies.database ? dependencies.database() : database(env));
  const config = skillpassportDbConfig(env);
  const configured = Boolean(config.SUPABASE_URL && discoveryCredential(env));
  const authority = {
    async fetch(request) {
      if (request.method === 'GET' && new URL(request.url).pathname === '/readiness')
        return Response.json({ version: 1, ready: active && configured, stagingOnly: true, emailPolicy: 'forbidden' });
      if (!active || !configured) return new Response('Unavailable', { status: 503 });
      return stagingAuthority(request, storage());
    },
  };
  // Enumerate capabilities rather than spreading the host's mail/SSO/environment.
  const discoveryEnv = {
    ENVIRONMENT: policyProfile,
    ZOHO_BULK_AVAILABLE: bulkDiscoveryAvailable(env),
    ZOHO_CLIENT_ID: env.ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET: env.ZOHO_CLIENT_SECRET,
    ZOHO_TOKEN_ENCRYPTION_KEY: env.ZOHO_TOKEN_ENCRYPTION_KEY,
    ZOHO_TOKEN_ENCRYPTION_KEYS:env.ZOHO_TOKEN_ENCRYPTION_KEYS,ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID:env.ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID,
    ZOHO_DISCOVERY_QUEUE: env.ZOHO_DISCOVERY_QUEUE, ZOHO_DISCOVERY_AUTHORITY: authority,
  };
  const executionEnv = {
    ENVIRONMENT: policyProfile,
    ...config,
    recoveryEnabled: active,
    ZOHO_APPROVED_QUEUE: env.ZOHO_APPROVED_QUEUE,
    ZOHO_APPROVER_AUTHORITY: env.ZOHO_APPROVER_AUTHORITY,
    ZOHO_CANDIDATE_DESTINATION: env.ZOHO_CANDIDATE_DESTINATION,
    ZOHO_JOB_DESTINATION: env.ZOHO_JOB_DESTINATION ?? jobDestination({
      ENVIRONMENT: policyProfile,
      ...config,
      ZOHO_APPROVER_AUTHORITY: env.ZOHO_APPROVER_AUTHORITY,
    }, dependencies.jobDestination),
  };
  return {
    discovery: { fetch: request => discoveryConsumer.fetch(request, discoveryEnv) },
    executor: { fetch: request => approvedConsumer.fetch(request, executionEnv) },
    async reconcileReceipt(operationId, database) {
      if (!active) throw new Error('Receipt recovery disabled');
      return executeApprovedOperation(database, { operationId, mode: 'reconcile' }, executionEnv);
    },
    async queue(batch) {
      const names = queueNames(env);
      if (names && batch.queue === names.discovery) {
        for(const message of batch.messages) {
          if(sourceOperations.recognizes(message.body)) await sourceOperations.message(message);
          else await discoveryConsumer.queue({...batch,messages:[message]},discoveryEnv);
        }
        return true;
      }
      if (names && batch.queue === names.approved) { await approvedConsumer.queue(batch, executionEnv, { database: dependencies.executionDatabase }); return true; }
      return false;
    },
    async scheduled(controller) {
      if (!active || controller.cron !== RECOVERY_CRON) return;
      // One unavailable destination must not stop unrelated source recovery.
      const results = await Promise.allSettled([
        readZohoConfig(env).privacyCleanup && configured ? (async () => {
          const { error } = await storage().rpc('zoho_cleanup_source_payloads', {});
          if (error) throw new Error('Source privacy cleanup unavailable');
        })() : Promise.resolve(),
        sourceOperations.scheduled(),
        discoveryConsumer.scheduled(controller, discoveryEnv), approvedConsumer.scheduled(controller, executionEnv, { database: dependencies.executionDatabase }),
        readZohoConfig(env).projectionDelivery ? (async () => {
          if (typeof env.ZOHO_CANDIDATE_DESTINATION?.recoverProjections !== 'function') throw new Error('Projection recovery unavailable');
          await env.ZOHO_CANDIDATE_DESTINATION.recoverProjections();
        })() : Promise.resolve(),
      ]);
      if (results.some(result => result.status === 'rejected')) {
        const components = ['source_privacy', 'source_operations', 'discovery', 'approved_execution', 'projection_delivery'];
        console.error(JSON.stringify({event:'zoho_recovery_incomplete', components:results.flatMap((result,index)=>result.status==='rejected'?[components[index]]:[])}));
        throw new Error('Integration recovery incomplete');
      }
    },
  };
}
