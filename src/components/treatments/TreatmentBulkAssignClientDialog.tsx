import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface CustomerOption {
    id: string
    name: string
    phone?: string | null
}

interface TreatmentBulkAssignCustomerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customers: CustomerOption[]
    isSubmitting: boolean
    onConfirm: (customerId: string) => void
}

export function TreatmentBulkAssignCustomerDialog({
    open,
    onOpenChange,
    customers,
    isSubmitting,
    onConfirm,
}: TreatmentBulkAssignCustomerDialogProps) {
    const [search, setSearch] = useState("")
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")

    const filteredCustomers = useMemo(() => {
        const normalized = search.trim()
        if (!normalized) return customers
        return customers.filter((customer) => {
            const haystack = `${customer.name ?? ""} ${customer.phone ?? ""}`
            return haystack.toLowerCase().includes(normalized.toLowerCase())
        })
    }, [customers, search])

    useEffect(() => {
        if (open) {
            setSearch("")
            setSelectedCustomerId((prev) => prev || (customers[0]?.id ?? ""))
        } else {
            setSelectedCustomerId("")
            setSearch("")
        }
    }, [open, customers])

    useEffect(() => {
        if (filteredCustomers.length === 0) {
            setSelectedCustomerId("")
            return
        }
        if (!filteredCustomers.some((customer) => customer.id === selectedCustomerId)) {
            setSelectedCustomerId(filteredCustomers[0].id)
        }
    }, [filteredCustomers, selectedCustomerId])

    const handleConfirm = () => {
        if (!selectedCustomerId) return
        onConfirm(selectedCustomerId)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!isSubmitting) {
                onOpenChange(next)
            }
        }}>
            <DialogContent dir="rtl" className="max-w-md text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">שיוך לקוח לפרופילים שנבחרו</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר לקוח חדש שיקושר לכל הפרופילים שסומנו. פעולה זו תעדכן את הבעלות על הפרופיל.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="חיפוש לפי שם או טלפון..."
                        dir="rtl"
                        className="text-right"
                    />
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                        <span>בחר לקוח</span>
                        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                            <SelectTrigger dir="rtl" className="text-right">
                                <SelectValue placeholder="בחר לקוח" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {filteredCustomers.length === 0 ? (
                                    <SelectItem value="__empty" disabled>
                                        לא נמצאו לקוחות מתאימים
                                    </SelectItem>
                                ) : (
                                    filteredCustomers.map((customer) => (
                                        <SelectItem key={customer.id} value={customer.id}>
                                            {customer.name}
                                            {customer.phone ? ` · ${customer.phone}` : ""}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </label>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleConfirm} disabled={isSubmitting || !selectedCustomerId}>
                        {isSubmitting ? "מעדכן..." : "עדכן לקוח"}
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

