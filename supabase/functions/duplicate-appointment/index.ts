import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
}

interface DuplicateAppointmentRequest {
  appointmentId: string
  weeksInterval: number
  repeatType: "count" | "endDate"
  repeatCount?: number
  endDate?: string
  startDate?: string
}

interface AirtableConfig {
  pat: string
  baseId: string
}

interface AirtableRecord<T> {
  id: string
  createdTime: string
  fields: T
}

interface GroomingAppointmentFields {
  "מועד התור": string
  "מועד סיום התור"?: string
  כלב?: string[]
  עמדה?: string[]
  "עמדת עבודה"?: string[]
  סטטוס?: string
  "סטטוס התור"?: string
  "סטטוס תשלום"?: string
  הערות?: string
  "הערות ובקשות לתור"?: string
  "הערות צוות פנימי"?: string
  "סוג שירות"?: string
  לקוח?: string[]
  "שם לקוח"?: string
  כרטיסייה?: string
  "שם כרטיסייה"?: string
  "סוג כרטיסייה"?: string
  "תור לגן"?: string[]
  "מזהה רשומה"?: string
  "מספר רשומה"?: string
  "האם תור אישי"?: boolean
  "תיאור תור אישי"?: string
  "מזהה קבוצת תורים"?: string
}

interface GardenAppointmentFields {
  "מועד התור": string
  "מועד סיום התור"?: string
  כלב?: string[]
  עמדה?: string[]
  "עמדת עבודה"?: string[]
  סטטוס?: string
  "סטטוס התור"?: string
  "סטטוס תשלום"?: string
  הערות?: string
  "הערות ובקשות לתור"?: string
  "הערות צוות פנימי"?: string
  "סוג שירות"?: string
  לקוח?: string[]
  "שם לקוח"?: string
  כרטיסייה?: string
  "שם כרטיסייה"?: string
  "סוג כרטיסייה"?: string
  "תור לגן"?: string[]
  "מזהה רשומה"?: string
  "מספר רשומה"?: string
  "האם תור אישי"?: boolean
  "תיאור תור אישי"?: string
  "מזהה קבוצת תורים"?: string
}

interface AppointmentData {
  id: string
  startDateTime: string
  endDateTime: string
  serviceType: "grooming" | "garden"
  dogs: Array<{ name: string }>
  clientName?: string
  appointmentGroupId?: string
  stationId?: string
  stationName?: string
  notes?: string
  internalNotes?: string
}

// Helper function to get Airtable configuration
function getAirtableConfig(): AirtableConfig {
  const pat = Deno.env.get("AIRTABLE_PAT")
  const baseId = Deno.env.get("AIRTABLE_BASE_ID")

  if (!pat || !baseId) {
    throw new Error("Missing Airtable credentials (AIRTABLE_PAT / AIRTABLE_BASE_ID)")
  }

  return { pat, baseId }
}

// Helper function to fetch appointment from Airtable
async function fetchAppointmentFromAirtable(appointmentId: string): Promise<AppointmentData | null> {
  const config = getAirtableConfig()

  console.log(`🔍 Fetching appointment ${appointmentId} from Airtable...`)

  // Try grooming appointments first
  try {
    const groomingResponse = await fetch(
      `https://api.airtable.com/v0/${config.baseId}/תורים למספרה?filterByFormula={מזהה רשומה}='${appointmentId}'`,
      {
        headers: {
          Authorization: `Bearer ${config.pat}`,
        },
      }
    )

    if (groomingResponse.ok) {
      const groomingData = await groomingResponse.json()
      if (groomingData.records && groomingData.records.length > 0) {
        const record = groomingData.records[0] as AirtableRecord<GroomingAppointmentFields>
        return convertGroomingRecordToAppointmentData(record)
      }
    }
  } catch (_error) {
    console.log("No grooming appointment found, trying garden appointments...")
  }

  // Try garden appointments
  try {
    const gardenResponse = await fetch(
      `https://api.airtable.com/v0/${config.baseId}/תורים לגן?filterByFormula={מזהה רשומה}='${appointmentId}'`,
      {
        headers: {
          Authorization: `Bearer ${config.pat}`,
        },
      }
    )

    if (gardenResponse.ok) {
      const gardenData = await gardenResponse.json()
      if (gardenData.records && gardenData.records.length > 0) {
        const record = gardenData.records[0] as AirtableRecord<GardenAppointmentFields>
        return convertGardenRecordToAppointmentData(record)
      }
    }
  } catch (_error) {
    console.log("No garden appointment found either")
  }

  return null
}

