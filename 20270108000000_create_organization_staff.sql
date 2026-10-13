-- ============================================================================
-- Migration: Normalize college_lecturers and school_educators into organization_staff
-- Purpose: Single unified table for staff/faculty across all organization types
-- Supports: College faculty + RareMinds trainers (multi-college assignments)
-- Date: 2027-01-08
-- Modified: 2027-01-08 - Added support for RareMinds trainers with mapping table
-- ============================================================================

-- Create the normalized organization_staff table
CREATE TABLE IF NOT EXISTS "public"."organization_staff" (
    -- Primary Key
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    
    -- Core References
    "user_id" uuid, -- References auth.users(id), can be null during onboarding
    "organization_id" uuid NOT NULL, -- References organizations(id)
    "organization_type" varchar(20) NOT NULL, -- 'school', 'college', 'company', 'rareminds', etc.
    
    -- Employee Information
    "employee_id" varchar(50), -- Auto-generated or manual (e.g., FAC001, SPR-T-0001)
    "first_name" varchar(255),
    "last_name" varchar(255),
    "email" varchar(255),
    "phone" varchar(20),
    "date_of_birth" date,
    "gender" varchar(20),
    
    -- Address Information (unified as JSONB for flexibility)
    "address" jsonb DEFAULT '{}'::jsonb,
    -- Structure: {"street": "...", "city": "...", "state": "...", "country": "...", "pincode": "..."}
    -- Replaces: school_educators' separate city/state/country/pincode fields
    
    -- Professional Information
    -- NOTE: department, designation, specialization removed - use metadata field instead for flexibility
    "role" varchar(50), -- e.g., "school_admin", "lecturer", "subject_teacher", "class_teacher", "rm_trainer"
    "qualification" varchar(255),
    "experience_years" integer,
    "date_of_joining" date,
    
    -- Subject/Teaching Expertise (unified as JSONB)
    "subject_expertise" jsonb DEFAULT '[]'::jsonb,
    -- Structure: [{"name": "Math", "proficiency": "expert", "years_experience": 5}, ...]
    -- Replaces: school_educators.subjects_handled (text[])
    
    -- Status Fields
    "account_status" varchar(20) DEFAULT 'active'::varchar,
    -- Values: 'active', 'inactive', 'pending', 'deactivated', 'suspended'
    
    "onboarding_status" varchar(20) DEFAULT 'pending'::varchar,
    -- Values: 'pending', 'documents_uploaded', 'verified', 'active', 'inactive'
    
    "verification_status" varchar(50) DEFAULT 'pending'::varchar,
    -- Values: 'pending', 'approved', 'rejected'
    
    -- Document URLs
    "degree_certificate_url" text,
    "id_proof_url" text,
    "resume_url" text,
    "photo_url" text,
    "experience_letters_url" jsonb DEFAULT '[]'::jsonb,
    -- Can be array of URLs: ["url1", "url2"] or objects: [{"name": "...", "url": "..."}]
    
    -- Temporary Password (for first-time login)
    "temporary_password" varchar(255),
    "password_created_at" timestamptz,
    
    -- Flexible Metadata (organization-specific data)
    "metadata" jsonb DEFAULT '{}'::jsonb,
    -- Examples:
    --   School: {"permissions": ["view_learners", "edit_curriculum"]}
    --   College: {"role": "lecturer", "roles": ["Lecturer"], "created_by": "admin@college.edu"}
    --   Company: {"clearance_level": "L3", "team": "Engineering"}
    
    -- Verification & Audit
    "created_by" uuid, -- User who created this record
    "verified_by" uuid, -- User who verified/approved this staff member
    "verified_at" timestamptz,
    
    -- Timestamps
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    
    -- Constraints
    CONSTRAINT "organization_staff_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT "organization_staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT "organization_staff_email_format_check" CHECK (
        ("email" IS NULL) OR 
        ("email"::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)
    ),
    CONSTRAINT "organization_staff_account_status_check" CHECK (
        "account_status"::text = ANY (ARRAY[
            'active'::varchar, 
            'inactive'::varchar, 
            'pending'::varchar, 
            'deactivated'::varchar,
            'suspended'::varchar
        ]::text[])
    ),
    CONSTRAINT "organization_staff_onboarding_status_check" CHECK (
        "onboarding_status"::text = ANY (ARRAY[
            'pending'::varchar,
            'documents_uploaded'::varchar,
            'verified'::varchar,
            'active'::varchar,
            'inactive'::varchar
        ]::text[])
    ),
    CONSTRAINT "organization_staff_organization_type_check" CHECK (
        "organization_type"::text = ANY (ARRAY[
            'school'::varchar,
            'college'::varchar,
            'company'::varchar,
            'rareminds'::varchar,
            'ngo'::varchar,
            'government'::varchar
        ]::text[])
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_organization_staff_user_id" ON "public"."organization_staff" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_organization_staff_organization_id" ON "public"."organization_staff" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_organization_staff_email" ON "public"."organization_staff" USING btree ("email");
CREATE INDEX IF NOT EXISTS "idx_organization_staff_employee_id" ON "public"."organization_staff" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_organization_staff_organization_type" ON "public"."organization_staff" USING btree ("organization_type");
CREATE INDEX IF NOT EXISTS "idx_organization_staff_account_status" ON "public"."organization_staff" USING btree ("account_status");
CREATE INDEX IF NOT EXISTS "idx_organization_staff_role" ON "public"."organization_staff" USING btree ("role");

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_organization_staff_org_type_status" 
    ON "public"."organization_staff" USING btree ("organization_id", "organization_type", "account_status");

CREATE INDEX IF NOT EXISTS "idx_organization_staff_org_role" 
    ON "public"."organization_staff" USING btree ("organization_id", "role");

-- Unique constraint: one user can only have one active record per organization
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organization_staff_user_org_unique" 
    ON "public"."organization_staff" ("user_id", "organization_id") 
    WHERE "user_id" IS NOT NULL AND "account_status" = 'active';

-- Comments for documentation
COMMENT ON TABLE "public"."organization_staff" IS 'Unified table for all staff/faculty members across all organization types (schools, colleges, companies, etc.). Replaces college_lecturers and school_educators tables.';

COMMENT ON COLUMN "public"."organization_staff"."user_id" IS 'References public.users (shadow table synced from SSO Worker auth.users). Can be NULL during onboarding before SSO account is created.';
COMMENT ON COLUMN "public"."organization_staff"."organization_type" IS 'Type of organization: school, college, company, rareminds, ngo, government';
COMMENT ON COLUMN "public"."organization_staff"."address" IS 'JSONB object containing structured address: {street, city, state, country, pincode}';
COMMENT ON COLUMN "public"."organization_staff"."subject_expertise" IS 'JSONB array of subjects with proficiency and experience: [{"name": "Math", "proficiency": "expert", "years_experience": 5}]';
COMMENT ON COLUMN "public"."organization_staff"."experience_letters_url" IS 'JSONB array of experience letter URLs or objects with metadata';
COMMENT ON COLUMN "public"."organization_staff"."metadata" IS 'Flexible JSONB field for organization-specific data (permissions, custom fields, etc.)';
COMMENT ON COLUMN "public"."organization_staff"."role" IS 'Staff role within the organization: school_admin, lecturer, subject_teacher, class_teacher, etc.';
COMMENT ON COLUMN "public"."organization_staff"."employee_id" IS 'Organization-specific employee identifier (can be auto-generated or manual)';

-- Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_organization_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organization_staff_updated_at_trigger
    BEFORE UPDATE ON "public"."organization_staff"
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_staff_updated_at();

-- RLS Policies (Row Level Security)
ALTER TABLE "public"."organization_staff" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view staff in their organization
CREATE POLICY "Users can view organization staff"
    ON "public"."organization_staff"
    FOR SELECT
    USING (
        -- User is viewing their own record
        auth.uid() = user_id
        OR
        -- User belongs to the same organization (generic check)
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_staff.organization_id
            AND om.status = 'active'
        )
    );

-- Policy: Organization owners/admins can manage staff
CREATE POLICY "Organization admins can manage staff"
    ON "public"."organization_staff"
    FOR ALL
    USING (
        -- Only owners and admins can manage staff (generic across all org types)
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_staff.organization_id
            AND om.role IN ('owner', 'admin')
            AND om.status = 'active'
        )
    );

-- Policy: Staff can update their own profile
CREATE POLICY "Staff can update own profile"
    ON "public"."organization_staff"
    FOR UPDATE
    USING (
        auth.uid() = user_id
    )
    WITH CHECK (
        auth.uid() = user_id
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organization_staff" TO authenticated;
GRANT SELECT ON "public"."organization_staff" TO anon;

-- Set table owner
ALTER TABLE "public"."organization_staff" OWNER TO postgres;
