import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper to get Airtable config
function getAirtableConfig() {
  const pat = Deno.env.get("AIRTABLE_PAT")
  const baseId = Deno.env.get("AIRTABLE_BASE_ID")
  if (!pat || !baseId) {
    throw new Error("Missing Airtable PAT or Base ID")
  }
  return { pat, baseId }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const {
      appointmentId,
      orderItems,
      appointmentPrice,
      cartId,
      serviceType, // "garden" or "grooming"
    } = await req.json()

    console.log("Saving cart:", { appointmentId, orderItems, appointmentPrice, cartId, serviceType })

    if (!appointmentId) {
      throw new Error("Appointment ID is required")
    }

    // Call Make.com webhook to save cart
    const webhookUrl = "https://hook.eu2.make.com/1r0xn66b7tepii7msxwm1dplb67trke5"

    const webhookPayload = {
      appointmentId,
      cartId: cartId || null,
      appointmentPrice: parseFloat(appointmentPrice) || 0,
      orderItems: orderItems.map((item: any) => ({
        name: item.name,
        quantity: item.amount,
        price: item.price,
        needsInvoice: item.needsInvoice || false,
      })),
      serviceType,
      timestamp: new Date().toISOString(),
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error("Webhook error:", errorText)
      throw new Error(`Failed to call webhook: ${webhookResponse.status}`)
    }

    const webhookResult = await webhookResponse.text()
    console.log("Webhook response:", webhookResult)

    // Try to parse webhook result to get cart ID
    let returnedCartId = cartId
    try {
      const parsed = JSON.parse(webhookResult)
      if (parsed.cartId) {
        returnedCartId = parsed.cartId
      }
    } catch (e) {
      // If response is not JSON, that's okay
      console.log("Webhook response is not JSON, using existing cartId")
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cart saved successfully",
        cartId: returnedCartId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Error saving cart:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to save cart",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
