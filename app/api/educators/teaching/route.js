import { NextResponse } from 'next/server';
import { requireEducatorAdmin } from '@/lib/educator-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseTeachingRequest, PLATFORM_TEACHING_ADMIN_ACTIONS, teachingFailure, teachingRpcName } from '@/lib/teaching-contract';

export async function GET(request) {
  const auth=await requireEducatorAdmin(request); if(auth.error)return auth.error;
  const {data,error}=await supabaseAdmin.rpc('external_educator_action',{p_actor:auth.user.id,p_action:'admin_overview',p_payload:{}});
  if(error){const failure=teachingFailure(error);return NextResponse.json({error:failure.message},{status:failure.status});}
  // Attach time slots per mapping so edit mode can prefill them.
  try {
    const ids = [...new Set((data?.mappings || []).map(m => m.id).filter(Boolean))];
    if (ids.length > 0) {
      const { data: slots } = await supabaseAdmin
        .from('assignment_time_slots')
        .select('assignment_id, start_time, end_time')
        .in('assignment_id', ids)
        .order('start_time', { ascending: true });
      const byId = Object.fromEntries(ids.map(mid => [mid, []]));
      for (const s of slots || []) {
        if (s.assignment_id && byId[s.assignment_id]) byId[s.assignment_id].push(s);
      }
      data.mappings = (data.mappings || []).map(m => ({ ...m, time_slots: byId[m.id] || [] }));
    }
  } catch (e) {
    console.error('⚠️ [TEACHING API] time slot enrichment failed:', e?.message);
  }
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request) {
  const auth=await requireEducatorAdmin(request); if(auth.error)return auth.error;
  let operation;try{operation=parseTeachingRequest(await request.json());}catch{return NextResponse.json({error:'Invalid teaching request'},{status:400});}
  if(!PLATFORM_TEACHING_ADMIN_ACTIONS.has(operation.action))return NextResponse.json({error:'Unsupported administrator operation'},{status:403});
  const {data,error}=await supabaseAdmin.rpc(teachingRpcName(operation.action),{p_actor:auth.user.id,p_action:operation.action,p_payload:operation.payload});
  if(error){const failure=teachingFailure(error);return NextResponse.json({error:failure.message},{status:failure.status});}
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'no-store'}});
}
