-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  description TEXT NOT NULL,
  university TEXT NOT NULL,
  duration TEXT NOT NULL,
  credits NUMERIC NOT NULL,
  category TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  target_outcomes TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  state TEXT, -- Added to support state filtering if needed, though not in form
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Approval workflow
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_courses_approval_status ON courses(approval_status);
CREATE INDEX IF NOT EXISTS idx_courses_university ON courses(university);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow read access to authenticated users (or public if needed)
CREATE POLICY "Allow read access to authenticated users"
  ON courses FOR SELECT
  TO authenticated
  USING (true);

-- Allow insert access to authenticated users (admins/recruiters etc)
CREATE POLICY "Allow insert access to authenticated users"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow update access to admins (simplified for now, can be more granular)
CREATE POLICY "Allow update access to authenticated users"
  ON courses FOR UPDATE
  TO authenticated
  USING (true);
