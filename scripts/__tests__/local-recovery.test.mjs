import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLocalRecovery } from '../lib/local-recovery.mjs';

function fixture(fetchImpl, crons = ['*/2 * * * *']) {
  let current = Date.parse('2026-11-04T10:00:30Z'), id = 0;
  const timers = new Map(), errors = [], successes = [];
  const stop = startLocalRecovery({ crons, origin: 'http://127.0.0.1:8896', fetchImpl,
    now: () => current, schedule: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    cancel: key => timers.delete(key), onError: message => errors.push(message), onSuccess: cron => successes.push(cron) });
  const fire = () => {
    const [key, { fn, ms }] = timers.entries().next().value;
    timers.delete(key); current += ms; return fn();
  };
  return { timers, errors, successes, fire, stop };
}

test('automatically invokes existing local recovery on UTC cron boundaries and repeats', async () => {
  const requests = [];
  const f = fixture(async (url, options) => { requests.push({ url, options }); return new Response('ok'); });
  assert.equal([...f.timers.values()][0].ms, 90000);
  await f.fire();
  assert.equal(requests.length, 1);
  assert.deepEqual(f.successes, ['*/2 * * * *']);
  assert.equal(requests[0].url.pathname, '/cdn-cgi/local/scheduled');
  assert.equal(requests[0].url.searchParams.get('cron'), '*/2 * * * *');
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal([...f.timers.values()][0].ms, 120000);
  await f.fire();
  assert.equal(requests.length, 2);
  f.stop(); assert.equal(f.timers.size, 0);
});

test('failed recovery retries on the next boundary without logging response data', async () => {
  const f = fixture(async () => new Response('private diagnostic', { status: 503 }));
  await f.fire();
  assert.equal(f.errors.length, 1);
  assert.equal(f.successes.length, 0);
  assert.doesNotMatch(f.errors[0], /private diagnostic/);
  assert.equal(f.timers.size, 1);
  f.stop();
});

test('an in-flight tick cannot overlap another tick and is aborted on shutdown', async () => {
  let signal;
  const f = fixture(async (_url, options) => new Promise((_, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const pending = f.fire();
  assert.equal(f.timers.size, 1);
  assert.equal([...f.timers.values()][0].ms, 30000);
  f.stop(); await pending;
  assert.equal(signal.aborted, true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.errors.length, 0);
});

test('recovery rejects remote targets and unsupported schedules before starting timers', () => {
  assert.throws(() => startLocalRecovery({ crons: ['*/2 * * * *'], origin: 'https://example.test' }), /loopback/);
  assert.throws(() => startLocalRecovery({ crons: ['* * * * *'], origin: 'http://127.0.0.1:8896' }), /Unsupported/);
});
