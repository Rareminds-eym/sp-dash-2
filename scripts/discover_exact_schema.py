"""
Discover exact schema requirements for users and recruiters tables
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

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("🔍 Discovering table schemas...")
print("="*80)

# Test 1: Check existing users table for allowed roles
print("\n1️⃣  Checking existing users...")
try:
    response = supabase.table('users').select('role').limit(10).execute()
    if response.data:
        roles = set([u['role'] for u in response.data])
        print(f"✅ Found roles in users table: {roles}")
except Exception as e:
    print(f"❌ Error: {str(e)}")

# Test 2: Try minimal recruiters insert with just id
print("\n2️⃣  Testing recruiters table with minimal fields...")
test_id = str(uuid.uuid4())

test_combinations = [
    {'id': test_id},
    {'id': test_id, 'userId': test_id},
    {'userId': test_id},
    {'userId': test_id, 'companyName': 'Test'},
]

for i, test_record in enumerate(test_combinations, 1):
    print(f"\n   Test {i}: {list(test_record.keys())}")
    try:
        response = supabase.table('recruiters').insert(test_record).execute()
        print(f"   ✅ SUCCESS! Schema discovered:")
        if response.data:
            for key in response.data[0].keys():
                print(f"      • {key}")
        
        # Clean up
        if 'userId' in test_record:
            supabase.table('recruiters').delete().eq('userId', test_id).execute()
        elif 'id' in test_record:
            supabase.table('recruiters').delete().eq('id', test_id).execute()
        break
    except Exception as e:
        error_str = str(e)
        print(f"   ❌ {error_str[:150]}")

# Test 3: Check if recruiters table is empty and what columns it might have
print("\n3️⃣  Checking recruiters table structure...")
try:
    # Try to select with various possible column names
    response = supabase.table('recruiters').select('*').limit(1).execute()
    print(f"   Recruiters table has {len(response.data)} records")
except Exception as e:
    print(f"   Error: {str(e)}")
