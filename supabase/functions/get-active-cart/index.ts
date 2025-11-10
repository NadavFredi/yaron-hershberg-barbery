import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper to get Airtable config
function getAirtableConfig() {
  const pat = Deno.env.get("AIRTABLE_PAT")
  const baseId = Deno.env.get("AIRTABLE_BASE_ID")
  if (!pat || !baseId) {
    throw new Error("Missing Airtable PAT or Base ID")
  }
  return { pat, baseId }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { appointmentId, serviceType } = await req.json()

    console.log("Getting active cart for appointment:", { appointmentId, serviceType })

    if (!appointmentId) {
      throw new Error("Appointment ID is required")
    }

    const config = getAirtableConfig()

    // Search for active cart (הזמנה) linked to this appointment
    const appointmentField = serviceType === "grooming" ? "תור למספרה" : serviceType === "garden" ? "תור לגן" : null

    if (!appointmentField) {
      throw new Error("Invalid service type")
    }

    // Search for cart where the appointment field contains the appointment ID
    const encodedTableName = encodeURIComponent("הזמנה")
    const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodedTableName}`)
    url.searchParams.append("filterByFormula", `SEARCH("${appointmentId}", {${appointmentField}})`)
    url.searchParams.append("maxRecords", "1")

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Airtable error:", errorText)
      throw new Error(`Failed to fetch cart: ${response.status}`)
    }

    const data = await response.json()

    if (!data.records || data.records.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          cart: null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    const cartRecord = data.records[0]
    const cartId = cartRecord.id

    // Fetch cart items (פריטי הזמנה)
    const itemsUrl = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent("פריטי הזמנה")}`)
    itemsUrl.searchParams.append("filterByFormula", `{פריטי הזמנה} = "${cartId}"`)

    const itemsResponse = await fetch(itemsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
    })

    let orderItems: any[] = []

    if (itemsResponse.ok) {
      const itemsData = await itemsResponse.json()
      orderItems =
        itemsData.records?.map((record: any) => {
          const fields = record.fields
          return {
            id: record.id,
            name: fields["שם מוצר"] || fields["שם"] || "",
            amount: parseInt(fields["כמות"] || "1"),
            price: parseFloat(fields["מחיר בפועל"] || fields["מחיר"] || "0"),
            needsInvoice: false,
          }
        }) || []
    }

    return new Response(
      JSON.stringify({
        success: true,
        cart: {
          id: cartId,
          orderItems,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Error getting active cart:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to get active cart",
        cart: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
