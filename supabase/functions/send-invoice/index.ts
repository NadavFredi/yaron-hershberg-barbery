import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SendInvoiceRequest {
  paymentId: string
  email: string
  customerId?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔍 [send-invoice] Function started")

    // Check for authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.error("❌ [send-invoice] No authorization header provided")
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized - Authentication required",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { paymentId, email, customerId } = await req.json() as SendInvoiceRequest

    console.log("📧 [send-invoice] Sending invoice:", { paymentId, email, customerId })

    if (!paymentId || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment ID and email are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable")
    }

    if (!supabaseServiceKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
    }

    // Use service role to bypass RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      console.error("❌ [send-invoice] Authentication failed:", authError?.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized - Invalid or expired session",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ [send-invoice] User authenticated:", user.id)

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .select(`
        *,
        customer:customers(id, full_name, phone, email)
      `)
      .eq("id", paymentId)
      .single()

    if (paymentError || !payment) {
      console.error("❌ [send-invoice] Payment not found:", paymentError)
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ [send-invoice] Payment found:", payment.id)

    // Call Make.com webhook for invoice sending
    // Replace with your actual webhook URL
    const webhookUrl = Deno.env.get("INVOICE_WEBHOOK_URL") || "https://hook.eu2.make.com/YOUR_WEBHOOK_ID"

    const webhookPayload = {
      paymentId: payment.id,
      paymentAmount: payment.amount,
      paymentCurrency: payment.currency,
      paymentStatus: payment.status,
      paymentMethod: payment.method,
      paymentDate: payment.created_at,
      customerId: payment.customer_id,
      customerName: payment.customer?.full_name,
      customerPhone: payment.customer?.phone,
      customerEmail: payment.customer?.email,
      invoiceEmail: email,
      timestamp: new Date().toISOString(),
    }

    console.log("📤 [send-invoice] Calling webhook:", webhookUrl)

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error("❌ [send-invoice] Webhook error:", errorText)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to send invoice: ${webhookResponse.status}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const webhookResult = await webhookResponse.text()
    console.log("✅ [send-invoice] Webhook response:", webhookResult)

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice sent successfully",
        paymentId: payment.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("❌ [send-invoice] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

