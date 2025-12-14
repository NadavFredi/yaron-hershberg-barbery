#!/usr/bin/env node

/**
 * Script to run the migration by sending batches to the edge function
 * 
 * Usage:
 *   node tmp/migrations/run-migration.js <batch-file> [supabase-url] [supabase-anon-key]
 * 
 * Example:
 *   node tmp/migrations/run-migration.js tmp/migrations/batches/sample-batch.json
 */

const fs = require('fs');
const path = require('path');

async function runMigration(batchFile, supabaseUrl, supabaseAnonKey) {
  // Default to local if env vars not set
  const url = supabaseUrl || process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  const anonKey = supabaseAnonKey || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  // Read batch file
  console.log(`📖 Reading batch file: ${batchFile}`);
  const batchContent = fs.readFileSync(batchFile, 'utf8');
  const batch = JSON.parse(batchContent);

  // Check if this is a combined batch or separate
  let migrationBatch;
  if (batch.clients || batch.treatments) {
    // Combined batch
    migrationBatch = {
      clients: batch.clients || [],
      treatments: batch.treatments || [],
    };
  } else if (Array.isArray(batch)) {
    // Assume it's a clients batch (array of clients)
    migrationBatch = {
      clients: batch,
      treatments: [],
    };
  } else {
    console.error('❌ Invalid batch format. Expected { clients: [], treatments: [] } or array of clients');
    process.exit(1);
  }

  console.log(`📊 Batch contains:`);
  console.log(`   - ${migrationBatch.clients.length} clients`);
  console.log(`   - ${migrationBatch.treatments.length} treatments`);

  // Get auth token (you need to be logged in)
  // For now, we'll use the service role or anon key
  // In production, you should get a real user token
  const authToken = process.env.MIGRATION_AUTH_TOKEN;

  if (!authToken) {
    console.warn('⚠️  No MIGRATION_AUTH_TOKEN found. Using anon key (may fail if RLS is enabled)');
    console.warn('   Set MIGRATION_AUTH_TOKEN environment variable with a valid user token');
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Call edge function
  const functionUrl = `${url}/functions/v1/migrate-clients`;
  console.log(`🚀 Calling edge function: ${functionUrl}`);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(migrationBatch),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Migration failed:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log(JSON.stringify(result, null, 2));

    // Show summary
    if (result.results) {
      console.log('\n📊 Summary:');
      console.log(`   Clients created: ${result.results.clients?.created || 0}`);
      console.log(`   Client errors: ${result.results.clients?.errors?.length || 0}`);
      console.log(`   Treatments created: ${result.results.treatments?.created || 0}`);
      console.log(`   Treatment errors: ${result.results.treatments?.errors?.length || 0}`);

      if (result.results.clients?.errors?.length > 0) {
        console.log('\n⚠️  Client errors:');
        result.results.clients.errors.slice(0, 10).forEach(err => {
          console.log(`   - ${err}`);
        });
        if (result.results.clients.errors.length > 10) {
          console.log(`   ... and ${result.results.clients.errors.length - 10} more`);
        }
      }

      if (result.results.treatments?.errors?.length > 0) {
        console.log('\n⚠️  Treatment errors:');
        result.results.treatments.errors.slice(0, 10).forEach(err => {
          console.log(`   - ${err}`);
        });
        if (result.results.treatments.errors.length > 10) {
          console.log(`   ... and ${result.results.treatments.errors.length - 10} more`);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error calling edge function:');
    console.error(error);
    process.exit(1);
  }
}

// Main
const batchFile = process.argv[2];
// Use provided args or fall back to env vars (which may be loaded from .env.local)
const supabaseUrl = process.argv[3] || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.argv[4] || process.env.VITE_SUPABASE_ANON_KEY;

if (!batchFile) {
  console.error('❌ Usage: node tmp/migrations/run-migration.js <batch-file> [supabase-url] [supabase-anon-key]');
  console.error('');
  console.error('Example:');
  console.error('  node tmp/migrations/run-migration.js tmp/migrations/batches/sample-batch.json');
  console.error('');
  console.error('Note: If URL/key not provided, will use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from environment');
  process.exit(1);
}

if (!fs.existsSync(batchFile)) {
  console.error(`❌ Batch file not found: ${batchFile}`);
  process.exit(1);
}

runMigration(batchFile, supabaseUrl, supabaseAnonKey).catch(error => {
  console.error('❌ Unexpected error:');
  console.error(error);
  process.exit(1);
});
