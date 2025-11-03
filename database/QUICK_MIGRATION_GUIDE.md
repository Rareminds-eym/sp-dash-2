# ⚡ Quick Migration Reference Card

## 🎯 Goal
Align your Supabase database with migration scripts:
- Create 18 missing tables
- Add 68 missing columns
- Create enums, triggers, functions, indexes

## 📍 Your Supabase Project
**SQL Editor:** https://supabase.com/dashboard/project/dpooleduinyyzxgrcwko/sql

## 🚀 3-Step Migration Process

### Step 1: Base Schema (2,234 lines)
```bash
cat /app/database/migration_script_step1_complete_schema.sql
```
- Copy output → Paste in Supabase SQL Editor → Run
- Creates: schools, colleges, companies, RBAC tables
- Time: ~30 seconds

### Step 2: Enhanced Schema (800+ lines)
```bash
cat /app/database/migration_script_step2_enhanced_schema.sql
```
- Copy output → Paste in Supabase SQL Editor → Run
- Creates: unified colleges, enrollment system, functions
- Time: ~20 seconds

### Step 3: Column Alignment (520 lines)
```bash
cat /app/database/alignment_migration.sql
```
- Copy output → Paste in Supabase SQL Editor → Run
- Adds: 68 missing columns to existing tables
- Time: ~15 seconds

## ✅ Verification
```bash
cd /app && node compare_database_schema.mjs
```
Expected: 0 missing tables, 0 missing columns

## 📋 Current Status (Before Migration)
- ✅ 8 tables with data: users, students, skill_passports, universities, recruiters, audit_logs, verifications, metrics_snapshots
- ❌ 18 tables missing: schools, colleges, companies, permissions, etc.
- ⚠️ 68 columns missing in existing tables

## 📋 After Migration
- ✅ 26 total tables (all present)
- ✅ All columns aligned
- ✅ 8 enums, 96 indexes, 24 triggers, 5 functions created
- ✅ 60+ RBAC permissions seeded

## 🛟 Quick Help
- Full guide: `/app/database/MIGRATION_EXECUTION_GUIDE.md`
- Analysis: `/app/database/DATABASE_ANALYSIS_SUMMARY.md`
- Helper: `bash /app/show_migration_sql.sh`

## ⚠️ Safety
- All scripts safe to run (use IF NOT EXISTS)
- No data deletion or modification
- All new columns are nullable
- Can run multiple times safely

---

**Ready?** Open Supabase SQL Editor and start with Step 1!
