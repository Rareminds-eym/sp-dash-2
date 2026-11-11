vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import {it,expect,vi} from 'vitest';
import {operatorSnapshot,runOperatorAction} from '../operator-actions';
import {sourceOperationsRuntime} from '../source-operations-runtime';
const id='10000000-0000-4000-8000-000000000001';
const actor='10000000-0000-4000-8000-000000000002';
const configuration=()=>({ZOHO_BACKGROUND_ENABLED:'true',ZOHO_DISCOVERY_ENABLED:'true',ZOHO_SOURCE_OPERATIONS_ENABLED:'true',
  ZOHO_DISCOVERY_QUEUE:{send:vi.fn()},ZOHO_CLIENT_ID:'fixture',ZOHO_CLIENT_SECRET:'fixture',
  ZOHO_REDIRECT_URI:'http://localhost/callback',ZOHO_TOKEN_ENCRYPTION_KEY:btoa('x'.repeat(32)),SKILLPASSPORT_ASSETS:{}});
function database(){return {rpc:vi.fn(async()=>({data:[]})),from:vi.fn(()=>{const q={select:()=>q,eq:()=>q,order:()=>q,
  single:async()=>({data:{id,status:'connected',credential_generation:1,source_org_id:'1234',region:'in'}}),
  maybeSingle:async()=>({data:null}),limit:async()=>({data:[]})};return q;})};}
it.each([
  {ZOHO_BACKGROUND_ENABLED:'false'},{ZOHO_BACKGROUND_ENABLED:undefined},
  {ZOHO_DISCOVERY_ENABLED:'false'},{ZOHO_SOURCE_OPERATIONS_ENABLED:'false'},
  {ZOHO_PREVIEW:'true'},{ZOHO_PREVIEW:'invalid'},{ZOHO_DISCOVERY_QUEUE:undefined},
])('operator and consumer agree that source work is disabled for %j',async patch=>{
  const env={...configuration(),...patch},db=database();
  expect((await operatorSnapshot(db,id,env,actor)).sourceEnabled).toBe(false);
  db.rpc.mockClear();db.from.mockClear();
  for(const action of ['start_bulk','start_deleted_scan','stage_source_merge']){
    await expect(runOperatorAction(db,{env,user:{id:actor}},action,{})).rejects.toThrow('Source operations disabled');
  }
  const message={body:{deletedScanId:id},retry:vi.fn(),ack:vi.fn()};
  await sourceOperationsRuntime(env,{database:()=>db}).message(message);
  expect(message.retry).toHaveBeenCalledOnce();expect(message.ack).not.toHaveBeenCalled();
  expect(db.rpc).not.toHaveBeenCalled();expect(db.from).not.toHaveBeenCalled();
});
it('reports source controls available with all shared gates, OAuth and storage configured',async()=>{
  expect((await operatorSnapshot(database(),id,configuration(),actor)).sourceEnabled).toBe(true);
});
