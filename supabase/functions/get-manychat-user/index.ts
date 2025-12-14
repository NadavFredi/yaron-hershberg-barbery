import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { ManyChatClient, type ManyChatSubscriber } from "../_shared/manychat-client.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface PhoneRequest {
  phone: string
  fullName: string
}

type GetManyChatUserRequest = PhoneRequest[]

// All ManyChat operations now use ManyChatClient directly

/**
 * Process a single phone number and get/create ManyChat subscriber
 */
async function processPhoneNumber(
  manychat: ManyChatClient,
  phoneRequest: PhoneRequest
): Promise<{ phone: string; subscriber: ManyChatSubscriber | null; error?: string }> {
  const { phone, fullName } = phoneRequest
  console.log(`📞 [get-manychat-user] Processing phone: ${phone}, name: ${fullName}`)

  // Normalize phone for lookup (remove + and use digits only as key)
  const phoneDigits = phone.replace(/\D/g, "")

  // Validate phone number format
  if (phoneDigits.length < 9) {
    console.warn(`⚠️ [get-manychat-user] Phone number is too short: ${phone}`)
    return {
      phone: phoneDigits,
      subscriber: null,
      error: "Invalid phone number format",
    }
  }

  // Check if phone is a placeholder
  if (phone.startsWith("user-")) {
    console.warn(`⚠️ [get-manychat-user] Phone number is a placeholder: ${phone}`)
    return {
      phone: phoneDigits,
      subscriber: null,
      error: "Phone number is not set",
    }
  }

  try {
    // Use the client's getOrCreateSubscriber method which handles all the logic
    const manychatSubscriber = await manychat.getOrCreateSubscriber(phone, fullName)

    console.log(`✅ [get-manychat-user] Successfully processed phone: ${phone}`)
    return {
      phone: phoneDigits,
      subscriber: manychatSubscriber,
    }
  } catch (error) {
    console.error(`❌ [get-manychat-user] Error processing phone ${phone}:`, error)
    return {
      phone: phoneDigits,
      subscriber: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 [get-manychat-user] Function called with method:", req.method)

    // Get ManyChat client
    let manychat: ManyChatClient
    try {
      manychat = ManyChatClient.fromEnvironment()
    } catch (error) {
      console.error("❌ [get-manychat-user] Missing MANYCHAT_API_KEY environment variable")
      return new Response(JSON.stringify({ success: false, error: "ManyChat API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Parse request - expect array of phone requests
    const phoneRequests: GetManyChatUserRequest = await req.json()
    console.log("📋 [get-manychat-user] Received request with", phoneRequests.length, "phone number(s)")

    if (!Array.isArray(phoneRequests) || phoneRequests.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Request must be an array of objects with 'phone' field (and optional 'fullName' and 'email')",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Validate each request has required fields
    for (const req of phoneRequests) {
      if (!req.phone || typeof req.phone !== "string") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Each request object must have a 'phone' field (string)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
      if (!req.fullName || typeof req.fullName !== "string") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Each request object must have a 'fullName' field (string)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
      // Ignore email if provided - we only use phone for WhatsApp
    }

    // Process all phone numbers in parallel
    console.log(`🔄 [get-manychat-user] Processing ${phoneRequests.length} phone number(s) in parallel...`)
    const results = await Promise.all(phoneRequests.map((phoneRequest) => processPhoneNumber(manychat, phoneRequest)))

    // Build result dictionary: key = phone digits, value = subscriber data or error
    const resultDict: Record<string, ManyChatSubscriber | { error: string }> = {}

    for (const result of results) {
      if (result.subscriber) {
        resultDict[result.phone] = result.subscriber
      } else {
        resultDict[result.phone] = {
          error: result.error || "Unknown error",
        } as { error: string }
      }
    }

    console.log(`✅ [get-manychat-user] Processed ${phoneRequests.length} phone number(s), returning results`)

    return new Response(JSON.stringify(resultDict), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [get-manychat-user] General error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
