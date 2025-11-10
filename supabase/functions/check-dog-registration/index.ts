import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

interface AirtableConfig {
  AIRTABLE_PAT: string
  AIRTABLE_BASE_ID: string
}

// Get Airtable configuration from environment variables
function getAirtableConfig(): AirtableConfig {
  const AIRTABLE_PAT = Deno.env.get("AIRTABLE_PAT")
  const AIRTABLE_BASE_ID = Deno.env.get("AIRTABLE_BASE_ID")

  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    throw new Error("Missing Airtable configuration")
  }

  return { AIRTABLE_PAT, AIRTABLE_BASE_ID }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed. Use POST.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      )
    }

    const body = await req.json()
    const { dogId } = body

    if (!dogId) {
      throw new Error("dogId parameter is required")
    }

    const config = getAirtableConfig()
    const result = await checkDogRegistration(dogId, config)

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

// Check if dog is already registered
async function checkDogRegistration(dogId: string, config: AirtableConfig) {
  try {
    // Mock response for now - always return true
    // Later this will check the actual Airtable data
    return {
      isRegistered: true,
      registrationDate: "2025-01-15",
      dogId: dogId,
    }
  } catch (error) {
    throw new Error(`Failed to check dog registration: ${error.message}`)
  }
}
