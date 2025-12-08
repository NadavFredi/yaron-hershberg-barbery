import { addHours, addMinutes, differenceInMinutes, format, min, startOfDay } from "date-fns"
import type { ManagerAppointment, ManagerScheduleData } from "./types"

export const DEFAULT_START_HOUR = 8
export const DEFAULT_END_HOUR = 20
export const PIXELS_PER_MINUTE_SCALE = [0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2] // Scale 1-7 values
export const DEFAULT_PIXELS_PER_MINUTE_SCALE = 3 // Default to middle (scale 3)
export const DEFAULT_INTERVAL_MINUTES = 15
export const MAX_VISIBLE_STATIONS = 5

export const ensureValidProposedMeetingRange = (startIso: string, endIso: string, intervalMinutes: number = DEFAULT_INTERVAL_MINUTES) => {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("זמני מפגש לא תקינים")
  }
  const minutes = differenceInMinutes(end, start)
  if (minutes < intervalMinutes) {
    throw new Error(`משך מפגש חייב להיות לפחות ${intervalMinutes} דקות`)
  }
}

export const INITIAL_LOADER_DELAY_MS = 200
const SNAPSHOT_STORAGE_KEY = "managerSchedule:snapshots:v1"
const MAX_SNAPSHOT_ENTRIES = 8

export type ManagerScheduleSnapshotEntry = {
  data: ManagerScheduleData
  storedAt: number
}

type ManagerScheduleSnapshotIndex = Record<string, ManagerScheduleSnapshotEntry>

let managerScheduleSnapshotIndex: ManagerScheduleSnapshotIndex | null = null

function getSessionStorage(): Storage | null {
  try {
    const candidate = (globalThis as unknown as { sessionStorage?: Storage }).sessionStorage
    return candidate ?? null
  } catch {
    return null
  }
}

function loadManagerScheduleSnapshotIndex(): ManagerScheduleSnapshotIndex {
  if (managerScheduleSnapshotIndex) {
    return managerScheduleSnapshotIndex
  }

  managerScheduleSnapshotIndex = {}

  const sessionStorage = getSessionStorage()
  if (!sessionStorage) {
    return managerScheduleSnapshotIndex
  }

  try {
    const raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY)
    if (!raw) {
      return managerScheduleSnapshotIndex
    }

    const parsed = JSON.parse(raw) as ManagerScheduleSnapshotIndex
    if (parsed && typeof parsed === "object") {
      managerScheduleSnapshotIndex = parsed
    }
  } catch (error) {
    console.warn("[ManagerSchedule] Failed to load snapshot cache from sessionStorage", error)
    managerScheduleSnapshotIndex = {}
  }

  return managerScheduleSnapshotIndex
}

export function getManagerScheduleSnapshot(key: string): ManagerScheduleData | null {
  const index = loadManagerScheduleSnapshotIndex()
  const snapshot = index[key]
  if (!snapshot) {
    return null
  }
  return snapshot.data
}

export function setManagerScheduleSnapshot(key: string, data: ManagerScheduleData) {
  const index = loadManagerScheduleSnapshotIndex()
  index[key] = {
    data,
    storedAt: Date.now(),
  }

  const sessionStorage = getSessionStorage()
  if (sessionStorage) {
    try {
      const entries = Object.entries(index)
      if (entries.length > MAX_SNAPSHOT_ENTRIES) {
        const sorted = entries.sort((a, b) => a[1].storedAt - b[1].storedAt)
        const trimmed = sorted.slice(sorted.length - MAX_SNAPSHOT_ENTRIES)
        managerScheduleSnapshotIndex = Object.fromEntries(trimmed)
      }
      sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(loadManagerScheduleSnapshotIndex()))
    } catch (error) {
      console.warn("[ManagerSchedule] Failed to persist snapshot cache to sessionStorage", error)
    }
  }
}

export const parseISODate = (value?: string | null): Date | null => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const getAppointmentDates = (
  appointment: Pick<ManagerAppointment, "id" | "startDateTime" | "endDateTime">
): { start: Date; end: Date } | null => {
  const start = parseISODate(appointment.startDateTime)
  const end = parseISODate(appointment.endDateTime)

  if (!start || !end) {
    console.warn("Skipping appointment with invalid dates", {
      appointmentId: appointment.id,
      start: appointment.startDateTime,
      end: appointment.endDateTime,
    })
    return null
  }

  return { start, end }
}

export interface TimelineSlot {
  offset: number
  height: number
  label: string
}

export interface TimelineConfig {
  start: Date
  end: Date
  totalMinutes: number
  height: number
  hourMarkers: { label: string; offset: number }[]
  slots: TimelineSlot[]
}

export const getErrorMessage = (error: unknown): string => {
  if (!error) return ""

  if (typeof error === "string") return error

  if (typeof error === "object" && error !== null) {
    if ("data" in error && typeof (error as { data?: unknown }).data === "string") {
      return (error as { data: string }).data
    }
    if ("error" in error && typeof (error as { error?: unknown }).error === "string") {
      return (error as { error: string }).error
    }
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message
    }
  }

  return "אירעה שגיאה בטעינת הנתונים."
}

export const buildTimeline = (
  selectedDate: Date,
  data: ManagerScheduleData | undefined,
  intervalMinutes: number,
  pixelsPerMinuteScale: number,
  optimisticAppointments: ManagerAppointment[] = [],
  globalEndHour?: number
): TimelineConfig => {
  const dayStart = startOfDay(selectedDate)
  let start = addHours(dayStart, DEFAULT_START_HOUR)
  // Use global end hour if provided, otherwise use default
  let end = addHours(dayStart, globalEndHour ?? DEFAULT_END_HOUR)

  const appointments = [...(data?.appointments ?? []), ...optimisticAppointments]
  const globalEnd = addHours(dayStart, globalEndHour ?? DEFAULT_END_HOUR)

  if (appointments.length > 0) {
    const validStarts = appointments
      .map((appointment) => parseISODate(appointment.startDateTime))
      .filter((date): date is Date => !!date)
    const validEnds = appointments
      .map((appointment) => parseISODate(appointment.endDateTime))
      .filter((date): date is Date => !!date)

    if (validStarts.length > 0) {
      start = min([start, ...validStarts])
    }
  }

  // Always cap timeline at global end hour - never extend beyond it, regardless of appointments
  end = globalEnd

  if (end <= start) {
    end = addHours(start, 1)
  }

  const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
  const totalMinutes = Math.max(60, differenceInMinutes(end, start))
  const height = totalMinutes * pixelsPerMinute

  const hourMarkers: { label: string; offset: number }[] = []
  let markerCursor = start
  while (markerCursor <= end) {
    const offset = differenceInMinutes(markerCursor, start) * pixelsPerMinute
    hourMarkers.push({ label: format(markerCursor, "HH:mm"), offset })
    markerCursor = addHours(markerCursor, 1)
  }

  const slots: TimelineSlot[] = []
  let slotCursor = start
  while (slotCursor < end) {
    const slotEnd = min([end, addMinutes(slotCursor, intervalMinutes)])
    const offset = differenceInMinutes(slotCursor, start) * pixelsPerMinute
    const heightPx = Math.max(1, differenceInMinutes(slotEnd, slotCursor) * pixelsPerMinute)
    slots.push({ offset, height: heightPx, label: format(slotCursor, "HH:mm") })
    slotCursor = slotEnd
  }

  return { start, end, totalMinutes, height, hourMarkers, slots }
}
