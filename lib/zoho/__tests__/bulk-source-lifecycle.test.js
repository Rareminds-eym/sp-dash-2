import { describe,it,expect,vi } from 'vitest';
import { parseBulkRows,extractBulkCsv,createBulkRead } from '../bulk-read';
import { createSourceLifecycle } from '../source-lifecycle';
import { deflateRawSync } from 'node:zlib';
import { bulkArtifactKey } from '../bulk-artifacts';
const connectionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',actor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const text=v=>new TextEncoder().encode(v);
const header='id,Modified_Time,First_Name,Last_Name,Email\r\n';
const row='99900000000000000001,2026-11-01T00:00:00Z,Ada,Lovelace,ada@example.invalid\r\n';
function storedZip(csv,name='Candidates.csv',deflated=false){
 const original=text(csv),data=deflated?new Uint8Array(deflateRawSync(original)):original, filename=text(name);let crc=-1;for(const byte of original){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^-1)>>>0;
 const central=30+filename.length+data.length,end=central+46+filename.length,bytes=new Uint8Array(end+22),v=new DataView(bytes.buffer);
 v.setUint32(0,0x04034b50,true);v.setUint16(8,deflated?8:0,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,original.length,true);v.setUint16(26,filename.length,true);bytes.set(filename,30);bytes.set(data,30+filename.length);
 v.setUint32(central,0x02014b50,true);v.setUint16(central+10,deflated?8:0,true);v.setUint32(central+16,crc,true);v.setUint32(central+20,data.length,true);v.setUint32(central+24,original.length,true);v.setUint16(central+28,filename.length,true);bytes.set(filename,central+46);
 v.setUint32(end,0x06054b50,true);v.setUint16(end+8,1,true);v.setUint16(end+10,1,true);v.setUint32(end+12,46+filename.length,true);v.setUint32(end+16,central,true);return bytes;
}
describe('bounded Recruit bulk export',()=>{
 it('preserves decimal IDs and resumable row offsets',()=>{const parsed=parseBulkRows(text(header+row+row),'Candidates',1,1);expect(parsed.records[0].externalId).toBe('99900000000000000001');expect(parsed.nextOffset).toBe(2);expect(parsed.done).toBe(true);});
 it('parses quoted newlines and escaped quotes without spreadsheet coercion',()=>{const parsed=parseBulkRows(text(header+'1,2026-11-01T00:00:00Z,"Ada\nA.","Love""lace",ada@example.invalid'),'Candidates');expect(parsed.records[0].data.name).toBe('Ada\nA. Love"lace');});
 it.each([header+'1,broken,A,B,a@example.invalid',header+'1,2026-11-01T00:00:00Z,A,B,invalid'])('records invalid row evidence without treating it as absence',csv=>{const r=parseBulkRows(text(csv),'Candidates');expect(r.records.length+r.issues.length).toBe(1);expect(r.done).toBe(true);expect(r.issues.length+(r.records[0]?.errors.length||0)).toBeGreaterThan(0);});
 it.each(['id,Email\n1,x','id,id\n1,1',header+'1,"unterminated',header+'1,x,a,b,c,extra',header+'1,x,"a"bad,b,c'])('rejects malformed CSV or incompatible fields',csv=>expect(()=>parseBulkRows(text(csv),'Candidates')).toThrow());
 it('rejects cursor beyond the immutable export',()=>expect(()=>parseBulkRows(text(header+row),'Candidates',2)).toThrow());
 it('extracts a single verified CSV',async()=>expect(await extractBulkCsv(storedZip(header+row))).toEqual(text(header+row)));
 it('extracts the provider deflate ZIP format',async()=>expect(await extractBulkCsv(storedZip(header+row,'Candidates.csv',true))).toEqual(text(header+row)));
 it('rejects corruption and archive traversal',async()=>{const bytes=storedZip(header+row);bytes[50]^=1;await expect(extractBulkCsv(bytes)).rejects.toThrow();await expect(extractBulkCsv(storedZip(header,'../Candidates.csv'))).rejects.toThrow();});
 it('rejects oversized advertised decompression before inflating',async()=>{const bytes=storedZip(header),v=new DataView(bytes.buffer);const central=30+text('Candidates.csv').length+text(header).length;v.setUint32(central+24,70*1024*1024,true);await expect(extractBulkCsv(bytes)).rejects.toThrow();});
 it('does not recreate an unclaimable bulk job',async()=>{const db={rpc:vi.fn(async()=>({data:{claimed:false}}))},fetcher=vi.fn();expect(await createBulkRead(db).tick(actor,'token','in',fetcher)).toEqual({done:true});expect(fetcher).not.toHaveBeenCalled();});
 it('creates a read export using allowlisted fields without callback or source writes',async()=>{
  const db={rpc:vi.fn(async name=>({data:name==='zoho_claim_bulk_read'?{claimed:true,lease:connectionId,run:{region:'in',state:'creating',module:'Candidates',export_page:1}}:{done:false}}))};
  const fetcher=vi.fn(async()=>Response.json({data:[{details:{id:'12345678901234567890'}}]}));
  await createBulkRead(db).tick(actor,'token','in',fetcher);
  expect(fetcher.mock.calls[0][0]).toBe('https://recruit.zoho.in/recruit/bulk/v2/read');
  const init=fetcher.mock.calls[0][1];expect(init.method).toBe('POST');expect(init.redirect).toBe('manual');
  expect(JSON.parse(init.body)).toEqual({query:{module:'Candidates',selectfields:['id','Modified_Time','First_Name','Last_Name','Email'],page:1}});
  expect(db.rpc).toHaveBeenLastCalledWith('zoho_advance_bulk_read',expect.objectContaining({p_command:'created',p_payload:{jobId:'12345678901234567890'}}));
 });
 it('defers polling on rate limits without creating another export',async()=>{
  const db={rpc:vi.fn(async name=>({data:name==='zoho_claim_bulk_read'?{claimed:true,lease:connectionId,run:{region:'in',state:'polling',module:'Candidates',export_page:1,provider_job_id:'123'}}:{done:false}}))};
  const result=await createBulkRead(db).tick(actor,'token','in',async()=>new Response(null,{status:429,headers:{'Retry-After':'120'}}));
  expect(result.done).toBe(false);expect(db.rpc).toHaveBeenLastCalledWith('zoho_advance_bulk_read',expect.objectContaining({p_command:'deferred',p_payload:expect.objectContaining({retryAfterSeconds:120})}));
 });
 it('downloads an immutable export once across resumable row batches, then removes its artifact',async()=>{
  let pointer=null,bytes=null;const run={region:'in',state:'polling',module:'Candidates',export_page:1,provider_job_id:'123',row_offset:0};
  const db={rpc:vi.fn(async(name,args)=>{
   if(name==='zoho_claim_bulk_read')return {data:{claimed:true,lease:connectionId,run:{...run,artifact:pointer,artifact_ready:!!bytes,artifact_write_pending:false,artifact_count:201,artifact_more:false}}};
   if(name==='zoho_advance_bulk_read'){
    if(args.p_command==='artifact-plan'){pointer={runId:actor,jobId:'123',digest:args.p_payload.archiveHash,key:bulkArtifactKey(actor,'123',args.p_payload.archiveHash),expiresAt:new Date(Date.now()+86400000).toISOString()};return {data:{artifact:pointer}};}
    if(args.p_command==='rows'){run.row_offset=args.p_payload.nextOffset;run.state=args.p_payload.done?'completed':'staging';return {data:{runId:actor,done:args.p_payload.done,state:run.state}};}
   }
   if(name==='zoho_finish_bulk_artifact_write')return {data:{ready:true}};
   return {data:{removed:true}};
  })};
  const store={put:vi.fn(async(_p,value)=>{bytes=value;}),get:vi.fn(async()=>bytes),remove:vi.fn(async()=>{bytes=null;})};
  const archive=storedZip(header+row.repeat(201));const fetcher=vi.fn(async url=>url.endsWith('/result')?new Response(archive):Response.json({data:[{id:'123',query:{module:'Candidates'},state:'COMPLETED',result:{page:1,count:201,more_records:false,download_url:'/recruit/bulk/v2/read/123/result'}}]}));
  const bulk=createBulkRead(db,{artifactStore:store});
  expect((await bulk.tick(actor,'token','in',fetcher)).done).toBe(false);
  expect((await bulk.tick(actor,'token','in',fetcher)).done).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(store.put).toHaveBeenCalledOnce();expect(store.get).toHaveBeenCalledOnce();expect(store.remove).toHaveBeenCalledOnce();
 });
 it('requires private storage before downloading a multi-batch export',async()=>{
  const db={rpc:vi.fn(async name=>({data:name==='zoho_claim_bulk_read'?{claimed:true,lease:connectionId,run:{region:'in',state:'polling',module:'Candidates',export_page:1,provider_job_id:'123',row_offset:0}}:{done:true}}))};
  const fetcher=vi.fn(async()=>Response.json({data:[{id:'123',query:{module:'Candidates'},state:'COMPLETED',result:{page:1,count:201,more_records:false,download_url:'/recruit/bulk/v2/read/123/result'}}]}));
  await expect(createBulkRead(db).tick(actor,'token','in',fetcher)).rejects.toThrow('Private export storage required');expect(fetcher).toHaveBeenCalledOnce();
 });
 it('retains failed cleanup work for a later scheduler retry',async()=>{
  const pointer={runId:actor,jobId:'123',digest:'a'.repeat(64),key:bulkArtifactKey(actor,'123','a'.repeat(64)),expiresAt:new Date(Date.now()+86400000).toISOString()};
  const db={rpc:vi.fn(async()=>({data:[pointer]}))};const store={remove:vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce()};const bulk=createBulkRead(db,{artifactStore:store});
  expect(await bulk.cleanup()).toEqual({removed:0});expect(db.rpc.mock.calls.map(([name])=>name)).not.toContain('zoho_finish_bulk_artifact_cleanup');
  expect(await bulk.cleanup()).toEqual({removed:1});expect(db.rpc).toHaveBeenLastCalledWith('zoho_finish_bulk_artifact_cleanup',{p_run:actor,p_key:pointer.key});
 });
 it('reconciles a finished R2 write after erasure revocation before deleting it',async()=>{
  const pointer={runId:actor,jobId:'123',digest:'a'.repeat(64),key:bulkArtifactKey(actor,'123','a'.repeat(64)),expiresAt:new Date(Date.now()+86400000).toISOString(),writeToken:connectionId};
  const db={rpc:vi.fn(async name=>({data:['zoho_due_bulk_artifact_writes','zoho_due_bulk_artifact_cleanup'].includes(name)?[pointer]:{ready:false,removed:true}}))};
  const store={has:vi.fn(async()=>true),remove:vi.fn(async()=>{})};expect(await createBulkRead(db,{artifactStore:store}).cleanup()).toEqual({removed:1});
  expect(db.rpc.mock.calls.map(([name])=>name)).toEqual(['zoho_due_bulk_artifact_writes','zoho_finish_bulk_artifact_write','zoho_due_bulk_artifact_cleanup','zoho_finish_bulk_artifact_cleanup']);
 });
});
describe('source lifecycle evidence',()=>{
 it('uses documented deletion endpoint and strips source PII before staging',async()=>{const db={rpc:vi.fn(async()=>({data:{done:true}}))};const fetcher=vi.fn(async()=>Response.json({data:[{id:'123',type:'recycle',deleted_time:'2026-11-01T00:00:00Z',display_name:'Private',deleted_by:{name:'Private'}}],info:{more_records:false}}));
 await createSourceLifecycle(db).discoverDeleted({connectionId,module:'Candidates',page:1},'secret','in',fetcher);
 expect(fetcher.mock.calls[0][0]).toContain('https://recruit.zoho.in/recruit/v2/Candidates/deleted?');expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
 expect(JSON.stringify(db.rpc.mock.calls)).not.toContain('Private');expect(db.rpc.mock.calls[0][1].p_records).toEqual([{externalId:'123',kind:'recycle',observedAt:'2026-11-01T00:00:00Z'}]);});
 it('source absence never fabricates a deletion proposal',async()=>{const db={rpc:vi.fn(async()=>({data:{done:true}}))};await createSourceLifecycle(db).discoverDeleted({connectionId,module:'Job_Openings',page:1},'secret','in',async()=>new Response(null,{status:204}));expect(db.rpc.mock.calls[0][1].p_records).toEqual([]);});
 it('requires live surviving source and successful empty loser before merge proposal',async()=>{const db={rpc:vi.fn(async()=>({data:{id:actor}}))};const input={connectionId,module:'Candidates',externalId:'1',survivorExternalId:'2',observedAt:'2026-11-01T00:00:00Z',evidenceReference:'Operator ticket ABC123'};
 const api=createSourceLifecycle(db);await expect(api.stageMerge(input,actor,'secret','in',async()=>Response.json({data:[{id:'2'}]}))).rejects.toThrow();expect(db.rpc).not.toHaveBeenCalled();
 const responses=[Response.json({data:[{id:'2'}]}),new Response(null,{status:204}),new Response(null,{status:204}),new Response(null,{status:204})];
 const fetcher=vi.fn(async()=>responses.shift());await api.stageMerge(input,actor,'secret','in',fetcher);expect(db.rpc).toHaveBeenCalledOnce();
 expect(fetcher.mock.calls.map(([url])=>new URL(url).searchParams.get('converted'))).toEqual(['false','true','false','true']);});
 it('requires exact revision, actor and explicit decision',async()=>{const db={rpc:vi.fn(async()=>({data:{}}))};const api=createSourceLifecycle(db);expect(()=>api.decide({connectionId,proposalId:actor,expectedRevision:0,decision:'approve',reason:'reviewed',requestId:actor},actor)).toThrow();expect(db.rpc).not.toHaveBeenCalled();});
});
