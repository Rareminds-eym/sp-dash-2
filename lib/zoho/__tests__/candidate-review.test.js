import { describe, it, expect, vi } from 'vitest';
import { candidateReviewContext, previewCandidateReview, previewCandidateReviews, verifyCandidateReview, verifyCandidateReviews } from '../candidate-review';
import { candidateApprovalReady } from '../candidate-review-selection';
const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
function fixture() {
  const request = { connectionId: id, recordId: id, revision: 1, sourceHash: 'a'.repeat(64), configRevision: 1, targetId: null };
  const record = { id, connection_id: id, module: 'Candidates', external_id: '123', revision: 1, source_hash: request.sourceHash,
    config_revision: 1, target_id: null, proposed_data: { email: 'candidate@example.com', name: 'Candidate Name' }, validation_errors: [], decision: 'pending_approval' };
  const connection = { id, status: 'connected', source_org_id: '456', config_revision: 1 };
  const db = { rpc: vi.fn(async () => ({ data: true })), from: table => { const query = { select: () => query, eq: () => query,
    single: async () => ({ data: table === 'zoho_connections' ? connection : record }) }; return query; } };
  const review = { version: 1, reviewHash: 'b'.repeat(64), recordId: id, revision: 1, sourceHash: request.sourceHash,
    configRevision: 1, targetId: null, decision: 'create', identity: { targetId: null, outcome: 'new_identity', email: 'candidate@example.com',
      name: 'Candidate Name', activationState: 'activation_pending', profileAction: 'create' },
    entitlements: { action: 'grant_discover', planCodes: ['discover'], learnerAccess: true, paidAccessPreserved: false, organizationAccessPreserved: false },
    blockers: [], expiresAt: new Date(Date.now() + 600000).toISOString() };
  const authority = { previewCandidateReview: vi.fn(async () => review), verifyCandidateReview: vi.fn(async () => ({ allowed: true })) };
  return { request, record, connection, db, review, authority };
}
describe('canonical candidate review', () => {
  it('blocks time-expired payloads independently of cleanup before canonical preview', async () => {
    const { db, request, authority } = fixture();
    db.rpc.mockResolvedValue({ data: false });
    await expect(previewCandidateReview(db, authority, 'signed', request)).rejects.toMatchObject({ code: '22023' });
    expect(authority.previewCandidateReview).not.toHaveBeenCalled();
  });
  it('loads source identity from private staging and rejects browser profile overrides', async () => {
    const { request, db, authority, review } = fixture();
    expect(await previewCandidateReview(db, authority, 'signed-human', request)).toEqual(review);
    expect(authority.previewCandidateReview).toHaveBeenCalledExactlyOnceWith({ accessToken: 'signed-human', context: {
      ...request, sourceOrgId: '456', externalId: '123', data: { email: 'candidate@example.com', name: 'Candidate Name' }, emailPolicy: 'forbidden',
    } });
    await expect(candidateReviewContext(db, { ...request, data: { email: 'attacker@example.com' } })).rejects.toThrow();
  });
  it.each(['revision', 'source_hash', 'config_revision', 'target_id', 'connection_id'])('rejects a changed staged %s', async key => {
    const { request, record, db, authority } = fixture();
    record[key] = ['revision', 'config_revision'].includes(key) ? 2 : key === 'source_hash' ? 'c'.repeat(64) : other;
    await expect(previewCandidateReview(db, authority, 'signed', request)).rejects.toMatchObject({ code: '40001' });
    expect(authority.previewCandidateReview).not.toHaveBeenCalled();
  });
  it.each(['disconnected', 'paused'])('refuses a %s source', async status => {
    const { request, connection, db, authority } = fixture(); connection.status = status;
    await expect(previewCandidateReview(db, authority, 'signed', request)).rejects.toThrow();
    expect(authority.previewCandidateReview).not.toHaveBeenCalled();
  });
  it.each(['validation', 'processing', 'job'])('rejects ineligible %s records before canonical lookup', async kind => {
    const { request, record, db, authority } = fixture();
    if (kind === 'validation') record.validation_errors = ['Invalid identity'];
    if (kind === 'processing') record.decision = 'processing';
    if (kind === 'job') record.module = 'Job_Openings';
    await expect(previewCandidateReview(db, authority, 'signed', request)).rejects.toThrow();
    expect(authority.previewCandidateReview).not.toHaveBeenCalled();
  });
  it.each(['revision', 'sourceHash', 'targetId', 'expired', 'identity', 'contradiction'])('rejects mismatched %s canonical responses', async kind => {
    const { request, db, authority, review } = fixture();
    if (kind === 'revision') review.revision++;
    if (kind === 'sourceHash') review.sourceHash = 'c'.repeat(64);
    if (kind === 'targetId') review.targetId = other;
    if (kind === 'expired') review.expiresAt = new Date(Date.now() - 1).toISOString();
    if (kind === 'identity') review.identity.email = 'other@example.com';
    if (kind === 'contradiction') review.blockers.push('blocked');
    await expect(previewCandidateReview(db, authority, 'signed', request)).rejects.toThrow();
  });
  it('returns blocked review for inspection without making it approvable', async () => {
    const { request, db, authority, review, record } = fixture();
    review.decision = 'blocked'; review.blockers = ['Ambiguous canonical identity']; review.identity.activationState = 'blocked'; review.entitlements.action = 'blocked';
    expect((await previewCandidateReview(db, authority, 'signed', request)).decision).toBe('blocked');
    expect(candidateApprovalReady(record, review, review.reviewHash)).toBe(false);
  });
  it('independently verifies hash and private source context before approval', async () => {
    const { request, db, authority } = fixture();
    const { recordId, connectionId, ...fields } = request;
    const item = { id: recordId, ...fields, candidateReviewHash: 'b'.repeat(64) };
    await verifyCandidateReview(db, authority, 'signed-human', connectionId, item);
    expect(authority.verifyCandidateReview).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'signed-human', candidateReviewHash: item.candidateReviewHash }));
    authority.verifyCandidateReview.mockResolvedValue({ allowed: false });
    await expect(verifyCandidateReview(db, authority, 'signed-human', connectionId, item)).rejects.toMatchObject({ code: '40001' });
    await expect(verifyCandidateReview(db, {}, 'signed-human', connectionId, item)).rejects.toMatchObject({ code: '22023' });
    await expect(verifyCandidateReview(db, authority, 'signed-human', connectionId, { ...item, candidateReviewHash: undefined })).rejects.toMatchObject({ code: '22023' });
  });
  it('requires explicit acknowledgment of an unexpired exact review', () => {
    const { record, review } = fixture();
    expect(candidateApprovalReady(record, review)).toBe(false);
    expect(candidateApprovalReady(record, review, undefined)).toBe(false);
    expect(candidateApprovalReady(record, review, review.reviewHash)).toBe(true);
    expect(candidateApprovalReady(record, review, 'c'.repeat(64))).toBe(false);
    expect(candidateApprovalReady({ ...record, revision: 2 }, review, review.reviewHash)).toBe(false);
    expect(candidateApprovalReady(record, review, review.reviewHash, Date.parse(review.expiresAt))).toBe(false);
  });
});

