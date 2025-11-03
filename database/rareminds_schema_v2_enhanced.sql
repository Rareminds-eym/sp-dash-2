-- ============================================================
-- RAREMINDS PLATFORM - ENHANCED DATABASE SCHEMA V2.0
-- Database: PostgreSQL 15+ (Supabase)
-- Purpose: Production-ready schema with college reassignment & student progression
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================
-- ENUMS
-- ============================================================

-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'platform_admin',
        'school_admin',
        'college_admin',
        'university_admin',
        'college_under_university_admin',
        'company_admin',
        'branch_manager',
        'educator',
        'lecturer',
        'student',
        'recruiter'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE entity_type AS ENUM (
        'school',
        'college',
        'university',
        'company'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM (
        'active',
        'inactive',
        'suspended',
        'pending'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM (
        'pending',
        'approved',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    CREATE TYPE verification_status AS ENUM (
        'pending',
        'verified',
        'rejected',
        'in_review'
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

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_auth_id UUID UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL,
    entity_type entity_type,
    entity_id UUID,
    account_status account_status DEFAULT 'pending',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    last_password_change TIMESTAMP WITH TIME ZONE,
    profile_image_url TEXT,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_role_entity CHECK (
        (role = 'platform_admin' AND entity_type IS NULL AND entity_id IS NULL) OR
        (role != 'platform_admin' AND entity_type IS NOT NULL)
    )
);

-- Add foreign key for created_by after users table is created
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_created_by;
ALTER TABLE users ADD CONSTRAINT fk_users_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Alter existing users table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supabase_auth_id') THEN
        ALTER TABLE users ADD COLUMN supabase_auth_id UUID UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_name') THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entity_type') THEN
        ALTER TABLE users ADD COLUMN entity_type entity_type;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entity_id') THEN
        ALTER TABLE users ADD COLUMN entity_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_status') THEN
        ALTER TABLE users ADD COLUMN account_status account_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_password_change') THEN
        ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_image_url') THEN
        ALTER TABLE users ADD COLUMN profile_image_url TEXT;
    END IF;
END $$;

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity ON users(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

-- ============================================================
-- SCHOOL STRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    board VARCHAR(100),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Aggregated counts for Admin Dashboard
    total_classes INTEGER DEFAULT 0,
    total_educators INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter schools table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='board') THEN
        ALTER TABLE schools ADD COLUMN board VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='approval_status') THEN
        ALTER TABLE schools ADD COLUMN approval_status approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='approved_by') THEN
        ALTER TABLE schools ADD COLUMN approved_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='approved_at') THEN
        ALTER TABLE schools ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='total_classes') THEN
        ALTER TABLE schools ADD COLUMN total_classes INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='total_educators') THEN
        ALTER TABLE schools ADD COLUMN total_educators INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='total_students') THEN
        ALTER TABLE schools ADD COLUMN total_students INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(account_status, approval_status);
CREATE INDEX IF NOT EXISTS idx_schools_state ON schools(state);

CREATE TABLE IF NOT EXISTS school_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    section VARCHAR(10),
    academic_year VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 40,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(school_id, name, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_school_classes_school ON school_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_academic_year ON school_classes(academic_year);

CREATE TABLE IF NOT EXISTS school_educators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experience_years INTEGER,
    date_of_joining DATE,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(school_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_school_educators_school ON school_educators(school_id);
CREATE INDEX IF NOT EXISTS idx_school_educators_user ON school_educators(user_id);

CREATE TABLE IF NOT EXISTS school_educator_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    educator_id UUID NOT NULL REFERENCES school_educators(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(educator_id, class_id, subject, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_educator_assignments_educator ON school_educator_class_assignments(educator_id);
CREATE INDEX IF NOT EXISTS idx_educator_assignments_class ON school_educator_class_assignments(class_id);

-- ============================================================
-- UNIFIED COLLEGES TABLE (Standalone + University Departments)
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
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Aggregated counts for Admin Dashboard
    total_courses INTEGER DEFAULT 0,
    total_lecturers INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
            college_type, account_status, approval_status, approved_by, approved_at,
            total_courses, total_lecturers, total_students, created_at, updated_at, metadata
        )
        SELECT 
            id, name, code, affiliation, accreditation, address, city, state,
            country, pincode, phone, email, website, established_year,
            'standalone', account_status, approval_status, approved_by, approved_at,
            total_courses, total_lecturers, total_students, created_at, updated_at, metadata
        FROM colleges_standalone
        ON CONFLICT (id) DO NOTHING;
    END IF;
    
    -- Migrate from university_colleges if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'university_colleges') THEN
        INSERT INTO colleges (
            id, university_id, name, code, dean_name, dean_email, dean_phone,
            established_year, college_type, account_status, created_at, updated_at, metadata
        )
        SELECT 
            id, university_id, name, code, dean_name, dean_email, dean_phone,
            established_year, 'university_department', account_status, created_at, updated_at, metadata
        FROM university_colleges
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges(code);
CREATE INDEX IF NOT EXISTS idx_colleges_university ON colleges(university_id);
CREATE INDEX IF NOT EXISTS idx_colleges_type ON colleges(college_type);
CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges(account_status, approval_status);
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges(state);

CREATE TABLE IF NOT EXISTS college_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    program VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    year INTEGER,
    semester INTEGER,
    section VARCHAR(10),
    academic_year VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 60,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(college_id, name, academic_year)
);

-- Update foreign key references if migrating
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE college_courses DROP CONSTRAINT IF EXISTS college_courses_college_id_fkey;
    
    -- Add new constraint
    ALTER TABLE college_courses 
    ADD CONSTRAINT college_courses_college_id_fkey 
    FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_college_courses_college ON college_courses(college_id);
CREATE INDEX IF NOT EXISTS idx_college_courses_academic_year ON college_courses(academic_year);

CREATE TABLE IF NOT EXISTS college_lecturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experience_years INTEGER,
    date_of_joining DATE,
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(college_id, employee_id)
);

