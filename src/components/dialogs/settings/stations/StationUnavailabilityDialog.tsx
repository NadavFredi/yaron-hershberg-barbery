import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface StationUnavailabilityDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    stationName?: string
    formData: {
        reason: string
        notes: string
        start_time: string
        end_time: string
    }
    onFormChange: (updates: Partial<StationUnavailabilityDialogProps["formData"]>) => void
    onSave: () => void
    isSaving: boolean
}

export function StationUnavailabilityDialog({
    open,
    onOpenChange,
    stationName,
    formData,
    onFormChange,
    onSave,
    isSaving,
}: StationUnavailabilityDialogProps) {
    const isSaveDisabled = !formData.start_time || !formData.end_time || isSaving

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>הוסף אילוץ לעמדה</DialogTitle>
                    <DialogDescription>
                        {stationName ? `אילוץ לעמדה ${stationName}` : "הגדרת זמינות לעמדה"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="unavailability-reason">סיבה</Label>
                        <Input
                            id="unavailability-reason"
                            placeholder="סיבת האילוץ (לא חובה)"
                            value={formData.reason}
                            onChange={(event) => onFormChange({ reason: event.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="unavailability-notes">הערות</Label>
                        <Textarea
                            id="unavailability-notes"
                            placeholder="פרטים נוספים"
                            value={formData.notes}
                            onChange={(event) => onFormChange({ notes: event.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="unavailability-start">תחילת האילוץ</Label>
                        <Input
                            id="unavailability-start"
                            type="datetime-local"
                            value={formData.start_time}
                            onChange={(event) => onFormChange({ start_time: event.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="unavailability-end">סיום האילוץ</Label>
                        <Input
                            id="unavailability-end"
                            type="datetime-local"
                            value={formData.end_time}
                            onChange={(event) => onFormChange({ end_time: event.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter className="sm:justify-start gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        ביטול
                    </Button>
                    <Button onClick={onSave} disabled={isSaveDisabled}>
                        {isSaving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                        שמור
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
