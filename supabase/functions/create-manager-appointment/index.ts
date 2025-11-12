import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ManagerAppointmentType = "private" | "business" | "garden"

interface CreateManagerAppointmentRequest {
  name: string
  stationId: string
  selectedStations: string[]
  startTime: string
  endTime: string
  appointmentType?: ManagerAppointmentType
  groupId?: string
  customerId?: string
  treatmentId?: string
  serviceId?: string
  isManualOverride?: boolean
  gardenAppointmentType?: "full-day" | "hourly" | "trial"
  services?: {
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
  }
  latePickupRequested?: boolean
  latePickupNotes?: string
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
      treatmentId,
      isManualOverride: _isManualOverride, // Reserved for future use
      gardenAppointmentType,
      services,
      latePickupRequested,
      latePickupNotes,
      notes,
      internalNotes,
      serviceId,
    }: CreateManagerAppointmentRequest = await req.json()

    const normalizedAppointmentType: ManagerAppointmentType =
      appointmentType === "business" ? "business" : appointmentType === "garden" ? "garden" : "private"

    console.log("📋 [create-manager-appointment] Request data:", {
      name,
      stationId,
      selectedStations,
      startTime,
      endTime,
      appointmentType: normalizedAppointmentType,
      gardenAppointmentType,
      groupId,
      customerId,
      treatmentId,
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
    let resolvedTreatmentId: string | undefined = treatmentId
    let resolvedServiceId: string | undefined = serviceId

    // Handle private appointments: create/find system customer and treatment
    if (normalizedAppointmentType === "private") {
      console.log("🔒 [create-manager-appointment] Creating private appointment, setting up system customer/treatment")

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

      // Find or create system treatment with the appointment name
      const { data: existingTreatment, error: treatmentSearchError } = await supabaseClient
        .from("treatments")
        .select("id")
        .eq("customer_id", resolvedCustomerId)
        .eq("name", name)
        .single()

      if (treatmentSearchError && treatmentSearchError.code !== "PGRST116") {
        console.error("❌ [create-manager-appointment] Error searching for system treatment:", treatmentSearchError)
        throw new Error(`Failed to search for system treatment: ${treatmentSearchError.message}`)
      }

      if (existingTreatment) {
        resolvedTreatmentId = existingTreatment.id
        console.log("✅ [create-manager-appointment] Found existing system treatment:", resolvedTreatmentId)
      } else {
        // Create system treatment
        const { data: newTreatment, error: treatmentCreateError } = await supabaseClient
          .from("treatments")
          .insert({
            customer_id: resolvedCustomerId,
            name: name,
            gender: "male" as const,
            is_small: true,
          })
          .select("id")
          .single()

        if (treatmentCreateError) {
          console.error("❌ [create-manager-appointment] Error creating system treatment:", treatmentCreateError)
          throw new Error(`Failed to create system treatment: ${treatmentCreateError.message}`)
        }

        resolvedTreatmentId = newTreatment.id
        console.log("✅ [create-manager-appointment] Created system treatment:", resolvedTreatmentId)
      }
    }

    // Validate customer and treatment IDs for business/garden appointments
    if (normalizedAppointmentType === "garden") {
      if (!resolvedCustomerId || !resolvedTreatmentId) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: customerId and treatmentId are required for business/garden appointments",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    } else if (normalizedAppointmentType === "business") {
      if (!resolvedCustomerId || (!resolvedServiceId && !resolvedTreatmentId)) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: business appointments require a customer and service or treatment",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    // Create appointments for each station
    if (normalizedAppointmentType === "garden") {
      // Create daycare appointments
      console.log("🌳 [create-manager-appointment] Creating daycare appointments")

      // Determine service type based on gardenAppointmentType
      // Normalize the input to handle any whitespace or case issues
      const normalizedGardenType = gardenAppointmentType?.toString().trim().toLowerCase()

      let serviceType: "full_day" | "trial" | "hourly" = "full_day"
      console.log(
        "🔍 [create-manager-appointment] gardenAppointmentType received:",
        gardenAppointmentType,
        "normalized:",
        normalizedGardenType,
        "type:",
        typeof gardenAppointmentType
      )

      if (normalizedGardenType === "trial") {
        serviceType = "trial"
        console.log("✅ [create-manager-appointment] Set serviceType to: trial")
      } else if (normalizedGardenType === "hourly") {
        serviceType = "hourly"
        console.log("✅ [create-manager-appointment] Set serviceType to: hourly")
      } else if (
        normalizedGardenType === "full-day" ||
        normalizedGardenType === "fullday" ||
        normalizedGardenType === "full_day"
      ) {
        serviceType = "full_day"
        console.log("✅ [create-manager-appointment] Set serviceType to: full_day")
      } else if (!gardenAppointmentType || normalizedGardenType === "") {
        // If no type specified, default to full_day (not trial!)
        console.log("⚠️ [create-manager-appointment] No gardenAppointmentType provided, defaulting to full_day")
        serviceType = "full_day"
      } else {
        console.log(
          "⚠️ [create-manager-appointment] Unknown gardenAppointmentType, defaulting to full_day. Received:",
          gardenAppointmentType,
          "normalized:",
          normalizedGardenType
        )
        serviceType = "full_day"
      }

      console.log("📝 [create-manager-appointment] Final serviceType:", serviceType)

      // For garden appointments, station_id should be NULL (garden doesn't use physical stations)
      // Filter out the pseudo "garden-station" ID if present
      const actualStationIds = stationsToUse.filter((id) => id !== "garden-station")

      // Use the first valid UUID station ID if available, otherwise use null
      // This allows flexibility for future garden stations with actual UUIDs
      const stationIdToUse =
        actualStationIds.length > 0 &&
        actualStationIds[0].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? actualStationIds[0]
          : null

      // Note: service_type and questionnaire_result columns no longer exist
      const insertPayload = {
        customer_id: resolvedCustomerId!,
        treatment_id: resolvedTreatmentId!,
        station_id: stationIdToUse,
        start_at: startTime,
        end_at: endTime,
        status: "pending" as const,
        customer_notes: notes || null,
        internal_notes: internalNotes || null,
        late_pickup_requested: latePickupRequested || null,
        late_pickup_notes: latePickupNotes || null,
        garden_trim_nails: services?.gardenTrimNails || null,
        garden_brush: services?.gardenBrush || null,
        garden_bath: services?.gardenBath || null,
      }

      console.log(
        `🔵 [create-manager-appointment] Inserting daycare appointment${
          stationIdToUse ? ` for station ${stationIdToUse}` : " (no station)"
        }:`,
        JSON.stringify(insertPayload, null, 2)
      )
      console.log(
        `🔍 [create-manager-appointment] service_type value in insertPayload:`,
        insertPayload.service_type,
        "type:",
        typeof insertPayload.service_type
      )

      const { data, error } = await supabaseClient
        .from("appointments")
        .insert(insertPayload)
        .select("id")
        .single()

      if (error) {
        console.error(`❌ [create-manager-appointment] Error inserting appointment:`, error)
        throw new Error(`Failed to create appointment: ${error.message}`)
      }

      console.log(
        `✅ [create-manager-appointment] Created daycare appointment ${data.id}${
          stationIdToUse ? ` for station ${stationIdToUse}` : ""
        }`
      )
      appointmentIds.push(data.id)
    } else {
      // Create grooming appointments
      console.log("✂️ [create-manager-appointment] Creating grooming appointments")

      for (const stationIdToUse of stationsToUse) {
        const insertPayload = {
          customer_id: resolvedCustomerId!,
          treatment_id: resolvedTreatmentId ?? null,
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
          .from("appointments")
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
    }

    console.log("🎉 [create-manager-appointment] Successfully created all appointments:", appointmentIds)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        appointmentIds,
        groupId: finalGroupId,
        message: `${
          normalizedAppointmentType === "business"
            ? "Business"
            : normalizedAppointmentType === "garden"
            ? "Garden"
            : "Private"
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
