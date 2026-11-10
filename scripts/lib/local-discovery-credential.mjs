import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loopbackDatabase } from './local-dashboard.mjs';
const day = 86400;
export const needsLocalDiscoveryCredential = settings => Boolean(settings.ZOHO_DISCOVERY_DB_TOKEN ||
  settings.ZOHO_CLIENT_ID && settings.ZOHO_CLIENT_SECRET && (settings.ZOHO_TOKEN_ENCRYPTION_KEY || settings.ZOHO_TOKEN_ENCRYPTION_KEYS));
/** Local development issuer only; never ships a signing key into the app runtime. */
export async function localDiscoveryCredential(settings, {
  now = () => Date.now(),
  inspect = () => JSON.parse(execFileSync('docker', ['inspect', 'supabase_rest_skillpassport'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }))[0],
  fetcher = fetch,
} = {}) {
  const urls = ['SKILLPASSPORT_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_URL'].map(key => settings[key]).filter(Boolean);
  if (!urls.length || !urls.every(loopbackDatabase)) throw new Error('Reader credential renewal requires local database URLs.');
  const existing = settings.ZOHO_DISCOVERY_DB_TOKEN;
  const issued = Math.floor(now()/1000);
  try {
    const claims = JSON.parse(Buffer.from(existing.split('.')[1], 'base64url'));
    if (claims.role === 'zoho_discovery' && Number.isSafeInteger(claims.exp) && claims.exp > issued + day) {
      const response = await fetcher(new URL('/rest/v1/', urls[0]), {redirect:'manual',headers:{apikey:settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${existing}`},signal:AbortSignal.timeout(10000)});
      await response.body?.cancel();
      if (response.ok) return { token: existing, renewed: false, expiresAt: claims.exp * 1000 };
    }
  } catch { /* Missing or expired local reader credentials are renewed below. */ }
  let secret, kid;
  try {
    const config = inspect().Config.Env.find(value => value.startsWith('PGRST_JWT_SECRET=')).slice('PGRST_JWT_SECRET='.length);
    if (config.startsWith('{')) {
      const key = JSON.parse(config).keys?.find(key => key.kty === 'oct' && typeof key.k === 'string');
      if (!key) throw new Error('No local symmetric key');
      secret = Buffer.from(key.k,'base64url'); kid = key.kid;
    } else secret = config;
    if (!secret?.length) throw new Error('Missing local key');
  } catch { throw new Error('Local reader credential renewal failed. Start the SkillPassport Supabase containers and retry npm run dev.'); }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expires = issued + 7*day;
  const unsigned = encode({alg:'HS256',typ:'JWT',...(kid ? {kid} : {})})+'.'+encode({role:'zoho_discovery',iat:issued,exp:expires});
  const token = unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
  let response;
  try { response = await fetcher(new URL('/rest/v1/', urls[0]), {redirect:'manual',headers:{apikey:settings.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)}); }
  catch { throw new Error('Local reader credential verification could not reach Supabase.'); }
  await response.body?.cancel();
  if (!response.ok) throw new Error('Local reader credential verification failed. Check local database and anonymous-key settings.');
  return {token,renewed:true,expiresAt:expires*1000};
}


/** Renew ahead of expiry; the local supervisor reloads only its own runtimes. */
export function startLocalDiscoveryRenewal({expiresAt,renew,onRenewed,onError,now=()=>Date.now(),setIntervalFn=setInterval,clearIntervalFn=clearInterval}) {
  let expires=expiresAt,working=false,stopped=false;
  const timer=setIntervalFn(async()=>{
    if(stopped||working||expires-now()>day*1000)return;
    working=true;
    try {
      const next=await renew();
      if(!stopped){await onRenewed(next);expires=next.expiresAt;}
    } catch {if(!stopped)onError('Local discovery credential refresh failed; retrying in one hour.');}
    finally{working=false;}
  },3600000);
  timer.unref?.();
  return ()=>{stopped=true;clearIntervalFn(timer);};
}
