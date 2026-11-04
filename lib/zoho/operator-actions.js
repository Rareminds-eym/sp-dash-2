import { sourceProcessingEnabled } from './config';
import {createBulkArtifactStore} from './bulk-artifacts';
import {tokenKeyring} from './token-vault';
import { z } from 'zod';
import { createBulkRead } from './bulk-read';
import { createSourceLifecycle } from './source-lifecycle';
import { createConnectionQuota } from './source-quota';
import { getConnectionAccessToken,oauthConfiguration } from './oauth';
import { rotateConnectionTokens } from './token-rotation';
import { previewCandidateReview } from './candidate-review';
import { bounded } from './approved-execution';

const uuid=z.string().uuid(), reason=z.string().trim().min(3).max(500);
const pageCursor=z.object({timestamp:z.string().datetime({offset:true}),id:uuid}).strict();
/** Recover committed canonical actions even when no application progress was
 * written before a response was lost. Only live-admin source-scoped refs leave SSO. */
export async function canonicalAdministrationPage(db,auth,input){
 const value=z.object({connectionId:uuid,cursor:pageCursor.nullable().default(null)}).strict().parse(input);
 const connection=await db.from('zoho_connections').select('source_org_id').eq('id',value.connectionId).single();
 if(connection.error||!connection.data)throw new Error('Canonical recovery source unavailable');
 const result=await bounded(()=>auth.env.ZOHO_APPROVER_AUTHORITY.listPendingCandidateAdministrations({accessToken:auth.accessToken,
  sourceOrgId:connection.data.source_org_id,before:value.cursor?{createdAt:value.cursor.timestamp,requestId:value.cursor.id}:null}));
 const item=z.object({requestId:uuid,action:z.enum(['establish_learner_context','erase_connector','release_suppression']),sourceOrgId:z.string().regex(/^\d{1,40}$/),
  externalId:z.string().regex(/^\d{1,40}$/),targetId:uuid,administrationVersion:z.number().int().positive().safe(),createdAt:z.string().datetime({offset:true}),actorId:uuid.optional()});
 const page=z.object({version:z.literal(1),emailPolicy:z.literal('forbidden'),items:z.array(item).max(50),nextCursor:z.object({createdAt:z.string().datetime({offset:true}),requestId:uuid}).nullable()}).parse(result);
 if(page.items.some(row=>row.sourceOrgId!==connection.data.source_org_id))throw new Error('Canonical recovery source mismatch');
 if(page.nextCursor){const last=page.items.at(-1);if(!last||last.requestId!==page.nextCursor.requestId||last.createdAt!==page.nextCursor.createdAt)throw new Error('Canonical recovery cursor mismatch');}
 return {version:1,kind:'canonical',view:'pending',items:page.items.map(row=>({request_id:row.requestId,action:row.action,source_org_id:row.sourceOrgId,external_id:row.externalId,
  target_id:row.targetId,administration_version:row.administrationVersion,actor_id:row.actorId,created_at:row.createdAt,completed:false})),nextCursor:page.nextCursor?{timestamp:page.nextCursor.createdAt,id:page.nextCursor.requestId}:null};
}
export const operatorActions=['start_bulk','start_deleted_scan','stage_source_merge','decide_source_lifecycle','configure_source_quota','rotate_connection_tokens',
  'preview_candidate_administration','execute_candidate_administration','recover_candidate_administration'];
const candidateInput=z.object({connectionId:uuid,recordId:uuid,action:z.enum(['establish_learner_context','erase_connector','release_suppression']),
  reason,acknowledgeIndependentDiscover:z.boolean()}).strict();
