import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createTranzilaClient } from "../_shared/tranzila-api-client.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface TranzilaCallbackData {
  Response?: string
  TranzilaTK?: string
  TranzilaTKX?: string
  Sum?: string
  Currency?: string
  ConfirmationCode?: string
  Token?: string
  CardType?: string
  CardName?: string
  CardNo?: string
  CardExp?: string
  CardCVV?: string
  CardHolderID?: string
  CardHolderName?: string
  CardHolderPhone?: string
  CardHolderEmail?: string
  CardHolderAddress?: string
  CardHolderCity?: string
  CardHolderZip?: string
  CardHolderCountry?: string
  record_id?: string // Customer ID
  mymore?: string // JSON string with cart_id and other custom data
  [key: string]: string | undefined
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Tranzila sends data as form-encoded or query params
    const url = new URL(req.url)
    const formData = await req.formData().catch(() => null)
    
    // Parse callback data from form data or query params
    const callbackData: TranzilaCallbackData = {}
    
    if (formData) {
      for (const [key, value] of formData.entries()) {
        callbackData[key] = value.toString()
      }
    } else {
      // Try query params
      for (const [key, value] of url.searchParams.entries()) {
        callbackData[key] = value
      }
    }

    console.log("📥 [payment-received-callback] Received callback:", {
      Response: callbackData.Response,
      ConfirmationCode: callbackData.ConfirmationCode,
      Sum: callbackData.Sum,
      record_id: callbackData.record_id,
      hasToken: !!callbackData.Token,
      hasMymore: !!callbackData.mymore,
    })

    // Extract transaction ID from Response or ConfirmationCode
    const transactionId = callbackData.Response || callbackData.ConfirmationCode
    if (!transactionId || transactionId === "ERR") {
      console.error("❌ [payment-received-callback] Invalid transaction ID:", transactionId)
      return new Response("Invalid transaction ID", {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Parse mymore to get cart_id and other custom data
    let cartId: string | null = null
    let customerId: string | null = callbackData.record_id || null
    try {
      if (callbackData.mymore) {
        const mymoreData = JSON.parse(callbackData.mymore)
        cartId = mymoreData.cart_id || null
        // Also check for customer_id in mymore if not in record_id
        if (!customerId && mymoreData.customer_id) {
          customerId = mymoreData.customer_id
        }
      }
    } catch (e) {
      console.warn("⚠️ [payment-received-callback] Failed to parse mymore:", e)
    }

    console.log("🔍 [payment-received-callback] Transaction ID:", transactionId, "Cart ID:", cartId, "Customer ID:", customerId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Tranzila API client (optional - for fetching retrieval key)
    let retrievalKey: string | null = null
    try {
      const tranzilaClient = createTranzilaClient()
      retrievalKey = await tranzilaClient.getRetrievalKeyByTransactionId(transactionId)
      if (retrievalKey) {
        console.log("✅ [payment-received-callback] Retrieved retrieval_key:", retrievalKey)
      }
    } catch (e) {
      console.warn("⚠️ [payment-received-callback] Failed to fetch retrieval_key (will fetch on-demand later):", e)
      // Continue anyway - we'll fetch retrieval_key later when viewing invoice
    }

    // If we have cart_id, fetch cart data and create order
    let orderId: string | null = null
    
    if (cartId) {
      console.log("📦 [payment-received-callback] Cart ID found:", cartId)
      
      // Fetch cart data
      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("customer_id, cart_appointments(grooming_appointment_id, daycare_appointment_id, appointment_price), cart_items(item_name, quantity, unit_price, product_id)")
        .eq("id", cartId)
        .single()
      
      if (cartError) {
        console.error("❌ [payment-received-callback] Failed to fetch cart:", cartError)
      } else if (cartData) {
        // Use customer_id from cart if not already set
        if (!customerId && cartData.customer_id) {
          customerId = cartData.customer_id
        }
        
        const cartItems = cartData.cart_items || []
        const cartAppointments = cartData.cart_appointments || []
        
        // Calculate totals
        const itemsTotal = cartItems.reduce((sum: number, item: any) => 
          sum + (parseFloat(item.unit_price?.toString() || "0") * parseFloat(item.quantity?.toString() || "0")), 0
        )
        const appointmentsTotal = cartAppointments.reduce((sum: number, apt: any) => 
          sum + parseFloat(apt.appointment_price?.toString() || "0"), 0
        )
        const subtotal = itemsTotal + appointmentsTotal
        const total = parseFloat(callbackData.Sum || subtotal.toString())
        
        // Create order
        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            customer_id: customerId,
            cart_id: cartId,
            status: "paid",
            subtotal: subtotal,
            total: total,
          })
          .select("id")
          .single()
        
        if (orderError) {
          console.error("❌ [payment-received-callback] Failed to create order:", orderError)
        } else if (newOrder) {
          orderId = newOrder.id
          console.log("✅ [payment-received-callback] Order created:", orderId)
          
          // Create order items (hard-copied from cart_items)
          if (cartItems && cartItems.length > 0) {
            const orderItemsToInsert = cartItems.map((item: any) => ({
              order_id: orderId,
              product_id: item.product_id || null,
              item_name: item.item_name || "פריט ללא שם",
              quantity: parseFloat(item.quantity?.toString() || "1"),
              unit_price: parseFloat(item.unit_price?.toString() || "0"),
            }))
            
            const { error: orderItemsError } = await supabase
              .from("order_items")
              .insert(orderItemsToInsert)
            
            if (orderItemsError) {
              console.error("❌ [payment-received-callback] Failed to create order items:", orderItemsError)
            } else {
              console.log("✅ [payment-received-callback] Order items created:", orderItemsToInsert.length)
            }
          }

          // Link appointments to order if we have cart appointments
          if (cartAppointments && cartAppointments.length > 0) {
            // Update appointments to link to order (if schema supports it)
            // Or create appointment_payments records
            for (const apt of cartAppointments) {
              if (apt.grooming_appointment_id) {
                // Could update grooming_appointment with order_id if schema supports it
                console.log("📝 [payment-received-callback] Grooming appointment:", apt.grooming_appointment_id)
              }
              if (apt.daycare_appointment_id) {
                // Could update daycare_appointment with order_id if schema supports it
                console.log("📝 [payment-received-callback] Daycare appointment:", apt.daycare_appointment_id)
              }
            }
          }

          // Mark cart as completed
          await supabase
            .from("carts")
            .update({ status: "completed" })
            .eq("id", cartId)
        }
      }
    }

    // Create payment record
    const amount = parseFloat(callbackData.Sum || "0")
    const currency = callbackData.Currency || "ILS"
    
    if (!customerId) {
      console.error("❌ [payment-received-callback] No customer_id found - cannot create payment")
      return new Response("Missing customer information", {
        status: 400,
        headers: corsHeaders,
      })
    }
    
    // Prepare payment metadata
    const paymentMetadata: any = {
      transaction_id: transactionId,
      order_id: orderId,
      cart_id: cartId,
      retrieval_key: retrievalKey,
    }

    // Add card information if available (for saving credit card)
    if (callbackData.Token) {
      paymentMetadata.token = callbackData.Token
      paymentMetadata.card_type = callbackData.CardType
      paymentMetadata.card_name = callbackData.CardName
      paymentMetadata.card_no = callbackData.CardNo
      paymentMetadata.card_exp = callbackData.CardExp
      paymentMetadata.card_holder_name = callbackData.CardHolderName
    }
    
    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        customer_id: customerId,
        amount: amount,
        currency: currency,
        status: "paid",
        method: "credit_card",
        external_id: transactionId,
        metadata: paymentMetadata,
      })
      .select("id")
      .single()
    
    if (paymentError) {
      console.error("❌ [payment-received-callback] Failed to create payment:", paymentError)
      return new Response(
        JSON.stringify({
          success: false,
          error: paymentError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }
    
    console.log("✅ [payment-received-callback] Payment created:", payment.id)
    
    // Save credit card token if provided and customer wants to save it
    if (callbackData.Token && customerId) {
      try {
        // Check if customer already has a saved token
        const { data: existingToken } = await supabase
          .from("credit_tokens")
          .select("id")
          .eq("customer_id", customerId)
          .maybeSingle()

        // Extract last 4 digits from CardNo if available
        const last4 = callbackData.CardNo ? callbackData.CardNo.slice(-4) : null
        
        // Extract expiration month/year from CardExp (format: MM/YY or MMYY)
        let expmonth: string | null = null
        let expyear: string | null = null
        if (callbackData.CardExp) {
          const expStr = callbackData.CardExp.replace(/\//g, "")
          if (expStr.length >= 4) {
            expmonth = expStr.slice(0, 2)
            expyear = "20" + expStr.slice(2, 4) // Convert YY to YYYY
          }
        }

        if (existingToken) {
          // Update existing token
          await supabase
            .from("credit_tokens")
            .update({
              token: callbackData.Token,
              provider: callbackData.CardType || "Tranzila",
              last4: last4,
              expmonth: expmonth,
              expyear: expyear,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingToken.id)
          
          console.log("✅ [payment-received-callback] Updated existing credit token")
        } else {
          // Create new token
          await supabase
            .from("credit_tokens")
            .insert({
              customer_id: customerId,
              token: callbackData.Token,
              provider: callbackData.CardType || "Tranzila",
              last4: last4,
              expmonth: expmonth,
              expyear: expyear,
            })
          
          console.log("✅ [payment-received-callback] Created new credit token")
        }
      } catch (tokenError) {
        console.warn("⚠️ [payment-received-callback] Failed to save credit token (non-critical):", tokenError)
        // Don't fail the payment if token saving fails
      }
    }
    
    // Link payment to appointments if we have cart appointments
    if (cartId && payment) {
      const { data: cartAppointments } = await supabase
        .from("cart_appointments")
        .select("grooming_appointment_id, daycare_appointment_id, appointment_price")
        .eq("cart_id", cartId)

      if (cartAppointments && cartAppointments.length > 0) {
        const appointmentPayments = cartAppointments
          .filter((apt: any) => apt.grooming_appointment_id || apt.daycare_appointment_id)
          .map((apt: any) => ({
            payment_id: payment.id,
            grooming_appointment_id: apt.grooming_appointment_id,
            daycare_appointment_id: apt.daycare_appointment_id,
            amount: parseFloat(apt.appointment_price?.toString() || "0"),
          }))
        
        if (appointmentPayments.length > 0) {
          const { error: aptPaymentError } = await supabase
            .from("appointment_payments")
            .insert(appointmentPayments)
          
          if (aptPaymentError) {
            console.error("❌ [payment-received-callback] Failed to link payment to appointments:", aptPaymentError)
          } else {
            console.log("✅ [payment-received-callback] Payment linked to appointments")
          }
        }
      }
    }
    
    console.log("✅ [payment-received-callback] Payment processed successfully")
    console.log("   Transaction ID:", transactionId)
    console.log("   Payment ID:", payment.id)
    console.log("   Order ID:", orderId)
    console.log("   Amount:", amount, currency)
    console.log("   Retrieval Key fetched:", retrievalKey ? "Yes" : "No (will fetch on-demand)")

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    })
  } catch (error) {
    console.error("❌ [payment-received-callback] Error:", error)
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

