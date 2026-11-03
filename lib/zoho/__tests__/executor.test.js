import { describe, expect, it } from 'vitest';
import { executorStatus } from '../executor';
describe('destination readiness guard', () => {
  it('disables creation for missing, failed or unsafe executors', async () => {
    for (const value of [undefined, {}, { fetch: async () => Response.json({ ready: true, emailPolicy: 'allowed' }) }, { fetch: async () => { throw new Error('offline'); } }])
      expect((await executorStatus(value, { sendBatch: async () => {} })).ready).toBe(false);
  });
  it('requires explicit no-email and approval attestation', async () => {
    const result = { version: 1, ready: true, emailPolicy: 'forbidden', approvalRequired: true, durableDispatch: true, receiptRecovery: true, modules: ['Candidates'] };
    const queue = { sendBatch: async () => {} };
    expect(await executorStatus({ fetch: async () => Response.json(result) }, queue)).toEqual(result);
    expect((await executorStatus({ fetch: async () => Response.json(result) })).ready).toBe(false);
    for (const field of ['approvalRequired', 'durableDispatch', 'receiptRecovery'])
      expect((await executorStatus({ fetch: async () => Response.json({ ...result, [field]: false }) }, queue)).ready).toBe(false);
  });
});
