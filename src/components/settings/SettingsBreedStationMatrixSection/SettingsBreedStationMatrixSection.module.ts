import { useState, useEffect, useRef, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { STATIONS_PER_VIEW, BREEDS_PER_PAGE } from "./SettingsBreedStationMatrixSection.consts"

// Types
export interface Breed {
    id: string
    name: string
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
    hourly_price?: number | null
    notes?: string | null
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
const cloneBreedMatrix = (breedMatrix: Record<string, MatrixCell> = {}) => {
    const cloned: Record<string, MatrixCell> = {}
    Object.entries(breedMatrix).forEach(([stationId, cell]) => {
        cloned[stationId] = { ...cell }
    })
    return cloned
}

const cloneMatrixMap = (matrixMap: Record<string, Record<string, MatrixCell>>) => {
    const cloned: Record<string, Record<string, MatrixCell>> = {}
    Object.entries(matrixMap).forEach(([breedId, breedMatrix]) => {
        cloned[breedId] = cloneBreedMatrix(breedMatrix)
    })
    return cloned
}

export function useSettingsBreedStationMatrixSection() {
    const { toast } = useToast()
    
    // State
    const [breeds, setBreeds] = useState<Breed[]>([])
    const [filteredBreeds, setFilteredBreeds] = useState<Breed[]>([])
    const [allStations, setAllStations] = useState<Station[]>([])
    const [allStationsIncludingInactive, setAllStationsIncludingInactive] = useState<Station[]>([])
    const [visibleStations, setVisibleStations] = useState<Station[]>([])
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    const [stationPage, setStationPage] = useState(0)
    const [breedPage, setBreedPage] = useState(0)
    const [searchTerm, setSearchTerm] = useState("")
    const [categoryFilterIds, setCategoryFilterIds] = useState<string[]>([])
    const [selectedColumnFilter, setSelectedColumnFilter] = useState<string | null>(null)
    const [columnFilterNeedsApproval, setColumnFilterNeedsApproval] = useState<boolean | null>(null)
    const [columnFilterIsActive, setColumnFilterIsActive] = useState<boolean | null>(null)
    const [columnFilterRemoteBooking, setColumnFilterRemoteBooking] = useState<boolean | null>(null)
    const [columnFilterDurationMin, setColumnFilterDurationMin] = useState<string>("")
    const [columnFilterDurationMax, setColumnFilterDurationMax] = useState<string>("")
    const [groomingServiceId, setGroomingServiceId] = useState<string | null>(null)
    const [matrix, setMatrix] = useState<Record<string, Record<string, MatrixCell>>>({})
    const [initialMatrix, setInitialMatrix] = useState<Record<string, Record<string, MatrixCell>>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false)
    const [isAddStationDialogOpen, setIsAddStationDialogOpen] = useState(false)
    const [isAddBreedDialogOpen, setIsAddBreedDialogOpen] = useState(false)
    const [newStationName, setNewStationName] = useState("")
    const [newBreedName, setNewBreedName] = useState("")
    const [isAddingStation, setIsAddingStation] = useState(false)
    const [isAddingBreed, setIsAddingBreed] = useState(false)
    const [stationToDelete, setStationToDelete] = useState<Station | null>(null)
    const [stationToDuplicate, setStationToDuplicate] = useState<Station | null>(null)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isDuplicateConfirmOpen, setIsDuplicateConfirmOpen] = useState(false)
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
    const [breedToDuplicate, setBreedToDuplicate] = useState<Breed | null>(null)
    const [isDuplicateBreedDialogOpen, setIsDuplicateBreedDialogOpen] = useState(false)
    const [isDuplicatingBreed, setIsDuplicatingBreed] = useState(false)
    const [breedToDelete, setBreedToDelete] = useState<Breed | null>(null)
    const [isDeleteBreedDialogOpen, setIsDeleteBreedDialogOpen] = useState(false)
    const [isDeletingBreed, setIsDeletingBreed] = useState(false)
    const [isTypingDuration, setIsTypingDuration] = useState<Record<string, Record<string, boolean>>>({})
    const [durationInputValues, setDurationInputValues] = useState<Record<string, Record<string, string>>>({})
    const [isTypingDefault, setIsTypingDefault] = useState<Record<string, boolean>>({})
    const [defaultDurationInputValues, setDefaultDurationInputValues] = useState<Record<string, string>>({})
    const [expandedBreedId, setExpandedBreedId] = useState<string | null>(null)
    const [editedBreedPrices, setEditedBreedPrices] = useState<Record<string, { size_class?: string | null; min_groom_price?: number | null; max_groom_price?: number | null; hourly_price?: number | null; notes?: string | null }>>({})
    const [dogCategories, setDogCategories] = useState<Array<{ id: string; name: string }>>([])
    const [breedCategoriesMap, setBreedCategoriesMap] = useState<Record<string, string[]>>({})
    const [editedCategoriesMap, setEditedCategoriesMap] = useState<Record<string, string[]>>({})
    const [savingBreedId, setSavingBreedId] = useState<string | null>(null)
    const [savingBreedRowId, setSavingBreedRowId] = useState<string | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

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

    const getDefaultTimeForBreed = (breedId: string): number | undefined => {
        const breedCells = matrix[breedId] || {}
        const firstSupported = Object.values(breedCells).find((cell) => cell.supported)
        return firstSupported?.defaultTime
    }

    const loadMatrixData = async (breedsList: Breed[], stationsList: Station[]) => {
        try {
            // Load station_breed_rules for this service (using the same table as SettingsBreedsSection)
            const { data: rulesData, error: rulesError } = await supabase
                .from("station_breed_rules")
                .select("*")
                .in("breed_id", breedsList.map(b => b.id))
                .in("station_id", stationsList.map(s => s.id))

            if (rulesError) throw rulesError

            // Build matrix from station_breed_rules
            const matrixMap: Record<string, Record<string, MatrixCell>> = {}

            breedsList.forEach((breed) => {
                matrixMap[breed.id] = {}

                // Get all rules for this breed
                const breedRules = rulesData?.filter(r => r.breed_id === breed.id) || []

                // Calculate default time as the most common duration_modifier_minutes value for active stations
                const activeRules = breedRules.filter(r => r.is_active)
                const timeCounts: Record<number, number> = {}
                activeRules.forEach(rule => {
                    const time = rule.duration_modifier_minutes ?? 0
                    timeCounts[time] = (timeCounts[time] || 0) + 1
                })
                const defaultTime = Object.keys(timeCounts).length > 0
                    ? parseInt(Object.keys(timeCounts).reduce((a, b) => timeCounts[parseInt(a)] > timeCounts[parseInt(b)] ? a : b))
                    : 60 // Default to 60 if no rules exist

                stationsList.forEach((station) => {
                    const rule = breedRules.find(r => r.station_id === station.id)
                    const supported = rule?.is_active ?? false
                    const stationTime = rule?.duration_modifier_minutes ?? 0
                    const remoteBooking = rule?.remote_booking_allowed ?? false
                    const approvalNeeded = rule?.requires_staff_approval ?? false

                    matrixMap[breed.id][station.id] = {
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
            // Load breeds with prices, notes, and size_class
            const { data: breedsData, error: breedsError } = await supabase
                .from("breeds")
                .select("id, name, size_class, min_groom_price, max_groom_price, hourly_price, notes")
                .order("name")
            if (breedsError) throw breedsError

            // Load dog categories
            const { data: categoriesData, error: categoriesError } = await supabase
                .from("dog_categories")
                .select("id, name")
                .order("name")
            if (categoriesError) throw categoriesError
            setDogCategories(categoriesData || [])

            // Load breed_dog_categories
            const breedIds = (breedsData || []).map(b => b.id)
            const breedCategoriesResponse = breedIds.length > 0
                ? await supabase.from("breed_dog_categories").select("breed_id, dog_category_id").in("breed_id", breedIds)
                : { data: [], error: null }
            if (breedCategoriesResponse.error) throw breedCategoriesResponse.error

            // Build map: breed_id -> array of category IDs
            const categoriesMap: Record<string, string[]> = {}
                ; (breedCategoriesResponse.data || []).forEach((row: { breed_id: string; dog_category_id: string }) => {
                    if (!categoriesMap[row.breed_id]) categoriesMap[row.breed_id] = []
                    categoriesMap[row.breed_id].push(row.dog_category_id)
                })
            setBreedCategoriesMap(categoriesMap)

            // Load stations (only active ones for the matrix)
            const { data: stationsData, error: stationsError } = await supabase
                .from("stations")
                .select("id, name, is_active, display_order")
                .order("display_order", { ascending: true })
                .order("name")
            if (stationsError) throw stationsError

            // Get grooming service ID - try to find it first, if not found, create it
            let { data: serviceData, error: serviceError } = await supabase
                .from("services")
                .select("id")
                .eq("name", "grooming")
                .maybeSingle()

            if (serviceError) throw serviceError

            // If service doesn't exist, create it
            if (!serviceData) {
                const { data: newService, error: createError } = await supabase
                    .from("services")
                    .insert({ name: "grooming", description: "שירות טיפוח" })
                    .select("id")
                    .single()

                if (createError) throw createError
                serviceData = newService
            }

            const activeStations = (stationsData || []).filter((s) => s.is_active)

            setBreeds(breedsData || [])
            setAllStations(activeStations)
            setAllStationsIncludingInactive(stationsData || [])

            // Initialize with all stations selected by default
            if (selectedStationIds.length === 0) {
                setSelectedStationIds(activeStations.map((s) => s.id))
            }

            setGroomingServiceId(serviceData?.id || null)

            // Load matrix data
            if (serviceData?.id) {
                await loadMatrixData(breedsData || [], activeStations)
            }
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
        categoryFilterIds: string
        selectedColumnFilter: string | null
        columnFilterIsActive: boolean | null
        columnFilterRemoteBooking: boolean | null
        columnFilterNeedsApproval: boolean | null
        columnFilterDurationMin: string
        columnFilterDurationMax: string
    }>({
        searchTerm: "",
        categoryFilterIds: "[]",
        selectedColumnFilter: null,
        columnFilterIsActive: null,
        columnFilterRemoteBooking: null,
        columnFilterNeedsApproval: null,
        columnFilterDurationMin: "",
        columnFilterDurationMax: "",
    })

    // Filter breeds by search term, categories, and column filters
    useEffect(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        const filtered = breeds.filter((breed) => {
            // Search filter
            if (normalizedSearch && !breed.name.toLowerCase().includes(normalizedSearch)) {
                return false
            }

            // Category filter
            if (categoryFilterIds.length > 0) {
                const breedCategories = editedCategoriesMap[breed.id] ?? breedCategoriesMap[breed.id] ?? []
                const matchesCategory = breedCategories.some((categoryId) => categoryFilterIds.includes(categoryId))
                if (!matchesCategory) {
                    return false
                }
            }

            // Column-specific filters (only if a column is selected)
            if (selectedColumnFilter) {
                const cell = matrix[breed.id]?.[selectedColumnFilter]

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
                    const defaultTime = getDefaultTimeForBreed(breed.id) ?? 60
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

        setFilteredBreeds(filtered)

        // Only reset breed page when actual filter criteria change, not when matrix data changes
        const currentCategoryFilterIds = JSON.stringify([...categoryFilterIds].sort())
        const prevFilters = prevFiltersRef.current
        
        const filtersChanged = 
            prevFilters.searchTerm !== searchTerm ||
            prevFilters.categoryFilterIds !== currentCategoryFilterIds ||
            prevFilters.selectedColumnFilter !== selectedColumnFilter ||
            prevFilters.columnFilterIsActive !== columnFilterIsActive ||
            prevFilters.columnFilterRemoteBooking !== columnFilterRemoteBooking ||
            prevFilters.columnFilterNeedsApproval !== columnFilterNeedsApproval ||
            prevFilters.columnFilterDurationMin !== columnFilterDurationMin ||
            prevFilters.columnFilterDurationMax !== columnFilterDurationMax

        if (filtersChanged) {
            setBreedPage(0)
            prevFiltersRef.current = {
                searchTerm,
                categoryFilterIds: currentCategoryFilterIds,
                selectedColumnFilter,
                columnFilterIsActive,
                columnFilterRemoteBooking,
                columnFilterNeedsApproval,
                columnFilterDurationMin,
                columnFilterDurationMax,
            }
        }
    }, [
        breeds,
        searchTerm,
        categoryFilterIds,
        breedCategoriesMap,
        editedCategoriesMap,
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
            const filteredStation = selected.find(s => s.id === selectedColumnFilter)
            setVisibleStations(filteredStation ? [filteredStation] : [])
            return
        }

        // Simple pagination: start from stationPage index, show STATIONS_PER_VIEW stations
        const startIdx = stationPage
        const endIdx = Math.min(startIdx + STATIONS_PER_VIEW, selected.length)
        const paginated = selected.slice(startIdx, endIdx)
        setVisibleStations(paginated)
    }, [allStationsIncludingInactive, selectedStationIds, stationPage, selectedColumnFilter])

    useEffect(() => {
        loadData()
    }, [])

    const breedHasPriceChanges = (breedId: string): boolean => {
        const editedPrices = editedBreedPrices[breedId]
        const breedPrices = breeds.find((b) => b.id === breedId)
        if (!editedPrices || !breedPrices) return false

        const pricesChanged = (
            editedPrices.size_class !== breedPrices.size_class ||
            editedPrices.min_groom_price !== breedPrices.min_groom_price ||
            editedPrices.max_groom_price !== breedPrices.max_groom_price ||
            editedPrices.hourly_price !== breedPrices.hourly_price ||
            editedPrices.notes !== breedPrices.notes
        )

        // Check categories
        const editedCategories = editedCategoriesMap[breedId] || []
        const originalCategories = breedCategoriesMap[breedId] || []
        const categoriesChanged = JSON.stringify([...editedCategories].sort()) !== JSON.stringify([...originalCategories].sort())

        return pricesChanged || categoriesChanged
    }

    const getBreedCategories = (breedId: string): string[] => {
        return editedCategoriesMap[breedId] ?? breedCategoriesMap[breedId] ?? []
    }

    const breedHasMatrixChanges = (breedId: string): boolean => {
        const current = matrix[breedId]
        const initial = initialMatrix[breedId]
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

    const getBreedStatus = (breedId: string): 'none' | 'some' | 'all' => {
        const breedCells = matrix[breedId] || {}
        const allStationIds = allStations.map(s => s.id)
        const enabledStations = allStationIds.filter(stationId => breedCells[stationId]?.supported).length
        const totalStations = allStationIds.length

        if (totalStations === 0) return 'none'
        if (enabledStations === 0) return 'none'
        if (enabledStations === totalStations) return 'all'
        return 'some'
    }

    const toggleBreedExpand = (breedId: string) => {
        setExpandedBreedId((prev) => {
            const newValue = prev === breedId ? null : breedId
            // Initialize edited prices, size, types, and categories if not already set
            if (newValue === breedId && !editedBreedPrices[breedId]) {
                const breed = breeds.find((b) => b.id === breedId)
                if (breed) {
                    setEditedBreedPrices((prev) => ({
                        ...prev,
                        [breedId]: {
                            size_class: breed.size_class,
                            min_groom_price: breed.min_groom_price,
                            max_groom_price: breed.max_groom_price,
                            hourly_price: breed.hourly_price,
                            notes: breed.notes,
                        },
                    }))
                }
            }
            // Initialize edited types and categories
            if (newValue === breedId && !editedCategoriesMap[breedId]) {
                setEditedCategoriesMap((prev) => ({
                    ...prev,
                    [breedId]: breedCategoriesMap[breedId] || [],
                }))
            }
            return newValue
        })
    }

    // Handlers
    const handleToggleSupport = (breedId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[breedId]?.[stationId]
        const currentSupported = cell?.supported ?? false
        const newSupported = !currentSupported

        // Get default time for this breed
        const defaultTime = getDefaultTimeForBreed(breedId) ?? 60

        // Update UI only - no API call
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}
            const cell = newMatrix[breedId][stationId] || { supported: false }

            newMatrix[breedId][stationId] = {
                ...cell,
                supported: newSupported,
                defaultTime: defaultTime,
                stationTime: newSupported ? (cell.stationTime ?? defaultTime) : undefined,
                remote_booking_allowed: newSupported ? (cell.remote_booking_allowed ?? false) : false,
                is_approval_needed: newSupported ? (cell.is_approval_needed ?? false) : false,
            }

            return newMatrix
        })
    }

    const handleDefaultTimeChange = (breedId: string, value: string) => {
        const time = value ? parseInt(value) : undefined
        if (!time || time < 0) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            // Update default time for all supported stations
            Object.keys(newMatrix[breedId]).forEach((stationId) => {
                const cell = newMatrix[breedId][stationId]
                if (cell.supported) {
                    newMatrix[breedId][stationId] = {
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

    const handleStationTimeChange = (breedId: string, stationId: string, value: string) => {
        const time = value ? parseInt(value) : undefined
        if (!time || time < 0) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}
            const cell = newMatrix[breedId][stationId] || { supported: false }

            newMatrix[breedId][stationId] = {
                ...cell,
                stationTime: time,
            }

            return newMatrix
        })
    }

    const handleApplyDefaultToAll = (breedId: string) => {
        const defaultTime = getDefaultTimeForBreed(breedId)
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
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            // Apply default time to all supported stations
            Object.keys(newMatrix[breedId]).forEach((stationId) => {
                const cell = newMatrix[breedId][stationId]
                if (cell.supported) {
                    newMatrix[breedId][stationId] = {
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
            const unselectedStations = allStationsIncludingInactive.filter(
                (s) => !newItems.includes(s.id)
            )
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
                const orderedSelectedIds = stationsData
                    .filter((s) => newItems.includes(s.id))
                    .map((s) => s.id)
                
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

    const handleTurnOnAllStations = (breedId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            allStations.forEach((station) => {
                const cell = newMatrix[breedId][station.id] || { supported: false }
                const defaultTime = cell.defaultTime || getDefaultTimeForBreed(breedId) || 60

                newMatrix[breedId][station.id] = {
                    supported: true,
                    defaultTime: defaultTime,
                    stationTime: cell.stationTime || defaultTime,
                }
            })

            return newMatrix
        })
    }

    const handleTurnOffAllStations = (breedId: string) => {
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) return newMatrix

            allStations.forEach((station) => {
                if (newMatrix[breedId][station.id]) {
                    newMatrix[breedId][station.id] = {
                        ...newMatrix[breedId][station.id],
                        supported: false,
                        remote_booking_allowed: false,
                        is_approval_needed: false,
                    }
                }
            })

            return newMatrix
        })
    }

    const handleMarkAllRemoteBooking = (breedId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            allStations.forEach((station) => {
                const cell = newMatrix[breedId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[breedId][station.id] = {
                        ...cell,
                        remote_booking_allowed: true,
                    }
                }
            })

            return newMatrix
        })
    }

    const handleMarkAllNoRemoteBooking = (breedId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            allStations.forEach((station) => {
                const cell = newMatrix[breedId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[breedId][station.id] = {
                        ...cell,
                        remote_booking_allowed: false,
                    }
                }
            })

            return newMatrix
        })
    }

    const handleMarkAllApprovalNeeded = (breedId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            allStations.forEach((station) => {
                const cell = newMatrix[breedId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[breedId][station.id] = {
                        ...cell,
                        is_approval_needed: true,
                    }
                }
            })

            return newMatrix
        })
    }

    const handleMarkAllNoApprovalNeeded = (breedId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            allStations.forEach((station) => {
                const cell = newMatrix[breedId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[breedId][station.id] = {
                        ...cell,
                        is_approval_needed: false,
                    }
                }
            })

            return newMatrix
        })
    }

    const handleAddBreed = async () => {
        if (!newBreedName.trim()) {
            toast({
                title: "שגיאה",
                description: "שם הגזע נדרש",
                variant: "destructive",
            })
            return
        }

        setIsAddingBreed(true)
        try {
            console.log("[SettingsBreedStationMatrixSection] Creating breed:", newBreedName.trim())

            const { data: newBreed, error } = await supabase
                .from("breeds")
                .insert({ name: newBreedName.trim() })
                .select("id, name, min_groom_price, max_groom_price, hourly_price, notes")
                .single()

            if (error) {
                console.error("[SettingsBreedStationMatrixSection] Error creating breed:", error)
                throw error
            }

            console.log("[SettingsBreedStationMatrixSection] Breed created successfully:", newBreed)

            toast({
                title: "הצלחה",
                description: "הגזע נוסף בהצלחה",
            })

            setNewBreedName("")
            setIsAddBreedDialogOpen(false)

            // Add the new breed to the current list and reload matrix data
            if (newBreed) {
                const updatedBreeds = [...breeds, newBreed].sort((a, b) => a.name.localeCompare(b.name))
                setBreeds(updatedBreeds)

                // Initialize matrix for new breed
                if (groomingServiceId) {
                    await loadMatrixData(updatedBreeds, allStations)
                }
            }
        } catch (error: unknown) {
            console.error("[SettingsBreedStationMatrixSection] Error adding breed:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן להוסיף את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsAddingBreed(false)
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
                if (groomingServiceId) {
                    await loadMatrixData(breeds, activeStations)
                }
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
        if (!groomingServiceId) {
            toast({
                title: "שגיאה",
                description: "שירות טיפוח לא נמצא",
                variant: "destructive",
            })
            return
        }

        setIsSaving(true)
        try {
            // Save all station_breed_rules (using the same table as SettingsBreedsSection)
            const rulesToUpsert: Array<{
                station_id: string
                breed_id: string
                is_active: boolean
                remote_booking_allowed: boolean
                requires_staff_approval: boolean
                duration_modifier_minutes: number
            }> = []

            for (const breed of breeds) {
                const breedCells = matrix[breed.id] || {}

                // Get default time for this breed
                const defaultTime = getDefaultTimeForBreed(breed.id) ?? 60

                // Process all stations for this breed
                for (const [stationId, cell] of Object.entries(breedCells)) {
                    const isActive = cell?.supported ?? false
                    const stationTime = cell?.stationTime ?? defaultTime

                    // Create or update station_breed_rule
                    // Note: We preserve existing remote_booking_allowed and is_approval_needed if rule exists, otherwise default to false
                    rulesToUpsert.push({
                        station_id: stationId,
                        breed_id: breed.id,
                        is_active: isActive,
                        remote_booking_allowed: cell?.remote_booking_allowed ?? false,
                        requires_staff_approval: cell?.is_approval_needed ?? false,
                        duration_modifier_minutes: isActive ? stationTime : 0,
                    })
                }
            }

            // Batch upsert all rules
            if (rulesToUpsert.length > 0) {
                const { error: upsertError } = await supabase
                    .from("station_breed_rules")
                    .upsert(rulesToUpsert, {
                        onConflict: "station_id,breed_id",
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

    const handlePriceChange = (breedId: string, field: 'size_class' | 'min_groom_price' | 'max_groom_price' | 'hourly_price', value: string) => {
        setEditedBreedPrices((prev) => ({
            ...prev,
            [breedId]: {
                ...(prev[breedId] || {}),
                [field]: field === 'size_class' ? (value === "__none__" ? null : value) : (value ? parseFloat(value) : null),
            },
        }))
    }

    const handleCategoriesChange = (breedId: string, selectedIds: string[]) => {
        setEditedCategoriesMap((prev) => ({
            ...prev,
            [breedId]: selectedIds,
        }))
    }

    const handleNotesChange = (breedId: string, value: string) => {
        setEditedBreedPrices((prev) => ({
            ...prev,
            [breedId]: {
                ...(prev[breedId] || {}),
                notes: value || null,
            },
        }))
    }

    const handleSaveBreedPrices = async (breedId: string) => {
        const editedPrices = editedBreedPrices[breedId]
        if (!editedPrices) return

        setSavingBreedId(breedId)
        try {
            // Update breed basic fields (size_class, prices, notes)
            const { error } = await supabase
                .from("breeds")
                .update({
                    size_class: editedPrices.size_class,
                    min_groom_price: editedPrices.min_groom_price,
                    max_groom_price: editedPrices.max_groom_price,
                    hourly_price: editedPrices.hourly_price,
                    notes: editedPrices.notes,
                })
                .eq("id", breedId)

            if (error) throw error

            // Update breed_dog_categories
            const editedCategories = editedCategoriesMap[breedId] || []
            const originalCategories = breedCategoriesMap[breedId] || []

            // Delete removed categories
            const categoriesToDelete = originalCategories.filter(id => !editedCategories.includes(id))
            if (categoriesToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("breed_dog_categories")
                    .delete()
                    .eq("breed_id", breedId)
                    .in("dog_category_id", categoriesToDelete)
                if (deleteError) throw deleteError
            }

            // Insert new categories
            const categoriesToInsert = editedCategories.filter(id => !originalCategories.includes(id))
            if (categoriesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from("breed_dog_categories")
                    .insert(categoriesToInsert.map(dog_category_id => ({ breed_id: breedId, dog_category_id })))
                if (insertError) throw insertError
            }

            // Update local state
            setBreeds((prev) =>
                prev.map((breed) =>
                    breed.id === breedId
                        ? {
                            ...breed,
                            size_class: editedPrices.size_class,
                            min_groom_price: editedPrices.min_groom_price,
                            max_groom_price: editedPrices.max_groom_price,
                            hourly_price: editedPrices.hourly_price,
                            notes: editedPrices.notes,
                        }
                        : breed
                )
            )

            // Update local maps
            setBreedCategoriesMap((prev) => ({
                ...prev,
                [breedId]: editedCategories,
            }))

            toast({
                title: "הצלחה",
                description: "השינויים נשמרו בהצלחה",
            })
        } catch (error: unknown) {
            console.error("Error saving breed data:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את השינויים"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingBreedId(null)
        }
    }

    const handleCancelBreedPrices = (breedId: string) => {
        const breed = breeds.find((b) => b.id === breedId)
        if (breed) {
            setEditedBreedPrices((prev) => ({
                ...prev,
                [breedId]: {
                    size_class: breed.size_class,
                    min_groom_price: breed.min_groom_price,
                    max_groom_price: breed.max_groom_price,
                    hourly_price: breed.hourly_price,
                    notes: breed.notes,
                },
            }))
        }
        // Reset categories
        setEditedCategoriesMap((prev) => ({
            ...prev,
            [breedId]: breedCategoriesMap[breedId] || [],
        }))
    }

    const saveBreedPricesSilent = async (breedId: string) => {
        const editedPrices = editedBreedPrices[breedId]
        if (!editedPrices) return

        const { error } = await supabase
            .from("breeds")
            .update({
                min_groom_price: editedPrices.min_groom_price ?? null,
                max_groom_price: editedPrices.max_groom_price ?? null,
                hourly_price: editedPrices.hourly_price ?? null,
                notes: editedPrices.notes ?? null,
            })
            .eq("id", breedId)

        if (error) throw error

        setBreeds((prev) =>
            prev.map((breed) =>
                breed.id === breedId
                    ? {
                        ...breed,
                        min_groom_price: editedPrices.min_groom_price ?? null,
                        max_groom_price: editedPrices.max_groom_price ?? null,
                        hourly_price: editedPrices.hourly_price ?? null,
                        notes: editedPrices.notes ?? null,
                    }
                    : breed
            )
        )

        setEditedBreedPrices((prev) => ({
            ...prev,
            [breedId]: {
                min_groom_price: editedPrices.min_groom_price ?? null,
                max_groom_price: editedPrices.max_groom_price ?? null,
                hourly_price: editedPrices.hourly_price ?? null,
                notes: editedPrices.notes ?? null,
            },
        }))
    }

    const handleSaveBreedRow = async (breedId: string) => {
        const matrixChanges = breedHasMatrixChanges(breedId)
        const priceChanges = breedHasPriceChanges(breedId)

        if (!matrixChanges && !priceChanges) return

        if (matrixChanges && !groomingServiceId) {
            toast({
                title: "שגיאה",
                description: "שירות טיפוח לא נמצא",
                variant: "destructive",
            })
            return
        }

        const breed = breeds.find((b) => b.id === breedId)
        const breedName = breed?.name ?? ""
        const matrixSnapshot = cloneBreedMatrix(matrix[breedId] || {})

        setSavingBreedRowId(breedId)
        if (priceChanges) {
            setSavingBreedId(breedId)
        }

        try {
            if (matrixChanges && groomingServiceId) {
                const defaultTime = getDefaultTimeForBreed(breedId) ?? 60
                const rulesToUpsert = Object.entries(matrixSnapshot).map(([stationId, cell]) => {
                    const isActive = cell?.supported ?? false

                    return {
                        station_id: stationId,
                        breed_id: breedId,
                        is_active: isActive,
                        remote_booking_allowed: isActive ? (cell?.remote_booking_allowed ?? false) : false,
                        duration_modifier_minutes: isActive ? (cell?.stationTime ?? defaultTime) : 0,
                    }
                })

                if (rulesToUpsert.length > 0) {
                    const { error } = await supabase
                        .from("station_breed_rules")
                        .upsert(rulesToUpsert, {
                            onConflict: "station_id,breed_id",
                        })

                    if (error) throw error
                }

                setInitialMatrix((prev) => ({
                    ...prev,
                    [breedId]: cloneBreedMatrix(matrixSnapshot),
                }))
            }

            if (priceChanges) {
                await saveBreedPricesSilent(breedId)
            }

            toast({
                title: "הצלחה",
                description: `השינויים עבור ${breedName || "הגזע"} נשמרו בהצלחה`,
            })
        } catch (error: unknown) {
            console.error("Error saving breed row:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את השינויים לגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingBreedRowId(null)
            if (priceChanges) {
                setSavingBreedId(null)
            }
        }
    }

    const handleRevertBreedRow = (breedId: string) => {
        const initialBreedMatrix = initialMatrix[breedId]
        if (!initialBreedMatrix) return

        setMatrix((prev) => ({
            ...prev,
            [breedId]: cloneBreedMatrix(initialBreedMatrix),
        }))

        setDurationInputValues((prev) => {
            const updated = { ...prev }
            delete updated[breedId]
            return updated
        })

        setIsTypingDuration((prev) => {
            const updated = { ...prev }
            delete updated[breedId]
            return updated
        })

        setDefaultDurationInputValues((prev) => {
            const updated = { ...prev }
            delete updated[breedId]
            return updated
        })

        setIsTypingDefault((prev) => {
            const updated = { ...prev }
            delete updated[breedId]
            return updated
        })

        handleCancelBreedPrices(breedId)
    }

    const handleToggleRemoteBooking = (breedId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[breedId]?.[stationId]
        if (!cell || !cell.supported) return

        const currentRemoteBooking = cell.remote_booking_allowed ?? false
        const newRemoteBooking = !currentRemoteBooking

        // Update UI only - no API call
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}
            const cell = newMatrix[breedId][stationId] || { supported: false }
            newMatrix[breedId][stationId] = {
                ...cell,
                remote_booking_allowed: newRemoteBooking,
            }
            return newMatrix
        })
    }

    const handleToggleApproval = (breedId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[breedId]?.[stationId]
        if (!cell || !cell.supported) return

        const currentApproval = cell.is_approval_needed ?? false
        const newApproval = !currentApproval

        // Update UI only - no API call
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}
            const cell = newMatrix[breedId][stationId] || { supported: false }
            newMatrix[breedId][stationId] = {
                ...cell,
                is_approval_needed: newApproval,
            }
            return newMatrix
        })
    }

    // Calculate pagination limits for stations (no cycling, stops at end)
    // Compute visible breeds with pagination
    const maxBreedPage = Math.max(0, Math.ceil(filteredBreeds.length / BREEDS_PER_PAGE) - 1)
    const visibleBreeds = filteredBreeds.slice(
        breedPage * BREEDS_PER_PAGE,
        (breedPage + 1) * BREEDS_PER_PAGE
    )
    const canGoPreviousBreed = breedPage > 0
    const canGoNextBreed = breedPage < maxBreedPage

    const handleNextBreedPage = () => {
        if (filteredBreeds.length <= BREEDS_PER_PAGE) return
        const nextPage = breedPage + 1
        if (nextPage <= maxBreedPage) {
            setBreedPage(nextPage)
        }
    }

    const handlePreviousBreedPage = () => {
        if (filteredBreeds.length <= BREEDS_PER_PAGE) return
        const prevPage = breedPage - 1
        if (prevPage >= 0) {
            setBreedPage(prevPage)
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

    const handleDuplicateBreed = (breed: Breed) => {
        setBreedToDuplicate(breed)
        setIsDuplicateBreedDialogOpen(true)
    }

    const handleDeleteBreed = (breed: Breed) => {
        setBreedToDelete(breed)
        setIsDeleteBreedDialogOpen(true)
    }

    const confirmDeleteBreed = async () => {
        if (!breedToDelete) return

        setIsDeletingBreed(true)

        try {
            const { error } = await supabase.from("breeds").delete().eq("id", breedToDelete.id)
            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הגזע נמחק בהצלחה",
            })

            setIsDeleteBreedDialogOpen(false)
            setBreedToDelete(null)

            // Reload all data to reflect the deletion
            await loadData()
        } catch (error: unknown) {
            console.error("Error deleting breed:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsDeletingBreed(false)
        }
    }

    const confirmDuplicateBreed = async (params: {
        mode: "new" | "existing"
        name?: string
        targetBreedIds?: string[]
        copyDetails: boolean
        copyStationRelations: boolean
    }) => {
        if (!breedToDuplicate) return

        setIsDuplicateBreedDialogOpen(false)
        setIsDuplicatingBreed(true)

        try {
            const sourceBreedId = breedToDuplicate.id

            if (params.mode === "new") {
                // Create new breed
                if (!params.name) throw new Error("Breed name is required for new breed")

                const { data: newBreed, error: breedError } = await supabase
                    .from("breeds")
                    .insert({
                        name: params.name,
                        size_class: breedToDuplicate.size_class,
                        min_groom_price: breedToDuplicate.min_groom_price,
                        max_groom_price: breedToDuplicate.max_groom_price,
                        hourly_price: breedToDuplicate.hourly_price,
                        notes: breedToDuplicate.notes,
                    })
                    .select()
                    .single()

                if (breedError) throw breedError
                if (!newBreed) throw new Error("Failed to create duplicate breed")

                const newBreedId = newBreed.id

                // Duplicate categories
                const originalCategoryIds = breedCategoriesMap[sourceBreedId] || []
                if (originalCategoryIds.length > 0) {
                    const categoriesToInsert = originalCategoryIds.map(categoryId => ({
                        breed_id: newBreedId,
                        dog_category_id: categoryId
                    }))
                    const { error: categoriesError } = await supabase
                        .from("breed_dog_categories")
                        .insert(categoriesToInsert)
                    if (categoriesError) throw categoriesError
                }

                // Duplicate station breed rules (only if checkbox is checked)
                if (groomingServiceId && params.copyStationRelations) {
                    const originalBreedCells = matrix[sourceBreedId] || {}
                    const stationIds = Object.keys(originalBreedCells)

                    for (const stationId of stationIds) {
                        const cell = originalBreedCells[stationId]
                        if (cell?.supported) {
                            // Get the original values
                            const defaultTime = cell.defaultTime
                            const originalStationTime = cell.stationTime
                            const originalRemoteBooking = cell.remote_booking_allowed ?? false
                            const originalApprovalNeeded = cell.is_approval_needed ?? false

                            // Get base_time_minutes for this station
                            const { data: baseTimeData } = await supabase
                                .from("service_station_matrix")
                                .select("base_time_minutes")
                                .eq("station_id", stationId)
                                .maybeSingle()

                            const baseTime = baseTimeData?.base_time_minutes || 0
                            const durationMinutes = originalStationTime || (baseTime + (defaultTime || 60))

                            // Ensure breed_modifier exists with the same default time
                            if (defaultTime) {
                                await supabase
                                    .from("breed_modifiers")
                                    .upsert(
                                        {
                                            breed_id: newBreedId,
                                            time_modifier_minutes: defaultTime,
                                        },
                                        { onConflict: "service_id,breed_id" }
                                    )
                            }

                            // Copy station_breed_rules with ALL values
                            await supabase
                                .from("station_breed_rules")
                                .upsert(
                                    {
                                        station_id: stationId,
                                        breed_id: newBreedId,
                                        is_active: true,
                                        remote_booking_allowed: originalRemoteBooking,
                                        requires_staff_approval: originalApprovalNeeded,
                                        duration_modifier_minutes: durationMinutes,
                                    },
                                    { onConflict: "station_id,breed_id" }
                                )
                        }
                    }
                }

                toast({
                    title: "הצלחה",
                    description: "הגזע שוכפל בהצלחה",
                })

                // Reload all data to include the new breed
                await loadData()
            } else {
                // Copy to existing breeds
                if (!params.targetBreedIds || params.targetBreedIds.length === 0) {
                    throw new Error("At least one target breed is required")
                }

                const sourceBreed = breeds.find(b => b.id === sourceBreedId)
                if (!sourceBreed) throw new Error("Source breed not found")

                // Process each target breed
                for (const targetId of params.targetBreedIds) {
                    if (params.copyDetails) {
                        // Update breed details (but NOT the name - keep existing breed name)
                        const { error: updateError } = await supabase
                            .from("breeds")
                            .update({
                                size_class: sourceBreed.size_class,
                                min_groom_price: sourceBreed.min_groom_price,
                                max_groom_price: sourceBreed.max_groom_price,
                                hourly_price: sourceBreed.hourly_price,
                                notes: sourceBreed.notes,
                            })
                            .eq("id", targetId)

                        if (updateError) throw updateError

                        // Copy dog categories - delete existing and insert new ones
                        const { error: deleteCategoriesError } = await supabase
                            .from("breed_dog_categories")
                            .delete()
                            .eq("breed_id", targetId)

                        if (deleteCategoriesError) throw deleteCategoriesError

                        const originalCategoryIds = breedCategoriesMap[sourceBreedId] || []
                        if (originalCategoryIds.length > 0) {
                            const categoriesToInsert = originalCategoryIds.map(categoryId => ({
                                breed_id: targetId,
                                dog_category_id: categoryId
                            }))
                            const { error: categoriesError } = await supabase
                                .from("breed_dog_categories")
                                .insert(categoriesToInsert)
                            if (categoriesError) throw categoriesError
                        }
                    }

                    // Copy station relations if requested
                    if (groomingServiceId && params.copyStationRelations) {
                        const originalBreedCells = matrix[sourceBreedId] || {}
                        const stationIds = Object.keys(originalBreedCells)

                        for (const stationId of stationIds) {
                            const cell = originalBreedCells[stationId]
                            if (cell?.supported) {
                                // Get the original values
                                const defaultTime = cell.defaultTime
                                const originalStationTime = cell.stationTime
                                const originalRemoteBooking = cell.remote_booking_allowed ?? false
                                const originalApprovalNeeded = cell.is_approval_needed ?? false

                                // Get base_time_minutes for this station
                                const { data: baseTimeData } = await supabase
                                    .from("service_station_matrix")
                                    .select("base_time_minutes")
                                    .eq("station_id", stationId)
                                    .maybeSingle()

                                const baseTime = baseTimeData?.base_time_minutes || 0
                                const durationMinutes = originalStationTime || (baseTime + (defaultTime || 60))

                                // Ensure breed_modifier exists with the same default time
                                if (defaultTime) {
                                    await supabase
                                        .from("breed_modifiers")
                                        .upsert(
                                            {
                                                breed_id: targetId,
                                                time_modifier_minutes: defaultTime,
                                            },
                                            { onConflict: "service_id,breed_id" }
                                        )
                                }

                                // Copy station_breed_rules with ALL values
                                await supabase
                                    .from("station_breed_rules")
                                    .upsert(
                                        {
                                            station_id: stationId,
                                            breed_id: targetId,
                                            is_active: true,
                                            remote_booking_allowed: originalRemoteBooking,
                                            requires_staff_approval: originalApprovalNeeded,
                                            duration_modifier_minutes: durationMinutes,
                                        },
                                        { onConflict: "station_id,breed_id" }
                                    )
                            }
                        }
                    }
                }

                toast({
                    title: "הצלחה",
                    description: `הנתונים הועתקו ל-${params.targetBreedIds.length} גזעים בהצלחה`,
                })

                // Reload all data
                await loadData()
            }
        } catch (error: unknown) {
            console.error("Error duplicating breed:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsDuplicatingBreed(false)
            setBreedToDuplicate(null)
        }
    }

    const confirmDuplicateStation = async (params: {
        mode: "new" | "existing"
        name?: string
        targetStationIds?: string[]
        copyDetails: boolean
        copyBreedRelations: boolean
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

                const sourceStation = allStations.find(s => s.id === sourceStationId)
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

                    // Copy breed relations if requested
                    if (groomingServiceId && params.copyBreedRelations) {
                        // Get the original station's base_time_minutes from service_station_matrix
                        const { data: originalMatrixData } = await supabase
                            .from("service_station_matrix")
                            .select("base_time_minutes")
                            .eq("station_id", sourceStationId)
                            .maybeSingle()

                        const originalBaseTime = originalMatrixData?.base_time_minutes || 0

                        // Copy the base_time_minutes to the target station
                        const { error: baseTimeError } = await supabase
                            .from("service_station_matrix")
                            .upsert(
                                {
                                    station_id: targetId,
                                    base_time_minutes: originalBaseTime,
                                    price: 0,
                                },
                                { onConflict: "service_id,station_id" }
                            )

                        if (baseTimeError) throw baseTimeError

                        // Now copy all breed-specific matrix values including station_breed_rules
                        const breedIds = Object.keys(matrix)
                        for (const breedId of breedIds) {
                            const cell = matrix[breedId]?.[sourceStationId]
                            if (cell?.supported) {
                                // Get the original values
                                const defaultTime = cell.defaultTime
                                const originalStationTime = cell.stationTime
                                const originalRemoteBooking = cell.remote_booking_allowed ?? false
                                const originalApprovalNeeded = cell.is_approval_needed ?? false

                                // Ensure breed_modifier exists with the same default time
                                if (defaultTime) {
                                    await supabase
                                        .from("breed_modifiers")
                                        .upsert(
                                            {
                                                breed_id: breedId,
                                                time_modifier_minutes: defaultTime,
                                            },
                                            { onConflict: "service_id,breed_id" }
                                        )
                                }

                                // Copy station_breed_rules with ALL values
                                const durationMinutes = originalStationTime || (originalBaseTime + (defaultTime || 60))
                                await supabase
                                    .from("station_breed_rules")
                                    .upsert(
                                        {
                                            station_id: targetId,
                                            breed_id: breedId,
                                            is_active: true,
                                            remote_booking_allowed: originalRemoteBooking,
                                            requires_staff_approval: originalApprovalNeeded,
                                            duration_modifier_minutes: durationMinutes,
                                        },
                                        { onConflict: "station_id,breed_id" }
                                    )
                            }
                        }
                    }
                }

                // Reload stations and matrix data
                const { data: stationsData } = await supabase
                    .from("stations")
                    .select("id, name, is_active")
                    .order("name")

                if (stationsData) {
                    const activeStations = stationsData.filter((s) => s.is_active)
                    setAllStations(activeStations)
                    setAllStationsIncludingInactive(stationsData)

                    // Reload matrix data to ensure everything is in sync
                    if (groomingServiceId) {
                        await loadMatrixData(breeds, activeStations)
                    }
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
            const breedIds = Object.keys(matrix)

            if (params.mode === "new" && groomingServiceId && params.copyBreedRelations) {
                // Get the original station's base_time_minutes from service_station_matrix
                const { data: originalMatrixData } = await supabase
                    .from("service_station_matrix")
                    .select("base_time_minutes")
                    .eq("station_id", sourceStationId)
                    .maybeSingle()

                const originalBaseTime = originalMatrixData?.base_time_minutes || 0

                // Copy the base_time_minutes to the target station first
                const { error: baseTimeError } = await supabase
                    .from("service_station_matrix")
                    .upsert(
                        {
                            station_id: targetStationId,
                            base_time_minutes: originalBaseTime,
                            price: 0,
                        },
                        { onConflict: "service_id,station_id" }
                    )

                if (baseTimeError) throw baseTimeError

                // Now copy all breed-specific matrix values including station_breed_rules
                // For each breed that was supported in the original station, ensure it's supported in the target one
                for (const breedId of breedIds) {
                    const cell = matrix[breedId]?.[sourceStationId]
                    if (cell?.supported) {
                        // Get the original values
                        const defaultTime = cell.defaultTime
                        const originalStationTime = cell.stationTime
                        const originalRemoteBooking = cell.remote_booking_allowed ?? false
                        const originalApprovalNeeded = cell.is_approval_needed ?? false

                        // Ensure breed_modifier exists with the same default time
                        if (defaultTime) {
                            await supabase
                                .from("breed_modifiers")
                                .upsert(
                                    {
                                        breed_id: breedId,
                                        time_modifier_minutes: defaultTime,
                                    },
                                    { onConflict: "service_id,breed_id" }
                                )
                        }

                        // Copy station_breed_rules with ALL values (is_active, remote_booking_allowed, requires_staff_approval, duration_modifier_minutes)
                        const durationMinutes = originalStationTime || (originalBaseTime + (defaultTime || 60))
                        await supabase
                            .from("station_breed_rules")
                            .upsert(
                                {
                                    station_id: targetStationId,
                                    breed_id: breedId,
                                    is_active: true,
                                    remote_booking_allowed: originalRemoteBooking,
                                    requires_staff_approval: originalApprovalNeeded,
                                    duration_modifier_minutes: durationMinutes,
                                },
                                { onConflict: "station_id,breed_id" }
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
                if (groomingServiceId) {
                    await loadMatrixData(breeds, activeStations)
                }
            }

            toast({
                title: "הצלחה",
                description: params.mode === "new"
                    ? "העמדה שוכפלה בהצלחה עם כל הערכים"
                    : "הנתונים הועתקו לעמדה הקיימת בהצלחה",
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
                .from("grooming_appointments")
                .update({ station_id: targetStationId })
                .eq("station_id", stationToDelete.id)

            if (transferError) throw transferError

            // Delete the station (this will cascade delete related records)
            const { error: deleteError } = await supabase
                .from("stations")
                .delete()
                .eq("id", stationToDelete.id)

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
                if (groomingServiceId) {
                    await loadMatrixData(breeds, activeStations)
                }
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
        breeds,
        filteredBreeds,
        visibleBreeds,
        allStations,
        allStationsIncludingInactive,
        visibleStations,
        selectedStationIds,
        stationPage,
        breedPage,
        searchTerm,
        categoryFilterIds,
        selectedColumnFilter,
        columnFilterNeedsApproval,
        columnFilterIsActive,
        columnFilterRemoteBooking,
        columnFilterDurationMin,
        columnFilterDurationMax,
        groomingServiceId,
        matrix,
        initialMatrix,
        isLoading,
        isSaving,
        isStationDialogOpen,
        isAddStationDialogOpen,
        isAddBreedDialogOpen,
        newStationName,
        newBreedName,
        isAddingStation,
        isAddingBreed,
        stationToDelete,
        stationToDuplicate,
        isDeleteConfirmOpen,
        isDuplicateConfirmOpen,
        isTransferDialogOpen,
        breedToDuplicate,
        isDuplicateBreedDialogOpen,
        isDuplicatingBreed,
        breedToDelete,
        isDeleteBreedDialogOpen,
        isDeletingBreed,
        isTypingDuration,
        durationInputValues,
        isTypingDefault,
        defaultDurationInputValues,
        expandedBreedId,
        editedBreedPrices,
        dogCategories,
        breedCategoriesMap,
        editedCategoriesMap,
        savingBreedId,
        savingBreedRowId,
        sensors,
        // Setters
        setSearchTerm,
        setCategoryFilterIds,
        setSelectedColumnFilter,
        setColumnFilterNeedsApproval,
        setColumnFilterIsActive,
        setColumnFilterRemoteBooking,
        setColumnFilterDurationMin,
        setColumnFilterDurationMax,
        setIsStationDialogOpen,
        setIsAddStationDialogOpen,
        setIsAddBreedDialogOpen,
        setNewStationName,
        setNewBreedName,
        setStationToDelete,
        setStationToDuplicate,
        setIsDeleteConfirmOpen,
        setIsDuplicateConfirmOpen,
        setIsTransferDialogOpen,
        setBreedToDuplicate,
        setIsDuplicateBreedDialogOpen,
        setBreedToDelete,
        setIsDeleteBreedDialogOpen,
        setIsTypingDuration,
        setDurationInputValues,
        setIsTypingDefault,
        setDefaultDurationInputValues,
        setExpandedBreedId,
        setEditedBreedPrices,
        setEditedCategoriesMap,
        // Utility functions
        getDefaultTimeForBreed,
        getBreedCategories,
        breedHasPriceChanges,
        breedHasMatrixChanges,
        getBreedStatus,
        toggleBreedExpand,
        cloneBreedMatrix,
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
        handleAddBreed,
        handleAddStation,
        handleSave,
        handlePriceChange,
        handleCategoriesChange,
        handleNotesChange,
        handleSaveBreedPrices,
        handleCancelBreedPrices,
        handleSaveBreedRow,
        handleRevertBreedRow,
        handleToggleRemoteBooking,
        handleToggleApproval,
        handleNextStationPage,
        handlePreviousStationPage,
        handleNextBreedPage,
        handlePreviousBreedPage,
        handleDuplicateStation,
        handleDuplicateBreed,
        handleDeleteBreed,
        confirmDeleteBreed,
        confirmDuplicateBreed,
        confirmDuplicateStation,
        handleDeleteStation,
        confirmDeleteStation,
        handleTransferAndDelete,
        // Pagination helpers
        maxStationPage,
        canGoPreviousStation,
        canGoNextStation,
        maxBreedPage,
        canGoPreviousBreed,
        canGoNextBreed,
    }
}

