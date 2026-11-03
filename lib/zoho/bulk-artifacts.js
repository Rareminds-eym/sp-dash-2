// Encrypted scratch exports share the existing assets bucket. This prefix is
// outside all asset-serving allowlists; no HTTP reader is introduced.
export const BULK_ARTIFACT_PREFIX = '__private_zoho_bulk/v1/';
const MAX_BYTES=8*1024*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const encode=bytes=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export function bulkArtifactKey(runId,jobId,digest){
 if(!uuid.test(runId)||!/^\d{1,40}$/.test(jobId)||!/^[a-f0-9]{64}$/.test(digest))throw new Error('Invalid export identity');
 return `${BULK_ARTIFACT_PREFIX}${runId}/${jobId}/${digest}.bin`;
}
function select(secret,keyId,writing){
 if(typeof secret==='string'){if(keyId!==undefined)throw new Error('Export key unavailable');return {key:secret};}
 const selected=writing?secret?.activeKeyId:keyId;
 if(selected===undefined){if(!secret?.legacyKey)throw new Error('Export key unavailable');return {key:secret.legacyKey};}
 if(!Object.hasOwn(secret?.keys||{},selected)||!/^[A-Za-z0-9_-]{1,80}$/.test(selected))throw new Error('Export key unavailable');
 return {key:secret.keys[selected],keyId:selected};
}
async function aes(value){const bytes=decode(value||'');if(bytes.length!==32)throw new Error('Invalid export encryption key');return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
function checked(pointer,now){
 if(pointer.key!==bulkArtifactKey(pointer.runId,pointer.jobId,pointer.digest))throw new Error('Export pointer mismatch');
 const expires=Date.parse(pointer.expiresAt);
 if(!Number.isFinite(expires)||expires<=now||expires>now+7*86400000+1000)throw new Error('Export artifact expired');
 return expires;
}
function associated(pointer,keyId){return new TextEncoder().encode(JSON.stringify(['zoho_bulk_export_v1',pointer.runId,pointer.jobId,pointer.digest,keyId??null,pointer.expiresAt]));}
async function bounded(object){
 if(!object?.body||object.size>MAX_BYTES+16)throw new Error('Export artifact size invalid');
 const reader=object.body.getReader();const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES+16){await reader.cancel();throw new Error('Export artifact size invalid');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export function createBulkArtifactStore(bucket,keyring,now=()=>Date.now()){
 if(typeof bucket?.put!=='function'||typeof bucket?.get!=='function'||typeof bucket?.delete!=='function')throw new Error('Private export storage unavailable');
 return {
  async put(pointer,bytes){
   checked(pointer,now());if(!(bytes instanceof Uint8Array)||bytes.length>MAX_BYTES||await digest(bytes)!==pointer.digest)throw new Error('Export artifact integrity invalid');
   const chosen=select(keyring,undefined,true),iv=crypto.getRandomValues(new Uint8Array(12));
   const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:associated(pointer,chosen.keyId)},await aes(chosen.key),bytes);
   await bucket.put(pointer.key,ciphertext,{httpMetadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'},customMetadata:{version:'1',iv:encode(iv),expiresAt:pointer.expiresAt,...(chosen.keyId?{keyId:chosen.keyId}:{})}});
  },
  async get(pointer){
   checked(pointer,now());const object=await bucket.get(pointer.key);if(!object)return null;
   const meta=object.customMetadata||{};
   if(meta.version!=='1'||meta.expiresAt!==pointer.expiresAt||!/^[A-Za-z0-9+/]{16}$/.test(meta.iv||''))throw new Error('Export envelope invalid');
   const chosen=select(keyring,meta.keyId,false);
   const bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(meta.iv),additionalData:associated(pointer,chosen.keyId)},await aes(chosen.key),await bounded(object)));
   if(await digest(bytes)!==pointer.digest)throw new Error('Export artifact integrity invalid');return bytes;
  },
  async remove(pointer){
   // Removal remains possible after TTL/key retirement; validate the path only.
   if(pointer.key!==bulkArtifactKey(pointer.runId,pointer.jobId,pointer.digest))throw new Error('Export pointer mismatch');
   await bucket.delete(pointer.key);
  },
  async has(pointer){
   // R2 object writes are atomic: observing this once-planned key proves that
   // its write finished, even if the database acknowledgement was lost.
   if(pointer.key!==bulkArtifactKey(pointer.runId,pointer.jobId,pointer.digest))throw new Error('Export pointer mismatch');
   const object=typeof bucket.head==='function'?await bucket.head(pointer.key):await bucket.get(pointer.key);
   await object?.body?.cancel();return Boolean(object);
  },
 };
}
