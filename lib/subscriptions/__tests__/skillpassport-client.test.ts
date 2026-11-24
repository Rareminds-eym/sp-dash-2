import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as context } from '../../../app/api/admin/subscriptions/authoring/context/route';
import { GET as creditContext } from '../../../app/api/admin/subscriptions/authoring/credits/context/route';
import { POST as drafts } from '../../../app/api/admin/subscriptions/authoring/drafts/route';
import { GET as catalog } from '../../../app/api/admin/subscriptions/catalog/route';
import { POST as publications } from '../../../app/api/admin/subscriptions/publications/route';
const io = vi.hoisted(() => ({ authorize: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../platform-admin', () => ({ requirePlatformAdmin: io.authorize }));

const id = 'a0000000-0000-4000-8000-000000000001';
const draftBody = JSON.stringify({ bundle: { draft: { id, plan: { id } } } });
let transport = vi.fn<typeof fetch>();
let env: Record<string, unknown>;
const request = (path = '', body?: string, type = 'application/json') => new Request(`https://dash.example.invalid/api/admin/subscriptions/${path}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': type }, body,
});
beforeEach(() => {
  vi.resetAllMocks();
  env = { SKILLPASSPORT_API_URL: 'https://owner.example.invalid' };
  io.authorize.mockResolvedValue({ env, user: { id }, accessToken: 'synthetic-token' });
  transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ schemaVersion: 1, plans: [], features: [] }));
  vi.stubGlobal('fetch', transport);
});
afterEach(() => vi.unstubAllGlobals());

describe('subscription-only owner endpoint transport', () => {
  it('uses exactly the configured origin with bearer auth and rejects redirects', async () => {
    expect((await catalog(request('catalog'))).status).toBe(200);
    expect(transport).toHaveBeenCalledExactlyOnceWith(new URL('https://owner.example.invalid/api/admin/subscriptions/catalog'),
      expect.objectContaining({ redirect: 'manual', cache: 'no-store', method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }), signal: expect.any(AbortSignal) }));
  });
  it('refuses an owner redirect instead of following it', async () => {
    transport.mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://elsewhere.invalid/' } }));
    expect((await catalog(request('catalog'))).status).toBe(503);
    expect(transport).toHaveBeenCalledOnce();
  });
  it.each([undefined, '', 'http://remote.invalid', 'https://owner.invalid/path', 'https://u:p@owner.invalid', 'https://owner.invalid?x=1'])('refuses missing or ambiguous targets %j', async target => {
    env.SKILLPASSPORT_API_URL = target;
    expect((await catalog(request())).status).toBe(503); expect(transport).not.toHaveBeenCalled();
  });
  it('does not substitute another configured source when the owner is absent', async () => {
    delete env.SKILLPASSPORT_API_URL; env.APP_URL = 'https://other.invalid';
    expect((await catalog(request())).status).toBe(503); expect(transport).not.toHaveBeenCalled();
  });
  it.each([context, creditContext])('forwards only one validated plan reference to the correct endpoint', async route => {
    transport.mockResolvedValue(Response.json({ schemaVersion: 1, plan: { id }, features: [] }));
    expect((await route(request(`?planId=${id}`))).status).toBe(200);
    expect(new URL(String(transport.mock.calls[0][0])).search).toBe(`?planId=${id}`);
    transport.mockClear();
    for (const query of ['', '?planId=bad', `?planId=${id}&planId=${id}`, `?planId=${id}&actorId=${id}`]) {
      expect((await route(request(query))).status).toBe(400);
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it('preserves authorization denials before endpoint IO', async () => {
    io.authorize.mockResolvedValue({ error: Response.json({ error: 'denied' }, { status: 403 }) });
    expect((await catalog(request())).status).toBe(403); expect(transport).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 413, 500, 502, 503, 302])('redacts owner errors and does not retry status %i', async status => {
    transport.mockResolvedValue(new Response('sensitive upstream detail', { status }));
    const result = await drafts(request('', draftBody));
    expect(result.status).toBe([400, 401, 403, 413].includes(status) ? status : 503);
    expect(await result.text()).not.toContain('sensitive'); expect(transport).toHaveBeenCalledTimes(1);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
  });
  it('surfaces an uncertain staging failure without a second write', async () => {
    transport.mockRejectedValue(new Error('sensitive network detail'));
    expect((await drafts(request('', draftBody))).status).toBe(503); expect(transport).toHaveBeenCalledTimes(1);
  });
  it('accepts only a receipt bound to the requested draft, plan, credits and signed actor', async () => {
    const value = {
      bundle: {
        schemaVersion: 1, draft: { id, plan: { id, productId: id, code: `pln_${'a'.repeat(32)}` } },
        includedCredits: { revisionId: id }
      }, stagedBy: id, stagedAt: '2026-11-18T12:00:00Z'
    };
    transport.mockResolvedValueOnce(Response.json(value));
    const submitted = JSON.stringify({ bundle: value.bundle });
    const response = await drafts(request('', submitted));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(value);
    const other = 'b0000000-0000-4000-8000-000000000001';
    for (const bundle of [{}, { ...value.bundle, draft: { ...value.bundle.draft, id: other } },
    { ...value.bundle, includedCredits: { revisionId: other } },
    { ...value.bundle, draft: { ...value.bundle.draft, plan: { ...value.bundle.draft.plan, id: other } } }]) {
      transport.mockResolvedValueOnce(Response.json({ ...value, bundle }));
      expect((await drafts(request('', submitted))).status).toBe(503);
    }
  });
  it('rejects caller actor and registry envelopes before endpoint IO', async () => {
    for (const value of [{}, { actorId: id, ...JSON.parse(draftBody) }, { registry: {}, ...JSON.parse(draftBody) }]) {
      expect((await drafts(request('', JSON.stringify(value)))).status).toBe(400);
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it('bounds actual bytes and rejects malformed input before endpoint IO', async () => {
    expect((await drafts(request('', ' '.repeat(262145)))).status).toBe(413);
    expect((await drafts(request('', '{'))).status).toBe(400);
    expect((await drafts(request('', '{}', 'text/plain'))).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([null, {}, [], { schemaVersion: 2, plans: [], features: [] }])('does not acknowledge malformed catalog success %j', async value => {
    transport.mockResolvedValue(Response.json(value)); expect((await catalog(request())).status).toBe(503);
  });
  it('rejects HTML and oversized success responses', async () => {
    transport.mockResolvedValue(new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }));
    expect((await catalog(request())).status).toBe(503);
    transport.mockResolvedValue(new Response(' '.repeat(8388609), { headers: { 'content-type': 'application/json' } }));
    expect((await catalog(request())).status).toBe(503);
  });
  it('rejects a context for another plan and a staging receipt for another actor', async () => {
    const other = 'b0000000-0000-4000-8000-000000000001';
    transport.mockResolvedValue(Response.json({ schemaVersion: 1, plan: { id: other }, features: [] }));
    expect((await context(request(`?planId=${id}`))).status).toBe(503);
    transport.mockResolvedValue(Response.json({ bundle: {}, stagedBy: other, stagedAt: '2026-11-18T12:00:00Z' }));
    expect((await drafts(request('', draftBody))).status).toBe(503);
  });

  it('forwards publication references only to SkillPassport and binds the acknowledgement to actor/transition', async () => {
    const body = { planId: id, revisionId: id, expectedPreviousRevisionId: null };
    const receipt = { planId: id, revisionId: id, previousRevisionId: null, publishedBy: id, publishedAt: '2026-11-19T12:00:00Z' };
    transport.mockResolvedValueOnce(Response.json(receipt));
    const response = await publications(request('', JSON.stringify(body)));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(receipt);
    expect(transport).toHaveBeenCalledExactlyOnceWith(new URL('https://owner.example.invalid/api/admin/subscriptions/publications'),
      expect.objectContaining({ method: 'POST', redirect: 'manual', body: JSON.stringify(body), cache: 'no-store' }));
  });
  it.each([{}, { planId: id, revisionId: id }, { planId: id, revisionId: id, expectedPreviousRevisionId: null, ready: true },
  { planId: id, revisionId: id, expectedPreviousRevisionId: null, actorId: id }])('rejects malformed publication or caller authority before IO %#', async body => {
    expect((await publications(request('', JSON.stringify(body)))).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['planId', 'revisionId', 'publishedBy', 'previousRevisionId'] as const)('rejects a mismatched publication %s', async field => {
    const receipt = {
      planId: id, revisionId: id, previousRevisionId: null as string | null,
      publishedBy: id, publishedAt: '2026-11-19T12:00:00Z'
    };
    receipt[field] = 'b0000000-0000-4000-8000-000000000001';
    transport.mockResolvedValueOnce(Response.json(receipt));
    expect((await publications(request('', JSON.stringify({ planId: id, revisionId: id, expectedPreviousRevisionId: null })))).status).toBe(503);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('does not retry an uncertain publication or report success', async () => {
    transport.mockRejectedValue(new Error('Synthetic uncertain publication'));
    expect((await publications(request('', JSON.stringify({ planId: id, revisionId: id, expectedPreviousRevisionId: null })))).status).toBe(503);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('current subscription HTTP transport', () => {
  function currentOwner(downgradedAt?: unknown) {
    const product = 'b0000000-0000-4000-8000-000000000001';
    return {
      schemaVersion: 1, actorId: id,
      state: {
        id, planId: id, revisionId: id, productId: product, version: 1, subject: { kind: 'user', id },
        status: 'active', periodStartsAt: 100, periodEndsAt: 1000, trialEndsAt: null, renewalEnabled: true,
        cancelledAt: null, paymentFailedAt: null, scheduledChange: null, ...(downgradedAt === undefined ? {} : { downgradedAt })
      },
      access: 'full', audience: 'synthetic', activatedAt: 100, subscriptionEndsAt: 1000, pools: [],
      plan: { id, productId: product, code: 'pln_' + 'a'.repeat(32), name: 'Synthetic', revisionNumber: 1 }, features: []
    };
  }
  it.each([undefined, null, 500])('uses SkillPassport only and preserves the current downgrade marker %s', async downgradedAt => {
    const { forwardSubscriptionRequest } = await import('../skillpassport-client');
    transport.mockResolvedValue(Response.json(currentOwner(downgradedAt)));
    const result = await forwardSubscriptionRequest(request('?subscriptionId=' + id), 'current');
    expect(result.status).toBe(200);
    expect((await result.json()).state.downgradedAt).toBe(downgradedAt);
    expect(String(transport.mock.calls[0][0])).toBe('https://owner.example.invalid/api/subscriptions/current?subscriptionId=' + id);
    expect(transport.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'manual', cache: 'no-store' });
    expect((await forwardSubscriptionRequest(request('?planId=' + id), 'current')).status).toBe(400);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([-1, 99, 1.5, '500', Number.MAX_SAFE_INTEGER + 1])('rejects an invalid current downgrade marker %s without retry', async downgradedAt => {
    const { forwardSubscriptionRequest } = await import('../skillpassport-client');
    transport.mockResolvedValue(Response.json(currentOwner(downgradedAt)));
    expect((await forwardSubscriptionRequest(request('?subscriptionId=' + id), 'current')).status).toBe(503);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('rejects a malformed current owner response without retry', async () => {
    const { forwardSubscriptionRequest } = await import('../skillpassport-client');
    transport.mockResolvedValue(Response.json({ schemaVersion: 1, state: { id } }));
    expect((await forwardSubscriptionRequest(request('?subscriptionId=' + id), 'current')).status).toBe(503);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('actual consumer proxy routes', () => {
  const other = 'b0000000-0000-4000-8000-000000000001';
  const usage = { subscriptionId: id, productId: other, recipient: { kind: 'subscriber', id }, featureKey: 'synthetic', poolKey: 'synthetic', allocated: 7, consumed: 2, remaining: 5, asOf: '2026-11-19T12:00:00Z' };
  const command = { operationId: id, request: { operation: 'cancel', subscriptionId: id, subject: { kind: 'user', id }, expectedVersion: 1, expectedRevisionId: other, reason: 'Synthetic owner request' } };
  const state = { id, planId: id, productId: other, revisionId: other, version: 2, subject: { kind: 'user', id }, status: 'cancelled', periodStartsAt: 100, periodEndsAt: 1000, trialEndsAt: null, renewalEnabled: false, cancelledAt: 500, paymentFailedAt: null, scheduledChange: null };
  const receipt = () => ({ operationId: id, committedAt: '2026-11-19T12:00:00Z', decision: { expectedVersion: 1, expectedRevisionId: other, next: state, access: 'read_only', retryAt: [], audit: { operation: 'cancel', actorId: id, reason: command.request.reason, at: 500, policyId: id, policyVersion: 1 } } });
  it('forwards only cursor discovery to SkillPassport and preserves an empty nonterminal page', async () => {
    const { GET } = await import('../../../app/api/admin/subscriptions/route');
    const page = { schemaVersion: 1, actorId: id, productId: other, items: [], nextCursor: other };
    transport.mockResolvedValue(Response.json(page));
    const response = await GET(request(`?cursor=${id}`));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(page);
    expect(String(transport.mock.calls[0][0])).toBe(`https://owner.example.invalid/api/subscriptions?cursor=${id}`);
    transport.mockClear();
    for (const query of ['?actorId=' + id, '?cursor=invalid', `?cursor=${id}&cursor=${other}`]) expect((await GET(request(query))).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects forged actor, repeated cursor and uninitialized capabilities', async () => {
    const { GET } = await import('../../../app/api/admin/subscriptions/route');
    for (const page of [
      { schemaVersion: 1, actorId: other, productId: other, items: [], nextCursor: null },
      { schemaVersion: 1, actorId: id, productId: other, items: [], nextCursor: id },
      { schemaVersion: 1, actorId: id, productId: other, items: [{ id: other, planId: id, productId: other, subject: { kind: 'user', id }, status: 'active', kind: 'uninitialized', version: null, revisionId: null, lifecycleOperations: ['cancel'] }], nextCursor: other },
    ]) { transport.mockResolvedValueOnce(Response.json(page)); expect((await GET(request(`?cursor=${id}`))).status).toBe(503); }
  });
  it('accepts only scoped usage counters and never forwards credit writes', async () => {
    const { POST } = await import('../../../app/api/admin/subscriptions/credits/route');
    const body = { kind: 'usage', subscriptionId: id, recipientId: id, poolKey: 'synthetic' };
    transport.mockResolvedValueOnce(Response.json(usage));
    expect((await POST(request('', JSON.stringify(body)))).status).toBe(200);
    for (const change of [{ subscriptionId: other }, { recipient: { kind: 'subscriber', id: other } }, { poolKey: 'other' }, { remaining: 6 }]) {
      transport.mockResolvedValueOnce(Response.json({ ...usage, ...change }));
      expect((await POST(request('', JSON.stringify(body)))).status).toBe(503);
    }
    transport.mockClear();
    for (const change of [{ kind: 'consume', actionKey: 'synthetic', operationId: id }, { actorId: other }, { amount: 1 }]) expect((await POST(request('', JSON.stringify({ ...body, ...change })))).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it('binds lifecycle acknowledgement to exact operation, actor, CAS and subject', async () => {
    const { POST } = await import('../../../app/api/admin/subscriptions/lifecycle/route');
    transport.mockResolvedValueOnce(Response.json(receipt()));
    expect((await POST(request('', JSON.stringify(command)))).status).toBe(200);
    for (const mutate of [
      (value: ReturnType<typeof receipt>) => { value.operationId = other; },
      (value: ReturnType<typeof receipt>) => { value.decision.expectedVersion = 2; },
      (value: ReturnType<typeof receipt>) => { value.decision.expectedRevisionId = id; },
      (value: ReturnType<typeof receipt>) => { value.decision.next = { ...state, id: other }; },
      (value: ReturnType<typeof receipt>) => { value.decision.next = { ...state, version: 3 }; },
      (value: ReturnType<typeof receipt>) => { value.decision.next = { ...state, subject: { kind: 'user', id: other } }; },
      (value: ReturnType<typeof receipt>) => { value.decision.audit.actorId = other; },
      (value: ReturnType<typeof receipt>) => { value.decision.audit.reason = 'Different'; },
    ]) { const value = receipt(); mutate(value); transport.mockResolvedValueOnce(Response.json(value)); expect((await POST(request('', JSON.stringify(command)))).status).toBe(503); }
  });
  it('rejects caller policy/authorization/payment amounts and does not retry uncertain lifecycle writes', async () => {
    const { POST } = await import('../../../app/api/admin/subscriptions/lifecycle/route');
    for (const extra of [{ policy: {} }, { authorized: true }, { amountMinor: 1 }, { actorId: other }]) expect((await POST(request('', JSON.stringify({ ...command, request: { ...command.request, ...extra } })))).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
    transport.mockRejectedValue(new Error('uncertain synthetic'));
    expect((await POST(request('', JSON.stringify(command)))).status).toBe(503);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('rejects a staging receipt that changes submitted terms', async () => {
    const value = { bundle: { schemaVersion: 1, draft: { id, plan: { id, productId: id, code: `pln_${'a'.repeat(32)}` }, name: 'Changed' }, includedCredits: { revisionId: id } }, stagedBy: id, stagedAt: '2026-11-18T12:00:00Z' };
    transport.mockResolvedValueOnce(Response.json(value));
    expect((await drafts(request('', JSON.stringify({ bundle: { ...value.bundle, draft: { ...value.bundle.draft, name: 'Requested' } } })))).status).toBe(503);
  });
  it.each(['prices', 'features', 'credits'])('rejects same-ID staging receipt with altered %s', async field => {
    const bundle = { schemaVersion: 1, draft: { id, plan: { id, productId: id, code: `pln_${'a'.repeat(32)}` }, prices: [{ amountMinor: 1 }], features: [{ key: 'synthetic', type: 'boolean', enabled: true }] }, includedCredits: { revisionId: id, rules: [{ quantity: { kind: 'finite', value: 5 } }] } };
    const changed = structuredClone(bundle);
    if (field === 'prices') changed.draft.prices[0].amountMinor = 2;
    if (field === 'features') changed.draft.features[0].enabled = false;
    if (field === 'credits') changed.includedCredits.rules[0].quantity.value = 6;
    transport.mockResolvedValueOnce(Response.json({ bundle: changed, stagedBy: id, stagedAt: '2026-11-18T12:00:00Z' }));
    expect((await drafts(request('', JSON.stringify({ bundle })))).status).toBe(503);
  });
});
