import {describe,it,expect,vi} from 'vitest';
import {createBulkArtifactStore,bulkArtifactKey} from '../bulk-artifacts';
const runId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',jobId='999123';
const key=btoa('k'.repeat(32)),nextKey=btoa('n'.repeat(32));
const keyring={activeKeyId:'current',keys:{current:key}};
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
async function fixture(){
 const bytes=new TextEncoder().encode('private candidate CSV bytes'),digest=await sha(bytes),now=Date.now();
 const pointer={runId,jobId,digest,key:bulkArtifactKey(runId,jobId,digest),expiresAt:new Date(now+86400000).toISOString()};
 const objects=new Map();const bucket={
  put:vi.fn(async(k,data,options)=>objects.set(k,{bytes:new Uint8Array(data),customMetadata:options.customMetadata})),
  get:vi.fn(async k=>{const row=objects.get(k);return row?{size:row.bytes.length,body:new Response(row.bytes).body,customMetadata:row.customMetadata}:null;}),
  delete:vi.fn(async k=>{objects.delete(k);}),
 };
 return {bytes,pointer,objects,bucket,now,store:createBulkArtifactStore(bucket,keyring,()=>now)};
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
