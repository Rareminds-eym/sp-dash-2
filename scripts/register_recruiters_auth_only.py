"""
Create Supabase Auth accounts for recruiters (without users table entries)
This script registers recruiter emails in Supabase Auth only
"""

import os
from supabase import create_client
from datetime import datetime
from dotenv import load_dotenv

load_dotenv('/app/.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
DEFAULT_PASSWORD = "Recruiter@2025"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("🔧 Recruiter Supabase Auth Registration")
print("="*80)

# Step 1: Get all recruiter organizations
print("\n📊 Fetching recruiter organizations...")
orgs_response = supabase.table('organizations').select('id, email, name').eq('type', 'recruiter').execute()
recruiter_orgs = orgs_response.data

# Clean and map emails
org_by_email = {}
for org in recruiter_orgs:
    if not org.get('email'):
        continue
    org_email = org['email'].lower().strip()
    
    # Clean email (take first if multiple)
    if '/' in org_email:
        org_email = org_email.split('/')[0].strip()
    if ',' in org_email:
        org_email = org_email.split(',')[0].strip()
    
    # Validate email
    if '@' in org_email and '.' in org_email:
        org_by_email[org_email] = org

print(f"✅ Found {len(recruiter_orgs)} recruiter organizations")
print(f"✅ Found {len(org_by_email)} valid emails")

# Step 2: Get existing auth users
print("\n📊 Fetching existing Supabase Auth users...")
try:
    auth_users = supabase.auth.admin.list_users(page=1, per_page=1000)
    existing_auth_emails = set([u.email.lower() for u in auth_users])
    recruiter_auth_emails = set([
        u.email.lower() for u in auth_users 
        if u.user_metadata and u.user_metadata.get('role') == 'recruiter'
    ])
    print(f"✅ Found {len(recruiter_auth_emails)} existing recruiter auth users")
except Exception as e:
    print(f"❌ Error fetching auth users: {str(e)}")
    existing_auth_emails = set()
    recruiter_auth_emails = set()

# Step 3: Create missing auth accounts
print("\n🔄 Creating missing Supabase Auth accounts...")
to_create = []
for email, org in org_by_email.items():
    if email not in existing_auth_emails:
        to_create.append((email, org['name']))

print(f"📊 Need to create {len(to_create)} new auth accounts")

created_count = 0
failed_count = 0
errors = []

for email, company_name in to_create:
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": DEFAULT_PASSWORD,
            "email_confirm": True,
            "user_metadata": {
                "name": company_name,
                "role": "recruiter",
                "imported_from": "excel"
            }
        })
        created_count += 1
        print(f"  ✅ Created auth user: {email} ({company_name})")
    except Exception as e:
        error_msg = str(e)
        if "already been registered" in error_msg or "User already registered" in error_msg:
            print(f"  ℹ️  Already exists: {email}")
        else:
            failed_count += 1
            errors.append(f"{email}: {error_msg}")
            print(f"  ❌ Failed: {email} - {error_msg}")

# Step 4: Final verification
print("\n" + "="*80)
print("📊 FINAL STATUS")
print("="*80)

# Recount auth users
auth_users_final = supabase.auth.admin.list_users(page=1, per_page=1000)
recruiter_auth_final = [
    u for u in auth_users_final 
    if u.user_metadata and u.user_metadata.get('role') == 'recruiter'
]

print(f"\n✅ Recruiter organizations in database: {len(recruiter_orgs)}")
print(f"✅ Recruiter auth accounts: {len(recruiter_auth_final)}")
print(f"✅ New auth accounts created: {created_count}")
if failed_count > 0:
    print(f"❌ Failed to create: {failed_count}")
    print(f"\nErrors:")
    for error in errors:
        print(f"  • {error}")

print(f"\n🔑 Login Credentials:")
print(f"  • Email: <recruiter email from database>")
print(f"  • Password: {DEFAULT_PASSWORD}")

print("\n✅ Supabase Auth registration completed!")
print("📝 Note: Recruiters are NOT added to users table (as per design)")
