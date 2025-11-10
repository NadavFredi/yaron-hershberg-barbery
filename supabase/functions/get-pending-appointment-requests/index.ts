import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error(
    "❌ [get-pending-appointment-requests] Missing Supabase environment variables",
    { hasUrl: Boolean(supabaseUrl), hasServiceRole: Boolean(serviceRoleKey), hasAnonKey: Boolean(anonKey) },
  )
  throw new Error("Missing Supabase environment configuration")
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const authClientFactory = (authHeader: string) =>
  createClient(supabaseUrl!, anonKey!, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

type ServiceType = "grooming" | "garden"

type PendingAppointmentRequest = {
  id: string
  serviceType: ServiceType
  createdAt: string
  startAt: string | null
  endAt: string | null
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  treatmentId: string | null
  treatmentName: string | null
  stationName: string | null
  serviceLabel: string | null
  notes: string | null
  appointmentKind?: "business" | "personal"
  questionnaireResult?: "not_required" | "pending" | "approved" | "rejected" | null
}

type GroomingRow = {
  id?: string
  created_at?: string
  start_at?: string
  end_at?: string
  status?: string
  customer_notes?: string | null
  appointment_kind?: string | null
  customers?: Record<string, unknown> | Record<string, unknown>[] | null
  treatments?: Record<string, unknown> | Record<string, unknown>[] | null
  stations?: Record<string, unknown> | Record<string, unknown>[] | null
  services?: Record<string, unknown> | Record<string, unknown>[] | null
}

type DaycareRow = {
  id?: string
  created_at?: string
  start_at?: string
  end_at?: string
  status?: string
  customer_notes?: string | null
  service_type?: string | null
  questionnaire_result?: string | null
  customers?: Record<string, unknown> | Record<string, unknown>[] | null
  treatments?: Record<string, unknown> | Record<string, unknown>[] | null
  stations?: Record<string, unknown> | Record<string, unknown>[] | null
}

const extractFirst = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null
  if (Array.isArray(value)) {
    return (value[0] as T) ?? null
  }
  return value as T
}

const normalizeAppointmentKind = (value: unknown): "business" | "personal" | undefined => {
  if (typeof value !== "string") {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "personal") {
    return "personal"
  }
  if (normalized === "business") {
    return "business"
  }
  return undefined
}

const normalizeQuestionnaireResult = (
  value: unknown,
): "not_required" | "pending" | "approved" | "rejected" | null => {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "not_required" || normalized === "pending" || normalized === "approved" || normalized === "rejected") {
    return normalized
  }
  return null
}

const mapGroomingRow = (row: GroomingRow): PendingAppointmentRequest | null => {
  if (!row?.id || row.status !== "pending") {
    return null
  }

  const customer = extractFirst<Record<string, unknown>>(row.customers)
  const treatment = extractFirst<Record<string, unknown>>(row.treatments)
  const station = extractFirst<Record<string, unknown>>(row.stations)
  const service = extractFirst<Record<string, unknown>>(row.services)

  return {
    id: String(row.id),
    serviceType: "grooming",
    createdAt: row.created_at ?? new Date().toISOString(),
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    customerId: customer?.id ? String(customer.id) : null,
    customerName: typeof customer?.full_name === "string" ? customer.full_name : null,
    customerPhone: typeof customer?.phone === "string" ? customer.phone : null,
    treatmentId: treatment?.id ? String(treatment.id) : null,
    treatmentName: typeof treatment?.name === "string" ? treatment.name : null,
    stationName: typeof station?.name === "string" ? (station.name as string) : null,
    serviceLabel: typeof service?.name === "string" ? (service.name as string) : "מספרה",
    notes: row.customer_notes ?? null,
    appointmentKind: normalizeAppointmentKind(row.appointment_kind),
  }
}

const mapDaycareRow = (row: DaycareRow): PendingAppointmentRequest | null => {
  if (!row?.id || row.status !== "pending") {
    return null
  }

  const customer = extractFirst<Record<string, unknown>>(row.customers)
  const treatment = extractFirst<Record<string, unknown>>(row.treatments)
  const station = extractFirst<Record<string, unknown>>(row.stations)

  const serviceLabel = (() => {
    const raw = typeof row.service_type === "string" ? row.service_type.trim().toLowerCase() : ""
    switch (raw) {
      case "hourly":
        return "גן - לפי שעה"
      case "trial":
        return "גן - ניסיון"
      case "full_day":
        return "גן - יום שלם"
      default:
        return "גן"
    }
  })()

  return {
    id: String(row.id),
    serviceType: "garden",
    createdAt: row.created_at ?? new Date().toISOString(),
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    customerId: customer?.id ? String(customer.id) : null,
    customerName: typeof customer?.full_name === "string" ? customer.full_name : null,
    customerPhone: typeof customer?.phone === "string" ? customer.phone : null,
    treatmentId: treatment?.id ? String(treatment.id) : null,
    treatmentName: typeof treatment?.name === "string" ? treatment.name : null,
    stationName: typeof station?.name === "string" ? (station.name as string) : "גן הכלבים",
    serviceLabel,
    notes: row.customer_notes ?? null,
    questionnaireResult: normalizeQuestionnaireResult(row.questionnaire_result),
  }
}

