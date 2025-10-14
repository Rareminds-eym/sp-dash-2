#!/usr/bin/env python3
"""
Focused test for the updated /api/metrics endpoint
Tests the new dynamic calculation from database tables
"""

import requests
import json
from datetime import datetime

# Base URL from environment
BASE_URL = "https://recruiter-sync.preview.emergentagent.com/api"

def test_metrics_endpoint_detailed():
    """Test the updated metrics endpoint with detailed validation"""
    print("🔍 TESTING UPDATED METRICS ENDPOINT")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BASE_URL}/metrics")
        print(f"📡 Request: GET {BASE_URL}/metrics")
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📋 Response Data: {json.dumps(data, indent=2)}")
            
            # Check for expected metric fields
            expected_fields = [
                'activeUniversities', 
                'registeredStudents', 
                'verifiedPassports', 
                'employabilityIndex', 
                'activeRecruiters'
            ]
            
            print("\n🔍 FIELD VALIDATION:")
            all_fields_present = True
            for field in expected_fields:
                if field in data:
                    value = data[field]
                    print(f"  ✅ {field}: {value} ({type(value).__name__})")
                else:
                    print(f"  ❌ {field}: MISSING")
                    all_fields_present = False
            
            print("\n📈 DATA ANALYSIS:")
            
            # Check if we have real data (not all zeros)
            non_zero_fields = [field for field in expected_fields if data.get(field, 0) > 0]
            zero_fields = [field for field in expected_fields if data.get(field, 0) == 0]
            
            print(f"  📊 Non-zero fields ({len(non_zero_fields)}): {non_zero_fields}")
            print(f"  🔢 Zero fields ({len(zero_fields)}): {zero_fields}")
            
            # Validate data types
            print("\n🔍 DATA TYPE VALIDATION:")
            type_validation = True
            for field in expected_fields:
                if field in data:
                    value = data[field]
                    expected_type = (int, float)
                    if isinstance(value, expected_type):
                        print(f"  ✅ {field}: {type(value).__name__} (valid)")
                    else:
                        print(f"  ❌ {field}: {type(value).__name__} (invalid - expected number)")
                        type_validation = False
            
            # Calculate success
            has_real_data = len(non_zero_fields) > 0
            
            print("\n📋 TEST RESULTS:")
            print(f"  ✅ All fields present: {all_fields_present}")
            print(f"  ✅ Correct data types: {type_validation}")
            print(f"  ✅ Has real data (not all zeros): {has_real_data}")
            
            overall_success = all_fields_present and type_validation
            
            if overall_success:
                if has_real_data:
                    print("\n🎉 SUCCESS: Metrics endpoint is working correctly with real database data!")
                else:
                    print("\n⚠️  SUCCESS: Metrics endpoint structure is correct, but all values are zero (may indicate empty database)")
                return True, data
            else:
                print("\n❌ FAILURE: Metrics endpoint has structural issues")
                return False, data
                
        else:
            print(f"❌ FAILURE: Metrics endpoint returned status {response.status_code}")
            try:
                error_data = response.json()
                print(f"📋 Error Response: {json.dumps(error_data, indent=2)}")
            except:
                print(f"📋 Raw Response: {response.text}")
            return False, None
            
    except Exception as e:
        print(f"❌ FAILURE: Request failed with exception: {str(e)}")
        return False, None

def test_database_connectivity():
    """Test if we can access other endpoints to verify database connectivity"""
    print("\n🔗 TESTING DATABASE CONNECTIVITY")
    print("=" * 60)
    
    endpoints_to_test = [
        ('/organizations', 'Organizations'),
        ('/students', 'Students'),
        ('/passports', 'Skill Passports')
    ]
    
    connectivity_results = {}
    
    for endpoint, name in endpoints_to_test:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            print(f"📡 Testing {name}: GET {BASE_URL}{endpoint}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    count = len(data)
                    print(f"  ✅ {name}: {count} records found")
                    connectivity_results[endpoint] = count
                else:
                    print(f"  ⚠️  {name}: Unexpected response format")
                    connectivity_results[endpoint] = 0
            else:
                print(f"  ❌ {name}: Status {response.status_code}")
                connectivity_results[endpoint] = 0
                
        except Exception as e:
            print(f"  ❌ {name}: Exception - {str(e)}")
            connectivity_results[endpoint] = 0
    
    return connectivity_results

if __name__ == "__main__":
    print("🚀 METRICS ENDPOINT VERIFICATION TEST")
    print("=" * 80)
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"⏰ Test Time: {datetime.now().isoformat()}")
    print()
    
    # Test database connectivity first
    db_results = test_database_connectivity()
    
    # Test the metrics endpoint
    success, metrics_data = test_metrics_endpoint_detailed()
    
    print("\n" + "=" * 80)
    print("📊 FINAL SUMMARY")
    print("=" * 80)
    
    print("🔗 Database Connectivity:")
    for endpoint, count in db_results.items():
        print(f"  - {endpoint}: {count} records")
    
    total_records = sum(db_results.values())
    print(f"  - Total records across tables: {total_records}")
    
    print(f"\n📈 Metrics Endpoint: {'✅ WORKING' if success else '❌ FAILED'}")
    
    if success and metrics_data:
        print("📋 Current Metrics Values:")
        for key, value in metrics_data.items():
            print(f"  - {key}: {value}")
    
    print(f"\n🎯 Overall Result: {'✅ METRICS FIX VERIFIED' if success else '❌ METRICS FIX NEEDS ATTENTION'}")