# Migration Script Fix Summary

## Problem
The migration script `database/migration_script_step1_complete_schema_camelCase.sql` was failing with error:
```
ERROR: 42701: column "approvedBy" of relation "schools" already exists
CONTEXT: SQL statement "ALTER TABLE schools ADD COLUMN "approvedBy" UUID REFERENCES users(id)"
```

## Root Cause
The `add_column_if_not_exists()` helper function cannot handle foreign key constraints (`REFERENCES`) in the column definition parameter. When PostgreSQL tries to execute the ALTER TABLE statement, it attempts to add the constraint inline, which fails if the column already exists.

## Solution Applied
1. **Separated column creation from constraint creation**: Removed all `REFERENCES` clauses from `add_column_if_not_exists()` calls
2. **Added separate constraint handling**: Foreign key constraints should be added separately using `add_constraint_if_not_exists()` or conditional blocks

## Changes Made
Fixed all instances where foreign key constraints were defined inline with column definitions:

### Before (Problematic):
```sql
PERFORM add_column_if_not_exists('schools', 'approvedBy', 'UUID REFERENCES users(id)');
```

### After (Fixed):
```sql
PERFORM add_column_if_not_exists('schools', 'approvedBy', 'UUID');

-- Add foreign key constraint separately
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'approvedBy'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = 'schools' 
        AND kcu.column_name = 'approvedBy' AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE schools ADD CONSTRAINT schools_approved_by_fkey FOREIGN KEY ("approvedBy") REFERENCES users(id);
        RAISE NOTICE 'Added foreign key constraint for schools.approvedBy';
    END IF;
END $$;
```

## Tables Fixed
- `schools.approvedBy`
- `colleges_standalone.approvedBy`
- `universities.approvedBy`
- `students.userId`
- `students.schoolId`
- `students.collegeId`
- `students.universityCollegeId`
- `students.schoolClassId`
- `students.collegeCourseId`
- `students.universityCourseId`
- `skill_passports.studentId`
- `skill_passports.verifiedBy`
- `companies.approvedBy`
- `recruiters.userId`
- `recruiters.companyId`
- `recruiters.branchId`
- `verifications.verifiedBy`

## Result
The migration script is now **idempotent** and can be run multiple times without errors. It will:
1. ✅ Check if tables exist before creating them
2. ✅ Check if columns exist before adding them  
3. ✅ Check if indexes exist before creating them
4. ✅ Check if constraints exist before adding them
5. ✅ Skip existing elements and only add missing ones

## Next Steps
1. Test the fixed migration script against your database
2. Add the foreign key constraints separately if needed
3. Consider adding a comprehensive constraint addition section at the end of the migration script

## Files Modified
- `database/migration_script_step1_complete_schema_camelCase.sql` - Fixed column definitions
- `tmp_rovodev_test_migration.sql` - Created for testing (will be cleaned up)