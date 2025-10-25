-- =============================================
-- DATABASE PERFORMANCE OPTIMIZATION INDEXES
-- Rareminds Super Admin Dashboard
-- =============================================
-- Run this script in Supabase SQL Editor
-- IMPORTANT: Uses CONCURRENTLY to avoid locking tables
-- =============================================

-- Enable trigram extension for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- USERS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
  ON users(email);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
  ON users(role);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_organizationId 
  ON users("organizationId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_isActive 
  ON users("isActive");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_createdAt 
  ON users("createdAt" DESC);
  
-- Composite index for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active 
  ON users(role, "isActive");

-- Trigram index for fuzzy email search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm 
  ON users USING gin(email gin_trgm_ops);

-- =============================================
-- RECRUITERS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_verificationstatus 
  ON recruiters(verificationstatus);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_isactive 
  ON recruiters(isactive);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_state 
  ON recruiters(state);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_email 
  ON recruiters(email);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_createdat 
  ON recruiters(createdat DESC);

-- Composite indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_status_active 
  ON recruiters(verificationstatus, isactive);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_state_status 
  ON recruiters(state, verificationstatus);

-- Trigram index for fuzzy name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recruiters_name_trgm 
  ON recruiters USING gin(name gin_trgm_ops);

-- =============================================
-- UNIVERSITIES TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_state 
  ON universities(state);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_verificationstatus 
  ON universities(verificationstatus);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_isactive 
  ON universities(isactive);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_createdat 
  ON universities(createdat DESC);

-- Trigram index for fuzzy name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_name_trgm 
  ON universities USING gin(name gin_trgm_ops);

-- =============================================
-- SKILL_PASSPORTS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_studentId 
  ON skill_passports("studentId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_status 
  ON skill_passports(status);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_nsqfLevel 
  ON skill_passports("nsqfLevel");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_createdAt 
  ON skill_passports("createdAt" DESC);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_updatedAt 
  ON skill_passports("updatedAt" DESC);

-- Composite indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_status_nsqf 
  ON skill_passports(status, "nsqfLevel");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passports_student_status 
  ON skill_passports("studentId", status);

-- =============================================
-- STUDENTS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_userId 
  ON students("userId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_universityId 
  ON students("universityId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_organizationId 
  ON students("organizationId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_email 
  ON students(email);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_createdAt 
  ON students("createdAt" DESC);

-- Trigram index for fuzzy email search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_email_trgm 
  ON students USING gin(email gin_trgm_ops);

-- =============================================
-- AUDIT_LOGS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_actorId 
  ON audit_logs("actorId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action 
  ON audit_logs(action);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_createdAt 
  ON audit_logs("createdAt" DESC);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_target 
  ON audit_logs(target);

-- Composite indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_actor_action 
  ON audit_logs("actorId", action);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action_date 
  ON audit_logs(action, "createdAt" DESC);

-- Trigram indexes for fuzzy search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_target_trgm 
  ON audit_logs USING gin(target gin_trgm_ops);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_ip_trgm 
  ON audit_logs USING gin(ip gin_trgm_ops);

-- =============================================
-- VERIFICATIONS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verifications_performedBy 
  ON verifications("performedBy");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verifications_targetId 
  ON verifications("targetId");
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verifications_createdAt 
  ON verifications("createdAt" DESC);

-- Composite index for common query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verifications_target_date 
  ON verifications("targetId", "createdAt" DESC);

-- =============================================
-- METRICS_SNAPSHOTS TABLE INDEXES
-- =============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_snapshotDate 
  ON metrics_snapshots("snapshotDate" DESC);

-- =============================================
-- VERIFICATION QUERIES
-- Run these to verify index creation
-- =============================================

-- View all indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =============================================
-- PERFORMANCE TESTING QUERIES
-- Test before and after applying indexes
-- =============================================

-- Test 1: Recruiters with filters (most common query)
EXPLAIN ANALYZE
SELECT * FROM recruiters
WHERE verificationstatus = 'pending'
  AND isactive = true
  AND state = 'Tamil Nadu'
LIMIT 20;

-- Test 2: Passports with status filter
EXPLAIN ANALYZE
SELECT * FROM skill_passports
WHERE status = 'verified'
  AND "nsqfLevel" = 4
ORDER BY "createdAt" DESC
LIMIT 20;

-- Test 3: Users with role filter
EXPLAIN ANALYZE
SELECT * FROM users
WHERE role = 'university_admin'
  AND "isActive" = true
ORDER BY "createdAt" DESC
LIMIT 20;

-- Test 4: Audit logs with filters
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE action = 'approve_recruiter'
  AND "createdAt" >= NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC
LIMIT 50;

-- Test 5: Students by university (for passport exports)
EXPLAIN ANALYZE
SELECT id FROM students
WHERE "universityId" = '5ca5589e-b49d-4027-baf7-7e2a88ae612a'
LIMIT 100;

-- =============================================
-- INDEX USAGE STATISTICS
-- Monitor which indexes are being used
-- =============================================

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan > 0
ORDER BY idx_scan DESC;

-- Find unused indexes (after a week of monitoring)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelid IS NOT NULL
ORDER BY pg_relation_size(indexrelid) DESC;

-- =============================================
-- NOTES
-- =============================================
-- 1. CONCURRENTLY option allows creating indexes without locking the table
-- 2. Trigram indexes (gin_trgm_ops) enable fuzzy/partial text search
-- 3. Composite indexes speed up queries with multiple filters
-- 4. DESC indexes optimize ORDER BY ... DESC queries
-- 5. Monitor index usage after 1 week and remove unused ones
-- 6. Expected improvement: 15-30x faster for filtered queries
-- =============================================
