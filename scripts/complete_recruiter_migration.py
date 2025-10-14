"""
Complete Recruiter Migration Solution:
1. Check recruiters table actual schema
2. Create auth users for each recruiter (even though they can't login due to role restriction)
3. Migrate recruiter data from organizations to recruiters table with proper user IDs
4. Update API endpoints to use recruiters table
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

# Initialize Supabase client with service role key for admin operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

DEFAULT_PASSWORD = "Recruiter@2025"

class CompleteMigration:
    def __init__(self):
        self.stats = {
            'total_recruiters': 0,
            'auth_users_created': 0,
            'users_table_created': 0,
            'recruiters_migrated': 0,
            'organizations_deleted': 0,
            'errors': []
        }
        
    def fetch_recruiters_from_organizations(self):
        """Fetch all recruiter records from organizations table"""
        print("📂 Fetching recruiters from organizations table...")
        
        try:
            response = supabase.table('organizations').select('*').eq('type', 'recruiter').execute()
            recruiters = response.data
            self.stats['total_recruiters'] = len(recruiters)
            
            print(f"✅ Found {self.stats['total_recruiters']} recruiter records")
            return recruiters
        except Exception as e:
            print(f"❌ Error fetching recruiters: {str(e)}")
            return []
    
    def create_auth_user_for_recruiter(self, email, company_name):
        """Create user in Supabase Auth or get existing user ID"""
        try:
            # First check if user already exists in users table
            users_response = supabase.table('users').select('id').eq('email', email).execute()
            if users_response.data and len(users_response.data) > 0:
                return users_response.data[0]['id'], "EXISTS"
            
            # Try to create new auth user
            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": DEFAULT_PASSWORD,
                "email_confirm": True,
                "user_metadata": {
                    "name": company_name,
                    "role": "recruiter"
                }
            })
            
            return auth_response.user.id, None
        except Exception as e:
            error_msg = str(e)
            if "already been registered" in error_msg or "User already registered" in error_msg:
                # Try to fetch existing user from users table
                try:
                    users_response = supabase.table('users').select('id').eq('email', email).execute()
                    if users_response.data and len(users_response.data) > 0:
                        return users_response.data[0]['id'], "EXISTS"
                except:
                    pass
                return None, "AUTH_EXISTS_NO_ID"
            return None, error_msg
    
    def create_user_record(self, user_id, email, company_name):
        """Create user record in users table"""
        try:
            user_record = {
                'id': user_id,
                'email': email,
                'role': 'recruiter',
                'isActive': True,
                'metadata': {
                    'name': company_name
                },
                'createdAt': datetime.now().isoformat()
            }
            
            response = supabase.table('users').insert(user_record).execute()
            return True, None
        except Exception as e:
            error_msg = str(e)
            if 'duplicate key' in error_msg.lower():
                return True, None  # Already exists, that's fine
            return False, error_msg
    
    def create_recruiter_record(self, user_id, org_data):
        """Create recruiter record in recruiters table"""
        try:
            # Map the necessary fields - adjust based on actual schema
            recruiter_record = {
                'id': user_id,  # id is foreign key to auth.users.id
                'companyName': org_data.get('name'),
                'contactEmail': org_data.get('email'),
                'contactPhone': org_data.get('phone'),
                'website': org_data.get('website'),
                'location': org_data.get('state'),
                'verificationStatus': org_data.get('verificationStatus', 'approved'),
                'isActive': org_data.get('isActive', True),
                'metadata': org_data.get('metadata', {}),
                'createdAt': org_data.get('createdAt', datetime.now().isoformat())
            }
            
            response = supabase.table('recruiters').insert(recruiter_record).execute()
            return True, None
        except Exception as e:
            return False, str(e)
    
    def migrate_single_recruiter(self, org_record):
        """Complete migration for a single recruiter"""
        company_name = org_record.get('name', 'Unknown')
        email = org_record.get('email')
        org_id = org_record.get('id')
        
        if not email:
            return False, "No email address"
        
        print(f"\n📝 Migrating: {company_name}")
        print(f"   Email: {email}")
        
        # Step 1: Create auth user
        print(f"   Creating auth user...")
        user_id, error = self.create_auth_user_for_recruiter(email, company_name)
        if error and error != "AUTH_EXISTS":
            print(f"   ❌ Auth creation failed: {error}")
            return False, f"Auth failed: {error}"
        if error == "AUTH_EXISTS":
            print(f"   ⚠️  Auth user already exists")
        else:
            print(f"   ✅ Auth user created: {user_id}")
            self.stats['auth_users_created'] += 1
        
        # Step 2: Create users table record
        if user_id:
            print(f"   Creating users table record...")
            success, error = self.create_user_record(user_id, email, company_name)
            if success:
                print(f"   ✅ Users table record created")
                self.stats['users_table_created'] += 1
            else:
                print(f"   ⚠️  Users table: {error}")
        
        # Step 3: Create recruiter record
        if user_id:
            print(f"   Creating recruiter record...")
            success, error = self.create_recruiter_record(user_id, org_record)
            if success:
                print(f"   ✅ Recruiter record created")
                self.stats['recruiters_migrated'] += 1
                
                # Step 4: Delete from organizations
                try:
                    supabase.table('organizations').delete().eq('id', org_id).execute()
                    print(f"   🗑️  Deleted from organizations table")
                    self.stats['organizations_deleted'] += 1
                except Exception as e:
                    print(f"   ⚠️  Could not delete from organizations: {str(e)}")
                
                return True, None
            else:
                print(f"   ❌ Recruiter record failed: {error}")
                return False, f"Recruiter record failed: {error}"
        
        return False, "No user ID available"
    
    def run(self):
        """Execute the complete migration"""
        print("🚀 Starting Complete Recruiter Migration...")
        print("="*80)
        
        # Fetch recruiters
        recruiters = self.fetch_recruiters_from_organizations()
        if not recruiters:
            print("⚠️  No recruiters to migrate!")
            return
        
        print(f"\n📋 Migration Plan:")
        print(f"   1. Create {len(recruiters)} auth users")
        print(f"   2. Create {len(recruiters)} users table records")
        print(f"   3. Create {len(recruiters)} recruiter records")
        print(f"   4. Delete {len(recruiters)} records from organizations table")
        
        print("\n" + "="*80)
        print("🔄 STARTING MIGRATION")
        print("="*80)
        
        # Process each recruiter
        for idx, org_record in enumerate(recruiters[:5], 1):  # Start with first 5 for testing
            success, error = self.migrate_single_recruiter(org_record)
            if not success:
                self.stats['errors'].append(f"{org_record.get('name')}: {error}")
        
        # Summary
        print("\n" + "="*80)
        print("📊 MIGRATION SUMMARY")
        print("="*80)
        print(f"   Total recruiters: {self.stats['total_recruiters']}")
        print(f"   Auth users created: {self.stats['auth_users_created']}")
        print(f"   Users table records: {self.stats['users_table_created']}")
        print(f"   Recruiters migrated: {self.stats['recruiters_migrated']}")
        print(f"   Organizations deleted: {self.stats['organizations_deleted']}")
        print(f"   Errors: {len(self.stats['errors'])}")
        
        if self.stats['errors']:
            print(f"\n❌ Errors:")
            for error in self.stats['errors'][:10]:
                print(f"   • {error}")


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Supabase credentials not found")
        sys.exit(1)
    
    migration = CompleteMigration()
    migration.run()
