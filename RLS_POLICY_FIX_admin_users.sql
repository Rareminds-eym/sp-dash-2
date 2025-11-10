-- ============================================================
-- FIX FOR admin_users TABLE RLS POLICY
-- ============================================================
-- 
-- PROBLEM: The current policy checks admin_users.user_id = auth.uid()
-- but auth.uid() returns supabase_auth_id, not users.id
--
-- SOLUTION: Join through users table to get the correct ID mapping
-- ============================================================

-- First, drop the existing incorrect policy
DROP POLICY IF EXISTS "super_admin_manage_admins" ON admin_users;
DROP POLICY IF EXISTS "platform_admin_all_admin_users" ON admin_users;

-- ============================================================
-- CORRECT POLICIES FOR admin_users TABLE
-- ============================================================

-- Policy 1: Platform admins and super admins can see all admin users
CREATE POLICY "platform_admin_read_admin_users" ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Policy 2: Platform admins and super admins can insert admin users
CREATE POLICY "platform_admin_insert_admin_users" ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Policy 3: Platform admins and super admins can update admin users
CREATE POLICY "platform_admin_update_admin_users" ON admin_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- Policy 4: Platform admins and super admins can delete admin users
CREATE POLICY "platform_admin_delete_admin_users" ON admin_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);

-- ============================================================
-- ALTERNATIVE: Single policy for all operations (simpler)
-- ============================================================
-- If you prefer a single policy instead of 4 separate ones:

-- Drop the 4 policies above and use this one instead:
/*
DROP POLICY IF EXISTS "platform_admin_read_admin_users" ON admin_users;
DROP POLICY IF EXISTS "platform_admin_insert_admin_users" ON admin_users;
DROP POLICY IF EXISTS "platform_admin_update_admin_users" ON admin_users;
DROP POLICY IF EXISTS "platform_admin_delete_admin_users" ON admin_users;

CREATE POLICY "platform_admin_all_admin_users" ON admin_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.supabase_auth_id = auth.uid()
    AND u.role IN ('platform_admin', 'super_admin')
  )
);
*/

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- After applying the policy, run this to verify it works:

-- 1. Check your current user's info
SELECT 
  auth.uid() as auth_id,
  u.id as user_id,
  u.email,
  u.role
FROM users u
WHERE u.supabase_auth_id = auth.uid();

-- 2. Try to fetch admin_users (should work now)
SELECT * FROM admin_users LIMIT 5;

-- 3. Check all policies on admin_users table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'admin_users';

-- ============================================================
-- KEY POINTS
-- ============================================================
/*
1. auth.uid() returns the Supabase auth user ID (from auth.users)
2. users.supabase_auth_id stores this auth ID
3. users.id is the internal user ID used in other tables
4. admin_users.user_id references users.id (not auth.uid())

Therefore, the policy MUST:
- Join users table: WHERE u.supabase_auth_id = auth.uid()
- Then check: u.role IN ('platform_admin', 'super_admin')

This correctly maps: auth.uid() → users.supabase_auth_id → users.role
*/

-- ============================================================
-- INDEX FOR PERFORMANCE
-- ============================================================
-- Add index to speed up the policy check:
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id_role 
ON users(supabase_auth_id, role);
