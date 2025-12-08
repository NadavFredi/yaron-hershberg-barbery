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

interface SubscriptionTypeDeleteDialogProps {
  open: boolean
  name?: string
  isSubmitting?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function SubscriptionTypeDeleteDialog({
  open,
  name,
  isSubmitting = false,
  onConfirm,
  onClose,
}: SubscriptionTypeDeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) {
          onClose()
        }
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">מחיקת סוג מנוי</AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את הסוג "{name}"? המנויים המשויכים לו יישארו ללא סוג.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            מחק
          </AlertDialogAction>
          <AlertDialogCancel disabled={isSubmitting}>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

