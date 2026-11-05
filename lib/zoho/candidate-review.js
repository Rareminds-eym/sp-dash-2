import { z } from 'zod';
import { bounded } from './approved-execution';

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const candidateReviewRequest = z.object({
  connectionId: uuid, recordId: uuid, revision: z.number().int().positive(),
  sourceHash: hash, configRevision: z.number().int().positive(), targetId: uuid.nullable(),
}).strict();
const reviewResponse = z.object({
  version: z.literal(1), reviewHash: hash, recordId: uuid,
  revision: z.number().int().positive(), sourceHash: hash, configRevision: z.number().int().positive(),
  targetId: uuid.nullable(), decision: z.enum(['create', 'preserve_existing', 'blocked']),
  identity: z.object({ targetId: uuid.nullable(), outcome: z.enum(['new_identity', 'existing_identity', 'ambiguous_identity']),
    email: z.string().email(), name: z.string().min(2).max(150),
    activationState: z.enum(['activation_pending', 'existing_sign_in_preserved', 'blocked']),
    profileAction: z.enum(['create', 'preserve']),
  }).strict(),
  entitlements: z.object({ action: z.enum(['grant_discover', 'preserve', 'blocked']),
    planCodes: z.array(z.string().min(1).max(100)).max(25), learnerAccess: z.boolean(),
    paidAccessPreserved: z.boolean(), organizationAccessPreserved: z.boolean(),
  }).strict(), blockers: z.array(z.string().min(1).max(300)).max(50),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

/** The browser supplies only version assertions. Private staged data selects the lookup. */
export async function candidateReviewContext(db, input) {
  const expected = candidateReviewRequest.parse(input);
  const [connection, record] = await Promise.all([
    db.from('zoho_connections').select('id,status,source_org_id,config_revision').eq('id', expected.connectionId).single(),
    db.from('zoho_staged_records').select('id,connection_id,module,external_id,revision,source_hash,config_revision,target_id,proposed_data,validation_errors,decision')
      .eq('connection_id', expected.connectionId).eq('id', expected.recordId).single(),
  ]);
  if (connection.error || record.error || !connection.data || !record.data) throw new Error('Candidate review context unavailable');
  const source = connection.data; const row = record.data;
  if (source.status !== 'connected') throw Object.assign(new Error('Candidate source is not connected'),
    {code:'40001',reviewReason:source.status==='paused'?'SOURCE_PAUSED':'SOURCE_NOT_CONNECTED'});
  if (row.config_revision !== source.config_revision) throw Object.assign(new Error('Candidate source configuration changed'),
    {code:'40001',reviewReason:'SOURCE_CONFIG_CHANGED'});
  if (row.module !== 'Candidates' || row.id !== expected.recordId ||
      row.connection_id !== expected.connectionId || row.revision !== expected.revision || row.source_hash !== expected.sourceHash ||
      row.config_revision !== expected.configRevision || row.config_revision !== source.config_revision || row.target_id !== expected.targetId)
    throw Object.assign(new Error('Reviewed selection changed'), { code: '40001' });
  if (!['pending_approval', 'held', 'rejected'].includes(row.decision) || !Array.isArray(row.validation_errors) || row.validation_errors.length)
    throw Object.assign(new Error('Candidate is not eligible for review'), { code: '22023' });
  const freshness = await db.rpc('zoho_review_payload_current', { p_connection: expected.connectionId, p_record: expected.recordId });
  if (freshness.error) throw new Error('Candidate payload freshness unavailable');
  if (freshness.data !== true) throw Object.assign(new Error('Candidate source payload expired; fetch again'), { code: '22023',reviewReason:'PAYLOAD_EXPIRED' });
  const data = z.object({ email: z.string().email().max(320), name: z.string().min(2).max(150) }).strict().parse(row.proposed_data);
  if (!/^\d{1,40}$/.test(source.source_org_id) || !/^\d{1,40}$/.test(row.external_id)) throw new Error('Candidate source unavailable');
  return { ...expected, sourceOrgId: source.source_org_id, externalId: row.external_id, data, emailPolicy: 'forbidden' };
}

export async function previewCandidateReview(db, authority, accessToken, input) {
  if (!accessToken || typeof authority?.previewCandidateReview !== 'function') throw new Error('Canonical candidate review unavailable');
  const context = await candidateReviewContext(db, input);
  const review = reviewResponse.parse(await bounded(() => authority.previewCandidateReview({ accessToken, context }), 10000));
  for (const field of ['recordId', 'revision', 'sourceHash', 'configRevision', 'targetId']) {
    if (review[field] !== context[field]) throw Object.assign(new Error('Candidate review changed'), { code: '40001' });
  }
  if (review.identity.email !== context.data.email || review.identity.name !== context.data.name || Date.parse(review.expiresAt) <= Date.now())
    throw new Error('Candidate review unavailable');
  if (review.decision !== 'blocked' && (review.blockers.length || review.identity.activationState === 'blocked' || review.entitlements.action === 'blocked'))
    throw new Error('Candidate review unavailable');
  if (review.decision === 'create' && (review.identity.outcome !== 'new_identity' || review.identity.targetId !== null ||
      review.identity.profileAction !== 'create' || review.identity.activationState !== 'activation_pending' ||
      review.entitlements.action !== 'grant_discover' || !review.entitlements.learnerAccess))
    throw new Error('Candidate review unavailable');
  if (review.decision === 'preserve_existing' && (review.identity.outcome !== 'existing_identity' || !review.identity.targetId ||
      review.identity.profileAction !== 'preserve' || !['activation_pending', 'existing_sign_in_preserved'].includes(review.identity.activationState) ||
      review.entitlements.action !== 'preserve' || !review.entitlements.learnerAccess))
    throw new Error('Candidate review unavailable');
  return review;
}

/** Recheck canonical state before recording the immutable human manifest. */
export async function verifyCandidateReview(db, authority, accessToken, connectionId, item) {
  if (!hash.safeParse(item.candidateReviewHash).success || !accessToken || typeof authority?.verifyCandidateReview !== 'function')
    throw Object.assign(new Error('Canonical candidate review required'), { code: '22023' });
  const context = await candidateReviewContext(db, { connectionId, recordId: item.id, revision: item.revision,
    sourceHash: item.sourceHash, configRevision: item.configRevision, targetId: item.targetId });
  const result = await bounded(() => authority.verifyCandidateReview({ accessToken, context, candidateReviewHash: item.candidateReviewHash }), 10000);
  if (result?.allowed !== true) throw Object.assign(new Error('Canonical candidate review changed'), { code: '40001' });
}
