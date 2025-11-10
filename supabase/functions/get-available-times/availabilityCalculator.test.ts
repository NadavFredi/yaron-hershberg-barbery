// supabase/functions/get-available-times/availabilityCalculator.test.ts

import { assertEquals, assert } from "https://deno.land/std@0.177.0/testing/asserts.ts"
import { calculateAvailableSlotsForMonth } from "./availabilityCalculator.ts"
import { CalculationInput } from "./types.ts"

const MOCK_WORKSTATIONS = [
  { id: "station1", name: "עמדה 1" },
  { id: "station2", name: "עמדה 2" },
]

const MOCK_OPERATING_HOURS = {
  1: { open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }, // Monday 9-5
  2: { open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } }, // Tuesday 9-5
}

Deno.test("Scenario 1: Simple case with a completely free day", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: [MOCK_WORKSTATIONS[0]],
    durationRules: [{ id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 60 }],
    operatingHours: { 4: { open: { hour: 9, minute: 0 }, close: { hour: 12, minute: 0 } } }, // Thursday 9-12
    appointments: [],
    constraints: [],
  }

  // Assuming August 21, 2025 is a Thursday
  const result = calculateAvailableSlotsForMonth(input)
  const thursdaySlots = result.find((d) => d.date === "2025-08-21")?.availableTimes || []

  assert(thursdaySlots.length > 0, "Should return slots for a free working day")
  assertEquals(thursdaySlots[0].time, "09:00")
  assert(thursdaySlots.some((slot) => slot.time === "11:00"), "Should include 11:00 slot")
})

Deno.test("Scenario 2: Day with one appointment in the middle", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: [MOCK_WORKSTATIONS[0]],
    durationRules: [{ id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 60 }],
    operatingHours: { 4: { open: { hour: 9, minute: 0 }, close: { hour: 13, minute: 0 } } },
    appointments: [
      {
        id: "appointment-1",
        stationId: "station1",
        start: new Date("2025-08-21T10:00:00Z"),
        end: new Date("2025-08-21T11:00:00Z"),
      },
    ],
    constraints: [],
  }
  const result = calculateAvailableSlotsForMonth(input)
  const thursdaySlots = result.find((d) => d.date === "2025-08-21")?.availableTimes || []

  assert(!thursdaySlots.some((s) => s.time === "10:00"), "Slot at 10:00 should not be available")
  assert(thursdaySlots.some((s) => s.time === "09:00"), "Slot at 09:00 should remain available")
  assert(thursdaySlots.some((s) => s.time === "12:00"), "Slot at 12:00 should remain available")
})

Deno.test("Scenario 3: Day with a multi-hour constraint", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: [MOCK_WORKSTATIONS[0]],
    durationRules: [{ id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 60 }],
    operatingHours: { 4: { open: { hour: 9, minute: 0 }, close: { hour: 13, minute: 0 } } },
    appointments: [],
    constraints: [
      {
        id: "constraint-1",
        stationId: "station1",
        start: new Date("2025-08-21T09:30:00Z"),
        end: new Date("2025-08-21T11:30:00Z"),
      },
    ],
  }
  const result = calculateAvailableSlotsForMonth(input)
  const thursdaySlots = result.find((d) => d.date === "2025-08-21")?.availableTimes || []

  assert(
    !thursdaySlots.some((s) => s.time === "09:00" || s.time === "10:00" || s.time === "11:00"),
    "Slots during constraint should be unavailable"
  )
  assert(
    thursdaySlots.some((s) => s.time === "11:30"),
    "Constraint should allow slot starting exactly at 11:30"
  )
  assert(
    !thursdaySlots.some((s) => s.time === "12:00"),
    "Slot times should resume from the newly freed boundary without rounding to 12:00"
  )
})

Deno.test("Scenario 4: Respects closing time", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: [MOCK_WORKSTATIONS[0]],
    durationRules: [{ id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 90 }], // 1.5 hours
    operatingHours: { 4: { open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } } },
    appointments: [],
    constraints: [],
  }
  const result = calculateAvailableSlotsForMonth(input)
  const thursdaySlots = result.find((d) => d.date === "2025-08-21")?.availableTimes || []
  const lastSlot = thursdaySlots[thursdaySlots.length - 1]

  // Last possible start time is 15:00, to end at 16:30 without exceeding closing time
  assertEquals(lastSlot.time, "15:00")
})

Deno.test("Scenario 5: Two workstations, one is fully booked", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: MOCK_WORKSTATIONS,
    durationRules: [
      { id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 60 },
      { id: "rule-2", breedId: "breed-1", stationId: "station2", durationInMinutes: 60 },
    ],
    operatingHours: { 4: { open: { hour: 9, minute: 0 }, close: { hour: 11, minute: 0 } } },
    appointments: [
      {
        id: "appointment-2",
        stationId: "station1", // station1 is booked all morning
        start: new Date("2025-08-21T09:00:00Z"),
        end: new Date("2025-08-21T11:00:00Z"),
      },
    ],
    constraints: [],
  }
  const result = calculateAvailableSlotsForMonth(input)
  const thursdaySlots = result.find((d) => d.date === "2025-08-21")?.availableTimes || []

  assert(
    thursdaySlots.every((s) => s.stationId === "station2"),
    "All available slots should be for station2"
  )
  assert(
    thursdaySlots.some((s) => s.time === "09:00"),
    "Station 2 should offer a 09:00 slot when station1 is booked"
  )
})

Deno.test("Scenario 6: Non-working day (e.g. Saturday)", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: MOCK_WORKSTATIONS,
    durationRules: [{ id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 60 }],
    operatingHours: { 4: { open: { hour: 9, minute: 0 }, close: { hour: 17, minute: 0 } } }, // Only Thursday is a working day
    appointments: [],
    constraints: [],
  }
  const result = calculateAvailableSlotsForMonth(input)

  // August 23, 2025 is a Saturday
  assert(!result.some((d) => d.date === "2025-08-23"), "Should be no available dates for a non-working day")
})

Deno.test("Scenario 7: Long appointment shifts subsequent slots to appointment end", () => {
  const input: CalculationInput = {
    year: 2025,
    month: 8,
    workstations: [MOCK_WORKSTATIONS[0]],
    durationRules: [{ id: "rule-1", breedId: "breed-1", stationId: "station1", durationInMinutes: 60 }],
    operatingHours: { 4: { open: { hour: 8, minute: 0 }, close: { hour: 18, minute: 0 } } },
    appointments: [
      {
        id: "appointment-long",
        stationId: "station1",
        start: new Date("2025-08-21T11:00:00Z"),
        end: new Date("2025-08-21T14:30:00Z"),
      },
    ],
    constraints: [],
  }

  const result = calculateAvailableSlotsForMonth(input)
  const slots = result.find((d) => d.date === "2025-08-21")?.availableTimes || []

  assert(slots.some((slot) => slot.time === "14:30"), "First slot after the long appointment should start at 14:30")
  const slotTimes = slots.map((slot) => slot.time)
  const index = slotTimes.indexOf("14:30")
  assert(index >= 0, "14:30 slot should exist")
  assertEquals(slotTimes[index + 1], "15:30", "Next slot should advance exactly 60 minutes later")
})
