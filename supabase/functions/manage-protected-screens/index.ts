import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Simple password hashing using Web Crypto API (works in Deno edge runtime)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const passwordData = encoder.encode(password)
  const salt = encoder.encode("protected-screen-salt-v1")

  const keyMaterial = await crypto.subtle.importKey("raw", passwordData, "PBKDF2", false, ["deriveBits", "deriveKey"])

  // Derive bits instead of key, then we can hash it
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  )

  // Hash the derived bits to get a fixed-length output
  const hashBuffer = await crypto.subtle.digest("SHA-256", derivedBits)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SetPasswordRequest {
  action: "set_password"
  password: string
}

interface VerifyPasswordRequest {
  action: "verify_password"
  password: string
}

interface UpdateProtectedScreensRequest {
  action: "update_protected_screens"
  screens: Array<{ screen_id: string; is_protected: boolean }>
}

type RequestBody = SetPasswordRequest | VerifyPasswordRequest | UpdateProtectedScreensRequest

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Verify user is a manager
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || profile?.role !== "manager") {
      return new Response(JSON.stringify({ error: "Only managers can access this" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body: RequestBody = await req.json()

    if (body.action === "set_password") {
      const { password } = body as SetPasswordRequest
      if (!password || password.length < 4) {
        return new Response(JSON.stringify({ error: "Password must be at least 4 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      try {
        const passwordHash = await hashPassword(password)

        // Upsert password hash
        const { error: upsertError } = await supabase.from("manager_protected_screen_passwords").upsert(
          {
            manager_id: user.id,
            password_hash: passwordHash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "manager_id" }
        )

        if (upsertError) {
          console.error("Error setting password:", upsertError)
          return new Response(JSON.stringify({ error: "Failed to set password", details: upsertError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      } catch (hashError) {
        console.error("Error hashing password:", hashError)
        return new Response(
          JSON.stringify({
            error: "Failed to hash password",
            details: hashError instanceof Error ? hashError.message : String(hashError),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    if (body.action === "verify_password") {
      const { password } = body as VerifyPasswordRequest

      try {
        // Get stored password hash
        const { data: passwordData, error: passwordError } = await supabase
          .from("manager_protected_screen_passwords")
          .select("password_hash")
          .eq("manager_id", user.id)
          .single()

        if (passwordError || !passwordData) {
          return new Response(JSON.stringify({ error: "No password set" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }

        const isValid = await verifyPassword(password, passwordData.password_hash)

        return new Response(JSON.stringify({ valid: isValid }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      } catch (compareError) {
        console.error("Error comparing password:", compareError)
        return new Response(
          JSON.stringify({
            error: "Failed to verify password",
            details: compareError instanceof Error ? compareError.message : String(compareError),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    if (body.action === "update_protected_screens") {
      const { screens } = body as UpdateProtectedScreensRequest

      // Delete existing protected screens for this manager
      const { error: deleteError } = await supabase.from("manager_protected_screens").delete().eq("manager_id", user.id)

      if (deleteError) {
        console.error("Error deleting protected screens:", deleteError)
        return new Response(JSON.stringify({ error: "Failed to update protected screens" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Insert new protected screens (only protected ones)
      const protectedScreens = screens.filter((s) => s.is_protected)
      if (protectedScreens.length > 0) {
        const { error: insertError } = await supabase.from("manager_protected_screens").insert(
          protectedScreens.map((s) => ({
            manager_id: user.id,
            screen_id: s.screen_id,
            is_protected: true,
          }))
        )

        if (insertError) {
          console.error("Error inserting protected screens:", insertError)
          return new Response(JSON.stringify({ error: "Failed to update protected screens" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          })
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error in manage-protected-screens:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
