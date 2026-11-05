import { z } from 'zod';
import { decisionSchema, configureSchema, discoverySchema, scopeSchema, ZOHO_POLICY } from './contracts';

const privacyReason = z.string().trim().min(3).max(500);
const privacyScope = z.object({ connectionId: z.string().uuid() });
const suppressionSchema = privacyScope.extend({ module: z.enum(['Candidates', 'Job_Openings']),
  externalId: z.string().regex(/^\d{1,40}$/), suppressed: z.boolean(), reason: privacyReason }).strict();
const retentionSchema = privacyScope.extend({ days: z.number().int().min(1).max(365), reason: privacyReason }).strict();
const historySchema = scopeSchema.extend({before:z.string().datetime({offset:true}).optional(),beforeId:z.string().uuid().optional()}).strict()
  .refine(value=>Boolean(value.before)===Boolean(value.beforeId));
function historyInput(input) { return historySchema.parse(typeof input==='string'?{connectionId:input}:input); }
function cursorQuery(query, parsed, column='created_at') {
  return parsed.before ? query.or(`${column}.lt.${parsed.before},and(${column}.eq.${parsed.before},id.lt.${parsed.beforeId})`) : query;
}

/** Dependency injection keeps the admin interface testable without production credentials. */
export function createZohoControlPlane(db) {
  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw Object.assign(new Error('Integration state could not be updated'), { code: error.code });
    return data;
  }
  return {
    async controlDiscovery(input, actor) {
      const parsed=scopeSchema.extend({runId:z.string().uuid(),command:z.enum(['pause','resume','cancel']),reason:privacyReason}).strict().parse(input);
      return rpc('zoho_control_discovery',{p_connection:parsed.connectionId,p_run:parsed.runId,p_action:parsed.command,p_reason:parsed.reason,p_actor:actor});
    },
    async reviewPage(input) {
      const base=z.object({connectionId:z.string().uuid(),module:z.enum(['Candidates','Job_Openings']),state:z.enum(['pending_approval','held','rejected','approved','approval_stale','processing','completed','failed']).optional(),search:z.string().trim().max(100).optional(),before:z.string().datetime({offset:true}).optional(),beforeId:z.string().uuid().optional()}).strict().refine(value=>Boolean(value.before)===Boolean(value.beforeId));
      const value=base.parse(input);
      return rpc('zoho_review_page',{p_connection:value.connectionId,p_module:value.module,p_state:value.state||null,p_search:value.search||'',p_before:value.before||null,p_before_id:value.beforeId||null});
    },
    async reviewWindow(input) {
      const value=z.object({connectionId:z.string().uuid(),module:z.enum(['Candidates','Job_Openings']),state:z.enum(['pending_approval','held','rejected','approved','approval_stale','processing','completed','failed']).optional(),search:z.string().trim().max(100).optional(),limit:z.coerce.number().int().min(50).max(100000),fingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict().parse(input);
      return rpc('zoho_review_window',{p_connection:value.connectionId,p_module:value.module,p_state:value.state||null,p_search:value.search||'',p_limit:value.limit,p_fingerprint:value.fingerprint||null});
    },
    async privacy(connectionId) {
      const scope = scopeSchema.parse({ connectionId });
      return rpc('zoho_source_privacy_snapshot', { p_connection: scope.connectionId });
    },
    async suppress(input, actor) {
      const parsed = suppressionSchema.parse(input);
      return rpc('zoho_set_source_suppression', { p_connection: parsed.connectionId, p_module: parsed.module,
        p_external: parsed.externalId, p_suppressed: parsed.suppressed, p_reason: parsed.reason, p_actor: actor });
    },
    async retention(input, actor) {
      const parsed = retentionSchema.parse(input);
      return rpc('zoho_configure_retention', { p_connection: parsed.connectionId, p_days: parsed.days,
        p_reason: parsed.reason, p_actor: actor });
    },
    async cleanup(input, actor) {
      const parsed = z.object({ reason: privacyReason, confirmed: z.literal(true) }).strict().parse(input);
      return rpc('zoho_cleanup_payloads_by_operator', { p_actor: actor, p_reason: parsed.reason });
    },
    async connectionControl(input, actor) {
      const parsed = privacyScope.extend({ expectedConfigRevision: z.number().int().positive(),
        command: z.enum(['pause', 'resume', 'disconnect']), reason: privacyReason }).strict().parse(input);
      return rpc('zoho_control_connection', { p_connection: parsed.connectionId, p_expected_config: parsed.expectedConfigRevision,
        p_action: parsed.command, p_reason: parsed.reason, p_actor: actor });
    },
    async summary() {
      return rpc('zoho_admin_snapshot', {});
    },
    async discover(input, actor) {
      const parsed = discoverySchema.parse(input);
      return rpc('zoho_start_discovery', { p_connection: parsed.connectionId, p_module: parsed.module, p_actor: actor });
    },
    async runs(input) {
      const parsed = historyInput(input);
      const query = db.from('zoho_discovery_runs').select('id,connection_id,config_revision,module,state,control_state,next_page,received_count,staged_count,deferred_count,failure_count,next_attempt_at,inventory_scope,last_error,created_at,completed_at,modified_since,scan_started_at,scan_had_exceptions').eq('connection_id', parsed.connectionId).order('created_at', { ascending: false }).order('id',{ascending:false}).limit(20);
      const {data,error}=await cursorQuery(query,parsed);
      if (error) throw new Error('Discovery history unavailable');
      return data;
    },
    async deferred(input) {
      const parsed = historyInput(input);
      const query = db.from('zoho_deferred_records')
        .select('id,module,external_id,state,reason,source_modified_at,next_attempt_at,expires_at,updated_at')
        .eq('connection_id', parsed.connectionId).in('state', ['waiting_execution', 'blocked_invalid'])
        .order('updated_at', { ascending: false }).order('id', { ascending: false }).limit(50);
      const {data,error}=await cursorQuery(query,parsed,'updated_at');
      if (error) throw new Error('Deferred discovery history unavailable');
      return data;
    },
    async executions(input) {
      const parsed = historyInput(input);
      const query = db.from('zoho_approved_operations')
        .select('id,state,record_revision,execution_attempts,next_attempt_at,last_error,lease_expires_at,completed_at,created_at,zoho_staged_records!inner(connection_id,module,external_id)')
        .eq('zoho_staged_records.connection_id', parsed.connectionId).order('created_at', { ascending: false })
        .order('id', { ascending: false }).limit(20);
      const {data,error}=await cursorQuery(query,parsed);
      if (error) throw new Error('Execution history unavailable');
      return data;
    },
    async configure(input, actor) {
      const parsed = configureSchema.parse(input);
      return rpc('zoho_register_connection', { p_name: parsed.name, p_source_org: parsed.sourceOrgId,
        p_region: parsed.region, p_publisher: parsed.publisherOrganizationId, p_actor: actor });
    },
    async replayDecision(input, actor) {
      const parsed = decisionSchema.parse(input);
      const found = await rpc('zoho_lookup_decision', { p_connection: parsed.connectionId, p_items: parsed.items,
        p_decision: parsed.decision, p_reason: parsed.reason, p_request: parsed.requestId, p_actor: actor });
      if (found?.found === false) return null;
      if (found?.found === true && found.result?.replayed === true) return found.result;
      throw new Error('Decision recovery unavailable');
    },
    async decide(input, actor) {
      const parsed = decisionSchema.parse(input);
      return rpc('zoho_decide_records', { p_connection: parsed.connectionId, p_items: parsed.items,
        p_decision: parsed.decision, p_reason: parsed.reason, p_request: parsed.requestId, p_actor: actor });
    },
  };
}
