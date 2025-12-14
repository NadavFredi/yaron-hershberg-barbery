import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createTranzilaClient } from "../_shared/tranzila-api-client.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface GetInvoiceRequest {
  transactionId: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { transactionId }: GetInvoiceRequest = await req.json()

    if (!transactionId) {
      return new Response(JSON.stringify({ success: false, error: "Transaction ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Initialize Tranzila API client
    const tranzilaClient = createTranzilaClient()
    const invoiceHtml = await tranzilaClient.getInvoiceForPayment(transactionId)

    return new Response(
      JSON.stringify({
        success: true,
        invoice: invoiceHtml,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ [tranzila-get-invoice] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
