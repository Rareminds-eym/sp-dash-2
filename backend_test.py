#!/usr/bin/env python3
"""
Backend Test Script for Export Filter Functionality
Testing both Recruiter Management and Skill Passport export filters
"""

import requests
import json
import csv
import io
from datetime import datetime

# Configuration
BASE_URL = "https://smart-search-14.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Authentication credentials
LOGIN_CREDENTIALS = {
    "email": "superadmin@rareminds.in",
    "password": "password123"
}

class ExportFilterTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def authenticate(self):
        """Authenticate with the API"""
        print("🔐 Authenticating...")
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=LOGIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Authentication successful: {data.get('user', {}).get('email', 'Unknown')}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def count_csv_rows(self, csv_content):
        """Count rows in CSV content (excluding header)"""
        try:
            reader = csv.reader(io.StringIO(csv_content))
            rows = list(reader)
            return len(rows) - 1 if len(rows) > 0 else 0  # Subtract header row
        except Exception as e:
            print(f"❌ Error counting CSV rows: {str(e)}")
            return -1
    
    def test_api_endpoint(self, endpoint, params=None):
        """Test regular API endpoint and return count"""
        try:
            # Add high limit to get all records for comparison
            if params is None:
                params = {}
            params['limit'] = 1000  # High limit to get all records
            
            response = self.session.get(f"{API_BASE}{endpoint}", params=params)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and 'data' in data:
                    return len(data['data'])
                elif isinstance(data, list):
                    return len(data)
                else:
                    return 0
            else:
                print(f"❌ API endpoint failed: {response.status_code} - {response.text}")
                return -1
        except Exception as e:
            print(f"❌ API endpoint error: {str(e)}")
            return -1
    
    def test_export_endpoint(self, endpoint, params=None):
        """Test export endpoint and return CSV row count"""
        try:
            response = self.session.get(f"{API_BASE}{endpoint}", params=params)
            if response.status_code == 200:
                if response.headers.get('content-type') == 'text/csv':
                    return self.count_csv_rows(response.text)
                else:
                    print(f"❌ Export endpoint returned non-CSV content: {response.headers.get('content-type')}")
                    return -1
            else:
                print(f"❌ Export endpoint failed: {response.status_code} - {response.text}")
                return -1
        except Exception as e:
            print(f"❌ Export endpoint error: {str(e)}")
            return -1
    
    def run_test_case(self, test_name, api_endpoint, export_endpoint, params=None):
        """Run a single test case comparing API and export counts"""
        print(f"\n📋 Testing: {test_name}")
        print(f"   Filters: {params if params else 'None'}")
        
        # Test regular API endpoint
        api_count = self.test_api_endpoint(api_endpoint, params)
        print(f"   API Count: {api_count}")
        
        # Test export endpoint
        export_count = self.test_export_endpoint(export_endpoint, params)
        print(f"   Export Count: {export_count}")
        
        # Compare results
        if api_count == -1 or export_count == -1:
            result = "❌ FAILED - Endpoint Error"
            success = False
        elif api_count == export_count:
            result = "✅ PASSED - Counts Match"
            success = True
        else:
            result = f"❌ FAILED - Count Mismatch (API: {api_count}, Export: {export_count})"
            success = False
        
        print(f"   Result: {result}")
        
        self.test_results.append({
            'test_name': test_name,
            'api_count': api_count,
            'export_count': export_count,
            'success': success,
            'result': result,
            'params': params
        })
        
        return success
    
    def test_recruiters_export_filters(self):
        """Test all recruiter export filter scenarios"""
        print("\n" + "="*60)
        print("🏢 TESTING RECRUITERS EXPORT FILTERS")
        print("="*60)
        
        test_cases = [
            {
                'name': 'Status Filter - Pending',
                'params': {'status': 'pending'}
            },
            {
                'name': 'Active Filter - True',
                'params': {'active': 'true'}
            },
            {
                'name': 'State Filter - Tamil Nadu',
                'params': {'state': 'Tamil Nadu'}
            },
            {
                'name': 'Search Filter - tech',
                'params': {'search': 'tech'}
            },
            {
                'name': 'Combined Filters - approved+active+solutions',
                'params': {'status': 'approved', 'active': 'true', 'search': 'solutions'}
            }
        ]
        
        passed = 0
        total = len(test_cases)
        
        for test_case in test_cases:
            success = self.run_test_case(
                test_case['name'],
                '/recruiters',
                '/recruiters/export',
                test_case['params']
            )
            if success:
                passed += 1
        
        print(f"\n📊 Recruiters Export Tests: {passed}/{total} passed")
        return passed, total
    
    def get_university_id(self):
        """Get a university ID for testing"""
        try:
            response = self.session.get(f"{API_BASE}/passports/universities")
            if response.status_code == 200:
                universities = response.json()
                if universities and len(universities) > 0:
                    return universities[0]['id']
            return None
        except:
            return None
    
    def get_student_email(self):
        """Get a student email for search testing"""
        try:
            # Get a larger sample to find a student with email
            response = self.session.get(f"{API_BASE}/passports", params={'limit': 50})
            if response.status_code == 200:
                data = response.json()
                if data.get('data') and len(data['data']) > 0:
                    for passport in data['data']:
                        student_email = (passport.get('students', {}).get('email') or 
                                       passport.get('students', {}).get('users', {}).get('email'))
                        if student_email:
                            # Test if this email actually works in the regular API
                            test_response = self.session.get(f"{API_BASE}/passports", 
                                                           params={'search': student_email, 'limit': 1000})
                            if test_response.status_code == 200:
                                test_data = test_response.json()
                                if test_data.get('data') and len(test_data['data']) > 0:
                                    return student_email
            return None
        except:
            return None
    
    def test_passports_export_filters(self):
        """Test all passport export filter scenarios"""
        print("\n" + "="*60)
        print("🎓 TESTING PASSPORTS EXPORT FILTERS")
        print("="*60)
        
        # Get dynamic test data
        university_id = self.get_university_id()
        student_email = self.get_student_email()
        
        print(f"📋 Test Data - University ID: {university_id}")
        print(f"📋 Test Data - Student Email: {student_email}")
        
        test_cases = [
            {
                'name': 'Status Filter - Verified',
                'params': {'status': 'verified'}
            },
            {
                'name': 'NSQF Level Filter - Level 5',
                'params': {'nsqfLevel': '5'}
            },
            {
                'name': 'University Filter',
                'params': {'university': university_id} if university_id else None
            },
            {
                'name': 'Search Filter - Student Email',
                'params': {'search': student_email} if student_email else None
            },
            {
                'name': 'Combined Filters - pending+level4',
                'params': {'status': 'pending', 'nsqfLevel': '4'}
            }
        ]
        
        passed = 0
        total = 0
        
        for test_case in test_cases:
            if test_case['params'] is None:
                print(f"\n⚠️  Skipping {test_case['name']} - No test data available")
                continue
                
            total += 1
            success = self.run_test_case(
                test_case['name'],
                '/passports',
                '/passports/export',
                test_case['params']
            )
            if success:
                passed += 1
        
        print(f"\n📊 Passports Export Tests: {passed}/{total} passed")
        return passed, total
    
    def verify_csv_format(self, endpoint, params=None):
        """Verify CSV format and headers"""
        try:
            response = self.session.get(f"{API_BASE}{endpoint}", params=params)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                csv_format_ok = content_type == 'text/csv'
                attachment_ok = 'attachment' in content_disposition
                
                return csv_format_ok and attachment_ok, response.text[:200]  # First 200 chars
            return False, "Request failed"
        except Exception as e:
            return False, str(e)
    
    def run_format_verification(self):
        """Verify CSV format for both endpoints"""
        print("\n" + "="*60)
        print("📄 VERIFYING CSV FORMAT")
        print("="*60)
        
        # Test recruiters export format
        print("\n🏢 Recruiters Export Format:")
        format_ok, sample = self.verify_csv_format('/recruiters/export')
        print(f"   Format Valid: {'✅' if format_ok else '❌'}")
        print(f"   Sample: {sample}")
        
        # Test passports export format
        print("\n🎓 Passports Export Format:")
        format_ok, sample = self.verify_csv_format('/passports/export')
        print(f"   Format Valid: {'✅' if format_ok else '❌'}")
        print(f"   Sample: {sample}")
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "N/A")
        
        # Print failed tests
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test_name']}: {test['result']}")
        
        # Print passed tests
        passed_test_list = [result for result in self.test_results if result['success']]
        if passed_test_list:
            print(f"\n✅ PASSED TESTS:")
            for test in passed_test_list:
                print(f"   • {test['test_name']}: API={test['api_count']}, Export={test['export_count']}")
    
    def run_all_tests(self):
        """Run all export filter tests"""
        print("🚀 Starting Export Filter Testing")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Run CSV format verification
        self.run_format_verification()
        
        # Run recruiter tests
        recruiter_passed, recruiter_total = self.test_recruiters_export_filters()
        
        # Run passport tests
        passport_passed, passport_total = self.test_passports_export_filters()
        
        # Print summary
        self.print_summary()
        
        # Final result
        total_passed = recruiter_passed + passport_passed
        total_tests = recruiter_total + passport_total
        
        print(f"\n🎯 FINAL RESULT: {total_passed}/{total_tests} tests passed")
        
        if total_passed == total_tests:
            print("🎉 ALL EXPORT FILTER TESTS PASSED!")
            return True
        else:
            print("⚠️  Some export filter tests failed. Review results above.")
            return False

def main():
    """Main function"""
    tester = ExportFilterTester()
    success = tester.run_all_tests()
    
    if success:
        exit(0)
    else:
        exit(1)

if __name__ == "__main__":
    main()
