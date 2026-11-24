import { z } from 'zod';
import { ZOHO_HOSTS, recruitJson } from './oauth';
import { MODULES, ZOHO_REGIONS, recruitModifiedSince } from './contracts';

const scope = z.object({ connectionId: z.string().uuid(), module: z.enum(MODULES) });
export const sourceLifecycleDecisionSchema = z.object({ connectionId: z.string().uuid(), proposalId: z.string().uuid(),
  expectedRevision: z.number().int().positive(), decision: z.enum(['approve','hold','reject']),
  reason: z.string().trim().min(3).max(500), requestId: z.string().uuid() }).strict();
export const sourceMergeEvidenceSchema = scope.extend({ externalId: z.string().regex(/^\d{1,40}$/),
  survivorExternalId: z.string().regex(/^\d{1,40}$/), observedAt: z.string().datetime({ offset: true }),
  evidenceReference: z.string().trim().min(10).max(500) }).strict().refine(v => v.externalId !== v.survivorExternalId);
const deletedPage = z.object({ data: z.array(z.object({ id: z.string().regex(/^\d{1,40}$/),
  type: z.enum(['recycle','permanent']), deleted_time: z.string().datetime({ offset: true }) })).max(200),
  info: z.object({ more_records: z.boolean() }) });
async function rpc(db, name, args) {
  const result = await db.rpc(name, args);
  if (result.error) throw Object.assign(new Error('Source lifecycle command unavailable'), { code: result.error.code });
  return result.data;
}

/** Recruit documents deletions, not a merge-event feed. Merges require operator evidence. */
export function createSourceLifecycle(db) {
  return {
    startDeletedScan(connectionId, module, actorId) {
      scope.parse({ connectionId,module });
      return rpc(db,'zoho_start_deleted_scan',{p_connection:connectionId,p_module:module,p_actor:z.string().uuid().parse(actorId)});
    },
    async tickDeletedScan(scanId, accessToken, region, fetcher=fetch, quota) {
      z.string().uuid().parse(scanId);z.enum(ZOHO_REGIONS).parse(region);
      if(typeof accessToken!=='string'||!accessToken)throw new Error('Source authorization required');
      const claim=await rpc(db,'zoho_claim_deleted_scan',{p_scan:scanId});
      if(!claim.claimed)return {done:true};
      const {scan,lease}=claim;if(scan.region!==region)throw new Error('Source region mismatch');
      const endpoint=new URL(`/recruit/v2/${scan.module}/deleted`,ZOHO_HOSTS[region].api);
      endpoint.search=new URLSearchParams({type:'All',page:String(scan.next_page),per_page:'200'}).toString();
      try {
        const page=deletedPage.parse(await recruitJson(endpoint.href,{headers:{Authorization:`Zoho-oauthtoken ${accessToken}`,
          ...(scan.modified_since?{'If-Modified-Since':recruitModifiedSince(scan.modified_since)}:{})}},fetcher,quota));
        return rpc(db,'zoho_commit_deleted_scan',{p_scan:scanId,p_lease:lease,p_records:page.data.map(row=>({externalId:row.id,observedAt:row.deleted_time,kind:row.type})),p_more:page.info.more_records});
      }catch(error){await rpc(db,'zoho_fail_deleted_scan',{p_scan:scanId,p_lease:lease});throw error;}
    },
    snapshot(connectionId) { return rpc(db, 'zoho_source_lifecycle_snapshot', { p_connection: z.string().uuid().parse(connectionId) }); },
    async discoverDeleted(input, accessToken, region, fetcher = fetch, quota) {
      const value = scope.extend({ page: z.number().int().min(1).max(500000),
        modifiedSince: z.string().datetime({ offset: true }).optional() }).strict().parse(input);
      z.enum(ZOHO_REGIONS).parse(region);
      if (typeof accessToken !== 'string' || !accessToken) throw new Error('Source authorization required');
      const endpoint = new URL(`/recruit/v2/${value.module}/deleted`, ZOHO_HOSTS[region].api);
      endpoint.search = new URLSearchParams({ type: 'All', page: String(value.page), per_page: '200' }).toString();
      const result = deletedPage.parse(await recruitJson(endpoint.href, { headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`, ...(value.modifiedSince ? { 'If-Modified-Since': recruitModifiedSince(value.modifiedSince) } : {}),
      } }, fetcher, quota));
      // Only allowlisted identifiers and timestamps cross the storage boundary;
      // deleted_by/display_name are deliberately discarded.
      return rpc(db, 'zoho_stage_source_deletions', { p_connection: value.connectionId, p_module: value.module,
        p_page: value.page, p_records: result.data.map(row => ({ externalId: row.id, observedAt: row.deleted_time, kind: row.type })),
        p_more: result.info.more_records });
    },
    async stageMerge(input, actorId, accessToken, region, fetcher = fetch, quota) {
      const v = sourceMergeEvidenceSchema.parse(input);
      z.enum(ZOHO_REGIONS).parse(region);
      if (typeof accessToken !== 'string' || !accessToken) throw new Error('Source authorization required');
      // Get Records by ID returns no data when the loser is unavailable. Only
      // successful empty responses count; auth/errors never prove deletion.
      const init = { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } };
      const read = async sourceId => {
        const endpoint=new URL(`/recruit/v2/${v.module}/${sourceId}`,ZOHO_HOSTS[region].api);
        const records=new Map();
        for (const converted of ['false','true']) {
          endpoint.search=new URLSearchParams({fields:'id',converted,approved:'both','$state':'save'}).toString();
          const result=await recruitJson(endpoint.href,init,fetcher,quota);
          if (!Array.isArray(result?.data) || result.data.some(row=>!row || typeof row.id!=='string'))
            throw new Error('Source merge evidence could not be verified');
          for (const row of result.data) records.set(row.id,row);
        }
        return {data:[...records.values()]};
      };
      const winner = await read(v.survivorExternalId);
      const loser = await read(v.externalId);
      if (!Array.isArray(winner?.data) || winner.data.length !== 1 || winner.data[0]?.id !== v.survivorExternalId ||
        !Array.isArray(loser?.data) || loser.data.length !== 0) throw new Error('Source merge evidence could not be verified');
      return rpc(db, 'zoho_stage_source_merge', { p_connection: v.connectionId, p_module: v.module, p_external: v.externalId,
        p_survivor: v.survivorExternalId, p_observed: v.observedAt, p_evidence: v.evidenceReference, p_actor: z.string().uuid().parse(actorId) });
    },
    decide(input, actorId) {
      const v = sourceLifecycleDecisionSchema.parse(input);
      return rpc(db, 'zoho_decide_source_lifecycle', { p_connection: v.connectionId, p_proposal: v.proposalId,
        p_revision: v.expectedRevision, p_decision: v.decision, p_reason: v.reason, p_request: v.requestId,
        p_actor: z.string().uuid().parse(actorId) });
    },
  };
}
