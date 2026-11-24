/** Existing contracts must be complete before an edit can replace their terms. */
export function hydrateHybridTerms(org) {
    if (!Number.isFinite(org.plan_amount) || !Number.isInteger(org.seat_count) || org.seat_count < 1 ||
        !['monthly', 'yearly', 'annual', 'lifetime'].includes(org.billing_cycle) || !Array.isArray(org.features) ||
        !org.features.every(feature => typeof feature === 'string') || !Object.hasOwn(org, 'notes')) {
        throw new Error('Saved Hybrid terms are incomplete. Refresh the organization list before editing.')
    }
    return {
        planAmount: String(org.plan_amount),
        seatCount: String(org.seat_count),
        billingCycle: org.billing_cycle,
        features: [...org.features],
        notes: org.notes ?? '',
    }
}
