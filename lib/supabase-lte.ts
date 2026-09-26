import { createClient } from '@supabase/supabase-js';

// ============================================================================
// LTE DATABASE - Learning Catalog Data
// ============================================================================
// Separate database for LTE course catalog, modules, levels, etc.
const lteUrl = process.env.LTE_SUPABASE_URL || process.env.SUPABASE_DB_URL;
const lteServiceKey = process.env.LTE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!lteUrl || !lteServiceKey) {
  throw new Error(
    'Missing LTE Supabase environment variables. ' +
    'Please set LTE_SUPABASE_URL and LTE_SERVICE_ROLE_KEY (or SUPABASE_DB_URL)'
  );
}

/**
 * LTE Database Client (Admin)
 * Use this for all LTE catalog data: courses, modules, levels, capabilities, etc.
 */
export const supabaseLTE = createClient(lteUrl, lteServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Direct PostgreSQL connection URL for advanced operations
 */
export function getLTEDatabaseURL(): string {
  const dbUrl = process.env.LTE_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (!dbUrl) {
    throw new Error(
      'Missing LTE database URL. ' +
      'Please set LTE_DATABASE_URL or DATABASE_URL environment variable'
    );
  }
  
  return dbUrl;
}
