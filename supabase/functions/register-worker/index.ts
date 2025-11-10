import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error("❌ [register-worker] Missing Supabase environment variables", {
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

type RegisterWorkerRequest = {
  fullName: string
  phoneNumber: string
  email?: string | null
  password?: string | null
  profileId?: string | null
  sendResetPasswordEmail?: boolean
}

type ErrorResponse = { success: false; error: string }

type SuccessResponse = {
  success: true
  worker: {
    id: string
    fullName: string | null
    email: string | null
    phoneNumber: string | null
    isActive: boolean
    createdAt: string | null
  }
  createdNewUser: boolean
}

const toDigits = (value: string) => value.replace(/\D/g, "")

const toE164FromDigits = (digits: string): string | null => {
  if (!digits) return null
  if ((digits.length === 9 || digits.length === 10) && digits.startsWith("0")) {
    return `+972${digits.slice(1)}`
  }
  if (digits.startsWith("972") && digits.length >= 11 && digits.length <= 13) {
    return `+${digits}`
  }
  if (digits.length >= 9 && digits.length <= 15) {
    return `+${digits}`
  }
  return null
}

const buildSearchablePhone = (digits: string): string | null => {
  if (!digits) return null
  if (digits.startsWith("0") && digits.length >= 9) {
    return `972${digits.slice(1)}`
  }
  return digits
}

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null
  }
  return trimmed
}

const normalizeFullName = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

const normalizePassword = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length < 8) {
    return null
  }
  return trimmed
}

