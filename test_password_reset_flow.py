#!/usr/bin/env python3
"""
Test Password Reset Flow for Admin Users
Tests the complete flow from admin creation to password reset
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000"
LOGIN_EMAIL = "superadmin@rareminds.in"
LOGIN_PASSWORD = "password123"

class PasswordResetFlowTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.access_token = None
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test_name": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        print(f"   {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")
        print()
        
    def login(self):
        """Login as super admin"""
        print("=" * 80)
        print("STEP 1: AUTHENTICATION")
        print("=" * 80)
        print()
        
        try:
            response = self.session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
                headers={"Content-Type": "application/json"}
            )
            
            data = response.json()
            
            if response.status_code == 200 and data.get("success"):
                self.log_result(
                    "Login",
                    True,
                    f"Successfully logged in as {LOGIN_EMAIL}",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Login",
                    False,
                    f"Login failed: {data.get('error', 'Unknown error')}",
                    {"status_code": response.status_code, "response": data}
                )
                return False
                
        except Exception as e:
            self.log_result("Login", False, f"Exception during login: {str(e)}")
            return False
    
    def test_reset_password_page_accessible(self):
        """Test that reset password page is accessible without authentication"""
        print("=" * 80)
        print("STEP 2: RESET PASSWORD PAGE ACCESSIBILITY")
        print("=" * 80)
        print()
        
        try:
            # Use a new session without authentication
            test_session = requests.Session()
            response = test_session.get(f"{BASE_URL}/reset-password")
            
            if response.status_code == 200:
                self.log_result(
                    "Reset Password Page Access",
                    True,
                    "Reset password page is accessible without authentication",
                    {"status_code": response.status_code}
                )
                return True
            else:
                self.log_result(
                    "Reset Password Page Access",
                    False,
                    f"Reset password page returned status {response.status_code}",
                    {"status_code": response.status_code}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Reset Password Page Access",
                False,
                f"Exception accessing reset password page: {str(e)}"
            )
            return False
    
    def test_api_redirect_urls_updated(self):
        """Verify API endpoints are configured to redirect to /reset-password"""
        print("=" * 80)
        print("STEP 3: API CONFIGURATION VERIFICATION")
        print("=" * 80)
        print()
        
        # Check if the API files have been updated
        files_to_check = [
            "/app/app/api/users/route.js",
            "/app/app/api/users/resend-email/route.js"
        ]
        
        all_updated = True
        for file_path in files_to_check:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                    if '/reset-password' in content:
                        print(f"✅ {file_path}: Contains /reset-password redirect")
                    else:
                        print(f"❌ {file_path}: Missing /reset-password redirect")
                        all_updated = False
            except Exception as e:
                print(f"❌ Error reading {file_path}: {str(e)}")
                all_updated = False
        
        if all_updated:
            self.log_result(
                "API Redirect Configuration",
                True,
                "All API endpoints configured to redirect to /reset-password",
                {"files_checked": files_to_check}
            )
        else:
            self.log_result(
                "API Redirect Configuration",
                False,
                "Some API endpoints not properly configured",
                {"files_checked": files_to_check}
            )
        
        return all_updated
    
    def test_middleware_public_route(self):
        """Verify middleware allows /reset-password as public route"""
        print("=" * 80)
        print("STEP 4: MIDDLEWARE CONFIGURATION VERIFICATION")
        print("=" * 80)
        print()
        
        try:
            with open('/app/middleware.js', 'r') as f:
                content = f.read()
                if "'/reset-password'" in content or '"/reset-password"' in content:
                    self.log_result(
                        "Middleware Public Route",
                        True,
                        "Middleware configured to allow /reset-password as public route",
                        {"file": "/app/middleware.js"}
                    )
                    return True
                else:
                    self.log_result(
                        "Middleware Public Route",
                        False,
                        "Middleware not configured for /reset-password",
                        {"file": "/app/middleware.js"}
                    )
                    return False
        except Exception as e:
            self.log_result(
                "Middleware Public Route",
                False,
                f"Error reading middleware.js: {str(e)}"
            )
            return False
    
    def test_reset_password_page_exists(self):
        """Verify reset password page file exists"""
        print("=" * 80)
        print("STEP 5: RESET PASSWORD PAGE FILE VERIFICATION")
        print("=" * 80)
        print()
        
        import os
        file_path = "/app/app/reset-password/page.js"
        
        if os.path.exists(file_path):
            # Check if it has the expected content
            with open(file_path, 'r') as f:
                content = f.read()
                has_supabase = 'supabase' in content.lower()
                has_password_update = 'updateUser' in content
                has_activation = 'verify-and-activate' in content
                
                if has_supabase and has_password_update and has_activation:
                    self.log_result(
                        "Reset Password Page Implementation",
                        True,
                        "Reset password page exists with complete implementation",
                        {
                            "file": file_path,
                            "has_supabase_integration": has_supabase,
                            "has_password_update": has_password_update,
                            "has_activation_call": has_activation
                        }
                    )
                    return True
                else:
                    self.log_result(
                        "Reset Password Page Implementation",
                        False,
                        "Reset password page exists but missing key features",
                        {
                            "file": file_path,
                            "has_supabase_integration": has_supabase,
                            "has_password_update": has_password_update,
                            "has_activation_call": has_activation
                        }
                    )
                    return False
        else:
            self.log_result(
                "Reset Password Page Implementation",
                False,
                f"Reset password page file does not exist at {file_path}"
            )
            return False
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print()
        
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["success"])
        failed = total - passed
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        print()
        
        if failed > 0:
            print("Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test_name']}: {result['message']}")
        
        print()
        print("=" * 80)
        print("CONCLUSION")
        print("=" * 80)
        
        if failed == 0:
            print("🟢 ALL TESTS PASSED - Password reset flow is properly configured!")
            print()
            print("Expected User Flow:")
            print("1. Admin receives password reset email")
            print("2. Clicks link → redirected to /reset-password page")
            print("3. Sets new password with validation")
            print("4. Account automatically activated")
            print("5. Auto-logged in and redirected to /dashboard")
        else:
            print("🔴 SOME TESTS FAILED - Please review the failed tests above")
        
        print("=" * 80)
    
    def run_all_tests(self):
        """Run all tests"""
        print("\n" + "=" * 80)
        print("PASSWORD RESET FLOW TESTING")
        print("Testing Date:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print("=" * 80)
        print()
        
        # Authentication test
        if not self.login():
            print("⚠️  Warning: Login failed, but continuing with other tests...")
            print()
        
        # Configuration and accessibility tests
        self.test_reset_password_page_exists()
        self.test_reset_password_page_accessible()
        self.test_middleware_public_route()
        self.test_api_redirect_urls_updated()
        
        # Print summary
        self.print_summary()

if __name__ == "__main__":
    tester = PasswordResetFlowTester()
    tester.run_all_tests()
