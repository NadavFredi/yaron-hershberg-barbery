import { useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearError, clearUser, setError, setLoading, setUser } from "@/store/slices/authSlice"
import { handleInvalidToken, isAuthError } from "@/utils/auth"

let authSubscription: { unsubscribe: () => void } | null = null
let authSubscriberCount = 0

export function useSupabaseAuth() {
  const dispatch = useAppDispatch()
  const authState = useAppSelector((state) => state.auth)

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
          // Check if this is an auth/token error
          // Supabase auth errors (like 403) should trigger logout
          if (isAuthError(error)) {
            handleInvalidToken()
            return
          }

          // For other errors, still log but don't redirect
          dispatch(setError(error.message || "Failed to fetch user"))

          // If error is from auth API (403/401), still logout even if isAuthError didn't catch it
          const errorStatus = (error as Record<string, unknown>)?.status as number | undefined
          if (errorStatus === 401 || errorStatus === 403) {
            handleInvalidToken()
            return
          }
        } else if (data.user) {
          dispatch(setUser(data.user))
        } else {
          // No user found - session expired or invalid
          dispatch(clearUser())

          // If we were expecting a user but didn't get one, it might be expired
          // Only redirect if we're not on auth pages
          if (typeof window !== "undefined") {
            const currentPath = window.location.pathname
            if (
              !currentPath.includes("/login") &&
              !currentPath.includes("/signup") &&
              !currentPath.includes("/reset-password") &&
              currentPath !== "/"
            ) {
              handleInvalidToken()
            }
          }
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
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
          // User signed out or token refresh failed
          dispatch(clearUser())

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
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Valid session - user signed in or token refreshed successfully
          if (session?.user) {
            dispatch(setUser(session.user))
            dispatch(clearError())
          } else {
            // No session after sign in/refresh - logout
            dispatch(clearUser())
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
          }
        } else if (session?.user) {
          // Valid session for other events
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

  return authState
}
