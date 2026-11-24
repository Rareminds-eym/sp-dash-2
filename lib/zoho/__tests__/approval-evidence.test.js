import { describe, it, expect, vi } from 'vitest';
import { recordHumanApproval } from '../approval-evidence';
const id = '10000000-0000-4000-8000-000000000001';
function fixture() {
  const row = { connection_id: id, proposed_data: {email:'candidate@example.com',name:'Candidate Name'}, validation_errors: [], decision:'pending_approval', id, module: 'Candidates', external_id: '123', revision: 1, source_hash: 'a'.repeat(64), config_revision: 1, target_id: null };
  const connection = { id, status: 'connected', source_org_id: '123', publisher_organization_id: id, config_revision: 1 };
  const db = { rpc: vi.fn(async () => ({ data: true })), from: table => { const query={ select:()=>query,eq:()=>query,single:async()=>({data:table==='zoho_connections'?connection:row}),in:async()=>({data:[row]}) }; return query; } };
  const authority = { verifyCandidateReview: vi.fn(async()=>({allowed:true})), recordApproval: vi.fn(async () => ({ recorded: true })) };
  const input = { connectionId: id, requestId: id, decision: 'approve', reason: 'Reviewed fixture',
    items: [{ id, revision: 1, sourceHash: row.source_hash, configRevision: 1, targetId: null, candidateReviewHash: 'b'.repeat(64) }] };
  return { db, authority, input, row, connection };
}
describe('human approval evidence', () => {
  it('registers only exact scope/hash/target metadata using the signed human token', async () => {
    const { db, authority, input } = fixture();
    await recordHumanApproval(db, authority, 'signed-human-token', input);
    expect(authority.recordApproval).toHaveBeenCalledExactlyOnceWith({ accessToken: 'signed-human-token', manifest: {
      requestId: id, connectionId: id, sourceOrgId: '123', publisherOrganizationId: id, configRevision: 1,
      reason: 'Reviewed fixture', emailPolicy: 'forbidden', items: [{ recordId: id, revision: 1, sourceHash: 'a'.repeat(64), module: 'Candidates', externalId: '123', targetId: null, candidateReviewHash: 'b'.repeat(64) }],
    } });
  });
  it.each(['revision', 'source_hash', 'target_id', 'config_revision'])('does not attest changed %s', async key => {
    const { db, authority, input, row } = fixture();
    row[key] = key === 'source_hash' ? 'b'.repeat(64) : key === 'target_id' ? id : 2;
    await expect(recordHumanApproval(db, authority, 'signed', input)).rejects.toMatchObject({ code: '40001' });
    expect(authority.recordApproval).not.toHaveBeenCalled();
  });
  it('fails closed for missing human credentials or denied canonical evidence', async () => {
    const { db, authority, input } = fixture();
    await expect(recordHumanApproval(db, authority, '', input)).rejects.toThrow();
    expect(authority.recordApproval).not.toHaveBeenCalled();
    authority.recordApproval.mockResolvedValue({ recorded: false });
    await expect(recordHumanApproval(db, authority, 'signed', input)).rejects.toMatchObject({code:'APPROVAL_EVIDENCE_UNAVAILABLE'});
    authority.recordApproval.mockRejectedValue(new Error('private token and storage detail'));
    await expect(recordHumanApproval(db, authority, 'signed', input)).rejects.toMatchObject({
      code:'APPROVAL_EVIDENCE_UNAVAILABLE',message:'Human approval could not be verified',
    });
  });
  it('requires reviewed fields only for approval and rejects authority overrides', async () => {
    const { db, authority, input } = fixture();
    for (const item of [{ id, revision: 1 }, { ...input.items[0], actorId: id }])
      await expect(recordHumanApproval(db, authority, 'signed', { ...input, items: [item] })).rejects.toThrow();
    expect(authority.recordApproval).not.toHaveBeenCalled();
  });
  it('denies a missing, changed or unverified canonical review before recording human evidence', async () => {
    const {db,authority,input}=fixture();
    const noHash={...input,items:input.items.map(({candidateReviewHash,...item})=>item)};
    await expect(recordHumanApproval(db,authority,'signed',noHash)).rejects.toMatchObject({code:'22023'});
    expect(authority.verifyCandidateReview).not.toHaveBeenCalled();
    authority.verifyCandidateReview.mockResolvedValue({allowed:false});
    await expect(recordHumanApproval(db,authority,'signed',input)).rejects.toMatchObject({code:'40001'});
    expect(authority.recordApproval).not.toHaveBeenCalled();
  });
  it('keeps job evidence independent of candidate reviews and rejects candidate proof on a job', async()=>{
    const {db,authority,input,row}=fixture(); row.module='Job_Openings';
    await expect(recordHumanApproval(db,authority,'signed',input)).rejects.toThrow('cannot authorize a job');
    const {candidateReviewHash,...item}=input.items[0];
    await recordHumanApproval(db,authority,'signed',{...input,items:[item]});
    expect(authority.verifyCandidateReview).not.toHaveBeenCalled();
    expect(authority.recordApproval).toHaveBeenCalledWith(expect.objectContaining({manifest:expect.objectContaining({items:[expect.not.objectContaining({candidateReviewHash})]})}));
  });

});