// Helper function to convert grooming record to appointment data
function convertGroomingRecordToAppointmentData(record: AirtableRecord<GroomingAppointmentFields>): AppointmentData {
  return {
    id: record.id,
    startDateTime: record.fields["מועד התור"],
    endDateTime: record.fields["מועד סיום התור"] || record.fields["מועד התור"],
    serviceType: "grooming",
    dogs: record.fields.כלב?.map((dogId) => ({ name: dogId })) || [],
    clientName: record.fields["שם לקוח"],
    appointmentGroupId: record.fields["מזהה קבוצת תורים"],
    stationId: record.fields["עמדת עבודה"]?.[0],
    stationName: record.fields["עמדה"]?.[0],
    notes: record.fields["הערות ובקשות לתור"],
    internalNotes: record.fields["הערות צוות פנימי"],
  }
}

// Helper function to convert garden record to appointment data
function convertGardenRecordToAppointmentData(record: AirtableRecord<GardenAppointmentFields>): AppointmentData {
  return {
    id: record.id,
    startDateTime: record.fields["מועד התור"],
    endDateTime: record.fields["מועד סיום התור"] || record.fields["מועד התור"],
    serviceType: "garden",
    dogs: record.fields.כלב?.map((dogId) => ({ name: dogId })) || [],
    clientName: record.fields["שם לקוח"],
    appointmentGroupId: record.fields["מזהה קבוצת תורים"],
    stationId: record.fields["עמדת עבודה"]?.[0],
    stationName: record.fields["עמדה"]?.[0],
    notes: record.fields["הערות ובקשות לתור"],
    internalNotes: record.fields["הערות צוות פנימי"],
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("🔄 Handling CORS preflight request")
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    console.log("🔄 Duplicate appointment request received")

    // Parse request body
    const { appointmentId, weeksInterval, repeatType, repeatCount, endDate, startDate }: DuplicateAppointmentRequest =
      await req.json()

    console.log("📋 Request data:", {
      appointmentId,
      weeksInterval,
      repeatType,
      repeatCount,
      endDate,
      startDate,
    })

    // Validate required fields
    if (!appointmentId) {
      console.error("❌ Missing appointmentId")
      return new Response(JSON.stringify({ error: "appointmentId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!weeksInterval || weeksInterval < 1) {
      console.error("❌ Invalid weeksInterval")
      return new Response(JSON.stringify({ error: "weeksInterval must be at least 1" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (repeatType === "count" && (!repeatCount || repeatCount < 1)) {
      console.error("❌ Invalid repeatCount")
      return new Response(JSON.stringify({ error: "repeatCount must be at least 1" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (repeatType === "endDate" && !endDate) {
      console.error("❌ Missing endDate")
      return new Response(JSON.stringify({ error: "endDate is required when repeatType is endDate" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Read the original appointment data from Airtable
    console.log("🔍 Fetching original appointment data from Airtable...")

    const appointmentData = await fetchAppointmentFromAirtable(appointmentId)

    if (!appointmentData) {
      console.error("❌ Appointment not found in Airtable")
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("✅ Original appointment data fetched:", appointmentData)

    // Calculate recurring appointments data
    const originalStartDate = new Date(appointmentData.startDateTime)
    const originalEndDate = new Date(appointmentData.endDateTime)
    const duration = originalEndDate.getTime() - originalStartDate.getTime()

    // Use the user-selected start date, or default to the original appointment date
    const seriesStartDate = startDate ? new Date(startDate) : originalStartDate

    // Extract time from original appointment to apply to each recurring appointment
    const originalTime = {
      hours: originalStartDate.getHours(),
      minutes: originalStartDate.getMinutes(),
      seconds: originalStartDate.getSeconds(),
    }

    // Generate a group ID for the series if the original appointment doesn't have one
    const seriesGroupId =
      appointmentData.appointmentGroupId || `series-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log(
      `📌 Using group ID: ${seriesGroupId} ${
        appointmentData.appointmentGroupId ? "(from original)" : "(newly generated)"
      }`
    )

    // Calculate how many appointments to create
    let totalAppointments = 0
    if (repeatType === "count") {
      totalAppointments = repeatCount!
    } else if (repeatType === "endDate") {
      const endDateTime = new Date(endDate!)
      const weeksDiff = Math.floor((endDateTime.getTime() - seriesStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      totalAppointments = Math.floor(weeksDiff / weeksInterval) + 1
    }

    console.log(`📊 Will create ${totalAppointments} recurring appointments starting from ${seriesStartDate}`)

    // Prepare recurring appointments data
    const recurringAppointments = []
    for (let i = 0; i < totalAppointments; i++) {
      const weekOffset = i * weeksInterval
      // Start from the selected start date, not the original appointment date
      const baseStartDate = new Date(seriesStartDate)
      baseStartDate.setHours(originalTime.hours)
      baseStartDate.setMinutes(originalTime.minutes)
      baseStartDate.setSeconds(originalTime.seconds)

      const newStartDate = new Date(baseStartDate.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000)
      const newEndDate = new Date(newStartDate.getTime() + duration)

      recurringAppointments.push({
        startDateTime: newStartDate.toISOString(),
        endDateTime: newEndDate.toISOString(),
        serviceType: appointmentData.serviceType,
        dogs: appointmentData.dogs,
        clientName: appointmentData.clientName,
        appointmentGroupId: seriesGroupId, // Use generated group ID for all appointments in series
        stationId: appointmentData.stationId,
        stationName: appointmentData.stationName,
        notes: appointmentData.notes,
        internalNotes: appointmentData.internalNotes,
        weekOffset: weekOffset,
        appointmentNumber: i + 1,
      })
    }

    // Prepare webhook payload
    const webhookPayload = {
      originalAppointment: {
        id: appointmentData.id,
        startDateTime: appointmentData.startDateTime,
        endDateTime: appointmentData.endDateTime,
        serviceType: appointmentData.serviceType,
        dogs: appointmentData.dogs,
        clientName: appointmentData.clientName,
        appointmentGroupId: appointmentData.appointmentGroupId,
        stationId: appointmentData.stationId,
        stationName: appointmentData.stationName,
        notes: appointmentData.notes,
        internalNotes: appointmentData.internalNotes,
      },
      duplicateSettings: {
        weeksInterval,
        repeatType,
        repeatCount,
        endDate,
        startDate,
      },
      recurringAppointments,
      seriesGroupId, // Include the group ID that will be used for all appointments in the series
      totalAppointments,
      createdAt: new Date().toISOString(),
    }

    console.log("📤 Sending data to webhook...")

    // Send data to webhook
    const webhookResponse = await fetch("https://hook.eu2.make.com/5tgb2egvo1n4etk4wqnqq4c1olmmg48d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!webhookResponse.ok) {
      console.error("❌ Webhook request failed:", webhookResponse.status, webhookResponse.statusText)
      return new Response(
        JSON.stringify({
          error: "Failed to send data to webhook",
          status: webhookResponse.status,
          statusText: webhookResponse.statusText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const webhookResult = await webhookResponse.text()
    console.log("✅ Webhook response:", webhookResult)

    // Parse the webhook response to extract created appointments
    let createdAppointments = []
    try {
      const webhookData = JSON.parse(webhookResult)
      if (webhookData.appointments && Array.isArray(webhookData.appointments)) {
        createdAppointments = webhookData.appointments
      }
    } catch (parseError) {
      console.error("❌ Failed to parse webhook response:", parseError)
    }

    // Return success response with created appointments
    return new Response(
      JSON.stringify({
        success: true,
        message: "Duplicate appointment data sent to webhook successfully",
        totalAppointments,
        createdAppointments,
        webhookResponse: webhookResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ Unexpected error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
