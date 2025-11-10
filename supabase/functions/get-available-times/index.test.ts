import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts"
import { Interval } from "./availabilityCalculator.ts"
import type { AvailabilityContext } from "./index.ts"

Deno.env.set("SUPPRESS_SUPABASE_EDGE_SERVE", "1")
Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") ?? "http://test.local")
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "test-service-role-key")

const { calculateAvailableDates, isDateWithinBusinessHours } = await import("./index.ts")

function createGardenContext(params: {
  businessHours: Map<number, Interval[]>
  startDate: Date
  endDate: Date
}): AvailabilityContext {
  return {
    serviceType: "garden",
    startDate: params.startDate,
    endDate: params.endDate,
    treatment: {
      id: "test-treatment",
      name: "Test Treatment",
      treatment_type_id: null,
      customer_id: null,
      customer_type_id: null,
    },
    isGrooming: false,
    isGarden: true,
    stationProfiles: [],
    stationWorkingHours: new Map(),
    businessHoursByWeekday: params.businessHours,
    stationAppointmentsByDate: new Map(),
    stationPositiveConstraints: new Map(),
    stationNegativeConstraints: new Map(),
    gardenUsageByDate: new Map(),
    capacityLimits: [],
  }
}

function createGroomingContext(params: {
  businessHours: Map<number, Interval[]>
  stationWorkingHours: Map<string, Map<number, Interval[]>>
  positiveConstraints: Map<string, Map<string, Interval[]>>
  startDate: Date
  endDate: Date
}): AvailabilityContext {
  return {
    serviceType: "grooming",
    startDate: params.startDate,
    endDate: params.endDate,
    treatment: {
      id: "test-grooming-treatment",
      name: "Grooming Treatment",
      treatment_type_id: "treatmentType-1",
      customer_id: "customer-1",
      customer_type_id: "type-1",
    },
    isGrooming: true,
    isGarden: false,
    stationProfiles: [
      {
        id: "station-1",
        name: "תחנת טיפוח",
        durationMinutes: 60,
        breakBetweenAppointments: 0,
        slotIncrementMinutes: 15,
        requiresApproval: false,
      },
    ],
    stationWorkingHours: params.stationWorkingHours,
    businessHoursByWeekday: params.businessHours,
    stationAppointmentsByDate: new Map(),
    stationPositiveConstraints: params.positiveConstraints,
    stationNegativeConstraints: new Map(),
    gardenUsageByDate: new Map(),
    capacityLimits: [],
  }
}

Deno.test("isDateWithinBusinessHours identifies active weekdays", () => {
  const businessMap = new Map<number, Interval[]>([
    [1, [{ startMinute: 9 * 60, endMinute: 17 * 60 }]],
  ])

  assertEquals(isDateWithinBusinessHours(businessMap, "2025-05-05"), true)
  assertEquals(isDateWithinBusinessHours(businessMap, "2025-05-06"), false)
})

Deno.test("calculateAvailableDates skips dates without global business hours for garden service", () => {
  const businessMap = new Map<number, Interval[]>([
    [1, [{ startMinute: 9 * 60, endMinute: 17 * 60 }]],
  ])

  const context = createGardenContext({
    businessHours: businessMap,
    startDate: new Date("2025-05-04T00:00:00Z"),
    endDate: new Date("2025-05-07T00:00:00Z"),
  })

  const dates = calculateAvailableDates(context)
  assertEquals(dates.map((d) => d.date), ["2025-05-05"])
})

Deno.test("calculateAvailableDates returns empty when no business hours configured", () => {
  const context = createGardenContext({
    businessHours: new Map(),
    startDate: new Date("2025-05-04T00:00:00Z"),
    endDate: new Date("2025-05-07T00:00:00Z"),
  })

  const dates = calculateAvailableDates(context)
  assertEquals(dates.length, 0)
})

Deno.test("grooming positive windows cannot extend before global opening", () => {
  const businessMap = new Map<number, Interval[]>([
    [1, [{ startMinute: 9 * 60, endMinute: 17 * 60 }]],
  ])

  const stationHoursByWeekday = new Map<number, Interval[]>([
    [1, [{ startMinute: 9 * 60, endMinute: 17 * 60 }]],
  ])

  const stationWorkingHours = new Map<string, Map<number, Interval[]>>()
  stationWorkingHours.set("station-1", stationHoursByWeekday)

  const positiveByDate = new Map<string, Interval[]>([
    ["2025-05-12", [{ startMinute: 7 * 60 + 30, endMinute: 10 * 60 }]],
  ])

  const positiveConstraints = new Map<string, Map<string, Interval[]>>()
  positiveConstraints.set("station-1", positiveByDate)

  const context = createGroomingContext({
    businessHours: businessMap,
    stationWorkingHours,
    positiveConstraints,
    startDate: new Date("2025-05-10T00:00:00Z"),
    endDate: new Date("2025-05-15T00:00:00Z"),
  })

  const dates = calculateAvailableDates(context)
  const monday = dates.find((date) => date.date === "2025-05-12")

  if (!monday) {
    throw new Error("Expected May 12th to be available")
  }

  assertEquals(monday.availableTimes[0].time, "09:00")
  const hasEarlySlot = monday.availableTimes.some((slot) => slot.time === "07:30")
  assertEquals(hasEarlySlot, false)
})
