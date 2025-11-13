-- Add rejected_by and rejected_at columns to recruiters table
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);
ALTER TABLE recruiters ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
