import { supabase } from "@/integrations/supabase/client"

// Guard to prevent multiple simultaneous redirects
let isRedirecting = false

/**
 * Logs out the user and redirects to login page
 * Called when token is invalid or expired
 * NON-BLOCKING: Doesn't await signOut to prevent page from freezing
 */
export function handleInvalidToken(): void {
  // Prevent multiple simultaneous calls
  if (isRedirecting) {
    console.log("🔒 [auth] Redirect already in progress, skipping...")
    return
  }

  console.log("🔒 [auth] Token invalid or expired, logging out user...")
  isRedirecting = true

  // Redirect immediately without waiting for signOut to complete
  // This prevents the page from freezing
  if (typeof window !== "undefined") {
    const currentPath = window.location.pathname
    const loginPath = "/login"

    // Only redirect if not already on login/signup pages
    if (
      !currentPath.includes("/login") &&
      !currentPath.includes("/signup") &&
      !currentPath.includes("/reset-password")
    ) {
      // Do signOut in background (non-blocking) and redirect immediately
      supabase.auth.signOut().catch((error) => {
        console.error("❌ [auth] Error during logout (non-blocking):", error)
      })

      // Redirect immediately - don't wait for signOut
      window.location.href = loginPath
    } else {
      // Already on auth page, just sign out in background
      supabase.auth.signOut().catch((error) => {
        console.error("❌ [auth] Error during logout (non-blocking):", error)
      })
      // Reset flag after a short delay since we're not redirecting
      setTimeout(() => {
        isRedirecting = false
      }, 1000)
    }
  } else {
    // Not in browser context, just sign out
    supabase.auth.signOut().catch((error) => {
      console.error("❌ [auth] Error during logout (non-blocking):", error)
    })
    // Reset flag after a short delay
    setTimeout(() => {
      isRedirecting = false
    }, 1000)
  }
}

/**
 * Checks if an error indicates an invalid/expired token
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false

  // Check if error is an object
  const errorObj = error as Record<string, unknown>

  // Check for HTTP status codes (including from Supabase Auth API)
  if (errorObj.status === 401 || errorObj.status === 403) {
    return true
  }

  // Supabase Auth errors can have statusCode instead of status
  if (errorObj.statusCode === 401 || errorObj.statusCode === 403) {
    return true
  }

  // Check for Supabase error codes
  // PGRST301 = missing or invalid JWT (from PostgREST/Data API)
  const supabaseErrorCode = errorObj.code as string | undefined
  if (supabaseErrorCode) {
    const code = supabaseErrorCode.toLowerCase()
    if (code === "pgrst301" || code.includes("jwt") || code.includes("token")) {
      return true
    }
  }

  // Check error message/name
  const errorMessage = (errorObj.message as string) || (errorObj.name as string) || String(error)
  const errorString = errorMessage.toLowerCase()

  // Common auth error patterns
  const authErrorPatterns = [
    "unauthorized",
    "forbidden",
    "invalid token",
    "expired token",
    "token expired",
    "jwt expired",
    "jwt malformed",
    "invalid jwt",
    "session expired",
    "session not found",
    "invalid session",
    "authentication failed",
    "auth token",
    "row-level security",
    "new row violates row-level security",
    // Supabase Auth API specific errors
    "invalid_token",
    "token_not_found",
    "jwt_secret_mismatch",
  ]

  return authErrorPatterns.some((pattern) => errorString.includes(pattern))
}
