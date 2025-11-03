#!/usr/bin/env node
/**
 * Fix camelCase migration scripts for PostgreSQL case sensitivity
 * PostgreSQL converts unquoted identifiers to lowercase, so we need to:
 * 1. Check for lowercase column names in IF NOT EXISTS
 * 2. Use double quotes around column names to preserve camelCase
 */

import * as fs from 'fs';

function fixCaseSensitivity(sql) {
  // Pattern: column_name='columnName' should be column_name='columnname' (lowercase)
  // Because PostgreSQL stores identifiers as lowercase
  
  const lines = sql.split('\n');
  const fixed = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Fix IF NOT EXISTS checks - convert the column name in quotes to lowercase
    // Match: column_name='camelCaseName'
    const columnCheckMatch = line.match(/column_name='([^']+)'/);
    if (columnCheckMatch) {
      const originalName = columnCheckMatch[1];
      const lowercaseName = originalName.toLowerCase();
      line = line.replace(`column_name='${originalName}'`, `column_name='${lowercaseName}'`);
    }
    
    // Add double quotes around column names in ALTER TABLE ADD COLUMN
    // Match: ADD COLUMN columnName TYPE
    const addColumnMatch = line.match(/ADD COLUMN ([a-z][a-zA-Z0-9]*)\s+(VARCHAR|INTEGER|TEXT|BOOLEAN|UUID|TIMESTAMP|DATE|DECIMAL|JSONB|INET|BIGINT|NUMERIC)/i);
    if (addColumnMatch) {
      const columnName = addColumnMatch[1];
      const dataType = addColumnMatch[2];
      // Replace with quoted column name
      line = line.replace(
        `ADD COLUMN ${columnName} ${dataType}`,
        `ADD COLUMN "${columnName}" ${dataType}`
      );
    }
    
    fixed.push(line);
  }
  
  return fixed.join('\n');
}

console.log('='.repeat(80));
console.log('FIXING POSTGRESQL CASE SENSITIVITY IN MIGRATION SCRIPTS');
console.log('='.repeat(80));
console.log();

const files = [
  '/app/database/migration_script_step1_complete_schema_camelCase.sql',
  '/app/database/migration_script_step2_enhanced_schema_camelCase.sql',
  '/app/database/alignment_migration_camelCase.sql'
];

files.forEach(filePath => {
  console.log(`📝 Processing: ${filePath}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = fixCaseSensitivity(content);
  
  // Create backup
  fs.writeFileSync(filePath + '.backup', content);
  
  // Write fixed version
  fs.writeFileSync(filePath, fixed);
  
  console.log(`   ✅ Fixed and saved`);
  console.log(`   📦 Backup saved to: ${filePath}.backup`);
  console.log();
});

console.log('='.repeat(80));
console.log('✅ All files fixed!');
console.log('='.repeat(80));
console.log();
console.log('Changes made:');
console.log('1. Column name checks now use lowercase (e.g., column_name=\'approvedby\')');
console.log('2. ALTER TABLE statements now use double quotes (e.g., ADD COLUMN "approvedBy")');
console.log();
console.log('You can now re-run the migration scripts in Supabase SQL Editor.');
console.log();
