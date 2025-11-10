// supabase/functions/get-available-times/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import {
  getAppointmentsForDateRange,
  getBusinessHours,
  getDaycareAppointmentsForRange,
  getDaycareCapacityLimits,
  getTreatmentRecord,
  getOperatingHours,
  getStationAllowedCustomerTypes,
  getStationBaseDurations,
  getStationTreatmentTypeRulesForTreatmentType,
  getStationUnavailability,
  getWorkstations,
  supabase,
} from "./supabase.ts"
import { AvailableDate, AvailableTime } from "./types.ts"
import {
  Interval,
  calculateSlotsForDate,
  intersectIntervalLists,
  normalizeIntervals,
} from "./availabilityCalculator.ts"

type ServiceSelection = "grooming" | "garden" | "both"

interface StationProfile {
  id: string
  name: string
  durationMinutes: number
  breakBetweenAppointments: number
  slotIncrementMinutes: number
  requiresApproval: boolean
}

interface AppointmentInterval {
  startMinute: number
  endMinute: number
}

interface GardenUsage {
  total: number
  fullDay: number
  hourly: number
  trial: number
  regular: number
}

interface DaycareCapacityLimit {
  id: string
  effective_date: string
  total_limit: number
  hourly_limit: number
  full_day_limit: number
  trial_limit: number
  regular_limit: number
}

interface CalendarSettingsRow {
  open_days_ahead: number | null
}

async function fetchCalendarSettingsDaysAhead(): Promise<number> {
  console.log(`🔍 [fetchCalendarSettingsDaysAhead] Fetching calendar window configuration`)

  const { data, error } = await supabase
    .from("calendar_settings")
    .select("open_days_ahead")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    console.error(`⚠️ [fetchCalendarSettingsDaysAhead] Could not fetch calendar_settings, defaulting to 30 days`, error)
    return 30
  }

  const typedData = (data as CalendarSettingsRow | null) ?? null
  const rawValue = typedData?.open_days_ahead ?? 30
  const normalized = Number.isFinite(rawValue) ? Math.max(0, Math.round(rawValue)) : 30

  console.log(`✅ [fetchCalendarSettingsDaysAhead] Using ${normalized} days ahead window (raw=${rawValue}, default=30)`)
  return normalized
}

export interface AvailabilityContext {
  serviceType: ServiceSelection
  startDate: Date
  endDate: Date
  maxDaysAhead: number
  treatment: NonNullable<Awaited<ReturnType<typeof getTreatmentRecord>>>
  isGrooming: boolean
  isGarden: boolean
  stationProfiles: StationProfile[]
  stationWorkingHours: Map<string, Map<number, Interval[]>>
  businessHoursByWeekday: Map<number, Interval[]>
  stationAppointmentsByDate: Map<string, Map<string, AppointmentInterval[]>>
  stationPositiveConstraints: Map<string, Map<string, Interval[]>>
  stationNegativeConstraints: Map<string, Map<string, Interval[]>>
  gardenUsageByDate: Map<string, GardenUsage>
  capacityLimits: DaycareCapacityLimit[]
}

const BUSINESS_TIME_ZONE = "Asia/Jerusalem"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const MINUTES_PER_DAY = 24 * 60
const SLOT_INCREMENT_MINUTES = 60
const MAX_GARDEN_PLACEHOLDER = 99

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
})

function parseTimeToMinutes(time: string): number {
  const [hoursStr, minutesStr] = time.split(":")
  const hours = parseInt(hoursStr ?? "0", 10)
  const minutes = parseInt(minutesStr ?? "0", 10)
  return hours * 60 + minutes
}

