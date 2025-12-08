import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ManagerStation } from "../types"
import { DndContext, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CheckCircle2, Loader2, SlidersHorizontal, GripVertical } from "lucide-react"
import type { ReactNode } from "react"

interface StationFilterItemProps {
  station: ManagerStation
  isSelected: boolean
  onToggle: (stationId: string, next: boolean) => void
}

function StationFilterItem({ station, isSelected, onToggle }: StationFilterItemProps) {
  const isGardenStation = station.serviceType === "garden"
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: station.id,
    disabled: isGardenStation,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const draggableProps = isGardenStation ? {} : { ...attributes, ...listeners }

  return (
    <div ref={setNodeRef} style={style}>
      <div className={cn("flex w-full items-center gap-2", isDragging && "opacity-80")}>
        <button
          type="button"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md  text-gray-400 transition-colors",
            isGardenStation
              ? "cursor-default "
              : " border border-transparent hover:border-blue-200 hover:text-blue-700"
          )}
          aria-label="שנה סדר עמדה"
          {...draggableProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(station.id, !isSelected)}
          className={cn(
            "flex flex-1 items-center justify-between rounded-md border px-3 py-2 text-right text-sm transition-colors",
            isGardenStation
              ? isSelected
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-emerald-100 bg-white text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50"
              : isSelected
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : "border-slate-200 text-gray-800 hover:border-blue-200 hover:bg-blue-50"
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn("font-medium", isGardenStation ? "text-emerald-900" : "text-gray-900")}>
              {station.name}
            </span>
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-[11px]",
                isGardenStation ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-gray-600"
              )}
            >
              {station.serviceType === "garden" ? "גן" : "מספרה"}
            </span>
            {!station.isActive ? (
              <span className="text-xs text-amber-600">מושהית</span>
            ) : null}
          </div>
          {isSelected ? (
            <CheckCircle2 className={cn("h-4 w-4", isGardenStation ? "text-emerald-600" : "text-blue-600")} />
          ) : (
            <span
              className={cn(
                "h-4 w-4 rounded-full border bg-white",
                isGardenStation ? "border-emerald-300" : "border-slate-300"
              )}
            />
          )}
        </button>
      </div>
    </div>
  )
}

export interface StationFilterPopoverProps {
  stations: ManagerStation[]
  visibleStationIds: string[]
  onSelectAll: () => void
  onClear: () => void
  onRestoreDaily?: () => void
  onToggle: (stationId: string, next: boolean) => void
  sensors: any
  onReorderEnd: (event: DragEndEvent) => void
  isStationOrderSaving: boolean
  showWaitingListColumn: boolean
  waitingListCount: number
  onToggleWaitingList: (next: boolean) => void
  showPinnedAppointmentsColumn?: boolean
  pinnedAppointmentsCount?: number
  onTogglePinnedAppointments?: (next: boolean) => void
  showGardenColumn?: boolean
  onToggleGarden?: (next: boolean) => void
  trigger?: ReactNode
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
}

interface WaitingListItemProps {
  isVisible: boolean
  count: number
  onToggle: (next: boolean) => void
}

function WaitingListFilterItem({ isVisible, count, onToggle }: WaitingListItemProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md ">
        <GripVertical className="h-4 w-4 opacity-40" />
      </div>
      <button
        type="button"
        onClick={() => onToggle(!isVisible)}
        className={cn(
          "flex flex-1 items-center justify-between rounded-md border px-3 py-2 text-right text-sm transition-colors",
          isVisible
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-emerald-100 bg-white text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50"
        )}
      >
        <div className="flex flex-col items-end">
          <span className="font-semibold">רשימת המתנה</span>
          <span className="text-xs text-emerald-700">{count} ממתינים</span>
        </div>
        {isVisible ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <span className="h-4 w-4 rounded-full border border-emerald-200 bg-white" />
        )}
      </button>
    </div>
  )
}

function PinnedAppointmentsFilterItem({ isVisible, count, onToggle }: PinnedAppointmentsFilterItemProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md ">
        <GripVertical className="h-4 w-4 opacity-40" />
      </div>
      <button
        type="button"
        onClick={() => onToggle(!isVisible)}
        className={cn(
          "flex flex-1 items-center justify-between rounded-md border px-3 py-2 text-right text-sm transition-colors",
          isVisible
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-amber-100 bg-white text-amber-800 hover:border-amber-200 hover:bg-amber-50"
        )}
      >
        <div className="flex flex-col items-end">
          <span className="font-semibold">תורים מסומנים</span>
          <span className="text-xs text-amber-700">{count} מסומנים</span>
        </div>
        {isVisible ? (
          <CheckCircle2 className="h-4 w-4 text-amber-600" />
        ) : (
          <span className="h-4 w-4 rounded-full border border-amber-200 bg-white" />
        )}
      </button>
    </div>
  )
}

