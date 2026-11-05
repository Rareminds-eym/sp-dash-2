import {describe,it,expect,vi} from 'vitest';
import {sourceOperationPollDelay} from '../operation-polling';
import {browserResponse} from '../browser-response';
import {discoveryPollDelay,discoveryErrorText} from '../discovery-progress';
import {candidateApprovalReady,candidateReviewUnavailable,repeatedCandidateName} from '../candidate-review-selection';
import {createZohoControlPlane} from '../control-plane';
import {readJobPolicy,readJobSurfacePage} from '../job-policy';
const id='10000000-0000-4000-8000-000000000001';
describe('operator audit regressions',()=>{
 it('bounds polling for long waits, preserves fast active checks and backs off failures',()=>{
  const now=Date.now();const waiting={active:true,phase:'queued',run:{last_error:'RATE_LIMITED',next_attempt_at:new Date(now+3600000).toISOString()}};
  expect(discoveryPollDelay(waiting,0,now)).toBe(60000);
  expect(discoveryPollDelay({active:true,phase:'running'},0,now)).toBe(3000);
  expect(discoveryPollDelay({active:true,phase:'running'},3,now)).toBe(24000);
  expect(discoveryPollDelay(waiting,5,now)).toBe(120000);
  expect(discoveryErrorText('RATE_LIMITED')).not.toContain('RATE_LIMITED');
 });
 it('handles HTML proxy pages, invalid JSON and JSON errors without exposing bodies',async()=>{
  for(const response of [new Response('<html>private upstream detail</html>',{status:502,headers:{'content-type':'text/html'}}),new Response('invalid json',{status:503,headers:{'content-type':'application/json'}})]){
   await expect(browserResponse(response)).rejects.toThrow(/Integration response unavailable \(HTTP 50[23]\)/);
  }
  await expect(browserResponse(Response.json({error:'Source changed',code:'SOURCE_CONFIG_CHANGED'},{status:409}))).rejects.toMatchObject({status:409,code:'SOURCE_CONFIG_CHANGED'});
 });
 it('never offers erased payloads for canonical review or approval',()=>{
  const record={module:'Candidates',payload_redacted_at:new Date().toISOString(),decision:'rejected'};
  expect(candidateReviewUnavailable(record,{status:'connected'})).toMatch(/erased or suppressed/);
  expect(candidateApprovalReady(record,{},'hash')).toBe(false);
 });
 it('flags repeated source names without changing them or guessing their identity',()=>{
  const record={module:'Candidates',proposed_data:{name:'Asha R Asha R'}};
  expect(repeatedCandidateName(record)).toBe(true);expect(record.proposed_data.name).toBe('Asha R Asha R');
  expect(repeatedCandidateName({module:'Candidates',proposed_data:{name:'Asha Raj'}})).toBe(false);
 });
 it('sends manual cleanup actor, reason and explicit confirmation to its audited RPC',async()=>{
  const rpc=vi.fn(async()=>({data:{redacted:0}}));const service=createZohoControlPlane({rpc});
  await expect(service.cleanup({},id)).rejects.toThrow();
  await expect(service.cleanup({reason:'Review',confirmed:false},id)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  await service.cleanup({reason:'Retention review',confirmed:true},id);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('zoho_cleanup_payloads_by_operator',{p_actor:id,p_reason:'Retention review'});
 });
 it('uses one bounded conditional window and cannot accept authority or huge-window overrides',async()=>{
  const rpc=vi.fn(async()=>({data:{records:[],unchanged:true}}));const service=createZohoControlPlane({rpc});
  await service.reviewWindow({connectionId:id,module:'Candidates',limit:'100',fingerprint:'a'.repeat(64)});
  expect(rpc).toHaveBeenCalledExactlyOnceWith('zoho_review_window',expect.objectContaining({p_limit:100,p_fingerprint:'a'.repeat(64)}));
  for(const change of [{limit:100001},{actorId:id},{fingerprint:'bad'}])await expect(service.reviewWindow({connectionId:id,module:'Candidates',limit:50,...change})).rejects.toThrow();
 });
 it('strips a legacy catalog response during upgrades and validates page bounds',async()=>{
  const rpc=vi.fn(async()=>({data:{triggerFingerprint:'a'.repeat(64),surfaceCount:16000,triggerSurface:[{definition:'private catalog'}]}}));
  expect(await readJobPolicy({rpc},id)).toEqual({triggerFingerprint:'a'.repeat(64),surfaceCount:16000});
  await readJobSurfacePage({rpc},{connectionId:id,fingerprint:'a'.repeat(64),offset:'10'});
  expect(rpc).toHaveBeenLastCalledWith('zoho_job_surface_page',{p_connection:id,p_fingerprint:'a'.repeat(64),p_offset:10});
  await expect(readJobSurfacePage({rpc},{connectionId:id,fingerprint:'a'.repeat(64),offset:-1})).rejects.toThrow();
 });
});

it('uses source work schedules, nearest runnable operation, and bounded outage backoff',()=>{
 const now=Date.now();const future=new Date(now+86400000).toISOString();
 const queued={bulk:[{state:'queued',next_attempt_at:future}],deletedScans:[]};
 expect(sourceOperationPollDelay(queued,0,now)).toBe(60000);
 expect(sourceOperationPollDelay(queued,2,now)).toBe(120000);
 expect(sourceOperationPollDelay({bulk:[{state:'completed'}]},0,now)).toBe(0);
 expect(sourceOperationPollDelay({...queued,deletedScans:[{state:'running'}]},0,now)).toBe(5000);
 expect(sourceOperationPollDelay({deletedScans:[{state:'queued',next_attempt_at:new Date(now+30000).toISOString()}]},0,now)).toBe(15000);
 expect(sourceOperationPollDelay({bulk:[{state:'staging',next_attempt_at:'invalid'}]},5,now)).toBe(120000);
});
