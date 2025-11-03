#!/usr/bin/env node
/**
 * Migration Script Converter: snake_case to camelCase
 * Converts all column names in migration scripts to camelCase
 */

import * as fs from 'fs';
import * as path from 'path';

// Convert snake_case to camelCase
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

// Pattern to match column definitions and references
const columnPatterns = [
  // Column definitions in CREATE/ALTER TABLE
  /\b([a-z_]+)\s+(VARCHAR|INTEGER|TEXT|BOOLEAN|UUID|TIMESTAMP|DATE|DECIMAL|JSONB|INET|BIGINT|NUMERIC)/gi,
  // Column names in REFERENCES
  /REFERENCES\s+([a-z_]+)\(([a-z_]+)\)/gi,
  // Column names in indexes
  /ON\s+([a-z_]+)\s*\(([a-z_,\s]+)\)/gi,
  // Column names in UPDATE statements  
  /UPDATE\s+([a-z_]+)\s+SET\s+([a-z_]+)\s*=/gi,
  // Column names in INSERT statements
  /INSERT INTO\s+([a-z_]+)\s*\(([a-z_,\s]+)\)/gi,
  // Column names in WHERE clauses
  /WHERE\s+([a-z_]+)\s*=/gi,
  // Column names in SELECT statements
  /SELECT\s+([a-z_,\s]+)\s+FROM/gi,
];

function convertColumnsToCamelCase(sql) {
  let converted = sql;
  
  // List of column names to convert (common ones)
  const columnsToConvert = [
    'supabase_auth_id',
    'first_name',
    'last_name',
    'entity_type',
    'entity_id',
    'account_status',
    'last_password_change',
    'profile_image_url',
    'last_login',
    'created_by',
    'created_at',
    'updated_at',
    'university_type',
    'approval_status',
    'approved_by',
    'approved_at',
    'total_colleges',
    'total_courses',
    'total_lecturers',
    'total_students',
    'student_type',
    'school_id',
    'college_id',
    'university_college_id',
    'school_class_id',
    'college_course_id',
    'university_course_id',
    'enrollment_number',
    'guardian_name',
    'guardian_phone',
    'guardian_email',
    'guardian_relation',
    'date_of_birth',
    'blood_group',
    'enrollment_date',
    'expected_graduation_date',
    'current_cgpa',
    'user_id',
    'nsqf_level',
    'work_experience',
    'verified_by',
    'verified_at',
    'ai_verified',
    'ai_verification_score',
    'verification_status',
    'is_active',
    'user_count',
    'company_id',
    'branch_id',
    'employee_id',
    'date_of_joining',
    'is_hq_recruiter',
    'verification_type',
    'verification_notes',
    'verification_data',
    'total_schools',
    'total_companies',
    'ip_address',
    'user_agent',
    'old_values',
    'new_values',
    'resource_type',
    'resource_id',
    'parent_id',
    'is_active_column',
    'class_name',
    'class_code',
    'academic_year',
    'course_name',
    'course_code',
    'course_duration',
    'degree_type',
    'specialization',
    'total_students',
    'available_seats',
    'start_date',
    'end_date',
    'employee_id',
    'department',
    'designation',
    'qualification',
    'experience_years',
    'is_hod',
    'assigned_at',
    'assigned_by',
    'role_name',
    'role_description',
    'is_system_role',
    'permission_name',
    'permission_key',
    'permission_description',
    'resource_type',
    'action_type',
    'company_name',
    'company_type',
    'registration_number',
    'pan_number',
    'gst_number',
    'total_branches',
    'total_employees',
    'branch_name',
    'branch_code',
    'branch_type',
    'is_headquarters',
    'manager_id',
    'enrollment_status',
    'enrolled_at',
    'enrolled_by',
    'completion_date',
    'withdrawal_date',
    'transfer_reason',
    'previous_class_id',
    'new_class_id',
    'transferred_at',
    'transferred_by',
  ];
  
  // Convert each column name
  columnsToConvert.forEach(snakeCase => {
    const camelCase = snakeToCamel(snakeCase);
    
    // Replace in various contexts with word boundaries
    const patterns = [
      new RegExp(`\\b${snakeCase}\\b(?=\\s+(VARCHAR|INTEGER|TEXT|BOOLEAN|UUID|TIMESTAMP|DATE|DECIMAL|JSONB|INET|BIGINT|NUMERIC))`, 'gi'),
      new RegExp(`\\b${snakeCase}\\b(?=\\s*=)`, 'gi'),
      new RegExp(`\\b${snakeCase}\\b(?=\\s*,)`, 'gi'),
      new RegExp(`\\b${snakeCase}\\b(?=\\s*\\))`, 'gi'),
      new RegExp(`\\b${snakeCase}\\b(?=\\s+REFERENCES)`, 'gi'),
      new RegExp(`\\(${snakeCase}\\)`, 'gi'),
      new RegExp(`'${snakeCase}'`, 'gi'),
      new RegExp(`table_name='${snakeCase}'`, 'gi'),
      new RegExp(`column_name='${snakeCase}'`, 'gi'),
      new RegExp(`ADD COLUMN ${snakeCase}\\b`, 'gi'),
    ];
    
    patterns.forEach(pattern => {
      converted = converted.replace(pattern, (match) => {
        return match.replace(new RegExp(snakeCase, 'gi'), camelCase);
      });
    });
  });
  
  return converted;
}

function convertFile(inputPath, outputPath) {
  console.log(`\n📝 Converting: ${path.basename(inputPath)}`);
  console.log(`   Reading from: ${inputPath}`);
  
  const content = fs.readFileSync(inputPath, 'utf8');
  const converted = convertColumnsToCamelCase(content);
  
  fs.writeFileSync(outputPath, converted);
  
  console.log(`   ✅ Saved to: ${outputPath}`);
  console.log(`   Original lines: ${content.split('\n').length}`);
  console.log(`   Converted lines: ${converted.split('\n').length}`);
  
  return { original: content.length, converted: converted.length };
}

console.log('='.repeat(80));
console.log('MIGRATION SCRIPT CONVERTER: snake_case → camelCase');
console.log('='.repeat(80));
console.log();

const files = [
  {
    input: '/app/database/migration_script_step1_complete_schema.sql',
    output: '/app/database/migration_script_step1_complete_schema_camelCase.sql'
  },
  {
    input: '/app/database/migration_script_step2_enhanced_schema.sql',
    output: '/app/database/migration_script_step2_enhanced_schema_camelCase.sql'
  },
  {
    input: '/app/database/alignment_migration.sql',
    output: '/app/database/alignment_migration_camelCase.sql'
  }
];

const results = [];

files.forEach(file => {
  try {
    const result = convertFile(file.input, file.output);
    results.push({ file: path.basename(file.output), ...result });
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('CONVERSION SUMMARY');
console.log('='.repeat(80));
console.log();

results.forEach(r => {
  console.log(`✅ ${r.file}`);
  console.log(`   Characters: ${r.original} → ${r.converted}`);
});

console.log();
console.log('🎉 Conversion complete!');
console.log();
console.log('New camelCase files created:');
files.forEach(f => console.log(`   • ${f.output}`));
console.log();
