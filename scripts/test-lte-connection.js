#!/usr/bin/env node
/**
 * Simple LTE Database Connection Test
 * Tests if we can connect to the LTE database on the configured port
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testConnection() {
  console.log('\n🔍 Testing LTE Database Connection\n');
  console.log('━'.repeat(60));
  
  const lteUrl = process.env.LTE_SUPABASE_URL;
  const lteKey = process.env.LTE_SERVICE_ROLE_KEY;
  
  console.log(`📡 LTE URL: ${lteUrl}`);
  
  if (!lteUrl) {
    console.error('❌ LTE_SUPABASE_URL not found in .env.local');
    process.exit(1);
  }
  
  if (!lteKey) {
    console.error('❌ LTE_SERVICE_ROLE_KEY not found in .env.local');
    process.exit(1);
  }
  
  // Determine environment
  const isLocal = lteUrl.includes('127.0.0.1') || lteUrl.includes('localhost');
  console.log(`🌍 Environment: ${isLocal ? 'LOCAL' : 'PRODUCTION'}`);
  
  if (isLocal) {
    // Extract port from URL
    const portMatch = lteUrl.match(/:(\d+)/);
    const port = portMatch ? portMatch[1] : 'unknown';
    console.log(`🔌 Port: ${port}`);
  }
  
  console.log('━'.repeat(60));
  
  try {
    // Create Supabase client
    const supabase = createClient(lteUrl, lteKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('\n1️⃣  Testing basic connectivity...');
    
    // Try to query a table that should exist
    const { data, error } = await supabase
      .from('lte_catalog_uploads')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  Connected, but lte_catalog_uploads table not found');
        console.log('   💡 You need to run the LTE migrations');
        console.log('\n📋 Next steps:');
        console.log('   1. Copy migrations from sso-worker/supabase/migrations/');
        console.log('      - 20260817000000_lte_catalog_uploads.sql');
        console.log('      - 20260818000000_publish_lte_catalog_snapshot.sql');
        console.log('   2. Apply them to your LTE Supabase instance');
        console.log('\n   See LTE_SEPARATE_DATABASE_SETUP.md for detailed instructions');
        return;
      }
      
      throw error;
    }
    
    console.log('   ✅ Connected successfully!');
    console.log('   ✅ lte_catalog_uploads table exists');
    
    if (data && data.length > 0) {
      console.log(`   📊 Found ${data.length} existing upload(s)`);
    } else {
      console.log('   📊 No uploads yet (table is empty)');
    }
    
    // Check for 15 LTE tables
    console.log('\n2️⃣  Checking LTE catalog tables...');
    
    const lteTables = [
      'roles',
      'capabilities', 
      'level_scale',
      'role_capability_sequence',
      'skills',
      'levels',
      'level_skills',
      'courses',
      'modules',
      'modules_content',
      'e_content',
      'module_artifacts',
      'artifact_questions',
      'artifact_templates',
      'artifact_template_questions'
    ];
    
    let foundCount = 0;
    const missingTables = [];
    
    for (const table of lteTables) {
      const { error: tableError } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!tableError || tableError.code !== '42P01') {
        foundCount++;
      } else {
        missingTables.push(table);
      }
    }
    
    console.log(`   Found ${foundCount}/15 LTE tables`);
    
    if (foundCount === 15) {
      console.log('   ✅ All 15 LTE catalog tables exist!');
    } else {
      console.log(`   ⚠️  Missing ${15 - foundCount} tables:`, missingTables.join(', '));
      console.log('\n   💡 Create these tables in your LTE database');
      console.log('      See PRODUCTION_SETUP.sql for table schemas');
    }
    
    // Check publish function
    console.log('\n3️⃣  Checking publish function...');
    
    const { error: funcError } = await supabase.rpc('publish_lte_catalog_snapshot', {
      p_upload_id: '00000000-0000-0000-0000-000000000000',
      p_published_by: '00000000-0000-0000-0000-000000000000',
      p_expected_snapshot_hash: 'test'
    });
    
    if (funcError && funcError.message.includes('could not find')) {
      console.log('   ⚠️  publish_lte_catalog_snapshot function not found');
      console.log('   💡 Run migration: 20260818000000_publish_lte_catalog_snapshot.sql');
    } else {
      console.log('   ✅ publish_lte_catalog_snapshot function exists');
    }
    
    // Summary
    console.log('\n━'.repeat(60));
    
    if (foundCount === 15 && !funcError) {
      console.log('✅ SUCCESS! Your LTE database is fully configured.');
      console.log('\n📝 Next steps:');
      console.log('   1. Start the admin dashboard: npm run dev');
      console.log('   2. Navigate to: http://localhost:3000/lte-course-upload');
      console.log('   3. Upload your LTE course catalog');
    } else {
      console.log('⚠️  Setup incomplete. See messages above for next steps.');
      console.log('\n📚 Documentation: LTE_SEPARATE_DATABASE_SETUP.md');
    }
    
    console.log('━'.repeat(60) + '\n');
    
  } catch (err) {
    console.error('\n❌ Connection failed!\n');
    
    if (err.code === 'ECONNREFUSED') {
      console.error('   Connection refused to:', lteUrl);
      console.error('\n💡 Possible issues:');
      console.error('   1. Is your LTE Supabase instance running?');
      console.error('      Check: cd <your-lte-folder> && supabase status');
      console.error('   2. Is the port correct in .env.local?');
      console.error(`      Current: ${lteUrl}`);
      console.error('   3. Did you start Supabase?');
      console.error('      Run: cd <your-lte-folder> && supabase start');
    } else {
      console.error('   Error:', err.message);
      if (err.code) {
        console.error('   Code:', err.code);
      }
    }
    
    console.error('\n━'.repeat(60) + '\n');
    process.exit(1);
  }
}

testConnection();
