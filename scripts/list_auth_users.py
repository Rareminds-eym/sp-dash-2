"""
List Auth Users to get their IDs for matching with emails
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("🔍 Fetching auth users with role='recruiter'...")
print("="*80)

try:
    # List all auth users (limit to first page)
    response = supabase.auth.admin.list_users()
    
    users = response
    if hasattr(users, 'users'):
        users = users.users
    elif isinstance(users, list):
        pass
    else:
        users = []
    
    recruiter_auth_users = []
    for user in users[:20]:  # Check first 20
        if hasattr(user, 'user_metadata'):
            metadata = user.user_metadata
        else:
            metadata = user.get('user_metadata', {})
        
        role = metadata.get('role', '')
        if role == 'recruiter':
            if hasattr(user, 'email'):
                email = user.email
                user_id = user.id
            else:
                email = user.get('email')
                user_id = user.get('id')
            
            recruiter_auth_users.append({
                'id': user_id,
                'email': email,
                'role': role
            })
            print(f"✅ Found recruiter: {email} (ID: {user_id})")
    
    print(f"\n📊 Total recruiter auth users found: {len(recruiter_auth_users)}")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
