const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function updateSchema() {
  console.log('='.repeat(80));
  console.log('UPDATING ORGANIZATIONS TABLE SCHEMA');
  console.log('='.repeat(80));

  const sqlCommands = [
    'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone text',
    'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website text',
    'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address text',
    'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city text',
    'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email text',
    'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "companyType" text',
    'CREATE INDEX IF NOT EXISTS idx_organizations_city ON organizations(city)',
    'CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type)',
    'CREATE INDEX IF NOT EXISTS idx_organizations_companyType ON organizations("companyType")',
    'CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email)'
  ];

  console.log('\nExecuting SQL commands...\n');

  for (const sql of sqlCommands) {
    console.log(`Executing: ${sql}`);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.log(`  ⚠️  Note: ${error.message}`);
      // Continue anyway as the column might already exist
    } else {
      console.log(`  ✓ Success`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Schema update attempt completed!');
  console.log('Verifying by querying organizations table...');
  console.log('='.repeat(80));

  // Verify the changes
  const { data: testOrg, error: testError } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (testError) {
    console.error('\n❌ Error verifying table:', testError.message);
  } else {
    console.log('\n✓ Current table columns:', testOrg.length > 0 ? Object.keys(testOrg[0]) : 'No data');
  }

  console.log('\n✓ You can now run: node scripts/import_recruiters.js');
}

updateSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
