const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function checkUsers() {
  const { data: users } = await supabase
    .from('users')
    .select('id, email, role, organizationId')
    .limit(10);
  
  console.log('Sample users:');
  users.forEach(u => {
    console.log(`  ${u.email} (${u.role}) - orgId: ${u.organizationId}`);
  });
  
  // Check unique organization IDs
  const { data: allUsers } = await supabase
    .from('users')
    .select('organizationId');
  
  const uniqueOrgIds = [...new Set(allUsers.map(u => u.organizationId).filter(Boolean))];
  console.log(`\nTotal unique organizationIds in users table: ${uniqueOrgIds.length}`);
  console.log('Unique IDs:', uniqueOrgIds);
}

checkUsers();
