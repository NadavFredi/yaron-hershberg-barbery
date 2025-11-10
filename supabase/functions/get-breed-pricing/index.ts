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
    const { breedId, breedName } = await req.json()
    console.log("Received breedId:", breedId, "breedName:", breedName)

    if (!breedId && !breedName) {
      throw new Error("Breed ID or name is required")
    }

    // Get Airtable config
    const config = getAirtableConfig()

    // Parse numeric fields helper
    const parseNumericField = (value: any): number | null => {
      if (value === null || value === undefined) return null
      const parsed = typeof value === "number" ? value : parseFloat(value)
      return isNaN(parsed) ? null : parsed
    }

    // Fetch all breeds and find the one matching the breedId or breedName
    const breedsUrl = `https://api.airtable.com/v0/${config.baseId}/גזעים`
    console.log("Fetching all breeds from:", breedsUrl)

    const breedsResponse = await fetch(breedsUrl, {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
    })

    if (!breedsResponse.ok) {
      const errorText = await breedsResponse.text()
      console.error("Airtable error:", errorText)
      throw new Error(`Failed to fetch breeds: ${breedsResponse.status}`)
    }

    const breedsData = await breedsResponse.json()
    console.log(`Found ${breedsData.records?.length || 0} total breeds`)

    // Find the breed matching the breedId or breedName
    let breedRecord
    if (breedId) {
      breedRecord = breedsData.records?.find((breed: any) => breed.id === breedId)
    } else if (breedName) {
      // Search by breed name
      breedRecord = breedsData.records?.find((breed: any) => {
        const breedFieldValue = breed.fields.גזע || breed.fields.שם || ""
        return breedFieldValue === breedName
      })
    }

    if (!breedRecord) {
      console.error("Breed not found for breedId:", breedId, "breedName:", breedName)
      // Return null values but don't throw error
      return new Response(
        JSON.stringify({
          minPrice: null,
          maxPrice: null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    const breedData = breedRecord
    console.log("Found breed:", breedData.id, breedData.fields.גזע || breedData.fields.שם)

    // Extract grooming prices
    const groomingMinPriceRaw =
      breedData.fields["מחיר  מינימום טיפול מספרה"] ?? breedData.fields["מחיר מינימום טיפול מספרה"]

    const groomingMaxPriceRaw = breedData.fields["מחיר מקסימום טיפול במספרה"]

    const minPrice = parseNumericField(groomingMinPriceRaw)
    const maxPrice = parseNumericField(groomingMaxPriceRaw)

    return new Response(
      JSON.stringify({
        minPrice,
        maxPrice,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Error fetching breed pricing:", error)

    return new Response(
      JSON.stringify({
        error: error.message || "Failed to fetch breed pricing",
        minPrice: null,
        maxPrice: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
