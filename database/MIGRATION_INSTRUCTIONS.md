# Database Migration Instructions

## Overview
This guide provides step-by-step instructions for migrating your existing Supabase database with the new schema enhancements **without losing any existing data**.

## Migration Files
1. **migration_script_step1_complete_schema.sql** - Applies the complete base schema (schools, companies, RBAC, enhanced columns)
2. **migration_script_step2_enhanced_schema.sql** - Applies V2 enhancements (unified colleges, enrollment system, functions)

## Pre-Migration Checklist
- [ ] Backup your current database
- [ ] Verify Supabase connection is working
- [ ] Check that all existing API endpoints are functioning
- [ ] Note down current table counts for verification

## Migration Steps

### Step 1: Backup Your Database (CRITICAL)

**Option A: Using Supabase Dashboard**
1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Backups**
3. Create a manual backup before proceeding

**Option B: Using pg_dump (if you have direct access)**
```bash
pg_dump -h your-supabase-host -U postgres -d your-database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply Migration Script - Step 1

1. **Open Supabase SQL Editor**
   - Go to your Supabase Dashboard
   - Click on **SQL Editor** in the left sidebar
   - Click **New Query**

2. **Copy and Paste Migration Script**
   - Open `/app/database/migration_script_step1_complete_schema.sql`
   - Copy the entire contents
   - Paste into the Supabase SQL Editor

3. **Execute the Script**
   - Click **Run** button
   - Wait for execution to complete (should take 5-30 seconds)
   - Check for success messages in the output

4. **Verify Step 1 Completion**
   - Look for the message: "STEP 1: RAREMINDS COMPLETE SCHEMA MIGRATION COMPLETED"
   - Check that new tables are created (schools, companies, permissions, etc.)
   - Verify existing tables still have all their data

### Step 3: Apply Migration Script - Step 2

1. **Open New Query in Supabase SQL Editor**
   - Click **New Query** again

2. **Copy and Paste Migration Script**
   - Open `/app/database/migration_script_step2_enhanced_schema.sql`
   - Copy the entire contents
   - Paste into the Supabase SQL Editor

3. **Execute the Script**
   - Click **Run** button
   - Wait for execution to complete (should take 5-20 seconds)
   - Check for success messages in the output

4. **Verify Step 2 Completion**
   - Look for the message: "STEP 2: RAREMINDS ENHANCED SCHEMA V2 MIGRATION COMPLETED"
   - Check that unified `colleges` table is created
   - Check that `student_enrollments` table is created
   - Verify new functions and views are created

### Step 4: Post-Migration Verification

Run the following verification queries in SQL Editor:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify data counts (should match your pre-migration counts)
SELECT 
    'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'students', COUNT(*) FROM students
UNION ALL
SELECT 'skill_passports', COUNT(*) FROM skill_passports
UNION ALL
SELECT 'universities', COUNT(*) FROM universities
UNION ALL
SELECT 'recruiters', COUNT(*) FROM recruiters
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'verifications', COUNT(*) FROM verifications
UNION ALL
SELECT 'metrics_snapshots', COUNT(*) FROM metrics_snapshots;

-- Check new tables are created
SELECT 
    'schools' as table_name, COUNT(*) as count FROM schools
UNION ALL
SELECT 'colleges', COUNT(*) FROM colleges
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL
SELECT 'role_permissions', COUNT(*) FROM role_permissions
UNION ALL
SELECT 'student_enrollments', COUNT(*) FROM student_enrollments;

-- Verify indexes are created
SELECT 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Verify triggers are created
SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Verify functions are created
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### Step 5: Test Your Application

1. **Restart your Next.js application** (if needed)
   ```bash
   sudo supervisorctl restart nextjs
   ```

2. **Test existing endpoints**
   - Login functionality
   - Students list
   - Skill passports list
   - Universities list
   - Recruiters list
   - Dashboard metrics

3. **Verify no errors in logs**
   ```bash
   tail -n 100 /var/log/supervisor/nextjs.err.log
   ```

## What Gets Added

### New Tables
- **schools** - School entities and management
- **school_classes** - Class structure for schools
- **school_educators** - Educator management for schools
- **school_educator_class_assignments** - Educator-to-class assignments
- **colleges_standalone** - Standalone college entities
- **college_courses** - Course structure for colleges
- **college_lecturers** - Lecturer management for colleges
- **college_lecturer_course_assignments** - Lecturer-to-course assignments
- **university_colleges** - University department structure
- **university_courses** - Course structure for universities
- **university_lecturers** - Lecturer management for universities
- **university_lecturer_course_assignments** - Lecturer-to-course assignments
- **colleges** (unified) - Combines standalone and university colleges
- **companies** - Company entities for recruitment
- **company_branches** - Branch structure for companies
- **permissions** - RBAC permission definitions
- **role_permissions** - Role-to-permission mappings
- **student_enrollments** - Student enrollment history tracking

### Enhanced Existing Tables
New columns added to existing tables (all nullable to preserve data):

**users**
- supabase_auth_id, first_name, last_name, entity_type, entity_id, account_status
- last_password_change, profile_image_url, created_by, last_login

**universities**
- university_type, approval_status, approved_by, approved_at, account_status
- total_colleges, total_courses, total_lecturers, total_students

**students**
- student_type, school_id, college_id, university_college_id
- school_class_id, college_course_id, university_course_id
- enrollment_number, guardian fields, date_of_birth, gender, blood_group
- enrollment_date, expected_graduation_date, current_cgpa, user_id

**skill_passports**
- nsqf_level, certifications, work_experience, projects, achievements
- verified_by, verified_at, ai_verified, ai_verification_score

**recruiters**
- verification_status, is_active, user_count, user_id, company_id
- branch_id, employee_id, designation, department, date_of_joining
- is_hq_recruiter, account_status

**verifications**
- verification_type, verification_notes, verification_data
- verified_by, verified_at

**audit_logs**
- ip_address, user_agent, old_values, new_values
- resource_type, resource_id

**metrics_snapshots**
- total_schools, total_colleges, total_companies

### New Functions
- **update_updated_at_column()** - Auto-update timestamps
- **get_active_enrollment(student_id)** - Get student's current enrollment
- **transfer_student()** - Transfer student between classes/courses
- **update_entity_student_counts()** - Auto-update entity student counts
- **validate_one_active_enrollment()** - Ensure one active enrollment per student

### New Views
- **v_entity_overview** - Unified view of all entities (schools, colleges, universities, companies)
- **v_student_current_enrollment** - Current enrollment details for all students

### New Indexes (47+ performance indexes)
- Text search indexes (trigram for fuzzy search)
- Composite indexes for common queries
- Foreign key indexes for join optimization
- Status and filtering indexes
- Sorting indexes (DESC for latest first)

### New Triggers
- Auto-update `updated_at` for all tables
- Auto-update entity student counts on enrollment changes
- Validate one active enrollment per student

### New Enums
- **user_role** - Platform roles (platform_admin, school_admin, college_admin, etc.)
- **entity_type** - Entity types (school, college, university, company)
- **account_status** - Account statuses (active, inactive, suspended, pending)
- **approval_status** - Approval statuses (pending, approved, rejected)
- **student_type** - Student types (direct, school, college, university)
- **verification_status** - Verification statuses (pending, verified, rejected, in_review)
- **enrollment_status** - Enrollment statuses (active, completed, withdrawn, transferred, suspended)
- **college_type** - College types (standalone, university_department)

## Rollback Instructions (If Needed)

If something goes wrong, you can restore from backup:

**Option A: Using Supabase Dashboard**
1. Go to **Database** → **Backups**
2. Select the backup created before migration
3. Click **Restore**

**Option B: Using psql (if you have direct access)**
```bash
psql -h your-supabase-host -U postgres -d your-database < backup_file.sql
```

## Safety Features

✅ All scripts use `IF NOT EXISTS` for table creation
✅ All column additions check for existence before adding
✅ All constraints use `DROP IF EXISTS` before recreation
✅ Foreign key updates use exception handling
✅ Enum creation uses exception handling for duplicates
✅ Data migration uses `ON CONFLICT DO NOTHING` to prevent duplicates
✅ No DROP TABLE or TRUNCATE commands
✅ No data deletion or modification

## Common Issues and Solutions

### Issue 1: "relation already exists"
**Solution:** This is safe to ignore. The script detects existing objects and skips them.

### Issue 2: "foreign key violation"
**Solution:** The migration preserves all foreign key relationships. If you see this error, it might indicate data integrity issues in your current database that need fixing first.

### Issue 3: "permission denied"
**Solution:** Ensure you're running the scripts with a superuser role in Supabase. Use the default `postgres` user provided by Supabase.

### Issue 4: "enum value already exists"
**Solution:** This is safe to ignore. The script handles duplicate enum values gracefully.

### Issue 5: "column already exists"
**Solution:** This is safe to ignore. The script checks for column existence before adding.

## Support

If you encounter any issues during migration:
1. Take a screenshot of the error message
2. Check the Supabase logs for detailed error information
3. Verify your backup is accessible before attempting fixes
4. You can always restore from backup and try again

## Post-Migration Recommendations

1. **Update Metrics Snapshot**
   - Run `POST /api/update-metrics` to recalculate all metrics

2. **Test All Features**
   - User authentication
   - Student management
   - Passport management
   - Recruiter management
   - Analytics and reports

3. **Monitor Performance**
   - The new indexes should improve query performance
   - Check that pages load faster
   - Verify export functions work correctly

4. **Review New Features**
   - Explore RBAC permission system
   - Test enrollment management functions
   - Use unified entity views for reporting

## Migration Completion Checklist

- [ ] Backup created and verified
- [ ] Step 1 migration executed successfully
- [ ] Step 2 migration executed successfully
- [ ] Verification queries run successfully
- [ ] All existing data counts match pre-migration counts
- [ ] Application tested and working
- [ ] No errors in application logs
- [ ] All API endpoints responding correctly
- [ ] Dashboard loading properly
- [ ] Metrics updated successfully

---

**Congratulations!** Your database has been successfully enhanced with the new schema while preserving all existing data.