-- Update foreign key references
DO $$
BEGIN
    ALTER TABLE college_lecturers DROP CONSTRAINT IF EXISTS college_lecturers_college_id_fkey;
    ALTER TABLE college_lecturers 
    ADD CONSTRAINT college_lecturers_college_id_fkey 
    FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_college_lecturers_college ON college_lecturers(college_id);
CREATE INDEX IF NOT EXISTS idx_college_lecturers_user ON college_lecturers(user_id);

CREATE TABLE IF NOT EXISTS college_lecturer_course_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES college_lecturers(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES college_courses(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(lecturer_id, course_id, subject, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_lecturer ON college_lecturer_course_assignments(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_course ON college_lecturer_course_assignments(course_id);

-- ============================================================
-- UNIVERSITY STRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    university_type VARCHAR(50),
    accreditation VARCHAR(100),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Aggregated counts for Admin Dashboard
    total_colleges INTEGER DEFAULT 0,
    total_courses INTEGER DEFAULT 0,
    total_lecturers INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter universities table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='university_type') THEN
        ALTER TABLE universities ADD COLUMN university_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approval_status') THEN
        ALTER TABLE universities ADD COLUMN approval_status approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approved_by') THEN
        ALTER TABLE universities ADD COLUMN approved_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approved_at') THEN
        ALTER TABLE universities ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='account_status') THEN
        ALTER TABLE universities ADD COLUMN account_status account_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_colleges') THEN
        ALTER TABLE universities ADD COLUMN total_colleges INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_courses') THEN
        ALTER TABLE universities ADD COLUMN total_courses INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_lecturers') THEN
        ALTER TABLE universities ADD COLUMN total_lecturers INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_students') THEN
        ALTER TABLE universities ADD COLUMN total_students INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_universities_code ON universities(code);
CREATE INDEX IF NOT EXISTS idx_universities_status ON universities(account_status, approval_status);
CREATE INDEX IF NOT EXISTS idx_universities_state ON universities(state);

-- ============================================================
-- STUDENTS TABLE (Simplified - enrollment details moved to student_enrollments)
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current active enrollment reference
    current_enrollment_id UUID,
    
    -- Student personal details
    enrollment_number VARCHAR(100) UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(20),
    blood_group VARCHAR(5),
    
    -- Guardian information
    guardian_name VARCHAR(200),
    guardian_phone VARCHAR(20),
    guardian_email VARCHAR(255),
    guardian_relation VARCHAR(50),
    
    -- Address
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    
    -- Overall academic performance
    overall_cgpa DECIMAL(4,2),
    
    -- Legacy fields from current implementation (for backward compatibility)
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    universityId UUID,
    organizationId UUID,
    profile JSONB DEFAULT '{}',
    
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter students table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='current_enrollment_id') THEN
        ALTER TABLE students ADD COLUMN current_enrollment_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='overall_cgpa') THEN
        ALTER TABLE students ADD COLUMN overall_cgpa DECIMAL(4,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_name') THEN
        ALTER TABLE students ADD COLUMN guardian_name VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_phone') THEN
        ALTER TABLE students ADD COLUMN guardian_phone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_email') THEN
        ALTER TABLE students ADD COLUMN guardian_email VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_relation') THEN
        ALTER TABLE students ADD COLUMN guardian_relation VARCHAR(50);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollment_number);
CREATE INDEX IF NOT EXISTS idx_students_current_enrollment ON students(current_enrollment_id);

