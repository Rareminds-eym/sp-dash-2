const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    console.log(Object.keys(data[0]));
  } else {
    console.log('No data found in universities table');
  }
}

checkColumns();
