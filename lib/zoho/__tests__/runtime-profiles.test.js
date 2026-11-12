import {afterEach, describe, expect, it, vi} from 'vitest';
import {readZohoConfig, ZOHO_PROFILES} from '../config';
import {integrationRuntime, queueNames, RECOVERY_CRON} from '../runtime';
import {sealTokens, tokenKeyring} from '../token-vault';

// Intentionally no config-module mocks: exercise the actual profile selection
// through the narrow queue adapters, provider response and staging authority.
const id='10000000-0000-4000-8000-000000000001';
const lease='10000000-0000-4000-8000-000000000002';
function configuration() {
  return {
    ENVIRONMENT:'development',SUPABASE_URL:'http://127.0.0.1:54321',
    ZOHO_CLIENT_ID:'synthetic',ZOHO_CLIENT_SECRET:'synthetic',
    ZOHO_TOKEN_ENCRYPTION_KEY:btoa('k'.repeat(32)),
    ZOHO_DISCOVERY_DB_TOKEN:`x.${btoa(JSON.stringify({role:'zoho_discovery',exp:Math.floor(Date.now()/1000)+3600}))}.x`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic',ZOHO_DISCOVERY_QUEUE:{send:vi.fn()},
    EMAIL_QUEUE:{send:vi.fn(()=>{throw new Error('Email forbidden');})},
    SSO:{createLearnerUser:vi.fn(()=>{throw new Error('Unapproved creation');})},
  };
}
afterEach(()=>vi.unstubAllGlobals());
describe('real runtime profile wiring',()=>{
  it.each(['local','qa'])('runs %s discovery through actual queue adapters without account or email effects',async profile=>{
    const env=profile==='qa'?{...configuration(),ENVIRONMENT:'qa',SUPABASE_URL:'https://qa.example.invalid'}:configuration();
    expect(readZohoConfig(env)).toBe(ZOHO_PROFILES[profile]);
    const envelope=await sealTokens({accessToken:'synthetic',refreshToken:'synthetic',expiresAt:Date.now()+3600000},tokenKeyring(env),id);
    const db={rpc:vi.fn(async name=>({data:name==='zoho_claim_discovery_batch'?{
      claimed:true,lease,run:{id,module:'Candidates',next_page:1,config_revision:1},
      source:{id,region:'in',credential_generation:1},envelope,
    }:name==='zoho_reserve_discovery_quota'?{granted:true,reservationId:lease}:{done:true,runId:id}}))};
    const fetcher=vi.fn(async()=>Response.json({data:[{id:'123',First_Name:'Synthetic',Email:'fixture@example.com',Modified_Time:'2026-10-29T08:00:00Z'}],info:{more_records:false}}));
    vi.stubGlobal('fetch',fetcher);
    const message={body:{runId:id},ack:vi.fn(),retry:vi.fn()};
    const runtime=integrationRuntime(env,{database:()=>db});
    expect(await runtime.queue({queue:queueNames(env).discovery,messages:[message]})).toBe(true);
    expect(message.ack).toHaveBeenCalledOnce();expect(message.retry).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(db.rpc).toHaveBeenLastCalledWith('zoho_commit_claimed_discovery',expect.objectContaining({
      p_run:id,p_lease:lease,p_records:[expect.objectContaining({data:{name:'Synthetic',email:'fixture@example.com'}})],
    }));
    expect(env.EMAIL_QUEUE.send).not.toHaveBeenCalled();expect(env.SSO.createLearnerUser).not.toHaveBeenCalled();
  });
  it('keeps real disabled profiles dormant for readiness, queued work and scheduled recovery',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    for(const ENVIRONMENT of ['preview','production','unknown','local-review']) {
      const env={...configuration(),ENVIRONMENT};const database=vi.fn();
      const runtime=integrationRuntime(env,{database,executionDatabase:database});
      expect((await (await runtime.discovery.fetch(new Request('https://internal/readiness'))).json()).ready).toBe(false);
      const message={body:{runId:id},ack:vi.fn(),retry:vi.fn()};
      const routed=await runtime.queue({queue:'zoho-recruit-discovery-dev',messages:[message]});
      // Named deployments with a matching queue retry dormant work. Unknown or
      // differently scoped queues are left to the existing host fallback.
      expect(routed).toBe(ENVIRONMENT==='local-review');
      expect(message.ack).not.toHaveBeenCalled();
      if(routed)expect(message.retry).toHaveBeenCalledOnce();
      await runtime.scheduled({cron:RECOVERY_CRON});
      expect(database).not.toHaveBeenCalled();expect(env.ZOHO_DISCOVERY_QUEUE.send).not.toHaveBeenCalled();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects mixed or malformed local database aliases before touching storage',async()=>{
    for(const patch of [
      {SKILLPASSPORT_SUPABASE_URL:'https://remote.invalid'},
      {SUPABASE_URL:'http://localhost.evil.invalid'},
      {SUPABASE_URL:'http://user:pass@localhost:54321'},
      {SUPABASE_URL:'http://localhost:54321/path'},
      {SUPABASE_URL:'http://localhost:54321/?q=1'},
    ]) {
      const env={...configuration(),...patch};const database=vi.fn();
      expect(readZohoConfig(env).background).toBe(false);
      const runtime=integrationRuntime(env,{database});
      expect((await (await runtime.discovery.fetch(new Request('https://internal/readiness'))).json()).ready).toBe(false);
      await runtime.scheduled({cron:RECOVERY_CRON});expect(database).not.toHaveBeenCalled();
    }
  });
});
