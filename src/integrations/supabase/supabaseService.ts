import { supabase } from "./client"
import type { Database } from "./types"
import { normalizePhone } from "@/utils/phone"
import { isAuthError, handleInvalidToken } from "@/utils/auth"
import { HttpError } from "@/utils/errorMessages"
import type {
  ManagerScheduleData,
  ManagerAppointment,
  ManagerStation,
  ManagerTreatment,
  ManagerServiceFilter,
  ManagerScheduleSearchResponse,
  ManagerScheduleTreatmentSearchResult,
  ManagerScheduleSearchClient,
} from "@/types/managerSchedule"
import type { ProposedMeetingPublicDetails } from "@/types/proposedMeeting"

type TreatmentTableRow = Database["public"]["Tables"]["treatments"]["Row"]
type TreatmentTypeSummary = Pick<
  Database["public"]["Tables"]["treatmentTypes"]["Row"],
  "name" | "size_class" | "min_groom_price" | "max_groom_price"
>
type TreatmentRowWithTreatmentType = TreatmentTableRow & { treatmentTypes: TreatmentTypeSummary | null }
type DaycareAppointmentSummary = Pick<Database["public"]["Tables"]["daycare_appointments"]["Row"], "treatment_id" | "status">
type GroomingAppointmentSummary = Pick<
  Database["public"]["Tables"]["grooming_appointments"]["Row"],
  "treatment_id" | "status"
>
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]
type CustomerTypeRow = Database["public"]["Tables"]["customer_types"]["Row"]
type ProposedMeetingRow = Database["public"]["Tables"]["proposed_meetings"]["Row"] & {
  stations?: { id: string; name: string } | { id: string; name: string }[] | null
  proposed_meeting_invites?: ProposedMeetingInviteRow[] | null
  proposed_meeting_categories?: ProposedMeetingCategoryRow[] | null
}
type ProposedMeetingInviteRow = Database["public"]["Tables"]["proposed_meeting_invites"]["Row"] & {
  customers?:
    | (CustomerRow & { customer_type?: Pick<CustomerTypeRow, "name"> | null })
    | (CustomerRow & {
        customer_type?: Pick<CustomerTypeRow, "name"> | null
      })[]
    | null
}
type ProposedMeetingCategoryRow = Database["public"]["Tables"]["proposed_meeting_categories"]["Row"] & {
  customer_type?: Pick<CustomerTypeRow, "name"> | null
}

const PROPOSED_MEETING_WEBHOOK_URL = "https://hook.eu2.make.com/4vndwatkc4r648au3t1mc394gh73pfny"
const PROPOSED_MEETING_CODE_ATTEMPTS = 5

const asSingle = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

export interface TreatmentRecord {
  id: string
  name: string
  treatmentType: string
  size: string
  isSmall: boolean
  ownerId: string
  hasAppointmentHistory?: boolean
  hasBeenToGarden?: boolean
  // Garden suitability fields
  questionnaireSuitableForGarden?: boolean // האם נמצא מתאים לגן מהשאלון
  staffApprovedForGarden?: string // האם מתאים לגן מילוי צוות (נמצא מתאים/נמצא לא מתאים/empty)
  hasRegisteredToGardenBefore?: boolean // האם הכלב נרשם בעבר לגן
  requiresSpecialApproval?: boolean
  groomingMinPrice?: number | null
  groomingMaxPrice?: number | null
}

export interface AppointmentRecord {
  id: string
  treatmentId: string
  date: string
  time: string
  service: string
  status: string
}

export interface AvailableDate {
  date: string
  available: boolean
  slots: number
  stationId: string
  availableTimes: AvailableTime[] // Add this to include cached time slots
}

export interface AvailableTime {
  time: string
  available: boolean
  duration: number
  stationId: string
}

export interface GardenQuestionnaireStatus {
  required: boolean
  completed: boolean
  formUrl?: string
  message?: string
}

export interface AvailableDatesResult {
  availableDates: AvailableDate[]
  gardenQuestionnaire?: GardenQuestionnaireStatus
}

export interface TreatmentRegistrationStatus {
  isRegistered: boolean
  registrationDate: string
  treatmentId: string
}

export interface MergedAppointment {
  id: string
  treatmentId: string
  treatmentName?: string
  date: string
  time: string
  service: "grooming" | "garden" | "both"
  status: string
  stationId?: string
  notes?: string
  groomingNotes?: string
  gardenNotes?: string
  groomingStatus?: string
  gardenStatus?: string
  startDateTime: string
  endDateTime: string
  groomingAppointmentId?: string
  gardenAppointmentId?: string
  latePickupRequested?: boolean
  latePickupNotes?: string
  gardenTrimNails?: boolean
  gardenBrush?: boolean
  gardenBath?: boolean
}

export interface ClientProfile {
  id: string
  fullName: string | null
  phone: string | null
  email: string | null
  address: string | null
  customerTypeId?: string | null
  customerTypeName?: string | null
}

async function hasTreatmentAppointmentHistory(treatmentId: string): Promise<boolean> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  if (!treatmentId) {
    throw new Error("treatmentId is required")
  }

  const [{ count: groomingCount, error: groomingError }, { count: daycareCount, error: daycareError }] =
    await Promise.all([
      supabase.from("grooming_appointments").select("id", { count: "exact", head: true }).eq("treatment_id", treatmentId),
      supabase.from("daycare_appointments").select("id", { count: "exact", head: true }).eq("treatment_id", treatmentId),
    ])

  if (groomingError) {
    console.error("❌ [hasTreatmentAppointmentHistory] Failed to check grooming appointments", groomingError)
    throw groomingError
  }

  if (daycareError) {
    console.error("❌ [hasTreatmentAppointmentHistory] Failed to check daycare appointments", daycareError)
    throw daycareError
  }

  const totalAppointments = (groomingCount ?? 0) + (daycareCount ?? 0)
  return totalAppointments > 0
}

// Generic function to call Supabase Edge Functions
async function callSupabaseFunction(functionName: string, params: Record<string, any> = {}) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

    if (!supabaseUrl) {
      throw new Error("VITE_SUPABASE_URL environment variable is not set")
    }

    // Check if we're running locally or in production
    const isLocal = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")

    if (isLocal) {
      // Call local Edge Functions directly via HTTP
      return await callLocalFunction(functionName, params, supabaseUrl)
    } else {
      // Call production Edge Functions via Supabase client
      return await callProductionFunction(functionName, params)
    }
  } catch (error) {
    console.error(`Error calling Supabase function ${functionName}:`, error)
    throw error
  }
}

