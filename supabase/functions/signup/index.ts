import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SignupRequest {
  email?: string | null
  password: string
  full_name: string
  phone_number: string
}

function toE164FromDigits(phoneDigits: string): string | null {
  const trimmedDigits = phoneDigits.replace(/\D/g, "")

  if (!trimmedDigits) {
    return null
  }

  if ((trimmedDigits.length === 9 || trimmedDigits.length === 10) && trimmedDigits.startsWith("0")) {
    return `+972${trimmedDigits.slice(1)}`
  }

  if (trimmedDigits.startsWith("972") && trimmedDigits.length >= 11 && trimmedDigits.length <= 13) {
    return `+${trimmedDigits}`
  }

  if (trimmedDigits.length >= 9 && trimmedDigits.length <= 15) {
    return `+${trimmedDigits}`
  }

  return null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("Signup function called with method:", req.method)

    const requestJson: SignupRequest = await req.json()
    const email = requestJson.email?.trim() || null
    const password = requestJson.password
    const full_name = requestJson.full_name
    const phone_number = requestJson.phone_number

    console.log("Received signup request payload:", {
      hasEmail: !!email,
      full_name,
      phone_number,
    })

    // Validate required fields
    if (!password || !full_name || !phone_number) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const digitsOnlyPhone = phone_number.replace(/\D/g, "")

    if (!digitsOnlyPhone) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (digitsOnlyPhone.length < 9 || digitsOnlyPhone.length > 15) {
      return new Response(JSON.stringify({ error: "Phone number must have between 9 and 15 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const phoneE164 = toE164FromDigits(digitsOnlyPhone)

    if (!phoneE164) {
      return new Response(JSON.stringify({ error: "Unable to convert phone to E.164 format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const searchablePhoneDigits =
      digitsOnlyPhone.startsWith("0") && digitsOnlyPhone.length >= 9
        ? `972${digitsOnlyPhone.slice(1)}`
        : digitsOnlyPhone

    console.log("Derived phone formats:", {
      digitsOnlyPhone,
      phoneE164,
      searchablePhoneDigits,
    })

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable")
    }

    if (!supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
          "For local development, this should be automatically available. " +
          "Check your Supabase configuration or set it manually."
      )
    }

    console.log("Using Supabase URL:", supabaseUrl)
    console.log("Service key available:", !!supabaseServiceKey)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Create the user
    console.log("Creating user...")
    const userPayload: Parameters<typeof supabase.auth.admin.createUser>[0] = {
      password,
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: {
        full_name,
        phone_number: digitsOnlyPhone,
        phone_number_digits: digitsOnlyPhone,
        phone_number_search: searchablePhoneDigits,
        phone_number_e164: phoneE164,
      },
    }

    if (email) {
      userPayload.email = email
      userPayload.email_confirm = true
      userPayload.user_metadata = {
        ...userPayload.user_metadata,
        email,
      }
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser(userPayload)

    if (authError) {
      console.error("Auth error:", authError)
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("User created successfully:", authData.user.id)

    // Create profile record using service role (bypasses RLS)
    console.log("Creating profile...")
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name,
        phone_number: digitsOnlyPhone,
        email,
      })
      .select()

    if (profileError) {
      console.error("Profile error:", profileError)
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("Profile created successfully")

    console.log("Signup flow completed successfully without external webhooks")

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("General error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
