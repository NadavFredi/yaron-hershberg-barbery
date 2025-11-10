// Test script for Airtable integration
// Run this with: npm run test:airtable

import { listAllTables } from "../integrations/airtable/client"
import { validateEnv } from "../lib/env"

async function testAirtable() {
  console.log("🧪 Testing Airtable Integration...")
  console.log("=".repeat(50))

  // Validate environment variables
  const isValid = validateEnv()
  if (!isValid) {
    console.error("❌ Environment validation failed!")
    console.error("Please check your .env file and ensure all required variables are set.")
    return
  }

  console.log("✅ Environment variables are properly configured")

  try {
    // Test listing all tables
    await listAllTables()
    console.log("🎉 Airtable integration test completed successfully!")
  } catch (error) {
    console.error("❌ Airtable integration test failed:", error)
  }
}

// Run the test immediately
testAirtable()

export { testAirtable }
