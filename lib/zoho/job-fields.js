import { RecruitFailure } from './oauth';

// Schema names only. No source records, credentials or account data are cached.
const cache = new Map();
const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(value);
function companyMetadata(metadata) {
  const matches = Array.isArray(metadata?.fields) ? metadata.fields.filter(field =>
    typeof field?.field_label === 'string' &&
    ['clientname','clientsname'].includes(field.field_label.toLowerCase().replace(/[^a-z]/g,'')) &&
    ['lookup','text'].includes(field.data_type) && identifier(field.api_name)) : [];
  // Department_Name is a client lookup in some accounts, a department in others.
  if (matches.length !== 1) throw new RecruitFailure('SOURCE_INVALID');
  return matches[0];
}
export function jobCompanyField(metadata) { return companyMetadata(metadata).api_name; }
async function cached(scope, resolve) {
  const previous = cache.get(scope);
  if (previous?.expiresAt > Date.now()) return previous.value;
  const value = await resolve();
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(scope,{value,expiresAt:Date.now()+300000});
  return value;
}
export function resolveJobCompanyField(scope, readMetadata) {
  return cached(`company:${scope}`,async()=>jobCompanyField(await readMetadata()));
}
function titleField(metadata) {
  for (const name of ['Posting_Title','Job_Opening_Name']) if (metadata.fields.some(field=>field?.api_name===name)) return name;
  throw new RecruitFailure('SOURCE_INVALID');
}
export function resolveJobReadSchema(scope, readMetadata) {
  return cached(`read:${scope}`,async()=>{
    const metadata=await readMetadata('Job_Openings');
    return {companyField:jobCompanyField(metadata),titleField:titleField(metadata),
      optionalApplicationLink:metadata.fields.some(field=>field?.api_name==='Application_Link')};
  });
}
/** Bare bulk lookups contain IDs; dotted related fields contain display values. */
export function resolveBulkJobSchema(scope, readMetadata) {
  return cached(`bulk:${scope}`,async()=>{
    const metadata=await readMetadata('Job_Openings');
    const field=companyMetadata(metadata);
    let companyField=field.api_name;
    if(field.data_type==='lookup'){
      const module=typeof field.lookup?.module==='string'?field.lookup.module:field.lookup?.module?.api_name;
      if(!identifier(module))throw new RecruitFailure('SOURCE_INVALID');
      const related=companyMetadata(await readMetadata(module));
      if(related.data_type!=='text')throw new RecruitFailure('SOURCE_INVALID');
      companyField+=`.${related.api_name}`;
    }
    return {companyField,titleField:titleField(metadata),optionalApplicationLink:metadata.fields.some(field=>field?.api_name==='Application_Link')};
  });
}
export async function resolveBulkJobCompanyField(scope, readMetadata) {
  return (await resolveBulkJobSchema(scope,readMetadata)).companyField;
}
