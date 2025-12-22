import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Info } from "lucide-react"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface EditSeriesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: ManagerAppointment | null
    onConfirm: (modifyAll: boolean) => void
}

export function EditSeriesDialog({
    open,
    onOpenChange,
    appointment,
    onConfirm,
}: EditSeriesDialogProps) {
    const [modifyAll, setModifyAll] = React.useState(false)

    const handleConfirm = () => {
        onConfirm(modifyAll)
        onOpenChange(false)
        setModifyAll(false)
    }

    const handleCancel = () => {
        onOpenChange(false)
        setModifyAll(false)
    }

    if (!appointment) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>עריכת תור בסדרה</DialogTitle>
                    <DialogDescription>
                        תור זה שייך לסדרת תורים. האם תרצה לערוך את כל התורים בסדרה או רק את התור הזה?
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <RadioGroup value={modifyAll ? "all" : "single"} onValueChange={(value) => setModifyAll(value === "all")}>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="single" id="single" />
                            <Label htmlFor="single" className="cursor-pointer">
                                ערוך רק את התור הזה
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all" className="cursor-pointer">
                                ערוך את כל התורים בסדרה
                            </Label>
                        </div>
                    </RadioGroup>
                    <div className="flex items-center gap-2 space-x-2 rtl:space-x-reverse bg-primary/10 border border-primary/20 rounded-md p-3">
                        <Info className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="text-sm text-primary">
                            {modifyAll ? (
                                <p>כל התורים בסדרה יעודכנו עם השינויים שביצעת.</p>
                            ) : (
                                <p>רק התור הזה יעודכן. שאר התורים בסדרה יישארו ללא שינוי.</p>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancel}>
                        ביטול
                    </Button>
                    <Button onClick={handleConfirm}>
                        המשך
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

