# Supabase Database Structure Analysis & Alignment Report

**Generated:** November 3, 2025  
**Analysis Tool:** Custom Node.js Database Comparison Script  
**Database:** dpooleduinyyzxgrcwko.supabase.co

---

## 📊 Executive Summary

### Current Database State
- **Total Tables in Database:** 26
- **Tables with Data:** 8 (users, students, skill_passports, universities, recruiters, audit_logs, verifications, metrics_snapshots)
- **Empty Tables:** 18 (all new schema tables from migration scripts)

### Migration Status
| Metric | Count |
|--------|-------|
| ✅ Tables in Sync | 0 |
| ⚠️ Tables Needing Updates | 8 |
| ❌ Missing Tables | 18 |
| ⚠️ Missing Columns (Total) | 68 |
| ℹ️ Extra Columns (Total) | 95 |

---

## 🔍 Detailed Analysis

### 1. Missing Tables (18)

These tables exist in migration scripts but NOT in the database:

#### School System (4 tables)
- `schools` - School entities and management
- `school_classes` - Class structure for schools
- `school_educators` - Educator management
- `school_educator_class_assignments` - Educator-to-class assignments

#### College System (4 tables)
- `colleges_standalone` - Standalone college entities
- `college_courses` - Course structure for colleges
- `college_lecturers` - Lecturer management
- `college_lecturer_course_assignments` - Lecturer-to-course assignments

#### University System (4 tables)
- `university_colleges` - University department structure
- `university_courses` - Course structure for universities
- `university_lecturers` - Lecturer management
- `university_lecturer_course_assignments` - Lecturer-to-course assignments

#### Company System (2 tables)
- `companies` - Company entities for recruitment
- `company_branches` - Branch structure for companies

#### RBAC & Other (4 tables)
- `permissions` - RBAC permission definitions
- `role_permissions` - Role-to-permission mappings
- `colleges` - Unified college table (V2 enhancement)
- `student_enrollments` - Enrollment history tracking

---

### 2. Tables Needing Column Updates (8)

#### 2.1 **users** Table
**Status:** ⚠️ Missing 9 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| supabase_auth_id | UUID UNIQUE | Link to Supabase Auth |
| first_name | VARCHAR(100) | User first name |
| last_name | VARCHAR(100) | User last name |
| entity_type | entity_type (enum) | Entity association type |
| entity_id | UUID | Entity foreign key |
| account_status | account_status (enum) | Account status |
| last_password_change | TIMESTAMP WITH TIME ZONE | Password change tracking |
| profile_image_url | TEXT | Profile image URL |
| last_login | TIMESTAMP WITH TIME ZONE | Last login timestamp |

**Extra Columns (8):** email, role, organizationId, isActive, metadata, createdAt, updatedAt, id

---

#### 2.2 **universities** Table
**Status:** ⚠️ Missing 9 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| university_type | VARCHAR(50) | Type of university |
| approval_status | approval_status (enum) | Approval status |
| approved_by | UUID → users(id) | Approver reference |
| approved_at | TIMESTAMP WITH TIME ZONE | Approval timestamp |
| account_status | account_status (enum) | Account status |
| total_colleges | INTEGER (DEFAULT 0) | College count |
| total_courses | INTEGER (DEFAULT 0) | Course count |
| total_lecturers | INTEGER (DEFAULT 0) | Lecturer count |
| total_students | INTEGER (DEFAULT 0) | Student count |

**Extra Columns (12):** id, name, email, phone, state, district, website, verificationstatus, isactive, createdat, updatedat, code

---

#### 2.3 **students** Table
**Status:** ⚠️ Missing 17 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| student_type | student_type (enum) | Type of student |
| school_id | UUID → schools(id) | School reference |
| college_id | UUID → colleges_standalone(id) | College reference |
| university_college_id | UUID → university_colleges(id) | University college reference |
| school_class_id | UUID → school_classes(id) | Class reference |
| college_course_id | UUID → college_courses(id) | Course reference |
| university_course_id | UUID → university_courses(id) | University course reference |
| enrollment_number | VARCHAR(100) | Enrollment number |
| guardian_name | VARCHAR(200) | Guardian name |
| guardian_phone | VARCHAR(20) | Guardian phone |
| guardian_email | VARCHAR(255) | Guardian email |
| guardian_relation | VARCHAR(50) | Guardian relation |
| gender | VARCHAR(20) | Student gender |
| blood_group | VARCHAR(5) | Blood group |
| enrollment_date | DATE | Enrollment date |
| expected_graduation_date | DATE | Expected graduation |
| current_cgpa | DECIMAL(4,2) | Current CGPA |

