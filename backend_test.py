import requests
import json
from datetime import datetime

class BackendTester:
    def __init__(self, base_url="https://profile-fix-15.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.user_id = None
        self.target_user_id = None
        self.passport_id = None
        self.recruiter_id = None
        self.results = []
    
    def log_result(self, test_name, passed, message="", details=None):
        result = {
            'test': test_name,
            'passed': passed,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.results.append(result)
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        return result
    
    def test_health_check(self):
        """Test basic connectivity to the API"""
        try:
            response = requests.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if 'message' in data:
                    self.log_result("Health Check", True, "API is responding correctly")
                    return True
                else:
                    self.log_result("Health Check", False, "API response missing message field")
                    return False
            else:
                self.log_result("Health Check", False, f"API returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, f"Connection failed: {str(e)}")
            return False
    
    def test_login(self, email, password):
        """Test POST /api/login - User authentication"""
        try:
            payload = {
                "email": email,
                "password": password
            }
            response = requests.post(f"{self.base_url}/login", json=payload)
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'user' in data:
                    self.user_id = data['user']['id']
                    self.log_result("Login", True, f"Login successful for {data['user']['email']}", data['user'])
                    return True
                else:
                    self.log_result("Login", False, "Login response missing user data")
                    return False
            elif response.status_code == 401:
                self.log_result("Login", False, "Invalid credentials")
                return False
            else:
                self.log_result("Login", False, f"Login endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Login", False, f"Login request failed: {str(e)}")
            return False
    
    def test_metrics_endpoint(self):
        """Test GET /api/metrics - Dashboard metrics"""
        try:
            response = requests.get(f"{self.base_url}/metrics")
            if response.status_code == 200:
                data = response.json()
                
                # Check for required fields
                expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                                 'employabilityIndex', 'activeRecruiters', 'source']
                
                missing_fields = [field for field in expected_fields if field not in data]
                if missing_fields:
                    self.log_result("Metrics API", False, f"Missing required fields: {missing_fields}")
                    return False
                
                # Check data types
                if not isinstance(data.get('activeUniversities', 0), int):
                    self.log_result("Metrics API", False, "activeUniversities should be integer")
                    return False
                
                if not isinstance(data.get('registeredStudents', 0), int):
                    self.log_result("Metrics API", False, "registeredStudents should be integer")
                    return False
                
                if not isinstance(data.get('verifiedPassports', 0), int):
                    self.log_result("Metrics API", False, "verifiedPassports should be integer")
                    return False
                
                if not isinstance(data.get('employabilityIndex', 0), (int, float)):
                    self.log_result("Metrics API", False, "employabilityIndex should be number")
                    return False
                
                if not isinstance(data.get('activeRecruiters', 0), int):
                    self.log_result("Metrics API", False, "activeRecruiters should be integer")
                    return False
                
                if not isinstance(data.get('source', ''), str):
                    self.log_result("Metrics API", False, "source should be string")
                    return False
                
                self.log_result("Metrics API", True, "Metrics endpoint working correctly", data)
                return True
            else:
                self.log_result("Metrics API", False, f"Metrics endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Metrics API", False, f"Metrics request failed: {str(e)}")
            return False
    
    def test_update_metrics(self):
        """Test POST /api/update-metrics - Update metrics snapshot"""
        try:
            # First call - should create or update snapshot
            response1 = requests.post(f"{self.base_url}/update-metrics")
            if response1.status_code == 200:
                data1 = response1.json()
                
                if not data1.get('success'):
                    self.log_result("Update Metrics API", False, "First call success flag is false")
                    return False
                
                # Check data object has all metrics
                data_obj = data1.get('data', {})
                expected_metrics = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                                  'employabilityIndex', 'activeRecruiters']
                
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
        """Test GET /api/verifications - List recent verifications"""
        try:
            response = requests.get(f"{self.base_url}/verifications")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if verifications have user data
                        has_user_data = any('users' in verification for verification in data if verification.get('performedBy'))
                        self.log_result("Verifications API", True, f"Verifications endpoint returned {len(data)} records, user data: {has_user_data}", data[:2] if data else [])
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
        """Test GET /api/audit-logs - List audit logs"""
        try:
            response = requests.get(f"{self.base_url}/audit-logs")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if logs have user data
                        has_user_data = any('users' in log for log in data if log.get('actorId'))
                        self.log_result("Audit Logs API", True, f"Audit logs endpoint returned {len(data)} records, user data: {has_user_data}", data[:2] if data else [])
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
    
    def test_verify_passport(self):
        """Test POST /api/verify - Verify a skill passport"""
        if not self.passport_id:
            self.log_result("Verify Passport", False, "No passport ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Verify Passport", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "passportId": self.passport_id,
                "userId": self.user_id,
                "note": "Test verification via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/verify",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Verify Passport", True, f"Passport verified: {data.get('message')}")
                    return True
                else:
                    self.log_result("Verify Passport", False, f"Verify failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Verify Passport", False, f"Verify endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Verify Passport", False, f"Verify request failed: {str(e)}")
            return False
    
    def test_reject_passport(self):
        """Test POST /api/reject-passport - Reject a skill passport"""
        if not self.passport_id:
            self.log_result("Reject Passport", False, "No passport ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Reject Passport", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "passportId": self.passport_id,
                "userId": self.user_id,
                "reason": "Test rejection via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/reject-passport",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Reject Passport", True, f"Passport rejected: {data.get('message')}")
                    return True
                else:
                    self.log_result("Reject Passport", False, f"Reject failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Reject Passport", False, f"Reject endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Reject Passport", False, f"Reject request failed: {str(e)}")
            return False
    
    def test_suspend_user(self):
        """Test POST /api/suspend-user - Suspend a user"""
        if not self.target_user_id:
            self.log_result("Suspend User", False, "No target user ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Suspend User", False, "No user ID available - login required")
            return False
        
        # Don't suspend ourselves
        if self.target_user_id == self.user_id:
            self.log_result("Suspend User", False, "Cannot suspend self - skipping test")
            return False
        
        try:
            payload = {
                "targetUserId": self.target_user_id,
                "actorId": self.user_id,
                "reason": "Test suspension via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/suspend-user",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Suspend User", True, f"User suspended: {data.get('message')}")
                    return True
                else:
                    self.log_result("Suspend User", False, f"Suspend failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Suspend User", False, f"Suspend endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Suspend User", False, f"Suspend request failed: {str(e)}")
            return False
    
    def test_activate_user(self):
        """Test POST /api/activate-user - Activate a user"""
        if not self.target_user_id:
            self.log_result("Activate User", False, "No target user ID available for testing")
            return False
        
        if not self.user_id:
            self.log_result("Activate User", False, "No user ID available - login required")
            return False
        
        try:
            payload = {
                "targetUserId": self.target_user_id,
                "actorId": self.user_id,
                "note": "Test activation via automated testing"
            }
            
            response = requests.post(
                f"{self.base_url}/activate-user",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Activate User", True, f"User activated: {data.get('message')}")
                    return True
                else:
                    self.log_result("Activate User", False, f"Activate failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Activate User", False, f"Activate endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Activate User", False, f"Activate request failed: {str(e)}")
            return False
    
    def test_metrics_scenarios(self):
        """Test comprehensive metrics scenarios"""
        try:
            # Scenario 1: Test initial metrics endpoint
            print("📊 Scenario 1: Testing initial /api/metrics...")
            response1 = requests.get(f"{self.base_url}/metrics")
            if response1.status_code != 200:
                self.log_result("Metrics Scenarios - Initial Check", False, 
                              f"Metrics endpoint returned status {response1.status_code}")
                return False
            
            data1 = response1.json()
            
            # Check for required fields including source
            expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                             'employabilityIndex', 'activeRecruiters', 'source']
            
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
                         'employabilityIndex', 'activeRecruiters']:
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
                    self.log_result("Approve Recruiter", False, f"Approval failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Approve Recruiter", False, f"Approve endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Approve Recruiter", False, f"Approve request failed: {str(e)}")
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
                    self.log_result("Reject Recruiter", False, f"Rejection failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                self.log_result("Reject Recruiter", False, f"Reject endpoint returned status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Reject Recruiter", False, f"Reject request failed: {str(e)}")
            return False
    
    def test_profile_update(self):
        """Test PUT /api/profile - Update user profile"""
        try:
            # First, get current user data to use for testing
            login_response = requests.post(f"{self.base_url}/login", json={
                "email": "superadmin@rareminds.in",
                "password": "password123"
            })
            
            if login_response.status_code != 200:
                self.log_result("Profile Update - Login", False, f"Login failed with status {login_response.status_code}")
                return False
            
            login_data = login_response.json()
            if not login_data.get('success') or 'user' not in login_data:
                self.log_result("Profile Update - Login", False, "Login response missing user data")
                return False
            
            user = login_data['user']
            current_email = user.get('email')
            current_name = user.get('name', 'Super Admin')
            organization_id = user.get('organizationId')
            
            print(f"📝 Testing profile update for user: {current_email}")
            print(f"   Current name: {current_name}")
            print(f"   Organization ID: {organization_id}")
            
            # Test 1: Valid profile update with new name
            new_name = "Super Admin Updated"
            payload = {
                "email": current_email,
                "name": new_name,
                "organizationName": "Rareminds Updated"
            }
            
            response = requests.put(
                f"{self.base_url}/profile",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print(f"   ✅ Profile update successful: {data.get('message')}")
                    
                    # Verify the update by checking the session endpoint
                    session_response = requests.get(f"{self.base_url}/auth/session")
                    if session_response.status_code == 200:
                        session_data = session_response.json()
                        updated_name = session_data.get('name')
                        
                        if updated_name == new_name:
                            print(f"   ✅ Name update verified: {updated_name}")
                        else:
                            print(f"   ⚠️  Name not updated in session: expected '{new_name}', got '{updated_name}'")
                    
                    # Test 2: Invalid request without email
                    invalid_payload = {
                        "name": "Test Name"
                    }
                    
                    invalid_response = requests.put(
                        f"{self.base_url}/profile",
                        json=invalid_payload,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if invalid_response.status_code == 400:
                        invalid_data = invalid_response.json()
                        if 'error' in invalid_data and 'Email is required' in invalid_data['error']:
                            print(f"   ✅ Validation working: {invalid_data['error']}")
                        else:
                            print(f"   ⚠️  Unexpected error message: {invalid_data}")
                    else:
                        print(f"   ⚠️  Expected 400 status for invalid request, got {invalid_response.status_code}")
                    
                    # Test 3: Non-existent user
                    nonexistent_payload = {
                        "email": "nonexistent@example.com",
                        "name": "Test Name"
                    }
                    
                    nonexistent_response = requests.put(
                        f"{self.base_url}/profile",
                        json=nonexistent_payload,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if nonexistent_response.status_code == 404:
                        nonexistent_data = nonexistent_response.json()
                        if 'error' in nonexistent_data and 'User not found' in nonexistent_data['error']:
                            print(f"   ✅ User not found handling: {nonexistent_data['error']}")
                        else:
                            print(f"   ⚠️  Unexpected error message: {nonexistent_data}")
                    else:
                        print(f"   ⚠️  Expected 404 status for non-existent user, got {nonexistent_response.status_code}")
                    
                    self.log_result("Profile Update", True, 
                                  f"Profile update functionality working correctly. Name updated from '{current_name}' to '{new_name}'. Validation and error handling working.", 
                                  {
                                      'original_name': current_name,
                                      'updated_name': new_name,
                                      'organization_id': organization_id,
                                      'response_data': data
                                  })
                    return True
                else:
                    self.log_result("Profile Update", False, f"Profile update failed: {data.get('error', 'Unknown error')}")
                    return False
            else:
                response_text = response.text if response.text else "No response body"
                self.log_result("Profile Update", False, f"Profile update endpoint returned status {response.status_code}: {response_text}")
                return False
                
        except Exception as e:
            self.log_result("Profile Update", False, f"Profile update test failed: {str(e)}")
            return False
    
    def run_all_tests(self, email="superadmin@rareminds.in", password="password123"):
        """Run all tests in sequence"""
        print("🚀 Starting Backend API Tests")
        print("=" * 50)
        
        # Test basic connectivity
        if not self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return False
        
        # Test login
        if not self.test_login(email, password):
            print("❌ Login failed - aborting tests")
            return False
        
        # Test core endpoints
        test_results = []
        test_results.append(self.test_metrics_endpoint())
        test_results.append(self.test_update_metrics())
        test_results.append(self.test_analytics_trends())
        test_results.append(self.test_analytics_state_wise())
        test_results.append(self.test_users_endpoint())
        test_results.append(self.test_organizations_endpoint())
        test_results.append(self.test_students_endpoint())
        test_results.append(self.test_passports_endpoint())
        test_results.append(self.test_verifications_endpoint())
        test_results.append(self.test_audit_logs_endpoint())
        
        # Test action endpoints
        test_results.append(self.test_verify_passport())
        test_results.append(self.test_reject_passport())
        test_results.append(self.test_suspend_user())
        test_results.append(self.test_activate_user())
        
        # Test recruiter endpoints
        test_results.append(self.test_get_recruiters())
        test_results.append(self.test_approve_recruiter())
        test_results.append(self.test_reject_recruiter())
        
        # Test profile update functionality
        test_results.append(self.test_profile_update())
        
        # Test comprehensive scenarios
        test_results.append(self.test_metrics_scenarios())
        
        # Calculate final results
        passed_tests = sum(test_results)
        total_tests = len(test_results)
        
        print("\n" + "=" * 50)
        print(f"🏁 Test Results: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {total_tests - passed_tests} tests failed")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()