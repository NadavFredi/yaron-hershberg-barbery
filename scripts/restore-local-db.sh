#!/bin/bash

# Script to restore backup files to local Supabase database
# Usage: ./scripts/restore-local-db.sh [backup_directory]
# Example: ./scripts/restore-local-db.sh backups/backup_20241118_143025
# If no directory is provided, uses the latest backup directory

set -e

# Local Supabase database connection (hardcoded - safe for local only)
LOCAL_DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Determine backup directory
if [ -z "$1" ]; then
    # Find the latest backup directory
    if [ ! -d "backups" ]; then
        echo "❌ Error: backups directory not found"
        echo "   Please run ./scripts/backup-db.sh first to create a backup"
        exit 1
    fi
    
    LATEST_BACKUP=$(ls -td backups/backup_* 2>/dev/null | head -n 1)
    
    if [ -z "${LATEST_BACKUP}" ]; then
        echo "❌ Error: No backup directories found in backups/"
        echo "   Please run ./scripts/backup-db.sh first to create a backup"
        exit 1
    fi
    
    BACKUP_DIR="${LATEST_BACKUP}"
    echo "📁 Using latest backup: ${BACKUP_DIR}"
else
    BACKUP_DIR="$1"
fi

# Check if backup directory exists
if [ ! -d "${BACKUP_DIR}" ]; then
    echo "❌ Error: Backup directory not found: ${BACKUP_DIR}"
    exit 1
fi

# Check if required files exist
ROLES_FILE="${BACKUP_DIR}/roles.sql"
SCHEMA_FILE="${BACKUP_DIR}/schema.sql"
DATA_FILE="${BACKUP_DIR}/data.sql"

MISSING_FILES=()

if [ ! -f "${ROLES_FILE}" ]; then
    MISSING_FILES+=("roles.sql")
fi

if [ ! -f "${SCHEMA_FILE}" ]; then
    MISSING_FILES+=("schema.sql")
fi

if [ ! -f "${DATA_FILE}" ]; then
    MISSING_FILES+=("data.sql")
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "❌ Error: Missing required files in ${BACKUP_DIR}:"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - ${file}"
    done
    exit 1
fi

echo "🔄 Preparing to restore backup to LOCAL database only..."
echo "   Backup directory: ${BACKUP_DIR}"
echo "   Target: LOCAL database (localhost:54322)"
echo ""
echo "⚠️  WARNING: This will overwrite data in your LOCAL database ONLY!"
echo "   This script will NOT affect your remote/production database."
echo "   Make sure you have a backup of your local database if needed."
echo ""

read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "❌ Restore cancelled."
    exit 0
fi

echo ""
echo "🔍 Connecting to LOCAL database..."

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

# Display the connection (but hide password)
DB_URL_DISPLAY=$(echo "${LOCAL_DB_URL}" | sed 's/:[^:@]*@/:***@/')
echo "   Connecting to: ${DB_URL_DISPLAY}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql (PostgreSQL client) not found."
    echo "   Please install PostgreSQL client:"
    echo "   On macOS: brew install postgresql"
    exit 1
fi

echo "✅ LOCAL database connection ready (remote database will NOT be affected)"
echo ""

# Clean local database - drop and recreate public and supabase_migrations schemas
# Note: auth schema is managed by Supabase, so we'll only truncate auth tables, not drop the schema
echo "🧹 Step 0/4: Cleaning local database (dropping existing schemas)..."
echo "   This will DROP all existing tables, views, and data in both public and supabase_migrations schemas"
echo "   Auth schema tables will be truncated (schema structure preserved)"
echo ""

CLEANUP_SQL="
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA supabase_migrations;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA supabase_migrations TO postgres;
-- Delete all auth users first (more reliable than truncate in some edge cases)
-- This ensures we start from scratch
DELETE FROM auth.users;
-- Truncate other auth tables (don't drop auth schema as it's managed by Supabase)
TRUNCATE TABLE IF EXISTS auth.identities CASCADE;
TRUNCATE TABLE IF EXISTS auth.sessions CASCADE;
TRUNCATE TABLE IF EXISTS auth.refresh_tokens CASCADE;
TRUNCATE TABLE IF EXISTS auth.audit_log_entries CASCADE;
TRUNCATE TABLE IF EXISTS auth.flow_state CASCADE;
TRUNCATE TABLE IF EXISTS auth.saml_providers CASCADE;
TRUNCATE TABLE IF EXISTS auth.saml_relay_states CASCADE;
TRUNCATE TABLE IF EXISTS auth.sso_providers CASCADE;
TRUNCATE TABLE IF EXISTS auth.sso_domains CASCADE;
"

