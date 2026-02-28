-- Alter existing courses table to support approval workflow and new fields

-- Add missing columns
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS university TEXT,
ADD COLUMN IF NOT EXISTS credits NUMERIC,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Add index for approval_status if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_courses_approval_status ON public.courses(approval_status);

-- Update existing rows to have a default approval status if needed (optional)
-- UPDATE public.courses SET approval_status = 'approved' WHERE status = 'Active';
-- UPDATE public.courses SET approval_status = 'pending' WHERE status = 'Draft';
