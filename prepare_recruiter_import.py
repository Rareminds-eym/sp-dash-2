import pandas as pd
import json
import uuid
import re

# Read the Excel file
df = pd.read_excel('recruiter_data.xlsx')

# Calculate completeness
df['completeness_percent'] = ((df.notna().sum(axis=1) / len(df.columns)) * 100).round(2)

# Get 100% complete records
complete_df = df[df['completeness_percent'] == 100].copy()
complete_df = complete_df.drop('completeness_percent', axis=1)

print(f"Found {len(complete_df)} complete recruiter records")

# Clean and prepare data
def clean_text(text):
    if pd.isna(text):
        return ""
    return str(text).strip()

def clean_email(email):
    email = clean_text(email)
    # Extract first email if multiple
    emails = re.findall(r'[\w\.-]+@[\w\.-]+', email)
    return emails[0].lower() if emails else email.lower()

def clean_phone(phone):
    phone = clean_text(phone)
    # Remove all non-numeric characters except |
    phone = re.sub(r'[^\d|]', '', phone)
    return phone

def clean_website(website):
    website = clean_text(website)
    if not website.startswith('http'):
        website = 'https://' + website
    return website

# Prepare recruiter organizations for database
recruiters = []
for idx, row in complete_df.iterrows():
    org_id = str(uuid.uuid4())
    email = clean_email(row['Mail ID'])
    company_name = clean_text(row['Company Name'])
    
    recruiter = {
        'id': org_id,
        'name': company_name,
        'type': 'recruiter',
        'email': email,
        'phone': clean_phone(row['Number']),
        'website': clean_website(row['Website']),
        'address': clean_text(row['Address']),
        'city': clean_text(row['Location']),
        'state': '',  # Not provided in data
        'country': 'India',
        'companyType': clean_text(row['Company type']),
        'isActive': True,
        'metadata': {
            'source': 'excel_import',
            'original_s_no': int(row['S.No ']),
            'import_date': '2025-01-14'
        }
    }
    recruiters.append(recruiter)

# Save to JSON
with open('recruiters_for_import.json', 'w') as f:
    json.dump(recruiters, f, indent=2)

print(f"Saved {len(recruiters)} recruiters to: recruiters_for_import.json")

# Create auth users data
auth_users = []
for rec in recruiters:
    # Generate password from company name
    password = 'Recruit@2025'  # Default password for all
    
    auth_user = {
        'email': rec['email'],
        'password': password,
        'name': rec['name'],
        'role': 'recruiter',
        'organizationId': rec['id']
    }
    auth_users.append(auth_user)

with open('recruiter_auth_users.json', 'w') as f:
    json.dump(auth_users, f, indent=2)

print(f"Saved {len(auth_users)} auth users to: recruiter_auth_users.json")

# Create summary with statistics
summary = {
    'total_records': len(complete_df),
    'unique_emails': len(complete_df['Mail ID'].unique()),
    'locations': complete_df['Location'].value_counts().to_dict(),
    'company_types': complete_df['Company type'].str.strip().value_counts().to_dict(),
    'sample_recruiters': recruiters[:5]
}

with open('import_summary.json', 'w') as f:
    json.dump(summary, f, indent=2, default=str)

print("\nImport Summary:")
print(f"  Total recruiters: {summary['total_records']}")
print(f"  Unique emails: {summary['unique_emails']}")
print(f"  Top locations: {list(summary['locations'].items())[:5]}")
print(f"  Company types: {list(summary['company_types'].items())[:5]}")
print("\nAll data prepared for import!")
