// This is a self-contained component that reads all data from Redux and hooks
// It was refactored from ManagerSchedule.tsx to be 100% self-contained with no props

import { DragOverlay } from "@dnd-kit/core"
import { DndContext } from "@dnd-kit/core"
import { useAppDispatch } from "@/store/hooks.ts"
import { setNewGardenAppointmentModalOpen, setNewGardenAppointmentType } from "@/store/slices/managerScheduleSlice.ts"
import { WaitingListColumn } from "@/pages/ManagerSchedule/components/waitingListColumn"
import { GardenColumn } from "@/pages/ManagerSchedule/components/gardenColumn/GardenColumn.tsx"
import { DroppableStationColumn } from "@/pages/ManagerSchedule/components/stationColumn/DroppableStationColumn.tsx"
import { PinnedAppointmentsColumn } from "@/pages/ManagerSchedule/pinnedAppointments/PinnedAppointmentsColumn.tsx"
import { ScheduleHeader } from "../ScheduleHeader.tsx"
import { TimeAxis } from "../TimeAxis.tsx"
import { CurrentTimeIndicator } from "../CurrentTimeIndicator.tsx"
import { useManagerScheduleContent } from "./managerScheduleContent.module.tsx"
import { addMinutes, differenceInMinutes, format } from "date-fns"
import { WAITLIST_DEFAULT_DURATION_MINUTES, STANDARD_COLUMN_WIDTH, PINNED_APPOINTMENTS_COLUMN_WIDTH, WAITLIST_COLUMN_WIDTH } from "../../constants"
import { scheduleScrollRefs } from "../scheduleScrollRefs.ts"

