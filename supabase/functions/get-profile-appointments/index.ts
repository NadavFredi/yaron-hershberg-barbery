import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable")
}

if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed. Use POST.",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  try {
    const body = await req.json()
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : ""

    if (!profileId) {
      throw new Error("profileId parameter is required")
    }

    const data = await getProfileAppointments(profileId)

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [get-profile-appointments] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

async function getProfileAppointments(profileId: string) {
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("id", profileId)
    .maybeSingle()

  if (customerError || !customer) {
    throw new Error(customerError?.message || `Customer with ID ${profileId} not found`)
  }

  const profileName = customer.full_name ?? "לקוח ללא שם"

  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select(
      `
        id,
        start_at,
        end_at,
        status,
        customer_notes,
        station_id,
        appointment_name,
        stations ( id, name ),
        services ( id, name )
      `
    )
    .eq("customer_id", profileId)
    .order("start_at", { ascending: false })

  if (appointmentsError) {
    throw new Error(appointmentsError.message)
  }

  const mapped = (appointments ?? []).map((appointment) => {
    const start = appointment.start_at ?? ""
    const end = appointment.end_at ?? start
    const startDate = start ? new Date(start) : null

    return {
      id: appointment.id,
      profileId,
      profileName,
      date: startDate ? startDate.toISOString().split("T")[0] : "",
      time: startDate ? startDate.toISOString().split("T")[1]?.slice(0, 5) ?? "" : "",
      service: appointment.services?.name ?? "שירות",
      status: appointment.status ?? "pending",
      stationId: appointment.station_id ?? "",
      notes: appointment.customer_notes ?? appointment.appointment_name ?? "",
      startDateTime: start,
      endDateTime: end,
      stationName: appointment.stations?.name ?? null,
    }
  })

  return { appointments: mapped }
}