describe('bounded source-scoped review batches', () => {
  function batchFixture(count = 10) {
    const f = fixture(), rows = Array.from({ length: count }, (_, i) => ({ ...f.record,
      id: `10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}` }));
    f.db.from = vi.fn(table => { const query = { select: () => query, eq: () => query,
      in: async () => ({ data: rows }), single: async () => ({ data: f.connection }) }; return query; });
    let inFlight = 0, maximum = 0;
    f.authority.previewCandidateReview.mockImplementation(async ({ context }) => {
      maximum = Math.max(maximum, ++inFlight); await Promise.resolve(); inFlight--;
      return { ...f.review, recordId: context.recordId };
    });
    const input = { connectionId: id, items: rows.map(row => { const { connectionId, ...item } = f.request; return { ...item, recordId: row.id }; }) };
    return { ...f, rows, input, maximum: () => maximum };
  }
  it('reads source and staging once for ten exact reviews, with at most five canonical checks in flight', async () => {
    const f = batchFixture();
    const reviews = await previewCandidateReviews(f.db, f.authority, 'signed', f.input);
    expect(reviews).toHaveLength(10); expect(f.db.from).toHaveBeenCalledTimes(2);
    expect(f.db.rpc).toHaveBeenCalledTimes(10); // Freshness remains independent.
    expect(f.authority.previewCandidateReview).toHaveBeenCalledTimes(10);
    expect(f.maximum()).toBeLessThanOrEqual(5);
    expect(reviews.map(item => item.recordId)).toEqual(f.rows.map(row => row.id));
  });
  it('isolates changed records without authorizing their neighbours', async () => {
    const f = batchFixture(2); f.rows[0].revision++;
    const result = await previewCandidateReviews(f.db, f.authority, 'signed', f.input);
    expect(result[0]).toMatchObject({ recordId: f.rows[0].id, issue: expect.any(String) });
    expect(result[1].review.recordId).toBe(f.rows[1].id);
    expect(f.authority.previewCandidateReview).toHaveBeenCalledTimes(1);
  });
  it.each(['paused', 'outage', 'invalid canonical response'])('fails the entire batch for %s', async kind => {
    const f = batchFixture(2);
    if (kind === 'paused') f.connection.status = 'paused';
    if (kind === 'outage') f.authority.previewCandidateReview.mockRejectedValue(new Error('private error'));
    if (kind === 'invalid canonical response') f.authority.previewCandidateReview.mockResolvedValue({ ...f.review, expiresAt: 'invalid' });
    await expect(previewCandidateReviews(f.db, f.authority, 'signed', f.input)).rejects.toThrow();
  });
  it.each(['duplicate', 'oversized', 'foreign source field'])('rejects %s before reading storage', async kind => {
    const f = batchFixture();
    if (kind === 'duplicate') f.input.items[1] = f.input.items[0];
    if (kind === 'oversized') f.input.items.push(f.input.items[0]);
    if (kind === 'foreign source field') f.input.items[0].connectionId = other;
    await expect(previewCandidateReviews(f.db, f.authority, 'signed', f.input)).rejects.toThrow();
    expect(f.db.from).not.toHaveBeenCalled();
  });
});

describe('approval-time shared staging reads', () => {
  it('verifies fifty live canonical hashes using two staging queries instead of one hundred', async () => {
    const f = fixture(), rows = Array.from({length:50}, (_, i) => ({ ...f.record, id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}` }));
    f.db.from=vi.fn(table=>{const q={select:()=>q,eq:()=>q,in:async()=>({data:rows}),single:async()=>({data:f.connection})};return q;});
    const items=rows.map(row=>({id:row.id,revision:1,sourceHash:row.source_hash,configRevision:1,targetId:null,candidateReviewHash:'b'.repeat(64)}));
    await verifyCandidateReviews(f.db,f.authority,'signed',id,items);
    expect(f.db.from).toHaveBeenCalledTimes(2); expect(f.db.rpc).toHaveBeenCalledTimes(50);
    expect(f.authority.verifyCandidateReview).toHaveBeenCalledTimes(50);
    f.authority.verifyCandidateReview.mockResolvedValue({allowed:false});
    await expect(verifyCandidateReviews(f.db,f.authority,'signed',id,items)).rejects.toMatchObject({code:'40001'});
  });
});
