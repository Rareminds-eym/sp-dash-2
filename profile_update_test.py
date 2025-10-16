#!/usr/bin/env python3
"""
Profile Update Functionality Test
Tests the PUT /api/profile endpoint for the settings page profile update functionality.
"""

import requests
import json
from datetime import datetime

class ProfileUpdateTester:
    def __init__(self, base_url="https://csv-passport-export.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
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
            print(f"   Details: {json.dumps(details, indent=2)}")
        return result
    
    def test_login_and_get_session(self):
        """Test login and get current user session data"""
        try:
            print("🔐 Testing login with superadmin@rareminds.in...")
            
            # Test login
            login_payload = {
                "email": "superadmin@rareminds.in",
                "password": "password123"
            }
            
            login_response = self.session.post(f"{self.base_url}/login", json=login_payload)
            
            if login_response.status_code != 200:
                self.log_result("Login Test", False, f"Login failed with status {login_response.status_code}")
                return None
            
            login_data = login_response.json()
            if not login_data.get('success') or 'user' not in login_data:
                self.log_result("Login Test", False, "Login response missing user data", login_data)
                return None
            
            user = login_data['user']
            self.log_result("Login Test", True, f"Login successful for {user.get('email')}", {
                'email': user.get('email'),
                'role': user.get('role'),
                'name': user.get('name'),
                'organizationId': user.get('organizationId')
            })
            
            # Test session endpoint using the same session (with cookies)
            print("📋 Testing session endpoint...")
            session_response = self.session.get(f"{self.base_url}/auth/session")
            
            if session_response.status_code == 200:
                session_data = session_response.json()
                self.log_result("Session Test", True, "Session endpoint working", {
                    'email': session_data.get('email'),
                    'role': session_data.get('role'),
                    'name': session_data.get('name'),
                    'organizationId': session_data.get('organizationId')
                })
                return user
            else:
                self.log_result("Session Test", False, f"Session endpoint returned status {session_response.status_code}")
                return user  # Still return user data from login
                
        except Exception as e:
            self.log_result("Login/Session Test", False, f"Test failed: {str(e)}")
            return None
    
    def test_profile_update_scenarios(self, user_data):
        """Test various profile update scenarios"""
        if not user_data:
            self.log_result("Profile Update Scenarios", False, "No user data available")
            return False
        
        current_email = user_data.get('email')
        current_name = user_data.get('name', 'Super Admin')
        organization_id = user_data.get('organizationId')
        
        print(f"👤 Testing profile update for: {current_email}")
        print(f"   Current name: {current_name}")
        print(f"   Organization ID: {organization_id}")
        
        all_tests_passed = True
        
        # Scenario 1: Valid profile update with new name
        print("\n📝 Scenario 1: Valid profile update with new name...")
        try:
            new_name = "Super Admin Updated"
            payload = {
                "email": current_email,
                "name": new_name,
                "organizationName": "Rareminds Updated"
            }
            
            response = self.session.put(
                f"{self.base_url}/profile",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Valid Profile Update", True, 
                                  f"Profile update successful: {data.get('message')}", 
                                  data)
                    
                    # Verify the update by checking session again
                    session_response = self.session.get(f"{self.base_url}/auth/session")
                    if session_response.status_code == 200:
                        session_data = session_response.json()
                        updated_name = session_data.get('name')
                        
                        if updated_name == new_name:
                            self.log_result("Profile Update Verification", True, 
                                          f"Name successfully updated and verified: {updated_name}")
                        else:
                            self.log_result("Profile Update Verification", False, 
                                          f"Name not updated in session: expected '{new_name}', got '{updated_name}'")
                            all_tests_passed = False
                    else:
                        self.log_result("Profile Update Verification", False, 
                                      f"Could not verify update - session endpoint returned {session_response.status_code}")
                        all_tests_passed = False
                else:
                    self.log_result("Valid Profile Update", False, 
                                  f"Profile update failed: {data.get('error', 'Unknown error')}")
                    all_tests_passed = False
            else:
                response_text = response.text if response.text else "No response body"
                self.log_result("Valid Profile Update", False, 
                              f"Profile update returned status {response.status_code}: {response_text}")
                all_tests_passed = False
                
        except Exception as e:
            self.log_result("Valid Profile Update", False, f"Test failed: {str(e)}")
            all_tests_passed = False
        
        # Scenario 2: Invalid request without email
        print("\n🚫 Scenario 2: Invalid request without email...")
        try:
            invalid_payload = {
                "name": "Test Name"
            }
            
            response = self.session.put(
                f"{self.base_url}/profile",
                json=invalid_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'Email is required' in data['error']:
                    self.log_result("Email Validation", True, 
                                  f"Email validation working correctly: {data['error']}")
                else:
                    self.log_result("Email Validation", False, 
                                  f"Unexpected error message: {data}")
                    all_tests_passed = False
            else:
                self.log_result("Email Validation", False, 
                              f"Expected 400 status for missing email, got {response.status_code}")
                all_tests_passed = False
                
        except Exception as e:
            self.log_result("Email Validation", False, f"Test failed: {str(e)}")
            all_tests_passed = False
        
        # Scenario 3: Non-existent user
        print("\n👻 Scenario 3: Non-existent user...")
        try:
            nonexistent_payload = {
                "email": "nonexistent@example.com",
                "name": "Test Name"
            }
            
            response = self.session.put(
                f"{self.base_url}/profile",
                json=nonexistent_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 404:
                data = response.json()
                if 'error' in data and 'User not found' in data['error']:
                    self.log_result("User Not Found Handling", True, 
                                  f"User not found handling working: {data['error']}")
                else:
                    self.log_result("User Not Found Handling", False, 
                                  f"Unexpected error message: {data}")
                    all_tests_passed = False
            else:
                self.log_result("User Not Found Handling", False, 
                              f"Expected 404 status for non-existent user, got {response.status_code}")
                all_tests_passed = False
                
        except Exception as e:
            self.log_result("User Not Found Handling", False, f"Test failed: {str(e)}")
            all_tests_passed = False
        
        # Scenario 4: Test with only name update (no organization name)
        print("\n📝 Scenario 4: Name-only update...")
        try:
            name_only_payload = {
                "email": current_email,
                "name": "Super Admin Final"
            }
            
            response = self.session.put(
                f"{self.base_url}/profile",
                json=name_only_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    self.log_result("Name-Only Update", True, 
                                  f"Name-only update successful: {data.get('message')}")
                else:
                    self.log_result("Name-Only Update", False, 
                                  f"Name-only update failed: {data.get('error', 'Unknown error')}")
                    all_tests_passed = False
            else:
                self.log_result("Name-Only Update", False, 
                              f"Name-only update returned status {response.status_code}")
                all_tests_passed = False
                
        except Exception as e:
            self.log_result("Name-Only Update", False, f"Test failed: {str(e)}")
            all_tests_passed = False
        
        return all_tests_passed
    
    def test_database_persistence(self, user_data):
        """Test if profile updates are persisted in the database"""
        if not user_data:
            return False
        
        print("\n💾 Testing database persistence...")
        
        try:
            # Update profile with a unique name
            unique_name = f"Test User {datetime.now().strftime('%H%M%S')}"
            payload = {
                "email": user_data.get('email'),
                "name": unique_name
            }
            
            # Make the update
            update_response = self.session.put(
                f"{self.base_url}/profile",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if update_response.status_code != 200:
                self.log_result("Database Persistence", False, 
                              f"Profile update failed with status {update_response.status_code}")
                return False
            
            # Wait a moment for database to update
            import time
            time.sleep(1)
            
            # Check if the update persisted by getting session data
            session_response = self.session.get(f"{self.base_url}/auth/session")
            
            if session_response.status_code == 200:
                session_data = session_response.json()
                persisted_name = session_data.get('name')
                
                if persisted_name == unique_name:
                    self.log_result("Database Persistence", True, 
                                  f"Profile update persisted correctly: {persisted_name}")
                    return True
                else:
                    self.log_result("Database Persistence", False, 
                                  f"Profile update not persisted: expected '{unique_name}', got '{persisted_name}'")
                    return False
            else:
                self.log_result("Database Persistence", False, 
                              f"Could not verify persistence - session endpoint returned {session_response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Database Persistence", False, f"Test failed: {str(e)}")
            return False
    
    def run_profile_tests(self):
        """Run all profile update tests"""
        print("🚀 Starting Profile Update Functionality Tests")
        print("=" * 60)
        
        # Step 1: Login and get session
        user_data = self.test_login_and_get_session()
        if not user_data:
            print("❌ Login failed - aborting profile tests")
            return False
        
        # Step 2: Test profile update scenarios
        scenarios_passed = self.test_profile_update_scenarios(user_data)
        
        # Step 3: Test database persistence
        persistence_passed = self.test_database_persistence(user_data)
        
        # Calculate results
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results if result['passed'])
        
        print("\n" + "=" * 60)
        print(f"🏁 Profile Update Test Results: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All profile update tests passed!")
            print("✅ Profile update functionality is working correctly")
            return True
        else:
            failed_tests = total_tests - passed_tests
            print(f"⚠️  {failed_tests} tests failed")
            print("❌ Profile update functionality has issues")
            
            # Show failed tests
            print("\nFailed tests:")
            for result in self.results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['message']}")
            
            return False

if __name__ == "__main__":
    tester = ProfileUpdateTester()
    success = tester.run_profile_tests()
    
    if success:
        print("\n✅ CONCLUSION: Profile update functionality is working correctly")
    else:
        print("\n❌ CONCLUSION: Profile update functionality needs attention")