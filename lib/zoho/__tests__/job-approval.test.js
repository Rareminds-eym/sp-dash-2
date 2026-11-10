import { describe, it, expect } from 'vitest';
import { jobPolicyContextIssue, jobPublicationIssue, jobSelectionIssues } from '../job-approval';

const source = {id:'source',configRevision:4};
const row = {id:'job',config_revision:4,validation_errors:[],target_id:null,proposed_data:{source_status:'Active',employment_type:'Full time'}};
const context = () => ({connectionId:'source',configRevision:4,emailPolicy:'forbidden',triggerFingerprint:'f'.repeat(64),
  policy:{enabled:true,noEmailReviewed:true,triggerFingerprint:'f'.repeat(64),statusMap:{Active:'open',Inactive:'closed',Held:'draft'},employmentMap:{'Full time':'job'}},
  publishing:{entitlementReady:true,remainingSlots:null,activeTargetIds:[]}});
describe('job publication preview guards', () => {
  it('rejects stale, disabled, unreviewed and malformed policy contexts', () => {
    for (const change of [{connectionId:'another'}, {configRevision:5}, {emailPolicy:'allowed'}, {triggerFingerprint:'changed'},
      {policy:{...context().policy,enabled:false}}, {publishing:{entitlementReady:true,remainingSlots:-1,activeTargetIds:[]}}])
      expect(jobPolicyContextIssue({...context(),...change},source)).toBeTruthy();
    expect(jobPolicyContextIssue(context(),source)).toBeNull();
  });
  it('blocks creation of closed jobs but permits closing an existing linked job', () => {
    const c=context(), closed={...row,proposed_data:{...row.proposed_data,source_status:'Inactive'}};
    expect(jobPublicationIssue(closed,c.policy,c.publishing)).toMatch(/Closed jobs cannot be created/);
    expect(jobPublicationIssue({...closed,target_id:'destination'},c.policy,c.publishing)).toBeNull();
  });
  it('checks entitlement and selection capacity while excluding drafts and already active targets', () => {
    const c=context();c.publishing={entitlementReady:false,remainingSlots:0,activeTargetIds:['existing']};
    expect(jobSelectionIssues([row],source,c)[0].message).toMatch(/entitlement/);
    expect(jobSelectionIssues([{...row,target_id:'existing'}],source,c)).toEqual([]);
    expect(jobSelectionIssues([{...row,proposed_data:{...row.proposed_data,source_status:'Held'}}],source,c)).toEqual([]);
    c.publishing={entitlementReady:true,remainingSlots:1,activeTargetIds:[]};
    expect(jobSelectionIssues([row,{...row,id:'second'}],source,c)).toMatchObject([{id:'second',message:expect.stringMatching(/capacity is exhausted/)}]);
  });
  it('keeps validation, source-revision and missing-record failures blocked', () => {
    expect(jobSelectionIssues([{...row,config_revision:3}],source,context())[0].message).toMatch(/configuration changed/);
    expect(jobSelectionIssues([{...row,validation_errors:['City required']}],source,context())[0].message).toMatch(/validation/);
    expect(jobSelectionIssues([undefined],source,context())[0].message).toMatch(/Record changed/);
  });
});
