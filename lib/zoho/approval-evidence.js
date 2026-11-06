import { decisionSchema } from './contracts';
import { bounded } from './approved-execution';
import { verifyCandidateReviews } from './candidate-review';

/** Record human evidence before local approval. An orphan manifest has no write authority. */
export async function recordHumanApproval(db, authority, accessToken, input) {
  const selection = decisionSchema.parse(input);
  if (selection.decision !== 'approve') throw new Error('Approval required');
  if (typeof authority?.recordApproval !== 'function' || !accessToken) throw new Error('Human approval authority unavailable');
  const [connection, records] = await Promise.all([
    db.from('zoho_connections').select('id,status,source_org_id,publisher_organization_id,config_revision').eq('id', selection.connectionId).single(),
    db.from('zoho_staged_records').select('id,module,external_id,revision,source_hash,config_revision,target_id').eq('connection_id', selection.connectionId).in('id', selection.items.map(item => item.id)),
  ]);
  const source = connection.data;
  if (connection.error || records.error || !source || source.status !== 'connected' || records.data?.length !== selection.items.length)
    throw new Error('Approval context unavailable');
  const items = [];
  for (const item of selection.items) {
    const row = records.data.find(row => row.id === item.id);
    if (!row || row.revision !== item.revision || row.source_hash !== item.sourceHash || row.config_revision !== item.configRevision ||
        row.config_revision !== source.config_revision || row.target_id !== item.targetId)
      throw Object.assign(new Error('Reviewed selection changed'), { code: '40001' });
    if (row.module !== 'Candidates' && item.candidateReviewHash !== undefined) throw new Error('Candidate review cannot authorize a job');
    items.push({ recordId: row.id, revision: row.revision, sourceHash: row.source_hash, module: row.module,
      externalId: row.external_id, targetId: row.target_id,
      ...(row.module === 'Candidates' ? { candidateReviewHash: item.candidateReviewHash } : {}) });
  }
  // Bounded parallel canonical reads keep large review batches within request budgets.
  // No approval is recorded unless every selected candidate passes independently.
  const candidates = selection.items.filter(item => records.data.find(row => row.id === item.id).module === 'Candidates');
  if (candidates.length) await verifyCandidateReviews(db, authority, accessToken, selection.connectionId, candidates);
  const manifest = { requestId: selection.requestId, connectionId: source.id, sourceOrgId: source.source_org_id,
    publisherOrganizationId: source.publisher_organization_id, configRevision: source.config_revision,
    items, reason: selection.reason, emailPolicy: 'forbidden' };
  const result = await bounded(() => authority.recordApproval({ accessToken, manifest }), 10000);
  if (result?.recorded !== true) throw new Error('Human approval could not be verified');
}
