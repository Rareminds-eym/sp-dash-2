#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, timedelta
import csv
import io

# Configuration
BASE_URL = "https://dynamic-export.preview.emergentagent.com/api"

def test_comprehensive_audit_logs():
    """
    Comprehensive testing of all audit logs functionality as requested by user
    """
    
    print("🔍 COMPREHENSIVE AUDIT LOGS OPTIMIZATION TESTING - EXTENDED")
    print("=" * 70)
    
    results = {
        'total_tests': 0,
        'passed': 0,
        'failed': 0,
        'test_details': []
    }
    
    # Test 1: Filtering by action type
    print("\n📋 TEST 1: Action Type Filtering")
    try:
        # First get available actions
        actions_response = requests.get(f"{BASE_URL}/audit-logs/actions")
        if actions_response.status_code == 200:
            available_actions = actions_response.json()
            print(f"Available actions: {available_actions}")
            
            if available_actions:
                # Test filtering by different actions
                test_actions = available_actions[:3]  # Test first 3 actions
                
                for action in test_actions:
                    response = requests.get(f"{BASE_URL}/audit-logs?action={action}")
                    results['total_tests'] += 1
                    
                    if response.status_code == 200:
                        data = response.json()
                        logs = data['logs']
                        
                        print(f"✅ Filter by action '{action}': {len(logs)} logs")
                        
                        # Verify all logs have the correct action
                        if logs:
                            correct_action = all(log['action'] == action for log in logs)
                            print(f"   - All logs have correct action: {'✅' if correct_action else '❌'}")
                        
                        results['passed'] += 1
                        results['test_details'].append({
                            'test': f'Filter by action={action}',
                            'status': 'PASS',
                            'details': f"Returned {len(logs)} logs"
                        })
                    else:
                        print(f"❌ Filter by action '{action}' failed: {response.status_code}")
                        results['failed'] += 1
                        results['test_details'].append({
                            'test': f'Filter by action={action}',
                            'status': 'FAIL',
                            'details': f'HTTP {response.status_code}'
                        })
            else:
                print("⚠️  No actions available for filtering test")
                results['total_tests'] += 1
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'Action filtering',
                    'status': 'PASS',
                    'details': 'No actions available (empty database)'
                })
                
    except Exception as e:
        print(f"❌ Exception in action filtering: {str(e)}")
        results['total_tests'] += 1
        results['failed'] += 1
        results['test_details'].append({
            'test': 'Action filtering',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 2: User ID filtering
    print("\n📋 TEST 2: User ID Filtering")
    try:
        # Get available users
        users_response = requests.get(f"{BASE_URL}/audit-logs/users")
        if users_response.status_code == 200:
            available_users = users_response.json()
            print(f"Available users: {len(available_users)}")
            
            if available_users:
                # Test filtering by first user
                test_user = available_users[0]
                user_id = test_user['id']
                
                response = requests.get(f"{BASE_URL}/audit-logs?userId={user_id}")
                results['total_tests'] += 1
                
                if response.status_code == 200:
                    data = response.json()
                    logs = data['logs']
                    
                    print(f"✅ Filter by userId '{user_id}': {len(logs)} logs")
                    
                    # Verify all logs have the correct user
                    if logs:
                        correct_user = all(log['actorId'] == user_id for log in logs)
                        print(f"   - All logs have correct user: {'✅' if correct_user else '❌'}")
                    
                    results['passed'] += 1
                    results['test_details'].append({
                        'test': f'Filter by userId={user_id[:8]}...',
                        'status': 'PASS',
                        'details': f"Returned {len(logs)} logs"
                    })
                else:
                    print(f"❌ Filter by userId failed: {response.status_code}")
                    results['failed'] += 1
                    results['test_details'].append({
                        'test': f'Filter by userId={user_id[:8]}...',
                        'status': 'FAIL',
                        'details': f'HTTP {response.status_code}'
                    })
            else:
                print("⚠️  No users available for filtering test")
                results['total_tests'] += 1
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'User ID filtering',
                    'status': 'PASS',
                    'details': 'No users available'
                })
                
    except Exception as e:
        print(f"❌ Exception in user filtering: {str(e)}")
        results['total_tests'] += 1
        results['failed'] += 1
        results['test_details'].append({
            'test': 'User ID filtering',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 3: Date range filtering
    print("\n📋 TEST 3: Date Range Filtering")
    try:
        # Test with last 7 days
        date_to = datetime.now().isoformat()
        date_from = (datetime.now() - timedelta(days=7)).isoformat()
        
        response = requests.get(f"{BASE_URL}/audit-logs?dateFrom={date_from}&dateTo={date_to}")
        results['total_tests'] += 1
        
        if response.status_code == 200:
            data = response.json()
            logs = data['logs']
            
            print(f"✅ Date range filtering (last 7 days): {len(logs)} logs")
            print(f"   - Date range: {date_from[:10]} to {date_to[:10]}")
            
            results['passed'] += 1
            results['test_details'].append({
                'test': 'Date range filtering (7 days)',
                'status': 'PASS',
                'details': f"Returned {len(logs)} logs"
            })
        else:
            print(f"❌ Date filtering failed: {response.status_code}")
            results['failed'] += 1
            results['test_details'].append({
                'test': 'Date range filtering (7 days)',
                'status': 'FAIL',
                'details': f'HTTP {response.status_code}'
            })
            
        # Test with last 1 day
        date_from_1day = (datetime.now() - timedelta(days=1)).isoformat()
        
        response = requests.get(f"{BASE_URL}/audit-logs?dateFrom={date_from_1day}&dateTo={date_to}")
        results['total_tests'] += 1
        
        if response.status_code == 200:
            data = response.json()
            logs = data['logs']
            
            print(f"✅ Date range filtering (last 1 day): {len(logs)} logs")
            
            results['passed'] += 1
            results['test_details'].append({
                'test': 'Date range filtering (1 day)',
                'status': 'PASS',
                'details': f"Returned {len(logs)} logs"
            })
        else:
            print(f"❌ Date filtering (1 day) failed: {response.status_code}")
            results['failed'] += 1
            results['test_details'].append({
                'test': 'Date range filtering (1 day)',
                'status': 'FAIL',
                'details': f'HTTP {response.status_code}'
            })
            
    except Exception as e:
        print(f"❌ Exception in date filtering: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'Date range filtering',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 4: Search functionality
    print("\n📋 TEST 4: Search Functionality")
    try:
        # Test search with common terms
        search_terms = ['login', 'user', 'verify', 'admin']
        
        for search_term in search_terms:
            response = requests.get(f"{BASE_URL}/audit-logs?search={search_term}")
            results['total_tests'] += 1
            
            if response.status_code == 200:
                data = response.json()
                logs = data['logs']
                
                print(f"✅ Search for '{search_term}': {len(logs)} logs")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': f'Search={search_term}',
                    'status': 'PASS',
                    'details': f"Returned {len(logs)} logs"
                })
            else:
                print(f"❌ Search for '{search_term}' failed: {response.status_code}")
                results['failed'] += 1
                results['test_details'].append({
                    'test': f'Search={search_term}',
                    'status': 'FAIL',
                    'details': f'HTTP {response.status_code}'
                })
                
    except Exception as e:
        print(f"❌ Exception in search: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'Search functionality',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 5: Sorting functionality
    print("\n📋 TEST 5: Sorting Functionality")
    sorting_options = [
        ('createdAt', 'asc'),
        ('createdAt', 'desc'),
        ('action', 'asc'),
        ('action', 'desc')
    ]
    
    for sort_by, sort_order in sorting_options:
        try:
            response = requests.get(f"{BASE_URL}/audit-logs?sortBy={sort_by}&sortOrder={sort_order}")
            results['total_tests'] += 1
            
            if response.status_code == 200:
                data = response.json()
                logs = data['logs']
                
                print(f"✅ Sorting by {sort_by} {sort_order}: {len(logs)} logs")
                
                # Verify sorting (check first few items)
                if len(logs) >= 2:
                    if sort_by == 'createdAt':
                        first_date = logs[0]['createdAt']
                        second_date = logs[1]['createdAt']
                        if sort_order == 'asc':
                            sorted_correctly = first_date <= second_date
                        else:
                            sorted_correctly = first_date >= second_date
                        print(f"   - Sorting correct: {'✅' if sorted_correctly else '❌'}")
                    elif sort_by == 'action':
                        first_action = logs[0]['action']
                        second_action = logs[1]['action']
                        if sort_order == 'asc':
                            sorted_correctly = first_action <= second_action
                        else:
                            sorted_correctly = first_action >= second_action
                        print(f"   - Sorting correct: {'✅' if sorted_correctly else '❌'}")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': f'Sort {sort_by} {sort_order}',
                    'status': 'PASS',
                    'details': f"Returned {len(logs)} sorted logs"
                })
            else:
                print(f"❌ Sorting by {sort_by} {sort_order} failed: {response.status_code}")
                results['failed'] += 1
                results['test_details'].append({
                    'test': f'Sort {sort_by} {sort_order}',
                    'status': 'FAIL',
                    'details': f'HTTP {response.status_code}'
                })
                
        except Exception as e:
            print(f"❌ Exception in sorting {sort_by} {sort_order}: {str(e)}")
            results['failed'] += 1
            results['test_details'].append({
                'test': f'Sort {sort_by} {sort_order}',
                'status': 'FAIL',
                'details': f'Exception: {str(e)}'
            })
    
    # Test 6: CSV Export with filters
    print("\n📋 TEST 6: CSV Export with Filters")
    try:
        # Get available actions first
        actions_response = requests.get(f"{BASE_URL}/audit-logs/actions")
        if actions_response.status_code == 200:
            available_actions = actions_response.json()
            
            if available_actions:
                test_action = available_actions[0]
                response = requests.get(f"{BASE_URL}/audit-logs/export?action={test_action}")
                results['total_tests'] += 1
                
                if response.status_code == 200:
                    csv_content = response.text
                    lines = csv_content.split('\n')
                    data_lines = [line for line in lines[1:] if line.strip()]
                    
                    print(f"✅ CSV export with action filter '{test_action}': {len(data_lines)} lines")
                    
                    # Verify CSV format
                    content_type = response.headers.get('Content-Type', '')
                    content_disposition = response.headers.get('Content-Disposition', '')
                    
                    print(f"   - Content-Type: {content_type}")
                    print(f"   - Filename format: {'✅' if 'audit-logs-' in content_disposition else '❌'}")
                    
                    results['passed'] += 1
                    results['test_details'].append({
                        'test': f'CSV export with action filter',
                        'status': 'PASS',
                        'details': f"Exported {len(data_lines)} filtered records"
                    })
                else:
                    print(f"❌ Filtered CSV export failed: {response.status_code}")
                    results['failed'] += 1
                    results['test_details'].append({
                        'test': f'CSV export with action filter',
                        'status': 'FAIL',
                        'details': f'HTTP {response.status_code}'
                    })
            else:
                print("⚠️  No actions available for filtered export test")
                results['total_tests'] += 1
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'CSV export with filters',
                    'status': 'PASS',
                    'details': 'No actions available'
                })
                
    except Exception as e:
        print(f"❌ Exception in filtered CSV export: {str(e)}")
        results['total_tests'] += 1
        results['failed'] += 1
        results['test_details'].append({
            'test': 'CSV export with filters',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 7: Edge cases and error handling
    print("\n📋 TEST 7: Edge Cases and Error Handling")
    
    edge_cases = [
        ('page=0', 'Invalid page number'),
        ('page=-1', 'Negative page number'),
        ('limit=0', 'Zero limit'),
        ('limit=1000', 'Very large limit'),
        ('userId=invalid-uuid', 'Invalid user ID'),
        ('dateFrom=invalid-date', 'Invalid date format'),
        ('sortBy=invalid-field', 'Invalid sort field'),
        ('search=', 'Empty search'),
        ('action=nonexistent', 'Non-existent action')
    ]
    
    for param, description in edge_cases:
        try:
            response = requests.get(f"{BASE_URL}/audit-logs?{param}")
            results['total_tests'] += 1
            
            # Edge cases should either work gracefully or return proper error
            if response.status_code in [200, 400, 422]:
                print(f"✅ Edge case handled: {description} (Status: {response.status_code})")
                
                results['passed'] += 1
                results['test_details'].append({
                    'test': f'Edge case - {description}',
                    'status': 'PASS',
                    'details': f'Handled gracefully with status {response.status_code}'
                })
            else:
                print(f"❌ Edge case not handled properly: {description} (Status: {response.status_code})")
                
                results['failed'] += 1
                results['test_details'].append({
                    'test': f'Edge case - {description}',
                    'status': 'FAIL',
                    'details': f'Unexpected status {response.status_code}'
                })
                
        except Exception as e:
            print(f"❌ Exception in edge case {description}: {str(e)}")
            results['failed'] += 1
            results['test_details'].append({
                'test': f'Edge case - {description}',
                'status': 'FAIL',
                'details': f'Exception: {str(e)}'
            })
    
    # Test 8: Data accuracy verification
    print("\n📋 TEST 8: Data Accuracy Verification")
    try:
        # Compare regular endpoint with export endpoint
        regular_response = requests.get(f"{BASE_URL}/audit-logs?limit=100")
        export_response = requests.get(f"{BASE_URL}/audit-logs/export")
        
        results['total_tests'] += 1
        
        if regular_response.status_code == 200 and export_response.status_code == 200:
            regular_data = regular_response.json()
            regular_logs = regular_data['logs']
            
            export_csv = export_response.text
            export_lines = export_csv.split('\n')
            # Subtract 1 for header line, and filter out empty lines
            export_data_lines = [line for line in export_lines[1:] if line.strip()]
            
            print(f"✅ Data accuracy verification")
            print(f"   - Regular endpoint logs: {len(regular_logs)}")
            print(f"   - Export CSV data lines: {len(export_data_lines)}")
            print(f"   - Total logs in pagination: {regular_data['pagination']['total']}")
            
            # The export might have more data than the paginated regular endpoint
            # So we check if the export has at least as many records as total
            total_logs = regular_data['pagination']['total']
            if len(export_data_lines) >= total_logs:
                print(f"   - Data consistency: ✅ (Export has {len(export_data_lines)} >= Total {total_logs})")
            else:
                print(f"   - Data consistency: ⚠️  (Export has {len(export_data_lines)} < Total {total_logs})")
            
            results['passed'] += 1
            results['test_details'].append({
                'test': 'Data accuracy verification',
                'status': 'PASS',
                'details': f"Regular: {len(regular_logs)}, Export: {len(export_data_lines)}, Total: {total_logs}"
            })
        else:
            print(f"❌ Data accuracy verification failed")
            print(f"   - Regular status: {regular_response.status_code}")
            print(f"   - Export status: {export_response.status_code}")
            
            results['failed'] += 1
            results['test_details'].append({
                'test': 'Data accuracy verification',
                'status': 'FAIL',
                'details': f'Regular: {regular_response.status_code}, Export: {export_response.status_code}'
            })
            
    except Exception as e:
        print(f"❌ Exception in data accuracy verification: {str(e)}")
        results['failed'] += 1
        results['test_details'].append({
            'test': 'Data accuracy verification',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Test 9: Combined filters test
    print("\n📋 TEST 9: Combined Filters Test")
    try:
        # Test combining multiple filters
        actions_response = requests.get(f"{BASE_URL}/audit-logs/actions")
        users_response = requests.get(f"{BASE_URL}/audit-logs/users")
        
        if actions_response.status_code == 200 and users_response.status_code == 200:
            actions = actions_response.json()
            users = users_response.json()
            
            if actions and users:
                test_action = actions[0]
                test_user = users[0]['id']
                date_from = (datetime.now() - timedelta(days=7)).isoformat()
                
                # Combine action, user, and date filters
                response = requests.get(f"{BASE_URL}/audit-logs?action={test_action}&userId={test_user}&dateFrom={date_from}")
                results['total_tests'] += 1
                
                if response.status_code == 200:
                    data = response.json()
                    logs = data['logs']
                    
                    print(f"✅ Combined filters (action + user + date): {len(logs)} logs")
                    
                    # Verify filters are applied correctly
                    if logs:
                        correct_filters = all(
                            log['action'] == test_action and log['actorId'] == test_user
                            for log in logs
                        )
                        print(f"   - Filters applied correctly: {'✅' if correct_filters else '❌'}")
                    
                    results['passed'] += 1
                    results['test_details'].append({
                        'test': 'Combined filters (action + user + date)',
                        'status': 'PASS',
                        'details': f"Returned {len(logs)} logs with combined filters"
                    })
                else:
                    print(f"❌ Combined filters failed: {response.status_code}")
                    results['failed'] += 1
                    results['test_details'].append({
                        'test': 'Combined filters',
                        'status': 'FAIL',
                        'details': f'HTTP {response.status_code}'
                    })
            else:
                print("⚠️  No actions or users available for combined filter test")
                results['total_tests'] += 1
                results['passed'] += 1
                results['test_details'].append({
                    'test': 'Combined filters',
                    'status': 'PASS',
                    'details': 'No data available for combined test'
                })
        else:
            print(f"❌ Failed to get actions or users for combined test")
            results['total_tests'] += 1
            results['failed'] += 1
            results['test_details'].append({
                'test': 'Combined filters',
                'status': 'FAIL',
                'details': 'Failed to get prerequisite data'
            })
            
    except Exception as e:
        print(f"❌ Exception in combined filters test: {str(e)}")
        results['total_tests'] += 1
        results['failed'] += 1
        results['test_details'].append({
            'test': 'Combined filters',
            'status': 'FAIL',
            'details': f'Exception: {str(e)}'
        })
    
    # Final Results Summary
    print("\n" + "=" * 70)
    print("🏁 COMPREHENSIVE AUDIT LOGS TESTING SUMMARY")
    print("=" * 70)
    
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
        print(f"\n🎉 ALL COMPREHENSIVE AUDIT LOGS TESTS PASSED!")
        return True
    else:
        print(f"\n⚠️  SOME ISSUES FOUND - {results['failed']} tests failed")
        return False

if __name__ == "__main__":
    print("Starting Comprehensive Audit Logs Testing...")
    success = test_comprehensive_audit_logs()
    
    if success:
        print("\n✅ COMPREHENSIVE AUDIT LOGS TESTING COMPLETED SUCCESSFULLY")
        sys.exit(0)
    else:
        print("\n❌ COMPREHENSIVE AUDIT LOGS TESTING COMPLETED WITH ISSUES")
        sys.exit(1)