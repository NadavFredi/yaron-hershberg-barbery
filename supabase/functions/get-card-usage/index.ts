import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

interface AirtableConfig {
  pat: string
  baseId: string
}

interface AirtableRecord<T> {
  id: string
  fields: T
}

interface SubscriptionUsage {
  id: string
  date: string | null
  treatmentName: string | null
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

const CARD_FIELD_CANDIDATES = ["כרטיסייה", "כרטיסיות", "Card", "card", "Subscription"]

function recordMatchesCard(fields: Record<string, unknown>, cardId: string): boolean {
  for (const candidate of CARD_FIELD_CANDIDATES) {
    const value = fields[candidate]
    if (!value) {
      continue
    }

    if (Array.isArray(value) && value.some((item) => item === cardId)) {
      return true
    }

    if (typeof value === "string" && value.trim() === cardId) {
      return true
    }
  }

  return false
}

async function fetchAllUsage(config: AirtableConfig): Promise<AirtableRecord<Record<string, unknown>>[]> {
  const records: AirtableRecord<Record<string, unknown>>[] = []
  let offset: string | undefined

  do {
    const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent("ניצול כרטיסיות")}`)
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
    records.push(...((data.records ?? []) as AirtableRecord<Record<string, unknown>>[]))
    offset = data.offset
  } while (offset)

  return records
}

function coalesceField<T extends Record<string, unknown>>(fields: T, names: string[]): any {
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== "") {
      return fields[name]
    }
  }
  return null
}

function mapDateValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value
  }
  return null
}

function mapUsageRecord(record: AirtableRecord<Record<string, unknown>>): SubscriptionUsage {
  const fields = record.fields

  const date = mapDateValue(coalesceField(fields, ["תאריך שימוש", "תאריך", "date"]))
  const createdAt = mapDateValue(coalesceField(fields, ["נוצר בתאריך", "Created", "created_at", "createdAt"]))
  const treatmentName = coalesceField(fields, ["שם הכלב", "כלב", "treatmentName"])?.toString() ?? null
  const service = coalesceField(fields, ["שירות", "Service", "סוג שירות"])?.toString() ?? null
  const planName =
    coalesceField(fields, ["סוג כרטיסייה", "כרטיסייה", "חבילה", "שם כרטיסייה", "plan"])?.toString() ?? null
  const staffMember = coalesceField(fields, ["מטפל", "מטפלת", "Staff", "איש צוות"])?.toString() ?? null
  const status = coalesceField(fields, ["סטטוס", "Status", "מצב"])?.toString() ?? null

  return {
    id: record.id,
    date,
    treatmentName,
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
    const cardId = body?.cardId?.trim()

    if (!cardId) {
      throw new Error("cardId is required")
    }

    const config = getAirtableConfig()
    const usageRecords = await fetchAllUsage(config)
    const filtered = usageRecords.filter((record) => recordMatchesCard(record.fields, cardId))
    const usage = filtered.map(mapUsageRecord)

    return new Response(JSON.stringify({ success: true, data: usage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Failed to fetch card usage", error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
