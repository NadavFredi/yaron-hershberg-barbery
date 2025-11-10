import { format } from "date-fns"
import { CalendarX, Clock, MapPin } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface ConstraintDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedConstraint: {
        id: string
        station_id: string
        reason: string | null
        notes: Record<string, any> | null
        start_time: string
        end_time: string
    } | null
    stationName?: string
}

const extractCustomReason = (notes: { text?: string } | null): string | null => {
    if (!notes?.text) return null
    const match = notes.text.match(/\[CUSTOM_REASON:(.+?)\]/)
    return match ? match[1] : null
}

const getConstraintDisplayReason = (reason: string | null, notes: Record<string, any> | null): string => {
    // First check if there's an enum reason
    if (reason) {
        const reasonLabels: Record<string, string> = {
            sick: "מחלה",
            vacation: "חופשה",
            ad_hoc: "אד-הוק",
        }
        return reasonLabels[reason] || reason
    }
    
    // Then check for custom reason in notes
    if (notes && typeof notes === 'object') {
        const customReason = extractCustomReason(notes as { text?: string } | null)
        if (customReason) {
            return customReason
        }
    }
    
    return "ללא סיבה"
}

export const ConstraintDetailsSheet = ({
    open,
    onOpenChange,
    selectedConstraint,
    stationName,
}: ConstraintDetailsSheetProps) => {
    if (!selectedConstraint) {
        return null
    }

    const startDate = new Date(selectedConstraint.start_time)
    const endDate = new Date(selectedConstraint.end_time)
    const dateStr = format(startDate, "dd.MM.yyyy")
    const timeRange = `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`
    const reasonText = getConstraintDisplayReason(selectedConstraint.reason, selectedConstraint.notes)
    
    // Calculate duration
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
    let durationStr: string
    
    if (durationMinutes >= 24 * 60) {
        // More than 24 hours - show in days and hours
        const days = Math.floor(durationMinutes / (24 * 60))
        const remainingMinutes = durationMinutes % (24 * 60)
        const hours = Math.floor(remainingMinutes / 60)
        const mins = remainingMinutes % 60
        
        if (hours > 0 && mins > 0) {
            durationStr = `${days} ימים, ${hours} שעות ו-${mins} דקות`
        } else if (hours > 0) {
            durationStr = `${days} ימים ו-${hours} שעות`
        } else if (mins > 0) {
            durationStr = `${days} ימים ו-${mins} דקות`
        } else {
            durationStr = `${days} ימים`
        }
    } else {
        // Less than 24 hours - show in hours and minutes
        const hours = Math.floor(durationMinutes / 60)
        const mins = durationMinutes % 60
        if (hours > 0 && mins > 0) {
            durationStr = `${hours} שעות ו-${mins} דקות`
        } else if (hours > 0) {
            durationStr = `${hours} שעות`
        } else {
            durationStr = `${mins} דקות`
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full max-w-md overflow-y-auto" dir="rtl">
                <SheetHeader>
                    <SheetTitle className="text-right flex items-center gap-2">
                        <CalendarX className="h-5 w-5 text-orange-600" />
                        פרטי אילוץ
                    </SheetTitle>
                    <SheetDescription className="text-right">
                        צפו בכל הפרטים על האילוץ.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6 text-right">
                    {/* Reason */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-900">סיבה</h3>
                        <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-800">
                            {reasonText}
                        </Badge>
                    </div>

                    <Separator />

                    {/* Date & Time */}
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
                            <div className="flex-1 space-y-1">
                                <div className="text-sm font-semibold text-gray-900">תאריך ושעה</div>
                                <div className="text-sm text-gray-600">
                                    <div>{dateStr}</div>
                                    <div className="font-medium">{timeRange}</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
                            <div className="flex-1 space-y-1">
                                <div className="text-sm font-semibold text-gray-900">משך זמן</div>
                                <div className="text-sm text-gray-600">{durationStr}</div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Station */}
                    {stationName && (
                        <div className="space-y-2">
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                                <div className="flex-1 space-y-1">
                                    <div className="text-sm font-semibold text-gray-900">עמדה</div>
                                    <div className="text-sm text-gray-600">{stationName}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {selectedConstraint.notes && typeof selectedConstraint.notes === 'object' && (selectedConstraint.notes as any).text && (() => {
                        // Extract notes text without the custom reason marker
                        const notesText = (selectedConstraint.notes as any).text as string
                        const notesWithoutReason = notesText.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "").trim()
                        
                        if (!notesWithoutReason) return null
                        
                        return (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-gray-900">הערות</h3>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                        {notesWithoutReason}
                                    </p>
                                </div>
                            </>
                        )
                    })()}
                </div>
            </SheetContent>
        </Sheet>
    )
}

