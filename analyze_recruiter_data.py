import pandas as pd
import json

# Read the Excel file
df = pd.read_excel('recruiter_data.xlsx')

print("=" * 80)
print("FILE STRUCTURE ANALYSIS")
print("=" * 80)
print(f"\nTotal records: {len(df)}")
print(f"\nColumn names ({len(df.columns)} columns):")
print(df.columns.tolist())

print("\n" + "=" * 80)
print("DATA TYPES")
print("=" * 80)
print(df.dtypes)

print("\n" + "=" * 80)
print("DATA COMPLETENESS ANALYSIS")
print("=" * 80)
print("\nMissing values per column:")
print(df.isnull().sum())

print("\n" + "=" * 80)
print("SAMPLE DATA (First 5 records)")
print("=" * 80)
print(df.head(5).to_string())

# Calculate completeness percentage for each record
df['completeness_percent'] = ((df.notna().sum(axis=1) / len(df.columns)) * 100).round(2)

print("\n" + "=" * 80)
print("COMPLETENESS STATISTICS")
print("=" * 80)
print(f"Average completeness: {df['completeness_percent'].mean():.2f}%")
print(f"Records with 100% data: {len(df[df['completeness_percent'] == 100])}")
print(f"Records with >= 90% data: {len(df[df['completeness_percent'] >= 90])}")
print(f"Records with >= 80% data: {len(df[df['completeness_percent'] >= 80])}")

# Get records with 100% complete data
complete_records = df[df['completeness_percent'] == 100]
print(f"\n{len(complete_records)} records have 100% complete data")

# Save complete records to JSON for inspection
if len(complete_records) > 0:
    # Convert to dict, handling NaN values
    complete_data = complete_records.drop('completeness_percent', axis=1).head(10).to_dict('records')
    with open('complete_recruiters_sample.json', 'w') as f:
        json.dump(complete_data, f, indent=2, default=str)
    print("Sample of complete records saved to: complete_recruiters_sample.json")

# Also get records with high completeness (>=90%)
high_complete = df[df['completeness_percent'] >= 90]
print(f"\n{len(high_complete)} records have >= 90% complete data")

# Save summary
with open('recruiter_data_summary.txt', 'w') as f:
    f.write(f"Total records: {len(df)}\n")
    f.write(f"Total columns: {len(df.columns)}\n")
    f.write(f"Records with 100% data: {len(complete_records)}\n")
    f.write(f"Records with >= 90% data: {len(high_complete)}\n")
    f.write(f"\nColumns:\n")
    for col in df.columns:
        f.write(f"  - {col}: {df[col].notna().sum()} non-null ({(df[col].notna().sum()/len(df)*100):.1f}%)\n")

print("\nSummary saved to: recruiter_data_summary.txt")
