import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"

interface BulkTreatmentTypesDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    count: number
    isProcessing: boolean
    onConfirm: () => void
}

export function BulkTreatmentTypesDeleteDialog({
    open,
    onOpenChange,
    count,
    isProcessing,
    onConfirm,
}: BulkTreatmentTypesDeleteDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={(value) => !isProcessing && onOpenChange(value)}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader className="text-right">
                    <AlertDialogTitle className="text-right">מחיקת גזעים נבחרים</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                        האם למחוק {count} גזעים שנבחרו? פעולה זו אינה ניתנת לשחזור ותסיר גם שיוכים לקטגוריות ולעמדות.
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

