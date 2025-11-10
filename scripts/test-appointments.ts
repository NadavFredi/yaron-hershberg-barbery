import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error("Missing Airtable configuration")
  process.exit(1)
}

// Test the formatTimeForJerusalem function
function testFormatTimeForJerusalem() {
  console.log("\n🧪 Testing formatTimeForJerusalem function...")

  const testTimes = [
    "2025-08-21T08:00:00.000Z", // The problematic appointment time
    "2025-08-21T11:00:00.000Z", // What it should be
    "09:00", // Already formatted time
  ]

  testTimes.forEach((time) => {
    try {
      const date = new Date(time)
      if (!isNaN(date.getTime())) {
        const jerusalemHours = date.getHours()
        const jerusalemMinutes = date.getMinutes()
        const result = `${jerusalemHours.toString().padStart(2, "0")}:${jerusalemMinutes.toString().padStart(2, "0")}`
        console.log(`  "${time}" → "${result}" (Hours: ${jerusalemHours}, Minutes: ${jerusalemMinutes})`)
      } else {
        console.log(`  "${time}" → Invalid date`)
      }
    } catch (e) {
      console.log(`  "${time}" → Error: ${e}`)
    }
  })
}

async function testAppointments() {
  try {
    console.log("🔍 Testing Airtable appointments fetch...")

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/תורים למספרה`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch appointments: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`📋 Found ${data.records.length} total appointments`)

    // Look for appointments on August 21st, 2025
    const targetDate = "2025-08-21"
    console.log(`\n🎯 Looking for appointments on ${targetDate}...`)

    data.records.forEach((record: any, index: number) => {
      const rawDate = record.fields["מועד התור"]
      const station = record.fields["עמדה"]?.[0]
      const duration = record.fields["משך טיפול"]

      console.log(`\n${index + 1}. Appointment ID: ${record.id}`)
      console.log(`   Raw Date: ${rawDate}`)
      console.log(`   Station: ${station}`)
      console.log(`   Duration: ${duration} seconds`)

      if (rawDate) {
        try {
          const appointmentDate = new Date(rawDate)
          console.log(`   Parsed Date: ${appointmentDate.toISOString()}`)

          // Check if it's on August 21st, 2025
          const appointmentDateInJerusalem = appointmentDate.toLocaleDateString("en-CA", {
            timeZone: "Asia/Jerusalem",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })

          console.log(`   Jerusalem Date: ${appointmentDateInJerusalem}`)
          console.log(`   Matches target (${targetDate}): ${appointmentDateInJerusalem === targetDate}`)

          if (appointmentDateInJerusalem === targetDate) {
            console.log(`   ✅ THIS APPOINTMENT SHOULD BE BLOCKING TIMES!`)

            // Test the time conversion
            const jerusalemHours = appointmentDate.getHours()
            const jerusalemMinutes = appointmentDate.getMinutes()
            const convertedTime = `${jerusalemHours.toString().padStart(2, "0")}:${jerusalemMinutes
              .toString()
              .padStart(2, "0")}`
            console.log(
              `   🕐 Converted time: ${convertedTime} (Hours: ${jerusalemHours}, Minutes: ${jerusalemMinutes})`
            )
          }
        } catch (e) {
          console.log(`   ❌ Error parsing date: ${e}`)
        }
      }
    })

    // Now test the specific date filtering logic
    console.log(`\n🧪 Testing date filtering logic...`)
    const filteredAppointments = data.records.filter((record: any) => {
      const rawIsoDate = record.fields["מועד התור"]
      if (!rawIsoDate) return false

      try {
        const appointmentUtcDate = new Date(rawIsoDate)
        if (isNaN(appointmentUtcDate.getTime())) return false

        const appointmentDateInJerusalem = appointmentUtcDate.toLocaleDateString("en-CA", {
          timeZone: "Asia/Jerusalem",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })

        return appointmentDateInJerusalem === targetDate
      } catch (e) {
        return false
      }
    })

    console.log(`\n📅 Filtered appointments for ${targetDate}: ${filteredAppointments.length}`)
    filteredAppointments.forEach((apt: any, index: number) => {
      console.log(`  ${index + 1}. Station: ${apt.fields["עמדה"]?.[0]}, Time: ${apt.fields["מועד התור"]}`)
    })
  } catch (error) {
    console.error("Error:", error)
  }
}

// Run tests
testFormatTimeForJerusalem()
testAppointments()
