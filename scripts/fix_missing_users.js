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

async function fixMissingUsers() {
  console.log('='.repeat(80));
  console.log('FIXING MISSING USER RECORDS FOR RECRUITERS');
  console.log('='.repeat(80));

  // Get all recruiter organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('type', 'recruiter');

  if (orgError) {
    console.error('Error fetching organizations:', orgError);
    return;
  }

  console.log(`\nFound ${orgs.length} recruiter organizations`);

  // Get existing users
  const { data: existingUsers, error: userError } = await supabase
    .from('users')
    .select('organizationId')
    .in('organizationId', orgs.map(o => o.id));

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const existingOrgIds = new Set(existingUsers.map(u => u.organizationId));
  const missingOrgs = orgs.filter(org => !existingOrgIds.has(org.id));

  console.log(`Missing user records for: ${missingOrgs.length} organizations\n`);

  if (missingOrgs.length === 0) {
    console.log('✓ All organizations have user records!');
    return;
  }

  // Get all auth users
  const { data: authData, error: authListError } = await supabase.auth.admin.listUsers();
  
  if (authListError) {
    console.error('Error listing auth users:', authListError);
    return;
  }

  console.log(`Total auth users in system: ${authData.users.length}\n`);

  let fixed = 0;
  let failed = 0;

  for (const org of missingOrgs) {
    try {
      console.log(`Processing: ${org.name}`);

      // Find auth user by email
      const authUser = authData.users.find(u => u.email === org.email);

      if (!authUser) {
        console.log(`  ⚠️  No auth user found for ${org.email}, skipping...`);
        failed++;
        continue;
      }

      // Create user record
      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: org.email,
          role: 'admin', // Using admin role
          organizationId: org.id,
          isActive: true,
          metadata: {
            name: org.name,
            source: 'recruiter_import_fix',
            originalRole: 'recruiter'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.log(`  ✗ Error: ${insertError.message}`);
        failed++;
      } else {
        console.log(`  ✓ User record created`);
        fixed++;
      }

    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('FIX COMPLETE');
  console.log('='.repeat(80));
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total organizations: ${orgs.length}`);
  console.log(`Total user records now: ${existingUsers.length + fixed}`);
  
  console.log('\n✓ Fix script completed!');
}

fixMissingUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
