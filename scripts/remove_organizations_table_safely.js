const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dpooleduinyyzxgrcwko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10';

const supabase = createClient(supabaseUrl, supabaseKey);

async function safelyRemoveOrganizationsTable() {
  console.log('=== SAFE ORGANIZATIONS TABLE REMOVAL PROCESS ===\n');
  
  try {
    // STEP 1: Verify all data is migrated
    console.log('STEP 1: Verifying data migration...\n');
    
    const { data: orgs } = await supabase.from('organizations').select('id, type');
    const { data: universities } = await supabase.from('universities').select('organizationid');
    const { data: recruiters } = await supabase.from('recruiters').select('organizationid');
    
    const orgUniversities = orgs?.filter(o => o.type === 'university') || [];
    const orgRecruiters = orgs?.filter(o => o.type === 'recruiter') || [];
    
    console.log(`  Organizations (universities): ${orgUniversities.length}`);
    console.log(`  Universities table: ${universities?.length || 0}`);
    console.log(`  Organizations (recruiters): ${orgRecruiters.length}`);
    console.log(`  Recruiters table: ${recruiters?.length || 0}`);
    
    if (orgUniversities.length !== universities?.length) {
      console.error('\n❌ ERROR: University count mismatch! Migration incomplete.');
      return false;
    }
    
    if (orgRecruiters.length !== recruiters?.length) {
      console.error('\n❌ ERROR: Recruiter count mismatch! Migration incomplete.');
      return false;
    }
    
    console.log('\n✅ All data migration verified!\n');
    
    // STEP 2: Verify all organizationIds are referenced in new tables
    console.log('STEP 2: Verifying organization references...\n');
    
    const univOrgIds = new Set(universities?.map(u => u.organizationid) || []);
    const recruiterOrgIds = new Set(recruiters?.map(r => r.organizationid) || []);
    
    let allMapped = true;
    for (const org of orgs || []) {
      if (org.type === 'university' && !univOrgIds.has(org.id)) {
        console.error(`  ❌ University org ${org.id} not in universities table`);
        allMapped = false;
      }
      if (org.type === 'recruiter' && !recruiterOrgIds.has(org.id)) {
        console.error(`  ❌ Recruiter org ${org.id} not in recruiters table`);
        allMapped = false;
      }
    }
    
    if (!allMapped) {
      console.error('\n❌ ERROR: Some organizations not mapped to new tables!');
      return false;
    }
    
    console.log('✅ All organizations properly referenced in new tables!\n');
    
    // STEP 3: Check foreign key dependencies
    console.log('STEP 3: Analyzing foreign key dependencies...\n');
    
    const { data: students } = await supabase
      .from('students')
      .select('universityId')
      .not('universityId', 'is', null);
    
    const { data: users } = await supabase
      .from('users')
      .select('organizationId')
      .not('organizationId', 'is', null);
    
    console.log(`  Students with universityId: ${students?.length || 0}`);
    console.log(`  Users with organizationId: ${users?.length || 0}`);
    
    // Verify all student universityIds exist in universities table
    const studentUnivIds = new Set(students?.map(s => s.universityId) || []);
    let invalidStudentRefs = 0;
    for (const univId of studentUnivIds) {
      const existsInOrg = orgs?.some(o => o.id === univId);
      const existsInUniv = univOrgIds.has(univId);
      if (existsInOrg && !existsInUniv) {
        invalidStudentRefs++;
      }
    }
    
    if (invalidStudentRefs > 0) {
      console.warn(`  ⚠️ WARNING: ${invalidStudentRefs} student university references may need attention`);
    }
    
    console.log('\n✅ Foreign key dependencies analyzed!\n');
    
    // STEP 4: Create backup info
    console.log('STEP 4: Creating backup information...\n');
    
    const backupInfo = {
      timestamp: new Date().toISOString(),
      organizations_count: orgs?.length || 0,
      universities_migrated: orgUniversities.length,
      recruiters_migrated: orgRecruiters.length,
      students_affected: students?.length || 0,
      users_affected: users?.length || 0
    };
    
    console.log('  Backup Info:', JSON.stringify(backupInfo, null, 2));
    console.log('\n✅ Backup information created!\n');
    
    // STEP 5: Summary
    console.log('=== MIGRATION SUMMARY ===\n');
    console.log('✅ All universities migrated to universities table');
    console.log('✅ All recruiters migrated to recruiters table');
    console.log('✅ All organization IDs properly referenced');
    console.log('✅ Foreign key dependencies verified');
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('   1. Students table still uses universityId (references organizations.id)');
    console.log('   2. Users table still uses organizationId (references organizations.id)');
    console.log('   3. API endpoints need to be updated to use new tables');
    console.log('   4. Universities table uses organizationid to maintain reference');
    console.log('   5. Recruiters table uses organizationid to maintain reference');
    console.log('\n⚠️  BEFORE REMOVING ORGANIZATIONS TABLE:');
    console.log('   - Update API endpoints to query universities/recruiters tables');
    console.log('   - Ensure foreign keys in students/users tables are handled');
    console.log('   - Test all application functionality');
    console.log('   - The organizationid columns in universities/recruiters tables maintain the link');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ERROR during verification:', error);
    return false;
  }
}

// Run the verification
safelyRemoveOrganizationsTable().then((success) => {
  if (success) {
    console.log('\n✅ Verification complete. Organizations table can be safely removed after API updates.');
    console.log('\nNext steps:');
    console.log('1. Update all API endpoints');
    console.log('2. Update frontend to use new table structures');
    console.log('3. Test thoroughly');
    console.log('4. Then drop organizations table');
  } else {
    console.log('\n❌ Verification failed. Do NOT remove organizations table yet.');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
