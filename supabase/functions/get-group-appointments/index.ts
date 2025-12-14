import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
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
  לקוח?: string[]
  עמדה?: string[]
  "עמדת עבודה"?: string[]
  "שם עמדה"?: string
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

interface ManagerTreatment {
  id: string
  name: string
  treatmentType?: string
  ownerId?: string
  clientClassification?: string
  clientName?: string
  gender?: string
  notes?: string
  medicalNotes?: string
  importantNotes?: string
  internalNotes?: string
  vetName?: string
  vetPhone?: string
  healthIssues?: string
  birthDate?: string
  tendsToBite?: string
  aggressiveWithOtherTreatments?: string
  // Removed garden-related fields - barbery system doesn't have garden
  recordId?: string
  recordNumber?: string
}

interface ManagerAppointment {
  id: string
  serviceType: "grooming"
  stationId: string
  stationName: string
  startDateTime: string
  endDateTime: string
  status: string
  paymentStatus?: string
  notes: string
  internalNotes?: string
  hasCrossServiceAppointment?: boolean
  treatments: ManagerTreatment[]
  serviceName?: string
  subscriptionName?: string
  clientId?: string
  clientName?: string
  clientClassification?: string
  clientEmail?: string
  clientPhone?: string
  durationMinutes?: number
  latePickupRequested?: boolean
  latePickupNotes?: string
  recordId?: string
  recordNumber?: string
  isPersonalAppointment?: boolean
  personalAppointmentDescription?: string
  groupAppointmentId?: string
}

interface OwnerInfo {
  id: string
  name?: string
  classification?: string
  email?: string
  phone?: string
  recordId?: string
  recordNumber?: string
}

const getAirtableConfig = (): AirtableConfig => {
  const pat = Deno.env.get("AIRTABLE_PAT")
  const baseId = Deno.env.get("AIRTABLE_BASE_ID")

  if (!pat || !baseId) {
    throw new Error("Missing Airtable configuration")
  }

  return { pat, baseId }
}

