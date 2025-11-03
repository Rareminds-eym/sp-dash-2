# Rareminds Platform - Database Schema Documentation

## 📋 Overview

This SQL file (`rareminds_complete_schema.sql`) contains the complete database schema for the Rareminds platform, designed for PostgreSQL 15+ (Supabase). It includes both CREATE statements for new tables and ALTER statements for migrating existing tables.

## 🎯 Key Features

### 1. **Migration-Friendly Design**
- Uses `CREATE TABLE IF NOT EXISTS` to avoid errors on existing tables
- Includes ALTER statements to add missing columns to existing tables
- Uses `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` for safe enum creation
- All inserts use `ON CONFLICT DO NOTHING` to prevent duplicate errors

### 2. **Architecture Compliance**
- Follows ARCHITECTURE.md specifications
- Implements proper entity hierarchy (Schools → Colleges → Universities → Companies)
- Maintains current implementation features (skill passports, separate recruiters table)
- Enforces "ONE STUDENT = ONE CLASS" constraint with database-level checks

### 3. **Comprehensive Coverage**
The schema includes **30+ tables** organized into:

#### **Core Tables**
- `users` - Central user management (extends Supabase auth)
- `permissions` - RBAC permissions
- `role_permissions` - Role-to-permission mappings
- `audit_logs` - Complete audit trail

#### **School System (4 tables)**
- `schools`
- `school_classes`
- `school_educators`
- `school_educator_class_assignments`

#### **College System (4 tables)**
- `colleges_standalone`
- `college_courses`
- `college_lecturers`
- `college_lecturer_course_assignments`

#### **University System (5 tables)**
- `universities`
- `university_colleges` (departments within universities)
- `university_courses`
- `university_lecturers`
- `university_lecturer_course_assignments`

#### **Student & Skills System (3 tables)**
- `students` - With ONE STUDENT = ONE CLASS constraint
- `skill_passports` - NSQF-based skill tracking
- `verifications` - Verification history

#### **Company & Recruitment System (3 tables)**
- `companies`
- `company_branches`
- `recruiters` - Separate table (merged with architecture approach)

#### **Analytics & Metrics (1 table)**
- `metrics_snapshots` - Daily platform metrics

## 🔐 Security & Constraints

### **Critical Constraints**

1. **ONE STUDENT = ONE CLASS** ✅
   ```sql
   CONSTRAINT chk_only_one_class CHECK (
       (school_class_id IS NOT NULL AND college_course_id IS NULL AND university_course_id IS NULL) OR
       (school_class_id IS NULL AND college_course_id IS NOT NULL AND university_course_id IS NULL) OR
       (school_class_id IS NULL AND college_course_id IS NULL AND university_course_id IS NOT NULL) OR
       (school_class_id IS NULL AND college_course_id IS NULL AND university_course_id IS NULL AND student_type = 'direct')
   )
   ```

2. **Role-Entity Validation**
   ```sql
   CONSTRAINT valid_role_entity CHECK (
       (role = 'platform_admin' AND entity_type IS NULL AND entity_id IS NULL) OR
       (role != 'platform_admin' AND entity_type IS NOT NULL)
   )
   ```

### **Enums (Type Safety)**
- `user_role` - 11 distinct roles
- `entity_type` - 4 entity types
- `account_status` - 4 statuses (active, inactive, suspended, pending)
- `approval_status` - 3 statuses (pending, approved, rejected)
- `student_type` - 4 types (direct, school, college_standalone, university)
- `verification_status` - 4 statuses (pending, verified, rejected, in_review)

## 📊 Indexing Strategy

### **Performance Indexes (50+ indexes)**

1. **Primary Lookups**
   - Email, phone, enrollment number indexes
   - Entity ID lookups (school_id, college_id, university_id)
   - Status-based filtering

2. **Full-Text Search (Trigram)**
   ```sql
   CREATE INDEX idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
   CREATE INDEX idx_students_name_trgm ON students USING gin(name gin_trgm_ops);
   ```

3. **Composite Indexes**
   - Entity + Status combinations
   - Frequently joined tables
   - Multi-column WHERE clauses

4. **Sorting Optimization**
   ```sql
   CREATE INDEX idx_audit_logs_created_desc ON audit_logs(created_at DESC);
   ```

## 🔄 Triggers

**Auto-Update Timestamps** - 15 triggers created
- Automatically updates `updated_at` on every row modification
- Applied to all major tables

## 👥 RBAC (Role-Based Access Control)

### **Roles Supported**
1. `platform_admin` - Full platform control
2. `school_admin` - School management
3. `college_admin` - College management
4. `university_admin` - University management
5. `college_under_university_admin` - Department head
6. `company_admin` - Company management
7. `branch_manager` - Branch operations
8. `educator` - School teacher
9. `lecturer` - College/university teacher
10. `student` - Student access
11. `recruiter` - Recruitment access

