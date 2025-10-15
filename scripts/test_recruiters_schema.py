"""
Get Recruiters Table Schema
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

# Try to insert a test record to see what columns exist
test_record = {
    'id': 'test-id-12345',
    'companyName': 'Test Company'
}

print("🔍 Testing recruiters table schema...")
print("="*80)

try:
    response = supabase.table('recruiters').insert(test_record).execute()
    print("✅ Basic insert worked!")
    print(f"Inserted record: {response.data}")
    
    # Clean up test record
    supabase.table('recruiters').delete().eq('id', 'test-id-12345').execute()
    print("🗑️  Cleaned up test record")
    
except Exception as e:
    print(f"❌ Error: {e}")

# Try with minimal fields
print("\n" + "="*80)
print("🔍 Trying to fetch any existing records to see the schema...")
try:
    response = supabase.table('recruiters').select('*').limit(5).execute()
    if response.data and len(response.data) > 0:
        print(f"✅ Found {len(response.data)} existing records")
        print(f"\n📋 Schema from existing records:")
        for key in response.data[0].keys():
            print(f"   • {key}")
    else:
        print("⚠️  No existing records found in recruiters table")
except Exception as e:
    print(f"❌ Error: {e}")
