import { readZohoConfig, ZOHO_DEFAULTS } from './config';
import { createClient } from '@supabase/supabase-js';
import { skillpassportDbConfig } from '../skillpassport-db-config';

/** Independent application storage/privacy probe, with no candidate data or writes. */
export async function candidateProjectionCapabilities(env, database = createClient) {
  const unavailable = { version: 1, ready: false, emailPolicy: 'forbidden',
    verifiesPostconditions: false, privateProfiles: false };
  const config = skillpassportDbConfig(env);
  if (!readZohoConfig(env).projectionDelivery || !config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY)
    return unavailable;
  try {
    const db = database(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(ZOHO_DEFAULTS.dependencyTimeoutMs) }) },
    });
    const { data, error } = await db.rpc('zoho_candidate_projection_ready', {});
    if (error || data !== true) return unavailable;
    return { version: 1, ready: true, emailPolicy: 'forbidden', verifiesPostconditions: true, privateProfiles: true };
  } catch { return unavailable; }
}

/** Narrow read-only capability; never accepts SQL names, tables, credentials or actor overrides. */
export async function validateLiveOperation(env, grant, database = createClient) {
  const config = skillpassportDbConfig(env);
  if (!readZohoConfig(env).execution || !config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY ||
      !grant || typeof grant !== 'object' || Array.isArray(grant)) return { allowed: false };
  try {
    if (new TextEncoder().encode(JSON.stringify(grant)).byteLength > 131072) return { allowed: false };
    const db = database(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(ZOHO_DEFAULTS.dependencyTimeoutMs) }) },
    });
    const { data, error } = await db.rpc('zoho_is_live_approved_operation', { p_grant: grant });
    return { allowed: !error && data === true };
  } catch { return { allowed: false }; }
}

/** Repair of already committed work is independent of permission for new execution. */
export async function validateProjectionReceipt(env, proof, database = createClient) {
  const config=skillpassportDbConfig(env);
  if (!readZohoConfig(env).projectionDelivery||!config.SUPABASE_URL||!config.SUPABASE_SERVICE_ROLE_KEY||
    !proof||typeof proof!=='object'||Array.isArray(proof)||Object.keys(proof).length!==5) return {allowed:false};
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  if(!uuid(proof.operationId)||!uuid(proof.projectionReceiptId)||!hash(proof.sourceHash)||!hash(proof.projectionHash)||proof.emailPolicy!=='forbidden') return {allowed:false};
  try {
    const db=database(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{
      auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(ZOHO_DEFAULTS.dependencyTimeoutMs)})},
    });
    const {data,error}=await db.rpc('zoho_check_candidate_projection',{p_operation:proof.operationId,p_source_hash:proof.sourceHash,
      p_projection_hash:proof.projectionHash,p_receipt:proof.projectionReceiptId});
    return {allowed:!error&&data===true};
  } catch {return {allowed:false};}
}
