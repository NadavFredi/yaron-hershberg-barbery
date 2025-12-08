import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Wallet, CheckCircle2, Lock } from "lucide-react"
import type { Database } from "@/integrations/supabase/types"

type CreditToken = Database["public"]["Tables"]["credit_tokens"]["Row"]

interface TokenPaymentApprovalProps {
    creditToken: CreditToken
    amount: number
    maxInstallments?: number
    onApprove: (numPayments: number) => void
    onCancel: () => void
    isProcessing?: boolean
    productName?: string
}

export const TokenPaymentApproval: React.FC<TokenPaymentApprovalProps> = ({
    creditToken,
    amount,
    maxInstallments = 12,
    onApprove,
    onCancel,
    isProcessing = false,
    productName,
}) => {
    const [numPayments, setNumPayments] = useState(1)
    const [approved, setApproved] = useState(false)

    const singlePaymentAmount = amount / numPayments
    const totalAmount = amount

    useEffect(() => {
        // Reset approval when numPayments changes
        setApproved(false)
    }, [numPayments])

    const handleApprove = () => {
        setApproved(true)
        onApprove(numPayments)
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Product Info */}
            {productName && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-right">{productName}</CardTitle>
                    </CardHeader>
                </Card>
            )}

            {/* Saved Card Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-right flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-blue-600" />
                        <span>כרטיס אשראי שמור</span>
                    </CardTitle>
                    <CardDescription className="text-right">
                        כרטיס אשראי זה ישמש לתשלום
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">מספר כרטיס:</span>
                            <span className="font-semibold text-gray-900">
                                **** {creditToken.last4 || "****"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-gray-600">ספק:</span>
                            <span className="font-medium">{creditToken.provider || "Tranzila"}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Installments Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-right">מספר תשלומים</CardTitle>
                    <CardDescription className="text-right">
                        בחר כמה תשלומים תרצה לבצע
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="numPayments" className="text-right">
                            מספר תשלומים (1-{maxInstallments})
                        </Label>
                        <Input
                            id="numPayments"
                            type="number"
                            min={1}
                            max={maxInstallments}
                            value={numPayments}
                            onChange={(e) => {
                                const value = parseInt(e.target.value) || 1
                                const clamped = Math.max(1, Math.min(maxInstallments, value))
                                setNumPayments(clamped)
                            }}
                            className="text-right"
                            dir="rtl"
                            disabled={isProcessing || approved}
                        />
                    </div>

                    {/* Payment Summary */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600">סכום כולל:</span>
                            <span className="text-xl font-bold text-gray-900">₪{totalAmount.toFixed(2)}</span>
                        </div>
                        {numPayments > 1 && (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">מספר תשלומים:</span>
                                    <span className="font-semibold">{numPayments}</span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                                    <span className="text-gray-600">סכום לכל תשלום:</span>
                                    <span className="text-lg font-bold text-blue-600">
                                        ₪{singlePaymentAmount.toFixed(2)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Security Notice */}
                    <div className="bg-purple-50 border border-purple-200 rounded p-3 flex items-start gap-2">
                        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-600" />
                        <div className="text-xs text-purple-800">
                            <p className="font-medium">תשלום מאובטח</p>
                            <p className="mt-1">התשלום יתבצע דרך Tranzila - מערכת תשלומים מאובטחת ומאושרת</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Approval Section */}
            {!approved && (
                <div className="flex gap-3 justify-start">
                    <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                        ביטול
                    </Button>
                    <Button
                        onClick={handleApprove}
                        disabled={isProcessing || numPayments < 1}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                מתעבד...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4 ml-2" />
                                אני מאשר את התשלום
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Final Confirmation */}
            {approved && (
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                            <div>
                                <p className="font-semibold text-green-900 mb-2">אישור התשלום</p>
                                <div className="space-y-2 text-sm text-green-800">
                                    <p>תבוצע גבייה של <strong>₪{totalAmount.toFixed(2)}</strong></p>
                                    {numPayments > 1 && (
                                        <p>
                                            ב-<strong>{numPayments}</strong> תשלומים של{" "}
                                            <strong>₪{singlePaymentAmount.toFixed(2)}</strong> כל אחד
                                        </p>
                                    )}
                                    <p>מהכרטיס השמור שלך</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

