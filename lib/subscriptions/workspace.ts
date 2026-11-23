import { z } from 'zod';

const reference = z.string().uuid().transform(value => value.toLowerCase());
const text = z.string().trim().min(1);
export const featureDefinition = z.object({ id: reference, key: text, name: text,
  type: z.enum(['boolean', 'enum', 'numeric_limit', 'metered']), category: text, options: z.array(text).optional() });
export const inventorySchema = z.object({ schemaVersion: z.literal(1), plans: z.array(z.object({
  id: reference, code: text, productId: reference.nullable(), name: text, isActive: z.boolean(), applicableEntities: z.array(text),
})), features: z.array(featureDefinition) });
export const contextSchema = z.object({ schemaVersion: z.literal(1),
  plan: z.object({ id: reference, code: text, productId: reference }), audiences: z.array(text).min(1),
  currencies: z.array(z.object({ code: text, minorUnit: z.number().int().nonnegative() })).min(1),
  features: z.array(featureDefinition), credit: z.object({ pools: z.array(z.object({ key: text, featureKey: text,
    recipient: z.enum(['subscriber', 'organization', 'managed_learner']), audiences: z.array(text) })),
    timePolicies: z.array(z.object({ id: reference }).passthrough()) }),
});
export type AuthoringContext = z.infer<typeof contextSchema>;
export type Inventory = z.infer<typeof inventorySchema>;
export const operations = ['upgrade', 'renew', 'downgrade', 'cancel', 'expire', 'payment_failed', 'suspend', 'reactivate'] as const;
export function lifecycleReferenceFields(operation: string) {
  return operation === 'upgrade' || operation === 'renew' ? ['quoteId', 'settlementId'] as const
    : operation === 'downgrade' ? ['targetRevisionId'] as const
      : operation === 'suspend' || operation === 'reactivate' ? ['approvalId'] as const : [];
}
export function buildLifecycleRequest(current: CurrentSubscription, operationValue: string, reason: string,
  references: Record<'targetRevisionId' | 'quoteId' | 'settlementId' | 'approvalId', string>, timing: string) {
  const operation = z.enum(operations).parse(operationValue);
  const request = { operation, subscriptionId: reference.parse(current.state.id), subject: current.state.subject,
    expectedVersion: z.number().int().positive().safe().parse(current.state.version), expectedRevisionId: reference.parse(current.state.revisionId), reason: text.max(2000).parse(reason),
    ...Object.fromEntries(lifecycleReferenceFields(operation).flatMap(field => {
      if (!references[field].trim() && field === 'approvalId') return [];
      return [[field, reference.parse(references[field].trim())]];
    })), ...(operation === 'downgrade' ? { timing: z.enum(['next_renewal', 'immediate']).parse(timing) } : {}) };
  return request;
}
// Same-tab uncertainty reference, never an authorization or settlement record. No credentials or reason are stored.
export function lifecycleTrackingKey(current: Pick<CurrentSubscription, 'actorId' | 'state'>) {
  return `subscription:lifecycle:${reference.parse(current.actorId)}:${reference.parse(current.state.productId)}`;
}
const trackedOperation = z.object({ version: z.literal(1), operationId: reference }).strict();
export function readTrackedLifecycle(key: string): { version: 1; operationId: string } | null {
  const raw = sessionStorage.getItem(key);
  if (raw === null) return null;
  const value = trackedOperation.parse(JSON.parse(raw));
  return { version: 1, operationId: reference.parse(value.operationId) };
}
export function trackLifecycle(key: string, operationId: string) {
  if (readTrackedLifecycle(key)) throw new Error('Reconcile the tracked operation before another request');
  const value = JSON.stringify(trackedOperation.parse({ version: 1, operationId }));
  sessionStorage.setItem(key, value);
  if (sessionStorage.getItem(key) !== value) throw new Error('Operation tracking could not be saved');
}
export function clearTrackedLifecycle(key: string, operationId: string) {
  if (readTrackedLifecycle(key)?.operationId !== operationId) throw new Error('Operation tracking changed; reconcile with the owner');
  sessionStorage.removeItem(key);
}
export const discoverySchema = z.object({ schemaVersion: z.literal(1), actorId: reference, productId: reference,
  items: z.array(z.object({ id: reference, planId: reference, productId: reference,
    subject: z.object({ kind: z.enum(['user', 'organization']), id: reference }).strict(),
    status: z.enum(['active', 'pending', 'paused', 'cancelled', 'expired', 'grace_period']),
    kind: z.enum(['initialized', 'uninitialized']), revisionId: reference.nullable(), version: z.number().int().positive().safe().nullable(),
    lifecycleOperations: z.array(z.enum(operations)).refine(values => new Set(values).size === values.length) }).strict().superRefine((value, context) => {
      if (value.kind === 'initialized' ? value.revisionId === null || value.version === null : value.revisionId !== null || value.version !== null || value.lifecycleOperations.length > 0) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid initialization binding' });
    })).max(50), nextCursor: reference.nullable() }).strict();
export type Discovery = z.infer<typeof discoverySchema>;
export interface CurrentSubscription {
  schemaVersion: 1; actorId: string; state: { id: string; planId: string; productId: string; revisionId: string;
    version: number; status: string; subject: { kind: 'user' | 'organization'; id: string }; periodEndsAt: number | null; validity?: 'perpetual' };
  access: string; plan: { name: string; revisionNumber: number }; features: Record<string, unknown>[];
  pools: { key: string; featureKey: string; recipient: 'subscriber' | 'organization' | 'managed_learner'; audiences: string[] }[];
}

