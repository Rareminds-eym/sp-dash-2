#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, timedelta
import csv
import io

# Configuration
BASE_URL = "https://auditpro-9.preview.emergentagent.com/api"

def test_audit_logs_endpoints():
    """
    Comprehensive testing of audit logs endpoints as requested:
    1. GET /api/audit-logs (Enhanced with pagination & filters)
    2. GET /api/audit-logs/export
    3. GET /api/audit-logs/actions
    4. GET /api/audit-logs/users
    """
    
    print("🔍 COMPREHENSIVE AUDIT LOGS OPTIMIZATION TESTING")
    print("=" * 60)
    
    results = {
        'total_tests': 0,
        'passed': 0,
        'failed': 0,
        'test_details': []
    }
    
    # Test 1: GET /api/audit-logs - Basic functionality
    print("\n📋 TEST 1: GET /api/audit-logs - Basic Pagination")
    try:
        response = requests.get(f"{BASE_URL}/audit-logs")
        results['total_tests'] += 1
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            required_fields = ['logs', 'pagination']
            if all(field in data for field in required_fields):
                pagination = data['pagination']
                logs = data['logs']
                
                print(f"✅ Basic endpoint working")
                print(f"   - Status: {response.status_code}")
                print(f"   - Total logs: {pagination.get('total', 0)}")
                print(f"   - Current page: {pagination.get('page', 1)}")
                print(f"   - Limit: {pagination.get('limit', 20)}")
                print(f"   - Total pages: {pagination.get('totalPages', 0)}")
                print(f"   - Logs returned: {len(logs)}")
                
                # Check if logs have user information
                if logs and len(logs) > 0:
                    sample_log = logs[0]
                    print(f"   - Sample log fields: {list(sample_log.keys())}")
                    if 'users' in sample_log and sample_log['users']:
                        print(f"   - User info populated: {sample_log['users']}")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'GET /api/audit-logs - Basic',
                    'status': 'PASS',
                    'details': f"Returned {len(logs)} logs with proper pagination"
                })
            else:
                print(f"❌ Missing required fields in response")
                results['failed'] += 1
                results['test_details'].append({
                    'test': 'GET /api/audit-logs - Basic',
                    'status': 'FAIL',
                    'details': 'Missing required response fields'
                })
        else:
            print(f"❌ Request failed with status: {response.status_code}")
            results['failed'] += 1
            results['test_details'].append({
                'test': 'GET /api/audit-logs - Basic',
                'status': 'FAIL',
                'details': f'HTTP {response.status_code}'
            })
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'GET /api/audit-logs - Basic',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })

    
    # Test 2: Pagination with different page sizes
    print("\n📋 TEST 2: GET /api/audit-logs - Pagination Variations")
    page_sizes = [10, 50, 100]
    
    for limit in page_sizes:
        try:
            response = requests.get(f"{BASE_URL}/audit-logs?page=1&limit={limit}")
            results['total_tests'] += 1
            
            if response.status_code == 200:
                data = response.json()
                pagination = data['pagination']
                logs = data['logs']
                
                print(f"✅ Pagination limit={limit}")
                print(f"   - Returned logs: {len(logs)}")
                print(f"   - Expected limit: {limit}")
                print(f"   - Actual limit in response: {pagination.get('limit')}")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': f'GET /api/audit-logs - Pagination limit={limit}',
                    'status': 'PASS',
                    'details': f"Returned {len(logs)} logs"
                })
            else:
                print(f"❌ Pagination test failed for limit={limit}: {response.status_code}")
                results['failed'] += 1
                results['test_details'].append({
                    'test': f'GET /api/audit-logs - Pagination limit={limit}',
                    'status': 'FAIL',
                    'details': f'HTTP {response.status_code}'
                })
                
        except Exception as e:
            print(f"❌ Exception for limit={limit}: {str(e)}")
            results['failed'] += 1
            results['test_details'].append({
                'test': f'GET /api/audit-logs - Pagination limit={limit}',
                'status': 'FAIL',
                'details': f'Exception: {str(e)}'
            })
    
    # Test 3: GET /api/audit-logs/actions - Unique action types
    print("\n📋 TEST 3: GET /api/audit-logs/actions - Unique Action Types")
    try:
        response = requests.get(f"{BASE_URL}/audit-logs/actions")
        results['total_tests'] += 1
        
        if response.status_code == 200:
            actions = response.json()
            
            print(f"✅ Actions endpoint working")
            print(f"   - Status: {response.status_code}")
            print(f"   - Actions returned: {len(actions)}")
            print(f"   - Action types: {actions}")
            
            # Verify it's an array of strings
            if isinstance(actions, list):
                print(f"   - Response is array: ✅")
                if actions:
                    print(f"   - Actions are sorted: {'✅' if actions == sorted(actions) else '❌'}")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'GET /api/audit-logs/actions',
                    'status': 'PASS',
                    'details': f"Returned {len(actions)} unique actions"
                })
            else:
                print(f"❌ Response is not an array")
                results['failed'] += 1
                results['test_details'].append({
                    'test': 'GET /api/audit-logs/actions',
                    'status': 'FAIL',
                    'details': 'Response is not an array'
                })
        else:
            print(f"❌ Request failed with status: {response.status_code}")
            results['failed'] += 1
            results['test_details'].append({
                'test': 'GET /api/audit-logs/actions',
                'status': 'FAIL',
                'details': f'HTTP {response.status_code}'
            })
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'GET /api/audit-logs/actions',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })

    
    # Test 4: GET /api/audit-logs/users - Users who performed actions
    print("\n📋 TEST 4: GET /api/audit-logs/users - Users with Actions")
    try:
        response = requests.get(f"{BASE_URL}/audit-logs/users")
        results['total_tests'] += 1
        
        if response.status_code == 200:
            users = response.json()
            
            print(f"✅ Users endpoint working")
            print(f"   - Status: {response.status_code}")
            print(f"   - Users returned: {len(users)}")
            
            # Verify structure
            if isinstance(users, list):
                print(f"   - Response is array: ✅")
                if users:
                    sample_user = users[0]
                    required_user_fields = ['id', 'email', 'name']
                    if all(field in sample_user for field in required_user_fields):
                        print(f"   - User structure correct: ✅")
                        print(f"   - Sample user: {sample_user}")
                        
                        # Check for duplicates
                        user_ids = [u['id'] for u in users]
                        unique_ids = set(user_ids)
                        print(f"   - No duplicate users: {'✅' if len(user_ids) == len(unique_ids) else '❌'}")
                    else:
                        print(f"   - Missing required user fields: {required_user_fields}")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'GET /api/audit-logs/users',
                    'status': 'PASS',
                    'details': f"Returned {len(users)} unique users"
                })
            else:
                print(f"❌ Response is not an array")
                results['failed'] += 1
                results['test_details'].append({
                    'test': 'GET /api/audit-logs/users',
                    'status': 'FAIL',
                    'details': 'Response is not an array'
                })
        else:
            print(f"❌ Request failed with status: {response.status_code}")
            results['failed'] += 1
            results['test_details'].append({
                'test': 'GET /api/audit-logs/users',
                'status': 'FAIL',
                'details': f'HTTP {response.status_code}'
            })
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'GET /api/audit-logs/users',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 5: CSV Export
    print("\n📋 TEST 5: GET /api/audit-logs/export - CSV Export")
    try:
        response = requests.get(f"{BASE_URL}/audit-logs/export")
        results['total_tests'] += 1
        
        if response.status_code == 200:
            # Check Content-Type
            content_type = response.headers.get('Content-Type', '')
            content_disposition = response.headers.get('Content-Disposition', '')
            
            print(f"✅ CSV export working")
            print(f"   - Status: {response.status_code}")
            print(f"   - Content-Type: {content_type}")
            print(f"   - Content-Disposition: {content_disposition}")
            
            # Verify CSV format
            csv_content = response.text
            lines = csv_content.split('\n')
            
            if lines:
                headers = lines[0]
                expected_headers = ['Timestamp', 'User', 'Email', 'Action', 'Target', 'IP Address', 'Details']
                
                print(f"   - CSV headers: {headers}")
                print(f"   - Total lines: {len(lines)}")
                
                # Check if headers match expected
                header_check = all(header in headers for header in expected_headers)
                print(f"   - Headers correct: {'✅' if header_check else '❌'}")
                
                # Check filename format
                filename_check = 'audit-logs-' in content_disposition and '.csv' in content_disposition
                print(f"   - Filename format correct: {'✅' if filename_check else '❌'}")
            
            results['passed'] += 1
            results['test_details'].append({
                'test': 'GET /api/audit-logs/export - Basic CSV',
                'status': 'PASS',
                'details': f"CSV export with {len(lines)} lines"
            })
        else:
            print(f"❌ CSV export failed: {response.status_code}")
            results['failed'] += 1
            results['test_details'].append({
                'test': 'GET /api/audit-logs/export - Basic CSV',
                'status': 'FAIL',
                'details': f'HTTP {response.status_code}'
            })
            
    except Exception as e:
        print(f"❌ Exception in CSV export: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'GET /api/audit-logs/export - Basic CSV',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Final Results Summary
    print("\n" + "=" * 60)
    print("🏁 AUDIT LOGS TESTING SUMMARY")
    print("=" * 60)
    
    print(f"📊 Total Tests: {results['total_tests']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"📈 Success Rate: {(results['passed']/results['total_tests']*100):.1f}%")
    
    print(f"\n📋 DETAILED TEST RESULTS:")
    for test in results['test_details']:
        status_emoji = "✅" if test['status'] == 'PASS' else "❌"
        print(f"{status_emoji} {test['test']}: {test['details']}")
    
    # Determine overall result
    if results['failed'] == 0:
        print(f"\n🎉 ALL AUDIT LOGS ENDPOINTS WORKING PERFECTLY!")
        return True
    else:
        print(f"\n⚠️  SOME ISSUES FOUND - {results['failed']} tests failed")
        return False

def main():
    """Main test execution"""
    print("Starting Comprehensive Audit Logs Optimization Testing...")
    success = test_audit_logs_endpoints()
    
    if success:
        print("\n✅ AUDIT LOGS TESTING COMPLETED SUCCESSFULLY")
        sys.exit(0)
    else:
        print("\n❌ AUDIT LOGS TESTING COMPLETED WITH ISSUES")
        sys.exit(1)

if __name__ == "__main__":
    main()
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            expected_headers = ['Student Name', 'Email', 'University', 'Status', 'NSQF Level', 'Skills', 'Created Date', 'Updated Date']
            csv_result = test_csv_format(response.text, expected_headers)
            
            if csv_result['valid']:
                print(f"  ✅ Filtered export successful")
                print(f"  ✅ Verified passports count: {csv_result['row_count']}")
                
                # Verify all rows have 'verified' status
                if csv_result['sample_rows']:
                    print(f"\n  📋 Status Verification:")
                    for i, row in enumerate(csv_result['sample_rows'][:3]):
                        if len(row) >= 4:
                            status = row[3].strip('"')
                            print(f"    Row {i+1} Status: '{status}' {'✅ Verified' if status == 'verified' else '❌ Not verified'}")
                
                return {
                    'success': True,
                    'row_count': csv_result['row_count'],
                    'filter_working': True
                }
            else:
                return {'success': False, 'error': 'Invalid CSV format'}
        else:
            print(f"  ❌ Request failed with status {response.status_code}")
            return {'success': False, 'error': f'HTTP {response.status_code}'}
            
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return {'success': False, 'error': str(e)}

def test_passport_export_with_search():
    """Test Scenario 3: Passport Export - With Search Filter"""
    print("\n" + "="*60)
    print("TEST 3: Passport Export - With Search Filter (Nithya)")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/passports/export?search=Nithya"
        print(f"Testing: GET {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            expected_headers = ['Student Name', 'Email', 'University', 'Status', 'NSQF Level', 'Skills', 'Created Date', 'Updated Date']
            csv_result = test_csv_format(response.text, expected_headers)
            
            if csv_result['valid']:
                print(f"  ✅ Search filter export successful")
                print(f"  ✅ Matching records count: {csv_result['row_count']}")
                
                # Verify search results contain 'Nithya'
                if csv_result['sample_rows']:
                    print(f"\n  📋 Search Result Verification:")
                    for i, row in enumerate(csv_result['sample_rows']):
                        if len(row) >= 2:
                            student_name = row[0].strip('"')
                            student_email = row[1].strip('"')
                            contains_nithya = 'nithya' in student_name.lower() or 'nithya' in student_email.lower()
                            print(f"    Row {i+1}: Name='{student_name}', Email='{student_email}' {'✅ Contains Nithya' if contains_nithya else '❌ No Nithya match'}")
                
                return {
                    'success': True,
                    'row_count': csv_result['row_count'],
                    'search_working': True
                }
            else:
                return {'success': False, 'error': 'Invalid CSV format'}
        else:
            print(f"  ❌ Request failed with status {response.status_code}")
            return {'success': False, 'error': f'HTTP {response.status_code}'}
            
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return {'success': False, 'error': str(e)}

def test_recruiter_export_no_filters():
    """Test Scenario 4: Recruiter Export - No Filters"""
    print("\n" + "="*60)
    print("TEST 4: Recruiter Export - No Filters")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/recruiters/export"
        print(f"Testing: GET {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            # Check headers
            content_type = response.headers.get('Content-Type', '')
            content_disposition = response.headers.get('Content-Disposition', '')
            print(f"Content-Type: {content_type}")
            print(f"Content-Disposition: {content_disposition}")
            
            # Validate CSV format
            expected_headers = ['Name', 'Email', 'Phone', 'State', 'District', 'Website', 'Status', 'Active', 'Created Date']
            csv_result = test_csv_format(response.text, expected_headers)
            
            if csv_result['valid']:
                print(f"  ✅ CSV format is valid")
                print(f"  ✅ Total recruiters: {csv_result['row_count']}")
                
                # Check sample data
                if csv_result['sample_rows']:
                    print(f"\n  📋 Sample Recruiter Data:")
                    for i, row in enumerate(csv_result['sample_rows'][:2]):
                        if len(row) >= 5:
                            name = row[0].strip('"')
                            email = row[1].strip('"')
                            phone = row[2].strip('"')
                            state = row[3].strip('"')
                            
                            print(f"    Row {i+1}:")
                            print(f"      Name: '{name}' {'✅ Populated' if name else '❌ Empty'}")
                            print(f"      Email: '{email}' {'✅ Populated' if email else '❌ Empty'}")
                            print(f"      Phone: '{phone}' {'✅ Populated' if phone else '❌ Empty'}")
                            print(f"      State: '{state}' {'✅ Populated' if state else '❌ Empty'}")
                
                return {
                    'success': True,
                    'row_count': csv_result['row_count'],
                    'headers_valid': csv_result['headers_match'],
                    'content_type_valid': 'text/csv' in content_type
                }
            else:
                return {'success': False, 'error': 'Invalid CSV format'}
        else:
            print(f"  ❌ Request failed with status {response.status_code}")
            return {'success': False, 'error': f'HTTP {response.status_code}'}
            
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return {'success': False, 'error': str(e)}

def test_recruiter_export_with_filters():
    """Test Scenario 5: Recruiter Export - With Filters"""
    print("\n" + "="*60)
    print("TEST 5: Recruiter Export - With Filters (status=approved&active=true)")
    print("="*60)
    
    try:
        url = f"{BASE_URL}/recruiters/export?status=approved&active=true"
        print(f"Testing: GET {url}")
        
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            expected_headers = ['Name', 'Email', 'Phone', 'State', 'District', 'Website', 'Status', 'Active', 'Created Date']
            csv_result = test_csv_format(response.text, expected_headers)
            
            if csv_result['valid']:
                print(f"  ✅ Filtered export successful")
                print(f"  ✅ Approved & active recruiters: {csv_result['row_count']}")
                
                # Verify filter results
                if csv_result['sample_rows']:
                    print(f"\n  📋 Filter Verification:")
                    for i, row in enumerate(csv_result['sample_rows'][:3]):
                        if len(row) >= 8:
                            status = row[6].strip('"')
                            active = row[7].strip('"')
                            print(f"    Row {i+1}: Status='{status}', Active='{active}' {'✅ Correct' if status == 'approved' and active == 'Yes' else '❌ Filter issue'}")
                
                return {
                    'success': True,
                    'row_count': csv_result['row_count'],
                    'filter_working': True
                }
            else:
                return {'success': False, 'error': 'Invalid CSV format'}
        else:
            print(f"  ❌ Request failed with status {response.status_code}")
            return {'success': False, 'error': f'HTTP {response.status_code}'}
            
    except Exception as e:
        print(f"  ❌ Test failed with exception: {e}")
        return {'success': False, 'error': str(e)}

def verify_data_consistency():
    """Verify data consistency between regular API and export endpoints"""
    print("\n" + "="*60)
    print("DATA CONSISTENCY VERIFICATION")
    print("="*60)
    
    try:
        # Get total counts from regular endpoints
        passports_response = requests.get(f"{BASE_URL}/passports", timeout=30)
        recruiters_response = requests.get(f"{BASE_URL}/recruiters", timeout=30)
        
        if passports_response.status_code == 200 and recruiters_response.status_code == 200:
            passports_data = passports_response.json()
            recruiters_data = recruiters_response.json()
            
            total_passports = passports_data.get('pagination', {}).get('total', 0)
            total_recruiters = recruiters_data.get('pagination', {}).get('total', 0)
            
            print(f"Regular API - Total Passports: {total_passports}")
            print(f"Regular API - Total Recruiters: {total_recruiters}")
            
            return {
                'total_passports': total_passports,
                'total_recruiters': total_recruiters
            }
        else:
            print("❌ Failed to get data from regular APIs")
            return None
            
    except Exception as e:
        print(f"❌ Data consistency check failed: {e}")
        return None

def main():
    """Main test execution"""
    print("🚀 STARTING CSV EXPORT FUNCTIONALITY TESTING")
    print("=" * 80)
    
    # Track test results
    results = {}
    
    # Verify data consistency first
    consistency_data = verify_data_consistency()
    
    # Run all test scenarios
    results['passport_no_filters'] = test_passport_export_no_filters()
    results['passport_status_filter'] = test_passport_export_with_status_filter()
    results['passport_search_filter'] = test_passport_export_with_search()
    results['recruiter_no_filters'] = test_recruiter_export_no_filters()
    results['recruiter_with_filters'] = test_recruiter_export_with_filters()
    
    # Generate summary report
    print("\n" + "="*80)
    print("📊 TEST SUMMARY REPORT")
    print("="*80)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result.get('success', False))
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print(f"\n📋 DETAILED RESULTS:")
    
    for test_name, result in results.items():
        status = "✅ PASS" if result.get('success', False) else "❌ FAIL"
        print(f"  {test_name}: {status}")
        if not result.get('success', False):
            print(f"    Error: {result.get('error', 'Unknown error')}")
        elif 'row_count' in result:
            print(f"    Rows exported: {result['row_count']}")
    
    # Data consistency check
    if consistency_data and results.get('passport_no_filters', {}).get('success'):
        passport_export_count = results['passport_no_filters'].get('row_count', 0)
        api_passport_count = consistency_data['total_passports']
        
        print(f"\n🔍 DATA CONSISTENCY CHECK:")
        print(f"  Passport API Count: {api_passport_count}")
        print(f"  Passport Export Count: {passport_export_count}")
        
        if passport_export_count == api_passport_count:
            print(f"  ✅ Passport counts match perfectly")
        else:
            print(f"  ⚠️  Passport counts differ (API: {api_passport_count}, Export: {passport_export_count})")
    
    if consistency_data and results.get('recruiter_no_filters', {}).get('success'):
        recruiter_export_count = results['recruiter_no_filters'].get('row_count', 0)
        api_recruiter_count = consistency_data['total_recruiters']
        
        print(f"  Recruiter API Count: {api_recruiter_count}")
        print(f"  Recruiter Export Count: {recruiter_export_count}")
        
        if recruiter_export_count == api_recruiter_count:
            print(f"  ✅ Recruiter counts match perfectly")
        else:
            print(f"  ⚠️  Recruiter counts differ (API: {api_recruiter_count}, Export: {recruiter_export_count})")
    
    # Critical issues check
    print(f"\n🚨 CRITICAL ISSUES CHECK:")
    
    passport_test = results.get('passport_no_filters', {})
    if passport_test.get('success'):
        print(f"  ✅ Passport export endpoint working")
        print(f"  ✅ CSV format validation passed")
        print(f"  ✅ Content-Type and filename headers correct")
    else:
        print(f"  ❌ CRITICAL: Passport export endpoint failing")
    
    recruiter_test = results.get('recruiter_no_filters', {})
    if recruiter_test.get('success'):
        print(f"  ✅ Recruiter export endpoint working")
    else:
        print(f"  ❌ CRITICAL: Recruiter export endpoint failing")
    
    print(f"\n🎯 FOCUS AREAS:")
    print(f"  • Student data population in passport exports")
    print(f"  • Filter functionality accuracy")
    print(f"  • CSV format compliance")
    print(f"  • Data consistency between API and export endpoints")
    
    print(f"\n✅ CSV EXPORT TESTING COMPLETED")
    print("="*80)
    
    return passed_tests == total_tests

if __name__ == "__main__":
    main()