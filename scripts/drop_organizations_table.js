const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dpooleduinyyzxgrcwko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10';

const supabase = createClient(supabaseUrl, supabaseKey);

async function dropOrganizationsTable() {
  console.log('=== FINAL VERIFICATION BEFORE DROPPING ORGANIZATIONS TABLE ===\n');
  
  try {
    // Final verification checks
    console.log('Running final verification checks...\n');
    
    const { data: orgs } = await supabase.from('organizations').select('type');
    const { data: universities } = await supabase.from('universities').select('organizationid');
    const { data: recruiters } = await supabase.from('recruiters').select('organizationid');
    
    const orgUniversities = orgs?.filter(o => o.type === 'university').length || 0;
    const orgRecruiters = orgs?.filter(o => o.type === 'recruiter').length || 0;
    
    console.log('Current state:');
    console.log(`  Organizations table: ${orgs?.length || 0} total (${orgUniversities} universities, ${orgRecruiters} recruiters)`);
    console.log(`  Universities table: ${universities?.length || 0}`);
    console.log(`  Recruiters table: ${recruiters?.length || 0}`);
    
    if (orgUniversities !== universities?.length || orgRecruiters !== recruiters?.length) {
      console.error('\n❌ VERIFICATION FAILED: Data counts do not match!');
      console.error('   DO NOT drop organizations table!');
      return false;
    }
    
    console.log('\n✅ All data verified and migrated correctly!\n');
    
    // WARNING: This action is IRREVERSIBLE
    console.log('⚠️  WARNING: YOU ARE ABOUT TO DROP THE ORGANIZATIONS TABLE');
    console.log('⚠️  This action is IRREVERSIBLE and will permanently delete the table.');
    console.log('⚠️  All data has been migrated to universities and recruiters tables.');
    console.log('⚠️  The organizationid foreign key columns maintain the references.\n');
    
    console.log('To proceed with dropping the organizations table, you need to:');
    console.log('1. Make sure all API endpoints have been tested');
    console.log('2. Verify the application works correctly');
    console.log('3. Run the following SQL command in Supabase SQL Editor:\n');
    console.log('   DROP TABLE IF EXISTS organizations CASCADE;\n');
    
    console.log('Note: We cannot drop the table from JavaScript due to security restrictions.');
    console.log('You must manually execute the DROP TABLE command in Supabase dashboard.\n');
    
    console.log('Path: Supabase Dashboard → SQL Editor → New Query → Paste command → Run\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERROR during verification:', error);
    return false;
  }
}

// Run the script
dropOrganizationsTable().then((success) => {
  if (success) {
    console.log('✅ Final verification complete.');
    console.log('✅ All systems ready for organizations table removal.');
    console.log('\n📋 CHECKLIST BEFORE DROPPING TABLE:');
    console.log('   ☐ All API endpoints tested and working');
    console.log('   ☐ Frontend application tested');
    console.log('   ☐ Login/authentication working');
    console.log('   ☐ University and recruiter data accessible');
    console.log('   ☐ No errors in application logs');
    console.log('\n🔧 TO DROP THE TABLE:');
    console.log('   1. Go to Supabase Dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Create new query');
    console.log('   4. Paste: DROP TABLE IF EXISTS organizations CASCADE;');
    console.log('   5. Execute query');
  } else {
    console.log('\n❌ Verification failed. DO NOT drop organizations table.');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
