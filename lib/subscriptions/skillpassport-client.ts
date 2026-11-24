import 'server-only';
import { z } from 'zod';
import { requirePlatformAdmin } from '../platform-admin';
import { DraftRequestError, readDraftRequest } from './authoring';
import { subscriptionStateSchema, validateCurrentSubscriptionResponse } from './current-subscription';
import { discoverySchema, operations } from './workspace';

const paths = {
  discovery: '/api/subscriptions',
  credits: '/api/subscriptions/credits',
  lifecycle: '/api/subscriptions/lifecycle',
  current: '/api/subscriptions/current',
  catalog: '/api/admin/subscriptions/catalog',
  context: '/api/admin/subscriptions/authoring/context',
  creditContext: '/api/admin/subscriptions/authoring/credits/context',
  drafts: '/api/admin/subscriptions/authoring/drafts',
  publications: '/api/admin/subscriptions/publications',
  installation: '/api/admin/subscriptions/catalog-installation',
  availability: '/api/admin/subscriptions/catalog-availability',
  retirement: '/api/admin/subscriptions/catalog-retirement',
  hybridAdoption: '/api/admin/subscriptions/catalog-hybrid-adoption',
  published: '/api/admin/subscriptions/published',
} as const;
type Operation = keyof typeof paths;
const headers = { 'Cache-Control': 'private, no-store' };
const reference = z.string().uuid().transform(value => value.toLowerCase());
const integer = z.number().int().nonnegative().safe();
const subject = z.object({ kind: z.enum(['user', 'organization']), id: reference }).strict();
const usageEnvelope = z.object({ kind: z.literal('usage'), subscriptionId: reference, recipientId: reference, poolKey: z.string().min(1) }).strict();
const lifecycleEnvelope = z.object({
  operationId: reference, request: z.object({
    operation: z.enum(operations), subscriptionId: reference, subject, expectedVersion: integer.min(1), expectedRevisionId: reference,
    reason: z.string().min(1).max(2000).refine(value => value === value.trim()), targetRevisionId: reference.optional(), timing: z.enum(['next_renewal', 'immediate']).optional(), quoteId: reference.optional(), settlementId: reference.optional(), approvalId: reference.optional()
  }).strict()
}).strict();
const object = z.record(z.unknown());
const draftEnvelope = z.object({
  bundle: z.object({
    draft: z.object({
      id: reference,
      plan: z.object({ id: reference }).passthrough()
    }).passthrough()
  }).passthrough()
}).strict();
const operationReference = { schemaVersion: z.literal(1), operationId: reference, hybridPlanId: reference, approvalReference: z.string().min(1).max(500) };
// Catalog commands carry references and reviewed source mappings; the owner derives and validates every commercial term.
const catalogEnvelopes = {
  installation: z.object({ ...operationReference, profiles: z.array(object).min(1) }).strict(),
  availability: z.object({ ...operationReference, entries: z.array(z.object({ planId: reference, revisionId: reference, expectedActive: z.literal(false) }).strict()).min(1) }).strict(),
  retirement: z.object({ ...operationReference, replacements: z.array(z.object({ legacyPlanId: reference, planId: reference, revisionId: reference }).strict()).min(1) }).strict(),
  hybridAdoption: z.object({ ...operationReference, identityOperationId: reference, identities: z.object({ targetCode: z.string().regex(/^pln_[0-9a-f]{32}$/),
    revisionId: reference, includedCreditsId: reference, ruleId: reference }).strict() }).strict(),
} as const;
const publicationEnvelope = z.object({
  planId: reference, revisionId: reference,
  expectedPreviousRevisionId: reference.nullable()
}).strict();
const messages: Record<Operation, string> = {
  discovery: 'Authorized subscriptions are unavailable', credits: 'Subscription usage is unavailable', lifecycle: 'Subscription lifecycle acknowledgement is unavailable',
  current: 'Current subscription is unavailable',
  catalog: 'Subscription catalog inventory is unavailable', context: 'Subscription authoring context is unavailable',
  creditContext: 'Subscription credit context is unavailable', drafts: 'Draft staging is unavailable',
  publications: 'Subscription publication is unavailable',
  installation: 'Subscription catalog installation is unavailable',
  availability: 'Subscription catalog availability is unavailable',
  retirement: 'Subscription catalog retirement is unavailable',
  hybridAdoption: 'Hybrid catalog adoption is unavailable',
  published: 'Published subscription catalog is unavailable',
};

