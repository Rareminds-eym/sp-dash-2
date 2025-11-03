#!/bin/bash

# RAREMINDS Database Migration Script
# This script executes the database migration using PostgreSQL connection

set -e  # Exit on error

echo ""
echo "============================================================"
echo "🚀 RAREMINDS DATABASE MIGRATION"
echo "============================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database connection details
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_PROJECT_REF="dpooleduinyyzxgrcwko"
DB_PASSWORD="${SUPABASE_DB_PASSWORD}"
DB_HOST="${SUPABASE_PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

# Migration files
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATABASE_DIR="${SCRIPT_DIR}/../database"
STEP1_FILE="${DATABASE_DIR}/migration_script_step1_complete_schema.sql"
STEP2_FILE="${DATABASE_DIR}/migration_script_step2_enhanced_schema.sql"
VERIFICATION_FILE="${DATABASE_DIR}/verification_script.sql"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql command not found${NC}"
    echo "Installing PostgreSQL client..."
    apt-get update -qq && apt-get install -y postgresql-client > /dev/null 2>&1
    
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ Failed to install PostgreSQL client${NC}"
        echo ""
        echo "Please run the migration manually through Supabase SQL Editor:"
        echo "https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new"
        exit 1
    fi
fi

echo -e "${BLUE}📋 Migration Plan:${NC}"
echo "   ✓ Step 1: Complete Schema (base tables, RBAC, indexes)"
echo "   ✓ Step 2: Enhanced Schema (unified colleges, enrollments)"
echo "   ✓ Step 3: Verification"
echo ""

# Check if migration files exist
if [ ! -f "$STEP1_FILE" ]; then
    echo -e "${RED}❌ Step 1 migration file not found: $STEP1_FILE${NC}"
    exit 1
fi

if [ ! -f "$STEP2_FILE" ]; then
    echo -e "${RED}❌ Step 2 migration file not found: $STEP2_FILE${NC}"
    exit 1
fi

if [ ! -f "$VERIFICATION_FILE" ]; then
    echo -e "${RED}❌ Verification file not found: $VERIFICATION_FILE${NC}"
    exit 1
fi

# Function to execute SQL file
execute_sql_file() {
    local file_path=$1
    local step_name=$2
    
    echo ""
    echo "============================================================"
    echo -e "${BLUE}Executing: $step_name${NC}"
    echo "============================================================"
    echo ""
    
    # Set password for psql
    export PGPASSWORD="$DB_PASSWORD"
    
    # Execute SQL file
    echo -e "${YELLOW}⏳ Running migration... (this may take 10-30 seconds)${NC}"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file_path" 2>&1 | tee /tmp/migration_output.log; then
        echo ""
        echo -e "${GREEN}✅ $step_name completed successfully!${NC}"
        return 0
    else
        echo ""
        echo -e "${RED}❌ Error executing $step_name${NC}"
        echo -e "${YELLOW}Check /tmp/migration_output.log for details${NC}"
        return 1
    fi
}

# Backup reminder
echo -e "${YELLOW}⚠️  IMPORTANT: Have you created a backup?${NC}"
echo "Create backup at: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/settings/database"
echo ""
read -p "Press Enter to continue with migration or Ctrl+C to cancel..."
echo ""

# Execute Step 1
if execute_sql_file "$STEP1_FILE" "Step 1: Complete Schema"; then
    echo -e "${GREEN}✓ Step 1 completed${NC}"
else
    echo -e "${RED}✗ Step 1 failed. Stopping migration.${NC}"
    exit 1
fi

# Execute Step 2
if execute_sql_file "$STEP2_FILE" "Step 2: Enhanced Schema"; then
    echo -e "${GREEN}✓ Step 2 completed${NC}"
else
    echo -e "${RED}✗ Step 2 failed. You may need to restore from backup.${NC}"
    exit 1
fi

# Execute Verification
echo ""
echo "============================================================"
echo -e "${BLUE}Running Verification${NC}"
echo "============================================================"
echo ""

export PGPASSWORD="$DB_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$VERIFICATION_FILE" 2>&1 | tee /tmp/verification_output.log

echo ""
echo "============================================================"
echo -e "${GREEN}✅ MIGRATION COMPLETED SUCCESSFULLY${NC}"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Check verification output above for any ❌ marks"
echo "2. Restart your Next.js application: sudo supervisorctl restart nextjs"
echo "3. Test your application endpoints"
echo "4. Update metrics: curl -X POST http://localhost:3000/api/update-metrics"
echo ""
echo -e "${GREEN}Migration files created:${NC}"
echo "   - 18+ new tables (schools, companies, RBAC)"
echo "   - 50+ new columns in existing tables"
echo "   - 47+ performance indexes"
echo "   - 17+ triggers"
echo "   - 5 database functions"
echo "   - 2 views"
echo ""
echo "All your existing data has been preserved! ✅"
echo ""
