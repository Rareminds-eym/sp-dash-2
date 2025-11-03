-- ============================================================
-- RAREMINDS DATABASE MIGRATION - STEP 1
-- Safe Migration Script for rareminds_complete_schema.sql
-- This script applies all schema changes without losing data
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================
-- ENUMS - Create if they don't exist
-- ============================================================

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
        'college_standalone',
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
    CREATE TYPE student_type AS ENUM (
        'direct',
        'school',
        'college_standalone',
        'university'
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

-- ============================================================
-- USERS TABLE - Add missing columns
-- ============================================================

-- Alter existing users table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supabaseAuthId') THEN
        ALTER TABLE users ADD COLUMN supabaseAuthId UUID UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firstName') THEN
        ALTER TABLE users ADD COLUMN firstName VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastName') THEN
        ALTER TABLE users ADD COLUMN lastName VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entityType') THEN
        ALTER TABLE users ADD COLUMN entityType entity_type;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entityId') THEN
        ALTER TABLE users ADD COLUMN entityId UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='accountStatus') THEN
        ALTER TABLE users ADD COLUMN accountStatus account_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastPasswordChange') THEN
        ALTER TABLE users ADD COLUMN lastPasswordChange TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profileImageUrl') THEN
        ALTER TABLE users ADD COLUMN profileImageUrl TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='createdBy') THEN
        ALTER TABLE users ADD COLUMN createdBy UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastLogin') THEN
        ALTER TABLE users ADD COLUMN lastLogin TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add foreign key for created_by
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_created_by;
ALTER TABLE users ADD CONSTRAINT fk_users_created_by 
    FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity ON users(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabaseAuthId);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(accountStatus);

-- ============================================================
-- SCHOOLS TABLE
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
    approvedBy UUID REFERENCES users(id),
    approvedAt TIMESTAMP WITH TIME ZONE,
    total_classes INTEGER DEFAULT 0,
    total_educators INTEGER DEFAULT 0,
    totalStudents INTEGER DEFAULT 0,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter schools table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='board') THEN
        ALTER TABLE schools ADD COLUMN board VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='approvalStatus') THEN
        ALTER TABLE schools ADD COLUMN approvalStatus approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='approvedBy') THEN
        ALTER TABLE schools ADD COLUMN approvedBy UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='approvedAt') THEN
        ALTER TABLE schools ADD COLUMN approvedAt TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='total_classes') THEN
        ALTER TABLE schools ADD COLUMN total_classes INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='total_educators') THEN
        ALTER TABLE schools ADD COLUMN total_educators INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='totalStudents') THEN
        ALTER TABLE schools ADD COLUMN totalStudents INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(accountStatus, approvalStatus);
CREATE INDEX IF NOT EXISTS idx_schools_state ON schools(state);

CREATE TABLE IF NOT EXISTS school_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schoolId UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    section VARCHAR(10),
    academicYear VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 40,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(schoolId, name, academicYear)
);

CREATE INDEX IF NOT EXISTS idx_school_classes_school ON school_classes(schoolId);
CREATE INDEX IF NOT EXISTS idx_school_classes_academic_year ON school_classes(academicYear);

CREATE TABLE IF NOT EXISTS school_educators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schoolId UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employeeId VARCHAR(50),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experienceYears INTEGER,
    dateOfJoining DATE,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(schoolId, employeeId)
);

CREATE INDEX IF NOT EXISTS idx_school_educators_school ON school_educators(schoolId);
CREATE INDEX IF NOT EXISTS idx_school_educators_user ON school_educators(userId);

CREATE TABLE IF NOT EXISTS school_educator_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    educator_id UUID NOT NULL REFERENCES school_educators(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academicYear VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assignedBy UUID REFERENCES users(id),
    UNIQUE(educator_id, class_id, subject, academicYear)
);

CREATE INDEX IF NOT EXISTS idx_educator_assignments_educator ON school_educator_class_assignments(educator_id);
CREATE INDEX IF NOT EXISTS idx_educator_assignments_class ON school_educator_class_assignments(class_id);

