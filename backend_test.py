#!/usr/bin/env python3
"""
Comprehensive Export Filter Testing
Tests all export endpoints to verify they properly respect applied filters
"""

import requests
import json
import csv
import io
from datetime import datetime, timedelta
import sys

# Base URL from environment
BASE_URL = "https://skill-export-filter.preview.emergentagent.com/api"

def test_api_endpoint(endpoint, params=None, description=""):
    """Test an API endpoint and return response data"""
    try:
        url = f"{BASE_URL}{endpoint}"
        # For API endpoints (not exports), add high limit to get all records for comparison
        if params is None:
            params = {}
        if '/export' not in endpoint and 'limit' not in params:
            params['limit'] = 1000  # High limit to get all records
        response = requests.get(url, params=params, timeout=30)
        
        print(f"\n{'='*60}")
        print(f"TEST: {description}")
        print(f"URL: {url}")
        if params:
            print(f"Params: {params}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            # Check if it's CSV content
            content_type = response.headers.get('content-type', '')
            if 'text/csv' in content_type:
                # Parse CSV and count rows
                csv_content = response.text
                csv_reader = csv.reader(io.StringIO(csv_content))
                rows = list(csv_reader)
                row_count = len(rows) - 1 if rows else 0  # Subtract header row
                print(f"✅ CSV Export Success - {row_count} data rows")
                
                # Show first few data rows for verification
                if len(rows) > 1:
                    print(f"Headers: {rows[0]}")
                    for i in range(1, min(4, len(rows))):  # Show first 3 data rows
                        print(f"Row {i}: {rows[i][:3]}...")  # Show first 3 columns
                
                return {'count': row_count, 'headers': rows[0] if rows else [], 'data': rows[1:] if len(rows) > 1 else []}
            else:
                # JSON response
                data = response.json()
                # Handle different response formats
                if isinstance(data, list):
                    count = len(data)
                elif isinstance(data, dict):
                    if 'data' in data:
                        # Paginated response format
                        count = len(data['data'])
                        data = data['data']  # Extract the actual data array
                    elif 'logs' in data:
                        # Audit logs format
                        count = len(data['logs'])
                    else:
                        count = data.get('total', 0)
                else:
                    count = 0
                print(f"✅ API Success - {count} records")
                return {'count': count, 'data': data}
        else:
            print(f"❌ Failed - {response.status_code}: {response.text[:200]}")
            return {'count': 0, 'error': response.text}
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return {'count': 0, 'error': str(e)}

def test_recruiters_export():
    """Test recruiters export with various filters"""
    print(f"\n{'#'*80}")
    print("# TEST 1: RECRUITERS EXPORT WITH FILTERS")
    print(f"{'#'*80}")
    
    results = {}
    
    # 1. Get total recruiters without filters
    results['total'] = test_api_endpoint('/recruiters', description="Total recruiters (no filters)")
    
    # 2. Get pending recruiters
    results['pending_api'] = test_api_endpoint('/recruiters', {'status': 'pending'}, "Pending recruiters (API)")
    results['pending_export'] = test_api_endpoint('/recruiters/export', {'status': 'pending'}, "Pending recruiters (CSV Export)")
    
    # 3. Get recruiters by state (use a real state from the data)
    results['state_api'] = test_api_endpoint('/recruiters', {'state': 'Tamil Nadu'}, "Tamil Nadu recruiters (API)")
    results['state_export'] = test_api_endpoint('/recruiters/export', {'state': 'Tamil Nadu'}, "Tamil Nadu recruiters (CSV Export)")
    
    # 4. Get active recruiters
    results['active_api'] = test_api_endpoint('/recruiters', {'active': 'true'}, "Active recruiters (API)")
    results['active_export'] = test_api_endpoint('/recruiters/export', {'active': 'true'}, "Active recruiters (CSV Export)")
    
    # 5. Search recruiters with 'tech'
    results['search_api'] = test_api_endpoint('/recruiters', {'search': 'tech'}, "Search 'tech' recruiters (API)")
    results['search_export'] = test_api_endpoint('/recruiters/export', {'search': 'tech'}, "Search 'tech' recruiters (CSV Export)")
    
    # 6. Combined filters
    combined_params = {'status': 'approved', 'active': 'true', 'state': 'Tamil Nadu'}
    results['combined_api'] = test_api_endpoint('/recruiters', combined_params, "Combined filters (API)")
    results['combined_export'] = test_api_endpoint('/recruiters/export', combined_params, "Combined filters (CSV Export)")
    
    # Verify counts match
    print(f"\n{'='*60}")
    print("RECRUITERS EXPORT VERIFICATION:")
    
    test_cases = [
        ('pending', 'pending_api', 'pending_export'),
        ('Tamil Nadu state', 'state_api', 'state_export'),
        ('active', 'active_api', 'active_export'),
        ('search tech', 'search_api', 'search_export'),
        ('combined filters', 'combined_api', 'combined_export')
    ]
    
    for name, api_key, export_key in test_cases:
        api_count = results.get(api_key, {}).get('count', 0)
        export_count = results.get(export_key, {}).get('count', 0)
        
        if api_count == export_count:
            print(f"✅ {name}: API={api_count}, Export={export_count} - MATCH")
        else:
            print(f"❌ {name}: API={api_count}, Export={export_count} - MISMATCH")
    
    return results

def test_passports_export():
    """Test passports export with various filters"""
    print(f"\n{'#'*80}")
    print("# TEST 2: PASSPORTS EXPORT WITH FILTERS")
    print(f"{'#'*80}")
    
    results = {}
    
    # 1. Get total passports without filters
    results['total'] = test_api_endpoint('/passports', description="Total passports (no filters)")
    
    # 2. Get verified passports
    results['verified_api'] = test_api_endpoint('/passports', {'status': 'verified'}, "Verified passports (API)")
    results['verified_export'] = test_api_endpoint('/passports/export', {'status': 'verified'}, "Verified passports (CSV Export)")
    
    # 3. Get level 5 passports
    results['level5_api'] = test_api_endpoint('/passports', {'nsqfLevel': '5'}, "NSQF Level 5 passports (API)")
    results['level5_export'] = test_api_endpoint('/passports/export', {'nsqfLevel': '5'}, "NSQF Level 5 passports (CSV Export)")
    
    # 4. Get first university ID for filtering
    total_data = results['total'].get('data', [])
    first_university_id = None
    if isinstance(total_data, list) and len(total_data) > 0:
        # Look for a passport with university data
        for passport in total_data[:10]:  # Check first 10
            if isinstance(passport, dict) and passport.get('students', {}).get('university', {}).get('id'):
                first_university_id = passport['students']['university']['id']
                break
    
    if first_university_id:
        results['univ_api'] = test_api_endpoint('/passports', {'university': first_university_id}, f"University {first_university_id[:8]}... passports (API)")
        results['univ_export'] = test_api_endpoint('/passports/export', {'university': first_university_id}, f"University {first_university_id[:8]}... passports (CSV Export)")
    
    # 5. Search by student email (get from first passport)
    student_email = None
    if isinstance(total_data, list) and len(total_data) > 0:
        for passport in total_data[:10]:
            if isinstance(passport, dict):
                email = passport.get('students', {}).get('email') or passport.get('students', {}).get('users', {}).get('email')
                if email:
                    student_email = email
                    break
    
    if student_email:
        results['email_api'] = test_api_endpoint('/passports', {'search': student_email}, f"Search '{student_email}' (API)")
        results['email_export'] = test_api_endpoint('/passports/export', {'search': student_email}, f"Search '{student_email}' (CSV Export)")
    
    # 6. Combined filters
    combined_params = {'status': 'pending', 'nsqfLevel': '4'}
    results['combined_api'] = test_api_endpoint('/passports', combined_params, "Combined filters (API)")
    results['combined_export'] = test_api_endpoint('/passports/export', combined_params, "Combined filters (CSV Export)")
    
    # Verify counts match
    print(f"\n{'='*60}")
    print("PASSPORTS EXPORT VERIFICATION:")
    
    test_cases = [
        ('verified', 'verified_api', 'verified_export'),
        ('NSQF Level 5', 'level5_api', 'level5_export'),
        ('combined filters', 'combined_api', 'combined_export')
    ]
    
    if first_university_id:
        test_cases.append(('university filter', 'univ_api', 'univ_export'))
    
    if student_email:
        test_cases.append(('email search', 'email_api', 'email_export'))
    
    for name, api_key, export_key in test_cases:
        api_count = results.get(api_key, {}).get('count', 0)
        export_count = results.get(export_key, {}).get('count', 0)
        
        if api_count == export_count:
            print(f"✅ {name}: API={api_count}, Export={export_count} - MATCH")
        else:
            print(f"❌ {name}: API={api_count}, Export={export_count} - MISMATCH")
    
    return results

def test_audit_logs_export():
    """Test audit logs export with various filters"""
    print(f"\n{'#'*80}")
    print("# TEST 3: AUDIT LOGS EXPORT WITH FILTERS")
    print(f"{'#'*80}")
    
    results = {}
    
    # 1. Get total audit logs without filters
    results['total'] = test_api_endpoint('/audit-logs', description="Total audit logs (no filters)")
    
    # 2. Get login actions
    results['login_api'] = test_api_endpoint('/audit-logs', {'action': 'login'}, "Login actions (API)")
    results['login_export'] = test_api_endpoint('/audit-logs/export', {'action': 'login'}, "Login actions (CSV Export)")
    
    # 3. Search in logs
    results['search_api'] = test_api_endpoint('/audit-logs', {'search': 'admin'}, "Search 'admin' (API)")
    results['search_export'] = test_api_endpoint('/audit-logs/export', {'search': 'admin'}, "Search 'admin' (CSV Export)")
    
    # 4. Get first user ID for filtering
    total_data = results['total'].get('data', {})
    first_user_id = None
    if isinstance(total_data, dict) and 'logs' in total_data:
        logs = total_data['logs']
        if isinstance(logs, list) and len(logs) > 0:
            first_user_id = logs[0].get('actorId')
    elif isinstance(total_data, list) and len(total_data) > 0:
        first_user_id = total_data[0].get('actorId')
    
    if first_user_id:
        results['user_api'] = test_api_endpoint('/audit-logs', {'userId': first_user_id}, f"User {first_user_id[:8]}... logs (API)")
        results['user_export'] = test_api_endpoint('/audit-logs/export', {'userId': first_user_id}, f"User {first_user_id[:8]}... logs (CSV Export)")
    
    # Verify counts match
    print(f"\n{'='*60}")
    print("AUDIT LOGS EXPORT VERIFICATION:")
    
    test_cases = [
        ('login action', 'login_api', 'login_export'),
        ('search admin', 'search_api', 'search_export')
    ]
    
    if first_user_id:
        test_cases.append(('user filter', 'user_api', 'user_export'))
    
    for name, api_key, export_key in test_cases:
        api_data = results.get(api_key, {})
        export_data = results.get(export_key, {})
        
        # Handle different response structures
        if isinstance(api_data.get('data'), dict) and 'logs' in api_data['data']:
            api_count = len(api_data['data']['logs'])
        else:
            api_count = api_data.get('count', 0)
        
        export_count = export_data.get('count', 0)
        
        if api_count == export_count:
            print(f"✅ {name}: API={api_count}, Export={export_count} - MATCH")
        else:
            print(f"❌ {name}: API={api_count}, Export={export_count} - MISMATCH")
    
    return results

def main():
    """Run comprehensive export filter testing"""
    print("COMPREHENSIVE EXPORT FILTER TESTING")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    recruiters_results = test_recruiters_export()
    passports_results = test_passports_export()
    audit_logs_results = test_audit_logs_export()
    
    # Final summary
    print(f"\n{'#'*80}")
    print("# FINAL SUMMARY")
    print(f"{'#'*80}")
    
    print("\n📊 RECRUITERS EXPORT:")
    print(f"   Total recruiters: {recruiters_results.get('total', {}).get('count', 0)}")
    print(f"   Pending: {recruiters_results.get('pending_export', {}).get('count', 0)}")
    print(f"   Tamil Nadu: {recruiters_results.get('state_export', {}).get('count', 0)}")
    print(f"   Active: {recruiters_results.get('active_export', {}).get('count', 0)}")
    print(f"   Search 'tech': {recruiters_results.get('search_export', {}).get('count', 0)}")
    print(f"   Combined filters: {recruiters_results.get('combined_export', {}).get('count', 0)}")
    
    print("\n📋 PASSPORTS EXPORT:")
    print(f"   Total passports: {passports_results.get('total', {}).get('count', 0)}")
    print(f"   Verified: {passports_results.get('verified_export', {}).get('count', 0)}")
    print(f"   NSQF Level 5: {passports_results.get('level5_export', {}).get('count', 0)}")
    print(f"   Combined filters: {passports_results.get('combined_export', {}).get('count', 0)}")
    
    print("\n📝 AUDIT LOGS EXPORT:")
    print(f"   Total logs: {audit_logs_results.get('total', {}).get('count', 0)}")
    print(f"   Login actions: {audit_logs_results.get('login_export', {}).get('count', 0)}")
    print(f"   Search 'admin': {audit_logs_results.get('search_export', {}).get('count', 0)}")
    
    print(f"\n✅ Export filter testing completed at {datetime.now().strftime('%H:%M:%S')}")

if __name__ == "__main__":
    main()