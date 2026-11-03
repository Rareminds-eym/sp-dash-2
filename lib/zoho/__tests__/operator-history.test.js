import {describe,it,expect,vi} from 'vitest';
import {operatorHistoryPage} from '../operator-history';
const id='10000000-0000-4000-8000-000000000001';
const input={connectionId:id,actorId:id,kind:'administration',view:'pending',cursor:null};
const page={version:1,kind:'administration',view:'pending',items:[],nextCursor:null};
describe('bounded operator history pages',()=>{
 it('passes only authenticated actor/source and a complete keyset to the fixed read-only RPC',async()=>{
  const db={rpc:vi.fn(async()=>({data:page}))};
  expect(await operatorHistoryPage(db,input)).toEqual(page);
  expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_operator_history_page',{p_connection:id,p_actor:id,p_kind:'administration',p_view:'pending',p_after:null,p_after_id:null});
 });
 it.each([{...input,limit:10000},{...input,actorId:'bad'},{...input,cursor:{timestamp:'2026-11-01T00:00:00Z'}},{...input,kind:'arbitrary_table'}])('rejects invalid selectors before storage',async value=>{
  const db={rpc:vi.fn()};await expect(operatorHistoryPage(db,value)).rejects.toThrow();expect(db.rpc).not.toHaveBeenCalled();
 });
 it('fails closed on oversized or mismatched pages',async()=>{
  const db={rpc:vi.fn(async()=>({data:{...page,items:Array.from({length:26},()=>({}))}}))};
  await expect(operatorHistoryPage(db,input)).rejects.toThrow();
  db.rpc.mockResolvedValue({data:{...page,view:'history'}});await expect(operatorHistoryPage(db,input)).rejects.toThrow();
 });
});
