const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function checkMatch() {
  // Get first user's organizationId
  const { data: users } = await supabase
    .from('users')
    .select('organizationId')
    .limit(1);
  
  const testOrgId = users[0].organizationId;
  console.log(`Testing organizationId: ${testOrgId}`);
  
  // Check if it exists in recruiters table id field
  const { data: recruiter } = await supabase
    .from('recruiters')
    .select('id, name')
    .eq('id', testOrgId)
    .single();
  
  if (recruiter) {
    console.log('✅ MATCH FOUND in recruiters.id');
    console.log(`   Recruiter: ${recruiter.name}`);
  } else {
    console.log('❌ NO MATCH in recruiters.id');
  }
}

checkMatch();
