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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supabaseauthid') THEN
        ALTER TABLE users ADD COLUMN "supabaseAuthId" UUID UNIQUE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='firstname') THEN
        ALTER TABLE users ADD COLUMN "firstName" VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastname') THEN
        ALTER TABLE users ADD COLUMN "lastName" VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entitytype') THEN
        ALTER TABLE users ADD COLUMN "entityType" entity_type;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entityid') THEN
        ALTER TABLE users ADD COLUMN "entityId" UUID;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='accountstatus') THEN
        ALTER TABLE users ADD COLUMN "accountStatus" account_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastpasswordchange') THEN
        ALTER TABLE users ADD COLUMN "lastPasswordChange" TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profileimageurl') THEN
        ALTER TABLE users ADD COLUMN "profileImageUrl" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lastlogin') THEN
        ALTER TABLE users ADD COLUMN "lastLogin" TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- Table: universities
-- Missing columns: 9

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='universitytype') THEN
        ALTER TABLE universities ADD COLUMN "universityType" VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvalstatus') THEN
        ALTER TABLE universities ADD COLUMN "approvalStatus" approval_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvedby') THEN
        ALTER TABLE universities ADD COLUMN "approvedBy" UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approvedat') THEN
        ALTER TABLE universities ADD COLUMN "approvedAt" TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='accountstatus') THEN
        ALTER TABLE universities ADD COLUMN "accountStatus" account_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalcolleges') THEN
        ALTER TABLE universities ADD COLUMN "totalColleges" INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalcourses') THEN
        ALTER TABLE universities ADD COLUMN "totalCourses" INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totallecturers') THEN
        ALTER TABLE universities ADD COLUMN "totalLecturers" INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='totalstudents') THEN
        ALTER TABLE universities ADD COLUMN "totalStudents" INTEGER DEFAULT 0;
    END IF;
END $$;


-- Table: students
-- Missing columns: 17

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='studenttype') THEN
        ALTER TABLE students ADD COLUMN "studentType" student_type;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='schoolid') THEN
        ALTER TABLE students ADD COLUMN "schoolId" UUID REFERENCES schools(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='collegeid') THEN
        ALTER TABLE students ADD COLUMN "collegeId" UUID REFERENCES colleges_standalone(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='universitycollegeid') THEN
        ALTER TABLE students ADD COLUMN "universityCollegeId" UUID REFERENCES university_colleges(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='schoolclassid') THEN
        ALTER TABLE students ADD COLUMN "schoolClassId" UUID REFERENCES school_classes(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='collegecourseid') THEN
        ALTER TABLE students ADD COLUMN "collegeCourseId" UUID REFERENCES college_courses(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='universitycourseid') THEN
        ALTER TABLE students ADD COLUMN "universityCourseId" UUID REFERENCES university_courses(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollmentnumber') THEN
        ALTER TABLE students ADD COLUMN "enrollmentNumber" VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianname') THEN
        ALTER TABLE students ADD COLUMN "guardianName" VARCHAR(200);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianphone') THEN
        ALTER TABLE students ADD COLUMN "guardianPhone" VARCHAR(20);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianemail') THEN
        ALTER TABLE students ADD COLUMN "guardianEmail" VARCHAR(255);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardianrelation') THEN
        ALTER TABLE students ADD COLUMN "guardianRelation" VARCHAR(50);
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='bloodgroup') THEN
        ALTER TABLE students ADD COLUMN "bloodGroup" VARCHAR(5);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollmentdate') THEN
        ALTER TABLE students ADD COLUMN "enrollmentDate" DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='expectedgraduationdate') THEN
        ALTER TABLE students ADD COLUMN "expectedGraduationDate" DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='currentcgpa') THEN
        ALTER TABLE students ADD COLUMN "currentCgpa" DECIMAL(4;
    END IF;
END $$;


-- Table: skill_passports
-- Missing columns: 8

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='nsqflevel') THEN
        ALTER TABLE skill_passports ADD COLUMN "nsqfLevel" INTEGER;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='workexperience') THEN
        ALTER TABLE skill_passports ADD COLUMN "workExperience" JSONB DEFAULT '[]';
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verifiedby') THEN
        ALTER TABLE skill_passports ADD COLUMN "verifiedBy" UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verifiedat') THEN
        ALTER TABLE skill_passports ADD COLUMN "verifiedAt" TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='aiverified') THEN
        ALTER TABLE skill_passports ADD COLUMN "aiVerified" BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='aiverificationscore') THEN
        ALTER TABLE skill_passports ADD COLUMN "aiVerificationScore" DECIMAL(5;
    END IF;
END $$;


-- Table: recruiters
-- Missing columns: 11

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='verificationstatus') THEN
        ALTER TABLE recruiters ADD COLUMN "verificationStatus" approval_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='isactive') THEN
        ALTER TABLE recruiters ADD COLUMN "isActive" BOOLEAN DEFAULT true;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='usercount') THEN
        ALTER TABLE recruiters ADD COLUMN "userCount" INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='companyid') THEN
        ALTER TABLE recruiters ADD COLUMN "companyId" UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='branchid') THEN
        ALTER TABLE recruiters ADD COLUMN "branchId" UUID REFERENCES company_branches(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='employeeid') THEN
        ALTER TABLE recruiters ADD COLUMN "employeeId" VARCHAR(50);
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='dateofjoining') THEN
        ALTER TABLE recruiters ADD COLUMN "dateOfJoining" DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='ishqrecruiter') THEN
        ALTER TABLE recruiters ADD COLUMN "isHqRecruiter" BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='accountstatus') THEN
        ALTER TABLE recruiters ADD COLUMN "accountStatus" account_status DEFAULT 'active';
    END IF;
END $$;


-- Table: verifications
-- Missing columns: 5

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationtype') THEN
        ALTER TABLE verifications ADD COLUMN "verificationType" VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationnotes') THEN
        ALTER TABLE verifications ADD COLUMN "verificationNotes" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verificationdata') THEN
        ALTER TABLE verifications ADD COLUMN "verificationData" JSONB DEFAULT '{}';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verifiedby') THEN
        ALTER TABLE verifications ADD COLUMN "verifiedBy" UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verifiedat') THEN
        ALTER TABLE verifications ADD COLUMN "verifiedAt" TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- Table: metrics_snapshots
-- Missing columns: 3

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalschools') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN "totalSchools" INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalcolleges') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN "totalColleges" INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='totalcompanies') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN "totalCompanies" INTEGER DEFAULT 0;
    END IF;
END $$;


-- Table: audit_logs
-- Missing columns: 6

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ipaddress') THEN
        ALTER TABLE audit_logs ADD COLUMN "ipAddress" INET;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='useragent') THEN
        ALTER TABLE audit_logs ADD COLUMN "userAgent" TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='oldvalues') THEN
        ALTER TABLE audit_logs ADD COLUMN "oldValues" JSONB;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='newvalues') THEN
        ALTER TABLE audit_logs ADD COLUMN "newValues" JSONB;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resourcetype') THEN
        ALTER TABLE audit_logs ADD COLUMN "resourceType" VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resourceid') THEN
        ALTER TABLE audit_logs ADD COLUMN "resourceId" UUID;
    END IF;
END $$;


-- ============================================================
-- END OF ALIGNMENT MIGRATION
-- ============================================================
