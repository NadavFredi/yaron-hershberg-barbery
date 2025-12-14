import { supabase } from "@/integrations/supabase/client"

export type PinReason = "reschedule" | "attention" | "special" | "date_change" | "quick_access"
export type AppointmentType = "grooming" | "daycare"

export interface PinnedAppointment {
  id: string
  user_id: string
  appointment_id: string
  appointment_type: AppointmentType
  reason: PinReason
  notes: string | null
  target_date: string | null // ISO date string
  pinned_at: string
  last_accessed_at: string
  auto_remove_after: string | null
}

export interface PinAppointmentInput {
  appointment_id: string
  appointment_type: AppointmentType
  reason?: PinReason
  notes?: string
  target_date?: string // ISO date string
}

export interface UpdatePinInput {
  reason?: PinReason
  notes?: string
  target_date?: string | null // ISO date string or null to clear
}

/**
 * Get all pinned appointments for the current user
 */
export async function getPinnedAppointments(): Promise<PinnedAppointment[]> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  // Get current user ID
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("pinned_appointments")
    .select("*")
    .eq("user_id", user.id)
    .order("pinned_at", { ascending: false })

  if (error) {
    throw new Error(error.message || "Failed to fetch pinned appointments")
  }

  return data ?? []
}

/**
 * Pin an appointment
 */
export async function pinAppointment(input: PinAppointmentInput): Promise<PinnedAppointment> {
  console.log('[pinAppointment service] Starting with input:', input)
  
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  // Get current user ID
  console.log('[pinAppointment service] Getting current user...')
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('[pinAppointment service] User not authenticated:', userError)
    throw new Error("User not authenticated")
  }
  console.log('[pinAppointment service] User authenticated:', user.id)

  // Check if already pinned
  console.log('[pinAppointment service] Checking if already pinned...')
  const { data: existing, error: checkError } = await supabase
    .from("pinned_appointments")
    .select("id")
    .eq("user_id", user.id)
    .eq("appointment_id", input.appointment_id)
    .eq("appointment_type", input.appointment_type)
    .maybeSingle()

  if (checkError) {
    console.error('[pinAppointment service] Error checking existing:', checkError)
  }

  if (existing) {
    console.log('[pinAppointment service] Appointment already pinned')
    throw new Error("Appointment is already pinned")
  }

  const insertData = {
    user_id: user.id,
    appointment_id: input.appointment_id,
    appointment_type: input.appointment_type,
    reason: input.reason || "quick_access",
    notes: input.notes || null,
    target_date: input.target_date || null,
  }
  console.log('[pinAppointment service] Inserting data:', insertData)

  const { data, error } = await supabase
    .from("pinned_appointments")
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('[pinAppointment service] Insert error:', error)
    // Check if it's a limit error
    if (error.message?.includes("limit") || error.code === "23514") {
      throw new Error("Pin limit reached. Maximum 20 pinned appointments allowed.")
    }
    throw new Error(error.message || "Failed to pin appointment")
  }

  console.log('[pinAppointment service] Successfully pinned:', data)
  return data
}

/**
 * Update a pinned appointment
 */
export async function updatePinnedAppointment(
  pinId: string,
  updates: UpdatePinInput
): Promise<PinnedAppointment> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  // Get current user ID
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  const updateData: Record<string, unknown> = {}
  if (updates.reason !== undefined) updateData.reason = updates.reason
  if (updates.notes !== undefined) updateData.notes = updates.notes
  if (updates.target_date !== undefined) updateData.target_date = updates.target_date

  const { data, error } = await supabase
    .from("pinned_appointments")
    .update(updateData)
    .eq("id", pinId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || "Failed to update pinned appointment")
  }

  if (!data) {
    throw new Error("Pinned appointment not found")
  }

  return data
}

/**
 * Unpin an appointment (by pin ID or appointment ID)
 */
export async function unpinAppointment(
  pinId?: string,
  appointmentId?: string,
  appointmentType?: AppointmentType
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client not initialized")
  }

  if (!pinId && (!appointmentId || !appointmentType)) {
    throw new Error("Must provide either pinId or appointmentId/appointmentType")
  }

  // Get current user ID
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  let query = supabase.from("pinned_appointments").delete().eq("user_id", user.id)

  if (pinId) {
    query = query.eq("id", pinId)
  } else {
    query = query.eq("appointment_id", appointmentId!).eq("appointment_type", appointmentType!)
  }

  const { error } = await query

  if (error) {
    throw new Error(error.message || "Failed to unpin appointment")
  }
}

