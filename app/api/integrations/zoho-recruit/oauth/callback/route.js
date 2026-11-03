import { requireZohoAdmin } from '@/lib/zoho/admin';
import { createZohoOAuth } from '@/lib/zoho/oauth';
import { z } from 'zod';

export async function GET(request) {
  const auth = await requireZohoAdmin(request);
  if (auth.error) return auth.error;
  const target = new URL('/integrations/zoho-recruit', request.url);
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const input = z.object({ state: z.string().min(60).max(100), code: z.string().min(1).max(2048) }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const connectionId=await createZohoOAuth(supabaseAdmin, { ...process.env, ...auth.env }).complete(input.state, input.code, auth.user.id);
    target.searchParams.set('source',connectionId);
    target.searchParams.set('connection', 'verified');
  } catch (error) {
    // No authorization codes, tokens, candidate data or provider errors in logs/redirects.
    target.searchParams.set('connection', 'failed');
    if (error?.code === 'ORGANIZATION_MISMATCH') target.searchParams.set('reason', 'organization_mismatch');
  }
  return Response.redirect(target, 303);
}