// Call local Edge Functions via HTTP
async function callLocalFunction(functionName: string, params: Record<string, any> = {}, host: string) {
  try {
    const url = `${host}/functions/v1/${functionName}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(`API error: ${data.error}`)
    }

    return data
  } catch (error) {
    console.error(`Error calling local function ${functionName}:`, error)
    throw error
  }
}

// Call production Edge Functions via Supabase client
async function callProductionFunction(functionName: string, params: Record<string, any> = {}) {
  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: params,
    })

    if (error) {
      throw new Error(`Supabase function error: ${error.message}`)
    }

    if (!data.success) {
      throw new Error(`API error: ${data.error}`)
    }

    return data
  } catch (error) {
    console.error(`Error calling production function ${functionName}:`, error)
    throw error
  }
}

// 1. List all treatments of owner
export async function listOwnerTreatments(ownerId: string): Promise<{ treatments: TreatmentRecord[] }> {
  // verbose log removed
  if (!ownerId) {
    console.error("❌ [listOwnerTreatments] ownerId is required")
    throw new Error("ownerId is required")
  }

  if (!supabase) {
    console.error("❌ [listOwnerTreatments] Supabase client not initialized")
    throw new Error("Supabase client not initialized")
  }

  const { data: treatmentRows, error } = await supabase
    .from("treatments")
    .select(
      `
      id,
      name,
      is_small,
      customer_id,
      questionnaire_result,
      treatmentTypes:treatment_types (
        id,
        name,
        size_class:default_duration_minutes,
        min_groom_price:default_price,
        max_groom_price:default_price,
        color_hex
      )
    `
    )
    .eq("customer_id", ownerId)
    .order("name", { ascending: true })

  if (error) {
    console.error("❌ [listOwnerTreatments] Failed to load owner treatments:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      ownerId,
    })
    throw error
  }

  const typedTreatmentRows = (treatmentRows ?? []) as TreatmentRowWithTreatmentType[]
  const treatmentIds = typedTreatmentRows.map((treatment) => treatment.id)

  // Get all unique treatmentType IDs from the treatments
  const treatmentTypeIds = [...new Set(typedTreatmentRows.map((treatment) => treatment.treatment_type_id).filter(Boolean) as string[])]

  // Fetch station_treatmentType_rules for all treatmentTypes to calculate requires_staff_approval
  let treatmentTypeRequiresApproval: Record<string, boolean> = {}
  if (treatmentTypeIds.length > 0) {
    // verbose log removed
    const { data: stationTreatmentTypeRules, error: rulesError } = await supabase
      .from("station_treatmentType_rules")
      .select("treatment_type_id, is_active, requires_staff_approval")
      .in("treatment_type_id", treatmentTypeIds)
      .eq("is_active", true)
      .eq("requires_staff_approval", true)

    if (rulesError) {
      console.error("❌ [listOwnerTreatments] Failed to load station_treatmentType_rules:", {
        error: rulesError,
        message: rulesError.message,
        treatmentTypeIds,
      })
      // Don't throw - just continue with false values
    } else {
      // verbose log removed

      // If any active station requires approval for a treatmentType, mark that treatmentType as requiring approval
      const treatmentTypesWithApproval = new Set(
        (stationTreatmentTypeRules ?? []).map((rule) => rule.treatment_type_id).filter(Boolean) as string[]
      )
      treatmentTypeIds.forEach((treatmentTypeId) => {
        treatmentTypeRequiresApproval[treatmentTypeId] = treatmentTypesWithApproval.has(treatmentTypeId)
      })
    }
  }

  let daycareVisitsByTreatment: Record<string, boolean> = {}
  let appointmentHistoryByTreatment: Record<string, boolean> = {}
  if (treatmentIds.length > 0) {
    const { data: daycareRows, error: daycareError } = await supabase
      .from("daycare_appointments")
      .select("treatment_id, status")
      .in("treatment_id", treatmentIds)

    if (daycareError) {
      console.error("❌ [listOwnerTreatments] Failed to load daycare appointments for treatments:", {
        error: daycareError,
        message: daycareError.message,
        details: daycareError.details,
        hint: daycareError.hint,
        code: daycareError.code,
        treatmentIds,
      })
      throw daycareError
    }

    const typedDaycareRows = (daycareRows ?? []) as DaycareAppointmentSummary[]
    daycareVisitsByTreatment = typedDaycareRows.reduce<Record<string, boolean>>((acc, row) => {
      if (!row?.treatment_id) {
        return acc
      }

      appointmentHistoryByTreatment[row.treatment_id] = true

      const isCompletedAppointment = row.status === "approved" || row.status === "matched" || row.status === "pending"

      if (isCompletedAppointment) {
        acc[row.treatment_id] = true
      }

      return acc
    }, {})
  }

  if (treatmentIds.length > 0) {
    // verbose log removed
    const { data: groomingRows, error: groomingError } = await supabase
      .from("grooming_appointments")
      .select("treatment_id, status")
      .in("treatment_id", treatmentIds)

    if (groomingError) {
      console.error("❌ [listOwnerTreatments] Failed to load grooming appointments for treatments:", {
        error: groomingError,
        message: groomingError.message,
        details: groomingError.details,
        hint: groomingError.hint,
        code: groomingError.code,
        treatmentIds,
      })
      throw groomingError
    }

    const typedGroomingRows = (groomingRows ?? []) as GroomingAppointmentSummary[]
    typedGroomingRows.forEach((row) => {
      if (row?.treatment_id) {
        appointmentHistoryByTreatment[row.treatment_id] = true
      }
    })

    // verbose log removed
  }

  const treatments: TreatmentRecord[] = typedTreatmentRows.map((treatment) => {
    const treatmentTypeInfo = treatment.treatmentTypes

    let questionnaireSuitableForGarden: boolean | undefined
    let staffApprovedForGarden = ""

    switch (treatment.questionnaire_result) {
      case "approved":
        questionnaireSuitableForGarden = true
        staffApprovedForGarden = "נמצא מתאים"
        break
      case "rejected":
        questionnaireSuitableForGarden = false
        staffApprovedForGarden = "נמצא לא מתאים"
        break
      default:
        questionnaireSuitableForGarden = undefined
        staffApprovedForGarden = ""
    }

    const hasGardenHistory = Boolean(daycareVisitsByTreatment[treatment.id])
    const hasAppointmentHistory = Boolean(appointmentHistoryByTreatment[treatment.id])

    // Determine size: prefer treatmentType size_class, fallback to is_small field
    let sizeDisplay = treatmentTypeInfo?.size_class ?? ""
    if (!sizeDisplay && treatment.is_small !== null && treatment.is_small !== undefined) {
      sizeDisplay = treatment.is_small ? "קטן" : "גדול"
    }
    if (!sizeDisplay) {
      sizeDisplay = "לא צוין"
    }

    return {
      id: treatment.id,
      name: treatment.name ?? "",
      treatmentType: treatmentTypeInfo?.name ?? "",
      size: sizeDisplay,
      isSmall: Boolean(treatment.is_small),
      ownerId: treatment.customer_id,
      hasAppointmentHistory,
      hasBeenToGarden: hasGardenHistory,
      questionnaireSuitableForGarden,
      staffApprovedForGarden,
      hasRegisteredToGardenBefore: hasGardenHistory,
      requiresSpecialApproval: Boolean(treatment.treatment_type_id && treatmentTypeRequiresApproval[treatment.treatment_type_id]),
      groomingMinPrice: typeof treatmentTypeInfo?.min_groom_price === "number" ? Number(treatmentTypeInfo.min_groom_price) : null,
      groomingMaxPrice: typeof treatmentTypeInfo?.max_groom_price === "number" ? Number(treatmentTypeInfo.max_groom_price) : null,
    }
  })

  return { treatments }
}

// Create a new treatment
export async function createTreatment(
  customerId: string,
  treatmentData: {
    name: string
    treatment_type_id?: string | null
    gender?: "male" | "female"
    birth_date?: string | null
    health_notes?: string | null
    vet_name?: string | null
    vet_phone?: string | null
    aggression_risk?: boolean | null
    people_anxious?: boolean | null
  }
): Promise<{ success: boolean; treatmentId?: string; error?: string }> {
  // verbose log removed

  if (!supabase) {
    console.error("❌ [createTreatment] Supabase client not initialized")
    throw new Error("Supabase client not initialized")
  }

  if (!customerId) {
    console.error("❌ [createTreatment] customerId is required")
    throw new Error("customerId is required")
  }

  if (!treatmentData.name || treatmentData.name.trim().length === 0) {
    console.error("❌ [createTreatment] Treatment name is required")
    throw new Error("Treatment name is required")
  }

  const insertPayload: Database["public"]["Tables"]["treatments"]["Insert"] = {
    customer_id: customerId,
    name: treatmentData.name.trim(),
    treatment_type_id: treatmentData.treatment_type_id ?? null,
    ...(treatmentData.gender && { gender: treatmentData.gender }),
    ...(treatmentData.birth_date && { birth_date: treatmentData.birth_date }),
    ...(treatmentData.health_notes && { health_notes: treatmentData.health_notes.trim() }),
    ...(treatmentData.vet_name && { vet_name: treatmentData.vet_name.trim() }),
    ...(treatmentData.vet_phone && { vet_phone: treatmentData.vet_phone.trim() }),
    ...(treatmentData.aggression_risk !== undefined && { aggression_risk: treatmentData.aggression_risk }),
    ...(treatmentData.people_anxious !== undefined && { people_anxious: treatmentData.people_anxious }),
  }

  // verbose log removed

  const { data: newTreatment, error } = await supabase.from("treatments").insert(insertPayload).select("id").single()

  if (error) {
    console.error("❌ [createTreatment] Failed to create treatment:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })

    // Check if this is an authentication/authorization error
    if (isAuthError(error)) {
      console.warn("🔒 [createTreatment] Auth error detected, logging out...", error)
      handleInvalidToken()
      return {
        success: false,
        error: "Session expired. Please log in again.",
      }
    }

    return {
      success: false,
      error: error.message || "Failed to create treatment",
    }
  }

  // verbose log removed

  return {
    success: true,
    treatmentId: newTreatment.id,
  }
}

// Get a single treatment by ID with all fields
export async function getTreatmentById(treatmentId: string): Promise<{
  success: boolean
  treatment?: {
    id: string
    name: string
    treatment_type_id: string | null
    gender: "male" | "female"
    birth_date: string | null
    is_small: boolean | null
    health_notes: string | null
    vet_name: string | null
    vet_phone: string | null
    aggression_risk: boolean | null
    people_anxious: boolean | null
    customer_id: string
  }
  error?: string
}> {
  // verbose log removed

  if (!supabase) {
    console.error("❌ [getTreatmentById] Supabase client not initialized")
    throw new Error("Supabase client not initialized")
  }

  if (!treatmentId) {
    console.error("❌ [getTreatmentById] treatmentId is required")
    throw new Error("treatmentId is required")
  }

  const { data: treatment, error } = await supabase.from("treatments").select("*").eq("id", treatmentId).single()

  if (error) {
    console.error("❌ [getTreatmentById] Failed to fetch treatment:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      treatmentId,
    })
    return {
      success: false,
      error: error.message || "Failed to fetch treatment",
    }
  }

  if (!treatment) {
    return {
      success: false,
      error: "Treatment not found",
    }
  }

  // verbose log removed

  return {
    success: true,
    treatment: {
      id: treatment.id,
      name: treatment.name,
      treatment_type_id: treatment.treatment_type_id,
      gender: treatment.gender,
      birth_date: treatment.birth_date,
      is_small: treatment.is_small,
      health_notes: treatment.health_notes,
      vet_name: treatment.vet_name,
      vet_phone: treatment.vet_phone,
      aggression_risk: treatment.aggression_risk,
      people_anxious: treatment.people_anxious,
      customer_id: treatment.customer_id,
    },
  }
}

// Update an existing treatment
export async function updateTreatment(
  treatmentId: string,
  treatmentData: {
    name?: string
    treatment_type_id?: string
    gender?: "male" | "female"
    birth_date?: string | null
    health_notes?: string | null
    vet_name?: string | null
    vet_phone?: string | null
    aggression_risk?: boolean | null
    people_anxious?: boolean | null
  }
): Promise<{ success: boolean; error?: string }> {
  // verbose log removed

  if (!supabase) {
    console.error("❌ [updateTreatment] Supabase client not initialized")
    throw new Error("Supabase client not initialized")
  }

  if (!treatmentId) {
    console.error("❌ [updateTreatment] treatmentId is required")
    throw new Error("treatmentId is required")
  }

  const { data: existingTreatment, error: existingTreatmentError } = await supabase
    .from("treatments")
    .select("treatment_type_id")
    .eq("id", treatmentId)
    .maybeSingle()

  if (existingTreatmentError) {
    console.error("❌ [updateTreatment] Failed to load current treatment state:", existingTreatmentError)
    throw existingTreatmentError
  }

  const updatePayload: Database["public"]["Tables"]["treatments"]["Update"] = {}

  if (treatmentData.name !== undefined) {
    if (!treatmentData.name || treatmentData.name.trim().length === 0) {
      throw new Error("Treatment name cannot be empty")
    }
    updatePayload.name = treatmentData.name.trim()
  }

  if (treatmentData.treatment_type_id !== undefined) {
    const normalizedTreatmentTypeId = treatmentData.treatment_type_id || null
    const existingTreatmentTypeId = existingTreatment?.treatment_type_id ?? null
    const isTreatmentTypeChanging = normalizedTreatmentTypeId !== existingTreatmentTypeId

    if (isTreatmentTypeChanging) {
      const hasHistory = await hasTreatmentAppointmentHistory(treatmentId)
      if (hasHistory) {
        throw new Error("לא ניתן לשנות גזע לכלב שכבר הוזמנו לו תורים")
      }
    }

    updatePayload.treatment_type_id = normalizedTreatmentTypeId
  }
  if (treatmentData.gender !== undefined) {
    updatePayload.gender = treatmentData.gender
  }
  if (treatmentData.birth_date !== undefined) {
    updatePayload.birth_date = treatmentData.birth_date || null
  }
  if (treatmentData.health_notes !== undefined) {
    updatePayload.health_notes = treatmentData.health_notes?.trim() || null
  }
  if (treatmentData.vet_name !== undefined) {
    updatePayload.vet_name = treatmentData.vet_name?.trim() || null
  }
  if (treatmentData.vet_phone !== undefined) {
    updatePayload.vet_phone = treatmentData.vet_phone?.trim() || null
  }
  if (treatmentData.aggression_risk !== undefined) {
    updatePayload.aggression_risk = treatmentData.aggression_risk
  }
  if (treatmentData.people_anxious !== undefined) {
    updatePayload.people_anxious = treatmentData.people_anxious
  }

  if (Object.keys(updatePayload).length === 0) {
    console.warn("⚠️ [updateTreatment] No fields to update")
    return { success: true }
  }

  const { error } = await supabase.from("treatments").update(updatePayload).eq("id", treatmentId)

  if (error) {
    console.error("❌ [updateTreatment] Failed to update treatment:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    return {
      success: false,
      error: error.message || "Failed to update treatment",
    }
  }

  return {
    success: true,
  }
}

// 2. Check if treatment is already registered
export async function checkTreatmentRegistration(treatmentId: string): Promise<TreatmentRegistrationStatus> {
  const result = await callSupabaseFunction("check-treatment-registration", { treatmentId })
  return result.data || result
}

// 3. Show all appointments for treatment ID
export async function getTreatmentAppointments(treatmentId: string): Promise<{ appointments: AppointmentRecord[] }> {
  const result = await callSupabaseFunction("get-treatment-appointments", { treatmentId })
  return result.data || result
}

// Get merged appointments directly from Supabase (grooming + garden combined)
export async function getMergedAppointments(treatmentId: string): Promise<{ appointments: MergedAppointment[] }> {
  try {
    // Get treatment name for the appointments
    const { data: treatment, error: treatmentError } = await supabase.from("treatments").select("name").eq("id", treatmentId).single()

    if (treatmentError || !treatment) {
      throw new Error(`Treatment with ID ${treatmentId} not found: ${treatmentError?.message || "Unknown error"}`)
    }

    const treatmentName = treatment.name

    // Fetch grooming and daycare appointments for this treatment
    const [groomingResult, daycareResult, combinedResult] = await Promise.all([
      supabase
        .from("grooming_appointments")
        .select("id, status, station_id, start_at, end_at, customer_notes, internal_notes")
        .eq("treatment_id", treatmentId),
      supabase
        .from("daycare_appointments")
        .select(
          "id, status, station_id, start_at, end_at, customer_notes, internal_notes, late_pickup_requested, late_pickup_notes, garden_trim_nails, garden_brush, garden_bath"
        )
        .eq("treatment_id", treatmentId),
      supabase.from("combined_appointments").select("grooming_appointment_id, daycare_appointment_id"),
    ])

    if (groomingResult.error) {
      throw new Error(`Failed to fetch grooming appointments: ${groomingResult.error.message}`)
    }
    if (daycareResult.error) {
      throw new Error(`Failed to fetch daycare appointments: ${daycareResult.error.message}`)
    }
    if (combinedResult.error) {
      throw new Error(`Failed to fetch combined appointments: ${combinedResult.error.message}`)
    }

    const groomingAppointments = groomingResult.data || []
    const daycareAppointments = daycareResult.data || []
    const combinedAppointments = combinedResult.data || []

    // Create maps to track combined appointments
    const combinedMap = new Map<string, string>() // Maps grooming_id -> daycare_id
    combinedAppointments.forEach((ca) => {
      if (ca.grooming_appointment_id && ca.daycare_appointment_id) {
        combinedMap.set(ca.grooming_appointment_id, ca.daycare_appointment_id)
      }
    })

    // Group appointments by date (YYYY-MM-DD)
    const formatDateKey = (date: string) => new Date(date).toISOString().split("T")[0]
    const groomingByDate = new Map<string, (typeof groomingAppointments)[0]>()
    const daycareByDate = new Map<string, (typeof daycareAppointments)[0]>()

    groomingAppointments.forEach((apt) => {
      const dateKey = formatDateKey(apt.start_at)
      groomingByDate.set(dateKey, apt)
    })

    daycareAppointments.forEach((apt) => {
      const dateKey = formatDateKey(apt.start_at)
      daycareByDate.set(dateKey, apt)
    })

    // Get all unique dates
    const allDates = new Set<string>()
    groomingByDate.forEach((_, date) => allDates.add(date))
    daycareByDate.forEach((_, date) => allDates.add(date))

    const mergedAppointments: MergedAppointment[] = []

    for (const dateKey of Array.from(allDates).sort()) {
      const groomingAppt = groomingByDate.get(dateKey)
      const daycareAppt = daycareByDate.get(dateKey)

      if (groomingAppt && daycareAppt) {
        // Both appointments on the same day - create "both" type
        const groomingStart = new Date(groomingAppt.start_at)
        const daycareStart = new Date(daycareAppt.start_at)
        const appointmentStart = groomingStart < daycareStart ? groomingStart : daycareStart

        const groomingEnd = new Date(groomingAppt.end_at)
        const daycareEnd = new Date(daycareAppt.end_at)
        const appointmentEnd = new Date(Math.max(groomingEnd.getTime(), daycareEnd.getTime()))

        // Format date and time
        const date = dateKey
        const time = appointmentStart.toTimeString().slice(0, 5) // HH:MM format

        mergedAppointments.push({
          id: `combined-${groomingAppt.id}-${daycareAppt.id}`,
          treatmentId,
          treatmentName,
          date,
          time,
          service: "both",
          status:
            groomingAppt.status === "cancelled" || daycareAppt.status === "cancelled"
              ? "cancelled"
              : groomingAppt.status,
          stationId: groomingAppt.station_id || daycareAppt.station_id || undefined,
          notes: (groomingAppt.customer_notes || daycareAppt.customer_notes || undefined)?.trim() || undefined,
          groomingNotes: groomingAppt.internal_notes?.trim() || undefined,
          gardenNotes: daycareAppt.internal_notes?.trim() || undefined,
          groomingStatus: groomingAppt.status,
          gardenStatus: daycareAppt.status,
          startDateTime: appointmentStart.toISOString(),
          endDateTime: appointmentEnd.toISOString(),
          groomingAppointmentId: groomingAppt.id,
          gardenAppointmentId: daycareAppt.id,
          latePickupRequested: daycareAppt.late_pickup_requested || false,
          latePickupNotes: daycareAppt.late_pickup_notes?.trim() || undefined,
          gardenTrimNails: daycareAppt.garden_trim_nails || false,
          gardenBrush: daycareAppt.garden_brush || false,
          gardenBath: daycareAppt.garden_bath || false,
        })
      } else if (groomingAppt) {
        // Only grooming appointment
        const start = new Date(groomingAppt.start_at)
        const end = new Date(groomingAppt.end_at)
        const date = formatDateKey(groomingAppt.start_at)
        const time = start.toTimeString().slice(0, 5)

        mergedAppointments.push({
          id: groomingAppt.id,
          treatmentId,
          treatmentName,
          date,
          time,
          service: "grooming",
          status: groomingAppt.status,
          stationId: groomingAppt.station_id || undefined,
          notes: groomingAppt.customer_notes?.trim() || undefined,
          groomingNotes: groomingAppt.internal_notes?.trim() || undefined,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          groomingAppointmentId: groomingAppt.id,
        })
      } else if (daycareAppt) {
        // Only daycare appointment
        const start = new Date(daycareAppt.start_at)
        const end = new Date(daycareAppt.end_at)
        const date = formatDateKey(daycareAppt.start_at)
        const time = start.toTimeString().slice(0, 5)

        mergedAppointments.push({
          id: daycareAppt.id,
          treatmentId,
          treatmentName,
          date,
          time,
          service: "garden",
          status: daycareAppt.status,
          stationId: daycareAppt.station_id || undefined,
          notes: daycareAppt.customer_notes?.trim() || undefined,
          gardenNotes: daycareAppt.internal_notes?.trim() || undefined,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          gardenAppointmentId: daycareAppt.id,
          latePickupRequested: daycareAppt.late_pickup_requested || false,
          latePickupNotes: daycareAppt.late_pickup_notes?.trim() || undefined,
          gardenTrimNails: daycareAppt.garden_trim_nails || false,
          gardenBrush: daycareAppt.garden_brush || false,
          gardenBath: daycareAppt.garden_bath || false,
        })
      }
    }

    // Sort by date and time
    mergedAppointments.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`).getTime()
      const dateB = new Date(`${b.date}T${b.time}`).getTime()
      return dateA - dateB
    })

    return { appointments: mergedAppointments }
  } catch (error) {
    console.error(`❌ [getMergedAppointments] Error:`, error)
    throw error
  }
}

