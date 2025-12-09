// supabase/functions/get-available-times/supabase.ts
// Replace Airtable queries with direct Supabase queries

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl) {
  throw new Error("Missing Supabase configuration: SUPABASE_URL")
}

const supabaseKey = supabaseServiceRoleKey ?? supabaseAnonKey

if (!supabaseKey) {
  throw new Error("Missing Supabase configuration: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY")
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

interface TreatmentRecord {
  id: string
  treatment_type_id: string | null
  name: string
  customer_id: string | null
  customer_type_id: string | null
}

interface Station {
  id: string
  name: string
  is_active: boolean
  break_between_appointments: number
  slot_interval_minutes: number
}

interface WorkingHours {
  station_id: string
  weekday: string
  open_time: string
  close_time: string
  shift_order: number
}

interface Appointment {
  id: string
  station_id: string | null
  start_at: string
  end_at: string
  status: string
}

interface StationUnavailability {
  station_id: string
  start_time: string
  end_time: string
  reason: string
  is_active: boolean
}

export interface ServiceStationMatrix {
  service_id: string
  station_id: string
  base_time_minutes: number
  price: number
}

interface BusinessHour {
  weekday: string
  open_time: string
  close_time: string
}

interface StationTreatmentTypeRuleRow {
  station_id: string
  treatment_type_id: string | null
  is_active: boolean
  remote_booking_allowed: boolean
  requires_staff_approval: boolean
  duration_modifier_minutes: number | null
}

interface StationAllowedCustomerTypeRow {
  station_id: string
  customer_type_id: string
}


/**
 * Get treatment record with treatmentType information
 */
export async function getTreatmentRecord(treatmentId: string): Promise<TreatmentRecord | null> {
  console.log(`🔍 [getTreatmentRecord] Fetching treatment ${treatmentId}`)

  // First check if we have any treatments in the database
  const { count: totalCount } = await supabase.from("treatments").select("*", { count: "exact", head: true })

  console.log(`🔍 [getTreatmentRecord] Total treatments in database: ${totalCount}`)

  const { data, error } = await supabase
    .from("treatments")
    .select(
      `
        id,
        name,
        treatment_type_id,
        customer_id,
        customer:customers!left(customer_type_id)
      `,
    )
    .eq("id", treatmentId)
    .limit(1)

  if (error) {
    console.error(`❌ [getTreatmentRecord] Error fetching treatment:`, error)
    throw new Error(`Failed to fetch treatment: ${error.message}`)
  }

  if (!data || data.length === 0) {
    console.error(`❌ [getTreatmentRecord] Treatment ${treatmentId} not found in database`)
    return null
  }

  const rawTreatment = data[0] as {
    id: string
    name: string
    treatment_type_id: string | null
    customer_id: string | null
    customer: { customer_type_id: string | null }[] | { customer_type_id: string | null } | null
  }

  const customer =
    Array.isArray(rawTreatment.customer) ? rawTreatment.customer[0] : rawTreatment.customer ?? { customer_type_id: null }

  const treatment: TreatmentRecord = {
    id: rawTreatment.id,
    name: rawTreatment.name,
    treatment_type_id: rawTreatment.treatment_type_id,
    customer_id: rawTreatment.customer_id ?? null,
    customer_type_id: customer?.customer_type_id ?? null,
  }

  console.log(
    `✅ Found treatment: ${treatment.name}, treatment_type_id: ${treatment.treatment_type_id}, customer_id: ${treatment.customer_id}, customer_type: ${treatment.customer_type_id}`,
  )
  return treatment
}

/**
 * Get all active stations
 */
export async function getWorkstations(): Promise<Station[]> {
  console.log(`🔍 [getWorkstations] Fetching active stations`)
  const { data, error } = await supabase
    .from("stations")
    .select("id, name, is_active, break_between_appointments, slot_interval_minutes")
    .eq("is_active", true)

  if (error) {
    throw new Error(`Failed to fetch stations: ${error.message}`)
  }

  console.log(`✅ Found ${data.length} active stations`)
  return data || []
}

/**
 * Get working hours for stations
 */
export async function getOperatingHours(): Promise<WorkingHours[]> {
  console.log(`🔍 [getOperatingHours] Fetching station working hours`)
  const { data, error } = await supabase
    .from("station_working_hours")
    .select("station_id, weekday, open_time, close_time, shift_order")
    .order("station_id, weekday, shift_order")

  if (error) {
    throw new Error(`Failed to fetch working hours: ${error.message}`)
  }

  console.log(`✅ Found ${data?.length || 0} working hour entries`)
  return data || []
}

/**
 * Get appointments for a date range
 */
export async function getAppointmentsForDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
  console.log(
    `🔍 [getAppointmentsForDateRange] Fetching appointments from ${startDate.toISOString()} to ${endDate.toISOString()}`
  )

  const { data, error } = await supabase
    .from("grooming_appointments")
    .select("id, station_id, start_at, end_at, status")
    .gte("start_at", startDate.toISOString())
    .lte("start_at", endDate.toISOString())
    .neq("status", "cancelled")

  if (error) {
    throw new Error(`Failed to fetch appointments: ${error.message}`)
  }

  console.log(`✅ Found ${data?.length || 0} appointments`)
  return data || []
}

