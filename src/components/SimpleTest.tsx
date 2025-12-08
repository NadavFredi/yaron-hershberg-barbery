import React from "react"

export function SimpleTest() {
    // Try to access environment variables directly
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    return (
        <div className="p-4">
            <h1>Environment Test</h1>
            <div className="space-y-2">
                <p><strong>VITE_SUPABASE_URL:</strong> {supabaseUrl ? supabaseUrl : "NOT SET"}</p>
                <p><strong>VITE_SUPABASE_ANON_KEY:</strong> {supabaseKey ? "***" + supabaseKey.slice(-4) : "NOT SET"}</p>
                <p><strong>Has Environment:</strong> {!!supabaseUrl && !!supabaseKey ? "YES" : "NO"}</p>
            </div>

            <button
                onClick={() => {
                    console.log("Direct environment check:", {
                        VITE_SUPABASE_URL: supabaseUrl || "NOT SET",
                        VITE_SUPABASE_ANON_KEY: supabaseKey ? "***" + supabaseKey.slice(-4) : "NOT SET",
                        hasEnv: !!supabaseUrl && !!supabaseKey
                    })
                }}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
                Check Console
            </button>
        </div>
    )
}
