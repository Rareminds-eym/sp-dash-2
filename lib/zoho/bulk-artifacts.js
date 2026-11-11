// Encrypted scratch exports share the existing assets bucket. This prefix is
// outside all asset-serving allowlists; no HTTP reader is introduced.
export const BULK_ARTIFACT_PREFIX = '__private_zoho_bulk/v1/';
const MAX_BYTES=8*1024*1024;
const MAX_INDEXED_BYTES=24*1024*1024,MAX_MANIFEST_BYTES=1024*1024,MAX_CHUNK_BYTES=3*1024*1024;
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
function indexedAssociated(pointer,keyId,kind,index=-1,module=null){
 return new TextEncoder().encode(JSON.stringify(['zoho_bulk_export_v2',pointer.runId,pointer.jobId,pointer.digest,keyId??null,pointer.expiresAt,kind,index,module]));
}
async function boundedRange(object,length){
 const reader=object.body.getReader();const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>length){await reader.cancel();throw new Error('Export range size invalid');}chunks.push(value);}}
 finally{reader.releaseLock();}
 if(size!==length)throw new Error('Export range truncated');
 const bytes=new Uint8Array(size);let at=0;for(const value of chunks){bytes.set(value,at);at+=value.length;}return bytes;
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
  async putIndexed(pointer, prepared, requestedOffset = 0) {
   let writeAttempted=false;
   try {
   checked(pointer,now());
   if(!['Candidates','Job_Openings'].includes(prepared.module)||!Number.isInteger(prepared.total)||prepared.total<0||prepared.total>200000
    ||prepared.chunkSize!==(prepared.module==='Candidates'?200:20))throw new Error('Invalid export index');
   const chosen=select(keyring,undefined,true),key=await aes(chosen.key),parts=[],chunks=[];
   let size=0,offset=0,requested=null,index=0;
   for(const rows of prepared.chunks()){
    const length=rows.records.length+rows.issues.length;
    if(rows.total!==prepared.total||rows.nextOffset!==offset+length||length>prepared.chunkSize
     ||rows.done!==(rows.nextOffset===prepared.total)||(!rows.done&&length!==prepared.chunkSize))throw new Error('Invalid export chunk');
    const bytes=new TextEncoder().encode(JSON.stringify(rows));
    if(bytes.length>MAX_CHUNK_BYTES)throw new Error('Export chunk size limit');
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:indexedAssociated(pointer,chosen.keyId,'chunk',index,prepared.module)},key,bytes));
    chunks.push([size,cipher.length,encode(iv)]);parts.push(cipher);size+=cipher.length;
    if(size>MAX_INDEXED_BYTES||chunks.length>10000)throw new Error('Indexed export size limit');
    if(offset===requestedOffset)requested=rows;
    offset=rows.nextOffset;index++;
   }
   if(offset!==prepared.total||chunks.length!==Math.max(1,Math.ceil(prepared.total/prepared.chunkSize))||!requested)throw new Error('Export index cursor mismatch');
   const manifest=new TextEncoder().encode(JSON.stringify({module:prepared.module,total:prepared.total,chunkSize:prepared.chunkSize,chunks}));
   if(manifest.length>MAX_MANIFEST_BYTES)throw new Error('Export manifest size limit');
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:indexedAssociated(pointer,chosen.keyId,'manifest')},key,manifest));
   // One atomic object under the existing durable pointer; no orphan sidecars.
   writeAttempted=true;
   await bucket.put(pointer.key,new Blob([encrypted,...parts]),{httpMetadata:{contentType:'application/octet-stream',cacheControl:'private, no-store'},
    customMetadata:{version:'2',...(pointer.writeToken?{writeToken:pointer.writeToken}:{}),iv:encode(iv),manifestLength:String(encrypted.length),expiresAt:pointer.expiresAt,...(chosen.keyId?{keyId:chosen.keyId}:{})}});
   return requested;
   } catch(error) { if(!writeAttempted)error.bulkWriteNotStarted=true; throw error; }
  },
  async readRows(pointer,module,offset,chunkSize) {
   checked(pointer,now());
   if(!['Candidates','Job_Openings'].includes(module)||chunkSize!==(module==='Candidates'?200:20)||!Number.isInteger(offset)||offset<0||offset>200000||offset%chunkSize!==0)throw new Error('Export index cursor mismatch');
   const object=typeof bucket.head==='function'?await bucket.head(pointer.key):await bucket.get(pointer.key);
   if(!object)return null;
   if(object.customMetadata?.version==='1'){
    await object.body?.cancel();return {bytes:await this.get(pointer)};
   }
   await object.body?.cancel();
   const meta=object.customMetadata||{},manifestLength=Number(meta.manifestLength);
   if(meta.version!=='2'||meta.expiresAt!==pointer.expiresAt||!/^[A-Za-z0-9+/]{16}$/.test(meta.iv||'')
    ||!Number.isInteger(manifestLength)||manifestLength<16||manifestLength>MAX_MANIFEST_BYTES+16
    ||object.size<manifestLength||object.size>MAX_INDEXED_BYTES+MAX_MANIFEST_BYTES+16||typeof object.etag!=='string')throw new Error('Export index envelope invalid');
   const chosen=select(keyring,meta.keyId,false),key=await aes(chosen.key);
   const range=async(start,length)=>{
    const part=await bucket.get(pointer.key,{range:{offset:start,length},onlyIf:{etagMatches:object.etag}});
    if(!part?.body||part.etag!==object.etag||part.range?.offset!==start||part.range?.length!==length){await part?.body?.cancel();throw new Error('Export index generation changed');}
    return boundedRange(part,length);
   };
   const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(meta.iv),additionalData:indexedAssociated(pointer,chosen.keyId,'manifest')},key,await range(0,manifestLength));
   const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   if(manifest.module!==module||manifest.chunkSize!==chunkSize||!Number.isInteger(manifest.total)||manifest.total<0||manifest.total>200000
    ||!Array.isArray(manifest.chunks)||manifest.chunks.length!==Math.max(1,Math.ceil(manifest.total/chunkSize)))throw new Error('Export manifest invalid');
   let expected=0;
   for(const entry of manifest.chunks){
    if(!Array.isArray(entry)||entry.length!==3||entry[0]!==expected||!Number.isInteger(entry[1])||entry[1]<16||entry[1]>MAX_CHUNK_BYTES+16||!/^[A-Za-z0-9+/]{16}$/.test(entry[2]))throw new Error('Export manifest invalid');
    expected+=entry[1];
   }
   if(expected+manifestLength!==object.size)throw new Error('Export manifest size mismatch');
   const index=offset/chunkSize,entry=manifest.chunks[index];
   if(!entry)throw new Error('Export index cursor mismatch');
   const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(entry[2]),additionalData:indexedAssociated(pointer,chosen.keyId,'chunk',index,module)},key,await range(manifestLength+entry[0],entry[1]));
   const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!Array.isArray(rows.records)||!Array.isArray(rows.issues)||rows.total!==manifest.total
    ||rows.records.length+rows.issues.length!==Math.min(chunkSize,manifest.total-offset)
    ||rows.nextOffset!==Math.min(offset+chunkSize,manifest.total)||rows.done!==(rows.nextOffset===manifest.total))throw new Error('Export chunk cursor mismatch');
   return {rows};
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
   await object?.body?.cancel();
   if(pointer.indexUpgrade)return object?.customMetadata?.version==='2'&&object.customMetadata.writeToken===pointer.writeToken;
   return Boolean(object);
  },
 };
}