async function rpc(db,name,args){const result=await db.rpc(name,args);if(result.error)throw Object.assign(new Error('Operator command unavailable'),{code:result.error.code});return result.data;}
export async function operatorSnapshot(db,connectionId,env={},actor){
 uuid.parse(connectionId);
 const connection=await db.from('zoho_connections').select('id,status,credential_generation,source_org_id,region').eq('id',connectionId).single();
 if(connection.error||!connection.data)throw new Error('Operator state unavailable');
 const [bulk,lifecycle,quota,deleted,administration]=await Promise.all([
  createBulkRead(db).snapshot(connectionId),createSourceLifecycle(db).snapshot(connectionId),
  db.from('zoho_source_quota').select('rolling_budget,concurrent_limit,blocked_until').eq('source_org_id',connection.data.source_org_id) .eq('region',connection.data.region).maybeSingle(),
  db.from('zoho_deleted_scans').select('id,module,state,next_page,failure_count,last_error,scan_started_at,completed_at').eq('connection_id',connectionId).order('scan_started_at',{ascending:false}).limit(20),
  db.from('zoho_candidate_administration_progress').select('request_id,action,external_id,completed,artifacts_confirmed,updated_at').eq('source_org_id',connection.data.source_org_id).eq('actor_id',uuid.parse(actor)).order('updated_at',{ascending:false}).limit(20),
 ]);
 if(quota.error||deleted.error||administration.error)throw new Error('Operator state unavailable');
 return {bulk,lifecycle,deletedScans:deleted.data,administration:administration.data.map(item=>({...item,completed:item.completed&&item.artifacts_confirmed})),sourceEnabled:sourceProcessingEnabled(env)&&Boolean(env.SKILLPASSPORT_ASSETS)&&oauthConfiguration(env).success,connection:{id:connection.data.id,status:connection.data.status,credential_generation:connection.data.credential_generation},quota:quota.data,emailPolicy:'forbidden'};
}
async function administrationContext(db,auth,input){
 const v=candidateInput.parse(input);
 if(v.acknowledgeIndependentDiscover!==(v.action==='establish_learner_context'))throw new Error('Explicit reviewed context acknowledgement required');
 const [connection,record]=await Promise.all([
  db.from('zoho_connections').select('source_org_id').eq('id',v.connectionId).single(),
  db.from('zoho_staged_records').select('id,module,external_id,revision,source_hash,config_revision,target_id').eq('connection_id',v.connectionId).eq('id',v.recordId).single(),
 ]);
 if(connection.error||record.error||record.data?.module!=='Candidates')throw new Error('Candidate source context unavailable');
 const row=record.data;
 let target=row.target_id;
 if(v.action==='establish_learner_context'){
  const review=await previewCandidateReview(db,auth.env.ZOHO_APPROVER_AUTHORITY,auth.accessToken,{connectionId:v.connectionId,recordId:row.id,
   revision:row.revision,sourceHash:row.source_hash,configRevision:row.config_revision,targetId:row.target_id});
  target=review.identity.targetId;
 }
 uuid.parse(target);
 return {value:v,context:{action:v.action,sourceOrgId:connection.data.source_org_id,externalId:row.external_id,targetId:target,
  reason:v.reason,emailPolicy:'forbidden',acknowledgeIndependentDiscover:v.acknowledgeIndependentDiscover}};
}
async function finishAdministration(db,auth,connectionId,receipt,expected){
 const authority=auth.env.ZOHO_APPROVER_AUTHORITY;
 if(receipt?.version!==1||receipt.state!=='completed'||receipt.emailPolicy!=='forbidden'||receipt.canonicalAccountPreserved!==true||
   receipt.scope!=='connector_only'||receipt.oldDataRestored!==false||!uuid.safeParse(receipt.targetId).success||receipt.requestId!==expected.requestId||
   !Number.isSafeInteger(receipt.administrationVersion)||receipt.administrationVersion<1||receipt.currentAdministration!==true||!uuid.safeParse(receipt.approvalActorId).success||
   !['establish_learner_context','erase_connector','release_suppression'].includes(receipt.action)||
   (expected.context&&['action','targetId','sourceOrgId','externalId'].some(key=>receipt[key]!==expected.context[key])))
  throw new Error('Canonical administration receipt unavailable');
 const connection=await db.from('zoho_connections').select('source_org_id').eq('id',connectionId).single();
 if(connection.error||connection.data?.source_org_id!==receipt.sourceOrgId)throw new Error('Administration source mismatch');
 async function acknowledge(value){
  try{
   const ack=await bounded(()=>authority.acknowledgeCandidateAdministration({accessToken:auth.accessToken,requestId:receipt.requestId}));
   if(ack?.version!==1||ack.requestId!==receipt.requestId||ack.administrationVersion!==receipt.administrationVersion||ack.acknowledged!==true||ack.emailPolicy!=='forbidden')throw new Error('Canonical confirmation unavailable');
   return {...value,canonicalAcknowledged:true};
  }catch{
   // SSO retains the pending receipt until ACK succeeds. Its enumeration makes
   // this recoverable after a full reload, even if the application is complete.
   return {...value,state:'application_pending',canonicalAcknowledged:false};
  }
 }
 async function complete(){
  if(receipt.action==='erase_connector'){
   const artifactStore=auth.env.SKILLPASSPORT_ASSETS?createBulkArtifactStore(auth.env.SKILLPASSPORT_ASSETS,tokenKeyring(auth.env)):undefined;
   const erased=await createBulkRead(db,{artifactStore}).eraseSourceArtifacts(connectionId,{requestId:receipt.requestId,administrationVersion:receipt.administrationVersion});
   if(erased?.complete!==true)return {...receipt,state:'application_pending',applicationConfirmed:false};
  }
  const confirmed=await rpc(db,'zoho_confirm_candidate_administration',{p_request:receipt.requestId,p_actor:auth.user.id});
  if(confirmed?.requestId!==receipt.requestId||confirmed.emailPolicy!=='forbidden'||!['completed','application_pending'].includes(confirmed.state))throw new Error('Application administration confirmation unavailable');
  const value={...receipt,state:confirmed.state,applicationConfirmed:confirmed.state==='completed'};
  return confirmed.state==='completed'?acknowledge(value):value;
 }
 if(receipt.action==='establish_learner_context')return acknowledge({...receipt,requiresFreshCandidateReview:true,applicationConfirmed:true});
 const progress=await db.from('zoho_candidate_administration_progress').select('last_operation_id,completed,action,target_id,source_org_id,external_id,administration_version').eq('request_id',receipt.requestId).maybeSingle();
 if(progress.error)throw new Error('Application privacy progress unavailable');
 if(progress.data&&['action','target_id','source_org_id','external_id'].some((key,index)=>progress.data[key]!==[receipt.action,receipt.targetId,receipt.sourceOrgId,receipt.externalId][index]))throw new Error('Application administration scope mismatch');
 const sameVersion=progress.data?.administration_version===receipt.administrationVersion;
 if(progress.data?.completed&&sameVersion)return complete();
 const legacyPartial=progress.data?.administration_version===0&&progress.data?.completed===false;
 let after=sameVersion||legacyPartial?progress.data?.last_operation_id||null:null;
 for(let page=0;page<4;page++){
  let chunk=receipt;
  if(receipt.action==='erase_connector'){
   const result=await bounded(()=>authority.listCandidateErasedOperations({accessToken:auth.accessToken,requestId:receipt.requestId,afterOperationId:after}));
   if(result?.version!==1||result.requestId!==receipt.requestId||result.targetId!==receipt.targetId||result.sourceOrgId!==receipt.sourceOrgId||
     result.externalId!==receipt.externalId||result.action!=='erase_connector'||result.state!=='completed'||result.canonicalAccountPreserved!==true||result.scope!=='connector_only'||result.oldDataRestored!==false||result.administrationVersion!==receipt.administrationVersion||result.approvalActorId!==receipt.approvalActorId||result.currentAdministration!==true||!Array.isArray(result.erasedOperationIds)||result.erasedOperationIds.length>500||typeof result.moreErasedOperations!=='boolean'||result.emailPolicy!=='forbidden')
    throw new Error('Canonical erasure page unavailable');
   chunk={...receipt,erasedOperationIds:result.erasedOperationIds,moreErasedOperations:result.moreErasedOperations};
  }
  const applied=await rpc(db,'zoho_apply_candidate_administration',{p_connection:connectionId,p_receipt:chunk,p_actor:auth.user.id,p_after:after});
  if(applied?.requestId!==receipt.requestId||applied?.emailPolicy!=='forbidden')throw new Error('Application administration receipt mismatch');
  if(applied?.state==='completed')return complete();
  if(applied?.state!=='application_pending'||!uuid.safeParse(applied.afterOperationId).success)throw new Error('Application privacy confirmation unavailable');
  after=applied.afterOperationId;
 }
 return {...receipt,state:'application_pending',applicationConfirmed:false};
}
export async function runOperatorAction(db,auth,action,input){
 if(['start_bulk','start_deleted_scan','stage_source_merge'].includes(action)&&(!sourceProcessingEnabled(auth.env)||!oauthConfiguration(auth.env).success))
  throw Object.assign(new Error('Source operations disabled'),{integrationUnavailable:true});
 const lifecycle=createSourceLifecycle(db);
 const artifactStore=action==='start_bulk'&&auth.env.SKILLPASSPORT_ASSETS?createBulkArtifactStore(auth.env.SKILLPASSPORT_ASSETS,tokenKeyring(auth.env)):undefined;
 const bulk=createBulkRead(db,{artifactStore});
 if(action==='start_bulk'){
  if(!artifactStore)throw Object.assign(new Error('Existing private export store required'),{integrationUnavailable:true});
  const result=await bulk.start(input,auth.user.id);
  try{await auth.env.ZOHO_DISCOVERY_QUEUE.send({bulkRunId:result.runId});}catch{}
  return result;
 }
 if(action==='start_deleted_scan'){
  const v=z.object({connectionId:uuid,module:z.enum(['Candidates','Job_Openings'])}).strict().parse(input);
  const result=await lifecycle.startDeletedScan(v.connectionId,v.module,auth.user.id);
  try{await auth.env.ZOHO_DISCOVERY_QUEUE.send({deletedScanId:result.scanId});}catch{}
  return result;
 }
 if(action==='decide_source_lifecycle')return lifecycle.decide(input,auth.user.id);
 if(action==='stage_source_merge'){
  const {connection,accessToken}=await getConnectionAccessToken(db,auth.env,uuid.parse(input?.connectionId));
  return lifecycle.stageMerge(input,auth.user.id,accessToken,connection.region,fetch,createConnectionQuota(db,connection.id));
 }
 if(action==='configure_source_quota'){
  const v=z.object({connectionId:uuid,budget:z.number().int().min(1).max(1000000),concurrency:z.number().int().min(1).max(5),reason}).strict().parse(input);
  return rpc(db,'zoho_configure_source_quota',{p_connection:v.connectionId,p_budget:v.budget,p_concurrency:v.concurrency,p_reason:v.reason,p_actor:auth.user.id});
 }
 if(action==='rotate_connection_tokens'){
  const v=z.object({connectionId:uuid,expectedGeneration:z.number().int().nonnegative(),reason}).strict().parse(input);
  return rotateConnectionTokens(db,auth.env,{...v,actor:auth.user.id});
 }
 const authority=auth.env.ZOHO_APPROVER_AUTHORITY;
 if(action==='recover_candidate_administration'){
  const v=z.object({connectionId:uuid,requestId:uuid}).strict().parse(input);
  const receipt=await bounded(()=>authority.findCandidateAdministration({accessToken:auth.accessToken,requestId:v.requestId}));
  return finishAdministration(db,auth,v.connectionId,receipt,{requestId:v.requestId});
 }
 if(action==='preview_candidate_administration'){
  const {context}=await administrationContext(db,auth,input);
  const review=await bounded(()=>authority.previewCandidateAdministration({accessToken:auth.accessToken,context}));
  if(review?.version!==1||review.action!==context.action||review.targetId!==context.targetId||review.sourceOrgId!==context.sourceOrgId||review.externalId!==context.externalId||
    review.allowed!==true||review.emailPolicy!=='forbidden'||review.scope!=='connector_only'||review.canonicalAccountPreserved!==true||
    !/^[a-f0-9]{64}$/.test(review.reviewHash||'')||!Number.isFinite(Date.parse(review.expiresAt))||Date.parse(review.expiresAt)<=Date.now())throw new Error('Canonical administration review unavailable');
  return review;
 }
 if(action==='execute_candidate_administration'){
  const v=z.object({context:candidateInput,reviewHash:z.string().regex(/^[a-f0-9]{64}$/),requestId:uuid}).strict().parse(input);
  const {context,value}=await administrationContext(db,auth,v.context);
  const receipt=await bounded(()=>authority.executeCandidateAdministration({accessToken:auth.accessToken,context,reviewHash:v.reviewHash,requestId:v.requestId}));
  return finishAdministration(db,auth,value.connectionId,receipt,{requestId:v.requestId,context});
 }
 throw new Error('Unsupported operator action');
}
