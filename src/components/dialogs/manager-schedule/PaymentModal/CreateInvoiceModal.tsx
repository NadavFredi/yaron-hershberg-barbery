import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"

interface CreateInvoiceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (details: { customerName: string; customerEmail?: string; customerPhone?: string; amount: number }) => void
    defaultName?: string
    defaultEmail?: string
    defaultPhone?: string
    defaultAmount?: number
    invoiceType: "debit" | "credit"
    isLoading?: boolean
}

export function CreateInvoiceModal({
    open,
    onOpenChange,
    onConfirm,
    defaultName = "",
    defaultEmail = "",
    defaultPhone = "",
    defaultAmount = 0,
    invoiceType,
    isLoading = false,
}: CreateInvoiceModalProps) {
    const [customerName, setCustomerName] = useState(defaultName)
    const [customerEmail, setCustomerEmail] = useState(defaultEmail)
    const [customerPhone, setCustomerPhone] = useState(defaultPhone)
    const [amount, setAmount] = useState(defaultAmount.toString())

    // Update form when defaults change
    useEffect(() => {
        setCustomerName(defaultName)
        setCustomerEmail(defaultEmail)
        setCustomerPhone(defaultPhone)
        setAmount(defaultAmount.toString())
    }, [defaultName, defaultEmail, defaultPhone, defaultAmount, open])

    const handleSubmit = () => {
        const amountNum = parseFloat(amount)
        if (!customerName.trim()) {
            return
        }
        if (isNaN(amountNum) || amountNum <= 0) {
            return
        }

        onConfirm({
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            amount: amountNum,
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                onMouseOver={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
            >
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">
                        {invoiceType === "credit" ? "צור חשבונית זיכוי" : "צור חשבונית"}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {invoiceType === "credit"
                            ? "אנא בדוק ועדכן את פרטי החשבונית לפני יצירתה"
                            : "אנא בדוק ועדכן את פרטי החשבונית לפני יצירתה"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="customer-name" className="text-right">שם לקוח *</Label>
                        <Input
                            id="customer-name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="שם לקוח"
                            dir="rtl"
                            className="text-right"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="customer-email" className="text-right">אימייל</Label>
                        <Input
                            id="customer-email"
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="אימייל"
                            dir="ltr"
                            className="text-left"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="customer-phone" className="text-right">טלפון</Label>
                        <PhoneInput
                            id="customer-phone"
                            value={customerPhone}
                            onChange={(value) => setCustomerPhone(value)}
                            placeholder="טלפון"
                            defaultCountry="il"
                            showValidation={false}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount" className="text-right">סכום (₪) *</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            dir="ltr"
                            className="text-left"
                        />
                    </div>
                </div>

                <DialogFooter className="flex sm:justify-start  gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        ביטול
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !customerName.trim() || parseFloat(amount) <= 0}>
                        {isLoading ? "יוצר..." : "צור חשבונית"}
                    </Button>

                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

