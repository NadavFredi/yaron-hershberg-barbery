import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error("Missing Airtable configuration")
  process.exit(1)
}

async function testBusinessHours() {
  try {
    console.log("🔍 Testing business hours for August 21st, 2025...")

    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/שעות פעילות`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch business hours: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`📋 Found ${data.records.length} business hours records`)

    // August 21st, 2025 is a Thursday (day 4)
    const targetDate = new Date("2025-08-21")
    const dayOfWeek = targetDate.getDay() // 4 = Thursday

    console.log(`\n📅 Target date: ${targetDate.toDateString()} (Day of week: ${dayOfWeek})`)

    // Hebrew day mapping
    const HEBREW_DAYS = {
      0: "א", // Sunday
      1: "ב", // Monday
      2: "ג", // Tuesday
      3: "ד", // Wednesday
      4: "ה", // Thursday
      5: "ו", // Friday
      6: "ש", // Saturday
    }

    const hebrewDay = HEBREW_DAYS[dayOfWeek]
    console.log(`🇮🇱 Hebrew day: ${hebrewDay}`)

    data.records.forEach((record: any, index: number) => {
      const day = record.fields["יום בשבוע"]
      const openingTime = record.fields["שעת פתיחה"]
      const closingTime = record.fields["שעת סגירה"]

      console.log(`\n${index + 1}. Day: ${day}`)
      console.log(`   Opening: ${openingTime}`)
      console.log(`   Closing: ${closingTime}`)

      if (day === hebrewDay) {
        console.log(`   ✅ MATCHES TARGET DAY!`)
      }
    })

    // Test the specific business hours for Thursday
    const thursdayHours = data.records.find((record: any) => record.fields["יום בשבוע"] === hebrewDay)

    if (thursdayHours) {
      console.log(`\n🎯 Thursday business hours:`)
      console.log(`   Opening: ${thursdayHours.fields["שעת פתיחה"]}`)
      console.log(`   Closing: ${thursdayHours.fields["שעת סגירה"]}`)

      // Test the time conversion
      const openingDate = new Date(thursdayHours.fields["שעת פתיחה"])
      const closingDate = new Date(thursdayHours.fields["שעת סגירה"])

      if (!isNaN(openingDate.getTime()) && !isNaN(closingDate.getTime())) {
        const openingHours = openingDate.getHours()
        const openingMinutes = openingDate.getMinutes()
        const closingHours = closingDate.getHours()
        const closingMinutes = closingDate.getMinutes()

        console.log(
          `   Converted opening: ${openingHours.toString().padStart(2, "0")}:${openingMinutes
            .toString()
            .padStart(2, "0")}`
        )
        console.log(
          `   Converted closing: ${closingHours.toString().padStart(2, "0")}:${closingMinutes
            .toString()
            .padStart(2, "0")}`
        )
      }
    } else {
      console.log(`\n❌ No business hours found for Thursday (${hebrewDay})`)
    }
  } catch (error) {
    console.error("Error:", error)
  }
}

testBusinessHours()
