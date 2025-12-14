import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, Shield, CreditCard, User, Mail, Phone, ArrowRight } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { PhoneInput } from "@/components/ui/phone-input"
import { skipToken } from "@reduxjs/toolkit/query"
import { useGetClientProfileQuery } from "@/store/services/supabaseApi"
import { MOCK_HANDSHAKE_TOKEN } from "@/utils/payment"

interface CreditCardSetupModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    onSuccess: () => void
}

export const CreditCardSetupModal: React.FC<CreditCardSetupModalProps> = ({
    open,
    onOpenChange,
    customerId,
    onSuccess,
}) => {
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [iframeUrl, setIframeUrl] = useState<string>("")
    const [showIframe, setShowIframe] = useState(false)
    const [fullName, setFullName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [isPhoneValid, setIsPhoneValid] = useState(true)
    const [showForm, setShowForm] = useState(true)

    // Fetch customer profile to prefill form
    const {
        data: profile,
        isLoading: isProfileLoading,
    } = useGetClientProfileQuery(customerId ?? skipToken)

    // Prefill form when profile loads
    useEffect(() => {
        if (profile && open) {
            setFullName(profile.fullName || "")
            setPhone(profile.phone || "")
            setEmail(profile.email || "")
            setShowForm(true)
            setShowIframe(false)
        }
    }, [profile, open])

    // Note: We rely on the Tranzilla callback (save-credit-token-callback) to save the token
    // The callback is triggered automatically when payment succeeds, so we don't need
    // to listen for postMessage events or manually save the token from the frontend

    const validateForm = (): boolean => {
        if (!fullName.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם מלא נדרש",
                variant: "destructive",
            })
            return false
        }

        if (!phone.trim()) {
            toast({
                title: "שדה חובה",
                description: "מספר טלפון נדרש",
                variant: "destructive",
            })
            return false
        }

        if (!isPhoneValid) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return false
        }

        if (!email.trim()) {
            toast({
                title: "שדה חובה",
                description: "כתובת אימייל נדרשת",
                variant: "destructive",
            })
            return false
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
            toast({
                title: "כתובת אימייל לא תקינה",
                description: "אנא הכנס כתובת אימייל תקינה",
                variant: "destructive",
            })
            return false
        }

        return true
    }

    const handleOpenIframe = async () => {
        // Validate form first
        if (!validateForm()) {
            return
        }

        try {
            setLoading(true)
            console.log("🔍 [CreditCardSetupModal] Creating Tranzilla handshake")

            // Use minimal amount for verification (1 NIS)
            const verificationSum = 0.1

            const { data: handshakeData, error: handshakeError } = await supabase.functions.invoke(
                "tranzila-handshake",
                {
                    body: { sum: verificationSum },
                }
            )

            if (handshakeError || !handshakeData?.success || !handshakeData?.thtk) {
                // Extract error message from multiple possible sources
                let errorMessage = "Failed to create Tranzilla handshake"

                if (handshakeError) {
                    errorMessage = handshakeError.message || errorMessage
                } else if (handshakeData?.error) {
                    errorMessage = handshakeData.error
                } else if (handshakeData && !handshakeData.success) {
                    errorMessage = handshakeData.error || "שגיאה ביצירת חיבור למערכת התשלומים"
                }

                console.error("❌ [CreditCardSetupModal] Handshake failed:", {
                    handshakeError,
                    handshakeData,
                    errorMessage,
                })
                throw new Error(errorMessage)
            }

            const thtk = handshakeData.thtk

            // Check if this is a mock token - don't include it in the request
            const isMockToken = thtk === MOCK_HANDSHAKE_TOKEN
            if (isMockToken) {
                console.warn("⚠️ [CreditCardSetupModal] Mock token detected, proceeding without thtk parameter")
            } else {
                console.log("✅ [CreditCardSetupModal] Handshake successful")
            }

            // Build Tranzilla iframe URL for tokenization (minimal charge for verification)
            const baseUrl = "https://direct.tranzila.com/bloved29/iframenew.php"
            const params: string[] = []

            // Helper function to add parameter
            const addParam = (key: string, value: string | number) => {
                if (value !== null && value !== undefined && value !== "") {
                    params.push(`${key}=${encodeURIComponent(value.toString())}`)
                }
            }

            // Add thtk token from handshake only if it's not a mock token
            if (!isMockToken) {
                addParam("thtk", thtk)
            }

            // Required parameters based on Tranzila documentation
            addParam("new_process", "1")
            addParam("lang", "il")
            addParam("sum", verificationSum.toString())
            addParam("currency", "1")
            addParam("tranmode", "A")
            // cred_type options: 1 = One payment, 6 = Credit installments, 8 = Installments
            addParam("cred_type", "1") // Single payment (default)

            // Add customer information
            addParam("customer_name", fullName.trim())
            addParam("phone", phone.trim().replace(/\D/g, "")) // Clean phone number
            addParam("email", email.trim())
            addParam("record_id", customerId)

            // Get JWT token from user session to pass to callback for validation
            const { data: { session } } = await supabase.auth.getSession()
            const jwtToken = session?.access_token

            if (!jwtToken) {
                throw new Error("לא ניתן לקבל את אסימון ההתחברות. אנא התחבר מחדש.")
            }

            // Add JWT token as parameter (Tranzilla will pass it back in the callback)
            addParam("jwt_token", jwtToken)

            // Add notify_url_address for callback when payment succeeds
            const supabaseUrl = import.meta.env.VITE_PROD_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
            if (supabaseUrl) {
                const notifyUrl = `${supabaseUrl}/functions/v1/save-credit-token-callback`
                // Add notify_url_address without encoding (as per Tranzilla pattern)
                params.push(`notify_url_address=${notifyUrl}`)
            }

            const url = `${baseUrl}?${params.join("&")}`

            // Build parameters object for logging
            const paramsObj: Record<string, string> = {}
            let recordIdValue = ""
            params.forEach((param) => {
                const [key, value] = param.split("=")
                const decodedValue = decodeURIComponent(value || "")
                // Truncate sensitive data
                if (key === "jwt_token" || key === "thtk") {
                    paramsObj[key] = decodedValue ? decodedValue.substring(0, 20) + "..." : "undefined"
                } else {
                    paramsObj[key] = decodedValue
                    // Capture full record_id for verification
                    if (key === "record_id") {
                        recordIdValue = decodedValue
                    }
                }
            })

            // Verify record_id matches customerId
            if (recordIdValue !== customerId) {
                console.warn("⚠️ [CreditCardSetupModal] record_id mismatch!", {
                    expected: customerId,
                    actual: recordIdValue,
                })
            }

            // Log all parameters as a single object
            console.log("📋 [CreditCardSetupModal] Iframe Parameters:", {
                baseUrl,
                isMockToken,
                totalParameters: params.length,
                customerId,
                recordId: recordIdValue || paramsObj.record_id,
                parameters: paramsObj,
                urlLength: url.length,
                urlPreview: url.substring(0, 300),
            })

            setIframeUrl(url)
            setShowForm(false)
            setShowIframe(true)
        } catch (error) {
            console.error("❌ [CreditCardSetupModal] Error opening iframe:", error)
            toast({
                title: "שגיאה",
                description: error instanceof Error ? error.message : "לא הצלחנו לפתוח את מסך התשלום",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setShowIframe(false)
        setShowForm(true)
        setIframeUrl("")
        setLoading(false)
        onOpenChange(false)
    }

    // Check if running locally
    const isLocalDev = () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PROD_SUPABASE_URL || ""
        return supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1:54321")
    }

    const handleSaveMockedCard = async () => {
        try {
            setLoading(true)
            console.log("🧪 [CreditCardSetupModal] Saving mocked card for testing")

            // Get JWT token for authentication
            const { data: { session } } = await supabase.auth.getSession()
            const jwtToken = session?.access_token

            if (!jwtToken) {
                throw new Error("לא ניתן לקבל את אסימון ההתחברות. אנא התחבר מחדש.")
            }

            // Create mocked callback data matching the format from Tranzila
            const mockedCallbackData = {
                Response: "000",
                o_tranmode: "A",
                expmonth: "12",
                myid: "204767958",
                email: email || "test@example.com",
                currency: "1",
                new_process: "1",
                expyear: "29",
                supplier: "bloved29",
                sum: "0.1",
                benid: "o27ri1rf58d53p03lv0pfbucq1",
                o_cred_type: "1",
                lang: "il",
                ccard: "",
                record_id: customerId,
                phone: phone.trim().replace(/\D/g, "") || "972528393372",
                thtk: "mock_token_" + Date.now().toString(),
                ccno: "1234", // Mock last 4 digits
                cred_type: "1",
                jwt_token: jwtToken,
                tranmode: "A",
                customer_name: fullName || "מעיין בילי",
                ConfirmationCode: "MOCK" + Math.floor(Math.random() * 1000000).toString().padStart(6, "0"),
                cardtype: "2",
                cardissuer: "6",
                cardaquirer: "5",
                index: "2",
                Tempref: "MOCK" + Date.now().toString(),
                TranzilaTK: "mock_tranzila_token_" + Date.now().toString(),
                token: "mock_token_" + Date.now().toString(),
            }

            // Get the callback URL - use local URL if in dev mode, otherwise use prod
            let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PROD_SUPABASE_URL
            if (!supabaseUrl) {
                throw new Error("לא נמצא URL של Supabase")
            }

            // For local development, ensure we use the correct local URL format
            if (isLocalDev()) {
                supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321"
            }

            const callbackUrl = `${supabaseUrl}/functions/v1/save-credit-token-callback`

            console.log("🧪 [CreditCardSetupModal] Calling callback URL:", callbackUrl)
            console.log("🧪 [CreditCardSetupModal] Mocked data:", {
                ...mockedCallbackData,
                jwt_token: jwtToken ? "PRESENT" : "NOT FOUND",
            })

            // Call the callback function with mocked data (as form-encoded)
            const formData = new URLSearchParams()
            Object.entries(mockedCallbackData).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    formData.append(key, value.toString())
                }
            })

            const response = await fetch(callbackUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData.toString(),
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || "שגיאה בשמירת כרטיס המבחן")
            }

            console.log("✅ [CreditCardSetupModal] Mocked card saved successfully:", result)

            toast({
                title: "הצלחה",
                description: "כרטיס המבחן נשמר בהצלחה",
            })

            // Dispatch event to notify banner to refresh
            console.log("📢 [CreditCardSetupModal] Dispatching creditCardSaved event")
            window.dispatchEvent(new CustomEvent("creditCardSaved"))

            // Trigger success callback
            onSuccess()
            handleClose()
        } catch (error) {
            console.error("❌ [CreditCardSetupModal] Error saving mocked card:", error)
            toast({
                title: "שגיאה",
                description: error instanceof Error ? error.message : "לא הצלחנו לשמור את כרטיס המבחן",
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md w-full p-0" dir="rtl">
                <DialogHeader className="p-6 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-right">
                                    הגדרת פרטי אשראי
                                </DialogTitle>
                                <DialogDescription className="text-right mt-1">
                                    הכנס את פרטי כרטיס האשראי שלך בצורה מאובטחת
                                </DialogDescription>
                            </div>
                        </div>

                    </div>
                </DialogHeader>

                {showForm && !showIframe ? (
                    <div className="p-6 space-y-4">
                        {/* Trust Badge */}
                        <div className="flex items-center justify-center gap-4 text-sm text-gray-600 pb-4 border-b">
                            <div className="flex items-center gap-1">
                                <Lock className="w-4 h-4 text-green-600" />
                                <span>תשלום מאובטח</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Shield className="w-4 h-4 text-blue-600" />
                                <span>מוגן SSL</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <CreditCard className="w-4 h-4 text-blue-600" />
                                <span>Tranzila</span>
                            </div>
                        </div>

                        {/* Form Section */}
                        <div className="space-y-4">
                            <div className="space-y-2 text-right">
                                <Label htmlFor="fullName" className="flex items-center justify-start gap-2">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span>שם מלא <span className="text-red-500">*</span></span>
                                </Label>
                                <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="הקלידו את שמכם המלא"
                                    dir="rtl"
                                    className="text-right"
                                    disabled={loading || isProfileLoading}
                                />
                            </div>

                            <div className="space-y-2 text-right">
                                <Label htmlFor="phone" className="flex items-center justify-start gap-2">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    <span>טלפון <span className="text-red-500">*</span></span>
                                </Label>
                                <PhoneInput
                                    id="phone"
                                    value={phone}
                                    onChange={setPhone}
                                    onValidationChange={setIsPhoneValid}
                                    placeholder="הקלידו מספר טלפון"
                                    disabled={loading || isProfileLoading}
                                />
                            </div>

                            <div className="space-y-2 text-right">
                                <Label htmlFor="email" className="flex items-center justify-start gap-2">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <span>אימייל <span className="text-red-500">*</span></span>
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    dir="rtl"
                                    className="text-right"
                                    disabled={loading || isProfileLoading}
                                />
                            </div>
                        </div>

                        {/* Info Message */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-right">
                            <p className="text-sm text-blue-900 font-medium mb-2">
                                אימות כרטיס אשראי
                            </p>
                            <p className="text-xs text-blue-700">
                                אנו נאמת את כרטיס האשראי שלך באמצעות תשלום סמלי של 1 ₪ בלבד.
                                הכרטיס יישמר במערכת לצורך תשלומים עתידיים.
                            </p>
                        </div>

                        {/* Security Notice */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-start gap-2 text-right">
                            <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-600" />
                            <div className="text-xs text-gray-700">
                                <p className="font-medium mb-1">תשלום מאובטח</p>
                                <p>
                                    התשלום מתבצע דרך Tranzila - מערכת תשלומים מאובטחת ומאושרת.
                                    פרטי הכרטיס שלך מוצפנים ולא נשמרים בשרתים שלנו.
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={handleOpenIframe}
                            disabled={loading || isProfileLoading}
                            className="w-full text-white py-3 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                            style={{ backgroundColor: "#4f60a8" }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    מעבד...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-4 h-4" />
                                    המשך לאימות כרטיס אשראי
                                </>
                            )}
                        </Button>
                    </div>
                ) : showIframe ? (
                    <div className="w-full flex flex-col" style={{ minHeight: "600px" }}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowIframe(false)
                                    setShowForm(true)
                                    setIframeUrl("")
                                }}
                                className="flex items-center gap-2 text-right"
                                dir="rtl"
                            >
                                <ArrowRight className="h-4 w-4" />
                                חזרה
                            </Button>
                            {isLocalDev() && (
                                <Button
                                    variant="outline"
                                    onClick={handleSaveMockedCard}
                                    disabled={loading}
                                    className="flex items-center gap-2 text-right border-[#4f60a8] text-[#4f60a8] hover:bg-[#4f60a8]/10 hover:border-[#4f60a8] transition-all duration-200"
                                    dir="rtl"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            שומר...
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="h-4 w-4" />
                                            שמור כרטיס טסט
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                        <iframe
                            src={iframeUrl}
                            className="w-full border-0 flex-1"
                            style={{ minHeight: "600px", width: "100%" }}
                            title="Tranzila Payment"
                            allow="payment"
                        />
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

