import type { ManagerAppointment } from "../types"

/**
 * Checks if two appointments overlap in time
 */
function doAppointmentsOverlap(apt1: ManagerAppointment, apt2: ManagerAppointment): boolean {
  const start1 = new Date(apt1.startDateTime).getTime()
  const end1 = new Date(apt1.endDateTime).getTime()
  const start2 = new Date(apt2.startDateTime).getTime()
  const end2 = new Date(apt2.endDateTime).getTime()

  // Two appointments overlap if one starts before the other ends
  // and one ends after the other starts
  return start1 < end2 && end1 > start2
}

/**
 * Calculates which appointments overlap with each other within a station
 * Returns a Map where each appointment ID maps to an array of overlapping appointment IDs
 */
export function calculateAppointmentOverlaps(
  appointments: ManagerAppointment[]
): Map<string, string[]> {
  const overlaps = new Map<string, string[]>()

  for (let i = 0; i < appointments.length; i++) {
    const apt1 = appointments[i]
    const overlappingIds: string[] = []

    for (let j = i + 1; j < appointments.length; j++) {
      const apt2 = appointments[j]

      if (doAppointmentsOverlap(apt1, apt2)) {
        overlappingIds.push(apt2.id)
        
        // Also add apt1 to apt2's overlap list
        const apt2Overlaps = overlaps.get(apt2.id) || []
        if (!apt2Overlaps.includes(apt1.id)) {
          apt2Overlaps.push(apt1.id)
          overlaps.set(apt2.id, apt2Overlaps)
        }
      }
    }

    if (overlappingIds.length > 0) {
      overlaps.set(apt1.id, overlappingIds)
    }
  }

  return overlaps
}

/**
 * Checks if a specific appointment has overlaps
 */
export function hasOverlaps(
  appointmentId: string,
  overlaps: Map<string, string[]>
): boolean {
  return overlaps.has(appointmentId) && (overlaps.get(appointmentId)?.length ?? 0) > 0
}

/**
 * Gets the count of overlapping appointments for a specific appointment
 */
export function getOverlapCount(
  appointmentId: string,
  overlaps: Map<string, string[]>
): number {
  return overlaps.get(appointmentId)?.length ?? 0
}

/**
 * Finds all appointments in the same overlap group (transitive closure)
 * If A overlaps B and B overlaps C, then A, B, and C are all in the same group
 */
function findAllOverlappingGroup(
  appointmentId: string,
  overlaps: Map<string, string[]>,
  allAppointments: ManagerAppointment[]
): Set<string> {
  const group = new Set<string>()
  const visited = new Set<string>()
  const toVisit = [appointmentId]

  while (toVisit.length > 0) {
    const currentId = toVisit.pop()!
    if (visited.has(currentId)) continue
    
    visited.add(currentId)
    group.add(currentId)

    // Get all appointments that overlap with current (bidirectional)
    const directOverlaps = overlaps.get(currentId) || []
    directOverlaps.forEach(id => {
      if (!visited.has(id)) {
        toVisit.push(id)
      }
    })

    // Also check reverse - appointments that have current in their overlap list
    allAppointments.forEach(apt => {
      const aptOverlaps = overlaps.get(apt.id) || []
      if (aptOverlaps.includes(currentId) && !visited.has(apt.id)) {
        toVisit.push(apt.id)
      }
    })
  }

  return group
}

/**
 * Calculates z-index for an appointment based on its start time when it has overlaps
 * Later start times get higher z-index values so they appear on top
 */
export function calculateZIndexForOverlap(
  appointment: ManagerAppointment,
  allAppointments: ManagerAppointment[],
  overlaps: Map<string, string[]>
): number {
  const hasOverlaps = overlaps.has(appointment.id) && (overlaps.get(appointment.id)?.length ?? 0) > 0
  
  if (!hasOverlaps) {
    return 2 // Default z-index for non-overlapping appointments
  }

  // Find all appointments in the same overlap group (transitive closure)
  const overlappingIds = findAllOverlappingGroup(appointment.id, overlaps, allAppointments)

  // Get all overlapping appointments
  const overlappingAppointments = allAppointments.filter(apt => overlappingIds.has(apt.id))
  
  // Sort by start time (earlier first)
  overlappingAppointments.sort((a, b) => {
    const startA = new Date(a.startDateTime).getTime()
    const startB = new Date(b.startDateTime).getTime()
    return startA - startB
  })

  // Find the index of this appointment in the sorted list
  const index = overlappingAppointments.findIndex(apt => apt.id === appointment.id)
  
  // Base z-index of 10, add index so later appointments (higher index) have higher z-index
  return 10 + index
}

