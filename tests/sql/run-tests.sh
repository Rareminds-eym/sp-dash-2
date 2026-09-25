#!/bin/bash
# Test runner for LTE Catalog Publishing SQL integration tests
# Usage: ./run-tests.sh [--with-timeout] [--database-url URL]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
RUN_TIMEOUT_TESTS=false
DATABASE_URL="${LTE_TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --with-timeout)
      RUN_TIMEOUT_TESTS=true
      shift
      ;;
    --database-url)
      DATABASE_URL="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --with-timeout         Include timeout tests (adds ~60 seconds)"
      echo "  --database-url URL     Override database connection string"
      echo "  --help                 Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  LTE_TEST_DATABASE_URL  Default database connection string"
      echo ""
      echo "Examples:"
      echo "  $0                                    # Run main tests only"
      echo "  $0 --with-timeout                     # Run all tests including timeout tests"
      echo "  $0 --database-url postgresql://...    # Use custom database URL"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   LTE Catalog Publishing SQL Integration Tests              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if database URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: Database URL not set${NC}"
  echo "Set LTE_TEST_DATABASE_URL environment variable or use --database-url option"
  exit 1
fi

echo -e "${BLUE}Database:${NC} ${DATABASE_URL%%\?*}" # Hide password in output
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo -e "${RED}Error: psql command not found${NC}"
  echo "Please install PostgreSQL client tools"
  exit 1
fi

# Check database connection
echo -e "${YELLOW}Checking database connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
  echo -e "${RED}Error: Cannot connect to database${NC}"
  echo "Check your database URL and ensure PostgreSQL is running"
  exit 1
fi
echo -e "${GREEN}✓ Database connection OK${NC}"
echo ""

# Check for test user
echo -e "${YELLOW}Checking for test user in auth.users...${NC}"
USER_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM auth.users" 2>/dev/null || echo "0")
if [ "$USER_COUNT" -eq "0" ]; then
  echo -e "${YELLOW}Warning: No users found in auth.users table${NC}"
  echo "Creating test user..."
  psql "$DATABASE_URL" -c "
    INSERT INTO auth.users (id, email, encrypted_password)
    VALUES (
      gen_random_uuid(),
      'test@sql-integration-test.local',
      crypt('test_password', gen_salt('bf'))
    )
    ON CONFLICT DO NOTHING
  " &> /dev/null || echo -e "${RED}Warning: Could not create test user (table may not exist)${NC}"
fi
echo -e "${GREEN}✓ Test prerequisites OK${NC}"
echo ""

# Run main integration tests
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Running Main Integration Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

START_TIME=$(date +%s)

if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/publish_lte_catalog_snapshot_v2_1.test.sql"; then
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  echo ""
  echo -e "${GREEN}✓ Main integration tests PASSED${NC} (${DURATION}s)"
  MAIN_TESTS_PASSED=true
else
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  echo ""
  echo -e "${RED}✗ Main integration tests FAILED${NC} (${DURATION}s)"
  MAIN_TESTS_PASSED=false
fi

echo ""

# Run timeout tests if requested
if [ "$RUN_TIMEOUT_TESTS" = true ]; then
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}Running Timeout Tests${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}Note: These tests use pg_sleep() and will take ~60 seconds${NC}"
  echo ""
  
  START_TIME=$(date +%s)
  
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/publish_lte_catalog_snapshot_timeout.test.sql"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo ""
    echo -e "${GREEN}✓ Timeout tests PASSED${NC} (${DURATION}s)"
    TIMEOUT_TESTS_PASSED=true
  else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo ""
    echo -e "${RED}✗ Timeout tests FAILED${NC} (${DURATION}s)"
    TIMEOUT_TESTS_PASSED=false
  fi
  echo ""
fi

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$MAIN_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✓ Main Integration Tests: PASSED${NC}"
else
  echo -e "${RED}✗ Main Integration Tests: FAILED${NC}"
fi

if [ "$RUN_TIMEOUT_TESTS" = true ]; then
  if [ "$TIMEOUT_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✓ Timeout Tests: PASSED${NC}"
  else
    echo -e "${RED}✗ Timeout Tests: FAILED${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Timeout Tests: SKIPPED${NC} (use --with-timeout to run)"
fi

echo ""

# Exit with appropriate code
if [ "$MAIN_TESTS_PASSED" = true ] && ( [ "$RUN_TIMEOUT_TESTS" = false ] || [ "$TIMEOUT_TESTS_PASSED" = true ] ); then
  echo -e "${GREEN}All tests passed! ✨${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed ✗${NC}"
  exit 1
fi
