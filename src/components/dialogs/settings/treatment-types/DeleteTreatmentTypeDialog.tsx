import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface TreatmentType {
    id: string
    name: string
}

interface DeleteTreatmentTypeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    treatmentType: TreatmentType | null
    onConfirm: () => Promise<void>
    isDeleting?: boolean
}

export function DeleteTreatmentTypeDialog({
    open,
    onOpenChange,
    treatmentType,
    onConfirm,
    isDeleting = false,
}: DeleteTreatmentTypeDialogProps) {
    const handleClose = () => {
        if (!isDeleting) {
            onOpenChange(false)
        }
    }

    const handleConfirm = async () => {
        await onConfirm()
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">מחק גזע?</DialogTitle>
                    <DialogDescription className="text-right">
                        האם אתה בטוח שברצונך למחוק את הגזע "{treatmentType?.name}"?
                        פעולה זו לא ניתנת לביטול.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isDeleting}
                    >
                        ביטול
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                    >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        מחק
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

