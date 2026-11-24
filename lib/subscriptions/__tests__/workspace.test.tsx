// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionWorkspace from '@/components/subscriptions/SubscriptionWorkspace';
import { availableOperations, AuthoringContext, buildDraft, buildLifecycleRequest, lifecycleTrackingKey, readTrackedLifecycle, trackLifecycle, clearTrackedLifecycle, CurrentSubscription, Discovery, DraftForm, subscriptionRequest } from '../workspace';

const id = 'a0000000-0000-4000-8000-000000000001';
const other = 'b0000000-0000-4000-8000-000000000001';
const context: AuthoringContext = { schemaVersion: 1, plan: { id, code: `pln_${'a'.repeat(32)}`, productId: id },
  audiences: ['synthetic_audience'], currencies: [{ code: 'USD', minorUnit: 2 }],
  features: [{ id, key: 'synthetic_flag', name: 'Synthetic flag', category: 'test', type: 'boolean' }], credit: { pools: [], timePolicies: [] } };
const form: DraftForm = { revisionId: id, revisionNumber: '1', name: 'Synthetic revision', audiences: ['synthetic_audience'],
  purchaseMode: 'contact_sales', prices: '[]', features: '[{"key":"synthetic_flag","type":"boolean","enabled":true}]', policyId: other, creditRules: '[]' };

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('operation-specific lifecycle requests and tracking', () => {
  const current = { actorId: id, state: { id, productId: id, version: 1, revisionId: id, subject: { kind: 'user', id } } } as CurrentSubscription;
  const references = { targetRevisionId: other, quoteId: id, settlementId: other, approvalId: id };
  it('serializes only quote and settlement for upgrade and no references for cancellation', () => {
    const upgrade = buildLifecycleRequest(current, 'upgrade', ' Upgrade ', references, 'immediate');
    expect(upgrade).toMatchObject({ operation: 'upgrade', reason: 'Upgrade', quoteId: id, settlementId: other });
    expect(upgrade).not.toHaveProperty('targetRevisionId'); expect(upgrade).not.toHaveProperty('timing'); expect(upgrade).not.toHaveProperty('approvalId');
    const cancel = buildLifecycleRequest(current, 'cancel', 'Cancel', references, 'next_renewal');
    for (const key of ['targetRevisionId', 'quoteId', 'settlementId', 'approvalId', 'timing']) expect(cancel).not.toHaveProperty(key);
    expect(buildLifecycleRequest(current, 'downgrade', 'Downgrade', references, 'next_renewal')).toMatchObject({ targetRevisionId: other, timing: 'next_renewal' });
    expect(() => buildLifecycleRequest(current, 'downgrade', 'Downgrade', references, '')).toThrow();
  });
  it('retains minimal identity, isolates actor/product, and rejects overwrite or malformed tracking', () => {
    const key = lifecycleTrackingKey(current);
    expect(readTrackedLifecycle(key)).toBeNull(); trackLifecycle(key, id);
    expect(readTrackedLifecycle(key)).toEqual({ version: 1, operationId: id });
    expect(() => trackLifecycle(key, other)).toThrow('Reconcile');
    expect(() => clearTrackedLifecycle(key, other)).toThrow('changed');
    expect(readTrackedLifecycle(lifecycleTrackingKey({ ...current, actorId: other }))).toBeNull();
    expect(readTrackedLifecycle(lifecycleTrackingKey({ ...current, state: { ...current.state, productId: other } }))).toBeNull();
    clearTrackedLifecycle(key, id); expect(readTrackedLifecycle(key)).toBeNull();
    sessionStorage.setItem(key, '{malformed'); expect(() => readTrackedLifecycle(key)).toThrow();
    expect(() => trackLifecycle(key, id)).toThrow();
  });
  it('surfaces unavailable storage instead of accepting an untracked intent', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    expect(() => trackLifecycle(lifecycleTrackingKey(current), id)).toThrow('Storage unavailable');
  });
});

