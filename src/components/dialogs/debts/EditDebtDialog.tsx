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

interface EditDebtDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    debtId: string | null
    onSuccess?: () => void
}

export function EditDebtDialog({ open, onOpenChange, debtId, onSuccess }: EditDebtDialogProps) {
    const { toast } = useToast()
    const [originalAmount, setOriginalAmount] = useState("")
    const [description, setDescription] = useState("")
    const [dueDate, setDueDate] = useState<Date | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (open && debtId) {
            loadDebt()
        } else {
            // Reset form when dialog closes
            setOriginalAmount("")
            setDescription("")
            setDueDate(null)
        }
    }, [open, debtId])

    const loadDebt = async () => {
        if (!debtId) return

        try {
            setIsLoading(true)
            const { data, error } = await supabase
                .from("debts")
                .select("*")
                .eq("id", debtId)
                .single()

            if (error) throw error

            if (data) {
                setOriginalAmount(data.original_amount.toString())
                setDescription(data.description || "")
                setDueDate(data.due_date ? new Date(data.due_date) : null)
            }
        } catch (error) {
            console.error("Error loading debt:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את פרטי החוב",
                variant: "destructive",
            })
            onOpenChange(false)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!debtId) return

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
            const { error } = await supabase
                .from("debts")
                .update({
                    original_amount: amount,
                    description: description.trim() || null,
                    due_date: dueDate ? dueDate.toISOString() : null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", debtId)

            if (error) throw error

            toast({
                title: "חוב עודכן בהצלחה",
                description: "פרטי החוב עודכנו",
            })

            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Error updating debt:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את החוב",
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
                    <DialogTitle className="text-right">ערוך חוב</DialogTitle>
                    <DialogDescription className="text-right">
                        עדכן את פרטי החוב
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="mr-2 text-gray-600">טוען...</span>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 py-4">
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
                                onClick={handleSave}
                                disabled={isSaving || !originalAmount.trim()}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                        שומר...
                                    </>
                                ) : (
                                    "שמור שינויים"
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
