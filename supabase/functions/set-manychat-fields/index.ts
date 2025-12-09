import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ManyChatClient } from "../_shared/manychat-client.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SetFieldsByPhone {
  phone: string
  name: string
  fields: Record<string, string> // field_id: value
}

interface SetFieldsBySubscriberId {
  subscriber_id: string
  fields: Record<string, string> // field_id: value
}

type SetManyChatFieldsRequest = (SetFieldsByPhone | SetFieldsBySubscriberId)[]

interface ManyChatSetFieldResponse {
  status: string
}

/**
 * Call get-manychat-user internally to get or create multiple subscribers at once
 */
async function getOrCreateSubscribers(
  phoneRequests: Array<{ phone: string; name: string; key: string }>
): Promise<Record<string, { subscriber_id: string; error?: string }>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable not set")
  }

  if (phoneRequests.length === 0) {
    return {}
  }

  console.log(`🔄 [set-manychat-fields] Calling get-manychat-user for ${phoneRequests.length} phone(s)`)

  try {
    // Create Supabase client with service role key to invoke functions
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Prepare request array for get-manychat-user
    const requestBody = phoneRequests.map((req) => ({
      phone: req.phone.replace(/\D/g, ""), // Normalize to digits only
      fullName: req.name,
    }))

    const { data, error } = await supabase.functions.invoke("get-manychat-user", {
      body: requestBody,
    })

    if (error) {
      throw new Error(`get-manychat-user failed: ${error.message}`)
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response from get-manychat-user")
    }

    // Build result map: key -> { subscriber_id, error? }
    const results: Record<string, { subscriber_id: string; error?: string }> = {}

    for (const phoneReq of phoneRequests) {
      const phoneDigits = phoneReq.phone.replace(/\D/g, "")
      const subscriberData = (data as Record<string, unknown>)[phoneDigits]

      if (!subscriberData || typeof subscriberData !== "object") {
        results[phoneReq.key] = {
          subscriber_id: "",
          error: "Subscriber data not found in response",
        }
        continue
      }

      if ("error" in subscriberData) {
        results[phoneReq.key] = {
          subscriber_id: "",
          error: subscriberData.error as string,
        }
        continue
      }

      // Extract subscriber ID from the subscriber data
      const subscriberId =
        (subscriberData as { id?: string; subscriber_id?: string }).id ||
        (subscriberData as { id?: string; subscriber_id?: string }).subscriber_id

      if (!subscriberId) {
        results[phoneReq.key] = {
          subscriber_id: "",
          error: "Subscriber ID not found in response",
        }
        continue
      }

      results[phoneReq.key] = { subscriber_id: String(subscriberId) }
    }

    return results
  } catch (error) {
    console.error(`❌ [set-manychat-fields] Error calling get-manychat-user:`, error)
    throw error
  }
}

// Removed setManyChatCustomField - now using ManyChatClient directly

/**
 * Set fields for a single subscriber
 * Supports both field_id (numeric) and field_name (string like "dog_name")
 */
