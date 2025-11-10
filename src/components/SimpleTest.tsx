import React from "react"

export function SimpleTest() {
    // Try to access environment variables directly
    const airtablePat = import.meta.env.VITE_AIRTABLE_PAT
    const airtableBaseId = import.meta.env.VITE_AIRTABLE_BASE_ID

    return (
        <div className="p-4">
            <h1>Environment Test</h1>
            <div className="space-y-2">
                <p><strong>VITE_AIRTABLE_PAT:</strong> {airtablePat ? "***" + airtablePat.slice(-4) : "NOT SET"}</p>
                <p><strong>VITE_AIRTABLE_BASE_ID:</strong> {airtableBaseId || "NOT SET"}</p>
                <p><strong>Has Environment:</strong> {!!airtablePat && !!airtableBaseId ? "YES" : "NO"}</p>
            </div>

            <button
                onClick={() => {
                    console.log("Direct environment check:", {
                        VITE_AIRTABLE_PAT: airtablePat ? "***" + airtablePat.slice(-4) : "NOT SET",
                        VITE_AIRTABLE_BASE_ID: airtableBaseId || "NOT SET",
                        hasEnv: !!airtablePat && !!airtableBaseId
                    })
                }}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
                Check Console
            </button>
        </div>
    )
}
