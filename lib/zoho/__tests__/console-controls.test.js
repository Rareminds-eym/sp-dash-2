import {describe,it,expect,vi} from 'vitest';
import {createZohoControlPlane} from '../control-plane';
import {discoveryProgress} from '../discovery-progress';
import {approvalCounts} from '../../approval-counts';
const id='10000000-0000-4000-8000-000000000001';
describe('console controls and read pages',()=>{
 it('binds run controls to the authenticated actor and source',async()=>{
  const db={rpc:vi.fn(async()=>({data:{runId:id,controlState:'paused'}}))};
  await createZohoControlPlane(db).controlDiscovery({connectionId:id,runId:id,command:'pause',reason:'Review checkpoint'},id);
  expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_control_discovery',{p_connection:id,p_run:id,p_action:'pause',p_reason:'Review checkpoint',p_actor:id});
  await expect(createZohoControlPlane(db).controlDiscovery({connectionId:id,runId:id,command:'resume',reason:'Review',actorId:id},id)).rejects.toThrow();
 });
 it('uses parameterized literal search and validates a complete keyset',async()=>{
  const db={rpc:vi.fn(async()=>({data:{records:[],total:0}}))};
  await createZohoControlPlane(db).reviewPage({connectionId:id,module:'Candidates',search:'%_(,email.eq.private)',state:'held'});
  expect(db.rpc.mock.calls[0]).toEqual(['zoho_review_page',{p_connection:id,p_module:'Candidates',p_state:'held',p_search:'%_(,email.eq.private)',p_before:null,p_before_id:null}]);
  await expect(createZohoControlPlane(db).reviewPage({connectionId:id,module:'Candidates',before:new Date().toISOString()})).rejects.toThrow();
 });
 it('keeps paused and cancelled runs distinct from failed discovery',()=>{
  const base={id,connection_id:id,module:'Candidates',state:'queued',next_page:6};
  expect(discoveryProgress([{...base,control_state:'paused'}],null,id,'Candidates')).toMatchObject({phase:'paused',active:false,batches:5});
  expect(discoveryProgress([{...base,state:'failed',control_state:'cancelled'}],null,id,'Candidates')).toMatchObject({phase:'cancelled',active:false});
  expect(discoveryProgress([{...base,state:'failed',control_state:'paused'}],null,id,'Candidates').phase).toBe('failed');
 });
 it('marks missing approval queues unavailable instead of manufacturing zero',async()=>{
  const db={from:table=>({select:()=>{const result={count:table==='students'?null:4,error:table==='students'?{code:'PGRST205'}:null};const q={eq:()=>q,is:()=>q,then:(yes,no)=>Promise.resolve(result).then(yes,no)};return q;}})};
  const result=await approvalCounts(db);expect(result.students).toEqual({status:'unavailable',count:null});expect(result.courses).toEqual({status:'available',count:4});
 });
});
