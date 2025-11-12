import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listAllTables, listTableRecords } from "@/integrations/airtable/client"
import { validateEnv } from "@/lib/env"

export function AirtableDemo() {
    const [isLoading, setIsLoading] = useState(false)
    const [tableName, setTableName] = useState("")
    const [logs, setLogs] = useState<string[]>([])

    // Intercept console.log to display in UI
    React.useEffect(() => {
        const originalLog = console.log
        const originalError = console.error
        const originalWarn = console.warn

        console.log = (...args) => {
            originalLog(...args)
            setLogs(prev => [...prev, `[LOG] ${args.join(" ")}`])
        }

        console.error = (...args) => {
            originalError(...args)
            setLogs(prev => [...prev, `[ERROR] ${args.join(" ")}`])
        }

        console.warn = (...args) => {
            originalWarn(...args)
            setLogs(prev => [...prev, `[WARN] ${args.join(" ")}`])
        }

        return () => {
            console.log = originalLog
            console.error = originalError
            console.warn = originalWarn
        }
    }, [])

    const handleListTables = async () => {
        setIsLoading(true)
        setLogs([])

        try {
            // Debug: Log environment variables
            console.log("🔍 Debug: Environment variables:", {
                AIRTABLE_PAT: import.meta.env.VITE_AIRTABLE_PAT ? "***" + import.meta.env.VITE_AIRTABLE_PAT.slice(-4) : "NOT SET",
                AIRTABLE_BASE_ID: import.meta.env.VITE_AIRTABLE_BASE_ID || "NOT SET"
            })

            // Validate environment variables first
            const isValid = validateEnv()
            if (!isValid) {
                console.warn("Environment validation failed. Check your .env file.")
            }

            await listAllTables()
        } catch (error) {
            console.error("Failed to list tables:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleListRecords = async () => {
        if (!tableName.trim()) {
            console.error("Please enter a table name")
            return
        }

        setIsLoading(true)
        setLogs([])

        try {
            await listTableRecords(tableName.trim(), 5) // Limit to 5 records for demo
        } catch (error) {
            console.error("Failed to list records:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const clearLogs = () => {
        setLogs([])
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>🔗 Airtable Integration Demo</CardTitle>
                    <CardDescription>
                        Test your Airtable connection and explore your base structure
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="airtable-pat">Airtable Personal Access Token</Label>
                            <Input
                                id="airtable-pat"
                                type="password"
                                placeholder="pat_..."
                                value={import.meta.env.VITE_AIRTABLE_PAT ? "***" + import.meta.env.VITE_AIRTABLE_PAT.slice(-4) : ""}
                                disabled
                            />
                            <p className="text-sm text-muted-foreground">
                                Set via VITE_AIRTABLE_PAT environment variable
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="airtable-base-id">Airtable Base ID</Label>
                            <Input
                                id="airtable-base-id"
                                placeholder="app..."
                                value={import.meta.env.VITE_AIRTABLE_BASE_ID || ""}
                                disabled
                            />
                            <p className="text-sm text-muted-foreground">
                                Set via VITE_AIRTABLE_BASE_ID environment variable
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={handleListTables}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? "Loading..." : "📊 List All Tables"}
                        </Button>

                        <Button
                            onClick={handleListRecords}
                            disabled={isLoading || !tableName.trim()}
                            variant="outline"
                        >
                            {isLoading ? "Loading..." : "📋 List Table Records"}
                        </Button>

                        <Button
                            onClick={clearLogs}
                            variant="secondary"
                        >
                            🗑️ Clear Logs
                        </Button>

                        <Button
                            onClick={() => {
                                console.log("🔍 Environment Check:", {
                                    AIRTABLE_PAT: import.meta.env.VITE_AIRTABLE_PAT ? "***" + import.meta.env.VITE_AIRTABLE_PAT.slice(-4) : "NOT SET",
                                    AIRTABLE_BASE_ID: import.meta.env.VITE_AIRTABLE_BASE_ID || "NOT SET",
                                    hasEnv: !!import.meta.env.VITE_AIRTABLE_PAT && !!import.meta.env.VITE_AIRTABLE_BASE_ID
                                })
                            }}
                            variant="outline"
                        >
                            🔍 Check Environment
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="table-name">Table Name (for listing records)</Label>
                        <Input
                            id="table-name"
                            placeholder="Enter table name (e.g., לקוחות, פרופילים, תורים למספרה)..."
                            value={tableName}
                            onChange={(e) => setTableName(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                            Try: לקוחות (Clients), פרופילים (Treatments), תורים למספרה (Grooming Appointments)
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>📝 Console Output</CardTitle>
                    <CardDescription>
                        Real-time logs from Airtable API calls
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm h-96 overflow-y-auto">
                        {logs.length === 0 ? (
                            <p className="text-gray-500">No logs yet. Click a button above to start...</p>
                        ) : (
                            logs.map((log, index) => (
                                <div key={index} className="mb-1">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>⚙️ Setup Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <h4 className="font-semibold">1. Environment Variables</h4>
                        <p className="text-sm text-muted-foreground">
                            Create a <code className="bg-gray-100 px-1 rounded">.env</code> file in your project root:
                        </p>
                        <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                            {`VITE_AIRTABLE_PAT=your_personal_access_token_here
VITE_AIRTABLE_BASE_ID=your_base_id_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-semibold">2. Airtable Personal Access Token</h4>
                        <p className="text-sm text-muted-foreground">
                            Generate a Personal Access Token at{" "}
                            <a
                                href="https://airtable.com/create/tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                https://airtable.com/create/tokens
                            </a>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-semibold">3. Base ID</h4>
                        <p className="text-sm text-muted-foreground">
                            Find your Base ID in the URL when viewing your Airtable base:{" "}
                            <code className="bg-gray-100 px-1 rounded">https://airtable.com/appXXXXXXXXXXXXXX</code>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
