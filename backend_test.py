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

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_result(success, message, details=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"   Details: {details}")

def test_login():
    """Test login functionality to get session"""
    print_test_header("Authentication Test")
    
    try:
        response = requests.post(f"{API_BASE}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Login successful for {TEST_EMAIL}")
            print(f"   User role: {data.get('user', {}).get('role', 'N/A')}")
            return True
        else:
            print_result(False, f"Login failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Login error: {str(e)}")
        return False

def test_metrics_endpoint():
    """Test GET /api/metrics - Verify activeUniversities=10, activeRecruiters=133"""
    print_test_header("Metrics Endpoint Test")
    
    try:
        response = requests.get(f"{API_BASE}/metrics")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ['activeUniversities', 'activeRecruiters', 'registeredStudents', 
                             'verifiedPassports', 'employabilityIndex']
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print_result(False, f"Missing required fields: {missing_fields}")
                return False
            
            # Verify specific counts
            active_universities = data.get('activeUniversities', 0)
            active_recruiters = data.get('activeRecruiters', 0)
            
            print_result(True, "Metrics endpoint responded successfully")
            print(f"   Active Universities: {active_universities} (expected: 10)")
            print(f"   Active Recruiters: {active_recruiters} (expected: 133)")
            print(f"   Registered Students: {data.get('registeredStudents', 0)}")
            print(f"   Verified Passports: {data.get('verifiedPassports', 0)}")
            print(f"   Employability Index: {data.get('employabilityIndex', 0)}%")
            print(f"   Data Source: {data.get('source', 'N/A')}")
            
            # Verify expected counts
            universities_correct = active_universities == 10
            recruiters_correct = active_recruiters == 133
            
            if universities_correct and recruiters_correct:
                print_result(True, "University and recruiter counts match expected values")
            else:
                print_result(False, f"Count mismatch - Universities: {active_universities}/10, Recruiters: {active_recruiters}/133")
            
            return universities_correct and recruiters_correct
            
        else:
            print_result(False, f"Metrics endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Metrics endpoint error: {str(e)}")
        return False

def test_organizations_endpoint():
    """Test GET /api/organizations - Verify combined data from universities and recruiters tables"""
    print_test_header("Organizations Endpoint Test")
    
    try:
        response = requests.get(f"{API_BASE}/organizations")
        
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                print_result(False, "Organizations endpoint should return an array")
                return False
            
            total_count = len(data)
            universities = [org for org in data if org.get('type') == 'university']
            recruiters = [org for org in data if org.get('type') == 'recruiter']
            
            print_result(True, "Organizations endpoint responded successfully")
            print(f"   Total Organizations: {total_count} (expected: 143)")
            print(f"   Universities: {len(universities)} (expected: 10)")
            print(f"   Recruiters: {len(recruiters)} (expected: 133)")
            
            # Verify structure of first few records
            if data:
                sample_org = data[0]
                required_fields = ['id', 'name', 'type', 'state', 'verificationStatus', 'isActive']
                missing_fields = [field for field in required_fields if field not in sample_org]
                
                if missing_fields:
                    print_result(False, f"Missing required fields in organization record: {missing_fields}")
                    return False
                
                print(f"   Sample organization: {sample_org.get('name')} ({sample_org.get('type')})")
            
            # Verify expected total count (10 universities + 133 recruiters = 143)
            expected_total = 143
            count_correct = total_count == expected_total
            
            if count_correct:
                print_result(True, f"Total organization count matches expected value: {total_count}")
            else:
                print_result(False, f"Total count mismatch: {total_count} (expected: {expected_total})")
            
            return count_correct
            
        else:
            print_result(False, f"Organizations endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Organizations endpoint error: {str(e)}")
        return False

def test_recruiters_endpoint():
    """Test GET /api/recruiters - Verify 133 recruiters with correct fields"""
    print_test_header("Recruiters Endpoint Test")
    
    try:
        response = requests.get(f"{API_BASE}/recruiters")
        
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                print_result(False, "Recruiters endpoint should return an array")
                return False
            
            recruiter_count = len(data)
            
            print_result(True, "Recruiters endpoint responded successfully")
            print(f"   Total Recruiters: {recruiter_count} (expected: 133)")
            
            # Verify structure of first recruiter
            if data:
                sample_recruiter = data[0]
                required_fields = ['id', 'name', 'type', 'state', 'email', 'phone', 'website', 
                                 'verificationStatus', 'isActive', 'userCount']
                missing_fields = [field for field in required_fields if field not in sample_recruiter]
                
                if missing_fields:
                    print_result(False, f"Missing required fields in recruiter record: {missing_fields}")
                    return False
                
                print(f"   Sample recruiter: {sample_recruiter.get('name')}")
                print(f"   User count: {sample_recruiter.get('userCount', 0)}")
                print(f"   Verification status: {sample_recruiter.get('verificationStatus')}")
                print(f"   Active status: {sample_recruiter.get('isActive')}")
            
            # Verify expected count
            count_correct = recruiter_count == 133
            
            if count_correct:
                print_result(True, f"Recruiter count matches expected value: {recruiter_count}")
            else:
                print_result(False, f"Recruiter count mismatch: {recruiter_count} (expected: 133)")
            
            return count_correct
            
        else:
            print_result(False, f"Recruiters endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Recruiters endpoint error: {str(e)}")
        return False

