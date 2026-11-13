import { refreshSourceLicense } from './source-license';
import { ZOHO_DEFAULTS, readZohoConfig, sourceProcessingEnabled } from './config';
import {createBulkArtifactStore} from './bulk-artifacts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createBulkRead } from './bulk-read';
import { createSourceLifecycle } from './source-lifecycle';
import { createConnectionQuota } from './source-quota';
import { getConnectionAccessToken } from './oauth';
import { skillpassportDbConfig } from '../skillpassport-db-config';
import { tokenKeyring } from './token-vault';
const bulkMessage=z.object({bulkRunId:z.string().uuid()}).strict();
const licenseMessage=z.object({licenseRefreshConnectionId:z.string().uuid()}).strict();
const deletedMessage=z.object({deletedScanId:z.string().uuid()}).strict();
const active=sourceProcessingEnabled;
export function sourceOperationsRuntime(env,dependencies={}){
 let db;
 function storage(){
  if(db)return db;
  if(dependencies.database)return db=dependencies.database();
  const config=skillpassportDbConfig(env);
  if(!config.SUPABASE_URL||!config.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Source operations storage unavailable');
  return db=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},
   global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(ZOHO_DEFAULTS.requestTimeoutMs)})}});
 }
 async function step(kind,id){
  const database=storage();
  const table=kind==='bulk'?'zoho_bulk_read_runs':'zoho_deleted_scans';
  const row=await database.from(table).select('connection_id,state,next_attempt_at,lease_expires_at').eq('id',id).single();
  if(row.error||!row.data)throw new Error('Source operation unavailable');
  // Redelivered references do not need credentials after completion or while
  // another lease/retry owns the work. The durable claim remains authoritative
  // when eligible, and scheduled recovery dispatches future work when due.
  if(['completed','completed_with_exceptions','failed'].includes(row.data.state) ||
   Date.parse(row.data.next_attempt_at)>Date.now() || Date.parse(row.data.lease_expires_at)>Date.now())return;
  const {connection,accessToken}=await (dependencies.getAccessToken||getConnectionAccessToken)(database,env,row.data.connection_id);
  const quota=createConnectionQuota(database,connection.id);
  const result=kind==='bulk'
   ?await createBulkRead(database,{artifactStore:env.SKILLPASSPORT_ASSETS?createBulkArtifactStore(env.SKILLPASSPORT_ASSETS,tokenKeyring(env)):undefined}).tick(id,accessToken,connection.region,dependencies.fetcher||fetch,quota)
   :await createSourceLifecycle(database).tickDeletedScan(id,accessToken,connection.region,dependencies.fetcher||fetch,quota);
  if(!result.done)await env.ZOHO_DISCOVERY_QUEUE.send(kind==='bulk'?{bulkRunId:id}:{deletedScanId:id},{delaySeconds:ZOHO_DEFAULTS.sourceStepDelaySeconds});
 }
 return {
  recognizes(body){return bulkMessage.safeParse(body).success||deletedMessage.safeParse(body).success||licenseMessage.safeParse(body).success;},
  async message(message){
   if(!active(env)){message.retry({delaySeconds:ZOHO_DEFAULTS.retryDelaySeconds});return;}
   const license=licenseMessage.safeParse(message.body);
   if(license.success){try{await refreshSourceLicense(storage(),env,license.data.licenseRefreshConnectionId,{fetcher:dependencies.fetcher||fetch});message.ack();}catch{message.retry({delaySeconds:ZOHO_DEFAULTS.retryDelaySeconds});}return;}
   const bulk=bulkMessage.safeParse(message.body),deleted=deletedMessage.safeParse(message.body);
   if(!bulk.success&&!deleted.success){message.ack();return;}
   try{await step(bulk.success?'bulk':'deleted',bulk.success?bulk.data.bulkRunId:deleted.data.deletedScanId);message.ack();}
   catch{message.retry({delaySeconds:ZOHO_DEFAULTS.retryDelaySeconds});}
  },
  async scheduled(){
   if(readZohoConfig(env).background&&(readZohoConfig(env).privacyCleanup||readZohoConfig(env).sourceOperations)){
    const artifactStore=env.SKILLPASSPORT_ASSETS?createBulkArtifactStore(env.SKILLPASSPORT_ASSETS,tokenKeyring(env)):undefined;
    await createBulkRead(storage(),{artifactStore}).cleanup();
   }
   if(!active(env))return;
   const database=storage();
   const licenses=await database.rpc('zoho_due_license_refreshes',{});
   if(licenses.error||!Array.isArray(licenses.data)||licenses.data.length>10)throw new Error('License refresh recovery unavailable');
   for(const id of licenses.data){z.string().uuid().parse(id);await env.ZOHO_DISCOVERY_QUEUE.send({licenseRefreshConnectionId:id});}
   for(const [name,key] of [['zoho_due_bulk_reads','bulkRunId'],['zoho_due_deleted_scans','deletedScanId']]){
    const result=await database.rpc(name,{});
    if(result.error||!Array.isArray(result.data)||result.data.length>10)throw new Error('Source operation recovery unavailable');
    const ids=result.data.map(item=>z.string().uuid().parse(item.id));
    let linked=new Set();
    if(key==='bulkRunId'&&ids.length){
     // The sync coordinator owns every linked discovery, including paused or
     // stopped runs. This scheduler owns only standalone inventory requests.
     const discoveries=await database.from('zoho_discovery_runs').select('bulk_run_id').in('bulk_run_id',ids);
     if(discoveries.error||!Array.isArray(discoveries.data))throw new Error('Bulk dispatch ownership unavailable');
     linked=new Set(discoveries.data.map(row=>z.string().uuid().parse(row.bulk_run_id)));
    }
    for(const id of ids)if(!linked.has(id))await env.ZOHO_DISCOVERY_QUEUE.send({[key]:id});
   }
  },
 };
}
