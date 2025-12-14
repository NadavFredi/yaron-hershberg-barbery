import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useState } from "react"

interface Debt {
    id: string
    customer_id: string
    original_amount: number
    description: string | null
    customer?: {
        full_name: string
    }
}

interface DeleteDebtDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    debt: Debt | null
    onConfirm?: () => void
}

export function DeleteDebtDialog({ open, onOpenChange, debt, onConfirm }: DeleteDebtDialogProps) {
    const { toast } = useToast()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!debt) return

        try {
            setIsDeleting(true)

            // Check if there are any payments linked to this debt
            const { data: payments, error: paymentsError } = await supabase
                .from("payments")
                .select("id")
                .eq("debt_id", debt.id)
                .limit(1)

            if (paymentsError) throw paymentsError

            if (payments && payments.length > 0) {
                toast({
                    title: "לא ניתן למחוק",
                    description: "לא ניתן למחוק חוב שיש לו תשלומים קשורים. יש למחוק תחילה את התשלומים.",
                    variant: "destructive",
                })
                setIsDeleting(false)
                return
            }

            const { error } = await supabase
                .from("debts")
                .delete()
                .eq("id", debt.id)

            if (error) throw error

            toast({
                title: "חוב נמחק",
                description: `החוב עבור ${debt.customer?.full_name || "לקוח"} נמחק בהצלחה`,
            })

            onOpenChange(false)
            onConfirm?.()
        } catch (error) {
            console.error("Error deleting debt:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את החוב",
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader className="text-right">
                    <AlertDialogTitle className="text-right">מחיקת חוב</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                        האם אתה בטוח שברצונך למחוק את החוב עבור {debt?.customer?.full_name || "לקוח זה"}?
                        {debt && (
                            <>
                                <br />
                                <span className="font-semibold">סכום: ₪{debt.original_amount.toFixed(2)}</span>
                            </>
                        )}
                        <br />
                        פעולה זו אינה ברת ביטול.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-red-600 text-white hover:bg-red-700"
                    >
                        {isDeleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        מחק
                    </AlertDialogAction>
                    <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