describe('registry-driven revision authoring', () => {
  it('binds explicit revision and included-credit identity to owner plan without invented prices', () => {
    const value = buildDraft(context, form);
    expect(value.bundle.draft.plan).toEqual(context.plan);
    expect(value.bundle.draft.prices).toEqual([]);
    expect(value.bundle.includedCredits).toMatchObject({ id: other, revisionId: id, funding: 'included', rules: [] });
  });
  it.each([{ audiences: ['unknown'] }, { features: '[{"key":"unknown","type":"boolean","enabled":true}]' },
    { revisionId: '' }, { prices: '' }, { creditRules: '[{"poolKey":"unknown"}]' }, { purchaseMode: '' }])('rejects absent or unregistered terms %j', change => {
    expect(() => buildDraft(context, { ...form, ...change })).toThrow();
  });
  it('rejects a registered currency with an invented minor unit', () => {
    expect(() => buildDraft(context, { ...form, prices: JSON.stringify([{ id, currency: 'USD', minorUnit: 3, amountMinor: 1,
      intervalUnit: 'month', intervalCount: 1, quantityBasis: 'subscription', audiences: form.audiences }]) })).toThrow('currency');
  });
});

describe('explicit lifecycle authority', () => {
  const current = { actorId: id, state: { id, planId: id, productId: id, revisionId: id, version: 1,
    subject: { kind: 'user', id } } } as CurrentSubscription;
  const discovery: Discovery = { schemaVersion: 1, actorId: id, productId: id, nextCursor: null,
    items: [{ id, planId: id, productId: id, subject: { kind: 'user', id }, status: 'active', kind: 'initialized',
      revisionId: id, version: 1, lifecycleOperations: ['cancel'] }] };
  it('uses only same actor, subject, product and current CAS authority', () => {
    expect(availableOperations(current, discovery)).toEqual(['cancel']);
    expect(availableOperations(current, null)).toEqual([]);
    expect(availableOperations(current, { ...discovery, actorId: other })).toEqual([]);
    for (const change of [{ version: 2 }, { revisionId: other }, { productId: other }, { planId: other },
      { subject: { kind: 'organization' as const, id } }, { kind: 'uninitialized' as const }]) {
      expect(availableOperations(current, { ...discovery, items: [{ ...discovery.items[0], ...change }] })).toEqual([]);
    }
  });
});

describe('browser transport', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('sends an uncertain write once and preserves the caller operation identity', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('Uncertain'));
    vi.stubGlobal('fetch', transport);
    const body = { operationId: id, request: { operation: 'cancel' } };
    await expect(subscriptionRequest('/lifecycle', body)).rejects.toThrow('Uncertain');
    expect(transport).toHaveBeenCalledExactlyOnceWith('/api/admin/subscriptions/lifecycle', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', redirect: 'error', body: JSON.stringify(body) }));
  });
  it('surfaces owner denial instead of cached success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Denied' }, { status: 403 })));
    await expect(subscriptionRequest('/catalog')).rejects.toThrow('Denied');
  });
});