// Get available dates for a treatment using the backend-configured calendar window
export async function getAvailableDates(treatmentId: string, serviceType: string): Promise<AvailableDatesResult> {
  try {
    // Use the new direct Supabase implementation instead of edge function
    const availableDates = await getAvailableDatesDirectly(treatmentId, serviceType)

    return { availableDates }
  } catch (error) {
    console.error("❌ Error fetching available dates:", error)
    throw error
  }
}

// Get available times for a treatment on a specific date
export async function getAvailableTimes(treatmentId: string, date: string): Promise<AvailableTime[]> {
  try {
    // Edge function will handle all complex calculation - this just calls it
    const result = await callSupabaseFunction("get-available-times", {
      treatmentId,
      date,
      mode: "time",
    })

    return result.data?.availableTimes || result.availableTimes || []
  } catch (error) {
    console.error("❌ Error fetching available times:", error)
    throw error
  }
}

// 6. Reserve appointment for treatment on a specific date
export async function reserveAppointment(
  treatmentId: string,
  date: string,
  stationId: string,
  startTime: string,
  notes?: string,
  isTrial?: boolean,
  appointmentType?: string,
  latePickupRequested?: boolean,
  latePickupNotes?: string,
  gardenTrimNails?: boolean,
  gardenBrush?: boolean,
  gardenBath?: boolean
): Promise<{
  success: boolean
  data?: any
  message?: string
  error?: string
}> {
  const payload = {
    treatmentId,
    date,
    stationId,
    startTime,
    ...(notes ? { notes } : {}),
    ...(isTrial !== undefined ? { isTrial } : {}),
    ...(appointmentType ? { appointmentType } : {}),
    ...(latePickupRequested !== undefined ? { latePickupRequested } : {}),
    ...(latePickupNotes ? { latePickupNotes } : {}),
    ...(gardenTrimNails !== undefined ? { gardenTrimNails } : {}),
    ...(gardenBrush !== undefined ? { gardenBrush } : {}),
    ...(gardenBath !== undefined ? { gardenBath } : {}),
  }

  const result = await callSupabaseFunction("reserve-appointment", payload)
  // Always return the full result object, not just result.data
  return result
}

export async function updateLatePickup(
  appointmentId: string,
  latePickupRequested: boolean,
  latePickupNotes?: string
): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  const payload = {
    appointmentId,
    latePickupRequested,
    ...(latePickupNotes ? { latePickupNotes } : {}),
  }

  // Use direct Supabase update instead of edge function
  const { updateLatePickup } = await import("@/pages/Appointments/Appointments.module")
  return await updateLatePickup(appointmentId, latePickupRequested, latePickupNotes)
}

// 7. Check if user exists in Supabase by email
export async function checkUserExists(email: string): Promise<{
  email: string
  exists: boolean
  message: string
}> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error("email is required")
  }

  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("email", normalizedEmail)

  if (error) {
    throw error
  }

  const exists = (count ?? 0) > 0

  return {
    email,
    exists,
    message: exists ? "User found in Supabase" : "User not found in Supabase",
  }
}

// 8. Register for waiting list
export async function registerWaitingList(
  customerId: string,
  serviceType: "grooming" | "daycare" | "both",
  dateRanges: Array<{ startDate: string; endDate: string }>,
  userId?: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // Use direct Supabase insert instead of edge function
    const { registerWaitingList } = await import("@/pages/Appointments/Appointments.module")
    return await registerWaitingList(customerId, serviceType, dateRanges, userId)
  } catch (error) {
    console.error("Failed to register waiting list:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to register waiting list",
    }
  }
}

export async function updateWaitingListEntry(
  entryId: string,
  serviceType: "grooming" | "daycare" | "both",
  dateRanges: Array<{ startDate: string; endDate: string }>,
  userId?: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // Use direct Supabase update instead of edge function
    const { updateWaitingListEntry } = await import("@/pages/Appointments/Appointments.module")
    return await updateWaitingListEntry(entryId, serviceType, dateRanges)
  } catch (error) {
    console.error("Failed to update waiting list entry:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update waiting list entry",
    }
  }
}

