import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { skillpassportDbConfig } from '../skillpassport-db-config';
import { forwardSubscriptionRequest } from '../subscriptions/skillpassport-client';
import { publishedCatalogSchema } from '../subscriptions/workspace';
import { eligiblePlans, type PromoPlan } from './model';

export function promoDatabase(env: Record<string, unknown>) {
  const config = skillpassportDbConfig(env);
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Application database is unavailable');
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
}
export async function publishedPromoPlans(request: Request): Promise<PromoPlan[]> {
  const plans: PromoPlan[] = [], seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const url = new URL('/api/admin/subscriptions/published', request.url);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await forwardSubscriptionRequest(new Request(url, { headers: request.headers }), 'published');
    if (!response.ok) throw new Error('Published plans are unavailable');
    const result = publishedCatalogSchema.parse(await response.json());
    plans.push(...eligiblePlans(result.plans));
    if (!result.nextCursor) return plans;
    if (seen.has(result.nextCursor)) throw new Error('Invalid catalog pagination');
    seen.add(result.nextCursor); cursor = result.nextCursor;
  }
  throw new Error('Catalog exceeds page budget');
}
export const promoHeaders = { 'Cache-Control': 'private, no-store' };
export const promoResponse = (body: unknown, status = 200) => Response.json(body, { status, headers: promoHeaders });
export async function smallJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Use JSON');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  let size = 0, body = '';
  const decoder = new TextDecoder();
  try { for (;;) { const { done, value } = await reader.read(); if (done) break;
    size += value.length; if (size > 8192) { await reader.cancel(); throw new Error('Body too large'); }
    body += decoder.decode(value, { stream: true });
  } } finally { reader.releaseLock(); }
  return JSON.parse(body + decoder.decode());
}
