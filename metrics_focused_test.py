import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:3000"

def test_metrics_endpoints():
    print("🧪 Testing Metrics Endpoints")
    print("=" * 50)
    
    # Test 1: GET /api/metrics - Dashboard metrics
    print("\n1. Testing GET /api/metrics")
    try:
        response = requests.get(f"{BASE_URL}/api/metrics")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   📊 Active Universities: {data.get('activeUniversities', 0)}")
            print(f"   👥 Registered Students: {data.get('registeredStudents', 0)}")
            print(f"   ✅ Verified Passports: {data.get('verifiedPassports', 0)}")
            print(f"   📈 Employability Index: {data.get('employabilityIndex', 0)}%")
            print(f"   🏢 Active Recruiters: {data.get('activeRecruiters', 0)}")
            print(f"   📅 Source: {data.get('source', 'unknown')}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")
    
    # Test 2: GET /api/analytics/trends - Trends data
    print("\n2. Testing GET /api/analytics/trends")
    try:
        response = requests.get(f"{BASE_URL}/api/analytics/trends")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   📈 Trends Data Points: {len(data) if isinstance(data, list) else 0}")
            if isinstance(data, list) and len(data) > 0:
                latest = data[-1]
                print(f"   📅 Latest Date: {latest.get('date', 'N/A')}")
                print(f"   📊 Employability Index: {latest.get('employability', 0)}%")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")
    
    # Test 3: POST /api/update-metrics - Update metrics snapshot
    print("\n3. Testing POST /api/update-metrics")
    try:
        response = requests.post(f"{BASE_URL}/api/update-metrics")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Success: {data.get('success', False)}")
            print(f"   💬 Message: {data.get('message', 'N/A')}")
            if 'data' in data:
                metrics = data['data']
                print(f"   📊 Active Universities: {metrics.get('activeUniversities', 0)}")
                print(f"   👥 Registered Students: {metrics.get('registeredStudents', 0)}")
                print(f"   ✅ Verified Passports: {metrics.get('verifiedPassports', 0)}")
                print(f"   📈 Employability Index: {metrics.get('employabilityIndex', 0)}%")
                print(f"   🏢 Active Recruiters: {metrics.get('activeRecruiters', 0)}")
        else:
            print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Exception: {e}")

if __name__ == "__main__":
    test_metrics_endpoints()