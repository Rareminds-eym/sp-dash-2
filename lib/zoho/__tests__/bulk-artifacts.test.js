import {describe,it,expect,vi} from 'vitest';
import {createBulkArtifactStore,bulkArtifactKey} from '../bulk-artifacts';
import {prepareBulkRows} from '../bulk-read';
const runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',jobId='999123';
const key=btoa('k'.repeat(32)),nextKey=btoa('n'.repeat(32));
const keyring={activeKeyId:'current',keys:{current:key}};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function fixture(){
 const bytes=new TextEncoder().encode('private candidate CSV bytes'),digest=await sha(bytes),now=Date.now();
 const pointer={runId,jobId,digest,key:bulkArtifactKey(runId,jobId,digest),expiresAt:new Date(now+86400000).toISOString()};
 const objects=new Map();const reads=[];let generation=0;const bucket={
  put:vi.fn(async(k,data,options)=>objects.set(k,{bytes:new Uint8Array(typeof data.arrayBuffer==='function'?await data.arrayBuffer():data),etag:String(++generation),customMetadata:options.customMetadata})),
  head:vi.fn(async k=>{const row=objects.get(k);return row?{size:row.bytes.length,etag:row.etag,customMetadata:row.customMetadata}:null;}),
  get:vi.fn(async(k,options)=>{const row=objects.get(k);if(!row)return null;
   const base={size:row.bytes.length,etag:row.etag,customMetadata:row.customMetadata};
   if(options?.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==row.etag)return base;
   const range=options?.range,bytes=range?row.bytes.subarray(range.offset,range.offset+range.length):row.bytes;reads.push(bytes.length);
   return {...base,body:new Response(bytes).body,...(range?{range:{offset:range.offset,length:bytes.length}}:{})};}),
  delete:vi.fn(async k=>{objects.delete(k);}),
 };
 return {bytes,pointer,objects,bucket,reads,now,store:createBulkArtifactStore(bucket,keyring,()=>now)};
}
describe('private encrypted Recruit export artifacts',()=>{
 it('stores only AES-GCM ciphertext under a non-asset prefix and authenticates the full export identity',async()=>{
  const f=await fixture();await f.store.put(f.pointer,f.bytes);
  expect(f.pointer.key).toMatch(/^__private_zoho_bulk\/v1\//);const stored=f.objects.get(f.pointer.key);
  expect(new TextDecoder().decode(stored.bytes)).not.toContain('candidate');expect(JSON.stringify(stored.customMetadata)).not.toContain('candidate');
  expect(await f.store.get(f.pointer)).toEqual(f.bytes);
  const moved={...f.pointer,runId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};moved.key=bulkArtifactKey(moved.runId,jobId,moved.digest);f.objects.set(moved.key,stored);
  await expect(f.store.get(moved)).rejects.toThrow();
 });
 it('rejects tampering, mismatched expiry and keys without falling back to another key',async()=>{
  const f=await fixture();await f.store.put(f.pointer,f.bytes);const stored=f.objects.get(f.pointer.key);stored.bytes[0]^=1;
  await expect(f.store.get(f.pointer)).rejects.toThrow();await f.store.put(f.pointer,f.bytes);
  await expect(f.store.get({...f.pointer,expiresAt:new Date(f.now+1000).toISOString()})).rejects.toThrow();
  await expect(createBulkArtifactStore(f.bucket,{activeKeyId:'next',keys:{next:nextKey}},()=>f.now).get(f.pointer)).rejects.toThrow('key unavailable');
  expect(await createBulkArtifactStore(f.bucket,{activeKeyId:'next',keys:{next:nextKey,current:key}},()=>f.now).get(f.pointer)).toEqual(f.bytes);
 });
 it('enforces a seven-day ceiling and rejects expired reads while still permitting cleanup',async()=>{
  const f=await fixture();await expect(f.store.put({...f.pointer,expiresAt:new Date(f.now+8*86400000).toISOString()},f.bytes)).rejects.toThrow();
  await f.store.put(f.pointer,f.bytes);const expired=createBulkArtifactStore(f.bucket,keyring,()=>f.now+2*86400000);
  await expect(expired.get(f.pointer)).rejects.toThrow('expired');await expired.remove(f.pointer);expect(f.objects.size).toBe(0);
 });
 it('does not hide deletion failures or permit traversal during removal',async()=>{
  const f=await fixture();f.bucket.delete.mockRejectedValue(new Error('storage unavailable'));
  await expect(f.store.remove(f.pointer)).rejects.toThrow('storage unavailable');
  await expect(f.store.remove({...f.pointer,key:'course-resources/public.csv'})).rejects.toThrow('pointer');
 });
});

const candidateExport=count=>new TextEncoder().encode('id,Modified_Time,First_Name,Last_Name,Email\r\n'+Array.from({length:count},(_,i)=>`${i+1},2026-11-01T00:00:00Z,Private,Person,private${i}@example.invalid\r\n`).join(''));
describe('indexed encrypted export batches',()=>{
 it('resumes by decrypting only the index and requested batch, including after a worker restart',async()=>{
  const f=await fixture();const first=await f.store.putIndexed(f.pointer,prepareBulkRows(candidateExport(401),'Candidates'));
  expect(first.records).toHaveLength(200);expect(first.nextOffset).toBe(200);
  const stored=f.objects.get(f.pointer.key);expect(stored.customMetadata.version).toBe('2');
  expect(new TextDecoder().decode(stored.bytes)).not.toContain('private0@');
  f.reads.length=0;f.bucket.get.mockClear();
  const restarted=createBulkArtifactStore(f.bucket,keyring,()=>f.now);
  const second=await restarted.readRows(f.pointer,'Candidates',200,200);
  expect(second.rows.records).toHaveLength(200);expect(second.rows.records[0].externalId).toBe('201');
  expect(second.rows.nextOffset).toBe(400);expect(second.rows.done).toBe(false);
  expect(f.bucket.get).toHaveBeenCalledTimes(2);
  expect(f.bucket.get.mock.calls.every(([,options])=>options.range&&options.onlyIf.etagMatches===stored.etag)).toBe(true);
  expect(f.reads.reduce((a,b)=>a+b,0)).toBeLessThan(stored.bytes.length);
  expect((await restarted.readRows(f.pointer,'Candidates',400,200)).rows.records).toHaveLength(1);
  expect((await restarted.readRows(f.pointer,'Candidates',400,200)).rows.done).toBe(true);
 });
 it('authenticates each encrypted batch and index independently',async()=>{
  const f=await fixture();await f.store.putIndexed(f.pointer,prepareBulkRows(candidateExport(201),'Candidates'));
  const stored=f.objects.get(f.pointer.key);stored.bytes[stored.bytes.length-1]^=1;
  await expect(f.store.readRows(f.pointer,'Candidates',200,200)).rejects.toThrow();
  expect((await f.store.readRows(f.pointer,'Candidates',0,200)).rows.records).toHaveLength(200);
  stored.bytes[0]^=1;
  await expect(f.store.readRows(f.pointer,'Candidates',0,200)).rejects.toThrow();
 });
 it('rejects wrong modules, cursors and retired keys without reading another batch',async()=>{
  const f=await fixture();await f.store.putIndexed(f.pointer,prepareBulkRows(candidateExport(201),'Candidates'));
  await expect(f.store.readRows(f.pointer,'Job_Openings',0,20)).rejects.toThrow('manifest');
  await expect(f.store.readRows(f.pointer,'Candidates',1,200)).rejects.toThrow('cursor');
  await expect(createBulkArtifactStore(f.bucket,{activeKeyId:'next',keys:{next:nextKey}},()=>f.now).readRows(f.pointer,'Candidates',0,200)).rejects.toThrow('key unavailable');
 });
 it('fails closed if the atomic object generation changes between metadata and range reads',async()=>{
  const f=await fixture();await f.store.putIndexed(f.pointer,prepareBulkRows(candidateExport(201),'Candidates'));
  const original=f.bucket.get.getMockImplementation();
  f.bucket.get.mockImplementation(async(...args)=>{f.objects.get(f.pointer.key).etag='replaced';return original(...args);});
  await expect(f.store.readRows(f.pointer,'Candidates',0,200)).rejects.toThrow('generation changed');
 });
 it('keeps a single tracked key and permits deletion after expiry',async()=>{
  const f=await fixture();await f.store.putIndexed(f.pointer,prepareBulkRows(candidateExport(201),'Candidates'));
  expect(f.objects.size).toBe(1);
  const expired=createBulkArtifactStore(f.bucket,keyring,()=>f.now+2*86400000);
  await expect(expired.readRows(f.pointer,'Candidates',0,200)).rejects.toThrow('expired');
  await expired.remove(f.pointer);expect(f.objects.size).toBe(0);
 });
 it('distinguishes pre-write validation failure from an uncertain object write',async()=>{
  const f=await fixture();
  await expect(f.store.putIndexed(f.pointer,{module:'Candidates',total:201,chunkSize:200,*chunks(){yield {records:[],issues:[],total:201,nextOffset:0,done:false};}})).rejects.toMatchObject({bulkWriteNotStarted:true});
  expect(f.bucket.put).not.toHaveBeenCalled();
  f.bucket.put.mockRejectedValueOnce(new Error('Storage unavailable'));
  try{await f.store.putIndexed(f.pointer,prepareBulkRows(candidateExport(1),'Candidates'));throw new Error('Expected write failure');}
  catch(error){expect(error.message).toBe('Storage unavailable');expect(error.bulkWriteNotStarted).not.toBe(true);}
 });
 it('can read a legacy encrypted ZIP for a one-time atomic index upgrade',async()=>{
  const f=await fixture();await f.store.put(f.pointer,f.bytes);
  expect((await f.store.readRows(f.pointer,'Candidates',0,200)).bytes).toEqual(f.bytes);
 });
});

it('requires the exact replacement token to reconcile a legacy index write',async()=>{
 const f=await fixture();const token='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await f.store.put(f.pointer,f.bytes);
 expect(await f.store.has({...f.pointer,indexUpgrade:true,writeToken:token})).toBe(false);
 await f.store.putIndexed({...f.pointer,writeToken:token},prepareBulkRows(candidateExport(1),'Candidates'));
 expect(await f.store.has({...f.pointer,indexUpgrade:true,writeToken:token})).toBe(true);
 expect(await f.store.has({...f.pointer,indexUpgrade:true,writeToken:'different'})).toBe(false);
});
