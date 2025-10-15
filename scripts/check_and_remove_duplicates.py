#!/usr/bin/env python3
"""
Script to check for and remove duplicate recruiters from the database
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
from collections import defaultdict

# Load environment variables
load_dotenv('/app/.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def find_duplicates():
    """Find duplicate recruiters based on email address"""
    print("="*60)
    print("Checking for duplicate recruiters...")
    print("="*60)
    
    # Get all recruiters
    response = supabase.table('recruiters').select('id, name, email, createdat').order('createdat', desc=False).execute()
    recruiters = response.data
    
    print(f"\nTotal recruiters in database: {len(recruiters)}")
    
    # Group by email
    email_groups = defaultdict(list)
    for recruiter in recruiters:
        email = recruiter.get('email', '').strip().lower()
        if email:
            email_groups[email].append(recruiter)
    
    # Find duplicates
    duplicates = {email: recs for email, recs in email_groups.items() if len(recs) > 1}
    
    if not duplicates:
        print("\n✅ No duplicate recruiters found!")
        print("All recruiter email addresses are unique.")
        return None
    
    print(f"\n⚠️  Found {len(duplicates)} email addresses with duplicates:")
    print(f"Total duplicate records: {sum(len(recs) - 1 for recs in duplicates.values())}")
    
    # Show duplicate details
    for email, recs in sorted(duplicates.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"\n  {email}: {len(recs)} records")
        for i, rec in enumerate(recs):
            print(f"    {i+1}. {rec['name']} (ID: {rec['id'][:8]}..., Created: {rec.get('createdat', 'N/A')})")
    
    return duplicates

def remove_duplicates(duplicates):
    """Remove duplicate recruiters, keeping the newest record for each email"""
    if not duplicates:
        return 0
    
    print("\n" + "="*60)
    print("Removing duplicate recruiters...")
    print("="*60)
    
    total_removed = 0
    
    for email, recs in duplicates.items():
        # Sort by created date (oldest to newest)
        sorted_recs = sorted(recs, key=lambda x: x.get('createdat', ''))
        
        # Keep the newest (last in sorted list), remove the rest
        to_remove = sorted_recs[:-1]
        to_keep = sorted_recs[-1]
        
        print(f"\n📧 {email}:")
        print(f"  ✓ Keeping: {to_keep['name']} (ID: {to_keep['id'][:8]}..., Created: {to_keep.get('createdat', 'N/A')})")
        
        for rec in to_remove:
            try:
                supabase.table('recruiters').delete().eq('id', rec['id']).execute()
                print(f"  ✗ Removed: {rec['name']} (ID: {rec['id'][:8]}..., Created: {rec.get('createdat', 'N/A')})")
                total_removed += 1
            except Exception as e:
                print(f"  ❌ Error removing {rec['name']}: {e}")
    
    return total_removed

def verify_cleanup():
    """Verify that all duplicates have been removed"""
    print("\n" + "="*60)
    print("Verifying cleanup...")
    print("="*60)
    
    response = supabase.table('recruiters').select('id, email').execute()
    recruiters = response.data
    
    # Check for duplicates
    emails = [r.get('email', '').strip().lower() for r in recruiters if r.get('email')]
    unique_emails = set(emails)
    
    print(f"\nTotal recruiters after cleanup: {len(recruiters)}")
    print(f"Unique email addresses: {len(unique_emails)}")
    
    if len(emails) == len(unique_emails):
        print("✅ Success! No duplicates found.")
    else:
        print(f"⚠️  Warning: Still have {len(emails) - len(unique_emails)} duplicates!")
    
    return len(recruiters)

def main():
    # Find duplicates
    duplicates = find_duplicates()
    
    if duplicates:
        # Ask for confirmation (auto-confirm in script)
        print("\n" + "="*60)
        print("Proceeding with duplicate removal...")
        print("="*60)
        
        # Remove duplicates
        removed_count = remove_duplicates(duplicates)
        
        print(f"\n" + "="*60)
        print(f"Summary: Removed {removed_count} duplicate records")
        print("="*60)
        
        # Verify cleanup
        final_count = verify_cleanup()
    else:
        print("\n" + "="*60)
        print("No action needed - database is clean!")
        print("="*60)

if __name__ == "__main__":
    main()
