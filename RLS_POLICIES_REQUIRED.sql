-- ============================================================
-- RLS POLICIES REQUIRED FOR SUPABASE ADMIN REMOVAL
-- ============================================================
-- 
-- These policies MUST be configured in Supabase for the application
-- to work correctly after removing supabaseAdmin client.
--
-- The policies ensure:
-- 1. Platform admins (super_admin, platform_admin) see ALL data
-- 2. Other users see only data scoped to their entity/role
-- 3. All database operations go through proper RLS enforcement
--
-- HOW TO APPLY:
-- 1. Open Supabase Dashboard
-- 2. Go to Authentication → Policies
-- 3. Select each table and add these policies
-- OR run this SQL in the SQL Editor
-- ============================================================

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to all users
CREATE POLICY "platform_admin_all_users" ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Users can read their own data
CREATE POLICY "users_own_data" ON users FOR SELECT
USING (supabase_auth_id = auth.uid());

-- Users can update their own metadata
CREATE POLICY "users_update_own" ON users FOR UPDATE
USING (supabase_auth_id = auth.uid())
WITH CHECK (supabase_auth_id = auth.uid());

-- Entity admins can manage users in their entity
CREATE POLICY "entity_admin_users" ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('university_admin', 'school_admin', 'company_admin')
    AND entity_id = u.entity_id
  )
);

-- ============================================================
-- STUDENTS TABLE POLICIES
-- ============================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to all students
CREATE POLICY "platform_admin_all_students" ON students FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- University admins see their university's students
CREATE POLICY "university_admin_students" ON students FOR SELECT
USING (
  universityId IN (
    SELECT entity_id FROM users
    WHERE supabase_auth_id = auth.uid()
    AND role = 'university_admin'
    AND entity_type = 'university'
  )
);

-- Students see only their own data
CREATE POLICY "student_own_data" ON students FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users
    WHERE supabase_auth_id = auth.uid()
  )
);

-- University admins can create/update/delete their students
CREATE POLICY "university_admin_manage_students" ON students FOR ALL
USING (
  universityId IN (
    SELECT entity_id FROM users
    WHERE supabase_auth_id = auth.uid()
    AND role = 'university_admin'
    AND entity_type = 'university'
  )
);

-- ============================================================
-- RECRUITERS TABLE POLICIES
-- ============================================================

ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to all recruiters
CREATE POLICY "platform_admin_all_recruiters" ON recruiters FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Company admins see their company's recruiters
CREATE POLICY "company_admin_recruiters" ON recruiters FOR SELECT
USING (
  companyId IN (
    SELECT entity_id FROM users
    WHERE supabase_auth_id = auth.uid()
    AND role = 'company_admin'
    AND entity_type = 'company'
  )
);

-- Recruiters see their own data
CREATE POLICY "recruiter_own_data" ON recruiters FOR SELECT
USING (
  user_id IN (
    SELECT id FROM users
    WHERE supabase_auth_id = auth.uid()
  )
);

-- ============================================================
-- SKILL_PASSPORTS TABLE POLICIES
-- ============================================================

ALTER TABLE skill_passports ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to all passports
CREATE POLICY "platform_admin_all_passports" ON skill_passports FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Users can see passports for students in their entity
CREATE POLICY "entity_passports" ON skill_passports FOR SELECT
USING (
  studentId IN (
    SELECT s.id FROM students s
    JOIN users u ON u.id = (
      SELECT id FROM users WHERE supabase_auth_id = auth.uid()
    )
    WHERE
      (u.role IN ('platform_admin', 'super_admin')) OR
      (u.role = 'university_admin' AND s.universityId = u.entity_id) OR
      (u.role = 'student' AND s.user_id = u.id)
  )
);

-- University admins can verify passports for their students
CREATE POLICY "university_admin_verify_passports" ON skill_passports FOR UPDATE
USING (
  studentId IN (
    SELECT s.id FROM students s
    WHERE s.universityId IN (
      SELECT entity_id FROM users
      WHERE supabase_auth_id = auth.uid()
      AND role = 'university_admin'
      AND entity_type = 'university'
    )
  )
);

-- ============================================================
-- PLACEMENTS TABLE POLICIES
-- ============================================================

ALTER TABLE placements ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to all placements
CREATE POLICY "platform_admin_all_placements" ON placements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Company admins see their company's placements
CREATE POLICY "company_admin_placements" ON placements FOR SELECT
USING (
  companyId IN (
    SELECT entity_id FROM users
    WHERE supabase_auth_id = auth.uid()
    AND role = 'company_admin'
    AND entity_type = 'company'
  )
);

-- University admins see placements for their students
CREATE POLICY "university_admin_placements" ON placements FOR SELECT
USING (
  studentId IN (
    SELECT id FROM students
    WHERE universityId IN (
      SELECT entity_id FROM users
      WHERE supabase_auth_id = auth.uid()
      AND role = 'university_admin'
      AND entity_type = 'university'
    )
  )
);