function acknowledges(submitted: unknown, received: unknown): boolean {
  if (submitted === null || typeof submitted !== 'object') return submitted === received;
  if (Array.isArray(submitted)) return Array.isArray(received) && submitted.length === received.length
    && submitted.every((value, index) => acknowledges(value, received[index]));
  if (received === null || typeof received !== 'object' || Array.isArray(received)) return false;
  return Object.keys(submitted).length === Object.keys(received).length
    && Object.entries(submitted).every(([key, value]) => acknowledges(value, (received as Record<string, unknown>)[key]));
}

/** One explicitly configured owner origin. No alternate origin, database or retry path. */
function ownerOrigin(env: Record<string, unknown>): string {
  const value = env.SKILLPASSPORT_API_URL;
  if (typeof value !== 'string' || value !== value.trim()) throw new Error('Missing subscription owner');
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Invalid subscription owner');
  }
  return url.origin;
}

async function readOwnerResponse(response: Response): Promise<Record<string, unknown>> {
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('Invalid owner response');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing owner response');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, body = '';
  try {
    for (; ;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8388608) { await reader.cancel(); throw new Error('Owner response exceeds budget'); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally { reader.releaseLock(); }
  return object.parse(JSON.parse(body));
}

export async function forwardSubscriptionRequest(request: Request, operation: Operation): Promise<Response> {
  try {
    const authorization = await requirePlatformAdmin(request);
    if (authorization.error) return authorization.error;
    const parameters = [...new URL(request.url).searchParams];
    const target = new URL(paths[operation], ownerOrigin(authorization.env));
    if (operation === 'current' || operation === 'context' || operation === 'creditContext') {
      const parameter = operation === 'current' ? 'subscriptionId' : 'planId';
      if (parameters.length !== 1 || parameters[0][0] !== parameter || !reference.safeParse(parameters[0][1]).success) {
        return Response.json({ error: 'Exactly one valid reference is required' }, { status: 400, headers });
      }
      target.searchParams.set(parameter, parameters[0][1]);
    } else if (operation === 'discovery' || operation === 'published') {
      if (parameters.length > 1 || (parameters.length === 1 && (parameters[0][0] !== 'cursor' || !reference.safeParse(parameters[0][1]).success))) return Response.json({ error: 'Only one valid cursor is accepted' }, { status: 400, headers });
      if (parameters.length) target.searchParams.set('cursor', parameters[0][1].toLowerCase());
    } else if (parameters.length) return Response.json({ error: 'Unexpected query parameters' }, { status: 400, headers });
    let draft: z.infer<typeof draftEnvelope> | undefined;
    let publication: z.infer<typeof publicationEnvelope> | undefined;
    if (operation === 'drafts') {
      const parsed = draftEnvelope.safeParse(await readDraftRequest(request));
      if (!parsed.success) return Response.json({ error: 'Invalid draft request' }, { status: 400, headers });
      draft = parsed.data;
    }
    if (operation === 'publications') {
      const parsed = publicationEnvelope.safeParse(await readDraftRequest(request));
      if (!parsed.success) return Response.json({ error: 'Invalid publication request' }, { status: 400, headers });
      publication = parsed.data;
    }
    let catalogCommand: Record<string, unknown> | undefined;
    if (operation === 'installation' || operation === 'availability' || operation === 'retirement' || operation === 'hybridAdoption') {
      const parsed = catalogEnvelopes[operation].safeParse(await readDraftRequest(request));
      if (!parsed.success) return Response.json({ error: 'Invalid catalog command' }, { status: 400, headers });
      catalogCommand = parsed.data;
    }
    let usage: z.infer<typeof usageEnvelope> | undefined;
    let lifecycle: z.infer<typeof lifecycleEnvelope> | undefined;
    if (operation === 'credits' || operation === 'lifecycle') {
      const value = await readDraftRequest(request);
      if (operation === 'credits') { const parsed = usageEnvelope.safeParse(value); if (!parsed.success) return Response.json({ error: 'Invalid usage request' }, { status: 400, headers }); usage = parsed.data; }
      else { const parsed = lifecycleEnvelope.safeParse(value); if (!parsed.success) return Response.json({ error: 'Invalid lifecycle request' }, { status: 400, headers }); lifecycle = parsed.data; }
    }
    const payload = draft ?? publication ?? catalogCommand ?? usage ?? lifecycle;
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const response = await fetch(target, {
      // Workers reject redirect 'error'; with 'manual' any 3xx is not ok and is refused below, never followed.
      method: payload === undefined ? 'GET' : 'POST', redirect: 'manual', cache: 'no-store',
      headers: { Authorization: `Bearer ${authorization.accessToken}`, 'Content-Type': 'application/json', 'X-RM-CSRF': '1' },
      body, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      // Never relay upstream internals, redirects or cookies. An uncertain write is never retried.
      await response.body?.cancel();
      const status = [400, 401, 403, 413].includes(response.status) ? response.status : 503;
      return Response.json({ error: status === 503 ? messages[operation] : 'Subscription request denied' }, { status, headers });
    }
    if (response.status !== 200) throw new Error('Unexpected owner acknowledgement');
    const result = await readOwnerResponse(response);
    if (operation === 'discovery') {
      const page = discoverySchema.parse(result);
      const after = parameters.length ? parameters[0][1].toLowerCase() : null;
      const ids = page.items.map(item => item.id);
      if (page.actorId !== authorization.user.id.toLowerCase() || new Set(ids).size !== ids.length
        || ids.some((id, index) => (after !== null && id <= after) || (index > 0 && id <= ids[index - 1]))
        || (page.nextCursor !== null && ((after !== null && page.nextCursor <= after) || ids.some(id => id > page.nextCursor)))
        || page.items.some(item => item.productId !== page.productId || (item.subject.kind === 'user' && item.subject.id !== page.actorId))) throw new Error('Discovery owner scope differs');
    } else if (operation === 'credits') {
      const receipt = z.object({ subscriptionId: reference, productId: reference, recipient: z.object({ kind: z.enum(['subscriber', 'organization', 'managed_learner']), id: reference }).strict(), featureKey: z.string().min(1), poolKey: z.string().min(1), allocated: integer, consumed: integer, remaining: integer, asOf: z.string().datetime({ offset: true }) }).strict().parse(result);
      if (!usage || receipt.subscriptionId !== usage.subscriptionId || receipt.recipient.id !== usage.recipientId || receipt.poolKey !== usage.poolKey || receipt.allocated - receipt.consumed !== receipt.remaining) throw new Error('Usage scope differs');
    } else if (operation === 'lifecycle') {
      const receipt = z.object({ operationId: reference, committedAt: z.string().datetime({ offset: true }), decision: z.object({ expectedVersion: integer.min(1), expectedRevisionId: reference, next: subscriptionStateSchema, access: z.enum(['full', 'restricted', 'read_only', 'suspended']), retryAt: z.array(integer), audit: z.object({ operation: z.enum(operations), actorId: reference, reason: z.string(), at: integer, policyId: reference, policyVersion: integer.min(1) }).strict() }).strict() }).strict().parse(result);
      const command = lifecycle?.request, decision = receipt.decision;
      if (!lifecycle || !command || receipt.operationId !== lifecycle.operationId || decision.expectedVersion !== command.expectedVersion || decision.expectedRevisionId !== command.expectedRevisionId || decision.next.id !== command.subscriptionId || decision.next.version !== command.expectedVersion + 1 || decision.next.subject.id !== command.subject.id || decision.next.subject.kind !== command.subject.kind || decision.audit.actorId !== authorization.user.id.toLowerCase() || decision.audit.operation !== command.operation || decision.audit.reason !== command.reason) throw new Error('Lifecycle acknowledgement differs');
    } else if (operation === 'current') {
      validateCurrentSubscriptionResponse(result, parameters[0][1], authorization.user.id);
    } else if (operation === 'published') {
      // Same published terms customers see; the owner already compared them with the application projections.
      const page = z.object({ schemaVersion: z.literal(1), actorId: reference, productId: reference, tax: object, plans: z.array(object), nextCursor: reference.nullable() }).strict().parse(result);
      if (page.actorId !== authorization.user.id.toLowerCase()) throw new Error('Published catalog actor differs');
    } else if (operation === 'catalog') {
      z.object({ schemaVersion: z.literal(1), plans: z.array(object), features: z.array(object) }).strict().parse(result);
    } else if (operation === 'drafts') {
      const receipt = z.object({
        bundle: z.object({
          schemaVersion: z.literal(1),
          draft: z.object({
            id: reference, plan: z.object({
              id: reference, productId: reference,
              code: z.string().regex(/^pln_[0-9a-f]{32}$/)
            }).strict()
          }).passthrough(),
          includedCredits: z.object({ revisionId: reference }).passthrough()
        }).strict(),
        stagedBy: reference, stagedAt: z.string().datetime({ offset: true })
      }).strict().parse(result);
      if (!draft || receipt.stagedBy.toLowerCase() !== authorization.user.id.toLowerCase()
        || !acknowledges(draft.bundle, receipt.bundle)
        || receipt.bundle.draft.id.toLowerCase() !== draft.bundle.draft.id.toLowerCase()
        || receipt.bundle.draft.plan.id.toLowerCase() !== draft.bundle.draft.plan.id.toLowerCase()
        || receipt.bundle.includedCredits.revisionId.toLowerCase() !== draft.bundle.draft.id.toLowerCase()) {
        throw new Error('Owner acknowledgement differs');
      }
    } else if (operation === 'publications') {
      const receipt = z.object({
        planId: reference, revisionId: reference, previousRevisionId: reference.nullable(),
        publishedBy: reference, publishedAt: z.string().datetime({ offset: true })
      }).strict().parse(result);
      if (!publication || receipt.planId.toLowerCase() !== publication.planId.toLowerCase()
        || receipt.revisionId.toLowerCase() !== publication.revisionId.toLowerCase()
        || (receipt.previousRevisionId?.toLowerCase() ?? null) !== (publication.expectedPreviousRevisionId?.toLowerCase() ?? null)
        || receipt.publishedBy.toLowerCase() !== authorization.user.id.toLowerCase()) throw new Error('Publication acknowledgement differs');
    } else if (operation === 'installation' || operation === 'availability' || operation === 'retirement' || operation === 'hybridAdoption') {
      const receipt = z.object({ operationId: reference }).passthrough().parse(result);
      if (!catalogCommand || receipt.operationId.toLowerCase() !== String(catalogCommand.operationId).toLowerCase()) throw new Error('Catalog command acknowledgement differs');
    } else {
      const context = z.object({ schemaVersion: z.literal(1), plan: z.object({ id: reference }).passthrough(), features: z.array(object) }).passthrough().parse(result);
      if (context.plan.id.toLowerCase() !== parameters[0][1].toLowerCase()) throw new Error('Owner plan differs');
    }
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof DraftRequestError) return Response.json({ error: 'Invalid draft request' }, { status: error.status, headers });
    return Response.json({ error: messages[operation] }, { status: 503, headers });
  }
}
