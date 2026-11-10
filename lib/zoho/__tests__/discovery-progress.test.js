import { describe, it, expect } from 'vitest';
import { discoveryProgress, discoveryTiming, formatDiscoveryDuration } from '../discovery-progress';
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

describe('retry timing presentation', () => {
  const now = Date.parse('2026-11-05T07:00:00Z');
  it('formats elapsed time and rounds fractional waits up', () => {
    expect(formatDiscoveryDuration(5360)).toBe('1h 29m 20s');
    expect(formatDiscoveryDuration(60)).toBe('1m');
    expect(formatDiscoveryDuration(0)).toBe('0s');
    expect(formatDiscoveryDuration(-1)).toBe('0s');
    expect(formatDiscoveryDuration(NaN)).toBe('0s');
    expect(formatDiscoveryDuration(0.1)).toBe('1s');
  });
  it('keeps a waiting run active without implying it is processing', () => {
    const progress = discoveryProgress([{...run, state:'queued', last_error:'RATE_LIMITED', next_attempt_at:'2026-11-05T07:40:00Z'}], null, 'source', 'Candidates');
    expect(progress.active).toBe(true);
    expect(discoveryTiming(progress, now)).toMatchObject({waiting:true, validRetry:true, remainingSeconds:2400});
    expect(discoveryTiming(progress, now).description).toContain('saved checkpoint');
    expect(discoveryTiming(progress, now + 2400001).description).toContain('Waiting for the background processor');
  });
  it('does not claim immediate retry eligibility for invalid timestamps', () => {
    expect(discoveryTiming({phase:'queued',run:{last_error:'RATE_LIMITED',next_attempt_at:'invalid'}},now)).toMatchObject({waiting:true,validRetry:false,description:'Waiting for retry scheduling. This page updates automatically.'});
  });
  it('does not show cooldown for paused, running or terminal states', () => {
    for (const phase of ['paused','running','completed','failed'])
      expect(discoveryTiming({phase,run:{last_error:'RATE_LIMITED',next_attempt_at:'2026-11-05T07:40:00Z'}},now).waiting).toBe(false);
    expect(discoveryTiming({phase:'queued',run:{}},now).waiting).toBe(false);
    expect(discoveryTiming({phase:'queued',run:{next_attempt_at:'2026-11-05T07:40:00Z'}},now).waiting).toBe(true);
  });
});

for (const module of ['Candidates', 'Job_Openings']) describe(`${module} capture feedback`, () => {
  it('preserves original scan time across checkpoint continuations', () => {
    const progress = discoveryProgress([{...run, module, created_at:'2026-11-06T09:00:00Z', scan_started_at:'2026-11-03T09:00:00Z'}], null, 'source', module);
    expect(progress.startedAt).toBe('2026-11-03T09:00:00Z');
  });
  it('distinguishes missing or partial legacy classification from genuine zero activity', () => {
    const base = {...run, module, new_count:0, changed_count:0, unchanged_count:0, suppressed_count:0};
    const progress = value => discoveryProgress([value], null, 'source', module);
    expect(progress(base).breakdownAvailable).toBe(false);
    expect(progress({...base, new_count:10}).breakdownAvailable).toBe(false);
    expect(progress({...base, new_count:18}).breakdownAvailable).toBe(true);
    expect(progress({...base, received_count:0, staged_count:0, deferred_count:0}).breakdownAvailable).toBe(true);
  });
});

it('accepts a newer completed live head after the requested run leaves the history window', () => {
  const request={connectionId:'source',module:'Candidates',phase:'queued',runId:'old',startedAt:'2026-11-03T08:00:00Z'};
  const latest={...run,id:'later',state:'completed',created_at:'2026-11-06T09:00:00Z'};
  expect(discoveryProgress([latest],request,'source','Candidates')).toMatchObject({run:{id:'later'},active:false,phase:'completed'});
  expect(discoveryProgress([{...latest,created_at:'2026-11-02T09:00:00Z'}],request,'source','Candidates')).toMatchObject({active:true,phase:'queued'});
});
