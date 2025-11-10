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
import { DuplicateBreedDialog } from "../../dialogs/settings/breeds/DuplicateBreedDialog"
import { DeleteBreedDialog } from "../../dialogs/settings/breeds/DeleteBreedDialog"
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

interface Breed {
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

interface BreedModifier {
    service_id: string
    breed_id: string
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

export function SettingsBreedStationMatrixSection() {
    const { toast } = useToast()
    const [breeds, setBreeds] = useState<Breed[]>([])
    const [filteredBreeds, setFilteredBreeds] = useState<Breed[]>([])
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
    const [dogTypes, setDogTypes] = useState<Array<{ id: string; name: string }>>([])
    const [dogCategories, setDogCategories] = useState<Array<{ id: string; name: string }>>([])
    const [breedTypesMap, setBreedTypesMap] = useState<Record<string, string[]>>({})
    const [breedCategoriesMap, setBreedCategoriesMap] = useState<Record<string, string[]>>({})
    const [editedTypesMap, setEditedTypesMap] = useState<Record<string, string[]>>({})
    const [editedCategoriesMap, setEditedCategoriesMap] = useState<Record<string, string[]>>({})
    const [savingBreedId, setSavingBreedId] = useState<string | null>(null)
    const [savingBreedRowId, setSavingBreedRowId] = useState<string | null>(null)
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

    // Filter breeds by search term and categories
    useEffect(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        const filtered = breeds.filter((breed) => {
            if (normalizedSearch && !breed.name.toLowerCase().includes(normalizedSearch)) {
                return false
            }

            if (typeFilterIds.length > 0) {
                const breedTypes = editedTypesMap[breed.id] ?? breedTypesMap[breed.id] ?? []
                const matchesType = breedTypes.some((typeId) => typeFilterIds.includes(typeId))
                if (!matchesType) {
                    return false
                }
            }

            if (categoryFilterIds.length > 0) {
                const breedCategories = editedCategoriesMap[breed.id] ?? breedCategoriesMap[breed.id] ?? []
                const matchesCategory = breedCategories.some((categoryId) => categoryFilterIds.includes(categoryId))
                if (!matchesCategory) {
                    return false
                }
            }

            return true
        })

        setFilteredBreeds(filtered)
    }, [
        breeds,
        searchTerm,
        typeFilterIds,
        categoryFilterIds,
        breedTypesMap,
        breedCategoriesMap,
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

        // Check types
        const editedTypes = editedTypesMap[breedId] || []
        const originalTypes = breedTypesMap[breedId] || []
        const typesChanged = JSON.stringify([...editedTypes].sort()) !== JSON.stringify([...originalTypes].sort())

        // Check categories
        const editedCategories = editedCategoriesMap[breedId] || []
        const originalCategories = breedCategoriesMap[breedId] || []
        const categoriesChanged = JSON.stringify([...editedCategories].sort()) !== JSON.stringify([...originalCategories].sort())

        return pricesChanged || typesChanged || categoriesChanged
    }

    const getBreedTypes = (breedId: string): string[] => {
        return editedTypesMap[breedId] ?? breedTypesMap[breedId] ?? []
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

    const loadData = async () => {
        setIsLoading(true)
        try {
            // Load breeds with prices, notes, and size_class
            const { data: breedsData, error: breedsError } = await supabase
                .from("breeds")
                .select("id, name, size_class, min_groom_price, max_groom_price, hourly_price, notes")
                .order("name")
            if (breedsError) throw breedsError

            // Load dog types and categories
            const [typesResponse, categoriesResponse] = await Promise.all([
                supabase.from("dog_types").select("id, name").order("name"),
                supabase.from("dog_categories").select("id, name").order("name"),
            ])
            if (typesResponse.error) throw typesResponse.error
            if (categoriesResponse.error) throw categoriesResponse.error
            setDogTypes(typesResponse.data || [])
            setDogCategories(categoriesResponse.data || [])

            // Load breed_dog_types and breed_dog_categories
            const breedIds = (breedsData || []).map(b => b.id)
            const [breedTypesResponse, breedCategoriesResponse] = await Promise.all([
                breedIds.length > 0
                    ? supabase.from("breed_dog_types").select("breed_id, dog_type_id").in("breed_id", breedIds)
                    : { data: [], error: null },
                breedIds.length > 0
                    ? supabase.from("breed_dog_categories").select("breed_id, dog_category_id").in("breed_id", breedIds)
                    : { data: [], error: null },
            ])
            if (breedTypesResponse.error) throw breedTypesResponse.error
            if (breedCategoriesResponse.error) throw breedCategoriesResponse.error

            // Build maps: breed_id -> array of type/category IDs
            const typesMap: Record<string, string[]> = {}
            const categoriesMap: Record<string, string[]> = {}
                ; (breedTypesResponse.data || []).forEach((row: { breed_id: string; dog_type_id: string }) => {
                    if (!typesMap[row.breed_id]) typesMap[row.breed_id] = []
                    typesMap[row.breed_id].push(row.dog_type_id)
                })
                ; (breedCategoriesResponse.data || []).forEach((row: { breed_id: string; dog_category_id: string }) => {
                    if (!categoriesMap[row.breed_id]) categoriesMap[row.breed_id] = []
                    categoriesMap[row.breed_id].push(row.dog_category_id)
                })
            setBreedTypesMap(typesMap)
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

    const handleToggleSupport = (breedId: string, stationId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}
            const cell = newMatrix[breedId][stationId] || { supported: false }
            const newSupported = !cell.supported

            // Get default time for this breed (from other supported stations or undefined)
            const defaultTime = Object.values(newMatrix[breedId] || {})
                .find((c) => c.supported && c.defaultTime !== undefined)?.defaultTime

            newMatrix[breedId][stationId] = {
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

    const handleTurnOnAllStations = (breedId: string) => {
        if (!groomingServiceId) return

        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            visibleStations.forEach((station) => {
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

            visibleStations.forEach((station) => {
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

    const handleMarkAllRemoteBooking = async (breedId: string) => {
        if (!groomingServiceId) return

        const breedCells = matrix[breedId] || {}
        const defaultTime = getDefaultTimeForBreed(breedId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            visibleStations.forEach((station) => {
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

        try {
            // Update all supported stations for this breed
            const updates = visibleStations
                .filter((station) => breedCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    breed_id: breedId,
                    is_active: true,
                    remote_booking_allowed: true,
                    duration_modifier_minutes: breedCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_breed_rules")
                    .upsert(updates, {
                        onConflict: "station_id,breed_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousBreed = { ...(prev[breedId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousBreed[stationId]
                        const currentCell = matrix[breedId]?.[stationId]

                        previousBreed[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            remote_booking_allowed: true,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[breedId] = previousBreed
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
                await loadMatrixData(breeds, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את תור מרחוק"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleMarkAllNoRemoteBooking = async (breedId: string) => {
        if (!groomingServiceId) return

        const breedCells = matrix[breedId] || {}
        const defaultTime = getDefaultTimeForBreed(breedId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            visibleStations.forEach((station) => {
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

        try {
            // Update all supported stations for this breed
            const updates = visibleStations
                .filter((station) => breedCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    breed_id: breedId,
                    is_active: true,
                    remote_booking_allowed: false,
                    duration_modifier_minutes: breedCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_breed_rules")
                    .upsert(updates, {
                        onConflict: "station_id,breed_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousBreed = { ...(prev[breedId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousBreed[stationId]
                        const currentCell = matrix[breedId]?.[stationId]

                        previousBreed[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            remote_booking_allowed: false,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[breedId] = previousBreed
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
                await loadMatrixData(breeds, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את תור מרחוק"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleMarkAllApprovalNeeded = async (breedId: string) => {
        if (!groomingServiceId) return

        const breedCells = matrix[breedId] || {}
        const defaultTime = getDefaultTimeForBreed(breedId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            visibleStations.forEach((station) => {
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

        try {
            // Update all supported stations for this breed
            const updates = visibleStations
                .filter((station) => breedCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    breed_id: breedId,
                    is_active: true,
                    requires_staff_approval: true,
                    remote_booking_allowed: breedCells[station.id]?.remote_booking_allowed ?? false,
                    duration_modifier_minutes: breedCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_breed_rules")
                    .upsert(updates, {
                        onConflict: "station_id,breed_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousBreed = { ...(prev[breedId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousBreed[stationId]
                        const currentCell = matrix[breedId]?.[stationId]

                        previousBreed[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            is_approval_needed: true,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[breedId] = previousBreed
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
                await loadMatrixData(breeds, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את אישור הצוות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleMarkAllNoApprovalNeeded = async (breedId: string) => {
        if (!groomingServiceId) return

        const breedCells = matrix[breedId] || {}
        const defaultTime = getDefaultTimeForBreed(breedId) ?? 60

        // Optimistically update UI
        setMatrix((prev) => {
            const newMatrix = { ...prev }
            if (!newMatrix[breedId]) newMatrix[breedId] = {}

            visibleStations.forEach((station) => {
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

        try {
            // Update all supported stations for this breed
            const updates = visibleStations
                .filter((station) => breedCells[station.id]?.supported)
                .map((station) => ({
                    station_id: station.id,
                    breed_id: breedId,
                    is_active: true,
                    requires_staff_approval: false,
                    remote_booking_allowed: breedCells[station.id]?.remote_booking_allowed ?? false,
                    duration_modifier_minutes: breedCells[station.id]?.stationTime ?? defaultTime,
                }))

            if (updates.length > 0) {
                const { error } = await supabase
                    .from("station_breed_rules")
                    .upsert(updates, {
                        onConflict: "station_id,breed_id",
                    })

                if (error) throw error

                setInitialMatrix((prev) => {
                    const next = { ...prev }
                    const previousBreed = { ...(prev[breedId] || {}) }

                    updates.forEach((update) => {
                        const stationId = update.station_id
                        const prevCell = previousBreed[stationId]
                        const currentCell = matrix[breedId]?.[stationId]

                        previousBreed[stationId] = {
                            ...(prevCell || {}),
                            supported: prevCell?.supported ?? true,
                            stationTime: update.duration_modifier_minutes,
                            is_approval_needed: false,
                            defaultTime: prevCell?.defaultTime ?? currentCell?.defaultTime ?? undefined,
                        }
                    })

                    next[breedId] = previousBreed
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
                await loadMatrixData(breeds, allStations)
            }
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לעדכן את אישור הצוות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        }
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

    const getDefaultTimeForBreed = (breedId: string): number | undefined => {
        const breedCells = matrix[breedId] || {}
        const firstSupported = Object.values(breedCells).find((cell) => cell.supported)
        return firstSupported?.defaultTime
    }

    // Calculate breed status: 'none', 'some', 'all'
    // Based on all stations (not just visible ones)
    const getBreedStatus = (breedId: string): 'none' | 'some' | 'all' => {
        const breedCells = matrix[breedId] || {}
        // Count across all stations in the matrix (allStations)
        const allStationIds = allStations.map(s => s.id)
        const enabledStations = allStationIds.filter(stationId => breedCells[stationId]?.supported).length
        const totalStations = allStationIds.length

        if (totalStations === 0) return 'none'
        if (enabledStations === 0) return 'none'
        if (enabledStations === totalStations) return 'all'
        return 'some'
    }

    const toggleBreedExpand = (breedId: string) => {
        setExpandedBreedId((prev) => (prev === breedId ? null : breedId))
        // Initialize edited prices, size, types, and categories if not already set
        if (!editedBreedPrices[breedId]) {
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
        if (!editedTypesMap[breedId]) {
            setEditedTypesMap((prev) => ({
                ...prev,
                [breedId]: breedTypesMap[breedId] || [],
            }))
        }
        if (!editedCategoriesMap[breedId]) {
            setEditedCategoriesMap((prev) => ({
                ...prev,
                [breedId]: breedCategoriesMap[breedId] || [],
            }))
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

    const handleTypesChange = (breedId: string, selectedIds: string[]) => {
        setEditedTypesMap((prev) => ({
            ...prev,
            [breedId]: selectedIds,
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

            // Update breed_dog_types
            const editedTypes = editedTypesMap[breedId] || []
            const originalTypes = breedTypesMap[breedId] || []

            // Delete removed types
            const typesToDelete = originalTypes.filter(id => !editedTypes.includes(id))
            if (typesToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .from("breed_dog_types")
                    .delete()
                    .eq("breed_id", breedId)
                    .in("dog_type_id", typesToDelete)
                if (deleteError) throw deleteError
            }

            // Insert new types
            const typesToInsert = editedTypes.filter(id => !originalTypes.includes(id))
            if (typesToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from("breed_dog_types")
                    .insert(typesToInsert.map(dog_type_id => ({ breed_id: breedId, dog_type_id })))
                if (insertError) throw insertError
            }

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
            setBreedTypesMap((prev) => ({
                ...prev,
                [breedId]: editedTypes,
            }))
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
        // Reset types and categories
        setEditedTypesMap((prev) => ({
            ...prev,
            [breedId]: breedTypesMap[breedId] || [],
        }))
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

        setTogglingRemoteBooking((prev) => {
            const updated = { ...prev }
            if (updated[breedId]) {
                delete updated[breedId]
            }
            return updated
        })

        handleCancelBreedPrices(breedId)
    }

    const handleToggleRemoteBooking = async (breedId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[breedId]?.[stationId]
        if (!cell || !cell.supported) return

        const currentRemoteBooking = cell.remote_booking_allowed ?? false
        const newRemoteBooking = !currentRemoteBooking

        // Optimistically update UI
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

        // Set loading state
        setTogglingRemoteBooking((prev) => ({
            ...prev,
            [breedId]: {
                ...(prev[breedId] || {}),
                [stationId]: true,
            },
        }))

        try {
            console.log("[SettingsBreedStationMatrixSection] Toggling remote booking:", {
                breedId,
                stationId,
                remoteBooking: newRemoteBooking,
            })

            // Get default time for this breed
            const defaultTime = getDefaultTimeForBreed(breedId) ?? 60
            const stationTime = cell.stationTime ?? defaultTime

            // Upsert the station_breed_rule with updated remote_booking_allowed
            const { error } = await supabase
                .from("station_breed_rules")
                .upsert(
                    {
                        station_id: stationId,
                        breed_id: breedId,
                        is_active: true,
                        remote_booking_allowed: newRemoteBooking,
                        duration_modifier_minutes: stationTime,
                    },
                    {
                        onConflict: "station_id,breed_id",
                    }
                )

            if (error) throw error

            setInitialMatrix((prev) => {
                const next = { ...prev }
                const previousBreed = { ...(prev[breedId] || {}) }
                const prevCell = previousBreed[stationId]
                previousBreed[stationId] = {
                    ...(prevCell || {}),
                    supported: prevCell?.supported ?? cell.supported ?? true,
                    stationTime: stationTime,
                    remote_booking_allowed: newRemoteBooking,
                    defaultTime: prevCell?.defaultTime ?? cell.defaultTime ?? undefined,
                }
                next[breedId] = previousBreed
                return next
            })

            console.log("[SettingsBreedStationMatrixSection] Remote booking toggled successfully")
        } catch (error: unknown) {
            console.error("[SettingsBreedStationMatrixSection] Error toggling remote booking:", error)

            // Revert optimistic update on error
            setMatrix((prev) => {
                const newMatrix = { ...prev }
                if (!newMatrix[breedId]) newMatrix[breedId] = {}
                const cell = newMatrix[breedId][stationId] || { supported: false }
                newMatrix[breedId][stationId] = {
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
                if (newState[breedId]) {
                    newState[breedId] = { ...newState[breedId] }
                    delete newState[breedId][stationId]
                }
                return newState
            })
        }
    }

    const handleToggleApproval = async (breedId: string, stationId: string) => {
        if (!groomingServiceId) return

        const cell = matrix[breedId]?.[stationId]
        if (!cell || !cell.supported) return

        const currentApproval = cell.is_approval_needed ?? false
        const newApproval = !currentApproval

        // Optimistically update UI
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

        // Set loading state
        setTogglingApproval((prev) => ({
            ...prev,
            [breedId]: {
                ...(prev[breedId] || {}),
                [stationId]: true,
            },
        }))

        try {
            // Get default time for this breed
            const defaultTime = getDefaultTimeForBreed(breedId) ?? 60
            const stationTime = cell.stationTime ?? defaultTime

            // Upsert the station_breed_rule with updated requires_staff_approval
            const { error } = await supabase
                .from("station_breed_rules")
                .upsert(
                    {
                        station_id: stationId,
                        breed_id: breedId,
                        is_active: true,
                        requires_staff_approval: newApproval,
                        remote_booking_allowed: cell.remote_booking_allowed ?? false,
                        duration_modifier_minutes: stationTime,
                    },
                    {
                        onConflict: "station_id,breed_id",
                    }
                )

            if (error) throw error

            setInitialMatrix((prev) => {
                const next = { ...prev }
                const previousBreed = { ...(prev[breedId] || {}) }
                const prevCell = previousBreed[stationId]
                previousBreed[stationId] = {
                    ...(prevCell || {}),
                    supported: prevCell?.supported ?? cell.supported ?? true,
                    stationTime: stationTime,
                    is_approval_needed: newApproval,
                    defaultTime: prevCell?.defaultTime ?? cell.defaultTime ?? undefined,
                }
                next[breedId] = previousBreed
                return next
            })
        } catch (error: unknown) {
            console.error("Error toggling approval:", error)

            // Revert optimistic update on error
            setMatrix((prev) => {
                const newMatrix = { ...prev }
                if (!newMatrix[breedId]) newMatrix[breedId] = {}
                const cell = newMatrix[breedId][stationId] || { supported: false }
                newMatrix[breedId][stationId] = {
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
                if (newState[breedId]) {
                    newState[breedId] = { ...newState[breedId] }
                    delete newState[breedId][stationId]
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

                // Duplicate categories (types)
                const originalTypeIds = breedTypesMap[sourceBreedId] || []
                if (originalTypeIds.length > 0) {
                    const typesToInsert = originalTypeIds.map(typeId => ({
                        breed_id: newBreedId,
                        dog_type_id: typeId
                    }))
                    const { error: typesError } = await supabase
                        .from("breed_dog_types")
                        .insert(typesToInsert)
                    if (typesError) throw typesError
                }

                // Duplicate subcategories (categories)
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

                        // Copy dog types - delete existing and insert new ones
                        const { error: deleteTypesError } = await supabase
                            .from("breed_dog_types")
                            .delete()
                            .eq("breed_id", targetId)

                        if (deleteTypesError) throw deleteTypesError

                        const originalTypeIds = breedTypesMap[sourceBreedId] || []
                        if (originalTypeIds.length > 0) {
                            const typesToInsert = originalTypeIds.map(typeId => ({
                                breed_id: targetId,
                                dog_type_id: typeId
                            }))
                            const { error: typesError } = await supabase
                                .from("breed_dog_types")
                                .insert(typesToInsert)
                            if (typesError) throw typesError
                        }

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
                    <Dialog open={isAddBreedDialogOpen} onOpenChange={setIsAddBreedDialogOpen}>
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
                                    <Label htmlFor="new-breed-name" className="text-right">שם הגזע</Label>
                                    <Input
                                        id="new-breed-name"
                                        value={newBreedName}
                                        onChange={(e) => setNewBreedName(e.target.value)}
                                        placeholder="הכנס שם גזע"
                                        dir="rtl"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && newBreedName.trim()) {
                                                handleAddBreed()
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex">
                                <Button variant="outline" onClick={() => setIsAddBreedDialogOpen(false)} disabled={isAddingBreed}>
                                    ביטול
                                </Button>
                                <Button onClick={handleAddBreed} disabled={isAddingBreed || !newBreedName.trim()}>
                                    {isAddingBreed && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
                        options={dogTypes.map((type) => ({ id: type.id, name: type.name }))}
                        selectedIds={typeFilterIds}
                        onSelectionChange={setTypeFilterIds}
                        placeholder="סנן לפי קטגוריה 1"
                        className="w-full"
                    />
                </div>
                <div className="space-y-2 min-w-0">
                    <Label className="text-sm text-right block">קטגוריה 2</Label>
                    <MultiSelectDropdown
                        options={dogCategories.map((category) => ({ id: category.id, name: category.name }))}
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
                                    {filteredBreeds.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td colSpan={visibleStations.length + 1} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                {breeds.length === 0
                                                    ? "אין גזעים במערכת. הוסף גזע חדש כדי להתחיל."
                                                    : "לא נמצאו גזעים התואמים את החיפוש."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredBreeds.map((breed) => {
                                            const defaultTime = getDefaultTimeForBreed(breed.id)
                                            const breedCells = matrix[breed.id] || {}
                                            const breedStatus = getBreedStatus(breed.id)
                                            const isExpanded = expandedBreedId === breed.id
                                            const editedPrices = editedBreedPrices[breed.id] || {}
                                            const hasPriceChanges = breedHasPriceChanges(breed.id)
                                            const hasMatrixChanges = breedHasMatrixChanges(breed.id)
                                            const isRowDirty = hasPriceChanges || hasMatrixChanges
                                            const isRowSaving = savingBreedRowId === breed.id

                                            // Get status color for filled circle (softer colors)
                                            const statusColor = breedStatus === 'none' ? 'bg-gray-300' : breedStatus === 'some' ? 'bg-blue-300' : 'bg-green-300'

                                            return (
                                                <>
                                                    <tr key={breed.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                        <td className="sticky right-0 bg-white z-10 border-r-2 border-primary/20 px-4 align-middle [&:has([role=checkbox])]:pr-0" style={{ width: '290px', minWidth: '290px' }}>
                                                            <div className="flex items-center justify-between gap-2 w-full" dir="rtl">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => toggleBreedExpand(breed.id)}
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
                                                                        <span className="font-medium truncate whitespace-nowrap block w-full text-right">{breed.name}</span>
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
                                                                                onClick={() => handleRevertBreedRow(breed.id)}
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
                                                                                onClick={() => handleSaveBreedRow(breed.id)}
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
                                                                                onClick={() => handleTurnOnAllStations(breed.id)}
                                                                            >
                                                                                <CheckSquare className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                                                title="תור מרחוק - כן (סמן את כל העמדות כתומכות בתור מרחוק)"
                                                                                onClick={() => handleMarkAllRemoteBooking(breed.id)}
                                                                            >
                                                                                <Globe className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                                                title="אישור - כן (סמן את כל העמדות כנדרשות אישור)"
                                                                                onClick={() => handleMarkAllApprovalNeeded(breed.id)}
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
                                                                                onClick={() => handleTurnOffAllStations(breed.id)}
                                                                            >
                                                                                <Square className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                                title="תור מרחוק - לא (סמן את כל העמדות ללא תמיכה בתור מרחוק)"
                                                                                onClick={() => handleMarkAllNoRemoteBooking(breed.id)}
                                                                            >
                                                                                <Globe className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                                                                title="אישור - לא (סמן את כל העמדות ללא דרישת אישור)"
                                                                                onClick={() => handleMarkAllNoApprovalNeeded(breed.id)}
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
                                                                                        id={`default-${breed.id}`}
                                                                                        type="text"
                                                                                        value={
                                                                                            isTypingDefault[breed.id]
                                                                                                ? (defaultDurationInputValues[breed.id] ?? formatDurationFromMinutes(defaultTime ?? 60))
                                                                                                : (defaultTime !== undefined ? formatDurationFromMinutes(defaultTime) : "")
                                                                                        }
                                                                                        onChange={(e) => {
                                                                                            const value = e.target.value
                                                                                            const cleaned = value.replace(/[^\d:]/g, "")
                                                                                            setDefaultDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: cleaned,
                                                                                            }))
                                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                                            if (minutes !== null && minutes >= 0) {
                                                                                                handleDefaultTimeChange(breed.id, minutes.toString())
                                                                                            }
                                                                                        }}
                                                                                        onFocus={(e) => {
                                                                                            setIsTypingDefault((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: true,
                                                                                            }))
                                                                                            const currentValue = formatDurationFromMinutes(defaultTime ?? 60)
                                                                                            setDefaultDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: currentValue,
                                                                                            }))
                                                                                            setTimeout(() => {
                                                                                                e.target.select()
                                                                                            }, 0)
                                                                                        }}
                                                                                        onBlur={(e) => {
                                                                                            setIsTypingDefault((prev) => {
                                                                                                const newState = { ...prev }
                                                                                                delete newState[breed.id]
                                                                                                return newState
                                                                                            })
                                                                                            const value = e.target.value
                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                            const formatted = formatDurationFromMinutes(finalMinutes)
                                                                                            setDefaultDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: formatted,
                                                                                            }))
                                                                                            if (finalMinutes !== defaultTime) {
                                                                                                handleDefaultTimeChange(breed.id, finalMinutes.toString())
                                                                                            }
                                                                                        }}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === "Enter") {
                                                                                                e.preventDefault()
                                                                                                const value = e.target.value
                                                                                                const minutes = parseDurationToMinutes(value)
                                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (defaultTime ?? 60)
                                                                                                handleDefaultTimeChange(breed.id, finalMinutes.toString())
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
                                                                                        onClick={() => handleApplyDefaultToAll(breed.id)}
                                                                                        className="h-7 w-7 p-0"
                                                                                        title="החל על כל העמדות"
                                                                                    >
                                                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                            <div className="border-t my-1" />
                                                                            <DropdownMenuItem
                                                                                onClick={() => handleDuplicateBreed(breed)}
                                                                                className="flex items-center gap-2"
                                                                            >
                                                                                <Copy className="h-4 w-4" />
                                                                                שכפל גזע
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() => handleDeleteBreed(breed)}
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
                                                            const cell = breedCells[station.id] || { supported: false }
                                                            const displayTime = cell.stationTime || defaultTime || 60
                                                            const isTyping = isTypingDuration[breed.id]?.[station.id] ?? false

                                                            const remoteBooking = cell?.remote_booking_allowed ?? false
                                                            const isTogglingRemote = togglingRemoteBooking[breed.id]?.[station.id] ?? false
                                                            const approvalNeeded = cell?.is_approval_needed ?? false
                                                            const isTogglingApproval = togglingApproval[breed.id]?.[station.id] ?? false

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
                                                                                        ? (durationInputValues[breed.id]?.[station.id] ?? formatDurationFromMinutes(displayTime))
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
                                                                                    [breed.id]: {
                                                                                        ...(prev[breed.id] || {}),
                                                                                        [station.id]: cleaned,
                                                                                    },
                                                                                }))

                                                                                // Try to parse and update if valid
                                                                                const minutes = parseDurationToMinutes(cleaned)
                                                                                if (minutes !== null && minutes >= 0) {
                                                                                    handleStationTimeChange(breed.id, station.id, minutes.toString())
                                                                                }
                                                                            }}
                                                                            onFocus={(e) => {
                                                                                if (!cell.supported) return // Prevent focus when disabled
                                                                                setIsTypingDuration((prev) => ({
                                                                                    ...prev,
                                                                                    [breed.id]: {
                                                                                        ...(prev[breed.id] || {}),
                                                                                        [station.id]: true,
                                                                                    },
                                                                                }))
                                                                                const currentValue = formatDurationFromMinutes(displayTime)
                                                                                setDurationInputValues((prev) => ({
                                                                                    ...prev,
                                                                                    [breed.id]: {
                                                                                        ...(prev[breed.id] || {}),
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
                                                                                    if (newState[breed.id]) {
                                                                                        newState[breed.id] = { ...newState[breed.id] }
                                                                                        delete newState[breed.id][station.id]
                                                                                    }
                                                                                    return newState
                                                                                })
                                                                                const value = e.target.value
                                                                                const minutes = parseDurationToMinutes(value)
                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                setDurationInputValues((prev) => ({
                                                                                    ...prev,
                                                                                    [breed.id]: {
                                                                                        ...(prev[breed.id] || {}),
                                                                                        [station.id]: formatted,
                                                                                    },
                                                                                }))

                                                                                if (finalMinutes !== displayTime) {
                                                                                    handleStationTimeChange(breed.id, station.id, finalMinutes.toString())
                                                                                }
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (!cell.supported) return // Prevent key handling when disabled
                                                                                if (e.key === "Enter") {
                                                                                    e.preventDefault()
                                                                                    const value = e.target.value
                                                                                    const minutes = parseDurationToMinutes(value)
                                                                                    const finalMinutes = minutes !== null && minutes >= 0 ? minutes : displayTime
                                                                                    handleStationTimeChange(breed.id, station.id, finalMinutes.toString())
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
                                                                            onClick={() => cell.supported && handleToggleRemoteBooking(breed.id, station.id)}
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
                                                                            onClick={() => cell.supported && handleToggleApproval(breed.id, station.id)}
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
                                                                            onCheckedChange={() => handleToggleSupport(breed.id, station.id)}
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
                                                                            <h3 className="text-sm font-semibold text-gray-900">מחירים והערות עבור {breed.name}</h3>
                                                                            {hasPriceChanges && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        onClick={() => handleCancelBreedPrices(breed.id)}
                                                                                        disabled={savingBreedId === breed.id}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        <X className="h-3 w-3 ml-1" />
                                                                                        ביטול
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={() => handleSaveBreedPrices(breed.id)}
                                                                                        disabled={savingBreedId === breed.id}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        {savingBreedId === breed.id ? (
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
                                                                                <Label htmlFor={`size-${breed.id}`} className="text-xs text-gray-600">
                                                                                    גודל:
                                                                                </Label>
                                                                                <Select
                                                                                    value={editedPrices.size_class || "__none__"}
                                                                                    onValueChange={(value) => handlePriceChange(breed.id, 'size_class', value)}
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
                                                                                    options={dogTypes.map(type => ({ id: type.id, name: type.name }))}
                                                                                    selectedIds={getBreedTypes(breed.id)}
                                                                                    onSelectionChange={(selectedIds) => handleTypesChange(breed.id, selectedIds)}
                                                                                    placeholder="בחר קטגוריות ראשיות..."
                                                                                    className="w-full"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs text-gray-600">קטגוריות משנה</Label>
                                                                                <MultiSelectDropdown
                                                                                    options={dogCategories.map(category => ({ id: category.id, name: category.name }))}
                                                                                    selectedIds={getBreedCategories(breed.id)}
                                                                                    onSelectionChange={(selectedIds) => handleCategoriesChange(breed.id, selectedIds)}
                                                                                    placeholder="בחר קטגוריות משנה..."
                                                                                    className="w-full"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`min-price-${breed.id}`} className="text-xs text-gray-600">
                                                                                    מחיר מינימום טיפוח:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`min-price-${breed.id}`}
                                                                                    type="number"
                                                                                    step="1"
                                                                                    value={editedPrices.min_groom_price ?? ""}
                                                                                    onChange={(e) => handlePriceChange(breed.id, 'min_groom_price', e.target.value)}
                                                                                    placeholder="-"
                                                                                    className="h-8"
                                                                                    dir="rtl"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`max-price-${breed.id}`} className="text-xs text-gray-600">
                                                                                    מחיר מקסימום טיפוח:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`max-price-${breed.id}`}
                                                                                    type="number"
                                                                                    step="1"
                                                                                    value={editedPrices.max_groom_price ?? ""}
                                                                                    onChange={(e) => handlePriceChange(breed.id, 'max_groom_price', e.target.value)}
                                                                                    placeholder="-"
                                                                                    className="h-8"
                                                                                    dir="rtl"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <Label htmlFor={`hourly-price-${breed.id}`} className="text-xs text-gray-600">
                                                                                    מחיר שעתי:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`hourly-price-${breed.id}`}
                                                                                    type="number"
                                                                                    step="1"
                                                                                    value={editedPrices.hourly_price ?? ""}
                                                                                    onChange={(e) => handlePriceChange(breed.id, 'hourly_price', e.target.value)}
                                                                                    placeholder="-"
                                                                                    className="h-8"
                                                                                    dir="rtl"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor={`notes-${breed.id}`} className="text-xs text-gray-600">
                                                                                הערות:
                                                                            </Label>
                                                                            <Textarea
                                                                                id={`notes-${breed.id}`}
                                                                                value={editedPrices.notes || ""}
                                                                                onChange={(e) => handleNotesChange(breed.id, e.target.value)}
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

            <DuplicateBreedDialog
                open={isDuplicateBreedDialogOpen}
                onOpenChange={setIsDuplicateBreedDialogOpen}
                breed={breedToDuplicate}
                breeds={breeds}
                onConfirm={confirmDuplicateBreed}
                isDuplicating={isDuplicatingBreed}
            />

            {/* Delete Breed Dialog */}
            <DeleteBreedDialog
                open={isDeleteBreedDialogOpen}
                onOpenChange={setIsDeleteBreedDialogOpen}
                breed={breedToDelete}
                onConfirm={confirmDeleteBreed}
                isDeleting={isDeletingBreed}
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
