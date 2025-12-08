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
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({}))
    const meetingId = typeof body?.meetingId === "string" ? body.meetingId.trim() : ""
    const code = typeof body?.code === "string" ? body.code.trim() : ""

    if (!meetingId) {
      return new Response(JSON.stringify({ success: false, error: "meetingId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: customerRow, error: customerError } = await serviceClient
      .from("customers")
      .select("id, customer_type_id")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle()

    if (customerError) {
      throw customerError
    }

    if (!customerRow) {
      return new Response(JSON.stringify({ success: false, error: "Customer profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
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
        reschedule_original_start_at,
        reschedule_original_end_at,
        proposed_meeting_invites(id, customer_id),
        proposed_meeting_categories(id, customer_type_id)
      `,
      )
      .eq("id", meetingId)
      .maybeSingle()

    if (meetingError) {
      throw meetingError
    }

    if (!meeting) {
      return new Response(JSON.stringify({ success: false, error: "Meeting not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (meeting.status && meeting.status !== "proposed") {
      return new Response(JSON.stringify({ success: false, error: "Meeting is no longer available" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const invited = (meeting.proposed_meeting_invites ?? []).some((invite: any) => invite.customer_id === customerRow.id)
    const categoryAllowed =
      !!customerRow.customer_type_id &&
      (meeting.proposed_meeting_categories ?? []).some(
        (category: any) => category.customer_type_id === customerRow.customer_type_id,
      )
    const codeAllowed = Boolean(code && code === meeting.code)

    if (!invited && !categoryAllowed && !codeAllowed) {
      return new Response(JSON.stringify({ success: false, error: "אין לך גישה להצעה זו" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (meeting.reschedule_customer_id && meeting.reschedule_customer_id !== customerRow.id) {
      return new Response(JSON.stringify({ success: false, error: "ההצעה הזו שמורה ללקוח אחר" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Create or move appointment
    let appointmentId: string | null = null
    const start = meeting.start_at
    const end = meeting.end_at
    const stationId = meeting.station_id ?? null

    if (!start || !end) {
      return new Response(JSON.stringify({ success: false, error: "Missing meeting times" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: appointment, error: appointmentError } = await serviceClient
      .from("appointments")
      .upsert(
        {
          id: meeting.reschedule_appointment_id ?? undefined,
          customer_id: customerRow.id,
          station_id: stationId,
          start_at: start,
          end_at: end,
          status: "scheduled",
          payment_status: "unpaid",
          appointment_kind: "business",
          appointment_name: meeting.title ?? null,
          customer_notes: meeting.summary ?? null,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle()

    if (appointmentError) {
      throw appointmentError
    }

    appointmentId = appointment?.id ?? null

    const { error: updateMeetingError } = await serviceClient
      .from("proposed_meetings")
      .update({
        status: "booked",
        updated_at: new Date().toISOString(),
        reschedule_appointment_id: appointmentId ?? meeting.reschedule_appointment_id,
        reschedule_customer_id: customerRow.id,
      })
      .eq("id", meetingId)

    if (updateMeetingError) {
      throw updateMeetingError
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointmentId,
        meetingId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("❌ [book-proposed-meeting] Error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
