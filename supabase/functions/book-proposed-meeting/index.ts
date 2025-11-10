import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing Supabase configuration for book-proposed-meeting function")
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const body = await req.json().catch(() => ({}))
    const meetingId = typeof body?.meetingId === "string" ? body.meetingId.trim() : ""
    const treatmentId = typeof body?.treatmentId === "string" ? body.treatmentId.trim() : ""
    const code = typeof body?.code === "string" ? body.code.trim() : ""

    if (!meetingId || !treatmentId) {
      return new Response(
        JSON.stringify({ success: false, error: "meetingId and treatmentId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { data: customerRow, error: customerError } = await serviceClient
      .from("customers")
      .select("id, customer_type_id")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (customerError) {
      console.error("❌ [book-proposed-meeting] Failed to load customer:", customerError)
      throw customerError
    }

    if (!customerRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer profile not found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const customerId = customerRow.id

    const { data: treatmentRow, error: treatmentError } = await serviceClient
      .from("treatments")
      .select("id, customer_id")
      .eq("id", treatmentId)
      .maybeSingle()

    if (treatmentError) {
      console.error("❌ [book-proposed-meeting] Failed to load treatment:", treatmentError)
      throw treatmentError
    }

    if (!treatmentRow || treatmentRow.customer_id !== customerId) {
      return new Response(
        JSON.stringify({ success: false, error: "Only invited customers can select this treatment" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { data: meeting, error: meetingError } = await serviceClient
      .from("proposed_meetings")
      .select(
        `
        id,
        station_id,
        service_type,
        start_at,
        end_at,
        status,
        code,
        title,
        summary,
        notes,
        reschedule_appointment_id,
        reschedule_customer_id,
        reschedule_treatment_id,
        reschedule_original_start_at,
        reschedule_original_end_at,
        proposed_meeting_invites(id, customer_id),
        proposed_meeting_categories(id, customer_type_id)
      `
      )
      .eq("id", meetingId)
      .maybeSingle()

    if (meetingError) {
      console.error("❌ [book-proposed-meeting] Failed to load meeting:", meetingError)
      throw meetingError
    }

    if (!meeting) {
      return new Response(
        JSON.stringify({ success: false, error: "Meeting not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (meeting.status && meeting.status !== "proposed") {
      return new Response(
        JSON.stringify({ success: false, error: "Meeting is no longer available" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const invited = (meeting.proposed_meeting_invites ?? []).some(
      (invite: any) => invite.customer_id === customerId
    )
    const categoryAllowed =
      !!customerRow.customer_type_id &&
      (meeting.proposed_meeting_categories ?? []).some(
        (category: any) => category.customer_type_id === customerRow.customer_type_id
      )
    const codeAllowed = Boolean(code && code === meeting.code)

    if (!invited && !categoryAllowed && !codeAllowed) {
      return new Response(
        JSON.stringify({ success: false, error: "אין לך גישה להצעה זו" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (meeting.reschedule_customer_id && meeting.reschedule_customer_id !== customerId) {
      return new Response(
        JSON.stringify({ success: false, error: "ההצעה הזו שמורה ללקוח אחר" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (meeting.reschedule_treatment_id && meeting.reschedule_treatment_id !== treatmentId) {
      return new Response(
        JSON.stringify({ success: false, error: "אפשר לאשר רק עם הכלב ששויך להצעה" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { data: locked, error: lockError } = await serviceClient
      .from("proposed_meetings")
      .update({ status: "locking" })
      .eq("id", meetingId)
      .eq("status", meeting.status ?? "proposed")
      .select("id")
      .maybeSingle()

    if (lockError) {
      console.error("❌ [book-proposed-meeting] Failed to lock meeting:", lockError)
      throw lockError
    }

    if (!locked) {
      return new Response(
        JSON.stringify({ success: false, error: "Meeting already taken" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    let appointmentId: string | null = null

    const isReschedule = Boolean(meeting.reschedule_appointment_id)

    try {
      if (isReschedule) {
        const tableName = meeting.service_type === "garden" ? "daycare_appointments" : "grooming_appointments"
        console.log("🔁 [book-proposed-meeting] Rescheduling appointment from proposed meeting", {
          meetingId,
          appointmentId: meeting.reschedule_appointment_id,
          customerId,
          treatmentId,
          serviceType: meeting.service_type,
        })

        const { data: originalAppointment, error: originalError } = await serviceClient
          .from(tableName)
          .select("id, customer_id, treatment_id, appointment_kind, status")
          .eq("id", meeting.reschedule_appointment_id)
          .maybeSingle()

        if (originalError) {
          throw originalError
        }

        if (!originalAppointment) {
          return new Response(
            JSON.stringify({ success: false, error: "התור המקורי לא נמצא" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }

        if (originalAppointment.customer_id !== customerId) {
          return new Response(
            JSON.stringify({ success: false, error: "התור המקורי שייך ללקוח אחר" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }

        if (meeting.reschedule_treatment_id && originalAppointment.treatment_id !== meeting.reschedule_treatment_id) {
          return new Response(
            JSON.stringify({ success: false, error: "התור המקורי שייך לכלב אחר" }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }

        const updatePayload: Record<string, unknown> = {
          station_id: meeting.station_id,
          start_at: meeting.start_at,
          end_at: meeting.end_at,
          status: "approved",
        }

        if (meeting.summary) {
          updatePayload.customer_notes = meeting.summary
        }
        if (meeting.notes) {
          updatePayload.internal_notes = meeting.notes
        }

        if (meeting.service_type !== "garden") {
          console.log("✂️ [book-proposed-meeting] Updating grooming appointment", {
            appointmentId: meeting.reschedule_appointment_id,
            stationId: meeting.station_id,
            startAt: meeting.start_at,
            endAt: meeting.end_at,
          })
        } else {
          console.log("🌿 [book-proposed-meeting] Updating daycare appointment", {
            appointmentId: meeting.reschedule_appointment_id,
            stationId: meeting.station_id,
            startAt: meeting.start_at,
            endAt: meeting.end_at,
          })
        }

        const { error: updateError } = await serviceClient
          .from(tableName)
          .update(updatePayload)
          .eq("id", meeting.reschedule_appointment_id)

        if (updateError) {
          throw updateError
        }

        appointmentId = meeting.reschedule_appointment_id
        console.log("✅ [book-proposed-meeting] Appointment rescheduled successfully", {
          meetingId,
          appointmentId,
        })
      } else if (meeting.service_type === "garden") {
        console.log("🌿 [book-proposed-meeting] Creating daycare appointment from proposed meeting", {
          meetingId,
          customerId,
          treatmentId,
          startAt: meeting.start_at,
          endAt: meeting.end_at,
        })
        const { data: appointment, error: insertError } = await serviceClient
          .from("daycare_appointments")
          .insert({
            station_id: meeting.station_id,
            customer_id: customerId,
            treatment_id: treatmentId,
            start_at: meeting.start_at,
            end_at: meeting.end_at,
            status: "approved",
            service_type: "hourly",
            customer_notes: meeting.summary,
            internal_notes: meeting.notes,
          })
          .select("id")
          .single()

        if (insertError) {
          throw insertError
        }
        appointmentId = appointment?.id ?? null
        console.log("✅ [book-proposed-meeting] Daycare appointment created", {
          meetingId,
          appointmentId,
        })
      } else {
        console.log("✂️ [book-proposed-meeting] Creating grooming appointment from proposed meeting", {
          meetingId,
          customerId,
          treatmentId,
          startAt: meeting.start_at,
          endAt: meeting.end_at,
        })
        const { data: appointment, error: insertError } = await serviceClient
          .from("grooming_appointments")
          .insert({
            station_id: meeting.station_id,
            customer_id: customerId,
            treatment_id: treatmentId,
            start_at: meeting.start_at,
            end_at: meeting.end_at,
            status: "approved",
            appointment_kind: "business",
            customer_notes: meeting.summary,
            internal_notes: meeting.notes,
          })
          .select("id")
          .single()

        if (insertError) {
          throw insertError
        }
        appointmentId = appointment?.id ?? null
        console.log("✅ [book-proposed-meeting] Grooming appointment created", {
          meetingId,
          appointmentId,
        })
      }
    } catch (error) {
      console.error("❌ [book-proposed-meeting] Failed to create appointment:", error)
      await serviceClient.from("proposed_meetings").update({ status: meeting.status ?? "proposed" }).eq("id", meetingId)
      throw error
    }

    await serviceClient.from("proposed_meetings").delete().eq("id", meetingId)

    return new Response(
      JSON.stringify({ success: true, appointmentId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("❌ [book-proposed-meeting] Unexpected failure:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
