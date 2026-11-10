import { describe, it, expect, vi } from 'vitest';
import { createBulkJobApproval } from '../bulk-candidate-approval';
import { decisionSchema } from '../contracts';
const id='10000000-0000-4000-8000-000000000001';
function fixture(count=123) {
  const connection={id,status:'connected',name:'Job source',configRevision:11};
  let current={...connection},sequence=0;
  const rows=Array.from({length:count},(_,i)=>({id:`20000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,connection_id:id,module:'Job_Openings',
    external_id:String(1000+i),revision:1,source_hash:'a'.repeat(64),config_revision:11,target_id:null,decision:'pending_approval',
    created_at:new Date(Date.UTC(2026,0,1)-i*1000).toISOString(),validation_errors:[],
    proposed_data:{title:`Engineer ${i}`,company_name:'Example client',department:'',location:'Chennai',source_status:'In-progress',employment_type:'Full time',description:'Example job',application_link:''}}));
  const state={publishing:{entitlementReady:true,remainingSlots:null,activeTargetIds:[]},decisions:[],fail:false,refuse:false,stopAt:0,policy:{enabled:true,noEmailReviewed:true,triggerFingerprint:'b'.repeat(64),statusMap:{'In-progress':'open',Inactive:'closed'},employmentMap:{'Full time':'job'}}};
  let flow;
  const api=vi.fn(async(path,options)=>{
    if(path){
      const query=new URL(path,'http://localhost').searchParams;
      if(query.get('view')==='job_policy')return {policy:{connectionId:id,configRevision:current.configRevision,emailPolicy:'forbidden',triggerFingerprint:state.policy.triggerFingerprint,publishing:{...state.publishing},policy:{...state.policy}}};
      expect(query.get('module')).toBe('Job_Openings');expect(query.get('state')).toBe('pending_approval');expect(query.has('search')).toBe(false);
      const offset=query.has('beforeId')?rows.findIndex(row=>row.id===query.get('beforeId'))+1:0;
      return {records:rows.slice(offset,offset+50),total:rows.length};
    }
    const {action,input}=JSON.parse(options.body);expect(action).toBe('decide');decisionSchema.parse(input);state.decisions.push(input);
    if(state.fail){state.fail=false;throw Error('Lost response');}
    if(state.refuse)throw Object.assign(Error('Record changed'),{status:409});
    if(state.publishing.remainingSlots!==null)state.publishing.remainingSlots=Math.max(0,state.publishing.remainingSlots-input.items.filter(item=>{const row=rows.find(row=>row.id===item.id);return state.policy.statusMap[row.proposed_data.source_status]==='open'&&!state.publishing.activeTargetIds.includes(row.target_id);}).length);
    return {result:{decision:'approve',count:input.items.length,delivery:'queued'}};
  });
  flow=createBulkJobApproval({api,connection,currentConnection:()=>current,onChange:next=>{if(state.stopAt&&next.approved===state.stopAt)flow.stop();},requestId:()=>`30000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`});
  return {flow,api,rows,state,connection,setSource:value=>{current=value;}};
}
describe('bulk job approvals',()=>{
  it('reviews all pages, sends batches of 50 and never calls candidate account checks',async()=>{
    const f=fixture();await f.flow.prepare();expect(f.flow.state).toMatchObject({phase:'ready',total:123,checked:123});expect(f.state.decisions).toHaveLength(0);
    expect(f.flow.state.eligible[0].review).toMatchObject({decision:'create_job',status:'open',employmentType:'job'});
    await f.flow.approve('Reviewed the job details and publication states');
    expect(f.state.decisions.map(input=>input.items.length)).toEqual([50,50,23]);
    expect(f.state.decisions.flatMap(input=>input.items).every(item=>!('candidateReviewHash' in item))).toBe(true);
    expect(f.flow.state).toMatchObject({phase:'done',approved:123});
  });
  it('excludes invalid, stale, erased, suppressed, unmapped and unlinked closed jobs',async()=>{
    const f=fixture(8);f.rows[0].validation_errors=['location mapping is required.'];f.rows[1].config_revision=10;f.rows[2].payload_redacted_at=new Date().toISOString();f.rows[3].suppressed=true;
    f.rows[4].proposed_data.employment_type='Any';f.rows[5].proposed_data.source_status='Inactive';
    f.rows[6].proposed_data.source_status='Inactive';f.rows[6].target_id=id;
    await f.flow.prepare();expect(f.flow.state.eligible.map(item=>item.record.id)).toEqual([f.rows[6].id,f.rows[7].id]);expect(f.flow.state.skipped).toHaveLength(6);
    await f.flow.approve('Reviewed eligible jobs');expect(f.state.decisions[0].items).toHaveLength(2);
  });
  it('recovers a lost response using the exact decision request',async()=>{
    const f=fixture(3);await f.flow.prepare();f.state.fail=true;await f.flow.approve('Reviewed jobs');expect(f.flow.state.pendingBatch).toBe(true);
    await f.flow.resume();expect(f.state.decisions[1]).toEqual(f.state.decisions[0]);expect(f.flow.state.approved).toBe(3);
  });
  it('requires a new review after a definite stale-version refusal',async()=>{
    const f=fixture(3);await f.flow.prepare();f.state.refuse=true;await f.flow.approve('Reviewed jobs');expect(f.flow.state).toMatchObject({phase:'error',pendingBatch:false,reviewRequired:true});
    await f.flow.resume();expect(f.state.decisions).toHaveLength(1);
  });
  it('blocks an unavailable or changed policy and changed source',async()=>{
    const f=fixture(2);f.state.policy.enabled=false;await f.flow.prepare();expect(f.flow.state.phase).toBe('error');expect(f.state.decisions).toHaveLength(0);
    f.state.policy.enabled=true;await f.flow.prepare();f.setSource({...f.connection,configRevision:12});await f.flow.approve('Reviewed jobs');expect(f.state.decisions).toHaveLength(0);
  });
  it('skips jobs whose publication outcome changes after the reviewed snapshot',async()=>{
    const f=fixture(2);await f.flow.prepare();f.state.policy.statusMap={'In-progress':'draft'};await f.flow.approve('Reviewed open jobs');
    expect(f.flow.state.approved).toBe(0);expect(f.flow.state.skipped).toHaveLength(2);expect(f.state.decisions).toHaveLength(0);
  });
  it('stops between decision batches and resumes without repeating approvals',async()=>{
    const f=fixture();await f.flow.prepare();f.state.stopAt=50;await f.flow.approve('Reviewed jobs');expect(f.flow.state).toMatchObject({phase:'paused',approved:50});
    f.state.stopAt=0;await f.flow.resume();expect(f.flow.state.approved).toBe(123);expect(f.state.decisions.map(input=>input.items.length)).toEqual([50,50,23]);
  });
  it('refuses an oversized complete list before approving any partial snapshot',async()=>{
    const f=fixture(1);f.api.mockImplementationOnce(async()=>({records:f.rows,total:10001}));await f.flow.prepare();
    expect(f.flow.state).toMatchObject({phase:'error',reviewRequired:true});expect(f.state.decisions).toHaveLength(0);
  });
  it('blocks new open jobs without entitlement but preserves drafts and existing active updates',async()=>{
    const f=fixture(3);f.state.publishing={entitlementReady:false,remainingSlots:0,activeTargetIds:[id]};
    f.rows[1].target_id=id;f.state.policy.statusMap.Draft='draft';f.rows[2].proposed_data.source_status='Draft';
    await f.flow.prepare();expect(f.flow.state.eligible.map(item=>item.record.id)).toEqual([f.rows[1].id,f.rows[2].id]);expect(f.flow.state.skipped[0].issue).toMatch(/entitlement/);
  });
  it('limits the reviewed snapshot and rechecks reduced capacity before each batch',async()=>{
    const f=fixture(53);f.state.publishing.remainingSlots=51;await f.flow.prepare();expect(f.flow.state.eligible).toHaveLength(51);
    f.state.publishing.remainingSlots=1;await f.flow.approve('Reviewed jobs');expect(f.flow.state.approved).toBe(1);expect(f.state.decisions.every(input=>input.items.length===1)).toBe(true);
  });
  it('rejects cross-module rows before offering approval',async()=>{
    const f=fixture(1);f.rows[0].module='Candidates';await f.flow.prepare();expect(f.flow.state).toMatchObject({phase:'error',reviewRequired:true});expect(f.state.decisions).toHaveLength(0);
  });
});
