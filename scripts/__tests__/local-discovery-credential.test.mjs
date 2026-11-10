import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {localDiscoveryCredential,startLocalDiscoveryRenewal,needsLocalDiscoveryCredential} from '../lib/local-discovery-credential.mjs';
const now=1700000000000,secret='synthetic-local-key';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const settings={NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon'};
test('renews an expired local restricted reader, verifies it and never returns the signing key',async()=>{
 let request;
 const result=await localDiscoveryCredential({...settings,ZOHO_DISCOVERY_DB_TOKEN:'old'}, {now:()=>now,inspect:()=>({Config:{Env:['PGRST_JWT_SECRET='+secret]}}),fetcher:async(url,init)=>{request={url,init};return new Response('{}');}});
 const [header,payload,signature]=result.token.split('.');
 const claims=JSON.parse(Buffer.from(payload,'base64url'));
 assert.equal(claims.role,'zoho_discovery');assert.equal(claims.exp,now/1000+7*86400);
 assert.equal(signature,createHmac('sha256',secret).update(header+'.'+payload).digest('base64url'));
 assert.equal(request.url.href,'http://127.0.0.1:54321/rest/v1/');assert.equal(request.init.redirect,'manual');
 assert.equal(result.renewed,true);assert.equal(JSON.stringify(result).includes(secret),false);
});
test('reuses a sufficiently fresh token without reading a signing key',async()=>{
 const token='x.'+encode({role:'zoho_discovery',exp:now/1000+2*86400})+'.x';
 const result=await localDiscoveryCredential({...settings,ZOHO_DISCOVERY_DB_TOKEN:token},{now:()=>now,inspect:()=>{throw Error('must not inspect');},fetcher:async()=>new Response('{}')});
 assert.equal(result.token,token);assert.equal(result.renewed,false);
});
test('supports a local octet JWK and preserves its key identifier',async()=>{
 const result=await localDiscoveryCredential(settings,{now:()=>now,inspect:()=>({Config:{Env:['PGRST_JWT_SECRET='+JSON.stringify({keys:[{kty:'oct',kid:'local',k:Buffer.from(secret).toString('base64url')}]})]}}),fetcher:async()=>new Response('{}')});
 assert.equal(JSON.parse(Buffer.from(result.token.split('.')[0],'base64url')).kid,'local');
});
test('refuses remote or conflicting remote aliases before reading any signing key',async()=>{
 await assert.rejects(localDiscoveryCredential({...settings,SUPABASE_URL:'https://remote.example'}, {inspect:()=>{throw Error('must not inspect');}}),/local database/);
});
test('rejects credentials the local database does not accept',async()=>{
 await assert.rejects(localDiscoveryCredential(settings,{now:()=>now,inspect:()=>({Config:{Env:['PGRST_JWT_SECRET='+secret]}}),fetcher:async()=>new Response('{}',{status:401})}),/verification failed/);
});

test('a running local supervisor renews before expiry, serializes renewal and stops its timer',async()=>{
 let tick,stopped=false,renewed=0,release;
 const next={token:'new-restricted-token',expiresAt:now+7*86400000};
 const stop=startLocalDiscoveryRenewal({expiresAt:now+1000,now:()=>now,renew:()=>new Promise(resolve=>{release=()=>resolve(next);}),onRenewed:async value=>{assert.equal(value,next);renewed++;},onError:()=>assert.fail('unexpected error'),setIntervalFn:fn=>{tick=fn;return {};},clearIntervalFn:()=>{stopped=true;}});
 const pending=tick();await tick();release();await pending;
 assert.equal(renewed,1);await tick();assert.equal(renewed,1);stop();assert.equal(stopped,true);
});
test('a stopped supervisor does not restart runtimes after a renewal completes',async()=>{
 let tick,release,restarted=false;
 const stop=startLocalDiscoveryRenewal({expiresAt:0,now:()=>now,renew:()=>new Promise(resolve=>{release=resolve;}),onRenewed:async()=>{restarted=true;},onError:()=>{},setIntervalFn:fn=>{tick=fn;return {};},clearIntervalFn:()=>{}});
 const pending=tick();stop();release({expiresAt:now+7*86400000});await pending;assert.equal(restarted,false);
});

test('an unconfigured Zoho integration does not force normal dashboard startup to issue credentials',()=>{
 assert.equal(needsLocalDiscoveryCredential(settings),false);
 assert.equal(needsLocalDiscoveryCredential({...settings,ZOHO_DISCOVERY_DB_TOKEN:'existing'}),true);
 assert.equal(needsLocalDiscoveryCredential({...settings,ZOHO_CLIENT_ID:'client',ZOHO_CLIENT_SECRET:'secret',ZOHO_TOKEN_ENCRYPTION_KEY:'key'}),true);
});
