// This is a self-contained component that reads all data from Redux and hooks
// It was refactored from ManagerSchedule.tsx to be 100% self-contained with no props

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react"
import { PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { StationFilterPopover } from "./StationFilterPopover"
import { DisplaySettingsPanel } from "./DisplaySettingsPanel"
import { DailyNotes } from "./DailyNotes"
import { EMPTY_STATIONS_OVERRIDE_PARAM } from "@/pages/ManagerSchedule/constants"
import {
  setShowServiceTypeSelectionModal,
  setVisibleStationIds,
  setStationOrderIds,
  setIsStationOrderSaving,
  setShowWaitingListColumn,
  setShowPinnedAppointmentsColumn,
} from "@/store/slices/managerScheduleSlice"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { supabaseApi } from "@/store/services/supabaseApi"
import { usePinnedAppointments } from "@/pages/ManagerSchedule/pinnedAppointments/usePinnedAppointments"
import { useWaitingList } from "@/pages/ManagerSchedule/components/waitingListColumn"

export function ManagerScheduleSidebar() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Get initial collapse state from URL params
  const initialCollapsed = searchParams.get("sidebarCollapsed") === "true"
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const isUserActionRef = useRef(false)

  // Sync state with URL params when URL changes (browser back/forward)
  useEffect(() => {
    // Skip if this change was triggered by user action
    if (isUserActionRef.current) {
      isUserActionRef.current = false
      return
    }

    const urlCollapsed = searchParams.get("sidebarCollapsed") === "true"
    if (urlCollapsed !== isCollapsed) {
      setIsCollapsed(urlCollapsed)
    }
  }, [searchParams, isCollapsed])

  // Update URL params when collapse state changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (isCollapsed) {
      params.set("sidebarCollapsed", "true")
    } else {
      params.delete("sidebarCollapsed")
    }
    setSearchParams(params, { replace: true })
  }, [isCollapsed, searchParams, setSearchParams])

  // Redux state
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const formattedDate = format(selectedDate, "yyyy-MM-dd")
  const visibleStationIds = useAppSelector((state) => state.managerSchedule.visibleStationIds)
  const stationOrderIds = useAppSelector((state) => state.managerSchedule.stationOrderIds)
  const isStationOrderSaving = useAppSelector((state) => state.managerSchedule.isStationOrderSaving)
  const showWaitingListColumn = useAppSelector((state) => state.managerSchedule.showWaitingListColumn)
  const showPinnedAppointmentsColumn = useAppSelector((state) => state.managerSchedule.showPinnedAppointmentsColumn)
  const hasEmptyStationsOverride = searchParams.get("stations") === EMPTY_STATIONS_OVERRIDE_PARAM

  // Data fetching
  const { data } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both",
  })

  // Pinned appointments hook
  const pinnedAppointmentsHook = usePinnedAppointments({ scheduleData: data })

  // Waiting list hook
  const waitingListHook = useWaitingList({
    selectedDate,
    selectedDateStr,
  })

  // Stations computation
  const stations = useMemo(() => {
    if (!data?.stations) return []
    const sorted = [...data.stations].sort((a, b) => {
      const aIndex = stationOrderIds.indexOf(a.id)
      const bIndex = stationOrderIds.indexOf(b.id)
      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
    return sorted
  }, [data?.stations, stationOrderIds])

  // Station filter summary

  const stationFilterSummary = useMemo(() => {
    if (hasEmptyStationsOverride) {
      return "ללא עמדות"
    }
    if (visibleStationIds.length === 0) {
      return "כל העמדות"
    }
    if (visibleStationIds.length === stations.length) {
      return "כל העמדות"
    }
    if (visibleStationIds.length === 1) {
      const station = stations.find((s) => visibleStationIds.includes(s.id))
      return station?.name || "עמדה אחת"
    }
    return `${visibleStationIds.length} עמדות`
  }, [visibleStationIds, stations, hasEmptyStationsOverride])

  const selectedStationCountForBadge = hasEmptyStationsOverride
    ? 0
    : visibleStationIds.length === 0
      ? stations.length
      : visibleStationIds.length

  // Station handlers
  const handleStationToggle = useCallback((stationId: string, next: boolean) => {
    if (next) {
      if (!visibleStationIds.includes(stationId)) {
        dispatch(setVisibleStationIds([...visibleStationIds, stationId]))
      }
    } else {
      const nextIds = visibleStationIds.filter((id) => id !== stationId)
      dispatch(setVisibleStationIds(nextIds))
    }
  }, [dispatch, visibleStationIds])

  const handleSelectAllStations = useCallback(() => {
    if (stations.length) {
      const allIds = stations.map((station) => station.id)
      dispatch(setVisibleStationIds(allIds))
    }
  }, [dispatch, stations])

  const handleClearStations = useCallback(() => {
    dispatch(setVisibleStationIds([]))
    dispatch(setStationOrderIds([]))
  }, [dispatch])

  const handleRestoreDailyStations = useCallback(() => {
    // Remove stations from URL if present, which will trigger reload from DB config
    const params = new URLSearchParams(searchParams)
    if (params.has("stations")) {
      params.delete("stations")
      setSearchParams(params, { replace: true })
    }
    // The persistence hook will reload stations from DB config when URL param is removed
  }, [searchParams, setSearchParams])

  const persistStationOrder = useCallback(async (orderedIds: string[]) => {
    const payload = orderedIds
      .filter((id) => !id.startsWith("garden-"))
      .map((id, index) => ({ id, display_order: index }))

    if (payload.length === 0) {
      return
    }

    const enrichedPayload = payload
      .map(({ id, display_order }) => {
        const station = stations.find((s) => s.id === id)
        if (!station) {
          return null
        }
        return {
          id,
          display_order,
          name: station.name,
          is_active: station.isActive ?? true,
        }
      })
      .filter((value): value is { id: string; display_order: number; name: string; is_active: boolean } => value !== null)

    if (enrichedPayload.length === 0) {
      return
    }

    dispatch(setIsStationOrderSaving(true))
    try {
      const { error: orderError } = await supabase
        .from("stations")
        .upsert(enrichedPayload, { onConflict: "id" })

      if (orderError) throw orderError

      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
    } catch (error) {
      console.error("Error updating station order:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לעדכן את סדר העמדות",
        variant: "destructive",
      })
    } finally {
      dispatch(setIsStationOrderSaving(false))
    }
  }, [dispatch, toast, stations])

  const handleStationReorderEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = stationOrderIds.indexOf(String(active.id))
    const newIndex = stationOrderIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) {
      return
    }
    const next = arrayMove(stationOrderIds, oldIndex, newIndex)
    if (
      next.length === stationOrderIds.length &&
      next.every((id, index) => id === stationOrderIds[index])
    ) {
      return
    }
    void persistStationOrder(next)
    dispatch(setStationOrderIds(next))
  }, [dispatch, persistStationOrder, stationOrderIds])


  // Station reorder sensors
  const stationReorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  )

  // Toggle handlers for waiting list and pinned appointments
  const handleToggleWaitingList = useCallback((next: boolean) => {
    dispatch(setShowWaitingListColumn(next))
  }, [dispatch])

  const handleTogglePinnedAppointments = useCallback((next: boolean) => {
    dispatch(setShowPinnedAppointmentsColumn(next))
  }, [dispatch])

  // Get counts
  const waitingListCount = waitingListHook.waitingListEntries?.length ?? 0
  const pinnedAppointmentsCount = pinnedAppointmentsHook.pinnedAppointments?.length ?? 0

  const toggleCollapse = useCallback((e?: React.MouseEvent) => {
    // Prevent any default behavior that might cause scrolling
    e?.preventDefault()
    e?.stopPropagation()

    // Mark as user action to prevent URL sync loop
    isUserActionRef.current = true

    // Save current scroll position
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    // Lock scroll during transition
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalTop = document.body.style.top
    const originalWidth = document.body.style.width

    // Prevent scrolling by locking the body
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    setIsCollapsed((prev) => !prev)

    // Restore scroll and unlock after transition completes
    setTimeout(() => {
      // Restore body styles
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.top = originalTop
      document.body.style.width = originalWidth

      // Restore scroll position
      window.scrollTo({
        left: scrollX,
        top: scrollY,
        behavior: 'instant' as ScrollBehavior
      })
    }, 300) // Match transition duration
  }, [])

  const isUnpinMode = !showPinnedAppointmentsColumn

  return (
    <>
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out relative ${isCollapsed ? 'w-10' : 'w-64'} ${isUnpinMode ? 'h-full' : ''}`}
        style={{
          flexShrink: 0,
          minWidth: isCollapsed ? '2.5rem' : '16rem',
          width: isCollapsed ? '2.5rem' : '16rem'
        }}
        dir="rtl"
      >
        {/* Expand button - only visible when collapsed, positioned on right edge */}
        {isCollapsed && (
          <Button
            variant="default"
            size="icon"
            onClick={toggleCollapse}
            className="absolute top-0 right-0 h-10 w-10 rounded-r-lg rounded-l-none border-l-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm z-20"
            title="הרחב סרגל צד"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Main content container - slides left when collapsed */}
        <div
          className={`w-64 rounded-lg bg-gray-50 border border-gray-200 shadow-sm py-4 relative transition-transform duration-300 ease-in-out ${isCollapsed ? 'translate-x-[calc(100%+2.5rem)] opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'} ${isUnpinMode ? 'h-full flex flex-col overflow-hidden' : ''}`}
        >
          <div className="flex items-center justify-between mb-4 px-3">
            <h2 className="text-sm font-semibold text-gray-900">פאנל ניהול</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              title="צמצם סרגל צד"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className={`space-y-4 ${isUnpinMode ? 'flex-1 overflow-y-auto' : ''}`}>
            {/* Daily Notes Section - moved to top */}
            <DailyNotes />

            {/* Action Buttons Section */}
            <div className="flex flex-col gap-2">
              <Button onClick={() => dispatch(setShowServiceTypeSelectionModal(true))} className="w-full">
                קבע תור חדש
              </Button>
            </div>



            {/* Display Settings Section */}
            <DisplaySettingsPanel />
          </div>
        </div>
      </div>
    </>
  )
}
