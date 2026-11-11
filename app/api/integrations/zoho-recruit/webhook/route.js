import { getCloudflareContext } from '@opennextjs/cloudflare';
import { acceptSyncWebhook } from '@/lib/zoho/sync-coordinator';
import { sourceProcessingEnabled } from '@/lib/zoho/config';

export async function POST(request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!sourceProcessingEnabled(env)) return Response.json({ error: 'Source processing unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    return await acceptSyncWebhook(request, supabaseAdmin);
  } catch {
    return Response.json({ error: 'Notification storage unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
