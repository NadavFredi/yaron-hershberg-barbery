import React, { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard, Wallet, ArrowRight } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { PaymentForm, type PaymentFormData } from "./PaymentForm"
import { PaymentIframe } from "./PaymentIframe"
import { TokenPaymentApproval } from "./TokenPaymentApproval"
import type { Database } from "@/integrations/supabase/types"
import { MOCK_HANDSHAKE_TOKEN, TRANZILA_SUPPLIER } from "@/utils/payment"

type CreditToken = Database["public"]["Tables"]["credit_tokens"]["Row"]

export type PaymentConfig = {
    amount: number
    productName: string
    productDescription?: string
    customerId: string
    paymentType?: "installments" | "single"
    maxInstallments?: number
    firstPayment?: number | null
    notifyUrlAddress?: string
    customData?: Record<string, any>
    onSuccess?: (data?: any) => void
    onError?: (error: string) => void
}

interface PaymentFlowProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    config: PaymentConfig
    allowTokenPayment?: boolean
    allowNewCardPayment?: boolean
}

type PaymentStep = "method" | "form" | "token-approval" | "iframe" | "processing"

export const PaymentFlow: React.FC<PaymentFlowProps> = ({
    open,
    onOpenChange,
    config,
    allowTokenPayment = true,
    allowNewCardPayment = true,
}) => {
    const { toast } = useToast()
    const navigate = useNavigate()
    const [step, setStep] = useState<PaymentStep>("method")
    const [creditToken, setCreditToken] = useState<CreditToken | null>(null)
    const [isLoadingToken, setIsLoadingToken] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<"token" | "new-card">("new-card")
    const [formData, setFormData] = useState<PaymentFormData | null>(null)
    const [numPayments, setNumPayments] = useState(1)
    const [iframeUrl, setIframeUrl] = useState<string>("")
    const [postData, setPostData] = useState<Record<string, string | number> | undefined>(undefined)
    const [isProcessing, setIsProcessing] = useState(false)

    // Load credit token when modal opens
    useEffect(() => {
        if (open && config.customerId) {
            loadCreditToken()
        } else {
            setStep("method")
            setCreditToken(null)
            setFormData(null)
            setIframeUrl("")
            setPostData(undefined)
        }
    }, [open, config.customerId])

    const loadCreditToken = async () => {
        if (!config.customerId) return

        setIsLoadingToken(true)
        try {
            const { data, error } = await supabase
                .from("credit_tokens")
                .select("*")
                .eq("customer_id", config.customerId)
                .maybeSingle()

            if (error && error.code !== "PGRST116") {
                throw error
            }

            if (data) {
                setCreditToken(data)
                if (allowTokenPayment) {
                    setPaymentMethod("token")
                }
            } else {
                setCreditToken(null)
                setPaymentMethod("new-card")
            }
        } catch (error) {
            console.error("❌ [PaymentFlow] Error loading credit token:", error)
            setCreditToken(null)
            setPaymentMethod("new-card")
        } finally {
            setIsLoadingToken(false)
        }
    }

    const handleTokenApproval = async (approvedNumPayments: number) => {
        setNumPayments(approvedNumPayments)
        setIsProcessing(true)
        setStep("processing")

        try {
            // Call the onSuccess callback with token payment info
            // The parent component should handle the actual charge
            config.onSuccess?.({
                method: "token",
                tokenId: creditToken?.id,
                numPayments: approvedNumPayments,
                amount: config.amount,
            })
        } catch (error) {
            console.error("❌ [PaymentFlow] Error processing token payment:", error)
            toast({
                title: "שגיאה בתשלום",
                description: error instanceof Error ? error.message : "לא ניתן לבצע את התשלום כעת",
                variant: "destructive",
            })
            setStep("token-approval")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleFormSubmit = async (data: PaymentFormData) => {
        setFormData(data)
        setIsProcessing(true)

        try {
            // Get Tranzila handshake token
            const handshakeSum =
                config.firstPayment !== null && config.firstPayment !== undefined && config.firstPayment > 0
                    ? config.firstPayment
                    : config.amount

            console.log("🤝 [PaymentFlow] Getting Tranzila handshake token...")
            const { data: handshakeData, error: handshakeError } = await supabase.functions.invoke("tranzila-handshake", {
                body: { sum: handshakeSum },
            })

            if (handshakeError || !handshakeData?.success || !handshakeData?.thtk) {
                // Extract error message from multiple possible sources
                let errorMessage = "לא ניתן להתחבר למערכת התשלומים"

                if (handshakeError) {
                    errorMessage = handshakeError.message || errorMessage
                } else if (handshakeData?.error) {
                    errorMessage = handshakeData.error
                } else if (handshakeData && !handshakeData.success) {
                    errorMessage = handshakeData.error || "שגיאה ביצירת חיבור למערכת התשלומים"
                }

                console.error("❌ [PaymentFlow] Handshake failed:", {
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
                console.warn("⚠️ [PaymentFlow] Mock token detected, proceeding without thtk parameter")
            }

            // Build POST data for Tranzila iframe
            const buildPostData = (): Record<string, string | number> => {
                const postData: Record<string, string | number> = {}

                // Helper function to add parameter
                const addParam = (key: string, value: string | number) => {
                    if (value !== null && value !== undefined && value !== "") {
                        postData[key] = value
                    }
                }

                // Add supplier (required for Tranzila)
                addParam("supplier", TRANZILA_SUPPLIER)

                // Add thtk token from handshake only if it's not a mock token
                if (!isMockToken) {
                    addParam("thtk", thtk)
                }

                // Required parameters
                addParam("new_process", 1)
                addParam("lang", "il")
                const sumAmount =
                    config.firstPayment !== null && config.firstPayment !== undefined && config.firstPayment > 0
                        ? config.firstPayment
                        : config.amount
                addParam("sum", sumAmount)
                addParam("currency", 1)
                addParam("tranmode", "AK")

                // Payment type configuration
                // cred_type options: 1 = One payment, 6 = Credit installments, 8 = Installments
                if (config.paymentType === "installments" || numPayments > 1) {
                    // Recurring installments
                    addParam("cred_type", 1)
                    addParam("recur_payments", numPayments)
                    addParam("recur_transaction", "4_approved")
                    const today = new Date()
                    const year = today.getFullYear()
                    const month = String(today.getMonth() + 1).padStart(2, "0")
                    const day = String(today.getDate()).padStart(2, "0")
                    addParam("recur_start_date", `${year}-${month}-${day}`)
                } else {
                    // Single payment
                    addParam("cred_type", 1) // One payment (default)
                    if (config.maxInstallments && config.maxInstallments > 0) {
                        // Allow customer to choose installments up to maxInstallments
                        // When maxpay is set, Tranzila will show installment options
                        addParam("maxpay", config.maxInstallments)
                    }
                }

                // Add customer information
                addParam("contact", data.fullName)
                addParam("customer_name", data.fullName)
                addParam("phone", data.phone.replace(/\D/g, ""))
                addParam("email", data.email)
                addParam("record_id", config.customerId)

                // Add custom data as mymore (JSON string)
                if (config.customData) {
                    addParam("mymore", JSON.stringify(config.customData))
                }

                // Add product list as JSON
                const productList = [
                    {
                        product_name: config.productName,
                        product_quantity: 1,
                        product_price: sumAmount,
                    },
                ]
                addParam("json_purchase_data", JSON.stringify(productList))
                addParam("u71", 1)

                // Add notify_url_address
                if (config.notifyUrlAddress) {
                    addParam("notify_url_address", config.notifyUrlAddress)
                }

                // Add payment details for recurring payments
                if (config.paymentType === "installments" || numPayments > 1) {
                    const recurringPaymentsCount =
                        config.firstPayment !== null && config.firstPayment !== undefined && config.firstPayment > 0
                            ? numPayments
                            : numPayments
                    addParam("amount_of_next_payments", recurringPaymentsCount)
                    addParam("single_payment_sum", config.amount)
                    if (config.firstPayment !== null && config.firstPayment !== undefined && config.firstPayment > 0) {
                        addParam("first_payment", config.firstPayment)
                    }
                }

                return postData
            }

            const paymentPostData = buildPostData()

            // Build sanitized object for logging (truncate sensitive data)
            const sanitizedData: Record<string, unknown> = {}
            Object.entries(paymentPostData).forEach(([key, value]) => {
                if (key === "thtk" || key === "jwt_token") {
                    sanitizedData[key] = value ? String(value).substring(0, 20) + "..." : "undefined"
                } else if (key === "json_purchase_data") {
                    sanitizedData[key] = JSON.parse(String(value))
                } else {
                    sanitizedData[key] = value
                }
            })

            // Log all POST data as a single object
            console.log("📋 [PaymentFlow] POST Data for Tranzilla iframe:", {
                supplier: paymentPostData.supplier,
                hasThtk: !!paymentPostData.thtk,
                isMockToken,
                totalParameters: Object.keys(paymentPostData).length,
                formActionUrl: "https://direct.tranzila.com/calbnoot/iframenew.php (hardcoded in PaymentIframe component)",
                parameters: sanitizedData,
            })

            setPostData(paymentPostData)
            setStep("iframe")
            setIsProcessing(false)
        } catch (error) {
            console.error("❌ [PaymentFlow] Error preparing payment:", error)
            toast({
                title: "שגיאה",
                description: error instanceof Error ? error.message : "לא ניתן לפתוח את מסך התשלום",
                variant: "destructive",
            })
            setIsProcessing(false)
        }
    }

    const handleIframeSuccess = (data?: any) => {
        console.log("✅ [PaymentFlow] Payment successful:", data)
        toast({
            title: "תשלום התקבל",
            description: "התשלום מתעבד, אנא המתן...",
        })
        config.onSuccess?.(data)
        setTimeout(() => {
            handleClose()
        }, 2000)
    }

    const handleIframeError = (error: string) => {
        console.error("❌ [PaymentFlow] Payment error:", error)
        toast({
            title: "שגיאה בתשלום",
            description: error,
            variant: "destructive",
        })
        config.onError?.(error)
    }

    const handleClose = () => {
        if (!isProcessing) {
            setStep("method")
            setFormData(null)
            setIframeUrl("")
            setPostData(undefined)
            setNumPayments(1)
            onOpenChange(false)
        }
    }

    if (step === "iframe") {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0" dir="rtl">
                    <div className="flex items-center justify-start p-4 border-b sticky top-0 bg-white z-10">
                        <Button
                            variant="ghost"
                            onClick={() => setStep("form")}
                            className="flex items-center gap-2 text-right"
                            dir="rtl"
                            disabled={isProcessing}
                        >
                            <ArrowRight className="h-4 w-4" />
                            חזרה
                        </Button>
                    </div>
                    <div className="p-4">
                        <PaymentIframe
                            postData={postData}
                            onSuccess={handleIframeSuccess}
                            onError={handleIframeError}
                            productName={config.productName}
                            productDescription={config.productDescription}
                            amount={config.amount}
                            firstPayment={config.firstPayment}
                            numPayments={numPayments}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">בחירת שיטת תשלום</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את שיטת התשלום המועדפת עליך
                    </DialogDescription>
                </DialogHeader>

                {step === "processing" ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-gray-600">מעבד את התשלום...</p>
                    </div>
                ) : step === "token-approval" && creditToken ? (
                    <TokenPaymentApproval
                        creditToken={creditToken}
                        amount={config.amount}
                        maxInstallments={config.maxInstallments || 12}
                        onApprove={handleTokenApproval}
                        onCancel={() => setStep("method")}
                        isProcessing={isProcessing}
                        productName={config.productName}
                    />
                ) : step === "form" ? (
                    <div className="space-y-4">
                        <PaymentForm
                            initialData={formData || undefined}
                            onSubmit={handleFormSubmit}
                            disabled={isProcessing}
                        />
                        <div className="flex gap-3 justify-start">
                            <Button variant="outline" onClick={() => setStep("method")} disabled={isProcessing}>
                                חזרה
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 space-y-3">
                        {isLoadingToken ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                {/* Payment Summary */}
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-sm text-slate-600 text-right">
                                        <div>
                                            {config.productName}: <span className="font-medium">₪{config.amount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Options */}
                                <div className="space-y-3">
                                    {allowTokenPayment && (
                                        <Button
                                            onClick={() => {
                                                if (creditToken) {
                                                    setStep("token-approval")
                                                } else {
                                                    // Navigate to billing settings
                                                    navigate("/profile?mode=billing")
                                                    toast({
                                                        title: "הגדרת כרטיס אשראי",
                                                        description: "אנא הגדר כרטיס אשראי בהגדרות הפרופיל",
                                                    })
                                                }
                                            }}
                                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                                            variant="outline"
                                            disabled={isProcessing}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex items-center justify-center w-10 h-10 rounded-lg ${creditToken ? "bg-primary/20" : "bg-gray-200"
                                                        }`}
                                                >
                                                    <Wallet
                                                        className={`h-5 w-5 ${creditToken ? "text-primary" : "text-gray-600"
                                                            }`}
                                                    />
                                                </div>
                                                <div className="text-right flex-1">
                                                    <div className="font-semibold text-gray-900">תשלום מכרטיס שמור</div>
                                                    <div className="text-sm text-gray-600">
                                                        {creditToken
                                                            ? `**** ${creditToken.last4 || "****"} - ${creditToken.provider || "Tranzila"}`
                                                            : "אין כרטיס שמור במערכת - לחץ להגדרה"}
                                                    </div>
                                                </div>
                                            </div>
                                        </Button>
                                    )}

                                    {allowNewCardPayment && (
                                        <Button
                                            onClick={() => setStep("form")}
                                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                                            variant="outline"
                                            disabled={isProcessing}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                                                    <CreditCard className="h-5 w-5 text-purple-600" />
                                                </div>
                                                <div className="text-right flex-1">
                                                    <div className="font-semibold">כרטיס אשראי אחר</div>
                                                    <div className="text-sm text-gray-500">הזנת פרטי כרטיס חדש</div>
                                                </div>
                                            </div>
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

