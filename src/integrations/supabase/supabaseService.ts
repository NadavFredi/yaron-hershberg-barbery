import { supabase } from "./client"
import type { Database } from "./types"
import { normalizePhone } from "@/utils/phone"
import { isAuthError, handleInvalidToken } from "@/utils/auth"
import { HttpError } from "@/utils/errorMessages"
import type {
  ManagerScheduleData,
  ManagerAppointment,
  ManagerStation,
  ManagerDog,
  ManagerServiceFilter,
  ManagerScheduleSearchResponse,
  ManagerScheduleDogSearchResult,
  ManagerScheduleSearchClient,
} from "@/pages/ManagerSchedule/types"
import type { ProposedMeetingPublicDetails } from "@/types/proposedMeeting"

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]
type CustomerTypeRow = Database["public"]["Tables"]["customer_types"]["Row"]
type ProposedMeetingRow = Database["public"]["Tables"]["proposed_meetings"]["Row"] & {
  stations?: { id: string; name: string } | { id: string; name: string }[] | null
  proposed_meeting_invites?: ProposedMeetingInviteRow[] | null
  proposed_meeting_categories?: ProposedMeetingCategoryRow[] | null
  proposed_meeting_dog_categories?: ProposedMeetingDogCategoryRow[] | null
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
type ProposedMeetingDogCategoryRow = Database["public"]["Tables"]["proposed_meeting_dog_categories"]["Row"] & {
  dog_category?: { name: string } | null
}

const PROPOSED_MEETING_WEBHOOK_URL = "https://hook.eu2.make.com/4vndwatkc4r648au3t1mc394gh73pfny"
const PROPOSED_MEETING_CODE_ATTEMPTS = 5

const asSingle = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

export interface DogRecord {
  id: string
  name: string
  breed: string
  size: string
  isSmall: boolean
  ownerId: string
  image_url?: string | null
  gender?: "male" | "female" | null
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
  dogId: string
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

export interface ClientProfile {
  id: string
  fullName: string | null
  phone: string | null
  email: string | null
  address: string | null
  customerTypeId?: string | null
  customerTypeName?: string | null
}

async function hasDogAppointmentHistory(dogId: string): Promise<boolean> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  if (!dogId) {
    throw new Error("dogId is required")
  }

  // dog_id removed - returning 0 count
  const [{ count: groomingCount, error: groomingError }] = await Promise.all([
    Promise.resolve({ count: 0, error: null }),
  ])

  if (groomingError) {
    console.error("❌ [hasDogAppointmentHistory] Failed to check grooming appointments", groomingError)
    throw groomingError
  }

  // Daycare appointments don't exist in this system - set count to 0
  const daycareCount = 0

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

// Reserve a single appointment (service-based, human barbershop)
export async function reserveAppointment(
  serviceId: string,
  date: string,
  stationId: string,
  startTime: string,
  notes?: string
): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
  const payload = {
    serviceId,
    date,
    stationId,
    startTime,
    ...(notes ? { notes } : {}),
  }

  return await callSupabaseFunction("reserve-appointment", payload)
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
  dogId?: string
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
      dogId: options.dogId,
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

/**
 * Manager approval of appointment (simple PostgREST update)
 * This is for MANAGERS only - changes the status field from "pending" to "approved"
 */
export const approveAppointmentByManager = async (
  appointmentId: string,
  appointmentType: "grooming" | "garden",
  status: "approved" | "cancelled" = "approved"
): Promise<{
  success: boolean
  message?: string
  error?: string
  appointment?: { id: string; status: string }
}> => {
  try {
    if (!supabase) {
      console.error("❌ [approveAppointmentByManager] Supabase client not initialized")
      throw new Error("Supabase client not initialized")
    }

    console.log(`🔵 [approveAppointmentByManager] Updating appointment status`, {
      appointmentId,
      appointmentType,
      status,
    })

    const tableName = appointmentType === "grooming" ? "grooming_appointments" : "daycare_appointments"

    const { data, error } = await supabase
      .from(tableName)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .select("id, status")
      .single()

    if (error) {
      console.error(`❌ [approveAppointmentByManager] Update error:`, error)
      return {
        success: false,
        error: error.message || "Failed to update appointment status",
      }
    }

    if (!data) {
      return {
        success: false,
        error: "Appointment not found",
      }
    }

    console.log(`✅ [approveAppointmentByManager] Appointment updated successfully:`, data)

    return {
      success: true,
      message: status === "approved" ? "התור אושר בהצלחה" : "התור בוטל בהצלחה",
      appointment: data,
    }
  } catch (error) {
    console.error(`❌ [approveAppointmentByManager] Error:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve appointment",
    }
  }
}

// Legacy functions for client approval - these use RPC for client confirmation
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

  const dogCategories =
    row.proposed_meeting_dog_categories?.map((category) => ({
      id: category.id,
      dogCategoryId: category.dog_category_id,
      dogCategoryName: category.dog_category?.name ?? null,
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
    dogs: [],
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
    proposedDogCategories: dogCategories,
    proposedLinkedAppointmentId: row.reschedule_appointment_id || undefined,
    proposedLinkedCustomerId: row.reschedule_customer_id || undefined,
    proposedLinkedDogId: row.reschedule_dog_id || undefined,
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
              series_id,
              customer_id,
              client_approved_arrival,
              manager_approved_arrival,
              treatment_started_at,
              treatment_ended_at,
              created_at,
              updated_at,
              stations(id, name),
              customers(id, full_name, phone, email, classification)
            `
            )
            .gte("start_at", dayStart.toISOString())
            .lte("start_at", dayEnd.toISOString())
            .order("start_at")

    // Fetch daycare appointments
    // Daycare appointments don't exist in this system - return empty result
    const daycarePromise = Promise.resolve({ data: [], error: null })

    const [groomingResult, daycareResult] = await Promise.all([groomingPromise, daycarePromise])

    if (groomingResult.error) {
      throw new Error(`Failed to fetch grooming appointments: ${groomingResult.error.message}`)
    }
    // Daycare appointments don't exist in this system - daycareResult is always empty

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
      const customer = Array.isArray(apt.customers) ? apt.customers[0] : apt.customers

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
        groomingNotes: (apt as any).grooming_notes || undefined,
        hasCrossServiceAppointment: hasCrossService,
        dogs: [], // Removed dog references - barbery system doesn't use dogs
        clientId: apt.customer_id,
        clientName: customer?.full_name || undefined,
        clientClassification: customer?.classification || undefined,
        clientEmail: customer?.email || undefined,
        clientPhone: customer?.phone || undefined,
        appointmentType: apt.appointment_kind === "personal" ? "private" : "business",
        isPersonalAppointment: apt.appointment_kind === "personal",
        personalAppointmentDescription: apt.appointment_name || undefined,
        price: apt.amount_due ? Number(apt.amount_due) : undefined,
        seriesId: apt.series_id || undefined,
        durationMinutes: Math.round((new Date(apt.end_at).getTime() - new Date(apt.start_at).getTime()) / 60000),
        clientApprovedArrival: apt.client_approved_arrival || null,
        managerApprovedArrival: apt.manager_approved_arrival || null,
        treatmentStartedAt: apt.treatment_started_at || null,
        treatmentEndedAt: apt.treatment_ended_at || null,
        ...(apt.created_at && { created_at: apt.created_at }),
        ...(apt.updated_at && { updated_at: apt.updated_at }),
      } as any)
    }

    // Process daycare appointments
    for (const apt of daycareAppointments) {
      const customer = Array.isArray(apt.customers) ? apt.customers[0] : apt.customers

      const managerDog: ManagerDog = {
        id: "",
        name: "",
        breed: undefined,
        ownerId: apt.customer_id,
        clientClassification: customer?.classification,
        clientName: customer?.full_name,
        minGroomingPrice: undefined,
        maxGroomingPrice: undefined,
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
        dogs: [managerDog],
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
        seriesId: apt.series_id || undefined,
        durationMinutes: Math.round((new Date(apt.end_at).getTime() - new Date(apt.start_at).getTime()) / 60000),
        clientApprovedArrival: apt.client_approved_arrival || null,
        managerApprovedArrival: apt.manager_approved_arrival || null,
        treatmentStartedAt: apt.treatment_started_at || null,
        treatmentEndedAt: apt.treatment_ended_at || null,
        ...(apt.created_at && { created_at: apt.created_at }),
        ...(apt.updated_at && { updated_at: apt.updated_at }),
      } as any)
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
            reschedule_dog_id,
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
            ),
            proposed_meeting_dog_categories(
              id,
              dog_category_id,
              dog_category:dog_categories(name)
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
  customerNotes?: string
  groomingNotes?: string
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

// Helper function to get or create system customer for private appointments
async function getOrCreateSystemCustomer(appointmentName: string): Promise<{ customerId: string }> {
  const SYSTEM_CUSTOMER_NAME = "צוות פנימי"
  const SYSTEM_PHONE = "0000000000"

  // Try to find existing system customer by phone (matching edge function logic)
  let { data: systemCustomer, error: customerSearchError } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", SYSTEM_PHONE)
    .maybeSingle()

  if (customerSearchError && customerSearchError.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine - we'll create one
    console.error("❌ [getOrCreateSystemCustomer] Error searching for system customer:", customerSearchError)
    throw new Error(`Failed to search for system customer: ${customerSearchError.message}`)
  }

  // If system customer doesn't exist, create it
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
        phone: SYSTEM_PHONE,
        classification: "existing", // Use valid enum value: 'extra_vip', 'vip', 'existing', 'new'
        auth_user_id: user.id, // Required by RLS policy
      })
      .select("id")
      .single()

    if (customerError || !newCustomer) {
      console.error("❌ [getOrCreateSystemCustomer] Error creating system customer:", customerError)
      throw new Error(`Failed to create system customer: ${customerError?.message || "Unknown error"}`)
    }

    systemCustomer = newCustomer
    console.log("✅ [getOrCreateSystemCustomer] Created system customer:", systemCustomer.id)
  } else {
    console.log("✅ [getOrCreateSystemCustomer] Found existing system customer:", systemCustomer.id)
  }

  return { customerId: systemCustomer.id }
}