-- ============================================================
-- STUDENT ENROLLMENTS TABLE (Enrollment History & Progression)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Entity references
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    college_id UUID REFERENCES colleges(id) ON DELETE SET NULL,
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    
    -- Class/Course references (ONE ENROLLMENT = ONE CLASS)
    school_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL,
    college_course_id UUID REFERENCES college_courses(id) ON DELETE SET NULL,
    
    -- Enrollment details
    enrollment_type VARCHAR(50) NOT NULL,  -- 'school', 'college', 'university'
    academic_year VARCHAR(20) NOT NULL,
    semester INTEGER,
    year INTEGER,  -- Year of study (1st year, 2nd year, etc.)
    
    -- Status tracking
    enrollment_status enrollment_status DEFAULT 'active',
    
    -- Dates
    enrollment_date DATE NOT NULL,
    expected_completion_date DATE,
    actual_completion_date DATE,
    
    -- Academic performance for this enrollment
    cgpa DECIMAL(4,2),
    attendance_percentage DECIMAL(5,2),
    
    -- Progression tracking
    promoted_to_enrollment_id UUID REFERENCES student_enrollments(id),
    previous_enrollment_id UUID REFERENCES student_enrollments(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Constraint: ONE ENROLLMENT = ONE CLASS/COURSE
    CONSTRAINT chk_one_class_per_enrollment CHECK (
        (school_class_id IS NOT NULL AND college_course_id IS NULL) OR
        (school_class_id IS NULL AND college_course_id IS NOT NULL) OR
        (school_class_id IS NULL AND college_course_id IS NULL AND enrollment_type = 'direct')
    )
);

