import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface TreatmentBulkAssignGenderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    isSubmitting: boolean
    onConfirm: (gender: "male" | "female") => void
}

export function TreatmentBulkAssignGenderDialog({
    open,
    onOpenChange,
    isSubmitting,
    onConfirm,
}: TreatmentBulkAssignGenderDialogProps) {
    const [gender, setGender] = useState<"male" | "female" | "">("")

    useEffect(() => {
        if (open) {
            setGender("male")
        } else {
            setGender("")
        }
    }, [open])

    const handleConfirm = () => {
        if (!gender) return
        onConfirm(gender)
    }

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!isSubmitting) {
                onOpenChange(next)
            }
        }}>
            <DialogContent dir="rtl" className="max-w-sm text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">עדכון מגדר לפרופילים שנבחרו</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את המגדר החדש שיוגדר לכל הפרופילים שנבחרו.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                        <span>בחר מין</span>
                        <Select value={gender} onValueChange={(value: "male" | "female") => setGender(value)}>
                            <SelectTrigger dir="rtl" className="text-right">
                                <SelectValue placeholder="בחר מין" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="male">זכר</SelectItem>
                                <SelectItem value="female">נקבה</SelectItem>
                            </SelectContent>
                        </Select>
                    </label>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleConfirm} disabled={isSubmitting || !gender}>
                        {isSubmitting ? "מעדכן..." : "עדכן מין"}
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

