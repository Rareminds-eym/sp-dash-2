"""
Check Database Schema - List all tables and their columns
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

def check_tables():
    """Check what tables exist in the database"""
    print("🔍 Checking database tables...")
    print("="*80)
    
    # List of expected tables
    tables_to_check = [
        'organizations',
        'recruiters',
        'users',
        'students',
        'skill_passports',
        'audit_logs',
        'verifications',
        'metrics_snapshots'
    ]
    
    for table in tables_to_check:
        try:
            response = supabase.table(table).select('*').limit(1).execute()
            print(f"✅ Table '{table}' exists (sample count: {len(response.data)})")
        except Exception as e:
            if 'does not exist' in str(e) or 'relation' in str(e):
                print(f"❌ Table '{table}' does NOT exist")
            else:
                print(f"⚠️  Table '{table}' - Error: {str(e)}")
    
    # Check organizations table for recruiter records
    print("\n" + "="*80)
    print("📊 Checking organizations table for recruiter records...")
    try:
        response = supabase.table('organizations').select('type').eq('type', 'recruiter').execute()
        recruiter_count = len(response.data)
        print(f"✅ Found {recruiter_count} recruiter records in organizations table")
        
        # Get sample recruiter record
        if recruiter_count > 0:
            sample = supabase.table('organizations').select('*').eq('type', 'recruiter').limit(1).execute()
            if sample.data:
                print(f"\n📋 Sample recruiter record structure:")
                for key, value in sample.data[0].items():
                    print(f"   - {key}: {type(value).__name__}")
    except Exception as e:
        print(f"❌ Error checking organizations table: {str(e)}")

if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Supabase credentials not found in environment variables")
        sys.exit(1)
    
    check_tables()
