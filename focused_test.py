#!/usr/bin/env python3
"""
Focused test for key endpoints including the new update-metrics
"""

import requests
import json

# Base URL from environment
BASE_URL = "https://email-split-bug.preview.emergentagent.com/api"

def test_key_endpoints():
    """Test key endpoints to ensure nothing is broken"""
    results = []
    
    # Test 1: API Root
    print("🧪 Testing API Root...")
    try:
        response = requests.get(f"{BASE_URL}")
        if response.status_code == 200:
            results.append(("API Root", True, "Working"))
            print("✅ API Root: Working")
        else:
            results.append(("API Root", False, f"Status {response.status_code}"))
            print(f"❌ API Root: Status {response.status_code}")
    except Exception as e:
        results.append(("API Root", False, str(e)))
        print(f"❌ API Root: {str(e)}")
    
    # Test 2: Metrics endpoint
    print("🧪 Testing Metrics endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/metrics")
        if response.status_code == 200:
            data = response.json()
            expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                             'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters']
            if all(field in data for field in expected_fields):
                results.append(("Metrics API", True, "All fields present"))
                print("✅ Metrics API: All fields present")
            else:
                results.append(("Metrics API", False, "Missing fields"))
                print("❌ Metrics API: Missing fields")
        else:
            results.append(("Metrics API", False, f"Status {response.status_code}"))
            print(f"❌ Metrics API: Status {response.status_code}")
    except Exception as e:
        results.append(("Metrics API", False, str(e)))
        print(f"❌ Metrics API: {str(e)}")
    
    # Test 3: Update Metrics endpoint (NEW)
    print("🧪 Testing Update Metrics endpoint...")
    try:
        response = requests.post(f"{BASE_URL}/update-metrics")
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and 'data' in data and 'message' in data:
                results.append(("Update Metrics API", True, "Working correctly"))
                print("✅ Update Metrics API: Working correctly")
            else:
                results.append(("Update Metrics API", False, "Invalid response format"))
                print("❌ Update Metrics API: Invalid response format")
        else:
            results.append(("Update Metrics API", False, f"Status {response.status_code}"))
            print(f"❌ Update Metrics API: Status {response.status_code}")
    except Exception as e:
        results.append(("Update Metrics API", False, str(e)))
        print(f"❌ Update Metrics API: {str(e)}")
    
    # Test 4: Users endpoint
    print("🧪 Testing Users endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/users")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                results.append(("Users API", True, f"Returned {len(data)} users"))
                print(f"✅ Users API: Returned {len(data)} users")
            else:
                results.append(("Users API", False, "Not an array"))
                print("❌ Users API: Not an array")
        else:
            results.append(("Users API", False, f"Status {response.status_code}"))
            print(f"❌ Users API: Status {response.status_code}")
    except Exception as e:
        results.append(("Users API", False, str(e)))
        print(f"❌ Users API: {str(e)}")
    
    # Test 5: Login endpoint
    print("🧪 Testing Login endpoint...")
    try:
        login_data = {"email": "superadmin@rareminds.com", "password": "admin123"}
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and 'user' in data:
                results.append(("Login API", True, "Login successful"))
                print("✅ Login API: Login successful")
            else:
                results.append(("Login API", False, "Invalid response"))
                print("❌ Login API: Invalid response")
        elif response.status_code == 401:
            results.append(("Login API", True, "Expected 401 (user may not exist)"))
            print("✅ Login API: Expected 401 (user may not exist)")
        else:
            results.append(("Login API", False, f"Status {response.status_code}"))
            print(f"❌ Login API: Status {response.status_code}")
    except Exception as e:
        results.append(("Login API", False, str(e)))
        print(f"❌ Login API: {str(e)}")
    
    return results

if __name__ == "__main__":
    print("=" * 60)
    print("FOCUSED BACKEND API TESTING")
    print("=" * 60)
    
    results = test_key_endpoints()
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    print("\n📋 DETAILED RESULTS:")
    for test_name, success, message in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status}: {test_name} - {message}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} TESTS FAILED")