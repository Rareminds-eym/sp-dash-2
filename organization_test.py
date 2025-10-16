#!/usr/bin/env python3

import requests
import json
import sys
from supabase import create_client, Client

# Configuration
BASE_URL = "https://dashboard-parity.preview.emergentagent.com"
SUPABASE_URL = "https://dpooleduinyyzxgrcwko.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb29sZWR1aW55eXp4Z3Jjd2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDY5OCwiZXhwIjoyMDc1NTcwNjk4fQ.WIrwkA_-2oCjwmD6WpCf9N38hYXEwrIIXXHB4x5km10"

# Test credentials
TEST_EMAIL = "superadmin@rareminds.in"
TEST_PASSWORD = "password123"

def test_organization_data_investigation():
    """
    Comprehensive test to investigate organization data issue for superadmin user.
    Tests the session endpoint and database queries to identify the root cause.
    """
    print("=" * 80)
    print("ORGANIZATION DATA INVESTIGATION FOR SUPERADMIN USER")
    print("=" * 80)
    
    # Initialize Supabase client for direct database queries
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        # Step 1: Login as superadmin to get session
        print("\n1. TESTING LOGIN AUTHENTICATION")
        print("-" * 40)
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        print(f"Login Status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return False
            
        login_data = login_response.json()
        print(f"✅ Login successful for: {login_data.get('user', {}).get('email', 'Unknown')}")
        
        # Extract cookies for session requests
        cookies = login_response.cookies
        
        # Step 2: Test session endpoint
        print("\n2. TESTING SESSION ENDPOINT")
        print("-" * 40)
        
        session_response = requests.get(f"{BASE_URL}/api/auth/session", cookies=cookies)
        print(f"Session Status: {session_response.status_code}")
        
        if session_response.status_code != 200:
            print(f"❌ Session failed: {session_response.text}")
            return False
            
        session_data = session_response.json()
        print(f"✅ Session endpoint working")
        
        # Analyze session data
        user_data = session_data.get('user', {})
        print(f"\nSESSION DATA ANALYSIS:")
        print(f"- Email: {user_data.get('email', 'Missing')}")
        print(f"- Role: {user_data.get('role', 'Missing')}")
        print(f"- Name: {user_data.get('name', 'Missing')}")
        print(f"- Organization ID: {user_data.get('organizationId', 'Missing')}")
        print(f"- Organization Object: {user_data.get('organization', 'Missing')}")
        
        organization_id = user_data.get('organizationId')
        organization_obj = user_data.get('organization')
        
        # Step 3: Direct database query for user data
        print("\n3. DIRECT DATABASE QUERY - USERS TABLE")
        print("-" * 40)
        
        try:
            user_query = supabase.table('users').select('*').eq('email', TEST_EMAIL).execute()
            
            if user_query.data:
                db_user = user_query.data[0]
                print(f"✅ User found in database")
                print(f"- User ID: {db_user.get('id', 'Missing')}")
                print(f"- Email: {db_user.get('email', 'Missing')}")
                print(f"- Role: {db_user.get('role', 'Missing')}")
                print(f"- Organization ID: {db_user.get('organizationId', 'Missing')}")
                print(f"- Is Active: {db_user.get('isActive', 'Missing')}")
                print(f"- Metadata: {db_user.get('metadata', 'Missing')}")
                
                db_org_id = db_user.get('organizationId')
                
                # Step 4: Check if organizationId exists and query organizations table
                print("\n4. ORGANIZATION DATA VERIFICATION")
                print("-" * 40)
                
                if db_org_id:
                    print(f"✅ User has organizationId: {db_org_id}")
                    
                    # Query organizations table
                    org_query = supabase.table('organizations').select('*').eq('id', db_org_id).execute()
                    
                    if org_query.data:
                        db_org = org_query.data[0]
                        print(f"✅ Organization found in database")
                        print(f"- Organization ID: {db_org.get('id', 'Missing')}")
                        print(f"- Name: {db_org.get('name', 'Missing')}")
                        print(f"- Type: {db_org.get('type', 'Missing')}")
                        print(f"- Is Active: {db_org.get('isActive', 'Missing')}")
                        
                        # Compare session data with database data
                        print("\n5. DATA CONSISTENCY CHECK")
                        print("-" * 40)
                        
                        session_org_id = user_data.get('organizationId')
                        session_org = user_data.get('organization')
                        
                        print(f"Session organizationId: {session_org_id}")
                        print(f"Database organizationId: {db_org_id}")
                        print(f"Match: {'✅' if session_org_id == db_org_id else '❌'}")
                        
                        if session_org:
                            print(f"\nSession organization object:")
                            print(f"- ID: {session_org.get('id', 'Missing')}")
                            print(f"- Name: {session_org.get('name', 'Missing')}")
                            print(f"- Type: {session_org.get('type', 'Missing')}")
                            
                            print(f"\nDatabase organization object:")
                            print(f"- ID: {db_org.get('id', 'Missing')}")
                            print(f"- Name: {db_org.get('name', 'Missing')}")
                            print(f"- Type: {db_org.get('type', 'Missing')}")
                            
                            # Check if data matches
                            org_match = (
                                session_org.get('id') == db_org.get('id') and
                                session_org.get('name') == db_org.get('name') and
                                session_org.get('type') == db_org.get('type')
                            )
                            print(f"Organization data match: {'✅' if org_match else '❌'}")
                        else:
                            print(f"❌ Session organization object is missing despite organizationId being present")
                            
                    else:
                        print(f"❌ Organization with ID {db_org_id} NOT found in organizations table")
                        print("This is a REFERENTIAL INTEGRITY ISSUE - user references non-existent organization")
                        
                        # List all organizations to see what's available
                        all_orgs = supabase.table('organizations').select('id, name, type').execute()
                        print(f"\nAvailable organizations in database:")
                        for org in all_orgs.data[:5]:  # Show first 5
                            print(f"- ID: {org.get('id')}, Name: {org.get('name')}, Type: {org.get('type')}")
                        
                else:
                    print(f"❌ User has NO organizationId in database")
                    print("This is a DATA ISSUE - user is not linked to any organization")
                    
            else:
                print(f"❌ User {TEST_EMAIL} NOT found in users table")
                
        except Exception as db_error:
            print(f"❌ Database query error: {str(db_error)}")
            
        # Step 6: Test settings page behavior simulation
        print("\n6. SETTINGS PAGE BEHAVIOR SIMULATION")
        print("-" * 40)
        
        # This simulates what the settings page would check
        if organization_id and organization_obj:
            print("✅ Settings page should show organization information")
            print(f"Organization: {organization_obj.get('name', 'Unknown')} ({organization_obj.get('type', 'Unknown')})")
        elif organization_id and not organization_obj:
            print("⚠️  Settings page might show 'You are not currently linked to an organization'")
            print("Reason: organizationId exists but organization object is null (referential integrity issue)")
        elif not organization_id:
            print("❌ Settings page will show 'You are not currently linked to an organization'")
            print("Reason: No organizationId in user data")
        
        # Step 7: Summary and recommendations
        print("\n7. ISSUE DIAGNOSIS & RECOMMENDATIONS")
        print("-" * 40)
        
        if not organization_id:
            print("🔍 ROOT CAUSE: User has no organizationId")
            print("📋 RECOMMENDATION: Update user record to assign organizationId")
        elif organization_id and not organization_obj:
            print("🔍 ROOT CAUSE: Referential integrity issue - organizationId exists but organization doesn't")
            print("📋 RECOMMENDATION: Either create the missing organization or update user's organizationId")
        elif organization_id and organization_obj:
            print("🔍 ROOT CAUSE: Data appears correct - possible frontend issue")
            print("📋 RECOMMENDATION: Check frontend settings page logic")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    print("Starting Organization Data Investigation...")
    success = test_organization_data_investigation()
    
    if success:
        print("\n" + "=" * 80)
        print("✅ INVESTIGATION COMPLETED SUCCESSFULLY")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("❌ INVESTIGATION FAILED")
        print("=" * 80)
        sys.exit(1)