#!/usr/bin/env python3
"""
Script to update recruiter statuses in the database
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
import random

# Load environment variables
load_dotenv('/app/.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_current_statuses():
    """Check current status distribution"""
    print("Checking current recruiter status distribution...")
    
    response = supabase.table('recruiters').select('id, name, verificationstatus').execute()
    recruiters = response.data
    
    status_counts = {}
    for recruiter in recruiters:
        status = recruiter.get('verificationstatus', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print(f"\nTotal recruiters: {len(recruiters)}")
    print("\nCurrent status distribution:")
    for status, count in status_counts.items():
        print(f"  {status}: {count}")
    
    return recruiters

def update_statuses():
    """Update some recruiter statuses to create variety"""
    print("\n" + "="*60)
    print("Updating recruiter statuses...")
    print("="*60)
    
    # First, check current distribution
    recruiters = check_current_statuses()
    
    if len(recruiters) == 0:
        print("\nNo recruiters found in database!")
        return
    
    # Define possible status values based on the application
    # From the code, valid statuses are: pending, approved, rejected
    statuses = ['pending', 'approved', 'rejected']
    
    # Let's update different recruiters to different statuses
    # We'll update about 30% of recruiters to create variety
    num_to_update = max(10, len(recruiters) // 3)
    
    # Shuffle recruiters to get random ones
    random.shuffle(recruiters)
    
    # Distribute updates across different statuses
    updates_per_status = num_to_update // 3
    
    updated_count = 0
    
    # Update some to 'pending'
    print(f"\nUpdating {updates_per_status} recruiters to 'pending'...")
    for i in range(updates_per_status):
        recruiter = recruiters[updated_count]
        try:
            supabase.table('recruiters').update({
                'verificationstatus': 'pending'
            }).eq('id', recruiter['id']).execute()
            print(f"  ✓ Updated {recruiter['name']} to 'pending'")
            updated_count += 1
        except Exception as e:
            print(f"  ✗ Error updating {recruiter['name']}: {e}")
    
    # Update some to 'approved'
    print(f"\nUpdating {updates_per_status} recruiters to 'approved'...")
    for i in range(updates_per_status):
        recruiter = recruiters[updated_count]
        try:
            supabase.table('recruiters').update({
                'verificationstatus': 'approved'
            }).eq('id', recruiter['id']).execute()
            print(f"  ✓ Updated {recruiter['name']} to 'approved'")
            updated_count += 1
        except Exception as e:
            print(f"  ✗ Error updating {recruiter['name']}: {e}")
    
    # Update some to 'rejected'
    print(f"\nUpdating {updates_per_status} recruiters to 'rejected'...")
    for i in range(updates_per_status):
        recruiter = recruiters[updated_count]
        try:
            supabase.table('recruiters').update({
                'verificationstatus': 'rejected'
            }).eq('id', recruiter['id']).execute()
            print(f"  ✓ Updated {recruiter['name']} to 'rejected'")
            updated_count += 1
        except Exception as e:
            print(f"  ✗ Error updating {recruiter['name']}: {e}")
    
    print(f"\n" + "="*60)
    print(f"Total recruiters updated: {updated_count}")
    print("="*60)
    
    # Check final distribution
    print("\n")
    check_current_statuses()

if __name__ == "__main__":
    update_statuses()
