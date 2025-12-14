import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

// Create Supabase client for Edge Functions
let supabase: any = null

try {
  // Check if we're in a browser environment and have the required variables
  if (typeof window !== "undefined") {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
        global: {
          // Intercept fetch requests to handle auth errors globally
          fetch: async (url, options = {}) => {
            const response = await fetch(url, options)

            // Check for 401/403 from auth endpoints
            if (!response.ok && (response.status === 401 || response.status === 403)) {
              const urlString = typeof url === "string" ? url : url.toString()

              // Only handle auth API errors (not data API which might be RLS)
              if (urlString.includes("/auth/v1/")) {
                // Import and call handleInvalidToken (dynamic import to avoid circular deps)
                const { handleInvalidToken } = await import("@/utils/auth")
                handleInvalidToken()

                // Return the error response so the caller can handle it
                return response
              }
            }

            return response
          },
        },
      })
    }
  }
} catch (error) {
  // Supabase client creation failed
}

export { supabase }