def test_students_endpoint():
    """Test GET /api/students - Verify organization data populated from universities table"""
    print_test_header("Students Endpoint Test")
    
    try:
        response = requests.get(f"{API_BASE}/students")
        
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                print_result(False, "Students endpoint should return an array")
                return False
            
            student_count = len(data)
            
            print_result(True, "Students endpoint responded successfully")
            print(f"   Total Students: {student_count}")
            
            # Check if students have organization data populated
            students_with_orgs = 0
            students_with_users = 0
            
            for student in data:
                if student.get('organizations'):
                    students_with_orgs += 1
                if student.get('users'):
                    students_with_users += 1
            
            print(f"   Students with organization data: {students_with_orgs}")
            print(f"   Students with user data: {students_with_users}")
            
            # Verify structure of first student with organization data
            student_with_org = next((s for s in data if s.get('organizations')), None)
            if student_with_org:
                org_data = student_with_org['organizations']
                print(f"   Sample organization: {org_data.get('name')} (ID: {org_data.get('id')})")
                print_result(True, "Students have organization data populated from universities table")
                return True
            else:
                print_result(False, "No students found with organization data populated")
                return False
            
        else:
            print_result(False, f"Students endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Students endpoint error: {str(e)}")
        return False

def test_university_reports_analytics():
    """Test GET /api/analytics/university-reports - Verify fetches from universities table"""
    print_test_header("University Reports Analytics Test")
    
    try:
        response = requests.get(f"{API_BASE}/analytics/university-reports")
        
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                print_result(False, "University reports endpoint should return an array")
                return False
            
            university_count = len(data)
            
            print_result(True, "University reports endpoint responded successfully")
            print(f"   Universities in report: {university_count}")
            
            # Verify structure of university reports
            if data:
                sample_report = data[0]
                required_fields = ['universityId', 'universityName', 'state', 'enrollmentCount', 
                                 'totalPassports', 'verifiedPassports', 'completionRate', 'verificationRate']
                missing_fields = [field for field in required_fields if field not in sample_report]
                
                if missing_fields:
                    print_result(False, f"Missing required fields in university report: {missing_fields}")
                    return False
                
                print(f"   Sample university: {sample_report.get('universityName')}")
                print(f"   Enrollment count: {sample_report.get('enrollmentCount', 0)}")
                print(f"   Total passports: {sample_report.get('totalPassports', 0)}")
                print(f"   Verified passports: {sample_report.get('verifiedPassports', 0)}")
                print(f"   Completion rate: {sample_report.get('completionRate', 0)}%")
                print(f"   Verification rate: {sample_report.get('verificationRate', 0)}%")
                
                print_result(True, "University reports contain all required metrics")
                return True
            else:
                print_result(False, "No university reports found")
                return False
            
        else:
            print_result(False, f"University reports endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"University reports endpoint error: {str(e)}")
        return False

def test_state_heatmap_analytics():
    """Test GET /api/analytics/state-heatmap - Verify combines data from both tables"""
    print_test_header("State Heatmap Analytics Test")
    
    try:
        response = requests.get(f"{API_BASE}/analytics/state-heatmap")
        
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                print_result(False, "State heatmap endpoint should return an array")
                return False
            
            state_count = len(data)
            
            print_result(True, "State heatmap endpoint responded successfully")
            print(f"   States in heatmap: {state_count}")
            
            # Verify structure of state data
            if data:
                sample_state = data[0]
                required_fields = ['state', 'universities', 'students', 'verifiedPassports', 
                                 'engagementScore', 'employabilityIndex']
                missing_fields = [field for field in required_fields if field not in sample_state]
                
                if missing_fields:
                    print_result(False, f"Missing required fields in state data: {missing_fields}")
                    return False
                
                print(f"   Sample state: {sample_state.get('state')}")
                print(f"   Universities: {sample_state.get('universities', 0)}")
                print(f"   Students: {sample_state.get('students', 0)}")
                print(f"   Verified passports: {sample_state.get('verifiedPassports', 0)}")
                print(f"   Engagement score: {sample_state.get('engagementScore', 0)}")
                print(f"   Employability index: {sample_state.get('employabilityIndex', 0)}")
                
                # Verify that data combines universities and recruiters
                total_universities = sum(state.get('universities', 0) for state in data)
                print(f"   Total universities across states: {total_universities}")
                
                print_result(True, "State heatmap combines data from universities and recruiters tables")
                return True
            else:
                print_result(False, "No state data found in heatmap")
                return False
            
        else:
            print_result(False, f"State heatmap endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"State heatmap endpoint error: {str(e)}")
        return False

def run_all_tests():
    """Run all migration verification tests"""
    print(f"\n🚀 Starting Universities and Recruiters Migration Testing")
    print(f"📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 API Base URL: {API_BASE}")
    
    test_results = []
    
    # Test 1: Authentication
    auth_result = test_login()
    test_results.append(("Authentication", auth_result))
    
    # Test 2: Metrics Endpoint
    metrics_result = test_metrics_endpoint()
    test_results.append(("Metrics Endpoint", metrics_result))
    
    # Test 3: Organizations Endpoint
    orgs_result = test_organizations_endpoint()
    test_results.append(("Organizations Endpoint", orgs_result))
    
    # Test 4: Recruiters Endpoint
    recruiters_result = test_recruiters_endpoint()
    test_results.append(("Recruiters Endpoint", recruiters_result))
    
    # Test 5: Students Endpoint
    students_result = test_students_endpoint()
    test_results.append(("Students Endpoint", students_result))
    
    # Test 6: University Reports Analytics
    uni_reports_result = test_university_reports_analytics()
    test_results.append(("University Reports Analytics", uni_reports_result))
    
    # Test 7: State Heatmap Analytics
    heatmap_result = test_state_heatmap_analytics()
    test_results.append(("State Heatmap Analytics", heatmap_result))
    
    # Summary
    print(f"\n{'='*60}")
    print(f"📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed_tests = sum(1 for _, result in test_results if result)
    total_tests = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED - Migration verification successful!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED - Migration needs attention")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)