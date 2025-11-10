import React, { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Mail, Lock, Phone, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toE164 } from "@/utils/phone"

interface SignUpProps {
    onSwitchToSignIn: () => void
}

export function SignUp({ onSwitchToSignIn }: SignUpProps) {
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    // Debug: Log initial state
    console.log('SignUp component initialized with states:', {
        email,
        fullName,
        phoneNumber,
        password
    })

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        // Validate passwords match
        if (password !== confirmPassword) {
            setError("הסיסמאות אינן תואמות")
            setIsLoading(false)
            return
        }

        // Validate password strength
        if (password.length < 6) {
            setError("הסיסמה חייבת להיות לפחות 6 תווים")
            setIsLoading(false)
            return
        }

        // Validate phone number format
        if (!phoneNumber || phoneNumber.trim() === "") {
            setError("מספר הטלפון הוא שדה חובה")
            setIsLoading(false)
            return
        }

        // Ensure only digits are used and validate allowed length
        const digitsOnlyPhone = phoneNumber.replace(/\D/g, '')
        if (digitsOnlyPhone.length < 9 || digitsOnlyPhone.length > 15) {
            setError("מספר הטלפון חייב להכיל בין 9 ל-15 ספרות (ספרות בלבד)")
            setIsLoading(false)
            return
        }

        const phoneE164 = toE164(digitsOnlyPhone)

        if (!phoneE164) {
            setError("אנא הזן מספר טלפון תקין בפורמט ישראלי או בינלאומי")
            setIsLoading(false)
            return
        }

        // Debug: Log all form state before validation
        console.log('=== FORM SUBMISSION DEBUG ===')
        console.log('Email state:', email)
        console.log('Full name state:', fullName)
        console.log('Phone number state (digits only):', digitsOnlyPhone)
        console.log('Password state:', password)
        console.log('Confirm password state:', confirmPassword)
        console.log('=============================')

        try {
            // Debug logging
            const trimmedEmail = email.trim()
            console.log('Form data being submitted:', {
                email: trimmedEmail,
                fullName,
                phoneNumberDigits: digitsOnlyPhone,
                phoneNumberE164: phoneE164,
                password
            })

            // Call the signup edge function using Supabase client
            const { data: result, error } = await supabase.functions.invoke('signup', {
                body: {
                    email: trimmedEmail || null,
                    password,
                    full_name: fullName,
                    phone_number: digitsOnlyPhone,
                }
            })

            if (error) {
                throw new Error(error.message || 'שגיאה ביצירת החשבון')
            }

            if (result && result.success) {
                setSuccess("החשבון נוצר בהצלחה! מעבירים אותך לתורים שלך כעת.")
                console.log("User signed up:", result.user)
                console.log("Signup response payload:", result)

                // Sign in the user automatically
                const identifierLog = trimmedEmail || phoneE164
                console.log("Attempting automatic sign-in with identifier:", identifierLog)

                const { error: signInError } = trimmedEmail
                    ? await supabase.auth.signInWithPassword({
                        email: trimmedEmail,
                        password,
                    })
                    : await supabase.auth.signInWithPassword({
                        phone: phoneE164,
                        password,
                    })

                if (signInError) {
                    console.error('Auto sign-in failed:', signInError)
                    // Redirect to login page if auto sign-in fails
                    setTimeout(() => {
                        navigate("/login")
                    }, 2000)
                } else {
                    // Redirect to appointments page after successful sign up and sign in
                    setTimeout(() => {
                        navigate("/appointments")
                    }, 2000)
                }
            } else {
                throw new Error('שגיאה ביצירת החשבון')
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה ביצירת החשבון")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-lg border border-gray-200">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <User className="w-6 h-6 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">צור חשבון</CardTitle>
                    <CardDescription className="text-gray-600">
                        הירשם כדי להתחיל עם מערכת הזימון תורים שלך
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">שם מלא</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="הכנס את השם המלא שלך"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

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
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                שדה אופציונלי - ניתן להרשם ללא אימייל
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">מספר טלפון</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="phoneNumber"
                                    type="tel"
                                    placeholder="הכנס את מספר הטלפון שלך"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        const digitsOnly = value.replace(/\D/g, '')
                                        console.log('Phone input changed (digits only):', digitsOnly)
                                        setPhoneNumber(digitsOnly)
                                    }}
                                    className="pl-10"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                הזן מספר טלפון הכולל ספרות בלבד (לדוגמה: 0541234567 או 972541234567)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">סיסמה</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="צור סיסמה"
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
                            <p className="text-xs text-gray-500">חייבת להיות לפחות 6 תווים</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">אישור סיסמה</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="אשר את הסיסמה שלך"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4 text-gray-400" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-gray-400" />
                                    )}
                                </Button>
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
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    יוצר חשבון...
                                </>
                            ) : (
                                "צור חשבון"
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
                        <span className="text-sm text-gray-600">יש לך כבר חשבון? </span>
                        <Link
                            to="/login"
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                            התחבר
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