-- ============================================================
-- COLLEGES STANDALONE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS colleges_standalone (
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
    affiliation VARCHAR(255),
    accreditation VARCHAR(100),
    account_status account_status DEFAULT 'pending',
    approval_status approval_status DEFAULT 'pending',
    approvedBy UUID REFERENCES users(id),
    approvedAt TIMESTAMP WITH TIME ZONE,
    totalCourses INTEGER DEFAULT 0,
    totalLecturers INTEGER DEFAULT 0,
    totalStudents INTEGER DEFAULT 0,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter colleges_standalone table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colleges_standalone' AND column_name='approvalStatus') THEN
        ALTER TABLE colleges_standalone ADD COLUMN approvalStatus approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colleges_standalone' AND column_name='approvedBy') THEN
        ALTER TABLE colleges_standalone ADD COLUMN approvedBy UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colleges_standalone' AND column_name='approvedAt') THEN
        ALTER TABLE colleges_standalone ADD COLUMN approvedAt TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colleges_standalone' AND column_name='totalCourses') THEN
        ALTER TABLE colleges_standalone ADD COLUMN totalCourses INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colleges_standalone' AND column_name='totalLecturers') THEN
        ALTER TABLE colleges_standalone ADD COLUMN totalLecturers INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='colleges_standalone' AND column_name='totalStudents') THEN
        ALTER TABLE colleges_standalone ADD COLUMN totalStudents INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_colleges_code ON colleges_standalone(code);
CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges_standalone(accountStatus, approvalStatus);
CREATE INDEX IF NOT EXISTS idx_colleges_state ON colleges_standalone(state);

CREATE TABLE IF NOT EXISTS college_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collegeId UUID NOT NULL REFERENCES colleges_standalone(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    program VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    year INTEGER,
    semester INTEGER,
    section VARCHAR(10),
    academicYear VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 60,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(collegeId, name, academicYear)
);

CREATE INDEX IF NOT EXISTS idx_college_courses_college ON college_courses(collegeId);
CREATE INDEX IF NOT EXISTS idx_college_courses_academic_year ON college_courses(academicYear);

CREATE TABLE IF NOT EXISTS college_lecturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collegeId UUID NOT NULL REFERENCES colleges_standalone(id) ON DELETE CASCADE,
    employeeId VARCHAR(50),
    department VARCHAR(100),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experienceYears INTEGER,
    dateOfJoining DATE,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(collegeId, employeeId)
);

CREATE INDEX IF NOT EXISTS idx_college_lecturers_college ON college_lecturers(collegeId);
CREATE INDEX IF NOT EXISTS idx_college_lecturers_user ON college_lecturers(userId);

CREATE TABLE IF NOT EXISTS college_lecturer_course_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES college_lecturers(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES college_courses(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academicYear VARCHAR(20) NOT NULL,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assignedBy UUID REFERENCES users(id),
    UNIQUE(lecturer_id, course_id, subject, academicYear)
);

CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_lecturer ON college_lecturer_course_assignments(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_assignments_course ON college_lecturer_course_assignments(course_id);

-- ============================================================
-- UNIVERSITIES TABLE
-- ============================================================

-- Alter universities table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='universityType') THEN
        ALTER TABLE universities ADD COLUMN universityType VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvalStatus') THEN
        ALTER TABLE universities ADD COLUMN approvalStatus approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvedBy') THEN
        ALTER TABLE universities ADD COLUMN approvedBy UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvedAt') THEN
        ALTER TABLE universities ADD COLUMN approvedAt TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='accountStatus') THEN
        ALTER TABLE universities ADD COLUMN accountStatus account_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalColleges') THEN
        ALTER TABLE universities ADD COLUMN totalColleges INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalCourses') THEN
        ALTER TABLE universities ADD COLUMN totalCourses INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalLecturers') THEN
        ALTER TABLE universities ADD COLUMN totalLecturers INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalStudents') THEN
        ALTER TABLE universities ADD COLUMN totalStudents INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_universities_code ON universities(code);
CREATE INDEX IF NOT EXISTS idx_universities_status ON universities(accountStatus, approvalStatus);
CREATE INDEX IF NOT EXISTS idx_universities_state ON universities(state);

CREATE TABLE IF NOT EXISTS university_colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    dean_name VARCHAR(200),
    dean_email VARCHAR(255),
    dean_phone VARCHAR(20),
    established_year INTEGER,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(university_id, code)
);

CREATE INDEX IF NOT EXISTS idx_university_colleges_university ON university_colleges(university_id);

