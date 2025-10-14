const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Initialize Supabase client
const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function addColumns() {
  console.log('='.repeat(80));
  console.log('ADDING RECRUITER COLUMNS TO ORGANIZATIONS TABLE');
  console.log('='.repeat(80));

  // First, check current organizations table structure
  console.log('\nChecking current organizations table...');
  const { data: currentOrgs, error: checkError } = await supabase
    .from('organizations')
    .select('*')
    .limit(1);

  if (checkError) {
    console.error('Error checking table:', checkError);
    process.exit(1);
  }

  console.log('Current columns:', currentOrgs.length > 0 ? Object.keys(currentOrgs[0]) : 'No data to check');

  // The columns we need to add
  const columnsToAdd = [
    { name: 'phone', type: 'text', nullable: true },
    { name: 'website', type: 'text', nullable: true },
    { name: 'address', type: 'text', nullable: true },
    { name: 'city', type: 'text', nullable: true },
    { name: 'state', type: 'text', nullable: true },
    { name: 'companyType', type: 'text', nullable: true }
  ];

  console.log('\n⚠️  MANUAL SQL REQUIRED:');
  console.log('Please run the following SQL commands in your Supabase SQL Editor:\n');
  console.log('-- Add recruiter-specific columns to organizations table');
  
  columnsToAdd.forEach(col => {
    const nullable = col.nullable ? '' : 'NOT NULL';
    console.log(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} ${nullable};`);
  });

  console.log('\n-- Create indexes for better query performance');
  console.log('CREATE INDEX IF NOT EXISTS idx_organizations_city ON organizations(city);');
  console.log('CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);');
  console.log('CREATE INDEX IF NOT EXISTS idx_organizations_companyType ON organizations("companyType");');

  console.log('\n' + '='.repeat(80));
  console.log('After running the SQL above, run the import script again:');
  console.log('  node scripts/import_recruiters.js');
  console.log('='.repeat(80));
}

addColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
