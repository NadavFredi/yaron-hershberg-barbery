import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Type": "application/json",
}

const BUSINESS_TIME_ZONE = "Asia/Jerusalem"
const DEFAULT_GROOMING_DURATION_MINUTES = 60
const DEFAULT_GARDEN_DURATION_MINUTES = 8 * 60 // Full-day placeholder
const GARDEN_PLACEHOLDER_STATION_ID = "garden-default"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase configuration for reserve-appointment function")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

type AppointmentType = "grooming" | "garden" | "both"

interface ReservationRequest {
  treatmentId: string
  date: string
  stationId?: string
  startTime?: string
  notes?: string
  isTrial?: boolean
  appointmentType?: string
  latePickupRequested?: boolean
  latePickupNotes?: string
  gardenTrimNails?: boolean
  gardenBrush?: boolean
  gardenBath?: boolean
}

interface WebhookResponse {
  success: boolean
  data?: unknown
  error?: string
}

interface TreatmentRecord {
  id: string
  customer_id: string
  treatment_type_id: string | null
}

interface GroomingAppointmentRow {
  id: string
  start_at: string
  end_at: string
  station_id: string | null
}

interface DaycareAppointmentRow {
  id: string
  start_at: string
  end_at: string
  station_id: string | null
}

interface CombinedAppointmentRow {
  id: string
  grooming_appointment_id: string
  daycare_appointment_id: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 },
      )
    }

    const body: ReservationRequest = await req.json()
    let appointmentType: AppointmentType
    try {
      appointmentType = normalizeAppointmentType(body.appointmentType)
    } catch (typeError) {
      const message = typeError instanceof Error ? typeError.message : "Invalid appointmentType"
      return badRequest(message)
    }
    const requiresGrooming = appointmentType === "grooming" || appointmentType === "both"
    const requiresGarden = appointmentType === "garden" || appointmentType === "both"
    const baseStartTime = body.startTime?.trim()
    const effectiveStartTime = baseStartTime && baseStartTime.length > 0 ? baseStartTime : "09:00"

    if (!body.treatmentId || !body.date) {
      return badRequest("treatmentId and date are required")
    }

    if (requiresGrooming) {
      if (!baseStartTime) {
        return badRequest("startTime is required for grooming appointments")
      }
      if (!body.stationId || body.stationId === GARDEN_PLACEHOLDER_STATION_ID) {
        return badRequest("stationId is required for grooming appointments")
      }
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(body.date)) {
      return badRequest("Date must be in YYYY-MM-DD format")
    }

    const selectedDate = new Date(body.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      return badRequest("Cannot reserve appointments for past dates")
    }

    const treatment = await fetchTreatmentRecord(body.treatmentId)

    let groomingAppointment: GroomingAppointmentRow | null = null
    let daycareAppointment: DaycareAppointmentRow | null = null
    let combinedAppointment: CombinedAppointmentRow | null = null

    try {
      if (requiresGrooming) {
        groomingAppointment = await createGroomingAppointment(body, treatment)
      }

      if (requiresGarden) {
        daycareAppointment = await createDaycareAppointment(body, treatment, effectiveStartTime)
      }

      if (requiresGarden && requiresGrooming && groomingAppointment && daycareAppointment) {
        combinedAppointment = await linkCombinedAppointments(groomingAppointment.id, daycareAppointment.id)
      }
    } catch (creationError) {
      await cleanupCreatedAppointments(groomingAppointment, daycareAppointment)
      throw creationError
    }

    const webhookResponse = await callReservationWebhook({
      treatmentId: body.treatmentId,
      date: body.date,
      stationId: body.stationId,
      startTime: effectiveStartTime,
      notes: body.notes,
      isTrial: body.isTrial,
      appointmentType,
      latePickupRequested: body.latePickupRequested,
      latePickupNotes: body.latePickupNotes,
      gardenTrimNails: body.gardenTrimNails,
      gardenBrush: body.gardenBrush,
      gardenBath: body.gardenBath,
      groomingAppointmentId: groomingAppointment?.id,
      daycareAppointmentId: daycareAppointment?.id,
      combinedAppointmentId: combinedAppointment?.id,
    }).catch((error) => {
      console.error("Webhook error (non-blocking):", error)
      return { success: false, error: error.message || "Webhook call failed" }
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: buildSuccessMessage(requiresGrooming, requiresGarden),
        data: {
          groomingAppointment,
          daycareAppointment,
          combinedAppointment,
          webhook: webhookResponse,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error) {
    console.error("Error processing reservation:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    )
  }
})

function badRequest(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
  )
}

function normalizeAppointmentType(value?: string | null): AppointmentType {
  const normalized = (value ?? "grooming").toLowerCase()
  if (normalized === "grooming" || normalized === "garden" || normalized === "both") {
    return normalized
  }
  throw new Error(`Unsupported appointmentType: ${value}`)
}

const tzOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function getTimeZoneOffsetMinutes(date: Date): number {
  const parts = tzOffsetFormatter.formatToParts(date)
  const values: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value
    }
  }
  const adjustedUtcTime = Date.UTC(
    Number(values.year ?? "0"),
    Number(values.month ?? "1") - 1,
    Number(values.day ?? "1"),
    Number(values.hour ?? "0"),
    Number(values.minute ?? "0"),
    Number(values.second ?? "0"),
  )
  return (adjustedUtcTime - date.getTime()) / 60000
}

function toUtcDate(date: string, time: string): Date {
  const [yearStr, monthStr, dayStr] = date.split("-")
  const [hourStr, minuteStr] = time.split(":")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    throw new Error(`Invalid date or time provided (${date} ${time})`)
  }

  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (Number.isNaN(naiveUtc.getTime())) {
    throw new Error(`Invalid date or time provided (${date} ${time})`)
  }

  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc)
  const adjustedUtcMs = naiveUtc.getTime() - offsetMinutes * 60 * 1000
  return new Date(adjustedUtcMs)
}

function minutesToMs(minutes: number) {
  return minutes * 60 * 1000
}

async function fetchTreatmentRecord(treatmentId: string): Promise<TreatmentRecord> {
  const { data, error } = await supabase
    .from("treatments")
    .select("id, customer_id, treatment_type_id")
    .eq("id", treatmentId)
    .maybeSingle<TreatmentRecord>()

  if (error) {
    throw new Error(`Failed to fetch treatment: ${error.message}`)
  }

  if (!data) {
    throw new Error(`Treatment ${treatmentId} not found`)
  }

  if (!data.customer_id) {
    throw new Error(`Treatment ${treatmentId} is missing a customer reference`)
  }

  return data
}

async function calculateGroomingDurationMinutes(stationId: string, treatmentTypeId: string | null): Promise<number> {
  if (treatmentTypeId) {
    const { data, error } = await supabase
      .from("station_treatmentType_rules")
      .select("duration_modifier_minutes")
      .eq("station_id", stationId)
      .eq("treatment_type_id", treatmentTypeId)
      .eq("is_active", true)
      .maybeSingle<{ duration_modifier_minutes: number | null }>()

    if (error) {
      throw new Error(`Failed to fetch station treatmentType rule: ${error.message}`)
    }

    const minutes = data?.duration_modifier_minutes ?? 0
    if (minutes && minutes > 0) {
      return minutes
    }
  }

  const { data: baseRows, error: baseError } = await supabase
    .from("service_station_matrix")
    .select("base_time_minutes")
    .eq("station_id", stationId)
    .order("base_time_minutes", { ascending: true })
    .limit(1)

  if (baseError) {
    throw new Error(`Failed to fetch base duration: ${baseError.message}`)
  }

  const fallback = baseRows?.[0]?.base_time_minutes
  return fallback && fallback > 0 ? fallback : DEFAULT_GROOMING_DURATION_MINUTES
}

async function createGroomingAppointment(
  request: ReservationRequest,
  treatment: TreatmentRecord,
): Promise<GroomingAppointmentRow> {
  if (!request.stationId) {
    throw new Error("stationId is required for grooming appointments")
  }
  if (!request.startTime) {
    throw new Error("startTime is required for grooming appointments")
  }

  const startAt = toUtcDate(request.date, request.startTime)
  const durationMinutes = await calculateGroomingDurationMinutes(request.stationId, treatment.treatment_type_id)
  const endAt = new Date(startAt.getTime() + minutesToMs(durationMinutes))
  const requiresApproval = await doesTreatmentTypeRequireApprovalForStation(request.stationId, treatment.treatment_type_id)
  const status = requiresApproval ? "pending" : "approved"

  console.log("🔍 [createGroomingAppointment] Determined approval requirement:", {
    stationId: request.stationId,
    treatmentTypeId: treatment.treatment_type_id,
    requiresApproval,
    status,
  })

  const { data, error } = await supabase
    .from("grooming_appointments")
    .insert({
      customer_id: treatment.customer_id,
      treatment_id: treatment.id,
      station_id: request.stationId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status,
      payment_status: "unpaid",
      appointment_kind: "business",
      customer_notes: request.notes ?? null,
    })
    .select()
    .maybeSingle<GroomingAppointmentRow>()

  if (error) {
    throw new Error(`Failed to create grooming appointment: ${error.message}`)
  }

  if (!data) {
    throw new Error("Failed to create grooming appointment (no data returned)")
  }

  return data
}