const buildWorkerPayload = (user: User | null, profileRow: Record<string, unknown> | null) => ({
  success: true as const,
  worker: {
    id: profileRow?.id ? String(profileRow.id) : user?.id ?? "",
    fullName: (profileRow?.full_name as string | null) ?? user?.user_metadata?.full_name ?? null,
    email: (profileRow?.email as string | null) ?? user?.email ?? null,
    phoneNumber: (profileRow?.phone_number as string | null) ?? user?.phone ?? null,
    isActive: Boolean(profileRow?.worker_is_active ?? true),
    createdAt: (profileRow?.created_at as string | null) ?? user?.created_at ?? null,
  },
})

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
    console.warn("⚠️ [register-worker] Missing Authorization header")
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
      console.warn("⚠️ [register-worker] Auth validation failed", { authError })
      const payload: ErrorResponse = { success: false, error: "Unauthorized" }
      return new Response(JSON.stringify(payload), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("❌ [register-worker] Failed to load requesting profile", profileError)
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
      console.warn("⚠️ [register-worker] Access denied - user is not manager", {
        requesterId: user.id,
        role: profile?.role,
      })
      const payload: ErrorResponse = { success: false, error: "Forbidden" }
      return new Response(JSON.stringify(payload), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body: RegisterWorkerRequest = await req.json().catch(() => ({} as RegisterWorkerRequest))

    const fullName = normalizeFullName(body.fullName)
    const phoneDigits = typeof body.phoneNumber === "string" ? toDigits(body.phoneNumber) : ""
    const phoneE164 = toE164FromDigits(phoneDigits)
    const searchablePhone = buildSearchablePhone(phoneDigits)
    const email = normalizeEmail(body.email)
    const profileId = typeof body.profileId === "string" && body.profileId.trim().length > 0 ? body.profileId.trim() : null

    if (!fullName) {
      const payload: ErrorResponse = { success: false, error: "יש להזין שם מלא עבור העובד." }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!phoneDigits) {
      const payload: ErrorResponse = { success: false, error: "יש להזין מספר טלפון לעובד." }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!phoneE164) {
      const payload: ErrorResponse = {
        success: false,
        error: "פורמט מספר הטלפון אינו תקין. אנא הזן מספר ישראלי תקין.",
      }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const payloadMetadata = {
      full_name: fullName,
      phone_number: phoneDigits,
      phone_number_digits: phoneDigits,
      phone_number_e164: phoneE164,
      phone_number_search: searchablePhone,
    }

    if (email) {
      payloadMetadata["email"] = email
    }

    // Support promoting an existing profile to worker
    if (profileId) {
      console.log("ℹ️ [register-worker] Promoting existing profile to worker", {
        requesterId: user.id,
        targetProfileId: profileId,
      })

      const { data: existingProfile, error: existingProfileError } = await serviceClient
        .from("profiles")
        .select("id, role, worker_is_active")
        .eq("id", profileId)
        .maybeSingle()

      if (existingProfileError) {
        console.error("❌ [register-worker] Failed to load target profile", existingProfileError)
        const payload: ErrorResponse = {
          success: false,
          error: "לא ניתן לטעון את פרטי העובד. נסה שוב מאוחר יותר.",
        }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      if (!existingProfile) {
        const payload: ErrorResponse = {
          success: false,
          error: "לא נמצא משתמש עם המזהה שסופק.",
        }
        return new Response(JSON.stringify(payload), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const { error: updateProfileError, data: updatedProfileRows } = await serviceClient
        .from("profiles")
        .update({
          full_name: fullName,
          phone_number: phoneDigits,
          email,
          role: "worker",
          worker_is_active: true,
        })
        .eq("id", profileId)
        .select("*")

      if (updateProfileError || !updatedProfileRows || updatedProfileRows.length === 0) {
        console.error("❌ [register-worker] Failed to update profile role", updateProfileError)
        const payload: ErrorResponse = {
          success: false,
          error: "לא הצלחנו לעדכן את פרטי העובד. נסה שוב מאוחר יותר.",
        }
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      // Update auth user metadata when possible
      const updatePayload: Parameters<typeof serviceClient.auth.admin.updateUserById>[1] = {
        phone: phoneE164,
        user_metadata: payloadMetadata,
      }

      if (email) {
        updatePayload.email = email
      }

      const { error: updateUserError } = await serviceClient.auth.admin.updateUserById(profileId, updatePayload)

      if (updateUserError) {
        console.warn("⚠️ [register-worker] Failed to update auth metadata", updateUserError)
      }

      const response: SuccessResponse = {
        ...buildWorkerPayload(null, updatedProfileRows[0]),
        createdNewUser: false,
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Creating a new worker user requires a password
    const password = normalizePassword(body.password)
    if (!password) {
      const payload: ErrorResponse = {
        success: false,
        error: "יש להזין סיסמה ראשונית באורך של לפחות 8 תווים לעובד חדש.",
      }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("👷 [register-worker] Creating new worker user", {
      managerId: user.id,
      fullName,
      hasEmail: Boolean(email),
    })

    const userPayload: Parameters<typeof serviceClient.auth.admin.createUser>[0] = {
      password,
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: payloadMetadata,
    }

    if (email) {
      userPayload.email = email
      userPayload.email_confirm = true
    }

    const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser(userPayload)

    if (createUserError || !createdUser?.user) {
      console.error("❌ [register-worker] Failed to create worker auth user", createUserError)
      const payload: ErrorResponse = {
        success: false,
        error:
          createUserError?.message ??
          "לא הצלחנו ליצור משתמש חדש עבור העובד. ודא שהאימייל או הטלפון לא קיימים כבר במערכת.",
      }
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const workerUser = createdUser.user

    const { error: upsertProfileError, data: profileRows } = await serviceClient
      .from("profiles")
      .upsert(
        {
          id: workerUser.id,
          full_name: fullName,
          phone_number: phoneDigits,
          email,
          role: "worker",
          worker_is_active: true,
        },
        { onConflict: "id" },
      )
      .select("*")

    if (upsertProfileError || !profileRows || profileRows.length === 0) {
      console.error("❌ [register-worker] Failed to upsert worker profile", upsertProfileError)
      const payload: ErrorResponse = {
        success: false,
        error: "העובד נוצר אך לא הצלחנו לשמור את הפרטים בפרופיל. בדוק את הלוגים.",
      }
      return new Response(JSON.stringify(payload), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (body.sendResetPasswordEmail && email) {
      const { error: resetError } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email,
      })

      if (resetError) {
        console.warn("⚠️ [register-worker] Failed to send reset password email", resetError)
      } else {
        console.log("✉️ [register-worker] Sent password reset link to new worker", { email })
      }
    }

    const response: SuccessResponse = {
      ...buildWorkerPayload(workerUser, profileRows[0]),
      createdNewUser: true,
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("❌ [register-worker] Unexpected error", error)
    const payload: ErrorResponse = {
      success: false,
      error: "אירעה שגיאה בלתי צפויה במהלך יצירת העובד. נסה שוב בעוד מספר דקות.",
    }
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})


