vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { describe, it, expect, vi } from 'vitest';
import { validateLiveOperation, validateProjectionReceipt, candidateProjectionCapabilities } from '../execution-authority';
const env = { ZOHO_EXECUTION_ENABLED: 'true', SUPABASE_URL: 'https://fixture.example', SUPABASE_SERVICE_ROLE_KEY: 'fixture' };
describe('independent projection readiness', () => {
  const settings = { ...env, ZOHO_PROJECTION_DELIVERY_ENABLED: 'true' };
  it('requires a positive read-only SQL probe before advertising readiness', async () => {
    const rpc = vi.fn(async () => ({ data: true }));
    expect(await candidateProjectionCapabilities(settings, () => ({ rpc }))).toEqual({
      version: 1, ready: true, emailPolicy: 'forbidden', verifiesPostconditions: true, privateProfiles: true,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('zoho_candidate_projection_ready', {});
  });
  it('denies paused or incomplete configuration before constructing a client', async () => {
    const database = vi.fn();
    for (const config of [{}, { ...settings, ZOHO_PROJECTION_DELIVERY_ENABLED: 'false' },
      { ...settings, SUPABASE_SERVICE_ROLE_KEY: undefined }]) {
      expect(await candidateProjectionCapabilities(config, database)).toMatchObject({ ready: false });
    }
    expect(database).not.toHaveBeenCalled();
  });
  it('denies incompatible probes, grant failures and exceptions without leaking details', async () => {
    for (const data of [false, null, 'true', { ready: true }])
      expect(await candidateProjectionCapabilities(settings, () => ({ rpc: async () => ({ data }) })))
        .toMatchObject({ ready: false, privateProfiles: false });
    expect(await candidateProjectionCapabilities(settings, () => ({ rpc: async () => ({ data: true, error: 'secret' }) })))
      .toMatchObject({ ready: false });
    expect(await candidateProjectionCapabilities(settings, () => { throw new Error('private'); }))
      .toEqual({ version: 1, ready: false, emailPolicy: 'forbidden', verifiesPostconditions: false, privateProfiles: false });
  });
});
describe('restricted live execution authority', () => {
  it('uses only a fixed read-only authority function and returns a boolean', async () => {
    const rpc = vi.fn(async () => ({ data: true }));
    const database = vi.fn(() => ({ rpc }));
    const grant = { operationId: 'fixture' };
    expect(await validateLiveOperation(env, grant, database)).toEqual({ allowed: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('zoho_is_live_approved_operation', { p_grant: grant });
  });
  it.each([
    [{ SKILLPASSPORT_SUPABASE_URL: 'https://app.fixture.example', SKILLPASSPORT_SERVICE_ROLE_KEY: 'specific' }, 'https://app.fixture.example', 'specific'],
    [{ SKILLPASSPORT_SUPABASE_URL: 'https://app.fixture.example', SUPABASE_SERVICE_ROLE_KEY: 'fallback' }, 'https://app.fixture.example', 'fallback'],
    [{ NEXT_PUBLIC_SUPABASE_URL: 'https://public.fixture.example', SUPABASE_SERVICE_ROLE_KEY: 'fallback' }, 'https://public.fixture.example', 'fallback'],
    [{ SUPABASE_URL: 'https://generic.fixture.example', SUPABASE_SERVICE_ROLE_KEY: 'fallback' }, 'https://generic.fixture.example', 'fallback'],
    [{ SKILLPASSPORT_SUPABASE_URL: 'https://app.fixture.example', NEXT_PUBLIC_SUPABASE_URL: 'https://public.fixture.example',
      SUPABASE_URL: 'https://generic.fixture.example', SKILLPASSPORT_SERVICE_ROLE_KEY: 'specific', SUPABASE_SERVICE_ROLE_KEY: 'generic' }, 'https://app.fixture.example', 'specific'],
  ])('reads the application database using the shared configuration policy: %j', async (settings, url, key) => {
    const rpc = vi.fn(async () => ({ data: true }));
    const database = vi.fn(() => ({ rpc }));
    expect(await validateLiveOperation({ ZOHO_EXECUTION_ENABLED: 'true', ...settings }, {}, database)).toEqual({ allowed: true });
    expect(database).toHaveBeenCalledExactlyOnceWith(url, key, expect.any(Object));
    expect(rpc).toHaveBeenCalledExactlyOnceWith('zoho_is_live_approved_operation', { p_grant: {} });
  });
  it.each([
    { SKILLPASSPORT_SUPABASE_URL: 'https://app.fixture.example' },
    { SKILLPASSPORT_SERVICE_ROLE_KEY: 'specific' },
  ])('denies incomplete application configuration without connecting: %j', async settings => {
    const database = vi.fn();
    expect(await validateLiveOperation({ ZOHO_EXECUTION_ENABLED: 'true', ...settings }, {}, database)).toEqual({ allowed: false });
    expect(database).not.toHaveBeenCalled();
  });
  it.each([false, null, 'true', { allowed: true }])('denies malformed or stale storage authority %j', async data => {
    expect(await validateLiveOperation(env, {}, () => ({ rpc: async () => ({ data }) }))).toEqual({ allowed: false });
  });
  it('denies disabled, unconfigured, oversized and malformed requests before connecting', async () => {
    const database = vi.fn();
    for (const [config, grant] of [[{ ...env, ZOHO_EXECUTION_ENABLED: 'false' }, {}], [{}, {}], [env, null], [env, []], [env, { data: 'x'.repeat(131073) }]])
      expect(await validateLiveOperation(config, grant, database)).toEqual({ allowed: false });
    expect(database).not.toHaveBeenCalled();
  });
  it('denies database errors without exposing private details', async () => {
    expect(await validateLiveOperation(env, {}, () => ({ rpc: async () => ({ data: true, error: { message: 'private' } }) }))).toEqual({ allowed: false });
    expect(await validateLiveOperation(env, {}, () => { throw new Error('private'); })).toEqual({ allowed: false });
  });
});

describe('independent application projection receipt authority',()=>{
  const proof={operationId:'10000000-0000-4000-8000-000000000001',sourceHash:'a'.repeat(64),projectionHash:'b'.repeat(64),
    projectionReceiptId:'10000000-0000-4000-8000-000000000002',emailPolicy:'forbidden'};
  const settings={SKILLPASSPORT_SUPABASE_URL:'https://app.fixture.example',SKILLPASSPORT_SERVICE_ROLE_KEY:'fixture',ZOHO_PROJECTION_DELIVERY_ENABLED:'true',ZOHO_EXECUTION_ENABLED:'false'};
  it('reads fixed postconditions independently while new execution remains paused',async()=>{
    const rpc=vi.fn(async()=>({data:true}));const database=vi.fn(()=>({rpc}));
    expect(await validateProjectionReceipt(settings,proof,database)).toEqual({allowed:true});
    expect(rpc).toHaveBeenCalledExactlyOnceWith('zoho_check_candidate_projection',{p_operation:proof.operationId,p_source_hash:proof.sourceHash,p_projection_hash:proof.projectionHash,p_receipt:proof.projectionReceiptId});
  });
  it('denies disabled delivery, unsafe references and non-boolean/error proofs',async()=>{
    const database=vi.fn();
    expect(await validateProjectionReceipt({...settings,ZOHO_PROJECTION_DELIVERY_ENABLED:'false'},proof,database)).toEqual({allowed:false});
    expect(await validateProjectionReceipt(settings,{...proof,email:'private@fixture.example'},database)).toEqual({allowed:false});
    expect(database).not.toHaveBeenCalled();
    for(const data of [false,null,'true',{allowed:true}]) expect(await validateProjectionReceipt(settings,proof,()=>({rpc:async()=>({data})}))).toEqual({allowed:false});
    expect(await validateProjectionReceipt(settings,proof,()=>({rpc:async()=>({data:true,error:{message:'private'}})}))).toEqual({allowed:false});
  });
});
