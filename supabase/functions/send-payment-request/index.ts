import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase configuration for send-payment-request")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { cartId, appointmentId, paymentGateway } = await req.json()

    if (!cartId || !appointmentId || !paymentGateway) {
      throw new Error("Cart ID, Appointment ID, and payment gateway are required")
    }

    const normalizedGateway = String(paymentGateway).toLowerCase()

    // Fetch appointment to obtain customer_id
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, customer_id")
      .eq("id", appointmentId)
      .maybeSingle()

    if (appointmentError) {
      throw new Error(`Failed to load appointment: ${appointmentError.message}`)
    }
    if (!appointment) {
      throw new Error("Appointment not found")
    }

    // Compute total from cart items + appointment price
    const { data: cartAppointment, error: cartAppointmentError } = await supabase
      .from("cart_appointments")
      .select("appointment_price")
      .eq("cart_id", cartId)
      .eq("appointment_id", appointmentId)
      .maybeSingle()

    if (cartAppointmentError) {
      throw new Error(`Failed to load cart appointment: ${cartAppointmentError.message}`)
    }

    const appointmentPrice = Number(cartAppointment?.appointment_price ?? 0)

    const { data: items, error: itemsError } = await supabase
      .from("cart_items")
      .select("quantity, unit_price")
      .eq("cart_id", cartId)

    if (itemsError) {
      throw new Error(`Failed to load cart items: ${itemsError.message}`)
    }

    const itemsTotal =
      items?.reduce((sum, item) => sum + Number(item.quantity ?? 1) * Number(item.unit_price ?? 0), 0) ?? 0
    const totalAmount = appointmentPrice + itemsTotal

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        customer_id: appointment.customer_id,
        appointment_id: appointmentId,
        amount: totalAmount,
        currency: "ILS",
        status: "unpaid",
        method: normalizedGateway,
      })
      .select("id, amount")
      .maybeSingle()

    if (paymentError) {
      throw new Error(`Failed to create payment: ${paymentError.message}`)
    }

    if (payment) {
      const { error: linkError } = await supabase.from("appointment_payments").insert({
        appointment_id: appointmentId,
        payment_id: payment.id,
        amount: payment.amount ?? totalAmount,
      })
      if (linkError) {
        console.warn("⚠️ Failed to link payment to appointment:", linkError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment record created",
        paymentId: payment?.id ?? null,
        amount: totalAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
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
      },
    )
  }
})