const clampLimit = (rawLimit: unknown): number => {
  if (typeof rawLimit === "number" && Number.isFinite(rawLimit)) {
    return Math.min(Math.max(Math.trunc(rawLimit), 1), 20)
  }
  if (typeof rawLimit === "string") {
    const parsed = Number.parseInt(rawLimit, 10)
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 1), 20)
    }
  }
  return 5
}

const isMissingTableError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "PGRST205"

const fetchGroomingRequests = async (limit: number): Promise<PendingAppointmentRequest[]> => {
  const { data, error } = await serviceClient
    .from("grooming_appointments")
    .select(
      `
        id,
        created_at,
        start_at,
        end_at,
        status,
        customer_notes,
        appointment_kind,
        customers (
          id,
          full_name,
          phone
        ),
        treatments (
          id,
          name
        ),
        stations (
          id,
          name
        ),
        services (
          id,
          name
        )
      `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit * 2)

  if (error) {
    if (isMissingTableError(error)) {
      console.warn("⚠️ [get-pending-appointment-requests] grooming_appointments table not found, returning empty list")
      return []
    }
    throw error
  }

  return (data ?? []).map((row) => mapGroomingRow(row as GroomingRow)).filter(Boolean) as PendingAppointmentRequest[]
}

const fetchDaycareRequests = async (limit: number): Promise<PendingAppointmentRequest[]> => {
  const { data, error } = await serviceClient
    .from("daycare_appointments")
    .select(
      `
        id,
        created_at,
        start_at,
        end_at,
        status,
        customer_notes,
        service_type,
        questionnaire_result,
        customers (
          id,
          full_name,
          phone
        ),
        treatments (
          id,
          name
        ),
        stations (
          id,
          name
        )
      `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit * 2)

  if (error) {
    if (isMissingTableError(error)) {
      console.warn("⚠️ [get-pending-appointment-requests] daycare_appointments table not found, returning empty list")
      return []
    }
    throw error
  }

  return (data ?? []).map((row) => mapDaycareRow(row as DaycareRow)).filter(Boolean) as PendingAppointmentRequest[]
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

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    console.warn("⚠️ [get-pending-appointment-requests] Missing Authorization header")
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const authClient = authClientFactory(authHeader)
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      console.warn("⚠️ [get-pending-appointment-requests] Auth check failed", { authError })
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("🔐 [get-pending-appointment-requests] Authenticated user", { userId: user.id })

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("❌ [get-pending-appointment-requests] Failed to load profile", profileError)
      return new Response(
        JSON.stringify({ success: false, error: "שגיאה בטעינת פרטי המשתמש. אנא נסה שוב מאוחר יותר." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    if (!profile || profile.role !== "manager") {
      console.warn("⚠️ [get-pending-appointment-requests] Access denied - not a manager", {
        userId: user.id,
        role: profile?.role,
      })
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const limit = clampLimit(body?.limit)

    console.log("🔔 [get-pending-appointment-requests] Fetching pending requests", {
      userId: user.id,
      managerName: profile.full_name ?? null,
      limit,
    })

    const [groomingRequests, daycareRequests] = await Promise.all([
      fetchGroomingRequests(limit),
      fetchDaycareRequests(limit),
    ])

    const combined = [...groomingRequests, ...daycareRequests].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const limited = combined.slice(0, limit)

    console.log("✅ [get-pending-appointment-requests] Returning results", {
      totalFetched: combined.length,
      returned: limited.length,
      groomingCount: groomingRequests.length,
      daycareCount: daycareRequests.length,
    })

    return new Response(
      JSON.stringify({
        data: {
          requests: limited,
          meta: {
            totalFetched: combined.length,
            returned: limited.length,
            requestedLimit: limit,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("❌ [get-pending-appointment-requests] Unexpected error", error)
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error"
    return new Response(
      JSON.stringify({
        success: false,
        error: "אירעה שגיאה בעת טעינת הבקשות. נסה שוב בעוד מספר דקות.",
        details: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})

