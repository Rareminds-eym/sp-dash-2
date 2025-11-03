#!/bin/bash
# Migration SQL Display Helper
# This script displays migration SQL for easy copying

echo "================================================================================"
echo "MIGRATION SCRIPT VIEWER"
echo "================================================================================"
echo ""
echo "Select which migration script to view:"
echo ""
echo "1) migration_script_step1_complete_schema.sql (2,234 lines)"
echo "2) migration_script_step2_enhanced_schema.sql (800+ lines)"  
echo "3) alignment_migration.sql (520 lines)"
echo "4) View all files info"
echo "5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
  1)
    echo ""
    echo "================================================================================"
    echo "STEP 1: COMPLETE SCHEMA MIGRATION"
    echo "================================================================================"
    echo ""
    echo "File: /app/database/migration_script_step1_complete_schema.sql"
    echo "Size: $(wc -l /app/database/migration_script_step1_complete_schema.sql | awk '{print $1}') lines"
    echo ""
    echo "Press ENTER to display content (Ctrl+C to cancel)..."
    read
    cat /app/database/migration_script_step1_complete_schema.sql
    ;;
  2)
    echo ""
    echo "================================================================================"
    echo "STEP 2: ENHANCED SCHEMA MIGRATION"
    echo "================================================================================"
    echo ""
    echo "File: /app/database/migration_script_step2_enhanced_schema.sql"
    echo "Size: $(wc -l /app/database/migration_script_step2_enhanced_schema.sql | awk '{print $1}') lines"
    echo ""
    echo "Press ENTER to display content (Ctrl+C to cancel)..."
    read
    cat /app/database/migration_script_step2_enhanced_schema.sql
    ;;
  3)
    echo ""
    echo "================================================================================"
    echo "ALIGNMENT MIGRATION (Column Additions)"
    echo "================================================================================"
    echo ""
    echo "File: /app/database/alignment_migration.sql"
    echo "Size: $(wc -l /app/database/alignment_migration.sql | awk '{print $1}') lines"
    echo ""
    echo "Press ENTER to display content (Ctrl+C to cancel)..."
    read
    cat /app/database/alignment_migration.sql
    ;;
  4)
    echo ""
    echo "================================================================================"
    echo "ALL MIGRATION FILES INFO"
    echo "================================================================================"
    echo ""
    ls -lh /app/database/*.sql
    echo ""
    echo "To view a specific file, use:"
    echo "  cat /app/database/[filename]"
    echo ""
    echo "To copy to clipboard (if you have xclip):"
    echo "  cat /app/database/[filename] | xclip -selection clipboard"
    ;;
  5)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo "Invalid choice"
    ;;
esac
