const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function checkOrgs() {
  const testId = 'f1ed42b6-ffe7-4108-90bb-6776b6504f7b';
  
  // Check if organizations table exists
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type')
    .eq('id', testId)
    .single();
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Found in organizations table:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkOrgs();
