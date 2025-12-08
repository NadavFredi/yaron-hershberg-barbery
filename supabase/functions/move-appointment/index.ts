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
  appointmentType: "grooming"
  // Removed garden-specific fields - barbery system only has grooming appointments
  internalNotes?: string
  customerNotes?: string
  // Removed groomingNotes - this field doesn't exist
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
      // Removed garden-specific fields - barbery system only has grooming appointments
      internalNotes,
      customerNotes,
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

    // Removed garden-specific time calculation - barbery system only has grooming appointments
    const finalNewStartTime = newStartTime
    const finalNewEndTime = newEndTime

    // Prepare update object for Supabase
    // Removed garden appointment handling - barbery system only has grooming appointments
    const updateData: Record<string, string | null | undefined> = {
      station_id: newStationId,
      start_at: finalNewStartTime,
      end_at: finalNewEndTime,
    }

    // Add internal notes if provided
    if (internalNotes !== undefined) {
      updateData.internal_notes = internalNotes || null
    }

    // Add customer notes if provided
    if (customerNotes !== undefined) {
      updateData.customer_notes = customerNotes || null
    }

    // Update grooming appointment
    if (appointmentType !== "grooming") {
      return new Response(JSON.stringify({ error: "Invalid appointment type. Must be 'grooming'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("Updating appointment:", appointmentId, updateData)

    const { data, error } = await supabaseClient
      .from("grooming_appointments")
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