**Extra Columns (32):** studentId, universityId, profile, createdAt, updatedAt, email, name, age, contact_number, alternate_number, district_name, university, branch_field, college_school_name, registration_number, github_link, linkedin_link, twitter_link, facebook_link, instagram_link, portfolio_link, other_social_links, approval_status, created_at, updated_at, embedding, phone, department, cgpa, employability_score, verified, id

---

#### 2.4 **skill_passports** Table
**Status:** ⚠️ Missing 8 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| nsqf_level | INTEGER | NSQF qualification level |
| certifications | JSONB (DEFAULT '[]') | Certifications array |
| work_experience | JSONB (DEFAULT '[]') | Work experience array |
| achievements | JSONB (DEFAULT '[]') | Achievements array |
| verified_by | UUID → users(id) | Verifier reference |
| verified_at | TIMESTAMP WITH TIME ZONE | Verification timestamp |
| ai_verified | BOOLEAN (DEFAULT false) | AI verification flag |
| ai_verification_score | DECIMAL(5,2) | AI verification score |

**Extra Columns (10):** studentId, status, aiVerification, nsqfLevel, skills, createdAt, updatedAt, id, certificates, assessments

**Note:** Some columns exist with different naming:
- `nsqfLevel` exists (camelCase) vs expected `nsqf_level` (snake_case)
- `aiVerification` exists (camelCase) vs expected `ai_verified` (snake_case)

---

#### 2.5 **recruiters** Table
**Status:** ⚠️ Missing 11 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| verification_status | approval_status (enum) | Verification status |
| is_active | BOOLEAN (DEFAULT true) | Active status |
| user_count | INTEGER (DEFAULT 0) | Associated user count |
| company_id | UUID → companies(id) | Company reference |
| branch_id | UUID → company_branches(id) | Branch reference |
| employee_id | VARCHAR(50) | Employee ID |
| designation | VARCHAR(100) | Job designation |
| department | VARCHAR(100) | Department |
| date_of_joining | DATE | Joining date |
| is_hq_recruiter | BOOLEAN (DEFAULT false) | HQ recruiter flag |
| account_status | account_status (enum) | Account status |

**Extra Columns (10):** id, name, email, phone, state, website, verificationstatus, isactive, createdat, updatedat

**Note:** Similar naming convention differences exist:
- `verificationstatus` vs `verification_status`
- `isactive` vs `is_active`

---

#### 2.6 **verifications** Table
**Status:** ⚠️ Missing 5 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| verification_type | VARCHAR(50) | Type of verification |
| verification_notes | TEXT | Verification notes |
| verification_data | JSONB (DEFAULT '{}') | Verification data |
| verified_by | UUID → users(id) | Verifier reference |
| verified_at | TIMESTAMP WITH TIME ZONE | Verification timestamp |

**Extra Columns (7):** id, targetTable, targetId, action, performedBy, note, createdAt

---

#### 2.7 **metrics_snapshots** Table
**Status:** ⚠️ Missing 3 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| total_schools | INTEGER (DEFAULT 0) | Total schools count |
| total_colleges | INTEGER (DEFAULT 0) | Total colleges count |
| total_companies | INTEGER (DEFAULT 0) | Total companies count |

**Extra Columns (9):** id, snapshotDate, activeUniversities, registeredStudents, verifiedPassports, aiVerifiedPercent, employabilityIndex, activeRecruiters, createdAt

---

#### 2.8 **audit_logs** Table
**Status:** ⚠️ Missing 6 columns

| Missing Column | Type | Description |
|----------------|------|-------------|
| ip_address | INET | IP address |
| user_agent | TEXT | User agent string |
| old_values | JSONB | Old values before change |
| new_values | JSONB | New values after change |
| resource_type | VARCHAR(50) | Resource type |
| resource_id | UUID | Resource identifier |

