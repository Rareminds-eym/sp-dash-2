// Only stable codes cross the private service boundary; never expose DB/provider bodies.
const codes = new Set([
  'JOB_INDEX_DISPATCH_UNCONFIGURED', 'JOB_INDEX_DISPATCH_UNAVAILABLE',
  'JOB_INDEX_MODEL_UNCONFIGURED', 'JOB_INDEX_MODEL_MISMATCH',
  'JOB_INDEX_PROVIDER_UNAVAILABLE', 'JOB_INDEX_PROVIDER_INCOMPATIBLE',
  'JOB_INDEX_DB_UNCONFIGURED', 'JOB_INDEX_DB_UNAVAILABLE',
  'JOB_INDEX_CLAIM_INVALID', 'JOB_INDEX_STATUS_INVALID',
]);
export const processorErrorCode = error => codes.has(error?.message) ? error.message : 'JOB_INDEX_PROCESSOR_UNAVAILABLE';
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
export function processorHealth(value, now = Date.now()) {
  const lastAttemptAt = timestamp(value?.lastAttemptAt), lastSuccessAt = timestamp(value?.lastSuccessAt);
  let state = ['running', 'idle', 'blocked'].includes(value?.state) ? value.state : 'unknown';
  if (lastAttemptAt && now - Date.parse(lastAttemptAt) > 720000) state = 'stale';
  return { state, errorCode: state === 'blocked' ? processorErrorCode({ message: value?.errorCode }) : null,
    lastAttemptAt, lastSuccessAt };
}
export async function readJobIndexHealth(env) {
  if (typeof env.JOB_INDEX_SERVICE?.getIndexingStatus !== 'function') return processorHealth(null);
  let timeout;
  try {
    return await Promise.race([
      (async () => {
        let value;
        try { value = await env.JOB_INDEX_SERVICE.getIndexingStatus(); return processorHealth(value); }
        finally { value?.[Symbol.dispose]?.(); }
      })(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Status unavailable')), 3000); }),
    ]);
  } catch { return { ...processorHealth(null), state: 'stale' }; }
  finally { clearTimeout(timeout); }
}
