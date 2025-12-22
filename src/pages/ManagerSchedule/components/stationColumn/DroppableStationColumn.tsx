import { addMinutes, differenceInMinutes, format } from "date-fns"
import { useDroppable } from "@dnd-kit/core"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { ManagerAppointment, ManagerStation } from "../../types"
import type { TimelineConfig } from "@/pages/ManagerSchedule/managerSchedule.module"
import { DraggableAppointmentCard } from "@/pages/ManagerSchedule/components/appointmentCard/DraggableAppointmentCard"
import { calculateAppointmentOverlaps, getOverlapCount, calculateZIndexForOverlap } from "../../utils/appointmentOverlaps"
import { PIXELS_PER_MINUTE_SCALE } from "../../managerSchedule.module"
import { snapTimeToInterval } from "../../constants"

interface HighlightedSlots {
  stationId: string
  startTimeSlot: number
  endTimeSlot: number
  allTimeSlots: number[]
}

interface DragToCreateState {
  isDragging: boolean
  startTime: Date | null
  endTime: Date | null
  stationId: string | null
}

interface DroppableStationColumnProps {
  station: ManagerStation
  timeline: TimelineConfig
  intervalMinutes: number
  pixelsPerMinuteScale: number
  appointments: ManagerAppointment[]
  stationConstraints: any[]
  hasWorkingHours: boolean
  highlightedSlots: HighlightedSlots | null
  dragToCreate: DragToCreateState
  onCreateDragStart: (event: React.MouseEvent, stationId: string) => void
  isSlotWithinWorkingHours: (slotTime: Date, stationId: string) => boolean
  isSlotGenerallyUnavailable: (slotTime: Date, stationId: string) => boolean
  isSlotCoveredByActiveConstraint: (slotTime: Date, stationId: string) => boolean
  isSlotEmptyButRestricted: (slotTime: Date, stationId: string, index: number) => boolean
  renderConstraintBlock: (constraint: any) => React.ReactNode
  resizingPreview: { appointmentId: string } | null
  renderAppointmentCard: (appointment: ManagerAppointment, isDragging: boolean) => React.ReactNode
  selectedDate: Date
  isAppointmentMenuOpen: boolean
}

