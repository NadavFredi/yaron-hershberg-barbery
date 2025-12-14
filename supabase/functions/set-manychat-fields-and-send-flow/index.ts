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

interface SetFieldsAndSendFlowRequest {
  users: SetManyChatFieldsRequest
  flow_id: string
}

interface ManyChatSendFlowResponse {
  status: string
  data?: {
    flow_id?: string
    subscriber_id?: string
  }
}

// Removed sendManyChatFlow - now using ManyChatClient directly

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 [set-manychat-fields-and-send-flow] Function called with method:", req.method)

    // Get ManyChat client
    let manychat: ManyChatClient
    try {
      manychat = ManyChatClient.fromEnvironment()
    } catch (error) {
      console.error("❌ [set-manychat-fields-and-send-flow] Missing MANYCHAT_API_KEY environment variable")
      return new Response(JSON.stringify({ success: false, error: "ManyChat API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Parse request
    const request: SetFieldsAndSendFlowRequest = await req.json()
    console.log("📋 [set-manychat-fields-and-send-flow] Received request")

    // Validate request
    if (!request.users || !Array.isArray(request.users) || request.users.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Request must have a 'users' array with at least one user",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (!request.flow_id || typeof request.flow_id !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Request must have a 'flow_id' field (string)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Validate each user request
    for (const userReq of request.users) {
      if ("phone" in userReq) {
        if (!userReq.phone || typeof userReq.phone !== "string") {
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
        if (!userReq.name || typeof userReq.name !== "string") {
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
        if (!userReq.subscriber_id || typeof userReq.subscriber_id !== "string") {
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

      if (!userReq.fields || typeof userReq.fields !== "object" || Array.isArray(userReq.fields)) {
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

    // Step 1: Call set-manychat-fields to set fields for all users
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    }

    console.log(`🔄 [set-manychat-fields-and-send-flow] Setting fields for ${request.users.length} user(s)...`)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: setFieldsData, error: setFieldsError } = await supabase.functions.invoke("set-manychat-fields", {
      body: request.users,
    })

    if (setFieldsError) {
      console.error(`❌ [set-manychat-fields-and-send-flow] Error setting fields:`, setFieldsError)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to set fields: ${setFieldsError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (!setFieldsData || typeof setFieldsData !== "object") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid response from set-manychat-fields",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Step 2: Extract subscriber IDs from set-manychat-fields response and send flows
    console.log(`📤 [set-manychat-fields-and-send-flow] Sending flow ${request.flow_id} to users...`)
    const results: Array<{
      key: string
      success: boolean
      subscriber_id?: string
      error?: string
    }> = []

    // Process results from set-manychat-fields
    for (const userReq of request.users) {
      const key = "phone" in userReq ? userReq.phone.replace(/\D/g, "") : userReq.subscriber_id
      const setFieldsResult = (setFieldsData as Record<string, unknown>)[key]

      if (!setFieldsResult || typeof setFieldsResult !== "object") {
        results.push({
          key,
          success: false,
          error: "Failed to set fields - no result returned",
        })
        continue
      }

      const setFieldsResultObj = setFieldsResult as { success?: boolean; subscriber_id?: string; error?: string }

      // If setting fields failed, don't send flow
      if (!setFieldsResultObj.success || !setFieldsResultObj.subscriber_id) {
        results.push({
          key,
          success: false,
          subscriber_id: setFieldsResultObj.subscriber_id,
          error: setFieldsResultObj.error || "Failed to set fields",
        })
        continue
      }

      // Send flow to this subscriber
      try {
        await manychat.sendFlow(setFieldsResultObj.subscriber_id, request.flow_id)
        results.push({
          key,
          success: true,
          subscriber_id: setFieldsResultObj.subscriber_id,
        })
      } catch (error) {
        results.push({
          key,
          success: false,
          subscriber_id: setFieldsResultObj.subscriber_id,
          error: error instanceof Error ? error.message : String(error),
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

    console.log(`✅ [set-manychat-fields-and-send-flow] Processed ${request.users.length} user(s), returning results`)

    return new Response(JSON.stringify(resultDict), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [set-manychat-fields-and-send-flow] General error:", error)
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
