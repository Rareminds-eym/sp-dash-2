"""
Repair Script: Create missing user records for recruiters
This script links existing Supabase Auth users to their organizations
"""

import os
from supabase import create_client, Client
from datetime import datetime
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("🔧 Starting Recruiter User Repair Script...")
print("="*80)

# Step 1: Get all recruiter organizations
print("\n📊 Fetching all recruiter organizations...")
response = supabase.table('organizations').select('*').eq('type', 'recruiter').execute()
recruiter_orgs = response.data
print(f"✅ Found {len(recruiter_orgs)} recruiter organizations")

# Step 2: Get existing users
print("\n📊 Fetching existing users...")
response = supabase.table('users').select('email, organizationId').execute()
existing_user_emails = set([user['email'].lower() for user in response.data])
print(f"✅ Found {len(existing_user_emails)} existing users in users table")

# Step 3: Get all Supabase Auth users
print("\n📊 Fetching Supabase Auth users...")
try:
    # Note: Supabase Python SDK doesn't have a direct way to list all auth users
    # We'll need to check each organization's email
    auth_users_to_create = []
    
    for org in recruiter_orgs:
        org_email = org['email'].lower().strip()
        
        # Clean email (take first if multiple)
        if '/' in org_email:
            org_email = org_email.split('/')[0].strip()
        if ',' in org_email:
            org_email = org_email.split(',')[0].strip()
        
        # Skip if not a valid email
        if '@' not in org_email or '.' not in org_email:
            print(f"  ⚠️  Skipping invalid email: {org_email} for {org['name']}")
            continue
        
        # Check if user record exists in users table
        if org_email not in existing_user_emails:
            # Try to get the auth user
            try:
                # Use admin API to get user by email
                auth_response = supabase.auth.admin.list_users()
                auth_users = [u for u in auth_response if u.email.lower() == org_email]
                
                if auth_users:
                    auth_user = auth_users[0]
                    auth_users_to_create.append({
                        'auth_user_id': auth_user.id,
                        'email': org_email,
                        'org_id': org['id'],
                        'org_name': org['name']
                    })
                    print(f"  ✅ Found auth user for: {org_email} ({org['name']})")
                else:
                    print(f"  ⚠️  No auth user found for: {org_email} ({org['name']})")
            except Exception as e:
                print(f"  ⚠️  Error checking auth user {org_email}: {str(e)}")
    
    print(f"\n📊 Found {len(auth_users_to_create)} auth users without user records")
    
except Exception as e:
    print(f"❌ Error fetching auth users: {str(e)}")
    auth_users_to_create = []

# Step 4: Create missing user records
print("\n🔄 Creating missing user records...")
created_count = 0
failed_count = 0
errors = []

for user_data in auth_users_to_create:
    try:
        user_record = {
            'id': user_data['auth_user_id'],
            'email': user_data['email'],
            'role': 'recruiter',
            'organizationId': user_data['org_id'],
            'isActive': True,
            'metadata': {
                'name': user_data['org_name'],
                'imported_from': 'excel',
                'repair_date': datetime.now().isoformat()
            },
            'createdAt': datetime.now().isoformat()
        }
        
        response = supabase.table('users').insert(user_record).execute()
        created_count += 1
        print(f"  ✅ Created user record for: {user_data['email']} ({user_data['org_name']})")
        
    except Exception as e:
        failed_count += 1
        error_msg = f"{user_data['email']} ({user_data['org_name']}): {str(e)}"
        errors.append(error_msg)
        print(f"  ❌ Failed: {error_msg}")

# Step 5: Generate report
print("\n" + "="*80)
print("📊 REPAIR SUMMARY REPORT")
print("="*80)
print(f"\n✅ Successfully created {created_count} user records")
print(f"❌ Failed to create {failed_count} user records")

if errors:
    print(f"\n❌ Errors:")
    for error in errors:
        print(f"  • {error}")

# Verify final counts
response = supabase.table('users').select('email').eq('role', 'recruiter').execute()
total_recruiter_users = len(response.data)
print(f"\n📊 Total recruiter users in database now: {total_recruiter_users}")

print("\n" + "="*80)
print("✅ Repair script completed!")
print("="*80)
