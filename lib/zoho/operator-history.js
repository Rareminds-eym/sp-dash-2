import { z } from 'zod';
const cursor=z.object({timestamp:z.string().datetime({offset:true}),id:z.string().uuid()}).strict();
export const operatorHistoryRequest=z.object({connectionId:z.string().uuid(),actorId:z.string().uuid(),
 kind:z.enum(['lifecycle','administration']),view:z.enum(['pending','history']),cursor:cursor.nullable().default(null)}).strict();
/** Read-only fixed-size pages. The actor is injected by the authenticated route. */
export async function operatorHistoryPage(db,input){
 const value=operatorHistoryRequest.parse(input);
 const result=await db.rpc('zoho_operator_history_page',{p_connection:value.connectionId,p_actor:value.actorId,p_kind:value.kind,p_view:value.view,
  p_after:value.cursor?.timestamp||null,p_after_id:value.cursor?.id||null});
 if(result.error)throw new Error('Operator history unavailable');
 const page=z.object({version:z.literal(1),kind:z.literal(value.kind),view:z.literal(value.view),items:z.array(z.record(z.unknown())).max(25),nextCursor:cursor.nullable()}).strict().parse(result.data);
 return page;
}
