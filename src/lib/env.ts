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
  AIRTABLE_PAT: getEnvVar("VITE_AIRTABLE_PAT"),
  AIRTABLE_BASE_ID: getEnvVar("VITE_AIRTABLE_BASE_ID"),
  SUPABASE_URL: getEnvVar("VITE_SUPABASE_URL"),
  SUPABASE_ANON_KEY: getEnvVar("VITE_SUPABASE_ANON_KEY"),
}

// Validate required environment variables
export function validateEnv() {
  // Only require Airtable variables for now
  const requiredVars = ["AIRTABLE_PAT", "AIRTABLE_BASE_ID"]

  const missing = requiredVars.filter((varName) => !env[varName as keyof typeof env])

  if (missing.length > 0) {
    console.warn("⚠️ Missing environment variables:", missing)
    console.warn("Please check your .env file and ensure VITE_AIRTABLE_PAT and VITE_AIRTABLE_BASE_ID are set")
  }

  return missing.length === 0
}
