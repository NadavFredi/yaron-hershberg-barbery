import React, { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface PaymentIframeProps {
    iframeUrl?: string
    postData?: Record<string, string | number>
    onSuccess?: (data?: any) => void
    onError?: (error: string) => void
    productName?: string
    productDescription?: string
    amount?: number
    firstPayment?: number | null
    numPayments?: number
    className?: string
}

export const PaymentIframe: React.FC<PaymentIframeProps> = ({
    iframeUrl,
    postData,
    onSuccess,
    onError,
    productName,
    productDescription,
    amount,
    firstPayment,
    numPayments,
    className = "",
}) => {
    const [isLoading, setIsLoading] = useState(true)
    const [iframeReady, setIframeReady] = useState(false)

    // Load jQuery and Tranzila scripts
    useEffect(() => {
        // Load jQuery if not already loaded
        if (!window.jQuery) {
            const jqueryScript = document.createElement("script")
            jqueryScript.src = "https://code.jquery.com/jquery-3.6.0.js"
            jqueryScript.async = true
            document.head.appendChild(jqueryScript)

            // Load Tranzila script after jQuery loads
            jqueryScript.onload = () => {
                const tranzilaScript = document.createElement("script")
                tranzilaScript.src = `https://direct.tranzila.com/js/tranzilanapple_v3.js?v=${Date.now()}`
                tranzilaScript.async = true
                document.head.appendChild(tranzilaScript)

                // Set up jQuery noConflict
                tranzilaScript.onload = () => {
                    if (window.jQuery) {
                        window.$n = window.jQuery.noConflict(true)
                    }
                    setIsLoading(false)
                }
            }
        } else {
            // jQuery already loaded, just load Tranzila script
            const tranzilaScript = document.createElement("script")
            tranzilaScript.src = `https://direct.tranzila.com/js/tranzilanapple_v3.js?v=${Date.now()}`
            tranzilaScript.async = true
            document.head.appendChild(tranzilaScript)

            tranzilaScript.onload = () => {
                if (window.jQuery) {
                    window.$n = window.jQuery.noConflict(true)
                }
                setIsLoading(false)
            }
        }
    }, [])

    // Handle iframe form submission
    useEffect(() => {
        if (!postData || isLoading || iframeReady) return

        // Wait a bit for iframe to be ready
        const timer = setTimeout(() => {
            const form = document.createElement("form")
            form.method = "POST"
            form.action = "https://direct.tranzila.com/calbnoot/iframenew.php"
            form.target = "tranzila-iframe"
            form.style.display = "none"

            // Add directcgi parameter first
            const directcgiInput = document.createElement("input")
            directcgiInput.type = "hidden"
            directcgiInput.name = "directcgi"
            directcgiInput.value = "on"
            form.appendChild(directcgiInput)

            // Add all form fields
            for (const [key, value] of Object.entries(postData)) {
                if (value !== null && value !== undefined && value !== "") {
                    const input = document.createElement("input")
                    input.type = "hidden"
                    input.name = key
                    // For json_purchase_data, URL-encode it
                    if (key === "json_purchase_data") {
                        input.value = encodeURIComponent(String(value))
                    } else {
                        input.value = String(value)
                    }
                    form.appendChild(input)
                }
            }

            document.body.appendChild(form)
            form.submit()
            document.body.removeChild(form)
            setIframeReady(true)
        }, 100)

        return () => clearTimeout(timer)
    }, [postData, isLoading, iframeReady])

    // Listen for Tranzila messages
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Verify origin for security
            if (event.origin !== "https://direct.tranzila.com") return

            console.log("📨 [PaymentIframe] Received message from Tranzila:", event.data)

            if (event.data?.Response === "OK" || event.data?.response === "OK") {
                onSuccess?.(event.data)
            } else if (event.data?.Response === "ERR" || event.data?.response === "ERR") {
                const errorMessage = event.data?.error || event.data?.Error || "שגיאה בתשלום"
                onError?.(errorMessage)
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [onSuccess, onError])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16" dir="rtl">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-gray-600">טוען מסך תשלום...</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`w-full ${className}`} dir="rtl">
            {(productName || amount) && (
                <div className="p-4 text-white mb-4 rounded-lg" style={{ backgroundColor: "#4f60a8" }}>
                    <h1 className="text-xl font-bold">{productName || "תשלום"}</h1>
                    {productDescription && productDescription.trim() && (
                        <p className="text-sm opacity-95 mt-2 leading-relaxed">{productDescription}</p>
                    )}
                    {firstPayment !== null && firstPayment !== undefined && firstPayment > 0 ? (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm opacity-90">תשלום ראשון:</span>
                                <span className="text-lg font-bold">₪{firstPayment.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm opacity-90">יתר התשלומים:</span>
                                <span className="text-base font-semibold">₪{amount?.toLocaleString()}</span>
                            </div>
                            {numPayments && (
                                <div className="pt-2 border-t border-white/20">
                                    <div className="flex items-center justify-between text-xs opacity-85">
                                        <span>סה"כ תשלומים:</span>
                                        <span className="font-semibold">{1 + numPayments}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        amount && (
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-sm opacity-90">סכום לתשלום:</span>
                                <span className="text-xl font-bold">₪{amount.toLocaleString()}</span>
                            </div>
                        )
                    )}
                </div>
            )}

            <div className="w-full" style={{ minHeight: "600px" }}>
                {iframeUrl ? (
                    <iframe
                        src={iframeUrl}
                        className="w-full border-0"
                        style={{ minHeight: "600px", width: "100%" }}
                        title="Tranzila Payment"
                        allow="payment"
                        {...({ allowPaymentRequest: "true" } as any)}
                    />
                ) : (
                    <iframe
                        id="tranzila-iframe"
                        name="tranzila-iframe"
                        className="w-full border-0"
                        style={{ minHeight: "600px", width: "100%" }}
                        title="Tranzila Payment"
                        allow="payment"
                        {...({ allowPaymentRequest: "true" } as any)}
                    />
                )}
            </div>
        </div>
    )
}

// Extend Window interface for jQuery
declare global {
    interface Window {
        jQuery?: any
        $?: any
        $n?: any
    }
}

