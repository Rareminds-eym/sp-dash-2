# 🚀 Database Migration Execution Guide

## ⚠️ Important Notice

Due to network security restrictions in the container environment, SQL migrations must be executed through the **Supabase SQL Editor** web interface. This is the standard and safest approach for Supabase database migrations.

---

## 📋 Pre-Migration Checklist

Before executing migrations, ensure:

- [ ] You have access to Supabase Dashboard
- [ ] You have admin/owner permissions on the project
- [ ] You have created a backup (recommended)

---

## 🔗 Quick Access

**Your Supabase Project:**
- Dashboard: https://supabase.com/dashboard/project/dpooleduinyyzxgrcwko
- SQL Editor: https://supabase.com/dashboard/project/dpooleduinyyzxgrcwko/sql

---

## 📝 Migration Steps

### Step 1: Create Database Backup (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Backups**
3. Click **Create Backup** (or note the latest automatic backup)
4. Wait for backup to complete

### Step 2: Execute Migration - Step 1 (Base Schema)

**Purpose:** Creates 20+ new tables, enums, indexes, triggers, RBAC permissions

**File:** `/app/database/migration_script_step1_complete_schema.sql`

**Instructions:**
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/dpooleduinyyzxgrcwko/sql
2. Click **"New Query"**
3. In your terminal, run:
   ```bash
   cat /app/database/migration_script_step1_complete_schema.sql
   ```
4. Copy the entire output
5. Paste into Supabase SQL Editor
6. Click **"Run"** button (or press Ctrl/Cmd + Enter)
7. Wait for execution (10-30 seconds)
8. Look for success message: `"STEP 1: RAREMINDS COMPLETE SCHEMA MIGRATION COMPLETED"`

**Expected Results:**
- ✅ 18 new tables created (schools, colleges, companies, permissions, etc.)
- ✅ 8 new enums created
- ✅ 40+ indexes created
- ✅ 15+ triggers created
- ✅ 60+ permissions seeded

---

### Step 3: Execute Migration - Step 2 (Enhanced Schema)

**Purpose:** Creates unified colleges table, enrollment system, functions, views

**File:** `/app/database/migration_script_step2_enhanced_schema.sql`

**Instructions:**
1. In Supabase SQL Editor, click **"New Query"** again
2. In your terminal, run:
   ```bash
   cat /app/database/migration_script_step2_enhanced_schema.sql
   ```
3. Copy the entire output
4. Paste into Supabase SQL Editor
5. Click **"Run"** button
6. Wait for execution (5-20 seconds)
7. Look for success message: `"STEP 2: RAREMINDS ENHANCED SCHEMA V2 MIGRATION COMPLETED"`

**Expected Results:**
- ✅ Unified `colleges` table created
- ✅ `student_enrollments` table created
- ✅ 5 database functions created
- ✅ 2 views created
- ✅ Additional triggers and constraints

---

### Step 4: Execute Alignment Script (Column Additions)

**Purpose:** Adds 68 missing columns to existing tables

**File:** `/app/database/alignment_migration.sql`

**Instructions:**
1. In Supabase SQL Editor, click **"New Query"** again
2. In your terminal, run:
   ```bash
   cat /app/database/alignment_migration.sql
   ```
3. Copy the entire output
4. Paste into Supabase SQL Editor
5. Click **"Run"** button
6. Wait for execution (5-15 seconds)
7. Verify: No error messages

**Expected Results:**
- ✅ 9 columns added to `users` table
- ✅ 9 columns added to `universities` table
- ✅ 17 columns added to `students` table
- ✅ 8 columns added to `skill_passports` table
- ✅ 11 columns added to `recruiters` table
- ✅ 5 columns added to `verifications` table
- ✅ 3 columns added to `metrics_snapshots` table
- ✅ 6 columns added to `audit_logs` table

---

## ✅ Post-Migration Verification

### Option 1: Automated Verification Script

Run the verification script to check if all migrations were successful:

```bash
cd /app && node compare_database_schema.mjs
```

**Expected Output:**
- ✅ Tables in sync: 26/26
- ✅ Missing tables: 0
- ✅ Missing columns: 0

### Option 2: Manual SQL Verification

Run these queries in Supabase SQL Editor:

