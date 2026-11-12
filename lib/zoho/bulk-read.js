import { z } from 'zod';
import { normalizeRecruitRecord, MODULES, ZOHO_REGIONS } from './contracts';
import { ZOHO_HOSTS, recruitJson, RecruitFailure } from './oauth';
import { bulkArtifactKey } from './bulk-artifacts';
import { resolveBulkJobSchema } from './job-fields';
import { bulkStagingWindow } from './bulk-staging-window';

const id = z.string().regex(/^\d{1,40}$/);
export const bulkStartSchema = z.object({ connectionId: z.string().uuid(), module: z.enum(MODULES), requestId: z.string().uuid() }).strict();
const fields = { Candidates: ['id','Modified_Time','First_Name','Last_Name','Email'],
  Job_Openings: ['id','Modified_Time','Posting_Title','Client_Name','City','Job_Type','Job_Description','Job_Opening_Status','Application_Link'] };
const MAX_ZIP = 8 * 1024 * 1024; const MAX_CSV = 16 * 1024 * 1024;
async function boundedBytes(stream, max) {
  if (!stream) throw new Error('Missing export body');
  const reader = stream.getReader(); const chunks = []; let total = 0;
  try { for (;;) { const {done,value} = await reader.read(); if (done) break;
    total += value.byteLength; if (total > max) { await reader.cancel(); throw new Error('Export size limit'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(total); let offset = 0;
  for (const bytes of chunks) { output.set(bytes,offset); offset += bytes.byteLength; } return output;
}
function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc>>>1)^((crc&1)?0xedb88320:0); } return (crc^-1)>>>0; }

// Bounds include a decoded UTF-16 CSV and staging rows in the existing Worker.
/** Parse the central directory before inflating: one CSV only, bounded sizes,
 * no encrypted/ZIP64/path entries. CRC and actual output length are verified. */
export async function extractBulkCsv(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length>MAX_ZIP || bytes.length<22) throw new Error('Invalid export archive');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let end = -1;
  for (let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--) if(view.getUint32(at,true)===0x06054b50){end=at;break;}
  if(end<0 || view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0 || view.getUint16(end+8,true)!==1 || view.getUint16(end+10,true)!==1
    || end+22+view.getUint16(end+20,true)!==bytes.length) throw new Error('Unsupported export archive');
  const at=view.getUint32(end+16,true); const directorySize=view.getUint32(end+12,true);
  if(at+46>end || at+directorySize!==end || view.getUint32(at,true)!==0x02014b50) throw new Error('Invalid archive directory');
  const flags=view.getUint16(at+8,true), method=view.getUint16(at+10,true), expectedCrc=view.getUint32(at+16,true), compressed=view.getUint32(at+20,true), expanded=view.getUint32(at+24,true);
  const nameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
  if(at+46+nameLength+extraLength+commentLength!==end || expanded>MAX_CSV || compressed>MAX_ZIP || flags&1 || ![0,8].includes(method) || view.getUint16(at+34,true)!==0)
    throw new Error('Unsupported archive entry');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(at+46,at+46+nameLength));
  if(!/^[A-Za-z0-9 _.-]+\.csv$/i.test(name)||name.includes('..') || local+30>at || view.getUint32(local,true)!==0x04034b50) throw new Error('Unsafe archive entry');
  const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
  if(start+compressed>at || view.getUint16(local+8,true)!==method || view.getUint16(local+6,true)!==flags) throw new Error('Archive entry mismatch');
  const content=bytes.subarray(start,start+compressed);
  const csv=method===0?content:await boundedBytes(new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw')),Math.min(expanded,MAX_CSV));
  if(csv.length!==expanded||crc32(csv)!==expectedCrc) throw new Error('Export integrity failure');
  return csv;
}

/** RFC4180 quoted fields, embedded newlines and CRLF; never coerces numeric IDs.
 * Cursor is the immutable export row offset, not a provider REST page. */
