import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Calendar, Sparkles, CheckCircle } from "lucide-react"

interface FirstTimeGardenBannerProps {
    dogName: string
    onSelectTrial: () => void
    onSkipTrial: () => void
    canSkipTrial?: boolean
}

export function FirstTimeGardenBanner({
    dogName,
    onSelectTrial,
    onSkipTrial,
    canSkipTrial = true
}: FirstTimeGardenBannerProps) {
    const [selectedOption, setSelectedOption] = useState<"trial" | "full" | null>("trial")
    const hasInitialized = useRef(false)

    // Automatically select trial option on mount only once
    useEffect(() => {
        if (!hasInitialized.current) {
            onSelectTrial()
            hasInitialized.current = true
        }
    }, [onSelectTrial])

    const handleTrialSelect = () => {
        setSelectedOption("trial")
        onSelectTrial()
    }

    const handleFullSelect = () => {
        setSelectedOption("full")
        onSkipTrial()
    }

    return (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-lg">
            <CardContent className="p-6">
                <div className="flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-amber-600 mr-2" />
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-lg px-4 py-2">
                        ביקור ראשון בגן!
                    </Badge>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center" dir="rtl">
                    זה הפעם הראשונה של {dogName} בגן! 🌟
                </h3>

                <p className="text-base text-gray-700 mb-4 leading-relaxed text-center" dir="rtl">
                    אנו מציעים לך שתי אפשרויות:
                </p>

                <div className="space-y-4 mb-6">
                    {/* Trial Option */}
                    <div
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${selectedOption === "trial"
                            ? "border-green-500 bg-green-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-25"
                            }`}
                        onClick={handleTrialSelect}
                        dir="rtl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedOption === "trial"
                                    ? "border-green-500 bg-green-500"
                                    : "border-gray-300"
                                    }`}>
                                    {selectedOption === "trial" && (
                                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                                    )}
                                </div>
                                <div className="flex items-center space-x-1.5 space-x-reverse">
                                    <Clock className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-semibold text-gray-900">ביקור ניסיון</span>
                                </div>
                            </div>
                            <div className="text-xs text-gray-600">
                                כמה שעות בלבד
                            </div>
                        </div>
                    </div>

                    {/* Full Day Option */}
                    <div
                        className={`p-4 rounded-lg border-2 transition-all duration-200 ${!canSkipTrial
                            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-50"
                            : selectedOption === "full"
                                ? "border-blue-500 bg-blue-50 shadow-md cursor-pointer"
                                : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-25 cursor-pointer"
                            }`}
                        onClick={canSkipTrial ? handleFullSelect : undefined}
                        dir="rtl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!canSkipTrial
                                    ? "border-gray-300 bg-gray-100"
                                    : selectedOption === "full"
                                        ? "border-blue-500 bg-blue-500"
                                        : "border-gray-300"
                                    }`}>
                                    {selectedOption === "full" && (
                                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                                    )}
                                </div>
                                <div className="flex items-center space-x-1.5 space-x-reverse">
                                    <Calendar className={`h-4 w-4 ${!canSkipTrial ? "text-gray-400" : "text-blue-600"}`} />
                                    <span className={`text-sm font-semibold ${!canSkipTrial ? "text-gray-500" : "text-gray-900"}`}>יום מלא</span>
                                </div>
                            </div>
                            <div className={`text-xs ${!canSkipTrial ? "text-gray-400" : "text-gray-600"}`}>
                                {!canSkipTrial ? "לא זמין כרגע" : "יום שלם של טיפוח"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                {selectedOption && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm" dir="rtl">
                        {selectedOption === "trial" ? (
                            <div className="space-y-2">
                                <div className="flex items-start space-x-2 space-x-reverse">
                                    <Clock className="h-3 w-3 text-green-600 mt-1" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-green-800">ביקור ניסיון</h4>
                                        <p className="text-xs text-green-700 mt-0.5">מושלם להכרות ראשונית</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700">
                                    • נמשך כמה שעות בלבד<br />
                                    • היכרות עם הצוות והחברים החדשים<br />
                                    • עוזר לכלב להתרגל לסביבה החדשה<br />
                                    • מושלם לכלבים שמגיעים לראשונה
                                </p>
                            </div>
                        ) : canSkipTrial ? (
                            <div className="space-y-2">
                                <div className="flex items-start space-x-2 space-x-reverse">
                                    <Calendar className="h-3 w-3 text-blue-600 mt-1" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-blue-800">יום מלא</h4>
                                        <p className="text-xs text-blue-700 mt-0.5">טיפוח מקצועי מלא</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700">
                                    • יום שלם בגן עם כל הפעילויות הרגילות<br />
                                    • טיפוח מקצועי מלא<br />
                                    • השתתפות בכל הפעילויות והמשחקים<br />
                                    • חוויה מלאה של יום בגן
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-start space-x-2 space-x-reverse">
                                    <Calendar className="h-3 w-3 text-gray-400 mt-1" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500">יום מלא - לא זמין</h4>
                                        <p className="text-xs text-gray-400 mt-0.5">לא זמין כרגע</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500">
                                    אפשרות זו לא זמינה כרגע עבור הכלב שלכם
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <p className="text-sm text-gray-600 text-right mt-4" dir="rtl">
                    💡 ביקור הניסיון מושלם לכלבים שמגיעים לראשונה - זה עוזר להם להתרגל לסביבה החדשה
                </p>
            </CardContent>
        </Card>
    )
}
