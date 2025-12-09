import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createTranzilaClient } from "../_shared/tranzila-api-client.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface CreateInvoiceRequest {
  orderId: string
  customerId: string
  action?: "1" | "3" // "1" for debit/invoice (default), "3" for credit/refund
  invoiceDetails?: {
    customerName: string
    customerEmail?: string
    customerPhone?: string
    amount: number
  }
}

interface OrderItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number | null
  product_id: string | null
}

interface CartItem {
  id: string
  item_name: string | null
  quantity: number
  unit_price: number | null
}

interface CartAppointment {
  id: string
  appointment_price: number | null
  grooming_appointment_id: string | null
  daycare_appointment_id: string | null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // Verify user is authenticated
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { orderId, customerId, action: requestAction, invoiceDetails }: CreateInvoiceRequest = await req.json()

    if (!orderId || !customerId) {
      return new Response(JSON.stringify({ success: false, error: "Order ID and Customer ID are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Determine action: "1" for debit/invoice (default), "3" for credit/refund
    const action: "1" | "3" = requestAction || "1"

    // Fetch order with items
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          item_name,
          quantity,
          unit_price,
          product_id
        )
      `
      )
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Use invoice details if provided, otherwise fetch from customer
    let customerName: string
    let customerEmail: string | undefined
    let customerPhone: string | undefined
    let invoiceAmount: number
    let customerAddress: string | undefined
    let customerGovId: string | undefined

    if (invoiceDetails) {
      // Use provided invoice details
      customerName = invoiceDetails.customerName
      customerEmail = invoiceDetails.customerEmail
      customerPhone = invoiceDetails.customerPhone
      invoiceAmount = invoiceDetails.amount

      // Still fetch customer for address and gov_id if needed
      const { data: customer } = await supabaseClient
        .from("customers")
        .select("id, full_name, email, address, gov_id, phone")
        .eq("id", customerId)
        .single()

      if (customer) {
        customerAddress = customer.address
        customerGovId = customer.gov_id
      }
    } else {
      // Fetch customer data
      const { data: customer, error: customerError } = await supabaseClient
        .from("customers")
        .select("id, full_name, email, address, gov_id, phone")
        .eq("id", customerId)
        .single()

      if (customerError || !customer) {
        return new Response(JSON.stringify({ success: false, error: "Customer not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (!customer.full_name) {
        return new Response(JSON.stringify({ success: false, error: "Customer name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      customerName = customer.full_name
      customerEmail = customer.email
      customerPhone = customer.phone
      customerAddress = customer.address
      customerGovId = customer.gov_id
    }

    // Format order items - check order_items first, then fallback to cart_items/cart_appointments
    // If invoiceDetails.amount is provided, create a single item with that amount
    let items: Array<{ name: string; unitPrice: number; quantity: number }> = []

    if (invoiceDetails) {
      // Use the provided amount as a single item
      items = [
        {
          name: action === "3" ? "זיכוי" : "חשבונית",
          unitPrice: invoiceAmount,
          quantity: 1,
        },
      ]
    } else {
      // Use order items
      if (order.order_items && order.order_items.length > 0) {
        // Use order_items if available
        items = (order.order_items as OrderItem[]).map((item) => ({
          name: item.item_name || "פריט",
          unitPrice: item.unit_price || 0,
          quantity: item.quantity || 1,
        }))
      } else if (order.cart_id) {
        // If no order_items, fetch from cart
        const [cartItemsResult, cartAppointmentsResult] = await Promise.all([
          supabaseClient.from("cart_items").select("id, item_name, quantity, unit_price").eq("cart_id", order.cart_id),
          supabaseClient
            .from("cart_appointments")
            .select("id, appointment_price, grooming_appointment_id, daycare_appointment_id")
            .eq("cart_id", order.cart_id),
        ])

        // Add cart items
        if (cartItemsResult.data && cartItemsResult.data.length > 0) {
          items.push(
            ...(cartItemsResult.data as CartItem[]).map((item) => ({
              name: item.item_name || "פריט",
              unitPrice: item.unit_price || 0,
              quantity: item.quantity || 1,
            }))
          )
        }

        // Add cart appointments as items
        if (cartAppointmentsResult.data && cartAppointmentsResult.data.length > 0) {
          ;(cartAppointmentsResult.data as CartAppointment[]).forEach((ca) => {
            const appointmentType = ca.grooming_appointment_id
              ? "תור מספרה"
              : ca.daycare_appointment_id
              ? "תור גן"
              : "תור"
            items.push({
              name: appointmentType,
              unitPrice: ca.appointment_price || 0,
              quantity: 1,
            })
          })
        }
      }

      if (items.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Order has no items" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    // Format payment info
    const totalAmount = invoiceDetails ? invoiceAmount : order.total || order.subtotal || 0
    const orderDate = new Date(order.created_at)
    const paymentDate = orderDate.toISOString().split("T")[0] // YYYY-MM-DD format

    // Parse address to extract city and zip if possible
    const address = customerAddress || ""
    // Try to extract zip code (5 digits) and city from address
    const zipMatch = address.match(/\b\d{5,7}\b/)
    const zip = zipMatch ? zipMatch[0] : ""

    // Prepare client ID: Tranzila requires numeric ID (9 digits). Strip non-digits and pad if needed.
    const govIdDigits = (customerGovId || "").replace(/\D/g, "")
    const uuidDigits = customerId.replace(/\D/g, "")
    const baseId = govIdDigits || uuidDigits
    const clientId = baseId ? baseId.padEnd(9, "0").slice(0, 9) : undefined

    // Initialize Tranzila API client
    const tranzilaClient = createTranzilaClient()

    const invoiceParams = {
      documentDate: orderDate.toISOString().split("T")[0], // YYYY-MM-DD format
      customerName: customerName,
      customerId: clientId,
      customerEmail: customerEmail || "",
      customerAddress: address,
      customerZip: zip,
      customerCountryCode: "IL",
      items: items,
      payments: [
        {
          amount: totalAmount,
          paymentDate: paymentDate,
        },
      ],
      vatPercent: 17,
      action: action,
    }

    console.log("📄 [tranzila-create-invoice] Calling createInvoice with params:", {
      ...invoiceParams,
      itemsCount: invoiceParams.items.length,
      items: invoiceParams.items,
      payments: invoiceParams.payments,
    })

    const invoiceResponse = await tranzilaClient.createInvoice(invoiceParams)

    // Extract invoice number and retrieval key from response
    let invoiceNumber: string | null = null
    let retrievalKey: string | null = null

    // Try different response structures for invoice number
    if (invoiceResponse.document_number) {
      invoiceNumber = invoiceResponse.document_number.toString()
    } else if (invoiceResponse.number) {
      invoiceNumber = invoiceResponse.number.toString()
    } else if (invoiceResponse.document?.number) {
      invoiceNumber = invoiceResponse.document.number.toString()
    }

    // Extract retrieval key
    if (invoiceResponse.retrieval_key) {
      retrievalKey = invoiceResponse.retrieval_key.toString()
    } else if (invoiceResponse.document?.retrieval_key) {
      retrievalKey = invoiceResponse.document.retrieval_key.toString()
    }

    console.log("📄 [tranzila-create-invoice] Extracted invoice data:", {
      invoiceNumber,
      retrievalKey: retrievalKey ? retrievalKey.substring(0, 20) + "..." : null,
      hasDocument: !!invoiceResponse.document,
    })

    // Save invoice to invoices table
    const invoiceType = action === "3" ? "credit" : "debit"
    let savedInvoiceId: string | null = null

    if (invoiceNumber || retrievalKey) {
      const { data: savedInvoice, error: insertError } = await supabaseClient
        .from("invoices")
        .insert({
          order_id: orderId,
          invoice_type: invoiceType,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          amount: totalAmount,
          invoice_number: invoiceNumber,
          retrieval_key: retrievalKey,
          created_by: user.id,
        })
        .select("id")
        .single()

      if (insertError) {
        console.error("❌ [tranzila-create-invoice] Error saving invoice:", insertError)
        // Don't fail the request if save fails, invoice was still created in Tranzila
      } else if (savedInvoice) {
        savedInvoiceId = savedInvoice.id
        console.log("✅ [tranzila-create-invoice] Invoice saved to database:", savedInvoiceId)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: savedInvoiceId,
        invoiceNumber: invoiceNumber,
        retrievalKey: retrievalKey,
        invoiceType,
        amount: totalAmount,
        invoiceData: invoiceResponse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ [tranzila-create-invoice] Error:", error)
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
