"""
Migrate Recruiter Data from Organizations Table to Recruiters Table
- Fetches all recruiter records from organizations table (type='recruiter')
- Migrates them to the dedicated recruiters table
- Optionally removes them from organizations table after successful migration
"""

import os
import sys
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class RecruiterMigration:
    def __init__(self):
        self.stats = {
            'total_recruiters': 0,
            'successfully_migrated': 0,
            'failed_migrations': 0,
            'deleted_from_organizations': 0,
            'errors': []
        }
        
    def fetch_recruiters_from_organizations(self):
        """Fetch all recruiter records from organizations table"""
        print("📂 Fetching recruiters from organizations table...")
        
        try:
            response = supabase.table('organizations').select('*').eq('type', 'recruiter').execute()
            recruiters = response.data
            self.stats['total_recruiters'] = len(recruiters)
            
            print(f"✅ Found {self.stats['total_recruiters']} recruiter records in organizations table")
            return recruiters
        except Exception as e:
            print(f"❌ Error fetching recruiters: {str(e)}")
            sys.exit(1)
    
    def map_to_recruiter_schema(self, org_record):
        """Map organization record to recruiter table schema"""
        # Map fields from organizations table to recruiters table
        recruiter_record = {
            'id': org_record.get('id'),
            'companyName': org_record.get('name'),
            'email': org_record.get('email'),
            'phone': org_record.get('phone'),
            'website': org_record.get('website'),
            'address': org_record.get('address'),
            'city': org_record.get('city'),
            'state': org_record.get('state'),
            'district': org_record.get('district'),
            'companyType': org_record.get('metadata', {}).get('company_type') if isinstance(org_record.get('metadata'), dict) else None,
            'verificationStatus': org_record.get('verificationStatus', 'pending'),
            'isActive': org_record.get('isActive', True),
            'verifiedAt': org_record.get('verifiedAt'),
            'verifiedBy': org_record.get('verifiedBy'),
            'metadata': org_record.get('metadata', {}),
            'createdAt': org_record.get('createdAt', datetime.now().isoformat()),
            'updatedAt': org_record.get('updatedAt')
        }
        
        return recruiter_record
    
    def migrate_single_recruiter(self, org_record):
        """Migrate a single recruiter from organizations to recruiters table"""
        company_name = org_record.get('name', 'Unknown')
        recruiter_id = org_record.get('id')
        
        try:
            # Map to recruiter schema
            recruiter_record = self.map_to_recruiter_schema(org_record)
            
            # Insert into recruiters table
            response = supabase.table('recruiters').insert(recruiter_record).execute()
            
            if response.data:
                return True, None
            else:
                return False, "No data returned from insert"
                
        except Exception as e:
            error_msg = str(e)
            # Check if record already exists
            if 'duplicate key' in error_msg.lower() or 'already exists' in error_msg.lower():
                return False, "ALREADY_EXISTS"
            return False, error_msg
    
    def delete_from_organizations(self, recruiter_id):
        """Delete recruiter record from organizations table"""
        try:
            supabase.table('organizations').delete().eq('id', recruiter_id).execute()
            return True
        except Exception as e:
            print(f"   ⚠️  Failed to delete from organizations: {str(e)}")
            return False
    
    def migrate_all_recruiters(self, recruiters, delete_after_migration=True):
        """Migrate all recruiters to recruiters table"""
        print("\n" + "="*80)
        print("🔄 STARTING MIGRATION")
        print("="*80)
        
        for idx, org_record in enumerate(recruiters, 1):
            company_name = org_record.get('name', 'Unknown')
            recruiter_id = org_record.get('id')
            
            print(f"\n{idx}/{self.stats['total_recruiters']}. Migrating: {company_name}")
            print(f"   ID: {recruiter_id}")
            
            # Migrate to recruiters table
            success, error = self.migrate_single_recruiter(org_record)
            
            if success:
                print(f"   ✅ Successfully inserted into recruiters table")
                self.stats['successfully_migrated'] += 1
                
                # Delete from organizations table if requested
                if delete_after_migration:
                    if self.delete_from_organizations(recruiter_id):
                        print(f"   🗑️  Deleted from organizations table")
                        self.stats['deleted_from_organizations'] += 1
            elif error == "ALREADY_EXISTS":
                print(f"   ⚠️  Already exists in recruiters table, skipping...")
                # Still delete from organizations if it already exists in recruiters
                if delete_after_migration:
                    if self.delete_from_organizations(recruiter_id):
                        print(f"   🗑️  Deleted from organizations table")
                        self.stats['deleted_from_organizations'] += 1
            else:
                print(f"   ❌ Migration failed: {error}")
                self.stats['failed_migrations'] += 1
                self.stats['errors'].append(f"{company_name} (ID: {recruiter_id}): {error}")
    
    def verify_migration(self):
        """Verify the migration results"""
        print("\n" + "="*80)
        print("🔍 VERIFYING MIGRATION")
        print("="*80)
        
        try:
            # Count recruiters in recruiters table
            recruiters_response = supabase.table('recruiters').select('id').execute()
            recruiters_count = len(recruiters_response.data)
            
            # Count remaining recruiters in organizations table
            orgs_response = supabase.table('organizations').select('id').eq('type', 'recruiter').execute()
            orgs_count = len(orgs_response.data)
            
            print(f"\n📊 Migration Results:")
            print(f"   • Recruiters in recruiters table: {recruiters_count}")
            print(f"   • Recruiters remaining in organizations table: {orgs_count}")
            print(f"   • Successfully migrated: {self.stats['successfully_migrated']}")
            print(f"   • Deleted from organizations: {self.stats['deleted_from_organizations']}")
            print(f"   • Failed migrations: {self.stats['failed_migrations']}")
            
            if orgs_count == 0 and recruiters_count == self.stats['total_recruiters']:
                print(f"\n✅ Migration completed successfully!")
                print(f"   All {self.stats['total_recruiters']} recruiters moved to recruiters table")
            elif orgs_count > 0:
                print(f"\n⚠️  Warning: {orgs_count} recruiters still remain in organizations table")
            
            if self.stats['errors']:
                print(f"\n❌ Errors encountered ({len(self.stats['errors'])}):")
                for error in self.stats['errors'][:10]:
                    print(f"   • {error}")
                if len(self.stats['errors']) > 10:
                    print(f"   ... and {len(self.stats['errors']) - 10} more errors")
                    
        except Exception as e:
            print(f"❌ Error verifying migration: {str(e)}")
    
    def run(self, delete_after_migration=True):
        """Run the migration process"""
        print("🚀 Starting Recruiter Data Migration...")
        print("="*80)
        
        # Fetch recruiters from organizations table
        recruiters = self.fetch_recruiters_from_organizations()
        
        if not recruiters:
            print("⚠️  No recruiters found in organizations table!")
            return
        
        # Show sample record
        print(f"\n📋 Sample organization record:")
        sample = recruiters[0]
        for key in ['id', 'name', 'email', 'phone', 'state', 'type', 'verificationStatus', 'isActive']:
            print(f"   • {key}: {sample.get(key)}")
        
        # Confirm migration
        action = "migrate and delete" if delete_after_migration else "migrate only (keep in organizations)"
        print(f"\n⚠️  About to {action} {len(recruiters)} recruiters")
        print(f"   From: organizations table (type='recruiter')")
        print(f"   To: recruiters table")
        
        # Migrate all recruiters
        self.migrate_all_recruiters(recruiters, delete_after_migration)
        
        # Verify migration
        self.verify_migration()
        
        print("\n" + "="*80)
        print("✅ MIGRATION COMPLETE")
        print("="*80)


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Supabase credentials not found in environment variables")
        sys.exit(1)
    
    migration = RecruiterMigration()
    
    # Run migration with delete_after_migration=True (remove from organizations after successful migration)
    migration.run(delete_after_migration=True)
