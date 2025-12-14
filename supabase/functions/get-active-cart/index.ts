import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase configuration for get-active-cart")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { appointmentId } = await req.json()

    if (!appointmentId) {
      throw new Error("Appointment ID is required")
    }

    // Find the latest active cart linked to the appointment
    const { data: cartAppointment, error: cartError } = await supabase
      .from("cart_appointments")
      .select(
        `
        cart_id,
        appointment_price,
        carts!inner(id, status, created_at)
      `,
      )
      .eq("appointment_id", appointmentId)
      .eq("carts.status", "active")
      .order("carts.created_at", { referencedTable: "carts", ascending: false })
      .limit(1)
      .maybeSingle()

    if (cartError) {
      throw new Error(`Failed to fetch cart for appointment: ${cartError.message}`)
    }

    if (!cartAppointment?.cart_id) {
      return new Response(JSON.stringify({ success: true, cart: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const cartId = cartAppointment.cart_id as string
    const appointmentPrice = cartAppointment.appointment_price ?? 0

    const { data: items, error: itemsError } = await supabase
      .from("cart_items")
      .select("id, item_name, quantity, unit_price")
      .eq("cart_id", cartId)
      .order("created_at", { ascending: true })

    if (itemsError) {
      throw new Error(`Failed to fetch cart items: ${itemsError.message}`)
    }

    const orderItems =
      items?.map((item) => ({
        id: item.id,
        name: item.item_name ?? "",
        amount: Number(item.quantity ?? 1),
        price: Number(item.unit_price ?? 0),
        needsInvoice: false,
      })) ?? []

    return new Response(
      JSON.stringify({
        success: true,
        cart: {
          id: cartId,
          orderItems,
          appointmentPrice,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error getting active cart:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get active cart",
        cart: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    )
  }
})
