import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireEducatorAdmin, PLATFORM_ORG_ID } from '@/lib/educator-admin';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().startsWith(value);}
export async function GET(request){
 const auth=await requireEducatorAdmin(request);if(auth.error)return auth.error;
 const params=new URL(request.url).searchParams;
 const staff=params.get('staffId')||'',status=params.get('status')||'',from=params.get('from')||'',to=params.get('to')||'';
 const page=Number(params.get('page')||1),limit=25;
 if(!Number.isInteger(page)||page<1||page>100000||(staff&&!UUID.test(staff))||(status&&!['present','absent','late','excused'].includes(status))||(from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to))return NextResponse.json({error:'Check the educator, status and date filters.'},{status:400});
 let query=supabaseAdmin.from('organization_staff_attendence').select(`id,date,status,remarks,marked_at,organization_staff_id,session_id,
 staff:organization_staff!inner(id,first_name,last_name,employee_id,organization_id),
 session:college_attendance_sessions(subject_name,start_time,end_time,organization_staff_id),
 organization:organizations(name)`,{count:'exact'}).eq('staff.organization_id',PLATFORM_ORG_ID);
 if(staff)query=query.eq('organization_staff_id',staff);
 if(status)query=query.eq('status',status);
 if(from)query=query.gte('date',from);
 if(to)query=query.lte('date',to);
 const {data,error,count}=await query.order('date',{ascending:false}).order('id',{ascending:false}).range((page-1)*limit,page*limit-1);
 if(error)return NextResponse.json({error:'Could not load educator attendance.'},{status:503});
 return NextResponse.json({success:true,data:{rows:data||[],total:count||0,page,pageSize:limit}},{headers:{'Cache-Control':'no-store'}});
}
