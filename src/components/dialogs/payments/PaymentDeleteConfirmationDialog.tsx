import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Payment {
    id: string
    amount: number
    currency: string
    customer?: {
        full_name: string
    }
}

interface PaymentDeleteConfirmationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    payment: Payment
    onConfirm: () => void
    isDeleting: boolean
}

export function PaymentDeleteConfirmationDialog({
    open,
    onOpenChange,
    payment,
    onConfirm,
    isDeleting,
}: PaymentDeleteConfirmationDialogProps) {
    const formatCurrency = (amount: number, currency: string = "ILS") => {
        return new Intl.NumberFormat("he-IL", {
            style: "currency",
            currency: currency,
        }).format(amount)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>מחיקת תשלום</DialogTitle>
                    <DialogDescription>
                        האם אתה בטוח שברצונך למחוק את התשלום הזה?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2 text-right">
                    <div className="text-sm text-gray-600">
                        <p><strong>לקוח:</strong> {payment.customer?.full_name || "לא ידוע"}</p>
                        <p><strong>סכום:</strong> {formatCurrency(payment.amount, payment.currency)}</p>
                    </div>
                    <p className="text-sm text-red-600 font-medium">
                        פעולה זו לא ניתנת לביטול!
                    </p>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-2"
                    >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                        מחק
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

