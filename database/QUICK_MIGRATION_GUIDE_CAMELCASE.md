# ⚡ Quick Migration Reference Card (camelCase Version)

## 🎯 Goal
Align your Supabase database with migration scripts (camelCase column names):
- Create 18 missing tables
- Add 68 missing columns
- Create enums, triggers, functions, indexes

## 📍 Your Supabase Project
**SQL Editor:** https://supabase.com/dashboard/project/dpooleduinyyzxgrcwko/sql

## 🚀 3-Step Migration Process (camelCase)

### Step 1: Base Schema (1,185 lines) - camelCase
```bash
cat /app/database/migration_script_step1_complete_schema_camelCase.sql
```
- Copy output → Paste in Supabase SQL Editor → Run
- Creates: schools, colleges, companies, RBAC tables
- Uses: **camelCase** for all column names (e.g., `createdAt`, `firstName`)
- Time: ~30 seconds

### Step 2: Enhanced Schema (540 lines) - camelCase
```bash
cat /app/database/migration_script_step2_enhanced_schema_camelCase.sql
```
- Copy output → Paste in Supabase SQL Editor → Run
- Creates: unified colleges, enrollment system, functions
- Uses: **camelCase** for all column names
- Time: ~20 seconds

### Step 3: Column Alignment (520 lines) - camelCase
```bash
cat /app/database/alignment_migration_camelCase.sql
```
- Copy output → Paste in Supabase SQL Editor → Run
- Adds: 68 missing columns to existing tables in **camelCase**
- Time: ~15 seconds

## ✅ Verification
```bash
cd /app && node compare_database_schema.mjs
```
Expected: 0 missing tables, fewer missing columns (camelCase aligned)

## 📋 Column Naming Convention

**camelCase Examples:**
- ✅ `firstName`, `lastName` (not first_name, last_name)
- ✅ `createdAt`, `updatedAt` (not created_at, updated_at)
- ✅ `entityType`, `entityId` (not entity_type, entity_id)
- ✅ `supabaseAuthId` (not supabase_auth_id)
- ✅ `approvalStatus` (not approval_status)
- ✅ `isActive` (not is_active)
- ✅ `userId`, `companyId` (not user_id, company_id)

**Note:** Table names remain lowercase with underscores (PostgreSQL convention)

## 📋 Current Status (Before Migration)
- ✅ 8 tables with data (using camelCase): users, students, skill_passports, universities, recruiters
- ❌ 18 tables missing: schools, colleges, companies, permissions, etc.
- ⚠️ 68 columns missing in existing tables

## 📋 After Migration
- ✅ 26 total tables (all present)
- ✅ All columns aligned with **camelCase** convention
- ✅ 8 enums, 96 indexes, 24 triggers, 5 functions created
- ✅ 60+ RBAC permissions seeded

## 📁 Files Available

**camelCase Versions (USE THESE):**
- `/app/database/migration_script_step1_complete_schema_camelCase.sql`
- `/app/database/migration_script_step2_enhanced_schema_camelCase.sql`
- `/app/database/alignment_migration_camelCase.sql`

**Original snake_case Versions (For Reference):**
- `/app/database/migration_script_step1_complete_schema.sql`
- `/app/database/migration_script_step2_enhanced_schema.sql`
- `/app/database/alignment_migration.sql`

## 🛟 Quick Help
- Full guide: `/app/database/MIGRATION_EXECUTION_GUIDE.md`
- Analysis: `/app/database/DATABASE_ANALYSIS_SUMMARY.md`
- This guide: `/app/database/QUICK_MIGRATION_GUIDE_CAMELCASE.md`

## ⚠️ Safety
- All scripts safe to run (use IF NOT EXISTS)
- No data deletion or modification
- All new columns are nullable
- Can run multiple times safely
- Matches your existing camelCase convention

## 🔄 What Changed?
Converted all column names from snake_case to camelCase:
- `first_name` → `firstName`
- `created_at` → `createdAt`
- `entity_type` → `entityType`
- `is_active` → `isActive`
- And 60+ more column conversions

---

**Ready?** Open Supabase SQL Editor and start with Step 1 (camelCase version)!

**Important:** Use the `_camelCase.sql` files, not the original `.sql` files!
