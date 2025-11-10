import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error("Missing Airtable configuration")
  process.exit(1)
}

// Simulate the exact logic from getAvailableTimes
async function testSingleDay() {
  try {
    console.log("🧪 Testing single-day logic for August 21st, 2025...")

    const targetDate = "2025-08-21"
    const dogId = "rec0kizAdkgig4jn1"

    // Step 1: Get dog and breed information
    console.log("\n📅 Step 1: Getting dog data...")
    const dogResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/כלבים/${dogId}`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const dogData = await dogResponse.json()
    console.log(`Dog data:`, JSON.stringify(dogData, null, 2))

    // Step 2: Find qualified workers
    console.log("\n👷 Step 2: Getting qualified workers...")
    const workersResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/עמדות מול גזעים`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const workersData = await workersResponse.json()
    const breedId = dogData.fields.גזע?.[0]

    const qualifiedWorkers = workersData.records
      .filter((record: any) => {
        const breeds = record.fields["גזעים"] || []
        return Array.isArray(breeds) && breeds.includes(breedId)
      })
      .map((record: any) => ({
        workerId: record.fields["עמדה"]?.[0],
        treatmentDurationMinutes: Math.floor((record.fields['סה"כ משך תספורת בשניות'] || 3600) / 60),
      }))
      .filter((worker: any) => worker.workerId && worker.treatmentDurationMinutes > 0)

    console.log(`Qualified workers:`, JSON.stringify(qualifiedWorkers, null, 2))

    // Step 3: Fetch business hours
    console.log("\n🕐 Step 3: Getting business hours...")
    const businessHoursResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/שעות פעילות`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const businessHoursData = await businessHoursResponse.json()
    const dateObj = new Date(targetDate)
    const dayOfWeek = dateObj.getDay()

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
    const dayHours = businessHoursData.records.find((record: any) => record.fields["יום בשבוע"] === hebrewDay)

    if (!dayHours) {
      throw new Error(`No business hours found for day ${hebrewDay}`)
    }

    // Convert business hours (UTC to Jerusalem time)
    const openingTimeUTC = dayHours.fields["שעת פתיחה"]
    const closingTimeUTC = dayHours.fields["שעת סגירה"]

    const openingDate = new Date(openingTimeUTC)
    const closingDate = new Date(closingTimeUTC)

    const openingHours = openingDate.getUTCHours() + 3
    const openingMinutes = openingDate.getUTCMinutes()
    const closingHours = closingDate.getUTCHours() + 3
    const closingMinutes = closingDate.getUTCMinutes()

    const finalOpeningHours = openingHours >= 24 ? openingHours - 24 : openingHours
    const finalClosingHours = closingHours >= 24 ? closingHours - 24 : closingHours

    const businessHours = {
      openingTime: `${finalOpeningHours.toString().padStart(2, "0")}:${openingMinutes.toString().padStart(2, "0")}`,
      closingTime: `${finalClosingHours.toString().padStart(2, "0")}:${closingMinutes.toString().padStart(2, "0")}`,
    }

    console.log(`Business hours: ${businessHours.openingTime} - ${businessHours.closingTime}`)

    // Step 4: Fetch appointments
    console.log("\n📅 Step 4: Getting appointments...")
    const appointmentsResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/תורים למספרה`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const appointmentsData = await appointmentsResponse.json()
    console.log(`Total appointments: ${appointmentsData.records.length}`)

    // Filter appointments for the target date
    const filteredAppointments = appointmentsData.records.filter((record: any) => {
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

    console.log(`Filtered appointments for ${targetDate}: ${filteredAppointments.length}`)

    // Convert appointments to the format expected by business logic
    const appointments = filteredAppointments
      .map((record: any) => {
        try {
          const appointmentDate = new Date(record.fields["מועד התור"])
          const startTime = `${appointmentDate.getHours().toString().padStart(2, "0")}:${appointmentDate
            .getMinutes()
            .toString()
            .padStart(2, "0")}`
          const durationSeconds = record.fields["משך טיפול"] || 0

          const [startHour, startMin] = startTime.split(":").map(Number)
          const totalStartMinutes = startHour * 60 + startMin
          const totalEndMinutes = totalStartMinutes + Math.floor(durationSeconds / 60)

          const endHour = Math.floor(totalEndMinutes / 60)
          const endMin = totalEndMinutes % 60
          const endTime = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`

          const workerId = record.fields["עמדה"]?.[0]
          if (!workerId) return null

          console.log(`✅ Mapped appointment: ${startTime} - ${endTime} (worker: ${workerId})`)

          return {
            startTime,
            endTime,
            workerId,
          }
        } catch (error) {
          console.log(`⚠️ Error mapping appointment: ${error.message}`)
          return null
        }
      })
      .filter((apt): apt is any => apt !== null)

    console.log(`Final appointments:`, JSON.stringify(appointments, null, 2))

    // Step 5: Simulate the business logic
    console.log("\n🎯 Step 5: Simulating business logic...")

    // Parse business hours
    const [openingHourStr, openingMinuteStr] = businessHours.openingTime.split(":")
    const [closingHourStr, closingMinuteStr] = businessHours.closingTime.split(":")
    const openingHour = parseInt(openingHourStr, 10)
    const openingMinute = parseInt(openingMinuteStr || "0", 10)
    const closingHour = parseInt(closingHourStr, 10)
    const closingMinute = parseInt(closingMinuteStr || "0", 10)

    console.log(`Parsed business hours: ${openingHour}:${openingMinute} - ${closingHour}:${closingMinute}`)

    let allAvailableSlots: any[] = []

    // Calculate available slots for each qualified worker
    for (const worker of qualifiedWorkers) {
      const workerAppointments = appointments.filter((apt) => apt.workerId === worker.workerId)
      console.log(`\nWorker ${worker.workerId} has ${workerAppointments.length} appointments`)

      // Generate slots from opening to closing
      let currentHour = openingHour
      let currentMinute = openingMinute

      while (currentHour < closingHour || (currentHour === closingHour && currentMinute < closingMinute)) {
        const slotTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`
        const slotEndMinutes = currentHour * 60 + currentMinute + worker.treatmentDurationMinutes
        const slotEndHour = Math.floor(slotEndMinutes / 60)
        const slotEndMin = slotEndMinutes % 60

        // Check if this slot would extend past closing time
        if (slotEndHour > closingHour || (slotEndHour === closingHour && slotEndMin > closingMinute)) {
          console.log(`   ⏰ Slot ${slotTime} would extend past closing time`)
          currentHour++
          currentMinute = openingMinute
          continue
        }

        // Check if this slot conflicts with existing appointments
        const hasConflict = workerAppointments.some((apt) => {
          const [aptStartHour, aptStartMin] = apt.startTime.split(":").map(Number)
          const [aptEndHour, aptEndMin] = apt.endTime.split(":").map(Number)
          const aptStartMinutes = aptStartHour * 60 + aptStartMin
          const aptEndMinutes = aptEndHour * 60 + aptEndMin
          const slotStartMinutes = currentHour * 60 + currentMinute
          const slotEndMinutesTotal = currentHour * 60 + currentMinute + worker.treatmentDurationMinutes

          const overlaps = slotStartMinutes < aptEndMinutes && slotEndMinutesTotal > aptStartMinutes

          if (overlaps) {
            console.log(`   ❌ Slot ${slotTime} conflicts with appointment ${apt.startTime}-${apt.endTime}`)
            console.log(
              `      Slot: ${slotStartMinutes}-${slotEndMinutesTotal} minutes, Appointment: ${aptStartMinutes}-${aptEndMinutes} minutes`
            )
          }

          return overlaps
        })

        if (!hasConflict) {
          console.log(`   ✅ Slot ${slotTime} is available`)
          allAvailableSlots.push({
            time: slotTime,
            available: true,
            duration: worker.treatmentDurationMinutes,
            stationId: worker.workerId,
          })
        } else {
          console.log(`   ❌ Slot ${slotTime} is blocked`)
        }

        // Move to next hour
        currentHour++
        currentMinute = openingMinute
      }
    }

    // De-duplicate slots
    const uniqueSlots = new Map<string, any>()
    for (const slot of allAvailableSlots) {
      if (!uniqueSlots.has(slot.time)) {
        uniqueSlots.set(slot.time, slot)
      }
    }

    const finalSlots = Array.from(uniqueSlots.values())
    finalSlots.sort((a, b) => a.time.localeCompare(b.time))

    console.log(`\n🎯 Final result: ${finalSlots.length} available time slots`)
    finalSlots.forEach((slot) => {
      console.log(`   ${slot.time} (${slot.duration} min, station: ${slot.stationId})`)
    })
  } catch (error) {
    console.error("Error:", error)
  }
}

testSingleDay()
