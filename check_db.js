const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dpooleduinyyzxgrcwko.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10'
);

async function checkColumns() {
  // Try to select all columns
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns in universities table:');
    console.log(JSON.stringify(Object.keys(data[0]), null, 2));
    console.log('\nSample data:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data found in universities table');
  }
}

checkColumns();
