import { ZOHO_DEFAULTS } from './config';
import { z } from 'zod';
const capability = z.object({
  version: z.literal(1), ready: z.literal(true), emailPolicy: z.literal('forbidden'),
  approvalRequired: z.literal(true), modules: z.array(z.enum(['Candidates', 'Job_Openings'])).min(1),
  durableDispatch: z.literal(true), receiptRecovery: z.literal(true),
});
/** No optimistic readiness: absent or non-attesting executors cannot enable approvals. */
export async function executorStatus(binding, queue) {
  if (typeof binding?.fetch !== 'function' || typeof queue?.sendBatch !== 'function') return { ready: false, modules: [] };
  let timer;
  try {
    const result = await Promise.race([
      (async () => {
        const response = await binding.fetch(new Request('https://zoho-approved.internal/readiness', { signal: AbortSignal.timeout(ZOHO_DEFAULTS.requestTimeoutMs) }));
        if (!response.ok) throw new Error('Executor unavailable');
        return response.json();
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Executor unavailable')), ZOHO_DEFAULTS.requestTimeoutMs); }),
    ]);
    const parsed = capability.safeParse(result);
    return parsed.success ? parsed.data : { ready: false, modules: [] };
  } catch { return { ready: false, modules: [] }; }
  finally { clearTimeout(timer); }
}
