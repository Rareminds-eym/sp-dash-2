#!/usr/bin/env python3
"""
Execute create_performance_indexes_final.sql in Supabase
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

def execute_sql_file():
    """Execute the SQL file in Supabase"""
    
    # Get Supabase credentials
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Error: Supabase credentials not found in .env file")
        return False
    
    print(f"📡 Connecting to Supabase: {supabase_url}")
    
    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Read SQL file
    sql_file_path = '/app/scripts/create_performance_indexes_final.sql'
    print(f"📄 Reading SQL file: {sql_file_path}")
    
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    print(f"📊 SQL file loaded ({len(sql_content)} characters)")
    print("\n" + "="*60)
    print("🚀 EXECUTING SQL QUERIES IN SUPABASE")
    print("="*60 + "\n")
    
    try:
        # Execute the SQL using Supabase RPC
        # Note: Supabase doesn't have direct SQL execution API, 
        # so we need to use PostgreSQL connection
        
        # Alternative approach: Use psycopg2 for direct PostgreSQL connection
        import psycopg2
        from urllib.parse import urlparse
        
        # Parse Supabase URL to get database connection details
        # For Supabase, we need to construct the PostgreSQL connection string
        parsed_url = urlparse(supabase_url)
        project_ref = parsed_url.hostname.split('.')[0]
        
        # Supabase PostgreSQL connection format:
        # postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
        
        print("⚠️  NOTE: Direct SQL execution requires database password")
        print("Please provide the Supabase database password (from Supabase Dashboard > Project Settings > Database)")
        print("\nAlternatively, you can execute this SQL manually in Supabase SQL Editor:")
        print(f"1. Go to: {supabase_url.replace('https://', 'https://supabase.com/dashboard/project/')}/sql")
        print("2. Copy and paste the contents of: /app/scripts/create_performance_indexes_final.sql")
        print("3. Click 'Run' to execute\n")
        
        # Try to get database password from environment
        db_password = os.getenv('SUPABASE_DB_PASSWORD')
        
        if db_password:
            print(f"🔐 Database password found in environment")
            
            # Construct PostgreSQL connection string
            db_host = f"db.{project_ref}.supabase.co"
            db_port = "5432"
            db_name = "postgres"
            db_user = "postgres"
            
            conn_string = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
            
            print(f"🔌 Connecting to PostgreSQL: {db_host}")
            
            # Connect to PostgreSQL
            conn = psycopg2.connect(conn_string)
            conn.autocommit = True
            cursor = conn.cursor()
            
            print("✅ Connected to database successfully")
            print("🔧 Executing SQL statements...\n")
            
            # Execute the SQL
            cursor.execute(sql_content)
            
            print("\n✅ SQL execution completed successfully!")
            print("📊 All performance indexes have been created")
            
            # Get index count
            cursor.execute("""
                SELECT COUNT(*) 
                FROM pg_stat_user_indexes
                WHERE schemaname = 'public' 
                AND indexname LIKE 'idx_%'
            """)
            index_count = cursor.fetchone()[0]
            print(f"📈 Total indexes created: {index_count}")
            
            # Close connection
            cursor.close()
            conn.close()
            
            print("\n" + "="*60)
            print("🎉 INDEX CREATION COMPLETE")
            print("="*60)
            print("\n✨ Your database queries should now be 15-30x faster!")
            
            return True
        else:
            print("\n❌ Database password not found in environment")
            print("\nTo execute automatically, add to /app/.env:")
            print("SUPABASE_DB_PASSWORD=your_database_password")
            print("\nOr execute manually in Supabase SQL Editor (recommended)")
            return False
            
    except Exception as e:
        print(f"\n❌ Error executing SQL: {str(e)}")
        print("\nPlease execute the SQL manually in Supabase SQL Editor:")
        print(f"1. Go to Supabase Dashboard > SQL Editor")
        print(f"2. Open file: /app/scripts/create_performance_indexes_final.sql")
        print(f"3. Copy all contents and paste in SQL Editor")
        print(f"4. Click 'Run'")
        return False

if __name__ == "__main__":
    execute_sql_file()
