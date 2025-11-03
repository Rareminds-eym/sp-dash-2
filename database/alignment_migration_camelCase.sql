-- ============================================================
-- DATABASE ALIGNMENT MIGRATION SCRIPT
-- Generated: 2025-11-03T09:21:13.712Z
-- 
-- This script aligns the Supabase database with migration scripts
-- ============================================================


-- Table: users
-- Missing columns: 9

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supabaseAuthId') THEN
        ALTER TABLE users ADD COLUMN supabaseAuthId UUID UNIQUE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firstName') THEN
        ALTER TABLE users ADD COLUMN firstName VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastName') THEN
        ALTER TABLE users ADD COLUMN lastName VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entityType') THEN
        ALTER TABLE users ADD COLUMN entityType entity_type;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entityId') THEN
        ALTER TABLE users ADD COLUMN entityId UUID;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='accountStatus') THEN
        ALTER TABLE users ADD COLUMN accountStatus account_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastPasswordChange') THEN
        ALTER TABLE users ADD COLUMN lastPasswordChange TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profileImageUrl') THEN
        ALTER TABLE users ADD COLUMN profileImageUrl TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastLogin') THEN
        ALTER TABLE users ADD COLUMN lastLogin TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- Table: universities
-- Missing columns: 9

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='universityType') THEN
        ALTER TABLE universities ADD COLUMN universityType VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvalStatus') THEN
        ALTER TABLE universities ADD COLUMN approvalStatus approval_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvedBy') THEN
        ALTER TABLE universities ADD COLUMN approvedBy UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvedAt') THEN
        ALTER TABLE universities ADD COLUMN approvedAt TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='accountStatus') THEN
        ALTER TABLE universities ADD COLUMN accountStatus account_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalColleges') THEN
        ALTER TABLE universities ADD COLUMN totalColleges INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalCourses') THEN
        ALTER TABLE universities ADD COLUMN totalCourses INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalLecturers') THEN
        ALTER TABLE universities ADD COLUMN totalLecturers INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalStudents') THEN
        ALTER TABLE universities ADD COLUMN totalStudents INTEGER DEFAULT 0;
    END IF;
END $$;


