import { Checkbox } from "@/components/ui/checkbox"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { Station } from "../SettingsServiceStationMatrixSection.module"

interface SortableStationItemProps {
    station: Station
    isSelected: boolean
    order: number
    onToggle: (stationId: string) => void
}

export function SortableStationItem({ station, isSelected, order, onToggle }: SortableStationItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: station.id,
        disabled: !isSelected,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 p-2 border rounded ${
                station.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'
            }`}
        >
            {isSelected && (
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
            )}
            <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(station.id)}
                className="scale-125"
            />
            <span className={`flex-1 font-medium ${!station.is_active ? 'text-gray-500' : ''}`}>
                {station.name}
            </span>
            {!station.is_active && (
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded" title="עמדה לא פעילה">
                    לא פעילה
                </span>
            )}
            {isSelected && (
                <span className="text-xs text-gray-500 w-8 text-center">{order}</span>
            )}
        </div>
    )
}

