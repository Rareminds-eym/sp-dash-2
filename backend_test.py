#!/usr/bin/env python3
"""
Rareminds Super Admin Dashboard Backend API Tests
Tests all backend APIs for the Super Admin Dashboard with Supabase backend
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from environment
BASE_URL = "https://sleek-dash-2.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.user_id = None
        self.passport_id = None
        self.target_user_id = None
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'response_data': response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        
    def test_api_root(self):
        """Test GET /api - API root endpoint"""
        try:
            response = requests.get(f"{self.base_url}")
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'endpoints' in data:
                    self.log_result("API Root", True, "API root endpoint working correctly", data)
                    return True
                else:
                    self.log_result("API Root", False, "API root response missing required fields")
                    return False
            else:
                self.log_result("API Root", False, f"API root returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("API Root", False, f"API root request failed: {str(e)}")
            return False
    
    def test_metrics_endpoint(self):
        """Test GET /api/metrics - Dashboard metrics"""
        try:
            response = requests.get(f"{self.base_url}/metrics")
            if response.status_code == 200:
                data = response.json()
                # Check for expected metric fields
                expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                                 'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters']
                
                has_all_fields = all(field in data for field in expected_fields)
                if has_all_fields:
                    self.log_result("Metrics API", True, "Metrics endpoint returned all expected fields", data)
                    return True
                else:
                    missing_fields = [field for field in expected_fields if field not in data]
                    self.log_result("Metrics API", False, f"Missing fields: {missing_fields}")
                    return False
            else:
                self.log_result("Metrics API", False, f"Metrics endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Metrics API", False, f"Metrics request failed: {str(e)}")
            return False
    
    def test_analytics_trends(self):
        """Test GET /api/analytics/trends - Trend data"""
        try:
            response = requests.get(f"{self.base_url}/analytics/trends")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Analytics Trends", True, f"Trends endpoint returned {len(data)} data points", data[:2] if data else [])
                    return True
                else:
                    self.log_result("Analytics Trends", False, "Trends endpoint should return an array")
                    return False
            else:
                self.log_result("Analytics Trends", False, f"Trends endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Analytics Trends", False, f"Trends request failed: {str(e)}")
            return False
    
    def test_analytics_state_wise(self):
        """Test GET /api/analytics/state-wise - State-wise distribution"""
        try:
            response = requests.get(f"{self.base_url}/analytics/state-wise")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Analytics State-wise", True, f"State-wise endpoint returned {len(data)} states", data[:3] if data else [])
                    return True
                else:
                    self.log_result("Analytics State-wise", False, "State-wise endpoint should return an array")
                    return False
            else:
                self.log_result("Analytics State-wise", False, f"State-wise endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Analytics State-wise", False, f"State-wise request failed: {str(e)}")
            return False
    
    def test_users_endpoint(self):
        """Test GET /api/users - List users with organization data"""
        try:
            response = requests.get(f"{self.base_url}/users")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Store a user ID for later tests
                        self.target_user_id = data[0].get('id')
                        # Check if users have organization data
                        has_org_data = any('organizations' in user for user in data if user.get('organizationId'))
                        self.log_result("Users API", True, f"Users endpoint returned {len(data)} users, org data: {has_org_data}", data[:2] if data else [])
                    else:
                        self.log_result("Users API", True, "Users endpoint returned empty array (no users in DB)")
                    return True
                else:
                    self.log_result("Users API", False, "Users endpoint should return an array")
                    return False
            else:
                self.log_result("Users API", False, f"Users endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Users API", False, f"Users request failed: {str(e)}")
            return False
    
    def test_organizations_endpoint(self):
        """Test GET /api/organizations - List organizations"""
        try:
            response = requests.get(f"{self.base_url}/organizations")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Organizations API", True, f"Organizations endpoint returned {len(data)} organizations", data[:2] if data else [])
                    return True
                else:
                    self.log_result("Organizations API", False, "Organizations endpoint should return an array")
                    return False
            else:
                self.log_result("Organizations API", False, f"Organizations endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Organizations API", False, f"Organizations request failed: {str(e)}")
            return False
    
    def test_students_endpoint(self):
        """Test GET /api/students - List students with related data"""
        try:
            response = requests.get(f"{self.base_url}/students")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if students have related user and organization data
                        has_user_data = any('users' in student for student in data if student.get('userId'))
                        has_org_data = any('organizations' in student for student in data if student.get('universityId'))
                        self.log_result("Students API", True, f"Students endpoint returned {len(data)} students, user data: {has_user_data}, org data: {has_org_data}", data[:2] if data else [])
                    else:
                        self.log_result("Students API", True, "Students endpoint returned empty array (no students in DB)")
                    return True
                else:
                    self.log_result("Students API", False, "Students endpoint should return an array")
                    return False
            else:
                self.log_result("Students API", False, f"Students endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Students API", False, f"Students request failed: {str(e)}")
            return False
    
    def test_passports_endpoint(self):
        """Test GET /api/passports - List skill passports with student info"""
        try:
            response = requests.get(f"{self.base_url}/passports")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Store a passport ID for later tests
                        self.passport_id = data[0].get('id')
                        # Check if passports have student data
                        has_student_data = any('students' in passport for passport in data if passport.get('studentId'))
                        self.log_result("Passports API", True, f"Passports endpoint returned {len(data)} passports, student data: {has_student_data}", data[:2] if data else [])
                    else:
                        self.log_result("Passports API", True, "Passports endpoint returned empty array (no passports in DB)")
                    return True
                else:
                    self.log_result("Passports API", False, "Passports endpoint should return an array")
                    return False
            else:
                self.log_result("Passports API", False, f"Passports endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Passports API", False, f"Passports request failed: {str(e)}")
            return False
    
    def test_verifications_endpoint(self):
        """Test GET /api/verifications - List verification history"""
        try:
            response = requests.get(f"{self.base_url}/verifications")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if verifications have user data
                        has_user_data = any('users' in verification for verification in data if verification.get('performedBy'))
                        self.log_result("Verifications API", True, f"Verifications endpoint returned {len(data)} verifications, user data: {has_user_data}", data[:2] if data else [])
                    else:
                        self.log_result("Verifications API", True, "Verifications endpoint returned empty array (no verifications in DB)")
                    return True
                else:
                    self.log_result("Verifications API", False, "Verifications endpoint should return an array")
                    return False
            else:
                self.log_result("Verifications API", False, f"Verifications endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Verifications API", False, f"Verifications request failed: {str(e)}")
            return False
    
    def test_audit_logs_endpoint(self):
        """Test GET /api/audit-logs - List audit trail"""
        try:
            response = requests.get(f"{self.base_url}/audit-logs")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if audit logs have user data
                        has_user_data = any('users' in log for log in data if log.get('actorId'))
                        self.log_result("Audit Logs API", True, f"Audit logs endpoint returned {len(data)} logs, user data: {has_user_data}", data[:2] if data else [])
                    else:
                        self.log_result("Audit Logs API", True, "Audit logs endpoint returned empty array (no logs in DB)")
                    return True
                else:
                    self.log_result("Audit Logs API", False, "Audit logs endpoint should return an array")
                    return False
            else:
                self.log_result("Audit Logs API", False, f"Audit logs endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Audit Logs API", False, f"Audit logs request failed: {str(e)}")
            return False
    
    def test_login_endpoint(self):
        """Test POST /api/login - Login functionality"""
        try:
            # Test with the specified super admin email
            login_data = {
                "email": "superadmin@rareminds.com",
                "password": "admin123"  # Using a realistic password
            }
            
            response = requests.post(f"{self.base_url}/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'user' in data:
                    self.user_id = data['user'].get('id')
                    self.log_result("Login API", True, f"Login successful for {login_data['email']}", data)
                    return True
                else:
                    self.log_result("Login API", False, "Login response missing success or user data")
                    return False
            elif response.status_code == 401:
                self.log_result("Login API", False, "Login failed - Invalid credentials (expected if user doesn't exist)")
                return False
            else:
                self.log_result("Login API", False, f"Login endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Login API", False, f"Login request failed: {str(e)}")
            return False
    
    def test_verify_passport(self):
        """Test POST /api/verify - Verify a passport"""
        if not self.passport_id or not self.user_id:
            self.log_result("Verify Passport API", False, "Cannot test - missing passport ID or user ID from previous tests")
            return False
            
        try:
            verify_data = {
                "passportId": self.passport_id,
                "userId": self.user_id,
                "note": "Test verification from backend testing"
            }
            
            response = requests.post(f"{self.base_url}/verify", json=verify_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Verify Passport API", True, "Passport verification successful", data)
                    return True
                else:
                    self.log_result("Verify Passport API", False, "Verification response missing success flag")
                    return False
            else:
                self.log_result("Verify Passport API", False, f"Verify endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Verify Passport API", False, f"Verify request failed: {str(e)}")
            return False
    
    def test_suspend_user(self):
        """Test POST /api/suspend-user - Suspend a user"""
        if not self.target_user_id or not self.user_id:
            self.log_result("Suspend User API", False, "Cannot test - missing target user ID or actor user ID from previous tests")
            return False
            
        try:
            suspend_data = {
                "targetUserId": self.target_user_id,
                "actorId": self.user_id,
                "reason": "Test suspension from backend testing"
            }
            
            response = requests.post(f"{self.base_url}/suspend-user", json=suspend_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Suspend User API", True, "User suspension successful", data)
                    return True
                else:
                    self.log_result("Suspend User API", False, "Suspension response missing success flag")
                    return False
            else:
                self.log_result("Suspend User API", False, f"Suspend endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Suspend User API", False, f"Suspend request failed: {str(e)}")
            return False
    
    def test_activate_user(self):
        """Test POST /api/activate-user - Reactivate the suspended user"""
        if not self.target_user_id or not self.user_id:
            self.log_result("Activate User API", False, "Cannot test - missing target user ID or actor user ID from previous tests")
            return False
            
        try:
            activate_data = {
                "targetUserId": self.target_user_id,
                "actorId": self.user_id,
                "note": "Test reactivation from backend testing"
            }
            
            response = requests.post(f"{self.base_url}/activate-user", json=activate_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Activate User API", True, "User activation successful", data)
                    return True
                else:
                    self.log_result("Activate User API", False, "Activation response missing success flag")
                    return False
            else:
                self.log_result("Activate User API", False, f"Activate endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Activate User API", False, f"Activate request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("=" * 80)
        print("RAREMINDS SUPER ADMIN DASHBOARD - BACKEND API TESTS")
        print("=" * 80)
        print(f"Testing against: {self.base_url}")
        print()
        
        # Test all GET endpoints first
        print("📊 TESTING DATA RETRIEVAL APIS...")
        self.test_api_root()
        self.test_metrics_endpoint()
        self.test_analytics_trends()
        self.test_analytics_state_wise()
        self.test_users_endpoint()
        self.test_organizations_endpoint()
        self.test_students_endpoint()
        self.test_passports_endpoint()
        self.test_verifications_endpoint()
        self.test_audit_logs_endpoint()
        
        print("\n🔐 TESTING ACTION APIS...")
        # Test login first to get user ID
        login_success = self.test_login_endpoint()
        
        # Only test action APIs if we have necessary IDs
        if login_success and self.user_id:
            if self.passport_id:
                self.test_verify_passport()
            else:
                self.log_result("Verify Passport API", False, "Skipped - no passport ID available from passports endpoint")
                
            if self.target_user_id:
                self.test_suspend_user()
                self.test_activate_user()
            else:
                self.log_result("Suspend User API", False, "Skipped - no target user ID available from users endpoint")
                self.log_result("Activate User API", False, "Skipped - no target user ID available from users endpoint")
        else:
            self.log_result("Action APIs", False, "Skipped action APIs - login failed or no user ID")
        
        # Print summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        
        print("\n✅ PASSED TESTS:")
        passed_tests = [result for result in self.test_results if result['success']]
        for test in passed_tests:
            print(f"  - {test['test']}: {test['message']}")
        
        return passed, total, self.test_results

if __name__ == "__main__":
    tester = BackendTester()
    passed, total, results = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)