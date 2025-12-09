import type { PointerEvent as ReactPointerEvent } from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "@/store/hooks.ts"
import {
  setConstraintToDelete,
  setConstraintToDeleteDetails,
  setConstraintResizingPreview,
  setDraggedAppointment,
  setDraggedConstraint,
  setDraggedWaitlistEntry,
  setDraggedPinnedAppointment,
  setEditingConstraint,
  setEditingConstraintDefaultTimes,
  setEditingConstraintStationIds,
  setEditingGroomingAppointment,
  setEditingPersonalAppointment,
  setEditingProposedMeeting,
  setFinalizedDragTimes,
  setGroomingEditOpen,
  setPersonalAppointmentEditOpen,
  setHighlightedSlots,
  setIsConstraintDialogOpen,
  setIsDetailsOpen,
  setMoveConfirmationOpen,
  setMoveDetails,
  setPendingResizeState,
  setPendingWaitlistPlacement,
  setProposedMeetingMode,
  setProposedMeetingTimes,
  setResizingPreview,
  setSelectedAppointment,
  setShouldRemoveFromWaitlist,
  setShowAppointmentTypeSelection,
  setShowDeleteConstraintDialog,
  setShowProposedMeetingModal,
  setShowWaitlistDropDialog,
  setStationOrderIds,
  setVisibleStationIds,
  setShowPinnedAppointmentDropDialog,
  setPinnedAppointmentDropDetails,
  setPinnedAppointmentDropAction,
  setPinnedAppointmentDropRemoveFromPinned,
  setShowBusinessAppointmentModal,
  setPrefillBusinessCustomer,
  setPrefillBusinessDog,
} from "@/store/slices/managerScheduleSlice.ts"
import { DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { addHours, addMinutes, differenceInMinutes, format, max, min, startOfDay } from "date-fns"
import { supabase } from "@/integrations/supabase/client.ts"
import { useToast } from "@/hooks/use-toast.ts"
import {
  supabaseApi,
  useGetManagerScheduleQuery,
  useGetShiftRestrictionsQuery,
  useGetStationConstraintsQuery,
  useGetStationWorkingHoursQuery,
  useMoveAppointmentMutation,
} from "@/store/services/supabaseApi.ts"
import { usePinnedAppointments } from "@/pages/ManagerSchedule/pinnedAppointments/usePinnedAppointments.ts"
import { useWaitingList } from "@/pages/ManagerSchedule/components/waitingListColumn"
import { scheduleScrollRefs } from "../scheduleScrollRefs.ts"
import { DraggableConstraintCard } from "../constraintCard/DraggableConstraintCard.tsx"
import { AppointmentCard } from "../appointmentCard/AppointmentCard.tsx"
import {
  buildTimeline,
  getAppointmentDates,
  MAX_VISIBLE_STATIONS,
  parseISODate,
  PIXELS_PER_MINUTE_SCALE,
} from "../../managerSchedule.module.ts"
import type { DragToCreateState, ManagerAppointment, ManagerStation, ResizeState, ConstraintResizeState } from "../../types.ts"
import {
  DEFAULT_END_HOUR,
  EMPTY_STATIONS_OVERRIDE_PARAM,
  PINNED_APPOINTMENTS_COLUMN_WIDTH,
  STANDARD_COLUMN_WIDTH,
  snapTimeToInterval,
  WAITLIST_COLUMN_WIDTH,
  WAITLIST_DEFAULT_DURATION_MINUTES,
} from "../../constants.ts"

/**
 * Helper function to check if an appointment is cancelled
 */
function isCancelledAppointment(appointment: ManagerAppointment): boolean {
  if (!appointment.status) {
    return false
  }
  const normalized = appointment.status.trim().toLowerCase()
  const CANCELLED_STATUS_KEYWORDS = ["cancelled", "canceled", "מבוטל", "בוטל"]
  return CANCELLED_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

/**
 * Hook that encapsulates all logic for the ManagerScheduleContent component
 */
export function useManagerScheduleContent() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const [moveAppointment] = useMoveAppointmentMutation()
  const [searchParams] = useSearchParams()

  // Redux state
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const formattedDate = format(selectedDate, "yyyy-MM-dd")
  const visibleStationIds = useAppSelector((state) => state.managerSchedule.visibleStationIds)
  const stationOrderIds = useAppSelector((state) => state.managerSchedule.stationOrderIds)
  // Station window pagination removed - all stations are shown with horizontal scroll
  const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)
  const intervalMinutes = useAppSelector((state) => state.managerSchedule.intervalMinutes)
  const pixelsPerMinuteScale = useAppSelector((state) => state.managerSchedule.pixelsPerMinuteScale)
  const showPinnedAppointmentsColumn = useAppSelector((state) => state.managerSchedule.showPinnedAppointmentsColumn)
  const showWaitingListColumn = useAppSelector((state) => state.managerSchedule.showWaitingListColumn)
  const draggedAppointment = useAppSelector((state) => state.managerSchedule.draggedAppointment)
  const draggedConstraint = useAppSelector((state) => state.managerSchedule.draggedConstraint)
  const draggedWaitlistEntry = useAppSelector((state) => state.managerSchedule.draggedWaitlistEntry)
  const draggedPinnedAppointment = useAppSelector((state) => state.managerSchedule.draggedPinnedAppointment)
  const pinnedAppointmentDropAction = useAppSelector((state) => state.managerSchedule.pinnedAppointmentDropAction)
  const pinnedAppointmentDropRemoveFromPinned = useAppSelector((state) => state.managerSchedule.pinnedAppointmentDropRemoveFromPinned)
  const pinnedAppointmentDropDetails = useAppSelector((state) => state.managerSchedule.pinnedAppointmentDropDetails)
  const highlightedSlots = useAppSelector((state) => state.managerSchedule.highlightedSlots)
  const resizingPreview = useAppSelector((state) => state.managerSchedule.resizingPreview)
  const hasEmptyStationsOverride = searchParams.get("stations") === EMPTY_STATIONS_OVERRIDE_PARAM
  const shouldHideAllStations = hasEmptyStationsOverride && visibleStationIds.length === 0

  // Data fetching
  const { data, isLoading: isScheduleLoading, isFetching: isScheduleFetching } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "grooming",
  })

  const { data: constraints = [] } = useGetStationConstraintsQuery(
    { date: selectedDateStr },
    { skip: !selectedDateStr }
  )

  const groomingStationIds = useMemo(
    () => data?.stations?.filter(station => station.serviceType === 'grooming').map(station => station.id) || [],
    [data?.stations]
  )

  const { data: stationWorkingHours = {} } = useGetStationWorkingHoursQuery(
    { stationIds: groomingStationIds },
    { skip: groomingStationIds.length === 0 }
  )

  const shiftIds = useMemo(() => {
    const ids: string[] = []
    Object.values(stationWorkingHours).forEach((shifts) => {
      if (Array.isArray(shifts)) {
        shifts.forEach((shift) => {
          if (shift?.id) {
            ids.push(shift.id)
          }
        })
      }
    })
    return ids
  }, [stationWorkingHours])

  const { data: shiftRestrictions = {} } = useGetShiftRestrictionsQuery(
    { shiftIds },
    { skip: shiftIds.length === 0 }
  )

  // Pinned appointments hook
  const pinnedAppointmentsHook = usePinnedAppointments({ scheduleData: data })

  // Waiting list hook
  const waitingListHook = useWaitingList({
    selectedDate,
    selectedDateStr,
  })

  // Local state
  const [optimisticAppointments, setOptimisticAppointments] = useState<ManagerAppointment[]>([])
  const [dragToCreate, setDragToCreate] = useState<DragToCreateState>({
    isDragging: false,
    startTime: null,
    endTime: null,
    stationId: null,
    startY: null,
    cancelled: false,
  })
  const [globalEndHour, setGlobalEndHour] = useState<number | undefined>(DEFAULT_END_HOUR)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const lastHighlightUpdateRef = useRef<number>(0)
  const [isAppointmentMenuOpen, setIsAppointmentMenuOpen] = useState(false)
  const openAppointmentMenusRef = useRef<Set<string>>(new Set())

  const dragToCreateRef = useRef<DragToCreateState>(dragToCreate)
  const resizeStateRef = useRef<ResizeState | null>(null)
  const constraintResizeStateRef = useRef<ConstraintResizeState | null>(null)
  const isResizingRef = useRef<boolean>(false)
  // Using module-level ref store for scroll sync with ScheduleHeader
  const headerScrollContainerRef = scheduleScrollRefs.headerScrollContainerRef
  const contentScrollContainerRef = scheduleScrollRefs.contentScrollContainerRef
  const isSyncingHorizontalScrollRef = scheduleScrollRefs.isSyncingHorizontalScroll

  // Preserve scroll position when date changes - prevent viewport from resetting
  const previousDateStrRef = useRef<string>(selectedDateStr)
  const savedScrollPositionRef = scheduleScrollRefs.savedScrollPosition

  // Continuously track scroll position
  useEffect(() => {
    const container = contentScrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      savedScrollPositionRef.current = {
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [savedScrollPositionRef])

  // Save scroll position when date changes
  useLayoutEffect(() => {
    const container = contentScrollContainerRef.current
    if (!container) return

    if (previousDateStrRef.current !== selectedDateStr) {
      savedScrollPositionRef.current = {
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      }
      previousDateStrRef.current = selectedDateStr
    }
  }, [selectedDateStr, savedScrollPositionRef])

  // Restore scroll position when data changes - restore immediately and repeatedly until it sticks
  useLayoutEffect(() => {
    if (!data || !savedScrollPositionRef.current) return

    const container = contentScrollContainerRef.current
    if (!container) return

    const saved = savedScrollPositionRef.current
    container.scrollLeft = saved.scrollLeft
    container.scrollTop = saved.scrollTop
  }, [data, savedScrollPositionRef])

  useEffect(() => {
    if (!data || !savedScrollPositionRef.current) return

    const container = contentScrollContainerRef.current
    if (!container) return

    const saved = savedScrollPositionRef.current

    // Restore multiple times to ensure it sticks
    const restore = () => {
      if (container && saved) {
        container.scrollLeft = saved.scrollLeft
        container.scrollTop = saved.scrollTop
      }
    }

    restore()
    requestAnimationFrame(restore)
    setTimeout(restore, 0)
    setTimeout(restore, 10)
    setTimeout(restore, 50)
  }, [data, savedScrollPositionRef])

  useEffect(() => {
    dragToCreateRef.current = dragToCreate
  }, [dragToCreate])

  // Track whether any appointment action popover is open to pause hover previews
  useEffect(() => {
    const handleMenuToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ appointmentId?: string; isOpen: boolean }>).detail
      if (!detail || !detail.appointmentId) return

      const next = new Set(openAppointmentMenusRef.current)
      if (detail.isOpen) {
        next.add(detail.appointmentId)
      } else {
        next.delete(detail.appointmentId)
      }
      openAppointmentMenusRef.current = next
      setIsAppointmentMenuOpen(next.size > 0)
    }

    globalThis.addEventListener("manager-schedule:appointment-menu-toggle", handleMenuToggle as EventListener)
    return () => globalThis.removeEventListener("manager-schedule:appointment-menu-toggle", handleMenuToggle as EventListener)
  }, [])

  // Compute stations
  const stations = useMemo(() => {
    if (!data?.stations) {
      return []
    }

    if (!stationOrderIds.length) {
      return [...data.stations].sort((a, b) => {
        const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        if (orderCompare !== 0) return orderCompare
        return a.name.localeCompare(b.name, "he")
      })
    }

    const positions = new Map(stationOrderIds.map((id, index) => [id, index]))
    const fallbackPosition = stationOrderIds.length

    return [...data.stations].sort((a, b) => {
      const posA = positions.has(a.id) ? positions.get(a.id)! : fallbackPosition
      const posB = positions.has(b.id) ? positions.get(b.id)! : fallbackPosition
      if (posA !== posB) return posA - posB
      const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      if (orderCompare !== 0) return orderCompare
      return a.name.localeCompare(b.name, "he")
    })
  }, [data?.stations, stationOrderIds])

  // Compute filtered stations
  const filteredStations = useMemo(() => {
    if (!stations.length) {
      return []
    }

    let stationsToShow = shouldHideAllStations
      ? []
      : visibleStationIds.length > 0
        ? stations.filter((station) => visibleStationIds.includes(station.id))
        : stations

    if (serviceFilter === "grooming") {
      stationsToShow = stationsToShow.filter(station => station.serviceType === "grooming")
    } else if (serviceFilter === "garden") {
      stationsToShow = stationsToShow.filter(station => station.serviceType === "garden")
    }

    return stationsToShow.filter(station => station.serviceType !== "garden")
  }, [stations, visibleStationIds, serviceFilter, shouldHideAllStations])

  // Compute timeline
  const timeline = useMemo(
    () => buildTimeline(selectedDate, data, intervalMinutes, pixelsPerMinuteScale, optimisticAppointments, globalEndHour),
    [selectedDateStr, data, intervalMinutes, pixelsPerMinuteScale, optimisticAppointments, globalEndHour]
  )


  // Compute grouped appointments
  const groupedAppointments = useMemo(() => {
    if (shouldHideAllStations) {
      return new Map<string, ManagerAppointment[]>()
    }
    const allAppointments = [...(data?.appointments ?? []), ...optimisticAppointments]
    if (allAppointments.length === 0) {
      return new Map<string, ManagerAppointment[]>()
    }

    const map = new Map<string, ManagerAppointment[]>()
    for (const appointment of allAppointments) {
      // Filter out cancelled appointments
      if (isCancelledAppointment(appointment)) {
        continue
      }

      if (visibleStationIds.length > 0 && !visibleStationIds.includes(appointment.stationId)) {
        continue
      }
      if (appointment.serviceType === "garden") {
        continue
      }

      if (serviceFilter === "garden") {
        continue
      }

      const appointmentStartDate = parseISODate(appointment.startDateTime)
      const appointmentEndDate = parseISODate(appointment.endDateTime)

      if (!appointmentStartDate || !appointmentEndDate) {
        continue
      }

      const currentDayStart = startOfDay(selectedDate)
      const currentDayEnd = addHours(currentDayStart, 24)

      const isWithinCurrentDay = (
        (appointmentStartDate >= currentDayStart && appointmentStartDate < currentDayEnd) ||
        (appointmentEndDate >= currentDayStart && appointmentEndDate < currentDayEnd) ||
        (appointmentStartDate < currentDayStart && appointmentEndDate >= currentDayEnd)
      )

      if (!isWithinCurrentDay) {
        continue
      }

      if (!map.has(appointment.stationId)) {
        map.set(appointment.stationId, [])
      }
      map.get(appointment.stationId)!.push(appointment)
    }

    for (const appointments of map.values()) {
      appointments.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
    }

    return map
  }, [data?.appointments, optimisticAppointments, visibleStationIds, serviceFilter, selectedDate, shouldHideAllStations])

  // Compute visible stations - show all filtered stations (no pagination)
  const visibleStations = filteredStations // Show all stations, no window pagination

  // Compute grid template columns - station columns expand but never shrink below the standard width
  // Order: TimeAxis -> Pinned -> Waiting -> Stations (direction: rtl will place TimeAxis on the right)
  const timeAxisWidth = 70
  const scheduledColumnCount = visibleStations.length
  const gridColumnParts: string[] = [`${timeAxisWidth}px`]
  if (showPinnedAppointmentsColumn) {
    gridColumnParts.push(`${PINNED_APPOINTMENTS_COLUMN_WIDTH}px`)
  }
  if (showWaitingListColumn) {
    gridColumnParts.push(`${WAITLIST_COLUMN_WIDTH}px`)
  }
  if (scheduledColumnCount > 0) {
    const scheduledTemplate =
      scheduledColumnCount === 1
        ? `minmax(${STANDARD_COLUMN_WIDTH}px, 1fr)`
        : `repeat(${scheduledColumnCount}, minmax(${STANDARD_COLUMN_WIDTH}px, 1fr))`
    gridColumnParts.push(scheduledTemplate)
  }
  const gridTemplateColumns = gridColumnParts.join(" ")

  // Group constraints by station
  const constraintsByStation = useMemo(() => {
    const map = new Map<string, typeof constraints>()
    for (const constraint of constraints) {
      if (visibleStationIds.length > 0 && !visibleStationIds.includes(constraint.station_id)) {
        continue
      }
      if (!map.has(constraint.station_id)) {
        map.set(constraint.station_id, [])
      }
      map.get(constraint.station_id)!.push(constraint)
    }
    return map
  }, [constraints, visibleStationIds])

  // Helper function to check if a time slot is covered by an active constraint
  const isSlotCoveredByActiveConstraint = useCallback((slotTime: Date, stationId: string): boolean => {
    const stationConstraints = constraintsByStation.get(stationId) ?? []
    const slotTimeISO = slotTime.toISOString()

    return stationConstraints.some(constraint => {
      if (!constraint.is_active) return false
      const constraintStart = parseISODate(constraint.start_time)
      const constraintEnd = parseISODate(constraint.end_time)
      if (!constraintStart || !constraintEnd) return false
      return slotTimeISO >= constraintStart.toISOString() && slotTimeISO < constraintEnd.toISOString()
    })
  }, [constraintsByStation])

  // Helper function to check if a slot is generally unavailable (outside working hours)
  const isSlotGenerallyUnavailable = useCallback((slotTime: Date, stationId: string): boolean => {
    const workingHours = stationWorkingHours[stationId]
    if (!workingHours || workingHours.length === 0) {
      return true
    }

    const dayNumber = slotTime.getDay()
    const weekdayMap: Record<number, string> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    }
    const weekday = weekdayMap[dayNumber]
    if (!weekday) return true

    const slotTimeMinutes = slotTime.getHours() * 60 + slotTime.getMinutes()
    const dayShifts = workingHours.filter(h => h.weekday.toLowerCase() === weekday)
    if (dayShifts.length === 0) return true

    const isWithinShift = dayShifts.some(shift => {
      const openTimeParts = shift.open_time.split(':')
      const closeTimeParts = shift.close_time.split(':')
      const openHour = parseInt(openTimeParts[0], 10)
      const openMin = parseInt(openTimeParts[1], 10)
      const closeHour = parseInt(closeTimeParts[0], 10)
      const closeMin = parseInt(closeTimeParts[1], 10)
      const openMinutes = openHour * 60 + openMin
      const closeMinutes = closeHour * 60 + closeMin
      return slotTimeMinutes >= openMinutes && slotTimeMinutes < closeMinutes
    })

    return !isWithinShift
  }, [stationWorkingHours])

  // Helper function to check if a time slot is within a station's working hours
  const isSlotWithinWorkingHours = useCallback((slotTime: Date, stationId: string): boolean => {
    if (isSlotCoveredByActiveConstraint(slotTime, stationId)) {
      return true
    }

    const workingHours = stationWorkingHours[stationId]
    if (!workingHours || workingHours.length === 0) {
      return false
    }

    const dayNumber = slotTime.getDay()
    const weekdayMap: Record<number, string> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    }
    const weekday = weekdayMap[dayNumber]
    if (!weekday) return true

    const slotTimeMinutes = slotTime.getHours() * 60 + slotTime.getMinutes()
    const dayShifts = workingHours.filter(h => h.weekday.toLowerCase() === weekday)
    if (dayShifts.length === 0) return false

    const isWithinShift = dayShifts.some(shift => {
      const openTimeParts = shift.open_time.split(':')
      const closeTimeParts = shift.close_time.split(':')
      const openHour = parseInt(openTimeParts[0], 10)
      const openMin = parseInt(openTimeParts[1], 10)
      const closeHour = parseInt(closeTimeParts[0], 10)
      const closeMin = parseInt(closeTimeParts[1], 10)
      const openMinutes = openHour * 60 + openMin
      const closeMinutes = closeHour * 60 + closeMin
      return slotTimeMinutes >= openMinutes && slotTimeMinutes < closeMinutes
    })

    return isWithinShift
  }, [stationWorkingHours, isSlotCoveredByActiveConstraint])

  // Helper function to check if a slot is empty but restricted
  const isSlotEmptyButRestricted = useCallback((slotTime: Date, stationId: string, slotIndex: number): boolean => {
    const isAvailable = isSlotWithinWorkingHours(slotTime, stationId)
    if (!isAvailable) return false

    const workingHours = stationWorkingHours[stationId]
    if (!workingHours || workingHours.length === 0) return false

    const dayNumber = slotTime.getDay()
    const weekdayMap: Record<number, string> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday',
    }
    const weekday = weekdayMap[dayNumber]
    if (!weekday) return false

    const slotTimeMinutes = slotTime.getHours() * 60 + slotTime.getMinutes()
    const matchingShift = workingHours.find(shift => {
      if (shift.weekday.toLowerCase() !== weekday) return false
      const openTimeParts = shift.open_time.split(':')
      const closeTimeParts = shift.close_time.split(':')
      const openHour = parseInt(openTimeParts[0], 10)
      const openMin = parseInt(openTimeParts[1], 10)
      const closeHour = parseInt(closeTimeParts[0], 10)
      const closeMin = parseInt(closeTimeParts[1], 10)
      const openMinutes = openHour * 60 + openMin
      const closeMinutes = closeHour * 60 + closeMin
      return slotTimeMinutes >= openMinutes && slotTimeMinutes < closeMinutes
    })

    if (!matchingShift) return false
    const shiftRestriction = shiftRestrictions[matchingShift.id]
    if (!shiftRestriction) return false

    // Removed allowedDogCategories - barbery system doesn't use dogs
    const hasRestrictions =
      (shiftRestriction.allowedCustomerTypes?.length > 0) ||
      (shiftRestriction.blockedCustomerTypes?.length > 0)
    if (!hasRestrictions) return false

    const slotEnd = addMinutes(slotTime, intervalMinutes)
    const slotStartISO = slotTime.toISOString()
    const slotEndISO = slotEnd.toISOString()
    const stationAppointments = groupedAppointments.get(stationId) ?? []
    const hasOverlappingAppointment = stationAppointments.some((appointment) => {
      const appointmentStart = parseISODate(appointment.startDateTime)
      const appointmentEnd = parseISODate(appointment.endDateTime)
      if (!appointmentStart || !appointmentEnd) return false
      const appointmentStartISO = appointmentStart.toISOString()
      const appointmentEndISO = appointmentEnd.toISOString()
      return appointmentStartISO < slotEndISO && appointmentEndISO > slotStartISO
    })

    return !hasOverlappingAppointment
  }, [stationWorkingHours, shiftRestrictions, isSlotWithinWorkingHours, groupedAppointments, intervalMinutes])

  // Constraint handlers
  const handleEditConstraint = useCallback(async (constraint: typeof constraints[0]) => {
    dispatch(setEditingConstraintDefaultTimes(null))
    try {
      const { data: allConstraints, error } = await supabase
        .from("station_unavailability")
        .select("station_id, reason, notes")
        .eq("start_time", constraint.start_time)
        .eq("end_time", constraint.end_time)

      if (error) throw error

      if (!allConstraints || allConstraints.length === 0) {
        dispatch(setEditingConstraint(constraint))
        dispatch(setEditingConstraintStationIds([constraint.station_id]))
        dispatch(setIsConstraintDialogOpen(true))
        return
      }

      const constraintReason = constraint.reason
      const constraintNotesJson = constraint.notes ? JSON.stringify(constraint.notes) : null

      const relatedConstraints = allConstraints.filter(c => {
        const cReason = c.reason
        const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
        const reasonMatch = constraintReason === cReason || (!constraintReason && !cReason)
        const notesMatch = constraintNotesJson === cNotesJson
        return reasonMatch && notesMatch
      })

      const stationIds = Array.from(new Set(relatedConstraints.map(c => c.station_id)))

      dispatch(setEditingConstraint(constraint))
      dispatch(setEditingConstraintStationIds(stationIds.length > 0 ? stationIds : [constraint.station_id]))
      dispatch(setIsConstraintDialogOpen(true))
    } catch (error) {
      console.error("Error fetching related constraints:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את האילוץ לעריכה",
        variant: "destructive",
      })
    }
  }, [dispatch, toast])

  const handleDuplicateConstraint = useCallback((constraint: typeof constraints[0]) => {
    const startDate = new Date(constraint.start_time)
    const endDate = new Date(constraint.end_time)
    const startTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`

    dispatch(setEditingConstraint(null))
    dispatch(setEditingConstraintStationIds([constraint.station_id]))
    dispatch(setEditingConstraintDefaultTimes({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startTime: startTime,
      endTime: endTime,
    }))
    dispatch(setIsConstraintDialogOpen(true))
  }, [dispatch])

  const handleDeleteConstraintClick = useCallback(async (constraintId: string) => {
    try {
      const constraint = constraints.find(c => c.id === constraintId)
      if (!constraint) return

      const { data: allConstraints, error } = await supabase
        .from("station_unavailability")
        .select("id, station_id, reason, notes")
        .eq("start_time", constraint.start_time)
        .eq("end_time", constraint.end_time)

      if (error) throw error

      if (!allConstraints || allConstraints.length === 0) {
        dispatch(setConstraintToDelete(constraintId))
        dispatch(setConstraintToDeleteDetails(null))
        dispatch(setShowDeleteConstraintDialog(true))
        return
      }

      const constraintNotesJson = constraint.notes ? JSON.stringify(constraint.notes) : null

      const relatedConstraints = allConstraints.filter(c => {
        const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
        return constraintNotesJson === cNotesJson || (!constraintNotesJson && !cNotesJson)
      })

      const stationIds = relatedConstraints.map(c => c.station_id)
      const stationNames = stationIds
        .map(id => data?.stations?.find(s => s.id === id)?.name)
        .filter((name): name is string => Boolean(name))

      dispatch(setConstraintToDelete(constraintId))
      dispatch(setConstraintToDeleteDetails({
        constraint,
        relatedConstraints: relatedConstraints as typeof constraints,
        stationIds,
        stationNames,
      }))
      dispatch(setShowDeleteConstraintDialog(true))
    } catch (error) {
      console.error("Error fetching related constraints:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לטעון את פרטי האילוץ",
        variant: "destructive",
      })
    }
  }, [dispatch, toast, constraints, data?.stations])

  // Constraint resize handlers
  const handleConstraintResizeMove = useCallback((event: PointerEvent) => {
    const resizeState = constraintResizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const deltaY = event.clientY - resizeState.startY
    const deltaMinutes = deltaY / pixelsPerMinute
    const snappedRelativeMinutes = Math.round(deltaMinutes / intervalMinutes) * intervalMinutes

    const baseDurationMinutes = Math.max(
      intervalMinutes,
      differenceInMinutes(resizeState.initialEnd, resizeState.startDate)
    )

    const provisionalDuration = baseDurationMinutes + snappedRelativeMinutes
    const snappedDuration = Math.max(
      intervalMinutes,
      Math.round(provisionalDuration / intervalMinutes) * intervalMinutes
    )

    let candidateEnd = addMinutes(resizeState.startDate, snappedDuration)

    const minimumEnd = addMinutes(resizeState.startDate, intervalMinutes)
    const clampedToTimelineEnd = min([candidateEnd, timeline.end])
    candidateEnd = max([clampedToTimelineEnd, minimumEnd])

    if (candidateEnd.getTime() !== resizeState.currentEnd.getTime()) {
      resizeState.currentEnd = candidateEnd
      dispatch(setConstraintResizingPreview({ constraintId: resizeState.constraint.id, endDate: candidateEnd }))
    }
  }, [intervalMinutes, pixelsPerMinuteScale, timeline.end, dispatch])

  const finalizeConstraintResize = useCallback(async (resizeState: ConstraintResizeState, nextEnd: Date) => {
    const originalEndIso = resizeState.initialEnd.toISOString()
    const nextEndIso = nextEnd.toISOString()

    if (originalEndIso === nextEndIso) {
      return
    }

    // Find the full constraint data from the query results
    const fullConstraint = constraints.find(c => c.id === resizeState.constraint.id)
    if (!fullConstraint) {
      console.warn("Constraint not found for resize operation", resizeState.constraint.id)
      return
    }

    const startDate = parseISODate(fullConstraint.start_time)
    if (!startDate) {
      console.warn("Invalid constraint start_time for resize", fullConstraint)
      return
    }

    try {
      // Fetch all related constraints to determine the stations group (same as in drag move)
      const { data: allConstraints } = await supabase
        .from("station_unavailability")
        .select("station_id, reason, notes")
        .eq("start_time", fullConstraint.start_time)
        .eq("end_time", fullConstraint.end_time)

      let stationIds: string[]

      if (allConstraints) {
        const constraintReason = fullConstraint.reason
        const constraintNotesJson = fullConstraint.notes ? JSON.stringify(fullConstraint.notes) : null

        const relatedConstraints = allConstraints.filter(c => {
          const cReason = c.reason
          const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
          const reasonMatch = constraintReason === cReason || (!constraintReason && !cReason)
          const notesMatch = constraintNotesJson === cNotesJson
          return reasonMatch && notesMatch
        })

        stationIds = Array.from(new Set(relatedConstraints.map(c => c.station_id)))

        if (stationIds.length === 0) {
          stationIds = [fullConstraint.station_id]
        }
      } else {
        stationIds = [fullConstraint.station_id]
      }

      dispatch(setEditingConstraint(fullConstraint))
      dispatch(setEditingConstraintStationIds(stationIds))
      dispatch(setEditingConstraintDefaultTimes({
        startDate: startDate.toISOString(),
        endDate: nextEndIso,
        startTime: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
        endTime: `${String(nextEnd.getHours()).padStart(2, "0")}:${String(nextEnd.getMinutes()).padStart(2, "0")}`,
        isActive: fullConstraint.is_active,
      }))
      dispatch(setIsConstraintDialogOpen(true))
    } catch (error) {
      console.error("Error preparing constraint for resize edit:", error)
      toast({
        title: "שגיאה בעריכת אילוץ",
        description: "לא ניתן לפתוח את האילוץ לעריכה לאחר שינוי האורך.",
        variant: "destructive",
      })
    }
  }, [constraints, dispatch, toast])

  const handleConstraintResizeEnd = useCallback((event: PointerEvent) => {
    const resizeState = constraintResizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    // Prevent the click event from bubbling to the constraint card
    event.stopPropagation()
    event.preventDefault()

    globalThis.removeEventListener('pointermove', handleConstraintResizeMove)
    globalThis.removeEventListener('pointerup', handleConstraintResizeEnd)
    globalThis.removeEventListener('pointercancel', handleConstraintResizeEnd)

    const shouldFinalize = resizeState.currentEnd.getTime() !== resizeState.initialEnd.getTime()
    const finalEnd = resizeState.currentEnd
    constraintResizeStateRef.current = null

    // Keep constraintResizingPreview set for a bit longer so the card can detect resizing just ended
    setTimeout(() => {
      dispatch(setConstraintResizingPreview(null))
    }, 300)

    if (!shouldFinalize) {
      return
    }

    // Use setTimeout to ensure any click events don't fire after resize ends
    setTimeout(() => {
      void finalizeConstraintResize(resizeState, finalEnd)
    }, 0)
  }, [finalizeConstraintResize, handleConstraintResizeMove, dispatch])

  const handleConstraintResizeStart = useCallback((event: React.PointerEvent<HTMLButtonElement>, constraint: typeof constraints[0]) => {
    if (constraintResizeStateRef.current) {
      return
    }

    const startDate = parseISODate(constraint.start_time)
    const endDate = parseISODate(constraint.end_time)
    if (!startDate || !endDate) {
      return
    }

    const pointerId = event.pointerId

    constraintResizeStateRef.current = {
      constraint: {
        id: constraint.id,
        station_id: constraint.station_id,
        start_at: constraint.start_time,
        end_at: constraint.end_time,
        reason: constraint.reason,
        notes: constraint.notes,
      },
      startDate,
      initialEnd: endDate,
      currentEnd: endDate,
      startY: event.clientY,
      pointerId,
    }

    globalThis.addEventListener('pointermove', handleConstraintResizeMove)
    globalThis.addEventListener('pointerup', handleConstraintResizeEnd)
    globalThis.addEventListener('pointercancel', handleConstraintResizeEnd)
  }, [handleConstraintResizeMove, handleConstraintResizeEnd])

  // Render constraint block using DraggableConstraintCard
  const renderConstraintBlock = useCallback((constraint: typeof constraints[0]) => {
    return (
      <DraggableConstraintCard
        key={constraint.id}
        constraint={constraint}
        timeline={timeline}
        pixelsPerMinuteScale={pixelsPerMinuteScale}
        intervalMinutes={intervalMinutes}
        onEdit={handleEditConstraint}
        onDuplicate={handleDuplicateConstraint}
        onDelete={handleDeleteConstraintClick}
        onResizeStart={handleConstraintResizeStart}
      />
    )
  }, [timeline, pixelsPerMinuteScale, intervalMinutes, handleEditConstraint, handleDuplicateConstraint, handleDeleteConstraintClick, handleConstraintResizeStart])

  // Handlers for appointment actions
  const handleAppointmentClick = useCallback((appointment: ManagerAppointment) => {
    // Don't open sheet if currently resizing
    if (isResizingRef.current) {
      return
    }
    dispatch(setSelectedAppointment(appointment))
    dispatch(setIsDetailsOpen(true))
  }, [dispatch])

  const handleOpenProposedMeetingEditor = useCallback((
    appointment: ManagerAppointment,
    overrides?: { startTime?: Date; endTime?: Date; stationId?: string }
  ) => {
    if (!appointment.proposedMeetingId) {
      return
    }

    const startTime = overrides?.startTime ?? new Date(appointment.startDateTime)
    const endTime = overrides?.endTime ?? new Date(appointment.endDateTime)
    const stationId = overrides?.stationId ?? appointment.stationId

    dispatch(setProposedMeetingMode("edit"))
    dispatch(setEditingProposedMeeting({
      ...appointment,
      startDateTime: startTime.toISOString(),
      endDateTime: endTime.toISOString(),
      stationId,
    }))
    dispatch(setProposedMeetingTimes({
      startTime,
      endTime,
      stationId,
    }))
    dispatch(setShowProposedMeetingModal(true))
  }, [dispatch])


  // Resize handlers
  const handleResizeMove = useCallback((event: PointerEvent) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const deltaY = event.clientY - resizeState.startY
    const deltaMinutes = deltaY / pixelsPerMinute
    const snappedRelativeMinutes = Math.round(deltaMinutes / intervalMinutes) * intervalMinutes

    const baseDurationMinutes = Math.max(
      intervalMinutes,
      differenceInMinutes(resizeState.initialEnd, resizeState.startDate)
    )

    const provisionalDuration = baseDurationMinutes + snappedRelativeMinutes
    const snappedDuration = Math.max(
      intervalMinutes,
      Math.round(provisionalDuration / intervalMinutes) * intervalMinutes
    )

    let candidateEnd = addMinutes(resizeState.startDate, snappedDuration)

    const minimumEnd = addMinutes(resizeState.startDate, intervalMinutes)
    const clampedToTimelineEnd = min([candidateEnd, timeline.end])
    candidateEnd = max([clampedToTimelineEnd, minimumEnd])

    if (candidateEnd.getTime() !== resizeState.currentEnd.getTime()) {
      resizeState.currentEnd = candidateEnd
      dispatch(setResizingPreview({ appointmentId: resizeState.appointment.id, endDate: candidateEnd }))
    }
  }, [intervalMinutes, pixelsPerMinuteScale, timeline.end, dispatch])

  const finalizeResize = useCallback((resizeState: ResizeState, nextEnd: Date) => {
    const originalEndIso = resizeState.initialEnd.toISOString()
    const nextEndIso = nextEnd.toISOString()

    if (originalEndIso === nextEndIso) {
      return
    }

    const nextDuration = Math.max(
      intervalMinutes,
      differenceInMinutes(nextEnd, resizeState.startDate)
    )
    const originalDuration = Math.max(
      intervalMinutes,
      differenceInMinutes(resizeState.initialEnd, resizeState.startDate)
    )

    if (resizeState.appointment.isProposedMeeting) {
      handleOpenProposedMeetingEditor(resizeState.appointment, {
        startTime: resizeState.startDate,
        endTime: nextEnd,
        stationId: resizeState.appointment.stationId,
      })
      return
    }

    // For all appointments (including business/personal), open the correct edit modal (not sheet)
    if (data) {
      dispatch(
        supabaseApi.util.updateQueryData(
          'getManagerSchedule',
          {
            date: format(selectedDate, 'yyyy-MM-dd'),
            serviceType: serviceFilter
          },
          (draft) => {
            if (!draft) return
            const appointmentIndex = draft.appointments.findIndex(
              (apt) => apt.id === resizeState.appointment.id
            )
            if (appointmentIndex === -1) return

            draft.appointments[appointmentIndex] = {
              ...draft.appointments[appointmentIndex],
              endDateTime: nextEndIso,
              durationMinutes: nextDuration,
            }
          }
        )
      )
    }

    dispatch(setPendingResizeState({
      appointment: resizeState.appointment,
      originalEndTime: originalEndIso,
      newEndTime: nextEndIso,
      originalDuration,
      newDuration: nextDuration
    }))

    // Get the updated appointment from cache after optimistic update
    const cacheKey = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      serviceType: serviceFilter
    }
    const cachedData = supabaseApi.endpoints.getManagerSchedule.select(cacheKey)({
      managerSchedule: { selectedDate, serviceFilter }
    } as any)
    const updatedAppointment = cachedData?.appointments?.find(
      (apt: ManagerAppointment) => apt.id === resizeState.appointment.id
    ) || resizeState.appointment

    // Use updated appointment (with optimistic changes)
    const appointmentToEdit = updatedAppointment

    // Open the correct modal based on appointment type
    if (resizeState.appointment.isPersonalAppointment || resizeState.appointment.appointmentType === "private") {
      // For personal appointments, open the personal appointment edit modal
      const startDate = parseISODate(appointmentToEdit.startDateTime)
      if (!startDate) {
        toast({
          title: "שגיאה בעריכת התור",
          description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
          variant: "destructive",
        })
        return
      }

      // Set the updated appointment to edit (with optimistic changes)
      dispatch(setEditingPersonalAppointment(appointmentToEdit))

      // Open the personal appointment edit modal
      dispatch(setPersonalAppointmentEditOpen(true))
    } else {
      // For regular grooming appointments (including business), open the grooming edit modal
      const startDate = parseISODate(appointmentToEdit.startDateTime)
      if (!startDate) {
        toast({
          title: "שגיאה בעריכת התור",
          description: "לא ניתן לפתוח את עריכת התור בגלל נתוני זמן חסרים או לא תקינים.",
          variant: "destructive",
        })
        return
      }
      dispatch(setEditingGroomingAppointment(appointmentToEdit))
      dispatch(setGroomingEditOpen(true))
    }
  }, [intervalMinutes, toast, data, dispatch, selectedDate, serviceFilter, handleOpenProposedMeetingEditor, moveAppointment])

  const handleResizeEnd = useCallback((event: PointerEvent) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || event.pointerId !== resizeState.pointerId) {
      return
    }

    // Prevent the click event from bubbling to the card
    event.stopPropagation()
    event.preventDefault()

    globalThis.removeEventListener('pointermove', handleResizeMove)
    globalThis.removeEventListener('pointerup', handleResizeEnd)
    globalThis.removeEventListener('pointercancel', handleResizeEnd)

    const shouldFinalize = resizeState.currentEnd.getTime() !== resizeState.initialEnd.getTime()
    const finalEnd = resizeState.currentEnd
    resizeStateRef.current = null

    // Keep resizingPreview set for a bit longer so AppointmentCard can detect resizing just ended
    // This prevents the click event from opening the sheet
    setTimeout(() => {
      dispatch(setResizingPreview(null))
    }, 300)

    if (!shouldFinalize) {
      // Keep isResizingRef true for a bit longer to prevent any delayed click events
      setTimeout(() => {
        isResizingRef.current = false
      }, 300)
      return
    }

    // Use setTimeout to ensure the click event doesn't fire after resize ends
    // Keep isResizingRef true until after finalizeResize completes and any click events are processed
    setTimeout(() => {
      try {
        finalizeResize({ ...resizeState, currentEnd: finalEnd }, finalEnd)
      } finally {
        // Reset after a longer delay to ensure any click events have been processed
        setTimeout(() => {
          isResizingRef.current = false
        }, 300)
      }
    }, 0)
  }, [finalizeResize, handleResizeMove, dispatch])

  const handleResizeStart = useCallback((event: ReactPointerEvent<HTMLButtonElement>, appointment: ManagerAppointment) => {
    if (appointment.serviceType !== "grooming") {
      return
    }

    if (resizeStateRef.current) {
      return
    }

    const dates = getAppointmentDates(appointment)
    if (!dates) {
      return
    }

    const { start: startDate, end: endDate } = dates
    const pointerId = event.pointerId

    isResizingRef.current = true
    resizeStateRef.current = {
      appointment,
      startDate,
      initialEnd: endDate,
      currentEnd: endDate,
      startY: event.clientY,
      pointerId,
    }

    globalThis.addEventListener('pointermove', handleResizeMove)
    globalThis.addEventListener('pointerup', handleResizeEnd)
    globalThis.addEventListener('pointercancel', handleResizeEnd)
  }, [handleResizeMove, handleResizeEnd])

  // Render appointment card using standalone component
  const renderAppointmentCard = useCallback((appointment: ManagerAppointment, isDragging: boolean = false, overlapCount: number = 0) => {
    return (
      <AppointmentCard
        key={appointment.id}
        appointment={appointment}
        isDragging={isDragging}
        onResizeStart={handleResizeStart}
        overlapCount={overlapCount}
      />
    )
  }, [handleResizeStart])

  // Drag-to-create handler
  const handleCreateDragStart = useCallback((event: React.MouseEvent, stationId: string) => {
    if (draggedAppointment.appointment || draggedConstraint.constraint || draggedWaitlistEntry.entry) {
      return
    }

    const station = stations.find(s => s.id === stationId)
    if (!station || station.serviceType !== 'grooming') {
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const y = event.clientY - rect.top

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const minutesFromStart = y / pixelsPerMinute
    const rawStartTime = addMinutes(timeline.start, minutesFromStart)
    const startTime = snapTimeToInterval(rawStartTime, intervalMinutes)

    setDragToCreate({
      isDragging: true,
      startTime,
      endTime: startTime,
      stationId,
      startY: y,
      cancelled: false
    })
  }, [draggedAppointment.appointment, draggedConstraint.constraint, draggedWaitlistEntry.entry, stations, pixelsPerMinuteScale, timeline.start, intervalMinutes])

  const handleCreateDragMove = useCallback((event: React.MouseEvent | MouseEvent) => {
    const currentDrag = dragToCreateRef.current
    if (!currentDrag.isDragging || !currentDrag.startTime || !currentDrag.stationId) {
      return
    }

    const stationElement = document.getElementById(`station-${currentDrag.stationId}`)
    if (!stationElement) return

    const rect = stationElement.getBoundingClientRect()
    const y = event.clientY - rect.top

    // Calculate current time based on Y position and snap to interval
    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const minutesFromStart = y / pixelsPerMinute
    const rawCurrentTime = addMinutes(timeline.start, minutesFromStart)
    const snappedCurrentTime = snapTimeToInterval(rawCurrentTime, intervalMinutes)

    // Determine start and end times based on drag direction
    let startTime: Date
    let endTime: Date

    if (snappedCurrentTime >= currentDrag.startTime) {
      // Dragging down - start time stays the same, current time becomes end time
      startTime = currentDrag.startTime
      endTime = snappedCurrentTime
    } else {
      // Dragging up - current time becomes start time, original start time becomes end time
      startTime = snappedCurrentTime
      endTime = currentDrag.startTime
    }

    // Ensure both times are on the same date as the original start time
    const originalDate = new Date(currentDrag.startTime.getFullYear(), currentDrag.startTime.getMonth(), currentDrag.startTime.getDate())
    startTime.setFullYear(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate())
    endTime.setFullYear(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate())

    // Ensure minimum duration of at least 1 interval
    const minDuration = intervalMinutes
    const currentDuration = differenceInMinutes(endTime, startTime)

    // If the duration is less than minimum or if start and end are the same
    if (currentDuration < minDuration || startTime.getTime() === endTime.getTime()) {
      // If dragging down, extend the end time
      if (snappedCurrentTime >= currentDrag.startTime) {
        endTime = addMinutes(startTime, minDuration)
      } else {
        // If dragging up, extend the start time backwards
        startTime = addMinutes(endTime, -minDuration)
      }
    }

    setDragToCreate(prev => ({
      ...prev,
      startTime,
      endTime
    }))
  }, [pixelsPerMinuteScale, timeline.start, intervalMinutes])

  const handleCreateDragEnd = useCallback(() => {
    const currentDrag = dragToCreateRef.current

    if (!currentDrag.isDragging || !currentDrag.startTime || !currentDrag.endTime || !currentDrag.stationId) {
      setDragToCreate({
        isDragging: false,
        startTime: null,
        endTime: null,
        stationId: null,
        startY: null,
        cancelled: false
      })
      return
    }

    // If the drag was cancelled (e.g., by pressing Escape), don't show the modal
    if (currentDrag.cancelled) {
      setDragToCreate({
        isDragging: false,
        startTime: null,
        endTime: null,
        stationId: null,
        startY: null,
        cancelled: false
      })
      return
    }

    // Capture finalized times (snapped to intervals)
    dispatch(setFinalizedDragTimes({
      startTime: currentDrag.startTime,
      endTime: currentDrag.endTime,
      stationId: currentDrag.stationId
    }))

    // Reset drag state
    setDragToCreate({
      isDragging: false,
      startTime: null,
      endTime: null,
      stationId: null,
      startY: null,
      cancelled: false
    })

    // Show appointment type selection modal
    dispatch(setShowAppointmentTypeSelection(true))
  }, [dispatch])

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as
      | { type: 'appointment'; appointment: ManagerAppointment }
      | { type: 'constraint'; constraint: typeof constraints[0] }
      | { type: 'waitlist'; entry: any }
      | { type: 'pinned-appointment'; pin: any; appointment: ManagerAppointment }
      | undefined

    if (dragData?.type === 'appointment' && dragData.appointment) {
      dispatch(setDraggedAppointment({
        appointment: dragData.appointment,
        cancelled: false
      }))
      dispatch(setHighlightedSlots(null))
      return
    }

    if (dragData?.type === 'constraint' && dragData.constraint) {
      dispatch(setDraggedConstraint({
        constraint: dragData.constraint,
        cancelled: false
      }))
      dispatch(setHighlightedSlots(null))
      return
    }

    if (dragData?.type === 'waitlist' && dragData.entry) {
      dispatch(setDraggedWaitlistEntry({
        entry: dragData.entry,
        cancelled: false
      }))
      dispatch(setHighlightedSlots(null))
      return
    }

    if (dragData?.type === 'pinned-appointment' && dragData.pin && dragData.appointment) {
      dispatch(setDraggedPinnedAppointment({
        pin: dragData.pin,
        appointment: dragData.appointment,
        cancelled: false
      }))
      dispatch(setHighlightedSlots(null))
      return
    }
  }

  // Mouse move handler for highlighting slots during drag
  const updateHighlightedSlotFromMousePosition = useCallback((mouseX: number, mouseY: number) => {
    const activeWaitlistEntry = draggedWaitlistEntry.entry
    const activePinnedAppointment = draggedPinnedAppointment.pin && draggedPinnedAppointment.appointment
    const draggedItem = draggedAppointment.appointment || draggedConstraint.constraint || activeWaitlistEntry || activePinnedAppointment
    if (!draggedItem || !data) return

    // Check if mouse is over pinned appointments column - if so, don't interfere
    const pinnedColumnElement = document.querySelector('[data-testid="pinned-appointments-column"]')
    if (pinnedColumnElement) {
      const rect = pinnedColumnElement.getBoundingClientRect()
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        // Mouse is over pinned column - don't clear highlighted slots, just return
        // The drop will be handled by handleDragEnd
        return
      }
    }

    // Find which station element the mouse is over
    const stationElements = document.querySelectorAll('[data-testid^="station-"]')
    let targetStation: ManagerStation | null = null
    let stationElement: Element | null = null

    for (const element of stationElements) {
      const rect = element.getBoundingClientRect()
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        const stationId = element.getAttribute('data-testid')?.replace('station-', '')
        if (stationId) {
          targetStation = data.stations.find(s => s.id === stationId) || null
          stationElement = element
          break
        }
      }
    }

    if (!targetStation || !stationElement || !draggedItem) {
      dispatch(setHighlightedSlots(null))
      return
    }

    // Check service type match for appointments (constraints can be on any station)
    const activeAppointment = draggedAppointment.appointment || (activePinnedAppointment ? draggedPinnedAppointment.appointment : null)
    if (activeAppointment && activeAppointment.serviceType !== targetStation.serviceType) {
      dispatch(setHighlightedSlots(null))
      return
    }

    if (activeWaitlistEntry && targetStation.serviceType !== "grooming") {
      dispatch(setHighlightedSlots(null))
      return
    }

    // Calculate time slot based on mouse Y position within the station
    const stationRect = stationElement.getBoundingClientRect()
    const relativeY = mouseY - stationRect.top

    const pixelsPerMinute = PIXELS_PER_MINUTE_SCALE[pixelsPerMinuteScale - 1]
    const minutesFromStart = relativeY / pixelsPerMinute
    const startTimeSlot = Math.max(0, Math.floor(minutesFromStart / intervalMinutes))
    const maxTimeSlot = Math.floor((differenceInMinutes(timeline.end, timeline.start) / intervalMinutes))

    if (startTimeSlot < 0 || startTimeSlot >= maxTimeSlot) {
      dispatch(setHighlightedSlots(null))
      return
    }

    // Get duration based on what's being dragged
    let durationMinutes: number
    if (activeAppointment) {
      const originalStart = new Date(activeAppointment.startDateTime)
      const originalEnd = new Date(activeAppointment.endDateTime)
      durationMinutes = differenceInMinutes(originalEnd, originalStart)
    } else if (draggedConstraint.constraint) {
      const originalStart = parseISODate(draggedConstraint.constraint.start_time)
      const originalEnd = parseISODate(draggedConstraint.constraint.end_time)
      if (!originalStart || !originalEnd) {
        dispatch(setHighlightedSlots(null))
        return
      }
      durationMinutes = differenceInMinutes(originalEnd, originalStart)
    } else if (activeWaitlistEntry) {
      durationMinutes = WAITLIST_DEFAULT_DURATION_MINUTES
    } else {
      dispatch(setHighlightedSlots(null))
      return
    }

    const durationTimeSlots = Math.ceil(durationMinutes / intervalMinutes)
    const endTimeSlot = startTimeSlot + durationTimeSlots - 1

    // Create array of all time slots the appointment will occupy
    const allTimeSlots = []
    for (let i = startTimeSlot; i <= endTimeSlot; i++) {
      allTimeSlots.push(i)
    }

    dispatch(setHighlightedSlots({
      stationId: targetStation.id,
      startTimeSlot,
      endTimeSlot,
      allTimeSlots
    }))
  }, [draggedAppointment.appointment, draggedPinnedAppointment.pin, draggedPinnedAppointment.appointment, draggedConstraint.constraint, draggedWaitlistEntry.entry, data, pixelsPerMinuteScale, intervalMinutes, timeline, dispatch])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggedAppointment.appointment || draggedConstraint.constraint || draggedWaitlistEntry.entry || (draggedPinnedAppointment.pin && draggedPinnedAppointment.appointment)) {
      setMousePosition({ x: event.clientX, y: event.clientY })

      // Throttle the highlighting updates for better performance
      const now = Date.now()
      if (!lastHighlightUpdateRef.current || now - lastHighlightUpdateRef.current > 50) {
        updateHighlightedSlotFromMousePosition(event.clientX, event.clientY)
        lastHighlightUpdateRef.current = now
      }
    }
  }, [draggedAppointment.appointment, draggedConstraint.constraint, draggedWaitlistEntry.entry, draggedPinnedAppointment.pin, draggedPinnedAppointment.appointment, updateHighlightedSlotFromMousePosition])

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      return
    }

    if (draggedPinnedAppointment.pin && draggedPinnedAppointment.appointment) {
      // Check if dropping on pinned appointments column - cancel if so
      const isPinnedColumn =
        over.data?.current?.type === 'pinned-appointments-column' ||
        over.id === 'pinned-appointments-column'

      if (isPinnedColumn) {
        return
      }

      // Allow drop on stations
      const targetStationId = over.id as string
      const targetStation = stations.find(station => station.id === targetStationId)

      if (targetStation && draggedPinnedAppointment.appointment.serviceType === targetStation.serviceType) {
        return
      }

      return
    }

    if (draggedAppointment.appointment) {
      // Check if dropping on pinned appointments column - allow all appointment types
      // Check multiple ways to detect the pinned column
      const isPinnedColumn =
        over.data?.current?.type === 'pinned-appointments-column' ||
        over.id === 'pinned-appointments-column' ||
        (typeof over.id === 'string' && over.id.includes('pinned-appointments'))

      if (isPinnedColumn) {
        // Allow drop on pinned column for all appointment types
        console.log('[handleDragOver] Over pinned column, allowing drop')
        return
      }

      const targetStationId = over.id as string
      const targetStation = stations.find(station => station.id === targetStationId)

      if (!targetStation || draggedAppointment.appointment.serviceType !== targetStation.serviceType) {
        return
      }

      return
    }

    if (draggedWaitlistEntry.entry) {
      // Highlighting handled by mouse move; nothing extra needed here yet
      return
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    console.log('[Drag End] Event details:', {
      activeId: active.id,
      overId: over?.id,
      overDataType: over?.data?.current?.type,
      overData: over?.data?.current,
      draggedAppointment: draggedAppointment.appointment?.id,
      draggedAppointmentType: draggedAppointment.appointment?.serviceType,
      draggedPinnedAppointment: draggedPinnedAppointment.pin?.id,
    })

    dispatch(setHighlightedSlots(null))

    // Handle pinned appointment drag
    if (draggedPinnedAppointment.pin && draggedPinnedAppointment.appointment) {
      if (draggedPinnedAppointment.cancelled) {
        dispatch(setDraggedPinnedAppointment({ pin: null, appointment: null, cancelled: false }))
        return
      }

      // Check if dropping on a station (not on pinned column)
      const isDroppingOnPinnedColumn =
        over?.data?.current?.type === 'pinned-appointments-column' ||
        over?.id === 'pinned-appointments-column'

      if (isDroppingOnPinnedColumn) {
        // Dropping back on pinned column - just cancel
        dispatch(setDraggedPinnedAppointment({ pin: null, appointment: null, cancelled: false }))
        return
      }

      // Check if dropping on a station
      const targetStationId = highlightedSlots?.stationId || (over?.id as string)
      const targetTimeSlot = highlightedSlots?.startTimeSlot

      if (!targetStationId || targetTimeSlot === undefined) {
        dispatch(setDraggedPinnedAppointment({ pin: null, appointment: null, cancelled: false }))
        return
      }

      const targetStation = stations.find(station => station.id === targetStationId)
      if (!targetStation) {
        dispatch(setDraggedPinnedAppointment({ pin: null, appointment: null, cancelled: false }))
        return
      }

      const appointment = draggedPinnedAppointment.appointment

      // Validate same service type
      if (appointment.serviceType !== targetStation.serviceType) {
        dispatch(setDraggedPinnedAppointment({ pin: null, appointment: null, cancelled: false }))
        return
      }

      // Calculate target times
      const targetMinutes = targetTimeSlot * intervalMinutes
      const newStartTime = addMinutes(timeline.start, targetMinutes)
      const originalStart = new Date(appointment.startDateTime)
      const originalEnd = new Date(appointment.endDateTime)
      const durationMinutes = differenceInMinutes(originalEnd, originalStart)
      const newEndTime = addMinutes(newStartTime, durationMinutes)

      // Show the drop dialog
      dispatch(setPinnedAppointmentDropDetails({
        pin: draggedPinnedAppointment.pin,
        appointment,
        targetStationId,
        targetStartTime: newStartTime.toISOString(),
        targetEndTime: newEndTime.toISOString(),
      }))
      dispatch(setShowPinnedAppointmentDropDialog(true))
      dispatch(setDraggedPinnedAppointment({ pin: null, appointment: null, cancelled: false }))
      return
    }

    // Handle constraint drag
    if (draggedConstraint.constraint) {
      if (draggedConstraint.cancelled) {
        dispatch(setDraggedConstraint({ constraint: null, cancelled: false }))
        return
      }

      // Use the current highlighted slots if available, otherwise fall back to over.id
      const targetStationId = highlightedSlots?.stationId || (over?.id as string)
      const targetTimeSlot = highlightedSlots?.startTimeSlot

      if (!targetStationId || targetTimeSlot === undefined) {
        dispatch(setDraggedConstraint({ constraint: null, cancelled: false }))
        return
      }

      // Calculate new time based on the highlighted slots
      const newStartTime = addMinutes(timeline.start, targetTimeSlot * intervalMinutes)
      const constraintStart = parseISODate(draggedConstraint.constraint.start_time)
      const constraintEnd = parseISODate(draggedConstraint.constraint.end_time)
      if (!constraintStart || !constraintEnd) {
        dispatch(setDraggedConstraint({ constraint: null, cancelled: false }))
        return
      }
      const durationMinutes = differenceInMinutes(constraintEnd, constraintStart)
      const newEndTime = addMinutes(newStartTime, durationMinutes)

      // When dragging to a new column, only mark the target column
      dispatch(setEditingConstraint(draggedConstraint.constraint))
      dispatch(setEditingConstraintStationIds([targetStationId]))

      dispatch(setEditingConstraintDefaultTimes({
        startDate: newStartTime.toISOString(),
        endDate: newEndTime.toISOString(),
        startTime: `${String(newStartTime.getHours()).padStart(2, "0")}:${String(newStartTime.getMinutes()).padStart(2, "0")}`,
        endTime: `${String(newEndTime.getHours()).padStart(2, "0")}:${String(newEndTime.getMinutes()).padStart(2, "0")}`
      }))
      dispatch(setIsConstraintDialogOpen(true))
      dispatch(setDraggedConstraint({ constraint: null, cancelled: false }))
      return
    }

    if (draggedWaitlistEntry.entry) {
      if (draggedWaitlistEntry.cancelled) {
        dispatch(setDraggedWaitlistEntry({ entry: null, cancelled: false }))
        dispatch(setHighlightedSlots(null))
        return
      }

      if (over?.data?.current?.type === 'garden-column') {
        dispatch(setDraggedWaitlistEntry({ entry: null, cancelled: false }))
        dispatch(setHighlightedSlots(null))
        toast({
          title: "יעד לא נתמך",
          description: "ניתן כרגע לגרור לרוחב עמדות המספרה בלבד.",
          variant: "destructive",
        })
        return
      }

      const targetStationId = highlightedSlots?.stationId || (over?.id as string)
      const targetTimeSlot = highlightedSlots?.startTimeSlot

      if (!targetStationId || targetTimeSlot === undefined) {
        dispatch(setDraggedWaitlistEntry({ entry: null, cancelled: false }))
        dispatch(setHighlightedSlots(null))
        return
      }

      const targetStation = stations.find(station => station.id === targetStationId)
      if (!targetStation || targetStation.serviceType !== "grooming") {
        dispatch(setDraggedWaitlistEntry({ entry: null, cancelled: false }))
        dispatch(setHighlightedSlots(null))
        toast({
          title: "עמדה לא זמינה",
          description: "בחר עמדת מספרה זמינה כדי לקבוע את התור.",
          variant: "destructive",
        })
        return
      }

      const startTime = addMinutes(timeline.start, targetTimeSlot * intervalMinutes)
      const endTime = addMinutes(startTime, WAITLIST_DEFAULT_DURATION_MINUTES)

      dispatch(setPendingWaitlistPlacement({
        entry: draggedWaitlistEntry.entry,
        stationId: targetStationId,
        startTime,
        endTime,
      }))
      dispatch(setShouldRemoveFromWaitlist(true))
      dispatch(setShowWaitlistDropDialog(true))
      dispatch(setDraggedWaitlistEntry({ entry: null, cancelled: false }))
      dispatch(setHighlightedSlots(null))
      return
    }

    if (!draggedAppointment.appointment) {
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }

    // If the drag was cancelled (e.g., by pressing Escape), don't proceed with the move
    if (draggedAppointment.cancelled) {
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }


    // Check if dropping on pinned appointments column
    // Check both the data type and the ID to be more robust
    const isPinnedColumn =
      over?.data?.current?.type === 'pinned-appointments-column' ||
      over?.id === 'pinned-appointments-column'

    console.log('[Drag End] Checking pinned column:', {
      isPinnedColumn,
      overId: over?.id,
      overDataType: over?.data?.current?.type,
      overDataCurrent: over?.data?.current,
      hasAppointment: !!draggedAppointment.appointment,
    })

    if (isPinnedColumn && draggedAppointment.appointment) {
      const appointment = draggedAppointment.appointment

      console.log('[Drag to Pin] Dropping appointment on pinned column:', {
        appointmentId: appointment.id,
        appointmentType: appointment.serviceType,
        clientName: appointment.clientName,
        // Removed dogNames - barbery system doesn't use dogs
        overId: over?.id,
        overDataType: over?.data?.current?.type,
      })

      // Check if already pinned
      if (pinnedAppointmentsHook.isAppointmentPinned(appointment)) {
        console.log('[Drag to Pin] Appointment already pinned, skipping')
        dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
        toast({
          title: "תור כבר מסומן",
          description: "התור כבר נמצא ברשימת התורים המסומנים",
        })
        return
      }

      // Pin the appointment
      console.log('[Drag to Pin] Pinning appointment with reason: quick_access')
      try {
        await pinnedAppointmentsHook.handlePinAppointment(appointment, "quick_access")
        dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      } catch (error) {
        console.error('[Drag to Pin] Error pinning appointment:', error)
        dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
        // Error toast is already shown by handlePinAppointment
      }
      return
    }

    // Use the current highlighted slots if available, otherwise fall back to over.id
    const targetStationId = highlightedSlots?.stationId || (over?.id as string)
    const targetTimeSlot = highlightedSlots?.startTimeSlot

    if (!targetStationId || targetTimeSlot === undefined) {
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }

    // Find the target station
    const targetStation = stations.find(station => station.id === targetStationId)
    if (!targetStation) {
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }

    // Validate same service type
    if (draggedAppointment.appointment.serviceType !== targetStation.serviceType) {
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }

    // Find current station
    const currentStation = stations.find(station => station.id === draggedAppointment.appointment.stationId)
    if (!currentStation) {
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }

    // Calculate the new start time based on the target time slot
    const targetMinutes = targetTimeSlot * intervalMinutes
    const newStartTime = addMinutes(timeline.start, targetMinutes)

    // Calculate duration and new end time
    const originalStart = new Date(draggedAppointment.appointment.startDateTime)
    const originalEnd = new Date(draggedAppointment.appointment.endDateTime)
    const durationMinutes = differenceInMinutes(originalEnd, originalStart)
    const newEndTime = addMinutes(newStartTime, durationMinutes)

    if (draggedAppointment.appointment.isProposedMeeting) {
      handleOpenProposedMeetingEditor(draggedAppointment.appointment, {
        startTime: newStartTime,
        endTime: newEndTime,
        stationId: targetStationId,
      })
      dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
      return
    }

    // Show confirmation modal
    dispatch(setMoveDetails({
      appointment: draggedAppointment.appointment,
      oldStation: currentStation,
      newStation: targetStation,
      oldStartTime: originalStart,
      oldEndTime: originalEnd,
      newStartTime,
      newEndTime
    }))
    dispatch(setMoveConfirmationOpen(true))
    dispatch(setDraggedAppointment({ appointment: null, cancelled: false }))
  }

  // Scroll handlers
  // Pagination removed - users scroll horizontally to see all stations

  // Station filter handlers
  const handleStationToggle = useCallback((stationId: string, next: boolean) => {
    if (next) {
      dispatch(setVisibleStationIds([...visibleStationIds, stationId]))
    } else {
      dispatch(setVisibleStationIds(visibleStationIds.filter(id => id !== stationId)))
    }
  }, [visibleStationIds, dispatch])

  const handleSelectAllStations = useCallback(() => {
    dispatch(setVisibleStationIds(stations.map(s => s.id)))
  }, [stations, dispatch])

  const handleClearStations = useCallback(() => {
    dispatch(setVisibleStationIds([]))
  }, [dispatch])

  const handleStationReorderEnd = useCallback((event: { active: { id: string }, over: { id: string } | null }) => {
    if (!event.over || event.active.id === event.over.id) return

    const oldIndex = stationOrderIds.indexOf(event.active.id)
    const newIndex = stationOrderIds.indexOf(event.over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(stationOrderIds, oldIndex, newIndex)
    dispatch(setStationOrderIds(newOrder))
  }, [stationOrderIds, dispatch])

  // Search handlers - placeholder for now, will be implemented with full search functionality
  const handleScheduleSearchInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    // This will be implemented with the full search functionality
  }, [])

  const scheduleSearchDropdown = null // Will be implemented with full search functionality

  // Event listeners for drag operations
  useEffect(() => {
    if (draggedAppointment.appointment) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          dispatch(setDraggedAppointment({
            appointment: null,
            cancelled: false
          }))
          dispatch(setHighlightedSlots(null))
        }
      }

      globalThis.addEventListener('mousemove', handleMouseMove)
      globalThis.addEventListener('keydown', handleKeyDown)

      return () => {
        globalThis.removeEventListener('mousemove', handleMouseMove)
        globalThis.removeEventListener('keydown', handleKeyDown)
      }
    } else if (draggedConstraint.constraint) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          dispatch(setDraggedConstraint({
            constraint: null,
            cancelled: false
          }))
          dispatch(setHighlightedSlots(null))
        }
      }

      globalThis.addEventListener('mousemove', handleMouseMove)
      globalThis.addEventListener('keydown', handleKeyDown)

      return () => {
        globalThis.removeEventListener('mousemove', handleMouseMove)
        globalThis.removeEventListener('keydown', handleKeyDown)
      }
    } else if (draggedWaitlistEntry.entry) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          dispatch(setDraggedWaitlistEntry({
            entry: null,
            cancelled: false
          }))
          dispatch(setHighlightedSlots(null))
        }
      }

      globalThis.addEventListener('mousemove', handleMouseMove)
      globalThis.addEventListener('keydown', handleKeyDown)

      return () => {
        globalThis.removeEventListener('mousemove', handleMouseMove)
        globalThis.removeEventListener('keydown', handleKeyDown)
      }
    } else if (draggedPinnedAppointment.pin && draggedPinnedAppointment.appointment) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          dispatch(setDraggedPinnedAppointment({
            pin: null,
            appointment: null,
            cancelled: false
          }))
          dispatch(setHighlightedSlots(null))
        }
      }

      globalThis.addEventListener('mousemove', handleMouseMove)
      globalThis.addEventListener('keydown', handleKeyDown)

      return () => {
        globalThis.removeEventListener('mousemove', handleMouseMove)
        globalThis.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [draggedAppointment.appointment, draggedConstraint.constraint, draggedWaitlistEntry.entry, draggedPinnedAppointment.pin, draggedPinnedAppointment.appointment, handleMouseMove, dispatch])

  // Mouse and keyboard event listeners for drag-to-create
  useEffect(() => {
    if (!dragToCreate.isDragging) return

    const handleMouseMoveEvent = (event: MouseEvent) => {
      handleCreateDragMove(event)
    }

    const handleMouseUp = () => {
      handleCreateDragEnd()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDragToCreate(prev => ({
          ...prev,
          isDragging: false,
          cancelled: true
        }))
      }
    }

    globalThis.addEventListener('mousemove', handleMouseMoveEvent)
    globalThis.addEventListener('mouseup', handleMouseUp)
    globalThis.addEventListener('keydown', handleKeyDown)

    return () => {
      globalThis.removeEventListener('mousemove', handleMouseMoveEvent)
      globalThis.removeEventListener('mouseup', handleMouseUp)
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [dragToCreate.isDragging, handleCreateDragMove, handleCreateDragEnd])

  // Handle pinned appointment drop action
  useEffect(() => {
    if (!pinnedAppointmentDropAction || !pinnedAppointmentDropDetails) return

    const { pin, appointment, targetStationId, targetStartTime, targetEndTime } = pinnedAppointmentDropDetails
    const targetStart = new Date(targetStartTime)
    const targetEnd = new Date(targetEndTime)

    console.log('[Pinned Appointment Drop] Handling action:', {
      action: pinnedAppointmentDropAction,
      appointmentId: appointment.id,
      targetStationId,
      removeFromPinned: pinnedAppointmentDropRemoveFromPinned,
    })

    // Handle remove from pinned if requested
    const handleRemoveFromPinned = async () => {
      if (pinnedAppointmentDropRemoveFromPinned) {
        try {
          await pinnedAppointmentsHook.handleUnpinById(pin.id)
        } catch (error) {
          console.error('[Pinned Appointment Drop] Failed to unpin:', error)
        }
      }
    }

    if (pinnedAppointmentDropAction === "proposal") {
      // Create a proposed meeting
      // Check if appointment has proposedMeetingId (it's already a proposed meeting)
      if (appointment.proposedMeetingId) {
        handleOpenProposedMeetingEditor(appointment, {
          startTime: targetStart,
          endTime: targetEnd,
          stationId: targetStationId,
        })
      } else {
        // Create new proposed meeting with pre-filled data from pinned appointment
        dispatch(setProposedMeetingMode("create"))

        // Pre-fill with appointment data
        const preFilledAppointment: ManagerAppointment = {
          ...appointment,
          startDateTime: targetStart.toISOString(),
          endDateTime: targetEnd.toISOString(),
          stationId: targetStationId,
          // Add proposed meeting metadata for pre-filling
          // Removed dog references - barbery system doesn't use dogs
          proposedTitle: `תור עבור ${appointment.clientName}`,
          proposedSummary: `תור תספורת עבור ${appointment.clientName}`,
          proposedNotes: appointment.internalNotes || appointment.customerNotes || "",
        }

        dispatch(setEditingProposedMeeting(preFilledAppointment))
        dispatch(setProposedMeetingTimes({
          startTime: targetStart,
          endTime: targetEnd,
          stationId: targetStationId,
        }))
        dispatch(setShowProposedMeetingModal(true))
      }
      handleRemoveFromPinned()
    } else if (pinnedAppointmentDropAction === "move") {
      // Move the appointment
      // Check if it's a proposed meeting - if so, edit it instead
      if (appointment.isProposedMeeting || appointment.proposedMeetingId) {
        handleOpenProposedMeetingEditor(appointment, {
          startTime: targetStart,
          endTime: targetEnd,
          stationId: targetStationId,
        })
      } else {
        const targetStation = stations.find(s => s.id === targetStationId)
        const currentStation = stations.find(s => s.id === appointment.stationId)

        if (targetStation && currentStation) {
          // For grooming appointments, show move confirmation
          dispatch(setMoveDetails({
            appointment,
            oldStation: currentStation,
            newStation: targetStation,
            oldStartTime: new Date(appointment.startDateTime),
            oldEndTime: new Date(appointment.endDateTime),
            newStartTime: targetStart,
            newEndTime: targetEnd,
          }))
          dispatch(setMoveConfirmationOpen(true))
        }
      }
      handleRemoveFromPinned()
    } else if (pinnedAppointmentDropAction === "new") {
      // Create a new appointment
      // For grooming appointments, use business appointment modal
      dispatch(setFinalizedDragTimes({
        startTime: targetStart,
        endTime: targetEnd,
        stationId: targetStationId,
      }))
      // Prefill with customer from the pinned appointment
      // Removed dog prefill - barbery system doesn't use dogs
      if (appointment.clientId) {
        dispatch(setPrefillBusinessCustomer({
          id: appointment.clientId,
          fullName: appointment.clientName,
          phone: appointment.clientPhone,
          email: appointment.clientEmail,
        }))
      }
      dispatch(setShowBusinessAppointmentModal(true))
      handleRemoveFromPinned()
    }

    // Reset the action and details after processing
    dispatch(setPinnedAppointmentDropAction(null))
    dispatch(setPinnedAppointmentDropDetails(null))
    dispatch(setPinnedAppointmentDropRemoveFromPinned(false))
  }, [pinnedAppointmentDropAction, pinnedAppointmentDropDetails, pinnedAppointmentDropRemoveFromPinned, pinnedAppointmentsHook, stations, dispatch, handleOpenProposedMeetingEditor])

  // Scroll synchronization handlers
  const syncHorizontalScroll = useCallback(
    (source: "header" | "content", scrollLeft: number) => {
      const target =
        source === "header" ? contentScrollContainerRef.current : headerScrollContainerRef.current

      if (!target) return
      if (Math.abs(target.scrollLeft - scrollLeft) < 1) return

      isSyncingHorizontalScrollRef.current = true
      target.scrollLeft = scrollLeft

      if (typeof globalThis !== "undefined" && typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(() => {
          isSyncingHorizontalScrollRef.current = false
        })
      } else {
        setTimeout(() => {
          isSyncingHorizontalScrollRef.current = false
        }, 0)
      }
    },
    []
  )

  const handleContentScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isSyncingHorizontalScrollRef.current) return
      syncHorizontalScroll("content", event.currentTarget.scrollLeft)
    },
    [syncHorizontalScroll]
  )

  const handleHeaderScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (isSyncingHorizontalScrollRef.current) return
      syncHorizontalScroll("header", event.currentTarget.scrollLeft)
    },
    [syncHorizontalScroll]
  )

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  return {
    // Data
    data,
    constraints,
    stationWorkingHours,
    shiftRestrictions,

    // Computed values
    stations,
    filteredStations,
    timeline,
    groupedAppointments,
    constraintsByStation,
    visibleStations,
    gridTemplateColumns,
    scheduledColumnCount,

    // Hooks
    pinnedAppointmentsHook,
    waitingListHook,

    // State
    dragToCreate,
    optimisticAppointments,
    globalEndHour,
    mousePosition,
    isAppointmentMenuOpen,

    // Refs
    dragToCreateRef,
    resizeStateRef,
    headerScrollContainerRef,
    contentScrollContainerRef,
    isSyncingHorizontalScrollRef,

    // Redux state
    selectedDate,
    selectedDateStr,
    formattedDate,
    visibleStationIds,
    stationOrderIds,
    serviceFilter,
    intervalMinutes,
    pixelsPerMinuteScale,
    showPinnedAppointmentsColumn,
    showWaitingListColumn,
    draggedAppointment,
    draggedPinnedAppointment,
    draggedConstraint,
    draggedWaitlistEntry,
    highlightedSlots,
    resizingPreview,

    // Handlers
    handleAppointmentClick,
    handleOpenProposedMeetingEditor,
    handleResizeMove,
    finalizeResize,
    handleResizeEnd,
    handleResizeStart,
    renderAppointmentCard,
    handleCreateDragStart,
    handleCreateDragMove,
    handleCreateDragEnd,
    handleDragStart,
    updateHighlightedSlotFromMousePosition,
    handleMouseMove,
    handleDragOver,
    handleDragEnd,
    handleStationToggle,
    handleSelectAllStations,
    handleClearStations,
    handleStationReorderEnd,
    handleScheduleSearchInputKeyDown,
    scheduleSearchDropdown,
    syncHorizontalScroll,
    handleContentScroll,
    handleHeaderScroll,
    sensors,
    handleEditConstraint,
    handleDuplicateConstraint,
    handleDeleteConstraintClick,
    handleConstraintResizeStart,
    renderConstraintBlock,
    isSlotCoveredByActiveConstraint,
    isSlotGenerallyUnavailable,
    isSlotWithinWorkingHours,
    isSlotEmptyButRestricted,

    // Loading states
    isScheduleLoading,
    isScheduleFetching,
  }
}