export async function deleteTreatment(
  treatmentId: string,
  options?: { ownerId?: string; treatmentName?: string }
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    if (!treatmentId) {
      throw new Error("treatmentId is required")
    }

    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const hasHistory = await hasTreatmentAppointmentHistory(treatmentId)
    if (hasHistory) {
      return {
        success: false,
        error: "לא ניתן למחוק כלב שכבר הוזמנו לו תורים",
      }
    }

    const { error } = await supabase.from("treatments").delete().eq("id", treatmentId)

    if (error) {
      throw error
    }

    return {
      success: true,
      message: options?.treatmentName ? `הכלב ${options.treatmentName} הוסר בהצלחה` : undefined,
    }
  } catch (error) {
    console.error("Failed to delete treatment:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete treatment",
    }
  }
}

export async function getClientProfile(clientId: string): Promise<ClientProfile> {
  if (!clientId) {
    throw new Error("clientId is required")
  }

  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, email, address, customer_type_id, customer_type:customer_types(name)")
    .eq("id", clientId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("Failed to load client profile")
  }

  return {
    id: data.id,
    fullName: data.full_name ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    address: data.address ?? null,
    customerTypeId: data.customer_type_id ?? null,
    customerTypeName: data.customer_type?.name ?? null,
  }
}

export async function updateAppointmentNotes(
  appointmentId: string,
  serviceType: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Determine which table to update based on serviceType
    const tableName = serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"

    // Update customer_notes field using PostgREST
    const { error } = await supabase
      .from(tableName)
      .update({ customer_notes: note || null })
      .eq("id", appointmentId)

    if (error) {
      console.error(`❌ [updateAppointmentNotes] Error updating notes:`, error)
      throw new Error(`Failed to update appointment notes: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to update appointment notes:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update appointment notes",
    }
  }
}

export async function updateClientProfile(
  clientId: string,
  profile: { fullName?: string; phone?: string; email?: string; address?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!clientId) {
      throw new Error("clientId is required")
    }

    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    const fullName = profile.fullName?.trim()
    const phone = profile.phone?.trim()
    const email = profile.email?.trim().toLowerCase()
    const address = profile.address?.trim()
    const normalizedPhone = normalizePhone(phone)

    const updatePayload: Database["public"]["Tables"]["customers"]["Update"] = {}

    if (fullName !== undefined) {
      updatePayload.full_name = fullName || null
    }
    if (phone !== undefined) {
      updatePayload.phone = phone || null
      updatePayload.phone_search = normalizedPhone
    }
    if (email !== undefined) {
      updatePayload.email = email || null
    }
    if (address !== undefined) {
      updatePayload.address = address || null
    }

    if (Object.keys(updatePayload).length === 0) {
      return { success: true }
    }

    const { error } = await supabase.from("customers").update(updatePayload).eq("id", clientId)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to update client profile:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update client profile",
    }
  }
}

// 9. Cancel appointment (via edge function)
export async function cancelAppointment(appointmentId: string): Promise<{
  success: boolean
  message?: string
  error?: string
  appointment?: {
    id: string
    status: string
  }
}> {
  try {
    // Use direct Supabase update instead of edge function
    const { cancelAppointment } = await import("@/pages/Appointments/Appointments.module")
    return await cancelAppointment(appointmentId)
  } catch (error) {
    console.error("Failed to cancel appointment:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel appointment",
    }
  }
}

// 10. Cancel appointment via webhook (with 24-hour validation)
export interface CancelAppointmentOptions {
  serviceType?: "grooming" | "garden" | "both"
  appointmentTime?: string
  treatmentId?: string
  stationId?: string
}

export async function cancelAppointmentWebhook(
  appointmentId: string,
  options: CancelAppointmentOptions = {}
): Promise<{
  success: boolean
  message?: string
  error?: string
  appointmentId?: string
  webhookResponse?: string
  timeDifferenceHours?: number
}> {
  try {
    // Use direct Supabase update with validation instead of edge function/webhook
    const { cancelAppointmentWithValidation } = await import("@/pages/Appointments/Appointments.module")
    return await cancelAppointmentWithValidation({
      appointmentId,
      appointmentTime: options.appointmentTime,
      serviceType: options.serviceType,
      treatmentId: options.treatmentId,
      stationId: options.stationId,
    })
  } catch (error) {
    console.error("Failed to cancel appointment via webhook:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel appointment",
    }
  }
}

export const approveAppointment = async (appointmentId: string, approvalStatus: "approved") => {
  try {
    // Use direct Supabase update instead of edge function/webhook
    const { approveAppointment } = await import("@/pages/Appointments/Appointments.module")
    return await approveAppointment(appointmentId, approvalStatus)
  } catch (error) {
    console.error("Failed to approve appointment:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve appointment",
    }
  }
}

export const approveGroomingAppointment = async (appointmentId: string, approvalStatus: "approved") => {
  try {
    // Use direct Supabase update instead of edge function
    const { approveGroomingAppointment } = await import("@/pages/Appointments/Appointments.module")
    return await approveGroomingAppointment(appointmentId, approvalStatus)
  } catch (error) {
    console.error("Failed to approve grooming appointment:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve grooming appointment",
    }
  }
}

type CombinedAppointmentAction = "approve" | "cancel"

interface CombinedAppointmentActionParams {
  groomingAppointmentId: string
  gardenAppointmentId: string
}

interface CombinedAppointmentActionResult {
  success: boolean
  message?: string
  error?: string
}

const combinedAppointmentFunctionName =
  import.meta.env.VITE_SUPABASE_COMBINED_APPOINTMENT_FUNCTION ?? "manage-both-appointments"

async function callCombinedAppointmentAction(
  action: CombinedAppointmentAction,
  params: CombinedAppointmentActionParams
): Promise<CombinedAppointmentActionResult> {
  const payload = {
    action,
    groomingAppointmentId: params.groomingAppointmentId,
    gardenAppointmentId: params.gardenAppointmentId,
  }

  const rawResult = await callSupabaseFunction(combinedAppointmentFunctionName, payload)
  const data =
    (rawResult?.data as CombinedAppointmentActionResult | undefined) ??
    (rawResult as CombinedAppointmentActionResult | undefined)

  if (!data) {
    throw new Error(`Failed to ${action} appointments: empty response`)
  }

  if (data.success === false) {
    throw new Error(data.error || `Failed to ${action} appointments`)
  }

  return {
    success: Boolean(data.success),
    message: data.message,
  }
}

function ensureCombinedIds(params: CombinedAppointmentActionParams) {
  if (!params.groomingAppointmentId || !params.gardenAppointmentId) {
    throw new Error("Both groomingAppointmentId and gardenAppointmentId are required")
  }
}

export async function approveCombinedAppointments(
  params: CombinedAppointmentActionParams
): Promise<CombinedAppointmentActionResult> {
  ensureCombinedIds(params)

  try {
    return await callCombinedAppointmentAction("approve", params)
  } catch (error) {
    console.warn("Falling back to individual approval calls:", error)
    const [groomingResult, gardenResult] = await Promise.all([
      approveGroomingAppointment(params.groomingAppointmentId, "approved"),
      approveAppointment(params.gardenAppointmentId, "approved"),
    ])

    if (groomingResult.success && gardenResult.success) {
      return {
        success: true,
        message: groomingResult.message || gardenResult.message || "התורים (תספורת וגן) אושרו בהצלחה",
      }
    }

    return {
      success: false,
      error: (!groomingResult.success ? groomingResult.error : gardenResult.error) || "שגיאה באישור התורים",
    }
  }
}

export async function cancelCombinedAppointments(
  params: CombinedAppointmentActionParams
): Promise<CombinedAppointmentActionResult> {
  ensureCombinedIds(params)

  try {
    return await callCombinedAppointmentAction("cancel", params)
  } catch (error) {
    console.warn("Falling back to individual cancellation calls:", error)
    const [groomingResult, gardenResult] = await Promise.all([
      cancelAppointmentWebhook(params.groomingAppointmentId, {
        serviceType: "grooming",
      }),
      cancelAppointmentWebhook(params.gardenAppointmentId, {
        serviceType: "garden",
      }),
    ])

    if (groomingResult.success && gardenResult.success) {
      return {
        success: true,
        message: groomingResult.message || gardenResult.message || "התורים (תספורת וגן) בוטלו בהצלחה",
      }
    }

    return {
      success: false,
      error: (!groomingResult.success ? groomingResult.error : gardenResult.error) || "שגיאה בביטול התורים",
    }
  }
}

const mapProposedMeetingRowToAppointment = (row: ProposedMeetingRow | null): ManagerAppointment | null => {
  if (!row) {
    return null
  }
  if (!row.start_at || !row.end_at) {
    console.warn("⚠️ [mapProposedMeetingRowToAppointment] Missing start or end", row.id)
    return null
  }

  const station = asSingle(row.stations)
  const invites =
    row.proposed_meeting_invites?.map((invite) => {
      const customer = asSingle(invite.customers)
      return {
        id: invite.id,
        customerId: invite.customer_id,
        customerName: customer?.full_name ?? undefined,
        customerTypeId: customer?.customer_type_id ?? invite.source_category_id ?? null,
        customerTypeName: customer?.customer_type?.name ?? undefined,
        clientClassification: customer?.classification ?? undefined,
        clientPhone: customer?.phone ?? undefined,
        clientEmail: customer?.email ?? undefined,
        source: invite.source === "category" ? "category" : "manual",
        sourceCategoryId: invite.source_category_id ?? null,
        lastNotifiedAt: invite.last_notified_at ?? undefined,
        notificationCount: invite.notification_count ?? undefined,
        lastWebhookStatus: invite.last_webhook_status ?? undefined,
      }
    }) ?? []

  const categories =
    row.proposed_meeting_categories?.map((category) => ({
      id: category.id,
      customerTypeId: category.customer_type_id,
      customerTypeName: category.customer_type?.name ?? null,
    })) ?? []

  const durationMinutes = Math.max(
    1,
    Math.round((new Date(row.end_at).getTime() - new Date(row.start_at).getTime()) / 60000)
  )

  return {
    id: `proposed-${row.id}`,
    serviceType: (row.service_type as "grooming" | "garden") || "grooming",
    stationId: row.station_id || station?.id || `proposed-station-${row.id}`,
    stationName: station?.name || "מפגש מוצע",
    startDateTime: row.start_at,
    endDateTime: row.end_at,
    status: row.status || "proposed",
    paymentStatus: undefined,
    notes: row.summary || "מפגש מוצע",
    internalNotes: row.notes || undefined,
    hasCrossServiceAppointment: false,
    treatments: [],
    clientId: undefined,
    clientName: row.title || undefined,
    clientClassification: undefined,
    clientEmail: undefined,
    clientPhone: undefined,
    appointmentType: "business",
    durationMinutes,
    isProposedMeeting: true,
    proposedMeetingId: row.id,
    proposedMeetingCode: row.code,
    proposedStatus: row.status || undefined,
    proposedTitle: row.title || undefined,
    proposedSummary: row.summary || undefined,
    proposedNotes: row.notes || undefined,
    proposedCreatedAt: row.created_at || undefined,
    proposedInvites: invites,
    proposedCategories: categories,
    proposedLinkedAppointmentId: row.reschedule_appointment_id || undefined,
    proposedLinkedCustomerId: row.reschedule_customer_id || undefined,
    proposedLinkedTreatmentId: row.reschedule_treatment_id || undefined,
    proposedOriginalStart: row.reschedule_original_start_at || undefined,
    proposedOriginalEnd: row.reschedule_original_end_at || undefined,
  }
}

// Get manager schedule data directly from Supabase
export async function getManagerSchedule(
  date: string,
  serviceType: ManagerServiceFilter = "both"
): Promise<ManagerScheduleData> {
  try {
    // Parse the date and create date range for the day (start of day to end of day in Jerusalem time)
    const dateOnly = date.split("T")[0] // Get YYYY-MM-DD format
    const dayStart = new Date(`${dateOnly}T00:00:00.000Z`)
    const dayEnd = new Date(`${dateOnly}T23:59:59.999Z`)

    // Fetch stations
    const { data: stationsData, error: stationsError } = await supabase
      .from("stations")
      .select("id, name, is_active, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name")

    if (stationsError) {
      throw new Error(`Failed to fetch stations: ${stationsError.message}`)
    }

    const stations: ManagerStation[] = (stationsData || []).map((station) => ({
      id: station.id,
      name: station.name,
      serviceType: "grooming", // Default, will check service_station_matrix later
      isActive: station.is_active,
      displayOrder: station.display_order ?? undefined,
    }))

    // Add a virtual garden station
    const gardenStation: ManagerStation = {
      id: "garden-station",
      name: "גן הכלבים",
      serviceType: "garden",
      isActive: true,
      displayOrder: Number.MAX_SAFE_INTEGER,
    }

    if (serviceType === "garden" || serviceType === "both") {
      stations.push(gardenStation)
    }

    // Fetch grooming appointments
    const groomingPromise =
      serviceType === "garden"
        ? Promise.resolve([])
        : supabase
            .from("grooming_appointments")
            .select(
              `
              id,
              status,
              station_id,
              start_at,
              end_at,
              customer_notes,
              internal_notes,
              payment_status,
              appointment_kind,
              amount_due,
              treatment_id,
              customer_id,
              stations(id, name),
              treatments(
                id,
                name,
                treatment_type_id,
                customer_id,
                treatmentTypes:treatment_types (
                  id,
                  name,
                  size_class:default_duration_minutes,
                  min_groom_price:default_price,
                  max_groom_price:default_price,
                  color_hex
                )
              ),
              customers(id, full_name, phone, email, classification)
            `
            )
            .gte("start_at", dayStart.toISOString())
            .lte("start_at", dayEnd.toISOString())
            .order("start_at")

    // Fetch daycare appointments
    const daycarePromise =
      serviceType === "grooming"
        ? Promise.resolve([])
        : supabase
            .from("daycare_appointments")
            .select(
              `
              id,
              status,
              station_id,
              start_at,
              end_at,
              customer_notes,
              internal_notes,
              payment_status,
              service_type,
              late_pickup_requested,
              late_pickup_notes,
              garden_trim_nails,
              garden_brush,
              garden_bath,
              questionnaire_result,
              treatment_id,
              customer_id,
              stations(id, name),
              treatments(
                id,
                name,
                treatment_type_id,
                customer_id,
                treatmentTypes:treatment_types (
                  id,
                  name,
                  size_class:default_duration_minutes,
                  min_groom_price:default_price,
                  max_groom_price:default_price,
                  color_hex
                )
              ),
              customers(id, full_name, phone, email, classification)
            `
            )
            .gte("start_at", dayStart.toISOString())
            .lte("start_at", dayEnd.toISOString())
            .order("start_at")

    const [groomingResult, daycareResult] = await Promise.all([groomingPromise, daycarePromise])

    if (groomingResult.error) {
      throw new Error(`Failed to fetch grooming appointments: ${groomingResult.error.message}`)
    }
    if (daycareResult.error) {
      throw new Error(`Failed to fetch daycare appointments: ${daycareResult.error.message}`)
    }

    const groomingAppointments = (groomingResult.data || []) as any[]
    const daycareAppointments = (daycareResult.data || []) as any[]

    // Fetch combined appointments to check for cross-service links
    // Get all combined appointments and filter to only those relevant to today's appointments
    const allGroomingIds = new Set(groomingAppointments.map((a) => a.id))
    const allDaycareIds = new Set(daycareAppointments.map((a) => a.id))

    const { data: combinedData } = await supabase
      .from("combined_appointments")
      .select("grooming_appointment_id, daycare_appointment_id")

    // Filter combined appointments to only those in today's appointments
    const combinedGroomingIds = new Set(
      (combinedData || []).map((c) => c.grooming_appointment_id).filter((id) => id && allGroomingIds.has(id))
    )
    const combinedDaycareIds = new Set(
      (combinedData || []).map((c) => c.daycare_appointment_id).filter((id) => id && allDaycareIds.has(id))
    )

    // Transform appointments to ManagerAppointment format
    const appointments: ManagerAppointment[] = []

    // Process grooming appointments
    for (const apt of groomingAppointments) {
      const station = Array.isArray(apt.stations) ? apt.stations[0] : apt.stations
      const treatment = Array.isArray(apt.treatments) ? apt.treatments[0] : apt.treatments
      const customer = Array.isArray(apt.customers) ? apt.customers[0] : apt.customers
      const treatmentType = treatment?.treatmentTypes ? (Array.isArray(treatment.treatmentTypes) ? treatment.treatmentTypes[0] : treatment.treatmentTypes) : null

      if (!treatment) continue

      const managerTreatment: ManagerTreatment = {
        id: treatment.id,
        name: treatment.name || "",
        treatmentType: treatmentType?.name,
        ownerId: treatment.customer_id,
        clientClassification: customer?.classification,
        clientName: customer?.full_name,
        minGroomingPrice: treatmentType?.min_groom_price ? Number(treatmentType.min_groom_price) : undefined,
        maxGroomingPrice: treatmentType?.max_groom_price ? Number(treatmentType.max_groom_price) : undefined,
      }

      const hasCrossService = combinedGroomingIds.has(apt.id)

      appointments.push({
        id: apt.id,
        serviceType: "grooming",
        stationId: apt.station_id || station?.id || "",
        stationName: station?.name || "לא ידוע",
        startDateTime: apt.start_at,
        endDateTime: apt.end_at,
        status: apt.status || "pending",
        paymentStatus: apt.payment_status || undefined,
        notes: apt.customer_notes || "",
        internalNotes: apt.internal_notes || undefined,
        hasCrossServiceAppointment: hasCrossService,
        treatments: [managerTreatment],
        clientId: apt.customer_id,
        clientName: customer?.full_name || undefined,
        clientClassification: customer?.classification || undefined,
        clientEmail: customer?.email || undefined,
        clientPhone: customer?.phone || undefined,
        appointmentType: apt.appointment_kind === "personal" ? "private" : "business",
        isPersonalAppointment: apt.appointment_kind === "personal",
        price: apt.amount_due ? Number(apt.amount_due) : undefined,
        durationMinutes: Math.round((new Date(apt.end_at).getTime() - new Date(apt.start_at).getTime()) / 60000),
      })
    }

    // Process daycare appointments
    for (const apt of daycareAppointments) {
      const treatment = Array.isArray(apt.treatments) ? apt.treatments[0] : apt.treatments
      const customer = Array.isArray(apt.customers) ? apt.customers[0] : apt.customers
      const treatmentType = treatment?.treatmentTypes ? (Array.isArray(treatment.treatmentTypes) ? treatment.treatmentTypes[0] : treatment.treatmentTypes) : null

      if (!treatment) continue

      const managerTreatment: ManagerTreatment = {
        id: treatment.id,
        name: treatment.name || "",
        treatmentType: treatmentType?.name,
        ownerId: treatment.customer_id,
        clientClassification: customer?.classification,
        clientName: customer?.full_name,
        minGroomingPrice: treatmentType?.min_groom_price ? Number(treatmentType.min_groom_price) : undefined,
        maxGroomingPrice: treatmentType?.max_groom_price ? Number(treatmentType.max_groom_price) : undefined,
      }

      const hasCrossService = combinedDaycareIds.has(apt.id)
      // Determine trial status based on service_type (primary source of truth)
      // If service_type is explicitly set, use it; otherwise fall back to questionnaire_result for backward compatibility
      const isTrial =
        apt.service_type === "trial" ||
        (apt.service_type == null && (apt.questionnaire_result === "pending" || apt.questionnaire_result === "trial"))

      // Determine service type from service_type enum value
      let serviceType: "full-day" | "hourly"
      if (apt.service_type === "hourly") {
        serviceType = "hourly"
      } else {
        // Both "full_day" and "trial" are displayed as "full-day" format
        serviceType = "full-day"
      }

      appointments.push({
        id: apt.id,
        serviceType: "garden",
        stationId: "garden-station",
        stationName: "גן הכלבים",
        startDateTime: apt.start_at,
        endDateTime: apt.end_at,
        status: apt.status || "pending",
        paymentStatus: apt.payment_status || undefined,
        notes: apt.customer_notes || "",
        internalNotes: apt.internal_notes || undefined,
        hasCrossServiceAppointment: hasCrossService,
        treatments: [managerTreatment],
        clientId: apt.customer_id,
        clientName: customer?.full_name || undefined,
        clientClassification: customer?.classification || undefined,
        clientEmail: customer?.email || undefined,
        clientPhone: customer?.phone || undefined,
        appointmentType: "business",
        gardenAppointmentType: serviceType,
        gardenIsTrial: isTrial,
        latePickupRequested: apt.late_pickup_requested || false,
        latePickupNotes: apt.late_pickup_notes || undefined,
        gardenTrimNails: apt.garden_trim_nails || false,
        gardenBrush: apt.garden_brush || false,
        gardenBath: apt.garden_bath || false,
        durationMinutes: Math.round((new Date(apt.end_at).getTime() - new Date(apt.start_at).getTime()) / 60000),
      })
    }

    // Include proposed meetings for the day so managers can see held slots
    const proposedServiceTypes: Array<"grooming" | "garden"> =
      serviceType === "both" ? ["grooming", "garden"] : serviceType === "garden" ? ["garden"] : ["grooming"]

    if (proposedServiceTypes.length > 0) {
      const { data: proposedMeetings, error: proposedMeetingsError } = await supabase
        .from("proposed_meetings")
        .select(
          `
            id,
            station_id,
            service_type,
            start_at,
            end_at,
            status,
            code,
            title,
            summary,
            notes,
            reschedule_appointment_id,
            reschedule_customer_id,
            reschedule_treatment_id,
            reschedule_original_start_at,
            reschedule_original_end_at,
            created_at,
            stations(id, name),
            proposed_meeting_invites(
              id,
              customer_id,
              source,
              source_category_id,
              last_notified_at,
              notification_count,
              last_webhook_status,
              customers(
                id,
                full_name,
                phone,
                email,
                classification,
                customer_type_id,
                customer_type:customer_types(name)
              )
            ),
            proposed_meeting_categories(
              id,
              customer_type_id,
              customer_type:customer_types(name)
            )
          `
        )
        .gte("start_at", dayStart.toISOString())
        .lte("start_at", dayEnd.toISOString())
        .in("service_type", proposedServiceTypes)

      if (proposedMeetingsError) {
        throw new Error(`Failed to fetch proposed meetings: ${proposedMeetingsError.message}`)
      }

      for (const meeting of proposedMeetings ?? []) {
        const mapped = mapProposedMeetingRowToAppointment(meeting as ProposedMeetingRow)
        if (mapped) {
          appointments.push(mapped)
        }
      }
    }

    // Sort appointments by start time
    appointments.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))

    return {
      date: dateOnly,
      serviceFilter: serviceType,
      stations,
      appointments,
    }
  } catch (error) {
    console.error(`❌ [getManagerSchedule] Error:`, error)
    throw error
  }
}

// Move appointment in Supabase
export async function moveAppointment(params: {
  appointmentId: string
  newStationId: string
  newStartTime: string
  newEndTime: string
  oldStationId: string
  oldStartTime: string
  oldEndTime: string
  appointmentType: "grooming" | "garden"
  newGardenAppointmentType?: "full-day" | "hourly" | "trial"
  newGardenIsTrial?: boolean
  selectedHours?: { start: string; end: string }
  gardenTrimNails?: boolean
  gardenBrush?: boolean
  gardenBath?: boolean
  latePickupRequested?: boolean
  latePickupNotes?: string
  internalNotes?: string
}): Promise<{ success: boolean; message?: string; error?: string; appointment?: any }> {
  try {
    if (!supabase) {
      console.error("❌ [moveAppointment] Supabase client not initialized")
      throw new Error("Supabase client not initialized")
    }

    // Use edge function for all appointment moves (consistent with creation)
    const { data, error } = await supabase.functions.invoke("move-appointment", {
      body: params,
    })

    if (error) {
      console.error(`❌ [moveAppointment] Edge function error:`, error)
      throw new Error(error.message || "Failed to move appointment")
    }

    if (data && data.error) {
      console.error(`❌ [moveAppointment] Error in response:`, data.error)
      throw new Error(data.error)
    }

    return {
      success: true,
      message: data?.message || "התור הועבר בהצלחה",
      appointment: data?.appointment,
    }
  } catch (error) {
    console.error(`❌ [moveAppointment] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to move appointment",
    }
  }
}

