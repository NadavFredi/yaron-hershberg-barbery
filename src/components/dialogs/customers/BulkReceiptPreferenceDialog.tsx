import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"

interface BulkReceiptPreferenceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    count: number
    shouldSend: boolean
    isProcessing: boolean
    onConfirm: () => void
}

export function BulkReceiptPreferenceDialog({
    open,
    onOpenChange,
    count,
    shouldSend,
    isProcessing,
    onConfirm,
}: BulkReceiptPreferenceDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader className="text-right">
                    <AlertDialogTitle className="text-right">
                        {shouldSend ? "סימון לשליחת חשבונית" : "ביטול שליחת חשבונית"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                        האם לעדכן את העדפת שליחת החשבונית עבור {count} לקוחות נבחרים ל"{shouldSend ? "כן" : "לא"}"?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        עדכן
                    </AlertDialogAction>
                    <AlertDialogCancel disabled={isProcessing}>ביטול</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

