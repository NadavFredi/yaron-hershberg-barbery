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
import { PhoneInput } from "@/components/ui/phone-input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SignInProps {
    onSwitchToSignUp: () => void
    onSwitchToResetPassword: () => void
    onUserOnboarding: (email: string) => void
}

type SignInMode = "email" | "phone"

export function SignIn({
    onSwitchToSignUp: _onSwitchToSignUp,
    onSwitchToResetPassword: _onSwitchToResetPassword,
    onUserOnboarding,
}: SignInProps) {
    const navigate = useNavigate()
    const [mode, setMode] = useState<SignInMode>("phone")

    // Email mode state
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    // Phone mode state
    const [phoneE164, setPhoneE164] = useState("")
    const [otp, setOtp] = useState("")
    const [otpSent, setOtpSent] = useState(false)
    const [otpLoading, setOtpLoading] = useState(false)

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const handleSendOTP = async () => {
        setOtpLoading(true)
        setError(null)
        setSuccess(null)

        if (!phoneE164) {
            setError("אנא הזן מספר טלפון תקין")
            setOtpLoading(false)
            return
        }

        try {
            console.log("Sending OTP to phone:", phoneE164)
            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: phoneE164,
            })

            if (otpError) {
                throw otpError
            }

            setOtpSent(true)
            setSuccess("קוד אימות נשלח למספר הטלפון שלך")
            console.log("OTP sent successfully")
        } catch (err) {
            console.error("Error sending OTP:", err)
            let errorMessage = "שגיאה בשליחת קוד אימות"

            if (err && typeof err === "object" && "message" in err) {
                const supabaseError = err as { message: string }
                const errorMsg = supabaseError.message.toLowerCase()

                if (errorMsg.includes("invalid") || errorMsg.includes("not found")) {
                    errorMessage = "מספר הטלפון לא נמצא במערכת. אנא בדוק את המספר או הירשם לחשבון חדש."
                } else if (errorMsg.includes("too many requests") || errorMsg.includes("rate_limit")) {
                    errorMessage = "יותר מדי בקשות. אנא נסה שוב בעוד מספר דקות."
                } else if (supabaseError.message.includes("א") || supabaseError.message.includes("ב")) {
                    errorMessage = supabaseError.message
                }
            }

            setError(errorMessage)
        } finally {
            setOtpLoading(false)
        }
    }

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(null)

        if (!otp || otp.length !== 6) {
            setError("אנא הזן קוד אימות בן 6 ספרות")
            setIsLoading(false)
            return
        }

        try {
            console.log("Verifying OTP for phone:", phoneE164)
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                phone: phoneE164,
                token: otp,
                type: 'sms',
            })

            if (verifyError) {
                throw verifyError
            }

            if (data.user) {
                setSuccess("התחברת בהצלחה! מעבירים אותך לתורים שלך כעת.")
                console.log("User signed in:", data.user)

                // For phone sign-in, skip user existence check since checkUserExists only works with email
                // The user is already authenticated via OTP, so we can proceed directly
                setTimeout(() => {
                    navigate("/appointments")
                }, 1200)
            } else {
                throw new Error("שגיאה באימות קוד")
            }
        } catch (err) {
            console.error("Error verifying OTP:", err)
            let errorMessage = "שגיאה באימות קוד"

            if (err && typeof err === "object" && "message" in err) {
                const supabaseError = err as { message: string }
                const errorMsg = supabaseError.message.toLowerCase()

                if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
                    errorMessage = "קוד האימות שגוי או פג תוקף. אנא בקש קוד חדש."
                } else if (errorMsg.includes("too many requests") || errorMsg.includes("rate_limit")) {
                    errorMessage = "יותר מדי ניסיונות. אנא נסה שוב בעוד מספר דקות."
                } else if (supabaseError.message.includes("א") || supabaseError.message.includes("ב")) {
                    errorMessage = supabaseError.message
                }
            }

            setError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

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

            // Check if user exists
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
            console.error("Sign in error:", err)
            let errorMessage = "שגיאה בהתחברות"

            if (err && typeof err === "object" && "message" in err) {
                const supabaseError = err as { message: string; status?: number }
                const errorMsg = supabaseError.message.toLowerCase()

                // Translate common Supabase errors to Hebrew
                if (errorMsg.includes("invalid login credentials") || errorMsg.includes("invalid_credentials")) {
                    errorMessage = "האימייל או הסיסמה שגויים. אנא בדוק את הפרטים ונסה שוב."
                } else if (errorMsg.includes("email not confirmed") || errorMsg.includes("email_not_confirmed")) {
                    errorMessage = "האימייל לא אומת. אנא בדוק את תיבת הדואר שלך ואומת את האימייל."
                } else if (errorMsg.includes("too many requests") || errorMsg.includes("rate_limit")) {
                    errorMessage = "יותר מדי ניסיונות התחברות. אנא נסה שוב בעוד מספר דקות."
                } else if (errorMsg.includes("user not found")) {
                    errorMessage = "משתמש לא נמצא. אנא בדוק את האימייל או הירשם לחשבון חדש."
                } else if (errorMsg.includes("incorrect password")) {
                    errorMessage = "הסיסמה שגויה. אנא נסה שוב או השתמש באיפוס סיסמה."
                } else {
                    // Use original message if it's already in Hebrew or we don't recognize it
                    errorMessage = supabaseError.message.includes("א") || supabaseError.message.includes("ב") || supabaseError.message.includes("ג")
                        ? supabaseError.message
                        : errorMessage
                }
            }

            setError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-lg border border-gray-200">
                <CardHeader className="text-center space-y-2">

                    <CardTitle className="text-2xl font-bold text-gray-900">ברוכים הבאים</CardTitle>
                    <CardDescription className="text-gray-600">
                        התחבר לחשבון שלך כדי להמשיך
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <Tabs value={mode} onValueChange={(value) => {
                        setMode(value as SignInMode)
                        setError(null)
                        setSuccess(null)
                        setOtpSent(false)
                        setOtp("")
                    }} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="email">אימייל</TabsTrigger>
                            <TabsTrigger value="phone">טלפון</TabsTrigger>
                        </TabsList>

                        <TabsContent value="email" className="space-y-4 mt-4">
                            <form onSubmit={handleSignIn} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-right block">אימייל</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="הכנס את האימייל שלך"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 text-left placeholder:text-right"
                                            required
                                            dir="ltr"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-right block">סיסמה</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="הכנס את הסיסמה שלך"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-10 pr-10 text-left placeholder:text-right"
                                            required
                                            dir="ltr"
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
                                    <Alert variant="destructive" className="text-right" dir="rtl">
                                        <AlertDescription className="text-right">{error}</AlertDescription>
                                    </Alert>
                                )}

                                {success && (
                                    <Alert className="text-right" dir="rtl">
                                        <AlertDescription className="text-right">{success}</AlertDescription>
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
                        </TabsContent>

                        <TabsContent value="phone" className="space-y-4 mt-4">
                            {!otpSent ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phoneInput" className="text-right block">מספר טלפון</Label>
                                        <PhoneInput
                                            id="phoneInput"
                                            value={phoneE164}
                                            onChange={(value) => {
                                                setPhoneE164(value)
                                                setError(null)
                                            }}
                                            placeholder="הכנס את מספר הטלפון שלך"
                                            defaultCountry="il"
                                            showValidation
                                        />
                                    </div>

                                    {error && (
                                        <Alert variant="destructive" className="text-right" dir="rtl">
                                            <AlertDescription className="text-right">{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {success && (
                                        <Alert className="text-right" dir="rtl">
                                            <AlertDescription className="text-right">{success}</AlertDescription>
                                        </Alert>
                                    )}

                                    <Button
                                        type="button"
                                        onClick={handleSendOTP}
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        disabled={otpLoading || !phoneE164}
                                    >
                                        {otpLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                שולח קוד...
                                            </>
                                        ) : (
                                            "שלח קוד אימות"
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleVerifyOTP} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="otp" className="text-right block">קוד אימות</Label>
                                        <p className="text-sm text-gray-600 mb-2 text-right">
                                            הזן את הקוד שנשלח למספר {phoneE164}
                                        </p>
                                        <div className="flex justify-center">
                                            <InputOTP
                                                maxLength={6}
                                                value={otp}
                                                onChange={(value) => {
                                                    setOtp(value)
                                                    setError(null)
                                                }}
                                            >
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0} />
                                                    <InputOTPSlot index={1} />
                                                    <InputOTPSlot index={2} />
                                                    <InputOTPSlot index={3} />
                                                    <InputOTPSlot index={4} />
                                                    <InputOTPSlot index={5} />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </div>

                                    {error && (
                                        <Alert variant="destructive" className="text-right" dir="rtl">
                                            <AlertDescription className="text-right">{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {success && (
                                        <Alert className="text-right" dir="rtl">
                                            <AlertDescription className="text-right">{success}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setOtpSent(false)
                                                setOtp("")
                                                setError(null)
                                                setSuccess(null)
                                            }}
                                            className="flex-1"
                                        >
                                            חזור
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                                            disabled={isLoading || otp.length !== 6}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    מאמת...
                                                </>
                                            ) : (
                                                "אמת קוד"
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </TabsContent>
                    </Tabs>

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
