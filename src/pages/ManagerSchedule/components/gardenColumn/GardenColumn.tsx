import { Plus } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useDroppable } from "@dnd-kit/core"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { ManagerAppointment } from "../../types"
import type { TimelineConfig } from "@/pages/ManagerSchedule/managerSchedule.module"
import { DraggableAppointmentCard } from "@/pages/ManagerSchedule/components/appointmentCard/DraggableAppointmentCard"
import { calculateAppointmentOverlaps, getOverlapCount, calculateZIndexForOverlap } from "../../utils/appointmentOverlaps"

export type GardenSection = {
  id: string
  title: string
  badgeLabel: string
  badgeClassName: string
  indicatorClassName: string
  titleBackgroundClassName: string
  dropZoneClassName: string
  dropZoneHoverClassName: string
  appointments: ManagerAppointment[]
}

interface GardenColumnProps {
  sections: GardenSection[]
  timeline: TimelineConfig
  pixelsPerMinuteScale: number
  resizingPreview: { appointmentId: string } | null
  handleCreateGardenAppointment: (sectionId: string) => void
  renderAppointmentCard: (appointment: ManagerAppointment, isDragging: boolean, overlapCount?: number) => React.ReactNode
}

export function GardenColumn({
  sections,
  timeline,
  pixelsPerMinuteScale,
  resizingPreview,
  handleCreateGardenAppointment,
  renderAppointmentCard,
}: GardenColumnProps) {
  const defaultAccordionValues = sections.map((section) => section.id)

  const GardenAccordionSection = ({ section }: { section: GardenSection }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: section.id,
      data: {
        type: "garden-column",
        columnId: section.id,
      },
    })

    // Calculate overlaps for appointments in this garden section
    const overlaps = useMemo(() => {
      return calculateAppointmentOverlaps(section.appointments)
    }, [section.appointments])

    return (
      <AccordionItem value={section.id} className="border-b border-emerald-200 last:border-b-0">
        <AccordionTrigger
          className={cn("px-2 text-right text-sm font-semibold text-gray-900", section.titleBackgroundClassName)}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-full", section.indicatorClassName)} />
              {section.title} ({section.appointments.length})
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                handleCreateGardenAppointment(section.id)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  handleCreateGardenAppointment(section.id)
                }
              }}
              className="ml-2 rounded-full p-1 hover:bg-gray-200 transition-colors"
              title="הוסף תור גן חדש"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div
            ref={setNodeRef}
            data-testid={`garden-column-${section.id}`}
            className={cn(
              "space-y-2 rounded-md border border-dashed px-2 py-2 transition-colors shadow-sm",
              isOver ? section.dropZoneHoverClassName : section.dropZoneClassName
            )}
            style={{ minHeight: section.appointments.length ? 0 : 96 }}
          >
            {section.appointments.length ? (
              section.appointments.map((appointment) => {
                const overlapCount = getOverlapCount(appointment.id, overlaps)
                const zIndex = calculateZIndexForOverlap(appointment, section.appointments, overlaps)
                return (
                  <DraggableAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    isGardenColumn
                    pixelsPerMinuteScale={pixelsPerMinuteScale}
                    timelineStart={timeline.start}
                    disabled={Boolean(resizingPreview?.appointmentId === appointment.id)}
                    renderAppointmentCard={renderAppointmentCard}
                    overlapCount={overlapCount}
                    zIndex={zIndex}
                  />
                )
              })
            ) : (
              <div className="py-4 text-center text-xs text-gray-500">אין תורים להצגה</div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
        style={{ height: timeline.height }}
      >
        <div className="absolute inset-0 pointer-events-none">
          {timeline.slots.map((slot, index) => (
            <div
              key={`garden-slot-${slot.offset}`}
              className={cn("absolute left-0 right-0 border-b border-slate-100", {
                "bg-slate-50/70": index % 2 === 0,
              })}
              style={{ top: slot.offset, height: slot.height }}
            />
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {timeline.hourMarkers.map((marker) => (
            <div
              key={`garden-marker-${marker.label}-${marker.offset}`}
              className="absolute inset-x-0 border-t border-dashed border-slate-200"
              style={{ top: marker.offset }}
            />
          ))}
        </div>
        <div className="relative z-10 flex h-full flex-col overflow-hidden">
          <Accordion
            type="multiple"
            defaultValue={defaultAccordionValues}
            className="flex-1 overflow-y-auto px-2 py-2"
          >
            {sections.map((section) => (
              <GardenAccordionSection key={section.id} section={section} />
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  )
}

