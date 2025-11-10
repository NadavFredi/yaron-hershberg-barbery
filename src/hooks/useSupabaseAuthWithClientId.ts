import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearError, clearUser, setError, setLoading, setUser } from "@/store/slices/authSlice"
import { normalizePhone } from "@/utils/phone"

let authSubscription: { unsubscribe: () => void } | null = null
let authSubscriberCount = 0

type SupabaseUser = NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]>

async function ensureCustomerRecord(user: SupabaseUser) {
  const metadataPhoneDigits =
    typeof user.user_metadata?.phone_number_digits === "string" &&
    user.user_metadata.phone_number_digits.trim().length > 0
      ? user.user_metadata.phone_number_digits.replace(/\D/g, "")
      : null

  const metadataPhone =
    typeof user.user_metadata?.phone_number === "string" && user.user_metadata.phone_number.trim().length > 0
      ? user.user_metadata.phone_number
      : null

  const authPhone = typeof user.phone === "string" && user.phone.trim().length > 0 ? user.phone : null

  const digitsOnly =
    metadataPhoneDigits ??
    (metadataPhone ? metadataPhone.replace(/\D/g, "") : null) ??
    (authPhone ? authPhone.replace(/\D/g, "") : null) ??
    ""

  const normalizedPhoneForSearch =
    normalizePhone(metadataPhone) ?? normalizePhone(digitsOnly) ?? normalizePhone(authPhone) ?? `user-${user.id}`

  const phoneForStorage =
    digitsOnly.length > 0
      ? digitsOnly
      : typeof normalizedPhoneForSearch === "string"
      ? normalizedPhoneForSearch
      : `user-${user.id}`

  console.log("📞 [ensureCustomerRecord] Phone derivation:", {
    metadataPhoneDigits,
    metadataPhone,
    authPhone,
    digitsOnly,
    normalizedPhoneForSearch,
    phoneForStorage,
  })

  const payload = {
    auth_user_id: user.id,
    full_name:
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
        ? user.user_metadata.full_name
        : null) ??
      user.email ??
      "לקוח ללא שם",
    phone: phoneForStorage,
    email: user.email,
    phone_search: normalizedPhoneForSearch,
  }

  const { data, error } = await supabase.from("customers").insert(payload).select("id").single()

  if (error) {
    throw error
  }

  const newClientId = data.id

  const { error: profileError } = await supabase.from("profiles").update({ client_id: newClientId }).eq("id", user.id)

  if (profileError) {
    console.warn("Failed to update profiles.client_id after customer creation:", profileError)
  }

  return newClientId
}

async function resolveClientIdForUser(user: SupabaseUser) {
  console.log("🔍 [resolveClientIdForUser] Starting resolution for user:", user.id)

  const metadataClientId =
    typeof user.user_metadata?.client_id === "string" && user.user_metadata.client_id.trim().length > 0
      ? user.user_metadata.client_id
      : null

  if (metadataClientId) {
    console.log("✅ [resolveClientIdForUser] Found clientId in user_metadata:", metadataClientId)
    return metadataClientId
  }

  console.log("🔍 [resolveClientIdForUser] Checking customers table for auth_user_id:", user.id)
  const { data: customerRow, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (customerError) {
    console.error("❌ [resolveClientIdForUser] Error querying customers:", customerError)
    throw customerError
  }

  if (customerRow?.id) {
    console.log("✅ [resolveClientIdForUser] Found customer record:", customerRow.id)
    return customerRow.id
  }

  console.log("🔍 [resolveClientIdForUser] Checking profiles table for client_id")
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    console.warn("⚠️ [resolveClientIdForUser] Failed to read profiles.client_id:", profileError)
  } else if (profileRow?.client_id) {
    console.log("✅ [resolveClientIdForUser] Found clientId in profiles:", profileRow.client_id)
    return profileRow.client_id
  }

  console.log("🔍 [resolveClientIdForUser] No existing customer found, creating new one")
  const newClientId = await ensureCustomerRecord(user)
  console.log("✅ [resolveClientIdForUser] Created new customer record:", newClientId)
  return newClientId
}

