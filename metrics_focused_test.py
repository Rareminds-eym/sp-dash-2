#!/usr/bin/env python3
"""
Focused test for metrics endpoint verification
"""

import requests
import json

BASE_URL = "https://email-split-bug.preview.emergentagent.com/api"

def test_metrics_endpoint():
    """Test the metrics endpoint with detailed analysis"""
    print("🔍 TESTING METRICS ENDPOINT")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/metrics")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Expected fields
            expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                             'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters']
            
            # Validate fields
            missing_fields = [field for field in expected_fields if field not in data]
            if missing_fields:
                print(f"❌ Missing fields: {missing_fields}")
                return False
            
            print("✅ All expected fields present")
            
            # Check for real data (not all zeros)
            non_zero_count = sum(1 for field in expected_fields if data.get(field, 0) > 0)
            print(f"📊 Non-zero fields: {non_zero_count}/{len(expected_fields)}")
            
            # Validate specific calculations based on what we know
            active_universities = data.get('activeUniversities', 0)
            registered_students = data.get('registeredStudents', 0)
            verified_passports = data.get('verifiedPassports', 0)
            
            print(f"🏫 Active Universities: {active_universities}")
            print(f"👥 Registered Students: {registered_students}")
            print(f"✅ Verified Passports: {verified_passports}")
            print(f"🤖 AI Verified %: {data.get('aiVerifiedPercent', 0)}")
            print(f"📈 Employability Index: {data.get('employabilityIndex', 0)}")
            print(f"🏢 Active Recruiters: {data.get('activeRecruiters', 0)}")
            
            # Verify calculations make sense
            if active_universities == 10:  # We know there are 10 universities
                print("✅ University count matches database")
            else:
                print(f"⚠️  University count unexpected: {active_universities}")
            
            if registered_students > 0:
                print("✅ Students data is populated")
            else:
                print("⚠️  No students found")
            
            return True
        else:
            print(f"❌ Failed with status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_metrics_endpoint()
    print(f"\n🎯 Result: {'✅ SUCCESS' if success else '❌ FAILED'}")