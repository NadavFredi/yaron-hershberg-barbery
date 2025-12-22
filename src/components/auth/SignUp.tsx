import React, { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { PhoneInput } from "@/components/ui/phone-input"
import { cn } from "@/lib/utils"

interface SignUpProps {
    onSwitchToSignIn: () => void
}

export function SignUp({ onSwitchToSignIn }: SignUpProps) {
    const navigate = useNavigate()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [phoneE164, setPhoneE164] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPhoneValid, setIsPhoneValid] = useState(false)
    const [isEmailValid, setIsEmailValid] = useState(true) // Default to true since email is optional

    // Email validation function
    const validateEmail = (emailValue: string): boolean => {
        if (!emailValue || emailValue.trim() === "") {
            return true // Email is optional, so empty is valid
        }
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(emailValue.trim())
    }

    // Handle email change with validation
    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value
        setEmail(newEmail)
        setIsEmailValid(validateEmail(newEmail))
        setError(null) // Clear error when user types
    }

    // Handle phone validation change from PhoneInput
    const handlePhoneValidationChange = (isValid: boolean) => {
        // Phone is required, so it's only valid if PhoneInput says it's valid AND it's not empty
        const phoneIsValid = isValid && phoneE164.trim() !== ""
        setIsPhoneValid(phoneIsValid)
        if (phoneIsValid) {
            setError(null) // Clear error when phone becomes valid
        }
    }

    // Also check phone validity when phoneE164 changes
    useEffect(() => {
        // Phone is required, so validate that it's not empty
        if (!phoneE164 || phoneE164.trim() === "") {
            setIsPhoneValid(false)
        }
        // The PhoneInput component will call onValidationChange when it validates
    }, [phoneE164])

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
        if (!phoneE164 || phoneE164.trim() === "") {
            setError("מספר הטלפון הוא שדה חובה")
            setIsLoading(false)
            return
        }

        // Extract phone digits from E164 format (+972501234567 -> 0501234567)
        let digitsOnlyPhone = phoneE164.replace(/\D/g, '')
        if (digitsOnlyPhone.startsWith('972') && digitsOnlyPhone.length >= 11) {
            digitsOnlyPhone = '0' + digitsOnlyPhone.slice(3)
        }

        if (digitsOnlyPhone.length < 9 || digitsOnlyPhone.length > 15) {
            setError("מספר הטלפון חייב להכיל בין 9 ל-15 ספרות")
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

            // Helper function to map error messages to Hebrew
            const mapErrorToHebrew = (errorMessage: string): string => {
                const lowerMessage = errorMessage.toLowerCase()

                if (lowerMessage.includes('already been registered') ||
                    lowerMessage.includes('user already exists') ||
                    lowerMessage.includes('already registered')) {
                    return 'משתמש עם כתובת אימייל זו כבר רשום במערכת. אם זה אתה, אנא התחבר במקום.'
                } else if (lowerMessage.includes('missing required fields')) {
                    return 'אנא מלא את כל השדות הנדרשים'
                } else if (lowerMessage.includes('invalid phone number')) {
                    return 'מספר הטלפון שהוזן אינו תקין'
                } else if (lowerMessage.includes('phone number must have between')) {
                    return 'מספר הטלפון חייב להכיל בין 9 ל-15 ספרות'
                } else if (lowerMessage.includes('unable to convert phone')) {
                    return 'לא ניתן להמיר את מספר הטלפון לפורמט הנדרש'
                } else if (lowerMessage.includes('internal server error')) {
                    return 'שגיאה פנימית בשרת. אנא נסה שוב מאוחר יותר'
                } else if (lowerMessage.includes('password')) {
                    return 'שגיאה בסיסמה. אנא בדוק שהסיסמה עומדת בדרישות'
                } else if (lowerMessage.includes('email')) {
                    return 'שגיאה בכתובת האימייל. אנא בדוק שהאימייל תקין'
                } else if (lowerMessage.includes('phone')) {
                    return 'שגיאה במספר הטלפון. אנא בדוק שהמספר תקין'
                }

                return errorMessage
            }

            // Extract error message from result or error object
            let extractedErrorMessage: string | null = null

            // First, check if result contains an error (even when error object is set, result might still have the error)
            if (result && typeof result === 'object' && 'error' in result && result.error) {
                extractedErrorMessage = typeof result.error === 'string' ? result.error : String(result.error)
                console.error('Signup error from edge function (in result.error):', extractedErrorMessage)
            }
            // If error is set, try to extract message from error object or make direct fetch
            else if (error) {
                console.error('Supabase invoke error:', error)
                const errorObj = error as Record<string, unknown>

                // Check error.context.body for the actual response body
                if (errorObj.context && typeof errorObj.context === 'object') {
                    const context = errorObj.context as Record<string, unknown>
                    if (context.body) {
                        try {
                            // body might be a string (JSON) or already parsed object
                            let body: unknown = context.body
                            if (typeof body === 'string') {
                                body = JSON.parse(body)
                            }
                            if (body && typeof body === 'object' && 'error' in body) {
                                extractedErrorMessage = typeof (body as Record<string, unknown>).error === 'string'
                                    ? (body as Record<string, unknown>).error as string
                                    : String((body as Record<string, unknown>).error)
                                console.error('Found error in error.context.body:', extractedErrorMessage)
                            }
                        } catch (e) {
                            console.error('Failed to parse error.context.body:', e)
                        }
                    }
                }

                // If we still don't have an error message, try making a direct fetch to get the actual error
                if (!extractedErrorMessage) {
                    try {
                        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
                        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

                        if (supabaseUrl && supabaseAnonKey) {
                            const response = await fetch(`${supabaseUrl}/functions/v1/signup`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'apikey': supabaseAnonKey,
                                    'authorization': `Bearer ${supabaseAnonKey}`,
                                },
                                body: JSON.stringify({
                                    email: trimmedEmail || null,
                                    password,
                                    full_name: fullName,
                                    phone_number: digitsOnlyPhone,
                                }),
                            })

                            // Even if status is not ok, try to parse the error from response body
                            const responseData = await response.json()
                            if (responseData && typeof responseData === 'object' && 'error' in responseData) {
                                extractedErrorMessage = typeof responseData.error === 'string'
                                    ? responseData.error
                                    : String(responseData.error)
                                console.error('Found error via direct fetch:', extractedErrorMessage)
                            }
                        }
                    } catch (fetchError) {
                        console.error('Failed to fetch error via direct call:', fetchError)
                    }
                }

                // If we still don't have an error message, check error.message
                if (!extractedErrorMessage && errorObj.message) {
                    const errorMessage = String(errorObj.message)
                    // Only use it if it's not the generic "non-2xx" message
                    if (!errorMessage.toLowerCase().includes('non-2xx')) {
                        extractedErrorMessage = errorMessage
                    }
                }
            }

            // If we found an error message, throw it with Hebrew translation
            if (extractedErrorMessage) {
                throw new Error(mapErrorToHebrew(extractedErrorMessage))
            }

            // If error is set but we couldn't extract a message, throw generic error
            if (error) {
                throw new Error('שגיאה ביצירת החשבון. אנא נסה שוב מאוחר יותר')
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

                    <CardTitle className="text-2xl font-bold text-gray-900">צור חשבון</CardTitle>
                    <CardDescription className="text-gray-600">
                        הירשם כדי להזמין תור
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-right block">
                                שם מלא <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="הכנס את השם המלא שלך"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="pl-10 text-right placeholder:text-right"
                                    required
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-right block">אימייל</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="הכנס את האימייל שלך"
                                    value={email}
                                    onChange={handleEmailChange}
                                    className={cn(
                                        "pl-10 text-left placeholder:text-right",
                                        !isEmailValid && "border-red-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    )}
                                    dir="ltr"
                                />
                            </div>
                            {!isEmailValid && (
                                <p className="text-xs text-red-500 text-right">
                                    כתובת אימייל לא תקינה
                                </p>
                            )}
                            {isEmailValid && (
                                <p className="text-xs text-gray-500 text-right">
                                    שדה אופציונלי - ניתן להרשם ללא אימייל
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phoneInput" className="text-right block">
                                מספר טלפון <span className="text-red-500">*</span>
                            </Label>
                            <PhoneInput
                                id="phoneInput"
                                value={phoneE164}
                                onChange={(value) => {
                                    setPhoneE164(value)
                                    setError(null)
                                }}
                                onValidationChange={handlePhoneValidationChange}
                                placeholder="הכנס את מספר הטלפון שלך"
                                defaultCountry="il"
                                showValidation
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-right block">
                                סיסמה <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="צור סיסמה"
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
                            <p className="text-xs text-gray-500 text-right">חייבת להיות לפחות 6 תווים</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-right block">
                                אישור סיסמה <span className="text-red-500">*</span>
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="אשר את הסיסמה שלך"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-10 text-left placeholder:text-right"
                                    required
                                    dir="ltr"
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
                            disabled={isLoading || !isPhoneValid || !isEmailValid}
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
