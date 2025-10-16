const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function checkMatch() {
  const testUniversityId = 'f1ed42b6-ffe7-4108-90bb-6776b6504f7b';
  
  // Check if this ID exists in universities table
  const { data: univData, error } = await supabase
    .from('universities')
    .select('id, name')
    .eq('id', testUniversityId)
    .single();
  
  if (error) {
    console.error('Error finding university:', error.message);
  } else {
    console.log('Found university:');
    console.log(JSON.stringify(univData, null, 2));
  }
}

checkMatch();
