import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration for search-manager-schedule")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

type ManagerAppointment = {
  id: string
  serviceType: "grooming"
  stationId: string
  stationName: string
  startDateTime: string
  endDateTime: string
  status: string
  paymentStatus?: string
  notes: string
  internalNotes?: string
  treatments: { id: string; name: string }[]
  clientId?: string
  clientName?: string
  clientPhone?: string
  serviceLabel?: string
}

type ClientSearchResult = {
  id: string
  name: string
  phone?: string
  email?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const rawTerm = typeof body?.term === "string" ? body.term.trim() : ""
    const limit = typeof body?.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 20

    if (!rawTerm) {
      return new Response(JSON.stringify({ success: true, appointments: [], treatments: [], clients: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const likeValue = `%${rawTerm.replace(/[%_]/g, (c) => `\\${c}`)}%`

    const [appointmentsRes, clientsRes] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          `
          id,
          start_at,
          end_at,
          status,
          payment_status,
          customer_notes,
          internal_notes,
          customer_id,
          station_id,
          appointment_name,
          customers:customer_id(id, full_name, phone),
          stations:station_id(id, name),
          services:service_id(id, name)
        `,
        )
        .or(
          [
            `customer_notes.ilike.${likeValue}`,
            `internal_notes.ilike.${likeValue}`,
            `appointment_name.ilike.${likeValue}`,
          ].join(","),
        )
        .order("start_at", { ascending: false })
        .limit(limit),
      supabase
        .from("customers")
        .select("id, full_name, phone, email")
        .or([`full_name.ilike.${likeValue}`, `phone.ilike.${likeValue}`, `email.ilike.${likeValue}`].join(","))
        .limit(limit),
    ])

    if (appointmentsRes.error) {
      throw new Error(appointmentsRes.error.message)
    }
    if (clientsRes.error) {
      throw new Error(clientsRes.error.message)
    }

    const appointments: ManagerAppointment[] =
      appointmentsRes.data?.map((row) => ({
        id: row.id,
        serviceType: "grooming",
        stationId: row.station_id ?? "",
        stationName: row.stations?.name ?? "עמדה",
        startDateTime: row.start_at ?? "",
        endDateTime: row.end_at ?? "",
        status: row.status ?? "pending",
        paymentStatus: row.payment_status ?? undefined,
        notes: row.customer_notes ?? row.appointment_name ?? "",
        internalNotes: row.internal_notes ?? undefined,
        treatments: [],
        clientId: row.customers?.id ?? undefined,
        clientName: row.customers?.full_name ?? undefined,
        clientPhone: row.customers?.phone ?? undefined,
        serviceLabel: row.services?.name ?? "שירות",
      })) ?? []

    const clients: ClientSearchResult[] =
      clientsRes.data?.map((row) => ({
        id: row.id,
        name: row.full_name ?? "",
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
      })) ?? []

    return new Response(
      JSON.stringify({
        success: true,
        appointments,
        treatments: [],
        clients,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("❌ [search-manager-schedule] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
