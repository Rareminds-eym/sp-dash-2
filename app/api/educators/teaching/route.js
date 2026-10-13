import { NextResponse } from 'next/server';
import { requireEducatorAdmin } from '@/lib/educator-admin';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseTeachingRequest, PLATFORM_TEACHING_ADMIN_ACTIONS, teachingFailure } from '../../../../../skillpassport/functions/lib/teaching-contract';

export async function GET(request) {
  const auth=await requireEducatorAdmin(request); if(auth.error)return auth.error;
  const {data,error}=await supabaseAdmin.rpc('external_educator_action',{p_actor:auth.user.id,p_action:'admin_overview',p_payload:{}});
  if(error){const failure=teachingFailure(error);return NextResponse.json({error:failure.message},{status:failure.status});}
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request) {
  const auth=await requireEducatorAdmin(request); if(auth.error)return auth.error;
  let operation;try{operation=parseTeachingRequest(await request.json());}catch{return NextResponse.json({error:'Invalid teaching request'},{status:400});}
  if(!PLATFORM_TEACHING_ADMIN_ACTIONS.has(operation.action))return NextResponse.json({error:'Unsupported administrator operation'},{status:403});
  const {data,error}=await supabaseAdmin.rpc('external_educator_action',{p_actor:auth.user.id,p_action:operation.action,p_payload:operation.payload});
  if(error){const failure=teachingFailure(error);return NextResponse.json({error:failure.message},{status:failure.status});}
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'no-store'}});
}
