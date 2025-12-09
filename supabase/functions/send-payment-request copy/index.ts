import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ManyChat Flow IDs
const MANYCHAT_FLOW_IDS = {
  SEND_BIT_PAYMENT_LINK: "content20251128214307_012273",
  SEND_PAYBOX_PAYMENT_LINK: "content20251201003718_892652",
} as const

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { cartId, appointmentId, paymentGateway, recipients, recipientPhones } = await req.json()

    console.log("Sending payment request:", { cartId, appointmentId, paymentGateway, recipients, recipientPhones })

    if (!cartId || !appointmentId || !paymentGateway) {
      throw new Error("Cart ID, Appointment ID, and Payment Gateway are required")
    }

    if (paymentGateway !== "bit" && paymentGateway !== "paybox") {
      throw new Error("Payment gateway must be 'bit' or 'paybox'")
    }

    // Support both new format (recipients with names) and legacy format (recipientPhones array)
    let recipientList: Array<{ phone: string; name: string }> = []

    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      // New format: array of {phone, name} objects
      recipientList = recipients.map((r: { phone: string; name?: string }) => ({
        phone: r.phone,
        name: r.name || "לקוח",
      }))
    } else if (recipientPhones && Array.isArray(recipientPhones) && recipientPhones.length > 0) {
      // Legacy format: just phone numbers
      recipientList = recipientPhones.map((phone: string) => ({
        phone,
        name: "לקוח",
      }))
    } else {
      throw new Error("At least one recipient is required (recipients array or recipientPhones array)")
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get cart and customer information
    const { data: cartData, error: cartError } = await supabase
      .from("carts")
      .select("customer_id, customers(full_name, phone)")
      .eq("id", cartId)
      .single()

    if (cartError) {
      console.error("Error fetching cart:", cartError)
      throw new Error("Failed to fetch cart information")
    }

    const customer = cartData?.customers as { full_name?: string; phone?: string } | null
    const customerName = customer?.full_name || "לקוח"

    // Get the appropriate ManyChat flow ID
    const flowId =
      paymentGateway === "bit" ? MANYCHAT_FLOW_IDS.SEND_BIT_PAYMENT_LINK : MANYCHAT_FLOW_IDS.SEND_PAYBOX_PAYMENT_LINK

    // Prepare users array for ManyChat
    // For each recipient, use their name if provided, otherwise use customer name
    const users = recipientList.map((recipient) => ({
      phone: recipient.phone,
      name: recipient.name || customerName,
      fields: {
        // You can add custom fields here if needed (e.g., cart_id, appointment_id)
        // Format: field_id: value (as strings)
      },
    }))

    // Call set-manychat-fields-and-send-flow to send the payment request
    console.log(`📤 [send-payment-request] Sending ${paymentGateway} payment flow to ${users.length} recipient(s)`)

    const { data: manychatResult, error: manychatError } = await supabase.functions.invoke(
      "set-manychat-fields-and-send-flow",
      {
        body: {
          users: users,
          flow_id: flowId,
        },
      }
    )

    if (manychatError) {
      console.error("Error calling ManyChat function:", manychatError)
      throw new Error(`Failed to send payment request via ManyChat: ${manychatError.message}`)
    }

    // Check results
    const results = manychatResult as Record<string, { success: boolean; error?: string }>
    const successCount = Object.values(results).filter((r) => r.success).length
    const failureCount = Object.values(results).filter((r) => !r.success).length

    console.log(`✅ [send-payment-request] Sent to ${successCount} recipient(s), ${failureCount} failed`)

    if (successCount === 0) {
      throw new Error("Failed to send payment request to any recipients")
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payment request sent successfully to ${successCount} recipient(s)`,
        results: results,
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
        error: error instanceof Error ? error.message : "Failed to send payment request",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