CREATE TABLE IF NOT EXISTS university_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collegeId UUID NOT NULL REFERENCES university_colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    program VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    year INTEGER,
    semester INTEGER,
    section VARCHAR(10),
    academicYear VARCHAR(20) NOT NULL,
    max_students INTEGER DEFAULT 60,
    current_students INTEGER DEFAULT 0,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(collegeId, name, academicYear)
);

CREATE INDEX IF NOT EXISTS idx_university_courses_college ON university_courses(collegeId);
CREATE INDEX IF NOT EXISTS idx_university_courses_academic_year ON university_courses(academicYear);

CREATE TABLE IF NOT EXISTS university_lecturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collegeId UUID NOT NULL REFERENCES university_colleges(id) ON DELETE CASCADE,
    employeeId VARCHAR(50),
    department VARCHAR(100),
    specialization VARCHAR(100),
    qualification VARCHAR(255),
    experienceYears INTEGER,
    dateOfJoining DATE,
    account_status account_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(collegeId, employeeId)
);

CREATE INDEX IF NOT EXISTS idx_university_lecturers_college ON university_lecturers(collegeId);
CREATE INDEX IF NOT EXISTS idx_university_lecturers_user ON university_lecturers(userId);

CREATE TABLE IF NOT EXISTS university_lecturer_course_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES university_lecturers(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES university_courses(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    academicYear VARCHAR(20) NOT NULL,
    assignedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assignedBy UUID REFERENCES users(id),
    UNIQUE(lecturer_id, course_id, subject, academicYear)
);

CREATE INDEX IF NOT EXISTS idx_university_lecturer_assignments_lecturer ON university_lecturer_course_assignments(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_university_lecturer_assignments_course ON university_lecturer_course_assignments(course_id);

-- ============================================================
-- STUDENTS TABLE - Add missing columns
-- ============================================================

-- Alter students table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='studentType') THEN
        ALTER TABLE students ADD COLUMN studentType student_type;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='schoolId') THEN
        ALTER TABLE students ADD COLUMN schoolId UUID REFERENCES schools(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='collegeId') THEN
        ALTER TABLE students ADD COLUMN collegeId UUID REFERENCES colleges_standalone(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='universityCollegeId') THEN
        ALTER TABLE students ADD COLUMN universityCollegeId UUID REFERENCES university_colleges(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='schoolClassId') THEN
        ALTER TABLE students ADD COLUMN schoolClassId UUID REFERENCES school_classes(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='collegeCourseId') THEN
        ALTER TABLE students ADD COLUMN collegeCourseId UUID REFERENCES college_courses(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='universityCourseId') THEN
        ALTER TABLE students ADD COLUMN universityCourseId UUID REFERENCES university_courses(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollmentNumber') THEN
        ALTER TABLE students ADD COLUMN enrollmentNumber VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianName') THEN
        ALTER TABLE students ADD COLUMN guardianName VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianPhone') THEN
        ALTER TABLE students ADD COLUMN guardianPhone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianEmail') THEN
        ALTER TABLE students ADD COLUMN guardianEmail VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianRelation') THEN
        ALTER TABLE students ADD COLUMN guardianRelation VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='dateOfBirth') THEN
        ALTER TABLE students ADD COLUMN dateOfBirth DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='gender') THEN
        ALTER TABLE students ADD COLUMN gender VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='bloodGroup') THEN
        ALTER TABLE students ADD COLUMN bloodGroup VARCHAR(5);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollmentDate') THEN
        ALTER TABLE students ADD COLUMN enrollmentDate DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='expectedGraduationDate') THEN
        ALTER TABLE students ADD COLUMN expectedGraduationDate DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='currentCgpa') THEN
        ALTER TABLE students ADD COLUMN currentCgpa DECIMAL(4,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='userId') THEN
        ALTER TABLE students ADD COLUMN userId UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_user ON students(userId);
CREATE INDEX IF NOT EXISTS idx_students_type ON students(studentType);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(schoolId);
CREATE INDEX IF NOT EXISTS idx_students_college ON students(collegeId);
CREATE INDEX IF NOT EXISTS idx_students_university ON students(university_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(schoolClassId);
CREATE INDEX IF NOT EXISTS idx_students_college_course ON students(collegeCourseId);
CREATE INDEX IF NOT EXISTS idx_students_university_course ON students(universityCourseId);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollmentNumber);

-- ============================================================
-- SKILL PASSPORTS TABLE - Add missing columns
-- ============================================================

