/**
 * Check actual schema of courses table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.LTE_SUPABASE_URL,
  process.env.LTE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('\n🔍 Checking Courses Table\n');
  
  // Try to get one course
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('✓ Table exists but is EMPTY - no courses were actually inserted!');
    console.log('\nThis means the publish skipped all records because they');
    console.log('appeared to be duplicates, but the table is actually empty.');
    console.log('\n💡 Solution: The data might be in the WRONG database or');
    console.log('   the UUID conflict detection prevented insertion.');
    return;
  }
  
  console.log('✓ Found courses! Sample record:\n');
  console.log(JSON.stringify(data[0], null, 2));
}

checkSchema().catch(console.error);
