import { useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import type { WaitingListEntry } from "@/types"

export interface SupabaseWaitingListEntry {
  id: string
  customer_id: string
  treatment_id: string | null
  service_scope: "grooming" | "daycare" | "both"
  status: "active" | "fulfilled" | "cancelled"
  start_date: string
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LegacyWaitingListEntry {
  id: string
  treatmentId?: string
  treatment_id?: string
  serviceType?: string
  service_scope?: string
  status?: string
  dateRanges?: Array<{ startDate: string; endDate: string }>
  start_date?: string
  end_date?: string | null
  notes?: string | null
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export interface WaitingListDateRange {
  startDate: string
  endDate: string
}

/**
 * Get all waiting list entries for a given customer
 */
export async function getWaitingListEntries(customerId: string): Promise<SupabaseWaitingListEntry[]> {
  if (!customerId) {
    return []
  }

  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .eq("customer_id", customerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching waiting list entries:", error)
    throw new Error(`Failed to fetch waiting list: ${error.message}`)
  }

  return data || []
}

/**
 * Register a new waiting list entry
 */
export async function registerWaitingList(
  customerId: string,
  serviceType: "grooming" | "daycare" | "both",
  dateRanges: WaitingListDateRange[],
  _userId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!customerId) {
      throw new Error("Customer ID is required")
    }

    // Create entries for each date range
    const entries = dateRanges.map((range) => ({
      treatment_id: null,
      customer_id: customerId,
      service_scope: serviceType,
      status: "active" as const,
      start_date: range.startDate,
      end_date: range.endDate || null,
    }))

    const { error: insertError } = await supabase
      .from("waitlist")
      .insert(entries)

    if (insertError) {
      throw new Error(`Failed to register waiting list: ${insertError.message}`)
    }

    return {
      success: true,
      message: "נרשמת לרשימת ההמתנה בהצלחה",
    }
  } catch (error) {
    console.error("Error registering waiting list:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to register waiting list",
    }
  }
}

/**
 * Update an existing waiting list entry
 */
export async function updateWaitingListEntry(
  entryId: string,
  serviceType: "grooming" | "daycare" | "both",
  dateRanges: WaitingListDateRange[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (dateRanges.length === 0) {
      throw new Error("At least one date range is required")
    }

    // Update the first date range to the existing entry
    const { error: updateError } = await supabase
      .from("waitlist")
      .update({
        service_scope: serviceType,
        start_date: dateRanges[0].startDate,
        end_date: dateRanges[0].endDate || null,
      })
      .eq("id", entryId)

    if (updateError) {
      throw new Error(`Failed to update waiting list entry: ${updateError.message}`)
    }

    // If there are additional date ranges, create new entries for them
    if (dateRanges.length > 1) {
      const { data: existingEntry } = await supabase
        .from("waitlist")
        .select("customer_id")
        .eq("id", entryId)
        .single()

      if (existingEntry) {
        const newEntries = dateRanges.slice(1).map((range) => ({
          treatment_id: treatmentId,
          customer_id: existingEntry.customer_id,
          service_scope: serviceType,
          status: "active" as const,
          start_date: range.startDate,
          end_date: range.endDate || null,
        }))

        const { error: insertError } = await supabase
          .from("waitlist")
          .insert(newEntries)

        if (insertError) {
          console.error("Error creating additional entries:", insertError)
          // Don't fail the whole operation if this fails
        }
      }
    }

    return {
      success: true,
      message: "רשימת ההמתנה עודכנה בהצלחה",
    }
  } catch (error) {
    console.error("Error updating waiting list entry:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update waiting list entry",
    }
  }
}

/**
 * Delete a waiting list entry
 */
export async function deleteWaitingListEntry(
  entryId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { error } = await supabase
      .from("waitlist")
      .update({ status: "cancelled" })
      .eq("id", entryId)

    if (error) {
      throw new Error(`Failed to delete waiting list entry: ${error.message}`)
    }

    return {
      success: true,
      message: "רשימת ההמתנה נמחקה בהצלחה",
    }
  } catch (error) {
    console.error("Error deleting waiting list entry:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete waiting list entry",
    }
  }
}

/**
 * Update late pickup request for an appointment
 */
