import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { DndContext, closestCenter, DragEndEvent, Sensors } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableStationItem } from "./SortableStationItem"
import type { Station } from "../SettingsBreedStationMatrixSection.module"

interface StationSelectionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    allStations: Station[]
    selectedStationIds: string[]
    onToggleStation: (stationId: string) => void
    onDragEnd: (event: DragEndEvent) => void
    sensors: Sensors
}

export function StationSelectionDialog({
    open,
    onOpenChange,
    allStations,
    selectedStationIds,
    onToggleStation,
    onDragEnd,
    sensors
}: StationSelectionDialogProps) {
    // Get selected and unselected stations (all together, not split)
    const selectedStations = useMemo(() => {
        return selectedStationIds
            .map(id => allStations.find(s => s.id === id))
            .filter((s): s is Station => s !== undefined)
    }, [selectedStationIds, allStations])

    const unselectedStations = useMemo(() => {
        return allStations.filter(s => !selectedStationIds.includes(s.id))
    }, [allStations, selectedStationIds])

    const handleMarkAll = () => {
        unselectedStations.forEach(station => {
            onToggleStation(station.id)
        })
    }

    const handleClearAll = () => {
        selectedStations.forEach(station => {
            onToggleStation(station.id)
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild >
                <Button variant="outline" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    בחר עמדות
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader className="text-right ">
                    <DialogTitle className="text-right">בחר וסדר עמדות</DialogTitle>
                    <DialogDescription className="text-right">בחר אילו עמדות להציג ובאיזה סדר. גרור את העמדות לסידור מחדש</DialogDescription>
                </DialogHeader>
                <div className="flex gap-2 justify-end mb-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAll}
                        disabled={unselectedStations.length === 0}
                    >
                        סמן הכל
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearAll}
                        disabled={selectedStations.length === 0}
                    >
                        נקה הכל
                    </Button>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <div className="space-y-4 max-h-[400px] overflow-y-auto py-4">
                        {/* Selected stations - sortable */}
                        {selectedStations.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">עמדות נבחרות (גרור לסידור מחדש)</h4>
                                <SortableContext
                                    items={selectedStationIds}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {selectedStations.map((station) => {
                                        const orderInSelected = selectedStationIds.indexOf(station.id) + 1
                                        return (
                                            <SortableStationItem
                                                key={station.id}
                                                station={station}
                                                isSelected
                                                order={orderInSelected}
                                                onToggle={onToggleStation}
                                            />
                                        )
                                    })}
                                </SortableContext>
                            </div>
                        )}

                        {/* Unselected stations - not sortable */}
                        {unselectedStations.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">עמדות זמינות</h4>
                                {unselectedStations.map((station) => (
                                    <SortableStationItem
                                        key={station.id}
                                        station={station}
                                        isSelected={false}
                                        order={0}
                                        onToggle={onToggleStation}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </DndContext>
            </DialogContent>
        </Dialog>
    )
}

