import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readZohoConfig,zohoProfileName,ZOHO_FLAG_NAMES,ZOHO_DEFAULTS,ZOHO_PROFILES,sourceProcessingEnabled} from '../config';
import {oauthConfiguration} from '../oauth';
describe('code-owned Zoho policy',()=>{
 it('ignores retired external flags, preview, queue selection and callback overrides',()=>{
  const env={ENVIRONMENT:'production',ZOHO_ENVIRONMENT:'dev',ZOHO_PREVIEW:'false',ZOHO_REDIRECT_URI:'https://untrusted.invalid/callback',...Object.fromEntries(Object.values(ZOHO_FLAG_NAMES).map(key=>[key,'true']))};
  expect(readZohoConfig(env)).toBe(ZOHO_PROFILES.production);
  for(const name of Object.keys(ZOHO_FLAG_NAMES))expect(readZohoConfig(env)[name]).toBe(false);
 });
 it('preserves disabled deployment profiles and the verified local profile',()=>{
  for(const ENVIRONMENT of ['production','development','preview','unknown']){
   for(const name of Object.keys(ZOHO_FLAG_NAMES))expect(readZohoConfig({ENVIRONMENT})[name]).toBe(false);
  }
  expect(readZohoConfig({ENVIRONMENT:'development',SUPABASE_URL:'http://127.0.0.1:54321'})).toBe(ZOHO_PROFILES.local);
  expect(readZohoConfig({ENVIRONMENT:'local-review',SUPABASE_URL:'http://127.0.0.1:54321'})).toBe(ZOHO_PROFILES['local-review']);
  expect(readZohoConfig({ENVIRONMENT:'local',SUPABASE_URL:'https://remote.invalid'})).toBe(ZOHO_PROFILES.blocked);
 });
 it('blocks previews even when a local database and retired flags are supplied',()=>{
  expect(readZohoConfig({ENVIRONMENT:'preview',SUPABASE_URL:'http://localhost:54321',ZOHO_BACKGROUND_ENABLED:'true'})).toBe(ZOHO_PROFILES.preview);
 });
 it('requires the queue and code-owned processing controls',()=>{
  expect(sourceProcessingEnabled({ENVIRONMENT:'local',ZOHO_DISCOVERY_QUEUE:{send(){}}})).toBe(true);
  expect(sourceProcessingEnabled({ENVIRONMENT:'local'})).toBe(false);
  expect(sourceProcessingEnabled({ENVIRONMENT:'production',ZOHO_DISCOVERY_QUEUE:{send(){}}})).toBe(false);
 });
 it('does not expose keys or permit mutable policy overrides',()=>{
  const policy=readZohoConfig({ENVIRONMENT:'production',emailPolicy:'allowed',requiresApproval:false,ZOHO_CLIENT_SECRET:'private'});
  expect(policy.emailPolicy).toBe('forbidden');expect(policy.requiresApproval).toBe(true);expect(Object.isFrozen(policy)).toBe(true);
  expect(policy).not.toHaveProperty('ZOHO_CLIENT_SECRET');
 });
 it('keeps deployment schedules aligned without retired Zoho variables',()=>{
  const config=readFileSync(new URL('../../../wrangler.toml',import.meta.url),'utf8');
  expect(config).not.toMatch(/^ZOHO_\w+\s*=/m);
  expect([...config.matchAll(/^crons = \["([^"]+)"\]/gm)].map(match=>match[1])).toEqual(Array(3).fill(ZOHO_DEFAULTS.recoveryCron));
 });
 it('enables QA discovery, approved execution and private projection with the exact OAuth callback',()=>{
  const env={ENVIRONMENT:'qa',ZOHO_CLIENT_ID:'synthetic',ZOHO_CLIENT_SECRET:'synthetic',
   ZOHO_TOKEN_ENCRYPTION_KEY:btoa('k'.repeat(32)),ZOHO_REDIRECT_URI:'https://untrusted.invalid/callback'};
  const result=oauthConfiguration(env);
  expect(result.success).toBe(true);
  expect(result.data.ZOHO_REDIRECT_URI).toBe('https://sp-dash-2-qa.subashini.workers.dev/api/integrations/zoho-recruit/oauth/callback');
  for(const name of ['background','discovery','sourceOperations','privacyCleanup','execution','jobPublisher'])expect(readZohoConfig(env)[name]).toBe(true);
  expect(readZohoConfig(env).projectionDelivery).toBe(true);
  expect(sourceProcessingEnabled({...env,ZOHO_DISCOVERY_QUEUE:{send(){}}})).toBe(true);
  expect(sourceProcessingEnabled(env)).toBe(false);
 });
 it('still requires every OAuth credential even with a configured QA callback',()=>{
  const credentials={ENVIRONMENT:'qa',ZOHO_CLIENT_ID:'synthetic',ZOHO_CLIENT_SECRET:'synthetic',
   ZOHO_TOKEN_ENCRYPTION_KEY:btoa('k'.repeat(32))};
  for(const name of ['ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET','ZOHO_TOKEN_ENCRYPTION_KEY']){
   expect(oauthConfiguration({...credentials,[name]:undefined}).success).toBe(false);
  }
 });
 it.each([
  ['development','dev'],['dev','dev'],['qa','qa'],['production','production'],
  ['preview','preview'],['local','local'],['local-review','blocked'],
  ['__proto__','blocked'],['constructor','blocked'],['toString','blocked'],
  ['QA','blocked'],[' qa ','blocked'],['unknown','blocked'],[null,'blocked'],[123,'blocked'],
 ])('resolves environment %s to %s', (ENVIRONMENT,expected)=>{
  expect(zohoProfileName({ENVIRONMENT})).toBe(expected);
 });
 it('handles an absent environment safely',()=>{
  expect(readZohoConfig(null)).toBe(ZOHO_PROFILES.blocked);
  expect(readZohoConfig()).toBe(ZOHO_PROFILES.blocked);
  expect(sourceProcessingEnabled(null)).toBe(false);
 });
 it.each(['http://localhost:54321','http://127.0.0.1:54321','http://[::1]:54321','https://localhost:54321'])
 ('recognizes a loopback database at %s',SUPABASE_URL=>{
  expect(zohoProfileName({ENVIRONMENT:'development',SUPABASE_URL})).toBe('local');
 });
 it.each([
  'https://remote.invalid','http://localhost.evil.invalid','ftp://localhost',
  'http://user:pass@localhost:54321','http://localhost:54321/path',
  'http://localhost:54321/?q=1','http://localhost:54321/#fragment','not-a-url',false,0,{},
 ])('blocks explicit local mode with an invalid database alias: %s',SUPABASE_URL=>{
  expect(zohoProfileName({ENVIRONMENT:'local',SUPABASE_URL})).toBe('blocked');
  expect(zohoProfileName({ENVIRONMENT:'local',SKILLPASSPORT_SUPABASE_URL:'http://localhost:54321',SUPABASE_URL})).toBe('blocked');
 });
 it('does not mistake QA or production backed by loopback for the local profile',()=>{
  for(const ENVIRONMENT of ['qa','production']){
   const config=readZohoConfig({ENVIRONMENT,SUPABASE_URL:'http://localhost:54321'});
   expect(config).toBe(ZOHO_PROFILES[ENVIRONMENT]);
   expect(config.background).toBe(ENVIRONMENT==='qa');
  }
 });
 it('keeps the profile registry and all policies immutable',()=>{
  expect(Object.isFrozen(ZOHO_PROFILES)).toBe(true);
  for(const policy of Object.values(ZOHO_PROFILES)){
   expect(Object.isFrozen(policy)).toBe(true);
   expect(()=>{policy.emailPolicy='allowed';}).toThrow();
   expect(()=>{policy.requiresApproval=false;}).toThrow();
  }
 });
});
