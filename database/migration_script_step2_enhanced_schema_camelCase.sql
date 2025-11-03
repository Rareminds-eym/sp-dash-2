-- ============================================================
-- RAREMINDS DATABASE MIGRATION - STEP 2
-- Safe Migration Script for rareminds_schema_v2_enhanced.sql
-- This applies enhancements from V2 schema (enrollment system, unified colleges)
-- ============================================================

-- ============================================================
-- NEW ENUMS FOR V2
-- ============================================================

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM (
        'active',
        'completed',
        'withdrawn',
        'transferred',
        'suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE college_type AS ENUM (
        'standalone',
        'university_department'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Modify entity_type enum to use 'college' instead of 'college_standalone'
DO $$
BEGIN
    -- Check if the enum needs updating
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'college' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'entityType')
    ) THEN
        -- Add new value if it doesn't exist
        ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'college';
    END IF;
END $$;

-- ============================================================
-- UNIFIED COLLEGES TABLE (Replaces colleges_standalone + university_colleges)
-- ============================================================

CREATE TABLE IF NOT EXISTS colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,  -- NULL = standalone
    
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    
    -- College type
    college_type college_type DEFAULT 'standalone',
    
    -- Department-specific fields (for university colleges)
    dean_name VARCHAR(200),
    dean_email VARCHAR(255),
    dean_phone VARCHAR(20),
    
    -- Standalone college fields
    affiliation VARCHAR(255),
    accreditation VARCHAR(100),
    
    -- Common fields
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approvedBy UUID REFERENCES users(id),
    approvedAt TIMESTAMP WITH TIME ZONE,
    
    -- Aggregated counts for Admin Dashboard
    totalCourses INTEGER DEFAULT 0,
    totalLecturers INTEGER DEFAULT 0,
    totalStudents INTEGER DEFAULT 0,
    
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(code)
);

-- Migration from old tables
DO $$
BEGIN
    -- Migrate from colleges_standalone if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'colleges_standalone') THEN
        INSERT INTO colleges (
            id, name, code, affiliation, accreditation, address, city, state, 
            country, pincode, phone, email, website, established_year,
            college_type, accountStatus, approvalStatus, approvedBy, approvedAt,
            totalCourses, totalLecturers, totalStudents, createdAt, updatedAt, metadata
        )
        SELECT 
            id, name, code, affiliation, accreditation, address, city, state,
            country, pincode, phone, email, website, established_year,
            'standalone', accountStatus, approvalStatus, approvedBy, approvedAt,
            totalCourses, totalLecturers, totalStudents, createdAt, updatedAt, metadata
        FROM colleges_standalone
        ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Migrate from university_colleges if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'university_colleges') THEN
        INSERT INTO colleges (
            id, university_id, name, code, dean_name, dean_email, dean_phone,
            established_year, college_type, accountStatus, createdAt, updatedAt, metadata
        )
        SELECT 
            id, university_id, name, code, dean_name, dean_email, dean_phone,
            established_year, 'university_department', accountStatus, createdAt, updatedAt, metadata
        FROM university_colleges
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(code);
CREATE INDEX IF NOT EXISTS idx_colleges_university ON colleges(university_id);
CREATE INDEX IF NOT EXISTS idx_colleges_type ON colleges(college_type);
CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges(accountStatus, approvalStatus);
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state);

