import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

interface AppointmentFields {
  "מועד התור": string // ISO DateTime string
  "מועד סיום התור": string // ISO DateTime string
  כלב: string[] // Array of record IDs from 'כלבים' table
  עמדה: string[] // Array of record IDs from 'עמדות עבודה'
  סטטוס: string // Status like "confirmed", "pending", "cancelled"
  "סוג שירות": string // Service type like "grooming", "garden", "both"
  "הערות ובקשות לתור"?: string
  הערות?: string // Legacy fallback
}

interface TreatmentFields {
  שם: string
  גזע: string[] // Array of record IDs from 'גזעים'
  "תורים למספרה": string[] // Array of record IDs from 'תורים למספרה'
}

async function fetchFromAirtable<T>(
  config: AirtableConfig,
  tableName: string,
  filterByFormula?: string
): Promise<AirtableRecord<T>[]> {
  const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(tableName)}`)
  if (filterByFormula) {
    url.searchParams.append("filterByFormula", filterByFormula)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.pat}`,
    },
  })

  if (!response.ok) {
    const errorBody = await response.json()
    console.error("Airtable API Error:", errorBody)
    throw new Error(`Airtable API request failed for table ${tableName}: ${response.statusText}`)
  }

  const data = await response.json()
  return data.records as AirtableRecord<T>[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed. Use POST.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      )
    }

    const body = await req.json()
    const { treatmentId } = body

    if (!treatmentId) {
      throw new Error("treatmentId parameter is required")
    }

    const config = getAirtableConfig()
    const result = await getTreatmentAppointments(treatmentId, config)

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})

// Get all appointments for a specific treatment ID from Airtable
async function getTreatmentAppointments(treatmentId: string, config: AirtableConfig) {
  try {
    console.log(`🔍 Fetching appointments for treatment ID: ${treatmentId}`)

    // First, get the treatment record to find linked appointment IDs
    const treatmentRecords = await fetchFromAirtable<TreatmentFields>(config, "כלבים", `{מזהה רשומה} = "${treatmentId}"`)
    if (treatmentRecords.length === 0) {
      throw new Error(`Treatment with ID ${treatmentId} not found`)
    }

    const treatmentRecord = treatmentRecords[0]
    const treatmentName = treatmentRecord.fields.שם
    console.log(`🔍 Found treatment: ${treatmentName}`)

    // Get the linked appointment IDs from the treatment's "תורים למספרה" field
    const appointmentIds = treatmentRecord.fields["תורים למספרה"] || []
    console.log(`🔍 Found ${appointmentIds.length} linked appointment IDs:`, appointmentIds)

    if (appointmentIds.length === 0) {
      console.log(`🔍 No appointments found for treatment ${treatmentName}`)
      return { appointments: [] }
    }

    // Fetch the specific appointment records using their IDs
    const appointmentRecords = await fetchFromAirtable<AppointmentFields>(config, "תורים למספרה")

    // Filter to only the appointments linked to this treatment
    const linkedAppointments = appointmentRecords.filter((record) => appointmentIds.includes(record.id))

    console.log(`🔍 Found ${linkedAppointments.length} appointment records for treatment ${treatmentName}`)

    // Transform Airtable records to our expected format
    const appointments = linkedAppointments.map((record) => {
      const startDate = new Date(record.fields["מועד התור"])
      const endDate = new Date(record.fields["מועד סיום התור"])

      return {
        id: record.id,
        treatmentId: treatmentId,
        treatmentName: treatmentName,
        date: startDate.toISOString().split("T")[0], // YYYY-MM-DD format
        time: startDate.toTimeString().split(" ")[0].slice(0, 5), // HH:MM format
        service: record.fields["סוג שירות"] || "grooming",
        status: record.fields["סטטוס התור"] || "confirmed",
        stationId: record.fields["עמדה"]?.[0] || "",
        notes: record.fields["הערות ובקשות לתור"]?.trim() || record.fields["הערות"]?.trim() || "",
        startDateTime: record.fields["מועד התור"],
        endDateTime: record.fields["מועד סיום התור"],
      }
    })

    console.log(`🔍 Processed ${appointments.length} appointments`)

    return {
      appointments: appointments,
    }
  } catch (error) {
    console.error(`❌ Failed to get treatment appointments:`, error)
    throw new Error(`Failed to get treatment appointments: ${error.message}`)
  }
}
