-- ====================================================================================================
-- Week 1 Migration: RBAC System + Approval Workflows + University Hierarchy
-- Date: January 2025
-- Description: Implements complete RBAC with 11 roles, approval workflows, and university colleges
-- ====================================================================================================

-- ====================================================================================================
-- PART 1: RBAC System Database Schema
-- ====================================================================================================

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create role_permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- 3. Ensure entity fields exist in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_id UUID;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_entity ON users(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- ====================================================================================================
-- PART 2: Seed Permissions
-- ====================================================================================================

-- Platform Admin Permissions (Full Access)
INSERT INTO permissions (name, resource, action, description) VALUES
('platform:manage_all', 'platform', 'manage_all', 'Full platform access'),
('platform:view_analytics', 'platform', 'view_analytics', 'View platform-wide analytics'),
('platform:configure_settings', 'platform', 'configure', 'Configure platform settings'),
('platform:manage_users', 'platform', 'manage_users', 'Manage all users across platform')
ON CONFLICT (name) DO NOTHING;

-- School Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('school:create', 'school', 'create', 'Create schools'),
('school:read', 'school', 'read', 'View school details'),
('school:update', 'school', 'update', 'Update school details'),
('school:delete', 'school', 'delete', 'Delete schools'),
('school:approve', 'school', 'approve', 'Approve school registration'),
('school:reject', 'school', 'reject', 'Reject school registration'),
('school:suspend', 'school', 'suspend', 'Suspend school'),
('school:read_own', 'school', 'read_own', 'View own school details'),
('school:update_own', 'school', 'update_own', 'Update own school details')
ON CONFLICT (name) DO NOTHING;

-- Class Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('class:create', 'class', 'create', 'Create classes'),
('class:read', 'class', 'read', 'View class details'),
('class:update', 'class', 'update', 'Update classes'),
('class:delete', 'class', 'delete', 'Delete classes')
ON CONFLICT (name) DO NOTHING;

-- Educator Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('educator:create', 'educator', 'create', 'Add educators'),
('educator:read', 'educator', 'read', 'View educators'),
('educator:update', 'educator', 'update', 'Update educator details'),
('educator:delete', 'educator', 'delete', 'Remove educators'),
('educator:assign', 'educator', 'assign', 'Assign educators to classes')
ON CONFLICT (name) DO NOTHING;

-- University Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('university:create', 'university', 'create', 'Create universities'),
('university:read', 'university', 'read', 'View university details'),
('university:update', 'university', 'update', 'Update universities'),
('university:delete', 'university', 'delete', 'Delete universities'),
('university:approve', 'university', 'approve', 'Approve universities'),
('university:reject', 'university', 'reject', 'Reject universities'),
('university:suspend', 'university', 'suspend', 'Suspend universities'),
('university:read_own', 'university', 'read_own', 'View own university details'),
('university:update_own', 'university', 'update_own', 'Update own university details')
ON CONFLICT (name) DO NOTHING;

-- College Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('college:create', 'college', 'create', 'Create colleges within university'),
('college:read', 'college', 'read', 'View college details'),
('college:update', 'college', 'update', 'Update college details'),
('college:delete', 'college', 'delete', 'Delete colleges'),
('college:approve', 'college', 'approve', 'Approve standalone colleges'),
('college:read_own', 'college', 'read_own', 'View own college details'),
('college:update_own', 'college', 'update_own', 'Update own college details')
ON CONFLICT (name) DO NOTHING;

-- Lecturer Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('lecturer:create', 'lecturer', 'create', 'Add lecturers'),
('lecturer:read', 'lecturer', 'read', 'View lecturers'),
('lecturer:update', 'lecturer', 'update', 'Update lecturer details'),
('lecturer:delete', 'lecturer', 'delete', 'Remove lecturers'),
('lecturer:assign', 'lecturer', 'assign', 'Assign lecturers to courses')
ON CONFLICT (name) DO NOTHING;

-- Student Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('student:create', 'student', 'create', 'Create student accounts'),
('student:read', 'student', 'read', 'View student details'),
('student:read_all', 'student', 'read_all', 'View all students across platform'),
('student:update', 'student', 'update', 'Update students'),
('student:delete', 'student', 'delete', 'Delete students'),
('student:enroll', 'student', 'enroll', 'Enroll students'),
('student:read_own', 'student', 'read_own', 'View own student profile')
ON CONFLICT (name) DO NOTHING;

-- Passport Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('passport:read', 'passport', 'read', 'View passports'),
('passport:read_all', 'passport', 'read_all', 'View all passports across platform'),
('passport:create', 'passport', 'create', 'Create passports'),
('passport:update', 'passport', 'update', 'Update passports'),
('passport:verify', 'passport', 'verify', 'Verify passports'),
('passport:reject', 'passport', 'reject', 'Reject passports'),
('passport:read_own', 'passport', 'read_own', 'View own passport')
ON CONFLICT (name) DO NOTHING;

-- Company/Recruiter Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('company:create', 'company', 'create', 'Create companies'),
('company:read', 'company', 'read', 'View company details'),
('company:update', 'company', 'update', 'Update companies'),
('company:approve', 'company', 'approve', 'Approve companies'),
('company:read_own', 'company', 'read_own', 'View own company details'),
('company:update_own', 'company', 'update_own', 'Update own company details'),
('recruiter:create', 'recruiter', 'create', 'Add recruiters'),
('recruiter:read', 'recruiter', 'read', 'View recruiter details'),
('recruiter:search_students', 'recruiter', 'search_students', 'Search student profiles')
ON CONFLICT (name) DO NOTHING;

-- Audit & User Permissions
INSERT INTO permissions (name, resource, action, description) VALUES
('audit:read_all', 'audit', 'read_all', 'View all audit logs'),
('audit:read_own', 'audit', 'read_own', 'View own activity logs'),
('user:read_all', 'user', 'read_all', 'View all users'),
('user:read_own', 'user', 'read_own', 'View own user profile'),
('user:update_any', 'user', 'update_any', 'Update any user'),
('user:update_own', 'user', 'update_own', 'Update own user profile'),
('user:suspend_any', 'user', 'suspend_any', 'Suspend any user'),
('user:delete_any', 'user', 'delete_any', 'Delete any user')
ON CONFLICT (name) DO NOTHING;

-- ====================================================================================================
-- PART 3: Assign Permissions to Roles
-- ====================================================================================================

-- Platform Admin (Full Access) - including existing super_admin role
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'platform_admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- School Admin (Manage own school)
INSERT INTO role_permissions (role, permission_id)
SELECT 'school_admin', id FROM permissions 
WHERE name IN (
  'school:read_own', 'school:update_own',
  'class:create', 'class:read', 'class:update', 'class:delete',
  'educator:create', 'educator:read', 'educator:update', 'educator:delete', 'educator:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- University Admin (Manage own university)
INSERT INTO role_permissions (role, permission_id)
SELECT 'university_admin', id FROM permissions 
WHERE name IN (
  'university:read_own', 'university:update_own',
  'college:create', 'college:read', 'college:update', 'college:delete',
  'lecturer:create', 'lecturer:read', 'lecturer:update', 'lecturer:delete', 'lecturer:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- College Admin (Standalone college)
INSERT INTO role_permissions (role, permission_id)
SELECT 'college_admin', id FROM permissions 
WHERE name IN (
  'college:read_own', 'college:update_own',
  'lecturer:create', 'lecturer:read', 'lecturer:update', 'lecturer:assign',
  'student:create', 'student:read', 'student:update', 'student:enroll',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- College Under University Admin (Department within university)
INSERT INTO role_permissions (role, permission_id)
SELECT 'college_under_university_admin', id FROM permissions 
WHERE name IN (
  'college:read_own', 'college:update_own',
  'lecturer:create', 'lecturer:read', 'lecturer:assign',
  'student:read', 'student:enroll',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Company Admin (Manage company and branches)
INSERT INTO role_permissions (role, permission_id)
SELECT 'company_admin', id FROM permissions 
WHERE name IN (
  'company:read_own', 'company:update_own',
  'recruiter:create', 'recruiter:read',
  'recruiter:search_students',
  'student:read',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Branch Manager (Manage company branch)
INSERT INTO role_permissions (role, permission_id)
SELECT 'branch_manager', id FROM permissions 
WHERE name IN (
  'recruiter:read',
  'recruiter:search_students',
  'student:read',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Educator (School teacher)
INSERT INTO role_permissions (role, permission_id)
SELECT 'educator', id FROM permissions 
WHERE name IN (
  'class:read',
  'student:read',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Lecturer (College/university teacher)
INSERT INTO role_permissions (role, permission_id)
SELECT 'lecturer', id FROM permissions 
WHERE name IN (
  'student:read',
  'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Student (View own data)
INSERT INTO role_permissions (role, permission_id)
SELECT 'student', id FROM permissions 
WHERE name IN (
  'student:read_own',
  'passport:read_own',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Recruiter (Search students)
INSERT INTO role_permissions (role, permission_id)
SELECT 'recruiter', id FROM permissions 
WHERE name IN (
  'recruiter:search_students',
  'student:read',
    'passport:read',
  'audit:read_own',
  'user:read_own', 'user:update_own'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Admin role (existing - similar to platform_admin)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Manager role (existing - limited admin access)
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions 
WHERE name IN (
  'school:read', 'university:read', 'college:read',
  'student:read_all', 'passport:read_all',
  'educator:read', 'lecturer:read',
  'audit:read_all', 'user:read_all',
  'platform:view_analytics'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ====================================================================================================
-- PART 4: Approval Workflows Database Schema
-- ====================================================================================================

-- Add approval fields to universities table
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- Add approval fields to recruiters table
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';

-- Create indexes for approval queries
CREATE INDEX IF NOT EXISTS idx_universities_approval ON universities(approval_status);
CREATE INDEX IF NOT EXISTS idx_universities_account_status ON universities(account_status);
CREATE INDEX IF NOT EXISTS idx_recruiters_approval ON recruiters(approval_status);
CREATE INDEX IF NOT EXISTS idx_recruiters_account_status ON recruiters(account_status);

-- Update existing records to 'approved' status
UPDATE universities SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE recruiters SET approval_status = 'approved' WHERE approval_status IS NULL;
UPDATE universities SET account_status = 'active' WHERE account_status IS NULL;
UPDATE recruiters SET account_status = 'active' WHERE account_status IS NULL;

-- ====================================================================================================
-- PART 5: University Hierarchy Database Schema
-- ====================================================================================================

-- Create university_colleges table (departments/faculties within universities)
CREATE TABLE IF NOT EXISTS university_colleges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  dean_name VARCHAR(200),
  dean_email VARCHAR(255),
  dean_phone VARCHAR(20),
  established_year INTEGER,
  description TEXT,
  account_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(university_id, code)
);

-- Add college relationship to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_college_id UUID REFERENCES university_colleges(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_type VARCHAR(30) DEFAULT 'university';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_univ_colleges_university ON university_colleges(university_id);
CREATE INDEX IF NOT EXISTS idx_univ_colleges_status ON university_colleges(account_status);
CREATE INDEX IF NOT EXISTS idx_students_univ_college ON students(university_college_id);
CREATE INDEX IF NOT EXISTS idx_students_student_type ON students(student_type);

-- ====================================================================================================
-- PART 6: Verification & Summary
-- ====================================================================================================

-- Verify tables created
SELECT 'permissions' as table_name, COUNT(*) as row_count FROM permissions
UNION ALL
SELECT 'role_permissions', COUNT(*) FROM role_permissions
UNION ALL
SELECT 'university_colleges', COUNT(*) FROM university_colleges;

-- Summary of permissions by role
SELECT 
  rp.role,
  COUNT(DISTINCT rp.permission_id) as permission_count,
  STRING_AGG(DISTINCT p.resource, ', ' ORDER BY p.resource) as resources
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
GROUP BY rp.role
ORDER BY rp.role;

-- ====================================================================================================
-- Migration Complete!
-- Next Steps:
-- 1. Execute this SQL in Supabase SQL Editor
-- 2. Verify all tables and permissions are created
-- 3. Test RBAC backend implementation
-- 4. Update frontend to use new permissions
-- ====================================================================================================