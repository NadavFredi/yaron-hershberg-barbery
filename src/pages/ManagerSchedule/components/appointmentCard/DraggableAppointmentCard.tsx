import { useDraggable } from "@dnd-kit/core"
import { differenceInMinutes } from "date-fns"
import type React from "react"
import { cn } from "@/lib/utils"
import type { ManagerAppointment } from "../../types"
import { PIXELS_PER_MINUTE_SCALE } from "../../managerSchedule.module"

const parseISODate = (value?: string | null): Date | null => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

interface DraggableAppointmentCardProps {
  appointment: ManagerAppointment
  pixelsPerMinuteScale: number
  timelineStart: Date
  disabled?: boolean
  renderAppointmentCard: (appointment: ManagerAppointment, isDragging: boolean, overlapCount?: number) => React.ReactNode
  overlapCount?: number
  zIndex?: number
}

export function DraggableAppointmentCard({
  appointment,
  pixelsPerMinuteScale,
  timelineStart,
  disabled = false,
  renderAppointmentCard,
  overlapCount = 0,
  zIndex = 2,
}: DraggableAppointmentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: appointment.id,
    data: {
      type: "appointment",
      appointment,
    },
    disabled,
  })

  const startDate = parseISODate(appointment.startDateTime)
  if (!startDate) {
    return null
  }
  const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
  const startMinutes = Math.max(0, differenceInMinutes(startDate, timelineStart))
  const top = startMinutes * pixelsPerMinute

  const style: React.CSSProperties = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      position: "absolute" as const,
      top: `${top}px`,
      left: "8px",
      right: "8px",
    }
    : {
      position: "absolute" as const,
      top: `${top}px`,
      left: "8px",
      right: "8px",
    }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, zIndex }}
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
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-50")}
    >
      {renderAppointmentCard(appointment, isDragging, overlapCount)}
    </div>
  )
}