async function doesTreatmentTypeRequireApprovalForStation(
  stationId: string | null | undefined,
  treatmentTypeId: string | null,
): Promise<boolean> {
  if (!stationId || !treatmentTypeId) {
    console.log("ℹ️ [createGroomingAppointment] Missing station or treatmentType, defaulting requiresApproval=false", {
      stationId,
      treatmentTypeId,
    })
    return false
  }

  const { data, error } = await supabase
    .from("station_treatmentType_rules")
    .select("requires_staff_approval")
    .eq("station_id", stationId)
    .eq("treatment_type_id", treatmentTypeId)
    .eq("is_active", true)
    .maybeSingle<{ requires_staff_approval: boolean | null }>()

  if (error) {
    console.error("❌ [createGroomingAppointment] Failed to check station treatmentType approval requirement", {
      stationId,
      treatmentTypeId,
      error,
    })
    throw new Error(`Failed to determine approval requirement: ${error.message}`)
  }

  const requiresApproval = Boolean(data?.requires_staff_approval)
  console.log("🔎 [createGroomingAppointment] Station treatmentType approval lookup result", {
    stationId,
    treatmentTypeId,
    requiresApproval,
  })
  return requiresApproval
}

async function createDaycareAppointment(
  request: ReservationRequest,
  treatment: TreatmentRecord,
  startTime: string,
): Promise<DaycareAppointmentRow> {
  const startAt = toUtcDate(request.date, startTime)
  const durationMinutes = DEFAULT_GARDEN_DURATION_MINUTES
  const endAt = new Date(startAt.getTime() + minutesToMs(durationMinutes))
  const stationId =
    request.stationId && request.stationId !== GARDEN_PLACEHOLDER_STATION_ID ? request.stationId : null
  const serviceType = request.isTrial ? "trial" : "full_day"

  const { data, error } = await supabase
    .from("daycare_appointments")
    .insert({
      customer_id: treatment.customer_id,
      treatment_id: treatment.id,
      station_id: stationId,
      status: "pending",
      payment_status: "unpaid",
      service_type: serviceType,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      late_pickup_requested: request.latePickupRequested ?? null,
      late_pickup_notes: request.latePickupNotes ?? null,
      garden_trim_nails: request.gardenTrimNails ?? null,
      garden_brush: request.gardenBrush ?? null,
      garden_bath: request.gardenBath ?? null,
      customer_notes: request.notes ?? null,
    })
    .select()
    .maybeSingle<DaycareAppointmentRow>()

  if (error) {
    throw new Error(`Failed to create daycare appointment: ${error.message}`)
  }

  if (!data) {
    throw new Error("Failed to create daycare appointment (no data returned)")
  }

  return data
}

async function linkCombinedAppointments(
  groomingId: string,
  daycareId: string,
): Promise<CombinedAppointmentRow> {
  const { data, error } = await supabase
    .from("combined_appointments")
    .insert({
      grooming_appointment_id: groomingId,
      daycare_appointment_id: daycareId,
    })
    .select()
    .maybeSingle<CombinedAppointmentRow>()

  if (error) {
    throw new Error(`Failed to link combined appointments: ${error.message}`)
  }

  if (!data) {
    throw new Error("Failed to create combined appointment mapping (no data returned)")
  }

  return data
}

async function cleanupCreatedAppointments(
  groomingAppointment: GroomingAppointmentRow | null,
  daycareAppointment: DaycareAppointmentRow | null,
) {
  if (groomingAppointment) {
    await supabase.from("grooming_appointments").delete().eq("id", groomingAppointment.id)
  }

  if (daycareAppointment) {
    await supabase.from("daycare_appointments").delete().eq("id", daycareAppointment.id)
  }
}

function buildSuccessMessage(grooming: boolean, garden: boolean) {
  if (grooming && garden) return "Grooming and garden appointments created successfully"
  if (grooming) return "Grooming appointment created successfully"
  if (garden) return "Garden appointment created successfully"
  return "Reservation processed successfully"
}

async function callReservationWebhook(payload: Record<string, unknown>): Promise<WebhookResponse> {
  const webhookUrl = "https://hook.eu2.make.com/2c3apygf8pu1bd9d1yx2cr9l6niuvcq9"

  console.log(`Calling webhook: ${webhookUrl}`)
  console.log("Payload:", payload)

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      timestamp: new Date().toISOString(),
      source: "wagtime-appointment-scheduler",
    }),
  })

  console.log(`Webhook response status: ${response.status}`)

  if (!response.ok) {
    throw new Error(`Webhook responded with status ${response.status}: ${response.statusText}`)
  }

  const contentType = response.headers.get("content-type")
  const responseData = contentType && contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  console.log("Webhook response data:", responseData)

  return {
    success: true,
    data: responseData,
  }
}
