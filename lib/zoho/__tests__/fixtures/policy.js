/** Unit-test policy injection, not production environment parsing. */
const policies=new Map();
export function fixtureProfileName(module,env={}) {
  if(policies.has(env.ENVIRONMENT))return env.ENVIRONMENT;
  const policy=fixturePolicy(module.readZohoConfig,env);
  if(!Object.keys(env).some(key=>key.startsWith('ZOHO_')&&(key.endsWith('_ENABLED')||['ZOHO_ENVIRONMENT','ZOHO_PREVIEW'].includes(key))))return module.zohoProfileName(env);
  const name=`fixture-${policies.size}`;policies.set(name,policy);return name;
}
export function fixturePolicy(actual,env={}) {
  if(env.ENVIRONMENT==='blocked')return actual({ENVIRONMENT:'unknown'});
  if(policies.has(env.ENVIRONMENT))return policies.get(env.ENVIRONMENT);
  const names={background:'BACKGROUND',discovery:'DISCOVERY',execution:'EXECUTION',jobPublisher:'JOB_PUBLISHER',projectionDelivery:'PROJECTION_DELIVERY',privacyCleanup:'PRIVACY_CLEANUP',sourceOperations:'SOURCE_OPERATIONS'};
  const hasFixture=Object.keys(env).some(key=>key.startsWith('ZOHO_')&&(key.endsWith('_ENABLED')||['ZOHO_ENVIRONMENT','ZOHO_PREVIEW','ZOHO_REDIRECT_URI'].includes(key)));
  if(!hasFixture)return actual(env);
  const preview=env.ZOHO_PREVIEW!==undefined&&env.ZOHO_PREVIEW!=='false';
  return {...actual(env),preview,environment:['dev','qa','production'].includes(env.ZOHO_ENVIRONMENT)?env.ZOHO_ENVIRONMENT:null,
    redirectUri:env.ZOHO_REDIRECT_URI??actual(env).redirectUri,
    ...Object.fromEntries(Object.entries(names).map(([name,key])=>[name,!preview&&env['ZOHO_'+key+'_ENABLED']==='true']))};
}
