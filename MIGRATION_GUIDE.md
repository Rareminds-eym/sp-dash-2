## Recruiter Data Import - Schema Migration Required

### Current Status
- **Recruiter records ready**: 148 complete records from 1M+ total
- **Issue**: Organizations table missing required columns
- **Solution**: Execute SQL migration below

### Required Columns to Add
- `phone` - Contact phone number
- `website` - Company website URL
- `address` - Physical address  
- `city` - City location
- `email` - Contact email address
- `companyType` - Type of company/industry

---

### 🚀 MIGRATION STEPS

#### Option 1: Via Supabase Dashboard (RECOMMENDED - 2 minutes)

1. **Go to your Supabase project**: https://dpooleduinyyzxgrcwko.supabase.co

2. **Navigate to**: SQL Editor (left sidebar)

3. **Copy and paste this SQL**:

```sql
-- Add recruiter-specific columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "companyType" text;

-- Create indexes for better query performance  
CREATE INDEX IF NOT EXISTS idx_organizations_city ON organizations(city);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_companyType ON organizations("companyType");
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);
```

4. **Click "Run"**

5. **Verify**: You should see "Success. No rows returned"

---

#### Option 2: Via Connection String (If you have database URL)

If you have direct PostgreSQL access, run:

```bash
cd /app
psql "YOUR_DATABASE_CONNECTION_STRING" -f scripts/schema_migration.sql
```

---

### ✅ After Migration

Once the SQL is executed, run the import script:

```bash
cd /app
node scripts/import_recruiters.js
```

This will:
- ✓ Create 148 recruiter organizations in the database
- ✓ Create 148 auth users (email + password)
- ✓ Create 148 user records linked to organizations
- ✓ All with password: `Recruit@2025`

---

### 📊 Data Summary

- **Total records in file**: 1,048,015
- **Complete records (100% data)**: 148
- **Unique emails**: 129
- **Top locations**: Chennai (18), Madurai (18), Nagercoil (13)
- **Top industries**: Software (21), OEM Manufacturing (13), IT Services (8)

---

### 🔒 Security Note

All recruiters will be created with:
- **Default Password**: `Recruit@2025` 
- **Role**: `recruiter`
- **Status**: Active
- They should change their password on first login

---

Need help? Let me know once you've run the SQL migration!
