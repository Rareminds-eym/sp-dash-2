/** Resolve the application database identically for API, queue and named authorities. */
export function skillpassportDbConfig(env) {
  return {
    SUPABASE_URL: env.SKILLPASSPORT_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SKILLPASSPORT_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