async function setFieldsForSubscriber(
  manychat: ManyChatClient,
  subscriberId: string,
  fields: Record<string, string>,
  key: string
): Promise<{ key: string; success: boolean; subscriber_id: string; error?: string }> {
  try {
    // Convert fields object to array format for setMultipleFields
    // Check if field key is numeric (field_id) or string (field_name)
    const fieldsArray = Object.entries(fields).map(([fieldKey, fieldValue]) => {
      // If the key is numeric, it's a field_id
      // If the key is "dog_name" or other string, it's a field_name
      const isNumeric = /^\d+$/.test(fieldKey)
      
      if (isNumeric) {
        return { fieldId: fieldKey, fieldValue }
      } else {
        // String keys like "dog_name" should use field_name
        return { fieldName: fieldKey, fieldValue }
      }
    })

    await manychat.setMultipleFields(subscriberId, fieldsArray)
    
    console.log(
      `✅ [set-manychat-fields] Set ${fieldsArray.length} field(s) for subscriber ${subscriberId}`,
      Object.keys(fields).join(", ")
    )

    return {
      key,
      success: true,
      subscriber_id: subscriberId,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`❌ [set-manychat-fields] Failed to set fields for subscriber ${subscriberId}:`, errorMsg)
    
    return {
      key,
      success: false,
      subscriber_id: subscriberId,
      error: `Failed to set fields: ${errorMsg}`,
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 [set-manychat-fields] Function called with method:", req.method)

    // Get ManyChat client
    let manychat: ManyChatClient
    try {
      manychat = ManyChatClient.fromEnvironment()
    } catch (error) {
      console.error("❌ [set-manychat-fields] Missing MANYCHAT_API_KEY environment variable")
      return new Response(JSON.stringify({ success: false, error: "ManyChat API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Parse request - expect array of field update requests
    const requests: SetManyChatFieldsRequest = await req.json()
    console.log("📋 [set-manychat-fields] Received request with", requests.length, "update(s)")

    if (!Array.isArray(requests) || requests.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Request must be an array of objects with 'phone'+'name'+'fields' or 'subscriber_id'+'fields'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Validate each request
    for (const req of requests) {
      if ("phone" in req) {
        if (!req.phone || typeof req.phone !== "string") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Each phone-based request must have a 'phone' field (string)",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
        if (!req.name || typeof req.name !== "string") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Each phone-based request must have a 'name' field (string)",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
      } else {
        if (!req.subscriber_id || typeof req.subscriber_id !== "string") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Each subscriber_id-based request must have a 'subscriber_id' field (string)",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
      }

      if (!req.fields || typeof req.fields !== "object" || Array.isArray(req.fields)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Each request must have a 'fields' object with field_id: value pairs",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    // Separate requests by type: phone-based vs subscriber_id-based
    const phoneRequests: Array<{ phone: string; name: string; fields: Record<string, string>; key: string }> = []
    const subscriberIdRequests: Array<{ subscriber_id: string; fields: Record<string, string>; key: string }> = []

    for (const request of requests) {
      if ("phone" in request) {
        const phoneDigits = request.phone.replace(/\D/g, "")
        phoneRequests.push({
          phone: request.phone,
          name: request.name,
          fields: request.fields,
          key: phoneDigits,
        })
      } else {
        subscriberIdRequests.push({
          subscriber_id: request.subscriber_id,
          fields: request.fields,
          key: request.subscriber_id,
        })
      }
    }

    console.log(
      `🔄 [set-manychat-fields] Processing ${phoneRequests.length} phone request(s) and ${subscriberIdRequests.length} subscriber_id request(s)...`
    )

    // Step 1: Batch call get-manychat-user for all phone requests at once
    let phoneSubscriberMap: Record<string, { subscriber_id: string; error?: string }> = {}
    if (phoneRequests.length > 0) {
      try {
        phoneSubscriberMap = await getOrCreateSubscribers(
          phoneRequests.map((req) => ({ phone: req.phone, name: req.name, key: req.key }))
        )
      } catch (error) {
        console.error(`❌ [set-manychat-fields] Error getting subscribers by phone:`, error)
        // Mark all phone requests as failed
        for (const req of phoneRequests) {
          phoneSubscriberMap[req.key] = {
            subscriber_id: "",
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }
    }

    // Step 2: Combine all subscriber IDs (from phone lookups + direct subscriber_ids)
    const allSubscriberRequests: Array<{
      subscriber_id: string
      fields: Record<string, string>
      key: string
    }> = []

    // Add phone-based requests (with resolved subscriber_ids)
    for (const phoneReq of phoneRequests) {
      const result = phoneSubscriberMap[phoneReq.key]
      if (result && !result.error && result.subscriber_id) {
        allSubscriberRequests.push({
          subscriber_id: result.subscriber_id,
          fields: phoneReq.fields,
          key: phoneReq.key,
        })
      }
    }

    // Add direct subscriber_id requests
    allSubscriberRequests.push(...subscriberIdRequests)

    // Step 3: Set fields for all subscribers in parallel
    console.log(`📝 [set-manychat-fields] Setting fields for ${allSubscriberRequests.length} subscriber(s)...`)
    const results = await Promise.all(
      allSubscriberRequests.map((req) => setFieldsForSubscriber(manychat, req.subscriber_id, req.fields, req.key))
    )

    // Step 4: Add error results for phone requests that failed
    for (const phoneReq of phoneRequests) {
      const result = phoneSubscriberMap[phoneReq.key]
      if (result && result.error) {
        results.push({
          key: phoneReq.key,
          success: false,
          subscriber_id: "",
          error: result.error,
        })
      }
    }

    // Build result dictionary: key = phone/subscriber_id, value = result
    const resultDict: Record<string, { success: boolean; subscriber_id?: string; error?: string }> = {}

    for (const result of results) {
      resultDict[result.key] = {
        success: result.success,
        ...(result.subscriber_id && { subscriber_id: result.subscriber_id }),
        ...(result.error && { error: result.error }),
      }
    }

    console.log(`✅ [set-manychat-fields] Processed ${requests.length} request(s), returning results`)

    return new Response(JSON.stringify(resultDict), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [set-manychat-fields] General error:", error)
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
