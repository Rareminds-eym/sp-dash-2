#!/usr/bin/env node
/**
 * Database Schema Comparison Tool
 * Compares actual Supabase database structure with migration scripts
 * Generates alignment report and updated migration script
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tables to analyze
const TABLES_TO_ANALYZE = [
  'users', 'students', 'skill_passports', 'universities', 'recruiters',
  'audit_logs', 'verifications', 'metrics_snapshots', 'schools',
  'school_classes', 'school_educators', 'school_educator_class_assignments',
  'colleges_standalone', 'college_courses', 'college_lecturers',
  'college_lecturer_course_assignments', 'university_colleges',
  'university_courses', 'university_lecturers',
  'university_lecturer_course_assignments', 'companies', 'company_branches',
  'permissions', 'role_permissions', 'student_enrollments', 'colleges'
];

async function getTableColumns(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      return { error: error.message, columns: [] };
    }
    
    if (data && data.length > 0) {
      return { error: null, columns: Object.keys(data[0]) };
    }
    
    // Empty table - try to insert and rollback to get schema
    return { error: null, columns: [] };
  } catch (err) {
    return { error: err.message, columns: [] };
  }
}

function parseMigrationScripts() {
  console.log('📖 Parsing migration scripts...\n');
  
  const migrations = {
    step1: fs.readFileSync('/app/database/migration_script_step1_complete_schema.sql', 'utf8'),
    step2: fs.readFileSync('/app/database/migration_script_step2_enhanced_schema.sql', 'utf8')
  };
  
  const expectedSchema = {
    tables: {},
    enums: [],
    functions: [],
    triggers: [],
    indexes: []
  };
  
  // Parse CREATE TABLE statements
  const tableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-z_]+)\s*\(([\s\S]*?)\);/gi;
  const alterTableRegex = /ALTER TABLE\s+([a-z_]+)\s+ADD COLUMN\s+([a-z_]+)\s+([^,;]+)/gi;
  const enumRegex = /CREATE TYPE\s+([a-z_]+)\s+AS ENUM/gi;
  const functionRegex = /CREATE OR REPLACE FUNCTION\s+([a-z_]+)\s*\(/gi;
  const triggerRegex = /CREATE TRIGGER\s+([a-z_]+)/gi;
  const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(IF NOT EXISTS\s+)?([a-z_]+)/gi;
  
  // Combine both migration scripts
  const fullMigration = migrations.step1 + '\n\n' + migrations.step2;
  
  // Extract tables
  let match;
  while ((match = tableRegex.exec(fullMigration)) !== null) {
    const tableName = match[1];
    const tableContent = match[2];
    
    // Parse columns from table definition
    const columns = [];
    const columnLines = tableContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('--'));
    
    columnLines.forEach(line => {
      const columnMatch = line.trim().match(/^([a-z_]+)\s+([A-Z]+[^,]*)/);
      if (columnMatch && !line.trim().startsWith('CONSTRAINT') && !line.trim().startsWith('PRIMARY') && !line.trim().startsWith('FOREIGN')) {
        columns.push({
          name: columnMatch[1],
          type: columnMatch[2].split(',')[0].trim()
        });
      }
    });
    
    expectedSchema.tables[tableName] = { columns };
  }
  
  // Extract ALTER TABLE columns
  alterTableRegex.lastIndex = 0;
  while ((match = alterTableRegex.exec(fullMigration)) !== null) {
    const tableName = match[1];
    const columnName = match[2];
    const columnType = match[3].trim();
    
    if (!expectedSchema.tables[tableName]) {
      expectedSchema.tables[tableName] = { columns: [] };
    }
    
    // Check if column already exists in the table definition
    const exists = expectedSchema.tables[tableName].columns.some(c => c.name === columnName);
    if (!exists) {
      expectedSchema.tables[tableName].columns.push({
        name: columnName,
        type: columnType
      });
    }
  }
  
  // Extract enums
  enumRegex.lastIndex = 0;
  while ((match = enumRegex.exec(fullMigration)) !== null) {
    expectedSchema.enums.push(match[1]);
  }
  
  // Extract functions
  functionRegex.lastIndex = 0;
  while ((match = functionRegex.exec(fullMigration)) !== null) {
    expectedSchema.functions.push(match[1]);
  }
  
  // Extract triggers
  triggerRegex.lastIndex = 0;
  while ((match = triggerRegex.exec(fullMigration)) !== null) {
    expectedSchema.triggers.push(match[1]);
  }
  
  // Extract indexes
  indexRegex.lastIndex = 0;
  while ((match = indexRegex.exec(fullMigration)) !== null) {
    expectedSchema.indexes.push(match[3]);
  }
  
  return expectedSchema;
}

async function compareDatabaseWithMigrations() {
  console.log('='.repeat(80));
  console.log('DATABASE vs MIGRATION SCRIPTS COMPARISON');
  console.log('='.repeat(80));
  console.log();
  
  // Parse migration scripts
  const expectedSchema = parseMigrationScripts();
  
  console.log(`📋 Expected Schema Summary:`);
  console.log(`   Tables: ${Object.keys(expectedSchema.tables).length}`);
  console.log(`   Enums: ${expectedSchema.enums.length}`);
  console.log(`   Functions: ${expectedSchema.functions.length}`);
  console.log(`   Triggers: ${expectedSchema.triggers.length}`);
  console.log(`   Indexes: ${expectedSchema.indexes.length}`);
  console.log();
  
  // Analyze each table
  const comparison = {
    tables: {},
    missingTables: [],
    extraTables: [],
    columnMismatches: {},
    summary: {
      tablesInSync: 0,
      tablesNeedUpdate: 0,
      missingColumns: 0,
      extraColumns: 0
    }
  };
  
  console.log('='.repeat(80));
  console.log('TABLE-BY-TABLE COMPARISON');
  console.log('='.repeat(80));
  console.log();
  
  // Check each expected table
  for (const tableName of Object.keys(expectedSchema.tables)) {
    console.log(`\n📊 Analyzing: ${tableName}`);
    console.log('-'.repeat(80));
    
    const { error, columns: actualColumns } = await getTableColumns(tableName);
    
    if (error) {
      console.log(`❌ ERROR: ${error}`);
      comparison.missingTables.push(tableName);
      continue;
    }
    
    const expectedColumns = expectedSchema.tables[tableName].columns;
    
    console.log(`   Expected columns: ${expectedColumns.length}`);
    console.log(`   Actual columns: ${actualColumns.length}`);
    
    const expectedColNames = expectedColumns.map(c => c.name);
    const missing = expectedColNames.filter(c => !actualColumns.includes(c));
    const extra = actualColumns.filter(c => !expectedColNames.includes(c));
    
    if (missing.length > 0) {
      console.log(`   ⚠️  Missing columns (${missing.length}): ${missing.join(', ')}`);
      comparison.columnMismatches[tableName] = comparison.columnMismatches[tableName] || {};
      comparison.columnMismatches[tableName].missing = missing;
      comparison.summary.missingColumns += missing.length;
      comparison.summary.tablesNeedUpdate++;
    }
    
    if (extra.length > 0) {
      console.log(`   ℹ️  Extra columns (${extra.length}): ${extra.join(', ')}`);
      comparison.columnMismatches[tableName] = comparison.columnMismatches[tableName] || {};
      comparison.columnMismatches[tableName].extra = extra;
      comparison.summary.extraColumns += extra.length;
    }
    
    if (missing.length === 0 && extra.length === 0) {
      console.log(`   ✅ Table schema matches migration script`);
      comparison.summary.tablesInSync++;
    }
    
    comparison.tables[tableName] = {
      exists: true,
      expectedColumns: expectedColumns.length,
      actualColumns: actualColumns.length,
      missingColumns: missing,
      extraColumns: extra
    };
  }
  
  // Check for tables in database that aren't in migrations
  for (const tableName of TABLES_TO_ANALYZE) {
    if (!expectedSchema.tables[tableName]) {
      const { error } = await getTableColumns(tableName);
      if (!error) {
        comparison.extraTables.push(tableName);
        console.log(`\n⚠️  Table '${tableName}' exists in database but not in migration scripts`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`✅ Tables in sync: ${comparison.summary.tablesInSync}`);
  console.log(`⚠️  Tables needing updates: ${comparison.summary.tablesNeedUpdate}`);
  console.log(`❌ Missing tables: ${comparison.missingTables.length}`);
  console.log(`ℹ️  Extra tables: ${comparison.extraTables.length}`);
  console.log(`⚠️  Missing columns (total): ${comparison.summary.missingColumns}`);
  console.log(`ℹ️  Extra columns (total): ${comparison.summary.extraColumns}`);
  
  if (comparison.missingTables.length > 0) {
    console.log(`\n❌ Missing Tables: ${comparison.missingTables.join(', ')}`);
  }
  
  if (comparison.extraTables.length > 0) {
    console.log(`\nℹ️  Extra Tables: ${comparison.extraTables.join(', ')}`);
  }
  
  // Save detailed comparison
  fs.writeFileSync(
    '/app/database_comparison_report.json',
    JSON.stringify({ expectedSchema, comparison, timestamp: new Date().toISOString() }, null, 2)
  );
  
  console.log('\n✅ Detailed comparison saved to: database_comparison_report.json');
  
  // Generate alignment migration script
  await generateAlignmentScript(comparison, expectedSchema);
  
  return comparison;
}

async function generateAlignmentScript(comparison, expectedSchema) {
  console.log('\n' + '='.repeat(80));
  console.log('GENERATING ALIGNMENT MIGRATION SCRIPT');
  console.log('='.repeat(80));
  console.log();
  
  let migrationScript = `-- ============================================================
-- DATABASE ALIGNMENT MIGRATION SCRIPT
-- Generated: ${new Date().toISOString()}
-- 
-- This script aligns the Supabase database with migration scripts
-- ============================================================

`;
  
  let changesCount = 0;
  
  // Generate ALTER TABLE statements for missing columns
  for (const [tableName, mismatch] of Object.entries(comparison.columnMismatches)) {
    if (mismatch.missing && mismatch.missing.length > 0) {
      migrationScript += `\n-- Table: ${tableName}\n`;
      migrationScript += `-- Missing columns: ${mismatch.missing.length}\n\n`;
      
      for (const columnName of mismatch.missing) {
        const expectedCol = expectedSchema.tables[tableName].columns.find(c => c.name === columnName);
        if (expectedCol) {
          migrationScript += `DO $$ \nBEGIN\n`;
          migrationScript += `    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${tableName}' AND column_name='${columnName}') THEN\n`;
          migrationScript += `        ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${expectedCol.type};\n`;
          migrationScript += `    END IF;\n`;
          migrationScript += `END $$;\n\n`;
          changesCount++;
        }
      }
    }
  }
  
  if (changesCount === 0) {
    migrationScript += `-- ✅ No alignment changes needed - database is in sync with migration scripts\n`;
    console.log('✅ Database is already in sync with migration scripts!');
  } else {
    console.log(`📝 Generated ${changesCount} alignment statements`);
  }
  
  migrationScript += `\n-- ============================================================\n`;
  migrationScript += `-- END OF ALIGNMENT MIGRATION\n`;
  migrationScript += `-- ============================================================\n`;
  
  fs.writeFileSync('/app/database/alignment_migration.sql', migrationScript);
  console.log('✅ Alignment migration script saved to: database/alignment_migration.sql');
  
  return migrationScript;
}

// Run the comparison
compareDatabaseWithMigrations()
  .then(comparison => {
    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('Generated files:');
    console.log('  1. database_comparison_report.json - Detailed comparison');
    console.log('  2. database/alignment_migration.sql - Migration script to align database');
    console.log();
  })
  .catch(err => {
    console.error('❌ Analysis failed:', err);
    process.exit(1);
  });
