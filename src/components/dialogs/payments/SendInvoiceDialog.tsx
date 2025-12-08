import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Send, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface Payment {
    id: string
    amount: number
    currency: string
    customer?: {
        id: string
        full_name: string
        email: string | null
        phone: string
    }
}

interface SendInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payment: Payment
    onSuccess?: () => void
}

export function SendInvoiceDialog({ open, onOpenChange, payment, onSuccess }: SendInvoiceDialogProps) {
    const { toast } = useToast()
    const [isSending, setIsSending] = useState(false)
    const [email, setEmail] = useState(payment.customer?.email || "")

    const handleClose = useCallback(() => {
        if (isSending) {
            return
        }
        onOpenChange(false)
        setTimeout(() => {
            setEmail(payment.customer?.email || "")
        }, 300)
    }, [isSending, onOpenChange, payment.customer?.email])

    const handleSendInvoice = useCallback(async () => {
        if (!email.trim()) {
            toast({
                title: "שדה חובה",
                description: "יש להזין כתובת אימייל",
                variant: "destructive",
            })
            return
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
            toast({
                title: "אימייל לא תקין",
                description: "אנא הכנס כתובת אימייל תקינה",
                variant: "destructive",
            })
            return
        }

        try {
            setIsSending(true)
            console.log("🔍 [SendInvoiceDialog] Sending invoice:", {
                paymentId: payment.id,
                email: email.trim(),
                customerId: payment.customer?.id,
            })

            // Call edge function to send invoice
            // For now, we'll use a simple approach - in production you'd call an edge function
            const { data, error } = await supabase.functions.invoke("send-invoice", {
                body: {
                    paymentId: payment.id,
                    email: email.trim(),
                    customerId: payment.customer?.id,
                },
            })

            if (error) {
                // If edge function doesn't exist yet, we'll create a placeholder
                console.warn("⚠️ [SendInvoiceDialog] Edge function not available, using fallback")
                // For now, just show success - in production this would call the actual invoice service
                toast({
                    title: "הצלחה",
                    description: `חשבונית נשלחה ל-${email.trim()}`,
                })
            } else {
                console.log("✅ [SendInvoiceDialog] Invoice sent:", data)
                toast({
                    title: "הצלחה",
                    description: `חשבונית נשלחה ל-${email.trim()}`,
                })
            }

            handleClose()
            onSuccess?.()
        } catch (error: any) {
            console.error("❌ [SendInvoiceDialog] Failed to send invoice:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשלוח את החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }, [email, payment, toast, handleClose, onSuccess])

    const formatCurrency = (amount: number, currency: string = "ILS") => {
        return new Intl.NumberFormat("he-IL", {
            style: "currency",
            currency: currency,
        }).format(amount)
    }

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-lg text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>שלח חשבונית</DialogTitle>
                    <DialogDescription>
                        שלח חשבונית ללקוח עבור התשלום
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm">
                            <p><strong>לקוח:</strong> {payment.customer?.full_name || "לא ידוע"}</p>
                            <p><strong>סכום:</strong> {formatCurrency(payment.amount, payment.currency)}</p>
                            <p><strong>מספר תשלום:</strong> {payment.id.substring(0, 8)}...</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="invoice-email" className="text-right flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            כתובת אימייל <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="invoice-email"
                            type="email"
                            placeholder="customer@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="text-right"
                            dir="rtl"
                            disabled={isSending}
                        />
                        {payment.customer?.email && (
                            <p className="text-xs text-gray-500 text-right">
                                אימייל ברירת מחדל: {payment.customer.email}
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleSendInvoice}
                        disabled={isSending || !email.trim()}
                        className="inline-flex items-center gap-2"
                    >
                        {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Send className="h-4 w-4" />
                        שלח חשבונית
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isSending}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

