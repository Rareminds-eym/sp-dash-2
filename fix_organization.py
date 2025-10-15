#!/usr/bin/env python3

import requests
import json
import sys
from supabase import create_client, Client

# Configuration
BASE_URL = "https://fix-recruiting.preview.emergentagent.com"
SUPABASE_URL = "https://dpooleduinyyzxgrcwko.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10"

# Test credentials
TEST_EMAIL = "superadmin@rareminds.in"
TEST_PASSWORD = "password123"

# Organization details to create
ORGANIZATION_ID = "905b21a8-8374-4a7c-a224-46bd6f58dc4c"
ORGANIZATION_NAME = "Rareminds"
ORGANIZATION_TYPE = "university"  # Changed from 'company' to 'university' as per DB constraints

def fix_organization_data():
    """
    Fix the missing organization issue by creating the organization that superadmin user references.
    """
    print("=" * 80)
    print("FIXING ORGANIZATION DATA INTEGRITY ISSUE")
    print("=" * 80)
    
    # Initialize Supabase client with service role key for admin operations
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    try:
        # Step 1: Verify the current issue
        print("\n1. VERIFYING CURRENT ISSUE")
        print("-" * 40)
        
        # Check if user exists and has the problematic organizationId
        user_query = supabase.table('users').select('*').eq('email', TEST_EMAIL).execute()
        
        if not user_query.data:
            print(f"❌ User {TEST_EMAIL} not found in database")
            return False
            
        user = user_query.data[0]
        user_org_id = user.get('organizationId')
        
        print(f"✅ User found: {user.get('email')}")
        print(f"   User organizationId: {user_org_id}")
        
        if user_org_id != ORGANIZATION_ID:
            print(f"❌ User organizationId ({user_org_id}) doesn't match expected ID ({ORGANIZATION_ID})")
            return False
        
        # Check if organization exists
        org_query = supabase.table('organizations').select('*').eq('id', ORGANIZATION_ID).execute()
        
        if org_query.data:
            print(f"✅ Organization {ORGANIZATION_ID} already exists!")
            print(f"   Name: {org_query.data[0].get('name')}")
            print(f"   Type: {org_query.data[0].get('type')}")
            print("   No fix needed - organization already exists.")
            return True
        else:
            print(f"❌ Organization {ORGANIZATION_ID} does NOT exist - this confirms the issue")
        
        # Step 2: Create the missing organization
        print("\n2. CREATING MISSING ORGANIZATION")
        print("-" * 40)
        
        organization_data = {
            'id': ORGANIZATION_ID,
            'name': ORGANIZATION_NAME,
            'type': ORGANIZATION_TYPE,
            'isActive': True,
            'createdAt': 'now()',
            'updatedAt': 'now()'
        }
        
        print(f"Creating organization with data:")
        print(f"   ID: {ORGANIZATION_ID}")
        print(f"   Name: {ORGANIZATION_NAME}")
        print(f"   Type: {ORGANIZATION_TYPE}")
        print(f"   isActive: True")
        
        # Insert the organization
        insert_result = supabase.table('organizations').insert(organization_data).execute()
        
        if insert_result.data:
            print(f"✅ Organization created successfully!")
            created_org = insert_result.data[0]
            print(f"   Created ID: {created_org.get('id')}")
            print(f"   Created Name: {created_org.get('name')}")
            print(f"   Created Type: {created_org.get('type')}")
        else:
            print(f"❌ Failed to create organization")
            if hasattr(insert_result, 'error') and insert_result.error:
                print(f"   Error: {insert_result.error}")
            return False
        
        # Step 3: Verify the fix
        print("\n3. VERIFYING THE FIX")
        print("-" * 40)
        
        # Check if organization now exists
        verify_org = supabase.table('organizations').select('*').eq('id', ORGANIZATION_ID).execute()
        
        if verify_org.data:
            org = verify_org.data[0]
            print(f"✅ Organization verification successful:")
            print(f"   ID: {org.get('id')}")
            print(f"   Name: {org.get('name')}")
            print(f"   Type: {org.get('type')}")
            print(f"   isActive: {org.get('isActive')}")
        else:
            print(f"❌ Organization verification failed - organization not found after creation")
            return False
        
        # Step 4: Test the session endpoint to confirm fix
        print("\n4. TESTING SESSION ENDPOINT AFTER FIX")
        print("-" * 40)
        
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            return False
        
        print(f"✅ Login successful")
        
        # Extract cookies for session request
        cookies = login_response.cookies
        
        # Test session endpoint
        session_response = requests.get(f"{BASE_URL}/api/auth/session", cookies=cookies)
        
        if session_response.status_code != 200:
            print(f"❌ Session endpoint failed: {session_response.status_code}")
            return False
        
        session_data = session_response.json()
        user_data = session_data.get('user', {})
        
        print(f"✅ Session endpoint working")
        print(f"   Email: {user_data.get('email')}")
        print(f"   Role: {user_data.get('role')}")
        print(f"   Organization ID: {user_data.get('organizationId')}")
        
        # Check if organization object is now populated
        organization_obj = user_data.get('organization')
        if organization_obj:
            print(f"✅ Organization object now populated:")
            print(f"   Organization Name: {organization_obj.get('name')}")
            print(f"   Organization Type: {organization_obj.get('type')}")
            print(f"   Organization ID: {organization_obj.get('id')}")
        else:
            print(f"❌ Organization object still missing from session response")
            return False
        
        # Step 5: Test settings page behavior simulation
        print("\n5. SETTINGS PAGE BEHAVIOR SIMULATION")
        print("-" * 40)
        
        if user_data.get('organizationId') and organization_obj:
            print("✅ Settings page should now show organization information correctly")
            print(f"   Organization: {organization_obj.get('name')} ({organization_obj.get('type')})")
            print("   Message should be: Organization details instead of 'You are not currently linked to an organization'")
        else:
            print("❌ Settings page will still show 'You are not currently linked to an organization'")
            return False
        
        # Step 6: Summary
        print("\n6. FIX SUMMARY")
        print("-" * 40)
        print("✅ ORGANIZATION DATA INTEGRITY ISSUE RESOLVED")
        print(f"   ✓ Created organization '{ORGANIZATION_NAME}' with ID '{ORGANIZATION_ID}'")
        print(f"   ✓ Organization type set to '{ORGANIZATION_TYPE}' (appropriate for superadmin)")
        print(f"   ✓ Organization is active (isActive: true)")
        print(f"   ✓ Session endpoint now returns complete organization data")
        print(f"   ✓ Settings page should now display organization information correctly")
        
        return True
        
    except Exception as e:
        print(f"❌ Fix failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_organization_fix():
    """
    Test that the organization fix is working by checking session endpoint
    """
    print("\n" + "=" * 80)
    print("TESTING ORGANIZATION FIX")
    print("=" * 80)
    
    try:
        # Login and test session
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            print(f"❌ Login test failed: {login_response.status_code}")
            return False
        
        cookies = login_response.cookies
        session_response = requests.get(f"{BASE_URL}/api/auth/session", cookies=cookies)
        
        if session_response.status_code != 200:
            print(f"❌ Session test failed: {session_response.status_code}")
            return False
        
        session_data = session_response.json()
        user_data = session_data.get('user', {})
        organization_obj = user_data.get('organization')
        
        print("SESSION ENDPOINT TEST RESULTS:")
        print(f"   Email: {user_data.get('email', 'Missing')}")
        print(f"   Role: {user_data.get('role', 'Missing')}")
        print(f"   Organization ID: {user_data.get('organizationId', 'Missing')}")
        
        if organization_obj:
            print(f"   Organization Name: {organization_obj.get('name', 'Missing')}")
            print(f"   Organization Type: {organization_obj.get('type', 'Missing')}")
            print(f"   Organization Active: {organization_obj.get('isActive', 'Missing')}")
            print("✅ ORGANIZATION FIX VERIFIED - Session returns complete organization data")
            return True
        else:
            print("❌ ORGANIZATION FIX FAILED - Organization object still missing")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    print("Starting Organization Data Fix...")
    
    # Step 1: Fix the organization data
    fix_success = fix_organization_data()
    
    if not fix_success:
        print("\n" + "=" * 80)
        print("❌ ORGANIZATION FIX FAILED")
        print("=" * 80)
        sys.exit(1)
    
    # Step 2: Test the fix
    test_success = test_organization_fix()
    
    if test_success:
        print("\n" + "=" * 80)
        print("✅ ORGANIZATION FIX COMPLETED SUCCESSFULLY")
        print("=" * 80)
        print("The superadmin user should now see organization information in settings page.")
        print("The 'You are not currently linked to an organization' message should be resolved.")
    else:
        print("\n" + "=" * 80)
        print("⚠️  ORGANIZATION FIX COMPLETED BUT VERIFICATION FAILED")
        print("=" * 80)
        print("The organization was created but session endpoint still has issues.")
        sys.exit(1)