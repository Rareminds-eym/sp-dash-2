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

async function verifyImport() {
  console.log('='.repeat(80));
  console.log('VERIFYING RECRUITER IMPORT STATUS');
  console.log('='.repeat(80));

  // Check organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('type', 'recruiter');

  if (orgError) {
    console.error('Error fetching organizations:', orgError);
    return;
  }

  console.log(`\n✓ Organizations imported: ${orgs.length}`);
  console.log('\nSample organizations:');
  orgs.slice(0, 5).forEach(org => {
    console.log(`  - ${org.name} (${org.city || 'N/A'})`);
    console.log(`    Email: ${org.email}, Phone: ${org.phone}`);
  });

  // Check users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, role, organizationId')
    .in('organizationId', orgs.map(o => o.id));

  if (userError) {
    console.error('\nError fetching users:', userError);
  } else {
    console.log(`\n✓ User records created: ${users.length}`);
    if (users.length > 0) {
      console.log('Sample users:');
      users.slice(0, 5).forEach(user => {
        console.log(`  - ${user.email} (Role: ${user.role})`);
      });
    }
  }

  // Check auth users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('\nError fetching auth users:', authError);
  } else {
    const recruiterEmails = orgs.map(o => o.email);
    const recruiterAuthUsers = authUsers.users.filter(u => recruiterEmails.includes(u.email));
    console.log(`\n✓ Auth users created: ${recruiterAuthUsers.length}`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Organizations (recruiters): ${orgs.length}`);
  console.log(`User records: ${users ? users.length : 0}`);
  console.log(`Missing user records: ${orgs.length - (users ? users.length : 0)}`);
  
  if (users && users.length < orgs.length) {
    console.log('\n⚠️  Some organizations are missing user records.');
    console.log('This means they have organization and auth accounts but no user table entry.');
    console.log('Run the fix script to complete the import.');
  }

  console.log('\n✓ Verification complete!');
}

verifyImport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