export function parseBulkRows(csv, module, offset=0, limit=200, companyField='Client_Name',titleField='Posting_Title') {
  z.enum(MODULES).parse(module); z.number().int().min(0).max(200000).parse(offset); z.number().int().min(1).max(1000).parse(limit);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(csv).replace(/^\uFEFF/,'');
  let header=null,duplicateId=false,row=[],field='',quoted=false,closed=false,index=0; const records=[],issues=[]; let total=0;
  function cell(){row.push(field);field='';closed=false;}
  function line(){cell();if(row.length===1&&row[0]===''&&index===text.length){row=[];return;}
    if(!header){header=row.map(key=>key==='Id'?'id':key); duplicateId=header[0]==='id'&&header[1]==='id'&&header.filter(key=>key==='id').length===2; if(header.length>50 || new Set(header).size!==header.length-(duplicateId?1:0) || !fields[module].filter(key=>module!=='Job_Openings'||key!=='Application_Link').every(key=>header.includes(key==='Client_Name'?companyField:key==='Posting_Title'?titleField:key))) throw new Error('Export fields mismatch');}
    else { if(row.length!==header.length) throw new Error('Export row width mismatch'); if(duplicateId&&row[0]!==row[1])throw new Error('Export ID columns disagree'); total++; if(total>200000) throw new Error('Export row limit');
      if(total>offset && records.length+issues.length<limit){ const raw=Object.fromEntries(header.map((key,i)=>[key,row[i]]));
        try{records.push(normalizeRecruitRecord(module,raw,companyField,titleField));}catch{issues.push({externalId:id.safeParse(raw.id).success?raw.id:null,code:'SOURCE_SCHEMA_INVALID'});} }}row=[];}
  for(index=0;index<text.length;index++){const c=text[index];
    if(quoted){if(c==='"'){if(text[index+1]==='"'){field+='"';index++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c===','||c==='\n'||c==='\r'){if(c===',')cell();else{if(c==='\r'&&text[index+1]==='\n')index++;line();}}
    else if(c==='"'){if(field||closed)throw new Error('Invalid CSV quoting');quoted=true;}
    else{if(closed)throw new Error('Invalid CSV trailing text');field+=c;}
    if(field.length>65536)throw new Error('Export cell limit');
  }
  if(quoted)throw new Error('Truncated CSV field');if(field||row.length||closed)line();
  if(!header || offset>total)throw new Error('Export cursor mismatch');
  return {records,issues,total,nextOffset:offset+records.length+issues.length,done:offset+records.length+issues.length===total};
}
/** One linear boundary pass; each bounded chunk is then normalized once.
 * Quoted newlines and escaped quotes never become false row boundaries. */
export function prepareBulkRows(csv,module,chunkSize=module==='Candidates'?200:20,companyField='Client_Name',titleField='Posting_Title') {
  z.enum(MODULES).parse(module);
  if(chunkSize!==(module==='Candidates'?200:20))throw new Error('Invalid export chunk size');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(csv).replace(/^\uFEFF/,'');
  let quoted=false,headerEnd=null,start=0,total=0;const ends=[];
  function boundary(end){
    if(headerEnd===null)headerEnd=end;
    else {total++;if(total>200000)throw new Error('Export row limit');if(total%chunkSize===0)ends.push(end);}
    start=end;
  }
  for(let i=0;i<text.length;i++){
    if(text[i]==='"'){
      if(quoted&&text[i+1]==='"')i++;else quoted=!quoted;
    }else if(!quoted&&(text[i]==='\r'||text[i]==='\n')){
      if(text[i]==='\r'&&text[i+1]==='\n')i++;
      boundary(i+1);
    }
  }
  if(quoted)throw new Error('Truncated CSV field');
  if(start<text.length)boundary(text.length);
  if(headerEnd===null)throw new Error('Export fields mismatch');
  const header=text.slice(0,headerEnd);
  // Validate the allowlisted header even for an empty export.
  parseBulkRows(new TextEncoder().encode(header),module,0,chunkSize,companyField,titleField);
  if(!ends.length||ends.at(-1)!==text.length)ends.push(text.length);
  return {module,total,chunkSize,*chunks(){
    let from=headerEnd,offset=0;
    for(const end of ends){
      const rows=parseBulkRows(new TextEncoder().encode(header+text.slice(from,end)),module,0,chunkSize,companyField,titleField);
      const count=rows.records.length+rows.issues.length;
      if(count!==Math.min(chunkSize,total-offset))throw new Error('Export index row mismatch');
      offset+=count;from=end;
      yield {...rows,total,nextOffset:offset,done:offset===total};
    }
  }};
}

async function rpc(db,name,args){const result=await db.rpc(name,args);if(result.error)throw Object.assign(new Error('Bulk command unavailable'),{code:result.error.code});return result.data;}
async function hash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}

export function createBulkRead(db, { artifactStore } = {}) {
  return {
    start(input,actor){const v=bulkStartSchema.parse(input);return rpc(db,'zoho_start_bulk_read',{p_connection:v.connectionId,p_module:v.module,p_request:v.requestId,p_actor:z.string().uuid().parse(actor)});},
    snapshot(connectionId){return rpc(db,'zoho_bulk_read_snapshot',{p_connection:z.string().uuid().parse(connectionId)});},
    async cleanup() {
      if(!artifactStore)return {removed:0,pending:true};
      if(typeof artifactStore.has==='function'){
        const writes=await rpc(db,'zoho_due_bulk_artifact_writes',{});
        for(const pointer of writes){try{if(await artifactStore.has(pointer))await rpc(db,pointer.indexUpgrade?'zoho_finish_bulk_index_write':'zoho_finish_bulk_artifact_write',{p_run:pointer.runId,p_key:pointer.key,p_write_token:pointer.writeToken,p_success:true});}catch{/* Unknown writes remain visible and block erasure completion. */}}
      }
      const due=await rpc(db,'zoho_due_bulk_artifact_cleanup',{});let removed=0;
      for(const row of due){try{await artifactStore.remove(row);await rpc(db,'zoho_finish_bulk_artifact_cleanup',{p_run:row.runId,p_key:row.key});removed++;}catch{/* Durable pointer remains for next scheduled retry. */}}
      return {removed};
    },
    async eraseSourceArtifacts(connectionId,administration) {
      z.string().uuid().parse(connectionId);
      const scope=z.object({requestId:z.string().uuid(),administrationVersion:z.number().int().positive().safe()}).strict().parse(administration);
      const args={p_connection:connectionId,p_request:scope.requestId,p_administration_version:scope.administrationVersion};
      await rpc(db,'zoho_erase_bulk_source_artifacts',args);
      await this.cleanup();
      return rpc(db,'zoho_erase_bulk_source_artifacts',args);
    },
    async tick(runId,accessToken,region,fetcher=fetch,quota){
      z.string().uuid().parse(runId);z.enum(ZOHO_REGIONS).parse(region);if(!accessToken)throw new Error('Source authorization required');
      const claim=await rpc(db,'zoho_claim_bulk_read',{p_run:runId});if(!claim.claimed)return {done:true};
      const {lease,run}=claim;const args={p_run:runId,p_lease:lease};const origin=ZOHO_HOSTS[region].api;
      if(run.region!==region)throw new Error('Source region mismatch');
      const init={headers:{Authorization:`Zoho-oauthtoken ${accessToken}`}};
      const schema = () => run.module === 'Job_Openings'
        ? resolveBulkJobSchema(`${region}:${runId}`, module => recruitJson(
          `${origin}/recruit/v2/settings/fields?module=${module}`,init,fetcher,quota))
        : Promise.resolve({companyField:'Client_Name',titleField:'Posting_Title',optionalApplicationLink:true});
      try {
        if(run.state==='creating'){
          const exportSchema = await schema();
          // The durable claim records creation BEFORE POST. Lost response never
          // retries POST: operator must restart the failed staging-only run.
          const result=await recruitJson(`${origin}/recruit/bulk/v2/read`,{...init,method:'POST',headers:{...init.headers,'Content-Type':'application/json'},body:JSON.stringify({query:{module:run.module,selectfields:fields[run.module].filter(field=>field!=='id'&&(field!=='Application_Link'||exportSchema.optionalApplicationLink)).map(field=>field==='Client_Name'?exportSchema.companyField:field==='Posting_Title'?exportSchema.titleField:field),page:run.export_page}})},fetcher,quota);
          const job=id.parse(result?.data?.[0]?.details?.id);
          return rpc(db,'zoho_advance_bulk_read',{...args,p_command:'created',p_payload:{jobId:job}});
        }
        const job=id.parse(run.provider_job_id);
        let bytes, result, indexedRows, pointer=run.artifact;
        const chunkSize=run.module==='Job_Openings'?20:200;
        if(pointer){
          if(!artifactStore)throw new Error('Private export storage unavailable; use REST inventory');
          const cached=typeof artifactStore.readRows==='function' ? await artifactStore.readRows(pointer,run.module,run.row_offset,chunkSize) : {bytes:await artifactStore.get(pointer)};
          bytes=cached?.bytes;indexedRows=cached?.rows;
          if(bytes||indexedRows){
            result={count:run.artifact_count,more_records:run.artifact_more};
            if(run.artifact_write_pending){
              if(run.artifact_index_upgrade && (typeof artifactStore.has!=='function'||!await artifactStore.has({...pointer,indexUpgrade:true,writeToken:run.artifact_write_token,module:run.module})))throw new Error('Export write outcome unknown; reconciliation required');
              await rpc(db,run.artifact_index_upgrade?'zoho_finish_bulk_index_write':'zoho_finish_bulk_artifact_write',{p_run:runId,p_key:pointer.key,p_write_token:run.artifact_write_token,p_success:true});
            }
          } else if(run.artifact_write_pending)throw new Error('Export write outcome unknown; reconciliation required');
          else if(run.artifact_ready)throw new Error('Export artifact missing; use REST inventory');
        }
        if(!bytes&&!indexedRows){
          const response=await recruitJson(`${origin}/recruit/bulk/v2/read/${job}`,init,fetcher,quota);
          const details=response?.data?.[0];if(details?.id!==job||details?.query?.module!==run.module)throw new Error('Export grant mismatch');
          if(['ADDED','IN PROGRESS'].includes(details.state))return rpc(db,'zoho_advance_bulk_read',{...args,p_command:'waiting',p_payload:{}});
          if(details.state!=='COMPLETED')throw new Error('Export failed');
          result=z.object({page:z.number().int(),count:z.number().int().min(0).max(200000),more_records:z.boolean(),download_url:z.string()}).parse(details.result);
          if(result.page!==run.export_page||result.download_url!==`/recruit/bulk/v2/read/${job}/result`)throw new Error('Export result mismatch');
          if(result.count>200&&!artifactStore)throw new Error('Private export storage required for resumable bulk; use REST inventory');
          // Only an allowlisted provider path is downloaded, once per export.
          const reservation=quota?await quota.reserve('bulk'):null;let downloaded;
          if(quota&&!reservation?.granted)throw new RecruitFailure('RATE_LIMITED',reservation?.retryAfterSeconds||60);
          try{downloaded=await fetcher(`${origin}${result.download_url}`,{...init,redirect:'manual',signal:AbortSignal.timeout(30000)});
            if(quota)await quota.settle(reservation.reservationId,downloaded.status,Number(downloaded.headers.get('Retry-After'))||0);
          }catch{if(quota&&!downloaded)await quota.settle(reservation.reservationId,0,0);throw new RecruitFailure('SOURCE_UNAVAILABLE');}
          if(!downloaded.ok)throw new RecruitFailure(downloaded.status===429?'RATE_LIMITED':downloaded.status>=500?'SOURCE_UNAVAILABLE':'SOURCE_INVALID',Number(downloaded.headers.get('Retry-After'))||0);
          bytes=await boundedBytes(downloaded.body,MAX_ZIP);const digest=await hash(bytes);
          if(pointer&&pointer.digest!==digest)throw new Error('Export changed during cache recovery');
          if(artifactStore){
            // Validate archive/index structure before planning an object write.
            // A rejected source file must not leave an uncertain-write marker.
            const prepared=typeof artifactStore.putIndexed==='function'?prepareBulkRows(await extractBulkCsv(bytes),run.module,chunkSize,(await schema()).companyField,(await schema()).titleField):null;
            if(prepared&&prepared.total!==result.count)throw new Error('Export count mismatch');
            if(!pointer){
              const planned=await rpc(db,'zoho_advance_bulk_read',{...args,p_command:'artifact-plan',p_payload:{archiveHash:digest,count:result.count,more:result.more_records}});
              pointer=planned.artifact;
              if(pointer.key!==bulkArtifactKey(runId,job,digest))throw new Error('Export artifact plan mismatch');
            }
            // The pointer is durable before the object exists. A crash cannot
            // create an untracked export: cleanup knows its deterministic key.
            try{
              if(typeof artifactStore.putIndexed==='function'){
                indexedRows=await artifactStore.putIndexed({...pointer,writeToken:lease},prepared,run.row_offset);bytes=null;
              }else await artifactStore.put(pointer,bytes);
            }
            catch(error){
              if(error.bulkWriteNotStarted===true){
                await rpc(db,'zoho_finish_bulk_artifact_write',{p_run:runId,p_key:pointer.key,p_write_token:lease,p_success:false});
                throw error;
              }
              throw new Error('Export write outcome unknown; reconciliation required');
            }
            const ready=await rpc(db,'zoho_finish_bulk_artifact_write',{p_run:runId,p_key:pointer.key,p_write_token:lease,p_success:true});
            if(!ready.ready)throw new Error('Export revoked during artifact write');
          }
        }
        const digest=pointer?.digest||await hash(bytes);
        if(bytes&&pointer&&typeof artifactStore?.putIndexed==='function'){
          const prepared=prepareBulkRows(await extractBulkCsv(bytes),run.module,chunkSize,(await schema()).companyField,(await schema()).titleField);
          if(prepared.total!==result.count)throw new Error('Export count mismatch');
          await rpc(db,'zoho_begin_bulk_index_upgrade',{p_run:runId,p_lease:lease,p_key:pointer.key});
          try { indexedRows=await artifactStore.putIndexed({...pointer,writeToken:lease},prepared,run.row_offset);bytes=null; }
          catch(error){
            if(error.bulkWriteNotStarted===true){await rpc(db,'zoho_finish_bulk_index_write',{p_run:runId,p_key:pointer.key,p_write_token:lease,p_success:false});throw error;}
            throw new Error('Export write outcome unknown; reconciliation required');
          }
          const ready=await rpc(db,'zoho_finish_bulk_index_write',{p_run:runId,p_key:pointer.key,p_write_token:lease,p_success:true});
          if(!ready.ready)throw new Error('Export revoked during index write');
        }
        const rows=indexedRows||parseBulkRows(await extractBulkCsv(bytes),run.module,run.row_offset,chunkSize,(await schema()).companyField,(await schema()).titleField);
        if(rows.total!==result.count)throw new Error('Export count mismatch');
        const commitRows=run.module==='Job_Openings'?bulkStagingWindow(rows,run.row_offset,5):rows;
        const committed=await rpc(db,'zoho_advance_bulk_read',{...args,p_command:'rows',p_payload:{...commitRows,archiveHash:digest,more:result.more_records}});
        if(commitRows.done&&pointer&&artifactStore){
          try{await artifactStore.remove(pointer);await rpc(db,'zoho_finish_bulk_artifact_cleanup',{p_run:runId,p_key:pointer.key});}catch{/* Scheduled cleanup retries; pointer is retained. */}
        }
        return committed;
      }catch(error){
        const retryable=run.state!=='creating'&&error instanceof RecruitFailure&&['RATE_LIMITED','SOURCE_UNAVAILABLE'].includes(error.code);
        await rpc(db,'zoho_advance_bulk_read',{...args,p_command:retryable?'deferred':'failed',p_payload:{retryAfterSeconds:Math.min(86400,Math.max(30,error.retryAfterSeconds||60)),code:error.message.includes('write outcome unknown')?'ARTIFACT_WRITE_OUTCOME_UNKNOWN':'BULK_SOURCE_OR_VALIDATION_FAILED'}});
        if(!retryable&&artifactStore){try{await this.cleanup();}catch{/* Durable cleanup is retried by scheduler. */}}
        if(retryable)return {runId,done:false,state:run.state};throw error;
      }
    },
  };
}
