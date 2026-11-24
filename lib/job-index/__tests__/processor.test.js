import { expect, it, vi } from 'vitest';
import { processJobIndex } from '../processor';
import { JobIndexCoordinator } from '../coordinator';
const model = 'fixture-model';
const metadata = { model, dimensions: 1536, task_types: ['RETRIEVAL_DOCUMENT'] };
const contract = { readIndexModel: async () => model, readCapabilities: async () => metadata };
const vector = Array(1536).fill(0.1);
const claims = Array.from({ length: 8 }, (_, i) => ({ id: String(i), input_text: `job ${i}`, input_hash: 'hash', lease_token: 'lease' }));
it('app owns queue work and publishes a bounded, model-verified RPC batch', async () => {
  let inFlight = 0, max = 0;
  const results = [];
  const rpc = vi.fn(async (name, args) => {
    if (name === 'claim_job_index') return claims;
    if (name === 'finish_job_index_batch') { results.push(...args.p_results); return 5; }
    return { managed: true, next_attempt_at: null };
  });
  const embed = vi.fn(async text => {
    inFlight++; max = Math.max(max, inFlight); await new Promise(resolve => setTimeout(resolve, 2)); inFlight--;
    if (text === 'job 1') throw new Error('RATE_LIMIT_EXCEEDED: Retry after 120s.');
    return { model: text === 'job 3' ? 'wrong' : model, embedding: text === 'job 2' ? [1] : vector };
  });
  await processJobIndex({}, { ...contract, rpc, embed, sleep: async () => {} });
  expect(max).toBe(2); expect(results).toHaveLength(8);
  expect(results.find(r => r.id === '1')).toMatchObject({ error: 'RATE_LIMITED', retry_after_seconds: 120 });
  expect(results.find(r => r.id === '2').error).toBe('INVALID_VECTOR');
  expect(results.find(r => r.id === '3').error).toBe('MODEL_MISMATCH');
  expect(rpc.mock.calls.filter(c => c[0] === 'finish_job_index_batch')).toHaveLength(1);
  expect(rpc.mock.calls.at(-1)[0]).toBe('job_index_dispatch_status');
});
it('sends only text and task type to the provider and disposes the RPC result', async () => {
  const dispose = vi.fn();
  const capabilityDispose = vi.fn();
  const getCapabilities = vi.fn(async () => ({ ...metadata, [Symbol.dispose]: capabilityDispose }));
  const embedText = vi.fn(async () => ({ model, embedding: vector, [Symbol.dispose]: dispose }));
  const rpc = vi.fn(async name => name === 'claim_job_index' ? [claims[0]] : { managed: true, next_attempt_at: null });
  await processJobIndex({ EMBEDDING_SERVICE: { embedText, getCapabilities } }, { readIndexModel: contract.readIndexModel, rpc, sleep: async () => {} });
  expect(embedText).toHaveBeenCalledExactlyOnceWith('job 0', 'RETRIEVAL_DOCUMENT');
  expect(dispose).toHaveBeenCalledOnce();
  expect(getCapabilities).toHaveBeenCalledExactlyOnceWith();
  expect(capabilityDispose).toHaveBeenCalledOnce();
});
it('does not consume claims when the provider binding is missing', async () => {
  const rpc = vi.fn();
  await expect(processJobIndex({}, { ...contract, rpc })).rejects.toThrow('JOB_INDEX_PROVIDER_UNAVAILABLE');
  expect(rpc).not.toHaveBeenCalled();
});
it.each([undefined, '', '  ', ' fixture-model '])('does not claim with an invalid stored model: %s', async storedModel => {
  const rpc = vi.fn(), embed = vi.fn(), readCapabilities = vi.fn();
  await expect(processJobIndex({}, { ...contract, rpc, embed, readCapabilities,
    readIndexModel: async () => storedModel })).rejects.toThrow('JOB_INDEX_MODEL_UNCONFIGURED');
  expect(rpc).not.toHaveBeenCalled(); expect(embed).not.toHaveBeenCalled();
  expect(readCapabilities).not.toHaveBeenCalled();
});
it.each([
  [{ ...metadata, model: 'new-model' }, 'JOB_INDEX_MODEL_MISMATCH'],
  [{ ...metadata, dimensions: 768 }, 'JOB_INDEX_PROVIDER_INCOMPATIBLE'],
  [{ ...metadata, task_types: ['RETRIEVAL_QUERY'] }, 'JOB_INDEX_PROVIDER_INCOMPATIBLE'],
  [{ ...metadata, task_types: 'RETRIEVAL_DOCUMENT' }, 'JOB_INDEX_PROVIDER_INCOMPATIBLE'],
  [null, 'JOB_INDEX_MODEL_MISMATCH'],
])('rejects incompatible provider metadata before any queue mutation', async (capabilities, error) => {
  const rpc = vi.fn(), embed = vi.fn();
  await expect(processJobIndex({ JOB_INDEX_MODEL: 'ignored-legacy-setting' }, { ...contract, rpc, embed,
    readCapabilities: async () => capabilities })).rejects.toThrow(error);
  expect(rpc).not.toHaveBeenCalled(); expect(embed).not.toHaveBeenCalled();
});
it('DB failure cannot be presented as a completed indexing batch', async () => {
  const rpc = vi.fn(), embed = vi.fn();
  await expect(processJobIndex({}, { ...contract, rpc, embed,
    readIndexModel: async () => { throw new Error('offline'); } })).rejects.toThrow('offline');
  expect(rpc).not.toHaveBeenCalled(); expect(embed).not.toHaveBeenCalled();
});
it('missing capability method or failed metadata lookup never claims work', async () => {
  const rpc = vi.fn(), embedText = vi.fn();
  await expect(processJobIndex({ EMBEDDING_SERVICE: { embedText } }, {
    readIndexModel: contract.readIndexModel, rpc })).rejects.toThrow('JOB_INDEX_PROVIDER_UNAVAILABLE');
  await expect(processJobIndex({}, { ...contract, rpc, embed: vi.fn(),
    readCapabilities: async () => { throw new Error('provider offline'); } })).rejects.toThrow('provider offline');
  expect(rpc).not.toHaveBeenCalled(); expect(embedText).not.toHaveBeenCalled();
});
it('the application alarm preserves recovery and coalesces overlapping work', async () => {
  let alarm = null;
  const setAlarm = vi.fn(async value => { alarm = value; });
  const coordinator = new JobIndexCoordinator({ storage: { get: async () => null, put: async () => {}, getAlarm: async () => alarm, setAlarm } }, {});
  for (let i = 0; i < 20; i++) await coordinator.fetch();
  expect(setAlarm).toHaveBeenCalledTimes(1);
  await Promise.all([coordinator.alarm(), coordinator.alarm()]);
  expect(setAlarm).toHaveBeenCalledTimes(3);
  expect(alarm).toBeGreaterThan(Date.now() + 59000);
});

