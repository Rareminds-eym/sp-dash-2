import { describe, expect, it, vi } from 'vitest';
import { sealTokens, openTokens, stateHash } from '../token-vault';
import { oauthConfiguration, createZohoOAuth, recruitJson } from '../oauth';
const key = btoa('a'.repeat(32));
describe('Zoho token protection', () => {
  it('requests bulk read during consent without adding module write or ALL permissions', async () => {
    const source={id:'10000000-0000-4000-8000-000000000001',source_org_id:'1234',region:'in'};
    let stored;
    const db={from:table=>table==='zoho_connections'?{select:()=>({eq:()=>({single:async()=>({data:source})})})}:{insert:async value=>{stored=value;return {data:null};}}};
    const service=createZohoOAuth(db,{ZOHO_CLIENT_ID:'client',ZOHO_CLIENT_SECRET:'secret',ENVIRONMENT:'local',ZOHO_TOKEN_ENCRYPTION_KEY:key});
    const target=new URL(await service.start(source.id,'verified-admin','http://localhost:3010'));
    const scopes=target.searchParams.get('scope').split(',');
    expect(scopes).toContain('ZohoRecruit.bulk.read');
    expect(scopes).toEqual(['ZohoRecruit.modules.candidate.READ','ZohoRecruit.modules.jobopening.READ','ZohoRecruit.bulk.read','ZohoRecruit.org.READ','ZohoRecruit.settings.fields.read']);
    expect(scopes.some(scope=>/\.(ALL|CREATE|UPDATE|DELETE)$/i.test(scope))).toBe(false);
    expect(target.origin).toBe('https://accounts.zoho.in');
    expect(target.searchParams.get('prompt')).toBe('consent');
    expect(stored.state_hash).toBe(await stateHash(target.searchParams.get('state')));
  });
  it('encrypts credentials and binds them to one connection', async () => {
    const credentials = { accessToken: 'private-access', refreshToken: 'private-refresh' };
    const envelope = await sealTokens(credentials, key, 'source-a');
    expect(JSON.stringify(envelope)).not.toContain('private');
    expect(await openTokens(envelope, key, 'source-a')).toEqual(credentials);
    await expect(openTokens(envelope, key, 'source-b')).rejects.toThrow();
    await expect(openTokens({ ...envelope, iv: btoa('b'.repeat(12)) }, key, 'source-a')).rejects.toThrow();
  });
  it('rejects a different organization without storing tokens or logging contact data', async () => {
    const source={id:'10000000-0000-4000-8000-000000000001',source_org_id:'1234',region:'in'};
    const rpc=vi.fn(async name=>({data:name==='zoho_consume_oauth_state'?{connectionId:source.id}:
      name==='zoho_reserve_source_quota'?{granted:true,reservationId:'reservation'}:{ok:true}}));
    const db={rpc,from:()=>({select:()=>({eq:()=>({single:async()=>({data:source})})})})};
    const fetcher=vi.fn(async url=>Response.json(url.includes('/oauth/')?
      {access_token:'private-access',refresh_token:'private-refresh',expires_in:3600}:
      {org:[{id:'5678',zgid:'9999',primary_email:'private@example.invalid'}]}));
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      const service=createZohoOAuth(db,{ZOHO_CLIENT_ID:'client',ZOHO_CLIENT_SECRET:'secret',ENVIRONMENT:'local',ZOHO_TOKEN_ENCRYPTION_KEY:key},fetcher);
      await expect(service.complete('state','code','admin')).rejects.toMatchObject({code:'ORGANIZATION_MISMATCH'});
      expect(rpc.mock.calls.some(([name])=>name==='zoho_complete_connection')).toBe(false);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-access|private-refresh|private@example/);
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it.each([
    [{zgid:'1234'},true],
    [{id:'1234'},true],
    [{id:'different',zgid:'1234'},true],
    [{id:'1234',zgid:'5678'},false],
    [{id:'1234',zgid:1234},false],
    [{zgid:1234},false],
    [{id:1234},false],
    [{company_name:'1234'},false],
    [null,false],
  ])('verifies exact Recruit organization identifiers %j (accepted=%s)', async (org,accepted) => {
    const source={id:'10000000-0000-4000-8000-000000000001',source_org_id:'1234',region:'in'};
    const rpc=vi.fn(async name=>({data:name==='zoho_consume_oauth_state'?{connectionId:source.id}:
      name==='zoho_reserve_source_quota'?{granted:true,reservationId:'reservation'}:{ok:true}}));
    const db={rpc,from:()=>({select:()=>({eq:()=>({single:async()=>({data:source})})})})};
    const fetcher=async url=>Response.json(url.includes('/oauth/')?
      {access_token:'private-access',refresh_token:'private-refresh',expires_in:3600}:{org:[org]});
    const service=createZohoOAuth(db,{ZOHO_CLIENT_ID:'client',ZOHO_CLIENT_SECRET:'secret',ENVIRONMENT:'local',ZOHO_TOKEN_ENCRYPTION_KEY:key},fetcher);
    if (accepted) {
      await expect(service.complete('state','code','admin')).resolves.toBe(source.id);
      const completion=rpc.mock.calls.find(([name])=>name==='zoho_complete_connection')[1];
      expect(await openTokens(completion.p_envelope,key,source.id)).toMatchObject({accessToken:'private-access',refreshToken:'private-refresh'});
    } else {
      await expect(service.complete('state','code','admin')).rejects.toMatchObject({code:'ORGANIZATION_MISMATCH'});
      expect(rpc.mock.calls.some(([name])=>name==='zoho_complete_connection')).toBe(false);
    }
  });
  it('rejects missing/invalid keys and generates a deterministic state digest', async () => {
    await expect(sealTokens({}, 'bad', 'source-a')).rejects.toThrow();
    expect(await stateHash('state')).toMatch(/^[a-f0-9]{64}$/);
    expect(await stateHash('state')).not.toBe(await stateHash('other'));
    expect(oauthConfiguration({}).success).toBe(false);
  });
  it('does not reflect provider errors or accept arbitrary redirect destinations', async () => {
    let options;
    const fetcher = async (_url, init) => { options = init; return new Response('private provider error', { status: 401 }); };
    await expect(recruitJson('https://recruit.zoho.in/recruit/v2/org', {}, fetcher)).rejects.toMatchObject({ message: 'Recruit request failed', code: 'ACCESS_UNAUTHORIZED' });
    expect(options.redirect).toBe('manual');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it('never calls the token provider for an invalid/replayed state', async () => {
    const fetcher = (() => { throw new Error('Provider must not be called'); });
    const db = { rpc: async () => ({ data: null, error: { code: '22023' } }) };
    const service = createZohoOAuth(db, { ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'secret', ENVIRONMENT: 'local', ZOHO_TOKEN_ENCRYPTION_KEY: key }, fetcher);
    await expect(service.complete('bad-state', 'code', 'admin')).rejects.toThrow('Zoho connection storage is unavailable');
  });
  it.each([301,302,307,308])('rejects provider redirect %i without following credentials', async status => {
    const calls=[];
    const fetcher=async(url,init)=>{calls.push({url,init});return new Response(null,{status,headers:{Location:'https://untrusted.example'}});};
    await expect(recruitJson('https://recruit.zoho.in/recruit/v2/org',{headers:{Authorization:'Zoho-oauthtoken fixture'}},fetcher)).rejects.toMatchObject({code:'SOURCE_INVALID'});
    expect(calls).toHaveLength(1);
    expect(calls[0].init.redirect).toBe('manual');
  });
});
