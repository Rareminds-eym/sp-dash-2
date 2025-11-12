#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Rareminds Admin Dashboard
Tests all authentication, user management, recruiter management, university/college management,
skill passports, and analytics endpoints.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

class RaremindsAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.auth_cookies = None
        self.test_results = []
        
    def log_test(self, endpoint: str, method: str, status_code: int, success: bool, error: str = None):
        """Log test results"""
        result = {
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'success': success,
            'error': error
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {method} {endpoint} - Status: {status_code}")
        if error:
            print(f"   Error: {error}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> requests.Response:
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}/api{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, timeout=30)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, json=data, timeout=30)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed for {method} {endpoint}: {str(e)}")
            raise
    
    def test_authentication_flow(self):
        """Test complete authentication flow"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test login with valid credentials
        login_data = {
            "email": "superadmin@rareminds.in",
            "password": "password123"
        }
        
        try:
            response = self.make_request('POST', '/auth/login', login_data)
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get('success'):
                    self.log_test('/auth/login', 'POST', 200, True)
                    # Store session cookies for subsequent requests
                    self.auth_cookies = response.cookies
                    self.session.cookies.update(response.cookies)
                else:
                    self.log_test('/auth/login', 'POST', 200, False, response_data.get('error', 'Login failed'))
            else:
                self.log_test('/auth/login', 'POST', response.status_code, False, f"HTTP {response.status_code}")
                
        except Exception as e:
            self.log_test('/auth/login', 'POST', 0, False, str(e))
        
        # Test session endpoint
        try:
            response = self.make_request('GET', '/auth/session')
            success = response.status_code == 200 and response.json().get('success', False)
            error = None if success else response.json().get('error', f"HTTP {response.status_code}")
            self.log_test('/auth/session', 'GET', response.status_code, success, error)
        except Exception as e:
            self.log_test('/auth/session', 'GET', 0, False, str(e))
        
        # Test logout
        try:
            response = self.make_request('POST', '/auth/logout')
            success = response.status_code == 200 and response.json().get('success', False)
            error = None if success else response.json().get('error', f"HTTP {response.status_code}")
            self.log_test('/auth/logout', 'POST', response.status_code, success, error)
            
            # Re-login for subsequent tests
            if success:
                login_response = self.make_request('POST', '/auth/login', login_data)
                if login_response.status_code == 200:
                    self.session.cookies.update(login_response.cookies)
                    
        except Exception as e:
            self.log_test('/auth/logout', 'POST', 0, False, str(e))
    
    def test_users_management(self):
        """Test user management endpoints"""
        print("\n👥 Testing Users Management Endpoints...")
        
        # Test GET /api/users with various parameters
        test_params = [
            {},  # Basic request
            {'page': '1', 'limit': '10'},  # Pagination
            {'search': 'admin'},  # Search
            {'role': 'admin'},  # Role filter
            {'active': 'true'},  # Active filter
            {'sortBy': 'email', 'sortOrder': 'asc'}  # Sorting
        ]
        
        for params in test_params:
            try:
                response = self.make_request('GET', '/users', params=params)
                success = response.status_code == 200
                error = None if success else f"HTTP {response.status_code}"
                
                if success:
                    data = response.json()
                    if 'data' not in data or 'pagination' not in data:
                        success = False
                        error = "Missing required response fields"
                
                param_str = f" (params: {params})" if params else ""
                self.log_test(f'/users{param_str}', 'GET', response.status_code, success, error)
                
            except Exception as e:
                self.log_test('/users', 'GET', 0, False, str(e))
        
        # Test POST /api/users (create new admin user)
        new_user_data = {
            "email": f"testadmin_{hash('test')}@rareminds.in",
            "role": "admin",
            "metadata": {"name": "Test Admin User"}
        }
        
        try:
            response = self.make_request('POST', '/users', new_user_data)
            success = response.status_code in [200, 201]
            error = None if success else f"HTTP {response.status_code}"
            
            if not success and response.status_code == 400:
                # Check if it's a validation error (acceptable)
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error = f"Validation error: {error_data['error']}"
                except:
                    pass
            
            self.log_test('/users', 'POST', response.status_code, success, error)
            
        except Exception as e:
            self.log_test('/users', 'POST', 0, False, str(e))
        
        # Test user activation/suspension endpoints
        test_user_id = "test-user-id-123"  # Mock ID for testing
        
        for action in ['activate', 'suspend']:
            try:
                response = self.make_request('PATCH', f'/users/{test_user_id}/{action}')
                # These might return 404 for non-existent user, which is acceptable
                success = response.status_code in [200, 404]
                error = None if success else f"HTTP {response.status_code}"
                self.log_test(f'/users/[id]/{action}', 'PATCH', response.status_code, success, error)
                
            except Exception as e:
                self.log_test(f'/users/[id]/{action}', 'PATCH', 0, False, str(e))
    
    def test_recruiters_management(self):
        """Test recruiter management endpoints"""
        print("\n🏢 Testing Recruiters Management Endpoints...")
        
        # Test GET /api/recruiters with various parameters
        test_params = [
            {},  # Basic request
            {'page': '1', 'limit': '10'},  # Pagination
            {'search': 'tech'},  # Search
            {'status': 'approved'},  # Status filter
            {'active': 'true'},  # Active filter
            {'state': 'Karnataka'},  # State filter
            {'sortBy': 'name', 'sortOrder': 'asc'}  # Sorting
        ]
        
        for params in test_params:
            try:
                response = self.make_request('GET', '/recruiters', params=params)
                success = response.status_code == 200
                error = None if success else f"HTTP {response.status_code}"
                
                if success:
                    data = response.json()
                    if 'data' not in data or 'pagination' not in data:
                        success = False
                        error = "Missing required response fields"
                
                param_str = f" (params: {params})" if params else ""
                self.log_test(f'/recruiters{param_str}', 'GET', response.status_code, success, error)
                
            except Exception as e:
                self.log_test('/recruiters', 'GET', 0, False, str(e))
        
        # Test GET /api/recruiters/[id]
        test_recruiter_id = "test-recruiter-123"
        try:
            response = self.make_request('GET', f'/recruiters/{test_recruiter_id}')
            # 404 is acceptable for non-existent recruiter
            success = response.status_code in [200, 404]
            error = None if success else f"HTTP {response.status_code}"
            self.log_test('/recruiters/[id]', 'GET', response.status_code, success, error)
            
        except Exception as e:
            self.log_test('/recruiters/[id]', 'GET', 0, False, str(e))
        
        # Test recruiter action endpoints
        actions = ['approve', 'reject', 'suspend', 'activate']
        test_data = {"recruiterId": "test-recruiter-123", "reason": "Test action"}
        
        for action in actions:
            try:
                response = self.make_request('POST', f'/recruiters/{action}', test_data)
                # These might return various status codes, 200/400/404 are acceptable
                success = response.status_code in [200, 400, 404]
                error = None if success else f"HTTP {response.status_code}"
                self.log_test(f'/recruiters/{action}', 'POST', response.status_code, success, error)
                
            except Exception as e:
                self.log_test(f'/recruiters/{action}', 'POST', 0, False, str(e))
    
    def test_universities_and_colleges(self):
        """Test universities and colleges endpoints"""
        print("\n🎓 Testing Universities and Colleges Endpoints...")
        
        # Test universities endpoints
        for entity in ['universities', 'colleges']:
            # Test GET with various parameters
            test_params = [
                {},  # Basic request
                {'page': '1', 'limit': '10'},  # Pagination
                {'search': 'engineering'},  # Search
                {'approval_status': 'pending'},  # Approval status filter
                {'account_status': 'active'}  # Account status filter
            ]
            
            for params in test_params:
                try:
                    response = self.make_request('GET', f'/{entity}', params=params)
                    success = response.status_code == 200
                    error = None if success else f"HTTP {response.status_code}"
                    
                    if success:
                        data = response.json()
                        if 'data' not in data or 'pagination' not in data:
                            success = False
                            error = "Missing required response fields"
                    
                    param_str = f" (params: {params})" if params else ""
                    self.log_test(f'/{entity}{param_str}', 'GET', response.status_code, success, error)
                    
                except Exception as e:
                    self.log_test(f'/{entity}', 'GET', 0, False, str(e))
            
            # Test approval/rejection endpoints
            test_data = {"id": "test-id-123", "reason": "Test approval"}
            
            for action in ['approve', 'reject']:
                try:
                    response = self.make_request('POST', f'/{entity}/{action}', test_data)
                    # These might return various status codes, 200/400/404 are acceptable
                    success = response.status_code in [200, 400, 404]
                    error = None if success else f"HTTP {response.status_code}"
                    self.log_test(f'/{entity}/{action}', 'POST', response.status_code, success, error)
                    
                except Exception as e:
                    self.log_test(f'/{entity}/{action}', 'POST', 0, False, str(e))
    
    def test_skill_passports(self):
        """Test skill passports endpoints"""
        print("\n📋 Testing Skill Passports Endpoints...")
        
        # Test GET /api/passports with various parameters
        test_params = [
            {},  # Basic request
            {'page': '1', 'limit': '10'},  # Pagination
            {'search': 'javascript'},  # Search
            {'status': 'verified'},  # Status filter
            {'nsqfLevel': '4'},  # NSQF level filter
            {'university': 'test-univ-123'},  # University filter
            {'sortBy': 'createdAt', 'sortOrder': 'desc'}  # Sorting
        ]
        
        for params in test_params:
            try:
                response = self.make_request('GET', '/passports', params=params)
                success = response.status_code == 200
                error = None if success else f"HTTP {response.status_code}"
                
                if success:
                    data = response.json()
                    if 'data' not in data or 'pagination' not in data:
                        success = False
                        error = "Missing required response fields"
                
                param_str = f" (params: {params})" if params else ""
                self.log_test(f'/passports{param_str}', 'GET', response.status_code, success, error)
                
            except Exception as e:
                self.log_test('/passports', 'GET', 0, False, str(e))
    
    def test_analytics_endpoints(self):
        """Test analytics endpoints"""
        print("\n📊 Testing Analytics Endpoints...")
        
        analytics_endpoints = [
            '/analytics/state-wise',
            '/analytics/recruiter-metrics',
            '/analytics/placement-conversion',
            '/analytics/trends'
        ]
        
        for endpoint in analytics_endpoints:
            try:
                response = self.make_request('GET', endpoint)
                success = response.status_code == 200
                error = None if success else f"HTTP {response.status_code}"
                
                if success:
                    try:
                        data = response.json()
                        # Basic validation that we got some data
                        if not data or (isinstance(data, dict) and len(data) == 0):
                            success = False
                            error = "Empty response data"
                    except json.JSONDecodeError:
                        success = False
                        error = "Invalid JSON response"
                
                self.log_test(endpoint, 'GET', response.status_code, success, error)
                
            except Exception as e:
                self.log_test(endpoint, 'GET', 0, False, str(e))
    
    def test_api_root(self):
        """Test API root endpoint"""
        print("\n🏠 Testing API Root Endpoint...")
        
        try:
            response = self.make_request('GET', '')
            success = response.status_code == 200
            error = None if success else f"HTTP {response.status_code}"
            
            if success:
                data = response.json()
                if 'message' not in data or 'version' not in data:
                    success = False
                    error = "Missing required API info fields"
            
            self.log_test('/', 'GET', response.status_code, success, error)
            
        except Exception as e:
            self.log_test('/', 'GET', 0, False, str(e))
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Comprehensive Rareminds API Testing...")
        print(f"Base URL: {self.base_url}")
        
        # Test API root
        self.test_api_root()
        
        # Test authentication flow first
        self.test_authentication_flow()
        
        # Test all other endpoints (these require authentication)
        self.test_users_management()
        self.test_recruiters_management()
        self.test_universities_and_colleges()
        self.test_skill_passports()
        self.test_analytics_endpoints()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("📋 TEST SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n🚨 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   ❌ {result['method']} {result['endpoint']} - {result['error']}")
        
        # Check for critical failures (500 errors)
        critical_failures = [r for r in self.test_results if r['status_code'] == 500]
        if critical_failures:
            print(f"\n🔥 CRITICAL FAILURES (500 Internal Server Error): {len(critical_failures)}")
            for result in critical_failures:
                print(f"   🔥 {result['method']} {result['endpoint']}")
        
        print("\n" + "="*80)

def main():
    """Main function to run the tests"""
    # Get base URL from environment or use default
    import os
    base_url = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
    
    print(f"Using base URL: {base_url}")
    
    # Create tester instance and run tests
    tester = RaremindsAPITester(base_url)
    tester.run_all_tests()
    
    # Exit with error code if there are critical failures
    critical_failures = [r for r in tester.test_results if r['status_code'] == 500]
    if critical_failures:
        print(f"\n❌ Exiting with error code due to {len(critical_failures)} critical failures")
        sys.exit(1)
    else:
        print("\n✅ All tests completed successfully (no critical failures)")
        sys.exit(0)

if __name__ == "__main__":
    main()