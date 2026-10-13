-- ============================================================================
-- Migration: Create organization_staff_assignments table
-- Purpose: Maps organization staff to organizations with proper FK relationships
-- Date: 2027-01-08
-- Modified: 2027-01-09 - Renamed from staff_college_assignments to organization_staff_assignments
-- Dependencies: Requires organization_staff table (20270108000000)
-- ============================================================================

-- ============================================================================
-- TABLE: organization_staff_assignments
-- Purpose: Maps staff (trainers/faculty) to organizations (colleges/schools/companies)
-- Links to: departments → programs → program_sections → courses
-- Unified table supporting: RareMinds trainers → colleges, school teachers → classes, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."organization_staff_assignments" (
    -- Primary Key
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    
    -- Core References (REQUIRED)
    "staff_id" uuid NOT NULL, -- FK to organization_staff(id) - the staff member
    "college_id" uuid NOT NULL, -- FK to organizations(id) - which organization (college/school/company)
    "department_id" uuid NOT NULL, -- FK to departments(id) - which department at the organization
    
    -- Optional References (for more specific assignments)
    "program_id" uuid, -- FK to programs(id) - which program/specialization (NULL = all programs in dept)
    "section_id" uuid, -- FK to program_sections(id) - which section (NULL = all sections)
    
    -- Assigned Courses (JSONB array of course IDs)
    "assigned_courses" jsonb DEFAULT '[]'::jsonb,
    -- Structure: ["course-uuid-1", "course-uuid-2", "course-uuid-3"]
    -- Or with metadata: [{"id": "uuid", "name": "ML Fundamentals", "code": "CS401"}]
    -- References course IDs from courses table
    
    -- Assignment Metadata
    "start_date" date, -- When this assignment starts
    "end_date" date, -- When this assignment ends (NULL = ongoing)
    "is_active" boolean DEFAULT true,
    "notes" text, -- Any special notes about this assignment
    
    -- Audit Fields
    "assigned_by" uuid, -- User who made this assignment
    "assigned_at" timestamptz DEFAULT now(),
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    "metadata" jsonb DEFAULT '{}'::jsonb, -- Additional flexible data
    
    -- Constraints
    CONSTRAINT "organization_staff_assignments_pkey" PRIMARY KEY ("id"),
    
    -- Foreign Key Constraints
    CONSTRAINT "organization_staff_assignments_staff_id_fkey" 
        FOREIGN KEY ("staff_id") REFERENCES "public"."organization_staff"("id") ON DELETE CASCADE,
    
    CONSTRAINT "organization_staff_assignments_college_id_fkey" 
        FOREIGN KEY ("college_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    
    CONSTRAINT "organization_staff_assignments_department_id_fkey" 
        FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE,
    
    CONSTRAINT "organization_staff_assignments_program_id_fkey" 
        FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE SET NULL,
    
    CONSTRAINT "organization_staff_assignments_section_id_fkey" 
        FOREIGN KEY ("section_id") REFERENCES "public"."program_sections"("id") ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Basic indexes for foreign keys
CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_staff_id" 
    ON "public"."organization_staff_assignments" USING btree ("staff_id");
    
CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_college_id" 
    ON "public"."organization_staff_assignments" USING btree ("college_id");

CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_department_id" 
    ON "public"."organization_staff_assignments" USING btree ("department_id");

CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_program_id" 
    ON "public"."organization_staff_assignments" USING btree ("program_id") 
    WHERE "program_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_section_id" 
    ON "public"."organization_staff_assignments" USING btree ("section_id") 
    WHERE "section_id" IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_active" 
    ON "public"."organization_staff_assignments" USING btree ("is_active") 
    WHERE "is_active" = true;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_staff_college" 
    ON "public"."organization_staff_assignments" USING btree ("staff_id", "college_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_college_dept" 
    ON "public"."organization_staff_assignments" USING btree ("college_id", "department_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_organization_staff_assignments_dept_program" 
    ON "public"."organization_staff_assignments" USING btree ("department_id", "program_id") 
    WHERE "program_id" IS NOT NULL;

-- Unique constraint: one active assignment per staff-college-department-program combination
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organization_staff_assignments_unique_active" 
    ON "public"."organization_staff_assignments" ("staff_id", "college_id", "department_id", "program_id") 
    WHERE "is_active" = true;

-- ============================================================================
-- COMMENTS / DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE "public"."organization_staff_assignments" IS 
'Maps organization staff to organizations with proper FK relationships to departments, programs, sections, and courses. Unified table supporting RareMinds trainers at colleges, school teachers at schools, etc.';

COMMENT ON COLUMN "public"."organization_staff_assignments"."staff_id" IS 
'FK to organization_staff table - the staff member being assigned';

COMMENT ON COLUMN "public"."organization_staff_assignments"."college_id" IS 
'FK to organizations table - which organization the staff is assigned to (college/school/company)';

COMMENT ON COLUMN "public"."organization_staff_assignments"."department_id" IS 
'FK to departments table - which department at the organization (REQUIRED)';

COMMENT ON COLUMN "public"."organization_staff_assignments"."program_id" IS 
'FK to programs table - which program/specialization (NULL = teaches all programs in the department)';

COMMENT ON COLUMN "public"."organization_staff_assignments"."section_id" IS 
'FK to program_sections table - which specific section (NULL = teaches all sections)';

COMMENT ON COLUMN "public"."organization_staff_assignments"."assigned_courses" IS 
'JSONB array of course IDs from courses table that this staff teaches. Example: ["course-uuid-1", "course-uuid-2"] or [{"id": "uuid", "name": "Course Name"}]';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_staff_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organization_staff_assignments_updated_at_trigger
    BEFORE UPDATE ON "public"."organization_staff_assignments"
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_staff_assignments_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE "public"."organization_staff_assignments" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view assignments for their organization
CREATE POLICY "Users can view staff assignments"
    ON "public"."organization_staff_assignments"
    FOR SELECT
    USING (
        -- Staff can view their own assignments
        EXISTS (
            SELECT 1 FROM organization_staff os
            WHERE os.id = organization_staff_assignments.staff_id
            AND os.user_id = auth.uid()
        )
        OR
        -- Organization admins can view staff assigned to their organization
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.organization_id = organization_staff_assignments.college_id
            AND om.status = 'active'
        )
        OR
        -- RareMinds admins can view all assignments
        EXISTS (
            SELECT 1 FROM organization_staff os
            JOIN organizations o ON os.organization_id = o.id
            WHERE os.user_id = auth.uid()
            AND (o.metadata->>'is_platform_org')::boolean = true
            AND os.role IN ('rm_admin', 'rm_manager', 'super_admin')
        )
    );

-- Policy: Only RareMinds admins can create/update/delete assignments
CREATE POLICY "RareMinds admins can manage assignments"
    ON "public"."organization_staff_assignments"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_staff os
            JOIN organizations o ON os.organization_id = o.id
            WHERE os.user_id = auth.uid()
            AND (o.metadata->>'is_platform_org')::boolean = true
            AND os.role IN ('rm_admin', 'rm_manager', 'super_admin')
        )
    );

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."organization_staff_assignments" TO authenticated;
GRANT SELECT ON "public"."organization_staff_assignments" TO anon;

-- Set table owner
ALTER TABLE "public"."organization_staff_assignments" OWNER TO postgres;
