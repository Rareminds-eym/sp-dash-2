import { describe, it, expect, vi } from 'vitest';
import { acceptSyncWebhook, syncCoordinator, webhookHash, bulkDiscoveryAvailable } from '../sync-coordinator';
const connectionId = '10000000-0000-4000-8000-000000000001';
const secret = 'a'.repeat(43);
const body = { connectionId, module: 'Candidates', secret };
const request = input => new Request('https://admin.example/api/integrations/zoho-recruit/webhook', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
describe('durable sync coordinator', () => {
  it('accepts authenticated hints and never sends source payloads or plaintext secrets to storage', async () => {
    const db = { rpc: vi.fn(async () => ({ data: true })) };
    const response = await acceptSyncWebhook(request(body), db);
    expect(response.status).toBe(202);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_accept_sync_hint', { p_connection: connectionId, p_module: 'Candidates', p_hash: await webhookHash(secret) });
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(secret);
    expect(await response.json()).toEqual({ accepted: true, stagingOnly: true });
  });
  it('supports workflow form bodies but rejects duplicate parameters', async () => {
    const db = { rpc: vi.fn(async () => ({ data: true })) };
    const form = extra => new Request('https://admin.example/webhook', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() + extra });
    expect((await acceptSyncWebhook(form(''), db)).status).toBe(202);
    db.rpc.mockClear();
    expect((await acceptSyncWebhook(form('&module=Job_Openings'), db)).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it.each([{ ...body, module: 'Users' }, { ...body, connectionId: 'bad' }, { ...body, secret: 'short' },
    { ...body, email: 'not-accepted@example.invalid' }, { ...body, approved: true }, { ...body, externalId: '1;DROP' }])('rejects untrusted payload fields before storage: %j', async input => {
    const db = { rpc: vi.fn() };
    expect((await acceptSyncWebhook(request(input), db)).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects oversized notifications, query credentials and missing authorization', async () => {
    const db = { rpc: vi.fn(async () => ({ data: false })) };
    expect((await acceptSyncWebhook(request({ ...body, padding: 'x'.repeat(5000) }), db)).status).toBe(413);
    expect(db.rpc).not.toHaveBeenCalled();
    const url = new Request('https://admin.example/webhook?secret=hidden', { method: 'POST', body: '{}' });
    expect((await acceptSyncWebhook(url, db)).status).toBe(400);
    expect((await acceptSyncWebhook(request(body), db)).status).toBe(401);
  });
  it('reports failed durable acceptance as retryable without acknowledging the hint', async () => {
    const db = { rpc: vi.fn(async () => ({ error: { code: '08006' } })) };
    expect((await acceptSyncWebhook(request(body), db)).status).toBe(503);
  });
  it('generates a random secret once and persists only its hash with actor/config fencing', async () => {
    const db = { rpc: vi.fn(async () => ({ data: {} })) };
    const result = await syncCoordinator(db).rotateWebhook({ connectionId, expectedConfigRevision: 3 }, connectionId);
    expect(result.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_rotate_webhook', { p_connection: connectionId, p_config: 3, p_hash: await webhookHash(result.secret), p_actor: connectionId });
  });
  it('bounds independent module policies and rejects caller-supplied actors', async () => {
    const db = { rpc: vi.fn(async () => ({ data: {} })) };
    const input = { connectionId, expectedConfigRevision: 3, module: 'Job_Openings', enabled: true, intervalMinutes: 15, reconciliationDays: 7, preferBulk: true };
    await syncCoordinator(db).configure(input, connectionId);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith('zoho_configure_sync', { p_connection: connectionId, p_config: 3, p_module: 'Job_Openings', p_enabled: true, p_interval: 15, p_reconciliation: 7, p_bulk: true, p_actor: connectionId });
    for (const patch of [{ intervalMinutes: 0 }, { reconciliationDays: 31 }, { enabled: 'true' }, { actor: connectionId }])
      await expect(syncCoordinator(db).configure({ ...input, ...patch }, connectionId)).rejects.toThrow();
  });
  it('keeps bulk selection off without source processing, encrypted storage and OAuth', () => {
    expect(bulkDiscoveryAvailable({})).toBe(false);
    expect(bulkDiscoveryAvailable({ ENVIRONMENT: 'local', SKILLPASSPORT_ASSETS: {}, ZOHO_DISCOVERY_QUEUE: { send() {} } })).toBe(false);
  });
});