// Helper function to get or create system customer and treatment for private appointments
async function getOrCreateSystemCustomerAndTreatment(
  appointmentName: string
): Promise<{ customerId: string; treatmentId: string }> {
  const SYSTEM_CUSTOMER_NAME = "צוות פנימי"
  const SYSTEM_CUSTOMER_EMAIL = "internal@wagtime.co.il"
  const SYSTEM_PHONE = "0000000000"

  // Try to find existing system customer
  let { data: systemCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("full_name", SYSTEM_CUSTOMER_NAME)
    .eq("email", SYSTEM_CUSTOMER_EMAIL)
    .maybeSingle()

  // If system customer doesn't exist, try to create it via edge function or use current user's auth_user_id
  // Note: RLS requires auth_user_id, so we'll set it to the current user for system customers
  if (!systemCustomer) {
    // Get current user to use as auth_user_id (required by RLS)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("User must be authenticated to create system customer")
    }

    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        full_name: SYSTEM_CUSTOMER_NAME,
        email: SYSTEM_CUSTOMER_EMAIL,
        phone: SYSTEM_PHONE,
        classification: "existing", // Use valid enum value: 'extra_vip', 'vip', 'existing', 'new'
        auth_user_id: user.id, // Required by RLS policy
      })
      .select("id")
      .single()

    if (customerError || !newCustomer) {
      throw new Error(`Failed to create system customer: ${customerError?.message || "Unknown error"}`)
    }

    systemCustomer = newCustomer
  }

  // Create a treatment with the appointment name (or use a generic name if too long)
  const treatmentName = appointmentName || "תור פרטי"
  const { data: systemTreatment, error: treatmentError } = await supabase
    .from("treatments")
    .insert({
      name: treatmentName.length > 100 ? "תור פרטי" : treatmentName,
      customer_id: systemCustomer.id,
      treatment_type_id: null, // No treatmentType for system treatments
      gender: "male", // Required field - default value for system treatments
      birth_date: null,
      is_small: false,
      health_notes: null,
      vet_name: null,
      vet_phone: null,
      aggression_risk: false,
      people_anxious: false,
    })
    .select("id")
    .single()

  if (treatmentError || !systemTreatment) {
    throw new Error(`Failed to create system treatment: ${treatmentError?.message || "Unknown error"}`)
  }

  return { customerId: systemCustomer.id, treatmentId: systemTreatment.id }
}