-- Alter skill_passports table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='nsqfLevel') THEN
        ALTER TABLE skill_passports ADD COLUMN nsqfLevel INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='certifications') THEN
        ALTER TABLE skill_passports ADD COLUMN certifications JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='workExperience') THEN
        ALTER TABLE skill_passports ADD COLUMN workExperience JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='projects') THEN
        ALTER TABLE skill_passports ADD COLUMN projects JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='achievements') THEN
        ALTER TABLE skill_passports ADD COLUMN achievements JSONB DEFAULT '[]';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verifiedBy') THEN
        ALTER TABLE skill_passports ADD COLUMN verifiedBy UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verifiedAt') THEN
        ALTER TABLE skill_passports ADD COLUMN verifiedAt TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='aiVerified') THEN
        ALTER TABLE skill_passports ADD COLUMN aiVerified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='aiVerificationScore') THEN
        ALTER TABLE skill_passports ADD COLUMN aiVerificationScore DECIMAL(5,2);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skill_passports_student ON skill_passports(student_id);
CREATE INDEX IF NOT EXISTS idx_skill_passports_status ON skill_passports(status);
CREATE INDEX IF NOT EXISTS idx_skill_passports_nsqf ON skill_passports(nsqfLevel);
CREATE INDEX IF NOT EXISTS idx_skill_passports_ai_verified ON skill_passports(aiVerified);

-- ============================================================
-- COMPANIES TABLE
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
    approvedBy UUID REFERENCES users(id),
    approvedAt TIMESTAMP WITH TIME ZONE,
    totalBranches INTEGER DEFAULT 0,
    total_recruiters INTEGER DEFAULT 0,
    hq_recruiters INTEGER DEFAULT 0,
    branch_recruiters INTEGER DEFAULT 0,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Alter companies table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='approvalStatus') THEN
        ALTER TABLE companies ADD COLUMN approvalStatus approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='approvedBy') THEN
        ALTER TABLE companies ADD COLUMN approvedBy UUID REFERENCES users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='approvedAt') THEN
        ALTER TABLE companies ADD COLUMN approvedAt TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='totalBranches') THEN
        ALTER TABLE companies ADD COLUMN totalBranches INTEGER DEFAULT 0;
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
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(accountStatus, approvalStatus);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_state ON companies(hq_state);

CREATE TABLE IF NOT EXISTS company_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    companyId UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    branchType VARCHAR(50),
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
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(companyId, code)
);

CREATE INDEX IF NOT EXISTS idx_company_branches_company ON company_branches(companyId);

-- ============================================================
-- RECRUITERS TABLE - Add missing columns
-- ============================================================

-- Alter recruiters table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='verificationStatus') THEN
        ALTER TABLE recruiters ADD COLUMN verificationStatus approval_status DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='isActive') THEN
        ALTER TABLE recruiters ADD COLUMN isActive BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='userCount') THEN
        ALTER TABLE recruiters ADD COLUMN userCount INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='userId') THEN
        ALTER TABLE recruiters ADD COLUMN userId UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='companyId') THEN
        ALTER TABLE recruiters ADD COLUMN companyId UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='branchId') THEN
        ALTER TABLE recruiters ADD COLUMN branchId UUID REFERENCES company_branches(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='employeeId') THEN
        ALTER TABLE recruiters ADD COLUMN employeeId VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='designation') THEN
        ALTER TABLE recruiters ADD COLUMN designation VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='department') THEN
        ALTER TABLE recruiters ADD COLUMN department VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='dateOfJoining') THEN
        ALTER TABLE recruiters ADD COLUMN dateOfJoining DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='isHqRecruiter') THEN
        ALTER TABLE recruiters ADD COLUMN isHqRecruiter BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='accountStatus') THEN
        ALTER TABLE recruiters ADD COLUMN accountStatus account_status DEFAULT 'active';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recruiters_company ON recruiters(companyId);
CREATE INDEX IF NOT EXISTS idx_recruiters_branch ON recruiters(branchId);
CREATE INDEX IF NOT EXISTS idx_recruiters_user ON recruiters(userId);
CREATE INDEX IF NOT EXISTS idx_recruiters_email ON recruiters(email);
CREATE INDEX IF NOT EXISTS idx_recruiters_status ON recruiters(verificationStatus, isActive);
CREATE INDEX IF NOT EXISTS idx_recruiters_state ON recruiters(state);

-- ============================================================
-- VERIFICATIONS TABLE - Add missing columns
-- ============================================================

