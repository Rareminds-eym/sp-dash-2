import { expect, it } from 'vitest';
import { hydrateHybridTerms } from '../hybrid-terms';
const contract = { plan_amount: 4300, seat_count: 100, billing_cycle: 'annual', features: ['admissions_data'], notes: 'Negotiated terms' };
it('hydrates every saved field and retains annual billing without converting the stored contract', () => {
    expect(hydrateHybridTerms(contract)).toEqual({ planAmount: '4300', seatCount: '100', billingCycle: 'annual', features: ['admissions_data'], notes: 'Negotiated terms' });
});
it('edits a copy of the grants rather than mutating the loaded contract', () => {
    const form = hydrateHybridTerms(contract);
    form.features.push('faculty');
    expect(contract.features).toEqual(['admissions_data']);
});
it('accepts valid zero price, empty grants and no notes', () => {
    expect(hydrateHybridTerms({ ...contract, plan_amount: 0, features: [], notes: null })).toMatchObject({ planAmount: '0', features: [], notes: '' });
});
it.each(['plan_amount', 'seat_count', 'billing_cycle', 'features', 'notes'])('blocks editing when %s was not loaded', key => {
    const partial = { ...contract };
    delete partial[key];
    expect(() => hydrateHybridTerms(partial)).toThrow('incomplete');
});
