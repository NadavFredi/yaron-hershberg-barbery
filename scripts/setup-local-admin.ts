#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import { execSync } from "child_process"
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const ADMIN_EMAIL = "admin@easyflow.co.il"
const ADMIN_PASSWORD = "AdminPass2024!"
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://localhost:54321"

/**
 * Format error for logging - handles various error types
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "object" && error !== null) {
    // Try to extract message, code, or details from Supabase error objects
    const err = error as Record<string, unknown>
    if (err.message) return String(err.message)
    if (err.code) return `Code: ${err.code}`
    if (err.details) return String(err.details)
    if (err.hint) return `Hint: ${err.hint}`
    // Fallback to JSON stringify for full error details
    try {
      return JSON.stringify(error, null, 2)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

/**
 * Check if Supabase is running locally
 */
async function checkSupabaseRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get Supabase service role key for local development
 * Tries to get it from environment first, then from supabase status
 */
function getServiceRoleKey(): string {
  // Try environment variable first
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("📝 Using SUPABASE_SERVICE_ROLE_KEY from environment")
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  }

  // Try to get it from supabase status
  try {
    console.log("📝 Attempting to get service role key from supabase status...")
    const statusOutput = execSync("supabase status --output json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const status = JSON.parse(statusOutput)
    if (status?.service_role_key) {
      console.log("✅ Found service role key from supabase status")
      return status.service_role_key
    }
  } catch (_error) {
    console.log("⚠️  Could not get service role key from supabase status")
    console.log("   Make sure Supabase is running: supabase start")
  }

  // Default local service role key (this is the standard local dev key)
  // You can also get it by running: supabase status
  console.log("⚠️  Using default local service role key")
  console.log("   If this doesn't work, run 'supabase status' and copy the service_role_key")

  // The default service role key for local Supabase
  // This is typically: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
}

async function setupLocalAdmin() {
  console.log("🚀 Setting up local admin user...")
  console.log("=====================================")

  try {
    const serviceRoleKey = getServiceRoleKey()

    if (!serviceRoleKey) {
      throw new Error(
        "❌ Could not find Supabase service role key.\n" +
          "   Please ensure Supabase is running locally: supabase start\n" +
          "   Or set SUPABASE_SERVICE_ROLE_KEY in your .env.local file"
      )
    }

    // Check if Supabase is running
    console.log(`📡 Checking Supabase connection at: ${SUPABASE_URL}`)
    const isRunning = await checkSupabaseRunning()
    if (!isRunning) {
      throw new Error(
        `❌ Cannot connect to Supabase at ${SUPABASE_URL}\n` +
          "   Please ensure Supabase is running locally:\n" +
          "   Run: supabase start"
      )
    }
    console.log("✅ Supabase is running")

    console.log(`📡 Connecting to Supabase at: ${SUPABASE_URL}`)
    const supabase = createClient(SUPABASE_URL, serviceRoleKey)

    // Check if user already exists
    console.log(`\n🔍 Checking if user ${ADMIN_EMAIL} already exists...`)
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.log("⚠️  Could not check existing users:", formatError(listError))
      console.log("   Continuing with user creation...")
    } else {
      const existingUser = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL)
      if (existingUser) {
        console.log(`✅ User ${ADMIN_EMAIL} already exists (ID: ${existingUser.id})`)

        // Check if profile exists and update role if needed
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", existingUser.id)
          .single()

        if (profileError && profileError.code !== "PGRST116") {
          console.error("❌ Error checking profile:", formatError(profileError))
          throw profileError
        }

        if (profile) {
          if (profile.role === "manager") {
            console.log("✅ User is already set as manager")
            console.log("🎉 Admin user is ready to use!")
            return
          } else {
            console.log("🔄 Updating user role to manager...")
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ role: "manager" })
              .eq("id", existingUser.id)

            if (updateError) {
              console.error("❌ Error updating role:", formatError(updateError))
              throw updateError
            }
            console.log("✅ Role updated to manager")
            console.log("🎉 Admin user is ready to use!")
            return
          }
        } else {
          // Profile doesn't exist, create it
          console.log("📝 Creating profile for existing user...")
          const { error: profileError } = await supabase.from("profiles").insert({
            id: existingUser.id,
            email: ADMIN_EMAIL,
            full_name: "Admin User",
            role: "manager",
          })

          if (profileError) {
            console.error("❌ Error creating profile:", formatError(profileError))
            throw profileError
          }
          console.log("✅ Profile created with manager role")
          console.log("🎉 Admin user is ready to use!")
          return
        }
      }
    }

    // Create the user
    console.log(`\n👤 Creating admin user: ${ADMIN_EMAIL}`)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: "Admin User",
      },
    })

    if (authError) {
      console.error("❌ Error creating user:", formatError(authError))
      console.error("   Full error details:", JSON.stringify(authError, null, 2))
      throw authError
    }

    console.log(`✅ User created successfully (ID: ${authData.user.id})`)

    // Create profile with manager role
    console.log("\n📝 Creating profile with manager role...")
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email: ADMIN_EMAIL,
      full_name: "Admin User",
      role: "manager",
    })

    if (profileError) {
      console.error("❌ Error creating profile:", formatError(profileError))
      console.error("   Full error details:", JSON.stringify(profileError, null, 2))
      // Try to clean up the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    console.log("✅ Profile created successfully with manager role")
    console.log("\n🎉 Admin user setup complete!")
    console.log("=====================================")
    console.log(`📧 Email: ${ADMIN_EMAIL}`)
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`)
    console.log(`👤 Role: Manager (מנהל)`)
    console.log(`🆔 User ID: ${authData.user.id}`)
    console.log("\n💡 You can now log in to the app with these credentials")
  } catch (error) {
    console.error("\n❌ Setup failed:")
    console.error(`   ${formatError(error)}`)
    console.error("\n   Full error details:")
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`)
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`)
      }
    }
    try {
      console.error(`   JSON: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
    } catch {
      console.error(`   Raw: ${String(error)}`)
    }
    process.exit(1)
  }
}

// Run the setup
setupLocalAdmin().catch((error) => {
  console.error("❌ Unhandled error:", formatError(error))
  try {
    console.error("   Full details:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
  } catch {
    console.error("   Raw error:", String(error))
  }
  process.exit(1)
})
