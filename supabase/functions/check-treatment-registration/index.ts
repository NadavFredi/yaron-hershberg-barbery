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
    const { treatmentId } = body

    if (!treatmentId) {
      throw new Error("treatmentId parameter is required")
    }

    const config = getAirtableConfig()
    const result = await checkTreatmentRegistration(treatmentId, config)

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

// Check if treatment is already registered
async function checkTreatmentRegistration(treatmentId: string, config: AirtableConfig) {
  try {
    // Mock response for now - always return true
    // Later this will check the actual Airtable data
    return {
      isRegistered: true,
      registrationDate: "2025-01-15",
      treatmentId: treatmentId,
    }
  } catch (error) {
    throw new Error(`Failed to check treatment registration: ${error.message}`)
  }
}
