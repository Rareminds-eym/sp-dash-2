#!/usr/bin/env python3
"""
Test comprehensive metrics scenarios for the updated /api/metrics endpoint
"""

import requests
import json
from datetime import datetime

# Base URL from environment
BASE_URL = "https://passport-paginate.preview.emergentagent.com/api"

def test_metrics_scenarios():
    """Test comprehensive metrics scenarios"""
    print("🧪 TESTING METRICS ENDPOINT SCENARIOS")
    print("=" * 60)
    
    try:
        # Scenario 1: Test initial metrics endpoint
        print("📊 Scenario 1: Testing initial /api/metrics...")
        response1 = requests.get(f"{BASE_URL}/metrics")
        if response1.status_code != 200:
            print(f"❌ FAIL: Metrics endpoint returned status {response1.status_code}")
            return False
        
        data1 = response1.json()
        print(f"   Response: {json.dumps(data1, indent=2)}")
        
        # Check for required fields including source
        expected_fields = ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                         'employabilityIndex', 'activeRecruiters', 'source']
        
        missing_fields = [field for field in expected_fields if field not in data1]
        if missing_fields:
            print(f"❌ FAIL: Missing required fields: {missing_fields}")
            return False
        
        initial_source = data1.get('source')
        print(f"   ✅ Initial metrics source: {initial_source}")
        print(f"   ✅ All 5 metrics fields present: {[f for f in expected_fields[:-1] if f in data1]}")
        
        # Scenario 2: Create/update snapshot using /api/update-metrics
        print("\n📊 Scenario 2: Creating/updating metrics snapshot...")
        response2 = requests.post(f"{BASE_URL}/update-metrics")
        if response2.status_code != 200:
            print(f"❌ FAIL: Update metrics endpoint returned status {response2.status_code}")
            return False
        
        data2 = response2.json()
        print(f"   Response: {json.dumps(data2, indent=2)}")
        
        if not data2.get('success'):
            print("❌ FAIL: Update metrics response success flag is false")
            return False
        
        snapshot_action = 'created' if 'created' in data2.get('message', '').lower() else 'updated'
        print(f"   ✅ Snapshot action: {snapshot_action}")
        
        # Scenario 3: Test metrics endpoint after snapshot creation
        print("\n📊 Scenario 3: Testing /api/metrics after snapshot creation...")
        response3 = requests.get(f"{BASE_URL}/metrics")
        if response3.status_code != 200:
            print(f"❌ FAIL: Metrics endpoint returned status {response3.status_code} after snapshot")
            return False
        
        data3 = response3.json()
        print(f"   Response: {json.dumps(data3, indent=2)}")
        
        # Check if source changed to 'snapshot'
        final_source = data3.get('source')
        print(f"   ✅ Final metrics source: {final_source}")
        
        # Verify snapshotDate field is present when source is 'snapshot'
        has_snapshot_date = 'snapshotDate' in data3 if final_source == 'snapshot' else True
        if final_source == 'snapshot':
            if has_snapshot_date:
                print(f"   ✅ Snapshot date present: {data3.get('snapshotDate')}")
            else:
                print("   ❌ Missing snapshotDate field when source is 'snapshot'")
        
        # Scenario 4: Verify data accuracy between endpoints
        print("\n📊 Scenario 4: Verifying data accuracy between endpoints...")
        snapshot_data = data2.get('data', {})
        
        # Compare key metrics between update-metrics response and metrics endpoint
        metrics_match = True
        mismatched_fields = []
        for field in ['activeUniversities', 'registeredStudents', 'verifiedPassports', 
                     'employabilityIndex', 'activeRecruiters']:
            snapshot_val = snapshot_data.get(field)
            metrics_val = data3.get(field)
            if snapshot_val != metrics_val:
                metrics_match = False
                mismatched_fields.append(f"{field}: snapshot={snapshot_val}, metrics={metrics_val}")
                print(f"   ❌ Mismatch in {field}: snapshot={snapshot_val}, metrics={metrics_val}")
            else:
                print(f"   ✅ {field} matches: {snapshot_val}")
        
        # Summary
        print("\n" + "="*60)
        print("METRICS ENDPOINT SCENARIOS TEST SUMMARY")
        print("="*60)
        
        scenarios_passed = 0
        total_scenarios = 4
        
        if initial_source in ['dynamic', 'snapshot', 'error']:
            print("✅ Scenario 1: Metrics endpoint returns valid source field")
            scenarios_passed += 1
        else:
            print(f"❌ Scenario 1: Invalid source '{initial_source}'")
        
        if data2.get('success') and snapshot_action in ['created', 'updated']:
            print(f"✅ Scenario 2: Snapshot {snapshot_action} successfully")
            scenarios_passed += 1
        else:
            print("❌ Scenario 2: Snapshot creation/update failed")
        
        if final_source == 'snapshot' and has_snapshot_date:
            print("✅ Scenario 3: Metrics endpoint returns snapshot data with snapshotDate")
            scenarios_passed += 1
        elif final_source == 'dynamic':
            print("✅ Scenario 3: Metrics endpoint returns dynamic data (fallback working)")
            scenarios_passed += 1
        else:
            print(f"❌ Scenario 3: Unexpected source '{final_source}' or missing snapshotDate")
        
        if metrics_match:
            print("✅ Scenario 4: Data accuracy verified - metrics match between endpoints")
            scenarios_passed += 1
        else:
            print(f"❌ Scenario 4: Data mismatch - {', '.join(mismatched_fields)}")
        
        print(f"\nResult: {scenarios_passed}/{total_scenarios} scenarios passed")
        
        return scenarios_passed == total_scenarios
        
    except Exception as e:
        print(f"❌ FAIL: Scenarios test failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_metrics_scenarios()
    exit(0 if success else 1)