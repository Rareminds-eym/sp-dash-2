import { requireZohoAdmin } from '@/lib/zoho/admin';
import { approvalCounts } from '@/lib/approval-counts';
export async function GET(request) {
  const auth=await requireZohoAdmin(request,['super_admin','admin']);
  if(auth.error)return auth.error;
  const {supabaseAdmin}=await import('@/lib/supabase-admin');
  return Response.json({sources:await approvalCounts(supabaseAdmin)},{headers:{'Cache-Control':'no-store'}});
}
