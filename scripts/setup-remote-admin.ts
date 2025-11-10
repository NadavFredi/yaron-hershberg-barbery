#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js"
import { execSync } from "child_process"
import { config } from "dotenv"
import { resolve } from "path"
import { existsSync, readFileSync } from "fs"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const ADMIN_EMAIL = "maayanbili@gmail.com"
const ADMIN_PASSWORD = "t8r+2+KFiirR.U_"

/**
 * Get Supabase URL and service role key for remote project
 */
function getSupabaseConfig(): { url: string; serviceRoleKey: string } {
  // Try environment variables first
  let url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // If URL not in env, try to get from linked project
  if (!url) {
    try {
      console.log("📝 Attempting to get project ref from linked project...")
      const projectRefFile = resolve(process.cwd(), "supabase", ".temp", "project-ref")
      
      if (existsSync(projectRefFile)) {
        const projectRef = readFileSync(projectRefFile, "utf-8").trim()
        url = `https://${projectRef}.supabase.co`
        console.log(`✅ Found linked project, using URL: ${url}`)
      }
    } catch (_error) {
      console.log("⚠️  Could not get project ref from file")
    }
  }

  if (url && serviceRoleKey) {
    console.log("📝 Using Supabase config:")
    console.log(`   URL: ${url}`)
    console.log(`   Service Role Key: ${serviceRoleKey.substring(0, 20)}...`)
    return { url, serviceRoleKey }
  }

  if (!url) {
    throw new Error(
      "❌ VITE_SUPABASE_URL not found.\n" +
        "   Options:\n" +
        "   1. Set VITE_SUPABASE_URL in your .env.local file\n" +
        "   2. Or link a Supabase project first: supabase link --project-ref YOUR_PROJECT_REF\n" +
        "   Example URL: https://your-project-ref.supabase.co"
    )
  }

  if (!serviceRoleKey) {
    throw new Error(
      "❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables.\n" +
        "   Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file\n" +
        "   You can find it in: Supabase Dashboard > Project Settings > API > service_role key\n" +
        "   URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api"
    )
  }

  return { url, serviceRoleKey }
}

async function setupRemoteAdmin() {
  console.log("🚀 Setting up remote admin user...")
  console.log("=====================================")

  try {
    const { url, serviceRoleKey } = getSupabaseConfig()

    console.log(`📡 Connecting to Supabase at: ${url}`)
    const supabase = createClient(url, serviceRoleKey)

    // Check if user already exists
    console.log(`\n🔍 Checking if user ${ADMIN_EMAIL} already exists...`)
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.log("⚠️  Could not check existing users:", listError.message)
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
          console.error("❌ Error checking profile:", profileError.message)
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
              console.error("❌ Error updating role:", updateError.message)
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
            console.error("❌ Error creating profile:", profileError.message)
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
      console.error("❌ Error creating user:", authError.message)
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
      console.error("❌ Error creating profile:", profileError.message)
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
    if (error instanceof Error) {
      console.error(`   ${error.message}`)
    } else {
      console.error("   Unknown error:", error)
    }
    process.exit(1)
  }
}

// Run the setup
setupRemoteAdmin().catch((error) => {
  console.error("❌ Unhandled error:", error)
  process.exit(1)
})

