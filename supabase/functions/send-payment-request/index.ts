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
    const { cartId, appointmentId, paymentGateway } = await req.json()

    console.log("Sending payment request:", { cartId, appointmentId, paymentGateway })

    if (!cartId || !appointmentId || !paymentGateway) {
      throw new Error("Cart ID, Appointment ID, and Payment Gateway are required")
    }

    if (paymentGateway !== "bit" && paymentGateway !== "paybox") {
      throw new Error("Payment gateway must be 'bit' or 'paybox'")
    }

    // Call Make.com webhook for payment request
    const webhookUrl = "https://hook.eu2.make.com/8mqc3khe2xk5h5ap72qu9w73pgjqb4ei"

    const webhookPayload = {
      cartId,
      appointmentId,
      paymentGateway,
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment request sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Error sending payment request:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send payment request",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
