import { useMemo } from "react"
import { addHours, format, startOfDay } from "date-fns"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConstraintManagerPanel } from "@/components/settings/SettingsConstraintsSection/SettingsConstraintsSection"

interface StationConstraintsContext {
    stationId: string
    stationName: string
    date: Date
}

interface StationConstraintsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    context: StationConstraintsContext | null
}

export function StationConstraintsModal({ open, onOpenChange, context }: StationConstraintsModalProps) {
    const defaultRange = useMemo(() => {
        if (!context) return null
        const dayStart = startOfDay(context.date)
        return {
            start: dayStart,
            end: addHours(dayStart, 24),
        }
    }, [context?.stationId, context ? context.date.getTime() : null])

    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent dir="rtl" className="max-w-6xl w-[95vw] h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {context ? `ניהול אילוצים לעמדה ${context.stationName}` : "ניהול אילוצים"}
                    </DialogTitle>
                    {context && (
                        <DialogDescription className="text-right">
                            {`תאריך ${format(context.date, "dd/MM/yyyy")}`}
                        </DialogDescription>
                    )}
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    {context && defaultRange ? (
                        <div className="h-full overflow-auto pr-1">
                            <ConstraintManagerPanel
                                key={`${context.stationId}-${context.date.toISOString()}`}
                                showHeader={false}
                                defaultFilterType="custom"
                                defaultCustomRange={defaultRange}
                                defaultStationIds={[context.stationId]}
                                autoSyncFilters
                            />
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            טוען אילוצים...
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

