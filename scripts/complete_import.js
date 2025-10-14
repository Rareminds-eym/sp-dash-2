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

async function completeImport() {
  console.log('='.repeat(80));
  console.log('COMPLETING RECRUITER IMPORT - CREATING MISSING AUTH & USER RECORDS');
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
    .select('organizationId, email')
    .in('organizationId', orgs.map(o => o.id));

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const existingOrgIds = new Set(existingUsers.map(u => u.organizationId));
  const missingOrgs = orgs.filter(org => org.email && !existingOrgIds.has(org.id));

  console.log(`Organizations needing completion: ${missingOrgs.length}\n`);

  if (missingOrgs.length === 0) {
    console.log('✓ All organizations have user records!');
    return;
  }

  let authCreated = 0;
  let userCreated = 0;
  let skipped = 0;
  let failed = 0;

  const defaultPassword = 'Recruit@2025';

  for (const org of missingOrgs) {
    try {
      console.log(`\n[${authCreated + userCreated + skipped + failed + 1}/${missingOrgs.length}] Processing: ${org.name}`);
      console.log(`  Email: ${org.email}`);

      // Step 1: Try to create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: org.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          name: org.name,
          role: 'recruiter'
        }
      });

      let authUserId;

      if (authError) {
        if (authError.message.includes('already registered')) {
          console.log(`  ⚠️  Auth user already exists`);
          // Try to get existing auth user
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const existingAuth = authUsers.users.find(u => u.email === org.email);
          if (existingAuth) {
            authUserId = existingAuth.id;
            console.log(`  ✓ Found existing auth user: ${authUserId}`);
          } else {
            console.log(`  ✗ Could not find existing auth user`);
            failed++;
            continue;
          }
        } else {
          console.log(`  ✗ Auth error: ${authError.message}`);
          failed++;
          continue;
        }
      } else {
        authUserId = authData.user.id;
        console.log(`  ✓ Auth user created: ${authUserId}`);
        authCreated++;
      }

      // Step 2: Create user record
      const { data: userData, error: userInsertError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          email: org.email,
          role: 'admin',
          organizationId: org.id,
          isActive: true,
          metadata: {
            name: org.name,
            source: 'recruiter_complete_import',
            originalRole: 'recruiter'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (userInsertError) {
        console.log(`  ✗ User record error: ${userInsertError.message}`);
        failed++;
      } else {
        console.log(`  ✓ User record created`);
        userCreated++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`  ✗ Unexpected error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('COMPLETION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Auth users created: ${authCreated}`);
  console.log(`User records created: ${userCreated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nTotal recruiter organizations: ${orgs.length}`);
  console.log(`Total user records before: ${existingUsers.length}`);
  console.log(`Total user records after: ${existingUsers.length + userCreated}`);
  console.log(`\nDefault password for new accounts: ${defaultPassword}`);
  
  console.log('\n✓ Import completion script finished!');
}

completeImport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
