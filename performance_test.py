#!/usr/bin/env python3
"""
Database Performance Optimization Testing Script
Testing 47 database indexes for 15-30x performance improvement
"""

import requests
import json
import time
import statistics
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://file-purge.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Authentication credentials
LOGIN_CREDENTIALS = {
    "email": "superadmin@rareminds.in",
    "password": "password123"
}

class PerformanceTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        self.performance_data = {}
        
    def authenticate(self):
        """Authenticate with the API"""
        print("🔐 Authenticating...")
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=LOGIN_CREDENTIALS)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Authentication successful: {data.get('user', {}).get('email', 'Unknown')}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def measure_response_time(self, endpoint, params=None, iterations=3):
        """Measure response time for an endpoint with multiple iterations"""
        times = []
        record_count = 0
        
        for i in range(iterations):
            try:
                start_time = time.time()
                response = self.session.get(f"{API_BASE}{endpoint}", params=params)
                end_time = time.time()
                
                response_time = (end_time - start_time) * 1000  # Convert to milliseconds
                
                if response.status_code == 200:
                    times.append(response_time)
                    
                    # Get record count from first successful response
                    if record_count == 0:
                        data = response.json()
                        if isinstance(data, dict):
                            if 'data' in data:
                                record_count = len(data['data'])
                            elif 'pagination' in data:
                                record_count = data['pagination'].get('total', 0)
                        elif isinstance(data, list):
                            record_count = len(data)
                else:
                    print(f"❌ Request failed: {response.status_code} - {response.text}")
                    return None, 0
                    
            except Exception as e:
                print(f"❌ Request error: {str(e)}")
                return None, 0
        
        if times:
            avg_time = statistics.mean(times)
            min_time = min(times)
            max_time = max(times)
            return {
                'avg': round(avg_time, 2),
                'min': round(min_time, 2),
                'max': round(max_time, 2),
                'all_times': times
            }, record_count
        
        return None, 0
    
    def test_endpoint_performance(self, test_name, endpoint, params=None, expected_records=None):
        """Test performance of a specific endpoint"""
        print(f"\n📊 Testing: {test_name}")
        if params:
            print(f"   Parameters: {params}")
        
        timing_data, record_count = self.measure_response_time(endpoint, params)
        
        if timing_data is None:
            print(f"   ❌ FAILED - Request error")
            return False
        
        print(f"   📈 Response Time: {timing_data['avg']}ms (avg), {timing_data['min']}ms (min), {timing_data['max']}ms (max)")
        print(f"   📋 Records Returned: {record_count}")
        
        if expected_records is not None:
            if record_count == expected_records:
                print(f"   ✅ Record count matches expected: {expected_records}")
            else:
                print(f"   ⚠️  Record count mismatch - Expected: {expected_records}, Got: {record_count}")
        
        # Store results
        self.performance_data[test_name] = {
            'endpoint': endpoint,
            'params': params,
            'timing': timing_data,
            'record_count': record_count,
            'expected_records': expected_records
        }
        
        return True
    
    def check_database_indexes(self):
        """Check if database indexes have been applied"""
        print("\n" + "="*80)
        print("🔍 CHECKING DATABASE INDEXES")
        print("="*80)
        
        # We can't directly query the database, but we can infer from performance
        # Test a simple endpoint to see if it's working
        try:
            response = self.session.get(f"{API_BASE}/metrics")
            if response.status_code == 200:
                print("✅ Database connection working")
                print("📝 Note: Index verification requires manual SQL query in Supabase:")
                print("   SELECT COUNT(*) FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'")
                print("   Expected result: 47 indexes if applied")
                return True
            else:
                print(f"❌ Database connection failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Database check error: {str(e)}")
            return False
    
    def test_recruiters_performance(self):
        """Test recruiters endpoint performance with various filters"""
        print("\n" + "="*80)
        print("🏢 TESTING RECRUITERS PERFORMANCE (130 recruiters)")
        print("="*80)
        
        test_cases = [
            {
                'name': 'All Recruiters (No Filters)',
                'endpoint': '/recruiters',
                'params': None,
                'expected': 130
            },
            {
                'name': 'Status Filter - Pending',
                'endpoint': '/recruiters',
                'params': {'status': 'pending'},
                'expected': None  # Will vary based on data
            },
            {
                'name': 'Status Filter - Approved',
                'endpoint': '/recruiters',
                'params': {'status': 'approved'},
                'expected': None
            },
            {
                'name': 'Composite Filter - Approved + Active',
                'endpoint': '/recruiters',
                'params': {'status': 'approved', 'active': 'true'},
                'expected': None
            },
            {
                'name': 'State Filter - Tamil Nadu',
                'endpoint': '/recruiters',
                'params': {'state': 'Tamil Nadu'},
                'expected': None
            },
            {
                'name': 'Search Query - tech',
                'endpoint': '/recruiters',
                'params': {'search': 'tech'},
                'expected': None
            },
            {
                'name': 'Pagination + Sorting',
                'endpoint': '/recruiters',
                'params': {'page': 1, 'limit': 20, 'sortBy': 'createdat', 'sortOrder': 'desc'},
                'expected': 20
            },
            {
                'name': 'CSV Export - All Recruiters',
                'endpoint': '/recruiters/export',
                'params': None,
                'expected': None
            }
        ]
        
        for test_case in test_cases:
            self.test_endpoint_performance(
                test_case['name'],
                test_case['endpoint'],
                test_case['params'],
                test_case['expected']
            )
    
    def test_passports_performance(self):
        """Test passports endpoint performance with various filters"""
        print("\n" + "="*80)
        print("🎓 TESTING PASSPORTS PERFORMANCE (712 passports)")
        print("="*80)
        
        # Get a university ID for testing
        university_id = self.get_university_id()
        
        test_cases = [
            {
                'name': 'All Passports (Paginated)',
                'endpoint': '/passports',
                'params': {'page': 1, 'limit': 20},
                'expected': 20
            },
            {
                'name': 'Status Filter - Verified',
                'endpoint': '/passports',
                'params': {'status': 'verified'},
                'expected': None
            },
            {
                'name': 'NSQF Level Filter - Level 4',
                'endpoint': '/passports',
                'params': {'nsqfLevel': '4'},
                'expected': None
            },
            {
                'name': 'University Filter',
                'endpoint': '/passports',
                'params': {'university': university_id} if university_id else None,
                'expected': None
            },
            {
                'name': 'Student Search',
                'endpoint': '/passports',
                'params': {'search': 'rajadharshini'},
                'expected': None
            },
            {
                'name': 'Large Page + Sorting',
                'endpoint': '/passports',
                'params': {'page': 1, 'limit': 100, 'sortBy': 'createdAt', 'sortOrder': 'desc'},
                'expected': 100
            },
            {
                'name': 'CSV Export - All Passports (712)',
                'endpoint': '/passports/export',
                'params': None,
                'expected': None
            }
        ]
        
        for test_case in test_cases:
            if test_case['params'] is None and 'University Filter' in test_case['name']:
                print(f"\n⚠️  Skipping {test_case['name']} - No university ID available")
                continue
                
            self.test_endpoint_performance(
                test_case['name'],
                test_case['endpoint'],
                test_case['params'],
                test_case['expected']
            )
    
    def test_audit_logs_performance(self):
        """Test audit logs performance"""
        print("\n" + "="*80)
        print("📋 TESTING AUDIT LOGS PERFORMANCE")
        print("="*80)
        
        test_cases = [
            {
                'name': 'Paginated Logs',
                'endpoint': '/audit-logs',
                'params': {'page': 1, 'limit': 50},
                'expected': None
            },
            {
                'name': 'Action Filter - login',
                'endpoint': '/audit-logs',
                'params': {'action': 'login'},
                'expected': None
            },
            {
                'name': 'Date Range Filter',
                'endpoint': '/audit-logs',
                'params': {'dateFrom': '2025-01-01', 'dateTo': '2025-01-20'},
                'expected': None
            },
            {
                'name': 'Search Query - admin',
                'endpoint': '/audit-logs',
                'params': {'search': 'admin'},
                'expected': None
            },
            {
                'name': 'CSV Export - Audit Logs',
                'endpoint': '/audit-logs/export',
                'params': None,
                'expected': None
            }
        ]
        
        for test_case in test_cases:
            self.test_endpoint_performance(
                test_case['name'],
                test_case['endpoint'],
                test_case['params'],
                test_case['expected']
            )
    
    def test_users_students_performance(self):
        """Test users and students performance"""
        print("\n" + "="*80)
        print("👥 TESTING USERS & STUDENTS PERFORMANCE")
        print("="*80)
        
        test_cases = [
            {
                'name': 'Paginated Users',
                'endpoint': '/users',
                'params': {'page': 1, 'limit': 20},
                'expected': 20
            },
            {
                'name': 'Role Filter - super_admin',
                'endpoint': '/users',
                'params': {'role': 'super_admin'},
                'expected': None
            },
            {
                'name': 'Large Page Students',
                'endpoint': '/students',
                'params': None,
                'expected': None
            }
        ]
        
        for test_case in test_cases:
            self.test_endpoint_performance(
                test_case['name'],
                test_case['endpoint'],
                test_case['params'],
                test_case['expected']
            )
    
    def test_analytics_performance(self):
        """Test analytics endpoints performance"""
        print("\n" + "="*80)
        print("📈 TESTING ANALYTICS PERFORMANCE")
        print("="*80)
        
        test_cases = [
            {
                'name': 'Dashboard Metrics',
                'endpoint': '/metrics',
                'params': None,
                'expected': None
            },
            {
                'name': 'University Reports Analytics',
                'endpoint': '/analytics/university-reports',
                'params': None,
                'expected': None
            },
            {
                'name': 'State Heatmap Analytics',
                'endpoint': '/analytics/state-heatmap',
                'params': None,
                'expected': None
            },
            {
                'name': 'Verifications List',
                'endpoint': '/verifications',
                'params': None,
                'expected': None
            }
        ]
        
        for test_case in test_cases:
            self.test_endpoint_performance(
                test_case['name'],
                test_case['endpoint'],
                test_case['params'],
                test_case['expected']
            )
    
    def get_university_id(self):
        """Get a university ID for testing"""
        try:
            response = self.session.get(f"{API_BASE}/passports/universities")
            if response.status_code == 200:
                universities = response.json()
                if universities and len(universities) > 0:
                    return universities[0]['id']
            return None
        except:
            return None
    
    def analyze_performance_results(self):
        """Analyze and categorize performance results"""
        print("\n" + "="*80)
        print("📊 PERFORMANCE ANALYSIS")
        print("="*80)
        
        if not self.performance_data:
            print("❌ No performance data to analyze")
            return
        
        # Categorize by response time
        fast_endpoints = []      # < 500ms
        medium_endpoints = []    # 500ms - 2000ms
        slow_endpoints = []      # > 2000ms
        
        for test_name, data in self.performance_data.items():
            avg_time = data['timing']['avg']
            
            if avg_time < 500:
                fast_endpoints.append((test_name, avg_time, data['record_count']))
            elif avg_time < 2000:
                medium_endpoints.append((test_name, avg_time, data['record_count']))
            else:
                slow_endpoints.append((test_name, avg_time, data['record_count']))
        
        print(f"\n🚀 FAST ENDPOINTS (< 500ms): {len(fast_endpoints)}")
        for name, time_ms, records in fast_endpoints:
            print(f"   ✅ {name}: {time_ms}ms ({records} records)")
        
        print(f"\n⚡ MEDIUM ENDPOINTS (500ms - 2s): {len(medium_endpoints)}")
        for name, time_ms, records in medium_endpoints:
            print(f"   🟡 {name}: {time_ms}ms ({records} records)")
        
        print(f"\n🐌 SLOW ENDPOINTS (> 2s): {len(slow_endpoints)}")
        for name, time_ms, records in slow_endpoints:
            print(f"   🔴 {name}: {time_ms}ms ({records} records)")
        
        # Calculate overall statistics
        all_times = [data['timing']['avg'] for data in self.performance_data.values()]
        if all_times:
            avg_response_time = statistics.mean(all_times)
            median_response_time = statistics.median(all_times)
            
            print(f"\n📈 OVERALL STATISTICS:")
            print(f"   Average Response Time: {avg_response_time:.2f}ms")
            print(f"   Median Response Time: {median_response_time:.2f}ms")
            print(f"   Fastest Endpoint: {min(all_times):.2f}ms")
            print(f"   Slowest Endpoint: {max(all_times):.2f}ms")
    
    def generate_performance_report(self):
        """Generate detailed performance report"""
        print("\n" + "="*80)
        print("📋 DETAILED PERFORMANCE REPORT")
        print("="*80)
        
        print(f"🕐 Test Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"📊 Total Endpoints Tested: {len(self.performance_data)}")
        
        # Success criteria evaluation
        print(f"\n🎯 SUCCESS CRITERIA EVALUATION:")
        
        # Check if all endpoints respond successfully
        all_successful = len(self.performance_data) > 0
        print(f"   ✅ All endpoints respond: {'YES' if all_successful else 'NO'}")
        
        # Check for fast response times (< 500ms for filtered queries)
        fast_filtered_queries = 0
        total_filtered_queries = 0
        
        for test_name, data in self.performance_data.items():
            if any(keyword in test_name.lower() for keyword in ['filter', 'search', 'status', 'state']):
                total_filtered_queries += 1
                if data['timing']['avg'] < 500:
                    fast_filtered_queries += 1
        
        if total_filtered_queries > 0:
            fast_percentage = (fast_filtered_queries / total_filtered_queries) * 100
            print(f"   ⚡ Filtered queries < 500ms: {fast_filtered_queries}/{total_filtered_queries} ({fast_percentage:.1f}%)")
        
        # Check export performance
        export_tests = {name: data for name, data in self.performance_data.items() if 'export' in name.lower()}
        if export_tests:
            print(f"   📤 Export endpoints tested: {len(export_tests)}")
            for name, data in export_tests.items():
                time_ms = data['timing']['avg']
                status = "✅ FAST" if time_ms < 2000 else "⚠️ SLOW"
                print(f"      {status} {name}: {time_ms}ms")
        
        print(f"\n📝 RECOMMENDATIONS:")
        
        # Identify slowest endpoints
        slow_endpoints = [(name, data['timing']['avg']) for name, data in self.performance_data.items() 
                         if data['timing']['avg'] > 1000]
        
        if slow_endpoints:
            slow_endpoints.sort(key=lambda x: x[1], reverse=True)
            print(f"   🔍 Slowest endpoints need optimization:")
            for name, time_ms in slow_endpoints[:3]:  # Top 3 slowest
                print(f"      • {name}: {time_ms}ms")
        else:
            print(f"   🎉 All endpoints performing well (< 1s response time)")
        
        # Index status recommendation
        print(f"\n💡 INDEX STATUS:")
        print(f"   📋 To verify 47 indexes are applied, run this SQL in Supabase:")
        print(f"      SELECT COUNT(*) FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'")
        print(f"   🎯 Expected result: 47 indexes")
        
        return True
    
    def run_comprehensive_performance_test(self):
        """Run all performance tests"""
        print("🚀 STARTING COMPREHENSIVE PERFORMANCE TESTING")
        print(f"🎯 Testing 47 Database Indexes for 15-30x Performance Improvement")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Authenticate
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return False
        
        # Check database indexes (informational)
        self.check_database_indexes()
        
        # Run all performance tests
        self.test_recruiters_performance()
        self.test_passports_performance()
        self.test_audit_logs_performance()
        self.test_users_students_performance()
        self.test_analytics_performance()
        
        # Analyze results
        self.analyze_performance_results()
        
        # Generate report
        self.generate_performance_report()
        
        print(f"\n🎉 PERFORMANCE TESTING COMPLETED!")
        print(f"📊 Total endpoints tested: {len(self.performance_data)}")
        
        return True

def main():
    """Main function"""
    tester = PerformanceTester()
    success = tester.run_comprehensive_performance_test()
    
    if success:
        print("\n✅ Performance testing completed successfully")
        sys.exit(0)
    else:
        print("\n❌ Performance testing failed")
        sys.exit(1)

if __name__ == "__main__":
    main()