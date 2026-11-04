vi.mock('../config',async original=>{
  const module=await original();const {fixturePolicy,fixtureProfileName}=await import('./fixtures/policy');
  const read=env=>fixturePolicy(module.readZohoConfig,env);
  return {...module,readZohoConfig:read,zohoProfileName:env=>fixtureProfileName(module,env),sourceProcessingEnabled:env=>{const policy=read(env);return policy.background&&policy.discovery&&policy.sourceOperations&&typeof env.ZOHO_DISCOVERY_QUEUE?.send==='function';}};
});
import { describe, expect, it, vi } from 'vitest';
import { openTokens, sealTokens, tokenKeyring, hasTokenKeyring } from '../token-vault';
import { recruitJson, getConnectionAccessToken } from '../oauth';
import { createConnectionQuota, createDiscoveryQuota } from '../source-quota';
import { rotateConnectionTokens } from '../token-rotation';
const oldKey = btoa('a'.repeat(32)); const newKey = btoa('b'.repeat(32));
const environment = { ZOHO_TOKEN_ENCRYPTION_KEYS: JSON.stringify({ old: oldKey, current: newKey }),
  ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID: 'current', ZOHO_TOKEN_ENCRYPTION_KEY: oldKey };
describe('Explicit token key lifecycle', () => {
  it('reads legacy envelopes, writes current ID and reads an explicit previous ID', async () => {
    const legacy = await sealTokens({ accessToken: 'private' }, oldKey, 'connection');
    const ring = tokenKeyring(environment);
    expect(await openTokens(legacy, ring, 'connection')).toEqual({ accessToken: 'private' });
    const previous = await sealTokens({ accessToken: 'previous' }, { ...ring, activeKeyId: 'old' }, 'connection');
    expect(await openTokens(previous, ring, 'connection')).toEqual({ accessToken: 'previous' });
    const current = await sealTokens({ accessToken: 'private' }, ring, 'connection');
    expect(current.keyId).toBe('current');
    expect(JSON.stringify(current)).not.toContain('private');
    await expect(openTokens(current, ring, 'other')).rejects.toThrow();
    await expect(openTokens({ ...current, keyId: 'old' }, ring, 'connection')).rejects.toThrow();
  });
  it('does not try alternative keys for removed or unknown IDs', async () => {
    const ring = tokenKeyring(environment);
    const envelope = await sealTokens({}, { ...ring, activeKeyId: 'old' }, 'c');
    await expect(openTokens(envelope, { ...ring, keys: { current: newKey } }, 'c')).rejects.toThrow('Token key unavailable');
    await expect(openTokens(envelope, oldKey, 'c')).rejects.toThrow('Token key unavailable');
    await expect(openTokens(await sealTokens({}, oldKey, 'c'), { ...ring, legacyKey: undefined }, 'c')).rejects.toThrow('Legacy token key unavailable');
  });
  it.each([
    { ZOHO_TOKEN_ENCRYPTION_KEYS: '{}' },
    { ...environment, ZOHO_TOKEN_ENCRYPTION_ACTIVE_KEY_ID: 'missing' },
    { ...environment, ZOHO_TOKEN_ENCRYPTION_KEYS: '[]' },
    { ...environment, ZOHO_TOKEN_ENCRYPTION_KEYS: '{"current":"short"}' },
  ])('rejects invalid keyring configuration', env => expect(hasTokenKeyring(env)).toBe(false));
  it('keeps a legacy-only configuration compatible', () => expect(hasTokenKeyring({ ZOHO_TOKEN_ENCRYPTION_KEY: oldKey })).toBe(true));
  function database(connection, envelope) {
    return { from: vi.fn(table => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === 'zoho_connections' ? connection : { envelope } }) }) }) })),
      rpc: vi.fn(async () => ({ data: { status: 'paused', keyId: 'current' } })) };
  }
  it('requires paused current generation and never calls SQL for stale confirmation', async () => {
    const db = database({ status: 'connected', credential_generation: 2 });
    await expect(rotateConnectionTokens(db, environment, { connectionId: 'c', actor: 'a', expectedGeneration: 2, reason: 'Approved rotation' })).rejects.toThrow('Pause');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rewraps credentials with an opaque expected-envelope CAS and safe response', async () => {
    const previous = await sealTokens({ accessToken: 'secret', refreshToken: 'secret-refresh' }, oldKey, 'c');
    const db = database({ status: 'paused', credential_generation: 2 }, previous);
    const result = await rotateConnectionTokens(db, environment, { connectionId: 'c', actor: 'a', expectedGeneration: 2, reason: 'Approved rotation' });
    expect(result).toEqual({ status: 'paused', keyId: 'current' });
    const [name, args] = db.rpc.mock.calls[0];
    expect(name).toBe('zoho_rotate_connection_tokens'); expect(args.p_expected).toEqual(previous);
    expect(await openTokens(args.p_envelope, tokenKeyring(environment), 'c')).toEqual({ accessToken: 'secret', refreshToken: 'secret-refresh' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('requires reconnect or approved read-key recovery when decryption is unavailable', async () => {
    const db = database({ status: 'paused', credential_generation: 2 }, await sealTokens({}, btoa('z'.repeat(32)), 'c'));
    await expect(rotateConnectionTokens(db, environment, { connectionId: 'c', actor: 'a', expectedGeneration: 2, reason: 'Approved rotation' })).rejects.toThrow('reconnect');
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
describe('Durable source quota transport', () => {
  const target = 'https://recruit.zoho.in/recruit/v2/Candidates';
  const quota = () => ({ reserve: vi.fn(async () => ({ granted: true, reservationId: 'reservation' })), settle: vi.fn(async () => ({ settled: true })) });
  it('does not call the provider without a reservation', async () => {
    const q = quota(); q.reserve.mockResolvedValue({ granted: false, retryAfterSeconds: 45 }); const fetcher = vi.fn();
    await expect(recruitJson(target, {}, fetcher, q)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 45 });
    expect(fetcher).not.toHaveBeenCalled(); expect(q.settle).not.toHaveBeenCalled();
  });
  it('settles 429 backoff without reading undocumented provider-credit headers', async () => {
    const q = quota();
    await expect(recruitJson(target, {}, async () => new Response('', { status: 429, headers: { 'Retry-After': '120', 'X-API-CREDITS-REMAINING': '999999' } }), q)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(q.settle).toHaveBeenCalledWith('reservation', 429, 120);
  });
  it('retains the charged reservation and releases concurrency after a transport failure', async () => {
    const q = quota();
    await expect(recruitJson(target, {}, async () => { throw new Error('network'); }, q)).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
    expect(q.settle).toHaveBeenCalledWith('reservation', 0, 0);
  });
  it('reserves OAuth separately and settles malformed responses', async () => {
    const q = quota();
    await expect(recruitJson('https://accounts.zoho.in/oauth/v2/token', {}, async () => new Response('invalid'), q)).rejects.toMatchObject({ code: 'SOURCE_INVALID' });
    expect(q.reserve).toHaveBeenCalledWith('oauth'); expect(q.settle).toHaveBeenCalledWith('reservation', 200, 0);
  });
  it('keeps all restricted commands bound to the run and lease', async () => {
    const command = vi.fn(async () => ({})); const q = createDiscoveryQuota(command, 'run', 'lease');
    await q.reserve('bulk'); await q.settle('reservation', 200, 0);
    expect(command.mock.calls).toEqual([
      ['quota-reserve', { runId: 'run', lease: 'lease', kind: 'bulk' }],
      ['quota-settle', { runId: 'run', lease: 'lease', reservationId: 'reservation', status: 200, retryAfterSeconds: 0 }],
    ]);
  });
  it('fails closed if database quota reservations fail', async () => {
    const q = createConnectionQuota({ rpc: async () => ({ error: { message: 'private error' } }) }, 'connection');
    await expect(q.reserve()).rejects.toThrow('Source quota authority unavailable');
  });
});
describe('Existing-runtime connection token renewal', () => {
  async function fixture({ expiresAt = Date.now() - 1000, uncertain = false, connected = true } = {}) {
    const envelope = await sealTokens({ accessToken: 'old-access', refreshToken: 'refresh', expiresAt }, oldKey, 'c');
    const connection = { id: 'c', region: 'in', source_org_id: '123', status: connected ? 'connected' : 'paused', credential_generation: 4 };
    return { connection, envelope,
      from: vi.fn(table => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === 'zoho_connections' ? connection : { envelope, refresh_uncertain: uncertain } }) }) }) })),
      rpc: vi.fn(async name => ({ data: name === 'zoho_begin_connection_refresh' ? { acquired: true } :
        name === 'zoho_reserve_source_quota' ? { granted: true, reservationId: 'reservation' } : { success: true } })),
    };
  }
  const env = { ...environment, ZOHO_CLIENT_ID: 'client', ZOHO_CLIENT_SECRET: 'client-secret' };
  it('returns a valid cached token without POST or refresh reservation', async () => {
    const db = await fixture({ expiresAt: Date.now() + 3600000 }); const fetcher = vi.fn();
    expect(await getConnectionAccessToken(db, env, 'c', { fetcher })).toEqual({ connection: db.connection, accessToken: 'old-access' });
    expect(fetcher).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it('uses the durable generation lease, pre-POST marker and current-key completion', async () => {
    const db = await fixture(); const fetcher = vi.fn(async () => Response.json({ access_token: 'new-access', expires_in: 3600 }));
    expect((await getConnectionAccessToken(db, env, 'c', { fetcher })).accessToken).toBe('new-access');
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['zoho_begin_connection_refresh', 'zoho_reserve_source_quota',
      'zoho_mark_connection_refresh', 'zoho_finish_connection_refresh', 'zoho_settle_source_quota']);
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_generation: 4, p_expected: db.envelope });
    const finalEnvelope = db.rpc.mock.calls[3][1].p_envelope;
    expect(finalEnvelope.keyId).toBe('current');
    expect((await openTokens(finalEnvelope, tokenKeyring(environment), 'c')).accessToken).toBe('new-access');
    expect(fetcher.mock.calls[0][1].redirect).toBe('manual');
  });
  it('keeps an ambiguous POST marked and never submits a second POST', async () => {
    const db = await fixture(); const fetcher = vi.fn(async () => { throw new Error('network'); });
    await expect(getConnectionAccessToken(db, env, 'c', { fetcher })).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['zoho_begin_connection_refresh', 'zoho_reserve_source_quota',
      'zoho_mark_connection_refresh', 'zoho_settle_source_quota']);
    const blocked = await fixture({ uncertain: true });
    await expect(getConnectionAccessToken(blocked, env, 'c', { fetcher })).rejects.toThrow('operator reconnect');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(blocked.rpc).not.toHaveBeenCalled();
  });
  it('does not fetch for paused connections or a competing refresh lease', async () => {
    const fetcher = vi.fn(); const paused = await fixture({ connected: false });
    await expect(getConnectionAccessToken(paused, env, 'c', { fetcher })).rejects.toThrow('Connected');
    const db = await fixture(); db.rpc.mockResolvedValue({ data: { acquired: false } });
    await expect(getConnectionAccessToken(db, env, 'c', { fetcher })).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('cancels a not-started refresh if the shared quota denies admission', async () => {
    const db = await fixture(); const fetcher = vi.fn();
    db.rpc.mockImplementation(async name => ({ data: name === 'zoho_begin_connection_refresh' ? { acquired: true } :
      name === 'zoho_reserve_source_quota' ? { granted: false, retryAfterSeconds: 120 } : { cancelled: true } }));
    await expect(getConnectionAccessToken(db, env, 'c', { fetcher })).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 120 });
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['zoho_begin_connection_refresh', 'zoho_reserve_source_quota', 'zoho_cancel_connection_refresh']);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
