#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321"
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "your-anon-key"

async function testSignup() {
  console.log("🧪 Testing Signup Edge Function...")
  console.log("=====================================")

  try {
    // Test data
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: "testpassword123",
      full_name: "Test User",
      phone_number: "0501234567",
    }

    console.log("📝 Test user data:", testUser)

    // Call the signup edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testUser),
    })

    const result = await response.json()
    console.log("📡 Response status:", response.status)
    console.log("📡 Response body:", JSON.stringify(result, null, 2))

    if (response.ok && result.success) {
      console.log("✅ Signup successful!")
      console.log("👤 User ID:", result.user.id)
      console.log("🆔 Client ID:", result.client_id)

      // Verify the user was created in Supabase
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

      // Try to sign in with the created user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      if (signInError) {
        console.log("⚠️  Auto sign-in failed:", signInError.message)
      } else {
        console.log("✅ Auto sign-in successful!")
        console.log("🔑 Session user:", signInData.user?.id)
      }

      // Check if profile was created with client_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", result.user.id)
        .single()

      if (profileError) {
        console.log("❌ Failed to fetch profile:", profileError.message)
      } else {
        console.log("✅ Profile created successfully!")
        console.log("📋 Profile data:", profileData)
      }
    } else {
      console.log("❌ Signup failed:", result.error)
    }
  } catch (error) {
    console.error("💥 Test error:", error)
  }
}

// Run the test
if (import.meta.main) {
  await testSignup()
}
