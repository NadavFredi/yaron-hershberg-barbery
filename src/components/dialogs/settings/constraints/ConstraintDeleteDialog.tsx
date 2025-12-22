import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { format, parseISO } from "date-fns"

interface Constraint {
    id: string
    station_id: string
    reason: string | null
    notes: { text?: string } | null
    start_time: string
    end_time: string
}

interface ConstraintDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    constraint: Constraint | null
    stationNames: string[]
    deleteFromAllStations: boolean
    onDeleteFromAllStationsChange: (deleteFromAll: boolean) => void
    onConfirm: () => void
    onCancel: () => void
    isLoading?: boolean
    isFromSettingsPage?: boolean
}

// Helper function to extract custom reason from notes
const extractCustomReason = (notes: { text?: string } | null): string | null => {
    if (!notes?.text) return null
    const match = notes.text.match(/\[CUSTOM_REASON:([^\]]+)\]/)
    return match ? match[1] : null
}

// Helper function to get display reason
const getConstraintDisplayReason = (reason: string | null, notes: { text?: string } | null): string => {
    if (reason) {
        const reasonLabels: Record<string, string> = {
            sick: "מחלה",
            vacation: "חופשה",
            ad_hoc: "אד-הוק",
        }
        return reasonLabels[reason] || reason
    }
    const customReason = extractCustomReason(notes)
    return customReason || "ללא סיבה"
}

export const ConstraintDeleteDialog: React.FC<ConstraintDeleteDialogProps> = ({
    open,
    onOpenChange,
    constraint,
    stationNames,
    deleteFromAllStations,
    onDeleteFromAllStationsChange,
    onConfirm,
    onCancel,
    isLoading = false,
    isFromSettingsPage = false,
}) => {
    if (!constraint) return null

    const startDate = parseISO(constraint.start_time)
    const endDate = parseISO(constraint.end_time)
    const reasonText = getConstraintDisplayReason(constraint.reason, constraint.notes)
    const notesText = constraint.notes?.text?.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "") || ""

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">מחיקת אילוץ</DialogTitle>
                    <DialogDescription className="text-right">
                        האם אתה בטוח שברצונך למחוק את האילוץ?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Constraint Details */}
                    <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-gray-600">עמדות:</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {stationNames.map((name, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-block px-2 py-1 bg-primary/20 text-primary rounded text-sm"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm text-gray-600">סיבה:</Label>
                                <p className="text-sm font-medium mt-1">{reasonText || "-"}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-gray-600">תאריך ושעה התחלה:</Label>
                                <p className="text-sm font-medium mt-1">
                                    {startDate ? format(startDate, "dd/MM/yyyy HH:mm") : "-"}
                                </p>
                            </div>
                            <div>
                                <Label className="text-sm text-gray-600">תאריך ושעה סיום:</Label>
                                <p className="text-sm font-medium mt-1">
                                    {endDate ? format(endDate, "dd/MM/yyyy HH:mm") : "-"}
                                </p>
                            </div>
                        </div>

                        {notesText && (
                            <div>
                                <Label className="text-sm text-gray-600">הערות:</Label>
                                <p className="text-sm mt-1">{notesText}</p>
                            </div>
                        )}
                    </div>

                    {/* Multi-station selection */}
                    {stationNames.length > 1 && (
                        <div className="space-y-3 border rounded-lg p-4">
                            <Label className="text-base font-semibold">אפשרויות מחיקה:</Label>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="delete-all"
                                        checked={deleteFromAllStations}
                                        onCheckedChange={(checked) => onDeleteFromAllStationsChange(checked === true)}
                                    />
                                    <Label htmlFor="delete-all" className="cursor-pointer text-sm">
                                        מחק מכל העמדות ({stationNames.length} עמדות)
                                    </Label>
                                </div>
                                {!isFromSettingsPage && (
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="delete-current"
                                            checked={!deleteFromAllStations}
                                            onCheckedChange={(checked) => onDeleteFromAllStationsChange(checked !== true)}
                                        />
                                        <Label htmlFor="delete-current" className="cursor-pointer text-sm">
                                            מחק רק מהעמדה הראשונה ({stationNames[0]})
                                        </Label>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0" dir="rtl">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        ביטול
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? "מוחק..." : "מחק"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

