import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for get-pending-appointment-requests")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

type PendingAppointmentRequest = {
  id: string
  serviceType: "grooming"
  createdAt: string
  startAt: string | null
  endAt: string | null
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  treatmentId: null
  treatmentName: null
  stationName: string | null
  serviceLabel: string | null
  notes: string | null
  appointmentKind?: "business" | "personal"
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number }
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 10

    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        created_at,
        start_at,
        end_at,
        status,
        customer_notes,
        appointment_kind,
        customers:customer_id ( id, full_name, phone ),
        stations:station_id ( id, name ),
        services:service_id ( id, name )
      `,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(error.message)
    }

    const requests: PendingAppointmentRequest[] =
      data?.map((row) => ({
        id: row.id,
        serviceType: "grooming",
        createdAt: row.created_at ?? new Date().toISOString(),
        startAt: row.start_at ?? null,
        endAt: row.end_at ?? null,
        customerId: row.customers?.id ?? null,
        customerName: row.customers?.full_name ?? null,
        customerPhone: row.customers?.phone ?? null,
        treatmentId: null,
        treatmentName: null,
        stationName: row.stations?.name ?? null,
        serviceLabel: row.services?.name ?? "תספורת",
        notes: row.customer_notes ?? null,
        appointmentKind:
          row.appointment_kind === "personal" || row.appointment_kind === "business"
            ? row.appointment_kind
            : "business",
      })) ?? []

    return new Response(JSON.stringify({ success: true, requests, meta: { returned: requests.length, totalFetched: requests.length, requestedLimit: limit } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("❌ [get-pending-appointment-requests] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
        requests: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
