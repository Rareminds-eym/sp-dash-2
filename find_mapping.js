const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function findMapping() {
  // Get a sample student with user data
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .limit(5);
  
  console.log('=== SAMPLE STUDENTS ===');
  if (students && students.length > 0) {
    console.log('Student fields:', Object.keys(students[0]));
    students.forEach(s => {
      console.log(`\nStudent: ${s.id}`);
      console.log(`  universityId: ${s.universityId}`);
      console.log(`  userId: ${s.userId}`);
      console.log(`  profile: ${JSON.stringify(s.profile)?.substring(0, 100)}`);
    });
  }
  
  // Check users table for organization references
  const oldUnivId = '1b0ab392-4fba-4037-ae99-6cdf1e0a232d'; // Annamalai from student data
  const { data: users } = await supabase
    .from('users')
    .select('email, organizationId, metadata')
    .eq('organizationId', oldUnivId)
    .limit(3);
  
  console.log('\n=== USERS WITH OLD UNIVERSITY ID ===');
  if (users && users.length > 0) {
    console.log(`Found ${users.length} users with organizationId: ${oldUnivId}`);
    console.log('Sample:', JSON.stringify(users[0], null, 2));
  } else {
    console.log('No users found with that organizationId');
  }
}

findMapping();
