import { describe, it, expect } from 'vitest';
import { discoveryProgress } from '../discovery-progress';
const run={id:'run',connection_id:'source',module:'Candidates',state:'running',next_page:3,received_count:20,staged_count:18,deferred_count:2,created_at:'2026-11-03T09:00:00Z'};
describe('discovery progress feedback',()=>{
  it('shows immediate activity before any server response instead of an old failure',()=>{
    const request={connectionId:'source',module:'Candidates',phase:'submitting',startedAt:run.created_at};
    const progress=discoveryProgress([{...run,state:'failed'}],request,'source','Candidates');
    expect(progress).toMatchObject({title:'Starting discovery…',active:true,received:0});
    expect(progress.phase).toBe('submitting');
  });
  it('isolates source/module and ignores late request outcomes from another source',()=>{
    expect(discoveryProgress([run],{connectionId:'other',module:'Candidates',phase:'submitting'},'other','Job_Openings')).toBeNull();
    expect(discoveryProgress([run],{connectionId:'other',module:'Candidates',phase:'submitting'},'source','Candidates')).toMatchObject({title:'Reading batch 3',received:20,staged:18,deferred:2,batches:2});
  });
  it('tracks the returned run ID rather than an earlier failed run',()=>{
    const request={connectionId:'source',module:'Candidates',phase:'queued',runId:'new'};
    expect(discoveryProgress([{...run,state:'failed'}],request,'source','Candidates')).toMatchObject({phase:'queued',active:true});
    expect(discoveryProgress([{...run,id:'new',state:'completed'}],request,'source','Candidates')).toMatchObject({phase:'completed',active:false});
  });
  it('shows failures and retries without claiming completion',()=>{
    const failed=discoveryProgress([{...run,state:'failed'}],null,'source','Candidates');
    expect(failed.active).toBe(false);
    expect(failed.title).toBe('Discovery stopped');
    expect(discoveryProgress([{...run,state:'queued',last_error:'RATE_LIMITED'}],null,'source','Candidates').title).toBe('Waiting to retry');
  });
  it('shows a newer active or paused run after the requested run completes',()=>{
    const request={connectionId:'source',module:'Candidates',phase:'queued',runId:'old'};
    const previous={...run,id:'old',state:'completed'};
    for(const [state,control_state,phase] of [['running','active','running'],['queued','paused','paused'],['completed','active','completed']]){
      const next={...run,id:'new',state,control_state};
      const progress=discoveryProgress([next,previous],request,'source','Candidates');
      expect(progress.run.id).toBe('new');
      expect(progress.phase).toBe(phase);
    }
  });
});