-- Update foreign key references for college_courses
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE college_courses DROP CONSTRAINT IF EXISTS college_courses_college_id_fkey;
    
    -- Add new constraint pointing to unified colleges table
    ALTER TABLE college_courses 
    ADD CONSTRAINT college_courses_college_id_fkey 
    FOREIGN KEY (collegeId) REFERENCES colleges(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update foreign key references for college_lecturers
DO $$
BEGIN
    ALTER TABLE college_lecturers DROP CONSTRAINT IF EXISTS college_lecturers_college_id_fkey;
    ALTER TABLE college_lecturers 
    ADD CONSTRAINT college_lecturers_college_id_fkey 
    FOREIGN KEY (collegeId) REFERENCES colleges(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update trigger for unified colleges table
DROP TRIGGER IF EXISTS update_colleges_updated_at ON colleges;
CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON colleges 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STUDENT ENROLLMENTS TABLE (Multi-class history tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Entity references (ONE ACTIVE AT A TIME per student)
    schoolId UUID REFERENCES schools(id) ON DELETE SET NULL,
    collegeId UUID REFERENCES colleges(id) ON DELETE SET NULL,
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    
    -- Class/Course references  
    schoolClassId UUID REFERENCES school_classes(id) ON DELETE SET NULL,
    collegeCourseId UUID REFERENCES college_courses(id) ON DELETE SET NULL,
    universityCourseId UUID REFERENCES university_courses(id) ON DELETE SET NULL,
    
    -- Enrollment details
    enrollmentNumber VARCHAR(100),
    enrollmentDate DATE NOT NULL,
    expectedGraduationDate DATE,
    actual_graduation_date DATE,
    enrollment_status enrollment_status DEFAULT 'active',
    
    -- Transfer/withdrawal information
    withdrawalDate DATE,
    withdrawal_reason TEXT,
    transfer_to_entity_id UUID,
    transfer_to_class_id UUID,
    transfer_date DATE,
    transferReason TEXT,
    
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Constraint: Only one class type can be set
    CONSTRAINT chk_enrollment_one_class CHECK (
        (school_class_id IS NOT NULL AND college_course_id IS NULL AND university_course_id IS NULL) OR
        (school_class_id IS NULL AND college_course_id IS NOT NULL AND university_course_id IS NULL) OR
        (school_class_id IS NULL AND college_course_id IS NULL AND university_course_id IS NOT NULL)
    ),
    
    -- Constraint: Entity must match class entity
    CONSTRAINT chk_enrollment_entity_match CHECK (
        (school_class_id IS NOT NULL AND school_id IS NOT NULL) OR
        (college_course_id IS NOT NULL AND college_id IS NOT NULL) OR
        (university_course_id IS NOT NULL AND university_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_status ON student_enrollments(enrollmentStatus);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_school_class ON student_enrollments(schoolClassId);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_college_course ON student_enrollments(collegeCourseId);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_university_course ON student_enrollments(universityCourseId);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_dates ON student_enrollments(enrollmentDate, expectedGraduationDate);

-- Add trigger for student_enrollments
DROP TRIGGER IF EXISTS update_student_enrollments_updated_at ON student_enrollments;
CREATE TRIGGER update_student_enrollments_updated_at BEFORE UPDATE ON student_enrollments 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Get Active Enrollment for Student
-- ============================================================

CREATE OR REPLACE FUNCTION get_active_enrollment(p_student_id UUID)
RETURNS TABLE (
    enrollment_id UUID,
    entityType TEXT,
    entity_name TEXT,
    className TEXT,
    enrollmentDate DATE,
    expectedGraduationDate DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        se.id as enrollment_id,
        CASE 
            WHEN se.school_id IS NOT NULL THEN 'school'
            WHEN se.college_id IS NOT NULL THEN 'college'
            WHEN se.university_id IS NOT NULL THEN 'university'
        END as entityType,
        COALESCE(s.name, c.name, u.name) as entity_name,
        COALESCE(sc.name, cc.name, uc.name) as className,
        se.enrollmentDate,
        se.expected_graduation_date
    FROM student_enrollments se
    LEFT JOIN schools s ON se.schoolId = s.id
    LEFT JOIN colleges c ON se.collegeId = c.id
    LEFT JOIN universities u ON se.university_id = u.id
    LEFT JOIN school_classes sc ON se.schoolClassId = sc.id
    LEFT JOIN college_courses cc ON se.collegeCourseId = cc.id
    LEFT JOIN university_courses uc ON se.universityCourseId = uc.id
    WHERE se.student_id = p_student_id
    AND se.enrollmentStatus = 'active'
    ORDER BY se.enrollment_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Transfer Student to New Class
-- ============================================================

CREATE OR REPLACE FUNCTION transfer_student(
    p_student_id UUID,
    p_new_entity_type TEXT,
    p_new_entity_id UUID,
    p_new_class_id UUID,
    p_transfer_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_old_enrollment_id UUID;
    v_new_enrollment_id UUID;
BEGIN
    -- Mark current enrollment as transferred
    UPDATE student_enrollments
    SET enrollmentStatus = 'transferred',
        transfer_date = CURRENT_DATE,
        transferReason = p_transfer_reason,
        transfer_to_entity_id = p_new_entity_id,
        transfer_to_class_id = p_new_class_id,
        updatedAt = NOW()
    WHERE student_id = p_student_id
    AND enrollmentStatus = 'active'
    RETURNING id INTO v_old_enrollment_id;
    
    -- Create new enrollment
    INSERT INTO student_enrollments (
        student_id,
        schoolId,
        collegeId,
        university_id,
        schoolClassId,
        collegeCourseId,
        universityCourseId,
        enrollmentDate,
        enrollmentStatus
    )
    VALUES (
        p_student_id,
        CASE WHEN p_new_entity_type = 'school' THEN p_new_entity_id ELSE NULL END,
        CASE WHEN p_new_entity_type = 'college' THEN p_new_entity_id ELSE NULL END,
        CASE WHEN p_new_entity_type = 'university' THEN p_new_entity_id ELSE NULL END,
        CASE WHEN p_new_entity_type = 'school' THEN p_new_class_id ELSE NULL END,
        CASE WHEN p_new_entity_type = 'college' THEN p_new_class_id ELSE NULL END,
        CASE WHEN p_new_entity_type = 'university' THEN p_new_class_id ELSE NULL END,
        CURRENT_DATE,
        'active'
    )
    RETURNING id INTO v_new_enrollment_id;
    
    RETURN v_new_enrollment_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Calculate Entity Student Counts
-- ============================================================

CREATE OR REPLACE FUNCTION update_entity_student_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update school counts
    IF NEW.school_id IS NOT NULL THEN
        UPDATE schools SET totalStudents = (
            SELECT COUNT(DISTINCT student_id) FROM student_enrollments 
            WHERE schoolId = NEW.school_id AND enrollmentStatus = 'active'
        )
        WHERE id = NEW.school_id;
    END IF;
    
    -- Update college counts
    IF NEW.college_id IS NOT NULL THEN
        UPDATE colleges SET totalStudents = (
            SELECT COUNT(DISTINCT student_id) FROM student_enrollments 
            WHERE collegeId = NEW.college_id AND enrollmentStatus = 'active'
        )
        WHERE id = NEW.college_id;
    END IF;
    
    -- Update university counts
    IF NEW.university_id IS NOT NULL THEN
        UPDATE universities SET totalStudents = (
            SELECT COUNT(DISTINCT student_id) FROM student_enrollments 
            WHERE university_id = NEW.university_id AND enrollmentStatus = 'active'
        )
        WHERE id = NEW.university_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating entity student counts
DROP TRIGGER IF EXISTS update_entity_counts_on_enrollment ON student_enrollments;
CREATE TRIGGER update_entity_counts_on_enrollment
AFTER INSERT OR UPDATE ON student_enrollments
FOR EACH ROW
EXECUTE FUNCTION update_entity_student_counts();

-- ============================================================
-- FUNCTION: Validate One Active Enrollment Per Student
-- ============================================================

CREATE OR REPLACE FUNCTION validate_one_active_enrollment()
RETURNS TRIGGER AS $$
DECLARE
    v_active_count INTEGER;
BEGIN
    IF NEW.enrollmentStatus = 'active' THEN
        SELECT COUNT(*) INTO v_active_count
        FROM student_enrollments
        WHERE student_id = NEW.student_id
        AND enrollmentStatus = 'active'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
        
        IF v_active_count > 0 THEN
            RAISE EXCEPTION 'Student can only have one active enrollment at a time';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce one active enrollment
DROP TRIGGER IF EXISTS check_one_active_enrollment ON student_enrollments;
CREATE TRIGGER check_one_active_enrollment
BEFORE INSERT OR UPDATE ON student_enrollments
FOR EACH ROW
EXECUTE FUNCTION validate_one_active_enrollment();

-- ============================================================
-- VIEW: Unified Entity Overview
-- ============================================================

CREATE OR REPLACE VIEW v_entity_overview AS
SELECT 
    'school' as entityType,
    id as entityId,
    name as entity_name,
    code,
    state,
    accountStatus,
    approvalStatus,
    totalStudents,
    total_classes as total_classes_courses,
    total_educators as total_staff,
    created_at
FROM schools
UNION ALL
SELECT 
    'college' as entityType,
    id as entityId,
    name as entity_name,
    code,
    state,
    accountStatus,
    approvalStatus,
    totalStudents,
    total_courses as total_classes_courses,
    total_lecturers as total_staff,
    created_at
FROM colleges
UNION ALL
SELECT 
    'university' as entityType,
    id as entityId,
    name as entity_name,
    code,
    state,
    accountStatus,
    approvalStatus,
    totalStudents,
    total_courses as total_classes_courses,
    total_lecturers as total_staff,
    created_at
FROM universities
UNION ALL
SELECT 
    'company' as entityType,
    id as entityId,
    name as entity_name,
    code,
    hq_state as state,
    accountStatus,
    approvalStatus,
    0 as totalStudents,
    total_branches as total_classes_courses,
    total_recruiters as total_staff,
    created_at
FROM companies;

-- ============================================================
-- VIEW: Student Current Enrollment
-- ============================================================

CREATE OR REPLACE VIEW v_student_current_enrollment AS
SELECT 
    s.id as student_id,
    s.name as student_name,
    s.email as student_email,
    se.enrollmentNumber,
    CASE 
        WHEN se.school_id IS NOT NULL THEN 'school'
        WHEN se.college_id IS NOT NULL THEN 'college'
        WHEN se.university_id IS NOT NULL THEN 'university'
    END as entityType,
    COALESCE(sch.id, col.id, uni.id) as entityId,
    COALESCE(sch.name, col.name, uni.name) as entity_name,
    COALESCE(sc.name, cc.name, uc.name) as className,
    se.enrollmentDate,
    se.expectedGraduationDate,
    se.enrollment_status
FROM students s
LEFT JOIN student_enrollments se ON s.id = se.student_id AND se.enrollmentStatus = 'active'
LEFT JOIN schools sch ON se.schoolId = sch.id
LEFT JOIN colleges col ON se.collegeId = col.id
LEFT JOIN universities uni ON se.university_id = uni.id
LEFT JOIN school_classes sc ON se.schoolClassId = sc.id
LEFT JOIN college_courses cc ON se.collegeCourseId = cc.id
LEFT JOIN university_courses uc ON se.universityCourseId = uc.id;

-- ============================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================

-- Indexes for unified colleges table
CREATE INDEX IF NOT EXISTS idx_colleges_university_type ON colleges(university_id, college_type) WHERE university_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_colleges_standalone ON colleges(college_type) WHERE college_type = 'standalone';

-- Composite indexes for enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status_date ON student_enrollments(student_id, enrollmentStatus, enrollment_date DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON student_enrollments(student_id) WHERE enrollmentStatus = 'active';

-- ============================================================
-- COMMENTS ON NEW TABLES AND VIEWS
-- ============================================================

COMMENT ON TABLE colleges IS 'Unified college table - handles both standalone colleges and university departments';
COMMENT ON TABLE student_enrollments IS 'Track student enrollment history across classes/courses with status changes';
COMMENT ON VIEW v_entity_overview IS 'Unified view of all entities (schools, colleges, universities, companies) for admin dashboard';
COMMENT ON VIEW v_student_current_enrollment IS 'Shows current active enrollment details for all students';
COMMENT ON FUNCTION get_active_enrollment(UUID) IS 'Retrieves active enrollment details for a specific student';
COMMENT ON FUNCTION transfer_student(UUID, TEXT, UUID, UUID, TEXT) IS 'Transfers student from current enrollment to new class/course';
COMMENT ON CONSTRAINT chk_enrollment_one_class ON student_enrollments IS 'Enforces ONE CLASS constraint - student can only be enrolled in one class at a time';

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$ 
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STEP 2: RAREMINDS ENHANCED SCHEMA V2 MIGRATION COMPLETED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'New features added:';
    RAISE NOTICE '  - Unified colleges table (standalone + university departments)';
    RAISE NOTICE '  - Student enrollments table (multi-class history tracking)';
    RAISE NOTICE '  - Enrollment management functions';
    RAISE NOTICE '  - Unified entity views for admin dashboard';
    RAISE NOTICE '  - Enhanced constraints and triggers';
    RAISE NOTICE '';
    RAISE NOTICE 'Database migration completed successfully!';
    RAISE NOTICE 'All existing data preserved.';
    RAISE NOTICE '============================================================';
END $$;
