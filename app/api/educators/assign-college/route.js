import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireEducatorAdmin } from '@/lib/educator-admin';
import { parseTeachingRequest,teachingFailure } from '../../../../../skillpassport/functions/lib/teaching-contract';
export async function POST(request){
 const auth=await requireEducatorAdmin(request);if(auth.error)return auth.error;
 try{
  const body=await request.json();
  const {data:staff,error:staffError}=await supabaseAdmin.from('organization_staff').select('id').eq('user_id',body.trainerId).eq('organization_id','00000000-0000-0000-0000-000000000001').single();
  if(staffError||!staff)return NextResponse.json({error:'Platform educator not found'},{status:404});
  const op=parseTeachingRequest({action:'map',payload:{staffId:staff.id,collegeId:body.collegeId,sectionId:body.sectionId,courseIds:body.assignedCourses,specializations:body.specializationId?[body.specializationId]:[],startDate:body.startDate,endDate:body.endDate||'',notes:body.notes||''}});
  const {data,error}=await supabaseAdmin.rpc('external_educator_action',{p_actor:auth.user.id,p_action:op.action,p_payload:op.payload});
  if(error){const f=teachingFailure(error);return NextResponse.json({error:f.message},{status:f.status});}
  return NextResponse.json({success:true,data},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'An exact college program/section, course and valid dates are required.'},{status:400});}
}
