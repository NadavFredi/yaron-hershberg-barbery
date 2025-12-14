#!/bin/bash

# Script to restore a dump file to local Supabase database
# Usage: npm run db:restore:local <dump_file_path>
# Example: npm run db:restore:local dumps/remote_db_dump_with_data_20251118_140530.sql

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Please provide a dump file path"
    echo ""
    echo "Usage: npm run db:restore:local <dump_file_path>"
    echo "Example: npm run db:restore:local dumps/remote_db_dump_with_data_20251118_140530.sql"
    echo ""
    echo "Available dump files:"
    ls -lh dumps/*.sql 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}' || echo "   No dump files found in dumps/ directory"
    exit 1
fi

DUMP_FILE="$1"

if [ ! -f "${DUMP_FILE}" ]; then
    echo "❌ Error: Dump file not found: ${DUMP_FILE}"
    exit 1
fi

echo "🔄 Restoring database from dump file to LOCAL database..."
echo "   File: ${DUMP_FILE}"
echo "   Target: Local Supabase (127.0.0.1:54322)"
echo ""
echo "⚠️  WARNING: This will overwrite data in your LOCAL database!"
echo "   Make sure you have a backup if needed."
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "❌ Restore cancelled."
    exit 0
fi

echo ""
echo "🔍 Checking if local Supabase is running..."

# Check if Supabase is running locally
if ! supabase status &>/dev/null; then
    echo "❌ Error: Local Supabase is not running."
    echo "   Please start it with: supabase start"
    exit 1
fi

echo ""
echo "📊 Dump file info:"
FILE_SIZE=$(ls -lh "${DUMP_FILE}" | awk '{print $5}')
COPY_COUNT=$(grep -c "^COPY public\." "${DUMP_FILE}" 2>/dev/null || echo "0")
INSERT_COUNT=$(grep -c "^INSERT INTO public\." "${DUMP_FILE}" 2>/dev/null || echo "0")
TABLE_COUNT=$(grep -c "^CREATE TABLE" "${DUMP_FILE}" 2>/dev/null || echo "0")

echo "   Size: ${FILE_SIZE}"
echo "   Tables: ${TABLE_COUNT}"
echo "   COPY statements: ${COPY_COUNT}"
echo "   INSERT statements: ${INSERT_COUNT}"
echo ""

# Find the Supabase database container
echo "🔍 Finding Supabase database container..."
DB_CONTAINER=$(docker ps --filter "name=supabase.*db" --format "{{.Names}}" | head -1)

if [ -z "${DB_CONTAINER}" ]; then
    echo "❌ Error: Could not find Supabase database container."
    echo "   Make sure Supabase is running: supabase start"
    exit 1
fi

echo "✅ Found database container: ${DB_CONTAINER}"
echo ""

# Test connection first
echo "🔌 Testing database connection..."
if ! docker exec "${DB_CONTAINER}" psql -U postgres -d postgres -c "SELECT 1;" &>/dev/null; then
    echo "❌ Error: Cannot connect to local database."
    echo "   Make sure Supabase is running: supabase start"
    exit 1
fi
echo "✅ Connection successful!"
echo ""

# Restore the dump
echo "📥 Restoring dump file..."
echo "   Using Docker container: ${DB_CONTAINER}"
RESTORE_START=$(date +%s)

# Copy dump file into container and execute it
if docker cp "${DUMP_FILE}" "${DB_CONTAINER}:/tmp/dump.sql" && \
   docker exec "${DB_CONTAINER}" psql -U postgres -d postgres -f /tmp/dump.sql > /tmp/restore_output.log 2>&1 && \
   docker exec "${DB_CONTAINER}" rm -f /tmp/dump.sql; then
    RESTORE_END=$(date +%s)
    RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
    
    echo "✅ Restore completed successfully!"
    echo "   Duration: ${RESTORE_DURATION} seconds"
    echo ""
    
    # Verify the restore
    echo "🔍 Verifying restore..."
    RESTORED_TABLES=$(docker exec "${DB_CONTAINER}" psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | tr -d ' ' || echo "0")
    
    echo "   Tables in database: ${RESTORED_TABLES}"
    
    if [ "${RESTORED_TABLES}" -gt 0 ]; then
        echo "✅ Database verification successful!"
    else
        echo "⚠️  Warning: No tables found after restore. Check the dump file."
    fi
    
    # Show some sample data counts
    echo ""
    echo "📊 Sample table row counts:"
    docker exec "${DB_CONTAINER}" psql -U postgres -d postgres -t -c "
        SELECT 
            schemaname||'.'||tablename as table_name,
            n_live_tup as row_count
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
        LIMIT 5;
    " 2>/dev/null | while read line; do
        if [ ! -z "$line" ]; then
            echo "   $line"
        fi
    done || echo "   (Unable to retrieve row counts)"
    
else
    echo "❌ Restore failed!"
    echo ""
    echo "Error output:"
    tail -20 /tmp/restore_output.log
    echo ""
    echo "Full error log saved to: /tmp/restore_output.log"
    # Clean up temp file in container if it exists
    docker exec "${DB_CONTAINER}" rm -f /tmp/dump.sql 2>/dev/null || true
    exit 1
fi

echo ""
echo "✅ All done! Your local database has been restored from the dump file."