// Create manager appointment via edge function
export async function createManagerAppointment(params: {
  name: string
  stationId: string
  selectedStations: string[]
  startTime: string
  endTime: string
  appointmentType: "private" | "business" | "garden"
  groupId?: string
  customerId?: string
  treatmentId?: string
  isManualOverride?: boolean
  gardenAppointmentType?: "full-day" | "hourly" | "trial"
  services?: {
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
  }
  latePickupRequested?: boolean
  latePickupNotes?: string
  notes?: string
  internalNotes?: string
}): Promise<{
  success: boolean
  appointmentIds?: string[]
  appointmentId?: string
  groupId?: string
  message?: string
}> {
  if (!supabase) {
    console.error("❌ [createManagerAppointment] Supabase client not initialized")
    throw new Error("Supabase client not initialized")
  }

  // Use edge function for all appointment creation (100% Supabase, no Make.com)
  const { data, error } = await supabase.functions.invoke("create-manager-appointment", {
    body: params,
  })

  if (error) {
    console.error(`❌ [createManagerAppointment] Edge function error:`, error)

    const errorObj = error as Record<string, unknown>
    const errorMessage = (errorObj.message as string) || ""

    // Extract status code from Supabase error (check multiple possible locations)
    let statusCode: number | null =
      typeof errorObj.status === "number"
        ? errorObj.status
        : typeof (errorObj.context as Record<string, unknown>)?.statusCode === "number"
        ? ((errorObj.context as Record<string, unknown>).statusCode as number)
        : typeof (errorObj.response as Record<string, unknown>)?.status === "number"
        ? ((errorObj.response as Record<string, unknown>).status as number)
        : typeof (errorObj.context as Record<string, unknown>)?.status === "number"
        ? ((errorObj.context as Record<string, unknown>).status as number)
        : null

    // If status code not found but error message indicates "non-2xx", it's likely a 401 when not authenticated
    // Check the error message for clues about authentication issues
    if (statusCode === null && typeof errorMessage === "string") {
      const errorLower = errorMessage.toLowerCase()
      // "Edge Function returned a non-2xx status code" typically means 401 when no auth token
      if (
        errorLower.includes("non-2xx") ||
        errorLower.includes("401") ||
        errorLower.includes("unauthorized") ||
        errorLower.includes("forbidden") ||
        errorLower.includes("authentication")
      ) {
        // Try to extract status code from message or context
        const statusMatch = errorMessage.match(/\b(401|403|404|500)\b/)
        if (statusMatch) {
          statusCode = parseInt(statusMatch[1], 10)
        } else if (errorLower.includes("unauthorized") || errorLower.includes("authentication") || !data) {
          // If it's a "non-2xx" error and we have no data, likely 401
          statusCode = 401
        }
      }
    }

    // Check if this is an auth error (401 or 403)
    if (isAuthError(error) || statusCode === 401 || statusCode === 403) {
      console.warn("🔒 [createManagerAppointment] Auth error detected, logging out...", { statusCode, error })
      handleInvalidToken()
      // Always use Hebrew error messages for auth errors
      throw new HttpError(
        statusCode === 403
          ? "אין לך הרשאות לבצע פעולה זו. אם אתה חושב שזו טעות, אנא פנה למנהל המערכת."
          : "ההתחברות שלך פגה או לא תקינה. אנא התחבר מחדש כדי להמשיך.",
        statusCode || 401,
        error
      )
    }

    // For other errors with status codes, use generic Hebrew message if English
    if (statusCode) {
      // If error message is in English and generic, use our Hebrew message based on status
      if (
        errorMessage.includes("Edge Function returned") ||
        errorMessage.includes("non-2xx") ||
        errorMessage === "Failed to create appointment"
      ) {
        const { getErrorMessage } = await import("@/utils/errorMessages")
        const hebrewMessage = getErrorMessage({ status: statusCode }, "אירעה שגיאה ביצירת התור")
        throw new HttpError(hebrewMessage, statusCode, error)
      }
      throw new HttpError(errorMessage, statusCode, error)
    }

    // If we have an English error message, try to provide a Hebrew fallback
    if (errorMessage && errorMessage.includes("Edge Function")) {
      throw new Error("אירעה שגיאה בתקשורת עם השרת. אנא נסה שוב.")
    }

    throw new Error(errorMessage || "אירעה שגיאה ביצירת התור. אנא נסה שוב.")
  }

  // Handle response from edge function
  // Note: For HTTP error responses (like 401), Supabase might put the response body in `data` instead of `error`
  if (data && typeof data === "object") {
    // Check if response contains an error field (HTTP error responses like 401)
    if ("error" in data && !("success" in data && data.success === true)) {
      const errorMessage = (data as { error?: string }).error || "Failed to create appointment"
      console.error(`❌ [createManagerAppointment] Error in response data:`, errorMessage)

      // Determine status code based on error message (fallback if not in error object)
      let statusCode: number | null = null
      if (typeof errorMessage === "string") {
        const errorLower = errorMessage.toLowerCase()
        if (
          errorLower.includes("unauthorized") ||
          errorLower.includes("authentication") ||
          errorLower.includes("expired") ||
          errorLower.includes("invalid session")
        ) {
          statusCode = 401
        } else if (errorLower.includes("forbidden") || errorLower.includes("permission")) {
          statusCode = 403
        }
      }

      // Check if it's an auth error in the error message
      if (statusCode === 401) {
        console.warn("🔒 [createManagerAppointment] Auth error detected in response data, logging out...")
        handleInvalidToken()
        throw new HttpError("ההתחברות שלך פגה או לא תקינה. אנא התחבר מחדש כדי להמשיך.", 401, errorMessage)
      }

      if (statusCode === 403) {
        throw new HttpError(
          "אין לך הרשאות לבצע פעולה זו. אם אתה חושב שזו טעות, אנא פנה למנהל המערכת.",
          403,
          errorMessage
        )
      }

      // For other errors, preserve status code if we detected one
      if (statusCode) {
        throw new HttpError(errorMessage, statusCode, data)
      }

      throw new Error(errorMessage)
    }

    // Check for success response
    if ("success" in data && data.success === true) {
      const response = data as {
        success: boolean
        appointmentIds?: string[]
        appointmentId?: string
        groupId?: string
        message?: string
      }
      return {
        success: true,
        appointmentIds: response.appointmentIds,
        appointmentId: response.appointmentId || response.appointmentIds?.[0], // Backward compatibility
        groupId: response.groupId,
        message: response.message || "תור נוצר בהצלחה",
      }
    }

    // If we get here, the response structure is unexpected
    console.error(`❌ [createManagerAppointment] Unexpected response structure:`, data)
    throw new Error("Invalid response from server")
  }

  // No data or invalid data
  throw new Error("Invalid response from server - no data received")
}

