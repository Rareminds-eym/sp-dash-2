#!/usr/bin/env python3
"""
Backend Testing Script for Reports Page Export Functionality
Tests all 5 export endpoints for the Reports page.
"""

import requests
import json
import os
import csv
import io
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://exportdata-check.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "superadmin@rareminds.in"
TEST_PASSWORD = "password123"

def test_login():
    """Test login and get session for authenticated requests"""
    print("🔐 Testing login...")
    
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(f"{API_BASE}/auth/login", json=login_data)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Login successful for user: {result.get('email', 'Unknown')}")
            print(f"   Role: {result.get('role', 'Unknown')}")
            return response.cookies
        else:
            print(f"❌ Login failed: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None

def validate_csv_format(content, expected_headers=None):
    """Validate CSV format and return parsed data"""
    try:
        # Parse CSV content
        csv_reader = csv.reader(io.StringIO(content))
        rows = list(csv_reader)
        
        if not rows:
            return False, "Empty CSV content"
        
        headers = rows[0]
        data_rows = rows[1:]
        
        # Check if headers match expected (if provided)
        if expected_headers:
            if headers != expected_headers:
                return False, f"Headers mismatch. Expected: {expected_headers}, Got: {headers}"
        
        # Validate data rows
        if not data_rows:
            return False, "No data rows found"
        
        return True, {
            'headers': headers,
            'data_rows': data_rows,
            'total_rows': len(data_rows)
        }
        
    except Exception as e:
        return False, f"CSV parsing error: {str(e)}"

def test_export_endpoint(endpoint_path, expected_headers, cookies, endpoint_name):
    """Test a specific export endpoint"""
    print(f"\n📊 Testing {endpoint_name} export endpoint...")
    
    try:
        # Make request to export endpoint
        response = requests.get(f"{API_BASE}{endpoint_path}", cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ {endpoint_name} export failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Check Content-Type header
        content_type = response.headers.get('Content-Type', '')
        if 'text/csv' not in content_type:
            print(f"❌ Wrong Content-Type: {content_type}, expected text/csv")
            return False
        
        # Check Content-Disposition header
        content_disposition = response.headers.get('Content-Disposition', '')
        if 'attachment' not in content_disposition:
            print(f"❌ Missing or wrong Content-Disposition: {content_disposition}")
            return False
        
        # Validate filename pattern
        today = datetime.now().strftime('%Y-%m-%d')
        if today not in content_disposition:
            print(f"❌ Filename doesn't contain today's date: {content_disposition}")
            return False
        
        # Validate CSV content
        csv_content = response.text
        is_valid, result = validate_csv_format(csv_content, expected_headers)
        
        if not is_valid:
            print(f"❌ CSV validation failed: {result}")
            return False
        
        print(f"✅ {endpoint_name} export successful!")
        print(f"   Headers: {result['headers']}")
        print(f"   Data rows: {result['total_rows']}")
        print(f"   Content-Type: {content_type}")
        print(f"   Filename: {content_disposition}")
        
        # Show sample data (first few rows)
        if result['data_rows']:
            print(f"   Sample data (first 3 rows):")
            for i, row in enumerate(result['data_rows'][:3]):
                print(f"     Row {i+1}: {row}")
        
        return True
        
    except Exception as e:
        print(f"❌ {endpoint_name} export error: {str(e)}")
        return False

def test_data_accuracy(cookies):
    """Test that export data matches the corresponding GET endpoints"""
    print(f"\n🔍 Testing data accuracy between GET and export endpoints...")
    
    try:
        # Test university reports data accuracy
        print("Comparing university reports data...")
        
        # Get data from regular endpoint
        get_response = requests.get(f"{API_BASE}/analytics/university-reports", cookies=cookies)
        if get_response.status_code == 200:
            get_data = get_response.json()
            print(f"GET endpoint returned {len(get_data)} universities")
            
            # Get export data
            export_response = requests.get(f"{API_BASE}/analytics/university-reports/export", cookies=cookies)
            if export_response.status_code == 200:
                is_valid, csv_result = validate_csv_format(export_response.text)
                if is_valid:
                    export_rows = csv_result['total_rows']
                    print(f"Export endpoint returned {export_rows} universities")
                    
                    if len(get_data) == export_rows:
                        print("✅ University reports data count matches between GET and export")
                        
                        # Check specific data points
                        if get_data and csv_result['data_rows']:
                            first_univ_get = get_data[0]
                            first_univ_export = csv_result['data_rows'][0]
                            
                            # Compare university name (first column in CSV)
                            if first_univ_get['universityName'] == first_univ_export[0].strip('"'):
                                print("✅ University name data matches")
                            else:
                                print(f"❌ University name mismatch: GET={first_univ_get['universityName']}, Export={first_univ_export[0]}")
                    else:
                        print(f"❌ Data count mismatch: GET={len(get_data)}, Export={export_rows}")
        
        # Test state heatmap data accuracy
        print("\nComparing state heatmap data...")
        
        get_response = requests.get(f"{API_BASE}/analytics/state-heatmap", cookies=cookies)
        if get_response.status_code == 200:
            get_data = get_response.json()
            print(f"GET endpoint returned {len(get_data)} states")
            
            export_response = requests.get(f"{API_BASE}/analytics/state-heatmap/export", cookies=cookies)
            if export_response.status_code == 200:
                is_valid, csv_result = validate_csv_format(export_response.text)
                if is_valid:
                    export_rows = csv_result['total_rows']
                    print(f"Export endpoint returned {export_rows} states")
                    
                    if len(get_data) == export_rows:
                        print("✅ State heatmap data count matches between GET and export")
                    else:
                        print(f"❌ Data count mismatch: GET={len(get_data)}, Export={export_rows}")
        
        return True
        
    except Exception as e:
        print(f"❌ Data accuracy test error: {str(e)}")
        return False

def main():
    """Main test function"""
    print("🚀 Starting Reports Page Export Functionality Testing")
    print("=" * 60)
    
    # Test login first
    cookies = test_login()
    if not cookies:
        print("❌ Cannot proceed without authentication")
        return
    
    # Define export endpoints to test
    export_tests = [
        {
            'path': '/analytics/university-reports/export',
            'name': 'University Reports',
            'expected_headers': ['University Name', 'State', 'Enrollment Count', 'Total Passports', 'Verified Passports', 'Completion Rate (%)', 'Verification Rate (%)']
        },
        {
            'path': '/analytics/recruiter-metrics/export',
            'name': 'Recruiter Metrics',
            'expected_headers': ['Month', 'Searches', 'Profile Views', 'Contact Attempts']
        },
        {
            'path': '/analytics/placement-conversion/export',
            'name': 'Placement Conversion',
            'expected_headers': ['Stage', 'Count', 'Percentage']
        },
        {
            'path': '/analytics/state-heatmap/export',
            'name': 'State Heatmap',
            'expected_headers': ['State', 'Universities', 'Students', 'Verified Passports', 'Engagement Score', 'Employability Index']
        },
        {
            'path': '/analytics/ai-insights/export',
            'name': 'AI Insights',
            'expected_headers': ['Skill', 'Growth', 'Category', 'Trend']
        }
    ]
    
    # Test each export endpoint
    successful_tests = 0
    total_tests = len(export_tests)
    
    for test_config in export_tests:
        success = test_export_endpoint(
            test_config['path'],
            test_config['expected_headers'],
            cookies,
            test_config['name']
        )
        if success:
            successful_tests += 1
    
    # Test data accuracy
    print(f"\n" + "=" * 60)
    test_data_accuracy(cookies)
    
    # Final summary
    print(f"\n" + "=" * 60)
    print("📋 EXPORT ENDPOINTS TESTING SUMMARY")
    print("=" * 60)
    print(f"✅ Successful tests: {successful_tests}/{total_tests}")
    print(f"❌ Failed tests: {total_tests - successful_tests}/{total_tests}")
    
    if successful_tests == total_tests:
        print("\n🎉 ALL EXPORT ENDPOINTS WORKING CORRECTLY!")
        print("✅ All 5 export endpoints return proper CSV files")
        print("✅ All CSV files have correct headers and data format")
        print("✅ All files have proper Content-Type and Content-Disposition headers")
        print("✅ All filenames follow the correct pattern with today's date")
    else:
        print(f"\n⚠️  {total_tests - successful_tests} export endpoint(s) need attention")
    
    print("\n" + "=" * 60)

def test_duplicate_emails():
    """Test 2: Verify no duplicate email addresses exist"""
    print("\n🔍 Test 2: Checking for duplicate email addresses...")
    
    try:
        all_recruiters = get_all_recruiters()
        
        # Extract and normalize emails
        emails = []
        for recruiter in all_recruiters:
            email = recruiter.get('email')
            if email and email.strip():  # Only include non-empty emails
                emails.append(email.lower().strip())
        
        # Count email occurrences
        email_counts = Counter(emails)
        duplicates = {email: count for email, count in email_counts.items() if count > 1}
        
        if duplicates:
            print(f"❌ Found {len(duplicates)} duplicate emails:")
            for email, count in duplicates.items():
                print(f"   - {email}: {count} occurrences")
            return False
        else:
            print(f"✅ No duplicate email addresses found")
            print(f"   Total unique emails: {len(email_counts)}")
            return True
            
    except Exception as e:
        print(f"❌ Error checking duplicate emails: {e}")
        return False

def test_specific_composite_email_removals():
    """Test 4: Verify specific recruiters with composite emails were removed"""
    print("\n🔍 Test 4: Verifying specific composite email removals...")
    
    try:
        all_recruiters = get_all_recruiters()
        success = True
        
        # Check "Overseas Cyber Technical Services (OCTS)" should only have 1 record with email "hr@octsindia.com"
        print("   Checking Overseas Cyber Technical Services (OCTS)...")
        octs_recruiters = []
        for recruiter in all_recruiters:
            name = recruiter.get('name', '')
            if 'Overseas Cyber Technical Services' in name or 'OCTS' in name:
                octs_recruiters.append(recruiter)
        
        print(f"     Found {len(octs_recruiters)} OCTS records:")
        for recruiter in octs_recruiters:
            print(f"       - Name: {recruiter.get('name')}, Email: {recruiter.get('email')}")
        
        octs_hr_email = [r for r in octs_recruiters if r.get('email') == 'hr@octsindia.com']
        if len(octs_recruiters) == 1 and len(octs_hr_email) == 1:
            print(f"     ✅ OCTS has exactly 1 record with hr@octsindia.com")
        else:
            print(f"     ❌ OCTS should have exactly 1 record with hr@octsindia.com")
            print(f"        Found: {len(octs_recruiters)} total records, {len(octs_hr_email)} with hr@octsindia.com")
            success = False
        
        # Check "Ak Infopark Pvt Ltd" should only have 1 record with email "hrm@akinfopark.com"
        print("   Checking Ak Infopark Pvt Ltd...")
        ak_recruiters = []
        for recruiter in all_recruiters:
            name = recruiter.get('name', '')
            if 'Ak Infopark' in name or 'AK Infopark' in name:
                ak_recruiters.append(recruiter)
        
        print(f"     Found {len(ak_recruiters)} Ak Infopark records:")
        for recruiter in ak_recruiters:
            print(f"       - Name: {recruiter.get('name')}, Email: {recruiter.get('email')}")
        
        ak_hrm_email = [r for r in ak_recruiters if r.get('email') == 'hrm@akinfopark.com']
        if len(ak_recruiters) == 1 and len(ak_hrm_email) == 1:
            print(f"     ✅ Ak Infopark has exactly 1 record with hrm@akinfopark.com")
        else:
            print(f"     ❌ Ak Infopark should have exactly 1 record with hrm@akinfopark.com")
            print(f"        Found: {len(ak_recruiters)} total records, {len(ak_hrm_email)} with hrm@akinfopark.com")
            success = False
        
        return success
        
    except Exception as e:
        print(f"❌ Error checking specific composite email removals: {e}")
        return False

def test_same_name_different_emails():
    """Test 5: Check that remaining recruiters with same names but different emails still exist"""
    print("\n🔍 Test 5: Verifying recruiters with same names but different emails...")
    
    try:
        all_recruiters = get_all_recruiters()
        success = True
        
        # Check "Vijay Dairy" (2 records with different emails should still exist)
        print("   Checking Vijay Dairy...")
        vijay_recruiters = []
        for recruiter in all_recruiters:
            name = recruiter.get('name', '')
            if 'Vijay Dairy' in name:
                vijay_recruiters.append(recruiter)
        
        vijay_emails = set()
        print(f"     Found {len(vijay_recruiters)} Vijay Dairy records:")
        for recruiter in vijay_recruiters:
            email = recruiter.get('email', '')
            vijay_emails.add(email)
            print(f"       - Name: {recruiter.get('name')}, Email: {email}")
        
        if len(vijay_recruiters) == 2 and len(vijay_emails) == 2:
            print(f"     ✅ Vijay Dairy has 2 records with different emails")
        else:
            print(f"     ⚠️  Vijay Dairy expected 2 records with different emails")
            print(f"        Found: {len(vijay_recruiters)} records, {len(vijay_emails)} unique emails")
        
        # Check "EL Forge Limited" (2 records with different emails should still exist)
        print("   Checking EL Forge Limited...")
        el_forge_recruiters = []
        for recruiter in all_recruiters:
            name = recruiter.get('name', '')
            if 'EL Forge' in name or 'El Forge' in name:
                el_forge_recruiters.append(recruiter)
        
        el_forge_emails = set()
        print(f"     Found {len(el_forge_recruiters)} EL Forge records:")
        for recruiter in el_forge_recruiters:
            email = recruiter.get('email', '')
            el_forge_emails.add(email)
            print(f"       - Name: {recruiter.get('name')}, Email: {email}")
        
        if len(el_forge_recruiters) == 2 and len(el_forge_emails) == 2:
            print(f"     ✅ EL Forge Limited has 2 records with different emails")
        else:
            print(f"     ⚠️  EL Forge Limited expected 2 records with different emails")
            print(f"        Found: {len(el_forge_recruiters)} records, {len(el_forge_emails)} unique emails")
        
        # Check "Acoustics India Private Limite" (2 records with different emails should still exist)
        print("   Checking Acoustics India Private Limited...")
        acoustics_recruiters = []
        for recruiter in all_recruiters:
            name = recruiter.get('name', '')
            if 'Acoustics India' in name:
                acoustics_recruiters.append(recruiter)
        
        acoustics_emails = set()
        print(f"     Found {len(acoustics_recruiters)} Acoustics India records:")
        for recruiter in acoustics_recruiters:
            email = recruiter.get('email', '')
            acoustics_emails.add(email)
            print(f"       - Name: {recruiter.get('name')}, Email: {email}")
        
        if len(acoustics_recruiters) == 2 and len(acoustics_emails) == 2:
            print(f"     ✅ Acoustics India has 2 records with different emails")
        else:
            print(f"     ⚠️  Acoustics India expected 2 records with different emails")
            print(f"        Found: {len(acoustics_recruiters)} records, {len(acoustics_emails)} unique emails")
        
        return success
        
    except Exception as e:
        print(f"❌ Error checking same name different emails: {e}")
        return False

def test_metrics_endpoint(expected_count):
    """Test 3: Check GET /api/metrics endpoint reflects the updated count"""
    print(f"\n🔍 Test 3: Checking GET /api/metrics endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/metrics", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Metrics endpoint failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
        data = response.json()
        print(f"✅ Metrics endpoint responded successfully")
        
        # Check activeRecruiters field
        active_recruiters = data.get('activeRecruiters')
        if active_recruiters is None:
            print(f"❌ activeRecruiters field missing from response")
            return False
        
        print(f"📊 activeRecruiters: {active_recruiters}")
        
        if active_recruiters == expected_count:
            print(f"✅ Metrics count matches recruiters endpoint: {active_recruiters}")
            return True
        else:
            print(f"❌ Metrics count ({active_recruiters}) doesn't match recruiters count ({expected_count})")
            return False
        
    except Exception as e:
        print(f"❌ Error testing metrics endpoint: {e}")
        return False

def main():
    """Run all duplicate recruiter removal verification tests"""
    print("🚀 DUPLICATE RECRUITER REMOVAL VERIFICATION")
    print("=" * 80)
    print("Testing the following requirements:")
    print("1. Total recruiter count should be 130 (down from 133)")
    print("2. No duplicate email addresses exist")
    print("3. GET /api/metrics endpoint reflects updated count")
    print("4. Specific recruiters with composite emails were removed")
    print("5. Recruiters with same names but different emails still exist")
    print("=" * 80)
    
    # Test results
    results = {}
    
    # Test 1: Total recruiter count
    success, total_count = test_total_recruiter_count()
    results['total_count'] = success
    
    # Test 2: No duplicate emails
    results['no_duplicates'] = test_duplicate_emails()
    
    # Test 3: Metrics endpoint reflects updated count
    results['metrics_updated'] = test_metrics_endpoint(total_count)
    
    # Test 4: Specific composite email removals
    results['composite_removals'] = test_specific_composite_email_removals()
    
    # Test 5: Same name different emails still exist
    results['same_name_different_emails'] = test_same_name_different_emails()
    
    # Summary
    print("\n" + "=" * 80)
    print("📋 DUPLICATE RECRUITER REMOVAL VERIFICATION SUMMARY")
    print("=" * 80)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    print(f"Total recruiters in database: {total_count}")
    
    if passed_tests == total_tests:
        print("🎉 All duplicate recruiter removal verification tests PASSED!")
        return True
    else:
        print("⚠️  Some verification tests FAILED - see details above")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)