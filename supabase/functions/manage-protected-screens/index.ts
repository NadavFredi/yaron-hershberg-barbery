import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { compare, hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

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

      const passwordHash = await hash(password)

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
        return new Response(JSON.stringify({ error: "Failed to set password" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (body.action === "verify_password") {
      const { password } = body as VerifyPasswordRequest

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

      const isValid = await compare(password, passwordData.password_hash)

      return new Response(JSON.stringify({ valid: isValid }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
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
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