-- ============================================================
-- UNIVERSITIES TABLE POLICIES
-- ============================================================

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to all universities
CREATE POLICY "platform_admin_all_universities" ON universities FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Anyone can view universities (public data)
CREATE POLICY "public_read_universities" ON universities FOR SELECT
USING (true);

-- University admins can update their own university
CREATE POLICY "university_admin_update_own" ON universities FOR UPDATE
USING (
  id IN (
    SELECT entity_id FROM users
    WHERE supabase_auth_id = auth.uid()
    AND role = 'university_admin'
    AND entity_type = 'university'
  )
);

-- ============================================================
-- ADMIN_USERS TABLE POLICIES
-- ============================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access to admin_users
CREATE POLICY "platform_admin_all_admin_users" ON admin_users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Super admins can manage platform admins
CREATE POLICY "super_admin_manage_admins" ON admin_users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role = 'super_admin'
  )
);

-- ============================================================
-- METRICS_SNAPSHOTS TABLE POLICIES
-- ============================================================

ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- Platform admins can read all metrics snapshots
CREATE POLICY "platform_admin_read_metrics" ON metrics_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Platform admins can insert new metrics snapshots
CREATE POLICY "platform_admin_write_metrics" ON metrics_snapshots FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Platform admins can update metrics snapshots
CREATE POLICY "platform_admin_update_metrics" ON metrics_snapshots FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- ============================================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all audit logs
CREATE POLICY "platform_admin_all_audit_logs" ON audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Users can see audit logs they created
CREATE POLICY "user_own_audit_logs" ON audit_logs FOR SELECT
USING (
  actorId IN (
    SELECT id FROM users
    WHERE supabase_auth_id = auth.uid()
  )
);

-- Anyone can insert audit logs (for tracking)
CREATE POLICY "anyone_insert_audit_logs" ON audit_logs FOR INSERT
WITH CHECK (true);

-- ============================================================
-- ORGANIZATIONS TABLE POLICIES (if exists)
-- ============================================================

-- Enable RLS on organizations if table exists
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Platform admins have full access
-- CREATE POLICY "platform_admin_all_organizations" ON organizations FOR ALL
-- USING (
--   EXISTS (
--     SELECT 1 FROM users u
--     WHERE u.supabase_auth_id = auth.uid()
--     AND u.role IN ('platform_admin', 'super_admin')
--   )
-- );

-- Anyone can view organizations (public data)
-- CREATE POLICY "public_read_organizations" ON organizations FOR SELECT
-- USING (true);

-- ============================================================
-- VERIFICATION STEPS
-- ============================================================

-- After applying these policies, verify they work:

-- 1. Check policies are enabled:
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Test as platform admin (should see all data):
-- Login as platform admin and run:
-- SELECT COUNT(*) FROM students;
-- SELECT COUNT(*) FROM recruiters;
-- SELECT COUNT(*) FROM skill_passports;

-- 3. Test as university admin (should see only their data):
-- Login as university admin and run:
-- SELECT COUNT(*) FROM students; -- Should return only their students
-- SELECT COUNT(*) FROM universities; -- Should see all universities (public)

-- 4. Test as student (should see only own data):
-- Login as student and run:
-- SELECT * FROM students WHERE user_id = auth.uid(); -- Should work
-- SELECT * FROM students; -- Should return only their record

-- ============================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================

-- Add indexes for RLS policy performance:

-- Index on users table for role lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_id_role 
ON users(supabase_auth_id, role);

-- Index on students for entity lookups
CREATE INDEX IF NOT EXISTS idx_students_university_id 
ON students(universityId);

CREATE INDEX IF NOT EXISTS idx_students_user_id 
ON students(user_id);

-- Index on recruiters for entity lookups
CREATE INDEX IF NOT EXISTS idx_recruiters_company_id 
ON recruiters(companyId);

-- Index on skill_passports for student lookups
CREATE INDEX IF NOT EXISTS idx_skill_passports_student_id 
ON skill_passports(studentId);

-- Index on placements for lookups
CREATE INDEX IF NOT EXISTS idx_placements_student_id 
ON placements(studentId);

CREATE INDEX IF NOT EXISTS idx_placements_company_id 
ON placements(companyId);

-- ============================================================
-- NOTES
-- ============================================================

/*
IMPORTANT:
1. These policies assume the 'users' table has:
   - supabase_auth_id (UUID) - links to auth.users
   - role (TEXT) - user's role (platform_admin, super_admin, university_admin, etc.)
   - entity_id (UUID) - ID of the entity they belong to
   - entity_type (TEXT) - type of entity (university, company, etc.)

2. The auth.uid() function returns the authenticated user's ID from the JWT token

3. Platform admins and super admins have full access to all data via RLS policies

4. All other users see data scoped to their entity/role

5. Test thoroughly after applying these policies!

6. Monitor query performance - RLS policies add overhead

7. Use indexed columns in policies for better performance
*/

-- ============================================================
-- END OF RLS POLICIES
-- ============================================================
