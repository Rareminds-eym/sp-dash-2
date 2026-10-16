import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/educator-admin',()=>({requireEducatorAdmin:m.auth,PLATFORM_ORG_ID:'platform'}));
vi.mock('@/lib/supabase-admin',()=>({supabaseAdmin:{from:m.from}}));
import {GET} from '../route';
let chain:any;
beforeEach(()=>{vi.resetAllMocks();chain={};for(const key of ['select','eq','gte','lte','order'])chain[key]=vi.fn(()=>chain);chain.range=vi.fn(async()=>({data:[{id:'attendance',status:'present'}],count:26,error:null}));m.from.mockReturnValue(chain);m.auth.mockResolvedValue({user:{id:'admin'}});});
it('scopes the recorded register to platform educators and paginates',async()=>{
 const response=await GET(new Request('http://localhost/api/educators/attendance?page=2&status=present&from=2026-10-01&to=2026-10-16'));
 expect(response.status).toBe(200);expect(m.from).toHaveBeenCalledWith('organization_staff_attendence');
 expect(chain.eq).toHaveBeenCalledWith('staff.organization_id','platform');expect(chain.eq).toHaveBeenCalledWith('status','present');
 expect(chain.gte).toHaveBeenCalledWith('date','2026-10-01');expect(chain.lte).toHaveBeenCalledWith('date','2026-10-16');expect(chain.range).toHaveBeenCalledWith(25,49);
 expect((await response.json()).data).toMatchObject({total:26,page:2,pageSize:25});
});
it('filters one educator by staff ID without filtering out previous trainer records',async()=>{
 const staff='10000000-0000-4000-8000-000000000001';await GET(new Request(`http://localhost?staffId=${staff}`));
 expect(chain.eq).toHaveBeenCalledWith('organization_staff_id',staff);expect(chain.eq).not.toHaveBeenCalledWith('session.organization_staff_id',staff);
});
it.each(['page=0','status=unknown','from=2026-02-30','from=2026-10-16&to=2026-10-01','staffId=bad'])('rejects invalid filters %s',async params=>{
 expect((await GET(new Request(`http://localhost?${params}`))).status).toBe(400);expect(m.from).not.toHaveBeenCalled();
});
it('blocks unauthenticated access',async()=>{m.auth.mockResolvedValue({error:new Response('denied',{status:403})});expect((await GET(new Request('http://localhost'))).status).toBe(403);expect(m.from).not.toHaveBeenCalled();});
it('reports database failures without exposing raw errors',async()=>{chain.range.mockResolvedValue({error:{message:'private database detail'}});const response=await GET(new Request('http://localhost'));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private');});
