#!/usr/bin/env python3
"""
Backend Testing Script for Recruiter Functionality
Tests the recruiter-related API endpoints as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://recruiter-sync.preview.emergentagent.com/api"
HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'Backend-Test-Script/1.0'
}

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_get_recruiters():
    """Test GET /api/recruiters endpoint"""
    print("=" * 60)
    print("TESTING GET /api/recruiters")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/recruiters", headers=HEADERS, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            total_recruiters = len(data)
            
            log_test("GET /api/recruiters - Status Code", "PASS", f"Status: {response.status_code}")
            log_test("GET /api/recruiters - Response Type", "PASS", f"Returned array with {total_recruiters} recruiters")
            
            # Check if we have the expected 161 recruiters
            if total_recruiters == 161:
                log_test("GET /api/recruiters - Total Count", "PASS", f"Expected 161 recruiters, got {total_recruiters}")
            else:
                log_test("GET /api/recruiters - Total Count", "WARN", f"Expected 161 recruiters, got {total_recruiters}")
            
            # Check structure of first recruiter if available
            if data and len(data) > 0:
                first_recruiter = data[0]
                required_fields = ['id', 'name', 'type', 'state', 'website', 'phone', 'email', 'address', 'verificationStatus', 'isActive', 'userCount']
                
                missing_fields = []
                for field in required_fields:
                    if field not in first_recruiter:
                        missing_fields.append(field)
                
                if not missing_fields:
                    log_test("GET /api/recruiters - Required Fields", "PASS", "All required fields present")
                else:
                    log_test("GET /api/recruiters - Required Fields", "FAIL", f"Missing fields: {missing_fields}")
                
                # Check for specific recruiter from Excel data
                axn_recruiter = None
                for recruiter in data:
                    if "AXN INFOTECH" in recruiter.get('name', '').upper():
                        axn_recruiter = recruiter
                        break
                
                if axn_recruiter:
                    log_test("GET /api/recruiters - Excel Data Verification", "PASS", f"Found AXN INFOTECH recruiter: {axn_recruiter['name']}")
                else:
                    log_test("GET /api/recruiters - Excel Data Verification", "WARN", "AXN INFOTECH recruiter not found in results")
                
                # Show sample recruiter data
                print("Sample Recruiter Data:")
                print(json.dumps(first_recruiter, indent=2))
                print()
                
            return data
        else:
            log_test("GET /api/recruiters - Status Code", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
            
    except Exception as e:
        log_test("GET /api/recruiters - Request", "FAIL", f"Exception: {str(e)}")
        return None

def test_get_metrics():
    """Test GET /api/metrics endpoint for activeRecruiters count"""
    print("=" * 60)
    print("TESTING GET /api/metrics - activeRecruiters")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/metrics", headers=HEADERS, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            log_test("GET /api/metrics - Status Code", "PASS", f"Status: {response.status_code}")
            
            if 'activeRecruiters' in data:
                active_recruiters = data['activeRecruiters']
                log_test("GET /api/metrics - activeRecruiters Field", "PASS", f"activeRecruiters: {active_recruiters}")
                
                if active_recruiters == 161:
                    log_test("GET /api/metrics - activeRecruiters Count", "PASS", f"Expected 161, got {active_recruiters}")
                else:
                    log_test("GET /api/metrics - activeRecruiters Count", "WARN", f"Expected 161, got {active_recruiters}")
            else:
                log_test("GET /api/metrics - activeRecruiters Field", "FAIL", "activeRecruiters field missing from response")
            
            print("Metrics Response:")
            print(json.dumps(data, indent=2))
            print()
            
            return data
        else:
            log_test("GET /api/metrics - Status Code", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return None
            
    except Exception as e:
        log_test("GET /api/metrics - Request", "FAIL", f"Exception: {str(e)}")
        return None

def test_recruiter_actions(recruiters_data):
    """Test recruiter action endpoints (approve/reject/suspend/activate)"""
    print("=" * 60)
    print("TESTING RECRUITER ACTION ENDPOINTS")
    print("=" * 60)
    
    if not recruiters_data or len(recruiters_data) == 0:
        log_test("Recruiter Actions - Prerequisites", "FAIL", "No recruiter data available for testing")
        return
    
    # Find a test recruiter (preferably one that's active)
    test_recruiter = None
    for recruiter in recruiters_data:
        if recruiter.get('isActive', True):
            test_recruiter = recruiter
            break
    
    if not test_recruiter:
        log_test("Recruiter Actions - Test Subject", "FAIL", "No active recruiter found for testing")
        return
    
    recruiter_id = test_recruiter['id']
    test_user_id = "test-user-id"  # Mock user ID for testing
    
    print(f"Using test recruiter: {test_recruiter['name']} (ID: {recruiter_id})")
    print()
    
    # Test 1: Suspend Recruiter
    try:
        suspend_payload = {
            "recruiterId": recruiter_id,
            "userId": test_user_id,
            "reason": "Testing suspend functionality"
        }
        
        response = requests.post(f"{BASE_URL}/suspend-recruiter", 
                               headers=HEADERS, 
                               json=suspend_payload, 
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                log_test("POST /api/suspend-recruiter", "PASS", f"Recruiter suspended successfully")
            else:
                log_test("POST /api/suspend-recruiter", "FAIL", f"Success flag false: {data}")
        else:
            log_test("POST /api/suspend-recruiter", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("POST /api/suspend-recruiter", "FAIL", f"Exception: {str(e)}")
    
    # Test 2: Activate Recruiter
    try:
        activate_payload = {
            "recruiterId": recruiter_id,
            "userId": test_user_id,
            "note": "Testing activate functionality"
        }
        
        response = requests.post(f"{BASE_URL}/activate-recruiter", 
                               headers=HEADERS, 
                               json=activate_payload, 
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                log_test("POST /api/activate-recruiter", "PASS", f"Recruiter activated successfully")
            else:
                log_test("POST /api/activate-recruiter", "FAIL", f"Success flag false: {data}")
        else:
            log_test("POST /api/activate-recruiter", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("POST /api/activate-recruiter", "FAIL", f"Exception: {str(e)}")
    
    # Test 3: Approve Recruiter (test with pending status)
    try:
        approve_payload = {
            "recruiterId": recruiter_id,
            "userId": test_user_id,
            "note": "Testing approve functionality"
        }
        
        response = requests.post(f"{BASE_URL}/approve-recruiter", 
                               headers=HEADERS, 
                               json=approve_payload, 
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                log_test("POST /api/approve-recruiter", "PASS", f"Recruiter approved successfully")
            else:
                log_test("POST /api/approve-recruiter", "FAIL", f"Success flag false: {data}")
        else:
            log_test("POST /api/approve-recruiter", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("POST /api/approve-recruiter", "FAIL", f"Exception: {str(e)}")
    
    # Test 4: Reject Recruiter
    try:
        reject_payload = {
            "recruiterId": recruiter_id,
            "userId": test_user_id,
            "reason": "Testing reject functionality"
        }
        
        response = requests.post(f"{BASE_URL}/reject-recruiter", 
                               headers=HEADERS, 
                               json=reject_payload, 
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                log_test("POST /api/reject-recruiter", "PASS", f"Recruiter rejected successfully")
            else:
                log_test("POST /api/reject-recruiter", "FAIL", f"Success flag false: {data}")
        else:
            log_test("POST /api/reject-recruiter", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("POST /api/reject-recruiter", "FAIL", f"Exception: {str(e)}")

def test_supabase_auth():
    """Test Supabase Auth for recruiter users"""
    print("=" * 60)
    print("TESTING SUPABASE AUTH FOR RECRUITERS")
    print("=" * 60)
    
    # Test login with recruiter credentials
    # Based on the import script, recruiters should have password "Recruiter@2025"
    
    # We'll test the login endpoint to verify auth integration
    try:
        # First, let's try to get a sample recruiter email from the recruiters endpoint
        recruiters_response = requests.get(f"{BASE_URL}/recruiters", headers=HEADERS, timeout=30)
        
        if recruiters_response.status_code == 200:
            recruiters_data = recruiters_response.json()
            
            if recruiters_data and len(recruiters_data) > 0:
                # Find a recruiter with a valid email
                test_email = None
                for recruiter in recruiters_data:
                    email = recruiter.get('email', '')
                    if email and '@' in email:
                        test_email = email
                        break
                
                if test_email:
                    log_test("Supabase Auth - Test Email Found", "PASS", f"Using email: {test_email}")
                    
                    # Test login with recruiter credentials
                    login_payload = {
                        "email": test_email,
                        "password": "Recruiter@2025"
                    }
                    
                    response = requests.post(f"{BASE_URL}/auth/login", 
                                           headers=HEADERS, 
                                           json=login_payload, 
                                           timeout=30)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('user'):
                            log_test("Supabase Auth - Recruiter Login", "PASS", f"Login successful for {test_email}")
                            print("Login Response:")
                            print(json.dumps(data, indent=2))
                            print()
                        else:
                            log_test("Supabase Auth - Recruiter Login", "FAIL", f"Login response missing user data: {data}")
                    else:
                        log_test("Supabase Auth - Recruiter Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
                else:
                    log_test("Supabase Auth - Test Email Found", "FAIL", "No valid email found in recruiter data")
            else:
                log_test("Supabase Auth - Prerequisites", "FAIL", "No recruiter data available")
        else:
            log_test("Supabase Auth - Prerequisites", "FAIL", f"Could not fetch recruiters: {recruiters_response.status_code}")
            
    except Exception as e:
        log_test("Supabase Auth - Request", "FAIL", f"Exception: {str(e)}")

def main():
    """Main test execution"""
    print("🚀 RECRUITER FUNCTIONALITY BACKEND TESTING")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # Test 1: GET /api/recruiters
    recruiters_data = test_get_recruiters()
    
    # Test 2: GET /api/metrics
    metrics_data = test_get_metrics()
    
    # Test 3: Recruiter Actions
    test_recruiter_actions(recruiters_data)
    
    # Test 4: Supabase Auth
    test_supabase_auth()
    
    print("=" * 60)
    print("🏁 TESTING COMPLETED")
    print(f"Test Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

if __name__ == "__main__":
    main()