-- Create partial unique index to ensure only ONE active enrollment per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_enrollments_one_active 
ON student_enrollments(student_id, enrollment_status) 
WHERE enrollment_status = 'active';

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON student_enrollments(student_id, enrollment_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_academic_year ON student_enrollments(academic_year);
CREATE INDEX IF NOT EXISTS idx_enrollments_school ON student_enrollments(school_id, school_class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_college ON student_enrollments(college_id, college_course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_university ON student_enrollments(university_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_dates ON student_enrollments(enrollment_date, expected_completion_date);

-- Add foreign key constraint from students to student_enrollments
ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_current_enrollment;
ALTER TABLE students 
ADD CONSTRAINT fk_students_current_enrollment 
FOREIGN KEY (current_enrollment_id) REFERENCES student_enrollments(id) ON DELETE SET NULL;

-- Migrate existing student data to enrollments
DO $$
DECLARE
    student_record RECORD;
    new_enrollment_id UUID;
BEGIN
    -- Only migrate if students exist and haven't been migrated yet
    FOR student_record IN 
        SELECT s.* FROM students s 
        LEFT JOIN student_enrollments e ON e.student_id = s.id 
        WHERE e.id IS NULL 
        AND s.account_status = 'active'
        LIMIT 1000  -- Process in batches
    LOOP
        -- Determine enrollment type and references
        IF student_record.school_id IS NOT NULL OR student_record.school_class_id IS NOT NULL THEN
            INSERT INTO student_enrollments (
                student_id, school_id, school_class_id,
                enrollment_type, academic_year, enrollment_status,
                enrollment_date, cgpa
            ) VALUES (
                student_record.id,
                student_record.school_id,
                student_record.school_class_id,
                'school',
                COALESCE(EXTRACT(YEAR FROM student_record.created_at)::TEXT || '-' || (EXTRACT(YEAR FROM student_record.created_at) + 1)::TEXT, '2024-2025'),
                'active',
                COALESCE(student_record.enrollment_date, student_record.created_at::DATE),
                student_record.current_cgpa
            ) RETURNING id INTO new_enrollment_id;
            
        ELSIF student_record.college_id IS NOT NULL OR student_record.college_course_id IS NOT NULL THEN
            INSERT INTO student_enrollments (
                student_id, college_id, college_course_id,
                enrollment_type, academic_year, enrollment_status,
                enrollment_date, cgpa
            ) VALUES (
                student_record.id,
                student_record.college_id,
                student_record.college_course_id,
                'college',
                COALESCE(EXTRACT(YEAR FROM student_record.created_at)::TEXT || '-' || (EXTRACT(YEAR FROM student_record.created_at) + 1)::TEXT, '2024-2025'),
                'active',
                COALESCE(student_record.enrollment_date, student_record.created_at::DATE),
                student_record.current_cgpa
            ) RETURNING id INTO new_enrollment_id;
            
        ELSIF student_record.university_id IS NOT NULL OR student_record.university_course_id IS NOT NULL THEN
            INSERT INTO student_enrollments (
                student_id, university_id, college_course_id,
                enrollment_type, academic_year, enrollment_status,
                enrollment_date, cgpa
            ) VALUES (
                student_record.id,
                student_record.university_id,
                student_record.university_course_id,
                'university',
                COALESCE(EXTRACT(YEAR FROM student_record.created_at)::TEXT || '-' || (EXTRACT(YEAR FROM student_record.created_at) + 1)::TEXT, '2024-2025'),
                'active',
                COALESCE(student_record.enrollment_date, student_record.created_at::DATE),
                student_record.current_cgpa
            ) RETURNING id INTO new_enrollment_id;
        ELSE
            -- Direct student (no institution)
            INSERT INTO student_enrollments (
                student_id, enrollment_type, academic_year, enrollment_status,
                enrollment_date
            ) VALUES (
                student_record.id,
                'direct',
                COALESCE(EXTRACT(YEAR FROM student_record.created_at)::TEXT || '-' || (EXTRACT(YEAR FROM student_record.created_at) + 1)::TEXT, '2024-2025'),
                'active',
                COALESCE(student_record.enrollment_date, student_record.created_at::DATE)
            ) RETURNING id INTO new_enrollment_id;
        END IF;
        
        -- Update student with current enrollment reference
        UPDATE students SET current_enrollment_id = new_enrollment_id WHERE id = student_record.id;
    END LOOP;
END $$;

-- ============================================================
-- SKILL PASSPORTS SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_passports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    nsqf_level INTEGER,
    skills JSONB DEFAULT '[]',
    certifications JSONB DEFAULT '[]',
    work_experience JSONB DEFAULT '[]',
    projects JSONB DEFAULT '[]',
    achievements JSONB DEFAULT '[]',
    status verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    ai_verified BOOLEAN DEFAULT false,
    ai_verification_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter skill_passports table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='nsqf_level') THEN
        ALTER TABLE skill_passports ADD COLUMN nsqf_level INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='certifications') THEN
        ALTER TABLE skill_passports ADD COLUMN certifications JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='work_experience') THEN
        ALTER TABLE skill_passports ADD COLUMN work_experience JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='projects') THEN
        ALTER TABLE skill_passports ADD COLUMN projects JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='achievements') THEN
        ALTER TABLE skill_passports ADD COLUMN achievements JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verified_by') THEN
        ALTER TABLE skill_passports ADD COLUMN verified_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verified_at') THEN
        ALTER TABLE skill_passports ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='ai_verified') THEN
        ALTER TABLE skill_passports ADD COLUMN ai_verified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='ai_verification_score') THEN
        ALTER TABLE skill_passports ADD COLUMN ai_verification_score DECIMAL(5,2);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skill_passports_student ON skill_passports(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_passports_status ON skill_passports(status);
CREATE INDEX IF NOT EXISTS idx_skill_passports_nsqf ON skill_passports(nsqf_level);
CREATE INDEX IF NOT EXISTS idx_skill_passports_ai_verified ON skill_passports(ai_verified);

-- ============================================================
-- COMPANY STRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    hq_address TEXT,
    hq_city VARCHAR(100),
    hq_state VARCHAR(100),
    hq_country VARCHAR(100) DEFAULT 'India',
    hq_pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_year INTEGER,
    contact_person_name VARCHAR(200),
    contact_person_designation VARCHAR(100),
    contact_person_email VARCHAR(255),
    contact_person_phone VARCHAR(20),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Aggregated counts for Admin Dashboard
    total_branches INTEGER DEFAULT 0,
    total_recruiters INTEGER DEFAULT 0,
    hq_recruiters INTEGER DEFAULT 0,
    branch_recruiters INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter companies table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='approval_status') THEN
        ALTER TABLE companies ADD COLUMN approval_status approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='approved_by') THEN
        ALTER TABLE companies ADD COLUMN approved_by UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='approved_at') THEN
        ALTER TABLE companies ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='total_branches') THEN
        ALTER TABLE companies ADD COLUMN total_branches INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='total_recruiters') THEN
        ALTER TABLE companies ADD COLUMN total_recruiters INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='hq_recruiters') THEN
        ALTER TABLE companies ADD COLUMN hq_recruiters INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='branch_recruiters') THEN
        ALTER TABLE companies ADD COLUMN branch_recruiters INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(account_status, approval_status);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_state ON companies(hq_state);

CREATE TABLE IF NOT EXISTS company_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    branch_type VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    branch_head_name VARCHAR(200),
    branch_head_email VARCHAR(255),
    branch_head_phone VARCHAR(20),
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_company_branches_company ON company_branches(company_id);