/** Browser traffic stays on the authenticated dashboard boundary. Writes are sent exactly once. */
export async function subscriptionRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/admin/subscriptions${path}`, { method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json', 'X-RM-CSRF': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'Subscription request failed');
  return result as T;
}

export function availableOperations(current: CurrentSubscription, discovery: Discovery | null) {
  const entry = discovery?.items.find(item => item.id === current.state.id && item.kind === 'initialized'
    && item.planId === current.state.planId && item.productId === current.state.productId
    && item.revisionId === current.state.revisionId && item.version === current.state.version
    && item.subject.id === current.state.subject.id && item.subject.kind === current.state.subject.kind);
  return entry && discovery?.actorId === current.actorId ? entry.lifecycleOperations : [];
}

export interface DraftForm { revisionId: string; revisionNumber: string; name: string; audiences: string[];
  purchaseMode: string; prices: string; features: string; policyId: string; creditRules: string }

/** No commercial defaults: every term is explicit input checked against owner context. */
export function buildDraft(context: AuthoringContext, form: DraftForm) {
  const id = reference.parse(form.revisionId);
  const audiences = z.array(text).min(1).parse(form.audiences);
  if (new Set(audiences).size !== audiences.length || audiences.some(value => !context.audiences.includes(value))) throw new Error('Select registered audiences');
  const prices = z.array(z.object({ id: reference, currency: text, minorUnit: z.number().int().nonnegative(),
    amountMinor: z.number().int().nonnegative().safe(), intervalUnit: z.enum(['month', 'year']), intervalCount: z.number().int().positive(),
    quantityBasis: z.enum(['subscription', 'seat']), audiences: z.array(text).min(1) }).strict()).parse(JSON.parse(form.prices));
  for (const price of prices) {
    if (!context.currencies.some(currency => currency.code === price.currency && currency.minorUnit === price.minorUnit)
      || price.audiences.some(audience => !audiences.includes(audience))) throw new Error('Price currency or audience differs from owner context');
  }
  const features = z.array(z.object({ key: text, type: z.enum(['boolean', 'enum', 'numeric_limit', 'metered']),
    enabled: z.boolean(), value: z.string().nullable().optional(), limit: z.record(z.unknown()).optional() }).strict()).parse(JSON.parse(form.features));
  if (new Set(features.map(item => item.key)).size !== features.length) throw new Error('Duplicate feature');
  for (const feature of features) {
    const definition = context.features.find(item => item.key === feature.key && item.type === feature.type);
    if (!definition || (feature.type === 'enum' && feature.enabled && !definition.options?.includes(feature.value!))) throw new Error('Feature differs from owner registry');
  }
  const rules = z.array(z.record(z.unknown())).parse(JSON.parse(form.creditRules));
  for (const rule of rules) {
    if (!context.credit.pools.some(pool => pool.key === rule.poolKey && pool.featureKey === rule.featureKey && pool.recipient === rule.recipient)) throw new Error('Credit rule differs from owner pool registry');
  }
  return { bundle: { schemaVersion: 1, draft: { schemaVersion: 2, id, plan: context.plan,
    revisionNumber: z.coerce.number().int().positive().safe().parse(form.revisionNumber), name: text.parse(form.name), audiences,
    purchaseMode: z.enum(['self_service', 'contact_sales']).parse(form.purchaseMode), prices, features },
    includedCredits: { schemaVersion: 1, id: reference.parse(form.policyId), revisionId: id, funding: 'included', rules } } };
}

/** Published offers as customers see them (same owner reader), across audiences, for administrators. */
const publishedCopy = z.object({ tagline: text, positioning: text, description: text, priceText: text, termsNote: text, highlights: z.array(text) }).strict();
export const publishedCatalogSchema = z.object({ schemaVersion: z.literal(1), actorId: reference, productId: reference,
  tax: z.object({ kind: z.literal('gst'), rateBasisPoints: z.number().int().min(1).max(10000), priceDisplay: z.enum(['exclusive', 'inclusive']) }).strict(),
  plans: z.array(z.object({ plan: z.object({ id: reference, code: text, productId: reference }).strict(), revisionId: reference,
    revisionNumber: z.number().int().min(1), name: text, audiences: z.array(text).min(1), purchaseMode: z.enum(['free', 'self_service', 'contact_sales']),
    prices: z.array(z.object({ id: reference, currency: text, minorUnit: z.number().int().min(0), amountMinor: z.number().int().min(0),
      intervalUnit: z.enum(['month', 'year']), intervalCount: z.number().int().min(1), quantityBasis: z.enum(['subscription', 'seat']), audiences: z.array(text) }).strict()),
    features: z.array(z.record(z.unknown())),
    presentation: z.object({ priceLabel: z.enum(['exact', 'starting_at']), taxInclusive: z.boolean(), badge: text.nullable(), copy: publishedCopy.nullable() }).strict(),
  }).strict()), nextCursor: reference.nullable() }).strict();
export type PublishedCatalog = z.infer<typeof publishedCatalogSchema>;
/** The same display rules as the customer card: "From" for starting-at prices and the owner tax label. */
export function publishedPriceLabel(catalog: PublishedCatalog, plan: PublishedCatalog['plans'][number], price: PublishedCatalog['plans'][number]['prices'][number]) {
  const digits = String(price.amountMinor).padStart(price.minorUnit + 1, '0');
  const amount = price.minorUnit === 0 ? digits : `${digits.slice(0, -price.minorUnit)}.${digits.slice(-price.minorUnit)}`;
  const tax = plan.presentation.taxInclusive ? '' : ` +${(catalog.tax.rateBasisPoints / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}% ${catalog.tax.kind.toUpperCase()}`;
  return `${plan.presentation.priceLabel === 'starting_at' ? 'From ' : ''}${price.currency} ${amount} / ${price.intervalCount} ${price.intervalUnit}${tax}`;
}
