import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase configuration for save-cart")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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
      customerId,
    } = await req.json()

    if (!appointmentId) {
      throw new Error("Appointment ID is required")
    }

    const parsedAppointmentPrice = Number(appointmentPrice ?? 0)
    const normalizedItems =
      Array.isArray(orderItems) && orderItems.length > 0
        ? orderItems.map((item: any) => ({
            name: item.name ?? "",
            amount: Number(item.amount ?? item.quantity ?? 1),
            price: Number(item.price ?? item.unit_price ?? 0),
            needsInvoice: Boolean(item.needsInvoice),
          }))
        : []

    let effectiveCartId = cartId as string | null | undefined

    if (!effectiveCartId) {
      const { data: newCart, error: cartError } = await supabase
        .from("carts")
        .insert({
          customer_id: customerId ?? null,
          status: "active",
        })
        .select("id")
        .maybeSingle()

      if (cartError) {
        throw new Error(`Failed to create cart: ${cartError.message}`)
      }

      effectiveCartId = newCart?.id ?? null
    }

    if (!effectiveCartId) {
      throw new Error("Failed to resolve cart")
    }

    // Link appointment to cart and update price
    const { error: upsertLinkError } = await supabase
      .from("cart_appointments")
      .upsert(
        {
          cart_id: effectiveCartId,
          appointment_id: appointmentId,
          appointment_price: parsedAppointmentPrice,
        },
        { onConflict: "cart_id,appointment_id" },
      )

    if (upsertLinkError) {
      throw new Error(`Failed to attach appointment to cart: ${upsertLinkError.message}`)
    }

    // Replace cart items for this cart
    const { error: deleteError } = await supabase.from("cart_items").delete().eq("cart_id", effectiveCartId)
    if (deleteError) {
      throw new Error(`Failed to clear existing cart items: ${deleteError.message}`)
    }

    if (normalizedItems.length > 0) {
      const { error: insertItemsError } = await supabase.from("cart_items").insert(
        normalizedItems.map((item) => ({
          cart_id: effectiveCartId,
          item_name: item.name,
          quantity: item.amount,
          unit_price: item.price,
        })),
      )

      if (insertItemsError) {
        throw new Error(`Failed to save cart items: ${insertItemsError.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cart saved successfully",
        cartId: effectiveCartId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    )
  } catch (error) {
    console.error("Error saving cart:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to save cart",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    )
  }
})
