import { useState, useEffect, useRef, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { STATIONS_PER_VIEW, SERVICES_PER_PAGE } from "./SettingsBreedStationMatrixSection.consts"

// Types
export interface Service {
    id: string
    name: string
    description?: string | null
    base_price: number
    active?: boolean
}

export interface Station {
    id: string
    name: string
    is_active: boolean
    display_order?: number
}

export interface MatrixCell {
    supported: boolean
    baseTimeMinutes?: number
    priceAdjustment?: number
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

export function useSettingsBreedStationMatrixSection() {
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
    const [columnFilterIsActive, setColumnFilterIsActive] = useState<boolean | null>(null)
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
    const [isTypingDuration, setIsTypingDuration] = useState<Record<string, Record<string, boolean>>>({})
    const [durationInputValues, setDurationInputValues] = useState<Record<string, Record<string, string>>>({})

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const loadMatrixData = async (servicesList: Service[], stationsList: Station[]) => {
        try {
            // Load service_station_matrix
            const { data: matrixData, error: matrixError } = await supabase
                .from("service_station_matrix")
                .select("*")
                .in("service_id", servicesList.map(s => s.id))
                .in("station_id", stationsList.map(s => s.id))

            if (matrixError) throw matrixError

            // Build matrix from service_station_matrix
            const matrixMap: Record<string, Record<string, MatrixCell>> = {}

            servicesList.forEach((service) => {
                matrixMap[service.id] = {}

                stationsList.forEach((station) => {
                    const matrixEntry = matrixData?.find(
                        m => m.service_id === service.id && m.station_id === station.id
                    )

                    matrixMap[service.id][station.id] = {
                        supported: !!matrixEntry,
                        baseTimeMinutes: matrixEntry?.base_time_minutes ?? 60,
                        priceAdjustment: matrixEntry?.price_adjustment ?? 0,
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
                .select("id, name, description, base_price, active")
                .order("name")
            if (servicesError) throw servicesError

            // Load stations
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

                // Duration filter
                if (columnFilterDurationMin || columnFilterDurationMax) {
                    const duration = cell?.baseTimeMinutes ?? 0
                    const minMinutes = columnFilterDurationMin ? parseDurationToMinutes(columnFilterDurationMin) : null
                    const maxMinutes = columnFilterDurationMax ? parseDurationToMinutes(columnFilterDurationMax) : null

                    if (minMinutes !== null && duration < minMinutes) return false
                    if (maxMinutes !== null && duration > maxMinutes) return false
                }
            }

            return true
        })

        setFilteredServices(filtered)
        // Reset to first page when filters change
        setServicePage(0)
    }, [
        services,
        searchTerm,
        selectedColumnFilter,
        columnFilterIsActive,
        columnFilterDurationMin,
        columnFilterDurationMax,
        matrix,
    ])

    // Update visible stations with pagination or column filter
    useEffect(() => {
        const selected = allStationsIncludingInactive.filter((s) => selectedStationIds.includes(s.id))
        if (selected.length === 0) {
            setVisibleStations([])
            return
        }

        // If column filter is selected, show only that column
        if (selectedColumnFilter) {
            const filteredStation = selected.find(s => s.id === selectedColumnFilter)
            setVisibleStations(filteredStation ? [filteredStation] : [])
            return
        }

        // Simple pagination
        const startIdx = stationPage
        const endIdx = Math.min(startIdx + STATIONS_PER_VIEW, selected.length)
        const paginated = selected.slice(startIdx, endIdx)
        setVisibleStations(paginated)
    }, [allStationsIncludingInactive, selectedStationIds, stationPage, selectedColumnFilter])

    useEffect(() => {
        loadData()
    }, [])

    // Pagination helpers
    const visibleServices = useMemo(() => {
        const startIdx = servicePage * SERVICES_PER_PAGE
        const endIdx = startIdx + SERVICES_PER_PAGE
        return filteredServices.slice(startIdx, endIdx)
    }, [filteredServices, servicePage])

    const maxStationPage = Math.max(0, Math.ceil(selectedStationIds.length / STATIONS_PER_VIEW) - 1)
    const canGoPreviousStation = stationPage > 0
    const canGoNextStation = stationPage < maxStationPage

    const maxServicePage = Math.max(0, Math.ceil(filteredServices.length / SERVICES_PER_PAGE) - 1)
    const canGoPreviousService = servicePage > 0
    const canGoNextService = servicePage < maxServicePage

    // Handlers
    const handleToggleSupport = (serviceId: string, stationId: string) => {
        const cell = matrix[serviceId]?.[stationId]
        const currentSupported = cell?.supported ?? false
        const newSupported = !currentSupported

        const service = services.find(s => s.id === serviceId)
        const defaultTime = cell?.baseTimeMinutes ?? 60

        // Update UI only - no API call
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
            const cell = newMatrix[serviceId][stationId] || { supported: false }

            newMatrix[serviceId][stationId] = {
                ...cell,
                supported: newSupported,
                baseTimeMinutes: newSupported ? (cell.baseTimeMinutes ?? defaultTime) : undefined,
                priceAdjustment: newSupported ? (cell.priceAdjustment ?? 0) : undefined,
            }

            return newMatrix
        })
    }

    const handleStationTimeChange = (serviceId: string, stationId: string, value: string) => {
        const time = value ? parseDurationToMinutes(value) : null
        if (time === null || time < 0) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
            const cell = newMatrix[serviceId][stationId] || { supported: false }

            newMatrix[serviceId][stationId] = {
                ...cell,
                baseTimeMinutes: time,
            }

            return newMatrix
        })
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            // Collect all changes
            const entriesToUpsert: Array<{
                service_id: string
                station_id: string
                base_time_minutes: number
                price_adjustment: number
            }> = []
            const entriesToDelete: Array<{ service_id: string; station_id: string }> = []

            for (const service of services) {
                const serviceCells = matrix[service.id] || {}

                for (const [stationId, cell] of Object.entries(serviceCells)) {
                    if (cell.supported) {
                        entriesToUpsert.push({
                            service_id: service.id,
                            station_id: stationId,
                            base_time_minutes: cell.baseTimeMinutes ?? 60,
                            price_adjustment: cell.priceAdjustment ?? 0,
                        })
                    } else {
                        // Check if it was supported before
                        const initialCell = initialMatrix[service.id]?.[stationId]
                        if (initialCell?.supported) {
                            entriesToDelete.push({
                                service_id: service.id,
                                station_id: stationId,
                            })
                        }
                    }
                }
            }

            // Delete entries that are no longer supported
            if (entriesToDelete.length > 0) {
                for (const entry of entriesToDelete) {
                    const { error } = await supabase
                        .from("service_station_matrix")
                        .delete()
                        .eq("service_id", entry.service_id)
                        .eq("station_id", entry.station_id)

                    if (error) throw error
                }
            }

            // Upsert entries
            if (entriesToUpsert.length > 0) {
                const { error: upsertError } = await supabase
                    .from("service_station_matrix")
                    .upsert(entriesToUpsert, {
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

    const handleAddService = async () => {
        if (!newServiceName.trim()) {
            toast({
                title: "שגיאה",
                description: "אנא הזן שם שירות",
                variant: "destructive",
            })
            return
        }

        setIsAddingService(true)
        try {
            const { data, error } = await supabase
                .from("services")
                .insert({ name: newServiceName.trim(), base_price: 0 })
                .select()
                .single()

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "השירות נוסף בהצלחה",
            })

            setNewServiceName("")
            setIsAddServiceDialogOpen(false)
            await loadData()
        } catch (error: unknown) {
            console.error("Error adding service:", error)
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
                description: "אנא הזן שם עמדה",
                variant: "destructive",
            })
            return
        }

        setIsAddingStation(true)
        try {
            const { data: stationsData } = await supabase
                .from("stations")
                .select("display_order")
                .order("display_order", { ascending: false })
                .limit(1)

            const maxOrder = stationsData?.[0]?.display_order ?? 0

            const { data, error } = await supabase
                .from("stations")
                .insert({
                    name: newStationName.trim(),
                    is_active: true,
                    display_order: maxOrder + 1,
                })
                .select()
                .single()

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "העמדה נוספה בהצלחה",
            })

            setNewStationName("")
            setIsAddStationDialogOpen(false)
            await loadData()
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

    const handleToggleStationSelection = (stationId: string) => {
        setSelectedStationIds((prev) => {
            if (prev.includes(stationId)) {
                return prev.filter((id) => id !== stationId)
            } else {
                return [...prev, stationId]
            }
        })
        setStationPage(0) // Reset to first page
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = active.id as string
        const overId = over.id as string

        setSelectedStationIds((prev) => {
            const newIds = [...prev]
            const activeIndex = newIds.indexOf(activeId)
            const overIndex = newIds.indexOf(overId)

            if (activeIndex === -1 || overIndex === -1) return prev

            newIds.splice(activeIndex, 1)
            newIds.splice(overIndex, 0, activeId)
            return newIds
        })
    }

    const handleTurnOnAllStations = (serviceId: string) => {
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[serviceId]) newMatrix[serviceId] = {}
            const service = services.find(s => s.id === serviceId)

            allStations.forEach((station) => {
                const cell = newMatrix[serviceId][station.id] || { supported: false }
            newMatrix[serviceId][station.id] = {
                supported: true,
                baseTimeMinutes: cell.baseTimeMinutes ?? 60,
                priceAdjustment: cell.priceAdjustment ?? 0,
            }
            })

            return newMatrix
        })
    }

    const handleTurnOffAllStations = (serviceId: string) => {
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[serviceId]) newMatrix[serviceId] = {}

            allStations.forEach((station) => {
                newMatrix[serviceId][station.id] = {
                    supported: false,
                }
            })

            return newMatrix
        })
    }

    const handleNextStationPage = () => {
        if (canGoNextStation) {
            setStationPage((prev) => prev + 1)
        }
    }

    const handlePreviousStationPage = () => {
        if (canGoPreviousStation) {
            setStationPage((prev) => prev - 1)
        }
    }

    const handleNextServicePage = () => {
        if (canGoNextService) {
            setServicePage((prev) => prev + 1)
        }
    }

    const handlePreviousServicePage = () => {
        if (canGoPreviousService) {
            setServicePage((prev) => prev - 1)
        }
    }

    const handleDuplicateStation = (station: Station) => {
        setStationToDuplicate(station)
        setIsDuplicateConfirmOpen(true)
    }

    const handleDeleteStation = (station: Station) => {
        setStationToDelete(station)
        setIsDeleteConfirmOpen(true)
    }

    const confirmDuplicateStation = async (newName: string) => {
        if (!stationToDuplicate) return

        setIsAddingStation(true)
        try {
            const { data: stationsData } = await supabase
                .from("stations")
                .select("display_order")
                .order("display_order", { ascending: false })
                .limit(1)

            const maxOrder = stationsData?.[0]?.display_order ?? 0

            const { error } = await supabase
                .from("stations")
                .insert({
                    name: newName,
                    is_active: stationToDuplicate.is_active,
                    display_order: maxOrder + 1,
                })

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "העמדה שוכפלה בהצלחה",
            })

            setIsDuplicateConfirmOpen(false)
            setStationToDuplicate(null)
            await loadData()
        } catch (error: unknown) {
            console.error("Error duplicating station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את העמדה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsAddingStation(false)
        }
    }

    const confirmDeleteStation = async () => {
        if (!stationToDelete) return

        try {
            const { error } = await supabase
                .from("stations")
                .delete()
                .eq("id", stationToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "העמדה נמחקה בהצלחה",
            })

            setIsDeleteConfirmOpen(false)
            setStationToDelete(null)
            await loadData()
        } catch (error: unknown) {
            console.error("Error deleting station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את העמדה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleTransferAndDelete = async (targetStationId: string) => {
        if (!stationToDelete) return

        try {
            // Transfer all service_station_matrix entries
            const { error: transferError } = await supabase
                .from("service_station_matrix")
                .update({ station_id: targetStationId })
                .eq("station_id", stationToDelete.id)

            if (transferError) throw transferError

            // Delete the station
            const { error: deleteError } = await supabase
                .from("stations")
                .delete()
                .eq("id", stationToDelete.id)

            if (deleteError) throw deleteError

            toast({
                title: "הצלחה",
                description: "העמדה נמחקה והנתונים הועברו בהצלחה",
            })

            setIsTransferDialogOpen(false)
            setIsDeleteConfirmOpen(false)
            setStationToDelete(null)
            await loadData()
        } catch (error: unknown) {
            console.error("Error transferring and deleting station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את העמדה"
            toast({
                title: "שגיאה",
                description: errorMessage,
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
        columnFilterIsActive,
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
        isTypingDuration,
        durationInputValues,
        sensors,
        // Setters
        setSearchTerm,
        setSelectedColumnFilter,
        setColumnFilterIsActive,
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
        setIsTypingDuration,
        setDurationInputValues,
        // Handlers
        handleToggleSupport,
        handleStationTimeChange,
        handleToggleStationSelection,
        handleDragEnd,
        handleTurnOnAllStations,
        handleTurnOffAllStations,
        handleAddService,
        handleAddStation,
        handleSave,
        handleNextStationPage,
        handlePreviousStationPage,
        handleNextServicePage,
        handlePreviousServicePage,
        handleDuplicateStation,
        handleDeleteStation,
        confirmDuplicateStation,
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
