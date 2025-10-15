const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function finalCheck() {
  // Check if organizations table exists with some university data
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type')
    .eq('type', 'university');
  
  if (error) {
    console.log('Organizations table does not exist or has error:', error.message);
  } else {
    console.log(`Found ${data.length} universities in organizations table`);
    if (data.length > 0) {
      console.log('Sample:', JSON.stringify(data[0], null, 2));
    }
  }
}

finalCheck();
