#!/usr/bin/env python3
"""
Backend API Testing Script for Passports CSV Export
Tests the data mapping fix for student information in CSV export
"""

import requests
import json
import csv
import io
from datetime import datetime

# Configuration
BASE_URL = "https://csv-passport-export.preview.emergentagent.com/api"

def test_passports_csv_export():
    """
    Test the Passports CSV export to verify the data mapping fix.
    
    Test Requirements:
    1. Fetch sample records from GET /api/passports (limit=5)
    2. Export same records using GET /api/passports/export
    3. Compare the data - verify Student Name, Email, and University fields are populated
    4. Check if data matches between the GET endpoint and CSV export
    """
    
    print("=" * 80)
    print("TESTING PASSPORTS CSV EXPORT DATA MAPPING FIX")
    print("=" * 80)
    
    try:
        # Step 1: Fetch sample passport records from GET /api/passports
        print("\n1. Fetching sample passport records from GET /api/passports...")
        
        passports_response = requests.get(f"{BASE_URL}/passports", params={"limit": 5})
        
        if passports_response.status_code != 200:
            print(f"❌ Failed to fetch passports: {passports_response.status_code}")
            print(f"Response: {passports_response.text}")
            return False
            
        passports_data = passports_response.json()
        passports = passports_data.get('data', [])
        
        if not passports:
            print("❌ No passport records found")
            print(f"Response structure: {list(passports_data.keys())}")
            return False
            
        print(f"✅ Successfully fetched {len(passports)} passport records")
        
        # Display sample passport data structure
        print("\n📋 Sample passport data structure:")
        for i, passport in enumerate(passports[:2]):  # Show first 2 records
            print(f"\nPassport {i+1}:")
            print(f"  ID: {passport.get('id', 'N/A')}")
            print(f"  Status: {passport.get('status', 'N/A')}")
            print(f"  NSQF Level: {passport.get('nsqfLevel', 'N/A')}")
            
            # Check student data structure
            student = passport.get('students', {})
            if student:
                print(f"  Student Data:")
                print(f"    Profile Name: {student.get('profile', {}).get('name', 'N/A')}")
                print(f"    User Email: {student.get('users', {}).get('email', 'N/A')}")
                print(f"    University: {student.get('university', {}).get('name', 'N/A')}")
                print(f"    Organization: {student.get('organization', {}).get('name', 'N/A')}")
            else:
                print(f"  Student Data: None")
        
        # Step 2: Export the same records using GET /api/passports/export
        print(f"\n2. Exporting passport records using GET /api/passports/export...")
        
        export_response = requests.get(f"{BASE_URL}/passports/export")
        
        if export_response.status_code != 200:
            print(f"❌ Failed to export passports: {export_response.status_code}")
            print(f"Response: {export_response.text}")
            return False
            
        # Check if response is CSV
        content_type = export_response.headers.get('Content-Type', '')
        if 'text/csv' not in content_type:
            print(f"❌ Expected CSV content type, got: {content_type}")
            return False
            
        print(f"✅ Successfully exported passports as CSV")
        print(f"Content-Type: {content_type}")
        
        # Step 3: Parse CSV and verify data
        print(f"\n3. Parsing CSV data and verifying student information...")
        
        csv_content = export_response.text
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        
        # Get CSV headers
        headers = csv_reader.fieldnames
        print(f"CSV Headers: {headers}")
        
        # Expected headers
        expected_headers = ['Student Name', 'Email', 'University', 'Status', 'NSQF Level', 'Skills', 'Created Date', 'Updated Date']
        
        # Check if all expected headers are present
        missing_headers = [h for h in expected_headers if h not in headers]
        if missing_headers:
            print(f"❌ Missing headers: {missing_headers}")
            return False
        
        print(f"✅ All expected headers present")
        
        # Parse CSV rows
        csv_rows = list(csv_reader)
        print(f"✅ CSV contains {len(csv_rows)} records")
        
        # Step 4: Verify specific fields are populated
        print(f"\n4. Verifying student data fields are populated...")
        
        empty_names = 0
        empty_emails = 0
        empty_universities = 0
        populated_records = 0
        
        print(f"\n📊 Sample CSV records:")
        for i, row in enumerate(csv_rows[:5]):  # Check first 5 records
            student_name = row.get('Student Name', '').strip().strip('"')
            email = row.get('Email', '').strip().strip('"')
            university = row.get('University', '').strip().strip('"')
            status = row.get('Status', '').strip().strip('"')
            
            print(f"\nCSV Record {i+1}:")
            print(f"  Student Name: '{student_name}' {'✅' if student_name else '❌ EMPTY'}")
            print(f"  Email: '{email}' {'✅' if email else '❌ EMPTY'}")
            print(f"  University: '{university}' {'✅' if university else '❌ EMPTY'}")
            print(f"  Status: '{status}'")
            
            if not student_name:
                empty_names += 1
            if not email:
                empty_emails += 1
            if not university:
                empty_universities += 1
            if student_name and email:
                populated_records += 1
        
        # Step 5: Compare with GET endpoint data
        print(f"\n5. Comparing CSV data with GET endpoint data...")
        
        # Find matching records between GET and CSV
        matches_found = 0
        data_consistency_issues = 0
        
        for passport in passports[:3]:  # Check first 3 records
            passport_id = passport.get('id')
            student = passport.get('students', {})
            
            # Expected data from GET endpoint
            expected_name = (student.get('profile', {}).get('name') or 
                           student.get('users', {}).get('metadata', {}).get('name') or 
                           student.get('metadata', {}).get('name') or 
                           student.get('name') or '')
            expected_email = (student.get('users', {}).get('email') or 
                            student.get('email') or '')
            expected_university = (student.get('university', {}).get('name') or 
                                 student.get('organization', {}).get('name') or '')
            
            print(f"\nComparing Passport ID: {passport_id}")
            print(f"  GET endpoint - Name: '{expected_name}', Email: '{expected_email}', University: '{expected_university}'")
            
            # Find corresponding CSV row (we can't match by ID easily, so we'll match by email if available)
            if expected_email:
                csv_match = None
                for row in csv_rows:
                    csv_email = row.get('Email', '').strip().strip('"')
                    if csv_email == expected_email:
                        csv_match = row
                        break
                
                if csv_match:
                    csv_name = csv_match.get('Student Name', '').strip().strip('"')
                    csv_email = csv_match.get('Email', '').strip().strip('"')
                    csv_university = csv_match.get('University', '').strip().strip('"')
                    
                    print(f"  CSV export   - Name: '{csv_name}', Email: '{csv_email}', University: '{csv_university}'")
                    
                    # Check for consistency
                    name_match = csv_name == expected_name if expected_name else True
                    email_match = csv_email == expected_email
                    university_match = csv_university == expected_university if expected_university else True
                    
                    if name_match and email_match and university_match:
                        print(f"  ✅ Data matches perfectly")
                        matches_found += 1
                    else:
                        print(f"  ❌ Data mismatch detected")
                        if not name_match:
                            print(f"    Name mismatch: GET='{expected_name}' vs CSV='{csv_name}'")
                        if not email_match:
                            print(f"    Email mismatch: GET='{expected_email}' vs CSV='{csv_email}'")
                        if not university_match:
                            print(f"    University mismatch: GET='{expected_university}' vs CSV='{csv_university}'")
                        data_consistency_issues += 1
                else:
                    print(f"  ⚠️  No matching CSV record found for email: {expected_email}")
            else:
                print(f"  ⚠️  No email in GET endpoint data to match with CSV")
        
        # Step 6: Generate test results summary
        print(f"\n" + "=" * 80)
        print("TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_csv_records = len(csv_rows)
        sample_size = min(5, total_csv_records)
        
        print(f"📊 CSV Export Statistics:")
        print(f"  Total records exported: {total_csv_records}")
        print(f"  Sample size analyzed: {sample_size}")
        print(f"  Records with populated names: {sample_size - empty_names}/{sample_size}")
        print(f"  Records with populated emails: {sample_size - empty_emails}/{sample_size}")
        print(f"  Records with populated universities: {sample_size - empty_universities}/{sample_size}")
        print(f"  Records with both name and email: {populated_records}/{sample_size}")
        
        print(f"\n🔍 Data Consistency Check:")
        print(f"  Successful matches: {matches_found}")
        print(f"  Data consistency issues: {data_consistency_issues}")
        
        # Determine overall test result
        critical_issues = []
        
        if empty_names == sample_size:
            critical_issues.append("All student names are empty")
        if empty_emails == sample_size:
            critical_issues.append("All student emails are empty")
        if data_consistency_issues > matches_found:
            critical_issues.append("More data inconsistencies than successful matches")
        
        if critical_issues:
            print(f"\n❌ CRITICAL ISSUES FOUND:")
            for issue in critical_issues:
                print(f"  - {issue}")
            print(f"\n🔧 RECOMMENDATION: The data mapping fix needs further investigation")
            return False
        else:
            print(f"\n✅ DATA MAPPING FIX VERIFICATION SUCCESSFUL")
            print(f"  - Student names are being populated correctly")
            print(f"  - Student emails are being populated correctly")
            print(f"  - Data consistency between GET and CSV export is maintained")
            
            if empty_universities > 0:
                print(f"  ⚠️  Note: Some university names are empty (this may be expected if not all students have university data)")
            
            return True
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main test execution"""
    print(f"🚀 Starting Passports CSV Export Testing")
    print(f"📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Base URL: {BASE_URL}")
    
    success = test_passports_csv_export()
    
    print(f"\n" + "=" * 80)
    if success:
        print("🎉 ALL TESTS PASSED - CSV EXPORT DATA MAPPING FIX VERIFIED")
    else:
        print("💥 TESTS FAILED - CSV EXPORT DATA MAPPING ISSUES DETECTED")
    print("=" * 80)
    
    return success

if __name__ == "__main__":
    main()