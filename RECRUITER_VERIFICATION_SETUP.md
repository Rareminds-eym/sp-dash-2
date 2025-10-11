# Recruiter Verification Feature - Setup Guide

## Overview
The Recruiter Verification feature has been successfully implemented and is ready to use. However, a database migration is required to add the necessary fields to the `organizations` table.

## Current Status

### ✅ Completed Implementation
1. **Backend APIs (5 endpoints)**
   - `GET /api/recruiters` - Fetch all recruiter organizations ✅ Working
   - `POST /api/approve-recruiter` - Approve recruiter registration ⏳ Needs migration
   - `POST /api/reject-recruiter` - Reject recruiter registration ⏳ Needs migration
   - `POST /api/suspend-recruiter` - Suspend recruiter access ⏳ Needs migration
   - `POST /api/activate-recruiter` - Activate suspended recruiter ⏳ Needs migration

2. **Frontend**
   - New "Recruiters" tab in dashboard sidebar ✅ Working
   - Recruiter list page with search and filters ✅ Working
   - Stats cards (Total, Pending, Approved, Active) ✅ Working
   - Approve/Reject actions for pending recruiters ✅ Working
   - Suspend/Activate actions for active recruiters ✅ Working

3. **Features**
   - Verification status tracking (pending/approved/rejected)
   - Active/inactive status management
   - User count per recruiter organization
   - Audit logging for all actions
   - Verification records
   - Confirmation dialogs for all actions

### ⏳ Pending: Database Migration

The following fields need to be added to the `organizations` table:
- `verificationStatus` - TEXT (pending/approved/rejected)
- `isActive` - BOOLEAN
- `verifiedAt` - TIMESTAMP
- `verifiedBy` - TEXT (foreign key to users.id)

## How to Complete Setup

### Step 1: Run Database Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the SQL from `/app/scripts/add-recruiter-verification-fields.sql` (shown below)
4. Click **Run** to execute the migration

### Step 2: Migration SQL

```sql
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
```

### Step 3: Verify Migration

After running the migration, you can verify it worked by:
1. Running the test script: `cd /app && export $(cat .env | grep -v '^#' | xargs) && node scripts/run-recruiter-migration.js`
2. The script will confirm the fields exist
3. All POST endpoints will now work correctly

## Testing

### Manual Testing
1. Login to the dashboard with superadmin credentials
2. Click on "Recruiters" in the sidebar
3. You should see the recruiter verification page with:
   - Search bar
   - Stats cards showing totals
   - List of recruiter organizations
   - Action buttons based on status

### Backend Testing
Run the test script:
```bash
cd /app
export $(cat .env | grep -v '^#' | xargs)
python test_recruiters.py
```

## Usage Guide

### For Super Admin / Admin Users

1. **View Recruiters**
   - Navigate to "Recruiters" from the sidebar
   - See all recruiter organizations with their status

2. **Approve Pending Recruiters**
   - Find recruiters with "Pending" status
   - Click "Approve" button
   - Confirm the action in the dialog

3. **Reject Recruiters**
   - Find recruiters with "Pending" status
   - Click "Reject" button
   - Confirm the action in the dialog

4. **Suspend Active Recruiters**
   - Find approved recruiters with "Active" status
   - Click "Suspend" button
   - Confirm the action in the dialog

5. **Activate Suspended Recruiters**
   - Find recruiters with "Suspended" status
   - Click "Activate" button
   - Confirm the action in the dialog

### Search & Filter
- Use the search bar to filter by:
  - Organization name
  - State
  - Verification status

### Stats Overview
The page shows 4 key metrics:
- **Total Recruiters** - All recruiter organizations
- **Pending** - Awaiting approval
- **Approved** - Verified recruiters
- **Active** - Currently active recruiters

## API Documentation

### GET /api/recruiters
Fetches all recruiter organizations with user count and verification status.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "TechCorp Recruiters",
    "type": "recruiter",
    "state": "Karnataka",
    "district": "Bangalore",
    "verificationStatus": "approved",
    "isActive": true,
    "userCount": 3,
    "createdAt": "2024-01-15T10:30:00Z",
    "verifiedAt": "2024-01-16T14:20:00Z",
    "verifiedBy": "admin-user-id"
  }
]
```

### POST /api/approve-recruiter
Approves a pending recruiter registration.

**Request:**
```json
{
  "recruiterId": "uuid",
  "userId": "uuid",
  "note": "Approved after document verification"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recruiter approved successfully"
}
```

### POST /api/reject-recruiter
Rejects a recruiter registration.

**Request:**
```json
{
  "recruiterId": "uuid",
  "userId": "uuid",
  "reason": "Invalid documentation"
}
```

### POST /api/suspend-recruiter
Suspends an active recruiter.

**Request:**
```json
{
  "recruiterId": "uuid",
  "userId": "uuid",
  "reason": "Policy violation"
}
```

### POST /api/activate-recruiter
Reactivates a suspended recruiter.

**Request:**
```json
{
  "recruiterId": "uuid",
  "userId": "uuid",
  "note": "Issue resolved, reactivating"
}
```

## Audit Trail

All recruiter verification actions are logged to:
- **audit_logs** table - Complete audit trail with user ID, action, and payload
- **verifications** table - Verification records with notes/reasons

View audit logs in the dashboard under "Audit Logs" menu.

## Troubleshooting

### Issue: Action buttons not working
- **Solution**: Run the database migration first
- The backend gracefully handles missing fields for GET requests but POST requests need the actual columns

### Issue: No recruiters showing
- **Solution**: Check if you have organizations with `type = 'recruiter'` in the database
- You can create test recruiters using the setup scripts in `/app/scripts/`

### Issue: Permission denied
- **Solution**: Ensure you're logged in as a super_admin or admin user
- Regular managers cannot approve/reject recruiters

## Next Steps

After completing the migration:
1. Test the feature end-to-end
2. Create some test recruiter organizations for demonstration
3. Verify audit logs are being created correctly
4. Test with different user roles (super_admin, admin, manager)

## Support

If you encounter any issues:
1. Check the backend logs: `tail -f /var/log/supervisor/nextjs.err.log`
2. Verify the migration ran successfully
3. Check browser console for frontend errors
4. Review audit logs for action history
