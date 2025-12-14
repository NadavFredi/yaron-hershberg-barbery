# Client Migration Guide

This guide explains how to migrate client and treatment data from the old system to the new Supabase system.

## Overview

The migration process involves:

1. **Preparing the data** - Converting Excel file to JSON batches
2. **Running the migration** - Sending batches to the edge function
3. **Verifying results** - Checking that data was migrated correctly

## Step 1: Prepare Migration Data

First, prepare the data by converting the Excel file to JSON batches:

```bash
cd tmp/migrations
node prepare-migration.js
```

This will:

- Read `clients.xlsx`
- Convert Excel dates to ISO format
- Normalize phone numbers and genders
- Split data into batches (100 clients per batch, 1000 treatments per batch)
- Save batches to `tmp/migrations/batches/`
- Create a sample batch for testing

## Step 2: Test with Sample Batch

Before running the full migration, test with a small sample:

```bash
# Make sure you have a valid auth token
export MIGRATION_AUTH_TOKEN="your-user-jwt-token-here"

# For local development
node run-migration.js batches/sample-batch.json

# For production
node run-migration.js batches/sample-batch.json https://your-project.supabase.co your-anon-key
```

## Step 3: Run Full Migration

Once you've verified the sample batch works:

```bash
# Run all client batches
for file in batches/clients-batch-*.json; do
  echo "Processing $file..."
  node run-migration.js "$file"
  sleep 2  # Small delay between batches
done

# Run all treatment batches
for file in batches/treatments-batch-*.json; do
  echo "Processing $file..."
  node run-migration.js "$file"
  sleep 2
done
```

## Getting an Auth Token

You need a valid JWT token from a logged-in manager user. You can get this from:

- Browser DevTools: Application > Local Storage > supabase.auth.token
- Or log in through your app and extract the token

For local development, you can use the service role key, but for production, use a real user token.

## What the Migration Does

### For Clients:

1. Checks if client already exists (by `external_id` or phone)
2. Creates auth user with phone number
3. Creates/finds customer_type by name
4. Creates/finds lead_source by name
5. Creates customer record with:
   - Full name, phone, email
   - Gender, date of birth
   - Customer type, lead source
   - External ID (CustomerID from old system)
   - is_banned flag
   - City, notes
6. Creates profile record

### For Treatments:

1. Finds customer by external_id
2. Creates/finds service by treatment name
3. Finds worker by name (in profiles table)
4. Creates payment record with:
   - Customer ID
   - Amount (price)
   - Date (from treatment date)
   - Status: "paid"
   - Method: "cash"
   - Metadata: treatment name, worker name, service ID

## Error Handling

The migration will:

- Skip clients that already exist (by phone or external_id)
- Continue processing even if individual items fail
- Return a summary with created counts and error messages
- Log all errors for debugging

## Data Mapping

### Client Fields:

- `שם ושם משפחה` → `full_name`
- `טלפון נייד` / `טלפון` → `phone`
- `דוא"ל` → `email`
- `סיווג לקוח` → `customer_type` (name)
- `מין` → `gender` (normalized: זכר→male, נקבה→female)
- `תאריך לידה` → `date_of_birth`
- `מקור הגעה` → `lead_source` (name)
- `CustomerID` → `external_id`
- `isBlockedMarketingMessages` → `is_banned`
- `עיר` → `city`
- `הערות כרטיס לקוח` → `notes`

### Treatment Fields:

- `CustomerId` → `customer_external_id` (to find customer)
- `ת. עריכת חשבון` → `treatment_date` (Excel date converted)
- `טיפול` → `treatment_name` (creates/finds service)
- `שם המטפל` → `worker_name` (finds worker)
- `מ.מעודכן` → `price` (amount in payment)

## Notes

- Phone numbers are normalized (Israeli format: 972XXXXXXXXX)
- Excel dates are converted from serial numbers to ISO dates
- Customer types and lead sources are created if they don't exist
- Workers must already exist in the profiles table (they won't be auto-created)
- Services are created if they don't exist
- All historical payments are marked as "paid" with method "cash"

## Troubleshooting

**Error: "Customer already exists"**

- The migration skips existing customers. This is normal if re-running.

**Error: "Worker not found"**

- Workers need to exist in the profiles table first. Create them manually or through the app.

**Error: "Invalid phone number"**

- Check the phone format in the Excel file. Should be Israeli format (10 digits starting with 0).

**Error: "Unauthorized"**

- Make sure you have a valid auth token. Check that the user has manager role.
