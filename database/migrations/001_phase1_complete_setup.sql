-- ============================================================
-- RAREMINDS PHASE 1 COMPLETE DATABASE MIGRATION
-- Version: 1.0
-- Date: January 2025
-- Description: RBAC + Approvals + University Hierarchy + Schools
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: RBAC SYSTEM
-- ============================================================

-- 1.1: Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2: Create role_permissions mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- 1.3: Ensure entity fields exist in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 1.4: Create RBAC indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity ON users(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- ============================================================
-- PART 2: SEED PERMISSIONS
-- ============================================================

-- Clear existing permissions (if re-running)
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE permissions CASCADE;

-- 2.1: Platform Admin Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('platform:manage_all', 'platform', 'manage_all', 'Full platform access'),
('platform:view_analytics', 'platform', 'view_analytics', 'View platform analytics'),
('platform:configure_settings', 'platform', 'configure', 'Configure platform settings');

-- 2.2: School Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('school:create', 'school', 'create', 'Create schools'),
('school:read', 'school', 'read', 'View school details'),
('school:update', 'school', 'update', 'Update school details'),
('school:delete', 'school', 'delete', 'Delete schools'),
('school:approve', 'school', 'approve', 'Approve school registration'),
('school:reject', 'school', 'reject', 'Reject school registration'),
('school:suspend', 'school', 'suspend', 'Suspend school'),
('class:create', 'class', 'create', 'Create classes'),
('class:read', 'class', 'read', 'View class details'),
('class:update', 'class', 'update', 'Update classes'),
('class:delete', 'class', 'delete', 'Delete classes'),
('educator:create', 'educator', 'create', 'Add educators'),
('educator:read', 'educator', 'read', 'View educators'),
('educator:update', 'educator', 'update', 'Update educators'),
('educator:assign', 'educator', 'assign', 'Assign educators to classes');

-- 2.3: University Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('university:create', 'university', 'create', 'Create universities'),
('university:read', 'university', 'read', 'View university details'),
('university:update', 'university', 'update', 'Update universities'),
('university:delete', 'university', 'delete', 'Delete universities'),
('university:approve', 'university', 'approve', 'Approve universities'),
('university:reject', 'university', 'reject', 'Reject universities'),
('university:suspend', 'university', 'suspend', 'Suspend universities');

-- 2.4: College Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('college:create', 'college', 'create', 'Create colleges within university'),
('college:read', 'college', 'read', 'View college details'),
('college:update', 'college', 'update', 'Update colleges'),
('college:delete', 'college', 'delete', 'Delete colleges'),
('lecturer:create', 'lecturer', 'create', 'Add lecturers'),
('lecturer:read', 'lecturer', 'read', 'View lecturers'),
('lecturer:update', 'lecturer', 'update', 'Update lecturers'),
('lecturer:assign', 'lecturer', 'assign', 'Assign lecturers to courses');

-- 2.5: Student Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('student:create', 'student', 'create', 'Create student accounts'),
('student:read', 'student', 'read', 'View student details'),
('student:update', 'student', 'update', 'Update students'),
('student:delete', 'student', 'delete', 'Delete students'),
('student:enroll', 'student', 'enroll', 'Enroll students');

-- 2.6: Passport Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('passport:create', 'passport', 'create', 'Create skill passports'),
('passport:read', 'passport', 'read', 'View passports'),
('passport:update', 'passport', 'update', 'Update passports'),
('passport:verify', 'passport', 'verify', 'Verify passports'),
('passport:reject', 'passport', 'reject', 'Reject passports');

-- 2.7: Company & Recruiter Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('company:create', 'company', 'create', 'Create companies'),
('company:read', 'company', 'read', 'View company details'),
('company:update', 'company', 'update', 'Update companies'),
('company:approve', 'company', 'approve', 'Approve companies'),
('recruiter:create', 'recruiter', 'create', 'Add recruiters'),
('recruiter:read', 'recruiter', 'read', 'View recruiters'),
('recruiter:update', 'recruiter', 'update', 'Update recruiters'),
('recruiter:approve', 'recruiter', 'approve', 'Approve recruiters');

-- 2.8: Audit & User Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('audit:read_all', 'audit', 'read_all', 'View all audit logs'),
('logs:read_all', 'logs', 'read_all', 'View all logs'),
('user:read_all', 'user', 'read_all', 'View all users'),
('user:create', 'user', 'create', 'Create users'),
('user:update_any', 'user', 'update_any', 'Update any user'),
('user:delete_any', 'user', 'delete_any', 'Delete any user'),
('user:suspend_any', 'user', 'suspend_any', 'Suspend any user'),
('user:activate_any', 'user', 'activate_any', 'Activate any user');

-- ============================================================
-- PART 3: ASSIGN PERMISSIONS TO ROLES
-- ============================================================

-- 3.1: Platform Admin gets ALL permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'platform_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Also grant to super_admin (your current role)
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3.2: School Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'school_admin', id FROM permissions 
WHERE name IN (
  'school:read', 'school:update',
  'class:create', 'class:read', 'class:update', 'class:delete',
  'educator:create', 'educator:read', 'educator:update', 'educator:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll',
  'passport:read', 'passport:verify'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3.3: University Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'university_admin', id FROM permissions 
WHERE name IN (
  'university:read', 'university:update',
  'college:create', 'college:read', 'college:update', 'college:delete',
  'lecturer:create', 'lecturer:read', 'lecturer:update', 'lecturer:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll',
  'passport:read', 'passport:verify'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3.4: College Admin permissions (for standalone colleges)
INSERT INTO role_permissions (role, permission_id)
SELECT 'college_admin', id FROM permissions 
WHERE name IN (
  'college:read', 'college:update',
  'lecturer:create', 'lecturer:read', 'lecturer:update', 'lecturer:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll',
  'passport:read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3.5: Company Admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'company_admin', id FROM permissions 
WHERE name IN (
  'company:read', 'company:update',
  'recruiter:create', 'recruiter:read', 'recruiter:update',
  'student:read', 'passport:read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3.6: Educator permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'educator', id FROM permissions 
WHERE name IN (
  'class:read',
  'student:read',
  'passport:read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3.7: Lecturer permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'lecturer', id FROM permissions 
WHERE name IN (
  'college:read',
  'student:read',
  'passport:read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================
-- PART 4: APPROVAL WORKFLOW FIELDS
-- ============================================================

-- 4.1: Add approval fields to universities
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- 4.2: Add approval fields to recruiters
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- 4.3: Create approval indexes
CREATE INDEX IF NOT EXISTS idx_universities_approval ON universities(approval_status);
CREATE INDEX IF NOT EXISTS idx_universities_status ON universities(account_status);
CREATE INDEX IF NOT EXISTS idx_recruiters_approval ON recruiters(approval_status);
CREATE INDEX IF NOT EXISTS idx_recruiters_status ON recruiters(account_status);

-- 4.4: Update existing records to 'approved' status
UPDATE universities SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE recruiters SET approval_status = 'approved' WHERE approval_status IS NULL;

-- ============================================================
-- PART 5: UNIVERSITY HIERARCHY
-- ============================================================

-- 5.1: Create university_colleges table
CREATE TABLE IF NOT EXISTS university_colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  dean_name VARCHAR(200),
  dean_email VARCHAR(255),
  dean_phone VARCHAR(20),
  established_year INTEGER,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(university_id, code)
);

-- 5.2: Add college relationship to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_college_id UUID REFERENCES university_colleges(id) ON DELETE SET NULL;

-- 5.3: Create university hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_univ_colleges_university ON university_colleges(university_id);
CREATE INDEX IF NOT EXISTS idx_students_univ_college ON students(university_college_id);

-- ============================================================
-- PART 6: SCHOOL MANAGEMENT SYSTEM
-- ============================================================

-- 6.1: Create schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  board VARCHAR(100), -- CBSE, State Board, ICSE, IGCSE, IB
  principal_name VARCHAR(200),
  principal_email VARCHAR(255),
  principal_phone VARCHAR(20),
  account_status VARCHAR(20) DEFAULT 'pending',
  approval_status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 6.2: Create school_classes table
CREATE TABLE IF NOT EXISTS school_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  section VARCHAR(10),
  academic_year VARCHAR(20) NOT NULL,
  max_students INTEGER DEFAULT 40,
  current_students INTEGER DEFAULT 0,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(school_id, name, academic_year)
);

-- 6.3: Create school_educators table
CREATE TABLE IF NOT EXISTS school_educators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  employee_id VARCHAR(50),
  specialization VARCHAR(100),
  qualification VARCHAR(255),
  experience_years INTEGER,
  date_of_joining DATE,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(school_id, employee_id)
);

-- 6.4: Create educator-class assignments (many-to-many)
CREATE TABLE IF NOT EXISTS school_educator_class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id UUID NOT NULL REFERENCES school_educators(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(educator_id, class_id, subject, academic_year)
);

-- 6.5: Update students table for school linkage
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_class_id UUID REFERENCES school_classes(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_type VARCHAR(30) DEFAULT 'direct';

-- 6.6: Create school indexes
CREATE INDEX IF NOT EXISTS idx_schools_approval ON schools(approval_status);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(account_status);
CREATE INDEX IF NOT EXISTS idx_schools_state ON schools(state);
CREATE INDEX IF NOT EXISTS idx_schools_board ON schools(board);
CREATE INDEX IF NOT EXISTS idx_school_classes_school ON school_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_academic_year ON school_classes(academic_year);
CREATE INDEX IF NOT EXISTS idx_school_educators_school ON school_educators(school_id);
CREATE INDEX IF NOT EXISTS idx_school_educators_user ON school_educators(user_id);
CREATE INDEX IF NOT EXISTS idx_educator_assignments_educator ON school_educator_class_assignments(educator_id);
CREATE INDEX IF NOT EXISTS idx_educator_assignments_class ON school_educator_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_class_id);

-- ============================================================
-- PART 7: DATA INTEGRITY CONSTRAINTS
-- ============================================================

-- 7.1: Ensure student can only be in ONE class at a time
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_only_one_class'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT chk_only_one_class CHECK (
      (school_class_id IS NOT NULL AND university_college_id IS NULL) OR
      (school_class_id IS NULL AND university_college_id IS NOT NULL) OR
      (school_class_id IS NULL AND university_college_id IS NULL)
    );
  END IF;
END $$;

-- ============================================================
-- PART 8: UPDATED TRIGGERS
-- ============================================================

-- 8.1: Create or replace updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 8.2: Add triggers for all new tables
DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;
CREATE TRIGGER update_schools_updated_at 
  BEFORE UPDATE ON schools 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_school_classes_updated_at ON school_classes;
CREATE TRIGGER update_school_classes_updated_at 
  BEFORE UPDATE ON school_classes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_school_educators_updated_at ON school_educators;
CREATE TRIGGER update_school_educators_updated_at 
  BEFORE UPDATE ON school_educators 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_univ_colleges_updated_at ON university_colleges;
CREATE TRIGGER update_univ_colleges_updated_at 
  BEFORE UPDATE ON university_colleges 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART 9: VERIFICATION & SUMMARY
-- ============================================================

-- Display summary of created objects
DO $$ 
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRATION COMPLETE - SUMMARY';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Tables Created: permissions, role_permissions, university_colleges, schools, school_classes, school_educators, school_educator_class_assignments';
  RAISE NOTICE 'Permissions Created: % total permissions', (SELECT COUNT(*) FROM permissions);
  RAISE NOTICE 'Role Permissions Assigned: % mappings', (SELECT COUNT(*) FROM role_permissions);
  RAISE NOTICE 'Indexes Created: ~25 performance indexes';
  RAISE NOTICE 'Triggers Created: updated_at triggers for all tables';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Review permissions: SELECT * FROM permissions;';
  RAISE NOTICE '2. Check role assignments: SELECT role, COUNT(*) FROM role_permissions GROUP BY role;';
  RAISE NOTICE '3. Test RBAC: Assign test users to different roles';
  RAISE NOTICE '4. Begin UI implementation';
  RAISE NOTICE '============================================================';
END $$;

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES (Run separately to verify)
-- ============================================================

-- Check permissions count
-- SELECT resource, COUNT(*) as permission_count FROM permissions GROUP BY resource ORDER BY resource;

-- Check role assignments
-- SELECT role, COUNT(*) as permissions_assigned FROM role_permissions GROUP BY role ORDER BY role;

-- Check table existence
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('schools', 'school_classes', 'school_educators', 'university_colleges', 'permissions', 'role_permissions') ORDER BY table_name;

-- Check indexes
-- SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('schools', 'universities', 'recruiters', 'students') ORDER BY tablename, indexname;
