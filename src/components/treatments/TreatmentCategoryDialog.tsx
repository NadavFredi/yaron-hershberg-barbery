import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface TreatmentCategoryDialogProps {
    open: boolean
    mode: "create" | "edit"
    entityLabel: string
    isSubmitting: boolean
    initialName?: string
    onSubmit: (name: string) => void
    onClose: () => void
}

export function TreatmentCategoryDialog({
    open,
    mode,
    entityLabel,
    isSubmitting,
    initialName = "",
    onSubmit,
    onClose,
}: TreatmentCategoryDialogProps) {
    const [name, setName] = useState(initialName)

    useEffect(() => {
        if (open) {
            setName(initialName)
        }
    }, [open, initialName])

    const handleSubmit = () => {
        const trimmed = name.trim()
        if (!trimmed) {
            return
        }
        onSubmit(trimmed)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!isSubmitting && !next) {
                onClose()
            }
        }}>
            <DialogContent dir="rtl" className="max-w-md text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">
                        {mode === "create" ? `הוסף ${entityLabel}` : `ערוך ${entityLabel}`}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {mode === "create"
                            ? `הוסף ${entityLabel} חדש לניהול טוב יותר של הכלבים.`
                            : `עדכן את שם ${entityLabel} לבחירתך.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                        <span>שם {entityLabel}</span>
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={`שם ${entityLabel}...`}
                            dir="rtl"
                            className="text-right"
                            autoFocus
                        />
                    </label>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
                        {isSubmitting ? "שומר..." : "שמור"}
                    </Button>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

