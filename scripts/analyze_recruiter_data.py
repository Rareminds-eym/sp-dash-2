import pandas as pd
import json

# Read the Excel file
file_path = '/tmp/recruiter_data.xlsx'

try:
    # Load Excel file
    xl_file = pd.ExcelFile(file_path)
    
    print("=== SHEET NAMES ===")
    print(json.dumps(xl_file.sheet_names, indent=2))
    print("\n")
    
    # Read the first sheet
    df = pd.read_excel(file_path, sheet_name=xl_file.sheet_names[0])
    
    print("=== COLUMN HEADERS ===")
    print(json.dumps(df.columns.tolist(), indent=2))
    print("\n")
    
    print("=== TOTAL ROWS ===")
    print(f"Total rows: {len(df)}")
    print("\n")
    
    print("=== SAMPLE DATA (first 3 rows) ===")
    print(df.head(3).to_string())
    print("\n")
    
    print("=== DATA TYPES ===")
    print(df.dtypes.to_string())
    print("\n")
    
    print("=== NULL/MISSING VALUES PER COLUMN ===")
    null_counts = df.isnull().sum()
    print(null_counts.to_string())
    print("\n")
    
    print("=== ROWS WITH 100% COMPLETE DATA ===")
    # Count rows with no null values
    complete_rows = df.dropna()
    print(f"Rows with 100% complete data: {len(complete_rows)}")
    print(f"Percentage: {(len(complete_rows)/len(df)*100):.2f}%")
    print("\n")
    
    # Show sample of complete rows
    if len(complete_rows) > 0:
        print("=== SAMPLE OF COMPLETE ROWS (first 2) ===")
        print(complete_rows.head(2).to_string())
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()
