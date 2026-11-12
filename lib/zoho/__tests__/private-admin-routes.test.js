import { beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({auth:vi.fn(),from:vi.fn(),audit:vi.fn(),writes:[]}));
vi.mock('../../platform-admin',()=>({requirePlatformAdmin:f.auth}));
vi.mock('../../supabase-admin',()=>({supabaseAdmin:{from:f.from}}));
vi.mock('../../services/auditService',()=>({logAudit:f.audit}));
import {POST as activate} from '../../../app/api/users/activate/route';
import {POST as suspend} from '../../../app/api/users/suspend/route';
import {DELETE as remove} from '../../../app/api/users/[id]/route';
import {PUT as profile} from '../../../app/api/users/profile/route';
const actor='10000000-0000-4000-8000-000000000001';
const target='10000000-0000-4000-8000-000000000002';
beforeEach(()=>{
 vi.clearAllMocks();f.writes.length=0;f.auth.mockResolvedValue({user:{id:actor}});
 f.from.mockImplementation(table=>{
  const q={select:()=>q,eq:()=>q,single:async()=>({data:{id:target,organizationId:null}}),
   update:value=>{f.writes.push({table,value});return q;},insert:value=>{f.writes.push({table,value});return q;},
   then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};
  return q;
 });
});
const cases=[['activate',activate,'POST'],['suspend',suspend,'POST'],['delete',remove,'DELETE'],['profile',profile,'PUT']];
const request=method=>new Request('https://admin.example/api/users',{method,headers:{origin:'https://admin.example','Content-Type':'application/json'},
 body:JSON.stringify({targetUserId:target,userId:target,actorId:'forged-actor',email:'target@example.com',firstName:'Updated'})});
describe('private identity admin routes',()=>{
 it.each(cases)('%s checks live platform authority before reading or writing identity data',async(_name,handler,method)=>{
  f.auth.mockResolvedValue({error:Response.json({error:'Forbidden'},{status:403})});
  const response=await handler(request(method),{params:Promise.resolve({id:target})});
  expect(response.status).toBe(403);expect(f.from).not.toHaveBeenCalled();expect(f.audit).not.toHaveBeenCalled();
 });
 it.each(cases)('%s uses the private server client and verified actor after authorization',async(name,handler,method)=>{
  const req=request(method);const response=await handler(req,{params:Promise.resolve({id:target})});
  expect(response.status).toBe(200);
  expect(f.auth).toHaveBeenCalledWith(req,['super_admin','admin']);
  expect(f.writes.some(write=>write.table==='users')).toBe(true);
  expect(f.audit.mock.calls[0][0]).toBe(actor);
  if(name!=='profile')expect(f.writes.find(write=>write.table==='verifications').value.performedBy).toBe(actor);
 });
});
