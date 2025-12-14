import { useState, useEffect, useRef, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { STATIONS_PER_VIEW, SERVICES_PER_PAGE } from "./SettingsServiceStationMatrixSection.consts"

// Types
export interface Service {
  id: string
  name: string
  base_price: number
  description?: string | null
}

export interface Station {
  id: string
  name: string
  is_active: boolean
  display_order?: number
}

export interface MatrixCell {
  supported: boolean
  defaultTime?: number
  stationTime?: number
  remote_booking_allowed?: boolean
  is_approval_needed?: boolean
}

// Utility functions
const cloneServiceMatrix = (serviceMatrix: Record<string, MatrixCell> = {}) => {
  const cloned: Record<string, MatrixCell> = {}
  Object.entries(serviceMatrix).forEach(([stationId, cell]) => {
    cloned[stationId] = { ...cell }
  })
  return cloned
}

const cloneMatrixMap = (matrixMap: Record<string, Record<string, MatrixCell>>) => {
  const cloned: Record<string, Record<string, MatrixCell>> = {}
  Object.entries(matrixMap).forEach(([serviceId, serviceMatrix]) => {
    cloned[serviceId] = cloneServiceMatrix(serviceMatrix)
  })
  return cloned
}

// Short-lived cache so navigating away and back doesn't refetch matrix data
const MATRIX_CACHE_TTL_MS = 5 * 60 * 1000
type MatrixCache = {
  timestamp: number
  services: Service[]
  filteredServices: Service[]
  allStations: Station[]
  allStationsIncludingInactive: Station[]
  visibleStations: Station[]
  selectedStationIds: string[]
  stationPage: number
  servicePage: number
  matrix: Record<string, Record<string, MatrixCell>>
  initialMatrix: Record<string, Record<string, MatrixCell>>
}
let matrixCache: MatrixCache | null = null

export function useSettingsServiceStationMatrixSection() {
  const { toast } = useToast()

  // State
  const [services, setServices] = useState<Service[]>([])
  const [filteredServices, setFilteredServices] = useState<Service[]>([])
  const [allStations, setAllStations] = useState<Station[]>([])
  const [allStationsIncludingInactive, setAllStationsIncludingInactive] = useState<Station[]>([])
  const [visibleStations, setVisibleStations] = useState<Station[]>([])
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
  const [stationPage, setStationPage] = useState(0)
  const [servicePage, setServicePage] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string | null>(null)
  const [columnFilterNeedsApproval, setColumnFilterNeedsApproval] = useState<boolean | null>(null)
  const [columnFilterIsActive, setColumnFilterIsActive] = useState<boolean | null>(null)
  const [columnFilterRemoteBooking, setColumnFilterRemoteBooking] = useState<boolean | null>(null)
  const [columnFilterDurationMin, setColumnFilterDurationMin] = useState<string>("")
  const [columnFilterDurationMax, setColumnFilterDurationMax] = useState<string>("")
  const [matrix, setMatrix] = useState<Record<string, Record<string, MatrixCell>>>({})
  const [initialMatrix, setInitialMatrix] = useState<Record<string, Record<string, MatrixCell>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isStationDialogOpen, setIsStationDialogOpen] = useState(false)
  const [isAddStationDialogOpen, setIsAddStationDialogOpen] = useState(false)
  const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false)
  const [newStationName, setNewStationName] = useState("")
  const [newServiceName, setNewServiceName] = useState("")
  const [isAddingStation, setIsAddingStation] = useState(false)
  const [isAddingService, setIsAddingService] = useState(false)
  const [stationToDelete, setStationToDelete] = useState<Station | null>(null)
  const [stationToDuplicate, setStationToDuplicate] = useState<Station | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDuplicateConfirmOpen, setIsDuplicateConfirmOpen] = useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [serviceToDuplicate, setServiceToDuplicate] = useState<Service | null>(null)
  const [isDuplicateServiceDialogOpen, setIsDuplicateServiceDialogOpen] = useState(false)
  const [isDuplicatingService, setIsDuplicatingService] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null)
  const [isDeleteServiceDialogOpen, setIsDeleteServiceDialogOpen] = useState(false)
  const [isDeletingService, setIsDeletingService] = useState(false)
  const [isTypingDuration, setIsTypingDuration] = useState<Record<string, Record<string, boolean>>>({})
  const [durationInputValues, setDurationInputValues] = useState<Record<string, Record<string, string>>>({})
  const [isTypingDefault, setIsTypingDefault] = useState<Record<string, boolean>>({})
  const [defaultDurationInputValues, setDefaultDurationInputValues] = useState<Record<string, string>>({})
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null)
  const [savingServiceRowId, setSavingServiceRowId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const isRestoringFromCache = useRef(false)

  const fetchStationWorkingHours = async (stationId: string) => {
    try {
      const { data, error } = await supabase
        .from("station_working_hours")
        .select("*")
        .eq("station_id", stationId)
        .order("weekday")
        .order("shift_order")

      if (error) throw error
      return (data || []).map((h) => ({
        ...h,
        open_time: h.open_time?.substring(0, 5) || "",
        close_time: h.close_time?.substring(0, 5) || "",
      }))
    } catch (error) {
      console.error("Error fetching station working hours:", error)
      return []
    }
  }

  const getDefaultTimeForService = (serviceId: string): number | undefined => {
    const serviceCells = matrix[serviceId] || {}
    const firstSupported = Object.values(serviceCells).find((cell) => cell.supported)
    return firstSupported?.defaultTime
  }

  const loadMatrixData = async (servicesList: Service[], stationsList: Station[]) => {
    try {
      // Load service_station_matrix
      const { data: matrixData, error: matrixError } = await supabase
        .from("service_station_matrix")
        .select("*")
        .in(
          "service_id",
          servicesList.map((s) => s.id)
        )
        .in(
          "station_id",
          stationsList.map((s) => s.id)
        )

      if (matrixError) throw matrixError

      // Build matrix from service_station_matrix
      const matrixMap: Record<string, Record<string, MatrixCell>> = {}

      servicesList.forEach((service) => {
        matrixMap[service.id] = {}

        // Get all matrix entries for this service
        const serviceMatrixEntries = matrixData?.filter((m) => m.service_id === service.id) || []

        // Calculate default time as the most common base_time_minutes value for active entries
        const activeEntries = serviceMatrixEntries.filter((m) => m.is_active)
        const timeCounts: Record<number, number> = {}
        activeEntries.forEach((entry) => {
          const time = entry.base_time_minutes ?? 60
          timeCounts[time] = (timeCounts[time] || 0) + 1
        })
        const defaultTime =
          Object.keys(timeCounts).length > 0
            ? parseInt(
                Object.keys(timeCounts).reduce((a, b) => (timeCounts[parseInt(a)] > timeCounts[parseInt(b)] ? a : b))
              )
            : 60 // Default to 60 if no entries exist

        stationsList.forEach((station) => {
          const entry = serviceMatrixEntries.find((m) => m.station_id === station.id)
          const supported = entry?.is_active ?? false
          const stationTime = entry?.base_time_minutes ?? 60
          const remoteBooking = entry?.remote_booking_allowed ?? false
          const approvalNeeded = entry?.requires_staff_approval ?? false

          matrixMap[service.id][station.id] = {
            supported,
            defaultTime,
            stationTime: supported ? stationTime : undefined,
            remote_booking_allowed: supported ? remoteBooking : false,
            is_approval_needed: supported ? approvalNeeded : false,
          }
        })
      })

      setMatrix(matrixMap)
      setInitialMatrix(cloneMatrixMap(matrixMap))
    } catch (error: unknown) {
      console.error("Error loading matrix data:", error)
      throw error
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Load services
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name, base_price, description")
        .order("name")
      if (servicesError) throw servicesError

      // Load stations (only active ones for the matrix)
      const { data: stationsData, error: stationsError } = await supabase
        .from("stations")
        .select("id, name, is_active, display_order")
        .order("display_order", { ascending: true })
        .order("name")
      if (stationsError) throw stationsError

      const activeStations = (stationsData || []).filter((s) => s.is_active)

      setServices(servicesData || [])
      setAllStations(activeStations)
      setAllStationsIncludingInactive(stationsData || [])

      // Initialize with all stations selected by default
      if (selectedStationIds.length === 0) {
        setSelectedStationIds(activeStations.map((s) => s.id))
      }

      // Load matrix data
      await loadMatrixData(servicesData || [], activeStations)
    } catch (error: unknown) {
      console.error("Error loading data:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן לטעון את הנתונים"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Track previous filter values to detect actual filter changes (not matrix changes)
  const prevFiltersRef = useRef<{
    searchTerm: string
    selectedColumnFilter: string | null
    columnFilterIsActive: boolean | null
    columnFilterRemoteBooking: boolean | null
    columnFilterNeedsApproval: boolean | null
    columnFilterDurationMin: string
    columnFilterDurationMax: string
  }>({
    searchTerm: "",
    selectedColumnFilter: null,
    columnFilterIsActive: null,
    columnFilterRemoteBooking: null,
    columnFilterNeedsApproval: null,
    columnFilterDurationMin: "",
    columnFilterDurationMax: "",
  })

  // Filter services by search term and column filters
  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = services.filter((service) => {
      // Search filter
      if (normalizedSearch && !service.name.toLowerCase().includes(normalizedSearch)) {
        return false
      }

      // Column-specific filters (only if a column is selected)
      if (selectedColumnFilter) {
        const cell = matrix[service.id]?.[selectedColumnFilter]

        // Active/Supported filter
        if (columnFilterIsActive !== null) {
          const isActive = cell?.supported ?? false
          if (isActive !== columnFilterIsActive) {
            return false
          }
        }

        // Remote booking filter
        if (columnFilterRemoteBooking !== null) {
          const hasRemoteBooking = cell?.remote_booking_allowed ?? false
          if (hasRemoteBooking !== columnFilterRemoteBooking) {
            return false
          }
        }

        // Approval needed filter
        if (columnFilterNeedsApproval !== null) {
          const needsApproval = cell?.is_approval_needed ?? false
          if (needsApproval !== columnFilterNeedsApproval) {
            return false
          }
        }

        // Duration filter
        if (columnFilterDurationMin || columnFilterDurationMax) {
          const defaultTime = getDefaultTimeForService(service.id) ?? 60
          const stationTime = cell?.stationTime ?? defaultTime
          const duration = stationTime

          if (columnFilterDurationMin) {
            const minMinutes = parseDurationToMinutes(columnFilterDurationMin)
            if (minMinutes !== null && duration < minMinutes) {
              return false
            }
          }

          if (columnFilterDurationMax) {
            const maxMinutes = parseDurationToMinutes(columnFilterDurationMax)
            if (maxMinutes !== null && duration > maxMinutes) {
              return false
            }
          }
        }
      }

      return true
    })

    setFilteredServices(filtered)

    // Only reset service page when actual filter criteria change, not when matrix data changes
    const prevFilters = prevFiltersRef.current

    const filtersChanged =
      prevFilters.searchTerm !== searchTerm ||
      prevFilters.selectedColumnFilter !== selectedColumnFilter ||
      prevFilters.columnFilterIsActive !== columnFilterIsActive ||
      prevFilters.columnFilterRemoteBooking !== columnFilterRemoteBooking ||
      prevFilters.columnFilterNeedsApproval !== columnFilterNeedsApproval ||
      prevFilters.columnFilterDurationMin !== columnFilterDurationMin ||
      prevFilters.columnFilterDurationMax !== columnFilterDurationMax

    if (filtersChanged) {
      setServicePage(0)
      prevFiltersRef.current = {
        searchTerm,
        selectedColumnFilter,
        columnFilterIsActive,
        columnFilterRemoteBooking,
        columnFilterNeedsApproval,
        columnFilterDurationMin,
        columnFilterDurationMax,
      }
    }
  }, [
    services,
    searchTerm,
    selectedColumnFilter,
    columnFilterIsActive,
    columnFilterRemoteBooking,
    columnFilterNeedsApproval,
    columnFilterDurationMin,
    columnFilterDurationMax,
    matrix,
  ])

  // Update visible stations with pagination (no rotation, stops at end) or column filter
  // Use allStationsIncludingInactive to show both active and inactive stations
  useEffect(() => {
    const selected = allStationsIncludingInactive.filter((s) => selectedStationIds.includes(s.id))
    if (selected.length === 0) {
      setVisibleStations([])
      return
    }

    // If column filter is selected, show only that column
    if (selectedColumnFilter) {
      const filteredStation = selected.find((s) => s.id === selectedColumnFilter)
      setVisibleStations(filteredStation ? [filteredStation] : [])
      return
    }

    // Simple pagination: start from stationPage index, show STATIONS_PER_VIEW stations
    const startIdx = stationPage
    const endIdx = Math.min(startIdx + STATIONS_PER_VIEW, selected.length)
    const paginated = selected.slice(startIdx, endIdx)
    setVisibleStations(paginated)
  }, [allStationsIncludingInactive, selectedStationIds, stationPage, selectedColumnFilter])

  // Persist matrix state in a short-lived cache to avoid refetching when returning to this tab
  useEffect(() => {
    if (isLoading || isRestoringFromCache.current) return
    matrixCache = {
      timestamp: Date.now(),
      services,
      filteredServices,
      allStations,
      allStationsIncludingInactive,
      visibleStations,
      selectedStationIds,
      stationPage,
      servicePage,
      matrix: cloneMatrixMap(matrix),
      initialMatrix: cloneMatrixMap(initialMatrix),
    }
  }, [
    isLoading,
    services,
    filteredServices,
    allStations,
    allStationsIncludingInactive,
    visibleStations,
    selectedStationIds,
    stationPage,
    servicePage,
    matrix,
    initialMatrix,
  ])

  useEffect(() => {
    const cached = matrixCache
    const isCacheFresh = cached && Date.now() - cached.timestamp < MATRIX_CACHE_TTL_MS

    if (isCacheFresh && cached) {
      isRestoringFromCache.current = true
      setServices(cached.services)
      setFilteredServices(cached.filteredServices)
      setAllStations(cached.allStations)
      setAllStationsIncludingInactive(cached.allStationsIncludingInactive)
      setVisibleStations(cached.visibleStations)
      setSelectedStationIds(cached.selectedStationIds)
      setStationPage(cached.stationPage)
      setServicePage(cached.servicePage)
      setMatrix(cloneMatrixMap(cached.matrix))
      setInitialMatrix(cloneMatrixMap(cached.initialMatrix))
      setIsLoading(false)
      queueMicrotask(() => {
        isRestoringFromCache.current = false
      })
      return
    }

    loadData()
  }, [])

  const serviceHasMatrixChanges = (serviceId: string): boolean => {
    const current = matrix[serviceId]
    const initial = initialMatrix[serviceId]
    if (!current || !initial) return false

    const stationIds = new Set([...Object.keys(current), ...Object.keys(initial)])
    for (const stationId of stationIds) {
      const currentCell = current[stationId]
      const initialCell = initial[stationId]

      const normalizedCurrent = {
        supported: currentCell?.supported ?? false,
        stationTime: currentCell?.supported ? currentCell?.stationTime ?? null : null,
        defaultTime: currentCell?.defaultTime ?? null,
        remote_booking_allowed: currentCell?.supported ? currentCell?.remote_booking_allowed ?? false : false,
        is_approval_needed: currentCell?.supported ? currentCell?.is_approval_needed ?? false : false,
      }
      const normalizedInitial = {
        supported: initialCell?.supported ?? false,
        stationTime: initialCell?.supported ? initialCell?.stationTime ?? null : null,
        defaultTime: initialCell?.defaultTime ?? null,
        remote_booking_allowed: initialCell?.supported ? initialCell?.remote_booking_allowed ?? false : false,
        is_approval_needed: initialCell?.supported ? initialCell?.is_approval_needed ?? false : false,
      }

      if (
        normalizedCurrent.supported !== normalizedInitial.supported ||
        normalizedCurrent.stationTime !== normalizedInitial.stationTime ||
        normalizedCurrent.defaultTime !== normalizedInitial.defaultTime ||
        normalizedCurrent.remote_booking_allowed !== normalizedInitial.remote_booking_allowed ||
        normalizedCurrent.is_approval_needed !== normalizedInitial.is_approval_needed
      ) {
        return true
      }
    }

    return false
  }

  const getServiceStatus = (serviceId: string): "none" | "some" | "all" => {
    const serviceCells = matrix[serviceId] || {}
    const allStationIds = allStations.map((s) => s.id)
    const enabledStations = allStationIds.filter((stationId) => serviceCells[stationId]?.supported).length
    const totalStations = allStationIds.length

    if (totalStations === 0) return "none"
    if (enabledStations === 0) return "none"
    if (enabledStations === totalStations) return "all"
    return "some"
  }

  const toggleServiceExpand = (serviceId: string) => {
    setExpandedServiceId((prev) => {
      return prev === serviceId ? null : serviceId
    })
  }

  // Handlers
  const handleToggleSupport = (serviceId: string, stationId: string) => {
    const cell = matrix[serviceId]?.[stationId]
    const currentSupported = cell?.supported ?? false
    const newSupported = !currentSupported

    // Get default time for this service
    const defaultTime = getDefaultTimeForService(serviceId) ?? 60

    // Update UI only - no API call
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
      const cell = newMatrix[serviceId][stationId] || { supported: false }

      newMatrix[serviceId][stationId] = {
        ...cell,
        supported: newSupported,
        defaultTime: defaultTime,
        stationTime: newSupported ? cell.stationTime ?? defaultTime : undefined,
        remote_booking_allowed: newSupported ? cell.remote_booking_allowed ?? false : false,
        is_approval_needed: newSupported ? cell.is_approval_needed ?? false : false,
      }

      return newMatrix
    })
  }

  const handleDefaultTimeChange = (serviceId: string, value: string) => {
    const time = value ? parseInt(value) : undefined
    if (!time || time < 0) return

    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      // Update default time for all supported stations
      Object.keys(newMatrix[serviceId]).forEach((stationId) => {
        const cell = newMatrix[serviceId][stationId]
        if (cell.supported) {
          newMatrix[serviceId][stationId] = {
            ...cell,
            defaultTime: time,
            // If station doesn't have override, update stationTime too
            stationTime: cell.stationTime === undefined ? time : cell.stationTime,
          }
        }
      })

      return newMatrix
    })
  }

  const handleStationTimeChange = (serviceId: string, stationId: string, value: string) => {
    const time = value ? parseInt(value) : undefined
    if (!time || time < 0) return

    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
      const cell = newMatrix[serviceId][stationId] || { supported: false }

      newMatrix[serviceId][stationId] = {
        ...cell,
        stationTime: time,
      }

      return newMatrix
    })
  }

  const handleApplyDefaultToAll = (serviceId: string) => {
    const defaultTime = getDefaultTimeForService(serviceId)
    if (!defaultTime || defaultTime < 0) {
      toast({
        title: "שגיאה",
        description: "אנא הגדר זמן ברירת מחדל תחילה",
        variant: "destructive",
      })
      return
    }

    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      // Apply default time to all supported stations
      Object.keys(newMatrix[serviceId]).forEach((stationId) => {
        const cell = newMatrix[serviceId][stationId]
        if (cell.supported) {
          newMatrix[serviceId][stationId] = {
            ...cell,
            defaultTime: defaultTime,
            stationTime: defaultTime, // Override station-specific time with default
          }
        }
      })

      return newMatrix
    })
  }

  const handleToggleStationSelection = (stationId: string) => {
    setSelectedStationIds((prev) => {
      if (prev.includes(stationId)) {
        return prev.filter((id) => id !== stationId)
      } else {
        return [...prev, stationId]
      }
    })
    setStationPage(0) // Reset to first page when selection changes
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // Calculate new order
    const previousOrder = [...selectedStationIds]
    const oldIndex = previousOrder.indexOf(active.id as string)
    const newIndex = previousOrder.indexOf(over.id as string)

    if (oldIndex === -1 || newIndex === -1) return

    const newItems = [...previousOrder]
    newItems.splice(oldIndex, 1)
    newItems.splice(newIndex, 0, active.id as string)

    // Optimistically update UI
    setSelectedStationIds(newItems)

    try {
      // Update display_order in database for all stations
      // Selected stations get their new order (0, 1, 2, ...)
      // Unselected stations get higher numbers to maintain their relative order
      const selectedUpdates = newItems.map((stationId, index) => ({
        id: stationId,
        display_order: index,
      }))

      // Get unselected stations and assign them higher display_order values
      // Use allStationsIncludingInactive to handle both active and inactive stations
      const unselectedStations = allStationsIncludingInactive.filter((s) => !newItems.includes(s.id))
      const unselectedUpdates = unselectedStations.map((station, index) => ({
        id: station.id,
        display_order: newItems.length + index,
      }))

      // Combine all updates
      const allUpdates = [...selectedUpdates, ...unselectedUpdates]

      // Batch update all stations
      for (const update of allUpdates) {
        const { error } = await supabase
          .from("stations")
          .update({ display_order: update.display_order })
          .eq("id", update.id)

        if (error) throw error
      }

      // Reload stations to reflect new order
      const { data: stationsData, error: stationsError } = await supabase
        .from("stations")
        .select("id, name, is_active, display_order")
        .order("display_order", { ascending: true })
        .order("name")

      if (stationsError) throw stationsError

      if (stationsData) {
        const activeStations = stationsData.filter((s) => s.is_active)
        setAllStations(activeStations)
        setAllStationsIncludingInactive(stationsData)

        // Update selectedStationIds to match the new order from database
        // This ensures the order matches what's in the DB
        // Include both active and inactive stations in the order
        const orderedSelectedIds = stationsData.filter((s) => newItems.includes(s.id)).map((s) => s.id)

        setSelectedStationIds(orderedSelectedIds)
      }

      toast({
        title: "הצלחה",
        description: "סדר העמדות עודכן בהצלחה",
      })
    } catch (error: unknown) {
      console.error("Error updating station order:", error)
      // Revert to previous order on error
      setSelectedStationIds(previousOrder)

      const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את סדר העמדות"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleTurnOnAllStations = (serviceId: string) => {
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      allStations.forEach((station) => {
        const cell = newMatrix[serviceId][station.id] || { supported: false }
        const defaultTime = cell.defaultTime || getDefaultTimeForService(serviceId) || 60

        newMatrix[serviceId][station.id] = {
          supported: true,
          defaultTime: defaultTime,
          stationTime: cell.stationTime || defaultTime,
        }
      })

      return newMatrix
    })
  }

  const handleTurnOffAllStations = (serviceId: string) => {
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) return newMatrix

      allStations.forEach((station) => {
        if (newMatrix[serviceId][station.id]) {
          newMatrix[serviceId][station.id] = {
            ...newMatrix[serviceId][station.id],
            supported: false,
            remote_booking_allowed: false,
            is_approval_needed: false,
          }
        }
      })

      return newMatrix
    })
  }

  const handleMarkAllRemoteBooking = (serviceId: string) => {
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      allStations.forEach((station) => {
        const cell = newMatrix[serviceId][station.id] || { supported: false }
        if (cell.supported) {
          newMatrix[serviceId][station.id] = {
            ...cell,
            remote_booking_allowed: true,
          }
        }
      })

      return newMatrix
    })
  }

  const handleMarkAllNoRemoteBooking = (serviceId: string) => {
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      allStations.forEach((station) => {
        const cell = newMatrix[serviceId][station.id] || { supported: false }
        if (cell.supported) {
          newMatrix[serviceId][station.id] = {
            ...cell,
            remote_booking_allowed: false,
          }
        }
      })

      return newMatrix
    })
  }

  const handleMarkAllApprovalNeeded = (serviceId: string) => {
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      allStations.forEach((station) => {
        const cell = newMatrix[serviceId][station.id] || { supported: false }
        if (cell.supported) {
          newMatrix[serviceId][station.id] = {
            ...cell,
            is_approval_needed: true,
          }
        }
      })

      return newMatrix
    })
  }

  const handleMarkAllNoApprovalNeeded = (serviceId: string) => {
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

      allStations.forEach((station) => {
        const cell = newMatrix[serviceId][station.id] || { supported: false }
        if (cell.supported) {
          newMatrix[serviceId][station.id] = {
            ...cell,
            is_approval_needed: false,
          }
        }
      })

      return newMatrix
    })
  }

  const handleAddService = async () => {
    if (!newServiceName.trim()) {
      toast({
        title: "שגיאה",
        description: "שם השירות נדרש",
        variant: "destructive",
      })
      return
    }

    setIsAddingService(true)
    try {
      console.log("[SettingsServiceStationMatrixSection] Creating service:", newServiceName.trim())

      const { data: newService, error } = await supabase
        .from("services")
        .insert({ name: newServiceName.trim(), base_price: 0 })
        .select("id, name, base_price, description")
        .single()

      if (error) {
        console.error("[SettingsServiceStationMatrixSection] Error creating service:", error)
        throw error
      }

      console.log("[SettingsServiceStationMatrixSection] Service created successfully:", newService)

      toast({
        title: "הצלחה",
        description: "השירות נוסף בהצלחה",
      })

      setNewServiceName("")
      setIsAddServiceDialogOpen(false)

      // Add the new service to the current list and reload matrix data
      if (newService) {
        const updatedServices = [...services, newService].sort((a, b) => a.name.localeCompare(b.name))
        setServices(updatedServices)

        // Initialize matrix for new service
        await loadMatrixData(updatedServices, allStations)
      }
    } catch (error: unknown) {
      console.error("[SettingsServiceStationMatrixSection] Error adding service:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן להוסיף את השירות"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsAddingService(false)
    }
  }

  const handleAddStation = async () => {
    if (!newStationName.trim()) {
      toast({
        title: "שגיאה",
        description: "שם העמדה נדרש",
        variant: "destructive",
      })
      return
    }

    setIsAddingStation(true)
    try {
      const { data: newStation, error } = await supabase
        .from("stations")
        .insert({ name: newStationName.trim(), is_active: true })
        .select("id, name, is_active")
        .single()

      if (error) throw error

      toast({
        title: "הצלחה",
        description: "העמדה נוספה בהצלחה",
      })

      setNewStationName("")
      setIsAddStationDialogOpen(false)

      // Reload stations
      const { data: stationsData, error: stationsError } = await supabase
        .from("stations")
        .select("id, name, is_active, display_order")
        .order("display_order", { ascending: true })
        .order("name")

      if (!stationsError && stationsData) {
        const activeStations = stationsData.filter((s) => s.is_active)
        setAllStations(activeStations)
        setAllStationsIncludingInactive(stationsData)

        // Add to selected stations by default
        if (newStation && !selectedStationIds.includes(newStation.id)) {
          setSelectedStationIds([...selectedStationIds, newStation.id])
        }

        // Reload matrix data with new station
        await loadMatrixData(services, activeStations)
      }
    } catch (error: unknown) {
      console.error("Error adding station:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן להוסיף את העמדה"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsAddingStation(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save all service_station_matrix entries
      const matrixToUpsert: Array<{
        service_id: string
        station_id: string
        base_time_minutes: number
        price_adjustment: number
        is_active: boolean
        remote_booking_allowed: boolean
        requires_staff_approval: boolean
      }> = []

      for (const service of services) {
        const serviceCells = matrix[service.id] || {}

        // Get default time for this service
        const defaultTime = getDefaultTimeForService(service.id) ?? 60

        // Process all stations for this service
        for (const [stationId, cell] of Object.entries(serviceCells)) {
          const isActive = cell?.supported ?? false
          const stationTime = cell?.stationTime ?? defaultTime

          matrixToUpsert.push({
            service_id: service.id,
            station_id: stationId,
            base_time_minutes: isActive ? stationTime : 60,
            price_adjustment: 0, // Price adjustment is handled separately if needed
            is_active: isActive,
            remote_booking_allowed: cell?.remote_booking_allowed ?? false,
            requires_staff_approval: cell?.is_approval_needed ?? false,
          })
        }
      }

      // Batch upsert all matrix entries
      if (matrixToUpsert.length > 0) {
        const { error: upsertError } = await supabase.from("service_station_matrix").upsert(matrixToUpsert, {
          onConflict: "service_id,station_id",
        })

        if (upsertError) throw upsertError
      }

      toast({
        title: "הצלחה",
        description: "המטריצה נשמרה בהצלחה",
      })

      // Reload data
      await loadData()
    } catch (error: unknown) {
      console.error("Error saving matrix:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את המטריצה"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveServiceRow = async (serviceId: string) => {
    const matrixChanges = serviceHasMatrixChanges(serviceId)

    if (!matrixChanges) return

    const service = services.find((s) => s.id === serviceId)
    const serviceName = service?.name ?? ""
    const matrixSnapshot = cloneServiceMatrix(matrix[serviceId] || {})

    setSavingServiceRowId(serviceId)

    try {
      const defaultTime = getDefaultTimeForService(serviceId) ?? 60

      // Ensure we save entries for ALL stations, not just those that have been interacted with
      const allStationIds = new Set([...Object.keys(matrixSnapshot), ...allStations.map((s) => s.id)])

      const matrixToUpsert = Array.from(allStationIds).map((stationId) => {
        const cell = matrixSnapshot[stationId]
        const isActive = cell?.supported ?? false
        const remoteBooking = isActive ? cell?.remote_booking_allowed ?? false : false

        return {
          service_id: serviceId,
          station_id: stationId,
          base_time_minutes: isActive ? cell?.stationTime ?? defaultTime : 60,
          price_adjustment: 0,
          is_active: isActive,
          remote_booking_allowed: remoteBooking,
          requires_staff_approval: isActive ? cell?.is_approval_needed ?? false : false,
        }
      })

      if (matrixToUpsert.length > 0) {
        const { error } = await supabase.from("service_station_matrix").upsert(matrixToUpsert, {
          onConflict: "service_id,station_id",
        })

        if (error) throw error
      }

      setInitialMatrix((prev) => ({
        ...prev,
        [serviceId]: cloneServiceMatrix(matrixSnapshot),
      }))

      toast({
        title: "הצלחה",
        description: `השינויים עבור ${serviceName || "השירות"} נשמרו בהצלחה`,
      })
    } catch (error: unknown) {
      console.error("Error saving service row:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את השינויים לשירות"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSavingServiceRowId(null)
    }
  }

  const handleRevertServiceRow = (serviceId: string) => {
    const initialServiceMatrix = initialMatrix[serviceId]
    if (!initialServiceMatrix) return

    setMatrix((prev) => ({
      ...prev,
      [serviceId]: cloneServiceMatrix(initialServiceMatrix),
    }))

    setDurationInputValues((prev) => {
      const updated = { ...prev }
      delete updated[serviceId]
      return updated
    })

    setIsTypingDuration((prev) => {
      const updated = { ...prev }
      delete updated[serviceId]
      return updated
    })

    setDefaultDurationInputValues((prev) => {
      const updated = { ...prev }
      delete updated[serviceId]
      return updated
    })

    setIsTypingDefault((prev) => {
      const updated = { ...prev }
      delete updated[serviceId]
      return updated
    })
  }

  const handleToggleRemoteBooking = (serviceId: string, stationId: string) => {
    const cell = matrix[serviceId]?.[stationId]
    if (!cell || !cell.supported) return

    const currentRemoteBooking = cell.remote_booking_allowed ?? false
    const newRemoteBooking = !currentRemoteBooking

    // Update UI only - no API call
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
      const cell = newMatrix[serviceId][stationId] || { supported: false }
      newMatrix[serviceId][stationId] = {
        ...cell,
        remote_booking_allowed: newRemoteBooking,
      }
      return newMatrix
    })
  }

  const handleToggleApproval = (serviceId: string, stationId: string) => {
    const cell = matrix[serviceId]?.[stationId]
    if (!cell || !cell.supported) return

    const currentApproval = cell.is_approval_needed ?? false
    const newApproval = !currentApproval

    // Update UI only - no API call
    setMatrix((prev) => {
      const newMatrix = { ...prev }
      if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
      const cell = newMatrix[serviceId][stationId] || { supported: false }
      newMatrix[serviceId][stationId] = {
        ...cell,
        is_approval_needed: newApproval,
      }
      return newMatrix
    })
  }

  // Calculate pagination limits for stations (no cycling, stops at end)
  // Compute visible services with pagination
  const maxServicePage = Math.max(0, Math.ceil(filteredServices.length / SERVICES_PER_PAGE) - 1)
  const visibleServices = filteredServices.slice(servicePage * SERVICES_PER_PAGE, (servicePage + 1) * SERVICES_PER_PAGE)
  const canGoPreviousService = servicePage > 0
  const canGoNextService = servicePage < maxServicePage

  const handleNextServicePage = () => {
    if (filteredServices.length <= SERVICES_PER_PAGE) return
    const nextPage = servicePage + 1
    if (nextPage <= maxServicePage) {
      setServicePage(nextPage)
    }
  }

  const handlePreviousServicePage = () => {
    if (filteredServices.length <= SERVICES_PER_PAGE) return
    const prevPage = servicePage - 1
    if (prevPage >= 0) {
      setServicePage(prevPage)
    }
  }

  const maxStationPage = Math.max(0, selectedStationIds.length - STATIONS_PER_VIEW)
  const canGoPreviousStation = stationPage > 0
  const canGoNextStation = stationPage < maxStationPage

  const handleNextStationPage = () => {
    if (selectedStationIds.length <= STATIONS_PER_VIEW) return
    const nextPage = stationPage + 1
    if (nextPage <= maxStationPage) {
      setStationPage(nextPage)
    }
  }

  const handlePreviousStationPage = () => {
    if (selectedStationIds.length <= STATIONS_PER_VIEW) return
    const prevPage = stationPage - 1
    if (prevPage >= 0) {
      setStationPage(prevPage)
    }
  }

  const handleDuplicateStation = (station: Station) => {
    setStationToDuplicate(station)
    setIsDuplicateConfirmOpen(true)
  }

  const handleDuplicateService = (service: Service) => {
    setServiceToDuplicate(service)
    setIsDuplicateServiceDialogOpen(true)
  }

  const handleDeleteService = (service: Service) => {
    setServiceToDelete(service)
    setIsDeleteServiceDialogOpen(true)
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return

    setIsDeletingService(true)

    try {
      const { error } = await supabase.from("services").delete().eq("id", serviceToDelete.id)
      if (error) throw error

      toast({
        title: "הצלחה",
        description: "השירות נמחק בהצלחה",
      })

      setIsDeleteServiceDialogOpen(false)
      setServiceToDelete(null)

      // Reload all data to reflect the deletion
      await loadData()
    } catch (error: unknown) {
      console.error("Error deleting service:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את השירות"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsDeletingService(false)
    }
  }

  const confirmDuplicateService = async (params: {
    mode: "new" | "existing"
    name?: string
    targetServiceIds?: string[]
    copyDetails: boolean
    copyStationRelations: boolean
  }) => {
    if (!serviceToDuplicate) return

    setIsDuplicateServiceDialogOpen(false)
    setIsDuplicatingService(true)

    try {
      const sourceServiceId = serviceToDuplicate.id

      if (params.mode === "new") {
        // Create new service
        if (!params.name) throw new Error("Service name is required for new service")

        const { data: newService, error: serviceError } = await supabase
          .from("services")
          .insert({
            name: params.name,
            base_price: serviceToDuplicate.base_price,
            description: serviceToDuplicate.description,
          })
          .select()
          .single()

        if (serviceError) throw serviceError
        if (!newService) throw new Error("Failed to create duplicate service")

        const newServiceId = newService.id

        // Duplicate station relations (only if checkbox is checked)
        if (params.copyStationRelations) {
          const originalServiceCells = matrix[sourceServiceId] || {}
          const stationIds = Object.keys(originalServiceCells)

          for (const stationId of stationIds) {
            const cell = originalServiceCells[stationId]
            if (cell?.supported) {
              // Get the original values
              const originalStationTime = cell.stationTime ?? 60
              const originalRemoteBooking = cell.remote_booking_allowed ?? false
              const originalApprovalNeeded = cell.is_approval_needed ?? false

              // Copy service_station_matrix with ALL values
              await supabase.from("service_station_matrix").upsert(
                {
                  service_id: newServiceId,
                  station_id: stationId,
                  base_time_minutes: originalStationTime,
                  price_adjustment: 0,
                  is_active: true,
                  remote_booking_allowed: originalRemoteBooking,
                  requires_staff_approval: originalApprovalNeeded,
                },
                { onConflict: "service_id,station_id" }
              )
            }
          }
        }

        toast({
          title: "הצלחה",
          description: "השירות שוכפל בהצלחה",
        })

        // Reload all data to include the new service
        await loadData()
      } else {
        // Copy to existing services
        if (!params.targetServiceIds || params.targetServiceIds.length === 0) {
          throw new Error("At least one target service is required")
        }

        const sourceService = services.find((s) => s.id === sourceServiceId)
        if (!sourceService) throw new Error("Source service not found")

        // Process each target service
        for (const targetId of params.targetServiceIds) {
          if (params.copyDetails) {
            // Update service details (but NOT the name - keep existing service name)
            const { error: updateError } = await supabase
              .from("services")
              .update({
                base_price: sourceService.base_price,
                description: sourceService.description,
              })
              .eq("id", targetId)

            if (updateError) throw updateError
          }

          // Copy station relations if requested
          if (params.copyStationRelations) {
            const originalServiceCells = matrix[sourceServiceId] || {}
            const stationIds = Object.keys(originalServiceCells)

            for (const stationId of stationIds) {
              const cell = originalServiceCells[stationId]
              if (cell?.supported) {
                // Get the original values
                const originalStationTime = cell.stationTime ?? 60
                const originalRemoteBooking = cell.remote_booking_allowed ?? false
                const originalApprovalNeeded = cell.is_approval_needed ?? false

                // Copy service_station_matrix with ALL values
                await supabase.from("service_station_matrix").upsert(
                  {
                    service_id: targetId,
                    station_id: stationId,
                    base_time_minutes: originalStationTime,
                    price_adjustment: 0,
                    is_active: true,
                    remote_booking_allowed: originalRemoteBooking,
                    requires_staff_approval: originalApprovalNeeded,
                  },
                  { onConflict: "service_id,station_id" }
                )
              }
            }
          }
        }

        toast({
          title: "הצלחה",
          description: `הנתונים הועתקו ל-${params.targetServiceIds.length} שירותים בהצלחה`,
        })

        // Reload all data
        await loadData()
      }
    } catch (error: unknown) {
      console.error("Error duplicating service:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את השירות"
      toast({
        title: "שגיאה",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsDuplicatingService(false)
      setServiceToDuplicate(null)
    }
  }

  const confirmDuplicateStation = async (params: {
    mode: "new" | "existing"
    name?: string
    targetStationIds?: string[]
    copyDetails: boolean
    copyServiceRelations: boolean
  }) => {
    if (!stationToDuplicate) return

    setIsDuplicateConfirmOpen(false)
    setIsAddingStation(true)

    try {
      const sourceStationId = stationToDuplicate.id
      let targetStationId: string

      if (params.mode === "new") {
        // Create new station with provided name
        if (!params.name) throw new Error("Station name is required for new station")

        const { data: newStation, error } = await supabase
          .from("stations")
          .insert({ name: params.name, is_active: true })
          .select("id, name, is_active")
          .single()

        if (error) throw error
        targetStationId = newStation.id

        // Copy working hours
        const originalWorkingHours = await fetchStationWorkingHours(sourceStationId)
        if (originalWorkingHours.length > 0) {
          const shiftsToInsert = originalWorkingHours.map((shift) => ({
            station_id: targetStationId,
            weekday: shift.weekday,
            open_time: shift.open_time,
            close_time: shift.close_time,
            shift_order: shift.shift_order || 0,
          }))

          const { error: hoursError } = await supabase.from("station_working_hours").insert(shiftsToInsert)
          if (hoursError) throw hoursError
        }
      } else {
        // Copy to existing stations
        if (!params.targetStationIds || params.targetStationIds.length === 0) {
          throw new Error("At least one target station is required")
        }

        const sourceStation = allStations.find((s) => s.id === sourceStationId)
        if (!sourceStation) throw new Error("Source station not found")

        // Process each target station
        for (const targetId of params.targetStationIds) {
          if (params.copyDetails) {
            // Update is_active (but NOT the name - keep existing station name)
            const { error: updateError } = await supabase
              .from("stations")
              .update({
                is_active: sourceStation.is_active,
              })
              .eq("id", targetId)

            if (updateError) throw updateError

            // Copy working hours - delete existing and insert new ones
            const { error: deleteError } = await supabase
              .from("station_working_hours")
              .delete()
              .eq("station_id", targetId)

            if (deleteError) throw deleteError

            const originalWorkingHours = await fetchStationWorkingHours(sourceStationId)
            if (originalWorkingHours.length > 0) {
              const shiftsToInsert = originalWorkingHours.map((shift) => ({
                station_id: targetId,
                weekday: shift.weekday,
                open_time: shift.open_time,
                close_time: shift.close_time,
                shift_order: shift.shift_order || 0,
              }))

              const { error: hoursError } = await supabase.from("station_working_hours").insert(shiftsToInsert)
              if (hoursError) throw hoursError
            }
          }

          // Copy service relations if requested
          if (params.copyServiceRelations) {
            // Get the original station's base_time_minutes from service_station_matrix
            const { data: originalMatrixData } = await supabase
              .from("service_station_matrix")
              .select("base_time_minutes")
              .eq("station_id", sourceStationId)
              .maybeSingle()

            const originalBaseTime = originalMatrixData?.base_time_minutes || 0

            // Copy the base_time_minutes to the target station
            const { error: baseTimeError } = await supabase.from("service_station_matrix").upsert(
              {
                station_id: targetId,
                base_time_minutes: originalBaseTime,
                price: 0,
              },
              { onConflict: "service_id,station_id" }
            )

            if (baseTimeError) throw baseTimeError

            // Now copy all service-specific matrix values
            const serviceIds = Object.keys(matrix)
            for (const serviceId of serviceIds) {
              const cell = matrix[serviceId]?.[sourceStationId]
              if (cell?.supported) {
                // Get the original values
                const originalStationTime = cell.stationTime ?? 60
                const originalRemoteBooking = cell.remote_booking_allowed ?? false
                const originalApprovalNeeded = cell.is_approval_needed ?? false

                // Copy service_station_matrix with ALL values
                await supabase.from("service_station_matrix").upsert(
                  {
                    service_id: serviceId,
                    station_id: targetId,
                    base_time_minutes: originalStationTime,
                    price_adjustment: 0,
                    is_active: true,
                    remote_booking_allowed: originalRemoteBooking,
                    requires_staff_approval: originalApprovalNeeded,
                  },
                  { onConflict: "service_id,station_id" }
                )
              }
            }
          }
        }

        // Reload stations and matrix data
        const { data: stationsData } = await supabase.from("stations").select("id, name, is_active").order("name")

        if (stationsData) {
          const activeStations = stationsData.filter((s) => s.is_active)
          setAllStations(activeStations)
          setAllStationsIncludingInactive(stationsData)

          // Reload matrix data to ensure everything is in sync
          await loadMatrixData(services, activeStations)
        }

        toast({
          title: "הצלחה",
          description: `הנתונים הועתקו ל-${params.targetStationIds.length} עמדות בהצלחה`,
        })

        setStationToDuplicate(null)
        setIsAddingStation(false)
        return
      }

      // Copy all matrix values for this station (only if checkbox is checked and mode is "new")
      const serviceIds = Object.keys(matrix)

      if (params.mode === "new" && params.copyServiceRelations) {
        // For each service that was supported in the original station, ensure it's supported in the target one
        for (const serviceId of serviceIds) {
          const cell = matrix[serviceId]?.[sourceStationId]
          if (cell?.supported) {
            // Get the original values
            const originalStationTime = cell.stationTime ?? 60
            const originalRemoteBooking = cell.remote_booking_allowed ?? false
            const originalApprovalNeeded = cell.is_approval_needed ?? false

            // Copy service_station_matrix with ALL values
            await supabase.from("service_station_matrix").upsert(
              {
                service_id: serviceId,
                station_id: targetStationId,
                base_time_minutes: originalStationTime,
                price_adjustment: 0,
                is_active: true,
                remote_booking_allowed: originalRemoteBooking,
                requires_staff_approval: originalApprovalNeeded,
              },
              { onConflict: "service_id,station_id" }
            )
          }
        }
      }

      // Reload stations and matrix data
      const { data: stationsData } = await supabase
        .from("stations")
        .select("id, name, is_active, display_order")
        .order("display_order", { ascending: true })
        .order("name")

      if (stationsData) {
        const activeStations = stationsData.filter((s) => s.is_active)
        setAllStations(activeStations)
        setAllStationsIncludingInactive(stationsData)

        // Add new station to selected stations (only for new mode)
        if (params.mode === "new" && !selectedStationIds.includes(targetStationId)) {
          setSelectedStationIds([...selectedStationIds, targetStationId])
        }

        // Reload matrix data to ensure everything is in sync
        await loadMatrixData(services, activeStations)
      }

      toast({
        title: "הצלחה",
        description: params.mode === "new" ? "העמדה שוכפלה בהצלחה עם כל הערכים" : "הנתונים הועתקו לעמדה הקיימת בהצלחה",
      })
    } catch (error: unknown) {
      console.error("Error duplicating station:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן לשכפל את העמדה",
        variant: "destructive",
      })
    } finally {
      setIsAddingStation(false)
    }

    setStationToDuplicate(null)
  }

  const handleDeleteStation = (station: Station) => {
    setStationToDelete(station)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDeleteStation = () => {
    if (!stationToDelete) return

    setIsDeleteConfirmOpen(false)
    setIsTransferDialogOpen(true)
  }

  const handleTransferAndDelete = async (targetStationId: string) => {
    if (!stationToDelete) return

    if (targetStationId === stationToDelete.id) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להעביר תורים לאותה עמדה",
        variant: "destructive",
      })
      return
    }

    try {
      // Transfer appointments from stationToDelete to targetStationId
      const { error: transferError } = await supabase
        .from("appointments")
        .update({ station_id: targetStationId })
        .eq("station_id", stationToDelete.id)

      if (transferError) throw transferError

      // Delete the station (this will cascade delete related records)
      const { error: deleteError } = await supabase.from("stations").delete().eq("id", stationToDelete.id)

      if (deleteError) throw deleteError

      // Remove from selected stations
      setSelectedStationIds((prev) => prev.filter((id) => id !== stationToDelete.id))

      // Reload stations
      const { data: stationsData } = await supabase
        .from("stations")
        .select("id, name, is_active, display_order")
        .order("display_order", { ascending: true })
        .order("name")

      if (stationsData) {
        const activeStations = stationsData.filter((s) => s.is_active)
        setAllStations(activeStations)
        setAllStationsIncludingInactive(stationsData)

        // Reload matrix data
        await loadMatrixData(services, activeStations)
      }

      toast({
        title: "הצלחה",
        description: "העמדה נמחקה והתורים הועברו בהצלחה",
      })

      setIsTransferDialogOpen(false)
      setStationToDelete(null)
    } catch (error: unknown) {
      console.error("Error deleting station:", error)
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את העמדה",
        variant: "destructive",
      })
    }
  }

  return {
    // Data
    services,
    filteredServices,
    visibleServices,
    allStations,
    allStationsIncludingInactive,
    visibleStations,
    selectedStationIds,
    stationPage,
    servicePage,
    searchTerm,
    selectedColumnFilter,
    columnFilterNeedsApproval,
    columnFilterIsActive,
    columnFilterRemoteBooking,
    columnFilterDurationMin,
    columnFilterDurationMax,
    matrix,
    initialMatrix,
    isLoading,
    isSaving,
    isStationDialogOpen,
    isAddStationDialogOpen,
    isAddServiceDialogOpen,
    newStationName,
    newServiceName,
    isAddingStation,
    isAddingService,
    stationToDelete,
    stationToDuplicate,
    isDeleteConfirmOpen,
    isDuplicateConfirmOpen,
    isTransferDialogOpen,
    serviceToDuplicate,
    isDuplicateServiceDialogOpen,
    isDuplicatingService,
    serviceToDelete,
    isDeleteServiceDialogOpen,
    isDeletingService,
    isTypingDuration,
    durationInputValues,
    isTypingDefault,
    defaultDurationInputValues,
    expandedServiceId,
    savingServiceId,
    savingServiceRowId,
    sensors,
    // Setters
    setSearchTerm,
    setSelectedColumnFilter,
    setColumnFilterNeedsApproval,
    setColumnFilterIsActive,
    setColumnFilterRemoteBooking,
    setColumnFilterDurationMin,
    setColumnFilterDurationMax,
    setIsStationDialogOpen,
    setIsAddStationDialogOpen,
    setIsAddServiceDialogOpen,
    setNewStationName,
    setNewServiceName,
    setStationToDelete,
    setStationToDuplicate,
    setIsDeleteConfirmOpen,
    setIsDuplicateConfirmOpen,
    setIsTransferDialogOpen,
    setServiceToDuplicate,
    setIsDuplicateServiceDialogOpen,
    setServiceToDelete,
    setIsDeleteServiceDialogOpen,
    setIsTypingDuration,
    setDurationInputValues,
    setIsTypingDefault,
    setDefaultDurationInputValues,
    setExpandedServiceId,
    // Utility functions
    getDefaultTimeForService,
    serviceHasMatrixChanges,
    getServiceStatus,
    toggleServiceExpand,
    cloneServiceMatrix,
    cloneMatrixMap,
    fetchStationWorkingHours,
    loadMatrixData,
    loadData,
    // Handlers
    handleToggleSupport,
    handleDefaultTimeChange,
    handleStationTimeChange,
    handleApplyDefaultToAll,
    handleToggleStationSelection,
    handleDragEnd,
    handleTurnOnAllStations,
    handleTurnOffAllStations,
    handleMarkAllRemoteBooking,
    handleMarkAllNoRemoteBooking,
    handleMarkAllApprovalNeeded,
    handleMarkAllNoApprovalNeeded,
    handleAddService,
    handleAddStation,
    handleSave,
    handleSaveServiceRow,
    handleRevertServiceRow,
    handleToggleRemoteBooking,
    handleToggleApproval,
    handleNextStationPage,
    handlePreviousStationPage,
    handleNextServicePage,
    handlePreviousServicePage,
    handleDuplicateStation,
    handleDuplicateService,
    handleDeleteService,
    confirmDeleteService,
    confirmDuplicateService,
    confirmDuplicateStation,
    handleDeleteStation,
    confirmDeleteStation,
    handleTransferAndDelete,
    // Pagination helpers
    maxStationPage,
    canGoPreviousStation,
    canGoNextStation,
    maxServicePage,
    canGoPreviousService,
    canGoNextService,
  }
}