const fetchFromAirtable = async <T>(
  config: AirtableConfig,
  tableName: string,
  filterFormula?: string
): Promise<AirtableRecord<T>[]> => {
  const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(tableName)}`)

  if (filterFormula) {
    url.searchParams.set("filterByFormula", filterFormula)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.pat}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Airtable API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.records
}

const coalesceStringField = (fields: Record<string, unknown>, fieldNames: string[]): string | undefined => {
  for (const fieldName of fieldNames) {
    const value = fields[fieldName]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

const extractSubscriptionName = (fields: Record<string, unknown>): string | undefined => {
  return coalesceStringField(fields, ["שם כרטיסייה", "Subscription Name", "subscriptionName"])
}

const extractServiceName = (fields: Record<string, unknown>, serviceType: string): string | undefined => {
  if (serviceType === "grooming") {
    return coalesceStringField(fields, ["סוג שירות", "Service Type", "serviceName"])
  }
  return undefined
}

const fetchTreatmentsByIds = async (
  config: AirtableConfig,
  treatmentIds: string[]
): Promise<{ treatmentMap: Map<string, ManagerTreatment>; ownerMap: Map<string, OwnerInfo> }> => {
  if (treatmentIds.length === 0) {
    return { treatmentMap: new Map(), ownerMap: new Map() }
  }

  const treatmentMap = new Map<string, ManagerTreatment>()
  const ownerMap = new Map<string, OwnerInfo>()

  // Fetch treatments
  const treatmentRecords = await fetchFromAirtable(config, "לקוחות")

  for (const record of treatmentRecords) {
    const fields = record.fields as Record<string, unknown>
    const treatment: ManagerTreatment = {
      id: record.id,
      name: coalesceStringField(fields, ["שם", "Name", "name"]) || "ללא שם",
      treatmentType: coalesceStringField(fields, ["גזע", "TreatmentType", "treatmentType"]),
      ownerId: coalesceStringField(fields, ["לקוח", "Owner", "ownerId"]),
      clientClassification: coalesceStringField(fields, [
        "סיווג לקוח",
        "Client Classification",
        "clientClassification",
      ]),
      clientName: coalesceStringField(fields, ["שם לקוח", "Client Name", "clientName"]),
      gender: coalesceStringField(fields, ["מין", "Gender", "gender"]),
      notes: coalesceStringField(fields, ["הערות", "Notes", "notes"]),
      medicalNotes: coalesceStringField(fields, ["הערות רפואיות", "Medical Notes", "medicalNotes"]),
      importantNotes: coalesceStringField(fields, ["משהו נוסף שחשוב שנדע", "Important Notes", "importantNotes"]),
      internalNotes: coalesceStringField(fields, ["הערות פנימי", "Internal Notes", "internalNotes"]),
      vetName: coalesceStringField(fields, ["שם הוטרינר", "Vet Name", "vetName"]),
      vetPhone: coalesceStringField(fields, ["טלפון הוטרינר", "Vet Phone", "vetPhone"]),
      healthIssues: coalesceStringField(fields, ["בעיות בריאות/אלרגיות", "Health Issues", "healthIssues"]),
      birthDate: coalesceStringField(fields, ["תאריך לידה לקוח", "Birth Date", "birthDate"]),
      tendsToBite: coalesceStringField(fields, [
        "האם הלקוח נוטה להילחץ או להירתע ממגע במסגרת חדשה",
        "Tends To Bite",
        "tendsToBite",
      ]),
      aggressiveWithOtherTreatments: coalesceStringField(fields, [
        "האם הלקוח עלול להפגין התנהגות מאתגרת בסביבה חברתית",
        "Aggressive With Other Treatments",
        "aggressiveWithOtherTreatments",
      ]),
      recordId: coalesceStringField(fields, ["מזהה רשומה", "Record ID", "recordId"]),
      recordNumber: coalesceStringField(fields, ["מספר רשומה", "Record Number", "recordNumber"]),
    }
    treatmentMap.set(record.id, treatment)

    // Extract owner info
    if (treatment.ownerId) {
      const ownerInfo: OwnerInfo = {
        id: treatment.ownerId,
        name: treatment.clientName,
        classification: treatment.clientClassification,
        recordId: treatment.recordId,
        recordNumber: treatment.recordNumber,
      }
      ownerMap.set(treatment.ownerId, ownerInfo)
    }
  }

  return { treatmentMap, ownerMap }
}

const buildManagerAppointment = (
  record: AirtableRecord<GroomingAppointmentFields>,
  stationId: string,
  stationName: string,
  treatmentLookup: Map<string, ManagerTreatment>,
  ownerLookup: Map<string, OwnerInfo>
): ManagerAppointment | null => {
  const startRaw = record.fields["מועד התור"]
  if (!startRaw) {
    console.log(`⚠️ Skipping appointment ${record.id} missing start time`)
    return null
  }

  const startDate = new Date(startRaw)
  if (Number.isNaN(startDate.getTime())) {
    console.log(`⚠️ Skipping appointment ${record.id} invalid start time`, startRaw)
    return null
  }

  const endRaw = record.fields["מועד סיום התור"]
  const endDate = endRaw ? new Date(endRaw) : new Date(startDate.getTime() + 60 * 60 * 1000)

  const treatmentIds = Array.isArray(record.fields.לקוח) ? record.fields.לקוח : []
  const treatments = treatmentIds.map((id) => treatmentLookup.get(id) ?? { id, name: "ללא שם" })
  const primaryTreatment = treatments[0]

  const clientId = primaryTreatment?.ownerId
  const ownerInfo = clientId ? ownerLookup.get(clientId) : undefined

  // Get client name from appointment record first, then fall back to owner info
  const appointmentClientName = (record.fields as unknown as Record<string, unknown>)["שם לקוח"]?.toString().trim()

  const clientClassification = ownerInfo?.classification ?? primaryTreatment?.clientClassification
  const clientName = appointmentClientName || ownerInfo?.name || primaryTreatment?.clientName

  const subscriptionName = extractSubscriptionName(record.fields as unknown as Record<string, unknown>)
  const serviceName = extractServiceName(record.fields as unknown as Record<string, unknown>, "grooming")

  const statusField = record.fields["סטטוס התור"]
  const status = statusField || (record.fields["סטטוס"] as string | undefined) || "לא ידוע"

  // Get payment status
  const paymentStatus = (record.fields as unknown as Record<string, unknown>)["סטטוס תשלום"]?.toString().trim()

  // Separate user comments from internal notes
  const userComments = record.fields["הערות ובקשות לתור"]?.trim() || ""
  const internalNotes =
    (record.fields as unknown as Record<string, unknown>)["הערות צוות פנימי"]?.toString().trim() || ""

  // Use only user comments for the notes field
  const notes = userComments || ""

  // Check for cross-service appointments
  const crossServiceField = record.fields["תור לגן"]
  const hasCrossServiceAppointment = Array.isArray(crossServiceField) && crossServiceField.length > 0

  // Extract record fields
  const appointmentRecordId = coalesceStringField(record.fields as unknown as Record<string, unknown>, [
    "מזהה רשומה",
    "Record ID",
    "recordId",
  ])
  let appointmentRecordNumber = coalesceStringField(record.fields as unknown as Record<string, unknown>, [
    "מספר רשומה",
    "Record Number",
    "recordNumber",
    "מספר רשומה",
    "מספר",
  ])

  // If not found as string, try to get as number and convert to string
  if (!appointmentRecordNumber) {
    const numericValue = (record.fields as unknown as Record<string, unknown>)["מספר רשומה"] as unknown as number
    if (typeof numericValue === "number") {
      appointmentRecordNumber = numericValue.toString()
    }
  }

  const durationMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)))

  // Extract personal appointment fields
  const isPersonalAppointment = record.fields["האם תור אישי"] === true
  const personalAppointmentDescription = record.fields["תיאור תור אישי"]?.trim()
  const groupAppointmentId = record.fields["מזהה קבוצת תורים"]?.trim()

  return {
    id: record.id,
    serviceType: "grooming",
    stationId,
    stationName,
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    status,
    paymentStatus: paymentStatus || undefined,
    notes,
    internalNotes: internalNotes || undefined,
    hasCrossServiceAppointment: hasCrossServiceAppointment || undefined,
    treatments,
    clientId,
    clientName,
    clientClassification,
    clientEmail: ownerInfo?.email,
    clientPhone: ownerInfo?.phone,
    subscriptionName,
    serviceName,
    durationMinutes,
    recordId: appointmentRecordId,
    recordNumber: appointmentRecordNumber,
    isPersonalAppointment,
    personalAppointmentDescription,
    groupAppointmentId,
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed. Use POST." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    })
  }

  try {
    const body = await req.json()
    const { groupId } = body

    if (!groupId) {
      return new Response(
        JSON.stringify({
          error: "Missing required field: groupId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("Getting appointments for group ID:", groupId)

    const config = getAirtableConfig()

    // Create filter formula to get appointments with the specific group ID
    const filterFormula = `AND({מזהה קבוצת תורים} = "${groupId}", {מזהה קבוצת תורים} != "")`

    // Fetch grooming appointments with the group ID
    const groomingRecords = await fetchFromAirtable<GroomingAppointmentFields>(config, "תורים למספרה", filterFormula)

    console.log(`Found ${groomingRecords.length} appointments in group ${groupId}`)

    // Get all treatment IDs from the appointments
    const treatmentIdCollector: string[] = []
    for (const record of groomingRecords) {
      if (Array.isArray(record.fields.לקוח)) {
        treatmentIdCollector.push(...record.fields.לקוח)
      }
    }

    // Fetch treatments and owners
    const { treatmentMap: treatmentLookup, ownerMap } = await fetchTreatmentsByIds(config, treatmentIdCollector)

    // Build appointments
    const appointments: ManagerAppointment[] = []
    for (const record of groomingRecords) {
      const stationCandidates = [
        record.fields["עמדה"],
        record.fields["עמדת עבודה"],
        (record.fields as unknown as Record<string, unknown>)["station"],
      ]
      let stationId: string | undefined

      for (const candidate of stationCandidates) {
        if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === "string") {
          stationId = candidate[0]
          break
        }
      }

      if (!stationId) {
        console.log(`⚠️ Appointment ${record.id} missing station reference, skipping`)
        continue
      }

      // Use the station name directly from the appointment record
      const stationName = record.fields["שם עמדה"] || `Station ${stationId}`
      console.log(`🎯 Using station name from appointment: "${stationName}"`)
      const appointment = buildManagerAppointment(record, stationId, stationName, treatmentLookup, ownerMap)
      if (appointment) {
        appointments.push(appointment)
      }
    }

    console.log(`Successfully built ${appointments.length} appointments for group ${groupId}`)

    return new Response(
      JSON.stringify({
        success: true,
        appointments,
        groupId,
        count: appointments.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Error in get-group-appointments function:", error)
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
