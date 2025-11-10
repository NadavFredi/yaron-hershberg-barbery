// Test script to verify minute-based time handling
import { calculateAvailableSlotsForMonth } from "./availabilityCalculator.ts"
import { CalculationInput } from "./types.ts"

// Test data with minute precision
const testInput: CalculationInput = {
  year: 2025,
  month: 8,
  workstations: [{ id: "station1", name: "עמדה 1" }],
  durationRules: [{ id: "rule-1", treatmentTypeId: "treatmentType-1", stationId: "station1", durationInMinutes: 60 }],
  operatingHours: {
    4: {
      // Thursday
      open: { hour: 9, minute: 30 }, // 9:30 AM
      close: { hour: 17, minute: 45 }, // 5:45 PM
    },
  },
  appointments: [
    {
      id: "test-appointment-1",
      stationId: "station1",
      start: new Date("2025-08-21T10:00:00Z"),
      end: new Date("2025-08-21T11:00:00Z"),
    },
  ],
  constraints: [
    {
      id: "test-constraint-1",
      stationId: "station1",
      start: new Date("2025-08-21T14:00:00Z"),
      end: new Date("2025-08-21T15:00:00Z"),
    },
  ],
}

console.log("Testing minute-based time handling...")
console.log("Operating hours: 9:30 AM - 5:45 PM")
console.log("Slot duration: 60 minutes")
console.log("Slot increment: 15 minutes")

const result = calculateAvailableSlotsForMonth(testInput)
console.log("\nResult:", JSON.stringify(result, null, 2))

// Verify that slots start at 9:30 and respect the 5:45 closing time
if (result.length > 0 && result[0].availableTimes.length > 0) {
  const firstSlot = result[0].availableTimes[0]
  const lastSlot = result[0].availableTimes[result[0].availableTimes.length - 1]

  console.log(`\nFirst slot: ${firstSlot.time}`)
  console.log(`Last slot: ${lastSlot.time}`)

  // Check that first slot is at 9:30
  if (firstSlot.time === "09:30") {
    console.log("✅ First slot correctly starts at 9:30")
  } else {
    console.log("❌ First slot should start at 9:30")
  }

  // Check that last slot ends before 5:45
  const lastSlotHour = parseInt(lastSlot.time.split(":")[0])
  const lastSlotMinute = parseInt(lastSlot.time.split(":")[1])
  const lastSlotEndHour = Math.floor((lastSlotHour * 60 + lastSlotMinute + 60) / 60)
  const lastSlotEndMinute = (lastSlotHour * 60 + lastSlotMinute + 60) % 60

  if (lastSlotEndHour < 17 || (lastSlotEndHour === 17 && lastSlotEndMinute <= 45)) {
    console.log("✅ Last slot correctly ends before 5:45")
  } else {
    console.log("❌ Last slot should end before 5:45")
  }
}
