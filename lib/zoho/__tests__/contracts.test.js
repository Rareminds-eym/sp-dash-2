import {vi} from 'vitest';
import { describe, it, expect } from 'vitest';
import { decisionSchema, configureSchema, ZOHO_REGIONS, normalizeRecruitRecord, canonicalJson, ZOHO_POLICY, ZOHO_PUBLISHER_ORGANIZATION_ID, recruitModifiedSince } from '../contracts';
import { ZOHO_HOSTS } from '../oauth';

const id = '10000000-0000-4000-8000-000000000001';
const decision = { connectionId: id, requestId: id, decision: 'approve', reason: 'Reviewed source', items: [{ id, revision: 1, sourceHash: 'a'.repeat(64), configRevision: 1, targetId: null }] };
describe('Recruit conditional timestamp contract', () => {
  it.each([
    ['2026-11-12T10:48:06.899064+00:00', '2026-11-12T10:48:06+00:00'],
    ['2026-11-12T16:18:06.999999+05:30', '2026-11-12T10:48:06+00:00'],
    ['2026-11-12T05:48:06.000001-05:00', '2026-11-12T10:48:06+00:00'],
    ['2026-11-12T10:48:06Z', '2026-11-12T10:48:06+00:00'],
  ])('formats %s at whole-second UTC precision without rounding up', (input, expected) => {
    expect(recruitModifiedSince(input)).toBe(expected);
    expect(Date.parse(recruitModifiedSince(input))).toBeLessThanOrEqual(Date.parse(input));
  });
  it.each(['invalid', '', null, undefined])('rejects invalid timestamps: %s', input => {
    expect(() => recruitModifiedSince(input)).toThrow();
  });
});
describe('Zoho approval contracts', () => {
  it('never permits the caller to enable email or replace authority fields', () => {
    expect(ZOHO_POLICY.emailPolicy).toBe('forbidden');
    for (const field of ['emailPolicy', 'sendEmail', 'actorId', 'autoApprove', 'planCode'])
      expect(decisionSchema.safeParse({ ...decision, [field]: 'true' }).success).toBe(false);
  });
  it('requires exact nonempty unique bounded selections', () => {
    expect(decisionSchema.parse(decision).items).toEqual(decision.items);
    for (const items of [[], Array(51).fill(decision.items[0]), [decision.items[0], decision.items[0]], [{ id, revision: 0 }]])
      expect(decisionSchema.safeParse({ ...decision, items }).success).toBe(false);
  });
  it('rejects arbitrary source regions and fabricated source organizations', () => {
    const input = { name: 'Recruit', sourceOrgId: '12345678901234567890', region: 'in', publisherOrganizationId: ZOHO_PUBLISHER_ORGANIZATION_ID };
    expect(configureSchema.parse(input)).toEqual(input);
    expect(configureSchema.safeParse({ ...input, region: 'https://attacker.example' }).success).toBe(false);
    expect([...ZOHO_REGIONS].sort()).toEqual(Object.keys(ZOHO_HOSTS).sort());
    for (const region of ['au', 'ca', 'sa']) expect(configureSchema.safeParse({ ...input, region }).success).toBe(false);
  });
  it('always registers sources for SkillPassport Platform and rejects another publisher', () => {
    const input = { name: 'Recruit', sourceOrgId: '123', region: 'in' };
    expect(configureSchema.parse(input).publisherOrganizationId).toBe(ZOHO_PUBLISHER_ORGANIZATION_ID);
    for (const publisherOrganizationId of [id, '6e607ffc-9d3c-4e94-abd6-72375cf9f33c', null, '']) {
      expect(configureSchema.safeParse({ ...input, publisherOrganizationId }).success).toBe(false);
    }
  });
  it('requires a valid timestamp and paired UUID for database pagination', async () => {
    const {createZohoControlPlane}=await import('../control-plane');
    const rpc=vi.fn();
    for (const value of [{ before: 'not-a-date', beforeId: id }, { before: '2026-10-29T08:00:00Z' },
      { beforeId: id }, { before: '2026-10-29T08:00:00Z),id.gt.0', beforeId: id }])
      await expect(createZohoControlPlane({rpc}).reviewPage({ connectionId: id,module:'Candidates', ...value })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('preserves large source IDs as strings and flags missing email without inventing data', () => {
    const source = { id: '99999999999999999999', Last_Name: 'Learner', Modified_Time: '2026-10-29T08:00:00Z' };
    const result = normalizeRecruitRecord('Candidates', source);
    expect(result.externalId).toBe(source.id);
    expect(result.data.email).toBe('');
    expect(result.errors).toContain('A valid primary email is required.');
    expect(() => normalizeRecruitRecord('Candidates', { ...source, id: 123 })).toThrow();
  });
  it('keeps only minimal source fields and never imports credentials/verification/roles', () => {
    const result = normalizeRecruitRecord('Candidates', { id: '123', First_Name: 'Sample', Last_Name: 'Learner', Email: 'USER@EXAMPLE.COM', Modified_Time: '2026-10-29T08:00:00Z', password: 'secret', role: 'super_admin', is_email_verified: true, notes: 'Private' });
    expect(result.data).toEqual({ name: 'Sample Learner', email: 'user@example.com' });
    expect(result.errors).toEqual([]);
  });
  it('never infers authorization to publish from a source job status', () => {
    const result = normalizeRecruitRecord('Job_Openings', { id: '123', Modified_Time: '2026-10-29T08:00:00Z', Job_Opening_Status: 'Open' });
    expect(result.errors).toContain('Job publication and status mapping requires review.');
    expect(result.data).not.toHaveProperty('is_active');
  });
  it.each([{ name: 'Example client', id: '456' }, 'Example client'])('maps Client Name to company and City alone to location', client => {
    const result = normalizeRecruitRecord('Job_Openings', {
      id: '123', Modified_Time: '2026-10-29T08:00:00Z',
      Client_Name: client, City: ' Chennai ', State: 'Tamil Nadu', Country: 'India',
    });
    expect(result.data.company_name).toBe('Example client');
    expect(result.data.location).toBe('Chennai');
    expect(result.errors).not.toContain('company_name mapping is required.');
    expect(result.errors).not.toContain('location mapping is required.');
  });
  it('keeps a missing City visible rather than substituting State or Country', () => {
    const result = normalizeRecruitRecord('Job_Openings', {
      id: '123', Modified_Time: '2026-10-29T08:00:00Z',
      Client_Name: { name: 'Example client' }, State: 'Tamil Nadu', Country: 'India',
    });
    expect(result.data.location).toBe('');
    expect(result.errors).toContain('location mapping is required.');
  });
  it('keeps truncated source text valid Unicode for PostgreSQL JSON', () => {
    const result = normalizeRecruitRecord('Candidates', { id: '123', First_Name: 'x'.repeat(149) + '😀', Email: 'fixture@example.com', Modified_Time: '2026-10-29T08:00:00Z' });
    expect(result.data.name).toBe('x'.repeat(149));
    expect(result.data.name.isWellFormed()).toBe(true);
  });
  it('produces stable canonical source content regardless of object key order', () => {
    expect(canonicalJson({ b: [1, { d: 2, c: 3 }], a: 'x' })).toBe(canonicalJson({ a: 'x', b: [1, { c: 3, d: 2 }] }));
  });
});


describe('Zoho jobs without department', () => {
  it('does not require or import Department and retains required company and City checks', () => {
    const source = { id: '123', Modified_Time: '2026-11-10T00:00:00Z', Posting_Title: 'Engineer', Client_Name: { name: 'Example client' }, City: 'Chennai', Job_Type: 'Full time' };
    const result = normalizeRecruitRecord('Job_Openings', source);
    expect(result.data.department).toBe('');
    expect(result.errors).toEqual(['Job publication and status mapping requires review.']);
    expect(normalizeRecruitRecord('Job_Openings', { ...source, Department: 'Not part of this import' }).data.department).toBe('');
    const incomplete = normalizeRecruitRecord('Job_Openings', { ...source, Client_Name: null, City: null });
    expect(incomplete.errors).toContain('company_name mapping is required.');
    expect(incomplete.errors).toContain('location mapping is required.');
  });
});
