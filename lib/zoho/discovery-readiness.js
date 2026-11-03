import { z } from 'zod';

const readiness = z.object({ version: z.literal(1), ready: z.literal(true),
  emailPolicy: z.literal('forbidden'), stagingOnly: z.literal(true) });

/** Ask the actual consumer; a producer binding alone cannot prove readiness. */
export async function discoveryStatus(binding, queue) {
  if (typeof binding?.fetch !== 'function' || typeof queue?.send !== 'function') return false;
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await binding.fetch(new Request('https://zoho-discovery.internal/readiness', { signal: AbortSignal.timeout(5000) }));
        return response.ok && readiness.safeParse(await response.json()).success;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Discovery unavailable')), 5000); }),
    ]);
  } catch { return false; }
  finally { clearTimeout(timer); }
}
