#!/usr/bin/env node
/**
 * Migration Executor
 * Executes database migration scripts through Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('='.repeat(80));
console.log('DATABASE MIGRATION EXECUTOR');
console.log('='.repeat(80));
console.log();

console.log('⚠️  IMPORTANT NOTICE');
console.log('='.repeat(80));
console.log();
console.log('Due to network restrictions in this container environment, we cannot');
console.log('execute raw SQL directly against your Supabase database.');
console.log();
console.log('However, I have prepared all the migration scripts for you:');
console.log();
console.log('📁 Migration Files Ready:');
console.log('  1. /app/database/migration_script_step1_complete_schema.sql');
console.log('  2. /app/database/migration_script_step2_enhanced_schema.sql');
console.log('  3. /app/database/alignment_migration.sql');
console.log();
console.log('='.repeat(80));
console.log('MANUAL EXECUTION INSTRUCTIONS');
console.log('='.repeat(80));
console.log();
console.log('Please follow these steps to execute the migrations:');
console.log();
console.log('Step 1: Open Supabase SQL Editor');
console.log('  → Go to: https://supabase.com/dashboard/project/dpooleduinyyzxgrcwko');
console.log('  → Click "SQL Editor" in the left sidebar');
console.log('  → Click "New Query"');
console.log();
console.log('Step 2: Execute Migration Step 1 (Base Schema)');
console.log('  → Copy contents of: migration_script_step1_complete_schema.sql');
console.log('  → Paste into SQL Editor');
console.log('  → Click "Run" button');
console.log('  → Wait for completion (should take 10-30 seconds)');
console.log('  → Verify: Look for success messages');
console.log();
console.log('Step 3: Execute Migration Step 2 (Enhanced Schema)');
console.log('  → Click "New Query" again');
console.log('  → Copy contents of: migration_script_step2_enhanced_schema.sql');
console.log('  → Paste into SQL Editor');
console.log('  → Click "Run" button');
console.log('  → Wait for completion (should take 5-20 seconds)');
console.log('  → Verify: Look for success messages');
console.log();
console.log('Step 4: Execute Alignment Script (Column Additions)');
console.log('  → Click "New Query" again');
console.log('  → Copy contents of: alignment_migration.sql');
console.log('  → Paste into SQL Editor');
console.log('  → Click "Run" button');
console.log('  → Wait for completion (should take 5-15 seconds)');
console.log('  → Verify: Look for success messages');
console.log();
console.log('='.repeat(80));
console.log('ALTERNATIVE: Use Provided Shell Script');
console.log('='.repeat(80));
console.log();
console.log('I am creating a helper script that will display the SQL content');
console.log('for easy copying. Run:');
console.log();
console.log('  bash /app/show_migration_sql.sh');
console.log();
console.log('='.repeat(80));
console.log('VERIFICATION');
console.log('='.repeat(80));
console.log();
console.log('After running all migrations, verify with:');
console.log();
console.log('  node /app/compare_database_schema.mjs');
console.log();
console.log('This will re-analyze and show if all tables and columns are now aligned.');
console.log();
console.log('='.repeat(80));

// Create a helper script
const helperScript = `#!/bin/bash
# Migration SQL Display Helper
# This script displays migration SQL for easy copying

echo "================================================================================"
echo "MIGRATION SCRIPT VIEWER"
echo "================================================================================"
echo ""
echo "Select which migration script to view:"
echo ""
echo "1) migration_script_step1_complete_schema.sql (2,234 lines)"
echo "2) migration_script_step2_enhanced_schema.sql (800+ lines)"  
echo "3) alignment_migration.sql (520 lines)"
echo "4) View all files info"
echo "5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
  1)
    echo ""
    echo "================================================================================"
    echo "STEP 1: COMPLETE SCHEMA MIGRATION"
    echo "================================================================================"
    echo ""
    echo "File: /app/database/migration_script_step1_complete_schema.sql"
    echo "Size: $(wc -l /app/database/migration_script_step1_complete_schema.sql | awk '{print $1}') lines"
    echo ""
    echo "Press ENTER to display content (Ctrl+C to cancel)..."
    read
    cat /app/database/migration_script_step1_complete_schema.sql
    ;;
  2)
    echo ""
    echo "================================================================================"
    echo "STEP 2: ENHANCED SCHEMA MIGRATION"
    echo "================================================================================"
    echo ""
    echo "File: /app/database/migration_script_step2_enhanced_schema.sql"
    echo "Size: $(wc -l /app/database/migration_script_step2_enhanced_schema.sql | awk '{print $1}') lines"
    echo ""
    echo "Press ENTER to display content (Ctrl+C to cancel)..."
    read
    cat /app/database/migration_script_step2_enhanced_schema.sql
    ;;
  3)
    echo ""
    echo "================================================================================"
    echo "ALIGNMENT MIGRATION (Column Additions)"
    echo "================================================================================"
    echo ""
    echo "File: /app/database/alignment_migration.sql"
    echo "Size: $(wc -l /app/database/alignment_migration.sql | awk '{print $1}') lines"
    echo ""
    echo "Press ENTER to display content (Ctrl+C to cancel)..."
    read
    cat /app/database/alignment_migration.sql
    ;;
  4)
    echo ""
    echo "================================================================================"
    echo "ALL MIGRATION FILES INFO"
    echo "================================================================================"
    echo ""
    ls -lh /app/database/*.sql
    echo ""
    echo "To view a specific file, use:"
    echo "  cat /app/database/[filename]"
    echo ""
    echo "To copy to clipboard (if you have xclip):"
    echo "  cat /app/database/[filename] | xclip -selection clipboard"
    ;;
  5)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid choice"
    ;;
esac
`;

fs.writeFileSync('/app/show_migration_sql.sh', helperScript);
fs.chmodSync('/app/show_migration_sql.sh', '755');

console.log('✅ Helper script created: /app/show_migration_sql.sh');
console.log();
console.log('='.repeat(80));
console.log('READY TO PROCEED');
console.log('='.repeat(80));
console.log();
console.log('Option 1: Run migrations manually in Supabase SQL Editor (Recommended)');
console.log('Option 2: Use helper script to view SQL: bash /app/show_migration_sql.sh');
console.log();
console.log('Once migrations are complete, run verification:');
console.log('  node /app/compare_database_schema.mjs');
console.log();
