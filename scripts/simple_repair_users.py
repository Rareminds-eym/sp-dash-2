"""
Simple Repair Script: Create user records for existing Supabase Auth recruiters
"""

import os
from supabase import create_client
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("🔧 Recruiter User Repair Script")
print("="*80)

# Step 1: Get all auth users with role='recruiter' in metadata
print("\n📊 Fetching recruiter auth users...")
auth_users = supabase.auth.admin.list_users(page=1, per_page=1000)
recruiter_auth_users = [
    u for u in auth_users 
    if u.user_metadata and u.user_metadata.get('role') == 'recruiter'
]
print(f"✅ Found {len(recruiter_auth_users)} recruiter auth users")

# Step 2: Get all recruiter organizations
print("\n📊 Fetching recruiter organizations...")
orgs_response = supabase.table('organizations').select('id, email, name').eq('type', 'recruiter').execute()
recruiter_orgs = orgs_response.data

# Create email to org mapping
org_by_email = {}
for org in recruiter_orgs:
    org_email = org['email'].lower().strip()
    # Clean email (take first if multiple)
    if '/' in org_email:
        org_email = org_email.split('/')[0].strip()
    if ',' in org_email:
        org_email = org_email.split(',')[0].strip()
    org_by_email[org_email] = org

print(f"✅ Found {len(recruiter_orgs)} recruiter organizations")

# Step 3: Create user records for each auth user
print("\n🔄 Creating user records...")
created_count = 0
skipped_count = 0
failed_count = 0

for auth_user in recruiter_auth_users:
    email = auth_user.email.lower()
    
    # Find matching organization
    org = org_by_email.get(email)
    
    if not org:
        print(f"  ⚠️  No organization found for: {email}")
        skipped_count += 1
        continue
    
    try:
        # Create user record
        user_record = {
            'id': auth_user.id,
            'email': email,
            'role': 'recruiter',
            'organizationId': org['id'],
            'isActive': True,
            'metadata': {
                'name': auth_user.user_metadata.get('name', org['name']),
                'imported_from': 'excel',
                'repair_date': datetime.now().isoformat()
            },
            'createdAt': datetime.now().isoformat()
        }
        
        response = supabase.table('users').insert(user_record).execute()
        created_count += 1
        print(f"  ✅ Created user record: {email} -> {org['name']}")
        
    except Exception as e:
        error_msg = str(e)
        if "duplicate key value violates unique constraint" in error_msg or "already exists" in error_msg:
            print(f"  ℹ️  User already exists: {email}")
            skipped_count += 1
        else:
            print(f"  ❌ Failed: {email} - {error_msg}")
            failed_count += 1

# Step 4: Verify and report
print("\n" + "="*80)
print("📊 REPAIR SUMMARY")
print("="*80)
print(f"✅ Successfully created: {created_count} user records")
print(f"ℹ️  Skipped (no org or already exists): {skipped_count}")
print(f"❌ Failed: {failed_count}")

# Verify final count
response = supabase.table('users').select('id').eq('role', 'recruiter').execute()
total_recruiter_users = len(response.data)
print(f"\n📊 Total recruiter users in database: {total_recruiter_users}")

print("\n✅ Repair completed!")
