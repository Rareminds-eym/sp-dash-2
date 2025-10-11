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
BASE_URL = "https://recruiter-verify-tab.preview.emergentagent.com/api"

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
    
    def test_update_metrics_endpoint(self):
        """Test POST /api/update-metrics - Update metrics snapshots table"""
        try:
            # First call - should create new snapshot
            response1 = requests.post(f"{self.base_url}/update-metrics")
            if response1.status_code == 200:
                data1 = response1.json()
                
                # Check required fields in response
                required_fields = ['success', 'message', 'data']
                has_all_fields = all(field in data1 for field in required_fields)
                
                if not has_all_fields:
                    missing_fields = [field for field in required_fields if field not in data1]
                    self.log_result("Update Metrics API", False, f"Missing required fields: {missing_fields}")
                    return False
                
                # Check success flag
                if not data1.get('success'):
                    self.log_result("Update Metrics API", False, "Response success flag is false")
                    return False
                
                # Check data object has all 6 metrics
                data_obj = data1.get('data', {})
                expected_metrics = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                                  'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters']
                
                has_all_metrics = all(metric in data_obj for metric in expected_metrics)
                if not has_all_metrics:
                    missing_metrics = [metric for metric in expected_metrics if metric not in data_obj]
                    self.log_result("Update Metrics API", False, f"Missing metrics in data: {missing_metrics}")
                    return False
                
                # Check if message indicates creation or update
                message1 = data1.get('message', '')
                action1 = 'created' if 'created' in message1.lower() else 'updated' if 'updated' in message1.lower() else 'unknown'
                
                # Second call - should update existing snapshot
                response2 = requests.post(f"{self.base_url}/update-metrics")
                if response2.status_code == 200:
                    data2 = response2.json()
                    
                    if not data2.get('success'):
                        self.log_result("Update Metrics API", False, "Second call success flag is false")
                        return False
                    
                    message2 = data2.get('message', '')
                    action2 = 'created' if 'created' in message2.lower() else 'updated' if 'updated' in message2.lower() else 'unknown'
                    
                    # Verify the metrics values match what /api/metrics returns
                    metrics_response = requests.get(f"{self.base_url}/metrics")
                    if metrics_response.status_code == 200:
                        metrics_data = metrics_response.json()
                        
                        # Compare key metrics
                        metrics_match = True
                        for metric in expected_metrics:
                            if data_obj.get(metric) != metrics_data.get(metric):
                                metrics_match = False
                                break
                        
                        if metrics_match:
                            self.log_result("Update Metrics API", True, 
                                          f"Update metrics working correctly. First call: {action1}, Second call: {action2}. Metrics match /api/metrics endpoint.", 
                                          {
                                              'first_action': action1,
                                              'second_action': action2,
                                              'metrics_data': data_obj,
                                              'metrics_match': metrics_match
                                          })
                            return True
                        else:
                            self.log_result("Update Metrics API", False, 
                                          "Metrics values don't match /api/metrics endpoint")
                            return False
                    else:
                        self.log_result("Update Metrics API", False, 
                                      f"Could not verify metrics match - /api/metrics returned {metrics_response.status_code}")
                        return False
                else:
                    self.log_result("Update Metrics API", False, 
                                  f"Second call returned status {response2.status_code}")
                    return False
            else:
                self.log_result("Update Metrics API", False, 
                              f"Update metrics endpoint returned status {response1.status_code}")
                return False
        except Exception as e:
            self.log_result("Update Metrics API", False, f"Update metrics request failed: {str(e)}")
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

    def test_university_reports_analytics(self):
        """Test GET /api/analytics/university-reports - University-wise analytics"""
        try:
            response = requests.get(f"{self.base_url}/analytics/university-reports")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check required fields in university reports
                        required_fields = ['universityId', 'universityName', 'state', 'enrollmentCount', 
                                         'totalPassports', 'verifiedPassports', 'completionRate', 'verificationRate']
                        sample_report = data[0]
                        has_all_fields = all(field in sample_report for field in required_fields)
                        
                        if has_all_fields:
                            self.log_result("University Reports Analytics", True, 
                                          f"University reports returned {len(data)} universities with all required fields", 
                                          data[:2] if data else [])
                        else:
                            missing_fields = [field for field in required_fields if field not in sample_report]
                            self.log_result("University Reports Analytics", False, 
                                          f"Missing required fields: {missing_fields}")
                        return has_all_fields
                    else:
                        self.log_result("University Reports Analytics", True, 
                                      "University reports returned empty array (no universities in DB)")
                        return True
                else:
                    self.log_result("University Reports Analytics", False, 
                                  "University reports should return an array")
                    return False
            else:
                self.log_result("University Reports Analytics", False, 
                              f"University reports returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("University Reports Analytics", False, 
                          f"University reports request failed: {str(e)}")
            return False

    def test_recruiter_metrics_analytics(self):
        """Test GET /api/analytics/recruiter-metrics - Recruiter engagement metrics"""
        try:
            response = requests.get(f"{self.base_url}/analytics/recruiter-metrics")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    # Check required fields in recruiter metrics
                    required_fields = ['totalSearches', 'profileViews', 'contactAttempts', 
                                     'shortlisted', 'hireIntents', 'searchTrends', 'topSkillsSearched']
                    has_all_fields = all(field in data for field in required_fields)
                    
                    if has_all_fields:
                        # Validate nested structures
                        trends_valid = isinstance(data.get('searchTrends'), list)
                        skills_valid = isinstance(data.get('topSkillsSearched'), list)
                        
                        if trends_valid and skills_valid:
                            self.log_result("Recruiter Metrics Analytics", True, 
                                          "Recruiter metrics returned all required fields with valid structure", 
                                          {k: v for k, v in data.items() if k not in ['searchTrends', 'topSkillsSearched']})
                        else:
                            self.log_result("Recruiter Metrics Analytics", False, 
                                          f"Invalid nested structure - trends: {trends_valid}, skills: {skills_valid}")
                        return has_all_fields and trends_valid and skills_valid
                    else:
                        missing_fields = [field for field in required_fields if field not in data]
                        self.log_result("Recruiter Metrics Analytics", False, 
                                      f"Missing required fields: {missing_fields}")
                        return False
                else:
                    self.log_result("Recruiter Metrics Analytics", False, 
                                  "Recruiter metrics should return an object")
                    return False
            else:
                self.log_result("Recruiter Metrics Analytics", False, 
                              f"Recruiter metrics returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Recruiter Metrics Analytics", False, 
                          f"Recruiter metrics request failed: {str(e)}")
            return False

    def test_placement_conversion_analytics(self):
        """Test GET /api/analytics/placement-conversion - Placement conversion funnel"""
        try:
            response = requests.get(f"{self.base_url}/analytics/placement-conversion")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    # Check required fields in placement conversion
                    required_fields = ['conversionFunnel', 'monthlyConversions']
                    has_all_fields = all(field in data for field in required_fields)
                    
                    if has_all_fields:
                        # Validate nested structures
                        funnel_valid = isinstance(data.get('conversionFunnel'), list)
                        monthly_valid = isinstance(data.get('monthlyConversions'), list)
                        
                        if funnel_valid and monthly_valid:
                            funnel_count = len(data.get('conversionFunnel', []))
                            monthly_count = len(data.get('monthlyConversions', []))
                            self.log_result("Placement Conversion Analytics", True, 
                                          f"Placement conversion returned funnel with {funnel_count} stages and {monthly_count} months", 
                                          {'funnel_stages': funnel_count, 'monthly_data': monthly_count})
                        else:
                            self.log_result("Placement Conversion Analytics", False, 
                                          f"Invalid nested structure - funnel: {funnel_valid}, monthly: {monthly_valid}")
                        return has_all_fields and funnel_valid and monthly_valid
                    else:
                        missing_fields = [field for field in required_fields if field not in data]
                        self.log_result("Placement Conversion Analytics", False, 
                                      f"Missing required fields: {missing_fields}")
                        return False
                else:
                    self.log_result("Placement Conversion Analytics", False, 
                                  "Placement conversion should return an object")
                    return False
            else:
                self.log_result("Placement Conversion Analytics", False, 
                              f"Placement conversion returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Placement Conversion Analytics", False, 
                          f"Placement conversion request failed: {str(e)}")
            return False

    def test_state_heatmap_analytics(self):
        """Test GET /api/analytics/state-heatmap - Enhanced state-wise heat map"""
        try:
            response = requests.get(f"{self.base_url}/analytics/state-heatmap")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check required fields in state heatmap
                        required_fields = ['state', 'universities', 'students', 'verifiedPassports', 
                                         'engagementScore', 'employabilityIndex']
                        sample_state = data[0]
                        has_all_fields = all(field in sample_state for field in required_fields)
                        
                        if has_all_fields:
                            # Validate data types
                            numeric_fields = ['universities', 'students', 'verifiedPassports', 
                                            'engagementScore', 'employabilityIndex']
                            valid_types = all(isinstance(sample_state.get(field), (int, float)) 
                                            for field in numeric_fields)
                            
                            if valid_types:
                                self.log_result("State Heatmap Analytics", True, 
                                              f"State heatmap returned {len(data)} states with all required fields and valid types", 
                                              data[:2] if data else [])
                            else:
                                self.log_result("State Heatmap Analytics", False, 
                                              "Invalid data types in numeric fields")
                            return has_all_fields and valid_types
                        else:
                            missing_fields = [field for field in required_fields if field not in sample_state]
                            self.log_result("State Heatmap Analytics", False, 
                                          f"Missing required fields: {missing_fields}")
                            return False
                    else:
                        self.log_result("State Heatmap Analytics", True, 
                                      "State heatmap returned empty array (no states in DB)")
                        return True
                else:
                    self.log_result("State Heatmap Analytics", False, 
                                  "State heatmap should return an array")
                    return False
            else:
                self.log_result("State Heatmap Analytics", False, 
                              f"State heatmap returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("State Heatmap Analytics", False, 
                          f"State heatmap request failed: {str(e)}")
            return False

    def test_ai_insights_analytics(self):
        """Test GET /api/analytics/ai-insights - AI-powered insights"""
        try:
            response = requests.get(f"{self.base_url}/analytics/ai-insights")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict):
                    # Check required fields in AI insights
                    required_fields = ['emergingSkills', 'soughtSkillTags', 'topUniversities']
                    has_all_fields = all(field in data for field in required_fields)
                    
                    if has_all_fields:
                        # Validate nested structures
                        skills_valid = isinstance(data.get('emergingSkills'), list)
                        tags_valid = isinstance(data.get('soughtSkillTags'), list)
                        unis_valid = isinstance(data.get('topUniversities'), list)
                        
                        if skills_valid and tags_valid and unis_valid:
                            skills_count = len(data.get('emergingSkills', []))
                            tags_count = len(data.get('soughtSkillTags', []))
                            unis_count = len(data.get('topUniversities', []))
                            self.log_result("AI Insights Analytics", True, 
                                          f"AI insights returned {skills_count} emerging skills, {tags_count} skill tags, {unis_count} universities", 
                                          {'emerging_skills': skills_count, 'skill_tags': tags_count, 'top_universities': unis_count})
                        else:
                            self.log_result("AI Insights Analytics", False, 
                                          f"Invalid nested structure - skills: {skills_valid}, tags: {tags_valid}, unis: {unis_valid}")
                        return has_all_fields and skills_valid and tags_valid and unis_valid
                    else:
                        missing_fields = [field for field in required_fields if field not in data]
                        self.log_result("AI Insights Analytics", False, 
                                      f"Missing required fields: {missing_fields}")
                        return False
                else:
                    self.log_result("AI Insights Analytics", False, 
                                  "AI insights should return an object")
                    return False
            else:
                self.log_result("AI Insights Analytics", False, 
                              f"AI insights returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("AI Insights Analytics", False, 
                          f"AI insights request failed: {str(e)}")
            return False

    def test_reject_passport(self):
        """Test POST /api/reject-passport - Reject a passport"""
        if not self.passport_id or not self.user_id:
            self.log_result("Reject Passport API", False, "Cannot test - missing passport ID or user ID from previous tests")
            return False
            
        try:
            reject_data = {
                "passportId": self.passport_id,
                "userId": self.user_id,
                "reason": "Test rejection from backend testing"
            }
            
            response = requests.post(f"{self.base_url}/reject-passport", json=reject_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Reject Passport API", True, "Passport rejection successful", data)
                    return True
                else:
                    self.log_result("Reject Passport API", False, "Rejection response missing success flag")
                    return False
            else:
                self.log_result("Reject Passport API", False, f"Reject endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Reject Passport API", False, f"Reject request failed: {str(e)}")
            return False

    def test_delete_user(self):
        """Test DELETE /api/user - Delete (soft delete) a user"""
        if not self.target_user_id or not self.user_id:
            self.log_result("Delete User API", False, "Cannot test - missing target user ID or actor user ID from previous tests")
            return False
            
        try:
            delete_data = {
                "userId": self.target_user_id,
                "actorId": self.user_id,
                "reason": "Test deletion from backend testing"
            }
            
            response = requests.delete(f"{self.base_url}/user", json=delete_data)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Delete User API", True, "User deletion (soft delete) successful", data)
                    return True
                else:
                    self.log_result("Delete User API", False, "Deletion response missing success flag")
                    return False
            else:
                self.log_result("Delete User API", False, f"Delete endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Delete User API", False, f"Delete request failed: {str(e)}")
            return False

    def test_metrics_endpoint_scenarios(self):
        """Test updated /api/metrics endpoint with specific scenarios"""
        try:
            print("\n🔍 TESTING UPDATED METRICS ENDPOINT SCENARIOS...")
            
            # First, clear any existing snapshots by checking if we can delete them
            # We'll use a different approach - just test the current behavior
            
            # Scenario 1: Test metrics endpoint (should work regardless of snapshot state)
            print("📊 Scenario 1: Testing /api/metrics endpoint...")
            response1 = requests.get(f"{self.base_url}/metrics")
            if response1.status_code != 200:
                self.log_result("Metrics Scenarios - Initial Check", False, 
                              f"Metrics endpoint returned status {response1.status_code}")
                return False
            
            data1 = response1.json()
            
            # Check for required fields including source
            expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                             'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters', 'source']
            
            missing_fields = [field for field in expected_fields if field not in data1]
            if missing_fields:
                self.log_result("Metrics Scenarios - Initial Check", False, 
                              f"Missing required fields: {missing_fields}")
                return False
            
            initial_source = data1.get('source')
            print(f"   Initial metrics source: {initial_source}")
            
            # Scenario 2: Create/update snapshot using /api/update-metrics
            print("📊 Scenario 2: Creating/updating metrics snapshot...")
            response2 = requests.post(f"{self.base_url}/update-metrics")
            if response2.status_code != 200:
                self.log_result("Metrics Scenarios - Snapshot Creation", False, 
                              f"Update metrics endpoint returned status {response2.status_code}")
                return False
            
            data2 = response2.json()
            if not data2.get('success'):
                self.log_result("Metrics Scenarios - Snapshot Creation", False, 
                              "Update metrics response success flag is false")
                return False
            
            snapshot_action = 'created' if 'created' in data2.get('message', '').lower() else 'updated'
            print(f"   Snapshot action: {snapshot_action}")
            
            # Scenario 3: Test metrics endpoint after snapshot creation
            print("📊 Scenario 3: Testing /api/metrics after snapshot creation...")
            response3 = requests.get(f"{self.base_url}/metrics")
            if response3.status_code != 200:
                self.log_result("Metrics Scenarios - After Snapshot", False, 
                              f"Metrics endpoint returned status {response3.status_code} after snapshot")
                return False
            
            data3 = response3.json()
            
            # Check if source changed to 'snapshot'
            final_source = data3.get('source')
            print(f"   Final metrics source: {final_source}")
            
            # Verify snapshotDate field is present when source is 'snapshot'
            has_snapshot_date = 'snapshotDate' in data3 if final_source == 'snapshot' else True
            
            # Scenario 4: Verify data accuracy between endpoints
            print("📊 Scenario 4: Verifying data accuracy between endpoints...")
            snapshot_data = data2.get('data', {})
            
            # Compare key metrics between update-metrics response and metrics endpoint
            metrics_match = True
            mismatched_fields = []
            for field in ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                         'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters']:
                if snapshot_data.get(field) != data3.get(field):
                    metrics_match = False
                    mismatched_fields.append(f"{field}: snapshot={snapshot_data.get(field)}, metrics={data3.get(field)}")
            
            # Compile results
            all_scenarios_passed = True
            scenario_results = []
            
            # Check each scenario
            if initial_source in ['dynamic', 'snapshot', 'error']:
                scenario_results.append("✅ Scenario 1: Metrics endpoint returns valid source field")
            else:
                scenario_results.append(f"❌ Scenario 1: Invalid source '{initial_source}'")
                all_scenarios_passed = False
            
            if data2.get('success') and snapshot_action in ['created', 'updated']:
                scenario_results.append(f"✅ Scenario 2: Snapshot {snapshot_action} successfully")
            else:
                scenario_results.append("❌ Scenario 2: Snapshot creation/update failed")
                all_scenarios_passed = False
            
            if final_source == 'snapshot' and has_snapshot_date:
                scenario_results.append("✅ Scenario 3: Metrics endpoint returns snapshot data with snapshotDate")
            elif final_source == 'dynamic':
                scenario_results.append("✅ Scenario 3: Metrics endpoint returns dynamic data (fallback working)")
            else:
                scenario_results.append(f"❌ Scenario 3: Unexpected source '{final_source}' or missing snapshotDate")
                all_scenarios_passed = False
            
            if metrics_match:
                scenario_results.append("✅ Scenario 4: Data accuracy verified - metrics match between endpoints")
            else:
                scenario_results.append(f"❌ Scenario 4: Data mismatch - {', '.join(mismatched_fields)}")
                all_scenarios_passed = False
            
            # Log comprehensive result
            result_message = f"Metrics endpoint scenarios test. {len([r for r in scenario_results if r.startswith('✅')])}/4 scenarios passed. " + "; ".join(scenario_results)
            
            self.log_result("Updated Metrics Endpoint Scenarios", all_scenarios_passed, result_message, {
                'initial_source': initial_source,
                'snapshot_action': snapshot_action,
                'final_source': final_source,
                'has_snapshot_date': has_snapshot_date,
                'metrics_match': metrics_match,
                'scenario_details': scenario_results
            })
            
            return all_scenarios_passed
            
        except Exception as e:
            self.log_result("Updated Metrics Endpoint Scenarios", False, f"Scenarios test failed: {str(e)}")
            return False
    
    def test_get_recruiters(self):
        """Test GET /api/recruiters - List all recruiter organizations"""
        try:
            response = requests.get(f"{self.base_url}/recruiters")
            
            if response.status_code == 200:
                recruiters = response.json()
                
                if isinstance(recruiters, list):
                    # Store first recruiter ID for other tests
                    if recruiters and 'id' in recruiters[0]:
                        self.recruiter_id = recruiters[0]['id']
                    
                    # Validate response structure
                    if recruiters:
                        recruiter = recruiters[0]
                        required_fields = ['id', 'name', 'type']
                        missing_fields = [field for field in required_fields if field not in recruiter]
                        
                        if missing_fields:
                            self.log_result("GET Recruiters", False, f"Missing required fields: {missing_fields}")
                            return False
                        
                        # Check for userCount and verification fields
                        has_user_count = 'userCount' in recruiter
                        has_verification_status = 'verificationStatus' in recruiter or recruiter.get('verificationStatus') == 'approved'
                        has_is_active = 'isActive' in recruiter or recruiter.get('isActive') == True
                        
                        message = f"Found {len(recruiters)} recruiters with proper structure"
                        if has_user_count:
                            message += f", userCount included"
                        if has_verification_status:
                            message += f", verificationStatus: {recruiter.get('verificationStatus', 'approved')}"
                        if has_is_active:
                            message += f", isActive: {recruiter.get('isActive', True)}"
                        
                        self.log_result("GET Recruiters", True, message, {
                            'count': len(recruiters),
                            'sample_recruiter': recruiter
                        })
                        return True
                    else:
                        self.log_result("GET Recruiters", True, "No recruiters found in database (empty array returned)")
                        return True
                else:
                    self.log_result("GET Recruiters", False, f"Expected array, got {type(recruiters)}")
                    return False
            else:
                self.log_result("GET Recruiters", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("GET Recruiters", False, f"Request failed: {str(e)}")
            return False
    
    def test_approve_recruiter(self):
        """Test POST /api/approve-recruiter"""
        if not hasattr(self, 'recruiter_id') or not self.recruiter_id:
            self.log_result("Approve Recruiter", False, "No recruiter ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Approve Recruiter", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "recruiterId": self.recruiter_id,
                "userId": self.user_id,
                "note": "Test approval via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/approve-recruiter",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Approve Recruiter", True, f"Recruiter approved: {data.get('message')}")
                    return True
                else:
                    self.log_result("Approve Recruiter", False, f"API returned success=false: {data}")
                    return False
            else:
                self.log_result("Approve Recruiter", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Approve Recruiter", False, f"Request failed: {str(e)}")
            return False
    
    def test_reject_recruiter(self):
        """Test POST /api/reject-recruiter"""
        if not hasattr(self, 'recruiter_id') or not self.recruiter_id:
            self.log_result("Reject Recruiter", False, "No recruiter ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Reject Recruiter", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "recruiterId": self.recruiter_id,
                "userId": self.user_id,
                "reason": "Test rejection via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/reject-recruiter",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Reject Recruiter", True, f"Recruiter rejected: {data.get('message')}")
                    return True
                else:
                    self.log_result("Reject Recruiter", False, f"API returned success=false: {data}")
                    return False
            else:
                self.log_result("Reject Recruiter", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Reject Recruiter", False, f"Request failed: {str(e)}")
            return False
    
    def test_suspend_recruiter(self):
        """Test POST /api/suspend-recruiter"""
        if not hasattr(self, 'recruiter_id') or not self.recruiter_id:
            self.log_result("Suspend Recruiter", False, "No recruiter ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Suspend Recruiter", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "recruiterId": self.recruiter_id,
                "userId": self.user_id,
                "reason": "Test suspension via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/suspend-recruiter",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Suspend Recruiter", True, f"Recruiter suspended: {data.get('message')}")
                    return True
                else:
                    self.log_result("Suspend Recruiter", False, f"API returned success=false: {data}")
                    return False
            else:
                self.log_result("Suspend Recruiter", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Suspend Recruiter", False, f"Request failed: {str(e)}")
            return False
    
    def test_activate_recruiter(self):
        """Test POST /api/activate-recruiter"""
        if not hasattr(self, 'recruiter_id') or not self.recruiter_id:
            self.log_result("Activate Recruiter", False, "No recruiter ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Activate Recruiter", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "recruiterId": self.recruiter_id,
                "userId": self.user_id,
                "note": "Test activation via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/activate-recruiter",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Activate Recruiter", True, f"Recruiter activated: {data.get('message')}")
                    return True
                else:
                    self.log_result("Activate Recruiter", False, f"API returned success=false: {data}")
                    return False
            else:
                self.log_result("Activate Recruiter", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Activate Recruiter", False, f"Request failed: {str(e)}")
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
        self.test_update_metrics_endpoint()
        
        # Test the specific metrics scenarios requested
        self.test_metrics_endpoint_scenarios()
        
        self.test_analytics_trends()
        self.test_analytics_state_wise()
        self.test_users_endpoint()
        self.test_organizations_endpoint()
        self.test_students_endpoint()
        self.test_passports_endpoint()
        self.test_verifications_endpoint()
        self.test_audit_logs_endpoint()
        
        print("\n📈 TESTING NEW ANALYTICS APIS...")
        self.test_university_reports_analytics()
        self.test_recruiter_metrics_analytics()
        self.test_placement_conversion_analytics()
        self.test_state_heatmap_analytics()
        self.test_ai_insights_analytics()
        
        print("\n🔐 TESTING ACTION APIS...")
        # Test login first to get user ID
        login_success = self.test_login_endpoint()
        
        # Only test action APIs if we have necessary IDs
        if login_success and self.user_id:
            if self.passport_id:
                self.test_verify_passport()
                self.test_reject_passport()
            else:
                self.log_result("Verify Passport API", False, "Skipped - no passport ID available from passports endpoint")
                self.log_result("Reject Passport API", False, "Skipped - no passport ID available from passports endpoint")
                
            if self.target_user_id:
                self.test_suspend_user()
                self.test_activate_user()
                self.test_delete_user()
            else:
                self.log_result("Suspend User API", False, "Skipped - no target user ID available from users endpoint")
                self.log_result("Activate User API", False, "Skipped - no target user ID available from users endpoint")
                self.log_result("Delete User API", False, "Skipped - no target user ID available from users endpoint")
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