export function DroppableStationColumn({
  station,
  timeline,
  intervalMinutes,
  pixelsPerMinuteScale,
  appointments,
  stationConstraints,
  highlightedSlots,
  dragToCreate,
  onCreateDragStart,
  isSlotWithinWorkingHours,
  isSlotGenerallyUnavailable,
  isSlotCoveredByActiveConstraint,
  isSlotEmptyButRestricted,
  renderConstraintBlock,
  resizingPreview,
  hasWorkingHours,
  renderAppointmentCard,
  selectedDate,
  isAppointmentMenuOpen,
}: DroppableStationColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: station.id,
    data: {
      type: "station",
      station,
    },
  })

  // Track hovered slot for preview
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null)
  const [mouseY, setMouseY] = useState<number | null>(null)

  // Calculate overlaps for appointments in this station
  const overlaps = useMemo(() => {
    return calculateAppointmentOverlaps(appointments)
  }, [appointments])

  // Check if a slot is empty (no appointments covering it)
  const isSlotEmpty = useMemo(() => {
    const slotMap = new Map<number, boolean>()
    timeline.slots.forEach((slot, index) => {
      const slotTime = addMinutes(timeline.start, index * intervalMinutes)
      const slotEndTime = addMinutes(slotTime, intervalMinutes)
      
      // Check if any appointment covers this slot
      const hasAppointment = appointments.some((appointment) => {
        const appointmentStart = appointment.startDateTime ? new Date(appointment.startDateTime) : null
        const appointmentEnd = appointment.endDateTime ? new Date(appointment.endDateTime) : null
        
        if (!appointmentStart || !appointmentEnd) return false
        
        // Check if appointment overlaps with slot
        return appointmentStart < slotEndTime && appointmentEnd > slotTime
      })
      
      slotMap.set(index, !hasAppointment)
    })
    return slotMap
  }, [timeline.slots, timeline.start, intervalMinutes, appointments])

  // Check if a slot is covered by an inactive constraint (orange block)
  const isSlotCoveredByInactiveConstraint = useMemo(() => {
    const slotMap = new Map<number, boolean>()
    timeline.slots.forEach((slot, index) => {
      const slotTime = addMinutes(timeline.start, index * intervalMinutes)
      const slotEndTime = addMinutes(slotTime, intervalMinutes)
      
      // Check if any inactive constraint covers this slot
      const hasInactiveConstraint = stationConstraints
        .filter((c) => !c.is_active) // Only check inactive constraints (the orange blocks)
        .some((constraint) => {
          const constraintStart = constraint.start_time ? new Date(constraint.start_time) : null
          const constraintEnd = constraint.end_time ? new Date(constraint.end_time) : null
          
          if (!constraintStart || !constraintEnd) return false
          
          // Check if constraint overlaps with slot
          return constraintStart < slotEndTime && constraintEnd > slotTime
        })
      
      slotMap.set(index, hasInactiveConstraint)
    })
    return slotMap
  }, [timeline.slots, timeline.start, intervalMinutes, stationConstraints])

  // When an appointment popover is open, hide hover previews to avoid ghost slots
  useEffect(() => {
    if (isAppointmentMenuOpen) {
      setHoveredSlotIndex(null)
      setMouseY(null)
    }
  }, [isAppointmentMenuOpen])

  return (
    <div key={station.id} className="flex flex-col gap-2">
      <div
        ref={setNodeRef}
        id={`station-${station.id}`}
        data-testid={`station-${station.id}`}
        className={cn(
          "relative overflow-hidden rounded-lg border bg-white transition-colors",
          isOver ? "border-primary/40 bg-primary/10" : "border-slate-200",
          station.serviceType === "grooming" ? "cursor-crosshair hover:bg-slate-50" : "cursor-default"
        )}
        style={{ height: timeline.height }}
        onMouseDown={(e) => {
          if (isAppointmentMenuOpen) {
            return
          }
          // If we're hovering over a slot, use that slot's exact time for the drag start
          // This ensures the drag starts from the slot the user was hovering over, not a nearby one
          if (hoveredSlotIndex !== null && hoveredSlotIndex >= 0 && hoveredSlotIndex < timeline.slots.length) {
            const slotTime = addMinutes(timeline.start, hoveredSlotIndex * intervalMinutes)
            const snappedStartTime = snapTimeToInterval(slotTime, intervalMinutes)
            // Create a synthetic event positioned at the center of the hovered slot
            const rect = e.currentTarget.getBoundingClientRect()
            const slot = timeline.slots[hoveredSlotIndex]
            const syntheticY = slot.offset + (slot.height / 2) // Use the center of the hovered slot
            const syntheticEvent = {
              ...e,
              clientY: rect.top + syntheticY,
              currentTarget: e.currentTarget,
            } as React.MouseEvent
            onCreateDragStart(syntheticEvent, station.id)
          } else {
            onCreateDragStart(e, station.id)
          }
        }}
        onMouseMove={(e) => {
          if (dragToCreate.isDragging || isAppointmentMenuOpen) {
            setHoveredSlotIndex(null)
            return
          }
          const rect = e.currentTarget.getBoundingClientRect()
          const y = e.clientY - rect.top
          setMouseY(y)
          
          // Find which slot contains this Y position
          let foundSlotIndex: number | null = null
          for (let i = 0; i < timeline.slots.length; i++) {
            const slot = timeline.slots[i]
            if (y >= slot.offset && y < slot.offset + slot.height) {
              foundSlotIndex = i
              break
            }
          }
          
          if (foundSlotIndex !== null && foundSlotIndex >= 0 && foundSlotIndex < timeline.slots.length) {
            const slotTime = addMinutes(timeline.start, foundSlotIndex * intervalMinutes)
            const isEmptyButRestricted = isSlotEmptyButRestricted(slotTime, station.id, foundSlotIndex)
            const isEmpty = isSlotEmpty.get(foundSlotIndex) ?? false
            const isCoveredByInactiveConstraint = isSlotCoveredByInactiveConstraint.get(foundSlotIndex) ?? false
            
            // Show hover for empty slots (including inactive/gray slots and restricted slots) but NOT for slots covered by inactive constraints (orange blocks)
            if (isEmpty && !isCoveredByInactiveConstraint) {
              setHoveredSlotIndex(foundSlotIndex)
            } else {
              setHoveredSlotIndex(null)
            }
          } else {
            setHoveredSlotIndex(null)
          }
        }}
        onMouseLeave={() => {
          setMouseY(null)
          setHoveredSlotIndex(null)
        }}
      >
        <div className="absolute inset-0">
          {timeline.slots.map((slot, index) => {
            const slotTime = addMinutes(timeline.start, index * intervalMinutes)
            const isAvailable = isSlotWithinWorkingHours(slotTime, station.id)
            const isGenerallyUnavailable = isSlotGenerallyUnavailable(slotTime, station.id)
            const hasActiveConstraint = isSlotCoveredByActiveConstraint(slotTime, station.id)
            const isMadeAvailableByConstraint = isGenerallyUnavailable && hasActiveConstraint
            const isEmptyButRestricted = isSlotEmptyButRestricted(slotTime, station.id, index)
            const isEmpty = isSlotEmpty.get(index) ?? false

            const isCoveredByInactiveConstraint = isSlotCoveredByInactiveConstraint.get(index) ?? false
            const isHovered = hoveredSlotIndex === index && isEmpty && !isCoveredByInactiveConstraint && !dragToCreate.isDragging && !isAppointmentMenuOpen

            return (
              <div
                key={`${station.id}-slot-${slot.offset}`}
                className={cn("absolute left-0 right-0 border-b border-slate-100 transition-colors", {
                  "bg-primary/20 border-primary/30":
                    highlightedSlots?.stationId === station.id && highlightedSlots?.allTimeSlots.includes(index),
                  "bg-primary/30 border-primary/40":
                    highlightedSlots?.stationId === station.id &&
                    (highlightedSlots?.startTimeSlot === index || highlightedSlots?.endTimeSlot === index),
                  "bg-fuchsia-50/90 border-fuchsia-200":
                    isEmptyButRestricted &&
                    index % 2 === 0 &&
                    !highlightedSlots?.allTimeSlots.includes(index) &&
                    !isHovered,
                  "bg-fuchsia-100/90  border-fuchsia-200":
                    isEmptyButRestricted &&
                    index % 2 !== 0 &&
                    !highlightedSlots?.allTimeSlots.includes(index) &&
                    !isHovered,
                  "bg-gray-300/80":
                    !isAvailable &&
                    !isMadeAvailableByConstraint &&
                    !isEmptyButRestricted &&
                    !highlightedSlots?.allTimeSlots.includes(index) &&
                    !isHovered,
                  "bg-slate-50/70":
                    (isAvailable || isMadeAvailableByConstraint) &&
                    index % 2 === 0 &&
                    !isEmptyButRestricted &&
                    !highlightedSlots?.allTimeSlots.includes(index) &&
                    !isHovered,
                  // Hovered state - fill the entire slot
                  "bg-primary/20 border-primary/30":
                    isHovered,
                })}
                style={{ top: slot.offset, height: slot.height }}
              >
                {/* Show time and date when hovered */}
                {isHovered && (
                  <div className="absolute inset-0 flex items-center justify-end text-right px-3 pointer-events-none z-10" dir="rtl">
                    <div className="text-sm font-medium text-gray-700">
                      {format(selectedDate, "dd/MM/yyyy")} {format(slotTime, "HH:mm")}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {timeline.hourMarkers.map((marker) => (
            <div
              key={`${station.id}-marker-${marker.label}-${marker.offset}`}
              className="absolute inset-x-0 border-t border-dashed border-slate-200"
              style={{ top: marker.offset }}
            />
          ))}
        </div>
        <div className="absolute inset-0">
          {stationConstraints.filter((c) => !c.is_active).map((constraint) => renderConstraintBlock(constraint))}
          {appointments.map((appointment) => {
            const overlapCount = getOverlapCount(appointment.id, overlaps)
            const zIndex = calculateZIndexForOverlap(appointment, appointments, overlaps)
            return (
              <DraggableAppointmentCard
                key={appointment.id}
                appointment={appointment}
                pixelsPerMinuteScale={pixelsPerMinuteScale}
                timelineStart={timeline.start}
                disabled={Boolean(resizingPreview?.appointmentId === appointment.id)}
                renderAppointmentCard={renderAppointmentCard}
                overlapCount={overlapCount}
                zIndex={zIndex}
              />
            )
          })}
        </div>


        {dragToCreate.isDragging &&
          dragToCreate.stationId === station.id &&
          dragToCreate.startTime &&
          dragToCreate.endTime && (
            <div
              className="absolute left-0 right-0 bg-purple-200 border-2 border-purple-400 rounded opacity-70 pointer-events-none z-10"
              style={{
                top:
                  (differenceInMinutes(dragToCreate.startTime, timeline.start) / intervalMinutes) *
                  (timeline.slots[0]?.height || 60),
                height:
                  (differenceInMinutes(dragToCreate.endTime, dragToCreate.startTime) / intervalMinutes) *
                  (timeline.slots[0]?.height || 60),
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-purple-800">
                {format(dragToCreate.startTime, "HH:mm")} - {format(dragToCreate.endTime, "HH:mm")}
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
