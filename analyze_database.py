#!/usr/bin/env python3
"""
Comprehensive Supabase Database Structure Analysis Script
Analyzes tables, columns, indexes, triggers, functions, constraints, and more
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection string
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD")

# Extract project ref from URL
project_ref = SUPABASE_URL.split("//")[1].split(".")[0]
DB_CONNECTION = f"postgresql://postgres:{SUPABASE_PASSWORD}@db.{project_ref}.supabase.co:5432/postgres"

def execute_query(query):
    """Execute a SQL query and return results"""
    try:
        conn = psycopg2.connect(DB_CONNECTION)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Error executing query: {e}")
        return []

def analyze_database():
    """Comprehensive database structure analysis"""
    
    print("=" * 80)
    print("SUPABASE DATABASE STRUCTURE ANALYSIS")
    print("=" * 80)
    print()
    
    # Get all tables
    tables_query = """
        SELECT 
            table_name,
            table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """
    
    tables_result = supabase.rpc('exec_sql', {'query': tables_query}).execute()
    
    if tables_result.data:
        tables = tables_result.data
        print(f"📊 TOTAL TABLES: {len(tables)}")
        print("-" * 80)
        
        for table in tables:
            table_name = table['table_name']
            print(f"\n🔷 TABLE: {table_name}")
            print("=" * 80)
            
            # Get columns for this table
            columns_query = f"""
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                AND table_name = '{table_name}'
                ORDER BY ordinal_position;
            """
            
            columns_result = supabase.rpc('exec_sql', {'query': columns_query}).execute()
            
            if columns_result.data:
                print("\n  📝 COLUMNS:")
                for col in columns_result.data:
                    null_str = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                    default_str = f", DEFAULT: {col['column_default']}" if col['column_default'] else ""
                    length_str = f"({col['character_maximum_length']})" if col['character_maximum_length'] else ""
                    print(f"    • {col['column_name']}: {col['data_type']}{length_str} {null_str}{default_str}")
            
            # Get indexes for this table
            indexes_query = f"""
                SELECT 
                    i.relname as index_name,
                    a.attname as column_name,
                    ix.indisunique as is_unique,
                    ix.indisprimary as is_primary,
                    am.amname as index_type
                FROM pg_class t
                JOIN pg_index ix ON t.oid = ix.indrelid
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                JOIN pg_am am ON i.relam = am.oid
                WHERE t.relkind = 'r'
                AND t.relname = '{table_name}'
                AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                ORDER BY i.relname, a.attnum;
            """
            
            indexes_result = supabase.rpc('exec_sql', {'query': indexes_query}).execute()
            
            if indexes_result.data:
                print("\n  🔑 INDEXES:")
                current_index = None
                for idx in indexes_result.data:
                    if idx['index_name'] != current_index:
                        index_type_str = "UNIQUE " if idx['is_unique'] else ""
                        primary_str = "PRIMARY KEY " if idx['is_primary'] else ""
                        print(f"    • {idx['index_name']} ({primary_str}{index_type_str}{idx['index_type']})")
                        current_index = idx['index_name']
                    print(f"        - {idx['column_name']}")
            
            # Get foreign keys for this table
            fk_query = f"""
                SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    rc.delete_rule,
                    rc.update_rule
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                JOIN information_schema.referential_constraints AS rc
                    ON rc.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = '{table_name}'
                AND tc.table_schema = 'public';
            """
            
            fk_result = supabase.rpc('exec_sql', {'query': fk_query}).execute()
            
            if fk_result.data:
                print("\n  🔗 FOREIGN KEYS:")
                for fk in fk_result.data:
                    print(f"    • {fk['constraint_name']}")
                    print(f"        {fk['column_name']} -> {fk['foreign_table_name']}.{fk['foreign_column_name']}")
                    print(f"        ON DELETE: {fk['delete_rule']}, ON UPDATE: {fk['update_rule']}")
            
            # Get unique constraints
            unique_query = f"""
                SELECT
                    tc.constraint_name,
                    kcu.column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'UNIQUE'
                AND tc.table_name = '{table_name}'
                AND tc.table_schema = 'public';
            """
            
            unique_result = supabase.rpc('exec_sql', {'query': unique_query}).execute()
            
            if unique_result.data:
                print("\n  ✨ UNIQUE CONSTRAINTS:")
                for uniq in unique_result.data:
                    print(f"    • {uniq['constraint_name']} on {uniq['column_name']}")
            
            # Get check constraints
            check_query = f"""
                SELECT
                    con.conname as constraint_name,
                    pg_get_constraintdef(con.oid) as constraint_definition
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace nsp ON nsp.oid = connamespace
                WHERE nsp.nspname = 'public'
                AND rel.relname = '{table_name}'
                AND con.contype = 'c';
            """
            
            check_result = supabase.rpc('exec_sql', {'query': check_query}).execute()
            
            if check_result.data:
                print("\n  ✅ CHECK CONSTRAINTS:")
                for chk in check_result.data:
                    print(f"    • {chk['constraint_name']}: {chk['constraint_definition']}")
            
            print()
    
    # Get all triggers
    print("\n" + "=" * 80)
    print("🎯 DATABASE TRIGGERS")
    print("=" * 80)
    
    triggers_query = """
        SELECT 
            trigger_name,
            event_manipulation,
            event_object_table,
            action_statement,
            action_timing,
            action_orientation
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name;
    """
    
    triggers_result = supabase.rpc('exec_sql', {'query': triggers_query}).execute()
    
    if triggers_result.data:
        print(f"\nTotal Triggers: {len(triggers_result.data)}\n")
        current_table = None
        for trg in triggers_result.data:
            if trg['event_object_table'] != current_table:
                print(f"\n📋 Table: {trg['event_object_table']}")
                current_table = trg['event_object_table']
            
            print(f"  • {trg['trigger_name']}")
            print(f"      Timing: {trg['action_timing']} {trg['event_manipulation']}")
            print(f"      Action: {trg['action_statement'][:100]}...")
    else:
        print("No triggers found")
    
    # Get all functions
    print("\n" + "=" * 80)
    print("⚙️  DATABASE FUNCTIONS")
    print("=" * 80)
    
    functions_query = """
        SELECT 
            routine_name,
            routine_type,
            data_type as return_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        ORDER BY routine_name;
    """
    
    functions_result = supabase.rpc('exec_sql', {'query': functions_query}).execute()
    
    if functions_result.data:
        print(f"\nTotal Functions: {len(functions_result.data)}\n")
        for func in functions_result.data:
            print(f"  • {func['routine_name']} -> {func['return_type']}")
    else:
        print("No functions found")
    
    # Get all views
    print("\n" + "=" * 80)
    print("👁️  DATABASE VIEWS")
    print("=" * 80)
    
    views_query = """
        SELECT 
            table_name,
            view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """
    
    views_result = supabase.rpc('exec_sql', {'query': views_query}).execute()
    
    if views_result.data:
        print(f"\nTotal Views: {len(views_result.data)}\n")
        for view in views_result.data:
            print(f"  • {view['table_name']}")
    else:
        print("No views found")
    
    # Get all sequences
    print("\n" + "=" * 80)
    print("🔢 DATABASE SEQUENCES")
    print("=" * 80)
    
    sequences_query = """
        SELECT 
            sequence_name,
            data_type,
            start_value,
            minimum_value,
            maximum_value,
            increment
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
        ORDER BY sequence_name;
    """
    
    sequences_result = supabase.rpc('exec_sql', {'query': sequences_query}).execute()
    
    if sequences_result.data:
        print(f"\nTotal Sequences: {len(sequences_result.data)}\n")
        for seq in sequences_result.data:
            print(f"  • {seq['sequence_name']}: {seq['data_type']} (start: {seq['start_value']}, increment: {seq['increment']})")
    else:
        print("No sequences found")
    
    print("\n" + "=" * 80)
    print("ANALYSIS COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    try:
        analyze_database()
    except Exception as e:
        print(f"❌ Error analyzing database: {e}")
        import traceback
        traceback.print_exc()