it('uses the app database stored model without an environment model override', async () => {
  const requests = [];
  const fetchMock = vi.fn(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push({ url, init });
    if (url.pathname.endsWith('/job_index_control')) return new Response(JSON.stringify({ model }), {
      headers: { 'Content-Type': 'application/json' },
    });
    if (url.pathname.endsWith('/claim_job_index')) return new Response('[]');
    return new Response(JSON.stringify({ managed: true, next_attempt_at: null }));
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const embedText = vi.fn(), getCapabilities = vi.fn(async () => metadata);
    await processJobIndex({
      SKILLPASSPORT_SUPABASE_URL: 'https://app-db.example.test', SKILLPASSPORT_SERVICE_ROLE_KEY: 'fixture-key',
      EMBEDDING_SERVICE: { getCapabilities, embedText },
    });
    expect(requests[0].url.pathname).toBe('/rest/v1/job_index_control');
    expect(requests[0].url.searchParams.get('select')).toBe('model');
    expect(requests[0].url.searchParams.get('singleton')).toBe('eq.true');
    for (const request of requests.slice(1)) expect(JSON.parse(request.init.body).p_model).toBe(model);
    expect(embedText).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
it('a failed stored-model read cannot claim jobs', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'unavailable' }), { status: 403 })));
  const rpc = vi.fn(), getCapabilities = vi.fn();
  try {
    await expect(processJobIndex({
      SKILLPASSPORT_SUPABASE_URL: 'https://app-db.example.test', SKILLPASSPORT_SERVICE_ROLE_KEY: 'fixture-key',
      EMBEDDING_SERVICE: { getCapabilities, embedText: vi.fn() },
    }, { rpc })).rejects.toThrow('JOB_INDEX_DB_UNAVAILABLE');
    expect(rpc).not.toHaveBeenCalled(); expect(getCapabilities).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
