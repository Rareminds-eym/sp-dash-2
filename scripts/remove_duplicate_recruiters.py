"""
Remove Duplicate Recruiters Script
- Identifies duplicate recruiters based on email address
- Keeps the newest record (latest createdAt)
- Deletes all older duplicates
"""

import os
import sys
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv
from collections import defaultdict

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class DuplicateRemover:
    def __init__(self):
        self.stats = {
            'total_recruiters': 0,
            'unique_emails': 0,
            'duplicates_found': 0,
            'duplicates_removed': 0,
            'errors': []
        }
        self.duplicate_groups = []
        
    def fetch_all_recruiters(self):
        """Fetch all recruiter organizations"""
        print("📂 Fetching all recruiter organizations...")
        
        try:
            response = supabase.table('organizations').select('*').eq('type', 'recruiter').order('createdAt', desc=False).execute()
            recruiters = response.data
            self.stats['total_recruiters'] = len(recruiters)
            
            print(f"✅ Found {self.stats['total_recruiters']} recruiter organizations")
            return recruiters
        except Exception as e:
            print(f"❌ Error fetching recruiters: {str(e)}")
            sys.exit(1)
    
    def identify_duplicates(self, recruiters):
        """Identify duplicate recruiters based on email"""
        print("\n🔍 Identifying duplicates by email address...")
        
        # Group recruiters by email (case-insensitive)
        email_groups = defaultdict(list)
        
        for recruiter in recruiters:
            email = recruiter.get('email', '').lower().strip()
            if email:
                email_groups[email].append(recruiter)
        
        self.stats['unique_emails'] = len(email_groups)
        
        # Find groups with more than one recruiter
        for email, group in email_groups.items():
            if len(group) > 1:
                # Sort by createdAt (oldest first)
                sorted_group = sorted(group, key=lambda x: x.get('createdAt', ''))
                self.duplicate_groups.append({
                    'email': email,
                    'count': len(group),
                    'to_keep': sorted_group[-1],  # Keep newest (last in sorted list)
                    'to_delete': sorted_group[:-1]  # Delete all older ones
                })
                self.stats['duplicates_found'] += len(group) - 1
        
        print(f"✅ Found {len(self.duplicate_groups)} email addresses with duplicates")
        print(f"   Total duplicate records to remove: {self.stats['duplicates_found']}")
        
        return len(self.duplicate_groups) > 0
    
    def display_duplicates(self):
        """Display duplicate information"""
        if not self.duplicate_groups:
            print("\n✅ No duplicates found!")
            return
        
        print("\n" + "="*80)
        print("📋 DUPLICATE RECRUITERS FOUND")
        print("="*80)
        
        for idx, group in enumerate(self.duplicate_groups, 1):
            print(f"\n{idx}. Email: {group['email']}")
            print(f"   Total records: {group['count']}")
            print(f"   ✅ KEEPING (newest):")
            keeper = group['to_keep']
            print(f"      - ID: {keeper['id']}")
            print(f"      - Company: {keeper['name']}")
            print(f"      - Created: {keeper.get('createdAt', 'N/A')}")
            
            print(f"   ❌ DELETING ({len(group['to_delete'])} older record(s)):")
            for record in group['to_delete']:
                print(f"      - ID: {record['id']}")
                print(f"      - Company: {record['name']}")
                print(f"      - Created: {record.get('createdAt', 'N/A')}")
    
    def remove_duplicates(self):
        """Remove duplicate recruiters"""
        if not self.duplicate_groups:
            print("\n✅ No duplicates to remove!")
            return
        
        print("\n" + "="*80)
        print("🗑️  REMOVING DUPLICATES")
        print("="*80)
        
        for idx, group in enumerate(self.duplicate_groups, 1):
            print(f"\n{idx}. Processing email: {group['email']}")
            
            for record in group['to_delete']:
                try:
                    print(f"   🗑️  Deleting: {record['name']} (ID: {record['id']})")
                    supabase.table('organizations').delete().eq('id', record['id']).execute()
                    self.stats['duplicates_removed'] += 1
                    print(f"   ✅ Deleted successfully")
                except Exception as e:
                    error_msg = f"Failed to delete {record['name']} (ID: {record['id']}): {str(e)}"
                    self.stats['errors'].append(error_msg)
                    print(f"   ❌ Error: {str(e)}")
    
    def verify_results(self):
        """Verify the cleanup results"""
        print("\n" + "="*80)
        print("🔍 VERIFYING RESULTS")
        print("="*80)
        
        try:
            response = supabase.table('organizations').select('id').eq('type', 'recruiter').execute()
            final_count = len(response.data)
            
            expected_count = self.stats['total_recruiters'] - self.stats['duplicates_removed']
            
            print(f"\n📊 Statistics:")
            print(f"   • Original recruiter count: {self.stats['total_recruiters']}")
            print(f"   • Unique email addresses: {self.stats['unique_emails']}")
            print(f"   • Duplicates removed: {self.stats['duplicates_removed']}")
            print(f"   • Expected final count: {expected_count}")
            print(f"   • Actual final count: {final_count}")
            
            if final_count == expected_count:
                print(f"\n✅ Verification successful! Counts match.")
            else:
                print(f"\n⚠️  Warning: Count mismatch. Expected {expected_count}, got {final_count}")
            
            if self.stats['errors']:
                print(f"\n❌ Errors encountered ({len(self.stats['errors'])}):")
                for error in self.stats['errors']:
                    print(f"   • {error}")
        except Exception as e:
            print(f"❌ Error verifying results: {str(e)}")
    
    def run(self):
        """Run the duplicate removal process"""
        print("🚀 Starting Duplicate Recruiter Removal Process...")
        print("="*80)
        
        # Fetch all recruiters
        recruiters = self.fetch_all_recruiters()
        
        if not recruiters:
            print("⚠️  No recruiters found in database!")
            return
        
        # Identify duplicates
        has_duplicates = self.identify_duplicates(recruiters)
        
        # Display duplicates
        self.display_duplicates()
        
        if not has_duplicates:
            print("\n✅ Database is clean - no duplicates found!")
            return
        
        # Remove duplicates
        self.remove_duplicates()
        
        # Verify results
        self.verify_results()
        
        print("\n" + "="*80)
        print("✅ DUPLICATE REMOVAL COMPLETE")
        print("="*80)


if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Supabase credentials not found in environment variables")
        sys.exit(1)
    
    remover = DuplicateRemover()
    remover.run()
