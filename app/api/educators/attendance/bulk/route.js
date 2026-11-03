import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireEducatorAdmin } from '@/lib/educator-admin';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadUnmarkedSessions(actor) {
 const rows=[]; let after=null;
 while(true){
  const {data,error}=await supabaseAdmin.rpc('unmarked_educator_attendance_sessions',{p_actor:actor,p_after:after,p_limit:1000});
  if(error || !Array.isArray(data)) throw new Error('Could not load unmarked educator sessions.');
  rows.push(...data);
  if(data.length<1000) return rows;
  const next=data[data.length-1].session_id;
  if(!next||next===after)throw new Error('Could not paginate educator sessions.');
  after=next;
 }
}
function dateValue(value) {
 const text=String(value||'').trim();
 const match=/^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(text);
 return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}
function timeValue(value) {
 const text=String(value||'').trim();
 const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
 return match ? `${match[1].padStart(2,'0')}:${match[2]}:${match[3]||'00'}` : text;
}
function sessionKey(row) {
 return JSON.stringify([row.course,dateValue(row.date),timeValue(row.start_time),timeValue(row.end_time),row.educator_name,row.organization].map(value=>String(value||'').trim()));
}
export async function GET(request) {
 const auth=await requireEducatorAdmin(request); if(auth.error)return auth.error;
 try {
  const sessions=await loadUnmarkedSessions(auth.user.id);
  const rows=sessions.map(row=>({course:row.course,date:row.date,start_time:row.start_time,end_time:row.end_time,
   educator_name:row.educator_name,organization:row.organization,status:'',remarks:''}));
  return NextResponse.json({success:true,data:{rows}},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error.message},{status:503});}
}

export async function POST(request){
 const auth=await requireEducatorAdmin(request);if(auth.error)return auth.error;
 let rows;try{rows=(await request.json()).rows;}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400});}
 if(!Array.isArray(rows)||!rows.length||rows.length>500)return NextResponse.json({error:'Provide 1 to 500 rows per request.'},{status:400});
 let available;
 if(rows.some(row=>String(row?.status||'').trim() && !(row.sessionId||row.session_id))) {
  try { available=await loadUnmarkedSessions(auth.user.id); }
  catch(error){return NextResponse.json({error:error.message},{status:503});}
 }
 const results=[];const seen=new Set();let succeeded=0,skipped=0;
 for(let index=0;index<rows.length;index++){
  const row=rows[index]||{};
  const add=(message,skip=false)=>{if(skip)skipped++;results.push({index,row,ok:false,skipped:skip,message});};
  const status=String(row.status||'').trim().toLowerCase();
  if(!status){add('Blank status; left unmarked.',true);continue;}
  if(!['present','absent','late','excused'].includes(status)){add('Status must be present, absent, late or excused.');continue;}
  let sessionId=String(row.sessionId||row.session_id||'').trim();
  let staffId=String(row.staffId||row.staff_id||'').trim();
  let version=Number(row.version??row.session_version);
  if(!sessionId){
   if(['course','date','start_time','end_time','educator_name','organization'].some(field=>!String(row[field]||'').trim())){add('Course, date, times, educator and organization are required.');continue;}
   const matches=(available||[]).filter(candidate=>sessionKey(candidate)===sessionKey(row));
   if(matches.length===0){add('Class is already marked, changed or ineligible. Download a fresh template.',true);continue;}
   if(matches.length>1){add('Multiple classes match these details; mark this class individually from Manage teaching.');continue;}
   sessionId=matches[0].session_id;staffId=matches[0].staff_id;version=matches[0].session_version;
  }
  if(!UUID.test(sessionId)||!UUID.test(staffId)||!Number.isInteger(version)||version<1){add('Invalid session ID, staff ID or version; use a fresh downloaded template.');continue;}
  const key=`${sessionId}:${staffId}`;
  if(seen.has(key)){add('Duplicate session row; skipped.',true);continue;}seen.add(key);
  const reason=String(row.remarks??row.reason??'').trim();
  if(reason.length>1000){add('Remarks must be at most 1000 characters.');continue;}
  const {data,error}=await supabaseAdmin.rpc('import_unmarked_educator_attendance',{
   p_actor:auth.user.id,p_session:sessionId,p_staff:staffId,p_version:version,p_status:status,p_reason:reason||null,
  });
  if(error){add(error.code==='42501'?'Attendance access denied.':'Attendance could not be imported; refresh the template and retry.');continue;}
  if(data?.skipped){add(data.message,true);continue;}
  if(data?.skipped !== false){add('Could not confirm attendance was saved. Refresh and retry.');continue;}
  succeeded++;results.push({index,row,ok:true,message:`Marked ${status}.`});
 }
 return NextResponse.json({success:true,data:{total:rows.length,succeeded,skipped,failed:rows.length-succeeded-skipped,results}});
}