-- Table: students
-- Missing columns: 17

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='studentType') THEN
        ALTER TABLE students ADD COLUMN studentType student_type;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='schoolId') THEN
        ALTER TABLE students ADD COLUMN schoolId UUID REFERENCES schools(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='collegeId') THEN
        ALTER TABLE students ADD COLUMN collegeId UUID REFERENCES colleges_standalone(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='universityCollegeId') THEN
        ALTER TABLE students ADD COLUMN universityCollegeId UUID REFERENCES university_colleges(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='schoolClassId') THEN
        ALTER TABLE students ADD COLUMN schoolClassId UUID REFERENCES school_classes(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='collegeCourseId') THEN
        ALTER TABLE students ADD COLUMN collegeCourseId UUID REFERENCES college_courses(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='universityCourseId') THEN
        ALTER TABLE students ADD COLUMN universityCourseId UUID REFERENCES university_courses(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollmentNumber') THEN
        ALTER TABLE students ADD COLUMN enrollmentNumber VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianName') THEN
        ALTER TABLE students ADD COLUMN guardianName VARCHAR(200);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianPhone') THEN
        ALTER TABLE students ADD COLUMN guardianPhone VARCHAR(20);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianEmail') THEN
        ALTER TABLE students ADD COLUMN guardianEmail VARCHAR(255);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianRelation') THEN
        ALTER TABLE students ADD COLUMN guardianRelation VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='gender') THEN
        ALTER TABLE students ADD COLUMN gender VARCHAR(20);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='bloodGroup') THEN
        ALTER TABLE students ADD COLUMN bloodGroup VARCHAR(5);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollmentDate') THEN
        ALTER TABLE students ADD COLUMN enrollmentDate DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='expectedGraduationDate') THEN
        ALTER TABLE students ADD COLUMN expectedGraduationDate DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='currentCgpa') THEN
        ALTER TABLE students ADD COLUMN currentCgpa DECIMAL(4;
    END IF;
END $$;


-- Table: skill_passports
-- Missing columns: 8

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='nsqfLevel') THEN
        ALTER TABLE skill_passports ADD COLUMN nsqfLevel INTEGER;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='certifications') THEN
        ALTER TABLE skill_passports ADD COLUMN certifications JSONB DEFAULT '[]';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='workExperience') THEN
        ALTER TABLE skill_passports ADD COLUMN workExperience JSONB DEFAULT '[]';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='achievements') THEN
        ALTER TABLE skill_passports ADD COLUMN achievements JSONB DEFAULT '[]';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verifiedBy') THEN
        ALTER TABLE skill_passports ADD COLUMN verifiedBy UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verifiedAt') THEN
        ALTER TABLE skill_passports ADD COLUMN verifiedAt TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='aiVerified') THEN
        ALTER TABLE skill_passports ADD COLUMN aiVerified BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='aiVerificationScore') THEN
        ALTER TABLE skill_passports ADD COLUMN aiVerificationScore DECIMAL(5;
    END IF;
END $$;


-- Table: recruiters
-- Missing columns: 11

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='verificationStatus') THEN
        ALTER TABLE recruiters ADD COLUMN verificationStatus approval_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='isActive') THEN
        ALTER TABLE recruiters ADD COLUMN isActive BOOLEAN DEFAULT true;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='userCount') THEN
        ALTER TABLE recruiters ADD COLUMN userCount INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='companyId') THEN
        ALTER TABLE recruiters ADD COLUMN companyId UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='branchId') THEN
        ALTER TABLE recruiters ADD COLUMN branchId UUID REFERENCES company_branches(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='employeeId') THEN
        ALTER TABLE recruiters ADD COLUMN employeeId VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='designation') THEN
        ALTER TABLE recruiters ADD COLUMN designation VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='department') THEN
        ALTER TABLE recruiters ADD COLUMN department VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='dateOfJoining') THEN
        ALTER TABLE recruiters ADD COLUMN dateOfJoining DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='isHqRecruiter') THEN
        ALTER TABLE recruiters ADD COLUMN isHqRecruiter BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='accountStatus') THEN
        ALTER TABLE recruiters ADD COLUMN accountStatus account_status DEFAULT 'active';
    END IF;
END $$;


-- Table: verifications
-- Missing columns: 5

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationType') THEN
        ALTER TABLE verifications ADD COLUMN verificationType VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationNotes') THEN
        ALTER TABLE verifications ADD COLUMN verificationNotes TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationData') THEN
        ALTER TABLE verifications ADD COLUMN verificationData JSONB DEFAULT '{}';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verifiedBy') THEN
        ALTER TABLE verifications ADD COLUMN verifiedBy UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verifiedAt') THEN
        ALTER TABLE verifications ADD COLUMN verifiedAt TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- Table: metrics_snapshots
-- Missing columns: 3

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalSchools') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN totalSchools INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalColleges') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN totalColleges INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalCompanies') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN totalCompanies INTEGER DEFAULT 0;
    END IF;
END $$;


-- Table: audit_logs
-- Missing columns: 6

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ipAddress') THEN
        ALTER TABLE audit_logs ADD COLUMN ipAddress INET;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='userAgent') THEN
        ALTER TABLE audit_logs ADD COLUMN userAgent TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='oldValues') THEN
        ALTER TABLE audit_logs ADD COLUMN oldValues JSONB;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='newValues') THEN
        ALTER TABLE audit_logs ADD COLUMN newValues JSONB;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resourceType') THEN
        ALTER TABLE audit_logs ADD COLUMN resourceType VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resourceId') THEN
        ALTER TABLE audit_logs ADD COLUMN resourceId UUID;
    END IF;
END $$;


-- ============================================================
-- END OF ALIGNMENT MIGRATION
-- ============================================================
