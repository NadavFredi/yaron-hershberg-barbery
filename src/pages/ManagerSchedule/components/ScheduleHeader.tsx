// Standalone Schedule Header Component - 100% self-contained, relies only on Redux
// Replicates the header structure from commit e77eef1a8b9d78f608e26a09cef58f1ad6f56414

import { useRef, useCallback, useMemo, useState, useEffect, useLayoutEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setVisibleStationIds,
  setStationOrderIds,
  setEditingStation,
  setIsStationEditDialogOpen,
  setStationToDuplicate,
  setIsDuplicateStationDialogOpen,
  setStationConstraintsContext,
  setIsStationConstraintsModalOpen,
  setIsScheduleSearchOpen,
  setScheduleSearchTerm,
  setIsScheduleSearchExpanded,
  setSelectedAppointment,
  setIsDetailsOpen,
  setSelectedDog,
  setIsDogDetailsOpen,
  setSelectedClient,
  setIsClientDetailsOpen,
  setSelectedDate,
  setShowWaitingListColumn,
  setShowPinnedAppointmentsColumn,
} from "@/store/slices/managerScheduleSlice"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StationFilterPopover } from "./StationFilterPopover"
import { DateNavigation } from "./dateNavigation"
import {
  Search,
  X,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Copy,
  CalendarCog,
  SlidersHorizontal,
  Loader2,
  FileText,
  UserRound,
  CalendarIcon,
  Bone,
} from "lucide-react"
import { useSensors, useSensor, PointerSensor } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { MAX_VISIBLE_STATIONS } from "../managerSchedule.module"
import { WAITLIST_COLUMN_WIDTH, PINNED_APPOINTMENTS_COLUMN_WIDTH, STANDARD_COLUMN_WIDTH, EMPTY_STATIONS_OVERRIDE_PARAM } from "../constants"
import { useGetManagerScheduleQuery, useLazySearchManagerScheduleQuery } from "@/store/services/supabaseApi"
import { useGetStationWorkingHoursQuery } from "@/store/services/supabaseApi"
import { supabase } from "@/integrations/supabase/client"
import { usePinnedAppointments } from "@/pages/ManagerSchedule/pinnedAppointments/usePinnedAppointments"
import { useWaitingList } from "@/pages/ManagerSchedule/components/waitingListColumn"
import { useDebounce } from "@/hooks/useDebounce"
import { createPortal } from "react-dom"
import { parseISODate } from "../managerSchedule.module"
import { scheduleScrollRefs } from "./scheduleScrollRefs"
import type {
  ManagerStation,
  ScheduleSearchEntry,
  ScheduleSearchResultType,
  ManagerScheduleSearchResponse,
  ClientDetails,
  ManagerAppointment,
  ManagerDog,
} from "../types"

interface ScheduleHeaderProps {
  showControlBarOnly?: boolean
  showColumnsOnly?: boolean
}

