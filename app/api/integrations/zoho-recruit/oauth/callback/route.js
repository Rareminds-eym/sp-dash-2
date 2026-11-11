import { requireZohoAdmin } from '@/lib/zoho/admin';
import { createZohoOAuth } from '@/lib/zoho/oauth';
import { z } from 'zod';
import { refreshAction } from '@/app/actions/auth';

function redirect(target) { return new Response(null,{status:303,headers:{Location:target.toString(),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}}); }

export async function GET(request) {
  let auth = await requireZohoAdmin(request);
  let unavailable = auth.error && auth.error.status !== 401 && auth.error.status !== 403;
  const target = new URL('/integrations/zoho-recruit', request.url);
  if (auth.error?.status === 401) {
    // Refresh in this callback: generic return-to helpers deliberately reject /api.
    // Never carry an authorization code into login/refresh URLs or consume state before auth.
    const refreshed = await refreshAction();
    if (refreshed.success) {
      auth = await requireZohoAdmin(request);
      unavailable = auth.error && auth.error.status !== 401 && auth.error.status !== 403;
    } else unavailable = refreshed.status !== 401;
  }
  if (auth.error) {
    target.searchParams.set('connection', 'failed');
    target.searchParams.set('reason', unavailable ? 'authority_unavailable' : auth.error.status === 403 ? 'administrator_required' : 'session_expired');
    return redirect(target);
  }
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const input = z.object({ state: z.string().min(60).max(100), code: z.string().min(1).max(2048).optional(),
      error: z.string().min(1).max(200).optional() }).refine(value => Boolean(value.code || value.error))
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const oauth = createZohoOAuth(supabaseAdmin, { ...process.env, ...auth.env });
    const rememberSource = source => target.searchParams.set('source', source);
    if (input.error) {
      await oauth.cancel(input.state, auth.user.id, rememberSource);
      target.searchParams.set('connection', 'failed');
      if (input.error === 'access_denied') target.searchParams.set('reason', 'consent_denied');
    } else {
      const connectionId = await oauth.complete(input.state, input.code, auth.user.id, rememberSource);
      target.searchParams.set('source', connectionId);
      target.searchParams.set('connection', 'verified');
    }
  } catch (error) {
    // No authorization codes, tokens, candidate data or provider errors in logs/redirects.
    target.searchParams.set('connection', 'failed');
    if (error?.code === 'ORGANIZATION_MISMATCH') target.searchParams.set('reason', 'organization_mismatch');
  }
  return redirect(target);
}
