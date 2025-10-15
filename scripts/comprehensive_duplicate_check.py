#!/usr/bin/env python3
"""
Comprehensive duplicate check and removal script
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

def analyze_duplicates():
    """Comprehensive duplicate analysis"""
    print("="*70)
    print("COMPREHENSIVE DUPLICATE ANALYSIS")
    print("="*70)
    
    response = supabase.table('recruiters').select('*').order('createdat', desc=False).execute()
    recruiters = response.data
    
    print(f"\nTotal recruiters: {len(recruiters)}")
    
    # Group by email
    email_groups = defaultdict(list)
    name_groups = defaultdict(list)
    phone_groups = defaultdict(list)
    
    for rec in recruiters:
        email = rec.get('email')
        if email and isinstance(email, str):
            email = email.strip().lower()
            if email:
                email_groups[email].append(rec)
        
        name = rec.get('name')
        if name and isinstance(name, str):
            name = name.strip().lower()
            if name:
                name_groups[name].append(rec)
        
        phone = rec.get('phone')
        if phone and isinstance(phone, str):
            phone = phone.strip()
            if phone:
                phone_groups[phone].append(rec)
    
    # Find duplicates
    email_dupes = {k: v for k, v in email_groups.items() if len(v) > 1}
    name_dupes = {k: v for k, v in name_groups.items() if len(v) > 1}
    phone_dupes = {k: v for k, v in phone_groups.items() if len(v) > 1}
    
    print("\n" + "-"*70)
    print("DUPLICATE ANALYSIS BY EMAIL")
    print("-"*70)
    if email_dupes:
        print(f"Found {len(email_dupes)} duplicate email addresses:")
        for email, recs in sorted(email_dupes.items(), key=lambda x: len(x[1]), reverse=True):
            print(f"\n📧 {email} ({len(recs)} records):")
            for i, rec in enumerate(recs, 1):
                print(f"   {i}. {rec['name']}")
                print(f"      ID: {rec['id']}")
                print(f"      Phone: {rec.get('phone', 'N/A')}")
                print(f"      Created: {rec.get('createdat', 'N/A')}")
    else:
        print("✅ No email duplicates found!")
    
    print("\n" + "-"*70)
    print("DUPLICATE ANALYSIS BY NAME")
    print("-"*70)
    if name_dupes:
        print(f"Found {len(name_dupes)} duplicate names:")
        for name, recs in sorted(name_dupes.items(), key=lambda x: len(x[1]), reverse=True):
            print(f"\n🏢 {name} ({len(recs)} records):")
            for i, rec in enumerate(recs, 1):
                print(f"   {i}. Email: {rec.get('email', 'N/A')}")
                print(f"      ID: {rec['id']}")
                print(f"      Phone: {rec.get('phone', 'N/A')}")
                print(f"      Created: {rec.get('createdat', 'N/A')}")
                print(f"      State: {rec.get('state', 'N/A')}")
    else:
        print("✅ No name duplicates found!")
    
    print("\n" + "-"*70)
    print("DUPLICATE ANALYSIS BY PHONE")
    print("-"*70)
    if phone_dupes:
        print(f"Found {len(phone_dupes)} duplicate phone numbers:")
        for phone, recs in sorted(phone_dupes.items(), key=lambda x: len(x[1]), reverse=True):
            print(f"\n📱 {phone} ({len(recs)} records):")
            for i, rec in enumerate(recs, 1):
                print(f"   {i}. {rec['name']}")
                print(f"      Email: {rec.get('email', 'N/A')}")
                print(f"      ID: {rec['id']}")
                print(f"      Created: {rec.get('createdat', 'N/A')}")
    else:
        print("✅ No phone duplicates found!")
    
    return email_dupes, name_dupes, phone_dupes

def remove_email_duplicates(email_dupes):
    """Remove email duplicates, keeping the newest record"""
    if not email_dupes:
        return 0
    
    print("\n" + "="*70)
    print("REMOVING EMAIL DUPLICATES")
    print("="*70)
    
    removed = 0
    for email, recs in email_dupes.items():
        # Sort by creation date
        sorted_recs = sorted(recs, key=lambda x: x.get('createdat', ''))
        to_keep = sorted_recs[-1]
        to_remove = sorted_recs[:-1]
        
        print(f"\n📧 {email}:")
        print(f"  ✓ KEEPING: {to_keep['name']} (Created: {to_keep.get('createdat', 'N/A')})")
        
        for rec in to_remove:
            try:
                supabase.table('recruiters').delete().eq('id', rec['id']).execute()
                print(f"  ✗ REMOVED: {rec['name']} (Created: {rec.get('createdat', 'N/A')})")
                removed += 1
            except Exception as e:
                print(f"  ❌ ERROR removing {rec['name']}: {e}")
    
    return removed

def main():
    email_dupes, name_dupes, phone_dupes = analyze_duplicates()
    
    if email_dupes:
        print("\n" + "="*70)
        print("PROCEEDING WITH EMAIL DUPLICATE REMOVAL")
        print("(Email is the primary unique identifier)")
        print("="*70)
        
        removed = remove_email_duplicates(email_dupes)
        
        print(f"\n" + "="*70)
        print(f"SUMMARY: Removed {removed} duplicate records")
        print("="*70)
        
        # Re-check
        print("\n" + "="*70)
        print("VERIFICATION")
        print("="*70)
        response = supabase.table('recruiters').select('id').execute()
        print(f"\nFinal recruiter count: {len(response.data)}")
    else:
        print("\n" + "="*70)
        print("✅ NO EMAIL DUPLICATES - DATABASE IS CLEAN!")
        print("="*70)
        print("\nNote: Name and phone duplicates exist but these may be")
        print("legitimate different entities with same name/phone.")
        print("Email is the primary unique identifier.")

if __name__ == "__main__":
    main()
