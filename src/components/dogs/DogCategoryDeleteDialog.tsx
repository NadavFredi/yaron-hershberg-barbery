import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"

interface DogCategoryDeleteDialogProps {
    open: boolean
    entityLabel: string
    name?: string
    isSubmitting: boolean
    onConfirm: () => void
    onClose: () => void
}

export function DogCategoryDeleteDialog({
    open,
    entityLabel,
    name,
    isSubmitting,
    onConfirm,
    onClose,
}: DogCategoryDeleteDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={(next) => {
            if (!isSubmitting && !next) {
                onClose()
            }
        }}>
            <AlertDialogContent dir="rtl" className="text-right">
                <AlertDialogHeader className="text-right">
                    <AlertDialogTitle className="text-right">מחיקת {entityLabel}</AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                        האם למחוק את {entityLabel} "{name ?? ""}"? פעולה זו אינה ברת ביטול וכל הקשרים עם גזעים ימחקו.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="bg-red-600 text-white hover:bg-red-700"
                    >
                        {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        מחק
                    </AlertDialogAction>
                    <AlertDialogCancel disabled={isSubmitting}>ביטול</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

