#!/bin/bash

# Script to backup local Supabase database (roles, schema, and data)
# Usage: ./scripts/backup-local-db.sh

set -e

# Check if Supabase is running locally
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Please install it first."
    exit 1
fi

if ! supabase status &> /dev/null; then
    echo "❌ Error: Local Supabase is not running."
    echo "   Please start it first: supabase start"
    exit 1
fi

# Create timestamp for backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/backup_local_${TIMESTAMP}"

echo "📦 Starting LOCAL database backup..."
echo "   Backup directory: ${BACKUP_DIR}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup roles
echo "⏳ Step 1/3: Backing up roles..."
if supabase db dump --local -f "${BACKUP_DIR}/roles.sql" --role-only 2>&1; then
    ROLES_SIZE=$(ls -lh "${BACKUP_DIR}/roles.sql" 2>/dev/null | awk '{print $5}' || echo "0B")
    echo "   ✅ Roles backup completed (${ROLES_SIZE})"
else
    echo "   ⚠️  Roles backup failed"
    exit 1
fi

echo ""

# Backup schema (include public, supabase_migrations, and auth schemas)
echo "⏳ Step 2/3: Backing up schema..."
if supabase db dump --local -f "${BACKUP_DIR}/schema.sql" -s public,supabase_migrations,auth 2>&1; then
    SCHEMA_SIZE=$(ls -lh "${BACKUP_DIR}/schema.sql" 2>/dev/null | awk '{print $5}' || echo "0B")
    SCHEMA_TABLES=$(grep -c "^CREATE TABLE" "${BACKUP_DIR}/schema.sql" 2>/dev/null || echo "0")
    echo "   ✅ Schema backup completed (${SCHEMA_SIZE}, ${SCHEMA_TABLES} tables)"
    echo "   📋 Includes: public schema + supabase_migrations (migration tracking) + auth (users)"
else
    echo "   ⚠️  Schema backup failed"
    exit 1
fi

echo ""

# Backup data (include public, supabase_migrations, and auth schemas)
echo "⏳ Step 3/3: Backing up data..."
if supabase db dump --local -f "${BACKUP_DIR}/data.sql" --data-only --use-copy -s public,supabase_migrations,auth 2>&1; then
    DATA_SIZE=$(ls -lh "${BACKUP_DIR}/data.sql" 2>/dev/null | awk '{print $5}' || echo "0B")
    DATA_COPIES=$(grep -c "^COPY public\." "${BACKUP_DIR}/data.sql" 2>/dev/null || echo "0")
    DATA_INSERTS=$(grep -c "^INSERT INTO public\." "${BACKUP_DIR}/data.sql" 2>/dev/null || echo "0")
    AUTH_COPIES=$(grep -c "^COPY auth\." "${BACKUP_DIR}/data.sql" 2>/dev/null || echo "0")
    echo "   ✅ Data backup completed (${DATA_SIZE}, ${DATA_COPIES} COPY statements for public, ${AUTH_COPIES} for auth, ${DATA_INSERTS} INSERT statements)"
else
    echo "   ⚠️  Data backup failed"
    exit 1
fi

echo ""
echo "✅ All backups completed successfully!"
echo "   Location: ${BACKUP_DIR}/"
echo "   Files:"
echo "     - roles.sql"
echo "     - schema.sql"
echo "     - data.sql"
echo ""
