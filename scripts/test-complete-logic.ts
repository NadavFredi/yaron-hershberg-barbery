import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error("Missing Airtable configuration")
  process.exit(1)
}

// Simulate the business logic from the API
function calculateWorkerAvailableSlots(
  worker: any,
  openingHour: number,
  closingHour: number,
  workerAppointments: any[],
  workerAbsences: any[],
  openingMinute: number = 0,
  closingMinute: number = 0
): any[] {
  const slots: any[] = []
  console.log(`\n🔧 Calculating slots for worker ${worker.workerId}`)
  console.log(
    `   Business hours: ${openingHour}:${openingMinute.toString().padStart(2, "0")} - ${closingHour}:${closingMinute
      .toString()
      .padStart(2, "0")}`
  )
  console.log(`   Worker appointments: ${workerAppointments.length}`)
  console.log(`   Worker absences: ${workerAbsences.length}`)

  // Generate slots from opening to closing, accounting for treatment duration
  let currentHour = openingHour
  let currentMinute = openingMinute

  while (currentHour < closingHour || (currentHour === closingHour && currentMinute < closingMinute)) {
    const slotTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`
    const slotEndMinutes = currentHour * 60 + currentMinute + worker.treatmentDurationMinutes
    const slotEndHour = Math.floor(slotEndMinutes / 60)
    const slotEndMin = slotEndMinutes % 60

    // Check if this slot would extend past closing time
    if (slotEndHour > closingHour || (slotEndHour === closingHour && slotEndMin > closingMinute)) {
      console.log(
        `   ⏰ Slot ${slotTime} would extend past closing time (${slotEndHour}:${slotEndMin
          .toString()
          .padStart(2, "0")})`
      )
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

    // Check if this slot conflicts with worker absences
    const hasAbsence = workerAbsences.some((abs) => {
      const [absStartHour, absStartMin] = abs.startTime.split(":").map(Number)
      const [absEndHour, absEndMin] = abs.endTime.split(":").map(Number)
      const absStartMinutes = absStartHour * 60 + absStartMin
      const absEndMinutes = absEndHour * 60 + absEndMin
      const slotStartMinutes = currentHour * 60 + currentMinute
      const slotEndMinutesTotal = currentHour * 60 + currentMinute + worker.treatmentDurationMinutes

      const overlaps = slotStartMinutes < absEndMinutes && slotEndMinutesTotal > absStartMinutes

      if (overlaps) {
        console.log(`   🚫 Slot ${slotTime} conflicts with absence ${abs.startTime}-${abs.endTime}`)
      }

      return overlaps
    })

    if (!hasConflict && !hasAbsence) {
      console.log(`   ✅ Slot ${slotTime} is available`)
      slots.push({
        time: slotTime,
        available: true,
        duration: worker.treatmentDurationMinutes,
        stationId: worker.workerId,
      })
    } else {
      console.log(`   ❌ Slot ${slotTime} is blocked`)
    }

    // Move to next hour but preserve opening minute
    currentHour++
    currentMinute = openingMinute
  }

  return slots
}

async function testCompleteLogic() {
  try {
    console.log("🧪 Testing complete business logic for August 21st, 2025...")

    // Test data for August 21st, 2025
    const targetDate = "2025-08-21"

    // 1. Get business hours
    console.log("\n📅 Step 1: Getting business hours...")
    const businessHoursResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/שעות פעילות`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const businessHoursData = await businessHoursResponse.json()
    const thursdayHours = businessHoursData.records.find((record: any) => record.fields["יום בשבוע"] === "ה")

    if (!thursdayHours) {
      throw new Error("No business hours found for Thursday")
    }

    // Convert business hours (UTC to Jerusalem time)
    const openingDate = new Date(thursdayHours.fields["שעת פתיחה"])
    const closingDate = new Date(thursdayHours.fields["שעת סגירה"])

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

    console.log(`   Business hours: ${businessHours.openingTime} - ${businessHours.closingTime}`)

    // 2. Get appointments
    console.log("\n📅 Step 2: Getting appointments...")
    const appointmentsResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/תורים למספרה`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const appointmentsData = await appointmentsResponse.json()

    // Filter appointments for August 21st
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

    console.log(`   Found ${filteredAppointments.length} appointments on ${targetDate}`)

    // Convert appointments to the format expected by business logic
    const appointments = filteredAppointments
      .map((record: any) => {
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

        console.log(`   Appointment: ${startTime} - ${endTime} (worker: ${workerId}, duration: ${durationSeconds}s)`)

        return {
          startTime,
          endTime,
          workerId,
        }
      })
      .filter((apt) => apt.workerId)

    // 3. Get qualified workers
    console.log("\n👷 Step 3: Getting qualified workers...")
    const workersResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/עמדות מול גזעים`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`,
        "Content-Type": "application/json",
      },
    })

    const workersData = await workersResponse.json()
    const qualifiedWorkers = workersData.records
      .map((record: any) => ({
        workerId: record.fields["עמדה"]?.[0],
        treatmentDurationMinutes: Math.floor((record.fields['סה"כ משך תספורת בשניות'] || 3600) / 60),
      }))
      .filter((worker) => worker.workerId && worker.treatmentDurationMinutes > 0)

    console.log(`   Found ${qualifiedWorkers.length} qualified workers`)
    qualifiedWorkers.forEach((worker) => {
      console.log(`     Worker ${worker.workerId}: ${worker.treatmentDurationMinutes} minutes`)
    })

    // 4. Calculate available slots
    console.log("\n🎯 Step 4: Calculating available slots...")
    const [openingHourStr, openingMinuteStr] = businessHours.openingTime.split(":")
    const [closingHourStr, closingMinuteStr] = businessHours.closingTime.split(":")
    const openingHour = parseInt(openingHourStr, 10)
    const openingMinute = parseInt(openingMinuteStr || "0", 10)
    const closingHour = parseInt(closingHourStr, 10)
    const closingMinute = parseInt(closingMinuteStr || "0", 10)

    let allAvailableSlots: any[] = []

    for (const worker of qualifiedWorkers) {
      const workerAppointments = appointments.filter((apt) => apt.workerId === worker.workerId)
      const workerAbsences: any[] = [] // No absences for this test

      const workerSlots = calculateWorkerAvailableSlots(
        worker,
        openingHour,
        closingHour,
        workerAppointments,
        workerAbsences,
        openingMinute,
        closingMinute
      )
      allAvailableSlots.push(...workerSlots)
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

testCompleteLogic()
