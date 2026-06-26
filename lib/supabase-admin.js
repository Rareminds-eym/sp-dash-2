import { createClient } from '@supabase/supabase-js'

// ============================================================================
// SKILLPASSPORT DATABASE - Application Data
// ============================================================================
// This is the main database for courses, passports, assessments, etc.
const skillpassportUrl = process.env.SKILLPASSPORT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const skillpassportServiceKey = process.env.SKILLPASSPORT_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!skillpassportUrl || !skillpassportServiceKey) {
  throw new Error('Missing SkillPassport Supabase environment variables')
}

/**
 * SkillPassport Database Client (Admin)
 * Use this for all application data: courses, passports, assessments, etc.
 */
export const supabaseAdmin = createClient(skillpassportUrl, skillpassportServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

