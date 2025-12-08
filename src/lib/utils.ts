import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts UUIDs from a combined appointment ID.
 * Combined IDs have the format: "combined-{grooming_uuid}-{daycare_uuid}"
 * 
 * @param combinedId - The combined appointment ID
 * @returns An object with groomingId and daycareId, or null if the ID is not a combined ID
 */
export function extractCombinedAppointmentIds(combinedId: string): { groomingId: string; daycareId: string } | null {
  if (!combinedId.startsWith('combined-')) {
    return null
  }
  
  // Remove 'combined-' prefix (9 characters)
  const remaining = combinedId.slice(9) // 'combined-'.length = 9
  
  // UUIDs are exactly 36 characters long (including hyphens)
  // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // After removing "combined-", we have: {uuid1}-{uuid2}
  // The first UUID is 36 chars, then a hyphen separator, then the second UUID (36 chars)
  
  if (remaining.length < 73) { // 36 + 1 (hyphen) + 36 = 73
    return null
  }
  
  // Extract first UUID (first 36 characters)
  const groomingId = remaining.slice(0, 36)
  
  // Skip the hyphen separator and extract second UUID (next 36 characters)
  const daycareId = remaining.slice(37, 73)
  
  // Validate that both are valid UUIDs (basic format check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(groomingId) && uuidRegex.test(daycareId)) {
    return {
      groomingId,
      daycareId
    }
  }
  
  return null
}

/**
 * Extracts the garden (daycare) appointment ID from an appointment ID.
 * If it's a combined ID, returns the daycare UUID.
 * Otherwise, returns the original ID if it's a valid UUID for garden appointments.
 * 
 * @param appointmentId - The appointment ID (can be combined or single UUID)
 * @param gardenAppointmentId - Optional garden appointment ID from the appointment data
 * @returns The garden appointment ID to use
 */
export function extractGardenAppointmentId(appointmentId: string, gardenAppointmentId?: string): string {
  // If we have the garden appointment ID directly, use it
  if (gardenAppointmentId) {
    return gardenAppointmentId
  }
  
  // Try to extract from combined ID
  const combinedIds = extractCombinedAppointmentIds(appointmentId)
  if (combinedIds) {
    return combinedIds.daycareId
  }
  
  // If it's not a combined ID, return as-is (assuming it's a valid UUID)
  return appointmentId
}

/**
 * Extracts the grooming appointment ID from an appointment ID.
 * If it's a combined ID, returns the grooming UUID.
 * Otherwise, returns the original ID if it's a valid UUID for grooming appointments.
 * 
 * @param appointmentId - The appointment ID (can be combined or single UUID)
 * @param groomingAppointmentId - Optional grooming appointment ID from the appointment data
 * @returns The grooming appointment ID to use
 */
export function extractGroomingAppointmentId(appointmentId: string, groomingAppointmentId?: string): string {
  // If we have the grooming appointment ID directly, use it
  if (groomingAppointmentId) {
    return groomingAppointmentId
  }
  
  // Try to extract from combined ID
  const combinedIds = extractCombinedAppointmentIds(appointmentId)
  if (combinedIds) {
    return combinedIds.groomingId
  }
  
  // If it's not a combined ID, return as-is (assuming it's a valid UUID)
  return appointmentId
}
