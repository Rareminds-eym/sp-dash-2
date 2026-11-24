'use client';

import React, { useEffect, useRef, useState } from 'react';
import { availableOperations, AuthoringContext, buildDraft, buildLifecycleRequest, lifecycleReferenceFields, lifecycleTrackingKey, readTrackedLifecycle, trackLifecycle, clearTrackedLifecycle, contextSchema, CurrentSubscription, Discovery,
  discoverySchema, DraftForm, Inventory, inventorySchema, PublishedCatalog, publishedCatalogSchema, publishedPriceLabel, subscriptionRequest } from '@/lib/subscriptions/workspace';
import styles from './SubscriptionWorkspace.module.css';

type Tab = 'catalog' | 'author' | 'current';
type Staged = { bundle: { draft: { id: string; plan: { id: string } } }; stagedBy: string; stagedAt: string };
const emptyDraft: DraftForm = { revisionId: '', revisionNumber: '', name: '', audiences: [], purchaseMode: '',
  prices: '', features: '', policyId: '', creditRules: '' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Subscription request failed';

function JsonTerms({ label, value, onChange, description }: { label: string; value: string; onChange: (value: string) => void; description: string }) {
  const id = React.useId();
  return <label className={styles.wide} htmlFor={id}>{label}<span id={`${id}-help`} className={styles.help}>{description}</span>
    <textarea id={id} rows={7} required spellCheck={false} value={value} aria-describedby={`${id}-help`} onChange={event => onChange(event.target.value)} /></label>;
}

/** Published offers from the same owner reader customers use; the admin sees every audience. */
function PublishedOffers({ attempt }: { attempt: number }) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState<PublishedCatalog | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setPage(null); setFailure('');
    subscriptionRequest(cursor ? `/published?cursor=${encodeURIComponent(cursor)}` : '/published', undefined, controller.signal)
      .then(value => setPage(publishedCatalogSchema.parse(value)))
      .catch(error => { if (!controller.signal.aborted) setFailure(errorMessage(error)); });
    return () => controller.abort();
  }, [cursor, attempt]);
  if (failure) return <p role="alert" className={styles.error}>{failure}</p>;
  if (!page) return <p role="status">Loading published offers…</p>;
  return <>
    {page.plans.length === 0 && <p className={styles.empty}>No published offers on this page.</p>}
    <div className={styles.cards}>{page.plans.map(plan => <article key={plan.revisionId} className={styles.card} aria-label={`${plan.name} published offer`}>
      {plan.presentation.badge && <span className={styles.badge}>{plan.presentation.badge}</span>}
      <h3>{plan.name}</h3><p>{plan.audiences.join(', ')} · Revision {plan.revisionNumber}</p>
      {plan.presentation.copy && <p>{plan.presentation.copy.tagline}</p>}
      {plan.prices.length ? plan.prices.map(price => <p key={price.id}><strong>{publishedPriceLabel(page, plan, price)}</strong></p>)
        : <p><strong>{plan.purchaseMode === 'free' ? 'Free' : plan.presentation.copy?.priceText ?? 'Custom terms'}</strong></p>}
      <p className={styles.help}>{plan.purchaseMode === 'contact_sales' ? 'Talk to Sales' : plan.purchaseMode === 'free' ? 'Free entry' : 'Self-serve purchase'}</p>
      <code>{plan.plan.code}</code>
    </article>)}</div>
    <div>{cursor && <button type="button" onClick={() => setCursor(null)}>First offers</button>}
      {page.nextCursor && page.plans.length > 0 && <button type="button" onClick={() => setCursor(page.nextCursor)}>Next offers</button>}</div>
  </>;
}

