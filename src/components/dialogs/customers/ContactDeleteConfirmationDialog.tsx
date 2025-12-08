import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"

interface ContactDeleteConfirmationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contactName?: string
    isProcessing: boolean
    onConfirm: () => void
}

export function ContactDeleteConfirmationDialog({
    open,
    onOpenChange,
    contactName,
    isProcessing,
    onConfirm,
}: ContactDeleteConfirmationDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader className="text-right">
                    <AlertDialogTitle className="text-right">מחיקת איש קשר</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                        האם אתה בטוח שברצונך למחוק את איש הקשר "{contactName ?? ""}"? פעולה זו אינה ברת ביטול.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="bg-red-600 text-white hover:bg-red-700"
                    >
                        {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        מחק
                    </AlertDialogAction>
                    <AlertDialogCancel disabled={isProcessing}>ביטול</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

