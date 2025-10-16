"""
Discover Recruiters Table Schema by Testing Different Fields
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv('/app/.env')

# Supabase credentials
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

test_id = str(uuid.uuid4())

# Test different field combinations
field_tests = [
    # Test 1: Minimal
    {
        'id': test_id,
        'companyName': 'Test Company'
    },
    # Test 2: Common recruiter fields
    {
        'id': test_id,
        'companyName': 'Test Company',
        'email': 'test@test.com',
        'phone': '1234567890'
    },
    # Test 3: With location fields
    {
        'id': test_id,
        'companyName': 'Test Company',
        'email': 'test@test.com',
        'phone': '1234567890',
        'location': 'Test City',
        'state': 'Test State'
    },
    # Test 4: Alternative field names
    {
        'id': test_id,
        'company_name': 'Test Company',
        'email': 'test@test.com',
        'phone': '1234567890'
    },
]

print("🔍 Testing recruiters table schema...")
print("="*80)

for i, test_record in enumerate(field_tests, 1):
    print(f"\n📝 Test {i}: {list(test_record.keys())}")
    try:
        response = supabase.table('recruiters').insert(test_record).execute()
        print(f"✅ SUCCESS! These fields work:")
        for key in test_record.keys():
            print(f"   • {key}")
        
        if response.data:
            print(f"\n📋 Returned record structure:")
            for key in response.data[0].keys():
                print(f"   • {key}: {type(response.data[0][key]).__name__}")
        
        # Clean up
        supabase.table('recruiters').delete().eq('id', test_id).execute()
        print(f"🗑️  Cleaned up test record")
        break  # Stop after first successful test
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Failed: {error_msg[:200]}")
        
print("\n" + "="*80)