CREATE TABLE IF NOT EXISTS recruiters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES company_branches(id) ON DELETE SET NULL,
    
    -- Additional fields from current implementation
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    state VARCHAR(100),
    district VARCHAR(100),
    website VARCHAR(255),
    address TEXT,
    
    employee_id VARCHAR(50),
    designation VARCHAR(100),
    department VARCHAR(100),
    date_of_joining DATE,
    is_hq_recruiter BOOLEAN DEFAULT false,
    
    verification_status approval_status DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    user_count INTEGER DEFAULT 0,
    
    account_status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(company_id, employee_id)
);

-- Alter recruiters table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='verification_status') THEN
        ALTER TABLE recruiters ADD COLUMN verification_status approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='is_active') THEN
        ALTER TABLE recruiters ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='user_count') THEN
        ALTER TABLE recruiters ADD COLUMN user_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='state') THEN
        ALTER TABLE recruiters ADD COLUMN state VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='district') THEN
        ALTER TABLE recruiters ADD COLUMN district VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='website') THEN
        ALTER TABLE recruiters ADD COLUMN website VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='address') THEN
        ALTER TABLE recruiters ADD COLUMN address TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recruiters_company ON recruiters(company_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_branch ON recruiters(branch_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_user ON recruiters(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);
CREATE INDEX IF NOT EXISTS idx_recruiters_status ON recruiters(verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_recruiters_state ON recruiters(state);

-- ============================================================
-- VERIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passport_id UUID REFERENCES skill_passports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_type VARCHAR(50) NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    verification_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter verifications table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verification_type') THEN
        ALTER TABLE verifications ADD COLUMN verification_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verification_notes') THEN
        ALTER TABLE verifications ADD COLUMN verification_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verification_data') THEN
        ALTER TABLE verifications ADD COLUMN verification_data JSONB DEFAULT '{}';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_verifications_passport ON verifications(passport_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(verification_status);

-- ============================================================
-- METRICS SNAPSHOTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE UNIQUE NOT NULL,
    active_universities INTEGER DEFAULT 0,
    registered_students INTEGER DEFAULT 0,
    verified_passports INTEGER DEFAULT 0,
    ai_verified_percent DECIMAL(5,2) DEFAULT 0,
    employability_index DECIMAL(5,2) DEFAULT 0,
    active_recruiters INTEGER DEFAULT 0,
    total_schools INTEGER DEFAULT 0,
    total_colleges INTEGER DEFAULT 0,
    total_companies INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter metrics_snapshots table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='total_schools') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN total_schools INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='total_colleges') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN total_colleges INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='total_companies') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN total_companies INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_date ON metrics_snapshots(snapshot_date);

-- ============================================================
-- RBAC TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter audit_logs table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ip_address') THEN
        ALTER TABLE audit_logs ADD COLUMN ip_address INET;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_agent') THEN
        ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='old_values') THEN
        ALTER TABLE audit_logs ADD COLUMN old_values JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='new_values') THEN
        ALTER TABLE audit_logs ADD COLUMN new_values JSONB;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist and create new ones
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_school_classes_updated_at ON school_classes;
CREATE TRIGGER update_school_classes_updated_at BEFORE UPDATE ON school_classes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_school_educators_updated_at ON school_educators;
CREATE TRIGGER update_school_educators_updated_at BEFORE UPDATE ON school_educators 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_colleges_updated_at ON colleges;
CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON colleges 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_college_courses_updated_at ON college_courses;
CREATE TRIGGER update_college_courses_updated_at BEFORE UPDATE ON college_courses 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_college_lecturers_updated_at ON college_lecturers;
CREATE TRIGGER update_college_lecturers_updated_at BEFORE UPDATE ON college_lecturers 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_universities_updated_at ON universities;
CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON universities 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_enrollments_updated_at ON student_enrollments;
CREATE TRIGGER update_student_enrollments_updated_at BEFORE UPDATE ON student_enrollments 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_skill_passports_updated_at ON skill_passports;
CREATE TRIGGER update_skill_passports_updated_at BEFORE UPDATE ON skill_passports 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_branches_updated_at ON company_branches;
CREATE TRIGGER update_company_branches_updated_at BEFORE UPDATE ON company_branches 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recruiters_updated_at ON recruiters;
CREATE TRIGGER update_recruiters_updated_at BEFORE UPDATE ON recruiters 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verifications_updated_at ON verifications;
CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON verifications 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_metrics_snapshots_updated_at ON metrics_snapshots;
CREATE TRIGGER update_metrics_snapshots_updated_at BEFORE UPDATE ON metrics_snapshots 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED PERMISSIONS
-- ============================================================

INSERT INTO permissions (name, resource, action, description) VALUES
('platform:manage_all', 'platform', 'manage_all', 'Full platform access'),
('platform:view_analytics', 'platform', 'view_analytics', 'View platform analytics'),
('platform:configure_settings', 'platform', 'configure_settings', 'Configure platform settings'),