function toDateKey(date: Date): string {
  const parts = dateFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

function getMinutesFromDate(date: Date): number {
  const parts = timeFormatter.formatToParts(date)
  const hourStr = parts.find((part) => part.type === "hour")?.value ?? "0"
  const minuteStr = parts.find((part) => part.type === "minute")?.value ?? "0"
  const hours = parseInt(hourStr, 10) || 0
  const minutes = parseInt(minuteStr, 10) || 0
  return hours * 60 + minutes
}

function pushStationDateInterval(
  target: Map<string, Map<string, Interval[]>>,
  stationId: string,
  dateKey: string,
  interval: Interval
) {
  const stationMap = target.get(stationId) ?? new Map<string, Interval[]>()
  const existing = stationMap.get(dateKey) ?? []
  existing.push(interval)
  stationMap.set(dateKey, existing)
  target.set(stationId, stationMap)
}

function resolveCapacityForDate(capacityRows: DaycareCapacityLimit[], dateKey: string): DaycareCapacityLimit | null {
  let effective: DaycareCapacityLimit | null = null
  for (const row of capacityRows) {
    if (row.effective_date <= dateKey) {
      effective = row
    } else {
      break
    }
  }
  return effective
}

function evaluateGardenCapacity(
  usageMap: Map<string, GardenUsage>,
  capacityRows: DaycareCapacityLimit[],
  dateKey: string
): { available: boolean; remaining: number } {
  const capacity = resolveCapacityForDate(capacityRows, dateKey)
  if (!capacity) {
    return { available: true, remaining: Number.POSITIVE_INFINITY }
  }

  const usage = usageMap.get(dateKey) ?? {
    total: 0,
    fullDay: 0,
    hourly: 0,
    trial: 0,
    regular: 0,
  }

  const totalRemaining = capacity.total_limit > 0 ? capacity.total_limit - usage.total : Number.POSITIVE_INFINITY
  const fullDayRemaining =
    capacity.full_day_limit > 0 ? capacity.full_day_limit - usage.fullDay : Number.POSITIVE_INFINITY
  const regularRemaining =
    capacity.regular_limit > 0 ? capacity.regular_limit - usage.regular : Number.POSITIVE_INFINITY

  const minRemaining = Math.min(totalRemaining, fullDayRemaining, regularRemaining)

  return {
    available: minRemaining > 0,
    remaining: Math.max(0, minRemaining),
  }
}

function getBusinessIntervalsForWeekday(
  businessHoursByWeekday: Map<number, Interval[]>,
  weekday: number
): Interval[] | undefined {
  return businessHoursByWeekday.get(weekday)
}

function getStationBaseIntervals(
  stationWorkingHours: Map<string, Map<number, Interval[]>>,
  businessHoursByWeekday: Map<number, Interval[]>,
  stationId: string,
  weekday: number
): Interval[] {
  const stationMap = stationWorkingHours.get(stationId)
  if (!stationMap) {
    return []
  }
  const stationIntervals = stationMap.get(weekday) ?? []
  if (stationIntervals.length === 0) {
    return []
  }

  const businessIntervals = getBusinessIntervalsForWeekday(businessHoursByWeekday, weekday)
  if (!businessIntervals || businessIntervals.length === 0) {
    return normalizeIntervals(stationIntervals)
  }

  return intersectIntervalLists(normalizeIntervals(stationIntervals), normalizeIntervals(businessIntervals))
}

function getAppointmentBlocksForStation(
  appointmentMap: Map<string, Map<string, AppointmentInterval[]>>,
  stationId: string,
  dateKey: string,
  breakBetweenAppointments: number
): Interval[] {
  const stationAppointments = appointmentMap.get(dateKey)?.get(stationId) ?? []
  if (stationAppointments.length === 0) {
    return []
  }

  return stationAppointments.map((apt) => ({
    startMinute: Math.max(0, apt.startMinute),
    endMinute: Math.min(MINUTES_PER_DAY, apt.endMinute + breakBetweenAppointments),
  }))
}

function getConstraintsForStation(
  constraintMap: Map<string, Map<string, Interval[]>>,
  stationId: string,
  dateKey: string
): Interval[] {
  return constraintMap.get(stationId)?.get(dateKey) ?? []
}

function getWeekdayFromDateKey(dateKey: string): number {
  const date = new Date(`${dateKey}T00:00:00Z`)
  return date.getUTCDay()
}

function hasActiveIntervals(intervals: Interval[] | undefined): boolean {
  if (!intervals || intervals.length === 0) {
    return false
  }

  return intervals.some((interval) => interval.endMinute > interval.startMinute)
}

function hasBusinessHoursForWeekday(businessHoursByWeekday: Map<number, Interval[]>, weekday: number): boolean {
  return hasActiveIntervals(businessHoursByWeekday.get(weekday))
}

export function isDateWithinBusinessHours(businessHoursByWeekday: Map<number, Interval[]>, dateKey: string): boolean {
  const weekday = getWeekdayFromDateKey(dateKey)
  return hasBusinessHoursForWeekday(businessHoursByWeekday, weekday)
}

function clampIntervalsToBusinessHours(intervals: Interval[], businessIntervals: Interval[]): Interval[] {
  if (!intervals || intervals.length === 0) {
    return []
  }
  if (!businessIntervals || businessIntervals.length === 0) {
    return []
  }
  return intersectIntervalLists(intervals, businessIntervals)
}

async function buildAvailabilityContext(params: {
  treatment: NonNullable<Awaited<ReturnType<typeof getTreatmentRecord>>>
  serviceType: ServiceSelection
  startDate: Date
  endDate: Date
  maxDaysAhead: number
}): Promise<AvailabilityContext> {
  const { treatment, serviceType, startDate, endDate, maxDaysAhead } = params
  const isGrooming = serviceType === "grooming" || serviceType === "both"
  const isGarden = serviceType === "garden" || serviceType === "both"

  console.log(
    `🧮 [buildAvailabilityContext] serviceType=${serviceType}, grooming=${isGrooming}, garden=${isGarden}, timezone=${BUSINESS_TIME_ZONE}, daysAhead=${maxDaysAhead}, window=${toDateKey(
      startDate
    )}→${toDateKey(endDate)}`
  )

  const stationProfiles: StationProfile[] = []
  const stationWorkingHours = new Map<string, Map<number, Interval[]>>()
  const businessHoursByWeekday = new Map<number, Interval[]>()
  const stationAppointmentsByDate = new Map<string, Map<string, AppointmentInterval[]>>()
  const stationPositiveConstraints = new Map<string, Map<string, Interval[]>>()
  const stationNegativeConstraints = new Map<string, Map<string, Interval[]>>()
  const gardenUsageByDate = new Map<string, GardenUsage>()
  const businessHoursPromise =
    isGrooming || isGarden ? getBusinessHours() : Promise.resolve<Awaited<ReturnType<typeof getBusinessHours>>>([])
  let businessHourRows: Awaited<ReturnType<typeof getBusinessHours>> = []
  let capacityLimits: DaycareCapacityLimit[] = []

  if (isGrooming) {
    const [stations, operatingHours, businessHours, appointments, unavailability, allowedCustomerTypes, stationRules] =
      await Promise.all([
        getWorkstations(),
        getOperatingHours(),
        businessHoursPromise,
        getAppointmentsForDateRange(startDate, endDate),
        getStationUnavailability(startDate, endDate),
        getStationAllowedCustomerTypes(),
        getStationTreatmentTypeRulesForTreatmentType(treatment.treatment_type_id ?? ""),
      ])
    businessHourRows = businessHours

    const stationsMap = new Map(stations.map((station) => [station.id, station]))
    const stationIds = Array.from(
      new Set(
        stationRules
          .map((rule) => rule.station_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    )

    const baseDurationMap = await getStationBaseDurations(stationIds)

    console.log(
      `📊 [buildAvailabilityContext] Stations=${stations.length}, rules=${stationRules.length}, appointments=${appointments.length}, unavailability=${unavailability.length}`
    )

    const allowedCustomerTypeMap = new Map<string, Set<string>>()
    for (const record of allowedCustomerTypes) {
      const set = allowedCustomerTypeMap.get(record.station_id) ?? new Set<string>()
      set.add(record.customer_type_id)
      allowedCustomerTypeMap.set(record.station_id, set)
    }

    for (const row of operatingHours) {
      const weekday = WEEKDAY_INDEX[row.weekday] ?? undefined
      if (weekday === undefined) continue

      const stationMap = stationWorkingHours.get(row.station_id) ?? new Map<number, Interval[]>()
      const intervals = stationMap.get(weekday) ?? []
      intervals.push({
        startMinute: parseTimeToMinutes(row.open_time),
        endMinute: parseTimeToMinutes(row.close_time),
      })
      stationMap.set(weekday, intervals)
      stationWorkingHours.set(row.station_id, stationMap)
    }

    for (const [stationId, stationMap] of stationWorkingHours.entries()) {
      for (const [weekday, intervals] of stationMap.entries()) {
        stationMap.set(weekday, normalizeIntervals(intervals))
      }
      stationWorkingHours.set(stationId, stationMap)
    }

    const stationRuleUsed = new Set<string>()

    for (const rule of stationRules) {
      if (!rule.station_id) continue
      if (stationRuleUsed.has(rule.station_id)) continue
      if (!rule.is_active) continue
      if (!rule.remote_booking_allowed) continue

      const station = stationsMap.get(rule.station_id)
      if (!station || !station.is_active) continue

      const allowedSet = allowedCustomerTypeMap.get(rule.station_id)
      if (allowedSet && allowedSet.size > 0) {
        if (!treatment.customer_type_id || !allowedSet.has(treatment.customer_type_id)) {
          console.log(
            `⛔️ Station ${rule.station_id} restricted to customer types ${Array.from(allowedSet).join(", ")}, skipping`
          )
          continue
        }
      }

      const ruleDuration = rule.duration_modifier_minutes ?? 0
      const baseTime = baseDurationMap.get(rule.station_id) ?? 60

      let duration = baseTime
      if (ruleDuration > 0) {
        duration = ruleDuration
      }
      if (duration <= 0) {
        duration = 60
      }

      stationProfiles.push({
        id: station.id,
        name: station.name,
        durationMinutes: duration,
        breakBetweenAppointments: 0, // Breaks disabled per business rules
        slotIncrementMinutes: station.slot_interval_minutes ?? SLOT_INCREMENT_MINUTES,
        requiresApproval: Boolean(rule.requires_staff_approval),
      })

      stationRuleUsed.add(rule.station_id)
    }

    console.log(`✅ [buildAvailabilityContext] Station profiles ready: ${stationProfiles.length}`)
    if (stationProfiles.length > 0) {
      console.log(
        `⏱️ [buildAvailabilityContext] Slot intervals by station: ${stationProfiles
          .map((profile) => `${profile.id}:${profile.slotIncrementMinutes}m`)
          .join(", ")}`
      )
    }

    for (const appointment of appointments) {
      if (!appointment.station_id) continue
      const startDateTime = new Date(appointment.start_at)
      const endDateTime = new Date(appointment.end_at)
      const dateKey = toDateKey(startDateTime)
      const stationMap = stationAppointmentsByDate.get(dateKey) ?? new Map<string, AppointmentInterval[]>()
      const entries = stationMap.get(appointment.station_id) ?? []
      entries.push({
        startMinute: getMinutesFromDate(startDateTime),
        endMinute: getMinutesFromDate(endDateTime),
      })
      stationMap.set(appointment.station_id, entries)
      stationAppointmentsByDate.set(dateKey, stationMap)
    }

    for (const block of unavailability) {
      const stationId = block.station_id
      if (!stationId) continue

      const start = new Date(block.start_time)
      const end = new Date(block.end_time)
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue

      const currentDay = new Date(start)
      currentDay.setUTCHours(0, 0, 0, 0)

      while (currentDay <= end) {
        const dayKey = toDateKey(currentDay)
        const dayStart = new Date(currentDay)
        const nextDay = new Date(dayStart)
        nextDay.setUTCDate(nextDay.getUTCDate() + 1)

        const intervalStartMs = Math.max(start.getTime(), dayStart.getTime())
        const intervalEndMs = Math.min(end.getTime(), nextDay.getTime())

        if (intervalStartMs < intervalEndMs) {
          const startMinute = Math.max(0, Math.floor((intervalStartMs - dayStart.getTime()) / 60000))
          const endMinute = Math.min(MINUTES_PER_DAY, Math.ceil((intervalEndMs - dayStart.getTime()) / 60000))
          const interval: Interval = { startMinute, endMinute }

          if (block.is_active) {
            pushStationDateInterval(stationPositiveConstraints, stationId, dayKey, interval)
          } else {
            pushStationDateInterval(stationNegativeConstraints, stationId, dayKey, interval)
          }
        }

        currentDay.setUTCDate(currentDay.getUTCDate() + 1)
        currentDay.setUTCHours(0, 0, 0, 0)
      }
    }

    console.log(
      `🧱 [buildAvailabilityContext] Constraint maps -> positiveStations=${stationPositiveConstraints.size}, negativeStations=${stationNegativeConstraints.size}`
    )
  }

  if (isGarden) {
    const [daycareAppointments, limits] = await Promise.all([
      getDaycareAppointmentsForRange(startDate, endDate),
      getDaycareCapacityLimits(),
    ])

    capacityLimits = limits

    console.log(
      `🌿 [buildAvailabilityContext] Garden appointments=${daycareAppointments.length}, capacitySnapshots=${capacityLimits.length}`
    )

    for (const appointment of daycareAppointments) {
      const dateKey = toDateKey(new Date(appointment.start_at))
      const usage = gardenUsageByDate.get(dateKey) ?? {
        total: 0,
        fullDay: 0,
        hourly: 0,
        trial: 0,
        regular: 0,
      }

      usage.total += 1
      if (appointment.service_type === "hourly") {
        usage.hourly += 1
      } else {
        usage.fullDay += 1
        if (appointment.service_type === "trial") {
          usage.trial += 1
        } else {
          usage.regular += 1
        }
      }

      gardenUsageByDate.set(dateKey, usage)
    }
  }

  console.log(
    `🎯 [buildAvailabilityContext] Completed context build (grooming=${stationProfiles.length}, gardenDates=${gardenUsageByDate.size})`
  )

  if (!isGrooming && isGarden) {
    businessHourRows = await businessHoursPromise
  }

  if ((isGrooming || isGarden) && businessHourRows.length === 0) {
    console.warn(
      `⚠️ [buildAvailabilityContext] No global business hours retrieved (grooming=${isGrooming}, garden=${isGarden})`
    )
  }

  for (const bh of businessHourRows) {
    const weekday = WEEKDAY_INDEX[bh.weekday] ?? undefined
    if (weekday === undefined) continue
    const intervals = businessHoursByWeekday.get(weekday) ?? []
    intervals.push({
      startMinute: parseTimeToMinutes(bh.open_time),
      endMinute: parseTimeToMinutes(bh.close_time),
    })
    businessHoursByWeekday.set(weekday, intervals)
  }

  for (const [weekday, intervals] of businessHoursByWeekday.entries()) {
    const normalized = normalizeIntervals(intervals).filter((interval) => interval.endMinute > interval.startMinute)
    if (normalized.length === 0) {
      businessHoursByWeekday.delete(weekday)
      continue
    }
    businessHoursByWeekday.set(weekday, normalized)
  }

  console.log(
    `🕰️ [buildAvailabilityContext] Global business hours loaded for weekdays=${Array.from(
      businessHoursByWeekday.keys()
    ).join(",")}`
  )

  return {
    treatment,
    serviceType,
    startDate,
    endDate,
    maxDaysAhead,
    stationProfiles,
    stationWorkingHours,
    businessHoursByWeekday,
    stationAppointmentsByDate,
    stationPositiveConstraints,
    stationNegativeConstraints,
    gardenUsageByDate,
    capacityLimits,
    isGrooming,
    isGarden,
  }
}

function calculateAvailableTimesForDate(context: AvailabilityContext, dateKey: string): AvailableTime[] {
  if (!context.isGrooming || context.stationProfiles.length === 0) {
    return []
  }

  if (!isDateWithinBusinessHours(context.businessHoursByWeekday, dateKey)) {
    console.log(`🚫 [calculateAvailableTimesForDate] date=${dateKey} blocked due to missing global working hours`)
    return []
  }

  if (context.isGarden) {
    const gardenCapacity = evaluateGardenCapacity(context.gardenUsageByDate, context.capacityLimits, dateKey)
    if (!gardenCapacity.available) {
      console.log(`🚫 [calculateAvailableTimesForDate] date=${dateKey} blocked by garden capacity`)
      return []
    }
  }

  const weekday = getWeekdayFromDateKey(dateKey)
  const slots: AvailableTime[] = []

  for (const profile of context.stationProfiles) {
    const baseIntervals = getStationBaseIntervals(
      context.stationWorkingHours,
      context.businessHoursByWeekday,
      profile.id,
      weekday
    )
    const businessIntervals = getBusinessIntervalsForWeekday(context.businessHoursByWeekday, weekday) ?? []
    const positiveConstraints = getConstraintsForStation(context.stationPositiveConstraints, profile.id, dateKey)
    const clampedPositive =
      businessIntervals.length > 0 ? clampIntervalsToBusinessHours(positiveConstraints, businessIntervals) : []
    const negativeConstraints = getConstraintsForStation(context.stationNegativeConstraints, profile.id, dateKey)
    const appointmentBlocks = getAppointmentBlocksForStation(
      context.stationAppointmentsByDate,
      profile.id,
      dateKey,
      profile.breakBetweenAppointments
    )

    const stationSlots = calculateSlotsForDate({
      station: {
        stationId: profile.id,
        durationMinutes: profile.durationMinutes,
        breakBetweenAppointments: profile.breakBetweenAppointments,
        slotIncrementMinutes: profile.slotIncrementMinutes,
        requiresApproval: profile.requiresApproval,
      },
      baseIntervals,
      positiveIntervals: clampedPositive,
      negativeIntervals: negativeConstraints,
      appointmentBlocks,
    })

    slots.push(...stationSlots)
  }

  console.log(
    `🕒 [calculateAvailableTimesForDate] date=${dateKey} (${BUSINESS_TIME_ZONE}), stations=${context.stationProfiles.length}, slots=${slots.length}`
  )

  slots.sort((a, b) => {
    if (a.time === b.time) {
      return a.stationId.localeCompare(b.stationId)
    }
    return a.time.localeCompare(b.time)
  })

  return slots
}

export function calculateAvailableDates(context: AvailabilityContext): AvailableDate[] {
  const availableDates: AvailableDate[] = []
  const totalDays =
    Math.min(
      context.maxDaysAhead,
      Math.max(0, Math.floor((context.endDate.getTime() - context.startDate.getTime()) / (24 * 60 * 60 * 1000)))
    ) || 0

  for (let offset = 1; offset <= totalDays; offset++) {
    const current = new Date(context.startDate)
    current.setDate(current.getDate() + offset)
    current.setHours(0, 0, 0, 0)

    if (current > context.endDate) {
      break
    }

    const dateKey = toDateKey(current)
    if (!isDateWithinBusinessHours(context.businessHoursByWeekday, dateKey)) {
      console.log(`🚫 [calculateAvailableDates] date=${dateKey} filtered out (outside global working hours)`)
      continue
    }
    const groomingSlots = calculateAvailableTimesForDate(context, dateKey)
    const gardenStatus = context.isGarden
      ? evaluateGardenCapacity(context.gardenUsageByDate, context.capacityLimits, dateKey)
      : { available: true, remaining: Number.POSITIVE_INFINITY }

    const isAvailable =
      (!context.isGrooming || groomingSlots.length > 0) && (!context.isGarden || gardenStatus.available)

    if (!isAvailable) {
      continue
    }

    availableDates.push({
      date: dateKey,
      available: true,
      slots: context.isGrooming
        ? groomingSlots.length
        : gardenStatus.remaining === Number.POSITIVE_INFINITY
        ? MAX_GARDEN_PLACEHOLDER
        : gardenStatus.remaining,
      stationId: context.isGrooming && groomingSlots.length > 0 ? groomingSlots[0].stationId : "",
      availableTimes: context.isGrooming ? groomingSlots : [],
    })
  }

  return availableDates
}

const SUPPRESS_EDGE_SERVE = Deno.env.get("SUPPRESS_SUPABASE_EDGE_SERVE") === "1"

if (SUPPRESS_EDGE_SERVE) {
  console.log("⏸️ [get-available-times] Serve suppressed via SUPPRESS_SUPABASE_EDGE_SERVE=1")
}

!SUPPRESS_EDGE_SERVE &&
  serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS })
    }

    try {
      const body = await req.json()
      const { treatmentId, serviceType, date, mode, debug } = body as {
        treatmentId?: string
        serviceType?: ServiceSelection
        date?: string
        mode?: "date" | "time"
        debug?: boolean
      }

      if (!treatmentId) {
        throw new Error("treatmentId is required")
      }

      if (!serviceType) {
        throw new Error("serviceType is required")
      }

      // Validate service type
      if (!["grooming", "garden", "both"].includes(serviceType)) {
        throw new Error("Invalid serviceType. Must be one of: grooming, garden, both")
      }

      console.log(`🔍 Processing request for treatment ${treatmentId}, service: ${serviceType}`)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const endDate = new Date(today)
      const maxDaysAhead = await fetchCalendarSettingsDaysAhead()
      const normalizedDaysAhead = Math.max(0, maxDaysAhead)
      endDate.setDate(endDate.getDate() + normalizedDaysAhead)
      console.log(`📅 [get-available-times] Calendar window configured for ${normalizedDaysAhead} days ahead`)

      // Get treatment information
      const treatment = await getTreatmentRecord(treatmentId)

      if (!treatment) {
        return new Response(JSON.stringify({ success: false, error: `Treatment with ID ${treatmentId} not found` }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          status: 404,
        })
      }

      if (!treatment.treatment_type_id && serviceType !== "garden") {
        console.warn(`⚠️ Treatment ${treatment.name} missing treatmentType, cannot compute grooming availability`)
        return new Response(JSON.stringify({ success: true, availableDates: [] }), {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          status: 200,
        })
      }

      const context = await buildAvailabilityContext({
        treatment,
        serviceType,
        startDate: today,
        endDate,
        maxDaysAhead: normalizedDaysAhead,
      })

      if (mode === "time" && date) {
        const availableTimes = calculateAvailableTimesForDate(context, date)
        return new Response(
          JSON.stringify({
            success: true,
            availableTimes,
            ...(debug
              ? {
                  debug: {
                    stationProfiles: context.stationProfiles,
                    workingStations: Array.from(context.stationWorkingHours.keys()),
                    businessWeekdays: Array.from(context.businessHoursByWeekday.keys()),
                    capacitySnapshots: context.capacityLimits.length,
                  },
                }
              : {}),
          }),
          {
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            status: 200,
          }
        )
      }

      const availableDates = calculateAvailableDates(context)

      return new Response(
        JSON.stringify({
          success: true,
          availableDates,
          ...(debug
            ? {
                debug: {
                  stationProfiles: context.stationProfiles,
                  workingStations: Array.from(context.stationWorkingHours.keys()),
                  businessWeekdays: Array.from(context.businessHoursByWeekday.keys()),
                  capacitySnapshots: context.capacityLimits.length,
                },
              }
            : {}),
        }),
        {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          status: 200,
        }
      )
    } catch (error) {
      console.error(`❌ Error processing request:`, error)
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, status: 500 }
      )
    }
  })
