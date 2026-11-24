import { describe, expect, it, vi } from 'vitest';
import { readExecutionProgress } from '../execution-progress';
const connectionId='10000000-0000-4000-8000-000000000001';
const progress={connectionId,module:'Candidates',checkedAt:'2026-11-06T01:00:00Z',total:1803,
  completed:26,queued:407,processing:0,checking:513,syncing:0,retrying:857,attention:0,overdue:0,expired:0,exhausted:0,nextRetryAt:null,emailPolicy:'forbidden'};
describe('complete execution progress snapshot',()=>{
  it('reads complete persisted counts with exact source/type scope',async()=>{
    const db={rpc:vi.fn(async()=>({data:progress}))};
    expect(await readExecutionProgress(db,{connectionId,module:'Candidates'})).toEqual(progress);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_execution_progress',{p_connection:connectionId,p_module:'Candidates'});
  });
  it.each([{total:1804},{completed:-1},{module:'Job_Openings'},{connectionId:'20000000-0000-4000-8000-000000000001'},{expired:1},{exhausted:1}])('refuses invalid, inconsistent or cross-source counts: %j',async patch=>{
    await expect(readExecutionProgress({rpc:async()=>({data:{...progress,...patch}})},{connectionId,module:'Candidates'})).rejects.toMatchObject({executionProgressUnavailable:true});
  });
  it('reports unavailable storage rather than inventing zero progress',async()=>{
    await expect(readExecutionProgress({rpc:async()=>({error:{code:'PGRST202'}})},{connectionId,module:'Candidates'})).rejects.toMatchObject({executionProgressUnavailable:true});
  });
});
