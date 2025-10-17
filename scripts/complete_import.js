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

  // Get all auth users upfront
  console.log('Fetching all auth users...');
  const { data: allAuthUsers, error: authListError } = await supabase.auth.admin.listUsers();
  
  if (authListError) {
    console.error('Error listing auth users:', authListError);
    return;
  }

  console.log(`Found ${allAuthUsers.users.length} auth users in system\n`);

  // Create a map for quick lookup
  const authUserMap = new Map();
  allAuthUsers.users.forEach(user => {
    authUserMap.set(user.email, user.id);
  });

  let authCreated = 0;
  let userCreated = 0;
  let skipped = 0;
  let failed = 0;

  const defaultPassword = 'Recruit@2025';

  for (const org of missingOrgs) {
    try {
      console.log(`\n[${authCreated + userCreated + skipped + failed + 1}/${missingOrgs.length}] Processing: ${org.name}`);
      console.log(`  Email: ${org.email}`);

      // Check if auth user exists
      let authUserId = authUserMap.get(org.email);

      if (!authUserId) {
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

        if (authError) {
          console.log(`  ✗ Auth error: ${authError.message}`);
          failed++;
          continue;
        }

        authUserId = authData.user.id;
        console.log(`  ✓ Auth user created: ${authUserId}`);
        authCreated++;
      } else {
        console.log(`  ✓ Auth user already exists: ${authUserId}`);
        skipped++;
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
