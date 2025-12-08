import { useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"

interface Payment {
    id: string
    customer_id: string
    amount: number
    currency: string
    status: "unpaid" | "paid" | "partial"
    method: string | null
    external_id: string | null
    created_at: string
    updated_at: string
}

interface EditPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    paymentId: string
    onSuccess?: () => void
}

export function EditPaymentDialog({ open, onOpenChange, paymentId, onSuccess }: EditPaymentDialogProps) {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const [paymentData, setPaymentData] = useState<Payment | null>(null)

    useEffect(() => {
        if (open && paymentId) {
            loadPayment()
        }
    }, [open, paymentId])

    const loadPayment = async () => {
        try {
            setIsLoading(true)
            console.log("🔍 [EditPaymentDialog] Loading payment:", paymentId)
            
            const { data, error } = await supabase
                .from("payments")
                .select("*")
                .eq("id", paymentId)
                .single()

            if (error) throw error

            setPaymentData(data as Payment)
            console.log("✅ [EditPaymentDialog] Loaded payment:", data)
        } catch (error: any) {
            console.error("❌ [EditPaymentDialog] Failed to load payment:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את פרטי התשלום",
                variant: "destructive",
            })
            handleClose()
        } finally {
            setIsLoading(false)
        }
    }

    const handleClose = useCallback(() => {
        if (isSaving) {
            return
        }
        onOpenChange(false)
        setTimeout(() => {
            setPaymentData(null)
        }, 300)
    }, [isSaving, onOpenChange])

    const handleSave = useCallback(async () => {
        if (!paymentData) return

        if (!paymentData.amount || paymentData.amount <= 0) {
            toast({
                title: "שדה חובה",
                description: "יש להזין סכום תקין",
                variant: "destructive",
            })
            return
        }

        try {
            setIsSaving(true)
            console.log("🔍 [EditPaymentDialog] Updating payment:", paymentId, paymentData)

            const updatePayload: any = {
                amount: paymentData.amount,
                currency: paymentData.currency,
                status: paymentData.status,
            }

            if (paymentData.method !== null) {
                updatePayload.method = paymentData.method || null
            }

            if (paymentData.external_id !== null) {
                updatePayload.external_id = paymentData.external_id || null
            }

            const { error } = await supabase
                .from("payments")
                .update(updatePayload)
                .eq("id", paymentId)

            if (error) throw error

            console.log("✅ [EditPaymentDialog] Payment updated")

            toast({
                title: "הצלחה",
                description: "התשלום עודכן בהצלחה",
            })

            handleClose()
            onSuccess?.()
        } catch (error: any) {
            console.error("❌ [EditPaymentDialog] Failed to update payment:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לעדכן את התשלום",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }, [paymentData, paymentId, toast, handleClose, onSuccess])

    if (isLoading) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent dir="rtl" className="max-w-lg">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="mr-4 text-gray-600">טוען...</span>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    if (!paymentData) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>ערוך תשלום</DialogTitle>
                    <DialogDescription>עדכן את פרטי התשלום</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-payment-amount">סכום <span className="text-red-500">*</span></Label>
                        <Input
                            id="edit-payment-amount"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                            className="text-right"
                            dir="rtl"
                            disabled={isSaving}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-payment-currency">מטבע</Label>
                            <Select
                                value={paymentData.currency}
                                onValueChange={(value) => setPaymentData({ ...paymentData, currency: value })}
                                disabled={isSaving}
                            >
                                <SelectTrigger id="edit-payment-currency" dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="ILS">₪ ILS</SelectItem>
                                    <SelectItem value="USD">$ USD</SelectItem>
                                    <SelectItem value="EUR">€ EUR</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-payment-status">סטטוס</Label>
                            <Select
                                value={paymentData.status}
                                onValueChange={(value: "unpaid" | "paid" | "partial") => setPaymentData({ ...paymentData, status: value })}
                                disabled={isSaving}
                            >
                                <SelectTrigger id="edit-payment-status" dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="unpaid">לא שולם</SelectItem>
                                    <SelectItem value="paid">שולם</SelectItem>
                                    <SelectItem value="partial">חלקי</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-payment-method">אמצעי תשלום</Label>
                        <Input
                            id="edit-payment-method"
                            placeholder="כרטיס אשראי, מזומן, העברה בנקאית..."
                            value={paymentData.method || ""}
                            onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value || null })}
                            className="text-right"
                            dir="rtl"
                            disabled={isSaving}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-payment-external-id">מזהה חיצוני</Label>
                        <Input
                            id="edit-payment-external-id"
                            placeholder="מזהה מתשלום חיצוני..."
                            value={paymentData.external_id || ""}
                            onChange={(e) => setPaymentData({ ...paymentData, external_id: e.target.value || null })}
                            className="text-right"
                            dir="rtl"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !paymentData.amount}
                        className="inline-flex items-center gap-2"
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        שמור שינויים
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

