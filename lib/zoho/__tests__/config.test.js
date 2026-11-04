import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {readZohoConfig,ZOHO_FLAG_NAMES,ZOHO_DEFAULTS,ZOHO_PROFILES,sourceProcessingEnabled} from '../config';
describe('code-owned Zoho policy',()=>{
 it('ignores retired external flags, preview, queue selection and callback overrides',()=>{
  const env={ENVIRONMENT:'production',ZOHO_ENVIRONMENT:'dev',ZOHO_PREVIEW:'false',ZOHO_REDIRECT_URI:'https://untrusted.invalid/callback',...Object.fromEntries(Object.values(ZOHO_FLAG_NAMES).map(key=>[key,'true']))};
  expect(readZohoConfig(env)).toBe(ZOHO_PROFILES.production);
  for(const name of Object.keys(ZOHO_FLAG_NAMES))expect(readZohoConfig(env)[name]).toBe(false);
 });
 it('preserves disabled deployment profiles and the verified local profile',()=>{
  for(const ENVIRONMENT of ['production','development','qa','preview','unknown']){
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
});
