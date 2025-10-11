-- Add verification and active status fields to organizations table
-- This enables recruiter verification functionality

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT DEFAULT 'pending' CHECK ("verificationStatus" IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT REFERENCES users(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orgs_verification ON organizations("verificationStatus");
CREATE INDEX IF NOT EXISTS idx_orgs_active ON organizations("isActive");

-- Update existing recruiter organizations to be approved by default
UPDATE organizations
SET "verificationStatus" = 'approved',
    "isActive" = true
WHERE type = 'recruiter';
