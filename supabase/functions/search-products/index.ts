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
    const { query } = await req.json()
    console.log("Searching products with query:", query)

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ products: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const config = getAirtableConfig()

    // Search in מוצרים table
    const searchFormula = `SEARCH("${query}", LOWER({שם מוצר}))`
    const encodedTableName = encodeURIComponent("מוצרים")
    const url = new URL(`https://api.airtable.com/v0/${config.baseId}/${encodedTableName}`)
    url.searchParams.append("filterByFormula", searchFormula)
    url.searchParams.append("maxRecords", "20")

    console.log("Fetching from URL:", url.toString())

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Airtable error:", errorText)
      throw new Error(`Failed to search products: ${response.status}`)
    }

    const data = await response.json()
    console.log(`Found ${data.records?.length || 0} products`)

    // Parse products from Airtable records
    const products =
      data.records?.map((record: any) => {
        const fields = record.fields
        // Handle price - check multiple possible field names, use nullish coalescing to allow 0 values
        const priceField = fields["מחיר צרכן"] ?? fields["מחיר"] ?? fields["price"]
        console.log(`Product ${record.id}: raw priceField =`, priceField, `(type: ${typeof priceField})`)
        let price = 0
        if (priceField !== undefined && priceField !== null) {
          if (typeof priceField === "number") {
            price = priceField
          } else if (typeof priceField === "string") {
            const parsed = parseFloat(priceField)
            price = isNaN(parsed) ? 0 : parsed
          }
        }
        console.log(`Product ${record.id}: parsed price =`, price)

        return {
          id: record.id,
          name: fields["שם מוצר"] || fields["שם"] || fields["name"] || "מוצר ללא שם",
          price,
          description: fields["תיאור"] || fields["description"] || "",
        }
      }) || []

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("Error searching products:", error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to search products",
        products: [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
