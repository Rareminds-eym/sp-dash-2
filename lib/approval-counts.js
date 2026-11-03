const sources=['universities','recruiters','colleges','students','courses'];
/** Count-only queries; unavailable sources are never represented as zero. */
export async function approvalCounts(db) {
  return Object.fromEntries(await Promise.all(sources.map(async source=>{
    try{
      let query=db.from(source==='colleges'?'organizations':source).select('*',{count:'exact',head:true}).eq('approval_status','pending');
      if(source==='colleges')query=query.eq('organization_type','college').eq('is_active',true);
      if(source==='courses')query=query.is('deleted_at',null);
      const {count,error}=await query;
      if(error||!Number.isSafeInteger(count)||count<0)return [source,{status:'unavailable',count:null}];
      return [source,{status:'available',count}];
    }catch{return [source,{status:'unavailable',count:null}];}
  })));
}
