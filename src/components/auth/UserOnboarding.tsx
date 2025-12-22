import React, { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, ArrowLeft } from "lucide-react"

interface UserOnboardingProps {
    userEmail: string
    onBackToAuth: () => void
}

export function UserOnboarding({ userEmail, onBackToAuth }: UserOnboardingProps) {
    const navigate = useNavigate()

    useEffect(() => {
        // Load Fillout script
        const script = document.createElement("script")
        script.src = "https://server.fillout.com/embed/v1/"
        script.async = true
        document.body.appendChild(script)

        return () => {
            // Cleanup script when component unmounts
            if (document.body.contains(script)) {
                document.body.removeChild(script)
            }
        }
    }, [])

    const handleFormComplete = () => {
        // This will be called when the Fillout form is completed
        // You can add logic here to redirect or show success message
        console.log("Fillout form completed")
    }

    const handleSkipForm = () => {
        // Allow users to skip the form and go to my-dogs page
        navigate("/my-dogs")
    }

    return (
        <div className="p-4" dir="rtl">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                        <User className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">השלם את הפרופיל שלך</h1>
                    <p className="text-lg text-gray-600">
                        ברוכים הבאים! אנחנו צריכים כמה פרטים נוספים כדי להגדיר את החשבון שלך.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        מחובר כ: <span className="font-semibold">{userEmail}</span>
                    </p>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center mb-6">
                    <Button
                        variant="ghost"
                        onClick={onBackToAuth}
                        className="text-primary hover:text-purple-700"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        חזור לכניסה
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSkipForm}
                        className="text-gray-600 hover:text-gray-700"
                    >
                        דלג לעת עתה
                    </Button>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Side - Info */}
                    <div className="lg:col-span-1">
                        <Card className="h-fit">
                            <CardHeader>
                                <CardTitle className="text-xl text-purple-700">למה אנחנו צריכים את זה</CardTitle>
                                <CardDescription>
                                    עזור לנו לספק לך את השירות הטוב ביותר האפשרי
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start space-x-3">
                                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-bold text-primary">1</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">שירות מותאם אישית</h4>
                                        <p className="text-sm text-gray-600">קבל המלצות בהתבסס על העדפותיך</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-bold text-primary">2</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">ניהול תורים</h4>
                                        <p className="text-sm text-gray-600">עקוב אחר התורים וההיסטוריה שלך</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-bold text-primary">3</span>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">תקשורת טובה יותר</h4>
                                        <p className="text-sm text-gray-600">קבל עדכונים ותזכורות</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Side - Fillout Form */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">המידע שלך</CardTitle>
                                <CardDescription>
                                    אנא מלא את הטופס למטה כדי להשלים את הפרופיל שלך
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    style={{ width: "100%", height: "500px" }}
                                    data-fillout-id="i1rmEvjoTCus"
                                    data-fillout-embed-type="standard"
                                    data-fillout-inherit-parameters
                                    data-fillout-dynamic-resize
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 text-sm text-gray-500">
                    <p>המידע שלך מאובטח וישמש רק לשיפור החוויה שלך</p>
                </div>
            </div>
        </div>
    )
}
