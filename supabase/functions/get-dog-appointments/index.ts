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
    const dogId = typeof body?.dogId === "string" ? body.dogId.trim() : ""

    if (!dogId) {
      throw new Error("dogId parameter is required")
    }

    const data = await getDogAppointments(dogId)

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [get-dog-appointments] Error:", error)
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

async function getDogAppointments(dogId: string) {
  const { data: dog, error: dogError } = await supabase.from("dogs").select("name").eq("id", dogId).single()

  if (dogError || !dog) {
    throw new Error(dogError?.message || `Dog with ID ${dogId} not found`)
  }

  const dogName = dog.name ?? "לקוח ללא שם"

  const { data: appointments, error: appointmentsError } = await supabase
    .from("grooming_appointments")
    .select(
      `
        id,
        start_at,
        end_at,
        status,
        customer_notes,
        station_id,
        stations ( id, name )
      `
    )
    .eq("dog_id", dogId)
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
      dogId,
      dogName,
      date: startDate ? startDate.toISOString().split("T")[0] : "",
      time: startDate ? startDate.toISOString().split("T")[1]?.slice(0, 5) ?? "" : "",
      service: "grooming" as const,
      status: appointment.status ?? "pending",
      stationId: appointment.station_id ?? "",
      notes: appointment.customer_notes ?? "",
      startDateTime: start,
      endDateTime: end,
      stationName: appointment.stations?.name ?? null,
    }
  })

  return { appointments: mapped }
}
