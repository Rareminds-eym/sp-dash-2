#!/usr/bin/env node
/**
 * Comprehensive fix for PostgreSQL case sensitivity
 * Adds double quotes around ALL camelCase column names
 */

import * as fs from 'fs';

// List of all camelCase columns that need quoting
const camelCaseColumns = [
  'supabaseAuthId', 'firstName', 'lastName', 'entityType', 'entityId',
  'accountStatus', 'lastPasswordChange', 'profileImageUrl', 'lastLogin',
  'createdBy', 'createdAt', 'updatedAt', 'universityType', 'approvalStatus',
  'approvedBy', 'approvedAt', 'totalColleges', 'totalCourses', 'totalLecturers',
  'totalStudents', 'studentType', 'schoolId', 'collegeId', 'universityCollegeId',
  'schoolClassId', 'collegeCourseId', 'universityCourseId', 'enrollmentNumber',
  'guardianName', 'guardianPhone', 'guardianEmail', 'guardianRelation',
  'dateOfBirth', 'bloodGroup', 'enrollmentDate', 'expectedGraduationDate',
  'currentCgpa', 'userId', 'nsqfLevel', 'workExperience', 'verifiedBy',
  'verifiedAt', 'aiVerified', 'aiVerificationScore', 'verificationStatus',
  'isActive', 'userCount', 'companyId', 'branchId', 'employeeId',
  'dateOfJoining', 'isHqRecruiter', 'verificationType', 'verificationNotes',
  'verificationData', 'totalSchools', 'totalCompanies', 'ipAddress',
  'userAgent', 'oldValues', 'newValues', 'resourceType', 'resourceId',
  'parentId', 'className', 'classCode', 'academicYear', 'totalEducators',
  'courseName', 'courseCode', 'courseDuration', 'degreeType', 'specialization',
  'availableSeats', 'startDate', 'endDate', 'experienceYears', 'isHod',
  'assignedAt', 'assignedBy', 'roleName', 'roleDescription', 'isSystemRole',
  'permissionName', 'permissionKey', 'permissionDescription', 'actionType',
  'companyName', 'companyType', 'registrationNumber', 'panNumber', 'gstNumber',
  'totalBranches', 'totalEmployees', 'branchName', 'branchCode', 'branchType',
  'isHeadquarters', 'managerId', 'enrollmentStatus', 'enrolledAt', 'enrolledBy',
  'completionDate', 'withdrawalDate', 'transferReason', 'previousClassId',
  'newClassId', 'transferredAt', 'transferredBy'
];

function addQuotesToCamelCase(sql) {
  let result = sql;
  
  camelCaseColumns.forEach(colName => {
    // Create regex patterns for different contexts
    const patterns = [
      // In column definitions: columnName TYPE
      new RegExp(`\\b${colName}\\s+(VARCHAR|INTEGER|TEXT|BOOLEAN|UUID|TIMESTAMP|DATE|DECIMAL|JSONB|INET|BIGINT|NUMERIC)`, 'gi'),
      // In ADD COLUMN: ADD COLUMN columnName
      new RegExp(`ADD COLUMN ${colName}\\b`, 'gi'),
      // After comma in column list: , columnName
      new RegExp(`,\\s*${colName}\\b`, 'g'),
      // Start of line or after opening paren: (columnName or \n  columnName
      new RegExp(`([\\(\\n]\\s*)${colName}\\b`, 'g'),
    ];
    
    patterns.forEach((pattern, index) => {
      if (index === 0) {
        // Column definition pattern
        result = result.replace(pattern, (match) => {
          return match.replace(new RegExp(`\\b${colName}\\b`, 'g'), `"${colName}"`);
        });
      } else if (index === 1) {
        // ADD COLUMN pattern
        result = result.replace(pattern, `ADD COLUMN "${colName}"`);
      } else if (index === 2) {
        // After comma pattern
        result = result.replace(pattern, `, "${colName}"`);
      } else if (index === 3) {
        // After paren or newline
        result = result.replace(pattern, (match, prefix) => {
          return `${prefix}"${colName}"`;
        });
      }
    });
  });
  
  return result;
}

function fixColumnNameChecks(sql) {
  let result = sql;
  
  // Fix all column_name='camelCase' to column_name='lowercase'
  camelCaseColumns.forEach(colName => {
    const lowercase = colName.toLowerCase();
    const pattern = new RegExp(`column_name='${colName}'`, 'gi');
    result = result.replace(pattern, `column_name='${lowercase}'`);
  });
  
  return result;
}

console.log('='.repeat(80));
console.log('COMPREHENSIVE POSTGRESQL CASE SENSITIVITY FIX');
console.log('='.repeat(80));
console.log();

const files = [
  '/app/database/migration_script_step1_complete_schema_camelCase.sql',
  '/app/database/migration_script_step2_enhanced_schema_camelCase.sql',
  '/app/database/alignment_migration_camelCase.sql'
];

files.forEach(filePath => {
  console.log(`📝 Processing: ${filePath.split('/').pop()}`);
  
  // Restore from backup if it exists
  const backupPath = filePath + '.backup';
  if (fs.existsSync(backupPath)) {
    const backup = fs.readFileSync(backupPath, 'utf8');
    fs.writeFileSync(filePath, backup);
    console.log(`   📦 Restored from backup`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Apply fixes
  let fixed = addQuotesToCamelCase(content);
  fixed = fixColumnNameChecks(fixed);
  
  // Save
  fs.writeFileSync(filePath, fixed);
  
  console.log(`   ✅ Fixed and saved`);
  console.log();
});

console.log('='.repeat(80));
console.log('✅ COMPREHENSIVE FIX COMPLETE!');
console.log('='.repeat(80));
console.log();
console.log('Changes applied:');
console.log('1. ✅ All camelCase column names now wrapped in double quotes');
console.log('2. ✅ All IF NOT EXISTS checks use lowercase column names');
console.log('3. ✅ Works in CREATE TABLE and ALTER TABLE statements');
console.log();
console.log('Example:');
console.log('  Before: ADD COLUMN firstName VARCHAR(100)');
console.log('  After:  ADD COLUMN "firstName" VARCHAR(100)');
console.log();
console.log('  Before: column_name=\'firstName\'');
console.log('  After:  column_name=\'firstname\'');
console.log();
console.log('Ready to run in Supabase SQL Editor!');
console.log();
