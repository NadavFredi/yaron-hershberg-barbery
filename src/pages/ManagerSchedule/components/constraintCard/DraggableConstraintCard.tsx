import { useDraggable } from "@dnd-kit/core"
import { addMinutes, differenceInMinutes, format, max, min } from "date-fns"
import { ChevronDown, ChevronUp, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type React from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  addExpandedConstraint,
  removeExpandedConstraint,
  setSelectedConstraint,
  setIsConstraintDetailsOpen,
} from "@/store/slices/managerScheduleSlice"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { PIXELS_PER_MINUTE_SCALE, parseISODate } from "../../managerSchedule.module"

const extractCustomReason = (notes: { text?: string } | null): string | null => {
  if (!notes?.text) return null
  const match = notes.text.match(/\[CUSTOM_REASON:(.+?)\]/)
  return match ? match[1] : null
}

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
  return customReason || "אילוץ"
}

interface Constraint {
  id: string
  station_id: string
  reason: string | null
  notes: { text?: string } | null
  start_time: string
  end_time: string
  is_active: boolean
}

interface DraggableConstraintCardProps {
  constraint: Constraint
  timeline: {
    start: Date
    end: Date
  }
  pixelsPerMinuteScale: number
  intervalMinutes: number
  onEdit: (constraint: Constraint) => void
  onDuplicate: (constraint: Constraint) => void
  onDelete: (constraintId: string) => void
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, constraint: Constraint) => void
}