```sql
-- Check all tables exist (should return 26 rows)
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check new tables specifically
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') 
       THEN '✅ schools' ELSE '❌ schools missing' END as schools,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') 
       THEN '✅ companies' ELSE '❌ companies missing' END as companies,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') 
       THEN '✅ permissions' ELSE '❌ permissions missing' END as permissions,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_enrollments') 
       THEN '✅ student_enrollments' ELSE '❌ student_enrollments missing' END as enrollments;

-- Check permissions seeded (should return 60+)
SELECT COUNT(*) as total_permissions FROM permissions;

-- Check role_permissions seeded (should return 100+)
SELECT COUNT(*) as total_role_permissions FROM role_permissions;

-- Verify new columns in users table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('supabase_auth_id', 'entity_type', 'entity_id', 'account_status')
ORDER BY column_name;

-- Verify new columns in students table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name IN ('student_type', 'school_id', 'enrollment_number', 'guardian_name')
ORDER BY column_name;
```

---

## 🔧 Helper Commands

### View Migration File Contents

```bash
# View Step 1 migration
cat /app/database/migration_script_step1_complete_schema.sql | less

# View Step 2 migration
cat /app/database/migration_script_step2_enhanced_schema.sql | less

# View alignment script
cat /app/database/alignment_migration.sql | less

# Check file sizes
ls -lh /app/database/*.sql
```

### Get Line Counts

```bash
wc -l /app/database/migration_script_step1_complete_schema.sql
wc -l /app/database/migration_script_step2_enhanced_schema.sql
wc -l /app/database/alignment_migration.sql
```

### Use Interactive Helper Script

```bash
bash /app/show_migration_sql.sh
```

---

## 🛟 Troubleshooting

### Issue: "syntax error" or "relation already exists"

**Solution:** Some objects may already exist. The scripts use `IF NOT EXISTS` checks, so most errors can be safely ignored. However, review the specific error:

- `relation "xyz" already exists` → Safe to ignore
- `type "xyz" already exists` → Safe to ignore
- `column "xyz" already exists` → Safe to ignore
- `syntax error` → Check if you copied the entire script

### Issue: "permission denied"

**Solution:** Ensure you're using an admin/owner account. The default `postgres` user in Supabase has full permissions.

### Issue: "foreign key constraint violation"

**Solution:** This indicates data integrity issues. Review the specific constraint and your existing data. May need to:
1. Fix data first
2. Comment out that specific foreign key
3. Add it later after data cleanup

### Issue: Migration times out

**Solution:** The scripts are large. If timeout occurs:
1. Break the script into smaller chunks (by table)
2. Execute each section separately
3. Or use the Supabase CLI (if you have it installed locally)

### Issue: Need to rollback

**Solution:** 
1. Restore from backup created in Step 1
2. Or manually drop created tables/columns
3. The scripts do not modify existing data, so existing tables remain safe

---

## 📊 What Gets Created/Modified

### New Tables (18)
- schools, school_classes, school_educators, school_educator_class_assignments
- colleges_standalone, college_courses, college_lecturers, college_lecturer_course_assignments
- university_colleges, university_courses, university_lecturers, university_lecturer_course_assignments
- companies, company_branches
- permissions, role_permissions
- colleges (unified), student_enrollments

### Enhanced Tables (8)
- users (+9 columns)
- universities (+9 columns)
- students (+17 columns)
- skill_passports (+8 columns)
- recruiters (+11 columns)
- verifications (+5 columns)
- metrics_snapshots (+3 columns)
- audit_logs (+6 columns)

### New Database Objects
- **Enums:** 8 (user_role, entity_type, account_status, approval_status, etc.)
- **Indexes:** 96 (performance optimization)
- **Triggers:** 24 (auto-update timestamps, counts)
- **Functions:** 5 (enrollment management, validation)
- **Views:** 2 (entity overview, student enrollment)
- **Permissions:** 60+ (RBAC system)

---

## 📞 Support

If you encounter any issues during migration:

1. **Check the logs** in Supabase SQL Editor output
2. **Review the analysis report:** `/app/database/DATABASE_ANALYSIS_SUMMARY.md`
3. **Run verification:** `node /app/compare_database_schema.mjs`
4. **Check file contents:** `cat /app/database/[filename]`

---

## ✅ Success Checklist

After completing all steps:

- [ ] Step 1 migration executed successfully
- [ ] Step 2 migration executed successfully
- [ ] Alignment script executed successfully
- [ ] Verification script shows 0 missing tables
- [ ] Verification script shows 0 missing columns
- [ ] All 26 tables exist in database
- [ ] Permissions table has 60+ rows
- [ ] No critical errors in migration output

---

**Ready to proceed?** Start with Step 1 above!

**Need help?** Review the comprehensive analysis in `/app/database/DATABASE_ANALYSIS_SUMMARY.md`
