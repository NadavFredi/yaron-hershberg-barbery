import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, RefreshCw, Search, X, Check, ChevronLeft, ChevronRight, Settings, CheckSquare, Square, Plus, MoreVertical, Copy, Trash2, GripVertical, ChevronDown, ChevronUp, Globe, ShieldCheck, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { DuplicateStationDialog } from "../../dialogs/settings/stations/DuplicateStationDialog"
import { DeleteStationDialog } from "../../dialogs/settings/stations/DeleteStationDialog"
import { DuplicateTreatmentTypeDialog } from "../../dialogs/settings/treatment-types/DuplicateTreatmentTypeDialog"
import { DeleteTreatmentTypeDialog } from "../../dialogs/settings/treatment-types/DeleteTreatmentTypeDialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Option {
    id: string
    name: string
}

interface MultiSelectDropdownProps {
    options: Option[]
    selectedIds: string[]
    onSelectionChange: (selectedIds: string[]) => void
    placeholder?: string
    className?: string
}

function MultiSelectDropdown({
    options,
    selectedIds,
    onSelectionChange,
    placeholder = "בחר...",
    className
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState<string | undefined>(undefined)
    const anchorRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleToggle = (optionId: string) => {
        if (selectedIds.includes(optionId)) {
            onSelectionChange(selectedIds.filter(id => id !== optionId))
        } else {
            onSelectionChange([...selectedIds, optionId])
        }
    }

    const selectedOptions = options.filter(opt => selectedIds.includes(opt.id))
    const filteredOptions = options.filter(opt => {
        if (!searchValue || searchValue === "") return true
        return opt.name.toLowerCase().includes(searchValue.toLowerCase())
    })

    const showBadges = selectedOptions.length > 0 && (searchValue === undefined || searchValue === "")

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div
                    ref={anchorRef}
                    className={cn(
                        "relative flex-1 min-h-8 border border-input bg-background rounded-md",
                        "flex flex-wrap items-center gap-1 px-2 py-1.5 text-sm",
                        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                        "w-full min-w-0",
                        className
                    )}
                    onClick={() => {
                        inputRef.current?.focus()
                        if (!open) {
                            setOpen(true)
                        }
                    }}
                    dir="rtl"
                >
                    {showBadges ? (
                        <>
                            {selectedOptions.map((option) => (
                                <Badge
                                    key={option.id}
                                    variant="secondary"
                                    className="text-xs h-6 px-2 flex items-center gap-1"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggle(option.id)
                                    }}
                                >
                                    <span>{option.name}</span>
                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" />
                                </Badge>
                            ))}
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchValue || ""}
                                onChange={(e) => {
                                    setSearchValue(e.target.value)
                                    if (!open) {
                                        setOpen(true)
                                    }
                                }}
                                onFocus={() => {
                                    if (searchValue === undefined) {
                                        setSearchValue("")
                                    }
                                    if (!open) {
                                        setOpen(true)
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Backspace" && searchValue === "") {
                                        if (selectedOptions.length > 0) {
                                            const lastOption = selectedOptions[selectedOptions.length - 1]
                                            handleToggle(lastOption.id)
                                        }
                                    }
                                }}
                                placeholder={selectedOptions.length === 0 ? placeholder : ""}
                                className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-right"
                                dir="rtl"
                            />
                        </>
                    ) : (
                        <Input
                            ref={inputRef}
                            value={searchValue || ""}
                            onChange={(e) => {
                                setSearchValue(e.target.value)
                                if (!open) {
                                    setOpen(true)
                                }
                            }}
                            onFocus={() => {
                                if (searchValue === undefined) {
                                    setSearchValue("")
                                }
                                if (!open) {
                                    setOpen(true)
                                }
                            }}
                            placeholder={placeholder}
                            dir="rtl"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto px-0 text-right"
                        />
                    )}
                    <button
                        type="button"
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-500 flex-shrink-0"
                        onMouseDown={(event) => {
                            event.preventDefault()
                            const nextOpen = !open
                            setOpen(nextOpen)
                            if (nextOpen && searchValue === undefined) {
                                setSearchValue("")
                            } else if (!nextOpen) {
                                setSearchValue(undefined)
                            }
                        }}
                    >
                        <ChevronDown className="h-4 w-4" />
                    </button>
                    {selectedOptions.length > 0 && (
                        <button
                            type="button"
                            className="absolute left-10 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                            onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                onSelectionChange([])
                            }}
                            title="נקה את כל הבחירות"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                dir="rtl"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onEscapeKeyDown={() => {
                    setOpen(false)
                    setSearchValue(undefined)
                }}
                onInteractOutside={(event) => {
                    if (anchorRef.current?.contains(event.target as Node)) {
                        event.preventDefault()
                        return
                    }
                    setOpen(false)
                    setSearchValue(undefined)
                }}
            >
                <div className="max-h-[300px] overflow-y-auto">
                    {selectedOptions.length > 0 && (
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
                            נבחרו: {selectedOptions.map(opt => opt.name).join(", ")}
                        </div>
                    )}
                    <div className="p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => handleToggle(option.id)}
                                    className="flex items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                >
                                    <Check
                                        className={cn(
                                            "ml-2 h-4 w-4 shrink-0",
                                            selectedIds.includes(option.id) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span>{option.name}</span>
                                </div>
                            ))
                        ) : (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                לא נמצאו תוצאות.
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface TreatmentType {
    id: string
    name: string
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
    hourly_price?: number | null
    notes?: string | null
}

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface ServiceStationMatrix {
    service_id: string
    station_id: string
    base_time_minutes: number
}

interface TreatmentTypeModifier {
    service_id: string
    treatment_type_id: string
    time_modifier_minutes: number
}

interface MatrixCell {
    supported: boolean
    defaultTime?: number
    stationTime?: number
    remote_booking_allowed?: boolean
    is_approval_needed?: boolean
}

const STATIONS_PER_VIEW = 4

interface SortableStationItemProps {
    station: Station
    isSelected: boolean
    order: number
    onToggle: (stationId: string) => void
}

function SortableStationItem({ station, isSelected, order, onToggle }: SortableStationItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: station.id,
        disabled: !isSelected,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 p-2 border rounded bg-white"
        >
            {isSelected && (
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
            )}
            <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(station.id)}
                className="scale-125"
            />
            <span className="flex-1 font-medium">{station.name}</span>
            {isSelected && (
                <span className="text-xs text-gray-500 w-8 text-center">{order}</span>
            )}
        </div>
    )
}

