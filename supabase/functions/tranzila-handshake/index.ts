import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface HandshakeRequest {
  sum: number
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { sum }: HandshakeRequest = await req.json()

    if (!sum || sum <= 0) {
      return new Response(JSON.stringify({ success: false, error: "Sum must be greater than 0" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const terminalName = Deno.env.get("TRANZILLA_TERMINAL_NAME") || "bloved29"
    const terminalPassword = Deno.env.get("TRANZILLA_PASSWORD") || ""

    if (!terminalPassword) {
      return new Response(JSON.stringify({ success: false, error: "Tranzila password not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const handshakeUrl = `https://api.tranzila.com/v1/handshake/create?supplier=${terminalName}&sum=${sum}&TranzilaPW=${terminalPassword}`

    const handshakeResponse = await fetch(handshakeUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!handshakeResponse.ok) {
      const errorText = await handshakeResponse.text()
      console.error("❌ [tranzila-handshake] Tranzilla API error:", {
        status: handshakeResponse.status,
        statusText: handshakeResponse.statusText,
        errorText,
        url: handshakeUrl.replace(/TranzilaPW=[^&]+/, "TranzilaPW=***"), // Hide password in logs
      })
      const errorMessage = errorText || `${handshakeResponse.status} ${handshakeResponse.statusText}`
      throw new Error(`Tranzila API error: ${errorMessage}`)
    }

    // Parse the response - it returns plain text like "thtk=token"
    const responseText = await handshakeResponse.text()
    const cleanedResponse = responseText.trim().replace(/\r\n/g, "").replace(/\n/g, "")

    // Parse the plain text response to extract the token
    // Format is typically: "thtk=TOKEN_HERE" or "thtk=TOKEN_HERE\n" or similar
    let thtk: string | null = null

    // Pattern 1: thtk=VALUE (most common format - matches alphanumeric characters)
    const thtkMatch1 = cleanedResponse.match(/thtk\s*=\s*([a-zA-Z0-9]+)/i)
    if (thtkMatch1 && thtkMatch1[1]) {
      thtk = thtkMatch1[1].trim()
    } else {
      // Pattern 2: thtk=VALUE with any characters after = until whitespace or end
      const thtkMatch2 = cleanedResponse.match(/thtk\s*=\s*([^\s\n\r&]+)/i)
      if (thtkMatch2 && thtkMatch2[1]) {
        thtk = thtkMatch2[1].trim()
      } else {
        // Pattern 3: If response is just the token value itself (no thtk= prefix)
        const tokenOnlyMatch = cleanedResponse.match(/^([a-zA-Z0-9]{20,})$/i)
        if (tokenOnlyMatch && tokenOnlyMatch[1]) {
          thtk = tokenOnlyMatch[1].trim()
        } else {
          // Pattern 4: Try to find thtk anywhere in the string with spaces around it
          const thtkMatch4 = cleanedResponse.match(/(?:^|\s)thtk\s*=\s*([a-zA-Z0-9]+)(?:\s|$)/i)
          if (thtkMatch4 && thtkMatch4[1]) {
            thtk = thtkMatch4[1].trim()
          }
        }
      }
    }

    if (!thtk || thtk.length === 0) {
      console.error("❌ [tranzila-handshake] Failed to extract token from response")
      console.error("❌ [tranzila-handshake] Original response:", JSON.stringify(responseText))
      console.error("❌ [tranzila-handshake] Cleaned response:", JSON.stringify(cleanedResponse))
      const errorMessage = `Failed to extract token from Tranzila response. Response: ${cleanedResponse.substring(
        0,
        200
      )}`
      throw new Error(errorMessage)
    }

    return new Response(
      JSON.stringify({
        success: true,
        thtk: thtk,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("❌ [tranzila-handshake] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    const errorStack = error instanceof Error ? error.stack : undefined

    // Log full error details for debugging
    console.error("❌ [tranzila-handshake] Full error details:", {
      message: errorMessage,
      stack: errorStack,
      error,
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorStack ? undefined : String(error), // Include details if no stack trace
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
