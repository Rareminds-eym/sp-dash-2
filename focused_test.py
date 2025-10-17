#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime


# Configuration
BASE_URL = "https://skill-export-filter.preview.emergentagent.com"
TEST_EMAIL = "superadmin@rareminds.in"
TEST_PASSWORD = "password123"

def print_separator(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")

def print_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")

def login_and_get_session():
    """Login and return session cookies for authenticated requests"""
    print_separator("AUTHENTICATION SETUP")
    
    # Step 1: Login
    login_url = f"{BASE_URL}/api/auth/login"
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    print(f"🔐 Logging in with {TEST_EMAIL}...")
    login_response = requests.post(login_url, json=login_data)
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"Response: {login_response.text}")
        return None
    
    print("✅ Login successful")
    return login_response.cookies

def test_session_endpoint(cookies):
    """Test /api/auth/session endpoint for complete user data"""
    print_separator("TESTING SESSION ENDPOINT")
    
    session_url = f"{BASE_URL}/api/auth/session"
    
    try:
        print(f"📡 Testing GET {session_url}")
        response = requests.get(session_url, cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result("Session endpoint response", False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print_result("Session JSON parsing", False, f"Invalid JSON: {e}")
            return False
        
        print(f"Response JSON: {json.dumps(data, indent=2)}")
        
        # Check if response has success field
        if not data.get('success'):
            print_result("Session success field", False, f"success={data.get('success')}")
            return False
        
        user = data.get('user')
        if not user:
            print_result("Session user object", False, "No user object in response")
            return False
        
        # Test specific fields requested in review
        tests_passed = 0
        total_tests = 4
        
        # Test 1: Email is present
        if user.get('email'):
            print_result("Email field present", True, f"email={user.get('email')}")
            tests_passed += 1
        else:
            print_result("Email field present", False, "Email field missing or empty")
        
        # Test 2: Role is present
        if user.get('role'):
            print_result("Role field present", True, f"role={user.get('role')}")
            tests_passed += 1
        else:
            print_result("Role field present", False, "Role field missing or empty")
        
        # Test 3: Name is extracted from metadata or user_metadata
        if user.get('name'):
            print_result("Name field present", True, f"name={user.get('name')}")
            tests_passed += 1
        else:
            print_result("Name field present", False, "Name field missing or empty")
        
        # Test 4: OrganizationId is present
        if user.get('organizationId'):
            print_result("OrganizationId field present", True, f"organizationId={user.get('organizationId')}")
            tests_passed += 1
        else:
            print_result("OrganizationId field present", False, "OrganizationId field missing or empty")
        
        print(f"\n📊 Session Endpoint Summary: {tests_passed}/{total_tests} tests passed")
        return tests_passed == total_tests
        
    except Exception as e:
        print_result("Session endpoint test", False, f"Exception: {e}")
        return False

def test_passports_endpoint(cookies):
    """Test /api/passports endpoint for student data with user metadata"""
    print_separator("TESTING PASSPORTS ENDPOINT")
    
    passports_url = f"{BASE_URL}/api/passports"
    
    try:
        print(f"📡 Testing GET {passports_url}")
        response = requests.get(passports_url, cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result("Passports endpoint response", False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        try:
            passports = response.json()
        except json.JSONDecodeError as e:
            print_result("Passports JSON parsing", False, f"Invalid JSON: {e}")
            return False
        
        if not isinstance(passports, list):
            print_result("Passports response format", False, "Expected array of passports")
            return False
        
        print(f"Found {len(passports)} passports")
        
        if len(passports) == 0:
            print_result("Passports data availability", False, "No passports found for testing")
            return False
        
        # Test the first passport for required structure
        passport = passports[0]
        print(f"Testing passport structure: {json.dumps(passport, indent=2)}")
        
        tests_passed = 0
        total_tests = 4
        
        # Test 1: Passport has students field
        if 'students' in passport:
            print_result("Passport has students field", True)
            tests_passed += 1
            
            student = passport['students']
            if student:
                # Test 2: Student has users field with metadata
                if 'users' in student and student['users']:
                    user_data = student['users']
                    print_result("Student has users field", True, f"users data: {user_data}")
                    tests_passed += 1
                    
                    # Test 3: Users field contains email
                    if user_data.get('email'):
                        print_result("Student user email present", True, f"email={user_data.get('email')}")
                        tests_passed += 1
                    else:
                        print_result("Student user email present", False, "Email missing in users field")
                    
                    # Test 4: Users field contains metadata with name OR profile has name
                    name_found = False
                    name_source = ""
                    
                    # Check users.metadata.name
                    if user_data.get('metadata') and user_data['metadata'].get('name'):
                        name_found = True
                        name_source = f"users.metadata.name={user_data['metadata']['name']}"
                    
                    # Check students.profile.name (if profile exists)
                    elif student.get('profile') and student['profile'].get('name'):
                        name_found = True
                        name_source = f"students.profile.name={student['profile']['name']}"
                    
                    if name_found:
                        print_result("Student name accessible", True, name_source)
                        tests_passed += 1
                    else:
                        print_result("Student name accessible", False, "Name not found in users.metadata or students.profile")
                        print(f"   Available user metadata: {user_data.get('metadata', {})}")
                        print(f"   Available student profile: {student.get('profile', {})}")
                
                else:
                    print_result("Student has users field", False, "users field missing or empty")
            else:
                print_result("Student data present", False, "students field is null")
        else:
            print_result("Passport has students field", False, "students field missing")
        
        print(f"\n📊 Passports Endpoint Summary: {tests_passed}/{total_tests} tests passed")
        return tests_passed == total_tests
        
    except Exception as e:
        print_result("Passports endpoint test", False, f"Exception: {e}")
        return False

def main():
    print_separator("FOCUSED BACKEND TESTING - USER REPORTED ISSUES")
    print(f"Testing specific functionality fixes:")
    print(f"1. /api/passports endpoint - student data with user metadata")
    print(f"2. /api/auth/session endpoint - complete user data")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    
    # Step 1: Login and get session
    cookies = login_and_get_session()
    if not cookies:
        print("❌ Cannot proceed without authentication")
        sys.exit(1)
    
    # Step 2: Test session endpoint
    session_success = test_session_endpoint(cookies)
    
    # Step 3: Test passports endpoint
    passports_success = test_passports_endpoint(cookies)
    
    # Final summary
    print_separator("FINAL TEST RESULTS")
    
    total_success = session_success and passports_success
    
    if session_success:
        print("✅ Session endpoint: All required fields present (email, role, name, organizationId)")
    else:
        print("❌ Session endpoint: Missing required fields or structure issues")
    
    if passports_success:
        print("✅ Passports endpoint: Student data with user metadata working correctly")
    else:
        print("❌ Passports endpoint: Issues with student user metadata structure")
    
    if total_success:
        print("\n🎉 ALL TESTS PASSED - Both reported issues appear to be resolved")
        sys.exit(0)
    else:
        print("\n⚠️  SOME TESTS FAILED - Issues still need attention")
        sys.exit(1)

if __name__ == "__main__":
    main()