-- Alter verifications table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationType') THEN
        ALTER TABLE verifications ADD COLUMN verificationType VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationNotes') THEN
        ALTER TABLE verifications ADD COLUMN verificationNotes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationData') THEN
        ALTER TABLE verifications ADD COLUMN verificationData JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verifiedBy') THEN
        ALTER TABLE verifications ADD COLUMN verifiedBy UUID REFERENCES users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verifiedAt') THEN
        ALTER TABLE verifications ADD COLUMN verifiedAt TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_verifications_passport ON verifications(passport_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(userId);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(verificationStatus);

-- ============================================================
-- METRICS SNAPSHOTS TABLE - Add missing columns
-- ============================================================

-- Alter metrics_snapshots table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalSchools') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN totalSchools INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalColleges') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN totalColleges INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalCompanies') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN totalCompanies INTEGER DEFAULT 0;
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
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================
-- AUDIT LOGS TABLE - Add missing columns
-- ============================================================

-- Alter audit_logs table to add missing columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ipAddress') THEN
        ALTER TABLE audit_logs ADD COLUMN ipAddress INET;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='userAgent') THEN
        ALTER TABLE audit_logs ADD COLUMN userAgent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='oldValues') THEN
        ALTER TABLE audit_logs ADD COLUMN oldValues JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='newValues') THEN
        ALTER TABLE audit_logs ADD COLUMN newValues JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resourceType') THEN
        ALTER TABLE audit_logs ADD COLUMN resourceType VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resourceId') THEN
        ALTER TABLE audit_logs ADD COLUMN resourceId UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resourceType, resourceId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(createdAt);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = NOW();
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

DROP TRIGGER IF EXISTS update_colleges_updated_at ON colleges_standalone;
CREATE TRIGGER update_colleges_updated_at BEFORE UPDATE ON colleges_standalone 
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

DROP TRIGGER IF EXISTS update_university_colleges_updated_at ON university_colleges;
CREATE TRIGGER update_university_colleges_updated_at BEFORE UPDATE ON university_colleges 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_university_courses_updated_at ON university_courses;
CREATE TRIGGER update_university_courses_updated_at BEFORE UPDATE ON university_courses 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_university_lecturers_updated_at ON university_lecturers;
CREATE TRIGGER update_university_lecturers_updated_at BEFORE UPDATE ON university_lecturers 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students 
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
-- PERFORMANCE INDEXES
-- ============================================================

-- Text search indexes using trigram
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin((first_name || ' ' || lastName) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_students_name_trgm ON students USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_email_trgm ON students USING gin(email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_recruiters_name_trgm ON recruiters USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recruiters_email_trgm ON recruiters USING gin(email gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_university_status ON students(university_id, accountStatus) WHERE university_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skill_passports_student_status ON skill_passports(student_id, status);

-- Sorting indexes (DESC for latest first)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_created_desc ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_passports_created_desc ON skill_passports(created_at DESC);

-- ============================================================
-- SEED PERMISSIONS
-- ============================================================

-- Insert permissions if they don't exist
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
    'student:create', 'student:read', 'student:update', 'student:enroll'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- College Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'college_admin', id FROM permissions 
WHERE name IN (
    'college:read', 'college:update',
    'class:create', 'class:read', 'class:update', 'class:delete',
    'educator:create', 'educator:read', 'educator:update', 'educator:assign',
    'student:create', 'student:read', 'student:update', 'student:enroll'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- University Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'university_admin', id FROM permissions 
WHERE name IN (
    'university:read', 'university:update',
    'class:create', 'class:read', 'class:update', 'class:delete',
    'educator:create', 'educator:read', 'educator:update', 'educator:assign',
    'student:create', 'student:read', 'student:update', 'student:enroll'
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
-- COMPLETION MESSAGE
-- ============================================================

DO $$ 
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'STEP 1: RAREMINDS COMPLETE SCHEMA MIGRATION COMPLETED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'All schema updates applied successfully!';
    RAISE NOTICE 'New tables created: schools, companies, RBAC tables';
    RAISE NOTICE 'Existing tables enhanced with new columns';
    RAISE NOTICE 'All indexes, triggers, and functions created';
    RAISE NOTICE 'Permissions seeded for RBAC system';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Apply Step 2 - Enhanced Schema V2';
    RAISE NOTICE '============================================================';
END $$;
