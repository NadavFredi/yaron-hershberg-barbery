import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

  // If it's a "proposed-" prefixed ID, it's a proposed meeting and not a real grooming appointment
  // Return empty string to indicate this is not a valid grooming appointment ID
  if (appointmentId.startsWith("proposed-")) {
    return ""
  }

  // If it's not a combined ID, return as-is (assuming it's a valid UUID)
  return appointmentId
}
