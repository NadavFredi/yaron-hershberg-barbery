import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface MoveAppointmentRequest {
  appointmentId: string
  newStationId: string
  newStartTime: string
  newEndTime: string
  oldStationId: string
  oldStartTime: string
  oldEndTime: string
  appointmentType: "grooming" | "garden"
  newGardenAppointmentType?: "full-day" | "hourly"
  newGardenIsTrial?: boolean
  selectedHours?: { start: string; end: string }
  gardenTrimNails?: boolean
  gardenBrush?: boolean
  gardenBath?: boolean
  latePickupRequested?: boolean
  latePickupNotes?: string
  internalNotes?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Initialize Supabase client
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    })

    const {
      appointmentId,
      newStationId,
      newStartTime,
      newEndTime,
      oldStationId,
      oldStartTime,
      oldEndTime,
      appointmentType,
      newGardenAppointmentType,
      newGardenIsTrial,
      selectedHours,
      gardenTrimNails,
      gardenBrush,
      gardenBath,
      latePickupRequested,
      latePickupNotes,
      internalNotes,
    }: MoveAppointmentRequest = await req.json()

    console.log("Moving appointment:", {
      appointmentId,
      appointmentType,
      oldStationId,
      oldStartTime,
      oldEndTime,
      newStationId,
      newStartTime,
      newEndTime,
    })

    if (
      !appointmentId ||
      !newStationId ||
      !newStartTime ||
      !newEndTime ||
      !oldStationId ||
      !oldStartTime ||
      !oldEndTime ||
      !appointmentType
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Calculate new times based on selected hours for hourly garden appointments
    let finalNewStartTime = newStartTime
    let finalNewEndTime = newEndTime

    if (appointmentType === "garden" && newGardenAppointmentType === "hourly" && selectedHours) {
      console.log(`🕐 Calculating new times for hourly garden appointment:`, {
        originalStart: newStartTime,
        originalEnd: newEndTime,
        selectedHours,
      })

      // Parse the selected hours
      const [startHour, startMinute] = selectedHours.start.split(":").map(Number)
      const [endHour, endMinute] = selectedHours.end.split(":").map(Number)

      // Get the date from the original appointment
      const originalDate = new Date(newStartTime)

      // Create new start and end times with the selected hours but keeping the same date
      finalNewStartTime = new Date(
        originalDate.getFullYear(),
        originalDate.getMonth(),
        originalDate.getDate(),
        startHour,
        startMinute
      ).toISOString()
      finalNewEndTime = new Date(
        originalDate.getFullYear(),
        originalDate.getMonth(),
        originalDate.getDate(),
        endHour,
        endMinute
      ).toISOString()

      console.log(`🕐 New calculated times:`, {
        finalNewStartTime,
        finalNewEndTime,
      })
    }

    // Prepare update object for Supabase
    type UpdateValue = string | boolean | null | undefined | "full_day" | "trial" | "hourly" | "pending" | "approved"
    const updateData: Record<string, UpdateValue> = {
      station_id:
        newStationId === "garden-station" ||
        newStationId === "garden-full-day" ||
        newStationId === "garden-hourly" ||
        newStationId === "garden-trial"
          ? null
          : newStationId,
      start_at: finalNewStartTime,
      end_at: finalNewEndTime,
    }

    // Add internal notes if provided
    if (internalNotes !== undefined) {
      updateData.internal_notes = internalNotes
    }

    // Update based on appointment type
    if (appointmentType === "grooming") {
      // Update appointment
      console.log("Updating appointment:", appointmentId, updateData)

      const { data, error } = await supabaseClient
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId)
        .select()
        .single()

      if (error) {
        console.error("Error updating appointment:", error)
        throw new Error(`Failed to update appointment: ${error.message}`)
      }

      console.log("✅ Successfully updated appointment:", data)

      return new Response(
        JSON.stringify({
          success: true,
          message: "Appointment moved successfully",
          appointment: data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } else if (appointmentType === "garden") {
      // Update appointment with garden-specific fields
      // Note: service_type and questionnaire_result columns no longer exist
      
      // Add garden-specific fields
      if (typeof latePickupRequested === "boolean") {
        updateData.late_pickup_requested = latePickupRequested
      }
      if (latePickupNotes !== undefined) {
        updateData.late_pickup_notes = latePickupNotes
      }
      if (typeof gardenTrimNails === "boolean") {
        updateData.garden_trim_nails = gardenTrimNails
      }
      if (typeof gardenBrush === "boolean") {
        updateData.garden_brush = gardenBrush
      }
      if (typeof gardenBath === "boolean") {
        updateData.garden_bath = gardenBath
      }

      console.log("Updating appointment:", appointmentId, updateData)

      const { data, error } = await supabaseClient
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId)
        .select()
        .single()

      if (error) {
        console.error("Error updating appointment:", error)
        throw new Error(`Failed to update appointment: ${error.message}`)
      }

      console.log("✅ Successfully updated appointment:", data)

      return new Response(
        JSON.stringify({
          success: true,
          message: "Appointment moved successfully",
          appointment: data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } else {
      return new Response(JSON.stringify({ error: "Invalid appointment type. Must be 'grooming' or 'garden'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("Unexpected error:", error)
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
