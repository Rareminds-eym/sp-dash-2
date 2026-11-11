vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({candidateReview:vi.fn(),rotate:vi.fn(),bulk:{start:vi.fn(),snapshot:vi.fn(),eraseSourceArtifacts:vi.fn()},
 lifecycle:{startDeletedScan:vi.fn(),stageMerge:vi.fn(),decide:vi.fn(),snapshot:vi.fn()}}));
vi.mock('../bulk-read',()=>({createBulkRead:()=>mocks.bulk}));
vi.mock('../source-lifecycle',()=>({createSourceLifecycle:()=>mocks.lifecycle}));
vi.mock('../source-quota',()=>({createConnectionQuota:()=>({})}));
vi.mock('../oauth',()=>({getConnectionAccessToken:vi.fn()}));
vi.mock('../token-rotation',()=>({rotateConnectionTokens:mocks.rotate}));
vi.mock('../candidate-review',()=>({previewCandidateReview:mocks.candidateReview}));
vi.mock('../approved-execution',()=>({bounded:work=>work()}));
import {runOperatorAction,canonicalAdministrationPage} from '../operator-actions';
const connectionId='10000000-0000-4000-8000-000000000001',recordId='10000000-0000-4000-8000-000000000002';
const targetId='10000000-0000-4000-8000-000000000003',actorId='10000000-0000-4000-8000-000000000004';
const requestId='10000000-0000-4000-8000-000000000005',other='10000000-0000-4000-8000-000000000006';
const operationId='20000000-0000-4000-8000-000000000001',nextOperation='20000000-0000-4000-8000-000000000002';
const reviewHash='a'.repeat(64);
function input(action='erase_connector'){return {connectionId,recordId,action,reason:'Explicit source-scoped operation',acknowledgeIndependentDiscover:action==='establish_learner_context'};}
function canonical(action='erase_connector'){return {version:1,requestId,action,state:'completed',targetId,sourceOrgId:'1234',externalId:'456',
 emailPolicy:'forbidden',canonicalAccountPreserved:true,scope:'connector_only',oldDataRestored:false,erasedOperationIds:[operationId],moreErasedOperations:false,administrationVersion:1,currentAdministration:true,applicationAcknowledged:false,approvalActorId:actorId};}
