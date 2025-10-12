#!/usr/bin/env python3
"""
Test the /api/metrics endpoint fallback to dynamic calculation when snapshots table is empty
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:3000"

def test_metrics_fallback():
    print("🧪 Testing Metrics Fallback Behavior")
    print("=" * 50)
    
    # Test 1: GET /api/metrics - Should work with or without snapshots
    print("\n1. Testing GET /api/metrics (Fallback Test)")
    try:
        response1 = requests.get(f"{BASE_URL}/api/metrics")
        print(f"   Status Code: {response1.status_code}")
        
        if response1.status_code == 200:
            data1 = response1.json()
            print(f"   📊 Active Universities: {data1.get('activeUniversities', 0)}")
            print(f"   👥 Registered Students: {data1.get('registeredStudents', 0)}")
            print(f"   ✅ Verified Passports: {data1.get('verifiedPassports', 0)}")
            print(f"   📈 Employability Index: {data1.get('employabilityIndex', 0)}%")
            print(f"   🏢 Active Recruiters: {data1.get('activeRecruiters', 0)}")
            print(f"   📅 Source: {data1.get('source', 'unknown')}")
        else:
            print(f"   ❌ Error: {response1.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")
    
    # Test 2: POST /api/update-metrics - Force creation of snapshot
    print("\n2. Testing POST /api/update-metrics (Snapshot Creation)")
    try:
        response2 = requests.post(f"{BASE_URL}/api/update-metrics")
        print(f"   Status Code: {response2.status_code}")
        
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"   ✅ Success: {data2.get('success', False)}")
            print(f"   💬 Message: {data2.get('message', 'N/A')}")
            if 'data' in data2:
                metrics = data2['data']
                print(f"   📊 Active Universities: {metrics.get('activeUniversities', 0)}")
                print(f"   👥 Registered Students: {metrics.get('registeredStudents', 0)}")
                print(f"   ✅ Verified Passports: {metrics.get('verifiedPassports', 0)}")
                print(f"   📈 Employability Index: {metrics.get('employabilityIndex', 0)}%")
                print(f"   🏢 Active Recruiters: {metrics.get('activeRecruiters', 0)}")
        else:
            print(f"   ❌ Error: {response2.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")
    
    # Test 3: GET /api/metrics - Should now return snapshot data
    print("\n3. Testing GET /api/metrics (Snapshot Data)")
    try:
        response3 = requests.get(f"{BASE_URL}/api/metrics")
        print(f"   Status Code: {response3.status_code}")
        
        if response3.status_code == 200:
            data3 = response3.json()
            print(f"   📊 Active Universities: {data3.get('activeUniversities', 0)}")
            print(f"   👥 Registered Students: {data3.get('registeredStudents', 0)}")
            print(f"   ✅ Verified Passports: {data3.get('verifiedPassports', 0)}")
            print(f"   📈 Employability Index: {data3.get('employabilityIndex', 0)}%")
            print(f"   🏢 Active Recruiters: {data3.get('activeRecruiters', 0)}")
            print(f"   📅 Source: {data3.get('source', 'unknown')}")
        else:
            print(f"   ❌ Error: {response3.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

if __name__ == "__main__":
    test_metrics_fallback()
