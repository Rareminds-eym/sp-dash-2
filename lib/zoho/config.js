/** Server runtime policy. Secrets and platform bindings are deliberately excluded. */
export const ZOHO_DEFAULTS = Object.freeze({
  recoveryCron: '*/2 * * * *', requestTimeoutMs: 15000,
  dependencyTimeoutMs: 5000, retryDelaySeconds: 300, sourceStepDelaySeconds: 10,
  maxProviderResponseBytes: 1048576, maxJobPageResponseBytes: 3 * 1048576,
  maxStagingCommitBytes: 8 * 1048576,
});
export const ZOHO_FLAG_NAMES = Object.freeze({
  background: 'ZOHO_BACKGROUND_ENABLED', discovery: 'ZOHO_DISCOVERY_ENABLED',
  execution: 'ZOHO_EXECUTION_ENABLED', jobPublisher: 'ZOHO_JOB_PUBLISHER_ENABLED',
  projectionDelivery: 'ZOHO_PROJECTION_DELIVERY_ENABLED', privacyCleanup: 'ZOHO_PRIVACY_CLEANUP_ENABLED',
  sourceOperations: 'ZOHO_SOURCE_OPERATIONS_ENABLED',
});
const disabled = Object.freeze(Object.fromEntries(Object.keys(ZOHO_FLAG_NAMES).map(name=>[name,false])));
const profile = (environment, redirectUri, flags=disabled, preview=false) => Object.freeze({
  emailPolicy:'forbidden',requiresApproval:true,environment,redirectUri,preview,...flags,
});
/** Edit these code profiles to change nonsecret Zoho behavior. Deployment defaults stay off. */
export const ZOHO_PROFILES = Object.freeze({
  production:profile('production',null),
  dev:profile('dev',null),
  qa:profile('qa',null),
  preview:profile(null,null,disabled,true),
  'local-review':profile('dev','http://localhost:3010/api/integrations/zoho-recruit/oauth/callback'),
  local:profile('dev','http://localhost:3010/api/integrations/zoho-recruit/oauth/callback',Object.freeze(
    {...disabled,background:true,discovery:true,execution:true,jobPublisher:true,projectionDelivery:true,privacyCleanup:true,sourceOperations:true})),
  blocked:profile(null,null),
});
export function zohoProfileName(env={}) {
  const name=env.ENVIRONMENT;
  if(name==='preview')return 'preview';
  const urls=[env.SKILLPASSPORT_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_URL].filter(Boolean);
  const local=urls.length>0&&urls.every(value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash;}catch{return false;}});
  if(name==='local-review')return local?'local-review':'blocked';
  if(name==='local')return urls.length===0||local?'local':'blocked';
  if(local&&(name===undefined||name==='development'||name==='dev'))return 'local';
  return name==='development'||name==='dev'?'dev':name==='qa'?'qa':name==='production'?'production':'blocked';
}
/** Nonsecret values come exclusively from code. Legacy ZOHO_* vars cannot override profiles. */
export function readZohoConfig(env = {}) {
  return ZOHO_PROFILES[zohoProfileName(env)];
}

/** Shared gate for operator controls and the existing source-operation consumer. */
export function sourceProcessingEnabled(env = {}) {
  const config=readZohoConfig(env);
  return config.background && config.discovery && config.sourceOperations &&
    typeof env.ZOHO_DISCOVERY_QUEUE?.send === 'function';
}