/**
 * Get station unavailability blocks
 */
export async function getStationUnavailability(startDate: Date, endDate: Date): Promise<StationUnavailability[]> {
  console.log(`🔍 [getStationUnavailability] Fetching unavailability blocks`)

  const { data, error } = await supabase
    .from("station_unavailability")
    .select("station_id, start_time, end_time, reason, is_active")
    .gte("end_time", startDate.toISOString())
    .lte("start_time", endDate.toISOString())

  if (error) {
    console.warn(`⚠️ Could not fetch unavailability blocks: ${error.message}`)
    return []
  }

  console.log(`✅ Found ${data?.length || 0} unavailability blocks`)
  return data || []
}

/**
 * Get treatmentType modifiers for duration calculations
 */
/**
 * Get service-station matrix for a service
 */
export async function getBusinessHours(): Promise<BusinessHour[]> {
  console.log(`🔍 [getBusinessHours] Fetching global business hours`)
  const { data, error } = await supabase.from("business_hours").select("weekday, open_time, close_time")

  if (error) {
    console.warn(`⚠️ Could not fetch business hours: ${error.message}`)
    return []
  }

  return data || []
}

export async function getStationTreatmentTypeRulesForTreatmentType(treatmentTypeId: string): Promise<StationTreatmentTypeRuleRow[]> {
  console.log(`🔍 [getStationTreatmentTypeRulesForTreatmentType] Fetching rules for treatmentType ${treatmentTypeId}`)

  const { data, error } = await supabase
    .from("station_treatmentType_rules")
    .select("station_id, treatment_type_id, is_active, remote_booking_allowed, requires_staff_approval, duration_modifier_minutes")
    .eq("treatment_type_id", treatmentTypeId)

  if (error) {
    throw new Error(`Failed to fetch station treatmentType rules: ${error.message}`)
  }

  return data || []
}

export async function getStationBaseDurations(stationIds: string[]): Promise<Map<string, number>> {
  if (stationIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from("service_station_matrix")
    .select("station_id, base_time_minutes")
    .in("station_id", stationIds)

  if (error) {
    throw new Error(`Failed to fetch station base durations: ${error.message}`)
  }

  const durations = new Map<string, number>()
  for (const row of data || []) {
    const baseTime = row.base_time_minutes ?? 0
    if (baseTime <= 0) continue
    const current = durations.get(row.station_id)
    if (current === undefined || baseTime < current) {
      durations.set(row.station_id, baseTime)
    }
  }

  return durations
}

export async function getStationAllowedCustomerTypes(): Promise<StationAllowedCustomerTypeRow[]> {
  console.log(`🔍 [getStationAllowedCustomerTypes] Fetching station customer type allowlists`)

  const { data, error } = await supabase
    .from("station_allowed_customer_types")
    .select("station_id, customer_type_id")

  if (error) {
    throw new Error(`Failed to fetch station allowed customer types: ${error.message}`)
  }

  return data || []
}

    .select("id, effective_date, total_limit, hourly_limit, full_day_limit, trial_limit, regular_limit")
    .order("effective_date", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch daycare capacity limits: ${error.message}`)
  }

  return data || []
}

/**
 * Get services (to find service ID from name)
 */
export async function getServiceByName(serviceName: string): Promise<{ id: string; name: string } | null> {
  console.log(`🔍 [getServiceByName] Fetching service by name: ${serviceName}`)

  const { data, error } = await supabase
    .from("services")
    .select("id, name")
    .ilike("name", `%${serviceName}%`)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch service: ${error.message}`)
  }

  return data
}
