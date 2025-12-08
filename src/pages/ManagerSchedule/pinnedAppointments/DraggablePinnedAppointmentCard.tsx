import { useDraggable } from "@dnd-kit/core"
import type React from "react"
import { cn } from "@/lib/utils"
import type { ManagerAppointment } from "../types"
import type { PinnedAppointment } from "./pinnedAppointmentsService"

interface DraggablePinnedAppointmentCardProps {
  pin: PinnedAppointment
  appointment: ManagerAppointment
  renderCard: (pin: PinnedAppointment, appointment: ManagerAppointment, isDragging: boolean) => React.ReactNode
}

export function DraggablePinnedAppointmentCard({
  pin,
  appointment,
  renderCard,
}: DraggablePinnedAppointmentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `pinned-${pin.id}`,
    data: {
      type: "pinned-appointment",
      pin,
      appointment,
    },
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseDown={(e) => {
        // Don't start drag if clicking on dropdown menu or any element with data-dnd-kit-no-drag
        const target = e.target as HTMLElement
        if (target.closest('[data-dnd-kit-no-drag]') || target.closest('[role="menuitem"]')) {
          e.stopPropagation()
          return
        }
        e.stopPropagation()
      }}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-50")}
    >
      {renderCard(pin, appointment, isDragging)}
    </div>
  )
}

