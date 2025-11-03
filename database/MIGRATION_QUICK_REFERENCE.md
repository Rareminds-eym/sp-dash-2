# Database Migration - Quick Reference

## Created Files

### 1. Migration Scripts
- **`migration_script_step1_complete_schema.sql`** (2,234 lines)
  - Complete base schema with schools, companies, RBAC
  - Adds 20+ new tables
  - Enhances existing tables with 50+ new columns
  - Creates 40+ performance indexes
  - Creates 15+ triggers
  - Seeds RBAC permissions
  
- **`migration_script_step2_enhanced_schema.sql`** (800+ lines)
  - Unified colleges table (combines standalone + university departments)
  - Student enrollment history system
  - Database functions for enrollment management
  - Unified views for entity overview
  - Additional constraints and triggers

### 2. Documentation
- **`MIGRATION_INSTRUCTIONS.md`** - Complete step-by-step migration guide
- **`verification_script.sql`** - Post-migration verification script
- **`MIGRATION_QUICK_REFERENCE.md`** - This file

## What Gets Migrated

### New Database Objects

#### Tables (26 new)
1. `schools` - School entities
2. `school_classes` - School class structure
3. `school_educators` - School educator management
4. `school_educator_class_assignments` - Educator assignments
5. `colleges_standalone` - Standalone colleges
6. `college_courses` - College course structure
7. `college_lecturers` - College lecturer management
8. `college_lecturer_course_assignments` - Lecturer assignments
9. `university_colleges` - University departments
10. `university_courses` - University course structure
11. `university_lecturers` - University lecturer management
12. `university_lecturer_course_assignments` - Lecturer assignments
13. `colleges` - Unified college table (NEW in V2)
14. `companies` - Company entities
15. `company_branches` - Company branch structure
16. `permissions` - RBAC permissions
17. `role_permissions` - Role-permission mappings
18. `student_enrollments` - Enrollment history (NEW in V2)

#### Existing Tables Enhanced
- `users` - 8 new columns
- `universities` - 9 new columns
- `students` - 16 new columns
- `skill_passports` - 9 new columns
- `recruiters` - 11 new columns
- `verifications` - 5 new columns
- `audit_logs` - 6 new columns
- `metrics_snapshots` - 3 new columns

#### Functions (5 new)
1. `update_updated_at_column()` - Auto-update timestamps
2. `get_active_enrollment(student_id)` - Get current enrollment
3. `transfer_student()` - Transfer student between classes
4. `update_entity_student_counts()` - Update counts automatically
5. `validate_one_active_enrollment()` - Enforce enrollment rules

#### Views (2 new)
1. `v_entity_overview` - Unified entity dashboard
2. `v_student_current_enrollment` - Current enrollments view

#### Enums (8 total)
1. `user_role` - 11 role types
2. `entity_type` - 4 entity types
3. `account_status` - 4 statuses
4. `approval_status` - 3 statuses
5. `student_type` - 4 types
6. `verification_status` - 4 statuses
7. `enrollment_status` - 5 statuses (NEW)
8. `college_type` - 2 types (NEW)

#### Indexes (47+ performance indexes)
- Text search (trigram) indexes
- Composite indexes for queries
- Foreign key indexes
- Status filtering indexes
- Sorting indexes (DESC)

#### Triggers (17+)
- Auto-update timestamps on all tables
- Auto-update entity counts
- Validate enrollment rules

## Execution Order

```
1. Create backup of current database
2. Execute migration_script_step1_complete_schema.sql
3. Verify Step 1 completion
4. Execute migration_script_step2_enhanced_schema.sql
5. Verify Step 2 completion
6. Run verification_script.sql
7. Test application
```

## Safety Features

✅ **No Data Loss**
- All scripts use `IF NOT EXISTS` checks
- No DROP TABLE commands
- No TRUNCATE commands
- No DELETE commands
- Nullable columns for new fields

✅ **Idempotent**
- Can be run multiple times safely
- Duplicate enum handling
- Conflict resolution for inserts

✅ **Rollback Ready**
- Clear backup instructions
- Restore procedures documented
- No irreversible changes

## Quick Commands

### Backup Database
```bash
# Via Supabase Dashboard
Dashboard → Database → Backups → Create Backup
```

### Execute Migration
```sql
-- In Supabase SQL Editor
-- Copy-paste each migration script and click Run
```

### Verify Migration
```sql
-- Run verification script
-- Check for ✅ marks in output
```

### Test Application
```bash
# Restart Next.js
sudo supervisorctl restart nextjs

# Check logs
tail -f /var/log/supervisor/nextjs.err.log
```

## Key Features Added

### 1. Multi-Entity Support
- Schools with classes and educators
- Colleges (standalone and university departments)
- Universities with multiple colleges
- Companies with branches and recruiters

### 2. Enhanced Student Management
- Student type classification
- Guardian information tracking
- Enrollment history
- Class/course progression tracking
- Transfer management

### 3. RBAC System
- Fine-grained permissions
- Role-based access control
- Platform/School/College/University/Company admin roles
- Educator and Lecturer roles

### 4. Performance Optimizations
- Trigram indexes for fuzzy text search
- Composite indexes for complex queries
- Optimized foreign key relationships
- Efficient sorting indexes

### 5. Enrollment System (V2)
- Historical enrollment tracking
- Multi-class progression
- Transfer management
- Withdrawal tracking
- Status management (active/completed/withdrawn/transferred/suspended)

### 6. Unified College System (V2)
- Single table for all colleges
- Supports standalone and university departments
- Simplified queries and management
- Backward compatible with existing data

## Post-Migration Actions

1. **Update Metrics**
   ```bash
   curl -X POST http://your-domain/api/update-metrics
   ```

2. **Test Endpoints**
   - GET /api/users
   - GET /api/students
   - GET /api/skill-passports
   - GET /api/universities
   - GET /api/recruiters

3. **Verify Dashboard**
   - Login as admin
   - Check all pages load
   - Verify data displays correctly

4. **Check Logs**
   - No errors in application logs
   - No database connection issues

## Migration Time Estimates

- **Step 1 (Complete Schema)**: 10-30 seconds
- **Step 2 (Enhanced Schema)**: 5-20 seconds
- **Verification**: 2-5 seconds
- **Total**: < 1 minute

## Data Preservation

All existing data remains intact:
- ✅ All users
- ✅ All students
- ✅ All skill passports
- ✅ All universities
- ✅ All recruiters
- ✅ All audit logs
- ✅ All verifications
- ✅ All metrics snapshots

New columns are added as nullable, so existing rows work without modification.

## Contact Support

If you encounter issues:
1. Check error messages in Supabase logs
2. Review MIGRATION_INSTRUCTIONS.md
3. Verify backup is accessible
4. Restore from backup if needed
5. Try again with fresh backup

---

**Ready to migrate?** Follow the steps in `MIGRATION_INSTRUCTIONS.md`