// Create manager appointment via edge function (for business/garden) or PostgREST (for private)
export async function createManagerAppointment(params: {
  name: string
  stationId: string
  selectedStations: string[]
  startTime: string
  endTime: string
  appointmentType: "private" | "business" | "garden"
  groupId?: string
  customerId?: string
  dogId?: string
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

  // For private appointments, use PostgREST directly instead of edge function
  if (params.appointmentType === "private") {
    console.log("🔒 [createManagerAppointment] Creating private appointment via PostgREST")

    try {
      // Get or create system customer
      const { customerId } = await getOrCreateSystemCustomer(params.name)

      // Generate group ID if multiple stations
      const finalGroupId =
        params.groupId ||
        (params.selectedStations.length > 1
          ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          : undefined)

      // Get stations to use
      const stationsToUse = params.selectedStations.length > 0 ? params.selectedStations : [params.stationId]

      // Create appointments for each station
      const appointmentIds: string[] = []

      for (const stationIdToUse of stationsToUse) {
        const { data: appointment, error: insertError } = await supabase
          .from("grooming_appointments")
          .insert({
            customer_id: customerId,
            station_id: stationIdToUse,
            start_at: params.startTime,
            end_at: params.endTime,
            status: "approved",
            appointment_kind: "personal",
            // appointment_name column doesn't exist - skipping
            series_id: finalGroupId || null,
            customer_notes: params.notes || null,
            internal_notes: params.internalNotes || null,
          })
          .select("id")
          .single()

        if (insertError) {
          console.error(`❌ [createManagerAppointment] Error creating private appointment:`, insertError)
          throw new Error(`Failed to create private appointment: ${insertError.message}`)
        }

        if (appointment) {
          appointmentIds.push(appointment.id)
          console.log(
            `✅ [createManagerAppointment] Created private appointment ${appointment.id} for station ${stationIdToUse}`
          )
        }
      }

      console.log("🎉 [createManagerAppointment] Successfully created all private appointments:", appointmentIds)

      return {
        success: true,
        appointmentIds,
        appointmentId: appointmentIds[0],
        groupId: finalGroupId,
        message: "תור פרטי נוצר בהצלחה",
      }
    } catch (error) {
      console.error("❌ [createManagerAppointment] Error creating private appointment:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check for auth errors
      if (
        errorMessage.includes("JWT") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("unauthorized")
      ) {
        handleInvalidToken()
        throw new HttpError("ההתחברות שלך פגה או לא תקינה. אנא התחבר מחדש כדי להמשיך.", 401, error)
      }

      throw new Error(errorMessage || "אירעה שגיאה ביצירת התור הפרטי. אנא נסה שוב.")
    }
  }

  // For business and garden appointments, use edge function
  console.log(`📋 [createManagerAppointment] Creating ${params.appointmentType} appointment via edge function`)
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
  dogId?: string
  stationId?: string
  updateCustomer?: boolean
  clientName?: string
  dogName?: string
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

// Delete appointment in Supabase (manager operation) - actually deletes the record
export async function managerDeleteAppointment(params: {
  appointmentId: string
  appointmentTime: string
  serviceType: "grooming" | "garden"
  dogId?: string
  stationId?: string
  updateCustomer?: boolean
  clientName?: string
  dogName?: string
  appointmentDate?: string
  groupId?: string
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const tableName = params.serviceType === "grooming" ? "grooming_appointments" : "daycare_appointments"

    // Actually delete the appointment record
    const { error } = await supabase.from(tableName).delete().eq("id", params.appointmentId)

    if (error) {
      throw new Error(`Failed to delete appointment: ${error.message}`)
    }

    // If this is a group appointment, delete all appointments in the group
    if (params.groupId) {
      const { error: groupError } = await supabase
        .from("grooming_appointments")
        .delete()
        .eq("series_id", params.groupId)

      if (groupError) {
        console.warn(`Failed to delete group appointments: ${groupError.message}`)
      }
    }

    return { success: true, message: "התור נמחק בהצלחה" }
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
        ${serviceType === "grooming" ? "appointment_kind," : ""}
        amount_due,
        customer_id,
        ${
          serviceType === "garden"
            ? "service_type, late_pickup_requested, late_pickup_notes, garden_trim_nails, garden_brush, garden_bath, questionnaire_result,"
            : ""
        }
        created_at,
        updated_at,
        stations(id, name),
        customers(id, full_name, phone, email, classification)
      `
      )
      .eq("id", appointmentId)
      .limit(1)

    if (error) {
      // Log only if it's a real error, not just "not found"
      if (error.code !== "PGRST116") {
        console.error(`❌ [getSingleManagerAppointment] Query error for appointment ${appointmentId}:`, error)
      }
      return {
        success: false,
        error: error.message || "Failed to fetch appointment",
      }
    }

    if (!data || data.length === 0) {
      // Appointment doesn't exist - this is normal for cancelled/deleted appointments
      // Return gracefully (calling code handles this)
      return {
        success: false,
        error: "Appointment not found",
      }
    }

    // Take the first result (should only be one since we're querying by ID)
    const appointmentData = data[0]

    // Check for combined appointment
    const { data: combinedData } = await supabase
      .from("combined_appointments")
      .select("grooming_appointment_id, daycare_appointment_id")
      .or(`${serviceType === "grooming" ? "grooming" : "daycare"}_appointment_id.eq.${appointmentId}`)
      .maybeSingle()

    const hasCrossService = !!combinedData

    const station = Array.isArray(appointmentData.stations) ? appointmentData.stations[0] : appointmentData.stations
    const customer = Array.isArray(appointmentData.customers) ? appointmentData.customers[0] : appointmentData.customers

    // Removed dog/breed references - barbery system doesn't use dogs
    const managerDog: ManagerDog = {
      id: "",
      name: "",
      breed: undefined,
      ownerId: appointmentData.customer_id,
      clientClassification: customer?.classification,
      clientName: customer?.full_name,
      minGroomingPrice: undefined,
      maxGroomingPrice: undefined,
    }

    const appointment: ManagerAppointment = {
      id: appointmentData.id,
      serviceType,
      stationId: appointmentData.station_id || (serviceType === "garden" ? "garden-station" : station?.id || ""),
      stationName: serviceType === "garden" ? "גן הכלבים" : station?.name || "לא ידוע",
      startDateTime: appointmentData.start_at,
      endDateTime: appointmentData.end_at,
      status: appointmentData.status || "pending",
      paymentStatus: appointmentData.payment_status || undefined,
      notes: appointmentData.customer_notes || "",
      internalNotes: appointmentData.internal_notes || undefined,
      groomingNotes: serviceType === "grooming" ? (appointmentData as any).grooming_notes || undefined : undefined,
      hasCrossServiceAppointment: hasCrossService,
      dogs: [managerDog],
      clientId: appointmentData.customer_id,
      clientName: customer?.full_name || undefined,
      clientClassification: customer?.classification || undefined,
      clientEmail: customer?.email || undefined,
      clientPhone: customer?.phone || undefined,
      appointmentType:
        serviceType === "grooming" && appointmentData.appointment_kind === "personal" ? "private" : "business",
      isPersonalAppointment: serviceType === "grooming" && appointmentData.appointment_kind === "personal",
      personalAppointmentDescription:
        serviceType === "grooming" && (appointmentData as any).appointment_name
          ? (appointmentData as any).appointment_name
          : undefined,
      price: appointmentData.amount_due ? Number(appointmentData.amount_due) : undefined,
      durationMinutes: Math.round(
        (new Date(appointmentData.end_at).getTime() - new Date(appointmentData.start_at).getTime()) / 60000
      ),
      ...(appointmentData.created_at && { created_at: appointmentData.created_at }),
      ...(appointmentData.updated_at && { updated_at: appointmentData.updated_at }),
    } as any

    if (serviceType === "garden") {
      const gardenData = appointmentData as any
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
    return { appointments: [], dogs: [], clients: [] }
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
      dogs?: ManagerScheduleDogSearchResult[]
      clients?: ManagerScheduleSearchClient[]
      error?: string
    }
    if (!response.success) {
      const fallbackMessage = response.error || "Failed to search manager schedule"
      throw new Error(fallbackMessage)
    }

    const appointments: ManagerAppointment[] = Array.isArray(response.appointments) ? response.appointments : []
    const dogs: ManagerScheduleDogSearchResult[] = Array.isArray(response.dogs) ? response.dogs : []
    const clients: ManagerScheduleSearchClient[] = Array.isArray(response.clients) ? response.clients : []

    return { appointments, dogs, clients }
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
  dogId: string
  code?: string
}): Promise<{ success: boolean; appointmentId?: string }> {
  if (!params.meetingId || !params.dogId) {
    throw new Error("meetingId and dogId are required")
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
  dogCategoryIds?: string[]
  dogIds?: Array<{ customerId: string; dogId: string }>
  status?: string
  code?: string
  rescheduleAppointmentId?: string | null
  rescheduleCustomerId?: string | null
  rescheduleDogId?: string | null
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
    reschedule_dog_id: params.rescheduleDogId ?? null,
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
    await syncProposedMeetingDogCategories(createdMeetingId, params.dogCategoryIds || [])
    await syncProposedMeetingInvites(createdMeetingId, params.customerIds, params.customerTypeIds, params.dogIds)
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
    reschedule_dog_id: params.rescheduleDogId ?? null,
    reschedule_original_start_at: params.rescheduleOriginalStartAt ?? null,
    reschedule_original_end_at: params.rescheduleOriginalEndAt ?? null,
  }

  const { error } = await supabase.from("proposed_meetings").update(sanitizedPayload).eq("id", params.meetingId)

  if (error) {
    throw new Error(error.message || "Failed to update proposed meeting")
  }

  await syncProposedMeetingCategories(params.meetingId, params.customerTypeIds)
  await syncProposedMeetingDogCategories(params.meetingId, params.dogCategoryIds || [])
  await syncProposedMeetingInvites(params.meetingId, params.customerIds, params.customerTypeIds, params.dogIds)

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

async function syncProposedMeetingDogCategories(meetingId: string, dogCategoryIds: string[]): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const normalized = uniqueStrings(dogCategoryIds)

  const { data: existing, error } = await supabase
    .from("proposed_meeting_dog_categories")
    .select("id, dog_category_id")
    .eq("proposed_meeting_id", meetingId)

  if (error) {
    throw new Error(error.message || "Failed to load meeting dog categories")
  }

  const existingByCategoryId = new Map((existing ?? []).map((row) => [row.dog_category_id, row.id]))
  const toInsert = normalized.filter((categoryId) => !existingByCategoryId.has(categoryId))
  const toDeleteIds = existing?.filter((row) => !normalized.includes(row.dog_category_id)).map((row) => row.id) ?? []

  if (toInsert.length) {
    const { error: insertError } = await supabase
      .from("proposed_meeting_dog_categories")
      .insert(toInsert.map((dogCategoryId) => ({ proposed_meeting_id: meetingId, dog_category_id: dogCategoryId })))

    if (insertError) {
      throw new Error(insertError.message || "Failed to insert meeting dog categories")
    }
  }

  if (toDeleteIds.length) {
    const { error: deleteError } = await supabase.from("proposed_meeting_dog_categories").delete().in("id", toDeleteIds)

    if (deleteError) {
      throw new Error(deleteError.message || "Failed to delete meeting dog categories")
    }
  }
}

async function syncProposedMeetingInvites(
  meetingId: string,
  manualCustomerIds: string[],
  categoryIds: string[],
  dogIds?: Array<{ customerId: string; dogId: string }>
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  const desiredPlan = await buildInvitePlan(manualCustomerIds, categoryIds, dogIds)

  const { data: existing, error } = await supabase
    .from("proposed_meeting_invites")
    .select("id, customer_id, source, source_category_id, dog_id")
    .eq("proposed_meeting_id", meetingId)

  if (error) {
    throw new Error(error.message || "Failed to load meeting invites")
  }

  // Create a map keyed by customerId+dogId for proper matching
  const plan = new Map<
    string,
    { source: "manual" | "category"; sourceCategoryId?: string | null; dogId?: string | null }
  >()
  desiredPlan.forEach((meta, customerId) => {
    const key = `${customerId}:${meta.dogId ?? "null"}`
    plan.set(key, meta)
  })

  const invitesToDelete: string[] = []
  const invitesToUpdate: Array<{
    id: string
    source: string
    source_category_id: string | null
    dog_id: string | null
  }> = []

  for (const invite of existing ?? []) {
    const inviteKey = `${invite.customer_id}:${invite.dog_id ?? "null"}`
    const desired = plan.get(inviteKey)
    if (!desired) {
      invitesToDelete.push(invite.id)
      continue
    }

    const normalizedCategory = desired.sourceCategoryId ?? null
    const normalizedDogId = desired.dogId ?? null
    if (
      invite.source !== desired.source ||
      (invite.source_category_id ?? null) !== normalizedCategory ||
      (invite.dog_id ?? null) !== normalizedDogId
    ) {
      invitesToUpdate.push({
        id: invite.id,
        source: desired.source,
        source_category_id: normalizedCategory,
        dog_id: normalizedDogId,
      })
    }

    plan.delete(inviteKey)
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
        dog_id: invite.dog_id,
      })),
      { onConflict: "id" }
    )
  }

  if (plan.size) {
    // Extract customerId and dogId from the key
    const invitesToInsert = Array.from(plan.entries()).map(([key, meta]) => {
      const [customerId, dogIdStr] = key.split(":")
      const dogId = dogIdStr === "null" ? null : dogIdStr
      return {
        proposed_meeting_id: meetingId,
        customer_id: customerId,
        source: meta.source,
        source_category_id: meta.sourceCategoryId ?? null,
        dog_id: dogId,
      }
    })
    await supabase.from("proposed_meeting_invites").insert(invitesToInsert)
  }
}

async function buildInvitePlan(
  manualCustomerIds: string[],
  categoryIds: string[],
  dogIds?: Array<{ customerId: string; dogId: string }>
): Promise<Map<string, { source: "manual" | "category"; sourceCategoryId?: string | null; dogId?: string | null }>> {
  const plan = new Map<
    string,
    { source: "manual" | "category"; sourceCategoryId?: string | null; dogId?: string | null }
  >()
  const manualIds = uniqueStrings(manualCustomerIds)

  // Create a map of customerId -> dogId from dogIds array
  const dogIdMap = new Map<string, string>()
  if (dogIds) {
    dogIds.forEach(({ customerId, dogId }) => {
      dogIdMap.set(customerId, dogId)
    })
  }

  manualIds.forEach((customerId) => {
    plan.set(customerId, {
      source: "manual",
      dogId: dogIdMap.get(customerId) ?? null,
    })
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
      dogId: dogIdMap.get(customer.id) ?? null, // Use dogId if specified for this customer
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

// Fetch distinct personal appointment names for autocomplete with search
export async function getPersonalAppointmentNames(searchTerm?: string): Promise<string[]> {
  if (!supabase) {
    console.error("❌ [getPersonalAppointmentNames] Supabase client not initialized")
    return []
  }

  try {
    console.log("🔍 [getPersonalAppointmentNames] Fetching personal appointment names", { searchTerm })

    // appointment_name column doesn't exist - returning empty array
    console.log("⚠️ [getPersonalAppointmentNames] appointment_name column removed, returning empty array")
    const uniqueNames: string[] = []

    console.log(`✅ [getPersonalAppointmentNames] Found ${uniqueNames.length} appointment names`)
    return uniqueNames
  } catch (error) {
    console.error("❌ [getPersonalAppointmentNames] Unexpected error:", error)
    return []
  }
}