// Cancel appointment in Supabase (manager operation)
export async function managerCancelAppointment(params: {
  appointmentId: string
  appointmentTime: string
  serviceType: "grooming" | "garden"
  treatmentId?: string
  stationId?: string
  updateCustomer?: boolean
  clientName?: string
  treatmentName?: string
  appointmentDate?: string
  groupId?: string
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const tableName = params.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"

    // Update appointment status to cancelled
    const { error } = await supabase.from(tableName).update({ status: "cancelled" }).eq("id", params.appointmentId)

    if (error) {
      throw new Error(`Failed to cancel appointment: ${error.message}`)
    }

    // If this is a group appointment, cancel all appointments in the group
    if (params.groupId && params.serviceType === "grooming") {
      const { error: groupError } = await supabase
        .from("grooming_appointments")
        .update({ status: "cancelled" })
        .eq("series_id", params.groupId)

      if (groupError) {
        console.warn(`Failed to cancel group appointments: ${groupError.message}`)
      }
    }

    return { success: true, message: "התור בוטל בהצלחה" }
  } catch (error) {
    console.error(`❌ [managerCancelAppointment] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel appointment",
    }
  }
}

// Delete appointment in Supabase (manager operation) - same as cancel for now
export async function managerDeleteAppointment(params: {
  appointmentId: string
  appointmentTime: string
  serviceType: "grooming" | "garden"
  treatmentId?: string
  stationId?: string
  updateCustomer?: boolean
  clientName?: string
  treatmentName?: string
  appointmentDate?: string
  groupId?: string
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // For now, deletion is the same as cancellation - we just set status to cancelled
    // In the future, you might want to actually delete records, but for audit purposes
    // cancellation is usually preferred
    return await managerCancelAppointment(params)
  } catch (error) {
    console.error(`❌ [managerDeleteAppointment] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete appointment",
    }
  }
}