export function SettingsTreatmentTypeStationMatrixSection() {
    const { toast } = useToast()
    const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([])
    const [filteredTreatmentTypes, setFilteredTreatmentTypes] = useState<TreatmentType[]>([])
    const [allStations, setAllStations] = useState<Station[]>([])
    const [visibleStations, setVisibleStations] = useState<Station[]>([])
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    const [stationPage, setStationPage] = useState(0)
    const [searchTerm, setSearchTerm] = useState("")
    const [typeFilterIds, setTypeFilterIds] = useState<string[]>([])
    const [categoryFilterIds, setCategoryFilterIds] = useState<string[]>([])
    const [groomingServiceId, setGroomingServiceId] = useState<string | null>(null)
    const [matrix, setMatrix] = useState<Record<string, Record<string, MatrixCell>>>({})
    const [initialMatrix, setInitialMatrix] = useState<Record<string, Record<string, MatrixCell>>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isStationDialogOpen, setIsStationDialogOpen] = useState(false)
    const [isAddStationDialogOpen, setIsAddStationDialogOpen] = useState(false)
    const [isAddTreatmentTypeDialogOpen, setIsAddTreatmentTypeDialogOpen] = useState(false)
    const [newStationName, setNewStationName] = useState("")
    const [newTreatmentTypeName, setNewTreatmentTypeName] = useState("")
    const [isAddingStation, setIsAddingStation] = useState(false)
    const [isAddingTreatmentType, setIsAddingTreatmentType] = useState(false)
    const [stationToDelete, setStationToDelete] = useState<Station | null>(null)
    const [stationToDuplicate, setStationToDuplicate] = useState<Station | null>(null)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [isDuplicateConfirmOpen, setIsDuplicateConfirmOpen] = useState(false)
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
    const [treatmentTypeToDuplicate, setTreatmentTypeToDuplicate] = useState<TreatmentType | null>(null)
    const [isDuplicateTreatmentTypeDialogOpen, setIsDuplicateTreatmentTypeDialogOpen] = useState(false)
    const [isDuplicatingTreatmentType, setIsDuplicatingTreatmentType] = useState(false)
    const [treatmentTypeToDelete, setTreatmentTypeToDelete] = useState<TreatmentType | null>(null)
    const [isDeleteTreatmentTypeDialogOpen, setIsDeleteTreatmentTypeDialogOpen] = useState(false)
    const [isDeletingTreatmentType, setIsDeletingTreatmentType] = useState(false)
    const [isTypingDuration, setIsTypingDuration] = useState<Record<string, Record<string, boolean>>>({})
    const [durationInputValues, setDurationInputValues] = useState<Record<string, Record<string, string>>>({})
    const [isTypingDefault, setIsTypingDefault] = useState<Record<string, boolean>>({})
    const [defaultDurationInputValues, setDefaultDurationInputValues] = useState<Record<string, string>>({})
    const [expandedTreatmentTypeId, setExpandedTreatmentTypeId] = useState<string | null>(null)
    const [editedTreatmentTypePrices, setEditedTreatmentTypePrices] = useState<Record<string, { size_class?: string | null; min_groom_price?: number | null; max_groom_price?: number | null; hourly_price?: number | null; notes?: string | null }>>({})
    const [treatmentCategories, setTreatmentCategories] = useState<Array<{ id: string; name: string }>>([])
    const [treatmentTypeTypesMap, setTreatmentTypeTypesMap] = useState<Record<string, string[]>>({})
    const [treatmentTypeCategoriesMap, setTreatmentTypeCategoriesMap] = useState<Record<string, string[]>>({})
    const [editedTypesMap, setEditedTypesMap] = useState<Record<string, string[]>>({})
    const [editedCategoriesMap, setEditedCategoriesMap] = useState<Record<string, string[]>>({})
    const [savingTreatmentTypeId, setSavingTreatmentTypeId] = useState<string | null>(null)
    const [savingTreatmentTypeRowId, setSavingTreatmentTypeRowId] = useState<string | null>(null)
    const [togglingRemoteBooking, setTogglingRemoteBooking] = useState<Record<string, Record<string, boolean>>>({})
    const [togglingApproval, setTogglingApproval] = useState<Record<string, Record<string, boolean>>>({})

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

    useEffect(() => {
        loadData()
    }, [])

    // Filter treatmentTypes by search term and categories
    useEffect(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        const filtered = treatmentTypes.filter((treatmentType) => {
            if (normalizedSearch && !treatmentType.name.toLowerCase().includes(normalizedSearch)) {
                return false
            }

            if (typeFilterIds.length > 0) {
                const treatmentTypeTypes = editedTypesMap[treatmentType.id] ?? treatmentTypeTypesMap[treatmentType.id] ?? []
                const matchesType = treatmentTypeTypes.some((typeId) => typeFilterIds.includes(typeId))
                if (!matchesType) {
                    return false
                }
            }

            if (categoryFilterIds.length > 0) {
                const treatmentTypeCategories = editedCategoriesMap[treatmentType.id] ?? treatmentTypeCategoriesMap[treatmentType.id] ?? []
                const matchesCategory = treatmentTypeCategories.some((categoryId) => categoryFilterIds.includes(categoryId))
                if (!matchesCategory) {
                    return false
                }
            }

            return true
        })

        setFilteredTreatmentTypes(filtered)
    }, [
        treatmentTypes,
        searchTerm,
        typeFilterIds,
        categoryFilterIds,
        treatmentTypeTypesMap,
        treatmentTypeCategoriesMap,
        editedTypesMap,
        editedCategoriesMap,
    ])

    // Update visible stations with pagination (no rotation, stops at end)
    useEffect(() => {
        const selected = allStations.filter((s) => selectedStationIds.includes(s.id))
        if (selected.length === 0) {
            setVisibleStations([])
            return
        }
        // Simple pagination: start from stationPage index, show STATIONS_PER_VIEW stations
        const startIdx = stationPage
        const endIdx = Math.min(startIdx + STATIONS_PER_VIEW, selected.length)
        const paginated = selected.slice(startIdx, endIdx)
        setVisibleStations(paginated)
    }, [allStations, selectedStationIds, stationPage])

    const cloneTreatmentTypeMatrix = (treatmentTypeMatrix: Record<string, MatrixCell> = {}) => {
        const cloned: Record<string, MatrixCell> = {}
        Object.entries(treatmentTypeMatrix).forEach(([stationId, cell]) => {
            cloned[stationId] = { ...cell }
        })
        return cloned
    }

    const cloneMatrixMap = (matrixMap: Record<string, Record<string, MatrixCell>>) => {
        const cloned: Record<string, Record<string, MatrixCell>> = {}
        Object.entries(matrixMap).forEach(([treatmentTypeId, treatmentTypeMatrix]) => {
            cloned[treatmentTypeId] = cloneTreatmentTypeMatrix(treatmentTypeMatrix)
        })
        return cloned
    }

    const treatmentTypeHasPriceChanges = (treatmentTypeId: string): boolean => {
        const editedPrices = editedTreatmentTypePrices[treatmentTypeId]
        const treatmentTypePrices = treatmentTypes.find((b) => b.id === treatmentTypeId)
        if (!editedPrices || !treatmentTypePrices) return false

        const pricesChanged = (
            editedPrices.size_class !== treatmentTypePrices.size_class ||
            editedPrices.min_groom_price !== treatmentTypePrices.min_groom_price ||
            editedPrices.max_groom_price !== treatmentTypePrices.max_groom_price ||
            editedPrices.hourly_price !== treatmentTypePrices.hourly_price ||
            editedPrices.notes !== treatmentTypePrices.notes
        )

        // Check types
        const editedTypes = editedTypesMap[treatmentTypeId] || []
        const originalTypes = treatmentTypeTypesMap[treatmentTypeId] || []
        const typesChanged = JSON.stringify([...editedTypes].sort()) !== JSON.stringify([...originalTypes].sort())

        // Check categories
        const editedCategories = editedCategoriesMap[treatmentTypeId] || []
        const originalCategories = treatmentTypeCategoriesMap[treatmentTypeId] || []
        const categoriesChanged = JSON.stringify([...editedCategories].sort()) !== JSON.stringify([...originalCategories].sort())

        return pricesChanged || typesChanged || categoriesChanged
    }

    const getTreatmentTypeTypes = (treatmentTypeId: string): string[] => {
        return editedTypesMap[treatmentTypeId] ?? treatmentTypeTypesMap[treatmentTypeId] ?? []
    }

    const getTreatmentTypeCategories = (treatmentTypeId: string): string[] => {
        return editedCategoriesMap[treatmentTypeId] ?? treatmentTypeCategoriesMap[treatmentTypeId] ?? []
    }

    const treatmentTypeHasMatrixChanges = (treatmentTypeId: string): boolean => {
        const current = matrix[treatmentTypeId]
        const initial = initialMatrix[treatmentTypeId]
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

    const loadData = async () => {
        setIsLoading(true)
        try {
            // Load treatmentTypes with prices, notes, and size_class
            const { data: treatmentTypesData, error: treatmentTypesError } = await supabase
                .from("treatmentTypes")
                .select("id, name, size_class, min_groom_price, max_groom_price, hourly_price, notes")
                .order("name")
            if (treatmentTypesError) throw treatmentTypesError

            // Load treatment types and categories
            const [typesResponse, categoriesResponse] = await Promise.all([
                supabase.from("treatment_types").select("id, name").order("name"),
                supabase.from("treatment_categories").select("id, name").order("name"),
            ])
            if (typesResponse.error) throw typesResponse.error
            if (categoriesResponse.error) throw categoriesResponse.error
            // Types map is handled via editedTypesMap; keep legacy fetch for compatibility if needed.
            setTreatmentCategories(categoriesResponse.data || [])

            // Load treatmentType_treatment_types and treatmentType_treatment_categories
            const treatmentTypeIds = (treatmentTypesData || []).map(b => b.id)
            const [treatmentTypeTypesResponse, treatmentTypeCategoriesResponse] = await Promise.all([
                treatmentTypeIds.length > 0
                    ? supabase.from("treatmentType_treatment_types").select("treatment_type_id, related_treatment_type_id").in("treatment_type_id", treatmentTypeIds)
                    : { data: [], error: null },
                treatmentTypeIds.length > 0
                    ? supabase.from("treatmentType_treatment_categories").select("treatment_type_id, treatment_category_id").in("treatment_type_id", treatmentTypeIds)
                    : { data: [], error: null },
            ])
            if (treatmentTypeTypesResponse.error) throw treatmentTypeTypesResponse.error
            if (treatmentTypeCategoriesResponse.error) throw treatmentTypeCategoriesResponse.error

            // Build maps: treatment_type_id -> array of type/category IDs
            const typesMap: Record<string, string[]> = {}
            const categoriesMap: Record<string, string[]> = {}
                ; (treatmentTypeTypesResponse.data || []).forEach((row: { treatment_type_id: string; related_treatment_type_id: string }) => {
                    if (!typesMap[row.treatment_type_id]) typesMap[row.treatment_type_id] = []
                    typesMap[row.treatment_type_id].push(row.related_treatment_type_id)
                })
                ; (treatmentTypeCategoriesResponse.data || []).forEach((row: { treatment_type_id: string; treatment_category_id: string }) => {
                    if (!categoriesMap[row.treatment_type_id]) categoriesMap[row.treatment_type_id] = []
                    categoriesMap[row.treatment_type_id].push(row.treatment_category_id)
                })
            setTreatmentTypeTypesMap(typesMap)
            setTreatmentTypeCategoriesMap(categoriesMap)

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

            // Categories map uses editedTypesMap; retain for compatibility.
            setAllStations(activeStations)

            // Initialize with all stations selected by default
            if (selectedStationIds.length === 0) {
                setSelectedStationIds(activeStations.map((s) => s.id))
            }

            setGroomingServiceId(serviceData?.id || null)

            // Load matrix data
            if (serviceData?.id) {
                await loadMatrixData(treatmentTypesData || [], activeStations)
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

    const loadMatrixData = async (treatmentTypesList: TreatmentType[], stationsList: Station[]) => {
        try {
            // Load station_treatmentType_rules for this service (using the same table as SettingsTreatmentTypesSection)
            const { data: rulesData, error: rulesError } = await supabase
                .from("station_treatmentType_rules")
                .select("*")
                .in("treatment_type_id", treatmentTypesList.map(b => b.id))
                .in("station_id", stationsList.map(s => s.id))

            if (rulesError) throw rulesError

            // Build matrix from station_treatmentType_rules
            const matrixMap: Record<string, Record<string, MatrixCell>> = {}

            treatmentTypesList.forEach((treatmentType) => {
                matrixMap[treatmentType.id] = {}

                // Get all rules for this treatmentType
                const treatmentTypeRules = rulesData?.filter(r => r.treatment_type_id === treatmentType.id) || []

                // Calculate default time as the most common duration_modifier_minutes value for active stations
                const activeRules = treatmentTypeRules.filter(r => r.is_active)
                const timeCounts: Record<number, number> = {}
                activeRules.forEach(rule => {
                    const time = rule.duration_modifier_minutes ?? 0
                    timeCounts[time] = (timeCounts[time] || 0) + 1
                })
                const defaultTime = Object.keys(timeCounts).length > 0
                    ? parseInt(Object.keys(timeCounts).reduce((a, b) => timeCounts[parseInt(a)] > timeCounts[parseInt(b)] ? a : b))
                    : 60 // Default to 60 if no rules exist

                stationsList.forEach((station) => {
                    const rule = treatmentTypeRules.find(r => r.station_id === station.id)
                    const supported = rule?.is_active ?? false
                    const stationTime = rule?.duration_modifier_minutes ?? 0
                    const remoteBooking = rule?.remote_booking_allowed ?? false
                    const approvalNeeded = rule?.requires_staff_approval ?? false

                    matrixMap[treatmentType.id][station.id] = {
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

    const handleToggleSupport = (treatmentTypeId: string, stationId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}
            const cell = newMatrix[treatmentTypeId][stationId] || { supported: false }
            const newSupported = !cell.supported

            // Get default time for this treatmentType (from other supported stations or undefined)
            const defaultTime = Object.values(newMatrix[treatmentTypeId] || {})
                .find((c) => c.supported && c.defaultTime !== undefined)?.defaultTime

            newMatrix[treatmentTypeId][stationId] = {
                ...cell,
                supported: newSupported,
                defaultTime: defaultTime || 60, // Default to 60 minutes if no default set
                stationTime: newSupported ? defaultTime || 60 : undefined,
                remote_booking_allowed: newSupported ? (cell.remote_booking_allowed ?? false) : false,
                is_approval_needed: newSupported ? (cell.is_approval_needed ?? false) : false,
            }

            return newMatrix
        })
    }

    const handleDefaultTimeChange = (treatmentTypeId: string, value: string) => {
        const time = value ? parseInt(value) : undefined
        if (!time || time < 0) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            // Update default time for all supported stations
            Object.keys(newMatrix[treatmentTypeId]).forEach((stationId) => {
                const cell = newMatrix[treatmentTypeId][stationId]
                if (cell.supported) {
                    newMatrix[treatmentTypeId][stationId] = {
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

    const handleStationTimeChange = (treatmentTypeId: string, stationId: string, value: string) => {
        const time = value ? parseInt(value) : undefined
        if (!time || time < 0) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}
            const cell = newMatrix[treatmentTypeId][stationId] || { supported: false }

            newMatrix[treatmentTypeId][stationId] = {
                ...cell,
                stationTime: time,
            }

            return newMatrix
        })
    }

    const handleApplyDefaultToAll = (treatmentTypeId: string) => {
        const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId)
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
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            // Apply default time to all supported stations
            Object.keys(newMatrix[treatmentTypeId]).forEach((stationId) => {
                const cell = newMatrix[treatmentTypeId][stationId]
                if (cell.supported) {
                    newMatrix[treatmentTypeId][stationId] = {
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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over || active.id === over.id) return

        setSelectedStationIds((items) => {
            const oldIndex = items.indexOf(active.id as string)
            const newIndex = items.indexOf(over.id as string)

            if (oldIndex === -1 || newIndex === -1) return items

            const newItems = [...items]
            newItems.splice(oldIndex, 1)
            newItems.splice(newIndex, 0, active.id as string)

            return newItems
        })
    }

    const handleTurnOnAllStations = (treatmentTypeId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            visibleStations.forEach((station) => {
                const cell = newMatrix[treatmentTypeId][station.id] || { supported: false }
                const defaultTime = cell.defaultTime || getDefaultTimeForTreatmentType(treatmentTypeId) || 60

                newMatrix[treatmentTypeId][station.id] = {
                    supported: true,
                    defaultTime: defaultTime,
                    stationTime: cell.stationTime || defaultTime,
                }
            })

            return newMatrix
        })
    }

    const handleTurnOffAllStations = (treatmentTypeId: string) => {
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) return newMatrix

            visibleStations.forEach((station) => {
                if (newMatrix[treatmentTypeId][station.id]) {
                    newMatrix[treatmentTypeId][station.id] = {
                        ...newMatrix[treatmentTypeId][station.id],
                        supported: false,
                        remote_booking_allowed: false,
                        is_approval_needed: false,
                    }
                }
            })

            return newMatrix
        })
    }

    const handleMarkAllRemoteBooking = async (treatmentTypeId: string) => {
        if (!groomingServiceId) return

        const treatmentTypeCells = matrix[treatmentTypeId] || {}
        const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            visibleStations.forEach((station) => {
                const cell = newMatrix[treatmentTypeId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[treatmentTypeId][station.id] = {
                        ...cell,
                        remote_booking_allowed: true,
                    }
                }
            })

            return newMatrix
        })

        try {
            // Update all supported stations for this treatmentType
            const updates = visibleStations
                .filter((station) => treatmentTypeCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    treatment_type_id: treatmentTypeId,
                    is_active: true,
                    remote_booking_allowed: true,
                    duration_modifier_minutes: treatmentTypeCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_treatmentType_rules")
                    .upsert(updates, {
                        onConflict: "station_id,treatment_type_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousTreatmentType = { ...(prev[treatmentTypeId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousTreatmentType[stationId]
                        const currentCell = matrix[treatmentTypeId]?.[stationId]

                        previousTreatmentType[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            remote_booking_allowed: true,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[treatmentTypeId] = previousTreatmentType
                    return next
                })
            }

            toast({
                title: "הצלחה",
                description: "כל העמדות הפעילות עודכנו לתמיכה בתור מרחוק",
            })
        } catch (error: unknown) {
            console.error("Error marking all remote booking:", error)
            // Reload to revert
            if (groomingServiceId) {
                await loadMatrixData(treatmentTypes, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את תור מרחוק"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleMarkAllNoRemoteBooking = async (treatmentTypeId: string) => {
        if (!groomingServiceId) return

        const treatmentTypeCells = matrix[treatmentTypeId] || {}
        const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            visibleStations.forEach((station) => {
                const cell = newMatrix[treatmentTypeId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[treatmentTypeId][station.id] = {
                        ...cell,
                        remote_booking_allowed: false,
                    }
                }
            })

            return newMatrix
        })

        try {
            // Update all supported stations for this treatmentType
            const updates = visibleStations
                .filter((station) => treatmentTypeCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    treatment_type_id: treatmentTypeId,
                    is_active: true,
                    remote_booking_allowed: false,
                    duration_modifier_minutes: treatmentTypeCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_treatmentType_rules")
                    .upsert(updates, {
                        onConflict: "station_id,treatment_type_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousTreatmentType = { ...(prev[treatmentTypeId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousTreatmentType[stationId]
                        const currentCell = matrix[treatmentTypeId]?.[stationId]

                        previousTreatmentType[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            remote_booking_allowed: false,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[treatmentTypeId] = previousTreatmentType
                    return next
                })
            }

            toast({
                title: "הצלחה",
                description: "כל העמדות הפעילות עודכנו ללא תמיכה בתור מרחוק",
            })
        } catch (error: unknown) {
            console.error("Error marking all no remote booking:", error)
            // Reload to revert
            if (groomingServiceId) {
                await loadMatrixData(treatmentTypes, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את תור מרחוק"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleMarkAllApprovalNeeded = async (treatmentTypeId: string) => {
        if (!groomingServiceId) return

        const treatmentTypeCells = matrix[treatmentTypeId] || {}
        const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            visibleStations.forEach((station) => {
                const cell = newMatrix[treatmentTypeId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[treatmentTypeId][station.id] = {
                        ...cell,
                        is_approval_needed: true,
                    }
                }
            })

            return newMatrix
        })

        try {
            // Update all supported stations for this treatmentType
            const updates = visibleStations
                .filter((station) => treatmentTypeCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    treatment_type_id: treatmentTypeId,
                    is_active: true,
                    requires_staff_approval: true,
                    remote_booking_allowed: treatmentTypeCells[station.id]?.remote_booking_allowed ?? false,
                    duration_modifier_minutes: treatmentTypeCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_treatmentType_rules")
                    .upsert(updates, {
                        onConflict: "station_id,treatment_type_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousTreatmentType = { ...(prev[treatmentTypeId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousTreatmentType[stationId]
                        const currentCell = matrix[treatmentTypeId]?.[stationId]

                        previousTreatmentType[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            is_approval_needed: true,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[treatmentTypeId] = previousTreatmentType
                    return next
                })
            }

            toast({
                title: "הצלחה",
                description: "כל העמדות הפעילות עודכנו כנדרשות אישור",
            })
        } catch (error: unknown) {
            console.error("Error marking all approval needed:", error)
            // Reload to revert
            if (groomingServiceId) {
                await loadMatrixData(treatmentTypes, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את אישור הצוות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleMarkAllNoApprovalNeeded = async (treatmentTypeId: string) => {
        if (!groomingServiceId) return

        const treatmentTypeCells = matrix[treatmentTypeId] || {}
        const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}

            visibleStations.forEach((station) => {
                const cell = newMatrix[treatmentTypeId][station.id] || { supported: false }
                if (cell.supported) {
                    newMatrix[treatmentTypeId][station.id] = {
                        ...cell,
                        is_approval_needed: false,
                    }
                }
            })

            return newMatrix
        })

        try {
            // Update all supported stations for this treatmentType
            const updates = visibleStations
                .filter((station) => treatmentTypeCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    treatment_type_id: treatmentTypeId,
                    is_active: true,
                    requires_staff_approval: false,
                    remote_booking_allowed: treatmentTypeCells[station.id]?.remote_booking_allowed ?? false,
                    duration_modifier_minutes: treatmentTypeCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_treatmentType_rules")
                    .upsert(updates, {
                        onConflict: "station_id,treatment_type_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousTreatmentType = { ...(prev[treatmentTypeId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousTreatmentType[stationId]
                        const currentCell = matrix[treatmentTypeId]?.[stationId]

                        previousTreatmentType[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            is_approval_needed: false,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[treatmentTypeId] = previousTreatmentType
                    return next
                })
            }

            toast({
                title: "הצלחה",
                description: "כל העמדות הפעילות עודכנו ללא דרישת אישור",
            })
        } catch (error: unknown) {
            console.error("Error marking all no approval needed:", error)
            // Reload to revert
            if (groomingServiceId) {
                await loadMatrixData(treatmentTypes, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את אישור הצוות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleAddTreatmentType = async () => {
        if (!newTreatmentTypeName.trim()) {
            toast({
                title: "שגיאה",
                description: "שם הגזע נדרש",
                variant: "destructive",
            })
            return
        }

        setIsAddingTreatmentType(true)
        try {
            console.log("[SettingsTreatmentTypeStationMatrixSection] Creating treatmentType:", newTreatmentTypeName.trim())

            const { data: newTreatmentType, error } = await supabase
                .from("treatmentTypes")
                .insert({ name: newTreatmentTypeName.trim() })
                .select("id, name, min_groom_price, max_groom_price, hourly_price, notes")
                .single()

            if (error) {
                console.error("[SettingsTreatmentTypeStationMatrixSection] Error creating treatmentType:", error)
                throw error
            }

            console.log("[SettingsTreatmentTypeStationMatrixSection] TreatmentType created successfully:", newTreatmentType)

            toast({
                title: "הצלחה",
                description: "הגזע נוסף בהצלחה",
            })

            setNewTreatmentTypeName("")
            setIsAddTreatmentTypeDialogOpen(false)

            // Add the new treatmentType to the current list and reload matrix data
            if (newTreatmentType) {
                const updatedTreatmentTypes = [...treatmentTypes, newTreatmentType].sort((a, b) => a.name.localeCompare(b.name))
                setTreatmentTypes(updatedTreatmentTypes)

                // Initialize matrix for new treatmentType
                if (groomingServiceId) {
                    await loadMatrixData(updatedTreatmentTypes, allStations)
                }
            }
        } catch (error: unknown) {
            console.error("[SettingsTreatmentTypeStationMatrixSection] Error adding treatmentType:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן להוסיף את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsAddingTreatmentType(false)
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

                // Add to selected stations by default
                if (newStation && !selectedStationIds.includes(newStation.id)) {
                    setSelectedStationIds([...selectedStationIds, newStation.id])
                }

                // Reload matrix data with new station
                if (groomingServiceId) {
                    await loadMatrixData(treatmentTypes, activeStations)
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
            // Save all station_treatmentType_rules (using the same table as SettingsTreatmentTypesSection)
            const rulesToUpsert: Array<{
                station_id: string
                treatment_type_id: string
                is_active: boolean
                remote_booking_allowed: boolean
                requires_staff_approval: boolean
                duration_modifier_minutes: number
            }> = []

            for (const treatmentType of treatmentTypes) {
                const treatmentTypeCells = matrix[treatmentType.id] || {}

                // Get default time for this treatmentType
                const defaultTime = getDefaultTimeForTreatmentType(treatmentType.id) ?? 60

                // Process all stations for this treatmentType
                for (const [stationId, cell] of Object.entries(treatmentTypeCells)) {
                    const isActive = cell?.supported ?? false
                    const stationTime = cell?.stationTime ?? defaultTime

                    // Create or update station_treatmentType_rule
                    // Note: We preserve existing remote_booking_allowed and is_approval_needed if rule exists, otherwise default to false
                    rulesToUpsert.push({
                        station_id: stationId,
                        treatment_type_id: treatmentType.id,
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
                    .from("station_treatmentType_rules")
                    .upsert(rulesToUpsert, {
                        onConflict: "station_id,treatment_type_id",
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

    const getDefaultTimeForTreatmentType = (treatmentTypeId: string): number | undefined => {
        const treatmentTypeCells = matrix[treatmentTypeId] || {}
        const firstSupported = Object.values(treatmentTypeCells).find((cell) => cell.supported)
        return firstSupported?.defaultTime
    }

    // Calculate treatmentType status: 'none', 'some', 'all'
    // Based on all stations (not just visible ones)
    const getTreatmentTypeStatus = (treatmentTypeId: string): 'none' | 'some' | 'all' => {
        const treatmentTypeCells = matrix[treatmentTypeId] || {}
        // Count across all stations in the matrix (allStations)
        const allStationIds = allStations.map(s => s.id)
        const enabledStations = allStationIds.filter(stationId => treatmentTypeCells[stationId]?.supported).length
        const totalStations = allStationIds.length

        if (totalStations === 0) return 'none'
        if (enabledStations === 0) return 'none'
        if (enabledStations === totalStations) return 'all'
        return 'some'
    }

    const toggleTreatmentTypeExpand = (treatmentTypeId: string) => {
        setExpandedTreatmentTypeId((prev) => (prev === treatmentTypeId ? null : treatmentTypeId))
        // Initialize edited prices, size, types, and categories if not already set
        if (!editedTreatmentTypePrices[treatmentTypeId]) {
            const treatmentType = treatmentTypes.find((b) => b.id === treatmentTypeId)
            if (treatmentType) {
                setEditedTreatmentTypePrices((prev) => ({
                    ...prev,
                    [treatmentTypeId]: {
                        size_class: treatmentType.size_class,
                        min_groom_price: treatmentType.min_groom_price,
                        max_groom_price: treatmentType.max_groom_price,
                        hourly_price: treatmentType.hourly_price,
                        notes: treatmentType.notes,
                    },
                }))
            }
        }
        // Initialize edited types and categories
        if (!editedTypesMap[treatmentTypeId]) {
            setEditedTypesMap((prev) => ({
                ...prev,
                [treatmentTypeId]: treatmentTypeTypesMap[treatmentTypeId] || [],
            }))
        }
        if (!editedCategoriesMap[treatmentTypeId]) {
            setEditedCategoriesMap((prev) => ({
                ...prev,
                [treatmentTypeId]: treatmentTypeCategoriesMap[treatmentTypeId] || [],
            }))
        }
    }

    const handlePriceChange = (treatmentTypeId: string, field: 'size_class' | 'min_groom_price' | 'max_groom_price' | 'hourly_price', value: string) => {
        setEditedTreatmentTypePrices((prev) => ({
            ...prev,
            [treatmentTypeId]: {
                ...(prev[treatmentTypeId] || {}),
                [field]: field === 'size_class' ? (value === "__none__" ? null : value) : (value ? parseFloat(value) : null),
            },
        }))
    }

    const handleTypesChange = (treatmentTypeId: string, selectedIds: string[]) => {
        setEditedTypesMap((prev) => ({
            ...prev,
            [treatmentTypeId]: selectedIds,
        }))
    }

    const handleCategoriesChange = (treatmentTypeId: string, selectedIds: string[]) => {
        setEditedCategoriesMap((prev) => ({
            ...prev,
            [treatmentTypeId]: selectedIds,
        }))
    }

    const handleNotesChange = (treatmentTypeId: string, value: string) => {
        setEditedTreatmentTypePrices((prev) => ({
            ...prev,
            [treatmentTypeId]: {
                ...(prev[treatmentTypeId] || {}),
                notes: value || null,
            },
        }))
    }

    const handleSaveTreatmentTypePrices = async (treatmentTypeId: string) => {
        const editedPrices = editedTreatmentTypePrices[treatmentTypeId]
        if (!editedPrices) return

        setSavingTreatmentTypeId(treatmentTypeId)
        try {
            // Update treatmentType basic fields (size_class, prices, notes)
            const { error } = await supabase
                .from("treatmentTypes")
                .update({
                    size_class: editedPrices.size_class,
                    min_groom_price: editedPrices.min_groom_price,
                    max_groom_price: editedPrices.max_groom_price,
                    hourly_price: editedPrices.hourly_price,
                    notes: editedPrices.notes,
                })
                .eq("id", treatmentTypeId)

            if (error) throw error

            // Update treatmentType_treatment_types
            const editedTypes = editedTypesMap[treatmentTypeId] || []
            const originalTypes = treatmentTypeTypesMap[treatmentTypeId] || []

            // Delete removed types
            const typesToDelete = originalTypes.filter(id => !editedTypes.includes(id))
            if (typesToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("treatmentType_treatment_types")
                    .delete()
                    .eq("treatment_type_id", treatmentTypeId)
                    .in("related_treatment_type_id", typesToDelete)
                if (deleteError) throw deleteError
            }

            // Insert new types
            const typesToInsert = editedTypes.filter(id => !originalTypes.includes(id))
            if (typesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from("treatmentType_treatment_types")
                    .insert(typesToInsert.map((relatedId) => ({ treatment_type_id: treatmentTypeId, related_treatment_type_id: relatedId })))
                if (insertError) throw insertError
            }

            // Update treatmentType_treatment_categories
            const editedCategories = editedCategoriesMap[treatmentTypeId] || []
            const originalCategories = treatmentTypeCategoriesMap[treatmentTypeId] || []

            // Delete removed categories
            const categoriesToDelete = originalCategories.filter(id => !editedCategories.includes(id))
            if (categoriesToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("treatmentType_treatment_categories")
                    .delete()
                    .eq("treatment_type_id", treatmentTypeId)
                    .in("treatment_category_id", categoriesToDelete)
                if (deleteError) throw deleteError
            }

            // Insert new categories
            const categoriesToInsert = editedCategories.filter(id => !originalCategories.includes(id))
            if (categoriesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from("treatmentType_treatment_categories")
                    .insert(categoriesToInsert.map(treatment_category_id => ({ treatment_type_id: treatmentTypeId, treatment_category_id })))
                if (insertError) throw insertError
            }

            // Update local state
            setTreatmentTypes((prev) =>
                prev.map((treatmentType) =>
                    treatmentType.id === treatmentTypeId
                        ? {
                            ...treatmentType,
                            size_class: editedPrices.size_class,
                            min_groom_price: editedPrices.min_groom_price,
                            max_groom_price: editedPrices.max_groom_price,
                            hourly_price: editedPrices.hourly_price,
                            notes: editedPrices.notes,
                        }
                        : treatmentType
                )
            )

            // Update local maps
            setTreatmentTypeTypesMap((prev) => ({
                ...prev,
                [treatmentTypeId]: editedTypes,
            }))
            setTreatmentTypeCategoriesMap((prev) => ({
                ...prev,
                [treatmentTypeId]: editedCategories,
            }))

            toast({
                title: "הצלחה",
                description: "השינויים נשמרו בהצלחה",
            })
        } catch (error: unknown) {
            console.error("Error saving treatmentType data:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את השינויים"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingTreatmentTypeId(null)
        }
    }

    const handleCancelTreatmentTypePrices = (treatmentTypeId: string) => {
        const treatmentType = treatmentTypes.find((b) => b.id === treatmentTypeId)
        if (treatmentType) {
            setEditedTreatmentTypePrices((prev) => ({
                ...prev,
                [treatmentTypeId]: {
                    size_class: treatmentType.size_class,
                    min_groom_price: treatmentType.min_groom_price,
                    max_groom_price: treatmentType.max_groom_price,
                    hourly_price: treatmentType.hourly_price,
                    notes: treatmentType.notes,
                },
            }))
        }
        // Reset types and categories
        setEditedTypesMap((prev) => ({
            ...prev,
            [treatmentTypeId]: treatmentTypeTypesMap[treatmentTypeId] || [],
        }))
        setEditedCategoriesMap((prev) => ({
            ...prev,
            [treatmentTypeId]: treatmentTypeCategoriesMap[treatmentTypeId] || [],
        }))
    }

    const saveTreatmentTypePricesSilent = async (treatmentTypeId: string) => {
        const editedPrices = editedTreatmentTypePrices[treatmentTypeId]
        if (!editedPrices) return

        const { error } = await supabase
            .from("treatmentTypes")
            .update({
                min_groom_price: editedPrices.min_groom_price ?? null,
                max_groom_price: editedPrices.max_groom_price ?? null,
                hourly_price: editedPrices.hourly_price ?? null,
                notes: editedPrices.notes ?? null,
            })
            .eq("id", treatmentTypeId)

        if (error) throw error

        setTreatmentTypes((prev) =>
            prev.map((treatmentType) =>
                treatmentType.id === treatmentTypeId
                    ? {
                        ...treatmentType,
                        min_groom_price: editedPrices.min_groom_price ?? null,
                        max_groom_price: editedPrices.max_groom_price ?? null,
                        hourly_price: editedPrices.hourly_price ?? null,
                        notes: editedPrices.notes ?? null,
                    }
                    : treatmentType
            )
        )

        setEditedTreatmentTypePrices((prev) => ({
            ...prev,
            [treatmentTypeId]: {
                min_groom_price: editedPrices.min_groom_price ?? null,
                max_groom_price: editedPrices.max_groom_price ?? null,
                hourly_price: editedPrices.hourly_price ?? null,
                notes: editedPrices.notes ?? null,
            },
        }))
    }

    const handleSaveTreatmentTypeRow = async (treatmentTypeId: string) => {
        const matrixChanges = treatmentTypeHasMatrixChanges(treatmentTypeId)
        const priceChanges = treatmentTypeHasPriceChanges(treatmentTypeId)

        if (!matrixChanges && !priceChanges) return

        if (matrixChanges && !groomingServiceId) {
            toast({
                title: "שגיאה",
                description: "שירות טיפוח לא נמצא",
                variant: "destructive",
            })
            return
        }

        const treatmentType = treatmentTypes.find((b) => b.id === treatmentTypeId)
        const treatmentTypeName = treatmentType?.name ?? ""
        const matrixSnapshot = cloneTreatmentTypeMatrix(matrix[treatmentTypeId] || {})

        setSavingTreatmentTypeRowId(treatmentTypeId)
        if (priceChanges) {
            setSavingTreatmentTypeId(treatmentTypeId)
        }

        try {
            if (matrixChanges && groomingServiceId) {
                const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60
                const rulesToUpsert = Object.entries(matrixSnapshot).map(([stationId, cell]) => {
                    const isActive = cell?.supported ?? false

                    return {
                        station_id: stationId,
                        treatment_type_id: treatmentTypeId,
                        is_active: isActive,
                        remote_booking_allowed: isActive ? (cell?.remote_booking_allowed ?? false) : false,
                        duration_modifier_minutes: isActive ? (cell?.stationTime ?? defaultTime) : 0,
                    }
                })

                if (rulesToUpsert.length > 0) {
                    const { error } = await supabase
                        .from("station_treatmentType_rules")
                        .upsert(rulesToUpsert, {
                            onConflict: "station_id,treatment_type_id",
                        })

                    if (error) throw error
                }

                setInitialMatrix((prev) => ({
                    ...prev,
                    [treatmentTypeId]: cloneTreatmentTypeMatrix(matrixSnapshot),
                }))
            }

            if (priceChanges) {
                await saveTreatmentTypePricesSilent(treatmentTypeId)
            }

            toast({
                title: "הצלחה",
                description: `השינויים עבור ${treatmentTypeName || "הגזע"} נשמרו בהצלחה`,
            })
        } catch (error: unknown) {
            console.error("Error saving treatmentType row:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את השינויים לגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingTreatmentTypeRowId(null)
            if (priceChanges) {
                setSavingTreatmentTypeId(null)
            }
        }
    }

    const handleRevertTreatmentTypeRow = (treatmentTypeId: string) => {
        const initialTreatmentTypeMatrix = initialMatrix[treatmentTypeId]
        if (!initialTreatmentTypeMatrix) return

        setMatrix((prev) => ({
            ...prev,
            [treatmentTypeId]: cloneTreatmentTypeMatrix(initialTreatmentTypeMatrix),
        }))

        setDurationInputValues((prev) => {
            const updated = { ...prev }
            delete updated[treatmentTypeId]
            return updated
        })

        setIsTypingDuration((prev) => {
            const updated = { ...prev }
            delete updated[treatmentTypeId]
            return updated
        })

        setDefaultDurationInputValues((prev) => {
            const updated = { ...prev }
            delete updated[treatmentTypeId]
            return updated
        })

        setIsTypingDefault((prev) => {
            const updated = { ...prev }
            delete updated[treatmentTypeId]
            return updated
        })

        setTogglingRemoteBooking((prev) => {
            const updated = { ...prev }
            if (updated[treatmentTypeId]) {
                delete updated[treatmentTypeId]
            }
            return updated
        })

        handleCancelTreatmentTypePrices(treatmentTypeId)
    }

    const handleToggleRemoteBooking = async (treatmentTypeId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[treatmentTypeId]?.[stationId]
        if (!cell || !cell.supported) return

        const currentRemoteBooking = cell.remote_booking_allowed ?? false
        const newRemoteBooking = !currentRemoteBooking

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}
            const cell = newMatrix[treatmentTypeId][stationId] || { supported: false }
            newMatrix[treatmentTypeId][stationId] = {
                ...cell,
                remote_booking_allowed: newRemoteBooking,
            }
            return newMatrix
        })

        // Set loading state
        setTogglingRemoteBooking((prev) => ({
            ...prev,
            [treatmentTypeId]: {
                ...(prev[treatmentTypeId] || {}),
                [stationId]: true,
            },
        }))

        try {
            console.log("[SettingsTreatmentTypeStationMatrixSection] Toggling remote booking:", {
                treatmentTypeId,
                stationId,
                remoteBooking: newRemoteBooking,
            })

            // Get default time for this treatmentType
            const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60
            const stationTime = cell.stationTime ?? defaultTime

            // Upsert the station_treatmentType_rule with updated remote_booking_allowed
            const { error } = await supabase
                .from("station_treatmentType_rules")
                .upsert(
                    {
                        station_id: stationId,
                        treatment_type_id: treatmentTypeId,
                        is_active: true,
                        remote_booking_allowed: newRemoteBooking,
                        duration_modifier_minutes: stationTime,
                    },
                    {
                        onConflict: "station_id,treatment_type_id",
                    }
                )

            if (error) throw error

            setInitialMatrix((prev) => {
                const next = { ...prev }
                const previousTreatmentType = { ...(prev[treatmentTypeId] || {}) }
                const prevCell = previousTreatmentType[stationId]
                previousTreatmentType[stationId] = {
                    ...(prevCell || {}),
                    supported: prevCell?.supported ?? cell.supported ?? true,
                    stationTime: stationTime,
                    remote_booking_allowed: newRemoteBooking,
                    defaultTime: prevCell?.defaultTime ?? cell.defaultTime ?? undefined,
                }
                next[treatmentTypeId] = previousTreatmentType
                return next
            })

            console.log("[SettingsTreatmentTypeStationMatrixSection] Remote booking toggled successfully")
        } catch (error: unknown) {
            console.error("[SettingsTreatmentTypeStationMatrixSection] Error toggling remote booking:", error)

            // Revert optimistic update on error
            setMatrix((prev) => {
                const newMatrix = { ...prev }
                if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}
                const cell = newMatrix[treatmentTypeId][stationId] || { supported: false }
                newMatrix[treatmentTypeId][stationId] = {
                    ...cell,
                    remote_booking_allowed: currentRemoteBooking,
                }
                return newMatrix
            })

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את תור מרחוק"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setTogglingRemoteBooking((prev) => {
                const newState = { ...prev }
                if (newState[treatmentTypeId]) {
                    newState[treatmentTypeId] = { ...newState[treatmentTypeId] }
                    delete newState[treatmentTypeId][stationId]
                }
                return newState
            })
        }
    }

    const handleToggleApproval = async (treatmentTypeId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[treatmentTypeId]?.[stationId]
        if (!cell || !cell.supported) return

        const currentApproval = cell.is_approval_needed ?? false
        const newApproval = !currentApproval

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}
            const cell = newMatrix[treatmentTypeId][stationId] || { supported: false }
            newMatrix[treatmentTypeId][stationId] = {
                ...cell,
                is_approval_needed: newApproval,
            }
            return newMatrix
        })

        // Set loading state
        setTogglingApproval((prev) => ({
            ...prev,
            [treatmentTypeId]: {
                ...(prev[treatmentTypeId] || {}),
                [stationId]: true,
            },
        }))

        try {
            // Get default time for this treatmentType
            const defaultTime = getDefaultTimeForTreatmentType(treatmentTypeId) ?? 60
            const stationTime = cell.stationTime ?? defaultTime

            // Upsert the station_treatmentType_rule with updated requires_staff_approval
            const { error } = await supabase
                .from("station_treatmentType_rules")
                .upsert(
                    {
                        station_id: stationId,
                        treatment_type_id: treatmentTypeId,
                        is_active: true,
                        requires_staff_approval: newApproval,
                        remote_booking_allowed: cell.remote_booking_allowed ?? false,
                        duration_modifier_minutes: stationTime,
                    },
                    {
                        onConflict: "station_id,treatment_type_id",
                    }
                )

            if (error) throw error

            setInitialMatrix((prev) => {
                const next = { ...prev }
                const previousTreatmentType = { ...(prev[treatmentTypeId] || {}) }
                const prevCell = previousTreatmentType[stationId]
                previousTreatmentType[stationId] = {
                    ...(prevCell || {}),
                    supported: prevCell?.supported ?? cell.supported ?? true,
                    stationTime: stationTime,
                    is_approval_needed: newApproval,
                    defaultTime: prevCell?.defaultTime ?? cell.defaultTime ?? undefined,
                }
                next[treatmentTypeId] = previousTreatmentType
                return next
            })
        } catch (error: unknown) {
            console.error("Error toggling approval:", error)

            // Revert optimistic update on error
            setMatrix((prev) => {
                const newMatrix = { ...prev }
                if (!newMatrix[treatmentTypeId]) newMatrix[treatmentTypeId] = {}
                const cell = newMatrix[treatmentTypeId][stationId] || { supported: false }
                newMatrix[treatmentTypeId][stationId] = {
                    ...cell,
                    is_approval_needed: currentApproval,
                }
                return newMatrix
            })

            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את אישור הצוות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setTogglingApproval((prev) => {
                const newState = { ...prev }
                if (newState[treatmentTypeId]) {
                    newState[treatmentTypeId] = { ...newState[treatmentTypeId] }
                    delete newState[treatmentTypeId][stationId]
                }
                return newState
            })
        }
    }

    // Calculate pagination limits (no cycling, stops at end)
    const maxPage = Math.max(0, selectedStationIds.length - STATIONS_PER_VIEW)
    const canGoPrevious = stationPage > 0
    const canGoNext = stationPage < maxPage

    const handleNextPage = () => {
        if (selectedStationIds.length <= STATIONS_PER_VIEW) return
        const nextPage = stationPage + 1
        if (nextPage <= maxPage) {
            setStationPage(nextPage)
        }
    }

    const handlePreviousPage = () => {
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

    const handleDuplicateTreatmentType = (treatmentType: TreatmentType) => {
        setTreatmentTypeToDuplicate(treatmentType)
        setIsDuplicateTreatmentTypeDialogOpen(true)
    }

    const handleDeleteTreatmentType = (treatmentType: TreatmentType) => {
        setTreatmentTypeToDelete(treatmentType)
        setIsDeleteTreatmentTypeDialogOpen(true)
    }

    const confirmDeleteTreatmentType = async () => {
        if (!treatmentTypeToDelete) return

        setIsDeletingTreatmentType(true)

        try {
            const { error } = await supabase.from("treatmentTypes").delete().eq("id", treatmentTypeToDelete.id)
            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הגזע נמחק בהצלחה",
            })

            setIsDeleteTreatmentTypeDialogOpen(false)
            setTreatmentTypeToDelete(null)

            // Reload all data to reflect the deletion
            await loadData()
        } catch (error: unknown) {
            console.error("Error deleting treatmentType:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsDeletingTreatmentType(false)
        }
    }

    const confirmDuplicateTreatmentType = async (params: {
        mode: "new" | "existing"
        name?: string
        targetTreatmentTypeIds?: string[]
        copyDetails: boolean
        copyStationRelations: boolean
    }) => {
        if (!treatmentTypeToDuplicate) return

        setIsDuplicateTreatmentTypeDialogOpen(false)
        setIsDuplicatingTreatmentType(true)

        try {
            const sourceTreatmentTypeId = treatmentTypeToDuplicate.id

            if (params.mode === "new") {
                // Create new treatmentType
                if (!params.name) throw new Error("TreatmentType name is required for new treatmentType")

                const { data: newTreatmentType, error: treatmentTypeError } = await supabase
                    .from("treatmentTypes")
                    .insert({
                        name: params.name,
                        size_class: treatmentTypeToDuplicate.size_class,
                        min_groom_price: treatmentTypeToDuplicate.min_groom_price,
                        max_groom_price: treatmentTypeToDuplicate.max_groom_price,
                        hourly_price: treatmentTypeToDuplicate.hourly_price,
                        notes: treatmentTypeToDuplicate.notes,
                    })
                    .select()
                    .single()

                if (treatmentTypeError) throw treatmentTypeError
                if (!newTreatmentType) throw new Error("Failed to create duplicate treatmentType")

                const newTreatmentTypeId = newTreatmentType.id

                // Duplicate categories (types)
                const originalTypeIds = treatmentTypeTypesMap[sourceTreatmentTypeId] || []
                if (originalTypeIds.length > 0) {
                    const typesToInsert = originalTypeIds.map(typeId => ({
                        treatment_type_id: newTreatmentTypeId,
                        related_treatment_type_id: typeId
                    }))
                    const { error: typesError } = await supabase
                        .from("treatmentType_treatment_types")
                        .insert(typesToInsert)
                    if (typesError) throw typesError
                }

                // Duplicate subcategories (categories)
                const originalCategoryIds = treatmentTypeCategoriesMap[sourceTreatmentTypeId] || []
                if (originalCategoryIds.length > 0) {
                    const categoriesToInsert = originalCategoryIds.map(categoryId => ({
                        treatment_type_id: newTreatmentTypeId,
                        treatment_category_id: categoryId
                    }))
                    const { error: categoriesError } = await supabase
                        .from("treatmentType_treatment_categories")
                        .insert(categoriesToInsert)
                    if (categoriesError) throw categoriesError
                }

                // Duplicate station treatmentType rules (only if checkbox is checked)
                if (groomingServiceId && params.copyStationRelations) {
                    const originalTreatmentTypeCells = matrix[sourceTreatmentTypeId] || {}
                    const stationIds = Object.keys(originalTreatmentTypeCells)

                    for (const stationId of stationIds) {
                        const cell = originalTreatmentTypeCells[stationId]
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

                            // Ensure treatmentType_modifier exists with the same default time
                            if (defaultTime) {
                                await supabase
                                    .from("treatmentType_modifiers")
                                    .upsert(
                                        {
                                            treatment_type_id: newTreatmentTypeId,
                                            time_modifier_minutes: defaultTime,
                                        },
                                        { onConflict: "service_id,treatment_type_id" }
                                    )
                            }

                            // Copy station_treatmentType_rules with ALL values
                            await supabase
                                .from("station_treatmentType_rules")
                                .upsert(
                                    {
                                        station_id: stationId,
                                        treatment_type_id: newTreatmentTypeId,
                                        is_active: true,
                                        remote_booking_allowed: originalRemoteBooking,
                                        requires_staff_approval: originalApprovalNeeded,
                                        duration_modifier_minutes: durationMinutes,
                                    },
                                    { onConflict: "station_id,treatment_type_id" }
                                )
                        }
                    }
                }

                toast({
                    title: "הצלחה",
                    description: "הגזע שוכפל בהצלחה",
                })

                // Reload all data to include the new treatmentType
                await loadData()
            } else {
                // Copy to existing treatmentTypes
                if (!params.targetTreatmentTypeIds || params.targetTreatmentTypeIds.length === 0) {
                    throw new Error("At least one target treatmentType is required")
                }

                const sourceTreatmentType = treatmentTypes.find(b => b.id === sourceTreatmentTypeId)
                if (!sourceTreatmentType) throw new Error("Source treatmentType not found")

                // Process each target treatmentType
                for (const targetId of params.targetTreatmentTypeIds) {
                    if (params.copyDetails) {
                        // Update treatmentType details (but NOT the name - keep existing treatmentType name)
                        const { error: updateError } = await supabase
                            .from("treatmentTypes")
                            .update({
                                size_class: sourceTreatmentType.size_class,
                                min_groom_price: sourceTreatmentType.min_groom_price,
                                max_groom_price: sourceTreatmentType.max_groom_price,
                                hourly_price: sourceTreatmentType.hourly_price,
                                notes: sourceTreatmentType.notes,
                            })
                            .eq("id", targetId)

                        if (updateError) throw updateError

                        // Copy treatment types - delete existing and insert new ones
                        const { error: deleteTypesError } = await supabase
                            .from("treatmentType_treatment_types")
                            .delete()
                            .eq("treatment_type_id", targetId)

                        if (deleteTypesError) throw deleteTypesError

                        const originalTypeIds = treatmentTypeTypesMap[sourceTreatmentTypeId] || []
                        if (originalTypeIds.length > 0) {
                            const typesToInsert = originalTypeIds.map(typeId => ({
                                treatment_type_id: targetId,
                                related_treatment_type_id: typeId
                            }))
                            const { error: typesError } = await supabase
                                .from("treatmentType_treatment_types")
                                .insert(typesToInsert)
                            if (typesError) throw typesError
                        }

                        // Copy treatment categories - delete existing and insert new ones
                        const { error: deleteCategoriesError } = await supabase
                            .from("treatmentType_treatment_categories")
                            .delete()
                            .eq("treatment_type_id", targetId)

                        if (deleteCategoriesError) throw deleteCategoriesError

                        const originalCategoryIds = treatmentTypeCategoriesMap[sourceTreatmentTypeId] || []
                        if (originalCategoryIds.length > 0) {
                            const categoriesToInsert = originalCategoryIds.map(categoryId => ({
                                treatment_type_id: targetId,
                                treatment_category_id: categoryId
                            }))
                            const { error: categoriesError } = await supabase
                                .from("treatmentType_treatment_categories")
                                .insert(categoriesToInsert)
                            if (categoriesError) throw categoriesError
                        }
                    }

                    // Copy station relations if requested
                    if (groomingServiceId && params.copyStationRelations) {
                        const originalTreatmentTypeCells = matrix[sourceTreatmentTypeId] || {}
                        const stationIds = Object.keys(originalTreatmentTypeCells)

                        for (const stationId of stationIds) {
                            const cell = originalTreatmentTypeCells[stationId]
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

                                // Ensure treatmentType_modifier exists with the same default time
                                if (defaultTime) {
                                    await supabase
                                        .from("treatmentType_modifiers")
                                        .upsert(
                                            {
                                                treatment_type_id: targetId,
                                                time_modifier_minutes: defaultTime,
                                            },
                                            { onConflict: "service_id,treatment_type_id" }
                                        )
                                }

                                // Copy station_treatmentType_rules with ALL values
                                await supabase
                                    .from("station_treatmentType_rules")
                                    .upsert(
                                        {
                                            station_id: stationId,
                                            treatment_type_id: targetId,
                                            is_active: true,
                                            remote_booking_allowed: originalRemoteBooking,
                                            requires_staff_approval: originalApprovalNeeded,
                                            duration_modifier_minutes: durationMinutes,
                                        },
                                        { onConflict: "station_id,treatment_type_id" }
                                    )
                            }
                        }
                    }
                }

                toast({
                    title: "הצלחה",
                    description: `הנתונים הועתקו ל-${params.targetTreatmentTypeIds.length} גזעים בהצלחה`,
                })

                // Reload all data
                await loadData()
            }
        } catch (error: unknown) {
            console.error("Error duplicating treatmentType:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשכפל את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsDuplicatingTreatmentType(false)
            setTreatmentTypeToDuplicate(null)
        }
    }

    const confirmDuplicateStation = async (params: {
        mode: "new" | "existing"
        name?: string
        targetStationIds?: string[]
        copyDetails: boolean
        copyTreatmentTypeRelations: boolean
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

                    // Copy treatmentType relations if requested
                    if (groomingServiceId && params.copyTreatmentTypeRelations) {
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

                        // Now copy all treatmentType-specific matrix values including station_treatmentType_rules
                        const treatmentTypeIds = Object.keys(matrix)
                        for (const treatmentTypeId of treatmentTypeIds) {
                            const cell = matrix[treatmentTypeId]?.[sourceStationId]
                            if (cell?.supported) {
                                // Get the original values
                                const defaultTime = cell.defaultTime
                                const originalStationTime = cell.stationTime
                                const originalRemoteBooking = cell.remote_booking_allowed ?? false
                                const originalApprovalNeeded = cell.is_approval_needed ?? false

                                // Ensure treatmentType_modifier exists with the same default time
                                if (defaultTime) {
                                    await supabase
                                        .from("treatmentType_modifiers")
                                        .upsert(
                                            {
                                                treatment_type_id: treatmentTypeId,
                                                time_modifier_minutes: defaultTime,
                                            },
                                            { onConflict: "service_id,treatment_type_id" }
                                        )
                                }

                                // Copy station_treatmentType_rules with ALL values
                                const durationMinutes = originalStationTime || (originalBaseTime + (defaultTime || 60))
                                await supabase
                                    .from("station_treatmentType_rules")
                                    .upsert(
                                        {
                                            station_id: targetId,
                                            treatment_type_id: treatmentTypeId,
                                            is_active: true,
                                            remote_booking_allowed: originalRemoteBooking,
                                            requires_staff_approval: originalApprovalNeeded,
                                            duration_modifier_minutes: durationMinutes,
                                        },
                                        { onConflict: "station_id,treatment_type_id" }
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

                    // Reload matrix data to ensure everything is in sync
                    if (groomingServiceId) {
                        await loadMatrixData(treatmentTypes, activeStations)
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
            const treatmentTypeIds = Object.keys(matrix)

            if (params.mode === "new" && groomingServiceId && params.copyTreatmentTypeRelations) {
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

                // Now copy all treatmentType-specific matrix values including station_treatmentType_rules
                // For each treatmentType that was supported in the original station, ensure it's supported in the target one
                for (const treatmentTypeId of treatmentTypeIds) {
                    const cell = matrix[treatmentTypeId]?.[sourceStationId]
                    if (cell?.supported) {
                        // Get the original values
                        const defaultTime = cell.defaultTime
                        const originalStationTime = cell.stationTime
                        const originalRemoteBooking = cell.remote_booking_allowed ?? false
                        const originalApprovalNeeded = cell.is_approval_needed ?? false

                        // Ensure treatmentType_modifier exists with the same default time
                        if (defaultTime) {
                            await supabase
                                .from("treatmentType_modifiers")
                                .upsert(
                                    {
                                        treatment_type_id: treatmentTypeId,
                                        time_modifier_minutes: defaultTime,
                                    },
                                    { onConflict: "service_id,treatment_type_id" }
                                )
                        }

                        // Copy station_treatmentType_rules with ALL values (is_active, remote_booking_allowed, requires_staff_approval, duration_modifier_minutes)
                        const durationMinutes = originalStationTime || (originalBaseTime + (defaultTime || 60))
                        await supabase
                            .from("station_treatmentType_rules")
                            .upsert(
                                {
                                    station_id: targetStationId,
                                    treatment_type_id: treatmentTypeId,
                                    is_active: true,
                                    remote_booking_allowed: originalRemoteBooking,
                                    requires_staff_approval: originalApprovalNeeded,
                                    duration_modifier_minutes: durationMinutes,
                                },
                                { onConflict: "station_id,treatment_type_id" }
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

                // Add new station to selected stations (only for new mode)
                if (params.mode === "new" && !selectedStationIds.includes(targetStationId)) {
                    setSelectedStationIds([...selectedStationIds, targetStationId])
                }

                // Reload matrix data to ensure everything is in sync
                if (groomingServiceId) {
                    await loadMatrixData(treatmentTypes, activeStations)
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

                // Reload matrix data
                if (groomingServiceId) {
                    await loadMatrixData(treatmentTypes, activeStations)
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען מטריצת גזעים-עמדות...</span>
            </div>
        )
    }

    if (!groomingServiceId) {
        return (
            <div className="text-center py-12 text-gray-500">
                שירות טיפוח לא נמצא במערכת. אנא הוסף שירות טיפוח תחילה.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">מטריצת גזעים-עמדות</h2>
                    <p className="text-gray-600 mt-1">נהל את כל הגדרות המערכת - גזעים, שעות עבודה, עמדות ומטריצות</p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors">
                                    <Info className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs" dir="rtl">
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium">הסבר:</p>
                                    <ul className="list-disc list-inside space-y-1 mr-2">
                                        <li>סמן ✓ כדי לאפשר לעמדה לטפל בגזע מסוים</li>
                                        <li>זמן ברירת מחדל חל על כל העמדות התומכות בגזע זה</li>
                                        <li>ניתן להגדיר זמן ספציפי לכל עמדה (עוקף את ברירת המחדל)</li>
                                        <li>הזמן הכולל = זמן בסיסי של העמדה + זמן תיקון הגזע</li>
                                    </ul>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Dialog open={isAddTreatmentTypeDialogOpen} onOpenChange={setIsAddTreatmentTypeDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">הוסף גזע</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm" dir="rtl">
                            <DialogHeader className="items-start text-right">
                                <DialogTitle>הוסף גזע חדש</DialogTitle>
                                <DialogDescription>הכנס שם גזע חדש להוספה למערכת</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-treatmentType-name" className="text-right">שם הגזע</Label>
                                    <Input
                                        id="new-treatmentType-name"
                                        value={newTreatmentTypeName}
                                        onChange={(e) => setNewTreatmentTypeName(e.target.value)}
                                        placeholder="הכנס שם גזע"
                                        dir="rtl"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && newTreatmentTypeName.trim()) {
                                                handleAddTreatmentType()
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex">
                                <Button variant="outline" onClick={() => setIsAddTreatmentTypeDialogOpen(false)} disabled={isAddingTreatmentType}>
                                    ביטול
                                </Button>
                                <Button onClick={handleAddTreatmentType} disabled={isAddingTreatmentType || !newTreatmentTypeName.trim()}>
                                    {isAddingTreatmentType && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    הוסף
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isAddStationDialogOpen} onOpenChange={setIsAddStationDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">הוסף עמדה</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm" dir="rtl">
                            <DialogHeader className="items-start text-right">
                                <DialogTitle>הוסף עמדה חדשה</DialogTitle>
                                <DialogDescription>הכנס שם עמדה חדשה להוספה למערכת</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-station-name" className="text-right">שם העמדה</Label>
                                    <Input
                                        id="new-station-name"
                                        value={newStationName}
                                        onChange={(e) => setNewStationName(e.target.value)}
                                        placeholder="הכנס שם עמדה"
                                        dir="rtl"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && newStationName.trim()) {
                                                handleAddStation()
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex">
                                <Button variant="outline" onClick={() => setIsAddStationDialogOpen(false)} disabled={isAddingStation}>
                                    ביטול
                                </Button>
                                <Button onClick={handleAddStation} disabled={isAddingStation || !newStationName.trim()}>
                                    {isAddingStation && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    הוסף
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isStationDialogOpen} onOpenChange={setIsStationDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                בחר עמדות
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md" dir="rtl">
                            <DialogHeader className="text-right">
                                <DialogTitle>בחר וסדר עמדות</DialogTitle>
                                <DialogDescription>בחר אילו עמדות להציג ובאיזה סדר. גרור את העמדות לסידור מחדש</DialogDescription>
                            </DialogHeader>
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={selectedStationIds}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto py-4">
                                        {allStations.map((station) => {
                                            const isSelected = selectedStationIds.includes(station.id)
                                            const currentIndex = isSelected ? selectedStationIds.indexOf(station.id) : -1

                                            return (
                                                <SortableStationItem
                                                    key={station.id}
                                                    station={station}
                                                    isSelected={isSelected}
                                                    order={currentIndex + 1}
                                                    onToggle={handleToggleStationSelection}
                                                />
                                            )
                                        })}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Save className="h-4 w-4" />
                        שמור שינויים
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                    placeholder="חפש גזע..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                    dir="rtl"
                />
                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Category Filters */}
            <div className="grid grid-cols-1 gap-4 w-full md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="space-y-2 min-w-0">
                    <Label className="text-sm text-right block">קטגוריה 1</Label>
                    <MultiSelectDropdown
                        options={treatmentTypes.map((type) => ({ id: type.id, name: type.name }))}
                        selectedIds={typeFilterIds}
                        onSelectionChange={setTypeFilterIds}
                        placeholder="סנן לפי קטגוריה 1"
                        className="w-full"
                    />
                </div>
                <div className="space-y-2 min-w-0">
                    <Label className="text-sm text-right block">קטגוריה 2</Label>
                    <MultiSelectDropdown
                        options={treatmentCategories.map((category) => ({ id: category.id, name: category.name }))}
                        selectedIds={categoryFilterIds}
                        onSelectionChange={setCategoryFilterIds}
                        placeholder="סנן לפי קטגוריה 2"
                        className="w-full"
                    />
                </div>
                <div className="flex items-end justify-start md:justify-end">
                    {(typeFilterIds.length > 0 || categoryFilterIds.length > 0) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setTypeFilterIds([])
                                setCategoryFilterIds([])
                            }}
                            className="self-start md:self-auto"
                        >
                            <X className="h-4 w-4 ml-2" />
                            נקה סינוני קטגוריות
                        </Button>
                    )}
                </div>
            </div>

            {/* Station Navigation */}
            {selectedStationIds.length > STATIONS_PER_VIEW && (
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={!canGoPrevious}
                        className="flex items-center gap-1"
                    >
                        <ChevronRight className="h-4 w-4" />
                        הקודם
                    </Button>
                    <span className="text-sm text-gray-600">
                        עמדות {stationPage + 1}-{Math.min(stationPage + STATIONS_PER_VIEW, selectedStationIds.length)} מתוך {selectedStationIds.length}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!canGoNext}
                        className="flex items-center gap-1"
                    >
                        הבא
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <div className="border rounded-lg">
                <div className="overflow-x-auto overflow-y-auto max-h-[800px] [direction:ltr] custom-scrollbar">
                    <div className="[direction:rtl]">
                        <div className="relative w-full">
                            <table className="w-full caption-bottom text-sm table-fixed">
                                <thead className="sticky top-0 z-20 [&_tr]:border-b bg-background">
                                    <tr className="border-b transition-colors bg-[hsl(228_36%_95%)]">
                                        <th className="text-right sticky pr-6 right-0 bg-[hsl(228_36%_95%)] text-primary font-semibold z-20 border-r-2 border-primary/20 align-middle" style={{ width: '290px', minWidth: '290px' }}>
                                            גזע / זמן ברירת מחדל
                                        </th>
                                        {visibleStations.map((station, stationIndex) => {
                                            const isLastStation = stationIndex === visibleStations.length - 1
                                            const headerBorderClasses = isLastStation
                                                ? 'border-l-2 border-r-2 border-primary/20'
                                                : 'border-l-2 border-r-2 border-primary/20'

                                            return (
                                                <th key={station.id} className={`text-center bg-[hsl(228_36%_95%)] text-primary font-semibold ${headerBorderClasses} h-12 px-3 align-middle`} style={{ width: '180px', minWidth: '180px' }}>
                                                    <div className="flex items-center justify-between gap-2 w-full">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 flex-shrink-0"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" dir="rtl">
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDuplicateStation(station)}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <Copy className="h-4 w-4" />
                                                                    שכפל
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteStation(station)}
                                                                    className="flex items-center gap-2 text-red-600"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    מחק
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <span className="text-center flex-1">{station.name}</span>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {filteredTreatmentTypes.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td colSpan={visibleStations.length + 1} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                {treatmentTypes.length === 0
                                                    ? "אין גזעים במערכת. הוסף גזע חדש כדי להתחיל."
                                                    : "לא נמצאו גזעים התואמים את החיפוש."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTreatmentTypes.map((treatmentType) => {
                                            const defaultTime = getDefaultTimeForTreatmentType(treatmentType.id)
                                            const treatmentTypeCells = matrix[treatmentType.id] || {}
                                            const treatmentTypeStatus = getTreatmentTypeStatus(treatmentType.id)
                                            const isExpanded = expandedTreatmentTypeId === treatmentType.id
                                            const editedPrices = editedTreatmentTypePrices[treatmentType.id] || {}
                                            const hasPriceChanges = treatmentTypeHasPriceChanges(treatmentType.id)
                                            const hasMatrixChanges = treatmentTypeHasMatrixChanges(treatmentType.id)
                                            const isRowDirty = hasPriceChanges || hasMatrixChanges
                                            const isRowSaving = savingTreatmentTypeRowId === treatmentType.id

                                            // Get status color for filled circle (softer colors)
                                            const statusColor = treatmentTypeStatus === 'none' ? 'bg-gray-300' : treatmentTypeStatus === 'some' ? 'bg-blue-300' : 'bg-green-300'

                                            return (
                                                <>
                                                    <tr key={treatmentType.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                        <td className="sticky right-0 bg-white z-10 border-r-2 border-primary/20 px-4 align-middle [&:has([role=checkbox])]:pr-0" style={{ width: '290px', minWidth: '290px' }}>
                                                            <div className="flex items-center justify-between gap-2 w-full" dir="rtl">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => toggleTreatmentTypeExpand(treatmentType.id)}
                                                                        className="h-6 w-6 p-0 flex-shrink-0"
                                                                        title={isExpanded ? "צמצם" : "הרחב"}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronUp className="h-4 w-4" />
                                                                        ) : (
                                                                            <ChevronDown className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                    <div className={`h-4 w-4 rounded-full ${statusColor} flex-shrink-0`} />
                                                                    <div className="flex flex-col  min-w-0 max-w-[140px]">
                                                                        <span className="font-medium truncate whitespace-nowrap block w-full text-right">{treatmentType.name}</span>
                                                                        <span className="text-xs text-gray-500 text-right">
                                                                            {`ברירת מחדל: ${formatDurationFromMinutes(defaultTime ?? 60)}`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                    {isRowDirty && (
                                                                        <>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                                                                title="בטל שינויים"
                                                                                onClick={() => handleRevertTreatmentTypeRow(treatmentType.id)}
                                                                                disabled={isRowSaving}
                                                                            >
                                                                                <X className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                                                                                title="שמור שינויים"
                                                                                onClick={() => handleSaveTreatmentTypeRow(treatmentType.id)}
                                                                                disabled={isRowSaving}
                                                                            >
                                                                                {isRowSaving ? (
                                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                ) : (
                                                                                    <Check className="h-3.5 w-3.5" />
                                                                                )}
                                                                            </Button>
                                                                            <div className="w-px h-5 bg-gray-300 mx-0.5" />
                                                                        </>
                                                                    )}
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <div className="flex items-center gap-0.5">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                                title="הפעל את כל העמדות"
                                                                                onClick={() => handleTurnOnAllStations(treatmentType.id)}
                                                                            >
                                                                                <CheckSquare className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                                                title="תור מרחוק - כן (סמן את כל העמדות כתומכות בתור מרחוק)"
                                                                                onClick={() => handleMarkAllRemoteBooking(treatmentType.id)}
                                                                            >
                                                                                <Globe className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                                                title="אישור - כן (סמן את כל העמדות כנדרשות אישור)"
                                                                                onClick={() => handleMarkAllApprovalNeeded(treatmentType.id)}
                                                                            >
                                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex items-center gap-0.5">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                                title="כבה את כל העמדות"
                                                                                onClick={() => handleTurnOffAllStations(treatmentType.id)}
                                                                            >
                                                                                <Square className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                                title="תור מרחוק - לא (סמן את כל העמדות ללא תמיכה בתור מרחוק)"
                                                                                onClick={() => handleMarkAllNoRemoteBooking(treatmentType.id)}
                                                                            >
                                                                                <Globe className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                                title="אישור - לא (סמן את כל העמדות ללא דרישת אישור)"
                                                                                onClick={() => handleMarkAllNoApprovalNeeded(treatmentType.id)}
                                                                            >
                                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-px h-5 bg-gray-300 mx-0.5" />
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0"
                                                                                title="פעולות קבוצתיות"
                                                                            >
                                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" dir="rtl" className="min-w-[180px]">
                                                                            <div className="px-2 py-1.5">
                                                                                <div className="flex items-center gap-1.5 mb-2">
                                                                                    <Settings className="h-3.5 w-3.5 text-gray-500" />
                                                                                    <span className="text-xs font-semibold text-gray-600">זמן ברירת מחדל</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Input
                                                                                        id={`default-${treatmentType.id}`}
                                                                                        type="text"
                                                                                        value={
                                                                                            isTypingDefault[treatmentType.id]
                                                                                                ? (defaultDurationInputValues[treatmentType.id] ?? formatDurationFromMinutes(defaultTime ?? 60))
                                                                                                : (defaultTime !== undefined ? formatDurationFromMinutes(defaultTime) : "")
                                                                                        }
                                                                                        onChange={(e) => {
                                                                                            const value = e.target.value
                                                                                            const cleaned = value.replace(/[^\d:]/g, "")
                                                                                            setDefaultDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: cleaned,
                                                                                            }))
                                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                                            if (minutes !== null && minutes >= 0) {
                                                                                                handleDefaultTimeChange(treatmentType.id, minutes.toString())
                                                                                            }
                                                                                        }}
                                                                                        onFocus={(e) => {
                                                                                            setIsTypingDefault((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: true,
                                                                                            }))
                                                                                            const currentValue = formatDurationFromMinutes(defaultTime ?? 60)
                                                                                            setDefaultDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: currentValue,
                                                                                            }))
                                                                                            setTimeout(() => {
                                                                                                e.target.select()
                                                                                            }, 0)
                                                                                        }}
                                                                                        onBlur={(e) => {
                                                                                            setIsTypingDefault((prev) => {
                                                                                                const newState = { ...prev }
                                                                                                delete newState[treatmentType.id]
                                                                                                return newState
                                                                                            })
                                                                                            const value = e.target.value
                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                            const formatted = formatDurationFromMinutes(finalMinutes)
                                                                                            setDefaultDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: formatted,
                                                                                            }))
                                                                                            if (finalMinutes !== defaultTime) {
                                                                                                handleDefaultTimeChange(treatmentType.id, finalMinutes.toString())
                                                                                            }
                                                                                        }}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === "Enter") {
                                                                                                e.preventDefault()
                                                                                                const value = e.target.value
                                                                                                const minutes = parseDurationToMinutes(value)
                                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                                handleDefaultTimeChange(treatmentType.id, finalMinutes.toString())
                                                                                                e.target.blur()
                                                                                            }
                                                                                        }}
                                                                                        className="h-7 w-14 text-xs text-right flex-1"
                                                                                        dir="rtl"
                                                                                        placeholder="1:00"
                                                                                    />
                                                                                    <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={() => handleApplyDefaultToAll(treatmentType.id)}
                                                                                        className="h-7 w-7 p-0"
                                                                                        title="החל על כל העמדות"
                                                                                    >
                                                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="border-t my-1" />
                                                                            <DropdownMenuItem
                                                                                onClick={() => handleDuplicateTreatmentType(treatmentType)}
                                                                                className="flex items-center gap-2"
                                                                            >
                                                                                <Copy className="h-4 w-4" />
                                                                                שכפל גזע
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() => handleDeleteTreatmentType(treatmentType)}
                                                                                className="flex items-center gap-2 text-red-600"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                                מחק גזע
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {visibleStations.map((station, stationIndex) => {
                                                            const cell = treatmentTypeCells[station.id] || { supported: false }
                                                            const displayTime = cell.stationTime || defaultTime || 60
                                                            const isTyping = isTypingDuration[treatmentType.id]?.[station.id] ?? false

                                                            const remoteBooking = cell?.remote_booking_allowed ?? false
                                                            const isTogglingRemote = togglingRemoteBooking[treatmentType.id]?.[station.id] ?? false
                                                            const approvalNeeded = cell?.is_approval_needed ?? false
                                                            const isTogglingApproval = togglingApproval[treatmentType.id]?.[station.id] ?? false

                                                            // Match column colors with headers - alternating subtle primary tint and white
                                                            const columnColor = stationIndex % 2 === 0
                                                                ? 'bg-primary/3 border-primary/10'  // Even: very subtle primary tint
                                                                : 'bg-white border-gray-100'  // Odd: white

                                                            // Add right border to the last (rightmost) station column
                                                            const isLastStation = stationIndex === visibleStations.length - 1
                                                            const borderClasses = isLastStation
                                                                ? `${columnColor} border-l-2 border-r-2 border-primary/20`
                                                                : `${columnColor} border-l-2 border-r-2 border-primary/20`

                                                            return (
                                                                <td key={station.id} className={`text-center align-middle ${borderClasses} px-4 py-1`} style={{ width: '180px', minWidth: '180px' }}>
                                                                    <div className="flex items-center gap-3 justify-center w-full max-w-full">
                                                                        <Input
                                                                            type="text"
                                                                            disabled={!cell.supported}
                                                                            value={
                                                                                cell.supported
                                                                                    ? (isTyping
                                                                                        ? (durationInputValues[treatmentType.id]?.[station.id] ?? formatDurationFromMinutes(displayTime))
                                                                                        : formatDurationFromMinutes(displayTime))
                                                                                    : "-"
                                                                            }
                                                                            onChange={(e) => {
                                                                                if (!cell.supported) return // Prevent changes when disabled
                                                                                const value = e.target.value
                                                                                // Only allow numbers and colons
                                                                                const cleaned = value.replace(/[^\d:]/g, "")

                                                                                setDurationInputValues((prev) => ({
                                                                                    ...prev,
                                                                                    [treatmentType.id]: {
                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                        [station.id]: cleaned,
                                                                                    },
                                                                                }))

                                                                                // Try to parse and update if valid
                                                                                const minutes = parseDurationToMinutes(cleaned)
                                                                                if (minutes !== null && minutes >= 0) {
                                                                                    handleStationTimeChange(treatmentType.id, station.id, minutes.toString())
                                                                                }
                                                                            }}
                                                                            onFocus={(e) => {
                                                                                if (!cell.supported) return // Prevent focus when disabled
                                                                                setIsTypingDuration((prev) => ({
                                                                                    ...prev,
                                                                                    [treatmentType.id]: {
                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                        [station.id]: true,
                                                                                    },
                                                                                }))
                                                                                const currentValue = formatDurationFromMinutes(displayTime)
                                                                                setDurationInputValues((prev) => ({
                                                                                    ...prev,
                                                                                    [treatmentType.id]: {
                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                        [station.id]: currentValue,
                                                                                    },
                                                                                }))
                                                                                setTimeout(() => {
                                                                                    e.target.select()
                                                                                }, 0)
                                                                            }}
                                                                            onBlur={(e) => {
                                                                                if (!cell.supported) return // Prevent blur handling when disabled
                                                                                setIsTypingDuration((prev) => {
                                                                                    const newState = { ...prev }
                                                                                    if (newState[treatmentType.id]) {
                                                                                        newState[treatmentType.id] = { ...newState[treatmentType.id] }
                                                                                        delete newState[treatmentType.id][station.id]
                                                                                    }
                                                                                    return newState
                                                                                })
                                                                                const value = e.target.value
                                                                                const minutes = parseDurationToMinutes(value)
                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                setDurationInputValues((prev) => ({
                                                                                    ...prev,
                                                                                    [treatmentType.id]: {
                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                        [station.id]: formatted,
                                                                                    },
                                                                                }))

                                                                                if (finalMinutes !== displayTime) {
                                                                                    handleStationTimeChange(treatmentType.id, station.id, finalMinutes.toString())
                                                                                }
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (!cell.supported) return // Prevent key handling when disabled
                                                                                if (e.key === "Enter") {
                                                                                    e.preventDefault()
                                                                                    const value = e.target.value
                                                                                    const minutes = parseDurationToMinutes(value)
                                                                                    const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                    handleStationTimeChange(treatmentType.id, station.id, finalMinutes.toString())
                                                                                    e.target.blur()
                                                                                }
                                                                            }}
                                                                            className="w-20 h-8 text-xs text-center"
                                                                            dir="rtl"
                                                                            placeholder={cell.supported ? "1:30" : "-"}
                                                                            title={cell.supported ? "זמן ספציפי לעמדה זו (עוקף ברירת מחדל)" : "עמדה לא פעילה"}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => cell.supported && handleToggleRemoteBooking(treatmentType.id, station.id)}
                                                                            disabled={isTogglingRemote || !cell.supported}
                                                                            className={`flex items-center justify-center p-0.5 rounded transition-colors ${cell.supported
                                                                                ? (remoteBooking
                                                                                    ? 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'
                                                                                    : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50')
                                                                                : 'text-gray-200 cursor-not-allowed'
                                                                                } ${isTogglingRemote ? 'opacity-50 cursor-not-allowed' : (cell.supported ? 'cursor-pointer' : '')}`}
                                                                            title={
                                                                                !cell.supported
                                                                                    ? "עמדה לא פעילה - הפעל עמדה כדי לאפשר תור מרחוק"
                                                                                    : (remoteBooking ? "לחץ כדי לכבות תור מרחוק" : "לחץ כדי לאפשר תור מרחוק")
                                                                            }
                                                                        >
                                                                            {isTogglingRemote ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Globe className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => cell.supported && handleToggleApproval(treatmentType.id, station.id)}
                                                                            disabled={isTogglingApproval || !cell.supported}
                                                                            className={`flex items-center justify-center p-0.5 rounded transition-colors ${cell.supported
                                                                                ? (approvalNeeded
                                                                                    ? 'text-orange-500 hover:text-orange-600 hover:bg-orange-50'
                                                                                    : 'text-gray-300 hover:text-gray-400 hover:bg-gray-50')
                                                                                : 'text-gray-200 cursor-not-allowed'
                                                                                } ${isTogglingApproval ? 'opacity-50 cursor-not-allowed' : (cell.supported ? 'cursor-pointer' : '')}`}
                                                                            title={
                                                                                !cell.supported
                                                                                    ? "עמדה לא פעילה - הפעל עמדה כדי לדרוש אישור"
                                                                                    : (approvalNeeded ? "לחץ כדי להסיר דרישת אישור" : "לחץ כדי לדרוש אישור צוות")
                                                                            }
                                                                        >
                                                                            {isTogglingApproval ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <ShieldCheck className="h-4 w-4" strokeWidth={2.5} />
                                                                            )}
                                                                        </button>
                                                                        <Checkbox
                                                                            checked={cell.supported}
                                                                            onCheckedChange={() => handleToggleSupport(treatmentType.id, station.id)}
                                                                            className="scale-125"
                                                                        />
                                                                    </div>
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                        <td colSpan={visibleStations.length + 1} className="px-4 align-middle [&:has([role=checkbox])]:pr-0 bg-gray-50 p-0">
                                                            <Collapsible open={isExpanded}>
                                                                <CollapsibleContent>
                                                                    <div className="p-4 border-t-2 border-primary/20" dir="rtl">
                                                                        <div className="flex items-center justify-between mb-4">
                                                                            <h3 className="text-sm font-semibold text-gray-900">מחירים והערות עבור {treatmentType.name}</h3>
                                                                            {hasPriceChanges && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        onClick={() => handleCancelTreatmentTypePrices(treatmentType.id)}
                                                                                        disabled={savingTreatmentTypeId === treatmentType.id}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        <X className="h-3 w-3 ml-1" />
                                                                                        ביטול
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={() => handleSaveTreatmentTypePrices(treatmentType.id)}
                                                                                        disabled={savingTreatmentTypeId === treatmentType.id}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        {savingTreatmentTypeId === treatmentType.id ? (
                                                                                            <>
                                                                                                <Loader2 className="h-3 w-3 animate-spin ml-1" />
                                                                                                שומר...
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <Save className="h-3 w-3 ml-1" />
                                                                                                שמור שינויים
                                                                                            </>
                                                                                        )}
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`size-${treatmentType.id}`} className="text-xs text-gray-600">
                                                                                    גודל:
                                                                                </Label>
                                                                                <Select
                                                                                    value={editedPrices.size_class || "__none__"}
                                                                                    onValueChange={(value) => handlePriceChange(treatmentType.id, 'size_class', value)}
                                                                                >
                                                                                    <SelectTrigger className="h-8" dir="rtl">
                                                                                        <SelectValue placeholder="-" />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent dir="rtl">
                                                                                        <SelectItem value="__none__">-</SelectItem>
                                                                                        <SelectItem value="small">קטן</SelectItem>
                                                                                        <SelectItem value="medium">בינוני</SelectItem>
                                                                                        <SelectItem value="medium_large">בינוני-גדול</SelectItem>
                                                                                        <SelectItem value="large">גדול</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs text-gray-600">קטגוריה ראשית</Label>
                                                                                <MultiSelectDropdown
                                                                                    options={treatmentTypes.map(type => ({ id: type.id, name: type.name }))}
                                                                                    selectedIds={getTreatmentTypeTypes(treatmentType.id)}
                                                                                    onSelectionChange={(selectedIds) => handleTypesChange(treatmentType.id, selectedIds)}
                                                                                    placeholder="בחר קטגוריות ראשיות..."
                                                                                    className="w-full"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs text-gray-600">קטגוריות משנה</Label>
                                                                                <MultiSelectDropdown
                                                                                    options={treatmentCategories.map(category => ({ id: category.id, name: category.name }))}
                                                                                    selectedIds={getTreatmentTypeCategories(treatmentType.id)}
                                                                                    onSelectionChange={(selectedIds) => handleCategoriesChange(treatmentType.id, selectedIds)}
                                                                                    placeholder="בחר קטגוריות משנה..."
                                                                                    className="w-full"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`min-price-${treatmentType.id}`} className="text-xs text-gray-600">
                                                                                    מחיר מינימום טיפוח:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`min-price-${treatmentType.id}`}
                                                                                    type="number"
                                                                                    step="1"
                                                                                    value={editedPrices.min_groom_price ?? ""}
                                                                                    onChange={(e) => handlePriceChange(treatmentType.id, 'min_groom_price', e.target.value)}
                                                                                    placeholder="-"
                                                                                    className="h-8"
                                                                                    dir="rtl"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`max-price-${treatmentType.id}`} className="text-xs text-gray-600">
                                                                                    מחיר מקסימום טיפוח:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`max-price-${treatmentType.id}`}
                                                                                    type="number"
                                                                                    step="1"
                                                                                    value={editedPrices.max_groom_price ?? ""}
                                                                                    onChange={(e) => handlePriceChange(treatmentType.id, 'max_groom_price', e.target.value)}
                                                                                    placeholder="-"
                                                                                    className="h-8"
                                                                                    dir="rtl"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`hourly-price-${treatmentType.id}`} className="text-xs text-gray-600">
                                                                                    מחיר שעתי:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`hourly-price-${treatmentType.id}`}
                                                                                    type="number"
                                                                                    step="1"
                                                                                    value={editedPrices.hourly_price ?? ""}
                                                                                    onChange={(e) => handlePriceChange(treatmentType.id, 'hourly_price', e.target.value)}
                                                                                    placeholder="-"
                                                                                    className="h-8"
                                                                                    dir="rtl"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor={`notes-${treatmentType.id}`} className="text-xs text-gray-600">
                                                                                הערות:
                                                                            </Label>
                                                                            <Textarea
                                                                                id={`notes-${treatmentType.id}`}
                                                                                value={editedPrices.notes || ""}
                                                                                onChange={(e) => handleNotesChange(treatmentType.id, e.target.value)}
                                                                                placeholder="הכנס הערות לגזע זה..."
                                                                                className="min-h-[80px]"
                                                                                dir="rtl"
                                                                            />
                                                                        </div>

                                                                    </div>
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        </td>
                                                    </tr>
                                                </>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialogs */}
            <DuplicateStationDialog
                open={isDuplicateConfirmOpen}
                onOpenChange={setIsDuplicateConfirmOpen}
                station={stationToDuplicate}
                stations={allStations}
                onConfirm={confirmDuplicateStation}
                isDuplicating={isAddingStation}
            />

            <DuplicateTreatmentTypeDialog
                open={isDuplicateTreatmentTypeDialogOpen}
                onOpenChange={setIsDuplicateTreatmentTypeDialogOpen}
                treatmentType={treatmentTypeToDuplicate}
                treatmentTypes={treatmentTypes}
                onConfirm={confirmDuplicateTreatmentType}
                isDuplicating={isDuplicatingTreatmentType}
            />

            {/* Delete TreatmentType Dialog */}
            <DeleteTreatmentTypeDialog
                open={isDeleteTreatmentTypeDialogOpen}
                onOpenChange={setIsDeleteTreatmentTypeDialogOpen}
                treatmentType={treatmentTypeToDelete}
                onConfirm={confirmDeleteTreatmentType}
                isDeleting={isDeletingTreatmentType}
            />

            <DeleteStationDialog
                deleteConfirmOpen={isDeleteConfirmOpen}
                onDeleteConfirmChange={setIsDeleteConfirmOpen}
                transferDialogOpen={isTransferDialogOpen}
                onTransferDialogChange={setIsTransferDialogOpen}
                station={stationToDelete}
                stations={allStations}
                onConfirmDelete={confirmDeleteStation}
                onTransferAndDelete={handleTransferAndDelete}
            />
        </div>
    )
}
