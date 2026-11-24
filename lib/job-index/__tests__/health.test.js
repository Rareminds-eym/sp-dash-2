import { expect, it, vi } from 'vitest';
import { processorHealth, readJobIndexHealth } from '../health';
import { JobIndexCoordinator, requestJobIndexStatus } from '../coordinator';

it('sanitizes errors and marks old processor heartbeats stale', () => {
  const now = Date.now(), lastAttemptAt = new Date(now).toISOString();
  expect(processorHealth({ state: 'blocked', errorCode: 'secret provider body', lastAttemptAt }).errorCode).toBe('JOB_INDEX_PROCESSOR_UNAVAILABLE');
  expect(processorHealth({ state: 'blocked', errorCode: 'JOB_INDEX_MODEL_MISMATCH', lastAttemptAt }).errorCode).toBe('JOB_INDEX_MODEL_MISMATCH');
  expect(processorHealth({ state: 'running', lastAttemptAt: new Date(now - 720001).toISOString() }, now).state).toBe('stale');
  expect(processorHealth(null).state).toBe('unknown');
});
it('persists a blocked cause and serves status after an object restart without scheduling work', async () => {
  const data = new Map(), setAlarm = vi.fn();
  const ctx = { storage: { get: async key => data.get(key), put: async (key, value) => data.set(key, value), setAlarm } };
  await new JobIndexCoordinator(ctx, {}).alarm();
  const status = await (await new JobIndexCoordinator(ctx, {}).fetch(new Request('https://internal/status'))).json();
  expect(status).toMatchObject({ state: 'blocked', errorCode: 'JOB_INDEX_PROVIDER_UNAVAILABLE', lastSuccessAt: null });
  expect(status.lastAttemptAt).toEqual(expect.any(String));
  expect(setAlarm).toHaveBeenCalledTimes(2);
});
it('private status routes to the same durable object without a wake', async () => {
  const fetch = vi.fn(async () => Response.json({ state: 'unknown' }));
  const env = { JOB_INDEX_COORDINATOR: { idFromName: vi.fn(name => name), get: vi.fn(() => ({ fetch })) } };
  expect((await requestJobIndexStatus(env)).state).toBe('unknown');
  expect(fetch).toHaveBeenCalledExactlyOnceWith('https://job-index.internal/status');
});
it('bounds unavailable health reads and disposes eventual RPC results', async () => {
  vi.useFakeTimers();
  try {
    let resolve;
    const dispose = vi.fn();
    const pending = readJobIndexHealth({ JOB_INDEX_SERVICE: { getIndexingStatus: () => new Promise(done => { resolve = done; }) } });
    await vi.advanceTimersByTimeAsync(3000);
    expect((await pending).state).toBe('stale');
    resolve({ state: 'unknown', [Symbol.dispose]: dispose });
    await vi.advanceTimersByTimeAsync(0);
    expect(dispose).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
