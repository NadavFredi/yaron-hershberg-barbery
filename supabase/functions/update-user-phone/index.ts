import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface UpdateUserPhoneRequest {
  user_id: string
  phone: string
  full_name?: string
}

function toE164FromDigits(phoneDigits: string): string | null {
  const trimmedDigits = phoneDigits.replace(/\D/g, "")

  if (!trimmedDigits) {
    return null
  }

  if ((trimmedDigits.length === 9 || trimmedDigits.length === 10) && trimmedDigits.startsWith("0")) {
    return `+972${trimmedDigits.slice(1)}`
  }

  if (trimmedDigits.startsWith("972") && trimmedDigits.length >= 11 && trimmedDigits.length <= 13) {
    return `+${trimmedDigits}`
  }

  if (trimmedDigits.length >= 9 && trimmedDigits.length <= 15) {
    return `+${trimmedDigits}`
  }

  return null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    console.log("📱 [update-user-phone] Function called with method:", req.method)

    const requestJson: UpdateUserPhoneRequest = await req.json()
    const { user_id, phone, full_name } = requestJson

    if (!user_id) {
      console.error("❌ [update-user-phone] Missing user_id")
      return new Response(
        JSON.stringify({ success: false, error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!phone) {
      console.error("❌ [update-user-phone] Missing phone")
      return new Response(
        JSON.stringify({ success: false, error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get Supabase environment variables
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

    console.log("🔧 [update-user-phone] Using Supabase URL:", supabaseUrl)
    console.log("🔧 [update-user-phone] Service key available:", !!supabaseServiceKey)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Normalize phone to E.164 format
    const phoneE164 = phone.startsWith("+") ? phone : toE164FromDigits(phone)
    if (!phoneE164) {
      console.error("❌ [update-user-phone] Invalid phone format:", phone)
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const digitsOnlyPhone = phoneE164.replace(/\D/g, "")
    const searchablePhoneDigits =
      digitsOnlyPhone.startsWith("972") && digitsOnlyPhone.length === 12
        ? `972${digitsOnlyPhone.slice(3)}`
        : digitsOnlyPhone.startsWith("0") && digitsOnlyPhone.length === 10
        ? `972${digitsOnlyPhone.slice(1)}`
        : digitsOnlyPhone

    console.log("📱 [update-user-phone] Phone formats:", {
      original: phone,
      phoneE164,
      digitsOnlyPhone,
      searchablePhoneDigits,
    })

    // Get current user to preserve existing metadata
    const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(user_id)

    if (getUserError) {
      console.error("❌ [update-user-phone] Error getting user:", getUserError)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to get user: ${getUserError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!currentUser.user) {
      console.error("❌ [update-user-phone] User not found")
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if phone is already set to the same value
    const currentPhone = currentUser.user.phone || currentUser.user.user_metadata?.phone_number_e164 || ""
    if (currentPhone === phoneE164) {
      console.log("ℹ️ [update-user-phone] Phone already set to same value, updating metadata only")
      
      // Still update metadata to ensure consistency
      const existingMetadata = currentUser.user.user_metadata || {}
      const metadataUpdates: Record<string, any> = {
        ...existingMetadata,
        phone_number: digitsOnlyPhone,
        phone_number_digits: digitsOnlyPhone,
        phone_number_search: searchablePhoneDigits,
        phone_number_e164: phoneE164,
      }

      if (full_name && full_name.trim()) {
        metadataUpdates.full_name = full_name.trim()
      }

      const { data: updatedUser, error: metadataError } = await supabase.auth.admin.updateUserById(user_id, {
        user_metadata: metadataUpdates,
      })

      if (metadataError) {
        console.error("❌ [update-user-phone] Error updating metadata:", metadataError)
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update metadata: ${metadataError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: updatedUser.user.id,
            phone: updatedUser.user.phone,
            user_metadata: updatedUser.user.user_metadata,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if phone is already in use by another user
    try {
      const { data: usersWithPhone, error: listError } = await supabase.auth.admin.listUsers()
      
      if (!listError && usersWithPhone?.users) {
        const conflictingUser = usersWithPhone.users.find(
          (u) => u.id !== user_id && (u.phone === phoneE164 || u.user_metadata?.phone_number_e164 === phoneE164)
        )
        
        if (conflictingUser) {
          console.error("❌ [update-user-phone] Phone already in use by another user:", conflictingUser.id)
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "מספר הטלפון כבר בשימוש על ידי משתמש אחר",
              error_en: "Phone number is already in use by another user"
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
      }
    } catch (checkError) {
      console.warn("⚠️ [update-user-phone] Could not check for phone conflicts:", checkError)
      // Continue anyway - Supabase will reject if there's a conflict, but we'll try to update anyway
    }

    // Prepare user metadata updates
    const existingMetadata = currentUser.user.user_metadata || {}
    const metadataUpdates: Record<string, any> = {
      ...existingMetadata,
      phone_number: digitsOnlyPhone,
      phone_number_digits: digitsOnlyPhone,
      phone_number_search: searchablePhoneDigits,
      phone_number_e164: phoneE164,
    }

    // Update full_name if provided
    if (full_name && full_name.trim()) {
      metadataUpdates.full_name = full_name.trim()
    }

    // Update metadata first (this always works)
    console.log("🔄 [update-user-phone] Updating user metadata:", {
      user_id,
      metadata: metadataUpdates,
    })

    const metadataResult = await supabase.auth.admin.updateUserById(user_id, {
      user_metadata: metadataUpdates,
    })

    if (metadataResult.error) {
      console.error("❌ [update-user-phone] Error updating metadata:", metadataResult.error)
      return new Response(
        JSON.stringify({ success: false, error: `Failed to update metadata: ${metadataResult.error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("✅ [update-user-phone] Metadata updated successfully")

    // Try to update phone field (may fail if SMS is disabled, but that's OK - metadata has the phone)
    let updatedUser = metadataResult.data
    let phoneUpdateError = null

    if (currentPhone !== phoneE164) {
      console.log("🔄 [update-user-phone] Attempting to update phone field:", {
        user_id,
        phone: phoneE164,
        phone_confirm: true,
        current_phone: currentPhone,
      })

      // Try updating phone field
      const phoneResult = await supabase.auth.admin.updateUserById(user_id, {
        phone: phoneE164,
        phone_confirm: true,
      })

      if (phoneResult.error) {
        phoneUpdateError = phoneResult.error
        console.warn("⚠️ [update-user-phone] Phone field update failed (this is OK if SMS is disabled):", phoneUpdateError.message)
        console.warn("⚠️ [update-user-phone] Phone is still stored in user_metadata.phone_number_e164")
        
        // Get refreshed user to return current state
        const { data: refreshedUser } = await supabase.auth.admin.getUserById(user_id)
        if (refreshedUser?.user) {
          updatedUser = refreshedUser
        }
      } else {
        console.log("✅ [update-user-phone] Phone field updated successfully")
        updatedUser = phoneResult.data
      }
    }

    if (!updatedUser?.user) {
      console.error("❌ [update-user-phone] Failed to get updated user")
      return new Response(
        JSON.stringify({ success: false, error: "Failed to retrieve updated user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const finalPhone = updatedUser.user.phone || updatedUser.user.user_metadata?.phone_number_e164 || phoneE164

    console.log("✅ [update-user-phone] User updated successfully:", {
      user_id: updatedUser.user.id,
      phone_field: updatedUser.user.phone,
      phone_metadata: updatedUser.user.user_metadata?.phone_number_e164,
      final_phone: finalPhone,
      phone_field_update_failed: phoneUpdateError !== null,
    })

    // If phone field update failed, check if it's due to a conflict
    if (phoneUpdateError) {
      // Check if the error is due to phone already being in use
      const errorMessage = phoneUpdateError.message?.toLowerCase() || ""
      if (errorMessage.includes("already") || errorMessage.includes("duplicate") || errorMessage.includes("exists")) {
        console.error("❌ [update-user-phone] Phone update failed due to conflict")
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "מספר הטלפון כבר בשימוש על ידי משתמש אחר",
            error_en: "Phone number is already in use by another user"
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      
      // Otherwise, it's OK - phone is in metadata (SMS disabled scenario)
      console.warn("⚠️ [update-user-phone] Phone field update failed, but phone is stored in metadata")
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser.user.id,
          phone: finalPhone,
          phone_field: updatedUser.user.phone,
          user_metadata: updatedUser.user.user_metadata,
        },
        warning: phoneUpdateError ? "Phone field update failed, but phone is stored in metadata. This is normal if SMS is disabled." : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("❌ [update-user-phone] Unexpected error:", error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