if echo "${CLEANUP_SQL}" | psql "${LOCAL_DB_URL}" > /dev/null 2>&1; then
    echo "   ✅ Local database cleaned (public schema dropped and recreated)"
    # Verify auth.users is empty before proceeding
    USER_COUNT=$(psql "${LOCAL_DB_URL}" -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | xargs || echo "-1")
    if [ "${USER_COUNT}" != "0" ] && [ "${USER_COUNT}" != "" ]; then
        echo "   ⚠️  Warning: auth.users still contains ${USER_COUNT} user(s) after cleanup"
        echo "   🔧 Attempting to force delete remaining users..."
        psql "${LOCAL_DB_URL}" -c "DELETE FROM auth.users;" > /dev/null 2>&1
        USER_COUNT_AFTER=$(psql "${LOCAL_DB_URL}" -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | xargs || echo "-1")
        if [ "${USER_COUNT_AFTER}" != "0" ] && [ "${USER_COUNT_AFTER}" != "" ]; then
            echo "   ❌ Failed to clear auth.users - ${USER_COUNT_AFTER} user(s) still remain"
            echo "   This may cause duplicate key errors during restore"
        else
            echo "   ✅ Successfully cleared all auth users"
        fi
    fi
else
    echo "   ❌ Failed to clean database"
    echo "   Showing error output:"
    echo "${CLEANUP_SQL}" | psql "${LOCAL_DB_URL}" 2>&1 | tail -20
    exit 1
fi

echo ""

# Restore roles
if [ -f "${ROLES_FILE}" ]; then
    echo "⏳ Step 1/4: Restoring roles..."
    if psql "${LOCAL_DB_URL}" -f "${ROLES_FILE}" > /dev/null 2>&1; then
        echo "   ✅ Roles restored"
    else
        echo "   ⚠️  Roles restore completed with warnings (this is usually OK)"
    fi
else
    echo "   ⏭️  Skipping roles (file not found)"
fi

echo ""

# Restore schema
if [ -f "${SCHEMA_FILE}" ]; then
    echo "⏳ Step 2/4: Restoring schema..."
    if psql "${LOCAL_DB_URL}" -f "${SCHEMA_FILE}" > /dev/null 2>&1; then
        echo "   ✅ Schema restored"
    else
        echo "   ❌ Schema restore failed"
        echo "   Showing error output:"
        psql "${LOCAL_DB_URL}" -f "${SCHEMA_FILE}" 2>&1 | tail -20
        exit 1
    fi
else
    echo "   ❌ Schema file not found - cannot continue without schema"
    exit 1
fi

echo ""

# Restore data
if [ -f "${DATA_FILE}" ]; then
    echo "⏳ Step 3/4: Restoring data (this may take a while)..."
    # Check if auth data exists in backup
    AUTH_DATA_EXISTS=$(grep -c "^COPY auth\." "${DATA_FILE}" 2>/dev/null || echo "0")
    if [ "${AUTH_DATA_EXISTS}" != "0" ]; then
        echo "   📋 Found auth.users data in backup - will restore users"
    fi
    if psql "${LOCAL_DB_URL}" -f "${DATA_FILE}" > /dev/null 2>&1; then
        echo "   ✅ Data restored"
        if [ "${AUTH_DATA_EXISTS}" != "0" ]; then
            USER_COUNT=$(psql "${LOCAL_DB_URL}" -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | xargs || echo "0")
            echo "   👥 Restored ${USER_COUNT} user(s) from auth.users"
        fi
    else
        echo "   ❌ Data restore failed"
        echo "   Showing error output:"
        psql "${LOCAL_DB_URL}" -f "${DATA_FILE}" 2>&1 | tail -20
        exit 1
    fi
else
    echo "   ⏭️  Skipping data (file not found)"
fi

echo ""