export function ManagerScheduleContent() {
  const dispatch = useAppDispatch()

  const hookResult = useManagerScheduleContent()

  if (!hookResult.data) {
    return null
  }

  const {
    constraints,
    stationWorkingHours,
    timeline,
    gardenSections,
    shouldShowGardenColumns,
    groupedAppointments,
    visibleStations,
    gridTemplateColumns,
    filteredStations,
    selectedDate,
    showPinnedAppointmentsColumn,
    showWaitingListColumn,
    pixelsPerMinuteScale,
    intervalMinutes,
    highlightedSlots,
    dragToCreate,
    resizingPreview,
    draggedAppointment,
    draggedPinnedAppointment,
    draggedConstraint,
    draggedWaitlistEntry,
    pinnedAppointmentsHook,
    handleAppointmentClick,
    handleCreateDragStart,
    handleResizeStart,
    renderAppointmentCard,
    renderConstraintBlock,
    isSlotWithinWorkingHours,
    isSlotGenerallyUnavailable,
    isSlotCoveredByActiveConstraint,
    isSlotEmptyButRestricted,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    contentScrollContainerRef,
    handleContentScroll,
    handleHeaderScroll,
    sensors,
    isAppointmentMenuOpen,
  } = hookResult

  const isUnpinMode = !showPinnedAppointmentsColumn
  const timeAxisWidth = 70
  const gardenColumnCount = shouldShowGardenColumns ? 1 : 0
  const minimumGridWidth =
    timeAxisWidth +
    (showPinnedAppointmentsColumn ? PINNED_APPOINTMENTS_COLUMN_WIDTH : 0) +
    (showWaitingListColumn ? WAITLIST_COLUMN_WIDTH : 0) +
    (gardenColumnCount + visibleStations.length) * STANDARD_COLUMN_WIDTH

  return (
    <div className={`relative flex items-start gap-6 w-full overflow-x-auto custom-scrollbar ${isUnpinMode ? 'h-full flex-col' : 'overflow-y-visible'}`} dir="rtl">
      <div className={`flex-1 min-w-0 ${isUnpinMode ? 'h-full flex flex-col' : ''}`} dir="rtl">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Schedule Header - Outside scroll container so it can stick */}
          <div className={`${isUnpinMode ? 'flex-shrink-0' : 'sticky top-0 left-0 right-0'} z-30 bg-white`}>
            <div
              ref={scheduleScrollRefs.headerScrollContainerRef}
              className="w-full overflow-x-auto overflow-y-visible scrollbar-hide"
              dir="rtl"
              style={{
                maxWidth: '100%',
              }}
              onScroll={handleHeaderScroll}
            >
              <ScheduleHeader />
            </div>
          </div>

          {/* Scroll container for content only */}
          <div
            ref={contentScrollContainerRef}
            className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar pb-2 ${isUnpinMode ? 'flex-1 min-h-0' : ''}`}
            dir="rtl"
            style={{
              maxWidth: '100%',
              maxHeight: isUnpinMode ? '100%' : 'calc(100vh - 120px)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--primary) / 0.3) hsl(var(--primary) / 0.05)',
            }}
            onScroll={handleContentScroll}
          >
            {/* Main grid content */}
            <div
              className="relative"
              style={{
                width: 'max-content',
                minWidth: `${minimumGridWidth}px`,
              }}
            >
              {/* Current time indicator - spans across all columns from time axis to end */}
              <CurrentTimeIndicator timeline={timeline} selectedDate={selectedDate} />
              
              <div
                className="grid min-w-max"
                style={{
                  gridTemplateColumns,
                  width: 'max-content',
                  minWidth: `${minimumGridWidth}px`,
                }}
              >
                {/* Time axis column - first in DOM, RTL will place it on the right */}
                <TimeAxis />

              {/* Pinned appointments column */}
              {showPinnedAppointmentsColumn && (
                <PinnedAppointmentsColumn
                  pinnedAppointments={pinnedAppointmentsHook.pinnedAppointments}
                  appointmentsMap={pinnedAppointmentsHook.pinnedAppointmentsAppointmentsMap}
                  isLoading={pinnedAppointmentsHook.isLoadingPinned}
                  onUnpin={pinnedAppointmentsHook.handleUnpinById}
                  onAppointmentClick={handleAppointmentClick}
                  timelineHeight={timeline.height}
                />
              )}

              {/* Waiting list column */}
              {showWaitingListColumn && (
                <WaitingListColumn
                  selectedDate={selectedDate}
                  timelineHeight={timeline.height}
                />
              )}

              {/* Garden columns */}
              {shouldShowGardenColumns && (
                <GardenColumn
                  sections={gardenSections.map(section => ({
                    ...section,
                    badgeClassName: section.id === 'garden-full-day' ? 'border-green-200 bg-green-100 text-green-700' :
                      section.id === 'garden-hourly' ? 'border-blue-200 bg-blue-100 text-blue-700' :
                        'border-amber-200 bg-amber-100 text-amber-700',
                    indicatorClassName: section.id === 'garden-full-day' ? 'bg-emerald-500' :
                      section.id === 'garden-hourly' ? 'bg-blue-500' : 'bg-amber-500',
                    titleBackgroundClassName: section.id === 'garden-full-day' ? 'bg-green-50' :
                      section.id === 'garden-hourly' ? 'bg-blue-50' : 'bg-amber-50',
                    dropZoneClassName: section.id === 'garden-full-day' ? 'border-green-200 bg-green-50' :
                      section.id === 'garden-hourly' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50',
                    dropZoneHoverClassName: section.id === 'garden-full-day' ? 'border-emerald-400 bg-green-100' :
                      section.id === 'garden-hourly' ? 'border-blue-400 bg-blue-100' : 'border-amber-400 bg-amber-100',
                  }))}
                  timeline={timeline}
                  pixelsPerMinuteScale={pixelsPerMinuteScale}
                  resizingPreview={resizingPreview}
                  handleCreateGardenAppointment={(sectionId) => {
                    let appointmentType: 'full-day' | 'hourly' | 'trial' = 'hourly'
                    if (sectionId === 'garden-full-day') {
                      appointmentType = 'full-day'
                    } else if (sectionId === 'garden-trial') {
                      appointmentType = 'trial'
                    }
                    dispatch(setNewGardenAppointmentType(appointmentType))
                    dispatch(setNewGardenAppointmentModalOpen(true))
                  }}
                  renderAppointmentCard={renderAppointmentCard}
                />
              )}

              {/* Station columns */}
              {visibleStations.map((station) => (
                <DroppableStationColumn
                  key={station.id}
                  station={station}
                  timeline={timeline}
                  intervalMinutes={intervalMinutes}
                  pixelsPerMinuteScale={pixelsPerMinuteScale}
                  appointments={groupedAppointments.get(station.id) ?? []}
                  stationConstraints={constraints.filter(c => c.station_id === station.id)}
                  hasWorkingHours={(stationWorkingHours[station.id] ?? []).length > 0}
                  highlightedSlots={highlightedSlots}
                  dragToCreate={dragToCreate}
                  onCreateDragStart={handleCreateDragStart}
                  isSlotWithinWorkingHours={isSlotWithinWorkingHours}
                  isSlotGenerallyUnavailable={isSlotGenerallyUnavailable}
                  isSlotCoveredByActiveConstraint={isSlotCoveredByActiveConstraint}
                  isSlotEmptyButRestricted={isSlotEmptyButRestricted}
                  renderConstraintBlock={renderConstraintBlock}
                  resizingPreview={resizingPreview}
                  renderAppointmentCard={renderAppointmentCard}
                  selectedDate={selectedDate}
                  isAppointmentMenuOpen={isAppointmentMenuOpen}
                />
              ))}
              </div>
            </div>
          </div>

          <DragOverlay>
            {draggedAppointment.appointment && (() => {
              const appointment = draggedAppointment.appointment
              const originalStart = new Date(appointment.startDateTime)
              const originalEnd = new Date(appointment.endDateTime)
              const originalTimeLabel = `${format(originalStart, "HH:mm")} - ${format(originalEnd, "HH:mm")}`

              // Calculate target time if highlightedSlots is available (even if different station)
              let targetTimeLabel = ""
              if (highlightedSlots) {
                const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
                const actualDurationMinutes = differenceInMinutes(originalEnd, originalStart)
                const targetEndTime = addMinutes(targetStartTime, actualDurationMinutes)
                targetTimeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
              }

              const displayText = appointment.isPersonalAppointment || appointment.appointmentType === "private"
                ? (appointment.personalAppointmentDescription || 'תור אישי')
                : (appointment.dogs[0]?.name || 'תור')

              // Determine background color based on appointment type
              let bgColor = "bg-blue-500" // Default for business appointments
              if (appointment.isProposedMeeting) {
                bgColor = "bg-lime-500"
              } else if (appointment.isPersonalAppointment || appointment.appointmentType === "private") {
                bgColor = "bg-purple-500"
              }

              return (
                <div className={`${bgColor} text-white p-3 rounded shadow-lg min-w-[200px]`}>
                  <div className="font-medium mb-1 text-right" dir="rtl">
                    {displayText}
                  </div>
                  <div className="text-xs text-right space-y-0.5" dir="rtl">
                    <div className="opacity-90">
                      מ: {originalTimeLabel}
                    </div>
                    {targetTimeLabel && (
                      <div className="font-semibold">
                        ל: {targetTimeLabel}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {draggedPinnedAppointment.appointment && (() => {
              const appointment = draggedPinnedAppointment.appointment
              const originalStart = new Date(appointment.startDateTime)
              const originalEnd = new Date(appointment.endDateTime)
              const originalTimeLabel = `${format(originalStart, "HH:mm")} - ${format(originalEnd, "HH:mm")}`

              // Calculate target time if highlightedSlots is available
              let targetTimeLabel = ""
              if (highlightedSlots) {
                const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
                const actualDurationMinutes = differenceInMinutes(originalEnd, originalStart)
                const targetEndTime = addMinutes(targetStartTime, actualDurationMinutes)
                targetTimeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
              }

              return (
                <div className="bg-amber-500 text-white p-3 rounded shadow-lg min-w-[200px]">
                  <div className="font-medium mb-1 text-right" dir="rtl">
                    {appointment.dogs[0]?.name || 'תור מסומן'}
                  </div>
                  <div className="text-xs text-right space-y-0.5" dir="rtl">
                    <div className="opacity-90">
                      מ: {originalTimeLabel}
                    </div>
                    {targetTimeLabel && (
                      <div className="font-semibold">
                        ל: {targetTimeLabel}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {draggedConstraint.constraint && (() => {
              const constraint = draggedConstraint.constraint
              const originalStart = new Date(constraint.start_time)
              const originalEnd = new Date(constraint.end_time)
              const originalTimeLabel = `${format(originalStart, "HH:mm")} - ${format(originalEnd, "HH:mm")}`

              // Calculate target time if highlightedSlots is available
              let targetTimeLabel = ""
              if (highlightedSlots) {
                const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
                const actualDurationMinutes = differenceInMinutes(originalEnd, originalStart)
                const targetEndTime = addMinutes(targetStartTime, actualDurationMinutes)
                targetTimeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
              }

              return (
                <div className="bg-orange-500 text-white p-3 rounded shadow-lg min-w-[200px]">
                  <div className="font-medium mb-1 text-right" dir="rtl">
                    אילוץ
                  </div>
                  <div className="text-xs text-right space-y-0.5" dir="rtl">
                    <div className="opacity-90">
                      מ: {originalTimeLabel}
                    </div>
                    {targetTimeLabel && (
                      <div className="font-semibold">
                        ל: {targetTimeLabel}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {draggedWaitlistEntry.entry && (() => {
              const entry = draggedWaitlistEntry.entry
              // Waitlist entries might not have times, so we'll just show the target time if available
              let targetTimeLabel = ""
              if (highlightedSlots) {
                const targetStartTime = addMinutes(timeline.start, highlightedSlots.startTimeSlot * intervalMinutes)
                const targetEndTime = addMinutes(targetStartTime, WAITLIST_DEFAULT_DURATION_MINUTES)
                targetTimeLabel = `${format(targetStartTime, "HH:mm")} - ${format(targetEndTime, "HH:mm")}`
              }

              return (
                <div className="bg-lime-500 text-white p-3 rounded shadow-lg min-w-[200px]">
                  <div className="font-medium mb-1 text-right" dir="rtl">
                    {entry.dogName || 'רשימת המתנה'}
                  </div>
                  {targetTimeLabel && (
                    <div className="text-xs text-right" dir="rtl">
                      <div className="font-semibold">
                        ל: {targetTimeLabel}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
