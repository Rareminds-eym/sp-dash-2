import { createClient } from '@supabase/supabase-js'
import { skillpassportDbConfig } from './skillpassport-db-config'

// ============================================================================
// SKILLPASSPORT DATABASE - Application Data
// ============================================================================
// This is the main database for courses, passports, assessments, etc.
const { SUPABASE_URL: skillpassportUrl, SUPABASE_SERVICE_ROLE_KEY: skillpassportServiceKey } = skillpassportDbConfig(process.env)

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