('school:create', 'school', 'create', 'Create schools'),
('school:read', 'school', 'read', 'View school details'),
('school:update', 'school', 'update', 'Update school details'),
('school:delete', 'school', 'delete', 'Delete schools'),
('school:approve', 'school', 'approve', 'Approve schools'),
('school:reject', 'school', 'reject', 'Reject schools'),
('school:suspend', 'school', 'suspend', 'Suspend schools'),

('college:create', 'college', 'create', 'Create colleges'),
('college:read', 'college', 'read', 'View college details'),
('college:update', 'college', 'update', 'Update college details'),
('college:delete', 'college', 'delete', 'Delete colleges'),
('college:approve', 'college', 'approve', 'Approve colleges'),
('college:reject', 'college', 'reject', 'Reject colleges'),
('college:suspend', 'college', 'suspend', 'Suspend colleges'),
('college:reassign', 'college', 'reassign', 'Reassign college to/from university'),

('university:create', 'university', 'create', 'Create universities'),
('university:read', 'university', 'read', 'View university details'),
('university:update', 'university', 'update', 'Update university details'),
('university:delete', 'university', 'delete', 'Delete universities'),
('university:approve', 'university', 'approve', 'Approve universities'),
('university:reject', 'university', 'reject', 'Reject universities'),
('university:suspend', 'university', 'suspend', 'Suspend universities'),

('company:create', 'company', 'create', 'Create companies'),
('company:read', 'company', 'read', 'View company details'),
('company:update', 'company', 'update', 'Update company details'),
('company:delete', 'company', 'delete', 'Delete companies'),
('company:approve', 'company', 'approve', 'Approve companies'),
('company:reject', 'company', 'reject', 'Reject companies'),
('company:suspend', 'company', 'suspend', 'Suspend companies'),

('class:create', 'class', 'create', 'Create classes'),
('class:read', 'class', 'read', 'View class details'),
('class:update', 'class', 'update', 'Update class details'),
('class:delete', 'class', 'delete', 'Delete classes'),

('educator:create', 'educator', 'create', 'Add educators'),
('educator:read', 'educator', 'read', 'View educator details'),
('educator:update', 'educator', 'update', 'Update educator details'),
('educator:delete', 'educator', 'delete', 'Delete educators'),
('educator:assign', 'educator', 'assign', 'Assign educators to classes'),

('student:create', 'student', 'create', 'Create student accounts'),
('student:read', 'student', 'read', 'View student details'),
('student:update', 'student', 'update', 'Update student details'),
('student:delete', 'student', 'delete', 'Delete students'),
('student:enroll', 'student', 'enroll', 'Enroll students'),
('student:promote', 'student', 'promote', 'Promote students to next level'),
('student:transfer', 'student', 'transfer', 'Transfer students between institutions'),

('enrollment:create', 'enrollment', 'create', 'Create enrollments'),
('enrollment:read', 'enrollment', 'read', 'View enrollment details'),
('enrollment:update', 'enrollment', 'update', 'Update enrollment status'),
('enrollment:complete', 'enrollment', 'complete', 'Mark enrollment as completed'),

('recruiter:create', 'recruiter', 'create', 'Add recruiters'),
('recruiter:read', 'recruiter', 'read', 'View recruiter details'),
('recruiter:update', 'recruiter', 'update', 'Update recruiter details'),
('recruiter:delete', 'recruiter', 'delete', 'Delete recruiters'),

('passport:read', 'passport', 'read', 'View skill passports'),
('passport:verify', 'passport', 'verify', 'Verify skill passports'),
('passport:reject', 'passport', 'reject', 'Reject skill passports'),

('user:read_all', 'user', 'read_all', 'View all users'),
('user:update_any', 'user', 'update_any', 'Update any user'),
('user:delete_any', 'user', 'delete_any', 'Delete any user'),
('user:suspend_any', 'user', 'suspend_any', 'Suspend any user'),
('user:activate_any', 'user', 'activate_any', 'Activate any user'),

('audit:read_all', 'audit', 'read_all', 'View audit logs'),
('logs:read_all', 'logs', 'read_all', 'View system logs'),

('permission:manage', 'permission', 'manage', 'Manage permissions'),
('role:manage', 'role', 'manage', 'Manage roles')

ON CONFLICT (name) DO NOTHING;

