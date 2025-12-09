import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const BUSINESS_TIME_ZONE = "Asia/Jerusalem"
const DEFAULT_DURATION_MINUTES = 60

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration for reserve-appointment")
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function toUtcDate(date: string, time: string): Date {
  // Ensure time formatting HH:mm
  const [hourStr, minuteStr] = (time || "00:00").split(":")
  const iso = `${date}T${hourStr?.padStart(2, "0") ?? "00"}:${minuteStr?.padStart(2, "0") ?? "00"}:00`
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid date/time: ${date} ${time}`)
  }
  return dt
}

async function resolveCustomerId(req: Request, explicitCustomerId?: string | null): Promise<string> {
  if (explicitCustomerId) return explicitCustomerId

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!authHeader) {
    throw new Error("customerId is required when no authenticated user is provided")
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError) {
    console.error("[reserve-appointment] Error getting user:", userError.message)
    throw new Error(`Unable to resolve authenticated user: ${userError.message}`)
  }

  if (!userData.user) {
    console.error("[reserve-appointment] No user data returned from getUser()")
    throw new Error("Unable to resolve authenticated user for customer mapping - invalid or expired token")
  }

  const authUserId = userData.user.id
  console.log(`[reserve-appointment] Resolving customer for authenticated user: ${authUserId}`)

  const { data: customer, error: customerError } = await adminClient
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  if (customerError) {
    console.error(`[reserve-appointment] Error querying customer:`, customerError.message)
    throw new Error(`Failed to resolve customer by user: ${customerError.message}`)
  }

  if (!customer?.id) {
    console.warn(
      `[reserve-appointment] No customer found for user ${authUserId}. User may need to complete profile setup.`
    )
    throw new Error("No customer record found for the authenticated user. Please ensure your profile is set up.")
  }

  console.log(`[reserve-appointment] Resolved customer ID: ${customer.id}`)
  return customer.id
}

async function getStationDuration(serviceId: string, stationId: string | null): Promise<number> {
  if (!stationId) return DEFAULT_DURATION_MINUTES

  const { data, error } = await adminClient
    .from("service_station_matrix")
    .select("base_time_minutes")
    .eq("service_id", serviceId)
    .eq("station_id", stationId)
    .eq("is_active", true)
    .maybeSingle<{ base_time_minutes: number | null }>()

  if (error) {
    console.warn("⚠️ [reserve-appointment] Failed to fetch service/station duration, using default", error.message)
    return DEFAULT_DURATION_MINUTES
  }

  const base = Number(data?.base_time_minutes ?? DEFAULT_DURATION_MINUTES)
  return Number.isFinite(base) && base > 0 ? base : DEFAULT_DURATION_MINUTES
}

async function stationRequiresApproval(serviceId: string, stationId: string | null): Promise<boolean> {
  if (!stationId) return false

  const { data, error } = await adminClient
    .from("service_station_matrix")
    .select("requires_staff_approval, remote_booking_allowed")
    .eq("service_id", serviceId)
    .eq("station_id", stationId)
    .maybeSingle<{ requires_staff_approval: boolean | null; remote_booking_allowed: boolean | null }>()

  if (error) {
    console.warn("⚠️ [reserve-appointment] Failed to check approval requirement, defaulting to false", error.message)
    return false
  }

  if (data && data.remote_booking_allowed === false) {
    throw new Error("This station/service combination cannot be booked remotely")
  }

  return Boolean(data?.requires_staff_approval)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const {
      serviceId: rawServiceId,
      treatmentId, // legacy name mapped to serviceId
      customerId: rawCustomerId,
      date,
      stationId,
      startTime,
      notes,
      appointmentKind,
      appointmentName,
    } = await req.json()

    const serviceId = (rawServiceId || treatmentId)?.toString()

    if (!serviceId) {
      throw new Error("serviceId is required")
    }

    if (!date || !startTime) {
      throw new Error("date and startTime are required")
    }

    if (!stationId) {
      throw new Error("stationId is required")
    }

    const customerId = await resolveCustomerId(req, rawCustomerId)

    const durationMinutes = await getStationDuration(serviceId, stationId)
    const startAt = toUtcDate(date, startTime)
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000)

    const requiresApproval = await stationRequiresApproval(serviceId, stationId)
    const status = requiresApproval ? "pending" : "scheduled"

    const { data: appointment, error: insertError } = await adminClient
      .from("appointments")
      .insert({
        customer_id: customerId,
        service_id: serviceId,
        station_id: stationId,
        status,
        payment_status: "unpaid",
        appointment_kind: appointmentKind ?? "business",
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        customer_notes: notes ?? null,
        appointment_name: appointmentName ?? null,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      throw new Error(`Failed to create appointment: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: requiresApproval ? "הפגישה ממתינה לאישור" : "נקבע תור בהצלחה",
        data: appointment,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error) {
    console.error("Error processing reservation:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
