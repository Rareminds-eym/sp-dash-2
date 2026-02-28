-- Add missing columns to the existing `courses` table
-- (Only add columns that are not already present.)

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS university TEXT,
  ADD COLUMN IF NOT EXISTS credits INTEGER,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS target_outcomes JSONB DEFAULT '[]'::jsonb;

-- Optional indexes for the new columns (helps filtering/search)
CREATE INDEX IF NOT EXISTS idx_courses_university ON public.courses (university);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses (category);
