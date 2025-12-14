// Environment configuration
// Import dotenv only in Node.js environment
if (typeof process !== "undefined" && process.env && typeof window === "undefined") {
  import("dotenv/config")
}

function getEnvVar(key: string): string {
  // Try Vite environment first (browser)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] || ""
  }

  // Fallback to Node.js process.env
  if (typeof process !== "undefined" && process.env) {
    return process.env[key] || ""
  }

  return ""
}

export const env = {
  SUPABASE_URL: getEnvVar("VITE_SUPABASE_URL"),
  SUPABASE_ANON_KEY: getEnvVar("VITE_SUPABASE_ANON_KEY"),
}

// Validate required environment variables
export function validateEnv() {
  const requiredVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY"]

  const missing = requiredVars.filter((varName) => !env[varName as keyof typeof env])

  if (missing.length > 0) {
    console.warn("⚠️ Missing environment variables:", missing)
    console.warn("Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set")
  }

  return missing.length === 0
}
