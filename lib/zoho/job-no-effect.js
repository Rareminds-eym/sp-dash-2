import { z } from 'zod';

/** Only a durable, operation/lease-bound SQL proof can return a rejected job to review. */
export const jobNoEffectSchema = z.object({
  state: z.literal('not_applied'), operationId: z.string().uuid(), lease: z.string().uuid(),
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/), emailPolicy: z.literal('forbidden'),
  reviewRequired: z.literal(true), reasonCode: z.literal('JOB_REVIEW_REQUIRED'),
}).strict();

export function matchingJobNoEffect(value, operationId, sourceHash, lease) {
  const parsed = jobNoEffectSchema.safeParse(value);
  return parsed.success && parsed.data.operationId === operationId && parsed.data.sourceHash === sourceHash &&
    (lease === undefined || parsed.data.lease === lease) ? parsed.data : null;
}
