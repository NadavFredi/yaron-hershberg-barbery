import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars are not set")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    })

    const { data, error } = await supabase
      .from("ticket_types")
      .select("id, name, description, price, total_entries, is_unlimited, display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })

    if (error) {
      throw error
    }

    const subscriptionTypes =
      data?.map((record) => ({
        id: record.id,
        name: record.name ?? "",
        description: record.description ?? "",
        price: record.price !== null && record.price !== undefined ? Number(record.price).toString() : "",
        order: record.display_order ?? 0,
        totalEntries: record.total_entries ?? null,
        isUnlimited: record.is_unlimited ?? false,
      })) ?? []

    return new Response(JSON.stringify({ success: true, data: subscriptionTypes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Failed to fetch subscription types", error)

    let message = "Unknown error"
    if (error instanceof Error) {
      message = error.message
    } else if (typeof error === "object" && error !== null && "message" in error) {
      const raw = (error as { message?: unknown }).message
      message = typeof raw === "string" ? raw : JSON.stringify(raw)
    } else {
      try {
        message = JSON.stringify(error)
      } catch {
        message = String(error)
      }
    }

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
