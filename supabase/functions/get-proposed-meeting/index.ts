import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for get-proposed-meeting function")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

type MeetingResponse = {
  success: boolean
  meeting?: Record<string, unknown>
  error?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const meetingId = typeof body?.meetingId === "string" ? body.meetingId.trim() : ""

    if (!meetingId) {
      return new Response(
        JSON.stringify({ success: false, error: "meetingId is required" } satisfies MeetingResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { data: meeting, error } = await supabase
      .from("proposed_meetings")
      .select(
        `
        id,
        station_id,
        service_type,
        start_at,
        end_at,
        status,
        title,
        summary,
        notes,
        reschedule_appointment_id,
        reschedule_customer_id,
        reschedule_treatment_id,
        reschedule_original_start_at,
        reschedule_original_end_at,
        stations(id, name),
        proposed_meeting_invites(
          id,
          customer_id,
          source,
          source_category_id,
          customers(id, full_name)
        ),
        proposed_meeting_categories(
          id,
          customer_type_id,
          customer_type:customer_types(name)
        )
      `
      )
      .eq("id", meetingId)
      .maybeSingle()

    if (error) {
      console.error("❌ [get-proposed-meeting] Query error:", error)
      throw error
    }

    if (!meeting) {
      return new Response(
        JSON.stringify({ success: false, error: "Meeting not found" } satisfies MeetingResponse),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const response = {
      id: meeting.id,
      stationId: meeting.station_id,
      stationName: Array.isArray(meeting.stations) ? meeting.stations[0]?.name ?? null : meeting.stations?.name ?? null,
      serviceType: meeting.service_type ?? "grooming",
      startAt: meeting.start_at,
      endAt: meeting.end_at,
      status: meeting.status ?? "proposed",
      title: meeting.title ?? null,
      summary: meeting.summary ?? null,
      notes: meeting.notes ?? null,
      rescheduleAppointmentId: meeting.reschedule_appointment_id ?? null,
      rescheduleCustomerId: meeting.reschedule_customer_id ?? null,
      rescheduleTreatmentId: meeting.reschedule_treatment_id ?? null,
      rescheduleOriginalStartAt: meeting.reschedule_original_start_at ?? null,
      rescheduleOriginalEndAt: meeting.reschedule_original_end_at ?? null,
      invites: (meeting.proposed_meeting_invites ?? []).map((invite: any) => ({
        id: invite.id,
        customerId: invite.customer_id ?? null,
        customerName: Array.isArray(invite.customers)
          ? invite.customers[0]?.full_name ?? null
          : invite.customers?.full_name ?? null,
        source: invite.source === "category" ? "category" : "manual",
        sourceCategoryId: invite.source_category_id ?? null,
      })),
      categories: (meeting.proposed_meeting_categories ?? []).map((category: any) => ({
        id: category.id,
        customerTypeId: category.customer_type_id,
        customerTypeName: category.customer_type?.name ?? null,
      })),
    }

    return new Response(JSON.stringify({ success: true, meeting: response } satisfies MeetingResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [get-proposed-meeting] Unexpected failure:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      } satisfies MeetingResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
