import { useEffect, useState, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Info } from "lucide-react"

export type CustomerTypeFormValues = {
  name: string
  description: string
}

type CustomerTypeDialogMode = "create" | "edit"

interface CustomerTypeDialogProps {
  open: boolean
  mode: CustomerTypeDialogMode
  initialValues?: CustomerTypeFormValues
  isSubmitting?: boolean
  nextPriority?: number
  onClose: () => void
  onSubmit: (values: CustomerTypeFormValues) => Promise<void> | void
}

export function CustomerTypeDialog({
  open,
  mode,
  initialValues,
  isSubmitting = false,
  nextPriority,
  onClose,
  onSubmit,
}: CustomerTypeDialogProps) {
  const [formValues, setFormValues] = useState<CustomerTypeFormValues>({ name: "", description: "" })

  useEffect(() => {
    if (open) {
      setFormValues(
        initialValues
          ? { name: initialValues.name, description: initialValues.description }
          : { name: "", description: "" }
      )
    }
  }, [initialValues, open])

  const isCreateMode = mode === "create"
  const descriptionHelper = useMemo(() => {
    if (!isCreateMode) {
      return "הקדימות הנוכחית תישמר כפי שהיא."
    }
    const priorityNumber = nextPriority ?? 1
    return `הקדימות החדשה תיקבע אוטומטית למקום ${priorityNumber}. מספר נמוך יותר מקבל קדימות גבוהה יותר.`
  }, [isCreateMode, nextPriority])

  const handleSubmit = async () => {
    const trimmedValues = {
      name: formValues.name.trim(),
      description: formValues.description.trim(),
    }

    if (!trimmedValues.name) {
      return
    }

    await onSubmit(trimmedValues)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen && !isSubmitting ? onClose() : undefined)}>
      <DialogContent dir="rtl" className="sm:max-w-lg text-right">
        <DialogHeader>
          <DialogTitle className="text-right">{isCreateMode ? "הוסף סוג לקוח" : "ערוך סוג לקוח"}</DialogTitle>
          <DialogDescription className="text-right">
            {isCreateMode
              ? "מלא את הפרטים כדי ליצור סוג לקוח חדש. הקדימות תקבע אוטומטית בהתאם למיקומו בטבלה."
              : "עדכן את הפרטים של סוג הלקוח."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="customer-type-name">שם סוג</Label>
            <Input
              id="customer-type-name"
              autoFocus
              value={formValues.name}
              onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="לדוגמה: VIP"
              className="text-right"
              dir="rtl"
              disabled={isSubmitting}
            />
            {!formValues.name.trim() && (
              <p className="text-xs text-red-500">שם הסוג הוא שדה חובה.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-type-description">תיאור (אופציונלי)</Label>
            <Textarea
              id="customer-type-description"
              value={formValues.description}
              onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="הוסף הערות לגבי סוג זה"
              className="min-h-[100px] text-right"
              dir="rtl"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-right text-xs text-emerald-700">
            <Info className="h-4 w-4" />
            <span>{descriptionHelper}</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
          <Button onClick={handleSubmit} disabled={isSubmitting || !formValues.name.trim()} className="flex items-center gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור סוג
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            בטל
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