// Get single appointment from Supabase (for manager schedule)
export async function getSingleManagerAppointment(
  appointmentId: string,
  serviceType: "grooming" | "garden"
): Promise<{ success: boolean; appointment?: ManagerAppointment; error?: string }> {
  try {
    const tableName = serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"

    const { data, error } = await supabase
      .from(tableName)
      .select(
        `
        id,
        status,
        station_id,
        start_at,
        end_at,
        customer_notes,
        internal_notes,
        payment_status,
        appointment_kind,
        amount_due,
        treatment_id,
        customer_id,
        ${
          serviceType === "garden"
            ? "service_type, late_pickup_requested, late_pickup_notes, garden_trim_nails, garden_brush, garden_bath, questionnaire_result,"
            : ""
        }
        stations(id, name),
        treatments(
          id,
          name,
          treatment_type_id,
          customer_id,
          treatmentTypes:treatment_types (
            id,
            name,
            size_class:default_duration_minutes,
            min_groom_price:default_price,
            max_groom_price:default_price,
            color_hex
          )
        ),
        customers(id, full_name, phone, email, classification)
      `
      )
      .eq("id", appointmentId)
      .single()

    if (error || !data) {
      throw new Error(error?.message || "Appointment not found")
    }

    // Check for combined appointment
    const { data: combinedData } = await supabase
      .from("combined_appointments")
      .select("grooming_appointment_id, daycare_appointment_id")
      .or(`${serviceType === "grooming" ? "grooming" : "daycare"}_appointment_id.eq.${appointmentId}`)
      .maybeSingle()

    const hasCrossService = !!combinedData

    const station = Array.isArray(data.stations) ? data.stations[0] : data.stations
    const treatment = Array.isArray(data.treatments) ? data.treatments[0] : data.treatments
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers
    const treatmentType = treatment?.treatmentTypes ? (Array.isArray(treatment.treatmentTypes) ? treatment.treatmentTypes[0] : treatment.treatmentTypes) : null

    if (!treatment) {
      throw new Error("Treatment information not found")
    }

    const managerTreatment: ManagerTreatment = {
      id: treatment.id,
      name: treatment.name || "",
      treatmentType: treatmentType?.name,
      ownerId: treatment.customer_id,
      clientClassification: customer?.classification,
      clientName: customer?.full_name,
      minGroomingPrice: treatmentType?.min_groom_price ? Number(treatmentType.min_groom_price) : undefined,
      maxGroomingPrice: treatmentType?.max_groom_price ? Number(treatmentType.max_groom_price) : undefined,
    }

    const appointment: ManagerAppointment = {
      id: data.id,
      serviceType,
      stationId: data.station_id || (serviceType === "garden" ? "garden-station" : station?.id || ""),
      stationName: serviceType === "garden" ? "גן הכלבים" : station?.name || "לא ידוע",
      startDateTime: data.start_at,
      endDateTime: data.end_at,
      status: data.status || "pending",
      paymentStatus: data.payment_status || undefined,
      notes: data.customer_notes || "",
      internalNotes: data.internal_notes || undefined,
      hasCrossServiceAppointment: hasCrossService,
      treatments: [managerTreatment],
      clientId: data.customer_id,
      clientName: customer?.full_name || undefined,
      clientClassification: customer?.classification || undefined,
      clientEmail: customer?.email || undefined,
      clientPhone: customer?.phone || undefined,
      appointmentType: serviceType === "grooming" && data.appointment_kind === "personal" ? "private" : "business",
      price: data.amount_due ? Number(data.amount_due) : undefined,
      durationMinutes: Math.round((new Date(data.end_at).getTime() - new Date(data.start_at).getTime()) / 60000),
    }

    if (serviceType === "garden") {
      const gardenData = data as any
      // Set gardenAppointmentType based on service_type
      if (gardenData.service_type === "trial") {
        appointment.gardenAppointmentType = "full-day" // Trials are displayed as full-day format
        appointment.gardenIsTrial = true
      } else if (gardenData.service_type === "hourly") {
        appointment.gardenAppointmentType = "hourly"
        appointment.gardenIsTrial = false
      } else {
        // service_type === "full_day"
        appointment.gardenAppointmentType = "full-day"
        appointment.gardenIsTrial = false
      }

      // Legacy fallback: also check questionnaire_result for backward compatibility
      // But prioritize service_type over questionnaire_result
      if (appointment.gardenIsTrial === undefined) {
        appointment.gardenIsTrial =
          gardenData.questionnaire_result === "pending" || gardenData.questionnaire_result === "trial"
      }
      appointment.latePickupRequested = gardenData.late_pickup_requested || false
      appointment.latePickupNotes = gardenData.late_pickup_notes || undefined
      appointment.gardenTrimNails = gardenData.garden_trim_nails || false
      appointment.gardenBrush = gardenData.garden_brush || false
      appointment.gardenBath = gardenData.garden_bath || false
    }

    return { success: true, appointment }
  } catch (error) {
    console.error(`❌ [getSingleManagerAppointment] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch appointment",
    }
  }
}

export async function searchManagerSchedule({
  term,
  limit = 12,
}: {
  term: string
  limit?: number
}): Promise<ManagerScheduleSearchResponse> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) {
    return { appointments: [], treatments: [], clients: [] }
  }

  if (!supabase) {
    console.error("❌ [searchManagerSchedule] Supabase client not initialized")
    throw new Error("Supabase client not initialized")
  }

  try {
    const { data, error } = await supabase.functions.invoke("search-manager-schedule", {
      body: {
        term: normalizedTerm,
        limit,
      },
    })

    if (error) {
      console.error("❌ [searchManagerSchedule] Edge function error", {
        normalizedTerm,
        limit,
        error,
      })
      throw new Error(error.message || "Failed to search manager schedule")
    }

    const response = (data ?? {}) as {
      success?: boolean
      appointments?: ManagerAppointment[]
      treatments?: ManagerScheduleTreatmentSearchResult[]
      clients?: ManagerScheduleSearchClient[]
      error?: string
    }
    if (!response.success) {
      const fallbackMessage = response.error || "Failed to search manager schedule"
      throw new Error(fallbackMessage)
    }

    const appointments: ManagerAppointment[] = Array.isArray(response.appointments) ? response.appointments : []
    const treatments: ManagerScheduleTreatmentSearchResult[] = Array.isArray(response.treatments) ? response.treatments : []
    const clients: ManagerScheduleSearchClient[] = Array.isArray(response.clients) ? response.clients : []

    return { appointments, treatments, clients }
  } catch (error) {
    console.error("❌ [searchManagerSchedule] Unexpected failure", {
      normalizedTerm,
      limit,
      error,
    })
    throw error instanceof Error ? error : new Error("Failed to search manager schedule")
  }
}

export async function getProposedMeetingPublic(meetingId: string): Promise<ProposedMeetingPublicDetails> {
  if (!meetingId) {
    throw new Error("meetingId is required")
  }

  const { data, error } = await supabase.functions.invoke("get-proposed-meeting", {
    body: { meetingId },
  })

  if (error) {
    throw new Error(error.message || "Failed to load proposed meeting")
  }

  const response = data as { success?: boolean; meeting?: ProposedMeetingPublicDetails; error?: string }
  if (!response?.success || !response.meeting) {
    throw new Error(response?.error || "Proposed meeting not found")
  }

  return response.meeting
}

export async function bookProposedMeeting(params: {
  meetingId: string
  treatmentId: string
  code?: string
}): Promise<{ success: boolean; appointmentId?: string }> {
  if (!params.meetingId || !params.treatmentId) {
    throw new Error("meetingId and treatmentId are required")
  }

  const { data, error } = await supabase.functions.invoke("book-proposed-meeting", {
    body: params,
  })

  if (error) {
    throw new Error(error.message || "Failed to confirm meeting")
  }

  const response = data as { success?: boolean; appointmentId?: string; error?: string }
  if (!response?.success) {
    throw new Error(response?.error || "Unable to confirm meeting")
  }

  return { success: true, appointmentId: response.appointmentId }
}

export interface ProposedMeetingInput {
  stationId: string
  startTime: string
  endTime: string
  serviceType: "grooming" | "garden"
  title?: string
  summary?: string
  notes?: string
  customerIds: string[]
  customerTypeIds: string[]
  status?: string
  code?: string
  rescheduleAppointmentId?: string | null
  rescheduleCustomerId?: string | null
  rescheduleTreatmentId?: string | null
  rescheduleOriginalStartAt?: string | null
  rescheduleOriginalEndAt?: string | null
}

export interface ProposedMeetingUpdateInput extends ProposedMeetingInput {
  meetingId: string
}

export async function createProposedMeeting(params: ProposedMeetingInput): Promise<{
  success: boolean
  meetingId: string
  code: string
}> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const basePayload = {
    station_id: params.stationId,
    start_at: params.startTime,
    end_at: params.endTime,
    service_type: params.serviceType,
    title: sanitizeText(params.title),
    summary: sanitizeText(params.summary),
    notes: sanitizeText(params.notes),
    status: params.status || "proposed",
    reschedule_appointment_id: params.rescheduleAppointmentId ?? null,
    reschedule_customer_id: params.rescheduleCustomerId ?? null,
    reschedule_treatment_id: params.rescheduleTreatmentId ?? null,
    reschedule_original_start_at: params.rescheduleOriginalStartAt ?? null,
    reschedule_original_end_at: params.rescheduleOriginalEndAt ?? null,
  }

  let createdMeetingId: string | null = null
  let createdCode: string | null = params.code?.trim() || null
  let lastError: Error | null = null

  for (let attempt = 0; attempt < PROPOSED_MEETING_CODE_ATTEMPTS; attempt += 1) {
    const code = createdCode || generateProposedMeetingCode()
    const { data, error } = await supabase
      .from("proposed_meetings")
      .insert({ ...basePayload, code })
      .select("id, code")
      .single()

    if (error) {
      // Retry on unique violation (duplicate code) when auto-generating codes
      if (error.code === "23505" && !params.code) {
        console.warn("⚠️ [createProposedMeeting] Duplicate code detected, retrying...")
        createdCode = null
        lastError = error
        continue
      }
      lastError = error
      break
    }

    createdMeetingId = data?.id ?? null
    createdCode = data?.code ?? code
    break
  }

  if (!createdMeetingId || !createdCode) {
    throw lastError ?? new Error("Failed to create proposed meeting")
  }

  try {
    await syncProposedMeetingCategories(createdMeetingId, params.customerTypeIds)
    await syncProposedMeetingInvites(createdMeetingId, params.customerIds, params.customerTypeIds)
  } catch (syncError) {
    console.error("❌ [createProposedMeeting] Failed to sync metadata, rolling back", syncError)
    await supabase.from("proposed_meetings").delete().eq("id", createdMeetingId)
    throw syncError instanceof Error ? syncError : new Error("Failed to finalize proposed meeting setup")
  }

  return { success: true, meetingId: createdMeetingId, code: createdCode }
}

export async function updateProposedMeeting(params: ProposedMeetingUpdateInput): Promise<{ success: boolean }> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const sanitizedPayload = {
    station_id: params.stationId,
    start_at: params.startTime,
    end_at: params.endTime,
    service_type: params.serviceType,
    title: sanitizeText(params.title),
    summary: sanitizeText(params.summary),
    notes: sanitizeText(params.notes),
    status: params.status || "proposed",
    reschedule_appointment_id: params.rescheduleAppointmentId ?? null,
    reschedule_customer_id: params.rescheduleCustomerId ?? null,
    reschedule_treatment_id: params.rescheduleTreatmentId ?? null,
    reschedule_original_start_at: params.rescheduleOriginalStartAt ?? null,
    reschedule_original_end_at: params.rescheduleOriginalEndAt ?? null,
  }

  const { error } = await supabase.from("proposed_meetings").update(sanitizedPayload).eq("id", params.meetingId)

  if (error) {
    throw new Error(error.message || "Failed to update proposed meeting")
  }

  await syncProposedMeetingCategories(params.meetingId, params.customerTypeIds)
  await syncProposedMeetingInvites(params.meetingId, params.customerIds, params.customerTypeIds)

  return { success: true }
}

export async function deleteProposedMeeting(meetingId: string): Promise<{ success: boolean }> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const { error } = await supabase.from("proposed_meetings").delete().eq("id", meetingId)
  if (error) {
    throw new Error(error.message || "Failed to delete proposed meeting")
  }

  return { success: true }
}

export async function sendProposedMeetingWebhook({
  inviteId,
  customerId,
  proposedMeetingId,
  notificationCount = 0,
}: {
  inviteId: string
  customerId: string
  proposedMeetingId: string
  notificationCount?: number
}): Promise<{ success: boolean; status: number }> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  if (!PROPOSED_MEETING_WEBHOOK_URL) {
    throw new Error("Webhook URL not configured")
  }

  const payload = {
    clientId: customerId,
    proposedMeetingId,
  }

  try {
    const response = await fetch(PROPOSED_MEETING_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const bodyText = await response.text().catch(() => "")

    if (!response.ok) {
      await supabase
        .from("proposed_meeting_invites")
        .update({
          last_webhook_status: `ERR:${response.status} ${bodyText}`.slice(0, 255),
        })
        .eq("id", inviteId)

      throw new Error(`Webhook failed with status ${response.status}`)
    }

    await supabase
      .from("proposed_meeting_invites")
      .update({
        last_notified_at: new Date().toISOString(),
        notification_count: notificationCount + 1,
        last_webhook_status: `OK:${response.status}`,
      })
      .eq("id", inviteId)

    return { success: true, status: response.status }
  } catch (error) {
    if (error instanceof Error) {
      await supabase
        .from("proposed_meeting_invites")
        .update({
          last_webhook_status: `ERR:${error.message}`.slice(0, 255),
        })
        .eq("id", inviteId)
    }
    throw error instanceof Error ? error : new Error("Webhook call failed")
  }
}

export async function sendManualProposedMeetingWebhook({
  proposedMeetingId,
  code,
  meetingLink,
  contact,
}: {
  proposedMeetingId: string
  code: string
  meetingLink: string
  contact: {
    name?: string
    phone?: string
    email?: string
  }
}): Promise<{ success: boolean; status: number }> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  if (!PROPOSED_MEETING_WEBHOOK_URL) {
    throw new Error("Webhook URL not configured")
  }

  const normalizedContact = {
    name: contact.name?.trim() || null,
    phone: contact.phone?.trim() || null,
    email: contact.email?.trim() || null,
  }

  if (!normalizedContact.phone && !normalizedContact.email) {
    throw new Error("Phone or email is required to send a manual invitation")
  }

  const payload = {
    proposedMeetingId,
    code,
    meetingLink,
    manualRecipient: normalizedContact,
    channel: "manual",
  }

  try {
    const response = await fetch(PROPOSED_MEETING_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const bodyText = await response.text().catch(() => "")

    if (!response.ok) {
      throw new Error(`Manual webhook failed with status ${response.status} ${bodyText}`)
    }

    return { success: true, status: response.status }
  } catch (error) {
    console.error("❌ [sendManualProposedMeetingWebhook] Webhook failed", {
      proposedMeetingId,
      error,
    })
    throw error instanceof Error ? error : new Error("Manual webhook call failed")
  }
}

const sanitizeText = (value?: string | null): string | null => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const uniqueStrings = (values: string[]): string[] => {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))))
}

async function syncProposedMeetingCategories(meetingId: string, categoryIds: string[]): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const normalized = uniqueStrings(categoryIds)

  const { data: existing, error } = await supabase
    .from("proposed_meeting_categories")
    .select("id, customer_type_id")
    .eq("proposed_meeting_id", meetingId)

  if (error) {
    throw new Error(error.message || "Failed to load meeting categories")
  }

  const existingByTypeId = new Map((existing ?? []).map((row) => [row.customer_type_id, row.id]))
  const toInsert = normalized.filter((typeId) => !existingByTypeId.has(typeId))
  const toDeleteIds = existing?.filter((row) => !normalized.includes(row.customer_type_id)).map((row) => row.id) ?? []

  if (toInsert.length) {
    await supabase
      .from("proposed_meeting_categories")
      .insert(toInsert.map((customerTypeId) => ({ proposed_meeting_id: meetingId, customer_type_id: customerTypeId })))
  }

  if (toDeleteIds.length) {
    await supabase.from("proposed_meeting_categories").delete().in("id", toDeleteIds)
  }
}

async function syncProposedMeetingInvites(
  meetingId: string,
  manualCustomerIds: string[],
  categoryIds: string[]
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const desiredPlan = await buildInvitePlan(manualCustomerIds, categoryIds)

  const { data: existing, error } = await supabase
    .from("proposed_meeting_invites")
    .select("id, customer_id, source, source_category_id")
    .eq("proposed_meeting_id", meetingId)

  if (error) {
    throw new Error(error.message || "Failed to load meeting invites")
  }

  const plan = new Map(desiredPlan)
  const invitesToDelete: string[] = []
  const invitesToUpdate: Array<{ id: string; source: string; source_category_id: string | null }> = []

  for (const invite of existing ?? []) {
    const desired = plan.get(invite.customer_id)
    if (!desired) {
      invitesToDelete.push(invite.id)
      continue
    }

    const normalizedCategory = desired.sourceCategoryId ?? null
    if (invite.source !== desired.source || (invite.source_category_id ?? null) !== normalizedCategory) {
      invitesToUpdate.push({
        id: invite.id,
        source: desired.source,
        source_category_id: normalizedCategory,
      })
    }

    plan.delete(invite.customer_id)
  }

  if (invitesToDelete.length) {
    await supabase.from("proposed_meeting_invites").delete().in("id", invitesToDelete)
  }

  if (invitesToUpdate.length) {
    await supabase.from("proposed_meeting_invites").upsert(
      invitesToUpdate.map((invite) => ({
        id: invite.id,
        source: invite.source,
        source_category_id: invite.source_category_id,
      })),
      { onConflict: "id" }
    )
  }

  if (plan.size) {
    await supabase.from("proposed_meeting_invites").insert(
      Array.from(plan.entries()).map(([customerId, meta]) => ({
        proposed_meeting_id: meetingId,
        customer_id: customerId,
        source: meta.source,
        source_category_id: meta.sourceCategoryId ?? null,
      }))
    )
  }
}

async function buildInvitePlan(
  manualCustomerIds: string[],
  categoryIds: string[]
): Promise<Map<string, { source: "manual" | "category"; sourceCategoryId?: string | null }>> {
  const plan = new Map<string, { source: "manual" | "category"; sourceCategoryId?: string | null }>()
  const manualIds = uniqueStrings(manualCustomerIds)

  manualIds.forEach((customerId) => {
    plan.set(customerId, { source: "manual" })
  })

  const normalizedCategories = uniqueStrings(categoryIds)
  if (!normalizedCategories.length) {
    return plan
  }

  const categoryCustomers = await fetchCustomersByTypeIds(normalizedCategories)
  for (const customer of categoryCustomers) {
    if (!customer?.id || plan.has(customer.id)) {
      continue
    }
    plan.set(customer.id, {
      source: "category",
      sourceCategoryId: customer.customer_type_id ?? null,
    })
  }

  return plan
}

async function fetchCustomersByTypeIds(typeIds: string[]): Promise<CustomerRow[]> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }
  if (!typeIds.length) {
    return []
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_type_id")
    .in("customer_type_id", typeIds)

  if (error) {
    throw new Error(error.message || "Failed to load customers for selected types")
  }

  return data ?? []
}

const generateProposedMeetingCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