### **Permissions (60+ permissions seeded)**

#### Platform-wide
- `platform:manage_all`
- `platform:view_analytics`
- `platform:configure_settings`

#### Entity Management (each has 7 permissions)
- School: create, read, update, delete, approve, reject, suspend
- College: create, read, update, delete, approve, reject, suspend
- University: create, read, update, delete, approve, reject, suspend
- Company: create, read, update, delete, approve, reject, suspend

#### User Management
- Class/Course: create, read, update, delete
- Educator: create, read, update, delete, assign
- Student: create, read, update, delete, enroll
- Recruiter: create, read, update, delete

#### System
- Passport: read, verify, reject
- User: read_all, update_any, delete_any, suspend_any, activate_any
- Audit: read_all
- Logs: read_all
- Permission: manage
- Role: manage

## 📝 Migration Considerations

### **For Existing Databases**

1. **Safe to Run Multiple Times**
   - All CREATE statements use `IF NOT EXISTS`
   - All ALTER statements check for column existence
   - All INSERT statements use `ON CONFLICT DO NOTHING`

2. **Data Preservation**
   - No DROP TABLE statements
   - No DELETE statements
   - Only additive changes (ADD COLUMN)
   - Existing data remains intact

3. **Manual Actions Needed**

   ⚠️ **Before Running:**
   - Backup your database
   - Review constraints against existing data
   - Check for data type mismatches

   ⚠️ **After Running:**
   - Populate new columns with default values if needed
   - Update existing student records to satisfy `chk_only_one_class` constraint
   - Verify foreign key relationships
   - Update `student_type` for existing students

## 🚀 Usage Instructions

### **Option 1: Supabase SQL Editor (Recommended)**
1. Open your Supabase project
2. Navigate to SQL Editor
3. Create new query
4. Copy entire contents of `rareminds_complete_schema.sql`
5. Execute the script
6. Review output messages

### **Option 2: psql Command Line**
```bash
psql -h your-host -U your-user -d your-database -f rareminds_complete_schema.sql
```

### **Option 3: Supabase CLI**
```bash
supabase db push --file database/rareminds_complete_schema.sql
```

## ✅ Verification Steps

After running the script, verify with:

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check permissions count
SELECT COUNT(*) FROM permissions; -- Should be 60+

-- Check role permissions
SELECT role, COUNT(*) as permission_count 
FROM role_permissions 
GROUP BY role;

-- Verify indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

## 📊 Statistics

- **Total Tables:** 30+
- **Total Columns:** 400+
- **Total Indexes:** 50+
- **Total Constraints:** 20+
- **Total Triggers:** 15
- **Total Enums:** 6
- **Total Permissions:** 60+
- **Total Role Mappings:** 100+

## 🔄 Maintenance

### **Regular Tasks**
1. **Weekly:** Review audit logs for anomalies
2. **Monthly:** Analyze query performance, add indexes if needed
3. **Quarterly:** Clean up old audit logs
4. **Annually:** Review and update permissions

### **Performance Monitoring**
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check unused indexes
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan = 0 AND schemaname = 'public';
```

## 🛟 Support & Troubleshooting

### **Common Issues**

1. **Constraint Violation on `chk_only_one_class`**
   - Student has multiple class assignments
   - Solution: Update student records to have only one active enrollment

2. **Foreign Key Violations**
   - Referenced entity doesn't exist
   - Solution: Create parent entity first or use SET NULL

3. **Enum Type Errors**
   - Invalid enum value
   - Solution: Check enum definitions, add new values if needed

### **Adding New Enum Values**
```sql
ALTER TYPE user_role ADD VALUE 'new_role' AFTER 'existing_role';
```

## 📚 Related Documentation

- **ARCHITECTURE.md** - System architecture and design decisions
- **Rareminds Admin App.pdf** - Functional requirements
- **test_result.md** - Current implementation status

## 🎓 Best Practices Implemented

1. ✅ UUID primary keys for distributed systems
2. ✅ Timestamp tracking (created_at, updated_at)
3. ✅ Soft deletes via account_status
4. ✅ JSONB for flexible metadata
5. ✅ Proper foreign key cascading
6. ✅ Comprehensive indexing strategy
7. ✅ Audit logging for compliance
8. ✅ RBAC for security
9. ✅ Database-level constraints for data integrity
10. ✅ Trigram indexes for fuzzy search

---

**Created by:** Rareminds Platform Team  
**Version:** 1.0.0  
**Last Updated:** 2025  
**Database:** PostgreSQL 15+ (Supabase)  
**Status:** Production Ready ✅
