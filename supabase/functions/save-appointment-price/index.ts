import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { appointmentId, price, recordId, recordNumber, serviceType } = await req.json()
    console.log("Saving appointment price:", { appointmentId, price, recordId, recordNumber, serviceType })

    if (!appointmentId && !recordId) {
      throw new Error("Appointment ID or Record ID is required")
    }

    // Make.com webhook URL for saving appointment prices
    const webhookUrl = "https://hook.eu2.make.com/sjaximdjzif3b9tqrr6kxfhm1c81pe63"

    // Call Make.com webhook
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appointmentId,
        price,
        recordId,
        recordNumber,
        serviceType, // "garden" or "grooming"
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Webhook error:", errorText)
      throw new Error(`Failed to call webhook: ${response.status}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Price saved successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Error saving appointment price:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to save price",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