export function ScheduleHeader({ showControlBarOnly = false, showColumnsOnly = false }: ScheduleHeaderProps = {}) {
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()

  // Redux state
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const formattedDate = format(selectedDate, "yyyy-MM-dd")
  const visibleStationIds = useAppSelector((state) => state.managerSchedule.visibleStationIds)
  const stationOrderIds = useAppSelector((state) => state.managerSchedule.stationOrderIds)
  // Station window pagination removed - all stations are shown with horizontal scroll
  const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)
  const showPinnedAppointmentsColumn = useAppSelector((state) => state.managerSchedule.showPinnedAppointmentsColumn)
  const showWaitingListColumn = useAppSelector((state) => state.managerSchedule.showWaitingListColumn)
  const isStationOrderSaving = useAppSelector((state) => state.managerSchedule.isStationOrderSaving)
  const scheduleSearchTerm = useAppSelector((state) => state.managerSchedule.scheduleSearchTerm)
  const isScheduleSearchOpen = useAppSelector((state) => state.managerSchedule.isScheduleSearchOpen)
  const isScheduleSearchExpanded = useAppSelector((state) => state.managerSchedule.isScheduleSearchExpanded)
  const hasEmptyStationsOverride = searchParams.get("stations") === EMPTY_STATIONS_OVERRIDE_PARAM
  const shouldHideAllStations = hasEmptyStationsOverride && visibleStationIds.length === 0

  // Data fetching
  const { data } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both",
  })

  const groomingStationIds = useMemo(
    () => data?.stations?.filter(station => station.serviceType === 'grooming').map(station => station.id) || [],
    [data?.stations]
  )

  const { data: stationWorkingHours = {} } = useGetStationWorkingHoursQuery(
    { stationIds: groomingStationIds },
    { skip: groomingStationIds.length === 0 }
  )

  // Pinned appointments hook
  const pinnedAppointmentsHook = usePinnedAppointments({ scheduleData: data })

  // Waiting list hook
  const waitingListHook = useWaitingList({
    selectedDate,
    selectedDateStr: formattedDate,
  })

  // Ensure summary exists with defaults
  const waitingListSummary = waitingListHook.summary || { filtered: 0, total: 0, scopeCounts: {} }

  // Refs - scroll container is now in parent (ManagerScheduleContent)
  const contentScrollContainerRef = scheduleScrollRefs.contentScrollContainerRef
  const scheduleSearchContainerRef = useRef<HTMLDivElement | null>(null)
  const scheduleSearchDropdownRef = useRef<HTMLDivElement | null>(null)
  const scheduleSearchInputRef = useRef<HTMLInputElement | null>(null)
  const scheduleSearchResultsRefs = useRef<Array<HTMLDivElement | null>>([])

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

  const stationBadgeCount = hasEmptyStationsOverride
    ? 0
    : visibleStationIds.length === 0
      ? stations.length
      : visibleStationIds.length

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

    // Show only grooming stations
    return stationsToShow.filter(station => station.serviceType === "grooming")
  }, [stations, visibleStationIds, serviceFilter, shouldHideAllStations])

  // Compute visible stations - show all filtered stations (no pagination)
  const visibleStations = filteredStations // Show all stations, no window pagination

  // Compute grid template columns - station columns expand but never shrink below the standard width
  // MUST match ManagerScheduleContent order and structure exactly
  // Order: TimeAxis -> Pinned -> WaitingList -> Stations (direction: rtl will place TimeAxis on the right)
  const timeAxisWidth = 70
  const scheduledColumnCount = visibleStations.length
  const gridColumnParts: string[] = [`${timeAxisWidth}px`]
  // Order MUST match ManagerScheduleContent: TimeAxis -> Pinned -> WaitingList -> Stations
  if (showPinnedAppointmentsColumn) {
    gridColumnParts.push(`${PINNED_APPOINTMENTS_COLUMN_WIDTH}px`)
  }
  if (showWaitingListColumn) {
    gridColumnParts.push(`${WAITLIST_COLUMN_WIDTH}px`)
  }
  // Match ManagerScheduleContent: stations in one repeat() call
  if (scheduledColumnCount > 0) {
    const scheduledTemplate =
      scheduledColumnCount === 1
        ? `minmax(${STANDARD_COLUMN_WIDTH}px, 1fr)`
        : `repeat(${scheduledColumnCount}, minmax(${STANDARD_COLUMN_WIDTH}px, 1fr))`
    gridColumnParts.push(scheduledTemplate)
  }
  const gridTemplateColumns = gridColumnParts.join(" ")
  const minimumGridWidth =
    timeAxisWidth +
    (showPinnedAppointmentsColumn ? PINNED_APPOINTMENTS_COLUMN_WIDTH : 0) +
    (showWaitingListColumn ? WAITLIST_COLUMN_WIDTH : 0) +
    scheduledColumnCount * STANDARD_COLUMN_WIDTH

  // Search functionality
  const [scheduleDropdownStyle, setScheduleDropdownStyle] = useState<{ left: number; top: number; width: number } | null>(null)
  const trimmedScheduleSearchTerm = scheduleSearchTerm.trim()
  const normalizedScheduleSearchTerm = trimmedScheduleSearchTerm.toLowerCase()
  const hasScheduleSearchQuery = trimmedScheduleSearchTerm.length > 0
  const debouncedScheduleSearchTerm = useDebounce(trimmedScheduleSearchTerm, 300)
  const [triggerScheduleSearch, { isFetching: isScheduleSearchLoading }] = useLazySearchManagerScheduleQuery()
  const [remoteScheduleSearchResults, setRemoteScheduleSearchResults] = useState<ManagerScheduleSearchResponse>({
    appointments: [],
    dogs: [],
    clients: [],
  })
  const [scheduleSearchError, setScheduleSearchError] = useState<string | null>(null)
  const latestScheduleSearchTermRef = useRef<string>("")
  const [scheduleSearchActiveIndex, setScheduleSearchActiveIndex] = useState(-1)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = scheduleSearchContainerRef.current
      const dropdown = scheduleSearchDropdownRef.current
      if (!container && !dropdown) {
        return
      }
      const target = event.target as Node
      const clickedInsideInput = container?.contains(target)
      const clickedInsideDropdown = dropdown?.contains(target)
      if (!clickedInsideInput && !clickedInsideDropdown) {
        dispatch(setIsScheduleSearchOpen(false))
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
    }
  }, [dispatch])

  useEffect(() => {
    if (!debouncedScheduleSearchTerm) {
      setRemoteScheduleSearchResults({
        appointments: [],
        dogs: [],
        clients: [],
      })
      setScheduleSearchError(null)
      latestScheduleSearchTermRef.current = ""
      return
    }

    latestScheduleSearchTermRef.current = debouncedScheduleSearchTerm
    setScheduleSearchError(null)

    const searchPromise = triggerScheduleSearch({ term: debouncedScheduleSearchTerm, limit: 20 })

    searchPromise
      .unwrap()
      .then((results) => {
        if (latestScheduleSearchTermRef.current === debouncedScheduleSearchTerm) {
          setRemoteScheduleSearchResults(results)
        }
      })
      .catch((error: unknown) => {
        if (latestScheduleSearchTermRef.current === debouncedScheduleSearchTerm) {
          console.error("Error searching schedule:", error)
          const fallbackMessage =
            typeof error === "object" &&
              error !== null &&
              "data" in error &&
              typeof (error as { data?: unknown }).data === "string"
              ? (error as { data: string }).data
              : "אירעה שגיאה במהלך החיפוש. נסו שוב."
          setScheduleSearchError(fallbackMessage)
          setRemoteScheduleSearchResults({
            appointments: [],
            dogs: [],
            clients: [],
          })
        }
      })

    return () => {
      if (typeof searchPromise.abort === "function") {
        searchPromise.abort()
      }
    }
  }, [debouncedScheduleSearchTerm, triggerScheduleSearch])

  const scheduleSearchTokens = useMemo(() => {
    if (!normalizedScheduleSearchTerm) {
      return []
    }
    return normalizedScheduleSearchTerm.split(/\s+/).filter(Boolean)
  }, [normalizedScheduleSearchTerm])

  const scheduleSearchEntries = useMemo<ScheduleSearchEntry[]>(() => {
    const entries: ScheduleSearchEntry[] = []
    const appointmentDogIds = new Set<string>()

    remoteScheduleSearchResults.appointments.forEach((appointment) => {
      const appointmentDate = parseISODate(appointment.startDateTime)
      if (!appointmentDate) {
        return
      }

      const isPersonal = appointment.isPersonalAppointment ?? false
      const dog = appointment.dogs?.[0]
      const ownerName = appointment.clientName

      let entityType: ScheduleSearchResultType = "appointment"
      if (isPersonal) {
        entityType = "personal"
      } else if (dog) {
        entityType = "dog"
      } else if (ownerName) {
        entityType = "client"
      }

      appointment.dogs?.forEach((appointmentDog) => {
        if (appointmentDog?.id) {
          appointmentDogIds.add(appointmentDog.id)
        }
      })

      const searchParts = [
        appointment.clientName,
        appointment.clientEmail,
        appointment.clientPhone,
        appointment.notes,
        appointment.internalNotes,
        appointment.stationName,
        dog?.name,
        dog?.breed,
        appointment.serviceName,
        appointment.personalAppointmentDescription,
      ].filter(Boolean)

      const searchText = searchParts.join(" ").toLowerCase()

      const dateLabel = format(appointmentDate, "EEEE, d MMMM yyyy", { locale: he })
      const timeLabel = format(appointmentDate, "HH:mm")

      entries.push({
        id: `appointment-${appointment.id}`,
        appointment,
        dog,
        ownerName,
        stationName: appointment.stationName,
        serviceType: appointment.serviceType,
        serviceLabel: "מספרה",
        appointmentDate,
        dateLabel,
        timeLabel,
        entityType,
        clientName: appointment.clientName,
        searchText,
      })
    })

    remoteScheduleSearchResults.dogs.forEach(({ dog, owner }) => {
      if (!dog || appointmentDogIds.has(dog.id)) {
        return
      }
      const clientDetails = owner
        ? {
          name: owner.name,
          classification: owner.classification,
          phone: owner.phone,
          email: owner.email,
          address: owner.address,
        }
        : undefined

      const searchParts = [
        dog.name,
        dog.breed,
        owner?.name,
        owner?.phone,
        owner?.email,
      ].filter(Boolean)

      const searchText = searchParts.join(" ").toLowerCase()

      entries.push({
        id: `dog-${dog.id}`,
        dog,
        ownerName: owner?.name,
        serviceType: "grooming",
        serviceLabel: "מספרה",
        entityType: "dog",
        clientDetails,
        searchText,
        dateLabel: "",
      })
    })

    remoteScheduleSearchResults.clients.forEach((client) => {
      const clientDetails = {
        name: client.name,
        classification: client.classification,
        phone: client.phone,
        email: client.email,
        address: client.address,
      }

      const searchParts = [
        client.name,
        client.phone,
        client.email,
        client.address,
        client.classification,
        client.customerTypeName,
      ].filter(Boolean)

      const searchText = searchParts.join(" ").toLowerCase()

      entries.push({
        id: `client-${client.id}`,
        serviceType: "grooming",
        serviceLabel: "מספרה",
        entityType: "client",
        clientName: client.name,
        clientDetails,
        searchText,
        dateLabel: "",
      })
    })

    return entries
  }, [remoteScheduleSearchResults])

  const scheduleSearchResults = useMemo(() => {
    if (!scheduleSearchTokens.length) {
      return []
    }
    const filtered = scheduleSearchEntries.filter((entry) =>
      scheduleSearchTokens.every((token) => entry.searchText.includes(token))
    )
    return filtered.slice(0, 12)
  }, [scheduleSearchEntries, scheduleSearchTokens])

  const isScheduleSearchVisuallyExpanded = isScheduleSearchExpanded || hasScheduleSearchQuery || isScheduleSearchOpen
  const shouldShowScheduleSearchDropdown = isScheduleSearchOpen && isScheduleSearchVisuallyExpanded && hasScheduleSearchQuery

  useEffect(() => {
    scheduleSearchResultsRefs.current = scheduleSearchResultsRefs.current.slice(0, scheduleSearchResults.length)
  }, [scheduleSearchResults.length])

  useEffect(() => {
    setScheduleSearchActiveIndex(-1)
  }, [trimmedScheduleSearchTerm])

  useEffect(() => {
    if (!shouldShowScheduleSearchDropdown || scheduleSearchResults.length === 0) {
      if (scheduleSearchActiveIndex !== -1) {
        setScheduleSearchActiveIndex(-1)
      }
      return
    }

    if (scheduleSearchActiveIndex >= scheduleSearchResults.length) {
      setScheduleSearchActiveIndex(scheduleSearchResults.length - 1)
    }
  }, [shouldShowScheduleSearchDropdown, scheduleSearchResults.length, scheduleSearchActiveIndex])

  useEffect(() => {
    if (scheduleSearchActiveIndex < 0) {
      return
    }
    const target = scheduleSearchResultsRefs.current[scheduleSearchActiveIndex]
    if (target) {
      target.scrollIntoView({ block: "nearest" })
    }
  }, [scheduleSearchActiveIndex])

  const updateScheduleSearchDropdownPosition = useCallback(() => {
    if (!scheduleSearchContainerRef.current) {
      setScheduleDropdownStyle(null)
      return
    }
    const rect = scheduleSearchContainerRef.current.getBoundingClientRect()
    setScheduleDropdownStyle({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!shouldShowScheduleSearchDropdown) {
      setScheduleDropdownStyle(null)
      return
    }
    updateScheduleSearchDropdownPosition()
  }, [shouldShowScheduleSearchDropdown, updateScheduleSearchDropdownPosition])

  useEffect(() => {
    if (!shouldShowScheduleSearchDropdown) {
      return
    }
    window.addEventListener("resize", updateScheduleSearchDropdownPosition)
    window.addEventListener("scroll", updateScheduleSearchDropdownPosition, true)
    return () => {
      window.removeEventListener("resize", updateScheduleSearchDropdownPosition)
      window.removeEventListener("scroll", updateScheduleSearchDropdownPosition, true)
    }
  }, [shouldShowScheduleSearchDropdown, updateScheduleSearchDropdownPosition])

  const scheduleSearchActiveResultId =
    scheduleSearchActiveIndex >= 0 && scheduleSearchResults[scheduleSearchActiveIndex]
      ? `schedule-search-result-${scheduleSearchResults[scheduleSearchActiveIndex].id}`
      : undefined

  const handleScheduleSearchInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShowScheduleSearchDropdown || scheduleSearchResults.length === 0) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setScheduleSearchActiveIndex((prev) => {
        const next = prev < scheduleSearchResults.length - 1 ? prev + 1 : 0
        return next
      })
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setScheduleSearchActiveIndex((prev) => {
        const next = prev > 0 ? prev - 1 : scheduleSearchResults.length - 1
        return next
      })
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (scheduleSearchActiveIndex >= 0 && scheduleSearchResults[scheduleSearchActiveIndex]) {
        handleScheduleSearchEntryPrimaryAction(scheduleSearchResults[scheduleSearchActiveIndex])
      }
    } else if (event.key === "Escape") {
      event.preventDefault()
      dispatch(setIsScheduleSearchOpen(false))
    }
  }, [shouldShowScheduleSearchDropdown, scheduleSearchResults, scheduleSearchActiveIndex, dispatch])

  const handleScheduleSearchEntryPrimaryAction = useCallback((result: ScheduleSearchEntry) => {
    if (result.appointment) {
      dispatch(setSelectedAppointment(result.appointment))
      dispatch(setIsDetailsOpen(true))
      dispatch(setIsScheduleSearchOpen(false))
      dispatch(setScheduleSearchTerm(""))
    } else if (result.dog) {
      dispatch(setSelectedDog(result.dog))
      dispatch(setIsDogDetailsOpen(true))
      dispatch(setIsScheduleSearchOpen(false))
      dispatch(setScheduleSearchTerm(""))
    } else if (result.clientDetails) {
      dispatch(setSelectedClient({
        id: result.id.replace("client-", ""),
        name: result.clientDetails.name,
        classification: result.clientDetails.classification,
        phone: result.clientDetails.phone,
        email: result.clientDetails.email,
        address: result.clientDetails.address,
      }))
      dispatch(setIsClientDetailsOpen(true))
      dispatch(setIsScheduleSearchOpen(false))
      dispatch(setScheduleSearchTerm(""))
    }
  }, [dispatch])

  const handleScheduleSearchOpenAppointment = useCallback((appointment: ManagerAppointment) => {
    dispatch(setSelectedAppointment(appointment))
    dispatch(setIsDetailsOpen(true))
    dispatch(setIsScheduleSearchOpen(false))
  }, [dispatch])

  const handleScheduleSearchOpenDog = useCallback((dog: ManagerDog) => {
    dispatch(setSelectedDog(dog))
    dispatch(setIsDogDetailsOpen(true))
    dispatch(setIsScheduleSearchOpen(false))
  }, [dispatch])

  const handleScheduleSearchOpenClientFromDetails = useCallback((clientDetails: ClientDetails) => {
    dispatch(setSelectedClient({
      id: "",
      name: clientDetails.name,
      classification: clientDetails.classification,
      phone: clientDetails.phone,
      email: clientDetails.email,
      address: clientDetails.address,
    }))
    dispatch(setIsClientDetailsOpen(true))
    dispatch(setIsScheduleSearchOpen(false))
  }, [dispatch])

  const handleScheduleSearchOpenClientFromAppointment = useCallback((appointment: ManagerAppointment) => {
    if (!appointment.clientName) return
    dispatch(setSelectedClient({
      id: appointment.clientId || "",
      name: appointment.clientName,
      classification: appointment.clientClassification,
      phone: appointment.clientPhone,
      email: appointment.clientEmail,
    }))
    dispatch(setIsClientDetailsOpen(true))
    dispatch(setIsScheduleSearchOpen(false))
  }, [dispatch])

  const handleScheduleSearchJumpToDate = useCallback((appointment: ManagerAppointment) => {
    const appointmentDate = parseISODate(appointment.startDateTime)
    if (appointmentDate) {
      dispatch(setSelectedDate(appointmentDate.toISOString()))
      dispatch(setIsScheduleSearchOpen(false))
      dispatch(setScheduleSearchTerm(""))
    }
  }, [dispatch])

  const scheduleSearchDropdown = shouldShowScheduleSearchDropdown && scheduleDropdownStyle
    ? createPortal(
      <div
        ref={scheduleSearchDropdownRef}
        className="fixed max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ease-out"
        style={{
          top: scheduleDropdownStyle.top,
          left: scheduleDropdownStyle.left,
          width: scheduleDropdownStyle.width,
          zIndex: 9999, // Above all content
        }}
        dir="rtl"
      >
        {scheduleSearchError ? (
          <div className="px-4 py-6 text-center text-sm text-red-500">
            {scheduleSearchError}
          </div>
        ) : isScheduleSearchLoading ? (
          <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            מחפש תורים...
          </div>
        ) : scheduleSearchResults.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            לא נמצאו תוצאות עבור "{trimmedScheduleSearchTerm}"
          </div>
        ) : (
          <div
            className="divide-y divide-slate-100"
            role="listbox"
            aria-activedescendant={scheduleSearchActiveResultId}
          >
            {scheduleSearchResults.map((result, index) => {
              const badgeClass = (() => {
                if (!result.appointment) {
                  if (result.entityType === "client") {
                    return "border-purple-100 bg-purple-50 text-purple-700"
                  }
                  return "border-slate-200 bg-slate-100 text-slate-700"
                }
                return "border-blue-100 bg-blue-50 text-blue-700"
              })()
              const titleText =
                result.entityType === "personal"
                  ? result.appointment?.personalAppointmentDescription || "תור אישי"
                  : result.dog?.name || result.ownerName || "תור ללא כלב"
              const secondaryText = (() => {
                if (result.entityType === "personal") {
                  return "תור אישי ביומן ההנהלה"
                }
                if (!result.appointment) {
                  if (result.entityType === "dog") {
                    return result.ownerName ? `בעלים: ${result.ownerName}` : "כלב במערכת"
                  }
                  if (result.entityType === "client") {
                    return result.clientDetails?.classification
                      ? `סיווג: ${result.clientDetails.classification}`
                      : "לקוח במערכת"
                  }
                }
                return result.ownerName ? `לקוח: ${result.ownerName}` : "ללא פרטי לקוח"
              })()
              const stationLabel =
                result.appointment && result.stationName ? ` · עמדה ${result.stationName}` : ""
              const timeLabel =
                result.timeLabel && result.timeLabel.trim().length > 0 ? ` - ${result.timeLabel}` : ""
              const canOpenClientFromAppointment =
                Boolean(result.appointment && result.appointment.clientName)
              const hasClientDetails = Boolean(result.clientDetails)
              const showClientButton = canOpenClientFromAppointment || hasClientDetails

              return (
                <div
                  key={result.id}
                  id={`schedule-search-result-${result.id}`}
                  role="option"
                  tabIndex={0}
                  ref={(element) => {
                    scheduleSearchResultsRefs.current[index] = element
                  }}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer transition focus:outline-none",
                    scheduleSearchActiveIndex === index ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                  aria-selected={scheduleSearchActiveIndex === index}
                  onClick={() => handleScheduleSearchEntryPrimaryAction(result)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleScheduleSearchEntryPrimaryAction(result)
                    }
                  }}
                  onMouseEnter={() => setScheduleSearchActiveIndex(index)}
                  onFocus={() => setScheduleSearchActiveIndex(index)}
                >
                  <div className="flex-1 space-y-1 text-right">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                      <span>{titleText}</span>
                      {result.entityType === "personal" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-purple-200 bg-purple-50 text-purple-700"
                        >
                          תור אישי
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-semibold", badgeClass)}
                      >
                        {result.serviceLabel}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {secondaryText}
                      {stationLabel}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {result.dateLabel}
                      {timeLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {showClientButton && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900"
                        title="פתח כרטיס לקוח"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (canOpenClientFromAppointment && result.appointment) {
                            handleScheduleSearchOpenClientFromAppointment(result.appointment)
                          } else if (hasClientDetails && result.clientDetails) {
                            handleScheduleSearchOpenClientFromDetails(result.clientDetails)
                          }
                        }}
                      >
                        <UserRound className="h-4 w-4" />
                      </Button>
                    )}
                    {result.dog && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900"
                        title="פתח כרטיס כלב"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleScheduleSearchOpenDog(result.dog!)
                        }}
                      >
                        <Bone className="h-4 w-4" />
                      </Button>
                    )}
                    {result.appointment && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-gray-900"
                          title="פתח פרטי תור"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleScheduleSearchOpenAppointment(result.appointment!)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-500 hover:text-gray-900"
                          title="קפוץ לתאריך ביומן"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleScheduleSearchJumpToDate(result.appointment!)
                          }}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>,
      document.body
    )
    : null

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
    dispatch(setStationOrderIds([]))
  }, [dispatch])

  const handleRestoreDailyStations = useCallback(async () => {
    // Remove stations from URL if present - this will trigger the persistence hook to reload
    const params = new URLSearchParams(searchParams)
    const hadStationsParam = params.has("stations")
    if (hadStationsParam) {
      params.delete("stations")
      setSearchParams(params, { replace: true })
    }

    // Directly load stations from DB config for the current weekday
    // We do this directly to ensure it happens immediately, regardless of persistence hook state
    const date = selectedDate
    const weekdayMap: Record<number, string> = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    }
    const weekday = weekdayMap[date.getDay()]

    try {
      const { data, error } = await supabase
        .from("station_daily_configs")
        .select("visible_station_ids, station_order_ids")
        .eq("weekday", weekday)
        .maybeSingle()

      if (error) {
        console.error("[RestoreDaily] Error fetching station daily config:", error)
        return
      }

      console.log("[RestoreDaily] DB response for weekday", weekday, ":", data)

      if (data) {
        // Check if config exists but has empty arrays (which means no stations configured)
        const hasEmptyConfig = (!data.visible_station_ids || data.visible_station_ids.length === 0) &&
          (!data.station_order_ids || data.station_order_ids.length === 0)

        if (hasEmptyConfig) {
          console.warn("[RestoreDaily] DB config exists but has empty arrays - this means no stations are configured for", weekday)
          // Don't change anything if the config is empty - this likely means the config wasn't set up properly
          // The user should configure stations in the settings page first
          return
        }

        // Set station visibility and order from DB config
        if (data.visible_station_ids && data.visible_station_ids.length > 0) {
          console.log("[RestoreDaily] Loading stations from DB config:", data.visible_station_ids)
          dispatch(setVisibleStationIds(data.visible_station_ids))
          if (data.station_order_ids && data.station_order_ids.length > 0) {
            dispatch(setStationOrderIds(data.station_order_ids))
          } else {
            dispatch(setStationOrderIds(data.visible_station_ids))
          }
        } else {
          // Config exists but visible_station_ids is empty - this shouldn't happen if we got past the check above
          console.warn("[RestoreDaily] Config exists but visible_station_ids is empty")
          dispatch(setVisibleStationIds([]))
          dispatch(setStationOrderIds([]))
        }
      } else {
        // No config found at all - this is different from empty arrays
        console.log("[RestoreDaily] No DB config row found for", weekday, "- stations will show all by default")
        // Don't change anything - let it show all stations (default behavior)
      }
    } catch (error) {
      console.error("[RestoreDaily] Error restoring daily stations:", error)
    }
  }, [searchParams, setSearchParams, selectedDate, dispatch])

  const handleStationReorderEnd = useCallback((event: { active: { id: string }, over: { id: string } | null }) => {
    if (!event.over || event.active.id === event.over.id) return

    const oldIndex = stationOrderIds.indexOf(event.active.id)
    const newIndex = stationOrderIds.indexOf(event.over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(stationOrderIds, oldIndex, newIndex)
    dispatch(setStationOrderIds(newOrder))
  }, [stationOrderIds, dispatch])

  // Pagination removed - users scroll horizontally to see all stations

  // Search handlers
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setScheduleSearchTerm(event.target.value))
    dispatch(setIsScheduleSearchOpen(true))
  }, [dispatch])

  const handleSearchFocus = useCallback(() => {
    dispatch(setIsScheduleSearchOpen(true))
  }, [dispatch])

  const handleSearchExpand = useCallback(() => {
    dispatch(setIsScheduleSearchExpanded(true))
    dispatch(setIsScheduleSearchOpen(true))
    requestAnimationFrame(() => scheduleSearchInputRef.current?.focus())
  }, [dispatch])

  const handleClearSearch = useCallback(() => {
    dispatch(setScheduleSearchTerm(""))
  }, [dispatch])

  // Station reorder sensors
  const stationReorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  )

  // Scroll synchronization is now handled by parent container

  if (!data) {
    return null
  }

  // Control bar component
  const controlBar = (
    <div
      className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-md"
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      <div className="flex flex-nowrap items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5" dir="rtl" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
        <div className="flex flex-1 min-w-0 items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {stations.length > 0 && (
              <StationFilterPopover
                stations={stations}
                visibleStationIds={visibleStationIds}
                onSelectAll={handleSelectAllStations}
                onClear={handleClearStations}
                onRestoreDaily={handleRestoreDailyStations}
                onToggle={handleStationToggle}
                sensors={stationReorderSensors}
                onReorderEnd={handleStationReorderEnd}
                isStationOrderSaving={isStationOrderSaving}
                showWaitingListColumn={showWaitingListColumn}
                waitingListCount={waitingListSummary.filtered}
                onToggleWaitingList={(next) => {
                  dispatch(setShowWaitingListColumn(next))
                }}
                showPinnedAppointmentsColumn={showPinnedAppointmentsColumn}
                pinnedAppointmentsCount={pinnedAppointmentsHook.pinnedAppointments?.length ?? 0}
                onTogglePinnedAppointments={(next) => {
                  dispatch(setShowPinnedAppointmentsColumn(next))
                }}
                align="start"
                trigger={
                  <Button type="button" variant="outline" size="sm" className="flex items-center gap-0.5 text-[11px] px-2 h-7 flex-shrink-0">
                    <SlidersHorizontal className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">עמדות</span>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0 text-[10px] font-semibold text-blue-700 whitespace-nowrap">
                      {stationBadgeCount}/{stations.length}
                    </span>
                  </Button>
                }
              />
            )}
          </div>
          <div
            ref={scheduleSearchContainerRef}
            className={cn(
              "relative flex-1 min-w-[40px] max-w-full overflow-visible transition-[max-width] duration-300",
              isScheduleSearchVisuallyExpanded ? "max-w-[min(18rem,calc(100vw-20rem))]" : "max-w-[48px]"
            )}
            style={{ zIndex: 60 }}
          >
            {isScheduleSearchVisuallyExpanded ? (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs sm:text-sm text-gray-700 shadow-sm transition-all duration-300 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 w-full",
                  isScheduleSearchOpen ? "border-blue-200 shadow-lg scale-[1.01]" : ""
                )}
              >
                <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <input
                  ref={scheduleSearchInputRef}
                  type="text"
                  dir="rtl"
                  value={scheduleSearchTerm}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onKeyDown={handleScheduleSearchInputKeyDown}
                  placeholder="חיפוש תורים, לקוחות או כלבים"
                  className="flex-1 min-w-0 border-none bg-transparent text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  autoComplete="off"
                />
                {scheduleSearchTerm && (
                  <button
                    type="button"
                    className="text-gray-400 transition hover:text-gray-600 flex-shrink-0"
                    onClick={handleClearSearch}
                    title="נקה חיפוש"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSearchExpand}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-gray-500 shadow-sm transition-all duration-300 hover:border-blue-200 hover:text-blue-600 hover:shadow-md flex-shrink-0"
                title="פתח חיפוש"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <DateNavigation />
        </div>
      </div>
    </div>
  )

  if (showControlBarOnly) {
    return (
      <>
        {controlBar}
        {scheduleSearchDropdown}
      </>
    )
  }

  // Columns header component - extract all the columns grid content
  const columnsHeaderContent = (
    <>
      {/* Order MUST match ManagerScheduleContent: TimeAxis -> Pinned -> WaitingList -> Stations */}
      <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 shadow-sm min-w-0" dir="rtl">
        ציר זמן
      </div>

      {showPinnedAppointmentsColumn && (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm min-w-0">
          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">תורים מסומנים</span>
        </div>
      )}

      {showWaitingListColumn && (
        <div className="rounded-lg border border-emerald-100 bg-white px-3 py-1.5 shadow-sm min-w-0">
          <div className="flex items-center justify-between text-sm font-semibold text-gray-900 gap-2">
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">רשימת המתנה</span>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 flex-shrink-0">
              {waitingListSummary.filtered}/{waitingListSummary.total}
            </Badge>
          </div>
          {waitingListHook.lastUpdatedLabel && (
            <div className="text-[11px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
              להיום · עודכן {waitingListHook.lastUpdatedLabel}
            </div>
          )}
        </div>
      )}

      {/* Station columns headers with warnings and actions */}
      {visibleStations.map((station) => {
        const hasWorkingHours = stationWorkingHours[station.id] && stationWorkingHours[station.id].length > 0
        return (
          <div key={`header-${station.id}`} className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{station.name}</span>
              {!hasWorkingHours && station.serviceType === "grooming" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600 transition-colors hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 flex-shrink-0"
                      title="אין שעות עבודה מוגדרות לעמדה זו"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="bottom" className="w-56 text-sm" dir="rtl">
                    לעמדה זו אין שעות עבודה מוגדרות. הגדר שעות עבודה כדי לאפשר קבלת תורים.
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4 text-gray-600" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir="rtl">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch(setEditingStation(station))
                      dispatch(setIsStationEditDialogOpen(true))
                    }}
                  >
                    <Pencil className="h-4 w-4 ml-2" />
                    ערוך
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch(setStationToDuplicate(station))
                      dispatch(setIsDuplicateStationDialogOpen(true))
                    }}
                  >
                    <Copy className="h-4 w-4 ml-2" />
                    שכפל
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch(setStationConstraintsContext({
                        stationId: station.id,
                        stationName: station.name,
                        date: selectedDate,
                      }))
                      dispatch(setIsStationConstraintsModalOpen(true))
                    }}
                  >
                    <CalendarCog className="h-4 w-4 ml-2" />
                    נהל אילוצים
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      })}
    </>
  )

  const columnsHeader = (
    <div className="sticky top-[60px] right-0 z-20 bg-white border-b border-slate-200 mb-2 rounded-t-lg py-0.5 px-1">
      <div className="grid" dir="rtl" style={{ gridTemplateColumns, width: '100%', minWidth: `max(100%, ${minimumGridWidth}px)` }}>
        {columnsHeaderContent}
      </div>
    </div>
  )

  if (showColumnsOnly) {
    return <>{columnsHeader}</>
  }

  return (
    <>
      {controlBar}
      {columnsHeader}
      {scheduleSearchDropdown}
    </>
  )
}
