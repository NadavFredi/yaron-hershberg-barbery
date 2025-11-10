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
    const { treatmentTypeId, treatmentTypeName } = await req.json()
    console.log("Received treatmentTypeId:", treatmentTypeId, "treatmentTypeName:", treatmentTypeName)

    if (!treatmentTypeId && !treatmentTypeName) {
      throw new Error("TreatmentType ID or name is required")
    }

    // Get Airtable config
    const config = getAirtableConfig()

    // Parse numeric fields helper
    const parseNumericField = (value: any): number | null => {
      if (value === null || value === undefined) return null
      const parsed = typeof value === "number" ? value : parseFloat(value)
      return isNaN(parsed) ? null : parsed
    }

    // Fetch all treatmentTypes and find the one matching the treatmentTypeId or treatmentTypeName
    const treatmentTypesUrl = `https://api.airtable.com/v0/${config.baseId}/גזעים`
    console.log("Fetching all treatmentTypes from:", treatmentTypesUrl)

    const treatmentTypesResponse = await fetch(treatmentTypesUrl, {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
    })

    if (!treatmentTypesResponse.ok) {
      const errorText = await treatmentTypesResponse.text()
      console.error("Airtable error:", errorText)
      throw new Error(`Failed to fetch treatmentTypes: ${treatmentTypesResponse.status}`)
    }

    const treatmentTypesData = await treatmentTypesResponse.json()
    console.log(`Found ${treatmentTypesData.records?.length || 0} total treatmentTypes`)

    // Find the treatmentType matching the treatmentTypeId or treatmentTypeName
    let treatmentTypeRecord
    if (treatmentTypeId) {
      treatmentTypeRecord = treatmentTypesData.records?.find((treatmentType: any) => treatmentType.id === treatmentTypeId)
    } else if (treatmentTypeName) {
      // Search by treatmentType name
      treatmentTypeRecord = treatmentTypesData.records?.find((treatmentType: any) => {
        const treatmentTypeFieldValue = treatmentType.fields.גזע || treatmentType.fields.שם || ""
        return treatmentTypeFieldValue === treatmentTypeName
      })
    }

    if (!treatmentTypeRecord) {
      console.error("TreatmentType not found for treatmentTypeId:", treatmentTypeId, "treatmentTypeName:", treatmentTypeName)
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

    const treatmentTypeData = treatmentTypeRecord
    console.log("Found treatmentType:", treatmentTypeData.id, treatmentTypeData.fields.גזע || treatmentTypeData.fields.שם)

    // Extract grooming prices
    const groomingMinPriceRaw =
      treatmentTypeData.fields["מחיר  מינימום טיפול מספרה"] ?? treatmentTypeData.fields["מחיר מינימום טיפול מספרה"]

    const groomingMaxPriceRaw = treatmentTypeData.fields["מחיר מקסימום טיפול במספרה"]

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
    console.error("Error fetching treatmentType pricing:", error)

    return new Response(
      JSON.stringify({
        error: error.message || "Failed to fetch treatmentType pricing",
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
