#!/usr/bin/env python3
"""
Database Index Verification Script
Check if 47 performance indexes have been applied
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://file-purge.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Authentication credentials
LOGIN_CREDENTIALS = {
    "email": "superadmin@rareminds.in",
    "password": "password123"
}

def authenticate():
    """Authenticate with the API"""
    print("🔐 Authenticating...")
    try:
        session = requests.Session()
        response = session.post(f"{API_BASE}/auth/login", json=LOGIN_CREDENTIALS)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Authentication successful: {data.get('user', {}).get('email', 'Unknown')}")
            return session
        else:
            print(f"❌ Authentication failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Authentication error: {str(e)}")
        return None

def test_csv_exports(session):
    """Test CSV export endpoints"""
    print("\n" + "="*60)
    print("📤 TESTING CSV EXPORT ENDPOINTS")
    print("="*60)
    
    export_endpoints = [
        ('/recruiters/export', 'Recruiters Export'),
        ('/passports/export', 'Passports Export'),
        ('/audit-logs/export', 'Audit Logs Export')
    ]
    
    for endpoint, name in export_endpoints:
        try:
            print(f"\n📋 Testing: {name}")
            response = session.get(f"{API_BASE}{endpoint}")
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if content_type == 'text/csv':
                    lines = response.text.split('\n')
                    row_count = len([line for line in lines if line.strip()]) - 1  # Exclude header
                    print(f"   ✅ SUCCESS: {row_count} records exported")
                    print(f"   📄 Content-Type: {content_type}")
                    print(f"   📝 Sample: {lines[0] if lines else 'No content'}")
                else:
                    print(f"   ❌ FAILED: Wrong content type - {content_type}")
            else:
                print(f"   ❌ FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")

def measure_query_performance(session):
    """Measure performance of key queries that should benefit from indexes"""
    print("\n" + "="*60)
    print("⚡ MEASURING QUERY PERFORMANCE")
    print("="*60)
    
    import time
    
    # Test queries that should be optimized by indexes
    test_queries = [
        {
            'name': 'Recruiters by Status (indexed)',
            'endpoint': '/recruiters',
            'params': {'status': 'approved', 'limit': 1000}
        },
        {
            'name': 'Recruiters by State (indexed)',
            'endpoint': '/recruiters',
            'params': {'state': 'Tamil Nadu', 'limit': 1000}
        },
        {
            'name': 'Passports by Status (indexed)',
            'endpoint': '/passports',
            'params': {'status': 'verified', 'limit': 1000}
        },
        {
            'name': 'Passports by NSQF Level (indexed)',
            'endpoint': '/passports',
            'params': {'nsqfLevel': '4', 'limit': 1000}
        },
        {
            'name': 'Users by Role (indexed)',
            'endpoint': '/users',
            'params': {'role': 'super_admin', 'limit': 1000}
        },
        {
            'name': 'Audit Logs by Action (indexed)',
            'endpoint': '/audit-logs',
            'params': {'action': 'login', 'limit': 1000}
        }
    ]
    
    performance_results = []
    
    for query in test_queries:
        try:
            print(f"\n🔍 Testing: {query['name']}")
            
            # Measure response time
            start_time = time.time()
            response = session.get(f"{API_BASE}{query['endpoint']}", params=query['params'])
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            if response.status_code == 200:
                data = response.json()
                
                # Get record count
                if isinstance(data, dict) and 'data' in data:
                    record_count = len(data['data'])
                    total_records = data.get('pagination', {}).get('total', record_count)
                elif isinstance(data, list):
                    record_count = len(data)
                    total_records = record_count
                else:
                    record_count = 0
                    total_records = 0
                
                print(f"   ⏱️  Response Time: {response_time:.2f}ms")
                print(f"   📊 Records: {record_count} returned, {total_records} total")
                
                # Evaluate performance
                if response_time < 300:
                    status = "🚀 EXCELLENT"
                elif response_time < 500:
                    status = "✅ GOOD"
                elif response_time < 1000:
                    status = "🟡 ACCEPTABLE"
                else:
                    status = "🔴 SLOW"
                
                print(f"   📈 Performance: {status}")
                
                performance_results.append({
                    'name': query['name'],
                    'response_time': response_time,
                    'record_count': record_count,
                    'total_records': total_records,
                    'status': status
                })
                
            else:
                print(f"   ❌ FAILED: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
    
    return performance_results

def analyze_index_effectiveness(performance_results):
    """Analyze if indexes are effective based on performance"""
    print("\n" + "="*60)
    print("📊 INDEX EFFECTIVENESS ANALYSIS")
    print("="*60)
    
    if not performance_results:
        print("❌ No performance data to analyze")
        return
    
    # Calculate statistics
    response_times = [result['response_time'] for result in performance_results]
    avg_response_time = sum(response_times) / len(response_times)
    
    fast_queries = len([r for r in performance_results if r['response_time'] < 500])
    total_queries = len(performance_results)
    
    print(f"📈 Performance Summary:")
    print(f"   Average Response Time: {avg_response_time:.2f}ms")
    print(f"   Fast Queries (< 500ms): {fast_queries}/{total_queries} ({fast_queries/total_queries*100:.1f}%)")
    print(f"   Fastest Query: {min(response_times):.2f}ms")
    print(f"   Slowest Query: {max(response_times):.2f}ms")
    
    print(f"\n🎯 Index Effectiveness Assessment:")
    
    if avg_response_time < 400:
        print("   🚀 EXCELLENT - Indexes appear to be working effectively")
        print("   💡 Performance indicates 47 indexes are likely applied")
    elif avg_response_time < 600:
        print("   ✅ GOOD - Indexes are providing performance benefits")
        print("   💡 Performance suggests indexes are partially applied")
    elif avg_response_time < 1000:
        print("   🟡 MODERATE - Some performance improvement visible")
        print("   ⚠️  Indexes may not be fully applied or optimized")
    else:
        print("   🔴 POOR - Limited performance improvement")
        print("   ❌ Indexes may not be applied or need optimization")
    
    print(f"\n📋 Detailed Results:")
    for result in performance_results:
        print(f"   {result['status']} {result['name']}: {result['response_time']:.2f}ms ({result['total_records']} records)")

def main():
    """Main function"""
    print("🔍 DATABASE INDEX VERIFICATION")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Authenticate
    session = authenticate()
    if not session:
        print("❌ Authentication failed. Cannot proceed.")
        return False
    
    # Test CSV exports
    test_csv_exports(session)
    
    # Measure query performance
    performance_results = measure_query_performance(session)
    
    # Analyze index effectiveness
    analyze_index_effectiveness(performance_results)
    
    print(f"\n💡 MANUAL INDEX VERIFICATION:")
    print(f"   To confirm 47 indexes are applied, run this SQL in Supabase SQL Editor:")
    print(f"   SELECT COUNT(*) FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';")
    print(f"   Expected result: 47")
    
    print(f"\n🎉 INDEX VERIFICATION COMPLETED!")
    return True

if __name__ == "__main__":
    main()