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
  const row=await database.from(table).select('connection_id').eq('id',id).single();
  if(row.error||!row.data)throw new Error('Source operation unavailable');
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
    for(const item of result.data){z.string().uuid().parse(item.id);await env.ZOHO_DISCOVERY_QUEUE.send({[key]:item.id});}
   }
  },
 };
}
