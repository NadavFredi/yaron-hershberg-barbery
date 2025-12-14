import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CustomerSearchInput } from "@/components/CustomerSearchInput"
import type { Customer } from "@/components/CustomerSearchInput"

interface SelectCustomerForPaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (customer: Customer) => void
}

export function SelectCustomerForPaymentDialog({
    open,
    onOpenChange,
    onConfirm
}: SelectCustomerForPaymentDialogProps) {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
        }
    }, [open])

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
    }

    const handleCustomerClear = () => {
        setSelectedCustomer(null)
    }

    const handleConfirm = () => {
        if (!selectedCustomer) return
        onConfirm(selectedCustomer)
        onOpenChange(false)
    }

    const handleCancel = () => {
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">בחר לקוח</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר לקוח לחיוב
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Customer Selection */}
                    <div className="space-y-2">
                        <CustomerSearchInput
                            selectedCustomer={selectedCustomer}
                            onCustomerSelect={handleCustomerSelect}
                            onCustomerClear={handleCustomerClear}
                            label="חיפוש לקוח"
                            placeholder="חיפוש לפי שם, טלפון או אימייל..."
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedCustomer}
                        className="inline-flex items-center gap-2"
                    >
                        המשך
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