function fixture(){
 const receipt=canonical();
 const review={version:1,scope:'connector_only',action:'erase_connector',targetId,sourceOrgId:'1234',externalId:'456',allowed:true,
  canonicalAccountPreserved:true,emailPolicy:'forbidden',changes:{},reviewHash,expiresAt:new Date(Date.now()+600000).toISOString()};
 const authority={previewCandidateAdministration:vi.fn(async()=>review),executeCandidateAdministration:vi.fn(async()=>receipt),
  findCandidateAdministration:vi.fn(async()=>receipt),listCandidateErasedOperations:vi.fn(async()=>receipt),
  acknowledgeCandidateAdministration:vi.fn(async()=>({version:1,requestId,administrationVersion:1,acknowledged:true,emailPolicy:'forbidden'})),
  listPendingCandidateAdministrations:vi.fn(async()=>({version:1,emailPolicy:'forbidden',items:[],nextCursor:null}))};
 const source={id:connectionId,status:'connected',source_org_id:'1234',config_revision:1,region:'in'};
 const record={id:recordId,connection_id:connectionId,module:'Candidates',external_id:'456',revision:1,source_hash:'b'.repeat(64),config_revision:1,target_id:targetId};
 let progress=null;
 const db={from:vi.fn(table=>{const q={select:()=>q,eq:()=>q,
  single:async()=>({data:table==='zoho_connections'?source:record}),
  maybeSingle:async()=>({data:table==='zoho_candidate_administration_progress'?progress:null})};return q;}),
  rpc:vi.fn(async(name,args)=>name==='zoho_apply_candidate_administration'?{data:{requestId:args.p_receipt.requestId,state:'completed',emailPolicy:'forbidden'}}:name==='zoho_confirm_candidate_administration'?{data:{requestId:args.p_request,state:'completed',emailPolicy:'forbidden'}}:{data:true})};
 const auth={user:{id:actorId},accessToken:'signed-human',env:{ZOHO_APPROVER_AUTHORITY:authority,ZOHO_SOURCE_OPERATIONS_ENABLED:'true'}};
 return {db,auth,receipt,review,authority,source,record,setProgress:p=>{progress={action:'erase_connector',target_id:targetId,source_org_id:'1234',external_id:'456',administration_version:1,...p};}};
}
beforeEach(()=>{vi.clearAllMocks();mocks.candidateReview.mockResolvedValue({identity:{targetId}});mocks.bulk.eraseSourceArtifacts.mockResolvedValue({complete:true,remaining:0});});
describe('operator administration scope and recovery',()=>{
 it('discovers an SSO-only committed request without application progress or browser memory, then recovers it',async()=>{
  const f=fixture();
  f.authority.listPendingCandidateAdministrations.mockResolvedValue({version:1,emailPolicy:'forbidden',nextCursor:null,items:[{requestId,action:'erase_connector',sourceOrgId:'1234',externalId:'456',targetId,administrationVersion:1,createdAt:'2026-11-03T00:00:00Z',actorId:other}]});
  const page=await canonicalAdministrationPage(f.db,f.auth,{connectionId});
  expect(page.items[0]).toMatchObject({request_id:requestId,actor_id:other,completed:false});
  const value=await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId:page.items[0].request_id});
  expect(value).toMatchObject({state:'completed',canonicalAcknowledged:true});
  expect(f.authority.executeCandidateAdministration).not.toHaveBeenCalled();
  expect(f.authority.acknowledgeCandidateAdministration).toHaveBeenCalledExactlyOnceWith({accessToken:'signed-human',requestId});
 });
 it('rejects canonical recovery pages for another source or inconsistent cursors',async()=>{
  const f=fixture();const item={requestId,action:'erase_connector',sourceOrgId:'9999',externalId:'456',targetId,administrationVersion:1,createdAt:'2026-11-03T00:00:00Z'};
  f.authority.listPendingCandidateAdministrations.mockResolvedValue({version:1,emailPolicy:'forbidden',items:[item],nextCursor:null});
  await expect(canonicalAdministrationPage(f.db,f.auth,{connectionId})).rejects.toThrow('source mismatch');
  item.sourceOrgId='1234';f.authority.listPendingCandidateAdministrations.mockResolvedValue({version:1,emailPolicy:'forbidden',items:[item],nextCursor:{createdAt:item.createdAt,requestId:other}});
  await expect(canonicalAdministrationPage(f.db,f.auth,{connectionId})).rejects.toThrow('cursor mismatch');
 });
 it('keeps canonical ACK pending and discoverable when the ACK response is lost',async()=>{
  const f=fixture();f.authority.acknowledgeCandidateAdministration.mockRejectedValueOnce(new Error('response lost'));
  expect(await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).toMatchObject({state:'application_pending',applicationConfirmed:true,canonicalAcknowledged:false});
  expect(await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).toMatchObject({state:'completed',canonicalAcknowledged:true});
 });
 it('reconciles legacy completed progress through the current versioned application wrapper',async()=>{
  const f=fixture();f.setProgress({completed:true,administration_version:0,last_operation_id:operationId});
  await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId});
  expect(f.authority.listCandidateErasedOperations).toHaveBeenCalledWith({accessToken:'signed-human',requestId,afterOperationId:null});
  expect(f.db.rpc).toHaveBeenCalledWith('zoho_apply_candidate_administration',expect.objectContaining({p_after:null}));
  expect(f.authority.acknowledgeCandidateAdministration).toHaveBeenCalledOnce();
 });
 it('preserves a legacy partial erasure cursor while upgrading its receipt version',async()=>{
  const f=fixture();f.setProgress({completed:false,administration_version:0,last_operation_id:operationId});
  f.authority.listCandidateErasedOperations.mockResolvedValue({...f.receipt,erasedOperationIds:[nextOperation]});
  await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId});
  expect(f.authority.listCandidateErasedOperations).toHaveBeenCalledWith({accessToken:'signed-human',requestId,afterOperationId:operationId});
  expect(f.db.rpc).toHaveBeenCalledWith('zoho_apply_candidate_administration',expect.objectContaining({p_after:operationId}));
 });
 it('rejects a superseded canonical receipt before any application mutation',async()=>{
  const f=fixture();f.receipt.currentAdministration=false;
  await expect(runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).rejects.toThrow();
  expect(f.db.rpc).not.toHaveBeenCalled();expect(mocks.bulk.eraseSourceArtifacts).not.toHaveBeenCalled();
 });
 it('acknowledges successful learner-context setup before returning for fresh candidate review',async()=>{
  const f=fixture();Object.assign(f.receipt,canonical('establish_learner_context'));
  expect(await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).toMatchObject({state:'completed',requiresFreshCandidateReview:true,canonicalAcknowledged:true});
  expect(f.db.rpc).not.toHaveBeenCalled();expect(f.authority.acknowledgeCandidateAdministration).toHaveBeenCalledOnce();
 });
 it('derives the canonical target from fresh source review and rejects arbitrary browser target overrides',async()=>{
  const f=fixture();f.record.target_id=null;f.review.action='establish_learner_context';
  await runOperatorAction(f.db,f.auth,'preview_candidate_administration',input('establish_learner_context'));
  expect(mocks.candidateReview).toHaveBeenCalledExactlyOnceWith(f.db,f.authority,'signed-human',{connectionId,recordId,revision:1,
   sourceHash:f.record.source_hash,configRevision:1,targetId:null});
  expect(f.authority.previewCandidateAdministration).toHaveBeenCalledExactlyOnceWith({accessToken:'signed-human',context:{action:'establish_learner_context',
   sourceOrgId:'1234',externalId:'456',targetId,reason:input().reason,emailPolicy:'forbidden',acknowledgeIndependentDiscover:true}});
  f.authority.previewCandidateAdministration.mockClear();
  await expect(runOperatorAction(f.db,f.auth,'preview_candidate_administration',{...input('establish_learner_context'),targetId:other})).rejects.toThrow();
  expect(f.authority.previewCandidateAdministration).not.toHaveBeenCalled();
 });
 it('requires explicit independent Discover acknowledgement and does not execute on stale canonical review',async()=>{
  const f=fixture();
  await expect(runOperatorAction(f.db,f.auth,'preview_candidate_administration',{...input('establish_learner_context'),acknowledgeIndependentDiscover:false})).rejects.toThrow();
  mocks.candidateReview.mockRejectedValueOnce(Object.assign(new Error('Reviewed selection changed'),{code:'40001'}));
  await expect(runOperatorAction(f.db,f.auth,'execute_candidate_administration',{context:input('establish_learner_context'),reviewHash,requestId})).rejects.toThrow('changed');
  expect(f.authority.executeCandidateAdministration).not.toHaveBeenCalled();
 });
 it.each(['scope','allowed','emailPolicy','expiresAt'])('rejects invalid preview %s evidence',async field=>{
  const f=fixture();f.review[field]=({scope:'platform_account',allowed:false,emailPolicy:'allowed',expiresAt:new Date(Date.now()-1000).toISOString()})[field];
  await expect(runOperatorAction(f.db,f.auth,'preview_candidate_administration',input())).rejects.toThrow();
 });
 it.each(['requestId','action','targetId','sourceOrgId','externalId','scope'])('binds executed canonical receipt %s to the requested command',async field=>{
  const f=fixture();f.receipt[field]=({requestId:other,action:'establish_learner_context',targetId:other,sourceOrgId:'9999',externalId:'9999',scope:'platform_account'})[field];
  await expect(runOperatorAction(f.db,f.auth,'execute_candidate_administration',{context:input(),reviewHash,requestId})).rejects.toThrow();
  expect(f.db.rpc).not.toHaveBeenCalled();
 });
 it('rejects wrong-source recovery before accepting even completed application progress',async()=>{
  const f=fixture();f.source.source_org_id='9999';f.setProgress({last_operation_id:operationId,completed:true});
  await expect(runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).rejects.toThrow();
  expect(f.db.rpc).not.toHaveBeenCalled();
 });
 it('recovers durable pagination from the recorded cursor without reexecuting the canonical mutation',async()=>{
  const f=fixture();f.setProgress({last_operation_id:operationId,completed:false});
  f.authority.listCandidateErasedOperations.mockResolvedValue({...f.receipt,erasedOperationIds:[nextOperation]});
  const value=await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId});
  expect(f.authority.findCandidateAdministration).toHaveBeenCalledExactlyOnceWith({accessToken:'signed-human',requestId});
  expect(f.authority.executeCandidateAdministration).not.toHaveBeenCalled();
  expect(f.authority.listCandidateErasedOperations).toHaveBeenCalledExactlyOnceWith({accessToken:'signed-human',requestId,afterOperationId:operationId});
  expect(f.db.rpc).toHaveBeenCalledWith('zoho_apply_candidate_administration',expect.objectContaining({p_connection:connectionId,p_actor:actorId,p_after:operationId}));
  expect(value).toMatchObject({state:'completed',applicationConfirmed:true});
 });
 it.each(['action','state','canonicalAccountPreserved'])('rejects inconsistent erasure page %s before application writes',async field=>{
  const f=fixture();f.authority.listCandidateErasedOperations.mockResolvedValue({...f.receipt,[field]:({action:'release_suppression',state:'pending',canonicalAccountPreserved:false})[field]});
  await expect(runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).rejects.toThrow();
  expect(f.db.rpc).not.toHaveBeenCalled();
 });
 it.each(['requestId','emailPolicy'])('rejects an application completion with mismatched %s',async field=>{
  const f=fixture();f.db.rpc.mockResolvedValue({data:{requestId,state:'completed',emailPolicy:'forbidden',[field]:field==='requestId'?other:'allowed'}});
  await expect(runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId})).rejects.toThrow();
 });
 it('leaves incomplete artifact erasure pending and retries it through recovery',async()=>{
  const f=fixture();mocks.bulk.eraseSourceArtifacts.mockResolvedValueOnce({complete:false,remaining:1});
  const value=await runOperatorAction(f.db,f.auth,'recover_candidate_administration',{connectionId,requestId});
  expect(value).toMatchObject({state:'application_pending',applicationConfirmed:false});
  expect(mocks.bulk.eraseSourceArtifacts).toHaveBeenCalledWith(connectionId,{requestId,administrationVersion:1});
  expect(f.authority.acknowledgeCandidateAdministration).not.toHaveBeenCalled();
 });
 it('forwards only reviewed rotation generation and the verified actor, never browser keys',async()=>{
  const f=fixture();mocks.rotate.mockResolvedValue({status:'paused',keyId:'current'});
  expect(await runOperatorAction(f.db,f.auth,'rotate_connection_tokens',{connectionId,expectedGeneration:2,reason:'Approved paused rotation'})).toEqual({status:'paused',keyId:'current'});
  expect(mocks.rotate).toHaveBeenCalledExactlyOnceWith(f.db,f.auth.env,{connectionId,expectedGeneration:2,reason:'Approved paused rotation',actor:actorId});
  mocks.rotate.mockClear();
  await expect(runOperatorAction(f.db,f.auth,'rotate_connection_tokens',{connectionId,expectedGeneration:2,reason:'Approved paused rotation',encryptionKey:'browser-secret'})).rejects.toThrow();
  expect(mocks.rotate).not.toHaveBeenCalled();
 });
});
