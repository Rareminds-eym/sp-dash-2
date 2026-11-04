vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import {beforeEach,describe,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({bulk:{tick:vi.fn(),cleanup:vi.fn()},deleted:{tickDeletedScan:vi.fn()}}));
vi.mock('../bulk-read',()=>({createBulkRead:()=>m.bulk}));
vi.mock('../source-lifecycle',()=>({createSourceLifecycle:()=>m.deleted}));
vi.mock('../source-quota',()=>({createConnectionQuota:()=>({reserve:vi.fn(),settle:vi.fn()})}));
import {sourceOperationsRuntime} from '../source-operations-runtime';
const id='10000000-0000-4000-8000-000000000001';
function setup(patch={}){
 const env={ZOHO_BACKGROUND_ENABLED:'true',ZOHO_SOURCE_OPERATIONS_ENABLED:'true',ZOHO_DISCOVERY_ENABLED:'true',ZOHO_DISCOVERY_QUEUE:{send:vi.fn()},...patch};
 const database={from:vi.fn(()=>({select:()=>({eq:()=>({single:async()=>({data:{connection_id:id}})})})})),rpc:vi.fn(async()=>({data:[{id,connectionId:id}]}))};
 const getAccessToken=vi.fn(async()=>({connection:{id,region:'in'},accessToken:'private-token'}));
 return {env,database,getAccessToken,runtime:sourceOperationsRuntime(env,{database:()=>database,getAccessToken})};
}
beforeEach(()=>{vi.clearAllMocks();m.bulk.tick.mockResolvedValue({done:false,runId:id});m.bulk.cleanup.mockResolvedValue({removed:0});m.deleted.tickDeletedScan.mockResolvedValue({done:true});});
describe('source operations on the existing discovery queue',()=>{
 it('defaults off without a new processing flag and retries without touching credentials',async()=>{
  const f=setup({ZOHO_SOURCE_OPERATIONS_ENABLED:undefined});const message={body:{bulkRunId:id},ack:vi.fn(),retry:vi.fn()};
  await f.runtime.message(message);expect(message.retry).toHaveBeenCalledOnce();expect(f.getAccessToken).not.toHaveBeenCalled();expect(f.database.from).not.toHaveBeenCalled();
 });
 it('sends only durable references for bounded bulk continuation',async()=>{
  const f=setup();const message={body:{bulkRunId:id},ack:vi.fn(),retry:vi.fn()};await f.runtime.message(message);
  expect(m.bulk.tick).toHaveBeenCalledWith(id,'private-token','in',expect.any(Function),expect.any(Object));
  expect(f.env.ZOHO_DISCOVERY_QUEUE.send).toHaveBeenCalledExactlyOnceWith({bulkRunId:id},{delaySeconds:10});
  expect(message.ack).toHaveBeenCalledOnce();expect(message.retry).not.toHaveBeenCalled();
 });
 it('does not acknowledge work when continuation publication fails',async()=>{
  const f=setup();f.env.ZOHO_DISCOVERY_QUEUE.send.mockRejectedValue(new Error('queue down'));
  const message={body:{bulkRunId:id},ack:vi.fn(),retry:vi.fn()};await f.runtime.message(message);
  expect(message.retry).toHaveBeenCalledOnce();expect(message.ack).not.toHaveBeenCalled();
 });
 it('handles deletion references without creating a bulk export',async()=>{
  const f=setup();const message={body:{deletedScanId:id},ack:vi.fn(),retry:vi.fn()};await f.runtime.message(message);
  expect(m.deleted.tickDeletedScan).toHaveBeenCalledOnce();expect(m.bulk.tick).not.toHaveBeenCalled();expect(f.env.ZOHO_DISCOVERY_QUEUE.send).not.toHaveBeenCalled();
 });
 it('keeps artifact cleanup running while source discovery is paused',async()=>{
  const f=setup({ZOHO_DISCOVERY_ENABLED:'false',ZOHO_SOURCE_OPERATIONS_ENABLED:'false',ZOHO_PRIVACY_CLEANUP_ENABLED:'true'});
  await f.runtime.scheduled();expect(m.bulk.cleanup).toHaveBeenCalledOnce();expect(f.database.rpc).not.toHaveBeenCalled();expect(f.getAccessToken).not.toHaveBeenCalled();
 });
 it('recovers due references without provider reads or notification capabilities',async()=>{
  const f=setup();await f.runtime.scheduled();expect(f.database.rpc).toHaveBeenCalledWith('zoho_due_bulk_reads',{});expect(f.database.rpc).toHaveBeenCalledWith('zoho_due_deleted_scans',{});
  expect(f.env.ZOHO_DISCOVERY_QUEUE.send.mock.calls.map(([body])=>body)).toEqual([{bulkRunId:id},{deletedScanId:id}]);expect(f.getAccessToken).not.toHaveBeenCalled();
 });
 it('rejects mixed or caller-enriched queue references',()=>{
  const f=setup();expect(f.runtime.recognizes({bulkRunId:id,email:'x@example.invalid'})).toBe(false);expect(f.runtime.recognizes({bulkRunId:id,deletedScanId:id})).toBe(false);
 });
});
