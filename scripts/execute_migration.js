const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile(filePath, stepName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Executing: ${stepName}`);
  console.log(`File: ${filePath}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Read SQL file
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    console.log(`📄 SQL file size: ${(sqlContent.length / 1024).toFixed(2)} KB`);
    console.log(`⏳ Executing migration... (this may take 10-30 seconds)\n`);

    // Execute SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sqlContent 
    }).catch(async () => {
      // If RPC doesn't exist, try direct query
      console.log('⚠️  RPC method not available, using direct query...');
      return await supabase.from('_').select('*').limit(0).then(() => {
        // This is a workaround - we'll need to use REST API
        throw new Error('Please use Supabase SQL Editor for migration');
      });
    });

    if (error) {
      console.error(`❌ Error in ${stepName}:`, error);
      return false;
    }

    console.log(`✅ ${stepName} completed successfully!\n`);
    return true;

  } catch (err) {
    console.error(`❌ Exception in ${stepName}:`, err.message);
    console.log('\n⚠️  MIGRATION NOTICE:');
    console.log('Supabase requires SQL migrations to be run through SQL Editor.');
    console.log('\nPlease follow these steps:');
    console.log(`1. Go to: ${supabaseUrl}/project/${supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : 'your-project-ref'}/sql`);
    console.log('   (If this URL is incorrect, please set NEXT_PUBLIC_SUPABASE_URL in your environment variables)');
    console.log('2. Click "New Query"');
    console.log(`3. Copy contents of: ${filePath}`);
    console.log('4. Paste into SQL Editor');
    console.log('5. Click "Run"');
    console.log('6. Wait for completion message\n');
    
    // Extract project reference from URL
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : 'your-project-ref';
    console.log(`If the URL above is incorrect, please set NEXT_PUBLIC_SUPABASE_URL in your environment variables.`);
    console.log(`Your project reference appears to be: ${projectRef}\n`);
    return false;
  }
}

async function runMigration() {
  console.log('\n🚀 RAREMINDS DATABASE MIGRATION');
  console.log('================================\n');

  const databaseDir = path.join(__dirname, '../database');
  
  const step1File = path.join(databaseDir, 'migration_script_step1_complete_schema.sql');
  const step2File = path.join(databaseDir, 'migration_script_step2_enhanced_schema.sql');
  const verificationFile = path.join(databaseDir, 'verification_script.sql');

  // Check if files exist
  if (!fs.existsSync(step1File)) {
    console.error('❌ Step 1 migration file not found');
    process.exit(1);
  }
  if (!fs.existsSync(step2File)) {
    console.error('❌ Step 2 migration file not found');
    process.exit(1);
  }

  console.log('📋 Migration Plan:');
  console.log('   Step 1: Complete Schema (base tables, RBAC, indexes)');
  console.log('   Step 2: Enhanced Schema (unified colleges, enrollments)');
  console.log('   Step 3: Verification\n');

  console.log('⚠️  IMPORTANT: Supabase migrations must be run through SQL Editor');
  console.log('This script will guide you through the process.\n');

  console.log('📖 Migration Instructions:\n');
  
  console.log('STEP 1 - Complete Schema:');
  console.log('1. Open: https://dpooleduinyyzxgrcwko.supabase.co/project/dpooleduinyyzxgrcwko/sql');
  console.log('2. Click "New Query"');
  console.log('3. Copy the entire contents of:');
  console.log(`   ${step1File}`);
  console.log('4. Paste into SQL Editor');
  console.log('5. Click "Run" button');
  console.log('6. Wait for: "STEP 1: RAREMINDS COMPLETE SCHEMA MIGRATION COMPLETED"\n');

  console.log('STEP 2 - Enhanced Schema:');
  console.log('1. Click "New Query" again');
  console.log('2. Copy the entire contents of:');
  console.log(`   ${step2File}`);
  console.log('3. Paste into SQL Editor');
  console.log('4. Click "Run" button');
  console.log('5. Wait for: "STEP 2: RAREMINDS ENHANCED SCHEMA V2 MIGRATION COMPLETED"\n');

  console.log('STEP 3 - Verification:');
  console.log('1. Click "New Query" once more');
  console.log('2. Copy the entire contents of:');
  console.log(`   ${verificationFile}`);
  console.log('3. Paste into SQL Editor');
  console.log('4. Click "Run" button');
  console.log('5. Check for ✅ marks in the output\n');

  console.log('${'='.repeat(60)}');
  console.log('ALTERNATIVE: View file contents to copy');
  console.log('${'='.repeat(60)}\n');

  // Show file contents for easy copying
  console.log('📄 Would you like to see the SQL contents here for easy copying?');
  console.log('   You can run this script with --show flag to display SQL\n');

  if (process.argv.includes('--show')) {
    console.log('\n📄 STEP 1 - COMPLETE SCHEMA SQL:');
    console.log('='.repeat(60));
    console.log(fs.readFileSync(step1File, 'utf8'));
    console.log('\n' + '='.repeat(60));
    
    console.log('\n\n📄 STEP 2 - ENHANCED SCHEMA SQL:');
    console.log('='.repeat(60));
    console.log(fs.readFileSync(step2File, 'utf8'));
    console.log('\n' + '='.repeat(60));
  }

  console.log('\n✅ Migration files are ready in /app/database/ folder');
  console.log('📖 For detailed instructions, read: /app/database/MIGRATION_INSTRUCTIONS.md\n');
}

runMigration().catch(err => {
  console.error('❌ Migration script error:', err);
  process.exit(1);
});
