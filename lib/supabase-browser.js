'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Supabase Browser Client — DATA OPERATIONS ONLY
// ============================================================================
// This client connects to the SkillPassport database for application data
// (courses, storage, passports, etc.). It uses the anon key with RLS.
//
// ⚠️  DO NOT use this client for authentication. All auth flows MUST go 
//     through Server Actions in app/actions/auth.js via SSO Worker RPC.
// ============================================================================

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        // Disable all auth features — auth is handled by SSO Worker
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
