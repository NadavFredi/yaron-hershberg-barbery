import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { DatePickerInput } from "@/components/DatePickerInput"
import { CustomerSearchInput } from "@/components/CustomerSearchInput"
import type { Customer } from "@/components/CustomerSearchInput"

interface CreateDebtDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    initialCustomerId?: string
}

export function CreateDebtDialog({ open, onOpenChange, onSuccess, initialCustomerId }: CreateDebtDialogProps) {
    const { toast } = useToast()
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [originalAmount, setOriginalAmount] = useState("")
    const [description, setDescription] = useState("")
    const [dueDate, setDueDate] = useState<Date | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            setSelectedCustomer(null)
            setOriginalAmount("")
            setDescription("")
            setDueDate(null)
            setIsSaving(false)
        }
    }, [open])

    // Load initial customer if provided
    useEffect(() => {
        if (open && initialCustomerId && !selectedCustomer) {
            supabase
                .from("customers")
                .select("id, full_name, phone, email")
                .eq("id", initialCustomerId)
                .single()
                .then(({ data, error }) => {
                    if (!error && data) {
                        setSelectedCustomer({
                            id: data.id,
                            name: data.full_name,
                            phone: data.phone,
                            email: data.email || undefined,
                        })
                    }
                })
        }
    }, [open, initialCustomerId, selectedCustomer])

    const handleCreate = async () => {
        if (!selectedCustomer) {
            toast({
                title: "שדה חובה",
                description: "יש לבחור לקוח",
                variant: "destructive",
            })
            return
        }

        if (!originalAmount.trim()) {
            toast({
                title: "שדה חובה",
                description: "יש להזין סכום חוב",
                variant: "destructive",
            })
            return
        }

        const amount = parseFloat(originalAmount)
        if (isNaN(amount) || amount <= 0) {
            toast({
                title: "שגיאה",
                description: "סכום חוב חייב להיות מספר חיובי",
                variant: "destructive",
            })
            return
        }

        try {
            setIsSaving(true)
            const { data, error } = await supabase
                .from("debts")
                .insert({
                    customer_id: selectedCustomer.id,
                    original_amount: amount,
                    description: description.trim() || null,
                    due_date: dueDate ? dueDate.toISOString() : null,
                    status: "open",
                })
                .select()
                .single()

            if (error) throw error

            toast({
                title: "חוב נוצר בהצלחה",
                description: `חוב בסך ₪${amount.toFixed(2)} נוצר עבור ${selectedCustomer.name}`,
            })

            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Error creating debt:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן ליצור את החוב",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">הוסף חוב חדש</DialogTitle>
                    <DialogDescription className="text-right">
                        צור חוב חדש ללקוח
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="customer">לקוח *</Label>
                        <CustomerSearchInput
                            value={selectedCustomer}
                            onChange={setSelectedCustomer}
                            placeholder="חפש לקוח..."
                            disabled={isSaving || !!initialCustomerId}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">סכום חוב (₪) *</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={originalAmount}
                            onChange={(e) => setOriginalAmount(e.target.value)}
                            placeholder="0.00"
                            className="text-right"
                            dir="rtl"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">תיאור</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="תיאור החוב (אופציונלי)"
                            className="text-right min-h-[100px]"
                            dir="rtl"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="due-date">תאריך יעד (אופציונלי)</Label>
                        <DatePickerInput
                            value={dueDate}
                            onChange={setDueDate}
                            placeholder="בחר תאריך יעד..."
                            wrapperClassName="w-full"
                            displayFormat="dd/MM/yyyy"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={isSaving || !selectedCustomer || !originalAmount.trim()}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                יוצר...
                            </>
                        ) : (
                            "צור חוב"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
