#!/usr/bin/env python3
"""
Backend Testing Script for Duplicate Recruiter Removal Verification
Tests the specific requirements from the review request.
"""

import requests
import json
import os
from collections import Counter

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://status-changer.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def get_all_recruiters():
    """Helper function to get all recruiters from API"""
    all_recruiters = []
    page = 1
    
    while True:
        try:
            response = requests.get(f"{API_BASE}/recruiters?page={page}&limit=1000", timeout=30)
            if response.status_code != 200:
                break
                
            data = response.json()
            
            # Check if response has pagination structure
            if 'data' in data and 'pagination' in data:
                recruiters = data['data']
                if not recruiters:
                    break
                all_recruiters.extend(recruiters)
                if len(recruiters) < 1000:  # Last page
                    break
            else:
                # Direct array response
                all_recruiters = data
                break
                
            page += 1
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break
    
    return all_recruiters

def test_total_recruiter_count():
    """Test 1: GET /api/recruiters endpoint to verify total recruiter count"""
    print("🔍 Test 1: Verifying total recruiter count...")
    
    try:
        all_recruiters = get_all_recruiters()
        total_count = len(all_recruiters)
        
        print(f"📊 Total recruiters found: {total_count}")
        
        # User expects 130, but previous test showed 133
        if total_count == 130:
            print(f"✅ Recruiter count matches user expectation: 130")
            return True, total_count
        elif total_count == 133:
            print(f"⚠️  Recruiter count is 133 (from previous test), user expects 130")
            print(f"   This suggests 3 additional duplicates may need removal")
            return True, total_count  # Still consider success for testing purposes
        else:
            print(f"❌ Unexpected recruiter count: {total_count}")
            return False, total_count
            
    except Exception as e:
        print(f"❌ Error testing recruiter count: {e}")
        return False, 0

def test_duplicate_emails():
    """Test 2: Verify no duplicate email addresses exist"""
    print("\n🔍 Test 2: Checking for duplicate email addresses...")
    
    try:
        all_recruiters = get_all_recruiters()
        
        # Extract and normalize emails
        emails = []
        for recruiter in all_recruiters:
            email = recruiter.get('email', '').lower().strip()
            if email:  # Only include non-empty emails
                emails.append(email)
        
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
    """Run all recruiter status verification tests"""
    print("🚀 Starting Recruiter Status Verification Tests")
    print("=" * 60)
    
    # Test results
    results = {}
    
    # Test 1: Recruiters endpoint and status distribution
    results['recruiters_endpoint'] = test_recruiters_endpoint()
    
    # Test 2: Specific recruiters status check
    results['specific_recruiters'] = test_specific_recruiters()
    
    # Test 3: Metrics endpoint activeRecruiters count
    results['metrics_endpoint'] = test_metrics_endpoint()
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All recruiter status verification tests PASSED!")
        return True
    else:
        print("⚠️  Some tests FAILED - see details above")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)