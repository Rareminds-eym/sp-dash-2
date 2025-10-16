const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function checkOrganizations() {
  // Try to get organizations
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type')
    .eq('type', 'university')
    .limit(3);
  
  if (error) {
    console.error('Organizations table error:', error.message);
  } else {
    console.log('Organizations table universities:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkOrganizations();
