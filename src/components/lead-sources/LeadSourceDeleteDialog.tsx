import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface LeadSourceDeleteDialogProps {
  open: boolean
  name?: string
  isSubmitting?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function LeadSourceDeleteDialog({
  open,
  name,
  isSubmitting = false,
  onConfirm,
  onClose,
}: LeadSourceDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen && !isSubmitting ? onClose() : undefined)}>
      <DialogContent dir="rtl" className="sm:max-w-lg text-right">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            מחק מקור הגעה
          </DialogTitle>
          <DialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את מקור ההגעה "{name}"?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-right">
          <p className="text-sm text-amber-800">
            <strong>שים לב:</strong> לקוחות המשויכים למקור הגעה זה יישארו ללא מקור הגעה לאחר המחיקה.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            מחק
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            בטל
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
