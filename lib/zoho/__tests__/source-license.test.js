import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({token:vi.fn(),json:vi.fn()}));
vi.mock('../oauth',()=>({getConnectionAccessToken:mocks.token,recruitJson:mocks.json,ZOHO_HOSTS:{in:{api:'https://recruit.zoho.in'}}}));
import { recruitLicense, matchingRecruitOrganization, refreshSourceLicense } from '../source-license';
const id='10000000-0000-4000-8000-000000000001';
function fixture(){return {rpc:vi.fn(async name=>({data:name==='zoho_claim_license_refresh'?{acquired:true,generation:3,sourceOrgId:'1234'}:true}))};}
beforeEach(()=>{vi.clearAllMocks();mocks.token.mockResolvedValue({connection:{id,region:'in',credential_generation:3},accessToken:'private-fixture-token'});mocks.json.mockResolvedValue({org:[{zgid:'1234',license_details:{plan_type:'enterprise',no_of_users:5}}]});});
describe('Recruit license observations',()=>{
 it('accepts only documented editions and validated licensed-user counts',()=>{
  expect(recruitLicense({license_details:{plan_type:'Enterprise',no_of_users:5}})).toEqual({plan:'enterprise',edition:'enterprise',users:5});
  for(const plan of ['enterprise_trial','ultimate','enterprise-plus',''])expect(recruitLicense({license_details:{plan_type:plan,no_of_users:5}}).edition).toBe('unknown');
  for(const users of ['5',-1,1.5,null,1000001])expect(recruitLicense({license_details:{plan_type:'enterprise',no_of_users:users}}).edition).toBe('unknown');
  expect(recruitLicense({})).toMatchObject({edition:'unknown',users:null});
 });
 it('recognizes the observed paid Zoho One bundle without using active-user count',()=>{
  const license={paid_type:'Zoho One',subscription:'Zoho One',paid:true,trial:false,no_of_users:41,$users:{total:41,used:9,remaining:32}};
  expect(recruitLicense({license_details:license})).toEqual({plan:'zoho one',edition:'enterprise',users:41});
  expect(recruitLicense({license_details:{...license,plan_type:' '}}).edition).toBe('enterprise');
 });
 it('never treats a trial, unverified paid label or conflicting fields as a paid plan',()=>{
  const license={paid_type:'Zoho One',subscription:'Zoho One',paid:true,trial:false,no_of_users:41};
  for(const patch of [{trial:true},{paid:false},{trial:'false'},{paid:'true'},{paid:undefined},{trial:undefined},{paid_type:'future_plan'},{subscription:'Standard'},{plan_type:123},{plan_type:'Standard'},{plan_type:'unknown'}])
   expect(recruitLicense({license_details:{...license,...patch}}).edition,JSON.stringify(patch)).toBe('unknown');
  expect(recruitLicense({license_details:{trial_type:'Enterprise',trial:true,no_of_users:41}}).edition).toBe('unknown');
  expect(recruitLicense({license_details:{plan_type:'enterprise',paid:false,no_of_users:41}}).edition).toBe('unknown');
 });
 it('persists the live bundle plan as the enterprise allowance tier',async()=>{
  const db=fixture();mocks.json.mockResolvedValue({org:[{zgid:'1234',license_details:{paid_type:'Zoho One',subscription:'Zoho One',paid:true,trial:false,no_of_users:41}}]});
  expect(await refreshSourceLicense(db,{},id)).toMatchObject({refreshed:true,edition:'enterprise'});
  expect(db.rpc).toHaveBeenCalledWith('zoho_finish_license_refresh',expect.objectContaining({p_plan:'zoho one',p_edition:'enterprise',p_users:41}));
 });
 it('never identifies an organization by name or overrides a conflicting zgid',()=>{
  expect(matchingRecruitOrganization({org:[{zgid:'999',id:'1234',company_name:'Rareminds'}]},'1234')).toBeUndefined();
  expect(matchingRecruitOrganization({org:[{zgid:1234}]},'1234')).toBeUndefined();
 });
 it('refreshes through the existing region host and stores only selected license fields',async()=>{
  const db=fixture();expect(await refreshSourceLicense(db,{},id)).toEqual({refreshed:true,edition:'enterprise'});
  expect(mocks.json).toHaveBeenCalledWith('https://recruit.zoho.in/recruit/v2/org',expect.any(Object),expect.any(Function),expect.any(Object));
  expect(db.rpc).toHaveBeenCalledWith('zoho_finish_license_refresh',expect.objectContaining({p_connection:id,p_generation:3,p_edition:'enterprise',p_users:5}));
  expect(db.rpc.mock.calls.some(([,args])=>JSON.stringify(args).includes('private-fixture-token'))).toBe(false);
 });
 it('reuses the already verified OAuth organization without spending another request',async()=>{
  const db=fixture();await refreshSourceLicense(db,{},id,{organization:{zgid:'1234',license_details:{plan_type:'free',no_of_users:0}}});
  expect(mocks.token).not.toHaveBeenCalled();expect(mocks.json).not.toHaveBeenCalled();
 });
 it('does not contact Zoho when a shared refresh is already claimed',async()=>{
  const db=fixture();db.rpc.mockResolvedValueOnce({data:{acquired:false}});
  expect(await refreshSourceLicense(db,{},id)).toMatchObject({refreshed:false});expect(mocks.token).not.toHaveBeenCalled();
 });
 it('rejects another organization and schedules backoff without saving its plan',async()=>{
  const db=fixture();mocks.json.mockResolvedValue({org:[{zgid:'different'}]});
  await expect(refreshSourceLicense(db,{},id)).rejects.toThrow('Could not refresh');
  expect(db.rpc).not.toHaveBeenCalledWith('zoho_finish_license_refresh',expect.anything());
  expect(db.rpc).toHaveBeenCalledWith('zoho_fail_license_refresh',expect.objectContaining({p_retry_after:900}));
 });
 it('honors provider retry guidance and does not guess an allowance on failures',async()=>{
  const db=fixture();mocks.json.mockRejectedValue(Object.assign(new Error('limited'),{code:'RATE_LIMITED',retryAfterSeconds:1800}));
  await expect(refreshSourceLicense(db,{},id)).rejects.toThrow('shared connector budget');
  expect(db.rpc).toHaveBeenCalledWith('zoho_fail_license_refresh',expect.objectContaining({p_retry_after:1800}));
 });
 it('rejects credentials changed after a refresh claim',async()=>{
  const db=fixture();mocks.token.mockResolvedValue({connection:{id,region:'in',credential_generation:4},accessToken:'private'});
  await expect(refreshSourceLicense(db,{},id)).rejects.toThrow('Could not refresh');expect(mocks.json).not.toHaveBeenCalled();
 });
});
