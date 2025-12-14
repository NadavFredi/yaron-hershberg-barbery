import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error("❌ [reset-worker-password] Missing Supabase environment variables", {
    hasUrl: Boolean(supabaseUrl),
    hasServiceRole: Boolean(serviceRoleKey),
    hasAnonKey: Boolean(anonKey),
  })
  throw new Error("Missing Supabase environment configuration")
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

const authClientFactory = (authHeader: string) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

type ResetWorkerPasswordRequest = {
  workerId: string
  action: "set_password" | "generate_link"
  newPassword?: string
}

type ErrorResponse = { success: false; error: string }

type SuccessResponse = {
  success: true
  message: string
  resetLink?: string
  newPassword?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    const payload: ErrorResponse = { success: false, error: "Method not allowed. Use POST." }
    return new Response(JSON.stringify(payload), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    console.warn("⚠️ [reset-worker-password] Missing Authorization header")
    const payload: ErrorResponse = { success: false, error: "Unauthorized" }
    return new Response(JSON.stringify(payload), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const authClient = authClientFactory(authHeader)
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser()

    if (authError || !user) {
      console.warn("⚠️ [reset-worker-password] Auth validation failed", { authError })
      const payload: ErrorResponse = { success: false, error: "Unauthorized" }
      return new Response(JSON.stringify(payload), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("❌ [reset-worker-password] Failed to load requesting profile", profileError)
      const payload: ErrorResponse = {
        success: false,
        error: "אירעה שגיאה באימות המשתמש. נסה שוב בעוד מספר דקות.",
      }
      return new Response(JSON.stringify(payload), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!profile || profile.role !== "manager") {
      console.warn("⚠️ [reset-worker-password] Access denied - user is not manager", {
        requesterId: user.id,
        role: profile?.role,
      })
      const payload: ErrorResponse = { success: false, error: "Forbidden" }
      return new Response(JSON.stringify(payload), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body: ResetWorkerPasswordRequest = await req.json().catch(() => ({} as ResetWorkerPasswordRequest))
    const workerId = typeof body.workerId === "string" && body.workerId.trim().length > 0 ? body.workerId.trim() : null
    const action = body.action === "set_password" || body.action === "generate_link" ? body.action : "generate_link"
    const newPassword = typeof body.newPassword === "string" && body.newPassword.trim().length >= 8 ? body.newPassword.trim() : null

    if (!workerId) {
      const payload: ErrorResponse = { success: false, error: "יש לספק מזהה עובד תקין." }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (action === "set_password" && !newPassword) {
      const payload: ErrorResponse = { success: false, error: "יש לספק סיסמה חדשה באורך של לפחות 8 תווים." }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("🔐 [reset-worker-password] Processing password action for worker", {
      managerId: user.id,
      workerId,
      action,
    })

    // Handle set password action
    if (action === "set_password") {
      console.log("🔐 [reset-worker-password] Setting password directly for worker", {
        workerId,
        hasPassword: Boolean(newPassword),
        passwordLength: newPassword?.length,
      })

      // Get current user to preserve their email/phone confirmation status
      const { data: currentUser, error: getUserError } = await serviceClient.auth.admin.getUserById(workerId)
      
      if (getUserError) {
        console.error("❌ [reset-worker-password] Failed to get user", getUserError)
        const payload: ErrorResponse = {
          success: false,
          error: "לא ניתן לטעון את פרטי המשתמש. נסה שוב מאוחר יותר.",
        }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Update password directly - this sets the password hash in Supabase Auth
      // The user can immediately log in with this password using their email
      // Note: signInWithPassword only works with email, not phone
      // If user only has phone, they must use OTP login, not password
      
      if (!currentUser?.user?.email) {
        console.warn("⚠️ [reset-worker-password] Worker has no email - password login won't work, only OTP")
        const payload: ErrorResponse = {
          success: false,
          error: "לעובד אין אימייל רשום. לא ניתן להתחבר עם סיסמה - יש להשתמש בקוד OTP דרך הטלפון.",
        }
        return new Response(JSON.stringify(payload), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const updatePayload: Parameters<typeof serviceClient.auth.admin.updateUserById>[1] = {
        password: newPassword!,
        email_confirm: true, // Always confirm email so password login works
      }
      
      // Also confirm phone if it exists (for OTP login option)
      if (currentUser?.user?.phone) {
        updatePayload.phone_confirm = true
      }

      console.log("🔐 [reset-worker-password] Updating password with payload:", {
        hasPassword: Boolean(newPassword),
        email_confirm: true,
        phone_confirm: Boolean(currentUser?.user?.phone),
      })

      const { error: updatePasswordError } = await serviceClient.auth.admin.updateUserById(workerId, updatePayload)

      if (updatePasswordError) {
        console.error("❌ [reset-worker-password] Failed to set password", updatePasswordError)
        const payload: ErrorResponse = {
          success: false,
          error: `לא ניתן לעדכן את הסיסמה: ${updatePasswordError.message || "נסה שוב מאוחר יותר."}`,
        }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log("✅ [reset-worker-password] Password updated successfully", {
        workerId,
        hasEmail: Boolean(currentUser?.user?.email),
        hasPhone: Boolean(currentUser?.user?.phone),
      })

      // Verify the password was set by getting the user again
      const { data: verifyUser } = await serviceClient.auth.admin.getUserById(workerId)
      console.log("🔍 [reset-worker-password] Verification - user email:", verifyUser?.user?.email)

      const loginInstructions = currentUser?.user?.email
        ? `העובד יכול להתחבר עם האימייל ${currentUser.user.email} והסיסמה החדשה.`
        : currentUser?.user?.phone
        ? `העובד יכול להתחבר עם מספר הטלפון ${currentUser.user.phone} באמצעות קוד OTP (לא סיסמה).`
        : "הסיסמה עודכנה, אך לא נמצא אימייל או טלפון רשום."

      const response: SuccessResponse = {
        success: true,
        message: `הסיסמה עודכנה בהצלחה. ${loginInstructions}`,
        newPassword: newPassword!,
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Get worker profile to check email for generate_link action
    const { data: workerProfile, error: workerProfileError } = await serviceClient
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", workerId)
      .maybeSingle()

    if (workerProfileError) {
      console.error("❌ [reset-worker-password] Failed to load worker profile", workerProfileError)
      const payload: ErrorResponse = {
        success: false,
        error: "לא ניתן לטעון את פרטי העובד. נסה שוב מאוחר יותר.",
      }
      return new Response(JSON.stringify(payload), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!workerProfile) {
      const payload: ErrorResponse = {
        success: false,
        error: "העובד לא נמצא במערכת.",
      }
      return new Response(JSON.stringify(payload), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Generate password reset link
    // Use the frontend origin from the request headers or environment
    // Try to get origin from referer header first (more reliable for edge functions)
    const referer = req.headers.get("referer")
    let requestOrigin = req.headers.get("origin")
    
    if (!requestOrigin && referer) {
      try {
        const refererUrl = new URL(referer)
        requestOrigin = `${refererUrl.protocol}//${refererUrl.host}`
      } catch {
        // If parsing fails, use default
      }
    }
    
    // Fallback to site_url from environment or default localhost
    if (!requestOrigin) {
      requestOrigin = Deno.env.get("SITE_URL") || "http://localhost:3000"
    }
    
    const redirectTo = `${requestOrigin}/reset-password`
    
    if (workerProfile.email) {
      // If worker has email, generate recovery link
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email: workerProfile.email,
        options: {
          redirectTo,
        },
      })

      if (linkError) {
        console.error("❌ [reset-worker-password] Failed to generate reset link", linkError)
        const payload: ErrorResponse = {
          success: false,
          error: "לא ניתן ליצור קישור איפוס סיסמה. ודא שהעובד יש לו אימייל רשום.",
        }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log("✅ [reset-worker-password] Password reset link generated", {
        workerId,
        hasEmail: Boolean(workerProfile.email),
      })

      const response: SuccessResponse = {
        success: true,
        message: `קישור איפוס סיסמה נשלח לאימייל ${workerProfile.email}`,
        resetLink: linkData.properties.action_link,
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    } else {
      // If no email, generate magic link for phone
      const { data: authUser } = await serviceClient.auth.admin.getUserById(workerId)
      
      if (!authUser?.user?.phone) {
        const payload: ErrorResponse = {
          success: false,
          error: "לעובד אין אימייל או מספר טלפון רשום. לא ניתן ליצור קישור איפוס סיסמה.",
        }
        return new Response(JSON.stringify(payload), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Generate magic link for phone
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: "magiclink",
        phone: authUser.user.phone,
        options: {
          redirectTo,
        },
      })

      if (linkError) {
        console.error("❌ [reset-worker-password] Failed to generate magic link", linkError)
        const payload: ErrorResponse = {
          success: false,
          error: "לא ניתן ליצור קישור איפוס סיסמה.",
        }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      console.log("✅ [reset-worker-password] Magic link generated for phone", {
        workerId,
        hasPhone: Boolean(authUser.user.phone),
      })

      const response: SuccessResponse = {
        success: true,
        message: `קישור איפוס סיסמה נשלח למספר הטלפון ${authUser.user.phone}`,
        resetLink: linkData.properties.action_link,
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    console.error("❌ [reset-worker-password] Unexpected error", error)
    const payload: ErrorResponse = {
      success: false,
      error: "אירעה שגיאה בלתי צפויה במהלך יצירת קישור איפוס הסיסמה. נסה שוב בעוד מספר דקות.",
    }
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

