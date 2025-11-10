import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, ArrowLeft } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

interface ResetPasswordProps {
    onBackToSignIn: () => void
}

export function ResetPassword({ onBackToSignIn }: ResetPasswordProps) {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password-confirm`,
            })

            if (error) {
                throw error
            }

            setSuccess("אימייל איפוס סיסמה נשלח! אנא בדוק את האימייל שלך להוראות נוספות.")
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה בשליחת אימייל האיפוס")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-lg border border-gray-200">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                        <Mail className="w-6 h-6 text-orange-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">איפוס סיסמה</CardTitle>
                    <CardDescription className="text-gray-600">
                        הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">אימייל</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="הכנס את האימייל שלך"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert>
                                <AlertDescription>{success}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-orange-600 hover:bg-orange-700"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    שולח אימייל איפוס...
                                </>
                            ) : (
                                "שלח אימייל איפוס"
                            )}
                        </Button>
                    </form>

                    <div className="text-center">
                        <Link
                            to="/login"
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center justify-center"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            חזור לכניסה
                        </Link>
                    </div>

                    <div className="text-center text-sm text-gray-500">
                        <p>זוכר את הסיסמה שלך?</p>
                        <Link
                            to="/login"
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                            התחבר במקום
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
