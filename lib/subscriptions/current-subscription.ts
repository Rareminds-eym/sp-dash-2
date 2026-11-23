import 'server-only';
import { z } from 'zod';

const reference = z.string().uuid().transform(v => v.toLowerCase());
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const revision = { planId: reference, revisionId: reference, productId: reference };
export const subscriptionStateSchema = z.object({ ...revision, id: reference, version: time.min(1),
  subject: z.object({ kind: z.enum(['user', 'organization']), id: reference }).strict(),
  status: z.enum(['active', 'pending', 'paused', 'cancelled', 'expired', 'grace_period']),
  periodStartsAt: time, periodEndsAt: time.nullable(), validity: z.literal('perpetual').optional(), trialEndsAt: time.nullable(), renewalEnabled: z.boolean(),
  cancelledAt: time.nullable(), paymentFailedAt: time.nullable(),
  downgradedAt: time.nullable().optional(),
  scheduledChange: z.object({ ...revision, effectiveAt: time }).strict().nullable(),
}).strict().refine(state => (state.periodEndsAt === null) === (state.validity === 'perpetual')
  && (state.periodEndsAt !== null || (!state.renewalEnabled && state.trialEndsAt === null && state.paymentFailedAt === null
    && state.scheduledChange === null && state.status !== 'expired' && state.status !== 'grace_period')), 'Invalid perpetual state');
const response = z.object({ schemaVersion: z.literal(1), actorId: reference, state: subscriptionStateSchema,
  access: z.enum(['full', 'restricted', 'read_only', 'suspended']), audience: z.string().min(1),
  activatedAt: time, subscriptionEndsAt: time.nullable(),
  pools: z.array(z.object({ key: z.string(), featureKey: z.string(), recipient: z.enum(['subscriber', 'organization', 'managed_learner']),
    audiences: z.array(z.string()) }).strict()),
  plan: z.object({ id: reference, code: z.string().regex(/^pln_[0-9a-f]{32}$/), productId: reference,
    name: z.string().min(1), revisionNumber: time.min(1) }).strict(),
  features: z.array(z.record(z.unknown())),
}).strict();
/** Validate the HTTP owner's response; this module has no database dependency. */
export function validateCurrentSubscriptionResponse(value: unknown, subscriptionId: string, actorId: string) {
  const result = response.parse(value);
  if (result.actorId !== actorId.toLowerCase() || result.state.id !== subscriptionId.toLowerCase()
    || result.plan.id !== result.state.planId || result.plan.productId !== result.state.productId
    || (result.state.periodEndsAt !== null && result.state.periodStartsAt >= result.state.periodEndsAt) || (result.state.periodEndsAt === null ? result.subscriptionEndsAt !== null : result.subscriptionEndsAt === null || result.subscriptionEndsAt < result.state.periodEndsAt)
    || (result.state.downgradedAt != null && result.state.downgradedAt < result.activatedAt)) {
    throw new Error('Current subscription owner scope differs');
  }
  return result;
}
