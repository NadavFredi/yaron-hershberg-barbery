#!/bin/bash

set -e  # Exit on error

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Migration Process${NC}"
echo ""

# Load .env.local file
ENV_FILE="$PROJECT_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Error: .env.local file not found at $ENV_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}📖 Loading environment variables from .env.local${NC}"
# Export variables from .env.local (skip comments and empty lines)
set -a
source "$ENV_FILE"
set +a

# Check required variables
if [ -z "$VITE_SUPABASE_URL" ]; then
  echo -e "${RED}❌ Error: VITE_SUPABASE_URL not found in .env.local${NC}"
  exit 1
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}❌ Error: VITE_SUPABASE_ANON_KEY not found in .env.local${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo "  Supabase URL: $VITE_SUPABASE_URL"
echo ""

# Change to migrations directory
cd "$SCRIPT_DIR"

# Step 1: Prepare migration data
echo -e "${BLUE}📊 Step 1: Preparing migration data...${NC}"
if [ ! -f "clients.xlsx" ]; then
  echo -e "${RED}❌ Error: clients.xlsx not found in $SCRIPT_DIR${NC}"
  exit 1
fi

node prepare-migration.js

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error: Failed to prepare migration data${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Migration data prepared${NC}"
echo ""

# Step 2: Check for batches
BATCHES_DIR="$SCRIPT_DIR/batches"
if [ ! -d "$BATCHES_DIR" ]; then
  echo -e "${RED}❌ Error: Batches directory not found${NC}"
  exit 1
fi

# Get auth token
AUTH_TOKEN="$MIGRATION_AUTH_TOKEN"
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  MIGRATION_AUTH_TOKEN not set${NC}"
  echo -e "${YELLOW}   The migration may fail if RLS is enabled${NC}"
  echo -e "${YELLOW}   You can set it with: export MIGRATION_AUTH_TOKEN='your-token'${NC}"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 3: Test with sample batch first
SAMPLE_BATCH="$BATCHES_DIR/sample-batch.json"
if [ -f "$SAMPLE_BATCH" ]; then
  echo -e "${BLUE}🧪 Step 2: Testing with sample batch...${NC}"
  
  node run-migration.js "$SAMPLE_BATCH" "$VITE_SUPABASE_URL" "$VITE_SUPABASE_ANON_KEY"
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Sample batch failed. Please fix errors before proceeding.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Sample batch completed successfully${NC}"
  echo ""
  read -p "Proceed with full migration? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
  fi
  echo ""
fi

# Step 4: Run client batches
CLIENT_BATCHES=($(ls "$BATCHES_DIR"/clients-batch-*.json 2>/dev/null | sort -V))
if [ ${#CLIENT_BATCHES[@]} -gt 0 ]; then
  echo -e "${BLUE}👥 Step 3: Migrating clients (${#CLIENT_BATCHES[@]} batches)...${NC}"
  
  CLIENT_COUNT=0
  CLIENT_ERRORS=0
  
  for batch_file in "${CLIENT_BATCHES[@]}"; do
    CLIENT_COUNT=$((CLIENT_COUNT + 1))
    echo -e "${BLUE}[$CLIENT_COUNT/${#CLIENT_BATCHES[@]}] Processing $(basename "$batch_file")...${NC}"
    
    if node run-migration.js "$batch_file" "$VITE_SUPABASE_URL" "$VITE_SUPABASE_ANON_KEY"; then
      echo -e "${GREEN}✅ Completed $(basename "$batch_file")${NC}"
    else
      echo -e "${RED}❌ Failed $(basename "$batch_file")${NC}"
      CLIENT_ERRORS=$((CLIENT_ERRORS + 1))
    fi
    
    # Small delay between batches
    if [ $CLIENT_COUNT -lt ${#CLIENT_BATCHES[@]} ]; then
      sleep 1
    fi
  done
  
  echo -e "${GREEN}✅ Client migration completed ($CLIENT_COUNT batches, $CLIENT_ERRORS errors)${NC}"
  echo ""
else
  echo -e "${YELLOW}⚠️  No client batches found${NC}"
fi

# Step 5: Run treatment batches
TREATMENT_BATCHES=($(ls "$BATCHES_DIR"/treatments-batch-*.json 2>/dev/null | sort -V))
if [ ${#TREATMENT_BATCHES[@]} -gt 0 ]; then
  echo -e "${BLUE}💊 Step 4: Migrating treatments (${#TREATMENT_BATCHES[@]} batches)...${NC}"
  
  TREATMENT_COUNT=0
  TREATMENT_ERRORS=0
  
  for batch_file in "${TREATMENT_BATCHES[@]}"; do
    TREATMENT_COUNT=$((TREATMENT_COUNT + 1))
    echo -e "${BLUE}[$TREATMENT_COUNT/${#TREATMENT_BATCHES[@]}] Processing $(basename "$batch_file")...${NC}"
    
    if node run-migration.js "$batch_file" "$VITE_SUPABASE_URL" "$VITE_SUPABASE_ANON_KEY"; then
      echo -e "${GREEN}✅ Completed $(basename "$batch_file")${NC}"
    else
      echo -e "${RED}❌ Failed $(basename "$batch_file")${NC}"
      TREATMENT_ERRORS=$((TREATMENT_ERRORS + 1))
    fi
    
    # Small delay between batches
    if [ $TREATMENT_COUNT -lt ${#TREATMENT_BATCHES[@]} ]; then
      sleep 1
    fi
  done
  
  echo -e "${GREEN}✅ Treatment migration completed ($TREATMENT_COUNT batches, $TREATMENT_ERRORS errors)${NC}"
  echo ""
else
  echo -e "${YELLOW}⚠️  No treatment batches found${NC}"
fi

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Migration Process Completed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  Client batches: ${#CLIENT_BATCHES[@]}"
echo "  Treatment batches: ${#TREATMENT_BATCHES[@]}"
echo "  Client errors: $CLIENT_ERRORS"
echo "  Treatment errors: $TREATMENT_ERRORS"
echo ""
