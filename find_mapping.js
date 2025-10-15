const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function findMapping() {
  // Get sample students with all their data
  const { data: students } = await supabase
    .from('students')
    .select('*, users(email, metadata)')
    .limit(20);
  
  console.log('=== SAMPLE STUDENT DATA ===');
  if (students && students.length > 0) {
    const sample = students[0];
    console.log('Student fields:', Object.keys(sample));
    console.log('\nSample student:', JSON.stringify(sample, null, 2));
  }
  
  // Check if there's any profile or organization info
  const univId = students[0]?.universityId;
  if (univId) {
    // Try to find any reference to this ID in users table
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('organizationId', univId)
      .limit(1);
    
    if (users && users.length > 0) {
      console.log('\n=== FOUND USER WITH MATCHING ORGANIZATION ID ===');
      console.log(JSON.stringify(users[0], null, 2));
    }
  }
}

findMapping();
