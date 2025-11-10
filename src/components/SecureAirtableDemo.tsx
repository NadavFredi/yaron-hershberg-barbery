import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    listOwnerTreatments,
    checkTreatmentRegistration,
    getTreatmentAppointments,
    getAvailableDates,
    getAvailableTimes,
    type TreatmentRecord,
    type AppointmentRecord,
    type AvailableDate,
    type AvailableTime
} from "@/integrations/supabase/supabaseService"

export function SecureAirtableDemo() {
    const [ownerId, setOwnerId] = useState("recPenfkmmn37ZvTb")
    const [treatmentId, setTreatmentId] = useState("rec1TmuoExAy7pP31")
    // daysAhead is controlled in the backend via calendar_settings (default 30)
    const [date, setDate] = useState("2025-01-20")

    const [treatments, setTreatments] = useState<TreatmentRecord[]>([])
    const [registration, setRegistration] = useState<any>(null)
    const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
    const [availableDates, setAvailableDates] = useState<AvailableDate[]>([])
    const [availableTimes, setAvailableTimes] = useState<AvailableTime[]>([])

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleListTreatments = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await listOwnerTreatments(ownerId)
            setTreatments(result.treatments)
            console.log("✅ Treatments loaded:", result.treatments)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load treatments")
            console.error("❌ Error loading treatments:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCheckRegistration = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await checkTreatmentRegistration(treatmentId)
            setRegistration(result)
            console.log("✅ Registration checked:", result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to check registration")
            console.error("❌ Error checking registration:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGetAppointments = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getTreatmentAppointments(treatmentId)
            setAppointments(result.appointments)
            console.log("✅ Appointments loaded:", result.appointments)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load appointments")
            console.error("❌ Error loading appointments:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGetAvailableDates = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getAvailableDates(treatmentId, "grooming")
            setAvailableDates(result.availableDates)
            console.log("✅ Available dates loaded:", result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load available dates")
            console.error("❌ Error loading available dates:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGetAvailableTimes = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const result = await getAvailableTimes(treatmentId, date)
            setAvailableTimes(result.availableTimes)
            console.log("✅ Available times loaded:", result.availableTimes)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load available times")
            console.error("❌ Error loading available times:", err)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-blue-50">
                <CardHeader className="text-center pb-8">
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-green-100 rounded-full mr-4">
                            <div className="h-8 w-8 text-green-600 text-2xl">🔒</div>
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-bold text-gray-800">
                                Secure Airtable API Demo
                            </CardTitle>
                            <CardDescription className="text-lg text-gray-600 mt-2">
                                Testing secure API calls through Supabase Edge Functions
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Input Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="owner-id">Owner ID</Label>
                            <Input
                                id="owner-id"
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                placeholder="Owner ID"
                            />
                        </div>
                        <div>
                            <Label htmlFor="treatment-id">Treatment ID</Label>
                            <Input
                                id="treatment-id"
                                value={treatmentId}
                                onChange={(e) => setTreatmentId(e.target.value)}
                                placeholder="Treatment ID"
                            />
                        </div>
                        <div>
                            <Label htmlFor="info">Days Ahead</Label>
                            <Input
                                id="info"
                                value="Managed in backend settings (default 30 days)"
                                disabled
                                className="bg-gray-100"
                            />
                        </div>
                        <div>
                            <Label htmlFor="date">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <Button
                            onClick={handleListTreatments}
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? "Loading..." : "🐕 List Treatments"}
                        </Button>

                        <Button
                            onClick={handleCheckRegistration}
                            disabled={isLoading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? "Loading..." : "✅ Check Registration"}
                        </Button>

                        <Button
                            onClick={handleGetAppointments}
                            disabled={isLoading}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {isLoading ? "Loading..." : "📅 Get Appointments"}
                        </Button>

                        <Button
                            onClick={handleGetAvailableDates}
                            disabled={isLoading}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            {isLoading ? "Loading..." : "📆 Available Dates"}
                        </Button>

                        <Button
                            onClick={handleGetAvailableTimes}
                            disabled={isLoading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isLoading ? "Loading..." : "🕐 Available Times"}
                        </Button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Card className="bg-red-50 border-red-200">
                            <CardContent className="p-4">
                                <div className="text-red-600">❌ Error: {error}</div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Results Display */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Treatments List */}
                        {treatments.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>🐕 Owner's Treatments ({treatments.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {treatments.map((treatment) => (
                                            <div key={treatment.id} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="font-semibold">{treatment.name}</div>
                                                <div className="text-sm text-gray-600">
                                                    TreatmentType: {treatment.treatmentType} | Size: {treatment.size} | Small: {treatment.isSmall ? "Yes" : "No"}
                                                </div>
                                                <div className="text-xs text-gray-500">ID: {treatment.id}</div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Registration Status */}
                        {registration && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>✅ Registration Status</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <div className="font-semibold">
                                            Treatment ID: {registration.treatmentId}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Registered: {registration.isRegistered ? "Yes" : "No"}
                                        </div>
                                        {registration.registrationDate && (
                                            <div className="text-sm text-gray-600">
                                                Date: {registration.registrationDate}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Appointments */}
                        {appointments.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>📅 Appointments ({appointments.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {appointments.map((apt) => (
                                            <div key={apt.id} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="font-semibold">{apt.service}</div>
                                                <div className="text-sm text-gray-600">
                                                    Date: {apt.date} | Time: {apt.time}
                                                </div>
                                                <Badge className={`ml-2 ${apt.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {apt.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Available Dates */}
                        {availableDates.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>📆 Available Dates ({availableDates.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {availableDates.slice(0, 10).map((date, index) => (
                                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="font-semibold">{date.date}</div>
                                                <div className="text-sm text-gray-600">
                                                    Available: {date.available ? "Yes" : "No"} | Slots: {date.slots}
                                                </div>
                                            </div>
                                        ))}
                                        {availableDates.length > 10 && (
                                            <div className="text-sm text-gray-500 text-center">
                                                ... and {availableDates.length - 10} more dates
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Available Times */}
                        {availableTimes.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>🕐 Available Times ({availableTimes.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {availableTimes.map((time, index) => (
                                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="font-semibold">{time.time}</div>
                                                <div className="text-sm text-gray-600">
                                                    Available: {time.available ? "Yes" : "No"} | Duration: {time.duration}min
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Instructions */}
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-blue-800 mb-2">🔒 Security Benefits:</h3>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• Airtable tokens are stored securely on Supabase backend</li>
                                <li>• Frontend never sees or stores sensitive API keys</li>
                                <li>• All API calls go through authenticated Supabase functions</li>
                                <li>• Rate limiting and access control can be implemented</li>
                                <li>• Audit logs of all API calls</li>
                            </ul>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    )
}