interface GardenFilterItemProps {
  isVisible: boolean
  onToggle: (next: boolean) => void
}

function GardenFilterItem({ isVisible, onToggle }: GardenFilterItemProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md ">
        <GripVertical className="h-4 w-4 opacity-40" />
      </div>
      <button
        type="button"
        onClick={() => onToggle(!isVisible)}
        className={cn(
          "flex flex-1 items-center justify-between rounded-md border px-3 py-2 text-right text-sm transition-colors",
          isVisible
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-emerald-100 bg-white text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50"
        )}
      >
        <div className="flex flex-col items-end">
          <span className="font-semibold">גן</span>
        </div>
        {isVisible ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <span className="h-4 w-4 rounded-full border border-emerald-200 bg-white" />
        )}
      </button>
    </div>
  )
}

export function StationFilterPopover({
  stations,
  visibleStationIds,
  onSelectAll,
  onClear,
  onToggle,
  sensors,
  onReorderEnd,
  isStationOrderSaving,
  showWaitingListColumn,
  waitingListCount,
  onToggleWaitingList,
  showPinnedAppointmentsColumn,
  pinnedAppointmentsCount,
  onTogglePinnedAppointments,
  showGardenColumn,
  onToggleGarden,
  trigger,
  align = "end",
  side = "bottom",
  onRestoreDaily,
}: StationFilterPopoverProps) {
  if (!stations.length) return null

  const selectedCount = visibleStationIds.length === 0 ? stations.length : visibleStationIds.length
  // Filter out "גן הכלבים" (Dog Garden) - we only show the "גן" filter item, not the actual station
  const gardenStations = stations.filter((station) => station.serviceType === "garden" && station.name !== "גן הכלבים")
  const otherStations = stations.filter((station) => station.serviceType !== "garden")

  const defaultTrigger = (
    <Button type="button" variant="outline" size="sm" className="flex items-center gap-2 text-sm font-medium">
      <SlidersHorizontal className="h-4 w-4" />
      <span>עמדות</span>
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
        {selectedCount}/{stations.length}
      </span>
    </Button>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align={align} side={side}>
        <div className="p-3 space-y-3" dir="rtl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                disabled={visibleStationIds.length === stations.length}
                className="h-7 px-2 text-xs"
              >
                בחר הכל
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={visibleStationIds.length === 0}
                className="h-7 px-2 text-xs"
              >
                נקה
              </Button>
              {onRestoreDaily && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRestoreDaily}
                  className="h-7 px-2 text-xs"
                >
                  שחזר להגדרות יומיות
                </Button>
              )}
            </div>
            {isStationOrderSaving && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>שומר...</span>
              </span>
            )}
          </div>
          <DndContext sensors={sensors} onDragEnd={onReorderEnd}>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {showPinnedAppointmentsColumn !== undefined && pinnedAppointmentsCount !== undefined && onTogglePinnedAppointments && (
                <PinnedAppointmentsFilterItem
                  isVisible={showPinnedAppointmentsColumn}
                  count={pinnedAppointmentsCount}
                  onToggle={onTogglePinnedAppointments}
                />
              )}
              <WaitingListFilterItem
                isVisible={showWaitingListColumn}
                count={waitingListCount}
                onToggle={onToggleWaitingList}
              />
              {showGardenColumn !== undefined && onToggleGarden && (
                <GardenFilterItem
                  isVisible={showGardenColumn}
                  onToggle={onToggleGarden}
                />
              )}
              {gardenStations.map((station) => (
                <StationFilterItem
                  key={`garden-station-filter-item-${station.id}`}
                  station={station}
                  isSelected={visibleStationIds.includes(station.id)}
                  onToggle={onToggle}
                />
              ))}
              <SortableContext items={otherStations.map((station) => station.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {otherStations.map((station) => (
                    <StationFilterItem
                      key={`station-filter-item-${station.id}`}
                      station={station}
                      isSelected={visibleStationIds.includes(station.id)}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  )
}
