import { useMemo, useState } from "react"
import { format, parseISO, differenceInMinutes } from "date-fns"
import { he } from "date-fns/locale"
import { Pin, PinOff, Search, Calendar, MoreHorizontal, X } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PinnedAppointment, PinReason } from "./pinnedAppointmentsService"
import type { ManagerAppointment } from "../types"
import { DraggablePinnedAppointmentCard } from "./DraggablePinnedAppointmentCard"

const PIN_REASON_LABELS: Record<PinReason, { label: string; badgeClass: string }> = {
  reschedule: { label: "צריך שינוי תאריך", badgeClass: "bg-red-50 text-red-700 border-red-100" },
  attention: { label: "דורש תשומת לב", badgeClass: "bg-orange-50 text-orange-700 border-orange-100" },
  special: { label: "בקשה מיוחדת", badgeClass: "bg-purple-50 text-purple-700 border-purple-100" },
  date_change: { label: "שינוי תאריך ממתין", badgeClass: "bg-primary/10 text-primary border-primary/20" },
  quick_access: { label: "גישה מהירה", badgeClass: "bg-gray-50 text-gray-700 border-gray-100" },
}

interface PinnedAppointmentsColumnProps {
  pinnedAppointments: PinnedAppointment[]
  appointmentsMap: Map<string, ManagerAppointment> // appointment_id-appointment_type -> appointment
  isLoading: boolean
  onUnpin: (pinId: string) => void
  onAppointmentClick: (appointment: ManagerAppointment) => void
  onReschedule?: (appointment: ManagerAppointment) => void
  onCreateProposal?: (appointment: ManagerAppointment) => void
  onUpdateTargetDate?: (pinId: string, targetDate: string | null) => void
  timelineHeight: number
}

