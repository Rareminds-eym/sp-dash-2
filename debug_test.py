#!/usr/bin/env python3

import requests
import json

BASE_URL = "https://recruiter-typing-fix.preview.emergentagent.com"

def debug_database_queries():
    """Debug the database queries to understand the issues"""
    
    # Login first
    login_response = requests.post(f'{BASE_URL}/api/auth/login', json={
        'email': 'superadmin@rareminds.in', 
        'password': 'password123'
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return
    
    cookies = login_response.cookies
    
    print("=== DEBUGGING SESSION ENDPOINT ===")
    
    # Test users endpoint to see what data exists
    users_response = requests.get(f'{BASE_URL}/api/users', cookies=cookies)
    if users_response.status_code == 200:
        users = users_response.json()
        print(f"Found {len(users)} users")
        
        # Find the superadmin user
        superadmin = None
        for user in users:
            if user.get('email') == 'superadmin@rareminds.in':
                superadmin = user
                break
        
        if superadmin:
            print("Superadmin user data:")
            print(json.dumps(superadmin, indent=2))
            print(f"Has organizationId: {'organizationId' in superadmin}")
            if 'organizationId' in superadmin:
                print(f"OrganizationId value: {superadmin['organizationId']}")
        else:
            print("❌ Superadmin user not found in users list")
    
    print("\n=== DEBUGGING PASSPORTS ENDPOINT ===")
    
    # Test students endpoint to see what students exist
    students_response = requests.get(f'{BASE_URL}/api/students', cookies=cookies)
    if students_response.status_code == 200:
        students = students_response.json()
        print(f"Found {len(students)} students")
        
        # Check if the student from passport exists
        target_student_id = "11e20b89-7d6b-43e7-b619-ef6c6ba46c08"
        target_student = None
        for student in students:
            if student.get('id') == target_student_id:
                target_student = student
                break
        
        if target_student:
            print(f"Target student found:")
            print(json.dumps(target_student, indent=2))
            print(f"Has userId: {'userId' in target_student}")
            if 'userId' in target_student:
                print(f"UserId value: {target_student['userId']}")
        else:
            print(f"❌ Target student {target_student_id} not found in students list")
            print("Available student IDs:")
            for student in students:
                print(f"  - {student.get('id')}")
    
    # Test passports endpoint again with detailed analysis
    passports_response = requests.get(f'{BASE_URL}/api/passports', cookies=cookies)
    if passports_response.status_code == 200:
        passports = passports_response.json()
        print(f"\nPassports endpoint returned {len(passports)} passports")
        if len(passports) > 0:
            passport = passports[0]
            print("First passport data:")
            print(json.dumps(passport, indent=2))

if __name__ == "__main__":
    debug_database_queries()