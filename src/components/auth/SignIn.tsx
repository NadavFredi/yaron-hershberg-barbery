import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { checkUserExists } from "@/integrations/supabase/supabaseService"

interface SignInProps {
    onSwitchToSignUp: () => void
    onSwitchToResetPassword: () => void
    onUserOnboarding: (email: string) => void
}

export function SignIn({
    onSwitchToSignUp: _onSwitchToSignUp,
    onSwitchToResetPassword: _onSwitchToResetPassword,
    onUserOnboarding,
}: SignInProps) {
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        try {
            const trimmedEmail = email.trim()

            const { data, error } = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password,
            })

            if (error) {
                throw error
            }

            setSuccess("התחברת בהצלחה! בודק את הפרופיל שלך...")
            console.log("User signed in:", data.user)
            const identifier = data.user?.email || trimmedEmail

            // Check if user exists in Airtable
            try {
                if (identifier) {
                    const userCheck = await checkUserExists(identifier)

                    if (!userCheck.exists) {
                        onUserOnboarding(identifier)
                    }
                } else {
                    onUserOnboarding(trimmedEmail)
                }
            } catch (userCheckError) {
                console.error("Error checking user existence:", userCheckError)
                onUserOnboarding(identifier)
            }

            setTimeout(() => {
                navigate("/appointments")
            }, 1200)
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה בהתחברות")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-lg border border-gray-200">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">ברוכים הבאים</CardTitle>
                    <CardDescription className="text-gray-600">
                        התחבר לחשבון שלך כדי להמשיך
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <form onSubmit={handleSignIn} className="space-y-4">
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

                        <div className="space-y-2">
                            <Label htmlFor="password">סיסמה</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="הכנס את הסיסמה שלך"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Link
                                to="/reset-password"
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                שכחת סיסמה?
                            </Link>
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
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    מתחבר...
                                </>
                            ) : (
                                "התחבר"
                            )}
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-gray-500">או</span>
                        </div>
                    </div>

                    <div className="text-center">
                        <span className="text-sm text-gray-600">אין לך חשבון? </span>
                        <Link
                            to="/signup"
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            הרשמה
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