**Extra Columns (7):** user_id, action, target, payload, ip, createdAt, id

---

## 🔧 Migration Requirements

### Priority 1: High Priority (Affects Existing Features)
These columns need to be added to support current functionality:

1. **users table**
   - `supabase_auth_id` - For proper Supabase Auth integration
   - `account_status` - For user status management
   - `entity_type`, `entity_id` - For entity associations

2. **universities table**
   - `approval_status` - For university approval workflow
   - `account_status` - For status management

3. **students table**
   - `student_type` - To categorize student types
   - `user_id` - To link students to users (already exists)

4. **skill_passports table**
   - `verified_by`, `verified_at` - For verification tracking
   - `certifications`, `work_experience`, `achievements` - For enhanced profiles

5. **recruiters table**
   - `verification_status`, `is_active` - Already exist as `verificationstatus`, `isactive` (naming convention)
   - `user_id` - To link recruiters to users (already exists)

6. **audit_logs table**
   - `ip_address`, `user_agent` - For better audit tracking
   - `old_values`, `new_values` - For change tracking

### Priority 2: Medium Priority (New Features)
These are needed for new entity types:

1. **Missing Tables** - All 18 missing tables need to be created for:
   - School system support
   - College system support
   - Company/branch structure
   - RBAC system
   - Enrollment tracking

2. **Additional Columns**
   - University counts (total_colleges, total_courses, etc.)
   - Student guardian information
   - Student enrollment tracking fields

### Priority 3: Low Priority (Optional Enhancements)
These are nice-to-have improvements:

1. **Profile enhancements**
   - `profile_image_url` in users
   - `last_login` tracking
   - Additional metadata fields

2. **Metrics enhancements**
   - `total_schools`, `total_colleges`, `total_companies` in metrics_snapshots

---

## 📋 Generated Artifacts

### 1. **alignment_migration.sql**
- **Location:** `/app/database/alignment_migration.sql`
- **Purpose:** SQL script to add missing columns to existing tables
- **Contains:** 68 ALTER TABLE statements
- **Safe to run:** Yes (uses IF NOT EXISTS checks)
- **Note:** Does NOT create missing tables - only adds columns

### 2. **database_comparison_report.json**
- **Location:** `/app/database_comparison_report.json`
- **Purpose:** Detailed JSON report of all differences
- **Contains:**
  - Expected schema from migration scripts
  - Actual database schema
  - Detailed comparison results
  - Column-by-column mismatches

### 3. **database_structure_analysis.json**
- **Location:** `/app/database_structure_analysis.json`
- **Purpose:** Simple database structure snapshot
- **Contains:**
  - List of existing tables
  - List of missing tables
  - Row counts for each table

---

## 🚀 Next Steps & Recommendations

### Step 1: Create Missing Tables
**Action:** Execute the full migration scripts to create missing tables
- Run `migration_script_step1_complete_schema.sql`
- Run `migration_script_step2_enhanced_schema.sql`

**Tables to be created:**
- All 18 missing tables (schools, colleges, companies, permissions, etc.)
- All associated indexes, triggers, and functions

### Step 2: Add Missing Columns
**Action:** Execute the alignment script to add missing columns
- Run `/app/database/alignment_migration.sql`

**Columns to be added:**
- 68 columns across 8 existing tables
- All columns are nullable to preserve existing data
- Safe to run multiple times

### Step 3: Data Migration (If Needed)
**Consider:**
1. **Naming Convention Migration**
   - Some columns exist with different naming (camelCase vs snake_case)
   - Examples: `verificationstatus` vs `verification_status`, `nsqfLevel` vs `nsqf_level`
   - Decision needed: Keep both or migrate data?

2. **Data Transformation**
   - Map existing columns to new structure if needed
   - Example: `organizationId` → `entity_id` with `entity_type`

### Step 4: Update Application Code
**After migration:**
1. Update API endpoints to use new column names
2. Add support for new tables (schools, companies, etc.)
3. Implement RBAC using permissions tables
4. Add enrollment tracking features

---

## ⚠️ Important Notes

### Naming Conventions
The database currently uses mixed naming conventions:
- **Migration scripts:** Use `snake_case` (PostgreSQL standard)
- **Current database:** Uses `camelCase` in some tables

