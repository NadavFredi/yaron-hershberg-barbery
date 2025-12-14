#!/bin/bash

# Script to restore backup files to remote Supabase database
# Usage: ./scripts/restore-remote-db.sh [backup_directory] [db_url]
# Example: ./scripts/restore-remote-db.sh backups/backup_20251202_144231 "postgresql://postgres:password@host:5432/postgres"
# If no directory is provided, uses the latest backup directory

set -e

# Load environment variables from .env.local if it exists (same approach as backup-db.sh)
if [ -f .env.local ]; then
    echo "📄 Loading environment variables from .env.local..."
    # Export variables from .env.local (ignoring comments and empty lines)
    # This handles KEY=value format, including values with spaces (if quoted)
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        
        # Trim whitespace
        line=$(echo "$line" | xargs)
        
        # Export if line contains = sign (KEY=value format)
        if [[ "$line" == *"="* ]]; then
            # Use eval for proper handling of quoted values, but only for KEY=value lines
            if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
                eval "export $line" 2>/dev/null || true
            fi
        fi
    done < .env.local
fi

# Determine backup directory
if [ -z "$1" ] || [[ "$1" == postgresql://* ]]; then
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

# Get database connection parameters
# Priority: 1) Individual env vars (DB_HOST, DB_USER, DB_PASSWORD), 2) SUPABASE_DB_URL, 3) Command line arg
if [ -n "${DB_HOST}" ] && [ -n "${DB_USER}" ] && [ -n "${DB_PASSWORD}" ]; then
    # Use individual environment variables
    echo "📝 Using individual database connection variables from environment"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-postgres}"
elif [ -n "$2" ]; then
    REMOTE_DB_URL="$2"
    echo "📝 Parsing database URL from command line argument"
elif [[ "$1" == postgresql://* ]]; then
    # First argument is actually the database URL
    REMOTE_DB_URL="$1"
    echo "📝 Parsing database URL from command line argument"
elif [ -n "${SUPABASE_DB_URL}" ]; then
    REMOTE_DB_URL="${SUPABASE_DB_URL}"
    echo "📝 Parsing SUPABASE_DB_URL from environment"
else
    echo "❌ Error: Database connection information is required"
    echo ""
    echo "Usage: ./scripts/restore-remote-db.sh [backup_directory] [db_url]"
    echo ""
    echo "Options:"
    echo "   1. Set individual variables in .env.local:"
    echo "      DB_HOST=hostname"
    echo "      DB_USER=username"
    echo "      DB_PASSWORD=password"
    echo "      DB_PORT=5432 (optional, defaults to 5432)"
    echo "      DB_NAME=postgres (optional, defaults to postgres)"
    echo ""
    echo "   2. Set SUPABASE_DB_URL in .env.local"
    echo ""
    echo "   3. Provide db_url as command line argument"
    echo ""
    echo "Example: ./scripts/restore-remote-db.sh backups/backup_20251202_144231 \"postgresql://postgres:password@host:5432/postgres\""
    exit 1
fi

# If we have a connection URL, parse it to extract parameters
if [ -n "${REMOTE_DB_URL}" ]; then
    # Parse connection string to extract connection parameters
    # Handles both standard format: postgresql://user:password@host:port/database
    # And Supabase pooler format: postgresql://user:password@pooler_id@host:port/database
    if [[ "${REMOTE_DB_URL}" == postgresql://* ]]; then
        # Remove postgresql:// prefix
        CONN_STR="${REMOTE_DB_URL#postgresql://}"
        
        # Check if this is Supabase pooler format (has two @ symbols)
        AT_COUNT=$(echo "${CONN_STR}" | tr -cd '@' | wc -c | tr -d ' ')
        
        if [[ "${AT_COUNT}" == "2" ]]; then
            # Supabase pooler format: user:password@pooler_id@host:port/database
            # Extract user:password (before first @)
            CREDENTIALS="${CONN_STR%%@*}"
            REMAINDER="${CONN_STR#*@}"
            # Extract pooler_id (between first and second @) - we ignore this
            POOLER_ID="${REMAINDER%%@*}"
            CONN_INFO="${REMAINDER#*@}"
        elif [[ "${AT_COUNT}" == "1" ]]; then
            # Standard format: user:password@host:port/database
            CREDENTIALS="${CONN_STR%%@*}"
            CONN_INFO="${CONN_STR#*@}"
        else
            echo "❌ Error: Invalid database URL format (expected 1 or 2 @ symbols)"
            exit 1
        fi
        
        # Extract user and password from credentials
        if [[ "${CREDENTIALS}" == *":"* ]]; then
            DB_USER="${CREDENTIALS%%:*}"
            DB_PASSWORD="${CREDENTIALS#*:}"
        else
            DB_USER="${CREDENTIALS}"
            DB_PASSWORD=""
        fi
        
        # Extract host:port/database
        if [[ "${CONN_INFO}" == *"/"* ]]; then
            HOST_PORT="${CONN_INFO%%/*}"
            DB_NAME="${CONN_INFO#*/}"
            # If database name is empty, default to postgres
            if [ -z "${DB_NAME}" ]; then
                DB_NAME="postgres"
            fi
        else
            HOST_PORT="${CONN_INFO}"
            DB_NAME="postgres"
        fi
        
        # Extract host and port
        if [[ "${HOST_PORT}" == *":"* ]]; then
            DB_HOST="${HOST_PORT%%:*}"
            DB_PORT="${HOST_PORT#*:}"
        else
            DB_HOST="${HOST_PORT}"
            DB_PORT="5432"
        fi
    else
        echo "❌ Error: Database URL must be in postgresql:// format"
        exit 1
    fi
fi

# Build psql connection parameters
PSQL_PARAMS="-h ${DB_HOST} -p ${DB_PORT} -d ${DB_NAME} -U ${DB_USER}"

# Set password as environment variable for psql
if [ -n "${DB_PASSWORD}" ]; then
    export PGPASSWORD="${DB_PASSWORD}"
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

echo "🔄 Preparing to restore backup to REMOTE database..."
echo "   Backup directory: ${BACKUP_DIR}"
echo "   Target: ${DB_HOST}:${DB_PORT}/${DB_NAME} (user: ${DB_USER})"
echo ""
echo "⚠️  WARNING: This will overwrite data in your REMOTE database!"
echo "   Make sure you have a backup of your remote database if needed."
echo ""

read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "❌ Restore cancelled."
    exit 0
fi

echo ""
echo "🔍 Connecting to REMOTE database..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql (PostgreSQL client) not found."
    echo "   Please install PostgreSQL client:"
    echo "   On macOS: brew install postgresql"
    exit 1
fi

# Test connection
echo "   Testing connection..."
if ! psql ${PSQL_PARAMS} -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ❌ Failed to connect to remote database"
    echo "   Please check your database URL and credentials"
    exit 1
fi

echo "   ✅ Remote database connection ready"
echo ""

# Clean remote database - drop and recreate public and supabase_migrations schemas
# Note: auth schema is managed by Supabase, so we'll only truncate auth tables, not drop the schema
echo "🧹 Step 0/4: Cleaning remote database (dropping existing schemas)..."
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
-- Truncate auth tables (don't drop auth schema as it's managed by Supabase)
TRUNCATE TABLE IF EXISTS auth.users CASCADE;
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

if echo "${CLEANUP_SQL}" | psql ${PSQL_PARAMS} > /dev/null 2>&1; then
    echo "   ✅ Remote database cleaned (public schema dropped and recreated)"
else
    echo "   ❌ Failed to clean database"
    echo "   Showing error output:"
    echo "${CLEANUP_SQL}" | psql ${PSQL_PARAMS} 2>&1 | tail -20
    exit 1
fi

echo ""

# Restore roles
if [ -f "${ROLES_FILE}" ]; then
    echo "⏳ Step 1/4: Restoring roles..."
    if psql ${PSQL_PARAMS} -f "${ROLES_FILE}" > /dev/null 2>&1; then
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
    if psql ${PSQL_PARAMS} -f "${SCHEMA_FILE}" > /dev/null 2>&1; then
        echo "   ✅ Schema restored"
    else
        echo "   ❌ Schema restore failed"
        echo "   Showing error output:"
        psql ${PSQL_PARAMS} -f "${SCHEMA_FILE}" 2>&1 | tail -20
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
    if psql ${PSQL_PARAMS} -f "${DATA_FILE}" > /dev/null 2>&1; then
        echo "   ✅ Data restored"
        if [ "${AUTH_DATA_EXISTS}" != "0" ]; then
            USER_COUNT=$(psql ${PSQL_PARAMS} -t -c "SELECT COUNT(*) FROM auth.users;" 2>/dev/null | xargs || echo "0")
            echo "   👥 Restored ${USER_COUNT} user(s) from auth.users"
        fi
    else
        echo "   ❌ Data restore failed"
        echo "   Showing error output:"
        psql ${PSQL_PARAMS} -f "${DATA_FILE}" 2>&1 | tail -20
        exit 1
    fi
else
    echo "   ⏭️  Skipping data (file not found)"
fi

echo ""

# Migration tracking is now included in the backup, so it should be restored automatically
# But let's verify it was restored correctly
echo "⏳ Step 4/4: Verifying migration tracking..."
MIGRATION_COUNT=$(psql ${PSQL_PARAMS} -t -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "${MIGRATION_COUNT}" != "0" ] && [ "${MIGRATION_COUNT}" != "" ]; then
    # Get the last applied migration (by version, not by date)
    LAST_MIGRATION=$(psql ${PSQL_PARAMS} -t -c "SELECT version || ' - ' || name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;" 2>/dev/null | xargs || echo "")
    
    # Get the highest version number from tracking table
    LAST_VERSION=$(psql ${PSQL_PARAMS} -t -c "SELECT MAX(version) FROM supabase_migrations.schema_migrations;" 2>/dev/null | xargs || echo "")
    
    echo "   ✅ Migration tracking restored (${MIGRATION_COUNT} migrations marked as applied)"
    if [ -n "${LAST_MIGRATION}" ]; then
        echo "   📌 Current last migration applied on remote Supabase is: ${LAST_MIGRATION}"
    fi
else
    echo "   ⚠️  Migration tracking not found in backup (this is OK for old backups)"
    echo "   ℹ️  You may need to run migrations manually if needed"
fi

echo ""
echo "✅ Restore completed successfully!"
echo "   Your remote database has been restored from: ${BACKUP_DIR}"
echo ""