export function PinnedAppointmentsColumn({
  pinnedAppointments,
  appointmentsMap,
  isLoading,
  onUnpin,
  onAppointmentClick,
  onReschedule,
  onCreateProposal,
  onUpdateTargetDate,
  timelineHeight,
}: PinnedAppointmentsColumnProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReason, setSelectedReason] = useState<PinReason | null>(null)
  const [selectedServiceType, setSelectedServiceType] = useState<"grooming" | "daycare" | null>(null)

  // Filter pinned appointments
  const filteredPinned = useMemo(() => {
    return pinnedAppointments.filter((pin) => {
      const key = `${pin.appointment_id}-${pin.appointment_type}`
      const appointment = appointmentsMap.get(key)

      if (!appointment) return false

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesSearch =
          appointment.dogs.some((dog) => dog.name?.toLowerCase().includes(term)) ||
          appointment.clientName?.toLowerCase().includes(term) ||
          appointment.clientPhone?.includes(term)

        if (!matchesSearch) return false
      }

      // Reason filter
      if (selectedReason && pin.reason !== selectedReason) return false

      // Service type filter
      if (selectedServiceType && pin.appointment_type !== selectedServiceType) return false

      return true
    })
  }, [pinnedAppointments, appointmentsMap, searchTerm, selectedReason, selectedServiceType])

  const hasFilters = Boolean(searchTerm || selectedReason || selectedServiceType)

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedReason(null)
    setSelectedServiceType(null)
  }

  // Make the column a droppable zone
  const { setNodeRef, isOver } = useDroppable({
    id: "pinned-appointments-column",
    data: {
      type: "pinned-appointments-column",
    },
  })

  return (
    <div className="flex flex-col h-full" dir="rtl">
      <div
        ref={setNodeRef}
        data-testid="pinned-appointments-column"
        data-droppable-type="pinned-appointments-column"
        className={cn(
          "relative overflow-hidden rounded-lg border bg-white transition-colors h-full",
          isOver ? "border-amber-400 bg-amber-50" : "border-slate-200"
        )}
        style={{ height: timelineHeight }}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="space-y-3 border-b border-slate-100 px-2 py-3 ">
            <div className="flex items-center justify-start gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">תורים מסומנים</p>
                <p className="text-xs text-gray-500">
                  {filteredPinned.length} מתוך {pinnedAppointments.length} מסומנים
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative" dir="rtl">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="חיפוש לפי שם לקוח או טלפון"
                className="pr-9 text-sm"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">סיבה</label>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(PIN_REASON_LABELS) as PinReason[]).map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(selectedReason === reason ? null : reason)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                        selectedReason === reason
                          ? PIN_REASON_LABELS[reason].badgeClass
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      {PIN_REASON_LABELS[reason].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">סוג שירות</label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedServiceType(selectedServiceType === "grooming" ? null : "grooming")}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      selectedServiceType === "grooming"
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    מספרה
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceType(selectedServiceType === "daycare" ? null : "daycare")}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      selectedServiceType === "daycare"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                  </button>
                </div>
              </div>
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={clearFilters}
                className="px-0 text-xs text-amber-700"
              >
                נקה מסננים
              </Button>
            )}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 px-2 py-3">
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  טוען תורים מסומנים...
                </div>
              ) : filteredPinned.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-sm text-gray-500">
                  {hasFilters ? "אין תורים מסומנים שעונים למסננים" : "אין תורים מסומנים"}
                </div>
              ) : (
                filteredPinned.map((pin) => {
                  const key = `${pin.appointment_id}-${pin.appointment_type}`
                  const appointment = appointmentsMap.get(key)

                  if (!appointment) return null

                  const startDate = parseISO(appointment.startDateTime)
                  const endDate = parseISO(appointment.endDateTime)
                  const duration = appointment.durationMinutes ?? Math.max(1, differenceInMinutes(endDate, startDate))
                  const reasonMeta = PIN_REASON_LABELS[pin.reason]

                  const renderCard = (pin: PinnedAppointment, appointment: ManagerAppointment, isDragging: boolean) => (
                    <div
                      className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-amber-300 hover:shadow-md text-right"
                      onClick={() => onAppointmentClick(appointment)}
                      data-dnd-kit-no-drag
                    >
                      {/* Header */}
                      <div className="mb-2 flex items-start justify-between gap-2" dir="rtl">
                        <div className="flex flex-wrap items-center gap-1 justify-end">
                          <Badge variant="outline" className={cn("text-[10px]", reasonMeta.badgeClass)}>
                            {reasonMeta.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              pin.appointment_type === "grooming"
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                          >
                            {pin.appointment_type === "grooming" ? "מספרה" : ""}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                              data-dnd-kit-no-drag
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" dir="rtl">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                onUnpin(pin.id)
                              }}
                            >
                              <PinOff className="h-4 w-4 ml-2" />
                              הסר מסימון
                            </DropdownMenuItem>
                            {onReschedule && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onReschedule(appointment)
                                }}
                              >
                                <Calendar className="h-4 w-4 ml-2" />
                                שנה תאריך
                              </DropdownMenuItem>
                            )}
                            {onCreateProposal && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onCreateProposal(appointment)
                                }}
                              >
                                <Calendar className="h-4 w-4 ml-2" />
                                צור הצעה
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Appointment Info */}
                      <div className="space-y-1 text-xs">
                        {appointment.dogs.map((dog) => (
                          <div key={dog.id} className="font-medium text-gray-900">
                            {dog.name}
                          </div>
                        ))}
                        <div className="text-gray-600">{appointment.clientName}</div>
                        <div className="text-gray-500">
                          {format(startDate, "dd/MM/yyyy", { locale: he })} {format(startDate, "HH:mm", { locale: he })} - {format(endDate, "HH:mm", { locale: he })}
                        </div>
                        <div className="text-gray-500">
                          משך: {duration} דקות
                        </div>
                        {appointment.stationName && (
                          <div className="text-gray-500">{appointment.stationName}</div>
                        )}
                        {appointment.serviceName && (
                          <div className="text-gray-500">
                            סוג שירות: <span className="text-gray-700 font-medium">{appointment.serviceName}</span>
                          </div>
                        )}
                      </div>

                      {/* Target Date */}
                      {pin.target_date && onUpdateTargetDate && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
                          <Calendar className="h-3 w-3" />
                          תאריך יעד: {format(parseISO(pin.target_date), "dd/MM/yyyy", { locale: he })}
                        </div>
                      )}
                    </div>
                  )

                  return (
                    <DraggablePinnedAppointmentCard
                      key={pin.id}
                      pin={pin}
                      appointment={appointment}
                      renderCard={renderCard}
                    />
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

