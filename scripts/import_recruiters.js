const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
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

// Initialize Supabase client with service role key for admin operations
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

async function importRecruiters() {
  console.log('='.repeat(80));
  console.log('RECRUITER DATA IMPORT SCRIPT');
  console.log('='.repeat(80));

  // Load prepared data
  const recruitersData = JSON.parse(fs.readFileSync('recruiters_for_import.json', 'utf8'));
  const authUsersData = JSON.parse(fs.readFileSync('recruiter_auth_users.json', 'utf8'));

  console.log(`\nLoaded ${recruitersData.length} recruiters and ${authUsersData.length} auth users`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Process each recruiter
  for (let i = 0; i < recruitersData.length; i++) {
    const recruiter = recruitersData[i];
    const authUser = authUsersData[i];

    try {
      console.log(`\n[${i + 1}/${recruitersData.length}] Processing: ${recruiter.name}`);

      // Step 1: Insert organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          id: recruiter.id,
          name: recruiter.name,
          type: recruiter.type,
          email: recruiter.email,
          phone: recruiter.phone,
          website: recruiter.website,
          address: recruiter.address,
          city: recruiter.city,
          state: recruiter.state,
          country: recruiter.country,
          metadata: recruiter.metadata,
          isActive: recruiter.isActive,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (orgError) {
        throw new Error(`Organization insert failed: ${orgError.message}`);
      }

      console.log(`  ✓ Organization created: ${orgData.id}`);

      // Step 2: Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: authUser.email,
        password: authUser.password,
        email_confirm: true,
        user_metadata: {
          name: authUser.name,
          role: authUser.role
        }
      });

      if (authError) {
        // If user already exists, try to get existing user
        if (authError.message.includes('already registered')) {
          console.log(`  ⚠ Auth user already exists: ${authUser.email}`);
          
          // Try to find existing user in users table
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', authUser.email)
            .single();

          if (existingUser) {
            console.log(`  ✓ Using existing user: ${existingUser.id}`);
            successCount++;
            continue;
          }
        } else {
          throw new Error(`Auth user creation failed: ${authError.message}`);
        }
      }

      console.log(`  ✓ Auth user created: ${authData.user.id}`);

      // Step 3: Insert user record in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: authUser.email,
          role: authUser.role,
          organizationId: authUser.organizationId,
          isActive: true,
          metadata: {
            name: authUser.name,
            source: 'recruiter_import'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        throw new Error(`User insert failed: ${userError.message}`);
      }

      console.log(`  ✓ User record created: ${userData.id}`);
      console.log(`  ✓ SUCCESS: ${recruiter.name} imported successfully`);
      
      successCount++;

    } catch (error) {
      console.error(`  ✗ ERROR: ${error.message}`);
      errorCount++;
      errors.push({
        recruiter: recruiter.name,
        email: recruiter.email,
        error: error.message
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total recruiters processed: ${recruitersData.length}`);
  console.log(`Successful imports: ${successCount}`);
  console.log(`Failed imports: ${errorCount}`);
  console.log(`Success rate: ${((successCount / recruitersData.length) * 100).toFixed(2)}%`);

  if (errors.length > 0) {
    console.log('\nErrors encountered:');
    errors.forEach((err, idx) => {
      console.log(`${idx + 1}. ${err.recruiter} (${err.email}): ${err.error}`);
    });

    // Save errors to file
    fs.writeFileSync('import_errors.json', JSON.stringify(errors, null, 2));
    console.log('\nErrors saved to: import_errors.json');
  }

  // Get final count of recruiter organizations
  const { count } = await supabase
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'recruiter');

  console.log(`\nTotal recruiter organizations in database: ${count}`);
  console.log('\n✓ Import process completed!');
}

// Run the import
importRecruiters()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