export function useSupabaseAuthWithClientId() {
  const dispatch = useAppDispatch()
  const authState = useAppSelector((state) => state.auth)
  const [isFetchingClientId, setIsFetchingClientId] = useState(false)
  const [clientIdError, setClientIdError] = useState<Error | null>(null)
  const [hasAttemptedClientIdResolution, setHasAttemptedClientIdResolution] = useState(false)
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(() => {
    const initial =
      typeof authState.user?.user_metadata?.client_id === "string" ? authState.user.user_metadata.client_id.trim() : ""
    return initial.length > 0 ? initial : null
  })

  useEffect(() => {
    // Reset resolution state when user changes
    setHasAttemptedClientIdResolution(false)
    setClientIdError(null)
    setIsFetchingClientId(false)
    const newClientId =
      typeof authState.user?.user_metadata?.client_id === "string" ? authState.user.user_metadata.client_id.trim() : ""
    setResolvedClientId(newClientId.length > 0 ? newClientId : null)
  }, [authState.user?.id, authState.user?.user_metadata?.client_id])

  useEffect(() => {
    let isMounted = true

    if (!authState.hasInitialized && !authState.isLoading) {
      const initializeUser = async () => {
        dispatch(setLoading(true))
        const { data, error } = await supabase.auth.getUser()

        if (!isMounted) {
          return
        }

        if (error) {
          // Import auth utilities
          const { isAuthError, handleInvalidToken } = await import("@/utils/auth")

          // Check if this is an auth/token error (like 403 from auth API)
          if (
            isAuthError(error) ||
            (error as Record<string, unknown>)?.status === 401 ||
            (error as Record<string, unknown>)?.status === 403
          ) {
            console.log("🔒 [useSupabaseAuthWithClientId] Auth error on getUser, logging out...", error)
            handleInvalidToken()
            return
          }

          console.error("❌ [useSupabaseAuthWithClientId] Error fetching user:", error)
          dispatch(setError(error.message || "Failed to fetch user"))
        } else if (data.user) {
          dispatch(setUser(data.user))
        } else {
          dispatch(clearUser())
        }
      }

      initializeUser()
    }

    return () => {
      isMounted = false
    }
  }, [dispatch, authState.hasInitialized, authState.isLoading])

  useEffect(() => {
    authSubscriberCount += 1

    if (!authSubscription) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(
          "🔄 [useSupabaseAuthWithClientId] Auth state changed:",
          event,
          session ? "has session" : "no session"
        )

        if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
          // User signed out or token refresh failed
          dispatch(clearUser())

          // Import and handle invalid token
          const { handleInvalidToken } = await import("@/utils/auth")

          // Redirect to login if not already there
          if (typeof window !== "undefined") {
            const currentPath = window.location.pathname
            if (
              !currentPath.includes("/login") &&
              !currentPath.includes("/signup") &&
              !currentPath.includes("/reset-password")
            ) {
              handleInvalidToken()
            }
          }
        } else if (session?.user) {
          // Valid session
          dispatch(setUser(session.user))
          dispatch(clearError())
        } else {
          // No session - logout
          dispatch(clearUser())
        }
      })

      authSubscription = listener.subscription
    }

    return () => {
      authSubscriberCount = Math.max(0, authSubscriberCount - 1)

      if (authSubscriberCount === 0 && authSubscription) {
        authSubscription.unsubscribe()
        authSubscription = null
      }
    }
  }, [dispatch])

  useEffect(() => {
    console.log("🔍 [useSupabaseAuthWithClientId] Effect triggered:", {
      hasUser: !!authState.user,
      resolvedClientId,
      isFetchingClientId,
      hasAttemptedClientIdResolution,
      userId: authState.user?.id,
    })

    // Only run if we have a user and haven't resolved yet and haven't attempted
    if (!authState.user || resolvedClientId || isFetchingClientId || hasAttemptedClientIdResolution) {
      console.log("⏭️ [useSupabaseAuthWithClientId] Skipping resolution:", {
        reason: !authState.user
          ? "no user"
          : resolvedClientId
          ? "already resolved"
          : isFetchingClientId
          ? "already fetching"
          : "already attempted",
      })
      return
    }

    let cancelled = false

    const ensureClientId = async () => {
      console.log("🚀 [useSupabaseAuthWithClientId] Starting clientId resolution")
      setIsFetchingClientId(true)
      setClientIdError(null)
      setHasAttemptedClientIdResolution(true) // Set immediately to prevent re-runs

      try {
        const customerId = await resolveClientIdForUser(authState.user)

        if (cancelled) {
          console.log("⚠️ [useSupabaseAuthWithClientId] Resolution cancelled")
          return
        }

        if (!customerId) {
          console.error("❌ [useSupabaseAuthWithClientId] No customerId returned")
          throw new Error("Failed to resolve customer ID")
        }

        console.log("✅ [useSupabaseAuthWithClientId] Resolved customerId:", customerId)
        setResolvedClientId(customerId)

        if (authState.user.user_metadata?.client_id !== customerId) {
          console.log("🔍 [useSupabaseAuthWithClientId] Updating user metadata with client_id")
          const { error: updateError } = await supabase.auth.updateUser({
            data: { client_id: customerId },
          })

          if (updateError) {
            console.warn("⚠️ [useSupabaseAuthWithClientId] Failed to persist client_id to auth metadata:", updateError)
          } else {
            console.log("✅ [useSupabaseAuthWithClientId] Refreshing user")
            const {
              data: { user: refreshedUser },
            } = await supabase.auth.getUser()

            if (!cancelled && refreshedUser) {
              console.log("✅ [useSupabaseAuthWithClientId] User refreshed with new metadata")
              dispatch(setUser(refreshedUser))
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          const normalizedError = error instanceof Error ? error : new Error(String(error))
          setClientIdError(normalizedError)
          console.error("❌ [useSupabaseAuthWithClientId] Failed to resolve client_id for user:", normalizedError)
        }
      } finally {
        if (!cancelled) {
          console.log("✅ [useSupabaseAuthWithClientId] Resolution completed")
          setIsFetchingClientId(false)
        }
      }
    }

    ensureClientId()

    return () => {
      cancelled = true
    }
  }, [authState.user?.id, dispatch]) // Only depend on user ID, not the whole user object or state flags

  return {
    ...authState,
    clientId: resolvedClientId,
    isFetchingClientId:
      isFetchingClientId || (!resolvedClientId && !hasAttemptedClientIdResolution && authState.user != null),
    clientIdError,
  }
}
