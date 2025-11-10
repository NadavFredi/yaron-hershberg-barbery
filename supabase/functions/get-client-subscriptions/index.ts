import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

interface AirtableConfig {
  pat: string
  baseId: string
}

interface AirtableRecord<T> {
  id: string
  fields: T
}

interface SubscriptionCard {
  id: string
  planName: string | null
  purchasedAt: string | null
  status: string | null
  remainingUses: number | null
  totalUses: number | null
  nextBooking: string | null
  notes: string | null
}

interface SubscriptionUsage {
  id: string
  date: string | null
  dogName: string | null
  service: string | null
  planName: string | null
  staffMember: string | null
  status: string | null
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function coalesceField<T extends Record<string, unknown>>(fields: T, names: string[]): any {
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== "") {
      return fields[name]
    }
  }
  return null
}

async function fetchAllRecords<T>(config: AirtableConfig, tableName: string): Promise<AirtableRecord<T>[]> {
  const records: AirtableRecord<T>[] = []
  let offset: string | undefined

  do {
    const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(tableName)}`)
    url.searchParams.append("pageSize", "100")
    if (offset) {
      url.searchParams.append("offset", offset)
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.pat}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Airtable error (${response.status}): ${text}`)
    }

    const data = await response.json()
    records.push(...((data.records ?? []) as AirtableRecord<T>[]))
    offset = data.offset
  } while (offset)

  return records
}

const CLIENT_FIELD_CANDIDATES = ["לקוחות", "לקוח", "Client", "client", "customer", "Customer"]

function recordMatchesClient(fields: Record<string, unknown>, clientId: string): boolean {
  for (const candidate of CLIENT_FIELD_CANDIDATES) {
    const value = fields[candidate]
    if (!value) {
      continue
    }

    if (Array.isArray(value) && value.some((item) => item === clientId)) {
      return true
    }

    if (typeof value === "string" && value.trim() === clientId) {
      return true
    }
  }

  return false
}

function mapNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function mapDateValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value
  }
  return null
}

function mapSubscriptionRecord(record: AirtableRecord<Record<string, unknown>>): SubscriptionCard {
  const fields = record.fields

  const planName =
    coalesceField(fields, ["סוג כרטיסייה", "שם כרטיסייה", "שם חבילה", "שם", "כרטיסייה", "מסלול"])?.toString() ?? null
  const purchasedAt = mapDateValue(
    coalesceField(fields, ["נוצר בתאריך", "תאריך רכישה", "נרכש בתאריך", "Created", "תאריך", "purchaseDate"])
  )

  // Get the active status field - this is the primary field that determines if subscription is active
  const isActiveValue = coalesceField(fields, ["האם הכרטיסייה פעילה ?", "האם הכרטיסייה פעילה?", "האם הכרטיסייה פעילה"])

  console.log(`Raw isActiveValue for ${record.id}:`, isActiveValue, `(type: ${typeof isActiveValue})`)

  // Determine if subscription is active based on the boolean field
  let isActive = false
  if (typeof isActiveValue === "boolean") {
    isActive = isActiveValue
    console.log(`Boolean field: ${isActiveValue} -> isActive: ${isActive}`)
  } else if (typeof isActiveValue === "string") {
    // Handle string representations of boolean
    const lowerValue = isActiveValue.toLowerCase().trim()
    isActive = lowerValue === "true" || lowerValue === "כן" || lowerValue === "yes"
    console.log(`String field: "${isActiveValue}" -> lowerValue: "${lowerValue}" -> isActive: ${isActive}`)
  } else {
    console.log(`Unknown field type: ${typeof isActiveValue}, defaulting to false`)
  }

  const status = isActive ? "פעילה" : "לא פעילה"
  console.log(`Final status for ${record.id}: ${status}`)

  const remainingUses = mapNumber(
    coalesceField(fields, ["יתרה לניצול כרטיסייה", "יתרה", "שימושים שנותרו", "ניצולים שנותרו", "remainingUses"])
  )
  const totalUses = mapNumber(
    coalesceField(fields, ["כמות כניסות בכרטיסיה הנבחרת", 'סה"כ שימושים', "מספר שימושים", "totalUses"])
  )
  const nextBooking = mapDateValue(coalesceField(fields, ["התור הבא", "מועד שימוש הבא", "nextBooking"]))
  const notes = coalesceField(fields, ["הערות", "Notes", "פירוט"])?.toString() ?? null

  return {
    id: record.id,
    planName,
    purchasedAt,
    status,
    remainingUses,
    totalUses,
    nextBooking,
    notes,
  }
}

function mapUsageRecord(record: AirtableRecord<Record<string, unknown>>): SubscriptionUsage {
  const fields = record.fields

  const date = mapDateValue(coalesceField(fields, ["נוצר בתאריך", "תאריך שימוש", "תאריך", "date"]))
  const dogName = coalesceField(fields, ["שם הכלב", "שם", "כלב", "dogName"])?.toString() ?? null
  const service = coalesceField(fields, ["שירות", "Service", "סוג שירות"])?.toString() ?? null
  const planName = coalesceField(fields, ["כרטיסיות", "כרטיסייה", "חבילה", "שם כרטיסייה", "plan"])?.toString() ?? null
  const staffMember = coalesceField(fields, ["מטפל", "מטפלת", "Staff", "איש צוות"])?.toString() ?? null
  const status = coalesceField(fields, ["סטטוס", "Status", "מצב"])?.toString() ?? null

  return {
    id: record.id,
    date,
    dogName,
    service,
    planName,
    staffMember,
    status,
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const clientId = body?.clientId?.trim()

    if (!clientId) {
      throw new Error("clientId is required")
    }

    const config = getAirtableConfig()

    const [cardsRaw, usageRaw] = await Promise.all([
      fetchAllRecords<Record<string, unknown>>(config, "כרטיסיות"),
      fetchAllRecords<Record<string, unknown>>(config, "ניצול כרטיסיות"),
    ])

    const filteredCards = cardsRaw.filter((record) => recordMatchesClient(record.fields, clientId))
    const filteredUsage = usageRaw.filter((record) => recordMatchesClient(record.fields, clientId))

    const subscriptions = filteredCards.map(mapSubscriptionRecord)
    const usage = filteredUsage.map(mapUsageRecord)

    console.log(`Total subscriptions returned: ${subscriptions.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscriptions,
          usage,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Failed to fetch client subscriptions", error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
