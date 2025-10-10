#!/usr/bin/env python3
"""
Test script specifically for the new /api/update-metrics endpoint
"""

import requests
import json
from datetime import datetime

# Base URL from environment
BASE_URL = "https://kpi-data-fix.preview.emergentagent.com/api"

def test_update_metrics_endpoint():
    """Test POST /api/update-metrics - Update metrics snapshots table"""
    print("🧪 Testing /api/update-metrics endpoint...")
    
    try:
        # First, get current metrics for comparison
        print("📊 Getting current metrics from /api/metrics...")
        metrics_response = requests.get(f"{BASE_URL}/metrics")
        if metrics_response.status_code != 200:
            print(f"❌ Could not get current metrics: {metrics_response.status_code}")
            return False
        
        current_metrics = metrics_response.json()
        print(f"✅ Current metrics: {current_metrics}")
        
        # First call to update-metrics - should create new snapshot
        print("\n🔄 First call to /api/update-metrics (should create snapshot)...")
        response1 = requests.post(f"{BASE_URL}/update-metrics")
        
        if response1.status_code != 200:
            print(f"❌ First call failed with status: {response1.status_code}")
            print(f"Response: {response1.text}")
            return False
        
        data1 = response1.json()
        print(f"✅ First call response: {json.dumps(data1, indent=2)}")
        
        # Check required fields in response
        required_fields = ['success', 'message', 'data']
        missing_fields = [field for field in required_fields if field not in data1]
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return False
        
        # Check success flag
        if not data1.get('success'):
            print(f"❌ Response success flag is false")
            return False
        
        # Check data object has all 6 metrics
        data_obj = data1.get('data', {})
        expected_metrics = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                          'aiVerifiedPercent', 'employabilityIndex', 'activeRecruiters']
        
        missing_metrics = [metric for metric in expected_metrics if metric not in data_obj]
        if missing_metrics:
            print(f"❌ Missing metrics in data: {missing_metrics}")
            return False
        
        # Check if message indicates creation or update
        message1 = data1.get('message', '')
        action1 = 'created' if 'created' in message1.lower() else 'updated' if 'updated' in message1.lower() else 'unknown'
        print(f"✅ First call action: {action1}")
        
        # Verify metrics match current metrics
        metrics_match = True
        mismatched_metrics = []
        for metric in expected_metrics:
            if data_obj.get(metric) != current_metrics.get(metric):
                metrics_match = False
                mismatched_metrics.append(f"{metric}: {data_obj.get(metric)} vs {current_metrics.get(metric)}")
        
        if not metrics_match:
            print(f"❌ Metrics don't match /api/metrics: {mismatched_metrics}")
            return False
        
        print("✅ Metrics match /api/metrics endpoint")
        
        # Second call - should update existing snapshot
        print("\n🔄 Second call to /api/update-metrics (should update existing snapshot)...")
        response2 = requests.post(f"{BASE_URL}/update-metrics")
        
        if response2.status_code != 200:
            print(f"❌ Second call failed with status: {response2.status_code}")
            print(f"Response: {response2.text}")
            return False
        
        data2 = response2.json()
        print(f"✅ Second call response: {json.dumps(data2, indent=2)}")
        
        if not data2.get('success'):
            print(f"❌ Second call success flag is false")
            return False
        
        message2 = data2.get('message', '')
        action2 = 'created' if 'created' in message2.lower() else 'updated' if 'updated' in message2.lower() else 'unknown'
        print(f"✅ Second call action: {action2}")
        
        # Verify both calls worked as expected
        if action1 in ['created', 'updated'] and action2 in ['created', 'updated']:
            print(f"\n🎉 SUCCESS: Update metrics endpoint working correctly!")
            print(f"   - First call: {action1} snapshot")
            print(f"   - Second call: {action2} snapshot")
            print(f"   - All 6 metrics present and match /api/metrics")
            print(f"   - Response format correct (success, message, data)")
            return True
        else:
            print(f"❌ Unexpected actions: first={action1}, second={action2}")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with exception: {str(e)}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("TESTING NEW /api/update-metrics ENDPOINT")
    print("=" * 60)
    
    success = test_update_metrics_endpoint()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ ALL TESTS PASSED - Update metrics endpoint working correctly!")
    else:
        print("❌ TESTS FAILED - Update metrics endpoint has issues")
    print("=" * 60)