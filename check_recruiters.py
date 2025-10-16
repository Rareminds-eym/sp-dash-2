import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get all recruiters
response = supabase.table('recruiters').select('id, name, isActive, active').limit(10).execute()

print(f"Total recruiters sampled: {len(response.data)}")
print("\nSample recruiters:")
for r in response.data[:5]:
    print(f"  ID: {r.get('id')}, Name: {r.get('name')}, isActive: {r.get('isActive')}, active: {r.get('active')}")

# Check counts
all_count = supabase.table('recruiters').select('id', count='exact').execute()
print(f"\nTotal recruiters: {all_count.count}")

isactive_count = supabase.table('recruiters').select('id', count='exact').eq('isActive', True).execute()
print(f"Recruiters with isActive=True: {isactive_count.count}")

active_count = supabase.table('recruiters').select('id', count='exact').eq('active', True).execute()
print(f"Recruiters with active=True: {active_count.count}")

