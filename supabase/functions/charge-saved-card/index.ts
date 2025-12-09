import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createTranzilaClient } from "../_shared/tranzila-api-client.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface ChargeSavedCardRequest {
  token: string
  cvv: string | null
  amount: number
  items: Array<{
    name: string
    type: string
    unit_price: number
    units_number: number
  }>
  customerId: string
  cartId?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { token, cvv, amount, items, customerId, cartId }: ChargeSavedCardRequest = await req.json()

    console.log("💳 [charge-saved-card] Charging saved card:", {
      customerId,
      amount,
      itemsCount: items.length,
      hasToken: !!token,
      hasCvv: !!cvv,
    })

    if (!token || !amount || amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: "Token and valid amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Items are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // CVV is required for tokenized payments
    if (!cvv || cvv.trim() === "") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "CVV is required for saved card payments. Please ensure the card has CVV stored.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const terminalPassword = Deno.env.get("TRANZILLA_PASSWORD") || ""

    if (!terminalPassword) {
      return new Response(JSON.stringify({ success: false, error: "Tranzila password not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Use shared Tranzila API client
    let responseData: any
    try {
      const tranzilaClient = createTranzilaClient()

      // Create credit card transaction using saved token
      responseData = await tranzilaClient.createCreditCardTransaction({
        token,
        cvv,
        items,
        terminalPassword,
      })
    } catch (apiError) {
      console.error("❌ [charge-saved-card] Tranzila API error:", apiError)
      return new Response(
        JSON.stringify({
          success: false,
          error: apiError instanceof Error ? apiError.message : "Payment failed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Get Supabase client to save payment record
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Get credit token ID
      const { data: creditToken } = await supabase
        .from("credit_tokens")
        .select("id")
        .eq("customer_id", customerId)
        .eq("token", token)
        .limit(1)
        .single()

      // Create payment record
      if (creditToken) {
        await supabase.from("payments").insert({
          customer_id: customerId,
          amount: amount,
          currency: "ILS",
          status: "paid",
          method: "saved_card",
          token_id: creditToken.id,
          external_id: responseData.ConfirmationCode || responseData.TranzilaTK || null,
          metadata: {
            response: responseData,
            cart_id: cartId,
          },
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: responseData,
        confirmationCode: responseData.ConfirmationCode,
        transactionId: responseData.TranzilaTK,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("❌ [charge-saved-card] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
