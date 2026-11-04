import { describe, expect, it, vi } from 'vitest';
import { discoveryConsumer as worker } from '../discovery-consumer';
import { discoveryStatus } from '../discovery-readiness';

const configured = { ENVIRONMENT: 'local', ZOHO_DISCOVERY_AUTHORITY: { fetch: async () => Response.json({ version: 1, ready: true, emailPolicy: 'forbidden', stagingOnly: true }) }, ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'secret',
  ZOHO_TOKEN_ENCRYPTION_KEY: btoa('k'.repeat(32)), ZOHO_DISCOVERY_QUEUE: { send: vi.fn() } };
const binding = env => ({ fetch: request => worker.fetch(request, env) });
describe('discovery readiness', () => {
  it('requires the actual enabled and configured consumer as well as the producer', async () => {
    expect(await discoveryStatus(binding(configured), configured.ZOHO_DISCOVERY_QUEUE)).toBe(true);
    for (const env of [{ ...configured, ENVIRONMENT: 'production' }, { ...configured, ZOHO_CLIENT_ID: '' },
      { ...configured, ZOHO_TOKEN_ENCRYPTION_KEY: 'invalid'.repeat(10) },
      { ...configured, ZOHO_DISCOVERY_QUEUE: undefined }, { ...configured, SUPABASE_SERVICE_ROLE_KEY: 'forbidden' }, { ...configured, ZOHO_DISCOVERY_AUTHORITY: undefined }])
      expect(await discoveryStatus(binding(env), configured.ZOHO_DISCOVERY_QUEUE)).toBe(false);
    expect(await discoveryStatus(undefined, configured.ZOHO_DISCOVERY_QUEUE)).toBe(false);
    expect(await discoveryStatus(binding(configured), undefined)).toBe(false);
  });
  it('fails closed for broken or unsafe attestations', async () => {
    for (const fetch of [async () => { throw new Error('offline'); },
      async () => Response.json({ version: 1, ready: true, emailPolicy: 'allowed', stagingOnly: false }),
      async () => new Response('not-json'), async () => Response.json({}, { status: 503 })])
      expect(await discoveryStatus({ fetch }, configured.ZOHO_DISCOVERY_QUEUE)).toBe(false);
  });
  it('times out an unresponsive consumer', async () => {
    vi.useFakeTimers();
    try {
      const pending = discoveryStatus({ fetch: () => new Promise(() => {}) }, configured.ZOHO_DISCOVERY_QUEUE);
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('exposes no tokens or records and rejects unrelated routes', async () => {
    const response = await worker.fetch(new Request('https://worker/readiness'), configured);
    expect(await response.json()).toEqual({ version: 1, ready: true, emailPolicy: 'forbidden', stagingOnly: true });
    expect((await worker.fetch(new Request('https://worker/'), configured)).status).toBe(404);
  });
});
