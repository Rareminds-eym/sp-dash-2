-- Rareminds Reports & Analytics - Recruiter Tracking Extension
-- Additional tables for comprehensive recruiter analytics

-- Create recruiters table
CREATE TABLE IF NOT EXISTS recruiters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT REFERENCES organizations(id),
  "userId" TEXT REFERENCES users(id),
  "companyName" TEXT NOT NULL,
  "industry" TEXT,
  "location" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recruiter_activities table for tracking searches, views, etc.
CREATE TABLE IF NOT EXISTS recruiter_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recruiterId" TEXT REFERENCES recruiters(id) ON DELETE CASCADE,
  "activityType" TEXT NOT NULL CHECK ("activityType" IN ('search', 'profile_view', 'contact', 'shortlist', 'hire_intent')),
  "targetStudentId" TEXT REFERENCES students(id),
  "searchCriteria" JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create placements table for tracking hiring pipeline
CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT REFERENCES students(id) ON DELETE CASCADE,
  "recruiterId" TEXT REFERENCES recruiters(id) ON DELETE CASCADE,
  "jobTitle" TEXT NOT NULL,
  "salaryOffered" DECIMAL(10,2),
  "placementStatus" TEXT NOT NULL CHECK ("placementStatus" IN ('applied', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'retained_6m', 'retained_1y')),
  "appliedDate" TIMESTAMP WITH TIME ZONE,
  "hiredDate" TIMESTAMP WITH TIME ZONE,
  "retentionDate" TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create skill_trends table for AI insights
CREATE TABLE IF NOT EXISTS skill_trends (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "skillName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "demandScore" INTEGER DEFAULT 0,
  "trendDirection" TEXT CHECK ("trendDirection" IN ('rising', 'stable', 'declining')),
  "weeklyGrowth" DECIMAL(5,2) DEFAULT 0,
  "monthlyGrowth" DECIMAL(5,2) DEFAULT 0,
  "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create university_performance table for rankings
CREATE TABLE IF NOT EXISTS university_performance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "universityId" TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  "enrollmentCount" INTEGER DEFAULT 0,
  "completionRate" DECIMAL(5,2) DEFAULT 0,
  "verificationRate" DECIMAL(5,2) DEFAULT 0,
  "placementRate" DECIMAL(5,2) DEFAULT 0,
  "avgSalary" DECIMAL(10,2) DEFAULT 0,
  "performanceScore" DECIMAL(5,2) DEFAULT 0,
  "rankPosition" INTEGER,
  "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_recruiters_org ON recruiters("organizationId");
CREATE INDEX IF NOT EXISTS idx_recruiters_user ON recruiters("userId");
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_recruiter ON recruiter_activities("recruiterId");
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_student ON recruiter_activities("targetStudentId");
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_type ON recruiter_activities("activityType");
CREATE INDEX IF NOT EXISTS idx_recruiter_activities_created ON recruiter_activities("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_placements_student ON placements("studentId");
CREATE INDEX IF NOT EXISTS idx_placements_recruiter ON placements("recruiterId");
CREATE INDEX IF NOT EXISTS idx_placements_status ON placements("placementStatus");
CREATE INDEX IF NOT EXISTS idx_placements_hired_date ON placements("hiredDate" DESC);
CREATE INDEX IF NOT EXISTS idx_skill_trends_snapshot ON skill_trends("snapshotDate" DESC);
CREATE INDEX IF NOT EXISTS idx_skill_trends_category ON skill_trends("category");
CREATE INDEX IF NOT EXISTS idx_university_performance_snapshot ON university_performance("snapshotDate" DESC);
CREATE INDEX IF NOT EXISTS idx_university_performance_rank ON university_performance("rankPosition");

-- Enable Row Level Security
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_performance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now)
CREATE POLICY "Allow public read" ON recruiters FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON recruiters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON recruiters FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON recruiter_activities FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON recruiter_activities FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read" ON placements FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON placements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON placements FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON skill_trends FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON skill_trends FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON skill_trends FOR UPDATE USING (true);

CREATE POLICY "Allow public read" ON university_performance FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON university_performance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON university_performance FOR UPDATE USING (true);

-- Add auto-update timestamp triggers
DROP TRIGGER IF EXISTS update_recruiters_timestamp ON recruiters;
CREATE TRIGGER update_recruiters_timestamp
  BEFORE UPDATE ON recruiters
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_placements_timestamp ON placements;
CREATE TRIGGER update_placements_timestamp
  BEFORE UPDATE ON placements
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();