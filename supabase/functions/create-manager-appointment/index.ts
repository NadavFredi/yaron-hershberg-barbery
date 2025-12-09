import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ManagerAppointmentType = "private" | "business"

interface CreateManagerAppointmentRequest {
  name: string
  stationId: string
  selectedStations: string[]
  startTime: string
  endTime: string
  appointmentType?: ManagerAppointmentType
  groupId?: string
  customerId?: string
  serviceId?: string
  isManualOverride?: boolean
  notes?: string
  internalNotes?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("🔵 [create-manager-appointment] Function started")

    // Check for authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.error("❌ [create-manager-appointment] No authorization header provided")
      return new Response(
        JSON.stringify({
          error: "Unauthorized - Authentication required",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable")
    }

    if (!supabaseServiceKey) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
          "For local development, this should be automatically available. " +
          "Check your Supabase configuration or set it manually."
      )
    }

    // Use service role to bypass RLS for manager operations
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user is authenticated (using regular client for auth check)
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()
    if (authError || !user) {
      console.error("❌ [create-manager-appointment] Authentication failed:", authError?.message)
      return new Response(
        JSON.stringify({
          error: "Unauthorized - Invalid or expired session. Please log in again.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log("✅ [create-manager-appointment] User authenticated:", user.id)

    // Parse request body
    const {
      name,
      stationId,
      selectedStations,
      startTime,
      endTime,
      appointmentType,
      groupId,
      customerId,
      isManualOverride: _isManualOverride, // Reserved for future use
      notes,
      internalNotes,
      serviceId,
    }: CreateManagerAppointmentRequest = await req.json()

    // Removed garden - barbery system only has grooming appointments
    const normalizedAppointmentType: ManagerAppointmentType = appointmentType === "business" ? "business" : "private"

    console.log("📋 [create-manager-appointment] Request data:", {
      name,
      stationId,
      selectedStations,
      startTime,
      endTime,
      appointmentType: normalizedAppointmentType,
      groupId,
      customerId,
      serviceId,
    })

    // Validate required fields
    if (!name || !stationId || !startTime || !endTime) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: name, stationId, startTime, endTime",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Generate a group ID if multiple stations are selected and no groupId provided
    const finalGroupId =
      groupId ||
      (selectedStations.length > 1 ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined)

    console.log("🆔 [create-manager-appointment] Generated/using group ID:", finalGroupId)

    // Get all stations to create appointments for (use selectedStations or just the primary stationId)
    const stationsToUse = selectedStations.length > 0 ? selectedStations : [stationId]
    console.log("📍 [create-manager-appointment] Creating appointments for stations:", stationsToUse)

    const appointmentIds: string[] = []
    let resolvedCustomerId: string | undefined = customerId
    let resolvedServiceId: string | undefined = serviceId

    // Handle private appointments: create/find system customer
    if (normalizedAppointmentType === "private") {
      console.log("🔒 [create-manager-appointment] Creating private appointment, setting up system customer")

      // Find or create system customer ("צוות פנימי" with phone "0000000000")
      const systemPhone = "0000000000"
      const systemName = "צוות פנימי"

      const { data: existingCustomer, error: customerSearchError } = await supabaseClient
        .from("customers")
        .select("id")
        .eq("phone", systemPhone)
        .single()

      if (customerSearchError && customerSearchError.code !== "PGRST116") {
        // PGRST116 = no rows returned, which is fine - we'll create one
        console.error("❌ [create-manager-appointment] Error searching for system customer:", customerSearchError)
        throw new Error(`Failed to search for system customer: ${customerSearchError.message}`)
      }

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer.id
        console.log("✅ [create-manager-appointment] Found existing system customer:", resolvedCustomerId)
      } else {
        // Create system customer
        const { data: newCustomer, error: customerCreateError } = await supabaseClient
          .from("customers")
          .insert({
            full_name: systemName,
            phone: systemPhone,
          })
          .select("id")
          .single()

        if (customerCreateError) {
          console.error("❌ [create-manager-appointment] Error creating system customer:", customerCreateError)
          throw new Error(`Failed to create system customer: ${customerCreateError.message}`)
        }

        resolvedCustomerId = newCustomer.id
        console.log("✅ [create-manager-appointment] Created system customer:", resolvedCustomerId)
      }
    }

    // Validate customer and service IDs for business appointments
    // Removed garden - barbery system only has grooming appointments
    if (normalizedAppointmentType === "business") {
      if (!resolvedCustomerId || !resolvedServiceId) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: business appointments require a customer and service",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    // Create appointments for each station
    console.log("✂️ [create-manager-appointment] Creating grooming appointments")

    for (const stationIdToUse of stationsToUse) {
      const insertPayload = {
        customer_id: resolvedCustomerId!,
        service_id: resolvedServiceId ?? null,
        station_id: stationIdToUse,
        start_at: startTime,
        end_at: endTime,
        status: "pending" as const,
        appointment_kind: normalizedAppointmentType === "private" ? ("personal" as const) : ("business" as const),
        customer_notes: notes || null,
        internal_notes: internalNotes || null,
      }

      console.log(
        `🔵 [create-manager-appointment] Inserting grooming appointment for station ${stationIdToUse}:`,
        insertPayload
      )

      const { data, error } = await supabaseClient
        .from("grooming_appointments")
        .insert(insertPayload)
        .select("id")
        .single()

      if (error) {
        console.error(`❌ [create-manager-appointment] Error inserting appointment:`, error)
        throw new Error(`Failed to create appointment: ${error.message}`)
      }

      console.log(
        `✅ [create-manager-appointment] Created grooming appointment ${data.id} for station ${stationIdToUse}`
      )
      appointmentIds.push(data.id)
    }

    console.log("🎉 [create-manager-appointment] Successfully created all appointments:", appointmentIds)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        appointmentIds,
        groupId: finalGroupId,
        message: `${
          normalizedAppointmentType === "business" ? "Business" : "Private"
        } appointment(s) created successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ [create-manager-appointment] Error in function:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
