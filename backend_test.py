#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, timedelta
import csv
import io

# Configuration
BASE_URL = "https://dynamic-export.preview.emergentagent.com/api"

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