**Examples:**
- `verificationstatus` vs `verification_status`
- `isactive` vs `is_active`
- `nsqfLevel` vs `nsqf_level`
- `studentId` vs `student_id`

### Data Preservation
- All generated migration scripts are safe to run
- No data will be lost or modified
- All new columns are nullable
- Uses `IF NOT EXISTS` checks to prevent errors

### Foreign Key Dependencies
Some missing columns have foreign key references to tables that don't exist yet:
- `students.school_id` → `schools(id)` (schools table doesn't exist)
- `students.college_id` → `colleges_standalone(id)` (table doesn't exist)
- `recruiters.company_id` → `companies(id)` (companies table doesn't exist)

**Solution:** Run full migration scripts first to create all tables, then add foreign keys.

---

## 📊 Migration Scripts Summary

### Available Migration Scripts

1. **migration_script_step1_complete_schema.sql** (2,234 lines)
   - Creates all base tables
   - Adds enums, triggers, indexes
   - Seeds RBAC permissions
   - Status: **NOT EXECUTED** (tables missing)

2. **migration_script_step2_enhanced_schema.sql** (800+ lines)
   - Creates unified colleges table
   - Creates enrollment system
   - Adds functions and views
   - Status: **NOT EXECUTED** (tables missing)

3. **alignment_migration.sql** (520 lines) **[NEW]**
   - Adds missing columns to existing tables
   - 68 ALTER TABLE statements
   - Safe to run after step 1 & 2
   - Status: **READY TO RUN**

### Expected Database Objects After Migration

| Object Type | Count |
|-------------|-------|
| Tables | 26 |
| Columns | 400+ |
| Indexes | 96 |
| Triggers | 24 |
| Functions | 5 |
| Enums | 8 |
| Permissions | 60+ |

---

## 🔍 Detailed Column Mappings

### Column Naming Comparison

#### students table
| Current (camelCase) | Expected (snake_case) | Status |
|---------------------|------------------------|--------|
| studentId | student_id | Both exist |
| universityId | university_id | Both exist |
| createdAt | created_at | Both exist |
| updatedAt | updated_at | Both exist |

#### skill_passports table
| Current (camelCase) | Expected (snake_case) | Status |
|---------------------|------------------------|--------|
| studentId | student_id | Both exist |
| nsqfLevel | nsqf_level | Different name |
| aiVerification | ai_verified | Different name |
| createdAt | created_at | Both exist |
| updatedAt | updated_at | Both exist |

#### recruiters table
| Current (camelCase) | Expected (snake_case) | Status |
|---------------------|------------------------|--------|
| verificationstatus | verification_status | Different name |
| isactive | is_active | Different name |
| createdat | created_at | Different name |
| updatedat | updated_at | Different name |

---

## ✅ Verification Checklist

Before migration:
- [ ] Database backup created
- [ ] Current row counts documented
- [ ] API endpoints documented
- [ ] Application downtime scheduled (if needed)

After migration:
- [ ] All 26 tables exist
- [ ] All row counts match pre-migration
- [ ] All indexes created
- [ ] All triggers created
- [ ] All functions created
- [ ] API endpoints still working
- [ ] No errors in application logs

---

## 📞 Support & Documentation

### Related Files
- `/app/database/README.md` - Schema documentation
- `/app/database/MIGRATION_INSTRUCTIONS.md` - Migration guide
- `/app/database/MIGRATION_QUICK_REFERENCE.md` - Quick reference
- `/app/database/migration_script_step1_complete_schema.sql` - Base schema
- `/app/database/migration_script_step2_enhanced_schema.sql` - Enhanced schema
- `/app/database/alignment_migration.sql` - Alignment script (NEW)

### Analysis Scripts
- `/app/analyze_db_structure.mjs` - Database structure analyzer
- `/app/compare_database_schema.mjs` - Schema comparison tool

### Generated Reports
- `/app/database_comparison_report.json` - Detailed comparison
- `/app/database_structure_analysis.json` - Structure snapshot
- `/app/database_comparison_output.txt` - Console output
- `/app/database_analysis_output.txt` - Analysis output

---

**Analysis Complete** ✅  
**Generated:** November 3, 2025  
**Next Action:** Review and execute migration scripts
