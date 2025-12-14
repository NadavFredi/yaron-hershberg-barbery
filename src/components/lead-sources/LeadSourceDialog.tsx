import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

export type LeadSourceFormValues = {
  name: string
}

type LeadSourceDialogMode = "create" | "edit"

interface LeadSourceDialogProps {
  open: boolean
  mode: LeadSourceDialogMode
  initialValues?: LeadSourceFormValues
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (values: LeadSourceFormValues) => Promise<void> | void
}

export function LeadSourceDialog({
  open,
  mode,
  initialValues,
  isSubmitting = false,
  onClose,
  onSubmit,
}: LeadSourceDialogProps) {
  const [formValues, setFormValues] = useState<LeadSourceFormValues>({ name: "" })

  useEffect(() => {
    if (open) {
      setFormValues(
        initialValues
          ? { name: initialValues.name }
          : { name: "" }
      )
    }
  }, [initialValues, open])

  const isCreateMode = mode === "create"

  const handleSubmit = async () => {
    const trimmedValues = {
      name: formValues.name.trim(),
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
          <DialogTitle className="text-right">{isCreateMode ? "הוסף מקור הגעה" : "ערוך מקור הגעה"}</DialogTitle>
          <DialogDescription className="text-right">
            {isCreateMode
              ? "הכנס שם למקור הגעה חדש"
              : "עדכן את שם מקור ההגעה."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="lead-source-name">שם מקור הגעה</Label>
            <Input
              id="lead-source-name"
              autoFocus
              value={formValues.name}
              onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="לדוגמה: אינסטגרם"
              className="text-right"
              dir="rtl"
              disabled={isSubmitting}
            />
            {!formValues.name.trim() && (
              <p className="text-xs text-red-500">שם מקור ההגעה הוא שדה חובה.</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
          <Button onClick={handleSubmit} disabled={isSubmitting || !formValues.name.trim()} className="flex items-center gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            בטל
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
