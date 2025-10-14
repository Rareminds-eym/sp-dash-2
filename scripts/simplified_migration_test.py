"""
Simplified Recruiter Migration:
1. Build email->auth_user_id mapping from existing auth users
2. For recruiters without auth users, create them
3. Create users table records
4. Create recruiters table records  
5. Delete from organizations table
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv
import uuid
from datetime import datetime

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

DEFAULT_PASSWORD = "Recruiter@2025"

print("🚀 Starting Simplified Recruiter Migration...")
print("="*80)

# Step 1: Build auth user email mapping
print("\n📋 Step 1: Building auth user mapping...")
auth_user_map = {}

try:
    response = supabase.auth.admin.list_users()
    users = response
    if hasattr(users, 'users'):
        users = users.users
    
    for user in users:
        if hasattr(user, 'user_metadata'):
            metadata = user.user_metadata
        else:
            metadata = user.get('user_metadata', {})
        
        if metadata.get('role') == 'recruiter':
            if hasattr(user, 'email'):
                email = user.email.lower()
                user_id = user.id
            else:
                email = user.get('email', '').lower()
                user_id = user.get('id')
            
            if email:
                auth_user_map[email] = user_id
    
    print(f"✅ Found {len(auth_user_map)} existing recruiter auth users")
except Exception as e:
    print(f"⚠️  Could not fetch auth users: {str(e)}")

# Step 2: Fetch recruiters from organizations
print("\n📋 Step 2: Fetching recruiters from organizations...")
try:
    response = supabase.table('organizations').select('*').eq('type', 'recruiter').execute()
    recruiters = response.data
    print(f"✅ Found {len(recruiters)} recruiter records")
except Exception as e:
    print(f"❌ Error: {str(e)}")
    sys.exit(1)

# Step 3: Process first few recruiters as test
print("\n📋 Step 3: Processing recruiters (TEST MODE - first 3)...")
print("="*80)

stats = {
    'processed': 0,
    'auth_created': 0,
    'users_created': 0,
    'recruiters_created': 0,
    'orgs_deleted': 0,
    'skipped': 0,
    'errors': []
}

for org in recruiters[:3]:  # Test with first 3
    company_name = org.get('name', 'Unknown')
    email = org.get('email', '').lower().strip()
    org_id = org.get('id')
    
    print(f"\n{stats['processed']+1}. {company_name}")
    print(f"   Email: {email}")
    
    if not email:
        print(f"   ⚠️  No email, skipping")
        stats['skipped'] += 1
        stats['processed'] += 1
        continue
    
    # Get or create auth user
    user_id = auth_user_map.get(email)
    
    if not user_id:
        print(f"   Creating new auth user...")
        try:
            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": DEFAULT_PASSWORD,
                "email_confirm": True,
                "user_metadata": {
                    "name": company_name,
                    "role": "recruiter"
                }
            })
            user_id = auth_response.user.id
            auth_user_map[email] = user_id
            print(f"   ✅ Auth user created: {user_id}")
            stats['auth_created'] += 1
        except Exception as e:
            print(f"   ❌ Auth creation failed: {str(e)[:100]}")
            stats['errors'].append(f"{company_name}: Auth failed")
            stats['processed'] += 1
            continue
    else:
        print(f"   ✅ Using existing auth ID: {user_id}")
    
    # Create users table record
    try:
        user_record = {
            'id': user_id,
            'email': email,
            'role': 'recruiter',
            'isActive': True,
            'metadata': {'name': company_name},
            'createdAt': datetime.now().isoformat()
        }
        supabase.table('users').insert(user_record).execute()
        print(f"   ✅ Users table record created")
        stats['users_created'] += 1
    except Exception as e:
        error_str = str(e)
        if 'duplicate' in error_str.lower():
            print(f"   ⚠️  Users record already exists")
        else:
            print(f"   ❌ Users table failed: {error_str[:100]}")
    
    # Create recruiters table record - need to discover correct fields
    try:
        recruiter_record = {
            'id': user_id,
            'companyName': company_name,
            'contactEmail': email,
            'contactPhone': org.get('phone'),
            'website': org.get('website'),
            'location': org.get('state'),
            'isActive': org.get('isActive', True),
            'verificationStatus': org.get('verificationStatus', 'approved'),
            'createdAt': org.get('createdAt', datetime.now().isoformat())
        }
        supabase.table('recruiters').insert(recruiter_record).execute()
        print(f"   ✅ Recruiters table record created")
        stats['recruiters_created'] += 1
        
        # Delete from organizations
        try:
            supabase.table('organizations').delete().eq('id', org_id).execute()
            print(f"   🗑️  Deleted from organizations")
            stats['orgs_deleted'] += 1
        except Exception as e:
            print(f"   ⚠️  Could not delete from orgs: {str(e)[:50]}")
            
    except Exception as e:
        error_str = str(e)
        print(f"   ❌ Recruiters table failed: {error_str[:200]}")
        stats['errors'].append(f"{company_name}: Recruiters table - {error_str[:100]}")
    
    stats['processed'] += 1

# Summary
print("\n" + "="*80)
print("📊 MIGRATION SUMMARY (TEST)")
print("="*80)
print(f"   Processed: {stats['processed']}")
print(f"   Auth users created: {stats['auth_created']}")
print(f"   Users table created: {stats['users_created']}")
print(f"   Recruiters created: {stats['recruiters_created']}")
print(f"   Organizations deleted: {stats['orgs_deleted']}")
print(f"   Skipped (no email): {stats['skipped']}")
print(f"   Errors: {len(stats['errors'])}")

if stats['errors']:
    print(f"\n❌ Errors:")
    for error in stats['errors']:
        print(f"   • {error}")

print("\n⚠️  This was a TEST run with 3 recruiters.")
print("   Review the output and schema errors before running full migration.")
