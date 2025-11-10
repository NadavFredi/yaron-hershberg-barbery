import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, User, Calendar, MapPin } from "lucide-react"
import { listOwnerTreatments } from "@/integrations/supabase/supabaseService"

interface TreatmentTypeRecord {
    id: string
    name: string
    treatmentType: string
    size: string
    isSmall: boolean
    treatmentIds: string[]
    stations: string[]
    fields: Record<string, any>
}

export function OwnerTreatmentsList() {
    const [treatmentTypes, setTreatmentTypes] = useState<TreatmentTypeRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Hardcoded owner ID for now
    const OWNER_ID = "recPenfkmmn37ZvTb"

    useEffect(() => {
        loadTreatmentTypes()
    }, [])

    const loadTreatmentTypes = async () => {
        setIsLoading(true)
        setError(null)

        try {
            // Use our secure service instead of direct Airtable calls
            const result = await listOwnerTreatments(OWNER_ID)

            // For now, we'll use mock data since the current service returns treatments, not treatmentTypes
            // Later we can create a separate service for treatmentTypes
            const mockTreatmentTypes: TreatmentTypeRecord[] = [
                {
                    id: "rec1TmuoExAy7pP31",
                    name: "פינצ'ר",
                    treatmentType: "פינצ'ר",
                    size: "קטן",
                    isSmall: true,
                    treatmentIds: ["recjO2wNtLIEiQlCR"],
                    stations: [],
                    fields: {}
                },
                {
                    id: "recLOQ10CCaLMTbQ5",
                    name: "פודל",
                    treatmentType: "פודל",
                    size: "קטן",
                    isSmall: true,
                    treatmentIds: ["recaj0vlpgrjNuM36"],
                    stations: ["recyRvjUDZZ54dNUr", "recRVP4v948gubwMr"],
                    fields: {}
                },
                {
                    id: "recYSrkKx4D1Wpvl7",
                    name: "מלטז",
                    treatmentType: "מלטז",
                    size: "גדול",
                    isSmall: false,
                    treatmentIds: ["rec1mp8vFujNZVa8q"],
                    stations: ["recXSKjtjwYJP3mWN"],
                    fields: {}
                }
            ]

            console.log("📊 Loaded treatmentTypes from secure service")
            setTreatmentTypes(mockTreatmentTypes)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load treatmentTypes")
            console.error("Error loading treatmentTypes:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const getSizeColor = (size: string) => {
        switch (size.toLowerCase()) {
            case "קטן": case "small": return "bg-green-100 text-green-800 border-green-200"
            case "בינוני": case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200"
            case "גדול": case "large": return "bg-red-100 text-red-800 border-red-200"
            default: return "bg-gray-100 text-gray-800 border-gray-200"
        }
    }

    const handleTreatmentTypeSelect = (treatmentType: TreatmentTypeRecord) => {
        console.log("Selected treatmentType:", treatmentType)
        // Here you can navigate to appointment booking or show more details
    }

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardHeader className="text-center pb-8">
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-3 bg-blue-100 rounded-full mr-4">
                            <Sparkles className="h-8 w-8 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-bold text-gray-800">
                                גזעי כלבים
                            </CardTitle>
                            <CardDescription className="text-lg text-gray-600 mt-2">
                                Treatment TreatmentTypes - Choose a treatmentType for grooming appointment
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* TreatmentTypes Summary */}
                    {treatmentTypes.length > 0 && (
                        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                            <CardContent className="p-6">
                                <div className="flex items-center mb-4">
                                    <Sparkles className="h-6 w-6 text-purple-600 mr-3" />
                                    <h3 className="text-xl font-semibold text-gray-800">סיכום גזעים (TreatmentTypes Summary)</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600">{treatmentTypes.length}</div>
                                        <div className="text-sm text-purple-800">סה"כ גזעים (Total TreatmentTypes)</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">
                                            {treatmentTypes.filter(b => b.isSmall).length}
                                        </div>
                                        <div className="text-sm text-green-800">כלבים קטנים (Small Treatments)</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {treatmentTypes.filter(b => !b.isSmall).length}
                                        </div>
                                        <div className="text-sm text-blue-800">כלבים גדולים (Large Treatments)</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* TreatmentTypes List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-center space-x-4 mb-6">
                            <h3 className="text-xl font-semibold text-gray-800">
                                בחר גזע לקביעת תור (Choose a treatmentType for appointment)
                            </h3>
                            <Button
                                onClick={loadTreatmentTypes}
                                variant="outline"
                                size="sm"
                            >
                                🔄 Refresh
                            </Button>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                <div className="text-gray-600">טוען גזעים... (Loading treatmentTypes...)</div>
                            </div>
                        ) : error ? (
                            <Card className="bg-red-50 border-red-200">
                                <CardContent className="p-6 text-center">
                                    <div className="text-red-600 mb-4">{error}</div>
                                    <Button onClick={loadTreatmentTypes} variant="outline">
                                        נסה שוב (Try Again)
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : treatmentTypes.length === 0 ? (
                            <Card className="bg-yellow-50 border-yellow-200">
                                <CardContent className="p-6 text-center">
                                    <Sparkles className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">לא נמצאו גזעים (No treatmentTypes found)</h3>
                                    <p className="text-gray-600">לא נמצאו גזעים בטבלה זו (No treatmentTypes found in this table)</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {treatmentTypes.map((treatmentType) => (
                                    <Card
                                        key={treatmentType.id}
                                        className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-300"
                                        onClick={() => handleTreatmentTypeSelect(treatmentType)}
                                    >
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center space-x-3">
                                                    <Sparkles className="h-8 w-8 text-blue-500" />
                                                    <div>
                                                        <h4 className="text-xl font-bold text-gray-900">{treatmentType.name}</h4>
                                                        <Badge className={getSizeColor(treatmentType.size)}>
                                                            {treatmentType.size}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center space-x-3">
                                                    <Sparkles className="h-4 w-4 text-gray-500" />
                                                    <div>
                                                        <div className="text-sm text-gray-600">גזע (TreatmentType)</div>
                                                        <div className="font-semibold text-gray-900">{treatmentType.treatmentType}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-3">
                                                    <Calendar className="h-4 w-4 text-gray-500" />
                                                    <div>
                                                        <div className="text-sm text-gray-600">כלבים (Treatments)</div>
                                                        <div className="font-semibold text-gray-900">{treatmentType.treatmentIds.length}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-3">
                                                    <MapPin className="h-4 w-4 text-gray-500" />
                                                    <div>
                                                        <div className="text-sm text-gray-600">עמדות (Stations)</div>
                                                        <div className="font-semibold text-gray-900">{treatmentType.stations.length}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleTreatmentTypeSelect(treatmentType)
                                                }}
                                            >
                                                בחר גזע זה (Select This TreatmentType)
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    {treatmentTypes.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{treatmentTypes.length}</div>
                                <div className="text-sm text-blue-800">סה"כ גזעים (Total TreatmentTypes)</div>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">
                                    {treatmentTypes.filter(b => b.isSmall).length}
                                </div>
                                <div className="text-sm text-green-800">כלבים קטנים (Small Treatments)</div>
                            </div>
                            <div className="text-center p-4 bg-pink-50 rounded-lg">
                                <div className="text-2xl font-bold text-pink-600">
                                    {treatmentTypes.filter(b => !b.isSmall).length}
                                </div>
                                <div className="text-sm text-pink-800">כלבים גדולים (Large Treatments)</div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
