vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { describe, expect, it, vi } from 'vitest';
import { jobDestination } from '../job-destination';
const id='10000000-0000-4000-8000-000000000001';
const target='10000000-0000-4000-8000-000000000002';
function fixture() {
 const grant={claimed:true,operationId:id,actorId:id,lease:id,module:'Job_Openings',action:'apply_job',sourceHash:'a'.repeat(64),
  targetId:null,emailPolicy:'forbidden',leaseExpiresAt:new Date(Date.now()+60000).toISOString(),approvalExpiresAt:new Date(Date.now()+120000).toISOString()};
 const receipt={state:'completed',operationId:id,sourceHash:grant.sourceHash,targetId:target,receiptId:id,emailPolicy:'forbidden'};
 const rpc=vi.fn(async name=>({data:name==='zoho_job_publisher_ready'?true:receipt,error:null}));
 const authority={checkApprover:vi.fn(async()=>({allowed:true})),validateApproval:vi.fn(async()=>({allowed:true}))};
 const database=vi.fn(()=>({rpc}));
 const env={SUPABASE_URL:'https://fixture.example',SUPABASE_SERVICE_ROLE_KEY:'private',ZOHO_EXECUTION_ENABLED:'true',ZOHO_JOB_PUBLISHER_ENABLED:'true',ZOHO_APPROVER_AUTHORITY:authority};
 return {grant,receipt,rpc,authority,database,env,destination:jobDestination(env,{database})};
}
describe('private canonical job destination',()=>{
 it('defaults disabled without dependencies or SQL access',async()=>{
  const f=fixture();delete f.env.ZOHO_JOB_PUBLISHER_ENABLED;
  const destination=jobDestination(f.env,{database:f.database});
  expect(await destination.capabilities()).toEqual({ready:false,modules:[]});
  await expect(destination.executeApprovedOperation(f.grant)).rejects.toThrow();expect(f.database).not.toHaveBeenCalled();
 });
 it('requires database safety review before advertising readiness',async()=>{
  const f=fixture();f.rpc.mockResolvedValue({data:false,error:null});
  expect(await f.destination.capabilities()).toEqual({ready:false,modules:[]});
  f.rpc.mockRejectedValue(new Error('Private detail'));expect(await f.destination.capabilities()).toEqual({ready:false,modules:[]});
 });
 it('independently checks current approver and exact approval before atomic SQL',async()=>{
  const f=fixture();expect((await f.destination.capabilities()).modules).toEqual(['Job_Openings']);f.rpc.mockClear();
  expect(await f.destination.executeApprovedOperation(f.grant)).toEqual(f.receipt);
  expect(f.authority.checkApprover).toHaveBeenCalledExactlyOnceWith(id);expect(f.authority.validateApproval).toHaveBeenCalledExactlyOnceWith(f.grant);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('zoho_apply_job_operation',{p_grant:f.grant});
  expect(f.authority.validateApproval.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
 });
 it('denies missing approval, revoked approvers, expired or malformed grants before writes',async()=>{
  for(const patch of [{module:'Candidates'},{action:'provision_candidate'},{emailPolicy:'allowed'},{leaseExpiresAt:new Date(0).toISOString()},{leaseExpiresAt:'invalid'},{approvalExpiresAt:'invalid'},{operationId:'bad'},{targetId:'other'}]){
   const f=fixture();await expect(f.destination.executeApprovedOperation({...f.grant,...patch})).rejects.toThrow();expect(f.rpc).not.toHaveBeenCalled();
  }
  for(const method of ['checkApprover','validateApproval']){
   const f=fixture();f.authority[method].mockResolvedValue({allowed:false});await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow();expect(f.rpc).not.toHaveBeenCalled();
  }
 });
 it('does not claim success on SQL failures or mismatched receipts',async()=>{
  for(const patch of [{sourceHash:'b'.repeat(64)},{targetId:'bad'},{emailPolicy:'allowed'},{extra:'private'}]){
   const f=fixture();f.rpc.mockResolvedValue({data:{...f.receipt,...patch},error:null});await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow();
  }
  const f=fixture();f.rpc.mockResolvedValue({data:null,error:{message:'Private detail'}});await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow('Job authority unavailable');
 });
 it('keeps committed receipts readable with execution disabled',async()=>{
  const f=fixture();f.env.ZOHO_EXECUTION_ENABLED='false';f.env.ZOHO_JOB_PUBLISHER_ENABLED='false';delete f.env.ZOHO_APPROVER_AUTHORITY;
  const destination=jobDestination(f.env,{database:f.database});
  expect(await destination.findOperationReceipt({operationId:id,sourceHash:f.grant.sourceHash,readOnly:true})).toEqual(f.receipt);
  await expect(destination.executeApprovedOperation(f.grant)).rejects.toThrow();
  expect(f.rpc).toHaveBeenCalledTimes(1);
 });
 it('supports read-only receipt recovery without renewing approval or invoking a write',async()=>{
  const f=fixture();expect(await f.destination.findOperationReceipt({operationId:id,sourceHash:f.grant.sourceHash,readOnly:true})).toEqual(f.receipt);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith('zoho_find_job_operation_receipt',{p_operation:id,p_source_hash:f.grant.sourceHash});
  expect(f.authority.validateApproval).not.toHaveBeenCalled();
  await expect(f.destination.findOperationReceipt({operationId:id,sourceHash:f.grant.sourceHash,readOnly:true,targetId:target})).rejects.toThrow();
 }); it('passes only exact durable prewrite no-effect proofs to the coordinator',async()=>{
  const f=fixture();const proof={state:'not_applied',operationId:id,lease:id,sourceHash:f.grant.sourceHash,
   emailPolicy:'forbidden',reviewRequired:true,reasonCode:'JOB_REVIEW_REQUIRED'};
  f.rpc.mockResolvedValue({data:proof,error:null});
  expect(await f.destination.executeApprovedOperation(f.grant)).toEqual(proof);
  expect(await f.destination.findOperationReceipt({operationId:id,sourceHash:f.grant.sourceHash,readOnly:true})).toEqual(proof);
  for(const patch of [{operationId:target},{sourceHash:'b'.repeat(64)},{lease:target},{reviewRequired:false},{reasonCode:'UNTRUSTED'},{extra:true}]){
   f.rpc.mockResolvedValue({data:{...proof,...patch},error:null});
   await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow();
  }
 });
 it('does not turn transport or generic database errors into no-effect proofs',async()=>{
  const f=fixture();
  f.rpc.mockRejectedValue(new Error('Transport timeout'));
  await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow();
  f.rpc.mockResolvedValue({data:null,error:{code:'P0001',message:'Publishing quota exceeded'}});
  await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow();
  f.rpc.mockResolvedValue({data:{state:'not_applied',operationId:id,lease:id,sourceHash:f.grant.sourceHash,emailPolicy:'forbidden'},error:null});
  await expect(f.destination.executeApprovedOperation(f.grant)).rejects.toThrow();
 });

});
