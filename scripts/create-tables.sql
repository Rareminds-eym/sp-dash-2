-- Rareminds Super Admin Dashboard - Database Schema
-- Run this SQL in Supabase SQL Editor

-- Drop existing tables if they exist
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS metrics_snapshots CASCADE;
DROP TABLE IF EXISTS skill_passports CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager')),
  "organizationId" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('university', 'college', 'institute', 'recruiter')),
  state TEXT,
  district TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create students table
CREATE TABLE students (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "universityId" TEXT REFERENCES organizations(id),
  profile JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create skill_passports table
CREATE TABLE skill_passports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'suspended')),
  "nsqfLevel" INTEGER,
  skills JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create verifications table
CREATE TABLE verifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "targetTable" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  action TEXT NOT NULL,
  "performedBy" TEXT REFERENCES users(id),
  note TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "actorId" TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  ip TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metrics_snapshots table
CREATE TABLE metrics_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "activeUniversities" INTEGER DEFAULT 0,
  "registeredStudents" INTEGER DEFAULT 0,
  "verifiedPassports" INTEGER DEFAULT 0,
  "employabilityIndex" DECIMAL(5,2) DEFAULT 0,
  "activeRecruiters" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_org ON users("organizationId");
CREATE INDEX idx_orgs_type ON organizations(type);
CREATE INDEX idx_orgs_state ON organizations(state);
CREATE INDEX idx_students_user ON students("userId");
CREATE INDEX idx_students_university ON students("universityId");
CREATE INDEX idx_passports_student ON skill_passports("studentId");
CREATE INDEX idx_passports_status ON skill_passports(status);
CREATE INDEX idx_verifications_target ON verifications("targetTable", "targetId");
CREATE INDEX idx_audit_actor ON audit_logs("actorId");
CREATE INDEX idx_audit_created ON audit_logs("createdAt" DESC);
CREATE INDEX idx_metrics_date ON metrics_snapshots("snapshotDate" DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now - will be refined based on role)
CREATE POLICY "Allow public read" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON users FOR DELETE USING (true);

CREATE POLICY "Allow public read" ON organizations FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON organizations FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON students FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON students FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON skill_passports FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON skill_passports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON skill_passports FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON verifications FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON verifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read" ON metrics_snapshots FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON metrics_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON metrics_snapshots FOR UPDATE USING (true);

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-update
DROP TRIGGER IF EXISTS update_users_timestamp ON users;
CREATE TRIGGER update_users_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_passports_timestamp ON skill_passports;
CREATE TRIGGER update_passports_timestamp
  BEFORE UPDATE ON skill_passports
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();