#!/bin/bash

# Script to restore a LOCAL backup to LOCAL Supabase database
# Usage: ./scripts/restore-local-from-local-db.sh [backup_directory]
# Example: ./scripts/restore-local-from-local-db.sh backups/backup_local_20241118_143025
# If no directory is provided, uses the latest local backup directory

set -e

# Determine backup directory
if [ -z "$1" ]; then
    # Find the latest local backup directory
    if [ ! -d "backups" ]; then
        echo "❌ Error: backups directory not found"
        echo "   Please run ./scripts/backup-local-db.sh first to create a local backup"
        exit 1
    fi
    
    LATEST_BACKUP=$(ls -td backups/backup_local_* 2>/dev/null | head -n 1)
    
    if [ -z "${LATEST_BACKUP}" ]; then
        echo "❌ Error: No local backup directories found in backups/"
        echo "   Please run ./scripts/backup-local-db.sh first to create a local backup"
        exit 1
    fi
    
    BACKUP_DIR="${LATEST_BACKUP}"
    echo "📁 Using latest local backup: ${BACKUP_DIR}"
else
    BACKUP_DIR="$1"
fi

# Check if backup directory exists
if [ ! -d "${BACKUP_DIR}" ]; then
    echo "❌ Error: Backup directory not found: ${BACKUP_DIR}"
    exit 1
fi

echo "🔄 Restoring LOCAL backup to LOCAL database..."
echo "   Local backup: ${BACKUP_DIR}"
echo "   Target: LOCAL database"
echo ""

# Call the restore-local-db.sh script with the backup directory
exec ./scripts/restore-local-db.sh "${BACKUP_DIR}"