export function DraggableConstraintCard({
  constraint,
  timeline,
  pixelsPerMinuteScale,
  intervalMinutes,
  onEdit,
  onDuplicate,
  onDelete,
  onResizeStart,
}: DraggableConstraintCardProps) {
  const dispatch = useAppDispatch()
  const constraintResizingPreview = useAppSelector((state) => state.managerSchedule.constraintResizingPreview)
  const expandedConstraints = useAppSelector((state) => state.managerSchedule.expandedConstraints)
  const highlightedSlots = useAppSelector((state) => state.managerSchedule.highlightedSlots)
  const draggedConstraint = useAppSelector((state) => state.managerSchedule.draggedConstraint)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: constraint.id,
    data: {
      type: 'constraint',
      constraint,
    },
    disabled: false,
  })

  const startDate = parseISODate(constraint.start_time)
  const endDate = parseISODate(constraint.end_time)

  if (!startDate || !endDate) {
    return null
  }

  // Check if constraint overlaps with the timeline
  const timelineStart = timeline.start
  const timelineEnd = timeline.end

  const constraintStart = max([startDate, timelineStart])
  const constraintEnd = min([endDate, timelineEnd])

  if (constraintEnd <= constraintStart) {
    return null // Constraint doesn't overlap with visible timeline
  }

  const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
  const top = differenceInMinutes(constraintStart, timelineStart) * pixelsPerMinute

  // Use resizing preview end date if available
  const previewEndDate = constraintResizingPreview?.constraintId === constraint.id && constraintResizingPreview.endDate
    ? parseISODate(constraintResizingPreview.endDate)
    : null
  const effectiveEndDate = previewEndDate ?? constraintEnd
  const originalHeight = Math.max(1, differenceInMinutes(effectiveEndDate, constraintStart) * pixelsPerMinute)
  const isResizing = Boolean(previewEndDate)

  const reasonText = getConstraintDisplayReason(constraint.reason, constraint.notes)

  // If dragging and we have target time, show both original and target times
  const startDateFormatted = format(startDate, "HH:mm")
  const endDateFormatted = format(endDate, "HH:mm")
  let timeRangeLabel = `${startDateFormatted} - ${endDateFormatted}`
  if (isDragging && highlightedSlots && draggedConstraint.constraint && draggedConstraint.constraint.id === constraint.id) {
    const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
    const constraintDurationMinutes = differenceInMinutes(endDate, startDate)
    const targetEndTime = addMinutes(targetStartTime, constraintDurationMinutes)
    const targetTimeRangeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
    timeRangeLabel = `${timeRangeLabel} ← ${targetTimeRangeLabel}`
  }
  if (previewEndDate) {
    const previewRangeLabel = `${format(startDate, "HH:mm")} - ${format(previewEndDate, "HH:mm")}`
    timeRangeLabel = previewRangeLabel === `${startDateFormatted} - ${endDateFormatted}`
      ? previewRangeLabel
      : `${startDateFormatted} - ${endDateFormatted} ← ${previewRangeLabel}`
  }

  // Extract notes text without the custom reason marker
  let notes: string | null = null
  if (constraint.notes && typeof constraint.notes === 'object' && (constraint.notes as any).text) {
    const notesText = (constraint.notes as any).text as string
    const notesWithoutReason = notesText.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "").trim()
    if (notesWithoutReason) {
      notes = notesWithoutReason
    }
  }

  // Determine if card is "small" and needs expansion
  const isSmallCard = originalHeight < 100
  const hasExpandableContent = Boolean(notes)
  const isExpanded = expandedConstraints.includes(constraint.id)

  // Use expanded height if card is expanded, otherwise original height
  const height = (isExpanded && isSmallCard)
    ? Math.max(originalHeight, 150) // More generous expanded height
    : originalHeight

  // Expand/collapse handlers
  const handleExpandCard = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(addExpandedConstraint(constraint.id))
  }

  const handleCollapseCard = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(removeExpandedConstraint(constraint.id))
  }

  const style: React.CSSProperties = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    position: 'absolute' as const,
    top: `${top}px`,
    left: constraint.is_active ? '0' : '8px',
    right: constraint.is_active ? '0' : '8px',
    zIndex: 0
  } : {
    position: 'absolute' as const,
    top: `${top}px`,
    left: constraint.is_active ? '0' : '8px',
    right: constraint.is_active ? '0' : '8px',
    zIndex: 0
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, height, minHeight: height < 40 ? 40 : height }}
      {...listeners}
      {...attributes}
      onMouseDown={(e) => {
        // Don't start drag if clicking on resize handle or any element with data-dnd-kit-no-drag
        const target = e.target as HTMLElement
        if (target.closest('[data-dnd-kit-no-drag]')) {
          e.stopPropagation()
          return
        }
        e.stopPropagation()
      }}
      className={cn(
        // Active constraints: transparent green styling exactly like gray slots - full width, minimal styling
        "bg-orange-100  border-orange-300 rounded-md opacity-80 hover:opacity-100 transition-opacity group flex flex-col cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        isResizing && constraint.is_active
          ? "ring-2 ring-green-400/70 shadow-md"
          : "ring-2 ring-orange-400/70 shadow-md"
      )}
      onClick={(e) => {
        // Don't open details while actively resizing
        if (isResizing) {
          return
        }
        // Don't open details if clicking on the menu button or expand button
        if ((e.target as HTMLElement).closest('[data-constraint-menu]') ||
          (e.target as HTMLElement).closest('[data-constraint-expand]')) {
          return
        }
        dispatch(setSelectedConstraint(constraint))
        dispatch(setIsConstraintDetailsOpen(true))
      }}
    >
      {/* 3-dots menu and expand/collapse icon positioned at top-left (RTL: right side) */}
      <div className="absolute top-1 left-1 flex items-center gap-1" style={{ zIndex: 20 }}>
        {/* Expand/Collapse icon for small cards - appears first (rightmost in RTL) */}
        {(isSmallCard && hasExpandableContent) || isExpanded ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0 bg-white/90 backdrop-blur-sm rounded-full shadow-sm",
              constraint.is_active
                ? "text-green-700 hover:text-green-900 hover:bg-green-200"
                : "text-orange-700 hover:text-orange-900 hover:bg-orange-200"
            )}
            data-constraint-expand
            title={isExpanded ? "כווץ" : "הרחב"}
            onClick={isExpanded ? handleCollapseCard : handleExpandCard}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        ) : null}

        {/* 3-dots menu - appears second (left of collapse icon in RTL, making it leftest) */}
        <div
          data-constraint-menu
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 w-6 p-0 bg-white/90 backdrop-blur-sm rounded-full shadow-sm",
                  constraint.is_active
                    ? "text-green-700 hover:text-green-900 hover:bg-green-200"
                    : "text-orange-700 hover:text-orange-900 hover:bg-orange-200"
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start" dir="rtl" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(constraint)
                  }}
                >
                  <Pencil className="h-4 w-4 ml-2" />
                  ערוך
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(constraint)
                  }}
                >
                  <Copy className="h-4 w-4 ml-2" />
                  שכפל
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(constraint.id)
                  }}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  מחק
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Constraint content - time at top, then reason, then notes */}
      <div className={cn(
        "flex flex-col flex-1 px-2 py-2 text-right pointer-events-none",
        !isExpanded && "overflow-hidden" // Hide overflowing content when not expanded
      )}>
        {/* For active constraints: show reason prominently, time less prominently */}
        {constraint.is_active ? (
          <>
            {/* Reason is the main content for active constraints */}
            <div className="text-sm font-semibold text-green-900 mb-0.5">
              {reasonText || "אילוץ פעיל"}
            </div>
            {/* Time shown smaller */}
            <div className="text-xs text-green-700/80">
              {timeRangeLabel}
            </div>
          </>
        ) : (
          <>
            {/* Time at the top */}
            <div className={cn(
              "text-xs text-gray-600 mb-1",
              isResizing && "font-medium text-orange-700"
            )}>
              {timeRangeLabel}
            </div>
            {/* Reason */}
            <div className="text-xs font-medium text-orange-800 mb-1">
              {reasonText}
            </div>
          </>
        )}

        {/* Notes if available */}
        {notes && (
          <div className={cn(
            "text-xs mt-1",
            constraint.is_active ? "text-green-700" : "text-orange-700",
            !isExpanded && "line-clamp-2"
          )}>
            {notes}
          </div>
        )}
      </div>
      {/* Resize handle at the bottom */}
      <button
        type="button"
        data-dnd-kit-no-drag
        onPointerDown={(event) => {
          event.stopPropagation()
          event.preventDefault()
          onResizeStart(event, constraint)
        }}
        onMouseDown={(event) => {
          event.stopPropagation()
          event.preventDefault()
        }}
        onTouchStart={(event) => {
          event.stopPropagation()
          event.preventDefault()
        }}
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-3 flex items-center justify-center cursor-ns-resize focus:outline-none z-10"
        title="שינוי אורך האילוץ"
      >
        <span
          className={cn(
            "h-1.5 w-12 rounded-full transition-colors",
            constraint.is_active
              ? "bg-green-400 hover:bg-green-500"
              : "bg-orange-400 hover:bg-orange-500",
            isResizing && (constraint.is_active ? "bg-green-500" : "bg-orange-500")
          )}
        />
      </button>
    </div>
  )
}
