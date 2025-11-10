// supabase/functions/get-available-times/availabilityCalculator.ts
//
// Core time-slot computation utilities shared by the edge function logic
// and the lightweight Deno tests in this directory.
//
// The functions here work with generic minute-based intervals so they can
// be composed with different data sources (Supabase rows, mocked data, etc).

import { AvailableDate, AvailableTime, CalculationInput } from "./types.ts"

export interface Interval {
  startMinute: number
  endMinute: number
}

export interface StationSlotConfig {
  stationId: string
  durationMinutes: number
  breakBetweenAppointments: number
  slotIncrementMinutes?: number
  requiresApproval?: boolean
}

export interface DailySlotComputation {
  station: StationSlotConfig
  baseIntervals: Interval[]
  positiveIntervals?: Interval[]
  negativeIntervals?: Interval[]
  appointmentBlocks?: Interval[]
}

const DEFAULT_SLOT_INCREMENT = 60

export function normalizeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals || intervals.length === 0) {
    return []
  }

  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute)
  const result: Interval[] = []

  for (const interval of sorted) {
    if (interval.endMinute <= interval.startMinute) {
      continue
    }
    if (result.length === 0) {
      result.push({ ...interval })
      continue
    }

    const last = result[result.length - 1]
    if (interval.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, interval.endMinute)
    } else {
      result.push({ ...interval })
    }
  }

  return result
}

export function intersectIntervalLists(a: Interval[], b: Interval[]): Interval[] {
  if (a.length === 0 || b.length === 0) {
    return []
  }

  const result: Interval[] = []
  let i = 0
  let j = 0
  const sortedA = normalizeIntervals(a)
  const sortedB = normalizeIntervals(b)

  while (i < sortedA.length && j < sortedB.length) {
    const currentA = sortedA[i]
    const currentB = sortedB[j]

    const start = Math.max(currentA.startMinute, currentB.startMinute)
    const end = Math.min(currentA.endMinute, currentB.endMinute)

    if (start < end) {
      result.push({ startMinute: start, endMinute: end })
    }

    if (currentA.endMinute < currentB.endMinute) {
      i++
    } else {
      j++
    }
  }

  return result
}

export function subtractIntervals(source: Interval[], block: Interval): Interval[] {
  if (source.length === 0) {
    return []
  }

  const result: Interval[] = []
  for (const interval of source) {
    if (block.endMinute <= interval.startMinute || block.startMinute >= interval.endMinute) {
      result.push(interval)
      continue
    }

    if (block.startMinute > interval.startMinute) {
      result.push({
        startMinute: interval.startMinute,
        endMinute: Math.min(block.startMinute, interval.endMinute),
      })
    }

    if (block.endMinute < interval.endMinute) {
      result.push({
        startMinute: Math.max(block.endMinute, interval.startMinute),
        endMinute: interval.endMinute,
      })
    }
  }

  return normalizeIntervals(result)
}

export function subtractIntervalList(source: Interval[], blocks: Interval[]): Interval[] {
  let current = normalizeIntervals(source)
  for (const block of normalizeIntervals(blocks)) {
    current = subtractIntervals(current, block)
    if (current.length === 0) {
      break
    }
  }
  return current
}

export function addPositiveIntervals(source: Interval[], additions: Interval[]): Interval[] {
  if (!additions || additions.length === 0) {
    return normalizeIntervals(source)
  }
  return normalizeIntervals([...source, ...additions])
}

export function roundUpToIncrement(minute: number, increment: number): number {
  if (increment <= 1) {
    return minute
  }
  const remainder = minute % increment
  if (remainder === 0) {
    return minute
  }
  return minute + (increment - remainder)
}

export function generateSlotsFromIntervals(intervals: Interval[], config: StationSlotConfig): number[] {
  const normalized = normalizeIntervals(intervals)
  const slots: number[] = []
  const increment = config.slotIncrementMinutes ?? DEFAULT_SLOT_INCREMENT
  const step = increment > 0 ? increment : config.durationMinutes

  for (const interval of normalized) {
    const latestStart = interval.endMinute - config.durationMinutes
    if (latestStart < interval.startMinute) {
      continue
    }

    let start = interval.startMinute
    while (start <= latestStart) {
      slots.push(start)
      start += step
    }
  }

  return slots
}

export function computeFreeIntervals(input: DailySlotComputation): Interval[] {
  const appointments = input.appointmentBlocks ?? []
  const positives = input.positiveIntervals ?? []
  const negatives = input.negativeIntervals ?? []

  // Merge base intervals and apply positive windows (which can extend availability)
  let intervals = addPositiveIntervals(input.baseIntervals, positives)

  // Remove negative constraints first
  if (negatives.length > 0) {
    intervals = subtractIntervalList(intervals, negatives)
  }

  // Remove appointment blocks (each already extended with station breaks)
  if (appointments.length > 0) {
    intervals = subtractIntervalList(intervals, appointments)
  }

  return normalizeIntervals(intervals)
}

