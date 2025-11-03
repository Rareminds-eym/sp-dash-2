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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supabase_auth_id') THEN
        ALTER TABLE users ADD COLUMN supabase_auth_id UUID UNIQUE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_name') THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entity_type') THEN
        ALTER TABLE users ADD COLUMN entity_type entity_type;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='entity_id') THEN
        ALTER TABLE users ADD COLUMN entity_id UUID;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_status') THEN
        ALTER TABLE users ADD COLUMN account_status account_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_password_change') THEN
        ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_image_url') THEN
        ALTER TABLE users ADD COLUMN profile_image_url TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- Table: universities
-- Missing columns: 9

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='university_type') THEN
        ALTER TABLE universities ADD COLUMN university_type VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approval_status') THEN
        ALTER TABLE universities ADD COLUMN approval_status approval_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approved_by') THEN
        ALTER TABLE universities ADD COLUMN approved_by UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='approved_at') THEN
        ALTER TABLE universities ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='account_status') THEN
        ALTER TABLE universities ADD COLUMN account_status account_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_colleges') THEN
        ALTER TABLE universities ADD COLUMN total_colleges INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_courses') THEN
        ALTER TABLE universities ADD COLUMN total_courses INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_lecturers') THEN
        ALTER TABLE universities ADD COLUMN total_lecturers INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='universities' AND column_name='total_students') THEN
        ALTER TABLE universities ADD COLUMN total_students INTEGER DEFAULT 0;
    END IF;
END $$;


-- Table: students
-- Missing columns: 17

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='student_type') THEN
        ALTER TABLE students ADD COLUMN student_type student_type;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='school_id') THEN
        ALTER TABLE students ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='college_id') THEN
        ALTER TABLE students ADD COLUMN college_id UUID REFERENCES colleges_standalone(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='university_college_id') THEN
        ALTER TABLE students ADD COLUMN university_college_id UUID REFERENCES university_colleges(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='school_class_id') THEN
        ALTER TABLE students ADD COLUMN school_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='college_course_id') THEN
        ALTER TABLE students ADD COLUMN college_course_id UUID REFERENCES college_courses(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='university_course_id') THEN
        ALTER TABLE students ADD COLUMN university_course_id UUID REFERENCES university_courses(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollment_number') THEN
        ALTER TABLE students ADD COLUMN enrollment_number VARCHAR(100);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_name') THEN
        ALTER TABLE students ADD COLUMN guardian_name VARCHAR(200);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_phone') THEN
        ALTER TABLE students ADD COLUMN guardian_phone VARCHAR(20);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_email') THEN
        ALTER TABLE students ADD COLUMN guardian_email VARCHAR(255);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_relation') THEN
        ALTER TABLE students ADD COLUMN guardian_relation VARCHAR(50);
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='blood_group') THEN
        ALTER TABLE students ADD COLUMN blood_group VARCHAR(5);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='enrollment_date') THEN
        ALTER TABLE students ADD COLUMN enrollment_date DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='expected_graduation_date') THEN
        ALTER TABLE students ADD COLUMN expected_graduation_date DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='current_cgpa') THEN
        ALTER TABLE students ADD COLUMN current_cgpa DECIMAL(4;
    END IF;
END $$;


-- Table: skill_passports
-- Missing columns: 8

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='nsqf_level') THEN
        ALTER TABLE skill_passports ADD COLUMN nsqf_level INTEGER;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='work_experience') THEN
        ALTER TABLE skill_passports ADD COLUMN work_experience JSONB DEFAULT '[]';
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verified_by') THEN
        ALTER TABLE skill_passports ADD COLUMN verified_by UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='verified_at') THEN
        ALTER TABLE skill_passports ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='ai_verified') THEN
        ALTER TABLE skill_passports ADD COLUMN ai_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='skill_passports' AND column_name='ai_verification_score') THEN
        ALTER TABLE skill_passports ADD COLUMN ai_verification_score DECIMAL(5;
    END IF;
END $$;


-- Table: recruiters
-- Missing columns: 11

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='verification_status') THEN
        ALTER TABLE recruiters ADD COLUMN verification_status approval_status DEFAULT 'pending';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='is_active') THEN
        ALTER TABLE recruiters ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='user_count') THEN
        ALTER TABLE recruiters ADD COLUMN user_count INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='company_id') THEN
        ALTER TABLE recruiters ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='branch_id') THEN
        ALTER TABLE recruiters ADD COLUMN branch_id UUID REFERENCES company_branches(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='employee_id') THEN
        ALTER TABLE recruiters ADD COLUMN employee_id VARCHAR(50);
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='date_of_joining') THEN
        ALTER TABLE recruiters ADD COLUMN date_of_joining DATE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='is_hq_recruiter') THEN
        ALTER TABLE recruiters ADD COLUMN is_hq_recruiter BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recruiters' AND column_name='account_status') THEN
        ALTER TABLE recruiters ADD COLUMN account_status account_status DEFAULT 'active';
    END IF;
END $$;


-- Table: verifications
-- Missing columns: 5

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verification_type') THEN
        ALTER TABLE verifications ADD COLUMN verification_type VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verification_notes') THEN
        ALTER TABLE verifications ADD COLUMN verification_notes TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verification_data') THEN
        ALTER TABLE verifications ADD COLUMN verification_data JSONB DEFAULT '{}';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verified_by') THEN
        ALTER TABLE verifications ADD COLUMN verified_by UUID REFERENCES users(id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='verifications' AND column_name='verified_at') THEN
        ALTER TABLE verifications ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;


-- Table: metrics_snapshots
-- Missing columns: 3

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='total_schools') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN total_schools INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='total_colleges') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN total_colleges INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metrics_snapshots' AND column_name='total_companies') THEN
        ALTER TABLE metrics_snapshots ADD COLUMN total_companies INTEGER DEFAULT 0;
    END IF;
END $$;


-- Table: audit_logs
-- Missing columns: 6

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ip_address') THEN
        ALTER TABLE audit_logs ADD COLUMN ip_address INET;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_agent') THEN
        ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='old_values') THEN
        ALTER TABLE audit_logs ADD COLUMN old_values JSONB;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='new_values') THEN
        ALTER TABLE audit_logs ADD COLUMN new_values JSONB;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resource_type') THEN
        ALTER TABLE audit_logs ADD COLUMN resource_type VARCHAR(50);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='resource_id') THEN
        ALTER TABLE audit_logs ADD COLUMN resource_id UUID;
    END IF;
END $$;


-- ============================================================
-- END OF ALIGNMENT MIGRATION
-- ============================================================
