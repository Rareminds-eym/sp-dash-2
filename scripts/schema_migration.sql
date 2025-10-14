-- Add recruiter-specific columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS "companyType" text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_organizations_city ON organizations(city);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_companyType ON organizations("companyType");
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);

-- Add comment to document the columns
COMMENT ON COLUMN organizations.phone IS 'Contact phone number';
COMMENT ON COLUMN organizations.website IS 'Company website URL';
COMMENT ON COLUMN organizations.address IS 'Physical address';
COMMENT ON COLUMN organizations.city IS 'City location';
COMMENT ON COLUMN organizations.email IS 'Contact email address';
COMMENT ON COLUMN organizations."companyType" IS 'Type of company/industry';