export function formatMinutesToTime(minute: number): string {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

export function calculateSlotsForDate(
  input: DailySlotComputation,
): AvailableTime[] {
  const freeIntervals = computeFreeIntervals(input)
  const slotMinutes = generateSlotsFromIntervals(freeIntervals, input.station)

  return slotMinutes.map((minute) => ({
    time: formatMinutesToTime(minute),
    available: true,
    duration: input.station.durationMinutes,
    stationId: input.station.stationId,
    requiresStaffApproval: input.station.requiresApproval ?? false,
  }))
}

export function calculateAvailableSlotsForMonth(input: CalculationInput): AvailableDate[] {
  const result: AvailableDate[] = []
  const daysInMonth = new Date(input.year, input.month, 0).getDate()
  const stationDurationMap = new Map<string, number>()

  for (const rule of input.durationRules) {
    stationDurationMap.set(rule.stationId, rule.durationInMinutes)
  }

  const appointmentsByDateStation = new Map<string, Map<string, Interval[]>>()
  for (const appointment of input.appointments) {
    const dateKey = appointment.start.toISOString().split("T")[0]
    const stationMap = appointmentsByDateStation.get(dateKey) ?? new Map()
    const blocks = stationMap.get(appointment.stationId) ?? []

    blocks.push({
      startMinute: Math.max(0, Math.round((appointment.start.getUTCHours() * 60 + appointment.start.getUTCMinutes()))),
      endMinute: Math.max(0, Math.round((appointment.end.getUTCHours() * 60 + appointment.end.getUTCMinutes()))),
    })

    stationMap.set(appointment.stationId, blocks)
    appointmentsByDateStation.set(dateKey, stationMap)
  }

  const constraintsByDateStation = new Map<string, Map<string, { pos: Interval[]; neg: Interval[] }>>()
  for (const constraint of input.constraints) {
    const startDate = new Date(constraint.start)
    const endDate = new Date(constraint.end)
    const current = new Date(startDate)

    while (current <= endDate) {
      const dateKey = current.toISOString().split("T")[0]
      const stationMap = constraintsByDateStation.get(dateKey) ?? new Map()
      const entry = stationMap.get(constraint.stationId) ?? { pos: [], neg: [] }

      const startMinute =
        current.toISOString().split("T")[0] === startDate.toISOString().split("T")[0]
          ? startDate.getUTCHours() * 60 + startDate.getUTCMinutes()
          : 0

      const endMinute =
        current.toISOString().split("T")[0] === endDate.toISOString().split("T")[0]
          ? endDate.getUTCHours() * 60 + endDate.getUTCMinutes()
          : 24 * 60

      const bucket = constraint.isPositive ? entry.pos : entry.neg
      bucket.push({ startMinute, endMinute })

      stationMap.set(constraint.stationId, entry)
      constraintsByDateStation.set(dateKey, stationMap)

      current.setUTCDate(current.getUTCDate() + 1)
      current.setUTCHours(0, 0, 0, 0)
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(Date.UTC(input.year, input.month - 1, day))
    const weekday = currentDate.getUTCDay()
    const operatingHours = input.operatingHours[weekday]

    if (!operatingHours) {
      continue
    }

    const baseInterval: Interval = {
      startMinute: operatingHours.open.hour * 60 + operatingHours.open.minute,
      endMinute: operatingHours.close.hour * 60 + operatingHours.close.minute,
    }

    const dateKey = currentDate.toISOString().split("T")[0]
    const dateEntry: AvailableDate = {
      date: dateKey,
      available: false,
      slots: 0,
      stationId: "",
      availableTimes: [],
    }

    for (const station of input.workstations) {
      const durationMinutes = stationDurationMap.get(station.id)
      if (!durationMinutes) {
        continue
      }

      const appointmentBlocks =
        appointmentsByDateStation.get(dateKey)?.get(station.id) ?? []

      const constraints = constraintsByDateStation.get(dateKey)?.get(station.id) ?? {
        pos: [],
        neg: [],
      }

      const slotConfig: StationSlotConfig = {
        stationId: station.id,
        durationMinutes,
        breakBetweenAppointments: 0,
        slotIncrementMinutes: DEFAULT_SLOT_INCREMENT,
      }

      const slots = calculateSlotsForDate({
        station: slotConfig,
        baseIntervals: [baseInterval],
        positiveIntervals: constraints.pos,
        negativeIntervals: constraints.neg,
        appointmentBlocks,
      })

      if (slots.length > 0) {
        dateEntry.available = true
        dateEntry.slots += slots.length
        dateEntry.stationId = station.id
        dateEntry.availableTimes.push(...slots)
      }
    }

    if (dateEntry.availableTimes.length > 0) {
      dateEntry.availableTimes.sort((a, b) => a.time.localeCompare(b.time))
    }

    if (dateEntry.available) {
      result.push(dateEntry)
    }
  }

  return result
}