describe('routed subscription workspace', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  async function click(text: string) {
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === text)!.click());
  }
  async function enter(label: string, value: string) {
    const element = [...container.querySelectorAll('label')].find(item => item.textContent?.startsWith(label))!.querySelector('input,select,textarea') as HTMLInputElement;
    await act(async () => { element.value = value; Simulate.change(element); });
  }
  async function submit(button: string) {
    const form = [...container.querySelectorAll('button')].find(element => element.textContent === button)!.closest('form')!;
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  }
  it('shows real empty inventory and exposes authoring/current sections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string) => {
      if (path.endsWith('/catalog')) return Response.json({ schemaVersion: 1, plans: [], features: [] });
      if (path.endsWith('/published')) return Response.json({ schemaVersion: 1, actorId: id, productId: id,
        tax: { kind: 'gst', rateBasisPoints: 1800, priceDisplay: 'exclusive' }, plans: [], nextCursor: null });
      throw new Error(`Unexpected test request: ${path}`);
    }));
    await act(async () => root.render(<SubscriptionWorkspace />));
    expect(container.textContent).toContain('No canonical plans are available');
    expect(container.textContent).toContain('No features are registered');
    expect(container.textContent).toContain('No published offers on this page.');
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Current & usage')!.click());
    expect(container.textContent).toContain('Explicit subscription UUID');
    expect(container.textContent).toContain('does not grant access');
    expect(container.querySelector('input')?.required).toBe(true);
  });
  it('shows loading followed by owner failure without fabricating catalog cards', async () => {
    let reject!: (reason: Error) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((_resolve, fail) => { reject = fail; })));
    await act(async () => root.render(<SubscriptionWorkspace />));
    expect(container.textContent).toContain('Loading catalog');
    await act(async () => reject(new Error('Owner unavailable')));
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Owner unavailable');
    expect(container.textContent).not.toContain('Prepare revision');
  });
  it('permits authoring inactive product-bound candidates and retains uncertain revision identity without enabling another write', async () => {
    const transport = vi.fn().mockImplementation(async (path: string) => {
      if (path.endsWith('/catalog')) return Response.json({ schemaVersion: 1, plans: [{ ...context.plan, name: 'Inactive candidate', isActive: false, applicableEntities: context.audiences }], features: context.features });
      if (path.includes('/authoring/credits/context')) return Response.json(context);
      throw new Error('Uncertain staging');
    });
    vi.stubGlobal('fetch', transport);
    await act(async () => root.render(<SubscriptionWorkspace />));
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Prepare revision')?.disabled).toBe(false);
    await click('Prepare revision'); await submit('Load owner context');
    for (const [label, value] of [['Revision UUID', id], ['Revision number', '1'], ['Display name', 'Synthetic'], ['Purchase mode', 'contact_sales'],
      ['Price options', '[]'], ['Feature grants', '[]'], ['Included credit policy UUID', other], ['Included credit rules', '[]']]) await enter(label, value);
    const checkbox = container.querySelector('fieldset input[type=checkbox]') as HTMLInputElement;
    await act(async () => { checkbox.checked = true; Simulate.change(checkbox); });
    await submit('Stage exact bundle');
    expect(container.textContent).toContain(`Staging acknowledgement for revision ${id} is uncertain`);
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Load owner context')?.disabled).toBe(true);
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Stage exact bundle')?.disabled).toBe(true);
    expect(transport.mock.calls.filter(call => call[0].endsWith('/authoring/drafts'))).toHaveLength(1);
  });
  it('continues discovery across an empty filtered page, reads active usage and retains an uncertain lifecycle operation', async () => {
    const current: CurrentSubscription = { schemaVersion: 1, actorId: id, state: { id, planId: id, productId: id, revisionId: id, version: 1, status: 'active', subject: { kind: 'user', id }, periodEndsAt: 1000 },
      access: 'full', plan: { name: 'Synthetic plan', revisionNumber: 1 }, pools: [{ key: 'synthetic_pool', featureKey: 'synthetic', recipient: 'subscriber', audiences: context.audiences }], features: [] };
    const entry = { id, planId: id, productId: id, revisionId: id, version: 1, status: 'active', subject: { kind: 'user', id }, kind: 'initialized', lifecycleOperations: ['cancel', 'downgrade', 'upgrade'] };
    const transport = vi.fn().mockImplementation(async (path: string, init: RequestInit) => {
      if (path.endsWith('/catalog')) return Response.json({ schemaVersion: 1, plans: [], features: [] });
      if (path === '/api/admin/subscriptions') return Response.json({ schemaVersion: 1, actorId: id, productId: id, items: [], nextCursor: other });
      if (path.includes('?cursor=')) return Response.json({ schemaVersion: 1, actorId: id, productId: id, items: [entry], nextCursor: null });
      if (path.includes('/current?')) return Response.json(current);
      if (path.endsWith('/credits')) { expect(JSON.parse(String(init.body))).toEqual({ kind: 'usage', subscriptionId: id, recipientId: id, poolKey: 'synthetic_pool' }); return Response.json({ allocated: 7, consumed: 2, remaining: 5, asOf: '2026-11-19T12:00:00Z' }); }
      if (path.endsWith('/lifecycle')) return Response.json({ decision: { next: { productId: other } } });
      throw new Error('Unexpected path');
    });
    vi.stubGlobal('fetch', transport);
    await act(async () => root.render(<SubscriptionWorkspace />));
    await click('Current & usage'); await click('Discover authorized subscriptions');
    expect(container.textContent).toContain('Continue to the next page'); await click('Next page'); await click('Read subscription');
    expect(container.textContent).toContain('Synthetic plan'); await enter('Credit pool', 'synthetic_pool'); await submit('Read usage');
    expect(container.textContent).toContain('Includes active allocations only');
    await enter('Authorized operation', 'downgrade'); await enter('Target revision UUID', other); await enter('Timing (when applicable)', 'next_renewal');
    await enter('Authorized operation', 'upgrade');
    expect(container.textContent).not.toContain('Target revision UUID'); expect(container.textContent).not.toContain('Timing (when applicable)');
    await enter('Verified quote UUID', id); await enter('Verified settlement UUID', other);
    await enter('Authorized operation', 'cancel'); await enter('Reason', 'Synthetic cancellation'); await submit('Submit once');
    const calls = transport.mock.calls.filter(call => call[0].endsWith('/lifecycle'));
    expect(calls).toHaveLength(1); const sent = JSON.parse(String(calls[0][1].body));
    expect(sent.request).toEqual({ operation: 'cancel', subscriptionId: id, subject: { kind: 'user', id },
      expectedVersion: 1, expectedRevisionId: id, reason: 'Synthetic cancellation' });
    expect(container.textContent).toContain(sent.operationId);
    expect(container.textContent).toContain('Lifecycle product differs from the current subscription');
    expect(container.textContent).toContain('retained for owner reconciliation');
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Submit once')?.disabled).toBe(true);
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(<SubscriptionWorkspace />));
    await click('Current & usage'); await click('Discover authorized subscriptions'); await click('Next page'); await click('Read subscription');
    expect(container.textContent).toContain(sent.operationId);
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Submit once')?.disabled).toBe(true);
    expect(transport.mock.calls.filter(call => call[0].endsWith('/lifecycle'))).toHaveLength(1);
  });
  it('stages explicit terms and publishes the exact receipt revision with explicit previous-revision CAS', async () => {
    const transport = vi.fn().mockImplementation(async (path: string, init: RequestInit) => {
      if (path.endsWith('/catalog')) return Response.json({ schemaVersion: 1, plans: [{ ...context.plan, name: 'Candidate', isActive: false, applicableEntities: context.audiences }], features: context.features });
      if (path.includes('/authoring/credits/context')) return Response.json(context);
      if (path.endsWith('/authoring/drafts')) return Response.json({ ...JSON.parse(String(init.body)), stagedBy: id, stagedAt: '2026-11-19T12:00:00Z' });
      if (path.endsWith('/publications')) return Response.json({ planId: id, revisionId: id, previousRevisionId: other, publishedBy: id, publishedAt: '2026-11-19T12:01:00Z' });
      throw new Error('Unexpected path');
    });
    vi.stubGlobal('fetch', transport);
    await act(async () => root.render(<SubscriptionWorkspace />));
    await click('Prepare revision'); await submit('Load owner context');
    for (const [label, value] of [['Revision UUID', id], ['Revision number', '1'], ['Display name', 'Synthetic'], ['Purchase mode', 'contact_sales'],
      ['Price options', '[]'], ['Feature grants', '[]'], ['Included credit policy UUID', other], ['Included credit rules', '[]']]) await enter(label, value);
    const checkbox = container.querySelector('fieldset input[type=checkbox]') as HTMLInputElement;
    await act(async () => { checkbox.checked = true; Simulate.change(checkbox); });
    await submit('Stage exact bundle');
    expect(container.textContent).toContain('Revision staged at');
    await enter('Expected previous revision UUID', other); await submit('Publish exact revision');
    const publication = transport.mock.calls.find(call => call[0].endsWith('/publications'))!;
    expect(JSON.parse(String(publication[1].body))).toEqual({ planId: id, revisionId: id, expectedPreviousRevisionId: other });
    expect(container.querySelector('[role=status]')?.textContent).toContain('Revision published at');
    expect(transport.mock.calls.filter(call => call[0].endsWith('/authoring/drafts'))).toHaveLength(1);
    expect(transport.mock.calls.filter(call => call[0].endsWith('/publications'))).toHaveLength(1);
  });
});
