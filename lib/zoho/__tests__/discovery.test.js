vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { describe, it, expect, vi } from 'vitest';
import { discoverPage } from '../discovery-consumer';
import { stagingAuthority } from '../discovery-authority';
import { recruitJson } from '../oauth';
import { sealTokens } from '../token-vault';
const id = '10000000-0000-4000-8000-000000000001';
const lease = '10000000-0000-4000-8000-000000000002';
const key = btoa('k'.repeat(32));
async function fixture(expiresAt = Date.now() + 3600000, sourceId = id) {
  const envelope = await sealTokens({ accessToken: 'access', refreshToken: 'refresh', expiresAt }, key, sourceId);
  const db = { rpc: vi.fn(async name => ({ data: name === 'zoho_claim_discovery_batch' ? {
    claimed: true, lease, run: { id, module: 'Candidates', next_page: 1, config_revision: 1 },
    source: { id: sourceId, region: 'in', credential_generation: 1 }, envelope,
  } : name === 'zoho_reserve_discovery_quota' ? {granted:true,reservationId:lease} : { acquired: true, runId: id, done: true, recorded: true } })) };
  const env = { ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'secret', ZOHO_TOKEN_ENCRYPTION_KEY: key,
    ZOHO_DISCOVERY_AUTHORITY: { fetch: request => stagingAuthority(request, db) } };
  return { db, env };
}
describe('isolated Recruit discovery', () => {
  it('resolves tenant modification field names using verified system metadata', async () => {
    const {db,env}=await fixture(undefined,'10000000-0000-4000-8000-000000000009');
    const fetcher=vi.fn(async url=>{
      if(url.includes('/settings/fields')) return Response.json({fields:[{api_name:'Updated_On',field_label:'Modified Time',data_type:'datetime',custom_field:false}]});
      if(new URL(url).searchParams.get('converted')==='true') return new Response(null,{status:204});
      const included=new URL(url).searchParams.get('fields').includes('Updated_On');
      return Response.json({data:[{id:'1',First_Name:'Fixture',Email:'fixture@example.invalid',...(included?{Updated_On:'2026-10-29T08:00:00Z'}:{})}],info:{more_records:false}});
    });
    await discoverPage(id,env,fetcher);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery',expect.objectContaining({p_records:[expect.objectContaining({modified:'2026-10-29T08:00:00Z'})],p_issues:[]}));
    expect(fetcher.mock.calls.filter(([url])=>url.includes('/settings/fields'))).toHaveLength(1);
  });
  it('never substitutes a custom date field for the system modification timestamp', async () => {
    const {db,env}=await fixture(undefined,'10000000-0000-4000-8000-000000000008');
    await discoverPage(id,env,async url=>Response.json(url.includes('/settings/fields')
      ? {fields:[{api_name:'Updated_On',field_label:'Modified Time',data_type:'datetime',custom_field:true}]}
      : {data:[{id:'1',Updated_On:'2026-10-29T08:00:00Z'}],info:{more_records:false}}));
    expect(db.rpc.mock.calls.some(([name])=>name==='zoho_commit_claimed_discovery')).toBe(false);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery',expect.objectContaining({p_code:'SOURCE_INVALID'}));
  });
  it('commits both conversion streams together and continues while either has more records', async () => {
    const {db,env}=await fixture();
    const fetcher=vi.fn(async url=>{
      const converted=new URL(url).searchParams.get('converted');
      return Response.json({data:[{id:converted==='true'?'2':'1',First_Name:'Fixture',Email:'fixture@example.invalid',Modified_Time:'2026-10-29T08:00:00Z'}],info:{more_records:converted==='true'}});
    });
    await discoverPage(id,env,fetcher);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery',expect.objectContaining({p_more:true,p_records:[expect.objectContaining({externalId:'1'}),expect.objectContaining({externalId:'2'})]}));
  });
  it('does not commit a partial batch if the second conversion stream fails', async () => {
    const {db,env}=await fixture();
    await discoverPage(id,env,async url=>new URL(url).searchParams.get('converted')==='true'
      ? new Response('',{status:429}) : Response.json({data:[],info:{more_records:false}}));
    expect(db.rpc.mock.calls.some(([name])=>name==='zoho_commit_claimed_discovery')).toBe(false);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery',expect.objectContaining({p_code:'RATE_LIMITED'}));
  });
  it('keeps the latest source version when conversion changes between stream reads', async () => {
    const {db,env}=await fixture();
    await discoverPage(id,env,async url=>{
      const converted=new URL(url).searchParams.get('converted')==='true';
      return Response.json({data:[{id:'1',First_Name:converted?'Updated':'Original',Email:'fixture@example.invalid',Modified_Time:converted?'2026-10-30T08:00:00Z':'2026-10-29T08:00:00Z'}],info:{more_records:false}});
    });
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery',expect.objectContaining({p_records:[expect.objectContaining({externalId:'1',data:expect.objectContaining({name:'Updated'})})]}));
  });
  it('uses only restricted staging commands and explicitly inventories saved records', async () => {
    const { db, env } = await fixture();
    const fetcher = vi.fn(async () => Response.json({ data: [{ id: '99999999999999999999', First_Name: 'Test', Last_Name: 'Learner', Email: 'test@example.com', Modified_Time: '2026-10-29T08:00:00Z' }], info: { more_records: false } }));
    await discoverPage(id, env, fetcher);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.origin).toBe('https://recruit.zoho.in'); expect(url.searchParams.get('$state')).toBe('save');
    expect(fetcher.mock.calls.map(([target]) => new URL(target).searchParams.get('converted'))).toEqual(['false','true']);
    expect(fetcher.mock.calls.every(([target]) => new URL(target).searchParams.get('per_page') === '10')).toBe(true);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['zoho_claim_discovery_batch','zoho_reserve_discovery_quota','zoho_settle_discovery_quota','zoho_reserve_discovery_quota','zoho_settle_discovery_quota','zoho_commit_claimed_discovery']);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_run: id, p_lease: lease, p_page: 1, p_more: false,
      p_records: [expect.objectContaining({ externalId: '99999999999999999999', data: { name: 'Test Learner', email: 'test@example.com' } })] }));
  });
  it('uses durable page checkpoints above the former cap and the authority delta watermark', async () => {
    const { db, env } = await fixture(); const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (name, args) => {
      const result = await original(name, args);
      if (name === 'zoho_claim_discovery_batch') Object.assign(result.data.run, { next_page: 501, modified_since: '2026-10-29T08:00:00+00:00' });
      return result;
    });
    const fetcher = vi.fn(async (_url, init) => {
      expect(init.headers['If-Modified-Since']).toBe('2026-10-29T08:00:00+00:00');
      return new Response(null, { status: 204 });
    });
    await discoverPage(id, env, fetcher);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('page')).toBe('501');
    expect(url.searchParams.get('sort_by')).toBe('id');
    expect(url.searchParams.get('sort_order')).toBe('asc');
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_page: 501 }));
  });
  it('accepts an unchanged conditional response without advancing a false page of records', async () => {
    const { db, env } = await fixture(); const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (name, args) => {
      const result = await original(name, args);
      if (name === 'zoho_claim_discovery_batch') result.data.run.modified_since = '2026-10-29T08:00:00Z';
      return result;
    });
    await discoverPage(id, env, async () => new Response(null, { status: 304 }));
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_records: [], p_more: false }));
  });
  it.each(['Candidates', 'Job_Openings'])('does not redownload %s when a database watermark contains microseconds', async module => {
    const { db, env } = await fixture(undefined, '10000000-0000-4000-8000-000000000007');
    const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (name, args) => {
      const result = await original(name, args);
      if (name === 'zoho_claim_discovery_batch') Object.assign(result.data.run, {
        module, modified_since: '2026-11-12T10:48:06.899064+00:00',
      });
      return result;
    });
    const reads = [];
    await discoverPage(id, env, async (url, init) => {
      if (url.includes('/settings/fields')) return Response.json({ fields: [
        { api_name: 'Posting_Title' }, { api_name: 'Client_Name', field_label: 'Client Name', data_type: 'text' },
      ] });
      reads.push(init.headers['If-Modified-Since']);
      // The live Recruit API ignores the fractional form and returns inventory.
      return init.headers['If-Modified-Since'] === '2026-11-12T10:48:06+00:00'
        ? new Response(null, { status: 304 })
        : Response.json({ data: [{ id: '1' }], info: { more_records: true } });
    });
    expect(reads).toEqual(['2026-11-12T10:48:06+00:00', '2026-11-12T10:48:06+00:00']);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({
      p_records: [], p_issues: [], p_more: false,
    }));
    expect(db.rpc.mock.calls.filter(([name]) => name === 'zoho_settle_discovery_quota')
      .slice(-2).every(([, args]) => args.p_status === 304)).toBe(true);
  });
  it('rejects an unsolicited 304 rather than claiming empty source inventory', async () => {
    await expect(recruitJson('https://recruit.zoho.in/recruit/v2/Candidates', {},
      async () => new Response(null, { status: 304 }))).rejects.toMatchObject({ code: 'SOURCE_INVALID' });
  });
  it('does not send a delta header for reconciliation inventory', async () => {
    const { env } = await fixture();
    await discoverPage(id, env, async (_url, init) => {
      expect(init.headers).not.toHaveProperty('If-Modified-Since');
      return new Response(null, { status: 204 });
    });
  });
  it('records malformed source IDs as exceptions', async () => {
    const { db, env } = await fixture();
    await discoverPage(id, env, async () => Response.json({ data: [{ id: 999 }], info: { more_records: false } }));
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_records: [], p_issues: Array.from({length:2},()=>({ externalId: null, code: 'SOURCE_SCHEMA_INVALID' })) }));
  });
  it('treats a 204 page as empty inventory', async () => {
    const { db, env } = await fixture();
    await discoverPage(id, env, async () => new Response(null, { status: 204 }));
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_records: [], p_more: false }));
  });
  it('does not fetch without a claim or with legacy database credentials', async () => {
    const { db, env } = await fixture(); const fetcher = vi.fn();
    db.rpc.mockResolvedValue({ data: { claimed: false } });
    expect(await discoverPage(id, env, fetcher)).toEqual({ done: true });
    await expect(discoverPage(id, { ...env, SUPABASE_SERVICE_ROLE_KEY: 'forbidden' }, fetcher)).rejects.toThrow('Restricted');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('persists classified failures rather than depending on queue attempt counters', async () => {
    for (const [status, code] of [[401, 'AUTH_REVOKED'], [403, 'PERMISSION_DENIED'], [429, 'RATE_LIMITED'], [503, 'SOURCE_UNAVAILABLE'], [400, 'SOURCE_INVALID']]) {
      const { db, env } = await fixture();
      expect(await discoverPage(id, env, async () => new Response('private provider body', { status, headers: { 'Retry-After': '120' } }))).toEqual({ done: true });
      expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery', { p_run: id, p_lease: lease, p_code: code, p_retry_after: 120 });
    }
  });
  it('handles invalid JSON, token revocation and transport errors without leaking provider bodies', async () => {
    await expect(recruitJson('https://example.com', {}, async () => Response.json({ error: 'invalid_grant', description: 'private' }))).rejects.toMatchObject({ code: 'AUTH_REVOKED' });
    await expect(recruitJson('https://example.com', {}, async () => new Response('private'))).rejects.toMatchObject({ code: 'SOURCE_INVALID' });
    await expect(recruitJson('https://example.com', {}, async () => { throw new Error('private'); })).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  });
  it('fails closed when the authority is unavailable', async () => {
    const { env } = await fixture(); const fetcher = vi.fn();
    env.ZOHO_DISCOVERY_AUTHORITY.fetch = async () => new Response('', { status: 503 });
    await expect(discoverPage(id, env, fetcher)).rejects.toThrow('authority');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refreshes a rejected access token once even with a future cached expiry', async () => {
    const { db, env } = await fixture(); let reads = 0;
    const fetcher = vi.fn(async (url, init) => {
      if (url.includes('/oauth/v2/token')) return Response.json({ access_token: 'renewed', expires_in: 3600 });
      reads++;
      expect(init.headers.Authorization).toBe(`Zoho-oauthtoken ${reads === 1 ? 'access' : 'renewed'}`);
      return reads === 1 ? new Response('', { status: 401 }) : new Response(null, { status: 204 });
    });
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(db.rpc.mock.calls.map(([name]) => name).filter(name=>!name.includes('_quota'))).toEqual(['zoho_claim_discovery_batch', 'zoho_begin_discovery_refresh', 'zoho_refresh_discovery_tokens', 'zoho_commit_claimed_discovery']);
  });
  it('stops after a revoked refresh token without another read', async () => {
    const { db, env } = await fixture();
    const fetcher = vi.fn(async url => url.includes('/oauth/v2/token') ? Response.json({ error: 'invalid_grant' }) : new Response('', { status: 401 }));
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery', expect.objectContaining({ p_code: 'AUTH_REVOKED' }));
    expect(db.rpc.mock.calls.map(([name]) => name)).not.toContain('zoho_commit_claimed_discovery');
  });
  it('does not loop on repeated 401 responses', async () => {
    const { db, env } = await fixture();
    const fetcher = vi.fn(async url => url.includes('/oauth/v2/token') ? Response.json({ access_token: 'renewed', expires_in: 3600 }) : new Response('', { status: 401 }));
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(db.rpc.mock.calls.filter(([name]) => name === 'zoho_begin_discovery_refresh')).toHaveLength(1);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery', expect.objectContaining({ p_code: 'AUTH_REVOKED' }));
  });
  it('also limits a proactive refresh to one renewal per page', async () => {
    const { db, env } = await fixture(Date.now() - 1);
    const fetcher = vi.fn(async url => url.includes('/oauth/v2/token') ? Response.json({ access_token: 'renewed', expires_in: 3600 }) : new Response('', { status: 401 }));
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery', expect.objectContaining({ p_code: 'AUTH_REVOKED' }));
  });
  it('adopts another page\'s newer token instead of issuing a duplicate refresh', async () => {
    const { db, env } = await fixture(); const original = db.rpc.getMockImplementation();
    const newer = await sealTokens({ accessToken: 'already-renewed', refreshToken: 'refresh', expiresAt: Date.now() + 3600000 }, key, id);
    db.rpc.mockImplementation(async (name, args) => name === 'zoho_begin_discovery_refresh' ? { data: { acquired: false, changed: true, envelope: newer } } : original(name, args));
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 })).mockImplementation(async (_url, init) => {
      expect(init.headers.Authorization).toBe('Zoho-oauthtoken already-renewed');
      return new Response(null, { status: 204 });
    });
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(db.rpc.mock.calls.map(([name]) => name)).not.toContain('zoho_refresh_discovery_tokens');
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.anything());
  });
  it('defers a competing refresh without treating it as revoked access', async () => {
    const { db, env } = await fixture(); const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (name, args) => name === 'zoho_begin_discovery_refresh' ? { data: { acquired: false, changed: false } } : original(name, args));
    const fetcher = vi.fn(async () => new Response('', { status: 401 }));
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_fail_discovery', expect.objectContaining({ p_code: 'SOURCE_UNAVAILABLE', p_retry_after: 30 }));
  });
  it.each(['Bad\0Name', 'Bad\ud800Name'])('quarantines unsupported source text before page submission', async name => {
    const { db, env } = await fixture();
    await discoverPage(id, env, async () => Response.json({ data: [{ id: '123', First_Name: name, Email: 'fixture@example.com', Modified_Time: '2026-10-29T08:00:00Z' }], info: { more_records: false } }));
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({ p_records: [], p_issues: Array.from({length:2},()=>({ externalId: '123', code: 'SOURCE_SCHEMA_INVALID' })) }));
  });
});
describe('private staging authority', () => {
  const request = (path, body) => new Request(`https://authority/${path}`, { method: 'POST', body: JSON.stringify(body) });
  it('exposes no generic database, approval, account or job command', async () => {
    const db = { rpc: vi.fn() };
    for (const path of ['rpc', 'approve', 'execute', 'users', 'constructor', '__proto__'])
      expect((await stagingAuthority(request(path, {}), db)).status).toBe(404);
    for (const extra of [{ actorId: id }, { targetId: id }, { sendEmail: false }, { role: 'super_admin' }])
      expect((await stagingAuthority(request('claim', { runId: id, ...extra }), db)).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects arbitrary payload fields and oversized bodies before storage', async () => {
    const db = { rpc: vi.fn() };
    const body = { runId: id, lease, page: 1, records: [{ externalId: '1', modified: '2026-10-29T08:00:00Z', data: { email: 'test@example.com', name: 'Test', role: 'admin' }, errors: [] }], issues: [], more: false };
    expect((await stagingAuthority(request('commit', body), db)).status).toBe(400);
    expect((await stagingAuthority(request('claim', { runId: id, padding: 'x'.repeat(1048576) }), db)).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('returns generic storage errors and stale-lease conflicts', async () => {
    const db = { rpc: vi.fn(async () => ({ error: { code: '40001', message: 'private database detail' } })) };
    const response = await stagingAuthority(request('claim', { runId: id }), db);
    expect(response.status).toBe(409); expect(await response.text()).not.toContain('private');
  });
});

describe('safe malformed source-ID accounting', () => {
  it.each(['\u0000','\ud800','invalid-id','1'.repeat(41)])('quarantines an invalid ID without copying it into JSON diagnostics (%j)', async badId => {
    const { db, env } = await fixture();
    const healthy = { id: '1', First_Name: 'Healthy', Last_Name: 'Fixture', Email: 'healthy@fixture.example', Modified_Time: '2026-10-29T08:00:00Z' };
    await discoverPage(id, env, async () => Response.json({ data: [{ id: badId }, healthy], info: { more_records: false } }));
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery', expect.objectContaining({
      p_records: [expect.objectContaining({ externalId: '1' })], p_issues: Array.from({length:2},()=>({ externalId: null, code: 'SOURCE_SCHEMA_INVALID' })),
    }));
  });
  it.each(['\u0000','\ud800','invalid-id','1'.repeat(41)])('rejects unsafe diagnostic IDs at the private staging boundary (%j)', async externalId => {
    const db = { rpc: vi.fn() };
    const response = await stagingAuthority(new Request('https://staging/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: id, lease, page: 1, records: [], issues: [{ externalId, code: 'SOURCE_SCHEMA_INVALID' }], more: false }) }), db);
    expect(response.status).toBe(400); expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe('persisted discovery page geometry', () => {
  it.each([10, 20, 200])('uses the claimed page size %i for both streams and commits atomically', async pageSize => {
    const { db, env } = await fixture(); const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[0] === 'zoho_claim_discovery_batch') result.data.run.page_size = pageSize;
      return result;
    });
    const fetcher = vi.fn(async url => {
      const query = new URL(url).searchParams; expect(query.get('per_page')).toBe(String(pageSize));
      const offset = query.get('converted') === 'true' ? pageSize : 0;
      return Response.json({ data: Array.from({ length: pageSize }, (_, i) => ({ id: String(i+offset+1), First_Name: 'Synthetic',
        Email: `candidate${i+offset}@example.invalid`, Modified_Time: '2026-10-29T08:00:00Z' })), info: { more_records: false } });
    });
    await discoverPage(id, env, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const commits = db.rpc.mock.calls.filter(([name]) => name === 'zoho_commit_claimed_discovery');
    expect(commits).toHaveLength(1); expect(commits[0][1].p_records).toHaveLength(pageSize*2);
  });
});

describe('bounded full-description job pages', () => {
  it('commits both twenty-job streams with maximum multibyte mapped fields, even above the former staging limit', async () => {
    const {db,env}=await fixture();const original=db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async(...args)=>{const result=await original(...args);if(args[0]==='zoho_claim_discovery_batch')Object.assign(result.data.run,{module:'Job_Openings',page_size:20});return result;});
    const fetcher=vi.fn(async url=>{
      if(url.includes('/settings/fields')) return Response.json({fields:[{api_name:'Client_Name',field_label:'Client Name',data_type:'lookup'},{api_name:'Posting_Title',field_label:'Posting Title',data_type:'text'}]});
      const offset=new URL(url).searchParams.get('converted')==='true'?20:0;
      return Response.json({data:Array.from({length:20},(_,i)=>({id:String(offset+i+1),Modified_Time:'2026-11-06T00:00:00Z',
        Posting_Title:'漢'.repeat(500),Client_Name:'漢'.repeat(300),Department:'漢'.repeat(150),City:'漢'.repeat(100),State:'漢'.repeat(100),Country:'漢'.repeat(100),
        Job_Type:'漢'.repeat(100),Job_Opening_Status:'漢'.repeat(100),Application_Link:'漢'.repeat(2048),Job_Description:'漢'.repeat(32000)})),info:{more_records:false}});
    });
    await discoverPage(id,env,fetcher);
    const commits=db.rpc.mock.calls.filter(([name])=>name==='zoho_commit_claimed_discovery');
    expect(commits).toHaveLength(1);expect(commits[0][1].p_records).toHaveLength(40);
    expect(commits[0][1].p_records.every(row=>row.data.description.length===32000)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(commits[0][1])).byteLength).toBeGreaterThan(4*1048576);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(db.rpc.mock.calls.some(([name])=>name==='zoho_fail_discovery')).toBe(false);
  });
  it.each([
    ['https://recruit.zoho.in/oauth/v2/token','POST'],
    ['https://recruit.zoho.in/recruit/v2/Candidates','GET'],
    ['https://recruit.zoho.in/recruit/v2/settings/fields?module=Job_Openings','GET'],
    ['https://recruit.zoho.in/recruit/v2/Job_Openings','POST'],
    ['https://untrusted.example/recruit/v2/Job_Openings','GET'],
  ])('keeps the smaller limit for %s %s',async(url,method)=>{
    await expect(recruitJson(url,{method},async()=>Response.json({padding:'x'.repeat(1048576)}))).rejects.toMatchObject({code:'SOURCE_INVALID'});
  });
  it('cancels job response streams beyond their bounded three-megabyte limit',async()=>{
    const cancel=vi.fn();
    const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(3*1048576+1));},cancel});
    await expect(recruitJson('https://recruit.zoho.in/recruit/v2/Job_Openings',{},async()=>new Response(stream))).rejects.toMatchObject({code:'SOURCE_INVALID'});
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});


describe('tenant job client lookup', () => {
  it('fetches the metadata-verified client field in both conversion streams', async () => {
    const { db, env } = await fixture(undefined, '10000000-0000-4000-8000-000000000099');
    const original = db.rpc.getMockImplementation();
    db.rpc.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[0] === 'zoho_claim_discovery_batch') result.data.run.module = 'Job_Openings';
      return result;
    });
    const fetcher = vi.fn(async url => {
      if (url.includes('/settings/fields')) return Response.json({ fields: [{ api_name: 'Department_Name', field_label: 'Clients Name', data_type: 'lookup' },{api_name:'Posting_Title',field_label:'Posting Title',data_type:'text'}] });
      expect(new URL(url).searchParams.get('fields').split(',')).toContain('Department_Name');
      return Response.json({ data: [{ id: '1', Modified_Time: '2026-11-10T00:00:00Z', Posting_Title: 'Engineer', Department_Name: { name: 'Example client' }, City: 'Chennai' }], info: { more_records: false } });
    });
    await discoverPage(id, env, fetcher);
    const commit = db.rpc.mock.calls.find(([name]) => name === 'zoho_commit_claimed_discovery');
    expect(commit[1].p_records[0].data).toMatchObject({ company_name: 'Example client', department: '', location: 'Chennai' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});


it('selects the verified tenant job title and does not request absent optional application links', async () => {
  const {db,env}=await fixture(undefined,'10000000-0000-4000-8000-000000000096');const original=db.rpc.getMockImplementation();
  db.rpc.mockImplementation(async(...args)=>{const result=await original(...args);if(args[0]==='zoho_claim_discovery_batch')result.data.run.module='Job_Openings';return result;});
  const fetcher=vi.fn(async url=>{
    if(url.includes('/settings/fields'))return Response.json({fields:[{api_name:'Department_Name',field_label:'Clients Name',data_type:'lookup'},{api_name:'Job_Opening_Name',field_label:'Posting Title',data_type:'text'}]});
    const fields=new URL(url).searchParams.get('fields').split(',');expect(fields).toContain('Job_Opening_Name');expect(fields).not.toContain('Posting_Title');expect(fields).not.toContain('Application_Link');
    return Response.json({data:[{id:'1',Modified_Time:'2026-11-10T00:00:00Z',Job_Opening_Name:'Engineer',Department_Name:{name:'Example client'},City:'Chennai',Job_Type:'Full time'}],info:{more_records:false}});
  });
  await discoverPage(id,env,fetcher);const commit=db.rpc.mock.calls.find(([name])=>name==='zoho_commit_claimed_discovery');
  expect(commit[1].p_records[0].data).toMatchObject({title:'Engineer',company_name:'Example client',application_link:''});
});
