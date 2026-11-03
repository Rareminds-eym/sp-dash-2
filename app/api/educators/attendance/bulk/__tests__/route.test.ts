import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),auth:vi.fn()}));
vi.mock('@/lib/supabase-admin',()=>({supabaseAdmin:{rpc:m.rpc}}));
vi.mock('@/lib/educator-admin',()=>({requireEducatorAdmin:m.auth}));
import {GET,POST} from '../route';
const sid='10000000-0000-4000-8000-000000000001',staff='20000000-0000-4000-8000-000000000001';
const row={session_id:sid,staff_id:staff,session_version:2,status:'present'};
const request=(rows:any)=>new Request('http://localhost/api/educators/attendance/bulk',{method:'POST',body:JSON.stringify({rows})});
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({user:{id:'admin'}});});
it('downloads every page with blank status retained',async()=>{
 const page=Array.from({length:1000},(_,i)=>({session_id:String(i),status:'',reason:''}));
 m.rpc.mockResolvedValueOnce({data:page}).mockResolvedValueOnce({data:[{session_id:'last',status:''}]});
 const res=await GET(new Request('http://localhost'));const body=await res.json();
 expect(body.data.rows).toHaveLength(1001);expect(body.data.rows[0].status).toBe('');
 expect(m.rpc).toHaveBeenLastCalledWith('unmarked_educator_attendance_sessions',{p_actor:'admin',p_after:'999',p_limit:1000});
});
it('skips blanks, imports filled rows, and never writes duplicates',async()=>{
 m.rpc.mockResolvedValue({data:{skipped:false}});
 const res=await POST(request([{...row,status:''},row,row]));const body=await res.json();
 expect(body.data).toMatchObject({succeeded:1,skipped:2,failed:0});expect(m.rpc).toHaveBeenCalledTimes(1);
 expect(m.rpc).toHaveBeenCalledWith('import_unmarked_educator_attendance',{p_actor:'admin',p_session:sid,p_staff:staff,p_version:2,p_status:'present',p_reason:null});
});
it('reports already marked rows without overwriting',async()=>{
 m.rpc.mockResolvedValue({data:{skipped:true,message:'Existing mark preserved'}});
 const body=await (await POST(request([row]))).json();expect(body.data).toMatchObject({skipped:1,succeeded:0,failed:0});
});
it('rejects unsupported statuses and malformed session references',async()=>{
 const body=await (await POST(request([{...row,status:'invalid'},{...row,session_id:'bad'}]))).json();
 expect(body.data.failed).toBe(2);expect(m.rpc).not.toHaveBeenCalled();
});
it('requires admin authentication for download and import',async()=>{
 m.auth.mockResolvedValue({error:new Response('denied',{status:403})});
 expect((await GET(new Request('http://localhost'))).status).toBe(403);
 expect((await POST(request([row]))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});

it('exports only the eight human-readable template columns',async()=>{
 m.rpc.mockResolvedValue({data:[{session_id:sid,staff_id:staff,session_version:2,employee_id:'FAC1',course:'Python',date:'2026-10-14',start_time:'09:00:00',end_time:'10:00:00',educator_name:'Hari',organization:'College'}]});
 const body=await (await GET(new Request('http://localhost'))).json();
 expect(Object.keys(body.data.rows[0])).toEqual(['course','date','start_time','end_time','educator_name','organization','status','remarks']);
 expect(body.data.rows[0]).not.toHaveProperty('session_id');
});
it.each(['late','excused'])('resolves human-readable rows and accepts %s with optional remarks',async status=>{
 const details={course:'Python',date:'2026-10-14',start_time:'09:00:00',end_time:'10:00:00',educator_name:'Hari',organization:'College'};
 m.rpc.mockResolvedValueOnce({data:[{...details,session_id:sid,staff_id:staff,session_version:2}]}).mockResolvedValueOnce({data:{skipped:false}});
 const body=await (await POST(request([{...details,date:'14-10-2026',start_time:'9:00',status}]))).json();
 expect(body.data.succeeded).toBe(1);
 expect(m.rpc).toHaveBeenLastCalledWith('import_unmarked_educator_attendance',expect.objectContaining({p_session:sid,p_staff:staff,p_status:status,p_reason:null}));
});
it('rejects ambiguous class names rather than choosing a session',async()=>{
 const details={course:'Python',date:'2026-10-14',start_time:'09:00',end_time:'10:00',educator_name:'Hari',organization:'College'};
 m.rpc.mockResolvedValue({data:[details,details]});
 const body=await (await POST(request([{...details,status:'present'}]))).json();
 expect(body.data.failed).toBe(1);expect(m.rpc).toHaveBeenCalledTimes(1);
});
it('skips a human-readable row marked since template download',async()=>{
 m.rpc.mockResolvedValue({data:[]});
 const body=await (await POST(request([{course:'Python',date:'2026-10-14',start_time:'09:00',end_time:'10:00',educator_name:'Hari',organization:'College',status:'absent'}]))).json();
 expect(body.data).toMatchObject({skipped:1,succeeded:0});expect(m.rpc).toHaveBeenCalledTimes(1);
});
