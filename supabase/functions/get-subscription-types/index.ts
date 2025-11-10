import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

interface AirtableConfig {
  pat: string
  baseId: string
}

interface SubscriptionType {
  id: string
  name: string
  description: string
  price: string
  order: number
}

async function fetchSubscriptionTypes(config: AirtableConfig): Promise<SubscriptionType[]> {
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent("סוגי כרטיסיות")}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.pat}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Airtable error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const records = data.records ?? []

  return records
    .map((record: any) => {
      const fields = record.fields ?? {}
      return {
        id: record.id,
        name: fields["שם"] ?? "",
        description: fields["תיאור קצר"] ?? "",
        price: fields["מחיר"] ?? "",
        order: fields["סדר"] ?? 0,
      }
    })
    .sort((a: SubscriptionType, b: SubscriptionType) => a.order - b.order)
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
    const config = getAirtableConfig()
    const subscriptionTypes = await fetchSubscriptionTypes(config)

    return new Response(JSON.stringify({ success: true, data: subscriptionTypes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Failed to fetch subscription types", error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