-- Platform Admin gets all permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'platform_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- School Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'school_admin', id FROM permissions 
WHERE name IN (
    'school:read', 'school:update',
    'class:create', 'class:read', 'class:update', 'class:delete',
    'educator:create', 'educator:read', 'educator:update', 'educator:assign',
    'student:create', 'student:read', 'student:update', 'student:enroll', 'student:promote',
    'enrollment:create', 'enrollment:read', 'enrollment:update', 'enrollment:complete'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- College Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'college_admin', id FROM permissions 
WHERE name IN (
    'college:read', 'college:update',
    'class:create', 'class:read', 'class:update', 'class:delete',
    'educator:create', 'educator:read', 'educator:update', 'educator:assign',
    'student:create', 'student:read', 'student:update', 'student:enroll', 'student:promote',
    'enrollment:create', 'enrollment:read', 'enrollment:update', 'enrollment:complete'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- University Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'university_admin', id FROM permissions 
WHERE name IN (
    'university:read', 'university:update',
    'college:read', 'college:update',
    'class:create', 'class:read', 'class:update', 'class:delete',
    'educator:create', 'educator:read', 'educator:update', 'educator:assign',
    'student:create', 'student:read', 'student:update', 'student:enroll', 'student:promote',
    'enrollment:create', 'enrollment:read', 'enrollment:update', 'enrollment:complete'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Company Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'company_admin', id FROM permissions 
WHERE name IN (
    'company:read', 'company:update',
    'recruiter:create', 'recruiter:read', 'recruiter:update'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Text search indexes using trigram
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin((first_name || ' ' || last_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_students_name_trgm ON students USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_email_trgm ON students USING gin(email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_recruiters_name_trgm ON recruiters USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recruiters_email_trgm ON recruiters USING gin(email gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status_active ON student_enrollments(student_id, enrollment_status) WHERE enrollment_status = 'active';
CREATE INDEX IF NOT EXISTS idx_skill_passports_student_status ON skill_passports(student_id, status);

-- Sorting indexes (DESC for latest first)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_created_desc ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_passports_created_desc ON skill_passports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_desc ON student_enrollments(created_at DESC);

-- ============================================================
-- COMMENTS ON TABLES (Documentation)
-- ============================================================

COMMENT ON TABLE users IS 'Central user table extending Supabase auth.users';
COMMENT ON TABLE schools IS 'School entities in the platform';
COMMENT ON TABLE colleges IS 'Unified colleges table - both standalone and university departments';
COMMENT ON TABLE universities IS 'University entities with multiple colleges';
COMMENT ON TABLE students IS 'Student records with reference to current active enrollment';
COMMENT ON TABLE student_enrollments IS 'Complete enrollment history with progression tracking - ONE ACTIVE ENROLLMENT per student';
COMMENT ON TABLE skill_passports IS 'Student skill passports with NSQF levels and verifications';
COMMENT ON TABLE companies IS 'Company entities for recruitment';
COMMENT ON TABLE recruiters IS 'Recruiter users associated with companies';
COMMENT ON TABLE audit_logs IS 'Audit trail for all sensitive operations';
COMMENT ON TABLE permissions IS 'System permissions for RBAC';
COMMENT ON TABLE role_permissions IS 'Role-to-permission mappings';

COMMENT ON COLUMN colleges.university_id IS 'NULL = standalone college, NOT NULL = university department';
COMMENT ON COLUMN colleges.college_type IS 'standalone or university_department - determines college classification';
COMMENT ON COLUMN students.current_enrollment_id IS 'Reference to active enrollment in student_enrollments table';
COMMENT ON COLUMN student_enrollments.enrollment_status IS 'active, completed, withdrawn, transferred, suspended';
COMMENT ON COLUMN student_enrollments.promoted_to_enrollment_id IS 'Next enrollment after promotion/progression';
COMMENT ON COLUMN student_enrollments.previous_enrollment_id IS 'Previous enrollment before this one';

COMMENT ON CONSTRAINT chk_one_class_per_enrollment ON student_enrollments IS 'Enforces ONE ENROLLMENT = ONE CLASS rule';
COMMENT ON CONSTRAINT valid_role_entity ON users IS 'Ensures platform_admin has no entity, all other roles must have entity_type and entity_id';

-- ============================================================
-- HELPER VIEWS FOR COMMON QUERIES
-- ============================================================

-- View: Current Active Enrollments
CREATE OR REPLACE VIEW v_active_enrollments AS
SELECT 
    e.id as enrollment_id,
    e.student_id,
    s.enrollment_number,
    s.name as student_name,
    s.email as student_email,
    e.enrollment_type,
    e.academic_year,
    e.semester,
    e.year,
    e.cgpa,
    CASE 
        WHEN e.school_id IS NOT NULL THEN sch.name
        WHEN e.college_id IS NOT NULL THEN col.name
        WHEN e.university_id IS NOT NULL THEN uni.name
    END as institution_name,
    CASE 
        WHEN e.school_class_id IS NOT NULL THEN sc.name
        WHEN e.college_course_id IS NOT NULL THEN cc.name
    END as class_course_name
FROM student_enrollments e
JOIN students s ON e.student_id = s.id
LEFT JOIN schools sch ON e.school_id = sch.id
LEFT JOIN colleges col ON e.college_id = col.id
LEFT JOIN universities uni ON e.university_id = uni.id
LEFT JOIN school_classes sc ON e.school_class_id = sc.id
LEFT JOIN college_courses cc ON e.college_course_id = cc.id
WHERE e.enrollment_status = 'active';

COMMENT ON VIEW v_active_enrollments IS 'All currently active student enrollments with institution and class details';

-- View: Student Academic Journey
CREATE OR REPLACE VIEW v_student_journey AS
SELECT 
    e.student_id,
    s.enrollment_number,
    s.name as student_name,
    e.id as enrollment_id,
    e.enrollment_type,
    e.academic_year,
    e.semester,
    e.enrollment_status,
    e.enrollment_date,
    e.actual_completion_date,
    e.cgpa,
    e.previous_enrollment_id,
    e.promoted_to_enrollment_id,
    CASE 
        WHEN e.school_id IS NOT NULL THEN sch.name
        WHEN e.college_id IS NOT NULL THEN col.name
        WHEN e.university_id IS NOT NULL THEN uni.name
    END as institution_name
FROM student_enrollments e
JOIN students s ON e.student_id = s.id
LEFT JOIN schools sch ON e.school_id = sch.id
LEFT JOIN colleges col ON e.college_id = col.id
LEFT JOIN universities uni ON e.university_id = uni.id
ORDER BY e.student_id, e.enrollment_date;

COMMENT ON VIEW v_student_journey IS 'Complete academic journey of all students with progression chain';

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$ 
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'RAREMINDS DATABASE SCHEMA V2.0 SETUP COMPLETED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'MAJOR ENHANCEMENTS:';
    RAISE NOTICE '  ✅ Unified Colleges Table (standalone + university departments)';
    RAISE NOTICE '  ✅ Student Enrollment History System';
    RAISE NOTICE '  ✅ Student Progression Support (grade advancement, transitions)';
    RAISE NOTICE '  ✅ College Reassignment Capability';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created/updated: ';
    RAISE NOTICE '  - Core: users, permissions, role_permissions, audit_logs';
    RAISE NOTICE '  - Schools: schools, school_classes, school_educators, assignments';
    RAISE NOTICE '  - Colleges: colleges (UNIFIED), college_courses, college_lecturers, assignments';
    RAISE NOTICE '  - Universities: universities';
    RAISE NOTICE '  - Students: students, student_enrollments (NEW)';
    RAISE NOTICE '  - Skills: skill_passports, verifications';
    RAISE NOTICE '  - Companies: companies, company_branches, recruiters';
    RAISE NOTICE '  - Metrics: metrics_snapshots';
    RAISE NOTICE '';
    RAISE NOTICE 'NEW CAPABILITIES:';
    RAISE NOTICE '  ✅ Students can advance grades/semesters';
    RAISE NOTICE '  ✅ Students can transition between institutions';
    RAISE NOTICE '  ✅ Complete enrollment history preserved';
    RAISE NOTICE '  ✅ Colleges can be reassigned to/from universities';
    RAISE NOTICE '  ✅ Only ONE active enrollment per student (enforced)';
    RAISE NOTICE '';
    RAISE NOTICE 'Views created:';
    RAISE NOTICE '  - v_active_enrollments: Current active enrollments';
    RAISE NOTICE '  - v_student_journey: Complete academic journey';
    RAISE NOTICE '';
    RAISE NOTICE 'Enums: user_role, entity_type, account_status, approval_status, enrollment_status, verification_status, college_type';
    RAISE NOTICE 'Indexes: 60+ performance indexes including trigram for fuzzy search';
    RAISE NOTICE 'Triggers: Auto-update updated_at timestamps';
    RAISE NOTICE 'Permissions: 70+ permissions seeded with role mappings';
    RAISE NOTICE '';
    RAISE NOTICE 'MIGRATION NOTES:';
    RAISE NOTICE '  - Old colleges_standalone data migrated to unified colleges table';
    RAISE NOTICE '  - Old university_colleges data migrated to unified colleges table';
    RAISE NOTICE '  - Current student enrollments migrated to student_enrollments table';
    RAISE NOTICE '  - Old tables preserved for safety - can be dropped after verification';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '  1. Verify data migration completeness';
    RAISE NOTICE '  2. Test college reassignment: UPDATE colleges SET university_id = ...';
    RAISE NOTICE '  3. Test student progression workflows';
    RAISE NOTICE '  4. After verification, optionally drop old tables';
    RAISE NOTICE '============================================================';
END $$;
