import { describe, it, expect, vi } from 'vitest';
import { jobPolicySchema, configureJobPolicy, readJobPolicy } from '../job-policy';
const id='10000000-0000-4000-8000-000000000001';
const input={connectionId:id,expectedConfigRevision:3,statusMap:{Open:'open',Closed:'closed',Draft:'draft'},
  employmentMap:{'Full Time':'job',Internship:'internship',Contract:'contract'},enabled:false,noEmailReviewed:false,
  triggerFingerprint:'a'.repeat(64),reason:'Reviewed explicit source status and job type mappings.'};
describe('reviewed job publication policy',()=>{
  it('forwards only exact policy plus verified actor to the service-only transaction',async()=>{
    const db={rpc:vi.fn(async()=>({data:{requiresRediscovery:true},error:null}))};
    expect(await configureJobPolicy(db,input,id)).toEqual({requiresRediscovery:true});
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_configure_job_policy',{
      p_connection:id,p_actor:id,p_expected_config:3,p_status_map:input.statusMap,p_employment_map:input.employmentMap,
      p_enabled:false,p_no_email_reviewed:false,p_trigger_fingerprint:'a'.repeat(64),p_reason:input.reason,
    });
  });
  it('requires explicit current no-email review for enabling, without inferring review from source status',()=>{
    expect(jobPolicySchema.safeParse({...input,enabled:true}).success).toBe(false);
    expect(jobPolicySchema.safeParse({...input,enabled:true,noEmailReviewed:true}).success).toBe(true);
  });
  it.each([
    {statusMap:{}},{employmentMap:{}},{statusMap:{Open:'published'}},{employmentMap:{Permanent:'full-time'}},
    {statusMap:{' Open ':'open'}},{statusMap:{'x\u0000':'open'}},{statusMap:{['x'.repeat(101)]:'open'}},
    {statusMap:Object.fromEntries(Array.from({length:51},(_,i)=>[String(i),'open']))},
    {triggerFingerprint:'incorrect'},{expectedConfigRevision:0},{reason:'Short'},
    {actorId:id},{sendEmail:true},{executionEnabled:true},
  ])('rejects invalid or authority-overriding policy %j',async change=>{
    const db={rpc:vi.fn()};
    await expect(configureJobPolicy(db,{...input,...change},id)).rejects.toThrow();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('loads read-only current fingerprints and propagates stale policy conflicts',async()=>{
    const db={rpc:vi.fn(async()=>({data:{triggerFingerprint:'b'.repeat(64)},error:null}))};
    expect(await readJobPolicy(db,id)).toEqual({triggerFingerprint:'b'.repeat(64),publishing:{triggerFingerprint:'b'.repeat(64)}});
    expect(db.rpc).toHaveBeenCalledWith('zoho_read_job_policy',{p_connection:id});
    db.rpc.mockResolvedValue({error:{code:'40001'}});
    await expect(configureJobPolicy(db,input,id)).rejects.toMatchObject({code:'40001'});
  });
});
