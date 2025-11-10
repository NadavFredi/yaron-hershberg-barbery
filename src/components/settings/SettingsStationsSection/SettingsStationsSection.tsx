import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DuplicateStationDialog } from "../../dialogs/settings/stations/DuplicateStationDialog"
import { DeleteStationDialog } from "../../dialogs/settings/stations/DeleteStationDialog"
import { StationEditDialog } from "../../dialogs/settings/stations/StationEditDialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, Loader2, Eye, ChevronLeft, ChevronRight, AlertCircle, Copy, GripVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAppDispatch } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import { Badge } from "@/components/ui/badge"
import { StationUnavailabilityDialog } from "@/components/dialogs/settings/stations/StationUnavailabilityDialog"
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Station {
    id: string
    name: string
    is_active: boolean
    display_order?: number
    slot_interval_minutes?: number
}

interface StationWorkingHour {
    id?: string
    station_id: string
    weekday: string
    open_time: string
    close_time: string
    shift_order: number
}

interface DayShifts {
    weekday: string
    shifts: StationWorkingHour[]
}

interface StationUnavailability {
    id: string
    station_id: string
    reason: string | null
    notes: { text?: string } | null
    start_time: string
    end_time: string
}

interface CustomerTypeOption {
    id: string
    name: string
}

interface SortableStationRowProps {
    station: Station
    hasWorkingHours: boolean
    allowedTypes: CustomerTypeOption[]
    description: string
    slotIntervalMinutes: number
    onToggleActive: (station: Station) => void
    onView: (station: Station) => void
    onEdit: (station: Station) => void
    onDuplicate: (station: Station) => void
    onDelete: (station: Station) => void
}

function SortableStationRow({
    station,
    hasWorkingHours,
    allowedTypes,
    description,
    slotIntervalMinutes,
    onToggleActive,
    onView,
    onEdit,
    onDuplicate,
    onDelete,
}: SortableStationRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: station.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn("transition-colors", isDragging && "bg-[hsl(228_36%_95%)]")}
        >
            <TableCell className="w-12 align-middle">
                <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded border border-transparent text-gray-400 transition-colors hover:border-primary/30 hover:text-primary"
                    aria-label="שנה סדר עמדה"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </TableCell>
            <TableCell className="px-4 py-1 align-middle font-medium">
                <div className="flex items-center gap-2">
                    <span>{station.name}</span>
                    {!hasWorkingHours && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 transition-colors hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    aria-label="אין שעות עבודה מוגדרות לעמדה זו"
                                >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" side="bottom" className="w-60 text-sm" dir="rtl">
                                <div className="space-y-1 text-right">
                                    <p className="font-medium text-amber-700">אין שעות עבודה מוגדרות לעמדה זו</p>
                                    <p className="text-xs text-gray-600">הגדר שעות עבודה כדי לאפשר קביעת תורים.</p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </TableCell>
            <TableCell className="px-4 py-1 align-middle">
                <div className="flex items-center">
                    <Checkbox
                        checked={station.is_active}
                        onCheckedChange={() => onToggleActive(station)}
                        className="scale-125"
                    />
                </div>
            </TableCell>
            <TableCell className="px-4 py-1 align-middle text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {slotIntervalMinutes} דקות
                </span>
            </TableCell>
            <TableCell className="px-4 py-1 align-middle text-right">
                <div className="text-sm text-gray-600">{description}</div>
            </TableCell>
            <TableCell className="px-4 py-1 align-middle text-right">
                {allowedTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {allowedTypes.slice(0, 3).map((type) => (
                            <Badge key={type.id} variant="outline" className="border-primary/20 bg-primary/5 text-primary text-xs px-2 py-0.5">
                                {type.name}
                            </Badge>
                        ))}
                        {allowedTypes.length > 3 && (
                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-xs px-2 py-0.5">
                                +{allowedTypes.length - 3}
                            </Badge>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">אין הגבלה</span>
                )}
            </TableCell>
            <TableCell className="px-4 py-1 align-middle">
                <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onView(station)} title="הצג פרטים">
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(station)} title="ערוך">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDuplicate(station)} title="שכפל">
                        <Copy className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(station)} title="מחק">
                        <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

const WEEKDAYS = [
    { value: "sunday", label: "יום ראשון", order: 0 },
    { value: "monday", label: "יום שני", order: 1 },
    { value: "tuesday", label: "יום שלישי", order: 2 },
    { value: "wednesday", label: "יום רביעי", order: 3 },
    { value: "thursday", label: "יום חמישי", order: 4 },
    { value: "friday", label: "יום שישי", order: 5 },
    { value: "saturday", label: "יום שבת", order: 6 },
]

