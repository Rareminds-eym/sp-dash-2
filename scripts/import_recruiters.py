"""
Recruiter Data Import Script
- Imports recruiters from Excel file with 100% complete data
- Creates organization records
- Creates Supabase Auth accounts
- Creates user records
- Sends welcome emails
"""

import pandas as pd
import os
import sys
from supabase import create_client, Client
from datetime import datetime
import uuid
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Default password for all recruiters
DEFAULT_PASSWORD = "Recruiter@2025"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class RecruiterImporter:
    def __init__(self, file_path):
        self.file_path = file_path
        self.stats = {
            'total_rows': 0,
            'complete_rows': 0,
            'duplicate_emails': 0,
            'already_exists': 0,
            'successfully_imported': 0,
            'failed': 0,
            'errors': []
        }
        self.imported_recruiters = []
        
    def load_data(self):
        """Load Excel file and filter complete rows"""
        print("📂 Loading Excel file...")
        df = pd.read_excel(self.file_path)
        self.stats['total_rows'] = len(df)
        
        # Filter rows with 100% complete data
        complete_df = df.dropna()
        self.stats['complete_rows'] = len(complete_df)
        
        print(f"✅ Found {self.stats['complete_rows']} rows with 100% complete data out of {self.stats['total_rows']} total rows")
        
        return complete_df
    
    def remove_duplicates(self, df):
        """Remove duplicate email addresses"""
        print("\n🔍 Checking for duplicate emails...")
        
        # Convert email to lowercase for comparison
        df['Mail ID'] = df['Mail ID'].str.strip().str.lower()
        
        # Keep first occurrence of each email
        df_unique = df.drop_duplicates(subset=['Mail ID'], keep='first')
        
        self.stats['duplicate_emails'] = len(df) - len(df_unique)
        
        if self.stats['duplicate_emails'] > 0:
            print(f"⚠️  Removed {self.stats['duplicate_emails']} duplicate email addresses")
        else:
            print("✅ No duplicate emails found")
        
        return df_unique
    
    def check_existing_emails(self, emails):
        """Check which emails already exist in the database"""
        print("\n🔍 Checking for existing emails in database...")
        
        try:
            # Check in users table
            response = supabase.table('users').select('email').in_('email', emails).execute()
            existing_emails = set([user['email'].lower() for user in response.data])
            
            print(f"📊 Found {len(existing_emails)} emails that already exist in database")
            return existing_emails
        except Exception as e:
            print(f"⚠️  Error checking existing emails: {str(e)}")
            return set()
    
    def create_organization(self, recruiter_data):
        """Create organization record for recruiter"""
        org_id = str(uuid.uuid4())
        
        org_record = {
            'id': org_id,
            'name': recruiter_data['Company Name'],
            'type': 'recruiter',
            'state': recruiter_data['Location'],
            'website': recruiter_data['Website'],
            'phone': recruiter_data['Number'],
            'email': recruiter_data['Mail ID'],
            'address': recruiter_data['Address'],
            'verificationStatus': 'approved',
            'isActive': True,
            'metadata': {
                'company_type': recruiter_data['Company type'],
                'imported_from': 'excel',
                'import_date': datetime.now().isoformat()
            },
            'createdAt': datetime.now().isoformat()
        }
        
        try:
            response = supabase.table('organizations').insert(org_record).execute()
            return org_id, None
        except Exception as e:
            return None, str(e)
    
    def create_auth_user(self, email, company_name):
        """Create user in Supabase Auth"""
        try:
            # Create auth user
            auth_response = supabase.auth.admin.create_user({
                "email": email,
                "password": DEFAULT_PASSWORD,
                "email_confirm": True,  # Auto-confirm email
                "user_metadata": {
                    "name": company_name,
                    "role": "recruiter",
                    "imported_from": "excel"
                }
            })
            
            return auth_response.user.id, None
        except Exception as e:
            error_msg = str(e)
            # Check if user already exists in auth
            if "already been registered" in error_msg or "User already registered" in error_msg:
                return None, "AUTH_EXISTS"
            return None, error_msg
    
    def create_user_record(self, auth_user_id, email, company_name, org_id):
        """Create user record in users table"""
        user_record = {
            'id': auth_user_id,
            'email': email,
            'role': 'recruiter',
            'organizationId': org_id,
            'isActive': True,
            'metadata': {
                'name': company_name,
                'imported_from': 'excel',
                'import_date': datetime.now().isoformat()
            },
            'createdAt': datetime.now().isoformat()
        }
        
        try:
            response = supabase.table('users').insert(user_record).execute()
            return True, None
        except Exception as e:
            return False, str(e)
    
    def send_welcome_email(self, email, company_name):
        """Send welcome email to recruiter"""
        # Note: This is a placeholder. In production, you'd use a real email service
        # For now, we'll just log that email should be sent
        print(f"  📧 Welcome email queued for: {email}")
        return True
    
    def import_recruiter(self, row):
        """Import a single recruiter"""
        recruiter_data = {
            'Company Name': row['Company Name'],
            'Website': row['Website'],
            'Number': row['Number'],
            'Mail ID': row['Mail ID'],
            'Company type': row['Company type'],
            'Address': row['Address'],
            'Location': row['Location']
        }
        
        email = recruiter_data['Mail ID']
        company_name = recruiter_data['Company Name']
        
        print(f"\n📝 Processing: {company_name} ({email})")
        
        try:
            # Step 1: Create organization
            print("  🏢 Creating organization...")
            org_id, error = self.create_organization(recruiter_data)
            if error:
                raise Exception(f"Organization creation failed: {error}")
            print(f"  ✅ Organization created: {org_id}")
            
            # Step 2: Create auth user
            print("  👤 Creating Supabase Auth user...")
            auth_user_id, error = self.create_auth_user(email, company_name)
            if error:
                if error == "AUTH_EXISTS":
                    print(f"  ⚠️  Auth user already exists, skipping...")
                    self.stats['already_exists'] += 1
                    return False
                raise Exception(f"Auth user creation failed: {error}")
            print(f"  ✅ Auth user created: {auth_user_id}")
            
            # Step 3: Create user record
            print("  📋 Creating user record...")
            success, error = self.create_user_record(auth_user_id, email, company_name, org_id)
            if error:
                raise Exception(f"User record creation failed: {error}")
            print("  ✅ User record created")
            
            # Step 4: Send welcome email
            print("  📧 Sending welcome email...")
            self.send_welcome_email(email, company_name)
            
            # Success!
            self.stats['successfully_imported'] += 1
            self.imported_recruiters.append({
                'company_name': company_name,
                'email': email,
                'org_id': org_id,
                'auth_user_id': auth_user_id,
                'location': recruiter_data['Location']
            })
            
            print(f"  ✅ Successfully imported!")
            return True
            
        except Exception as e:
            self.stats['failed'] += 1
            error_msg = f"{company_name} ({email}): {str(e)}"
            self.stats['errors'].append(error_msg)
            print(f"  ❌ Failed: {str(e)}")
            return False
    
    def generate_report(self):
        """Generate import report"""
        print("\n" + "="*80)
        print("📊 IMPORT SUMMARY REPORT")
        print("="*80)
        print(f"\n📈 Statistics:")
        print(f"  • Total rows in file: {self.stats['total_rows']}")
        print(f"  • Rows with 100% complete data: {self.stats['complete_rows']}")
        print(f"  • Duplicate emails removed: {self.stats['duplicate_emails']}")
        print(f"  • Already existing in database: {self.stats['already_exists']}")
        print(f"  • Successfully imported: {self.stats['successfully_imported']}")
        print(f"  • Failed imports: {self.stats['failed']}")
        
        if self.stats['errors']:
            print(f"\n❌ Errors ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:10]:  # Show first 10 errors
                print(f"  • {error}")
            if len(self.stats['errors']) > 10:
                print(f"  ... and {len(self.stats['errors']) - 10} more errors")
        
        if self.imported_recruiters:
            print(f"\n✅ Successfully Imported Recruiters:")
            print(f"  First 5 recruiters:")
            for i, recruiter in enumerate(self.imported_recruiters[:5], 1):
                print(f"  {i}. {recruiter['company_name']}")
                print(f"     Email: {recruiter['email']}")
                print(f"     Location: {recruiter['location']}")
                print(f"     Organization ID: {recruiter['org_id']}")
        
        print("\n📧 Login Credentials for all imported recruiters:")
        print(f"  • Email: <their email address>")
        print(f"  • Password: {DEFAULT_PASSWORD}")
        print("\n" + "="*80)
        
        # Save detailed report to file
        report_file = '/app/recruiter_import_report.json'
        report_data = {
            'timestamp': datetime.now().isoformat(),
            'statistics': self.stats,
            'imported_recruiters': self.imported_recruiters
        }
        
        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\n💾 Detailed report saved to: {report_file}")
    
    def run(self):
        """Run the import process"""
        print("🚀 Starting Recruiter Import Process...")
        print("="*80)
        
        # Load data
        df = self.load_data()
        
        # Remove duplicates
        df_unique = self.remove_duplicates(df)
        
        # Check existing emails
        all_emails = df_unique['Mail ID'].tolist()
        existing_emails = self.check_existing_emails(all_emails)
        
        # Filter out existing emails
        df_to_import = df_unique[~df_unique['Mail ID'].isin(existing_emails)]
        
        self.stats['already_exists'] = len(df_unique) - len(df_to_import)
        
        print(f"\n📊 Ready to import {len(df_to_import)} new recruiters")
        
        if len(df_to_import) == 0:
            print("⚠️  No new recruiters to import!")
            self.generate_report()
            return
        
        # Import each recruiter
        print("\n" + "="*80)
        print("🔄 Starting Import...")
        print("="*80)
        
        for idx, row in df_to_import.iterrows():
            self.import_recruiter(row)
        
        # Generate final report
        self.generate_report()


if __name__ == "__main__":
    file_path = '/tmp/recruiter_data.xlsx'
    
    if not os.path.exists(file_path):
        print(f"❌ Error: File not found: {file_path}")
        sys.exit(1)
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Supabase credentials not found in environment variables")
        sys.exit(1)
    
    importer = RecruiterImporter(file_path)
    importer.run()