export default function SubscriptionWorkspace() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [inventoryError, setInventoryError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [planId, setPlanId] = useState('');
  const [context, setContext] = useState<AuthoringContext | null>(null);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [previousRevision, setPreviousRevision] = useState('');
  const [firstPublication, setFirstPublication] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState('');
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [discoveryError, setDiscoveryError] = useState('');
  const [poolKey, setPoolKey] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [usage, setUsage] = useState<{ allocated: number; consumed: number; remaining: number; asOf: string } | null>(null);
  const [operation, setOperation] = useState('');
  const [reason, setReason] = useState('');
  const [timing, setTiming] = useState('');
  const [references, setReferences] = useState({ targetRevisionId: '', quoteId: '', settlementId: '', approvalId: '' });
  const [pendingWrite, setPendingWrite] = useState<{ operationId: string } | null>(null);
  const [trackingReady, setTrackingReady] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const trackingKey = current ? lifecycleTrackingKey(current) : null;
  const [stagingUncertain, setStagingUncertain] = useState(false);
  const [publicationUncertain, setPublicationUncertain] = useState(false);

  useEffect(() => {
    setTrackingReady(false); setTrackingError(''); setPendingWrite(null);
    if (!trackingKey) return;
    try { setPendingWrite(readTrackedLifecycle(trackingKey)); setTrackingReady(true); }
    catch { setTrackingError('Operation tracking is unavailable or invalid. Reconcile tracking before submitting a change.'); }
  }, [trackingKey]);

  useEffect(() => {
    const controller = new AbortController();
    setInventory(null); setInventoryError('');
    subscriptionRequest('/catalog', undefined, controller.signal).then(value => setInventory(inventorySchema.parse(value)))
      .catch(failure => { if (!controller.signal.aborted) setInventoryError(errorMessage(failure)); });
    return () => controller.abort();
  }, [catalogAttempt]);

  async function run(label: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (failure) { setError(errorMessage(failure)); }
    finally { busyRef.current = false; setBusy(''); }
  }
  function edit<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setStaged(null);
  }
  const permitted = current ? availableOperations(current, discovery) : [];
  const selectedPool = current?.pools.find(pool => pool.key === poolKey);
  const locked = Boolean(busy);

  async function loadCurrent(id: string) {
    setCurrent(null); setUsage(null); setOperation(''); setPoolKey(''); setRecipientId('');
    const value = await subscriptionRequest<CurrentSubscription>(`/current?subscriptionId=${encodeURIComponent(id)}`);
    setCurrent(value);
  }
  async function loadDiscovery(cursor?: string) {
    setDiscoveryError('');
    try {
      const value = discoverySchema.parse(await subscriptionRequest(cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''));
      setDiscovery(value);
    } catch (failure) { setDiscovery(null); setDiscoveryError(errorMessage(failure)); }
  }

  return <section className={styles.workspace} aria-label="Subscription workspace">
    <header className={styles.heading}><div><p className={styles.eyebrow}>Subscription operations</p><h1>Plans & subscriptions</h1>
      <p>Review the catalog, prepare revision terms and manage authorized subscriptions.</p></div>
      <span className={styles.badge}>Owner verified</span></header>
    <nav className={styles.tabs} aria-label="Subscription sections">{(['catalog', 'author', 'current'] as Tab[]).map(value =>
      <button type="button" key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setError(''); setNotice(''); }}>
        {{ catalog: 'Catalog', author: 'Revision studio', current: 'Current & usage' }[value]}</button>)}</nav>
    <div aria-live="polite" role="status">{busy && <p className={styles.status}>{busy}…</p>}{notice && <p className={styles.success}>{notice}</p>}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}

    {tab === 'catalog' && <div className={styles.panel}>
      <div className={styles.panelHeading}><h2>Published offers</h2><button type="button" onClick={() => setCatalogAttempt(value => value + 1)}>Refresh offers</button></div>
      <p className={styles.help}>Exactly the published terms customers see, for every audience, checked against the application copy.</p>
      <PublishedOffers attempt={catalogAttempt} />
      <div className={styles.panelHeading}><h2>Canonical plan inventory</h2><button type="button" onClick={() => setCatalogAttempt(value => value + 1)}>Refresh inventory</button></div>
      <p className={styles.help}>Inventory is administrative reference data. A plan becomes an offer only after its revision is published.</p>
      {inventoryError ? <p role="alert" className={styles.error}>{inventoryError}</p> : !inventory ? <p role="status">Loading catalog…</p> : <>
        {inventory.plans.length === 0 && <p className={styles.empty}>No canonical plans are available.</p>}
        <div className={styles.cards}>{inventory.plans.map(plan => <article key={plan.id} className={styles.card}>
          <span className={styles.badge}>{plan.isActive ? 'Active' : 'Inactive'}</span><h3>{plan.name}</h3><p>{plan.applicableEntities.join(', ')}</p>
          <code>{plan.code}</code><button type="button" disabled={locked || stagingUncertain || publicationUncertain || !plan.productId} onClick={() => { setPlanId(plan.id); setContext(null); setStaged(null); setTab('author'); }}>Prepare revision</button>
          {!plan.productId && <p className={styles.help}>Product binding is unavailable.</p>}
        </article>)}</div>
        <h3 className={styles.subheading}>Application feature registry</h3>
        {inventory.features.length === 0 ? <p className={styles.empty}>No features are registered.</p> : <div className={styles.registry}>{inventory.features.map(feature => <div key={feature.id}><strong>{feature.name}</strong><code>{feature.key}</code><span>{feature.type} · {feature.category}</span></div>)}</div>}
      </>}
      <p className={styles.help}>Purchases require published commercial terms and verified quote/payment integration. This workspace does not create payments.</p>
    </div>}

    {tab === 'author' && <div className={styles.panel}>
      <h2>Revision studio</h2><p className={styles.help}>Stage an immutable bundle, then publish its exact revision with a previous-revision check. All terms are validated by the owner.</p>
      <form className={styles.inline} onSubmit={event => { event.preventDefault(); void run('Loading authoring context', async () => {
        if (stagingUncertain || publicationUncertain) throw new Error('Reconcile the pending revision acknowledgement before changing context');
        setContext(null); setStaged(null); setDraft(emptyDraft);
        setPreviousRevision(''); setFirstPublication(false);
        const value = contextSchema.parse(await subscriptionRequest(`/authoring/credits/context?planId=${encodeURIComponent(planId)}`));
        setContext(value);
      }); }}><label>Canonical plan<select required disabled={locked || stagingUncertain || publicationUncertain} value={planId} onChange={event => { setPlanId(event.target.value); setContext(null); setStaged(null); }}>
        <option value="">Choose a plan</option>{inventory?.plans.filter(plan => plan.productId).map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.code}</option>)}</select></label>
        <button disabled={locked || stagingUncertain || publicationUncertain || !planId}>Load owner context</button></form>
      {context && <>
        <div className={styles.context}><strong>Registered terms</strong><p>Audiences: {context.audiences.join(', ')}</p><p>Currencies: {context.currencies.map(currency => `${currency.code} (${currency.minorUnit} minor digits)`).join(', ')}</p>
          <details><summary>Feature, credit pool and time-policy references</summary><pre>{JSON.stringify({ features: context.features, pools: context.credit.pools, timePolicies: context.credit.timePolicies }, null, 2)}</pre></details></div>
        <form className={styles.form} onSubmit={event => { event.preventDefault(); void run('Staging revision', async () => {
          if (stagingUncertain || publicationUncertain) throw new Error('Reconcile the pending revision acknowledgement before another write');
          const body = buildDraft(context, draft); setStaged(null); setStagingUncertain(true);
          const receipt = await subscriptionRequest<Staged>('/authoring/drafts', body); setStaged(receipt); setStagingUncertain(false);
          setNotice(`Revision staged at ${receipt.stagedAt} by ${receipt.stagedBy}.`);
        }); }}>
          <fieldset className={styles.formFields} disabled={locked || stagingUncertain || publicationUncertain}>
          <label>Revision UUID<input required value={draft.revisionId} onChange={event => edit('revisionId', event.target.value)} /></label>
          <label>Revision number<input required type="number" min="1" step="1" value={draft.revisionNumber} onChange={event => edit('revisionNumber', event.target.value)} /></label>
          <label>Display name<input required value={draft.name} onChange={event => edit('name', event.target.value)} /></label>
          <label>Purchase mode<select required value={draft.purchaseMode} onChange={event => edit('purchaseMode', event.target.value)}><option value="">Choose terms</option><option value="self_service">Self service</option><option value="contact_sales">Contact sales</option></select></label>
          <fieldset className={styles.wide}><legend>Eligible audiences</legend>{context.audiences.map(audience => <label className={styles.checkbox} key={audience}><input type="checkbox" checked={draft.audiences.includes(audience)} onChange={event => edit('audiences', event.target.checked ? [...draft.audiences, audience] : draft.audiences.filter(value => value !== audience))} />{audience}</label>)}</fieldset>
          <JsonTerms label="Price options (JSON array)" value={draft.prices} onChange={value => edit('prices', value)} description="Each option: id, currency, minorUnit, amountMinor, intervalUnit (month/year), intervalCount, quantityBasis (subscription/seat), audiences. Use registered currencies; enter [] only for intentionally absent prices." />
          <JsonTerms label="Feature grants (JSON array)" value={draft.features} onChange={value => edit('features', value)} description="Each grant: registered key, type and enabled. Enum grants require value; numeric/metered grants require explicit limit terms. No grant is selected automatically." />
          <label>Included credit policy UUID<input required value={draft.policyId} onChange={event => edit('policyId', event.target.value)} /></label>
          <JsonTerms label="Included credit rules (JSON array)" value={draft.creditRules} onChange={value => edit('creditRules', value)} description="Each rule requires id, registered featureKey/poolKey/recipient, audiences, quantity, cadence, expiry and rollover. Monthly rules require a registered timePolicyId. Enter [] only when intentionally providing no included credits." />
          <div className={styles.wide}><button disabled={locked || stagingUncertain || publicationUncertain}>Stage exact bundle</button>{stagingUncertain && <p className={styles.error}>Staging acknowledgement for revision {draft.revisionId} is uncertain. Reconcile this revision with the owner before starting another write.</p>}</div>
          </fieldset>
        </form>
        {staged && <form className={styles.publication} onSubmit={event => { event.preventDefault(); void run('Publishing revision', async () => {
          if (publicationUncertain) throw new Error('Reconcile the pending publication acknowledgement before another write');
          setPublicationUncertain(true);
          const result = await subscriptionRequest<{ publishedAt: string }>('/publications', { planId: staged.bundle.draft.plan.id,
            revisionId: staged.bundle.draft.id, expectedPreviousRevisionId: firstPublication ? null : previousRevision });
          setPublicationUncertain(false); setStaged(null); setNotice(`Revision published at ${result.publishedAt}.`);
        }); }}><h3>Publish staged revision</h3><code>{staged.bundle.draft.id}</code>
          <label className={styles.checkbox}><input type="checkbox" disabled={locked || publicationUncertain} checked={firstPublication} onChange={event => setFirstPublication(event.target.checked)} />This is the first publication (no previous revision)</label>
          {!firstPublication && <label>Expected previous revision UUID<input required disabled={locked || publicationUncertain} value={previousRevision} onChange={event => setPreviousRevision(event.target.value)} /></label>}
          <button disabled={locked || publicationUncertain}>Publish exact revision</button>{publicationUncertain && <p className={styles.error}>Publication acknowledgement for revision {staged.bundle.draft.id} is uncertain. Reconcile the publication pointer with the owner before another write.</p>}
        </form>}
      </>}
    </div>}

    {tab === 'current' && <div className={styles.panel}>
      <div className={styles.panelHeading}><h2>Current subscription & usage</h2><button type="button" disabled={locked} onClick={() => void run('Discovering authorized subscriptions', () => loadDiscovery())}>Discover authorized subscriptions</button></div>
      {discoveryError && <p role="alert" className={styles.error}>{discoveryError}</p>}
      {discovery && <div className={styles.context}>{discovery.items.length === 0 ? <p>{discovery.nextCursor ? 'No authorized subscriptions on this page. Continue to the next page.' : 'No subscriptions are authorized on this page.'}</p> : discovery.items.map(item => <div key={item.id} className={styles.discovery}>
        <code>{item.id}</code><span>{item.status} · {item.kind}</span><button type="button" disabled={locked || item.kind !== 'initialized'} onClick={() => { setSubscriptionId(item.id); void run('Reading subscription', () => loadCurrent(item.id)); }}>Read subscription</button>
        {item.kind === 'uninitialized' && <span>Owner initialization is required.</span>}</div>)}{discovery.nextCursor && <button type="button" disabled={locked} onClick={() => void run('Loading next page', () => loadDiscovery(discovery.nextCursor!))}>Next page</button>}</div>}
      <form className={styles.inline} onSubmit={event => { event.preventDefault(); void run('Reading subscription', () => loadCurrent(subscriptionId)); }}><label>Explicit subscription UUID<input required disabled={locked} value={subscriptionId} onChange={event => setSubscriptionId(event.target.value)} /></label><button disabled={locked}>Read current</button></form>
      <p className={styles.help}>The owner verifies subject scope. Platform administration does not grant access to another customer's subscription.</p>
      {current && <>
        <div className={styles.summary}><div><span>Current plan</span><strong>{current.plan.name}</strong></div><div><span>Status / access</span><strong>{current.state.status} / {current.access}</strong></div><div><span>Revision / version</span><strong>{current.plan.revisionNumber} / {current.state.version}</strong></div></div>
        <details><summary>Current feature grants</summary><pre>{JSON.stringify(current.features, null, 2)}</pre></details>
        <h3 className={styles.subheading}>Active credit usage</h3>{current.pools.length === 0 ? <p className={styles.empty}>No credit pools are configured for this revision.</p> : <form className={styles.form} onSubmit={event => { event.preventDefault(); void run('Reading active usage', async () => {
          if (!selectedPool) throw new Error('Select a configured pool');
          const recipient = selectedPool.recipient === 'managed_learner' ? recipientId : current.state.subject.id;
          setUsage(null); setUsage(await subscriptionRequest('/credits', { kind: 'usage', subscriptionId: current.state.id, poolKey, recipientId: recipient }));
        }); }}><label>Credit pool<select required disabled={locked} value={poolKey} onChange={event => { setPoolKey(event.target.value); setUsage(null); setRecipientId(''); }}><option value="">Select configured pool</option>{current.pools.map(pool => <option key={pool.key} value={pool.key}>{pool.key} · {pool.recipient}</option>)}</select></label>
          {selectedPool?.recipient === 'managed_learner' && <label>Managed learner recipient UUID<input required disabled={locked} value={recipientId} onChange={event => { setRecipientId(event.target.value); setUsage(null); }} /></label>}
          <button disabled={locked || !selectedPool}>Read usage</button></form>}
        {usage && <div className={styles.summary}><div><span>Allocated</span><strong>{usage.allocated}</strong></div><div><span>Consumed</span><strong>{usage.consumed}</strong></div><div><span>Remaining</span><strong>{usage.remaining}</strong></div><p>As of {usage.asOf}. Includes active allocations only.</p></div>}
        <h3 className={styles.subheading}>Lifecycle request</h3>
        {!permitted.length ? <p className={styles.empty}>No lifecycle operations are explicitly authorized for this current version. Refresh authorized discovery after an owner change.</p> : <form className={styles.form} onSubmit={event => { event.preventDefault(); void run('Submitting lifecycle request', async () => {
          if (!trackingReady || !trackingKey || pendingWrite || !permitted.includes(operation as typeof permitted[number])) throw new Error('An operation requires fresh explicit owner authority and tracking');
          const request = buildLifecycleRequest(current, operation, reason, references, timing);
          const submission = { operationId: crypto.randomUUID(), request };
          try { trackLifecycle(trackingKey, submission.operationId); }
          catch { setTrackingReady(false); setTrackingError('Operation tracking could not be saved. No request was sent; reconcile any tracked operation.'); throw new Error('Operation tracking could not be saved'); }
          setPendingWrite(submission);
          const receipt = await subscriptionRequest<{ operationId: string; decision: { expectedVersion: number; expectedRevisionId: string; next: { id: string; productId: string; version: number; subject: { kind: string; id: string } }; audit: { operation: string; actorId: string; reason: string } } }>('/lifecycle', submission);
          if (receipt.decision.next.productId !== current.state.productId) throw new Error('Lifecycle product differs from the current subscription');
          if (receipt.operationId !== submission.operationId || receipt.decision.expectedVersion !== current.state.version
            || receipt.decision.expectedRevisionId !== current.state.revisionId || receipt.decision.next.id !== current.state.id
            || receipt.decision.next.version !== current.state.version + 1 || receipt.decision.next.subject.id !== current.state.subject.id
            || receipt.decision.next.subject.kind !== current.state.subject.kind || receipt.decision.audit.operation !== operation
            || receipt.decision.audit.actorId !== current.actorId || receipt.decision.audit.reason !== request.reason) throw new Error('Lifecycle acknowledgement differs');
          clearTrackedLifecycle(trackingKey, submission.operationId);
          setPendingWrite(null); setOperation(''); setDiscovery(null);
          setCurrent(null); setUsage(null); setNotice('Lifecycle request committed. Read current state and refresh discovery before another operation.');
        }); }}>
          <fieldset className={styles.formFields} disabled={locked || Boolean(pendingWrite) || !trackingReady}>
          <label>Authorized operation<select required value={operation} disabled={Boolean(pendingWrite) || !trackingReady} onChange={event => { setOperation(event.target.value); setReferences({ targetRevisionId: '', quoteId: '', settlementId: '', approvalId: '' }); setTiming(''); }}><option value="">Choose operation</option>{permitted.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Reason<input required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label>
          {operation === 'downgrade' && <label>Timing (when applicable)<select required value={timing} onChange={event => setTiming(event.target.value)}><option value="">Unspecified</option><option value="next_renewal">Next renewal</option><option value="immediate">Immediate</option></select></label>}
          {lifecycleReferenceFields(operation).map(key => <label key={key}>{{ targetRevisionId: 'Target revision UUID', quoteId: 'Verified quote UUID', settlementId: 'Verified settlement UUID', approvalId: 'Owner approval UUID' }[key]}<input required={key !== 'approvalId'} value={references[key]} onChange={event => setReferences(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
          <p className={`${styles.help} ${styles.wide}`}>Only genuine owner references are accepted. An authorized operation can still be denied when payment, approval or transition terms are unavailable.</p>
          <button disabled={locked || Boolean(pendingWrite) || !trackingReady}>Submit once</button>
          </fieldset>
        </form>}
        {pendingWrite && <p role="alert" className={styles.error}>Request outcome is uncertain. Operation {pendingWrite.operationId} is retained for owner reconciliation. No automatic retry will run.</p>}
        {trackingError && <p role="alert" className={styles.error}>{trackingError}</p>}
      </>}
    </div>}
  </section>;
}