export function SettingsStationsSection() {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const [stations, setStations] = useState<Station[]>([])
    const [stationWorkingHours, setStationWorkingHours] = useState<Record<string, StationWorkingHour[]>>({})
    const [unavailabilities, setUnavailabilities] = useState<Record<string, StationUnavailability[]>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
    const [isUnavailabilityDialogOpen, setIsUnavailabilityDialogOpen] = useState(false)
    const [editingStation, setEditingStation] = useState<Station | null>(null)
    const [viewingStation, setViewingStation] = useState<Station | null>(null)
    const [selectedStationForUnavailability, setSelectedStationForUnavailability] = useState<Station | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 50
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
    const [stationToDuplicate, setStationToDuplicate] = useState<Station | null>(null)
    const [stationOrderIds, setStationOrderIds] = useState<string[]>([])
    const [isOrderSaving, setIsOrderSaving] = useState(false)
    const stationDragSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 6,
            },
        })
    )
    const [isDuplicating, setIsDuplicating] = useState(false)
    const [stationToDelete, setStationToDelete] = useState<Station | null>(null)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
    const [groomingServiceId, setGroomingServiceId] = useState<string | null>(null)
    const [breeds, setBreeds] = useState<Array<{ id: string; name: string }>>([])

    // Station form data
    const [formData, setFormData] = useState({
        name: "",
        is_active: true,
        slot_interval_minutes: 60,
    })

    // Working hours data for the station being edited
    const [dayShifts, setDayShifts] = useState<DayShifts[]>([])
    const [stationAllowedCustomerTypes, setStationAllowedCustomerTypes] = useState<Record<string, CustomerTypeOption[]>>({})
    const [viewingAllowedCustomerTypes, setViewingAllowedCustomerTypes] = useState<CustomerTypeOption[]>([])

    const [unavailabilityFormData, setUnavailabilityFormData] = useState({
        reason: "",
        notes: "",
        start_time: "",
        end_time: "",
    })

    useEffect(() => {
        fetchStations()
        fetchUnavailabilities()
        loadGroomingServiceAndBreeds()
    }, [])

    const loadGroomingServiceAndBreeds = async () => {
        try {
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

            setGroomingServiceId(serviceData?.id || null)

            // Load breeds
            const { data: breedsData, error: breedsError } = await supabase
                .from("breeds")
                .select("id, name")
                .order("name")

            if (breedsError) throw breedsError
            setBreeds(breedsData || [])
        } catch (error) {
            console.error("Error loading grooming service and breeds:", error)
        }
    }

    useEffect(() => {
        // Fetch working hours for all stations in a single query when stations change
        if (stations.length > 0 && stations.length <= 100) { // Batch limit check
            const fetchAllStationWorkingHours = async () => {
                try {
                    // Fetch all working hours in one query
                    const { data, error } = await supabase
                        .from("station_working_hours")
                        .select("*")
                        .in("station_id", stations.map(s => s.id))
                        .order("station_id")
                        .order("weekday")
                        .order("shift_order")

                    if (error) throw error

                    // Group by station_id
                    const hoursMap: Record<string, StationWorkingHour[]> = {}
                    stations.forEach((station) => {
                        const stationHours = (data || [])
                            .filter(h => h.station_id === station.id)
                            .map((h) => ({
                                ...h,
                                open_time: h.open_time?.substring(0, 5) || "",
                                close_time: h.close_time?.substring(0, 5) || "",
                            }))
                        hoursMap[station.id] = stationHours
                    })

                    setStationWorkingHours(hoursMap)
                } catch (error) {
                    console.error("Error fetching station working hours:", error)
                    // Fallback to individual calls if batch fails
                    Promise.all(stations.map((station) => fetchStationWorkingHours(station.id))).then((results) => {
                        const hoursMap: Record<string, StationWorkingHour[]> = {}
                        stations.forEach((station, index) => {
                            hoursMap[station.id] = results[index]
                        })
                        setStationWorkingHours(hoursMap)
                    })
                }
            }

            fetchAllStationWorkingHours()
        }
    }, [stations])

    const fetchStations = async (showLoading: boolean = true) => {
        if (showLoading) {
            setIsLoading(true)
        }
        try {
            const { data, error } = await supabase
                .from("stations")
                .select("id, name, is_active, display_order, slot_interval_minutes")
                .order("display_order", { ascending: true })
                .order("name")

            if (error) throw error
            const normalizedStations = (data || []).map((station) => ({
                ...station,
                slot_interval_minutes: station.slot_interval_minutes ?? 60,
            }))
            setStations(normalizedStations)
            setStationOrderIds((prev) => {
                const incoming = (data || []).map((station) => station.id)
                if (prev.length === 0) return incoming
                const preserved = prev.filter((id) => incoming.includes(id))
                const missing = incoming.filter((id) => !preserved.includes(id))
                return [...preserved, ...missing]
            })
        } catch (error) {
            console.error("Error fetching stations:", error)
            if (showLoading) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לטעון את רשימת העמדות",
                    variant: "destructive",
                })
            }
        } finally {
            if (showLoading) {
                setIsLoading(false)
            }
        }
    }

    const fetchStationWorkingHours = async (stationId: string): Promise<StationWorkingHour[]> => {
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

    const fetchStationAllowedCustomerTypes = async (stationId: string): Promise<CustomerTypeOption[]> => {
        try {
            const { data, error } = await supabase
                .from("station_allowed_customer_types")
                .select("customer_type_id, customer_type:customer_types(id, name)")
                .eq("station_id", stationId)

            if (error) throw error

            const options: CustomerTypeOption[] = []
            const seen = new Set<string>()
            type AllowedRow = {
                customer_type_id: string | null
                customer_type?: { id: string; name: string } | null
            }

            const rows = (data || []) as AllowedRow[]
            for (const row of rows) {
                const resolvedId = row.customer_type?.id || row.customer_type_id || undefined
                if (!resolvedId || seen.has(resolvedId)) {
                    continue
                }

                seen.add(resolvedId)
                options.push({
                    id: resolvedId,
                    name: row.customer_type?.name || "סוג לקוח לא ידוע",
                })
            }

            console.log("✅ [SettingsStationsSection] Loaded allowed customer types:", {
                stationId,
                count: options.length,
            })

            return options
        } catch (error) {
            console.error("❌ [SettingsStationsSection] Failed to load allowed customer types:", error)
            throw error
        }
    }

    const loadAllowedCustomerTypes = async (stationIds: string[]) => {
        if (stationIds.length === 0) {
            setStationAllowedCustomerTypes({})
            return
        }

        try {
            const { data, error } = await supabase
                .from("station_allowed_customer_types")
                .select("station_id, customer_type:customer_types(id, name)")
                .in("station_id", stationIds)

            if (error) throw error

            type AllowedRow = {
                station_id: string | null
                customer_type: { id: string; name: string } | null
            }

            const grouped: Record<string, CustomerTypeOption[]> = {}
            const rows = (data || []) as AllowedRow[]

            rows.forEach((row) => {
                if (!row.station_id) {
                    return
                }
                if (!grouped[row.station_id]) {
                    grouped[row.station_id] = []
                }
                if (row.customer_type) {
                    grouped[row.station_id].push({
                        id: row.customer_type.id,
                        name: row.customer_type.name,
                    })
                }
            })

            stationIds.forEach((id) => {
                if (!grouped[id]) {
                    grouped[id] = []
                }
            })

            console.log("✅ [SettingsStationsSection] Loaded allowed customer type restrictions for table view:", grouped)
            setStationAllowedCustomerTypes(grouped)
        } catch (error) {
            console.error("❌ [SettingsStationsSection] Failed to bulk load allowed customer type restrictions:", error)
        }
    }

    useEffect(() => {
        if (stations.length === 0) {
            setStationAllowedCustomerTypes({})
            return
        }

        void loadAllowedCustomerTypes(stations.map((station) => station.id))
    }, [stations])

    const processHoursData = (existingHours: StationWorkingHour[]) => {
        const shiftsByDay = new Map<string, StationWorkingHour[]>()

        WEEKDAYS.forEach((day) => {
            shiftsByDay.set(day.value, [])
        })

        existingHours.forEach((hour) => {
            if (shiftsByDay.has(hour.weekday)) {
                shiftsByDay.get(hour.weekday)!.push(hour)
            }
        })

        const sortedDays: DayShifts[] = WEEKDAYS.map((day) => {
            const shifts = shiftsByDay.get(day.value) || []
            shifts.sort((a, b) => (a.shift_order || 0) - (b.shift_order || 0))
            return {
                weekday: day.value,
                shifts: shifts.length > 0 ? shifts : [],
            }
        })

        setDayShifts(sortedDays)
    }

    const fetchUnavailabilities = async () => {
        try {
            const { data, error } = await supabase.from("station_unavailability").select("*")

            if (error) throw error

            const grouped = (data || []).reduce((acc, unav) => {
                if (!acc[unav.station_id]) acc[unav.station_id] = []
                acc[unav.station_id].push(unav)
                return acc
            }, {} as Record<string, StationUnavailability[]>)

            setUnavailabilities(grouped)
        } catch (error) {
            console.error("Error fetching unavailabilities:", error)
        }
    }

    const handleAdd = () => {
        setEditingStation(null)
        setIsDialogOpen(true)
    }

    const handleView = async (station: Station) => {
        setViewingStation(station)
        setFormData({
            name: station.name,
            is_active: station.is_active,
            slot_interval_minutes: station.slot_interval_minutes ?? 60,
        })
        setViewingAllowedCustomerTypes([])

        try {
            console.log("🔍 [SettingsStationsSection] Loading station view data:", station.id)
            const [hours, allowedTypes] = await Promise.all([
                fetchStationWorkingHours(station.id),
                fetchStationAllowedCustomerTypes(station.id).catch((error) => {
                    toast({
                        title: "שגיאה בטעינת סוגי הלקוחות",
                        description: "לא הצלחנו לטעון את סוגי הלקוחות המורשים לעמדה זו.",
                        variant: "destructive",
                    })
                    console.error("❌ [SettingsStationsSection] Failed to fetch allowed customer types for view:", error)
                    return []
                }),
            ])

            processHoursData(hours)
            setViewingAllowedCustomerTypes(allowedTypes)
            setStationAllowedCustomerTypes((prev) => ({
                ...prev,
                [station.id]: allowedTypes,
            }))
        } finally {
            setIsViewDialogOpen(true)
        }
    }

    const handleEdit = (station: Station) => {
        setEditingStation(station)
        setIsDialogOpen(true)
    }

    const handleDialogSaved = async () => {
        await fetchStations()
        // Refresh working hours for all stations after saving
        const hoursMap: Record<string, StationWorkingHour[]> = {}
        const allStations = await supabase
            .from("stations")
            .select("id, name, is_active, display_order, slot_interval_minutes")
            .order("display_order", { ascending: true })
            .order("name")
        if (allStations.data) {
            const normalized = allStations.data.map((station) => ({
                ...station,
                slot_interval_minutes: station.slot_interval_minutes ?? 60,
            }))
            const results = await Promise.all(normalized.map((s) => fetchStationWorkingHours(s.id)))
            normalized.forEach((station, index) => {
                hoursMap[station.id] = results[index]
            })
            setStationWorkingHours(hoursMap)
            await loadAllowedCustomerTypes(normalized.map((station) => station.id))
        }
    }

    const handleToggleActive = async (station: Station) => {
        // Optimistically update the UI immediately
        const newActiveState = !station.is_active
        setStations((prev) =>
            prev.map((s) => (s.id === station.id ? { ...s, is_active: newActiveState } : s))
        )

        try {
            const { error } = await supabase.from("stations").update({ is_active: newActiveState }).eq("id", station.id)
            if (error) throw error

            // Invalidate ManagerSchedule cache so the calendar board reflects the change immediately
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))

            // Silently refresh in the background without showing loading state
            fetchStations(false)
        } catch (_error: unknown) {
            // Revert optimistic update on error
            setStations((prev) =>
                prev.map((s) => (s.id === station.id ? { ...s, is_active: station.is_active } : s))
            )
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את סטטוס העמדה",
                variant: "destructive",
            })
        }
    }

    const handleAddUnavailability = (station: Station) => {
        setSelectedStationForUnavailability(station)
        setUnavailabilityFormData({
            reason: "",
            notes: "",
            start_time: "",
            end_time: "",
        })
        setIsUnavailabilityDialogOpen(true)
    }

    const handleSaveUnavailability = async () => {
        if (!selectedStationForUnavailability || !unavailabilityFormData.start_time || !unavailabilityFormData.end_time) {
            return
        }

        setIsSaving(true)
        try {
            const { error } = await supabase.from("station_unavailability").insert({
                station_id: selectedStationForUnavailability.id,
                reason: unavailabilityFormData.reason || null,
                notes: unavailabilityFormData.notes ? { text: unavailabilityFormData.notes } : null,
                start_time: unavailabilityFormData.start_time,
                end_time: unavailabilityFormData.end_time,
            })

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "האילוץ נוסף בהצלחה",
            })

            setIsUnavailabilityDialogOpen(false)
            fetchUnavailabilities()
        } catch (error: unknown) {
            console.error("Error saving unavailability:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את האילוץ"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDuplicate = (station: Station) => {
        setStationToDuplicate(station)
        setIsDuplicateDialogOpen(true)
    }

    const confirmDuplicateStation = async (params: {
        mode: "new" | "existing"
        name?: string
        targetStationIds?: string[]
        copyDetails: boolean
        copyBreedRelations: boolean
    }) => {
        if (!stationToDuplicate) return

        setIsDuplicating(true)
        try {
            const sourceStationId = stationToDuplicate.id
            const { data: allowedCustomerTypesRows, error: allowedTypesError } = await supabase
                .from("station_allowed_customer_types")
                .select("customer_type_id")
                .eq("station_id", sourceStationId)

            if (allowedTypesError) throw allowedTypesError

            const allowedCustomerTypeIds = (allowedCustomerTypesRows || [])
                .map((row) => row.customer_type_id)
                .filter((value): value is string => Boolean(value))

            let targetStationId: string

            if (params.mode === "new") {
                // Create new station
                if (!params.name) throw new Error("Station name is required for new station")

                const { data: newStation, error: stationError } = await supabase
                    .from("stations")
                    .insert({
                        name: params.name,
                        is_active: stationToDuplicate.is_active,
                        slot_interval_minutes: stationToDuplicate.slot_interval_minutes ?? 60,
                    })
                    .select("id, name, is_active")
                    .single()

                if (stationError) throw stationError
                if (!newStation) throw new Error("Failed to create duplicate station")
                targetStationId = newStation.id

                // Fetch working hours for the original station
                const originalWorkingHours = await fetchStationWorkingHours(sourceStationId)

                // Duplicate working hours
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

                if (allowedCustomerTypeIds.length > 0) {
                    const payload = allowedCustomerTypeIds.map((customerTypeId) => ({
                        station_id: targetStationId,
                        customer_type_id: customerTypeId,
                    }))

                    const { error: insertAllowedError } = await supabase
                        .from("station_allowed_customer_types")
                        .insert(payload)

                    if (insertAllowedError) throw insertAllowedError
                }
            } else {
                // Copy to existing stations
                if (!params.targetStationIds || params.targetStationIds.length === 0) {
                    throw new Error("At least one target station is required")
                }

                const sourceStation = stations.find(s => s.id === sourceStationId)
                if (!sourceStation) throw new Error("Source station not found")

                // Process each target station
                for (const targetId of params.targetStationIds) {
                    if (params.copyDetails) {
                        // Update is_active (but NOT the name - keep existing station name)
                        const { error: updateError } = await supabase
                            .from("stations")
                            .update({
                                is_active: sourceStation.is_active,
                                slot_interval_minutes: sourceStation.slot_interval_minutes ?? 60,
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

                        const { error: deleteAllowedError } = await supabase
                            .from("station_allowed_customer_types")
                            .delete()
                            .eq("station_id", targetId)

                        if (deleteAllowedError) throw deleteAllowedError

                        if (allowedCustomerTypeIds.length > 0) {
                            const payload = allowedCustomerTypeIds.map((customerTypeId) => ({
                                station_id: targetId,
                                customer_type_id: customerTypeId,
                            }))

                            const { error: insertAllowedError } = await supabase
                                .from("station_allowed_customer_types")
                                .insert(payload)

                            if (insertAllowedError) throw insertAllowedError
                        }
                    }

                    // Copy breed relations if requested
                    if (groomingServiceId && params.copyBreedRelations) {
                        // Get the original station's base_time_minutes from service_station_matrix
                        const { data: originalMatrixData } = await supabase
                            .from("service_station_matrix")
                            .select("base_time_minutes")
                            .eq("service_id", groomingServiceId)
                            .eq("station_id", sourceStationId)
                            .maybeSingle()

                        const originalBaseTime = originalMatrixData?.base_time_minutes || 0

                        // Copy the base_time_minutes to the target station
                        const { error: baseTimeError } = await supabase
                            .from("service_station_matrix")
                            .upsert(
                                {
                                    service_id: groomingServiceId,
                                    station_id: targetId,
                                    base_time_minutes: originalBaseTime,
                                    price: 0,
                                },
                                { onConflict: "service_id,station_id" }
                            )

                        if (baseTimeError) throw baseTimeError

                        // Get all station_breed_rules for the original station
                        const { data: originalRules, error: rulesError } = await supabase
                            .from("station_breed_rules")
                            .select("*")
                            .eq("station_id", sourceStationId)

                        if (rulesError) throw rulesError

                        // Copy all station_breed_rules with ALL values
                        console.log(
                            "[SettingsStationsSection] Copying",
                            originalRules?.length ?? 0,
                            "station_breed_rules records from",
                            sourceStationId,
                            "to",
                            targetId
                        )

                        if (originalRules && originalRules.length > 0) {
                            for (const rule of originalRules) {
                                // Get default time from breed_modifiers if exists
                                const { data: breedModifier } = await supabase
                                    .from("breed_modifiers")
                                    .select("time_modifier_minutes")
                                    .eq("service_id", groomingServiceId)
                                    .eq("breed_id", rule.breed_id)
                                    .maybeSingle()

                                const defaultTime = breedModifier?.time_modifier_minutes || 60
                                const durationMinutes = rule.duration_modifier_minutes || (originalBaseTime + defaultTime)

                                // Copy station_breed_rules with ALL values
                                await supabase
                                    .from("station_breed_rules")
                                    .upsert(
                                        {
                                            station_id: targetId,
                                            breed_id: rule.breed_id,
                                            is_active: rule.is_active ?? true,
                                            remote_booking_allowed: rule.remote_booking_allowed ?? false,
                                            requires_staff_approval: rule.requires_staff_approval ?? false,
                                            duration_modifier_minutes: durationMinutes,
                                        },
                                        { onConflict: "station_id,breed_id" }
                                    )

                                // Ensure breed_modifier exists with the same default time if it exists for original
                                if (breedModifier) {
                                    await supabase
                                        .from("breed_modifiers")
                                        .upsert(
                                            {
                                                service_id: groomingServiceId,
                                                breed_id: rule.breed_id,
                                                time_modifier_minutes: breedModifier.time_modifier_minutes,
                                            },
                                            { onConflict: "service_id,breed_id" }
                                        )
                                }
                            }
                        }
                    }
                }

                // Refresh stations and working hours for all target stations
                await fetchStations()
                for (const targetId of params.targetStationIds) {
                    const hours = await fetchStationWorkingHours(targetId)
                    setStationWorkingHours((prev) => ({ ...prev, [targetId]: hours }))
                }

                toast({
                    title: "הצלחה",
                    description: `הנתונים הועתקו ל-${params.targetStationIds.length} עמדות בהצלחה`,
                })

                // Invalidate ManagerSchedule cache
                dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))

                setIsDuplicateDialogOpen(false)
                setStationToDuplicate(null)
                setIsDuplicating(false)
                return
            }

            // Copy all matrix values for this station (only if checkbox is checked and mode is "new")
            if (params.mode === "new" && groomingServiceId && params.copyBreedRelations) {
                // Get the original station's base_time_minutes from service_station_matrix
                const { data: originalMatrixData } = await supabase
                    .from("service_station_matrix")
                    .select("base_time_minutes")
                    .eq("service_id", groomingServiceId)
                    .eq("station_id", sourceStationId)
                    .maybeSingle()

                const originalBaseTime = originalMatrixData?.base_time_minutes || 0

                // Copy the base_time_minutes to the target station first
                const { error: baseTimeError } = await supabase
                    .from("service_station_matrix")
                    .upsert(
                        {
                            service_id: groomingServiceId,
                            station_id: targetStationId,
                            base_time_minutes: originalBaseTime,
                            price: 0,
                        },
                        { onConflict: "service_id,station_id" }
                    )

                if (baseTimeError) throw baseTimeError

                // Get all station_breed_rules for the original station
                const { data: originalRules, error: rulesError } = await supabase
                    .from("station_breed_rules")
                    .select("*")
                    .eq("station_id", sourceStationId)

                if (rulesError) throw rulesError

                // Copy all station_breed_rules with ALL values
                console.log(
                    "[SettingsStationsSection] Copying",
                    originalRules?.length ?? 0,
                    "station_breed_rules records from",
                    sourceStationId,
                    "to new station",
                    targetStationId
                )

                if (originalRules && originalRules.length > 0) {
                    for (const rule of originalRules) {
                        // Get default time from breed_modifiers if exists
                        const { data: breedModifier } = await supabase
                            .from("breed_modifiers")
                            .select("time_modifier_minutes")
                            .eq("service_id", groomingServiceId)
                            .eq("breed_id", rule.breed_id)
                            .maybeSingle()

                        const defaultTime = breedModifier?.time_modifier_minutes || 60
                        const durationMinutes = rule.duration_modifier_minutes || (originalBaseTime + defaultTime)

                        // Copy station_breed_rules with ALL values
                        await supabase
                            .from("station_breed_rules")
                            .upsert(
                                {
                                    station_id: targetStationId,
                                    breed_id: rule.breed_id,
                                    is_active: rule.is_active ?? true,
                                    remote_booking_allowed: rule.remote_booking_allowed ?? false,
                                    requires_staff_approval: rule.requires_staff_approval ?? false,
                                    duration_modifier_minutes: durationMinutes,
                                },
                                { onConflict: "station_id,breed_id" }
                            )

                        // Ensure breed_modifier exists with the same default time if it exists for original
                        if (breedModifier) {
                            await supabase
                                .from("breed_modifiers")
                                .upsert(
                                    {
                                        service_id: groomingServiceId,
                                        breed_id: rule.breed_id,
                                        time_modifier_minutes: breedModifier.time_modifier_minutes,
                                    },
                                    { onConflict: "service_id,breed_id" }
                                )
                        }
                    }
                }
            }

            toast({
                title: "הצלחה",
                description: params.mode === "new"
                    ? "העמדה שוכפלה בהצלחה עם כל הערכים"
                    : "הנתונים הועתקו לעמדה הקיימת בהצלחה",
            })

            // Invalidate ManagerSchedule cache so the calendar board reflects the changes immediately
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))

            setIsDuplicateDialogOpen(false)
            setStationToDuplicate(null)

            // Refresh stations and working hours
            await fetchStations()
            const hours = await fetchStationWorkingHours(targetStationId)
            setStationWorkingHours((prev) => ({ ...prev, [targetStationId]: hours }))
        } catch (error: unknown) {
            console.error("Error duplicating station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את העמדה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsDuplicating(false)
        }
    }

    const handleDeleteUnavailability = async (id: string) => {
        if (!confirm("האם אתה בטוח שברצונך למחוק את האילוץ הזה?")) return

        try {
            const { error } = await supabase.from("station_unavailability").delete().eq("id", id)
            if (error) throw error
            toast({
                title: "הצלחה",
                description: "האילוץ נמחק בהצלחה",
            })
            fetchUnavailabilities()
        } catch (_error: unknown) {
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את האילוץ",
                variant: "destructive",
            })
        }
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

            toast({
                title: "הצלחה",
                description: "העמדה נמחקה והתורים הועברו בהצלחה",
            })

            // Invalidate ManagerSchedule cache so the calendar board reflects the changes immediately
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))

            setIsTransferDialogOpen(false)
            setStationToDelete(null)

            // Refresh stations
            await fetchStations()
        } catch (error: unknown) {
            console.error("Error deleting station:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את העמדה",
                variant: "destructive",
            })
        }
    }

    const orderedStations = useMemo(() => {
        if (!stations.length) return []
        if (!stationOrderIds.length) {
            return [...stations].sort((a, b) => {
                const orderCompare = (a.display_order ?? 0) - (b.display_order ?? 0)
                if (orderCompare !== 0) return orderCompare
                return a.name.localeCompare(b.name, "he")
            })
        }
        const positions = new Map(stationOrderIds.map((id, index) => [id, index]))
        const fallback = stationOrderIds.length
        return [...stations].sort((a, b) => {
            const posA = positions.get(a.id) ?? fallback
            const posB = positions.get(b.id) ?? fallback
            if (posA !== posB) return posA - posB
            const orderCompare = (a.display_order ?? 0) - (b.display_order ?? 0)
            if (orderCompare !== 0) return orderCompare
            return a.name.localeCompare(b.name, "he")
        })
    }, [stations, stationOrderIds])

    const persistStationOrder = async (orderedIds: string[]) => {
        const payload = orderedIds
            .map((id, index) => {
                const station = stations.find((s) => s.id === id)
                if (!station) return null
                return {
                    id,
                    display_order: index,
                    name: station.name,
                    is_active: station.is_active,
                }
            })
            .filter((value): value is { id: string; display_order: number; name: string; is_active: boolean } => value !== null)

        if (!payload.length) return

        setIsOrderSaving(true)
        try {
            const { error } = await supabase.from("stations").upsert(payload, { onConflict: "id" })
            if (error) throw error
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
        } catch (error) {
            console.error("Error updating station order:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את סדר העמדות",
                variant: "destructive",
            })
        } finally {
            setIsOrderSaving(false)
        }
    }

    const handleStationOrderEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setStationOrderIds((prev) => {
            const oldIndex = prev.indexOf(String(active.id))
            const newIndex = prev.indexOf(String(over.id))
            if (oldIndex === -1 || newIndex === -1) return prev
            const next = arrayMove(prev, oldIndex, newIndex)
            void persistStationOrder(next)
            return next
        })
    }

    const getStationDescription = (stationId: string): string => {
        const hours = stationWorkingHours[stationId] || []
        if (hours.length === 0) {
            return "אין שעות עבודה מוגדרות"
        }

        // Group by weekday
        const byDay = new Map<string, StationWorkingHour[]>()
        hours.forEach((h) => {
            if (!byDay.has(h.weekday)) byDay.set(h.weekday, [])
            byDay.get(h.weekday)!.push(h)
        })

        const daysWithShifts = Array.from(byDay.keys()).sort((a, b) => {
            const aOrder = WEEKDAYS.find((d) => d.value === a)?.order ?? 999
            const bOrder = WEEKDAYS.find((d) => d.value === b)?.order ?? 999
            return aOrder - bOrder
        })

        if (daysWithShifts.length === 0) {
            return "אין שעות עבודה מוגדרות"
        }

        // Format: show days with all shifts times
        const dayLabels = daysWithShifts.map((day) => {
            const dayLabel = WEEKDAYS.find((d) => d.value === day)?.label || day
            const dayShifts = byDay.get(day)!
            dayShifts.sort((a, b) => (a.shift_order || 0) - (b.shift_order || 0))

            // Format all shifts for this day
            const shiftTimes = dayShifts.map((shift) =>
                `${shift.open_time.substring(0, 5)}-${shift.close_time.substring(0, 5)}`
            ).join(", ")

            return `${dayLabel} ${shiftTimes}`
        })

        return dayLabels.join(", ")
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען עמדות...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">ניהול עמדות</h2>
                    <p className="text-gray-600 mt-1">נהל את כל העמדות במערכת - שעות עבודה, ימי פעילות ואילוצים</p>
                </div>
                <div className="flex items-center gap-3">
                    {isOrderSaving && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>שומר סדר...</span>
                        </div>
                    )}
                <Button onClick={handleAdd} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף עמדה חדשה
                </Button>
                </div>
            </div>

            <div className="border rounded-lg">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar">
                    <div className="[direction:rtl]">
                        <Table>
                            <TableHeader className="sticky top-0 z-20 bg-background">
                                <TableRow className="bg-[hsl(228_36%_95%)]">
                                    <TableHead className="h-12 w-12 bg-[hsl(228_36%_95%)]"></TableHead>
                                    <TableHead className="h-12 px-2 text-right align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">שם העמדה</TableHead>
                                    <TableHead className="h-12 px-2 text-right align-middle font-medium text-primary font-semibold w-24 bg-[hsl(228_36%_95%)]">פעילה</TableHead>
                                    <TableHead className="h-12 px-2 text-right align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">מרווח תורים (דקות)</TableHead>
                                    <TableHead className="h-12 px-2 text-right align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">תיאור שעות פעילות</TableHead>
                                    <TableHead className="h-12 px-2 text-right align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">הגבלת סוגי לקוחות</TableHead>
                                    <TableHead className="h-12 px-2 text-right align-middle font-medium text-primary font-semibold w-32 bg-[hsl(228_36%_95%)]">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <DndContext sensors={stationDragSensors} onDragEnd={handleStationOrderEnd}>
                                <SortableContext items={orderedStations.slice((currentPage - 1) * ITEMS_PER_PAGE, Math.min(stations.length, currentPage * ITEMS_PER_PAGE)).map((station) => station.id)} strategy={verticalListSortingStrategy}>
                                    <TableBody>
                                        {(() => {
                                            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
                                            const endIndex = startIndex + ITEMS_PER_PAGE
                                            const paginatedStations = orderedStations.slice(startIndex, endIndex)

                                            if (stations.length === 0) {
                                                return (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                            אין עמדות במערכת. הוסף עמדה חדשה כדי להתחיל.
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            }

                                            return (
                                                <>
                                                    {paginatedStations.map((station) => (
                                                        <SortableStationRow
                                                            key={station.id}
                                                            station={station}
                                                            hasWorkingHours={!!(stationWorkingHours[station.id] && stationWorkingHours[station.id].length > 0)}
                                                            allowedTypes={stationAllowedCustomerTypes[station.id] || []}
                                                            description={getStationDescription(station.id)}
                                                            slotIntervalMinutes={station.slot_interval_minutes ?? 60}
                                                            onToggleActive={handleToggleActive}
                                                            onView={handleView}
                                                            onEdit={handleEdit}
                                                            onDuplicate={handleDuplicate}
                                                            onDelete={handleDeleteStation}
                                                        />
                                                    ))}
                                                </>
                                            )
                                        })()}
                                    </TableBody>
                                </SortableContext>
                            </DndContext>
                        </Table>
                    </div>
                </div>

                {/* Pagination */}
                {
                    orderedStations.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600">
                                מציג {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, orderedStations.length)} מתוך {orderedStations.length} עמדות
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-1"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                    הקודם
                                </Button>
                                <span className="text-sm text-gray-600">
                                    עמוד {currentPage} מתוך {Math.ceil(orderedStations.length / ITEMS_PER_PAGE)}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(orderedStations.length / ITEMS_PER_PAGE), p + 1))}
                                    disabled={currentPage >= Math.ceil(orderedStations.length / ITEMS_PER_PAGE)}
                                    className="flex items-center gap-1"
                                >
                                    הבא
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Station Add/Edit Dialog */}
            <StationEditDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                station={editingStation}
                onSaved={handleDialogSaved}
            />

            {/* Station View Dialog (Read-only) */}
            <Dialog
                open={isViewDialogOpen}
                onOpenChange={(open) => {
                    setIsViewDialogOpen(open)
                    if (!open) {
                        setViewingAllowedCustomerTypes([])
                    }
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">פרטי עמדה: {viewingStation?.name}</DialogTitle>
                        <DialogDescription className="text-right">צפייה בפרטי העמדה ושעות העבודה</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>שם העמדה</Label>
                                <div className="text-gray-900 font-medium">{formData.name}</div>
                            </div>
                            <div className="space-y-2">
                                <Label>סטטוס</Label>
                                <div className="text-gray-900">
                                    {formData.is_active ? "פעילה" : "מושבתת"}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>מרווח תורים (בדקות)</Label>
                                <div className="text-gray-900 font-medium">
                                    {formData.slot_interval_minutes} דקות
                                </div>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>סוגי לקוחות מורשים</Label>
                                {viewingAllowedCustomerTypes.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 justify-start">
                                        {viewingAllowedCustomerTypes.map((type) => (
                                            <Badge
                                                key={type.id}
                                                variant="outline"
                                                className="bg-primary/5 border-primary/20 text-primary"
                                            >
                                                {type.name}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        כל הלקוחות יכולים להזמין תורים לעמדה זו.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Working Hours Section (Read-only) */}
                        <div className="space-y-4 border-t pt-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">שעות עבודה</h3>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right w-32">יום בשבוע</TableHead>
                                            <TableHead className="text-right">משמרות</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dayShifts.map((dayShift) => {
                                            const dayLabel = WEEKDAYS.find((d) => d.value === dayShift.weekday)?.label || dayShift.weekday
                                            const hasShifts = dayShift.shifts.length > 0

                                            return (
                                                <TableRow key={dayShift.weekday}>
                                                    <TableCell className="font-medium align-top pt-4">
                                                        {dayLabel}
                                                    </TableCell>
                                                    <TableCell>
                                                        {hasShifts ? (
                                                            <div className="space-y-2">
                                                                {dayShift.shifts.map((shift, shiftIndex) => (
                                                                    <div
                                                                        key={shiftIndex}
                                                                        className="flex items-center gap-3 p-2 border border-gray-200 rounded bg-gray-50 text-sm"
                                                                    >
                                                                        <span className="text-gray-600">
                                                                            {shift.open_time.substring(0, 5)} - {shift.close_time.substring(0, 5)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-400 text-sm py-2">
                                                                אין שעות עבודה עבור יום זה
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-start gap-2">
                        <Button onClick={() => {
                            setIsViewDialogOpen(false)
                            if (viewingStation) {
                                setTimeout(() => handleEdit(viewingStation), 100)
                            }
                        }}>
                            <Pencil className="h-4 w-4 ml-2" />
                            ערוך
                        </Button>
                        <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                            סגור
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unavailability Dialog */}
            <StationUnavailabilityDialog
                open={isUnavailabilityDialogOpen}
                onOpenChange={setIsUnavailabilityDialogOpen}
                stationName={selectedStationForUnavailability?.name}
                formData={unavailabilityFormData}
                onFormChange={(updates) =>
                    setUnavailabilityFormData((prev) => ({
                        ...prev,
                        ...updates,
                    }))
                }
                onSave={handleSaveUnavailability}
                isSaving={isSaving}
            />

            {/* Duplicate Station Dialog */}
            <DuplicateStationDialog
                open={isDuplicateDialogOpen}
                onOpenChange={setIsDuplicateDialogOpen}
                station={stationToDuplicate}
                stations={stations}
                onConfirm={confirmDuplicateStation}
                isDuplicating={isDuplicating}
            />

            {/* Delete Station Dialog */}
            <DeleteStationDialog
                deleteConfirmOpen={isDeleteConfirmOpen}
                onDeleteConfirmChange={setIsDeleteConfirmOpen}
                transferDialogOpen={isTransferDialogOpen}
                onTransferDialogChange={setIsTransferDialogOpen}
                station={stationToDelete}
                stations={stations}
                onConfirmDelete={confirmDeleteStation}
                onTransferAndDelete={handleTransferAndDelete}
            />
        </div >
    )
}