export async function updateLatePickup(
  appointmentId: string,
  latePickupRequested: boolean,
  latePickupNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Determine which table to update based on appointment type
    // Try grooming first
    const { error } = await supabase
      .from("grooming_appointments")
      .update({
        late_pickup_requested: latePickupRequested,
        late_pickup_notes: latePickupNotes || null,
      })
      .eq("id", appointmentId)

    // If not found in grooming, try daycare
    if (error && error.code !== "PGRST116") {
      const { error: daycareError } = await supabase
        .from("daycare_appointments")
        .update({
          late_pickup_requested: latePickupRequested,
          late_pickup_notes: latePickupNotes || null,
        })
        .eq("id", appointmentId)

      if (daycareError) {
        throw new Error(`Failed to update late pickup: ${daycareError.message}`)
      }
    } else if (error) {
      throw new Error(`Failed to update late pickup: ${error.message}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Error updating late pickup:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update late pickup",
    }
  }
}

/**
 * Cancel an appointment (simple - just update status)
 */
export async function cancelAppointment(
  appointmentId: string
): Promise<{ success: boolean; message?: string; error?: string; appointment?: { id: string; status: string } }> {
  try {
    const rpcResult = await updateAppointmentStatusViaRpc(appointmentId, "cancelled", null)

    if (rpcResult.success) {
      return {
        success: true,
        message: rpcResult.message,
        appointment: rpcResult.appointmentId
          ? {
              id: rpcResult.appointmentId,
              status: rpcResult.status ?? "cancelled",
            }
          : undefined,
      }
    }

    console.warn("[cancelAppointment] RPC path failed, falling back to direct table update:", rpcResult.error)

    // Try grooming appointments first
    const { data: groomingData, error: groomingError } = await supabase
      .from("grooming_appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId)
      .select("id, status")
      .single()

    if (groomingError && groomingError.code !== "PGRST116") {
      // If not found in grooming, try daycare
      const { data: daycareData, error: daycareError } = await supabase
        .from("daycare_appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId)
        .select("id, status")
        .single()

      if (daycareError) {
        throw new Error(`Failed to cancel appointment: ${daycareError.message}`)
      }

      return {
        success: true,
        message: "התור בוטל בהצלחה",
        appointment: {
          id: daycareData!.id,
          status: daycareData!.status,
        },
      }
    }

    if (!groomingData) {
      throw new Error("Appointment not found")
    }

    return {
      success: true,
      message: "התור בוטל בהצלחה",
      appointment: {
        id: groomingData.id,
        status: groomingData.status,
      },
    }
  } catch (error) {
    console.error("Error cancelling appointment:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel appointment",
    }
  }
}

/**
 * Cancel appointment with 24-hour validation (no webhook)
 */
export async function cancelAppointmentWithValidation(params: {
  appointmentId: string
  appointmentTime?: string
  serviceType?: "grooming" | "garden" | "both"
  treatmentId?: string
  stationId?: string
}): Promise<{
  success: boolean
  message?: string
  error?: string
  appointmentId?: string
  timeDifferenceHours?: number
}> {
  try {
    const { appointmentId, appointmentTime } = params
    const now = new Date()
    let timeDifferenceHours: number | null = null

    // Validate 24-hour rule if appointment time is provided
    if (appointmentTime) {
      const appointmentDateTime = new Date(appointmentTime)
      if (!Number.isNaN(appointmentDateTime.getTime())) {
        timeDifferenceHours = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

        if (timeDifferenceHours < 24) {
          return {
            success: false,
            error: `לא ניתן לבטל את התור. ביטול חייב להיות לפחות 24 שעות לפני מועד התור. נותרו ${timeDifferenceHours.toFixed(1)} שעות.`,
            timeDifferenceHours,
          }
        }
      }
    }

    // Cancel the appointment
    const result = await cancelAppointment(appointmentId)

    return {
      ...result,
      appointmentId,
      timeDifferenceHours,
    }
  } catch (error) {
    console.error("Error cancelling appointment with validation:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel appointment",
    }
  }
}

/**
 * Approve an appointment (update status to approved - no webhook)
 */
type AllowableAppointmentStatus = "approved" | "cancelled"

async function updateAppointmentStatusViaRpc(
  appointmentId: string,
  nextStatus: AllowableAppointmentStatus,
  serviceHint: "grooming" | "garden" | "daycare" | null
): Promise<{
  success: boolean
  message?: string
  appointmentId?: string
  status?: string
  error?: string
}> {
  try {
    console.log("[updateAppointmentStatusViaRpc] Calling approve_appointment_arrival RPC", {
      appointmentId,
      nextStatus,
      serviceHint,
    })

    const { data, error } = await supabase.rpc("approve_appointment_arrival", {
      p_appointment_id: appointmentId,
      p_new_status: nextStatus,
      p_service_hint: serviceHint,
    })

    if (error) {
      console.error("[updateAppointmentStatusViaRpc] RPC error:", error)
      return {
        success: false,
        error: error.message || "Failed to update appointment status",
      }
    }

    if (!data || data.success !== true) {
      console.error("[updateAppointmentStatusViaRpc] RPC returned unsuccessful payload:", data)
      return {
        success: false,
        error: data?.error || "Failed to update appointment status",
      }
    }

    console.log("[updateAppointmentStatusViaRpc] Appointment status updated successfully", data)

    return {
      success: true,
      message: nextStatus === "cancelled" ? "התור בוטל בהצלחה" : "התור אושר בהצלחה",
      appointmentId: data.appointment_id as string | undefined,
      status: data.status as string | undefined,
    }
  } catch (error) {
    console.error("[updateAppointmentStatusViaRpc] Unexpected error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update appointment status",
    }
  }
}

export async function approveAppointment(
  appointmentId: string,
  approvalStatus: "approved"
): Promise<{
  success: boolean
  message?: string
  appointmentId?: string
  approvalStatus?: string
  error?: string
}> {
  const result = await updateAppointmentStatusViaRpc(appointmentId, approvalStatus, "garden")
  return {
    ...result,
    approvalStatus: result.status,
  }
}

/**
 * Approve a grooming appointment (update status to approved - no webhook)
 */
export async function approveGroomingAppointment(
  appointmentId: string,
  approvalStatus: "approved"
): Promise<{
  success: boolean
  message?: string
  appointment?: { id: string; status: string }
  error?: string
}> {
  const result = await updateAppointmentStatusViaRpc(appointmentId, approvalStatus, "grooming")

  if (!result.success) {
    return result
  }

  return {
    success: true,
    message: result.message,
    appointment: result.appointmentId
      ? {
          id: result.appointmentId,
          status: result.status ?? approvalStatus,
        }
      : undefined,
  }
}

/**
 * Transform waiting list data from API format to component format
 * Handles both new Supabase format and legacy format
 */
export function transformWaitingListEntries(
  waitingListData: SupabaseWaitingListEntry[] | LegacyWaitingListEntry[] | { entries?: LegacyWaitingListEntry[] } | undefined,
  treatmentIds?: string[]
): WaitingListEntry[] {
  // Handle both old format ({ entries: [...] }) and new format (array directly)
  let entries: LegacyWaitingListEntry[] = []
  if (Array.isArray(waitingListData)) {
    entries = waitingListData
  } else if (waitingListData && typeof waitingListData === "object" && "entries" in waitingListData) {
    entries = (waitingListData as { entries?: LegacyWaitingListEntry[] })?.entries ?? []
  }

  // Transform from Supabase format to component format
  return entries
    .filter((entry) => {
      if (!treatmentIds || treatmentIds.length === 0) {
        return true
      }
      const treatmentId = entry.treatment_id || entry.treatmentId
      return !treatmentId || treatmentIds.includes(treatmentId)
    })
    .map((entry) => {
      const treatmentId = entry.treatment_id || entry.treatmentId || null
      const serviceType = entry.service_scope || entry.serviceType || "grooming"
      const status = entry.status || "pending"

      // Convert date fields to dateRanges format
      const dateRanges: Array<{ startDate: string; endDate: string }> = []
      if (entry.start_date) {
        dateRanges.push({
          startDate: entry.start_date,
          endDate: entry.end_date || entry.start_date,
        })
      } else if (entry.dateRanges && Array.isArray(entry.dateRanges)) {
        dateRanges.push(...entry.dateRanges)
      }

      return {
        id: entry.id,
        treatmentId,
        treatmentName: (entry as any)?.treatment_name || (entry as any)?.treatmentName || null,
        serviceType: serviceType === "daycare" ? "garden" : serviceType, // Map daycare to garden for compatibility
        status: status,
        dateRanges,
        notes: entry.notes || null,
        createdAt: entry.created_at || entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updated_at || entry.updatedAt || new Date().toISOString(),
      }
    })
}

/**
 * Hook to transform waiting list entries for use in components
 */
export function useWaitingListEntries(
  waitingListData: SupabaseWaitingListEntry[] | LegacyWaitingListEntry[] | { entries?: LegacyWaitingListEntry[] } | undefined,
  treatmentIds?: string[]
): WaitingListEntry[] {
  return useMemo(() => transformWaitingListEntries(waitingListData, treatmentIds), [waitingListData, treatmentIds])
}
