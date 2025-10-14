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

async function removeDuplicates() {
  console.log('='.repeat(80));
  console.log('REMOVING DUPLICATE RECRUITER ORGANIZATIONS');
  console.log('='.repeat(80));

  // Get all recruiter organizations
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('type', 'recruiter')
    .order('createdAt', { ascending: true }); // Keep the oldest/first entry

  if (orgError) {
    console.error('Error fetching organizations:', orgError);
    return;
  }

  console.log(`\nTotal recruiter organizations: ${orgs.length}`);

  // Group by email
  const emailGroups = new Map();
  const noEmailOrgs = [];

  orgs.forEach(org => {
    if (!org.email || org.email === 'null') {
      noEmailOrgs.push(org);
    } else {
      if (!emailGroups.has(org.email)) {
        emailGroups.set(org.email, []);
      }
      emailGroups.get(org.email).push(org);
    }
  });

  console.log(`\nUnique email addresses: ${emailGroups.size}`);
  console.log(`Organizations without email: ${noEmailOrgs.length}`);

  // Find duplicates
  const duplicateGroups = [];
  emailGroups.forEach((group, email) => {
    if (group.length > 1) {
      duplicateGroups.push({ email, orgs: group });
    }
  });

  console.log(`\nEmails with duplicates: ${duplicateGroups.length}`);
  
  if (duplicateGroups.length === 0) {
    console.log('\n✓ No duplicates found!');
    return;
  }

  console.log('\nDuplicate organizations:');
  duplicateGroups.forEach((group, idx) => {
    console.log(`\n${idx + 1}. Email: ${group.email} (${group.orgs.length} entries)`);
    group.orgs.forEach((org, i) => {
      console.log(`   ${i === 0 ? '→ KEEP' : '  DELETE'}: ${org.name} (ID: ${org.id.substring(0, 8)}...)`);
    });
  });

  // Prepare deletion list (keep first, delete rest)
  const toDelete = [];
  duplicateGroups.forEach(group => {
    // Keep the first one (oldest), delete the rest
    const [keep, ...remove] = group.orgs;
    toDelete.push(...remove);
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Organizations to delete: ${toDelete.length}`);
  console.log(`Organizations to keep: ${orgs.length - toDelete.length}`);
  console.log(`${'='.repeat(80)}`);

  // Delete duplicates
  console.log('\nDeleting duplicate organizations...\n');
  
  let deleted = 0;
  let failed = 0;

  for (const org of toDelete) {
    try {
      const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', org.id);

      if (deleteError) {
        console.log(`✗ Failed to delete ${org.name}: ${deleteError.message}`);
        failed++;
      } else {
        console.log(`✓ Deleted: ${org.name} (${org.email})`);
        deleted++;
      }
    } catch (error) {
      console.error(`✗ Error deleting ${org.name}: ${error.message}`);
      failed++;
    }
  }

  // Get final count
  const { data: finalOrgs, error: finalError } = await supabase
    .from('organizations')
    .select('id')
    .eq('type', 'recruiter');

  console.log('\n' + '='.repeat(80));
  console.log('DELETION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Successfully deleted: ${deleted}`);
  console.log(`Failed to delete: ${failed}`);
  console.log(`Total recruiters before: ${orgs.length}`);
  console.log(`Total recruiters after: ${finalOrgs ? finalOrgs.length : 'Error fetching'}`);
  
  console.log('\n✓ Duplicate removal complete!');
}

removeDuplicates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
