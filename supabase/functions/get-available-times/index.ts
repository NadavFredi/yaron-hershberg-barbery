import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const BUSINESS_TIME_ZONE = "Asia/Jerusalem"
const DEFAULT_DURATION = 60
const DEFAULT_SLOT_INTERVAL = 15

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase configuration for get-available-times")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Interval = { start: number; end: number }

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => parseInt(v ?? "0", 10))
  return h * 60 + m
}

function toDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE })
}

function getWeekday(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TIME_ZONE, weekday: "long" }).format(date).toLowerCase()
}

function minutesInBusinessTz(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10)
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10)
  return hour * 60 + minute
}

function intersects(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

function subtractIntervals(window: Interval, blockers: Interval[]): Interval[] {
  let available: Interval[] = [window]
  for (const block of blockers) {
    const next: Interval[] = []
    for (const current of available) {
      if (!intersects(current, block)) {
        next.push(current)
        continue
      }
      if (block.start > current.start) {
        next.push({ start: current.start, end: Math.max(current.start, block.start) })
      }
      if (block.end < current.end) {
        next.push({ start: Math.min(current.end, block.end), end: current.end })
      }
    }
    available = next
  }
  return available.filter((i) => i.end - i.start > 0)
}

function buildSlots(windows: Interval[], duration: number, slotIncrement: number): { time: string }[] {
  const slots: { time: string }[] = []
  for (const window of windows) {
    let cursor = window.start
    while (cursor + duration <= window.end) {
      const hours = Math.floor(cursor / 60)
      const minutes = cursor % 60
      slots.push({ time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}` })
      cursor += slotIncrement
    }
  }
  return slots
}

async function fetchCalendarWindow(): Promise<number> {
  const { data, error } = await supabase
    .from("calendar_settings")
    .select("open_days_ahead")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn("⚠️ [get-available-times] Could not fetch calendar_settings, defaulting to 30 days", error.message)
    return 30
  }

  const value = Number(data?.open_days_ahead ?? 30)
  return Number.isFinite(value) && value >= 0 ? value : 30
}

async function fetchStations(serviceId: string) {
  const { data, error } = await supabase
    .from("service_station_matrix")
    .select(
      `
      station_id,
      base_time_minutes,
      remote_booking_allowed,
      requires_staff_approval,
      stations:station_id (
        id,
        name,
        break_between_treatments_minutes,
        slot_interval_minutes,
        is_active
      )
    `
    )
    .eq("service_id", serviceId)
    .eq("is_active", true)

  if (error) {
    console.error(`[get-available-times] Failed to load station matrix for service ${serviceId}:`, error.message)
    throw new Error(`Failed to load station matrix: ${error.message}`)
  }

  interface StationData {
    id: string
    name: string
    break_between_treatments_minutes: number | null
    slot_interval_minutes: number | null
    is_active: boolean | null
  }

  interface StationRow {
    station_id: string
    base_time_minutes: number | null
    remote_booking_allowed: boolean | null
    stations: StationData[] | null
  }

  const filtered =
    (data as unknown as StationRow[] | null)?.filter((row) => {
      // Supabase returns the relation as an array, take the first element
      const station = row.stations?.[0]
      const stationActive = station?.is_active !== false
      const remoteBookingAllowed = row.remote_booking_allowed === true // Explicitly require true
      return stationActive && remoteBookingAllowed
    }) ?? []

  console.log(
    `[get-available-times] Service ${serviceId}: Found ${data?.length ?? 0} matrix entries, ${
      filtered.length
    } after filtering (active + remote_booking_allowed=true)`
  )

  return filtered.map((row) => {
    // Supabase returns the relation as an array, take the first element
    const station = row.stations?.[0]
    return {
      stationId: row.station_id,
      name: station?.name ?? "",
      duration: Number(row.base_time_minutes ?? DEFAULT_DURATION),
      slotInterval: Number(station?.slot_interval_minutes ?? DEFAULT_SLOT_INTERVAL),
      breakBetween: Number(station?.break_between_treatments_minutes ?? 0),
    }
  })
}

async function fetchWorkingHours(stationIds: string[]) {
  if (stationIds.length === 0) {
    console.log("[get-available-times] No station IDs provided, skipping working hours fetch")
    return []
  }
  const { data, error } = await supabase
    .from("station_working_hours")
    .select("station_id, weekday, open_time, close_time")
    .in("station_id", stationIds)

  if (error) {
    console.error(`[get-available-times] Failed to fetch station working hours:`, error.message)
    throw new Error(`Failed to fetch station working hours: ${error.message}`)
  }

  console.log(`[get-available-times] Found ${data?.length ?? 0} working hour entries for ${stationIds.length} stations`)
  return data ?? []
}

async function fetchAppointments(stationIds: string[], startDate: Date, endDate: Date) {
  if (stationIds.length === 0) return []
  const { data, error } = await supabase
    .from("appointments")
    .select("id, station_id, start_at, end_at, status")
    .in("station_id", stationIds)
    .gte("start_at", startDate.toISOString())
    .lte("end_at", endDate.toISOString())
    .neq("status", "cancelled") // Exclude cancelled appointments

  if (error) {
    console.error(`[get-available-times] Failed to fetch appointments:`, error.message)
    throw new Error(`Failed to fetch existing appointments: ${error.message}`)
  }

  console.log(`[get-available-times] Found ${data?.length ?? 0} active appointments (excluding cancelled)`)
  return data ?? []
}

async function fetchUnavailability(stationIds: string[], startDate: Date, endDate: Date) {
  if (stationIds.length === 0) return []
  const { data, error } = await supabase
    .from("station_unavailability")
    .select("station_id, start_time, end_time, is_active")
    .in("station_id", stationIds)
    .gte("start_time", startDate.toISOString())
    .lte("end_time", endDate.toISOString())

  if (error) {
    throw new Error(`Failed to fetch station unavailability: ${error.message}`)
  }
  return data ?? []
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10))
  return new Date(Date.UTC(y, m - 1, d))
}

async function computeAvailability(serviceId: string, startDate: Date, endDate: Date) {
  const stations = await fetchStations(serviceId)
  const stationIds = stations.map((s) => s.stationId)

  if (stations.length === 0) {
    console.warn(
      `[get-available-times] No stations found for service ${serviceId} with active matrix entries and remote_booking_allowed=true`
    )
  }

  const [workingHours, appointments, unavailability] = await Promise.all([
    fetchWorkingHours(stationIds),
    fetchAppointments(stationIds, startDate, endDate),
    fetchUnavailability(stationIds, startDate, endDate),
  ])

  const workingByStation = new Map<string, Map<string, Interval[]>>()
  for (const wh of workingHours) {
    const weekday = (wh.weekday ?? "").toLowerCase()
    const stationMap = workingByStation.get(wh.station_id) ?? new Map<string, Interval[]>()
    const intervals = stationMap.get(weekday) ?? []
    intervals.push({ start: parseMinutes(wh.open_time), end: parseMinutes(wh.close_time) })
    stationMap.set(weekday, intervals)
    workingByStation.set(wh.station_id, stationMap)
  }

  // Log summary of working hours by station
  for (const station of stations) {
    const stationWorkingHours = workingByStation.get(station.stationId)
    const weekdayCount = stationWorkingHours ? Array.from(stationWorkingHours.keys()).length : 0
    if (weekdayCount === 0) {
      console.warn(
        `[get-available-times] Station ${station.stationId} (${station.name}) has no working hours configured`
      )
    } else {
      console.log(
        `[get-available-times] Station ${station.stationId} (${station.name}) has working hours for ${weekdayCount} weekdays`
      )
    }
  }

  const blockersByDateAndStation = new Map<string, Map<string, Interval[]>>()
  for (const block of unavailability) {
    const stationId = block.station_id
    if (!stationId || block.is_active === false) continue
    const start = new Date(block.start_time)
    const end = new Date(block.end_time)
    const dateKey = toDateKey(start)
    const mapByStation = blockersByDateAndStation.get(dateKey) ?? new Map<string, Interval[]>()
    const entries = mapByStation.get(stationId) ?? []
    entries.push({ start: minutesInBusinessTz(start), end: minutesInBusinessTz(end) })
    mapByStation.set(stationId, entries)
    blockersByDateAndStation.set(dateKey, mapByStation)
  }

  const appointmentsByDateAndStation = new Map<string, Map<string, Interval[]>>()
  for (const appt of appointments) {
    const start = new Date(appt.start_at)
    const end = new Date(appt.end_at)
    const dateKey = toDateKey(start)
    const mapByStation = appointmentsByDateAndStation.get(dateKey) ?? new Map<string, Interval[]>()
    const entries = mapByStation.get(appt.station_id) ?? []
    entries.push({ start: minutesInBusinessTz(start), end: minutesInBusinessTz(end) })
    mapByStation.set(appt.station_id, entries)
    appointmentsByDateAndStation.set(dateKey, mapByStation)
  }

  return {
    stations,
    workingByStation,
    blockersByDateAndStation,
    appointmentsByDateAndStation,
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    const { serviceId, treatmentId, date, mode } = body as {
      serviceId?: string
      treatmentId?: string
      date?: string
      mode?: "date" | "time"
    }

    const effectiveServiceId = serviceId || treatmentId

    if (!effectiveServiceId) {
      throw new Error("serviceId is required")
    }

    const daysAhead = await fetchCalendarWindow()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + daysAhead)
    endDate.setHours(23, 59, 59, 999)

    const { stations, workingByStation, blockersByDateAndStation, appointmentsByDateAndStation } =
      await computeAvailability(effectiveServiceId, today, endDate)

    console.log(`[get-available-times] Computing availability for ${stations.length} stations over ${daysAhead} days`)

    const allDates: string[] = []
    for (let i = 0; i <= daysAhead; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      allDates.push(toDateKey(d))
    }

    const computeForDate = (dateKey: string) => {
      const result: { time: string; stationId: string }[] = []
      for (const station of stations) {
        const weekday = getWeekday(dateFromKey(dateKey))
        const windows = workingByStation.get(station.stationId)?.get(weekday) ?? []
        if (windows.length === 0) continue
        const blockers = blockersByDateAndStation.get(dateKey)?.get(station.stationId) ?? []
        const appts = appointmentsByDateAndStation.get(dateKey)?.get(station.stationId) ?? []

        const unavailable = [...blockers, ...appts]
        const availableWindows = windows
          .map((w) => subtractIntervals(w, unavailable))
          .flat()
          .filter((i) => i.end - i.start >= station.duration)

        const slots = buildSlots(
          availableWindows,
          station.duration + station.breakBetween,
          Math.max(station.slotInterval, 5)
        ).map((slot) => ({ ...slot, stationId: station.stationId }))

        result.push(...slots)
      }
      return result
    }

    if (mode === "time" && date) {
      const availableTimes = computeForDate(date).map((slot) => ({
        ...slot,
        available: true,
        duration: stations.find((s) => s.stationId === slot.stationId)?.duration ?? DEFAULT_DURATION,
      }))
      return new Response(JSON.stringify({ success: true, availableTimes }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const availableDates = allDates
      .map((dateKey) => {
        const slots = computeForDate(dateKey).map((slot) => ({
          ...slot,
          available: true,
          duration: stations.find((s) => s.stationId === slot.stationId)?.duration ?? DEFAULT_DURATION,
        }))
        return {
          date: dateKey,
          available: slots.length > 0,
          slots: slots.length,
          stationId: slots[0]?.stationId ?? null,
          availableTimes: slots,
        }
      })
      .filter((d) => d.available)

    console.log(
      `[get-available-times] Found ${availableDates.length} available dates out of ${allDates.length} total dates`
    )

    if (availableDates.length === 0 && stations.length > 0) {
      console.warn(
        `[get-available-times] No available dates found. This could mean:\n` +
          `  - Stations don't have working hours configured\n` +
          `  - All time slots are blocked by appointments or unavailability\n` +
          `  - Service-station matrix entries don't have remote_booking_allowed=true`
      )
    }

    return new Response(JSON.stringify({ success: true, availableDates }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("Error processing availability:", error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
