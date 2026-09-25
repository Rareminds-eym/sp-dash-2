/**
 * Check what tables actually exist in the LTE database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.LTE_SUPABASE_URL,
  process.env.LTE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('\n🔍 Checking LTE Database Schema\n');
  
  // Query pg_tables to see what actually exists
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `
  });

  if (error) {
    // Try alternative approach
    console.log('Direct query failed, trying table checks...\n');
    
    const tables = [
      'courses', 'modules', 'roles', 'capabilities', 'levels', 
      'skills', 'level_skills', 'modules_content', 'e_content',
      'module_artifacts', 'artifact_questions', 'artifact_templates',
      'artifact_template_questions', 'level_scale', 'role_capability_sequence',
      'lte_catalog_uploads'
    ];
    
    for (const table of tables) {
      const { error: checkError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (checkError) {
        console.log(`❌ ${table} - ${checkError.message}`);
      } else {
        console.log(`✓ ${table} - exists`);
      }
    }
  } else {
    console.log('Tables in database:\n');
    data.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
  }
}

checkTables().catch(console.error);