# Migration tracking is now included in the backup, so it should be restored automatically
# But let's verify it was restored correctly
echo "⏳ Step 4/4: Verifying migration tracking..."
MIGRATION_COUNT=$(psql "${LOCAL_DB_URL}" -t -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "${MIGRATION_COUNT}" != "0" ] && [ "${MIGRATION_COUNT}" != "" ]; then
    # Get the last applied migration (by version, not by date)
    LAST_MIGRATION=$(psql "${LOCAL_DB_URL}" -t -c "SELECT version || ' - ' || name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | xargs || echo "")
    
    # Get the highest version number from tracking table
    LAST_VERSION=$(psql "${LOCAL_DB_URL}" -t -c "SELECT MAX(version) FROM supabase_migrations.schema_migrations;" 2>/dev/null | xargs || echo "")
    
    echo "   ✅ Migration tracking restored (${MIGRATION_COUNT} migrations marked as applied)"
    if [ -n "${LAST_MIGRATION}" ]; then
        echo "   📌 Current last migration applied on local Supabase is: ${LAST_MIGRATION}"
    fi
    
    # Check for migration files that exist locally but aren't in tracking (and have versions before the last one)
    # These are likely migrations that were applied manually or have incorrect dates
    if [ -n "${LAST_VERSION}" ]; then
        echo "   🔍 Checking for untracked migration files (before ${LAST_VERSION})..."
        UNTRACKED_COUNT=$(ls -1 supabase/migrations/*.sql 2>/dev/null | \
            awk -F'/' '{print $NF}' | \
            awk -F'_' '{print $1}' | \
            awk -v last="${LAST_VERSION}" '$1 < last && $1 != "" {print}' | \
            while read version; do
                psql "${LOCAL_DB_URL}" -t -c "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}';" 2>/dev/null | grep -q "1" || echo "${version}"
            done | wc -l | xargs)
        
        if [ "${UNTRACKED_COUNT}" != "0" ] && [ -n "${UNTRACKED_COUNT}" ]; then
            echo "   ⚠️  Found ${UNTRACKED_COUNT} migration file(s) that exist locally but aren't tracked"
            
            # Try to automatically mark known problematic migrations as applied if their objects exist
            echo "   🔧 Attempting to auto-fix untracked migrations..."
            
            # Check for 20250129000000 and 20260102000000 (expiry_calculation_method migrations)
            # If the enum type exists, mark these migrations as applied
            ENUM_EXISTS=$(psql "${LOCAL_DB_URL}" -t -c "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expiry_calculation_method');" 2>/dev/null | xargs || echo "f")
            
            if [ "${ENUM_EXISTS}" = "t" ]; then
                # Mark these migrations as applied since the enum already exists
                psql "${LOCAL_DB_URL}" -t -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20250129000000', 'add_expiry_calculation_method'), ('20260102000000', 'add_expiry_calculation_method') ON CONFLICT (version) DO NOTHING;" > /dev/null 2>&1
                MARKED=$(psql "${LOCAL_DB_URL}" -t -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20250129000000', '20260102000000');" 2>/dev/null | xargs || echo "0")
                if [ "${MARKED}" = "2" ]; then
                    echo "   ✅ Auto-marked 2 expiry_calculation_method migrations as applied (objects already exist)"
                    UNTRACKED_COUNT=$((UNTRACKED_COUNT - 2))
                fi
            fi
            
            if [ "${UNTRACKED_COUNT}" != "0" ] && [ "${UNTRACKED_COUNT}" != "" ]; then
                echo "   ⚠️  ${UNTRACKED_COUNT} untracked migration(s) remain - they will be attempted when running 'supabase migration up --include-all'"
                echo "   💡 If they fail, they may need to be marked as applied manually or made idempotent"
            else
                echo "   ✅ All untracked migrations have been auto-fixed"
            fi
        fi
    fi
    
    echo "   ℹ️  Supabase knows which migrations are already applied"
else
    echo "   ⚠️  Migration tracking not found in backup (this is OK for old backups)"
    echo "   ℹ️  You may need to run 'supabase migration up --include-all' to apply new migrations"
fi

echo ""

# Fix refresh_tokens sequence to prevent "duplicate key" errors on sign-in
echo "🔧 Fixing auth.refresh_tokens sequence..."
FIX_SEQUENCE_SQL="
-- Reset the refresh_tokens sequence to match the max ID (or 1 if table is empty)
SELECT setval('auth.refresh_tokens_id_seq', COALESCE((SELECT MAX(id) FROM auth.refresh_tokens), 1), true);
"

if echo "${FIX_SEQUENCE_SQL}" | psql "${LOCAL_DB_URL}" > /dev/null 2>&1; then
    echo "   ✅ Refresh tokens sequence reset"
else
    echo "   ⚠️  Warning: Could not reset refresh_tokens sequence (this is usually OK)"
fi

echo ""
echo "✅ Restore completed successfully!"
echo "   Your local database has been restored from: ${BACKUP_DIR}"
echo ""
if [ "${MIGRATION_COUNT}" != "0" ] && [ "${MIGRATION_COUNT}" != "" ]; then
    echo "📝 Migration tracking was restored from backup."
    echo "   Next step: Run 'supabase migration up --include-all' to apply any new migrations"
else
    echo "📝 Migration tracking was not in backup (old backup format)."
    echo "   Next step: Run 'supabase migration up --include-all' to apply migrations"
    echo "   (Idempotent migrations will skip if objects already exist)"
fi
echo ""
