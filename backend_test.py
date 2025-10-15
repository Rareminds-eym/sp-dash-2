#!/usr/bin/env python3
"""
Backend Testing Script for Recruiter Status Verification
Tests the recruiter status distribution and specific recruiter statuses
"""

import requests
import json
import os
from collections import Counter
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://status-changer.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_recruiters_endpoint():
    """Test GET /api/recruiters endpoint and verify status distribution"""
    print("🔍 Testing GET /api/recruiters endpoint...")
    
    try:
        # Test basic endpoint
        response = requests.get(f"{API_BASE}/recruiters", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
        data = response.json()
        
        # Check if response has pagination structure
        if 'data' in data and 'pagination' in data:
            recruiters = data['data']
            pagination = data['pagination']
            total_count = pagination['total']
            print(f"✅ Paginated response detected. Total recruiters: {total_count}")
        else:
            # Direct array response
            recruiters = data
            total_count = len(recruiters)
            print(f"✅ Direct array response. Total recruiters: {total_count}")
        
        print(f"📊 Found {len(recruiters)} recruiters in current page")
        
        # If paginated, get all recruiters
        all_recruiters = []
        if 'pagination' in data:
            # Get all pages
            page = 1
            while True:
                response = requests.get(f"{API_BASE}/recruiters?page={page}&limit=100", timeout=30)
                if response.status_code != 200:
                    break
                page_data = response.json()
                if 'data' not in page_data or not page_data['data']:
                    break
                all_recruiters.extend(page_data['data'])
                if len(page_data['data']) < 100:  # Last page
                    break
                page += 1
        else:
            all_recruiters = recruiters
        
        print(f"📊 Total recruiters collected: {len(all_recruiters)}")
        
        # Verify total count
        expected_total = 133
        if len(all_recruiters) != expected_total:
            print(f"❌ FAILED: Expected {expected_total} total recruiters, got {len(all_recruiters)}")
            return False
        
        print(f"✅ Total recruiter count matches expected: {expected_total}")
        
        # Count status distribution
        status_counts = Counter()
        for recruiter in all_recruiters:
            status = recruiter.get('verificationStatus', 'approved')  # Default to approved if missing
            status_counts[status] += 1
        
        print(f"\n📈 Status Distribution:")
        for status, count in status_counts.items():
            print(f"  {status}: {count}")
        
        # Verify expected distribution
        expected_distribution = {
            'approved': 102,
            'pending': 15,
            'rejected': 16
        }
        
        success = True
        for status, expected_count in expected_distribution.items():
            actual_count = status_counts.get(status, 0)
            if actual_count == expected_count:
                print(f"✅ {status}: {actual_count} (matches expected {expected_count})")
            else:
                print(f"❌ {status}: {actual_count} (expected {expected_count})")
                success = False
        
        # Check for unexpected statuses
        unexpected_statuses = set(status_counts.keys()) - set(expected_distribution.keys())
        if unexpected_statuses:
            print(f"⚠️  Unexpected statuses found: {unexpected_statuses}")
        
        return success
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: JSON decode error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
        return False

def test_specific_recruiters():
    """Test specific recruiters have correct statuses"""
    print("\n🔍 Testing specific recruiter statuses...")
    
    expected_recruiters = {
        "Kaivalya Technologies Private Limited": 'pending',
        "R G Bronez Pvt Ltd": 'rejected',
        "J.A SOLUTIONS": 'approved'
    }
    
    try:
        # Get all recruiters
        all_recruiters = []
        page = 1
        while True:
            response = requests.get(f"{API_BASE}/recruiters?page={page}&limit=100", timeout=30)
            if response.status_code != 200:
                break
            data = response.json()
            if 'data' in data:
                recruiters = data['data']
            else:
                recruiters = data
            
            if not recruiters:
                break
            all_recruiters.extend(recruiters)
            if len(recruiters) < 100:  # Last page
                break
            page += 1
        
        print(f"📊 Searching through {len(all_recruiters)} recruiters...")
        
        # Find specific recruiters
        found_recruiters = {}
        for recruiter in all_recruiters:
            name = recruiter.get('name', '')
            if name in expected_recruiters:
                found_recruiters[name] = recruiter.get('verificationStatus', 'approved')
        
        print(f"\n🔍 Specific Recruiter Status Check:")
        success = True
        
        for name, expected_status in expected_recruiters.items():
            if name in found_recruiters:
                actual_status = found_recruiters[name]
                if actual_status == expected_status:
                    print(f"✅ {name}: {actual_status} (matches expected {expected_status})")
                else:
                    print(f"❌ {name}: {actual_status} (expected {expected_status})")
                    success = False
            else:
                print(f"❌ {name}: NOT FOUND in database")
                success = False
        
        return success
        
    except Exception as e:
        print(f"❌ FAILED: Error checking specific recruiters - {e}")
        return False

def test_metrics_endpoint():
    """Test GET /api/metrics endpoint shows correct activeRecruiters count"""
    print("\n🔍 Testing GET /api/metrics endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/metrics", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
        data = response.json()
        print(f"✅ Metrics endpoint responded successfully")
        
        # Check activeRecruiters field
        active_recruiters = data.get('activeRecruiters')
        if active_recruiters is None:
            print(f"❌ FAILED: activeRecruiters field missing from response")
            return False
        
        expected_count = 133
        if active_recruiters == expected_count:
            print(f"✅ activeRecruiters: {active_recruiters} (matches expected {expected_count})")
        else:
            print(f"❌ activeRecruiters: {active_recruiters} (expected {expected_count})")
            return False
        
        # Display other metrics for context
        print(f"\n📊 Other Metrics:")
        for key, value in data.items():
            if key != 'activeRecruiters':
                print(f"  {key}: {value}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error - {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: JSON decode error - {e}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error - {e}")
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
    success = run_all_tests()
    exit(0 if success else 1)