import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

export type SubscriptionTypeFormValues = {
  name: string
  description: string
  price: string
  type: "entrances" | "days"
  totalEntries: string
  daysDuration: string
  expirationDays: string
  expiryCalculationMethod: "from_purchase_date" | "from_first_usage"
  isActive: boolean
  visibleToUsers: boolean
}

type SubscriptionTypeDialogMode = "create" | "edit"

interface SubscriptionTypeDialogProps {
  open: boolean
  mode: SubscriptionTypeDialogMode
  initialValues?: SubscriptionTypeFormValues
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (values: SubscriptionTypeFormValues) => Promise<void> | void
}

export function SubscriptionTypeDialog({
  open,
  mode,
  initialValues,
  isSubmitting = false,
  onClose,
  onSubmit,
}: SubscriptionTypeDialogProps) {
  const [formValues, setFormValues] = useState<SubscriptionTypeFormValues>({
    name: "",
    description: "",
    price: "",
    type: "entrances",
    totalEntries: "",
    daysDuration: "",
    expirationDays: "365",
    expiryCalculationMethod: "from_purchase_date",
    isActive: true,
    visibleToUsers: true,
  })

  useEffect(() => {
    if (open) {
      setFormValues(
        initialValues
          ? {
            name: initialValues.name,
            description: initialValues.description,
            price: initialValues.price,
            type: initialValues.type,
            totalEntries: initialValues.totalEntries,
            daysDuration: initialValues.daysDuration,
            expirationDays: initialValues.expirationDays,
            expiryCalculationMethod: initialValues.expiryCalculationMethod,
            isActive: initialValues.isActive,
            visibleToUsers: initialValues.visibleToUsers,
          }
          : {
            name: "",
            description: "",
            price: "",
            type: "entrances",
            totalEntries: "",
            daysDuration: "",
            expirationDays: "365",
            expiryCalculationMethod: "from_purchase_date",
            isActive: true,
            visibleToUsers: true,
          }
      )
    }
  }, [initialValues, open])

  const isCreateMode = mode === "create"

  const handleSubmit = async () => {
    const trimmedValues = {
      name: formValues.name.trim(),
      description: formValues.description.trim(),
      price: formValues.price.trim(),
      type: formValues.type,
      totalEntries: formValues.totalEntries.trim(),
      daysDuration: formValues.daysDuration.trim(),
      expirationDays: formValues.expirationDays.trim(),
      expiryCalculationMethod: formValues.expiryCalculationMethod,
      isActive: formValues.isActive,
    }

    if (!trimmedValues.name) {
      return
    }

    // Validate based on type
    if (trimmedValues.type === "entrances" && !trimmedValues.totalEntries) {
      return
    }
    if (trimmedValues.type === "days" && !trimmedValues.daysDuration) {
      return
    }
    if (!trimmedValues.expirationDays) {
      return
    }

    await onSubmit(trimmedValues)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen && !isSubmitting ? onClose() : undefined)}>
      <DialogContent dir="rtl" className="sm:max-w-lg text-right max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-right">{isCreateMode ? "הוסף סוג מנוי" : "ערוך סוג מנוי"}</DialogTitle>
          <DialogDescription className="text-right">
            {isCreateMode ? "מלא את הפרטים כדי ליצור סוג מנוי חדש." : "עדכן את הפרטים של סוג המנוי."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 overflow-y-auto flex-1 min-h-0 pr-4" style={{ scrollbarGutter: 'stable', direction: 'ltr' }} dir="ltr">
          <div className="space-y-4" dir="rtl">
            <div className="space-y-2">
              <Label htmlFor="subscription-type-name">שם סוג</Label>
              <Input
                id="subscription-type-name"
                autoFocus
                value={formValues.name}
                onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="לדוגמה: חבילת 6 טיפולים"
                className="text-right"
                dir="rtl"
                disabled={isSubmitting}
              />
              {!formValues.name.trim() && <p className="text-xs text-red-500">שם הסוג הוא שדה חובה.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-type-price">מחיר (₪)</Label>
              <Input
                id="subscription-type-price"
                type="number"
                step="0.01"
                min="0"
                value={formValues.price}
                onChange={(event) => setFormValues((prev) => ({ ...prev, price: event.target.value }))}
                placeholder="0.00"
                className="text-right"
                dir="rtl"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-type-type">סוג מנוי</Label>
              <Select
                value={formValues.type}
                onValueChange={(value: "entrances" | "days") => setFormValues((prev) => ({ ...prev, type: value }))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="entrances">לפי כניסות</SelectItem>
                  <SelectItem value="days">לפי ימים</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formValues.type === "entrances" && (
              <div className="space-y-2">
                <Label htmlFor="subscription-type-entries">מספר כניסות</Label>
                <Input
                  id="subscription-type-entries"
                  type="number"
                  min="1"
                  value={formValues.totalEntries}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, totalEntries: event.target.value }))}
                  placeholder="לדוגמה: 6"
                  className="text-right"
                  dir="rtl"
                  disabled={isSubmitting}
                />
                {!formValues.totalEntries && <p className="text-xs text-red-500">מספר כניסות הוא שדה חובה.</p>}
              </div>
            )}

            {formValues.type === "days" && (
              <div className="space-y-2">
                <Label htmlFor="subscription-type-days">מספר ימים</Label>
                <Input
                  id="subscription-type-days"
                  type="number"
                  min="1"
                  value={formValues.daysDuration}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, daysDuration: event.target.value }))}
                  placeholder="לדוגמה: 90"
                  className="text-right"
                  dir="rtl"
                  disabled={isSubmitting}
                />
                {!formValues.daysDuration && <p className="text-xs text-red-500">מספר ימים הוא שדה חובה.</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subscription-type-expiration">ימי תפוגה</Label>
              <Input
                id="subscription-type-expiration"
                type="number"
                min="1"
                value={formValues.expirationDays}
                onChange={(event) => setFormValues((prev) => ({ ...prev, expirationDays: event.target.value }))}
                placeholder="365"
                className="text-right"
                dir="rtl"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">מספר הימים עד תפוגת המנוי</p>
              {!formValues.expirationDays && <p className="text-xs text-red-500">ימי תפוגה הוא שדה חובה.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-type-expiry-calculation">חישוב תפוגה</Label>
              <Select
                value={formValues.expiryCalculationMethod}
                onValueChange={(value: "from_purchase_date" | "from_first_usage") => setFormValues((prev) => ({ ...prev, expiryCalculationMethod: value }))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue placeholder="בחר שיטת חישוב" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="from_purchase_date">מתאריך רכישה</SelectItem>
                  <SelectItem value="from_first_usage">משימוש ראשון</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {formValues.expiryCalculationMethod === "from_purchase_date"
                  ? "תפוגת המנוי תחושב מתאריך הרכישה"
                  : "תפוגת המנוי תחושב מתאריך השימוש הראשון"}
              </p>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="is-active"
                checked={formValues.isActive}
                onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, isActive: checked === true }))}
                disabled={isSubmitting}
              />
              <Label htmlFor="is-active" className="text-sm font-normal cursor-pointer">
                פעיל (זמין לרכישה)
              </Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="visible-to-users"
                checked={formValues.visibleToUsers}
                onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, visibleToUsers: checked === true }))}
                disabled={isSubmitting}
              />
              <Label htmlFor="visible-to-users" className="text-sm font-normal cursor-pointer">
                גלוי למשתמשים
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subscription-type-description">תיאור (אופציונלי)</Label>
              <Textarea
                id="subscription-type-description"
                value={formValues.description}
                onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="הוסף הערות לגבי סוג זה"
                className="min-h-[100px] text-right"
                dir="rtl"
                disabled={isSubmitting}
              />
            </div>
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

