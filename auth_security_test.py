#!/usr/bin/env python3
"""
Authentication Security Testing Suite
Tests the JWT security fixes and getUser() implementation
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://passport-paginate.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
VALID_CREDENTIALS = {
    "email": "superadmin@rareminds.in",
    "password": "password123"
}

INVALID_CREDENTIALS = {
    "email": "invalid@test.com", 
    "password": "wrongpassword"
}

class AuthSecurityTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def test_login_flow(self):
        """Test complete authentication flow with valid credentials"""
        print("\n=== Testing Login Flow ===")
        
        try:
            # Test valid login
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json=VALID_CREDENTIALS,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("user"):
                    user = data["user"]
                    required_fields = ["email", "role", "name", "organizationId"]
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if not missing_fields:
                        self.log_result(
                            "Valid Login", True,
                            f"Login successful for {user['email']} with role {user['role']}",
                            f"User data: {json.dumps(user, indent=2)}"
                        )
                        return True
                    else:
                        self.log_result(
                            "Valid Login", False,
                            f"Missing required user fields: {missing_fields}",
                            f"Response: {json.dumps(data, indent=2)}"
                        )
                else:
                    self.log_result(
                        "Valid Login", False,
                        "Login response missing success flag or user data",
                        f"Response: {json.dumps(data, indent=2)}"
                    )
            else:
                self.log_result(
                    "Valid Login", False,
                    f"Login failed with status {response.status_code}",
                    f"Response: {response.text}"
                )
                
        except Exception as e:
            self.log_result("Valid Login", False, f"Login request failed: {str(e)}")
            
        return False
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        print("\n=== Testing Invalid Login ===")
        
        try:
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json=INVALID_CREDENTIALS,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if not data.get("success") and data.get("error"):
                    self.log_result(
                        "Invalid Login", True,
                        "Invalid credentials properly rejected",
                        f"Error message: {data['error']}"
                    )
                    return True
                else:
                    self.log_result(
                        "Invalid Login", False,
                        "Response format incorrect for invalid login",
                        f"Response: {json.dumps(data, indent=2)}"
                    )
            else:
                self.log_result(
                    "Invalid Login", False,
                    f"Expected 401 status, got {response.status_code}",
                    f"Response: {response.text}"
                )
                
        except Exception as e:
            self.log_result("Invalid Login", False, f"Invalid login test failed: {str(e)}")
            
        return False
    
    def test_session_api_valid(self):
        """Test session API with valid authentication"""
        print("\n=== Testing Session API (Valid) ===")
        
        # First login to get valid session
        login_success = self.test_login_flow()
        if not login_success:
            self.log_result("Session API Valid", False, "Cannot test session API - login failed")
            return False
            
        try:
            # Test session endpoint
            response = self.session.get(f"{API_BASE}/auth/session")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("user"):
                    user = data["user"]
                    required_fields = ["email", "role", "name", "organizationId"]
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if not missing_fields:
                        self.log_result(
                            "Session API Valid", True,
                            f"Session API returned complete user data for {user['email']}",
                            f"User data: {json.dumps(user, indent=2)}"
                        )
                        return True
                    else:
                        self.log_result(
                            "Session API Valid", False,
                            f"Session API missing required fields: {missing_fields}",
                            f"Response: {json.dumps(data, indent=2)}"
                        )
                else:
                    self.log_result(
                        "Session API Valid", False,
                        "Session API response missing success flag or user data",
                        f"Response: {json.dumps(data, indent=2)}"
                    )
            else:
                self.log_result(
                    "Session API Valid", False,
                    f"Session API failed with status {response.status_code}",
                    f"Response: {response.text}"
                )
                
        except Exception as e:
            self.log_result("Session API Valid", False, f"Session API test failed: {str(e)}")
            
        return False
    
    def test_session_api_invalid(self):
        """Test session API without authentication"""
        print("\n=== Testing Session API (Invalid) ===")
        
        # Create new session without authentication
        test_session = requests.Session()
        
        try:
            response = test_session.get(f"{API_BASE}/auth/session")
            
            if response.status_code == 401:
                data = response.json()
                if not data.get("success") and data.get("error"):
                    self.log_result(
                        "Session API Invalid", True,
                        "Session API properly rejects unauthenticated requests",
                        f"Error message: {data['error']}"
                    )
                    return True
                else:
                    self.log_result(
                        "Session API Invalid", False,
                        "Response format incorrect for unauthenticated session",
                        f"Response: {json.dumps(data, indent=2)}"
                    )
            else:
                self.log_result(
                    "Session API Invalid", False,
                    f"Expected 401 status for unauthenticated session, got {response.status_code}",
                    f"Response: {response.text}"
                )
                
        except Exception as e:
            self.log_result("Session API Invalid", False, f"Unauthenticated session test failed: {str(e)}")
            
        return False
    
    def test_protected_route_access(self):
        """Test that protected routes work with valid authentication"""
        print("\n=== Testing Protected Route Access ===")
        
        # Ensure we have valid session
        if not self.test_login_flow():
            self.log_result("Protected Route Access", False, "Cannot test protected routes - login failed")
            return False
            
        try:
            # Test accessing a protected API endpoint
            response = self.session.get(f"{API_BASE}/metrics")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and len(data) > 0:
                    self.log_result(
                        "Protected Route Access", True,
                        "Protected route accessible with valid authentication",
                        f"Metrics data keys: {list(data.keys())}"
                    )
                    return True
                else:
                    self.log_result(
                        "Protected Route Access", False,
                        "Protected route returned empty or invalid data",
                        f"Response: {json.dumps(data, indent=2)}"
                    )
            else:
                self.log_result(
                    "Protected Route Access", False,
                    f"Protected route failed with status {response.status_code}",
                    f"Response: {response.text}"
                )
                
        except Exception as e:
            self.log_result("Protected Route Access", False, f"Protected route test failed: {str(e)}")
            
        return False
    
    def test_protected_route_without_auth(self):
        """Test that protected routes reject unauthenticated requests"""
        print("\n=== Testing Protected Route Without Auth ===")
        
        # Note: API routes are not protected by middleware (by design)
        # Frontend routes are protected by middleware
        # This test verifies the middleware configuration is working as expected
        
        # Create new session without authentication
        test_session = requests.Session()
        
        try:
            # Test a frontend route that should be protected
            response = test_session.get(f"{BASE_URL}/dashboard", allow_redirects=False)
            
            # Should redirect to login (302 or 307) for frontend routes
            if response.status_code in [302, 307]:
                location = response.headers.get('Location', '')
                if 'login' in location.lower() or location == '/login':
                    self.log_result(
                        "Protected Route Without Auth", True,
                        f"Protected frontend route properly redirects to login: {location} (status {response.status_code})"
                    )
                    return True
                else:
                    self.log_result(
                        "Protected Route Without Auth", False,
                        f"Protected route redirected but not to login: {location}"
                    )
            elif response.status_code in [401, 403]:
                self.log_result(
                    "Protected Route Without Auth", True,
                    f"Protected route properly rejects unauthenticated requests (status {response.status_code})"
                )
                return True
            else:
                self.log_result(
                    "Protected Route Without Auth", False,
                    f"Protected route should redirect or reject unauthenticated access, got status {response.status_code}",
                    f"Response: {response.text[:200]}"
                )
                
        except Exception as e:
            self.log_result("Protected Route Without Auth", False, f"Protected route auth test failed: {str(e)}")
            
        return False
    
    def test_jwt_error_handling(self):
        """Test JWT error handling scenarios"""
        print("\n=== Testing JWT Error Handling ===")
        
        # Test with malformed JWT token
        test_session = requests.Session()
        
        # Set invalid JWT cookie
        test_session.cookies.set('sb-access-token', 'invalid.jwt.token')
        test_session.cookies.set('sb-refresh-token', 'invalid.refresh.token')
        
        try:
            response = test_session.get(f"{API_BASE}/auth/session")
            
            if response.status_code == 401:
                data = response.json()
                if not data.get("success") and data.get("error"):
                    error_msg = data["error"].lower()
                    # Accept various authentication error messages as valid
                    valid_errors = ["jwt", "expired", "authentication", "auth session missing", "invalid", "token"]
                    if any(err in error_msg for err in valid_errors):
                        self.log_result(
                            "JWT Error Handling", True,
                            "JWT/Auth errors handled gracefully with proper error messages",
                            f"Error message: {data['error']}"
                        )
                        return True
                    else:
                        self.log_result(
                            "JWT Error Handling", False,
                            f"JWT error message not descriptive enough: {data['error']}"
                        )
                else:
                    self.log_result(
                        "JWT Error Handling", False,
                        "JWT error response format incorrect",
                        f"Response: {json.dumps(data, indent=2)}"
                    )
            else:
                self.log_result(
                    "JWT Error Handling", False,
                    f"Expected 401 for invalid JWT, got {response.status_code}",
                    f"Response: {response.text}"
                )
                
        except Exception as e:
            self.log_result("JWT Error Handling", False, f"JWT error handling test failed: {str(e)}")
            
        return False
    
    def test_user_data_consistency(self):
        """Test that user data is consistent between login and session APIs"""
        print("\n=== Testing User Data Consistency ===")
        
        try:
            # Get user data from login
            login_response = self.session.post(
                f"{API_BASE}/auth/login",
                json=VALID_CREDENTIALS,
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code != 200:
                self.log_result("User Data Consistency", False, "Login failed for consistency test")
                return False
                
            login_data = login_response.json()
            login_user = login_data.get("user", {})
            
            # Get user data from session
            session_response = self.session.get(f"{API_BASE}/auth/session")
            
            if session_response.status_code != 200:
                self.log_result("User Data Consistency", False, "Session API failed for consistency test")
                return False
                
            session_data = session_response.json()
            session_user = session_data.get("user", {})
            
            # Compare key fields
            key_fields = ["email", "role", "name", "organizationId"]
            inconsistencies = []
            
            for field in key_fields:
                login_value = login_user.get(field)
                session_value = session_user.get(field)
                if login_value != session_value:
                    inconsistencies.append(f"{field}: login='{login_value}' vs session='{session_value}'")
            
            if not inconsistencies:
                self.log_result(
                    "User Data Consistency", True,
                    "User data consistent between login and session APIs",
                    f"Verified fields: {key_fields}"
                )
                return True
            else:
                self.log_result(
                    "User Data Consistency", False,
                    f"User data inconsistencies found: {', '.join(inconsistencies)}"
                )
                
        except Exception as e:
            self.log_result("User Data Consistency", False, f"User data consistency test failed: {str(e)}")
            
        return False
    
    def run_all_tests(self):
        """Run all authentication security tests"""
        print("🔐 AUTHENTICATION SECURITY TESTING SUITE")
        print("=" * 50)
        
        tests = [
            self.test_login_flow,
            self.test_invalid_login,
            self.test_session_api_valid,
            self.test_session_api_invalid,
            self.test_protected_route_access,
            self.test_protected_route_without_auth,
            self.test_jwt_error_handling,
            self.test_user_data_consistency
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed += 1
            except Exception as e:
                print(f"❌ Test {test.__name__} crashed: {str(e)}")
        
        print(f"\n{'='*50}")
        print(f"🔐 AUTHENTICATION SECURITY TEST RESULTS")
        print(f"{'='*50}")
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if passed == total:
            print("🎉 ALL AUTHENTICATION SECURITY TESTS PASSED!")
            print("✅ JWT security fixes working correctly")
            print("✅ getUser() implementation secure")
            print("✅ Error handling robust")
        else:
            print("⚠️  Some authentication security tests failed")
            print("🔍 Review failed tests above for details")
        
        return passed == total

if __name__ == "__main__":
    tester = AuthSecurityTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)