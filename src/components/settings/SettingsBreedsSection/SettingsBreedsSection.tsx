import { Fragment, useState, useEffect, useRef, useCallback } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Loader2, Search, X, Check, Copy, ChevronDown, ChevronUp, RefreshCw, Pencil, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { formatDurationFromMinutes, parseDurationToMinutes } from "@/lib/duration-utils"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DuplicateBreedDialog } from "../../dialogs/settings/breeds/DuplicateBreedDialog"
import { DeleteBreedDialog } from "../../dialogs/settings/breeds/DeleteBreedDialog"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { BulkBreedsDeleteDialog } from "../../dialogs/settings/breeds/BulkBreedsDeleteDialog"
import { BulkBreedsSizeDialog } from "../../dialogs/settings/breeds/BulkBreedsSizeDialog"
import { BulkBreedsCategoriesDialog } from "../../dialogs/settings/breeds/BulkBreedsCategoriesDialog"
import { useBreedsSettings } from "./SettingsBreedsSection.module"

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
    onCreateNew?: (name: string) => Promise<string | undefined>
    isCreating?: boolean
    onEdit?: (id: string, newName: string) => Promise<void>
    onDelete?: (id: string) => Promise<void>
    isEditing?: string | null
    onStartEdit?: (id: string) => void
    onCancelEdit?: () => void
    isDeleting?: string | null
    deleteConfirmOpen?: string | null
    onDeleteConfirmOpen?: (id: string | null) => void
}

function MultiSelectDropdown({
    options,
    selectedIds,
    onSelectionChange,
    placeholder = "בחר...",
    className,
    onCreateNew,
    isCreating = false,
    onEdit,
    onDelete,
    isEditing = null,
    onStartEdit,
    onCancelEdit,
    isDeleting = null,
    deleteConfirmOpen = null,
    onDeleteConfirmOpen,
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState<string | undefined>(undefined)
    const [editingText, setEditingText] = useState<string>("")
    const anchorRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleToggle = (optionId: string) => {
        if (isEditing === optionId) return // Don't toggle when editing
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

    // Check if we can add a new option
    const searchText = searchValue !== undefined ? searchValue.trim() : ""
    const exactMatch = searchText.length > 0
        ? options.find(opt => opt.name.toLowerCase() === searchText.toLowerCase())
        : null
    const canAddNew = onCreateNew && searchText.length > 0 && !exactMatch

    const handleCreateNew = async () => {
        if (!onCreateNew || !searchText || canAddNew === false) return
        try {
            const newId = await onCreateNew(searchText)
            setSearchValue("")
            // Auto-select the newly created item
            if (newId && !selectedIds.includes(newId)) {
                onSelectionChange([...selectedIds, newId])
            }
            // Keep dropdown open for further selection
        } catch (error) {
            console.error("Error creating new option:", error)
        }
    }

    const handleStartEdit = (optionId: string, currentName: string) => {
        if (onStartEdit) {
            onStartEdit(optionId)
            setEditingText(currentName)
        }
    }

    const handleSaveEdit = async (optionId: string) => {
        if (!onEdit || !editingText.trim()) return
        const option = options.find(opt => opt.id === optionId)
        if (option && editingText.trim() === option.name) {
            // No change, just cancel
            if (onCancelEdit) onCancelEdit()
            return
        }
        try {
            await onEdit(optionId, editingText.trim())
            if (onCancelEdit) onCancelEdit()
            setEditingText("")
        } catch (error) {
            console.error("Error editing option:", error)
        }
    }

    const handleCancelEdit = () => {
        if (onCancelEdit) onCancelEdit()
        setEditingText("")
    }

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
                                    if (e.key === "Enter" && canAddNew) {
                                        e.preventDefault()
                                        handleCreateNew()
                                    } else if (e.key === "Backspace" && searchValue === "") {
                                        // Remove last badge on backspace
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
                            onBlur={() => {
                                // Don't close on blur - let Popover handle it
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canAddNew) {
                                    e.preventDefault()
                                    handleCreateNew()
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
                            filteredOptions.map((option) => {
                                const isEditingThis = isEditing === option.id
                                return (
                                    <div
                                        key={option.id}
                                        onClick={() => {
                                            if (!isEditingThis) {
                                                handleToggle(option.id)
                                            }
                                        }}
                                        className={cn(
                                            "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm",
                                            !isEditingThis && "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        {isEditingThis ? (
                                            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault()
                                                            handleSaveEdit(option.id)
                                                        } else if (e.key === "Escape") {
                                                            e.preventDefault()
                                                            handleCancelEdit()
                                                        }
                                                    }}
                                                    autoFocus
                                                    className="h-8 text-sm flex-1"
                                                    dir="rtl"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => handleSaveEdit(option.id)}
                                                    disabled={isDeleting === option.id}
                                                >
                                                    {isDeleting === option.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Save className="h-3 w-3 text-green-600" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={handleCancelEdit}
                                                    disabled={isDeleting === option.id}
                                                >
                                                    <X className="h-3 w-3 text-gray-500" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center flex-1">
                                                    <Check
                                                        className={cn(
                                                            "ml-2 h-4 w-4 shrink-0",
                                                            selectedIds.includes(option.id) ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span>{option.name}</span>
                                                </div>
                                                {(onEdit || onDelete) && (
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {onEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 hover:bg-blue-50"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleStartEdit(option.id, option.name)
                                                                }}
                                                            >
                                                                <Pencil className="h-3 w-3 text-blue-500" />
                                                            </Button>
                                                        )}
                                                        {onDelete && (
                                                            <Popover
                                                                open={deleteConfirmOpen === option.id}
                                                                onOpenChange={(open) => {
                                                                    if (onDeleteConfirmOpen) {
                                                                        onDeleteConfirmOpen(open ? option.id : null)
                                                                    }
                                                                }}
                                                            >
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 hover:bg-red-50"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            if (onDeleteConfirmOpen) {
                                                                                onDeleteConfirmOpen(option.id)
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3 text-red-500" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-64" dir="rtl">
                                                                    <div className="space-y-3">
                                                                        <p className="text-sm text-right">
                                                                            האם אתה בטוח שברצונך למחוק את "{option.name}"?
                                                                        </p>
                                                                        <div className="flex justify-end gap-2">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    if (onDeleteConfirmOpen) {
                                                                                        onDeleteConfirmOpen(null)
                                                                                    }
                                                                                }}
                                                                                disabled={isDeleting === option.id}
                                                                            >
                                                                                ביטול
                                                                            </Button>
                                                                            <Button
                                                                                variant="destructive"
                                                                                size="sm"
                                                                                onClick={async () => {
                                                                                    if (onDelete) {
                                                                                        try {
                                                                                            await onDelete(option.id)
                                                                                            if (onDeleteConfirmOpen) {
                                                                                                onDeleteConfirmOpen(null)
                                                                                            }
                                                                                        } catch (error) {
                                                                                            console.error("Error deleting:", error)
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                disabled={isDeleting === option.id}
                                                                            >
                                                                                {isDeleting === option.id ? (
                                                                                    <>
                                                                                        <Loader2 className="h-3 w-3 animate-spin ml-1" />
                                                                                        מוחק...
                                                                                    </>
                                                                                ) : (
                                                                                    "מחק"
                                                                                )}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )
                            })
                        ) : (
                            !canAddNew && (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                    לא נמצאו תוצאות.
                                </div>
                            )
                        )}
                        {canAddNew && (
                            <div className={cn("p-1", filteredOptions.length > 0 ? "border-t" : "")}>
                                <div
                                    onClick={() => !isCreating && handleCreateNew()}
                                    className={cn(
                                        "flex items-center justify-between cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                                        isCreating && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <span>הוסף "{searchText}"</span>
                                    {isCreating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </div>
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
    // Note: is_active and remote_booking_allowed are no longer stored at breed level
    // They are calculated dynamically from station_breed_rules
}

type EditedBreed = Partial<Breed> & { id: string }

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface StationBreedRule {
    id?: string
    station_id: string
    breed_id: string
    is_active: boolean
    remote_booking_allowed: boolean
    requires_staff_approval?: boolean
    duration_modifier_minutes?: number | null
}

interface DogType {
    id: string
    name: string
}

interface DogCategory {
    id: string
    name: string
}

interface SettingsBreedsSectionProps {
    defaultDogCategoryId?: string | null
}

export function SettingsBreedsSection({ defaultDogCategoryId }: SettingsBreedsSectionProps = {}) {
    const { toast } = useToast()
    const [searchParams] = useSearchParams()
    const [breeds, setBreeds] = useState<Breed[]>([])
    const [filteredBreeds, setFilteredBreeds] = useState<Breed[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editedBreeds, setEditedBreeds] = useState<Record<string, EditedBreed>>({})
    const [savingBreedId, setSavingBreedId] = useState<string | null>(null)
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
    const [breedToDuplicate, setBreedToDuplicate] = useState<Breed | null>(null)
    const [isDuplicating, setIsDuplicating] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [breedToDelete, setBreedToDelete] = useState<Breed | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newBreedName, setNewBreedName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 50

    // Station management states
    const [expandedBreedId, setExpandedBreedId] = useState<string | null>(null)
    const [allStations, setAllStations] = useState<Station[]>([])
    const [stationBreedRules, setStationBreedRules] = useState<Record<string, Record<string, StationBreedRule>>>({})
    const [originalStationBreedRules, setOriginalStationBreedRules] = useState<Record<string, Record<string, StationBreedRule>>>({})
    const [loadingStations, setLoadingStations] = useState<string | null>(null)
    const [savingStationRules, setSavingStationRules] = useState<string | null>(null)
    const [globalDurationValue, setGlobalDurationValue] = useState<Record<string, number>>({})
    const [durationInputValues, setDurationInputValues] = useState<Record<string, Record<string, string>>>({})
    const [isTypingGlobal, setIsTypingGlobal] = useState<Record<string, boolean>>({})
    const [isTypingStation, setIsTypingStation] = useState<Record<string, Record<string, boolean>>>({})

    // Filter states
    const [selectedBreedIds, setSelectedBreedIds] = useState<string[]>([])
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const shiftPressedRef = useRef(false)
    const shiftKeyHeldRef = useRef(false)
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
    const [currentBulkAction, setCurrentBulkAction] = useState<"size" | "categories" | "delete" | null>(null)
    const [isBulkSizeDialogOpen, setIsBulkSizeDialogOpen] = useState(false)
    const [isBulkCategoriesDialogOpen, setIsBulkCategoriesDialogOpen] = useState(false)
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)

    // Filter states
    // Initialize searchTerm from URL param if present
    const initialSearchTerm = searchParams.get("search") || ""
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
    const [hasNotesFilter, setHasNotesFilter] = useState<"all" | "with" | "without">("all")
    const [remoteBookingFilter, setRemoteBookingFilter] = useState<"all" | "allowed" | "not-allowed" | "partially">("all")
    const [isActiveFilter, setIsActiveFilter] = useState<"all" | "active" | "inactive" | "partially">("all")
    const [priceFilterType, setPriceFilterType] = useState<"all" | "has-min" | "has-max" | "has-hourly" | "no-prices" | "min-lt" | "min-gt" | "max-lt" | "max-gt" | "hourly-lt" | "hourly-gt">("all")
    const [priceFilterValue, setPriceFilterValue] = useState<string>("")
    const [dogCategoryFilter, setDogCategoryFilter] = useState<string>("")
    const [dogCategoryFilterId, setDogCategoryFilterId] = useState<string | null>(defaultDogCategoryId ?? null)
    const defaultDogCategoryAppliedRef = useRef<string | null>(null)

    // Category states
    const [dogCategories, setDogCategories] = useState<DogCategory[]>([])
    const [breedCategoriesMap, setBreedCategoriesMap] = useState<Record<string, string[]>>({})
    const [editedCategoriesMap, setEditedCategoriesMap] = useState<Record<string, string[]>>({})
    const [isCreatingCategory, setIsCreatingCategory] = useState(false)
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
    const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] = useState<string | null>(null)
    const [isSavingEdit, setIsSavingEdit] = useState(false)

    // Sync searchTerm with URL param when it changes
    useEffect(() => {
        const searchParam = searchParams.get("search") || ""
        setSearchTerm(searchParam)
    }, [searchParams.get("search")])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Shift") {
                shiftKeyHeldRef.current = true
            }
        }

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Shift") {
                shiftKeyHeldRef.current = false
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    }, [])

    const searchDogCategories = useCallback(
        async (search: string, limit = 10) => {
            const trimmed = search.trim()
            console.log("🔍 [SettingsBreedsSection] Searching dog categories", { search: trimmed, limit })
            try {
                let query = supabase
                    .from("dog_categories")
                    .select("name")
                    .order("name")
                    .limit(limit)

                if (trimmed) {
                    query = query.ilike("name", `%${trimmed}%`)
                }

                const { data, error } = await query
                if (error) throw error

                const results = (data ?? []).map((item) => item.name)
                console.log("✅ [SettingsBreedsSection] Found dog categories", { count: results.length })
                return results
            } catch (error) {
                console.error("❌ [SettingsBreedsSection] Failed searching dog categories", { error })
                return []
            }
        },
        []
    )

    const handleDogCategoryFilterChange = (value: string) => {
        setDogCategoryFilter(value)
        if (!value.trim()) {
            setDogCategoryFilterId(null)
            return
        }
        const match = dogCategories.find((category) => category.name === value.trim())
        setDogCategoryFilterId(match ? match.id : null)
    }

    // Handler for creating new category
    const handleCreateNewCategory = async (name: string): Promise<string | undefined> => {
        if (!name.trim()) return undefined
        setIsCreatingCategory(true)
        try {
            const { data, error } = await supabase
                .from("dog_categories")
                .insert({ name: name.trim() })
                .select()
                .single()

            if (error && error.code !== "23505") {
                // 23505 is unique violation - ignore if already exists
                throw error
            }

            // If already exists, fetch it
            if (error && error.code === "23505") {
                const { data: existing } = await supabase
                    .from("dog_categories")
                    .select("*")
                    .eq("name", name.trim())
                    .single()

                if (existing) {
                    setDogCategories(prev => [...prev, existing])
                    toast({
                        title: "הצלחה",
                        description: `הקטגוריה "${name.trim()}" כבר קיימת`,
                    })
                    return existing.id
                }
            }

            if (data) {
                setDogCategories(prev => [...prev, data])
                toast({
                    title: "הצלחה",
                    description: `הקטגוריה "${name.trim()}" נוספה בהצלחה`,
                })
                return data.id
            }
            return undefined
        } catch (error) {
            console.error("Error creating new category:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף קטגוריה משנה",
                variant: "destructive",
            })
            return undefined
        } finally {
            setIsCreatingCategory(false)
        }
    }

    // Handler for editing category
    const handleEditCategory = async (id: string, newName: string) => {
        if (!newName.trim()) return

        const category = dogCategories.find(c => c.id === id)
        if (category && newName.trim() === category.name) {
            setEditingCategoryId(null)
            return
        }

        setIsSavingEdit(true)
        try {
            // Check if new name already exists
            const { data: existing, error: checkError } = await supabase
                .from("dog_categories")
                .select("id")
                .eq("name", newName.trim())
                .maybeSingle()

            if (checkError) {
                throw checkError
            }

            if (existing && existing.id !== id) {
                toast({
                    title: "שגיאה",
                    description: `קטגוריה בשם "${newName.trim()}" כבר קיימת`,
                    variant: "destructive",
                })
                return
            }

            // Update the category
            const { error } = await supabase
                .from("dog_categories")
                .update({ name: newName.trim() })
                .eq("id", id)

            if (error) throw error

            // Update local state
            setDogCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName.trim() } : c))

            setEditingCategoryId(null)
            toast({
                title: "הצלחה",
                description: `הקטגוריה עודכנה בהצלחה`,
            })
        } catch (error) {
            console.error("Error editing category:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לערוך קטגוריה משנה",
                variant: "destructive",
            })
        } finally {
            setIsSavingEdit(false)
        }
    }

    // Handler for deleting category
    const handleDeleteCategory = async (id: string) => {
        setDeletingCategoryId(id)
        try {
            const category = dogCategories.find(c => c.id === id)
            if (!category) return

            // First, delete all relationships
            const { error: relationsError } = await supabase
                .from("breed_dog_categories")
                .delete()
                .eq("dog_category_id", id)

            if (relationsError) throw relationsError

            // Then delete the category itself
            const { error } = await supabase
                .from("dog_categories")
                .delete()
                .eq("id", id)

            if (error) throw error

            // Update local state
            setDogCategories(prev => prev.filter(c => c.id !== id))

            // Remove from all breed selections
            const updatedCategoriesMap: Record<string, string[]> = {}
            Object.keys(breedCategoriesMap).forEach(breedId => {
                updatedCategoriesMap[breedId] = breedCategoriesMap[breedId].filter(categoryId => categoryId !== id)
            })
            setBreedCategoriesMap(updatedCategoriesMap)

            // Also remove from edited categories
            const updatedEditedCategories: Record<string, string[]> = {}
            Object.keys(editedCategoriesMap).forEach(breedId => {
                updatedEditedCategories[breedId] = (editedCategoriesMap[breedId] || []).filter(categoryId => categoryId !== id)
            })
            setEditedCategoriesMap(updatedEditedCategories)

            toast({
                title: "הצלחה",
                description: `הקטגוריה "${category.name}" נמחקה בהצלחה`,
            })
        } catch (error) {
            console.error("Error deleting category:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק קטגוריה משנה",
                variant: "destructive",
            })
        } finally {
            setDeletingCategoryId(null)
        }
    }

    // Data loading is handled by useBreedsSettings hook

    // Load all data using the API module hook
    const { data: settingsData, isLoading: isLoadingSettings, error: settingsError, refetch } = useBreedsSettings()

    // Sync settings data to component state
    useEffect(() => {
        if (settingsData) {
            setBreeds(settingsData.breeds || [])
            setFilteredBreeds(settingsData.breeds || [])
            setAllStations(settingsData.stations || [])
            setStationBreedRules(settingsData.stationBreedRules || {})
            setDurationInputValues(settingsData.durationInputValues || {})
            setDogCategories(settingsData.dogCategories || [])
            setBreedCategoriesMap(settingsData.breedCategoriesMap || {})

            // Create original rules map for change tracking
            const originalRulesMap: Record<string, Record<string, StationBreedRule>> = {}
            Object.keys(settingsData.stationBreedRules || {}).forEach((breedId) => {
                originalRulesMap[breedId] = JSON.parse(JSON.stringify(settingsData.stationBreedRules[breedId]))
            })
            setOriginalStationBreedRules(originalRulesMap)
        }
    }, [settingsData])

    useEffect(() => {
        setIsLoading(isLoadingSettings)
    }, [isLoadingSettings])

    useEffect(() => {
        if (settingsError && settingsError.message) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את הנתונים",
                variant: "destructive",
            })
        }
    }, [settingsError, toast])

    const loadAllDataFromBackend = async (_showLoading: boolean = true) => {
        await refetch()
    }

    // Load all station breed rules for all breeds at once - much more efficient
    const loadAllStationBreedRules = async () => {
        if (allStations.length === 0 || breeds.length === 0) {
            return
        }

        try {
            console.log("[SettingsBreedsSection] Loading all station breed rules...")

            // Fetch all station breed rules for all breeds in a single query
            const { data, error } = await supabase
                .from("station_breed_rules")
                .select("*")
                .in("breed_id", breeds.map(b => b.id))

            if (error) throw error

            console.log("[SettingsBreedsSection] Fetched", data?.length || 0, "station breed rules")

            // Group rules by breed_id
            const rulesByBreed: Record<string, StationBreedRule[]> = {}
            breeds.forEach(breed => {
                rulesByBreed[breed.id] = data?.filter(r => r.breed_id === breed.id) || []
            })

            // Process each breed's rules
            const allRulesMap: Record<string, Record<string, StationBreedRule>> = {}
            const allDurationInputValues: Record<string, Record<string, string>> = {}
            const allOriginalRulesMap: Record<string, Record<string, StationBreedRule>> = {}

            breeds.forEach((breed) => {
                const breedRules = rulesByBreed[breed.id] || []
                const rulesMap: Record<string, StationBreedRule> = {}
                const inputValuesMap: Record<string, string> = {}

                // Initialize all stations with default values or existing rules
                allStations.forEach((station) => {
                    const existingRule = breedRules.find((r) => r.station_id === station.id)
                    if (existingRule) {
                        const minutes = existingRule.duration_modifier_minutes ?? 0
                        rulesMap[station.id] = {
                            id: existingRule.id,
                            station_id: station.id,
                            breed_id: breed.id,
                            is_active: existingRule.is_active ?? true,
                            remote_booking_allowed: existingRule.remote_booking_allowed ?? false,
                            requires_staff_approval: existingRule.requires_staff_approval ?? false,
                            duration_modifier_minutes: minutes,
                        }
                        inputValuesMap[station.id] = formatDurationFromMinutes(minutes)
                    } else {
                        // Create default rule for stations that don't have one
                        rulesMap[station.id] = {
                            station_id: station.id,
                            breed_id: breed.id,
                            is_active: true,
                            remote_booking_allowed: false,
                            requires_staff_approval: false,
                            duration_modifier_minutes: 0,
                        }
                        inputValuesMap[station.id] = formatDurationFromMinutes(0)
                    }
                })

                allRulesMap[breed.id] = rulesMap
                allDurationInputValues[breed.id] = inputValuesMap
                allOriginalRulesMap[breed.id] = JSON.parse(JSON.stringify(rulesMap))
            })

            setStationBreedRules(allRulesMap)
            setDurationInputValues(allDurationInputValues)
            setOriginalStationBreedRules(allOriginalRulesMap)

            console.log("[SettingsBreedsSection] Loaded all station breed rules for", breeds.length, "breeds")
        } catch (error) {
            console.error("Error loading all station breed rules:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את נתוני העמדות",
                variant: "destructive",
            })
        }
    }

    const loadStationBreedRules = async (breedId: string) => {
        // If rules are already loaded, don't reload
        if (stationBreedRules[breedId] && Object.keys(stationBreedRules[breedId]).length > 0) {
            return
        }
        if (allStations.length === 0) {
            console.log("[SettingsBreedsSection] Stations not loaded yet, waiting...")
            // Wait a bit and try again (stations should be loading)
            setTimeout(() => {
                if (allStations.length > 0) {
                    loadStationBreedRules(breedId)
                } else {
                    setLoadingStations(null)
                }
            }, 500)
            return
        }

        setLoadingStations(breedId)
        try {
            const { data, error } = await supabase
                .from("station_breed_rules")
                .select("*")
                .eq("breed_id", breedId)

            if (error) throw error

            // Create a map of station_id -> rule
            const rulesMap: Record<string, StationBreedRule> = {}

            // Initialize all stations with default values
            allStations.forEach((station) => {
                const existingRule = data?.find((r) => r.station_id === station.id)
                if (existingRule) {
                    const minutes = existingRule.duration_modifier_minutes ?? 0
                    rulesMap[station.id] = {
                        id: existingRule.id,
                        station_id: station.id,
                        breed_id: breedId,
                        is_active: existingRule.is_active ?? true,
                        remote_booking_allowed: existingRule.remote_booking_allowed ?? false,
                        requires_staff_approval: existingRule.requires_staff_approval ?? false,
                        duration_modifier_minutes: minutes,
                    }
                } else {
                    // Create default rule for stations that don't have one
                    rulesMap[station.id] = {
                        station_id: station.id,
                        breed_id: breedId,
                        is_active: true,
                        remote_booking_allowed: false,
                        requires_staff_approval: false,
                        duration_modifier_minutes: 0,
                    }
                }
            })

            // Initialize duration input values
            const inputValuesMap: Record<string, string> = {}
            allStations.forEach((station) => {
                const existingRule = data?.find((r) => r.station_id === station.id)
                const minutes = existingRule?.duration_modifier_minutes ?? 0
                inputValuesMap[station.id] = formatDurationFromMinutes(minutes)
            })

            // Deep clone for original state tracking
            const originalRulesMap = JSON.parse(JSON.stringify(rulesMap))

            setStationBreedRules((prev) => ({
                ...prev,
                [breedId]: rulesMap,
            }))

            // Initialize duration input values
            setDurationInputValues((prev) => ({
                ...prev,
                [breedId]: inputValuesMap,
            }))

            setOriginalStationBreedRules((prev) => ({
                ...prev,
                [breedId]: originalRulesMap,
            }))

            console.log("[SettingsBreedsSection] Loaded station rules for breed:", breedId, rulesMap)
        } catch (error) {
            console.error("Error loading station breed rules:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את נתוני העמדות",
                variant: "destructive",
            })
        } finally {
            setLoadingStations(null)
        }
    }

    const toggleBreedExpand = (breedId: string) => {
        setExpandedBreedId((prev) => {
            // If clicking the same breed, collapse it
            if (prev === breedId) {
                setLoadingStations(null)
                return null
            }
            // Otherwise, expand the new breed (this automatically collapses the previous one)
            // Rules should already be loaded by loadAllDataFromBackend, but if not, load them as fallback
            if (!stationBreedRules[breedId] || Object.keys(stationBreedRules[breedId]).length === 0) {
                setLoadingStations(breedId)
                loadStationBreedRules(breedId)
            }
            return breedId
        })
    }

    // Calculate parent checkbox state based on child stations
    // Note: Breed-level is_active, remote_booking_allowed, and requires_staff_approval are no longer stored in DB
    // They are always calculated from station rules
    // The parent checkbox should reflect ALL stations, not just active ones
    const getParentCheckboxState = (
        breedId: string,
        field: "is_active" | "remote_booking_allowed" | "requires_staff_approval"
    ): { checked: boolean; indeterminate: boolean } => {
        const breedRules = stationBreedRules[breedId]
        if (!breedRules || Object.keys(breedRules).length === 0) {
            // No station rules loaded yet - return unchecked (not indeterminate)
            return { checked: false, indeterminate: false }
        }

        // Consider ALL stations when calculating parent checkbox state
        // This ensures the parent accurately reflects the status of all its children
        const rulesToCheck = Object.values(breedRules)

        if (rulesToCheck.length === 0) {
            return { checked: false, indeterminate: false }
        }

        // Normalize values: treat undefined/null as false
        const stationValues = rulesToCheck.map((rule) => {
            const value = rule[field]
            return value === true
        })
        const allChecked = stationValues.every((v) => v === true)
        const allUnchecked = stationValues.every((v) => v === false)

        if (allChecked) {
            return { checked: true, indeterminate: false }
        } else if (allUnchecked) {
            return { checked: false, indeterminate: false }
        } else {
            // Mixed state - some checked, some unchecked
            return { checked: false, indeterminate: true }
        }
    }

    // Sync all child stations when parent checkbox is clicked
    // Note: This only updates station rules, NOT breed-level fields
    // Breed-level is_active, remote_booking_allowed, and requires_staff_approval are calculated from stations
    const handleParentCheckboxChange = (
        breedId: string,
        field: "is_active" | "remote_booking_allowed" | "requires_staff_approval",
        checked: boolean
    ) => {
        const breedRules = stationBreedRules[breedId]
        if (!breedRules || Object.keys(breedRules).length === 0) {
            // If no station rules loaded, do nothing (can't sync what doesn't exist)
            return
        }

        // Update all station rules for this breed
        // This does NOT mark the breed row as dirty - only station rule changes do
        setStationBreedRules((prev) => {
            const breedRules = prev[breedId] || {}
            const updatedRules: Record<string, StationBreedRule> = {}

            Object.keys(breedRules).forEach((stationId) => {
                updatedRules[stationId] = {
                    ...breedRules[stationId],
                    [field]: checked,
                }
            })

            return {
                ...prev,
                [breedId]: updatedRules,
            }
        })
    }

    const handleStationRuleChange = (breedId: string, stationId: string, field: "is_active" | "remote_booking_allowed" | "requires_staff_approval" | "duration_modifier_minutes", value: boolean | number | null) => {
        setStationBreedRules((prev) => {
            const breedRules = prev[breedId] || {}
            const updatedRules = { ...breedRules }

            // Update the target station
            updatedRules[stationId] = {
                ...breedRules[stationId],
                [field]: value,
            }

            return {
                ...prev,
                [breedId]: updatedRules,
            }
        })
    }


    // Calculate the global duration value from all station times
    // Returns the common value if all stations have the same time, null otherwise
    const getGlobalDurationFromStations = (breedId: string): number | null => {
        const breedRules = stationBreedRules[breedId]
        if (!breedRules || Object.keys(breedRules).length === 0) {
            return null
        }

        const stationMinutes = Object.values(breedRules).map((rule) => rule.duration_modifier_minutes ?? 0)
        if (stationMinutes.length === 0) {
            return null
        }

        // Check if all stations have the same time
        const firstValue = stationMinutes[0]
        const allSame = stationMinutes.every((minutes) => minutes === firstValue)

        return allSame ? firstValue : null
    }

    const handleApplyTimeToAll = (breedId: string, durationString: string) => {
        const timeMinutes = parseDurationToMinutes(durationString)

        if (timeMinutes === null || timeMinutes < 0) {
            toast({
                title: "שגיאה",
                description: "אנא הכנס זמן תקין בפורמט שעות:דקות (למשל: 1:30)",
                variant: "destructive",
            })
            return
        }

        const breedRules = stationBreedRules[breedId]
        if (!breedRules) return

        // Update time for all stations
        setStationBreedRules((prev) => {
            const breedRules = prev[breedId] || {}
            const updatedRules: Record<string, StationBreedRule> = {}

            // Update all stations with the new time
            Object.keys(breedRules).forEach((stationId) => {
                updatedRules[stationId] = {
                    ...breedRules[stationId],
                    duration_modifier_minutes: timeMinutes,
                }
            })

            // Update duration input values for all stations
            const inputValuesMap: Record<string, string> = {}
            Object.keys(breedRules).forEach((stationId) => {
                inputValuesMap[stationId] = formatDurationFromMinutes(timeMinutes)
            })

            setDurationInputValues((prev) => ({
                ...prev,
                [breedId]: inputValuesMap,
            }))

            return {
                ...prev,
                [breedId]: updatedRules,
            }
        })

        // Update global duration value to match
        setGlobalDurationValue((prev) => ({
            ...prev,
            [breedId]: timeMinutes,
        }))

        const durationStr = formatDurationFromMinutes(timeMinutes)
        toast({
            title: "בוצע",
            description: `הוגדר זמן ${durationStr} לכל העמדות`,
        })
    }

    const handleSaveStationRules = async (breedId: string) => {
        const breedRules = stationBreedRules[breedId]
        if (!breedRules) {
            toast({
                title: "שגיאה",
                description: "אין הגדרות עמדות לשמירה",
                variant: "destructive",
            })
            return
        }

        const breed = breeds.find((b) => b.id === breedId)
        if (!breed) {
            toast({
                title: "שגיאה",
                description: "גזע לא נמצא",
                variant: "destructive",
            })
            return
        }

        setSavingStationRules(breedId)
        try {
            const rulesToSave = Object.values(breedRules)

            // Prepare data for batch upsert (Supabase upsert uses ON CONFLICT on unique constraint)
            const rulesData = rulesToSave.map((rule) => ({
                station_id: rule.station_id,
                breed_id: rule.breed_id,
                is_active: rule.is_active,
                remote_booking_allowed: rule.remote_booking_allowed,
                requires_staff_approval: rule.requires_staff_approval ?? false,
                duration_modifier_minutes: rule.duration_modifier_minutes ?? 0,
            }))

            // Use upsert with conflict resolution on the unique constraint (station_id, breed_id)
            // This handles both inserts and updates in a single API call
            const { data: upsertedRules, error: upsertError } = await supabase
                .from("station_breed_rules")
                .upsert(rulesData, {
                    onConflict: "station_id,breed_id",
                })
                .select("id,station_id,breed_id")

            if (upsertError) throw upsertError

            console.log("[SettingsBreedsSection] Batch upserted station rules:", upsertedRules?.length || 0, "rules")
            // Note: We no longer update breed-level is_active or remote_booking_allowed
            // These are now calculated dynamically from station rules

            toast({
                title: "הצלחה",
                description: "הגדרות העמדות נשמרו בהצלחה",
            })

            // Update the original state with the saved rules (including new IDs from upsert)
            const updatedRulesMap = JSON.parse(JSON.stringify(breedRules))
            setOriginalStationBreedRules((prev) => ({
                ...prev,
                [breedId]: updatedRulesMap,
            }))

            // Reload data in the background silently (no loading state, no flicker)
            // This ensures consistency without disrupting the UI
            loadAllDataFromBackend(false).catch((error) => {
                console.error("[SettingsBreedsSection] Background refresh failed:", error)
                // Silent failure - data was already saved successfully
            })
        } catch (error) {
            console.error("Error saving station rules:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את הגדרות העמדות"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingStationRules(null)
        }
    }

    const handleCancelStationRules = (breedId: string) => {
        const originalRules = originalStationBreedRules[breedId]
        if (!originalRules) {
            // No original state, just reload all data silently
            loadAllDataFromBackend(false).catch((error) => {
                console.error("[SettingsBreedsSection] Background refresh failed:", error)
            })
            return
        }

        // Restore original state
        const restoredRules = JSON.parse(JSON.stringify(originalRules))
        setStationBreedRules((prev) => ({
            ...prev,
            [breedId]: restoredRules,
        }))

        toast({
            title: "בוטל",
            description: "השינויים בוטלו",
        })
    }

    const hasStationRuleChanges = (breedId: string): boolean => {
        const currentRules = stationBreedRules[breedId]
        const originalRules = originalStationBreedRules[breedId]

        if (!currentRules || !originalRules) return false

        // Compare all station rules
        for (const stationId in currentRules) {
            const current = currentRules[stationId]
            const original = originalRules[stationId]

            if (!original) return true

            if (current.is_active !== original.is_active ||
                current.remote_booking_allowed !== original.remote_booking_allowed ||
                (current.duration_modifier_minutes ?? 0) !== (original.duration_modifier_minutes ?? 0)) {
                return true
            }
        }

        return false
    }

    const handleCheckboxPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        shiftPressedRef.current = event.shiftKey || shiftKeyHeldRef.current
    }

    const handleCheckboxPointerUpOrLeave = () => {
        shiftPressedRef.current = false
    }

    const handleSelectAllChange = (value: boolean | "indeterminate") => {
        if (value) {
            const ids = filteredBreeds.map((breed) => breed.id)
            setSelectedBreedIds(ids)
            setLastSelectedIndex(null)
        } else {
            setSelectedBreedIds([])
            setLastSelectedIndex(null)
        }
    }

    const handleBreedSelectionChange = (breedId: string, isChecked: boolean, index: number) => {
        setSelectedBreedIds((prev) => {
            const selectionSet = new Set(prev)
            if (isChecked) {
                selectionSet.add(breedId)
            } else {
                selectionSet.delete(breedId)
            }

            const isShiftSelection =
                (shiftPressedRef.current || shiftKeyHeldRef.current) &&
                lastSelectedIndex !== null &&
                lastSelectedIndex !== index

            if (isShiftSelection) {
                const start = Math.min(lastSelectedIndex!, index)
                const end = Math.max(lastSelectedIndex!, index)
                const rangeIds = filteredBreeds.slice(start, end + 1).map((breed) => breed.id)

                if (isChecked) {
                    rangeIds.forEach((id) => selectionSet.add(id))
                } else {
                    rangeIds.forEach((id) => selectionSet.delete(id))
                }
            }

            return filteredBreeds.map((breed) => breed.id).filter((id) => selectionSet.has(id))
        })

        if (isChecked) {
            setLastSelectedIndex(index)
        } else if (!shiftPressedRef.current) {
            setLastSelectedIndex(null)
        }

        shiftPressedRef.current = false
    }

    const clearSelection = () => {
        setSelectedBreedIds([])
        setLastSelectedIndex(null)
    }

    const handleBulkSizeConfirm = async (sizeClass: "small" | "medium" | "medium_large" | "large" | null) => {
        if (selectedBreedIds.length === 0) return
        console.log("🛠️ [SettingsBreedsSection] Bulk updating breed size", { selectedBreedIds, sizeClass })
        setCurrentBulkAction("size")
        setIsBulkActionLoading(true)
        try {
            const { error } = await supabase
                .from("breeds")
                .update({ size_class: sizeClass })
                .in("id", selectedBreedIds)

            if (error) throw error

            setBreeds((prev) =>
                prev.map((breed) =>
                    selectedBreedIds.includes(breed.id) ? { ...breed, size_class: sizeClass } : breed
                )
            )
            setFilteredBreeds((prev) =>
                prev.map((breed) =>
                    selectedBreedIds.includes(breed.id) ? { ...breed, size_class: sizeClass } : breed
                )
            )

            toast({
                title: "עודכן בהצלחה",
                description: `גודל הגזע עודכן עבור ${selectedBreedIds.length} גזעים`,
            })

            setIsBulkSizeDialogOpen(false)
            clearSelection()
        } catch (error) {
            console.error("❌ [SettingsBreedsSection] Failed bulk size update", { error })
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את גודל הגזעים שנבחרו",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const handleBulkCategoriesConfirm = async ({
        categoryIds,
    }: {
        categoryIds: string[]
    }) => {
        if (selectedBreedIds.length === 0) return
        if (!categoryIds || categoryIds.length === 0) {
            toast({
                title: "לא נבחרו פעולות",
                description: "בחר קטגוריות לעדכון.",
            })
            return
        }

        console.log("🛠️ [SettingsBreedsSection] Bulk updating breed categories", {
            selectedBreedIds,
            categoryIds,
        })

        setCurrentBulkAction("categories")
        setIsBulkActionLoading(true)

        try {
            // Update categories
            const { error: deleteCategoriesError } = await supabase
                .from("breed_dog_categories")
                .delete()
                .in("breed_id", selectedBreedIds)
            if (deleteCategoriesError) throw deleteCategoriesError

            if (categoryIds.length > 0) {
                const insertRows = selectedBreedIds.flatMap((breedId) =>
                    categoryIds.map((categoryId) => ({
                        breed_id: breedId,
                        dog_category_id: categoryId,
                    }))
                )
                const { error: insertCategoriesError } = await supabase
                    .from("breed_dog_categories")
                    .insert(insertRows)
                if (insertCategoriesError) throw insertCategoriesError
            }

            setBreedCategoriesMap((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => {
                    updated[id] = [...categoryIds]
                })
                return updated
            })

            setEditedCategoriesMap((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => {
                    delete updated[id]
                })
                return updated
            })

            toast({
                title: "עודכן בהצלחה",
                description: `הקטגוריות עודכנו עבור ${selectedBreedIds.length} גזעים`,
            })

            setIsBulkCategoriesDialogOpen(false)
            clearSelection()
        } catch (error) {
            console.error("❌ [SettingsBreedsSection] Failed bulk categories update", { error })
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את הקטגוריות לגזעים שנבחרו",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const handleBulkDeleteConfirm = async () => {
        if (selectedBreedIds.length === 0) return
        console.log("🗑️ [SettingsBreedsSection] Bulk deleting breeds", { selectedBreedIds })
        setCurrentBulkAction("delete")
        setIsBulkActionLoading(true)
        try {
            const { error } = await supabase.from("breeds").delete().in("id", selectedBreedIds)
            if (error) throw error

            setBreeds((prev) => prev.filter((breed) => !selectedBreedIds.includes(breed.id)))
            setFilteredBreeds((prev) => {
                const updated = prev.filter((breed) => !selectedBreedIds.includes(breed.id))
                setCurrentPage((page) => {
                    const maxPage = Math.max(1, Math.ceil(Math.max(updated.length, 1) / ITEMS_PER_PAGE))
                    return Math.min(page, maxPage)
                })
                return updated
            })

            setBreedCategoriesMap((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setEditedBreeds((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setEditedCategoriesMap((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setStationBreedRules((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setOriginalStationBreedRules((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setDurationInputValues((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setGlobalDurationValue((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setIsTypingStation((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setTogglingRemoteBooking((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })
            setTogglingApproval((prev) => {
                const updated = { ...prev }
                selectedBreedIds.forEach((id) => delete updated[id])
                return updated
            })

            toast({
                title: "הצלחה",
                description: `נמחקו ${selectedBreedIds.length} גזעים בהצלחה`,
            })

            setIsBulkDeleteDialogOpen(false)
            clearSelection()
        } catch (error) {
            console.error("❌ [SettingsBreedsSection] Failed bulk delete", { error })
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את הגזעים שנבחרו",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    useEffect(() => {
        setSelectedBreedIds((prev) => prev.filter((id) => breeds.some((breed) => breed.id === id)))
    }, [breeds])

    // Filter breeds based on search and filters
    useEffect(() => {
        let filtered = [...breeds]

        // Search by name
        if (searchTerm.trim()) {
            filtered = filtered.filter((breed) =>
                breed.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Filter by notes
        if (hasNotesFilter === "with") {
            filtered = filtered.filter((breed) => breed.notes && breed.notes.trim().length > 0)
        } else if (hasNotesFilter === "without") {
            filtered = filtered.filter((breed) => !breed.notes || breed.notes.trim().length === 0)
        }

        // Filter by remote booking (calculated from station rules)
        if (remoteBookingFilter === "allowed") {
            filtered = filtered.filter((breed) => {
                const state = getParentCheckboxState(breed.id, "remote_booking_allowed")
                return state.checked === true && !state.indeterminate
            })
        } else if (remoteBookingFilter === "not-allowed") {
            filtered = filtered.filter((breed) => {
                const state = getParentCheckboxState(breed.id, "remote_booking_allowed")
                return state.checked === false && !state.indeterminate
            })
        } else if (remoteBookingFilter === "partially") {
            filtered = filtered.filter((breed) => {
                const state = getParentCheckboxState(breed.id, "remote_booking_allowed")
                return state.indeterminate === true
            })
        }

        // Filter by is_active (calculated from station rules)
        if (isActiveFilter === "active") {
            filtered = filtered.filter((breed) => {
                const state = getParentCheckboxState(breed.id, "is_active")
                return state.checked === true && !state.indeterminate
            })
        } else if (isActiveFilter === "inactive") {
            filtered = filtered.filter((breed) => {
                const state = getParentCheckboxState(breed.id, "is_active")
                return state.checked === false && !state.indeterminate
            })
        } else if (isActiveFilter === "partially") {
            filtered = filtered.filter((breed) => {
                const state = getParentCheckboxState(breed.id, "is_active")
                return state.indeterminate === true
            })
        }

        // Filter by pricing
        if (priceFilterType === "has-min") {
            filtered = filtered.filter((breed) => breed.min_groom_price != null)
        } else if (priceFilterType === "has-max") {
            filtered = filtered.filter((breed) => breed.max_groom_price != null)
        } else if (priceFilterType === "has-hourly") {
            filtered = filtered.filter((breed) => breed.hourly_price != null)
        } else if (priceFilterType === "no-prices") {
            filtered = filtered.filter(
                (breed) =>
                    breed.min_groom_price == null &&
                    breed.max_groom_price == null &&
                    breed.hourly_price == null
            )
        } else if (priceFilterType === "min-lt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((breed) => breed.min_groom_price != null && breed.min_groom_price < value)
            }
        } else if (priceFilterType === "min-gt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((breed) => breed.min_groom_price != null && breed.min_groom_price > value)
            }
        } else if (priceFilterType === "max-lt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((breed) => breed.max_groom_price != null && breed.max_groom_price < value)
            }
        } else if (priceFilterType === "max-gt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((breed) => breed.max_groom_price != null && breed.max_groom_price > value)
            }
        } else if (priceFilterType === "hourly-lt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((breed) => breed.hourly_price != null && breed.hourly_price < value)
            }
        } else if (priceFilterType === "hourly-gt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((breed) => breed.hourly_price != null && breed.hourly_price > value)
            }
        }

        if (dogCategoryFilterId) {
            filtered = filtered.filter((breed) => getBreedCategories(breed.id).includes(dogCategoryFilterId))
        } else if (dogCategoryFilter.trim()) {
            const normalizedCategory = dogCategoryFilter.trim().toLowerCase()
            filtered = filtered.filter((breed) => {
                const categoryIds = getBreedCategories(breed.id)
                return categoryIds.some((categoryId) => {
                    const categoryName = dogCategories.find((category) => category.id === categoryId)?.name?.toLowerCase() ?? ""
                    return categoryName.includes(normalizedCategory)
                })
            })
        }

        setFilteredBreeds(filtered)
        setCurrentPage(1) // Reset to first page when filters change
    }, [
        breeds,
        searchTerm,
        hasNotesFilter,
        remoteBookingFilter,
        isActiveFilter,
        priceFilterType,
        priceFilterValue,
        stationBreedRules,
        dogCategoryFilter,
        dogCategoryFilterId,
        dogCategories,
        breedCategoriesMap,
    ])

    const fetchBreeds = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from("breeds")
                .select("*")
                .order("name")

            if (error) throw error
            const fetchedBreeds = data || []
            setBreeds(fetchedBreeds)
            setFilteredBreeds(fetchedBreeds)
            setEditedBreeds({}) // Clear edited state on fetch
        } catch (error) {
            console.error("Error fetching breeds:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את רשימת הגזעים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleAdd = () => {
        setIsAddDialogOpen(true)
    }

    const confirmAddBreed = () => {
        if (!newBreedName.trim()) {
            toast({
                title: "שגיאה",
                description: "שם הגזע נדרש",
                variant: "destructive",
            })
            return
        }

        setIsAdding(true)
        try {
            const newId = `new-${Date.now()}`
            const newBreed: Breed = {
                id: newId,
                name: newBreedName.trim(),
                min_groom_price: null,
                max_groom_price: null,
                hourly_price: null,
                notes: null,
                // Note: is_active and remote_booking_allowed are calculated from station_breed_rules
            }
            const updatedBreeds = [...breeds, newBreed]
            setBreeds(updatedBreeds)
            setEditedBreeds({ ...editedBreeds, [newId]: { ...newBreed } })

            setNewBreedName("")
            setIsAddDialogOpen(false)

            // Force scroll to the new row after a brief delay to allow rendering
            setTimeout(() => {
                const element = document.querySelector(`[data-breed-id="${newId}"]`)
                element?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }, 100)
        } catch (error: unknown) {
            console.error("Error adding breed:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף את הגזע",
                variant: "destructive",
            })
        } finally {
            setIsAdding(false)
        }
    }

    const handleDuplicate = (breed: Breed) => {
        setBreedToDuplicate(breed)
        setIsDuplicateDialogOpen(true)
    }

    const confirmDuplicateBreed = async (params: {
        mode: "new" | "existing"
        name?: string
        targetBreedIds?: string[]
        copyDetails: boolean
        copyStationRelations: boolean
    }) => {
        if (!breedToDuplicate) return

        setIsDuplicating(true)
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
                if (params.copyStationRelations) {
                    const originalRules = stationBreedRules[sourceBreedId] || {}
                    const rulesToInsert = Object.values(originalRules).map(rule => ({
                        station_id: rule.station_id,
                        breed_id: newBreedId,
                        is_active: rule.is_active ?? true,
                        remote_booking_allowed: rule.remote_booking_allowed ?? false,
                        requires_staff_approval: rule.requires_staff_approval ?? false,
                        duration_modifier_minutes: rule.duration_modifier_minutes ?? 0,
                    }))

                    if (rulesToInsert.length > 0) {
                        const { error: rulesError } = await supabase
                            .from("station_breed_rules")
                            .insert(rulesToInsert)
                        if (rulesError) throw rulesError
                    }
                }

                toast({
                    title: "הצלחה",
                    description: "הגזע שוכפל בהצלחה עם כל הערכים",
                })

                setIsDuplicateDialogOpen(false)

                // Reload all data from backend to include the new breed with all its data (silently)
                loadAllDataFromBackend(false).catch((error) => {
                    console.error("[SettingsBreedsSection] Background refresh failed:", error)
                })
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
                    if (params.copyStationRelations) {
                        const originalRules = stationBreedRules[sourceBreedId] || {}
                        const rulesToInsert = Object.values(originalRules).map(rule => ({
                            station_id: rule.station_id,
                            breed_id: targetId,
                            is_active: rule.is_active ?? true,
                            remote_booking_allowed: rule.remote_booking_allowed ?? false,
                            requires_staff_approval: rule.requires_staff_approval ?? false,
                            duration_modifier_minutes: rule.duration_modifier_minutes ?? 0,
                        }))

                        if (rulesToInsert.length > 0) {
                            // Delete existing rules for this breed first
                            const { error: deleteRulesError } = await supabase
                                .from("station_breed_rules")
                                .delete()
                                .eq("breed_id", targetId)

                            if (deleteRulesError) throw deleteRulesError

                            const { error: rulesError } = await supabase
                                .from("station_breed_rules")
                                .insert(rulesToInsert)
                            if (rulesError) throw rulesError
                        }
                    }
                }

                toast({
                    title: "הצלחה",
                    description: `הנתונים הועתקו ל-${params.targetBreedIds.length} גזעים בהצלחה`,
                })

                setIsDuplicateDialogOpen(false)

                // Reload all data from backend
                loadAllDataFromBackend(false).catch((error) => {
                    console.error("[SettingsBreedsSection] Background refresh failed:", error)
                })
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
            setIsDuplicating(false)
            setBreedToDuplicate(null)
        }
    }

    const handleFieldChange = (breedId: string, field: keyof Breed, value: string | number | boolean | null) => {
        setEditedBreeds({
            ...editedBreeds,
            [breedId]: {
                ...editedBreeds[breedId],
                id: breedId,
                [field]: value,
            },
        })
    }

    const handleCategoriesChange = (breedId: string, selectedCategoryIds: string[]) => {
        setEditedCategoriesMap({
            ...editedCategoriesMap,
            [breedId]: selectedCategoryIds,
        })
        // Also mark the breed as dirty
        setEditedBreeds({
            ...editedBreeds,
            [breedId]: {
                ...editedBreeds[breedId],
                id: breedId,
            },
        })
    }

    const handleSaveRow = async (breedId: string) => {
        const editedBreed = editedBreeds[breedId]
        const hasEditedCategories = editedCategoriesMap[breedId] !== undefined

        // If no breed data and no category changes, nothing to save
        if (!editedBreed && !hasEditedCategories) return

        // If breed data exists, validate it
        if (editedBreed) {
            const name = editedBreed.name?.trim() || breeds.find((b) => b.id === breedId)?.name?.trim()
            if (!name) {
                toast({
                    title: "שגיאה",
                    description: "שם הגזע נדרש",
                    variant: "destructive",
                })
                return
            }
        }

        setSavingBreedId(breedId)
        try {
            let updatedBreed: Breed | null = null

            // Only update breed data if there are breed field changes
            if (editedBreed) {
                const name = editedBreed.name?.trim() || breeds.find((b) => b.id === breedId)?.name?.trim()

                const getPriceValue = (editedValue: number | string | null | undefined, originalValue: number | null | undefined): number | null => {
                    if (editedValue === undefined) {
                        return originalValue ?? null
                    }
                    if (editedValue === null || editedValue === "" || (typeof editedValue === "string" && editedValue.trim() === "")) {
                        return null
                    }
                    const numValue = typeof editedValue === "string" ? parseFloat(editedValue) : editedValue
                    return isNaN(numValue) ? null : numValue
                }

                const breedData = {
                    name: name,
                    size_class: editedBreed.size_class !== undefined
                        ? (editedBreed.size_class?.trim() || null)
                        : breeds.find((b) => b.id === breedId)?.size_class ?? null,
                    min_groom_price: getPriceValue(editedBreed.min_groom_price, breeds.find((b) => b.id === breedId)?.min_groom_price),
                    max_groom_price: getPriceValue(editedBreed.max_groom_price, breeds.find((b) => b.id === breedId)?.max_groom_price),
                    hourly_price: getPriceValue(editedBreed.hourly_price, breeds.find((b) => b.id === breedId)?.hourly_price),
                    notes: editedBreed.notes !== undefined
                        ? (editedBreed.notes?.trim() || null)
                        : breeds.find((b) => b.id === breedId)?.notes ?? null,
                    // Note: is_active and remote_booking_allowed are no longer stored at breed level
                    // They are calculated dynamically from station_breed_rules
                }

                const isNewBreed = breedId.startsWith("new-")

                if (isNewBreed) {
                    const { data: insertedData, error } = await supabase.from("breeds").insert(breedData).select().single()
                    if (error) throw error
                    updatedBreed = insertedData
                    toast({
                        title: "הצלחה",
                        description: "הגזע נוצר בהצלחה",
                    })
                } else {
                    const { data: updatedData, error } = await supabase.from("breeds").update(breedData).eq("id", breedId).select().single()
                    if (error) throw error
                    updatedBreed = updatedData
                    toast({
                        title: "הצלחה",
                        description: "הגזע עודכן בהצלחה",
                    })
                }
            }

            // Save categories if they were edited
            const editedCategories = editedCategoriesMap[breedId]

            if (editedCategories !== undefined) {
                // Use updated breed ID if breed was just created, otherwise use the original breedId
                const finalBreedId = (updatedBreed && breedId.startsWith("new-")) ? updatedBreed.id : breedId

                // Update categories
                // Delete existing categories
                await supabase
                    .from("breed_dog_categories")
                    .delete()
                    .eq("breed_id", finalBreedId)

                // Insert new categories
                if (editedCategories.length > 0) {
                    const categoriesToInsert = editedCategories.map(categoryId => ({
                        breed_id: finalBreedId,
                        dog_category_id: categoryId
                    }))
                    await supabase.from("breed_dog_categories").insert(categoriesToInsert)
                }

                // Update local state
                setBreedCategoriesMap(prev => ({
                    ...prev,
                    [finalBreedId]: editedCategories
                }))
            }

            // Optimistically update the local state immediately
            if (updatedBreed) {
                // Update breeds state immediately with saved data
                setBreeds((prev) => prev.map((b) => (b.id === breedId ? updatedBreed! : b)))
                setFilteredBreeds((prev) => prev.map((b) => (b.id === breedId ? updatedBreed! : b)))
            }

            // Clear edited state immediately - no refetch needed since we updated optimistically
            setEditedBreeds((prev) => {
                const newEditedBreeds = { ...prev }
                delete newEditedBreeds[breedId]
                return newEditedBreeds
            })

            // Clear edited categories
            setEditedCategoriesMap(prev => {
                const newMap = { ...prev }
                delete newMap[breedId]
                return newMap
            })
        } catch (error: unknown) {
            console.error("Error saving breed:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingBreedId(null)
        }
    }

    const handleCancelRow = (breedId: string) => {
        const isNewBreed = breedId.startsWith("new-")
        if (isNewBreed) {
            // Remove new breed from list
            setBreeds(breeds.filter((b) => b.id !== breedId))
        }
        // Remove from edited breeds
        const newEditedBreeds = { ...editedBreeds }
        delete newEditedBreeds[breedId]
        setEditedBreeds(newEditedBreeds)

        // Clear edited categories
        setEditedCategoriesMap(prev => {
            const newMap = { ...prev }
            delete newMap[breedId]
            return newMap
        })
    }

    const hasAnyDirtyBreeds = () => {
        // Check if any breed-level fields are dirty
        const hasDirtyBreedFields = Object.keys(editedBreeds).length > 0

        // Check if any categories are dirty
        const hasDirtyCategories = Object.keys(editedCategoriesMap).length > 0

        // Check if any station breed rules are dirty
        const hasDirtyStationRules = breeds.some((breed) => hasStationRuleChanges(breed.id))

        return hasDirtyBreedFields || hasDirtyCategories || hasDirtyStationRules
    }

    const handleSaveAll = async () => {
        const dirtyBreedIds = Object.keys(editedBreeds)
        const breedsWithDirtyCategories = Object.keys(editedCategoriesMap)
        const breedsWithDirtyStationRules = breeds.filter((breed) => hasStationRuleChanges(breed.id))

        if (dirtyBreedIds.length === 0 && breedsWithDirtyCategories.length === 0 && breedsWithDirtyStationRules.length === 0) return

        // Save all dirty breed-level fields sequentially
        for (const breedId of dirtyBreedIds) {
            await handleSaveRow(breedId)
        }

        // Save breeds that only have category changes (not in editedBreeds)
        for (const breedId of breedsWithDirtyCategories) {
            if (!dirtyBreedIds.includes(breedId)) {
                await handleSaveRow(breedId)
            }
        }

        // Save all dirty station rules sequentially
        for (const breed of breedsWithDirtyStationRules) {
            await handleSaveStationRules(breed.id)
        }

        const totalSaved = dirtyBreedIds.length + breedsWithDirtyCategories.length + breedsWithDirtyStationRules.length
        toast({
            title: "הצלחה",
            description: `נשמרו ${totalSaved} גזעים והגדרות עמדות בהצלחה`,
        })
    }

    const handleDiscardAll = () => {
        const dirtyBreedIds = Object.keys(editedBreeds)
        const breedsWithDirtyCategories = Object.keys(editedCategoriesMap)
        const breedsWithDirtyStationRules = breeds.filter((breed) => hasStationRuleChanges(breed.id))

        if (dirtyBreedIds.length === 0 && breedsWithDirtyCategories.length === 0 && breedsWithDirtyStationRules.length === 0) return

        // Remove all new breeds
        const newBreeds = dirtyBreedIds.filter((id) => id.startsWith("new-"))
        if (newBreeds.length > 0) {
            setBreeds((prev) => prev.filter((b) => !newBreeds.includes(b.id)))
        }

        // Clear all edited breed-level fields
        setEditedBreeds({})

        // Clear all edited categories
        setEditedCategoriesMap({})

        // Discard all dirty station rules by restoring original state
        breedsWithDirtyStationRules.forEach((breed) => {
            const originalRules = originalStationBreedRules[breed.id]
            if (originalRules) {
                const restoredRules = JSON.parse(JSON.stringify(originalRules))
                setStationBreedRules((prev) => ({
                    ...prev,
                    [breed.id]: restoredRules,
                }))

                // Restore duration input values
                const restoredInputValues: Record<string, string> = {}
                Object.values(restoredRules).forEach((rule: StationBreedRule) => {
                    restoredInputValues[rule.station_id] = formatDurationFromMinutes(rule.duration_modifier_minutes ?? 0)
                })
                setDurationInputValues((prev) => ({
                    ...prev,
                    [breed.id]: restoredInputValues,
                }))
            }
        })

        const totalDiscarded = dirtyBreedIds.length + breedsWithDirtyStationRules.length
        toast({
            title: "בוטל",
            description: `בוטלו שינויים ב-${totalDiscarded} גזעים והגדרות עמדות`,
        })
    }

    const handleDelete = (breed: Breed) => {
        setBreedToDelete(breed)
        setIsDeleteDialogOpen(true)
    }

    const confirmDeleteBreed = async () => {
        if (!breedToDelete) return

        setIsDeleting(true)
        try {
            const { error } = await supabase.from("breeds").delete().eq("id", breedToDelete.id)
            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הגזע נמחק בהצלחה",
            })

            // Optimistically remove from state
            setBreeds((prev) => prev.filter((b) => b.id !== breedToDelete.id))
            setFilteredBreeds((prev) => prev.filter((b) => b.id !== breedToDelete.id))

            setIsDeleteDialogOpen(false)
            setBreedToDelete(null)
        } catch (error: unknown) {
            console.error("Error deleting breed:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן למחוק את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const getBreedValue = (breed: Breed, field: keyof Breed) => {
        const edited = editedBreeds[breed.id]
        if (edited && field in edited) {
            return edited[field as keyof EditedBreed]
        }
        return breed[field]
    }

    const getBreedCategories = (breedId: string): string[] => {
        if (editedCategoriesMap[breedId] !== undefined) {
            return editedCategoriesMap[breedId]
        }
        return breedCategoriesMap[breedId] || []
    }

    useEffect(() => {
        if (defaultDogCategoryId && dogCategories.length > 0) {
            if (defaultDogCategoryAppliedRef.current !== defaultDogCategoryId) {
                const match = dogCategories.find((category) => category.id === defaultDogCategoryId)
                if (match) {
                    setDogCategoryFilter(match.name)
                    setDogCategoryFilterId(match.id)
                    defaultDogCategoryAppliedRef.current = defaultDogCategoryId
                }
            }
        } else if (!defaultDogCategoryId && defaultDogCategoryAppliedRef.current) {
            setDogCategoryFilter("")
            setDogCategoryFilterId(null)
            defaultDogCategoryAppliedRef.current = null
        }
    }, [defaultDogCategoryId, dogCategories])

    const selectedCount = selectedBreedIds.length
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedBreeds = filteredBreeds.slice(startIndex, endIndex)
    const pageIds = paginatedBreeds.map((breed) => breed.id)
    const isAllSelected =
        paginatedBreeds.length > 0 && pageIds.every((id) => selectedBreedIds.includes(id))
    const isPartiallySelected =
        pageIds.some((id) => selectedBreedIds.includes(id)) && !isAllSelected
    const disableSelection = isBulkActionLoading

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mr-2">טוען גזעים...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">ניהול גזעים</h2>
                    <p className="text-gray-600 mt-1">נהל את כל הגזעים במערכת - מחירים, הערות והרשאות</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasAnyDirtyBreeds() && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDiscardAll}
                                className="flex items-center gap-2"
                            >
                                <X className="h-4 w-4" />
                                בטל הכל
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleSaveAll}
                                className="flex items-center gap-2 border-green-600 text-green-600 hover:bg-green-50"
                                disabled={
                                    Object.keys(editedBreeds).some((id) => savingBreedId === id) ||
                                    breeds.some((breed) => savingStationRules === breed.id)
                                }
                            >
                                <Check className="h-4 w-4" />
                                שמור הכל
                            </Button>
                        </>
                    )}
                    <Button type="button" onClick={handleAdd} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        הוסף גזע חדש
                    </Button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                        placeholder="חפש לפי שם גזע..."
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="space-y-2">
                        <Label>הערות</Label>
                        <Select value={hasNotesFilter} onValueChange={(value: "all" | "with" | "without") => setHasNotesFilter(value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="with">עם הערות</SelectItem>
                                <SelectItem value="without">ללא הערות</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>תור מרחוק</Label>
                        <Select
                            value={remoteBookingFilter}
                            onValueChange={(value: "all" | "allowed" | "not-allowed" | "partially") => setRemoteBookingFilter(value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="allowed">מאפשר תור מרחוק</SelectItem>
                                <SelectItem value="not-allowed">לא מאפשר תור מרחוק</SelectItem>
                                <SelectItem value="partially">חלקית כן, חלקית לא</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>פעיל</Label>
                        <Select
                            value={isActiveFilter}
                            onValueChange={(value: "all" | "active" | "inactive" | "partially") => setIsActiveFilter(value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="active">פעיל</SelectItem>
                                <SelectItem value="inactive">לא פעיל</SelectItem>
                                <SelectItem value="partially">חלקית פעיל, חלקית לא פעיל</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>מחירים</Label>
                        <div className="flex gap-2">
                            <Select
                                value={priceFilterType}
                                onValueChange={(value: typeof priceFilterType) => {
                                    setPriceFilterType(value)
                                    if (!value.includes("-lt") && !value.includes("-gt")) {
                                        setPriceFilterValue("")
                                    }
                                }}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="has-min">עם מחיר מינימום</SelectItem>
                                    <SelectItem value="has-max">עם מחיר מקסימום</SelectItem>
                                    <SelectItem value="has-hourly">עם מחיר שעתי</SelectItem>
                                    <SelectItem value="no-prices">ללא מחירים</SelectItem>
                                    <SelectItem value="min-lt">מחיר מינימום פחות מ-</SelectItem>
                                    <SelectItem value="min-gt">מחיר מינימום גדול מ-</SelectItem>
                                    <SelectItem value="max-lt">מחיר מקסימום פחות מ-</SelectItem>
                                    <SelectItem value="max-gt">מחיר מקסימום גדול מ-</SelectItem>
                                    <SelectItem value="hourly-lt">מחיר שעתי פחות מ-</SelectItem>
                                    <SelectItem value="hourly-gt">מחיר שעתי גדול מ-</SelectItem>
                                </SelectContent>
                            </Select>
                            {(priceFilterType.includes("-lt") || priceFilterType.includes("-gt")) && (
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="₪"
                                    value={priceFilterValue}
                                    onChange={(e) => setPriceFilterValue(e.target.value)}
                                    className="w-24"
                                    dir="rtl"
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>קטגוריה</Label>
                        <AutocompleteFilter
                            value={dogCategoryFilter}
                            onChange={handleDogCategoryFilterChange}
                            placeholder="הקלד שם קטגוריה..."
                            searchFn={searchDogCategories}
                            minSearchLength={0}
                            autoSearchOnFocus
                            initialLoadOnMount
                            initialResultsLimit={5}
                        />
                    </div>
                </div>

                {(searchTerm ||
                    hasNotesFilter !== "all" ||
                    remoteBookingFilter !== "all" ||
                    isActiveFilter !== "all" ||
                    priceFilterType !== "all" ||
                    dogCategoryFilter ||
                    dogCategoryFilterId) && (
                        <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-gray-600">
                                נמצאו {filteredBreeds.length} מתוך {breeds.length} גזעים
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchTerm("")
                                    setHasNotesFilter("all")
                                    setRemoteBookingFilter("all")
                                    setIsActiveFilter("all")
                                    setPriceFilterType("all")
                                    setPriceFilterValue("")
                                    setDogTypeFilter("")
                                    setDogTypeFilterId(null)
                                    setDogCategoryFilter("")
                                    setDogCategoryFilterId(null)
                                }}
                                className="text-sm"
                            >
                                <X className="h-4 w-4 ml-2" />
                                נקה מסננים
                            </Button>
                        </div>
                    )}
            </div>

            {selectedCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col text-right text-blue-900">
                        <span className="text-sm font-semibold">נבחרו {selectedCount} גזעים</span>
                        <span className="text-xs text-blue-800/80">בצע פעולות מרובות על כל הגזעים שנבחרו</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={clearSelection} disabled={disableSelection}>
                            בטל בחירה
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBulkSizeDialogOpen(true)}
                            disabled={disableSelection}
                        >
                            {currentBulkAction === "size" && isBulkActionLoading && (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                            עדכן גודל
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBulkCategoriesDialogOpen(true)}
                            disabled={disableSelection}
                        >
                            {currentBulkAction === "categories" && isBulkActionLoading && (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                            הגדר קטגוריות
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setIsBulkDeleteDialogOpen(true)}
                            disabled={disableSelection}
                        >
                            {currentBulkAction === "delete" && isBulkActionLoading && (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                            מחיקה מרובה
                        </Button>
                    </div>
                </div>
            )}

            <div className="border rounded-lg">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar">
                    <div className="[direction:rtl]">
                        <div className="relative w-full">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="sticky top-0 z-20 [&_tr]:border-b bg-background">
                                    <tr className="border-b transition-colors bg-[hsl(228_36%_95%)]">
                                        <th className="h-12 w-12 p-0 text-center align-middle font-medium text-primary font-semibold">
                                            <div className="flex h-full items-center justify-center">
                                                <Checkbox
                                                    checked={isAllSelected}
                                                    indeterminate={isPartiallySelected}
                                                    onPointerDownCapture={handleCheckboxPointerDown}
                                                    onPointerUp={handleCheckboxPointerUpOrLeave}
                                                    onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                    onCheckedChange={handleSelectAllChange}
                                                    aria-label="בחר את כל הגזעים בעמוד הנוכחי"
                                                    disabled={filteredBreeds.length === 0 || disableSelection}
                                                />
                                            </div>
                                        </th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold">שם הגזע</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold w-28">גודל</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold">מחיר מינימום</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold">מחיר מקסימום</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold">מחיר שעתי</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold">הערות</th>
                                        <th className="h-12 px-1 text-center align-middle font-medium text-primary font-semibold w-16">תור מרחוק</th>
                                        <th className="h-12 px-1 text-center align-middle font-medium text-primary font-semibold w-16">אישור צוות</th>
                                        <th className="h-12 px-1 text-center align-middle font-medium text-primary font-semibold w-16">פעיל</th>
                                        <th className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold w-[100px]">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {filteredBreeds.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td colSpan={11} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                {breeds.length === 0
                                                    ? "אין גזעים במערכת. הוסף גזע חדש כדי להתחיל."
                                                    : "לא נמצאו גזעים התואמים את המסננים."}
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {paginatedBreeds.map((breed, index) => {
                                                const globalIndex = startIndex + index
                                                // Check if categories have actually changed
                                                const hasCategoriesChanged =
                                                    editedCategoriesMap[breed.id] !== undefined &&
                                                    JSON.stringify(editedCategoriesMap[breed.id].sort()) !==
                                                    JSON.stringify((breedCategoriesMap[breed.id] || []).sort())

                                                const isDirty = !!editedBreeds[breed.id] || hasCategoriesChanged
                                                const isSaving = savingBreedId === breed.id
                                                const name = (getBreedValue(breed, "name") as string) || ""
                                                const sizeClass = getBreedValue(breed, "size_class") as string | null
                                                const minPrice = getBreedValue(breed, "min_groom_price") as number | null
                                                const maxPrice = getBreedValue(breed, "max_groom_price") as number | null
                                                const hourlyPrice = getBreedValue(breed, "hourly_price") as number | null
                                                const notes = getBreedValue(breed, "notes") as string | null

                                                const isExpanded = expandedBreedId === breed.id
                                                const breedStationRules = stationBreedRules[breed.id] || {}
                                                const hasStationRules = Object.keys(breedStationRules).length > 0

                                                // Get calculated parent checkbox states
                                                const remoteBookingState = getParentCheckboxState(breed.id, "remote_booking_allowed")
                                                const approvalState = getParentCheckboxState(breed.id, "requires_staff_approval")
                                                const isActiveState = getParentCheckboxState(breed.id, "is_active")

                                                return [
                                                    <tr
                                                        key={breed.id}
                                                        data-breed-id={breed.id}
                                                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                    >
                                                        <td className="w-12 p-0 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                            <div
                                                                className="flex h-full items-center justify-center"
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                <Checkbox
                                                                    checked={selectedBreedIds.includes(breed.id)}
                                                                    onPointerDownCapture={handleCheckboxPointerDown}
                                                                    onPointerUp={handleCheckboxPointerUpOrLeave}
                                                                    onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                                    onCheckedChange={(value) =>
                                                                        handleBreedSelectionChange(breed.id, value === true, globalIndex)
                                                                    }
                                                                    aria-label={`בחר את הגזע ${name || "ללא שם"}`}
                                                                    disabled={disableSelection}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 align-middle [&:has([role=checkbox])]:pr-0">
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleBreedExpand(breed.id)}
                                                                    className="h-6 w-6 p-0"
                                                                    title={isExpanded ? "צמצם" : "הרחב"}
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    ) : (
                                                                        <ChevronDown className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                                <Input
                                                                    value={name}
                                                                    onChange={(e) => handleFieldChange(breed.id, "name", e.target.value)}
                                                                    placeholder="שם הגזע"
                                                                    className="h-8 flex-1"
                                                                    dir="rtl"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                            <div className="flex justify-center">
                                                                <Select
                                                                    value={sizeClass || "__none__"}
                                                                    onValueChange={(value) => handleFieldChange(breed.id, "size_class", value === "__none__" ? null : value)}
                                                                >
                                                                    <SelectTrigger className="h-8 w-28" dir="rtl">
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
                                                        </td>
                                                        <td className="px-2 py-1 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                            <div className="flex justify-center">
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={minPrice ?? ""}
                                                                    onChange={(e) => handleFieldChange(breed.id, "min_groom_price", e.target.value ? parseFloat(e.target.value) : null)}
                                                                    placeholder="-"
                                                                    className="h-8 w-16"
                                                                    dir="rtl"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                            <div className="flex justify-center">
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={maxPrice ?? ""}
                                                                    onChange={(e) => handleFieldChange(breed.id, "max_groom_price", e.target.value ? parseFloat(e.target.value) : null)}
                                                                    placeholder="-"
                                                                    className="h-8 w-16"
                                                                    dir="rtl"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                            <div className="flex justify-center">
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={hourlyPrice ?? ""}
                                                                    onChange={(e) => handleFieldChange(breed.id, "hourly_price", e.target.value ? parseFloat(e.target.value) : null)}
                                                                    placeholder="-"
                                                                    className="h-8 w-16"
                                                                    dir="rtl"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                            <Input
                                                                value={notes || ""}
                                                                onChange={(e) => handleFieldChange(breed.id, "notes", e.target.value || null)}
                                                                placeholder="-"
                                                                className="h-8 w-48 mx-auto"
                                                                dir="rtl"
                                                            />
                                                        </td>
                                                        <td className="px-1 py-1 align-middle text-center w-16">
                                                            <div className="flex items-center justify-center w-full">
                                                                <Checkbox
                                                                    checked={remoteBookingState.checked}
                                                                    indeterminate={remoteBookingState.indeterminate}
                                                                    onCheckedChange={(checked) => {
                                                                        // Toggle logic:
                                                                        // - If indeterminate → set all to checked (true)
                                                                        // - If checked → set all to unchecked (false)  
                                                                        // - If unchecked → set all to checked (true)
                                                                        const newValue = remoteBookingState.indeterminate || checked === true
                                                                        handleParentCheckboxChange(breed.id, "remote_booking_allowed", newValue)
                                                                    }}
                                                                    title={remoteBookingState.indeterminate ? "חלק מהעמדות מאפשרות תור מרחוק - לחץ כדי לסמן את כולן" : ""}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-1 align-middle text-center w-16">
                                                            <div className="flex items-center justify-center w-full">
                                                                <Checkbox
                                                                    checked={approvalState.checked}
                                                                    indeterminate={approvalState.indeterminate}
                                                                    onCheckedChange={(checked) => {
                                                                        // Toggle logic:
                                                                        // - If indeterminate → set all to checked (true)
                                                                        // - If checked → set all to unchecked (false)
                                                                        // - If unchecked → set all to checked (true)
                                                                        const newValue = approvalState.indeterminate || checked === true
                                                                        handleParentCheckboxChange(breed.id, "requires_staff_approval", newValue)
                                                                    }}
                                                                    title={approvalState.indeterminate ? "חלק מהעמדות דורשות אישור - לחץ כדי לסמן את כולן" : ""}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-1 align-middle text-center w-16">
                                                            <div className="flex items-center justify-center w-full">
                                                                <Checkbox
                                                                    checked={isActiveState.checked}
                                                                    indeterminate={isActiveState.indeterminate}
                                                                    onCheckedChange={(checked) => {
                                                                        // Toggle logic:
                                                                        // - If indeterminate → set all to checked (true)
                                                                        // - If checked → set all to unchecked (false)
                                                                        // - If unchecked → set all to checked (true)
                                                                        const newValue = isActiveState.indeterminate || checked === true
                                                                        handleParentCheckboxChange(breed.id, "is_active", newValue)
                                                                    }}
                                                                    title={isActiveState.indeterminate ? "חלק מהעמדות פעילות - לחץ כדי לסמן את כולן" : ""}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1 align-middle [&:has([role=checkbox])]:pr-0">
                                                            <div className="flex items-center gap-2 justify-center min-w-[100px]">
                                                                {isDirty ? (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleSaveRow(breed.id)}
                                                                            disabled={isSaving}
                                                                            title="שמור שינויים"
                                                                        >
                                                                            {isSaving ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                                                                            ) : (
                                                                                <Check className="h-4 w-4 text-green-600" />
                                                                            )}
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleCancelRow(breed.id)}
                                                                            disabled={isSaving}
                                                                            title="בטל שינויים"
                                                                        >
                                                                            <X className="h-4 w-4 text-red-600" />
                                                                        </Button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDuplicate(breed)}
                                                                            disabled={isSaving}
                                                                            title="שכפל גזע"
                                                                        >
                                                                            <Copy className="h-4 w-4 text-blue-600" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDelete(breed)}
                                                                            disabled={isSaving}
                                                                            title="מחק גזע"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>,
                                                    <tr
                                                        key={`${breed.id}-details`}
                                                        className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                    >
                                                        <td colSpan={11} className="px-4 align-middle [&:has([role=checkbox])]:pr-0 bg-gray-50 p-0">
                                                            <Collapsible open={isExpanded}>
                                                                <CollapsibleContent>
                                                                    <div className="p-3 border-t-2 border-primary/20">
                                                                        {/* Save/Cancel buttons for categories - shown when categories are modified */}
                                                                        {hasCategoriesChanged && (
                                                                            <div className="flex items-center justify-end gap-2 mb-4">
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() => handleCancelRow(breed.id)}
                                                                                    disabled={isSaving}
                                                                                    className="h-8 text-xs"
                                                                                >
                                                                                    <X className="h-3 w-3 ml-1" />
                                                                                    ביטול
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={() => handleSaveRow(breed.id)}
                                                                                    disabled={isSaving}
                                                                                    className="h-8 text-xs"
                                                                                >
                                                                                    {isSaving ? (
                                                                                        <>
                                                                                            <Loader2 className="h-3 w-3 animate-spin ml-1" />
                                                                                            שומר...
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Check className="h-3 w-3 ml-1" />
                                                                                            שמור שינויים
                                                                                        </>
                                                                                    )}
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                        <div className="mb-4">
                                                                            <div className="space-y-2">
                                                                                <Label className="text-xs text-gray-600">קטגוריה</Label>
                                                                                <MultiSelectDropdown
                                                                                    options={dogCategories.map(category => ({ id: category.id, name: category.name }))}
                                                                                    selectedIds={getBreedCategories(breed.id)}
                                                                                    onSelectionChange={(selectedIds) => handleCategoriesChange(breed.id, selectedIds)}
                                                                                    placeholder="בחר קטגוריות..."
                                                                                    className="w-full"
                                                                                    onCreateNew={handleCreateNewCategory}
                                                                                    isCreating={isCreatingCategory}
                                                                                    onEdit={handleEditCategory}
                                                                                    onDelete={handleDeleteCategory}
                                                                                    isEditing={editingCategoryId}
                                                                                    onStartEdit={setEditingCategoryId}
                                                                                    onCancelEdit={() => setEditingCategoryId(null)}
                                                                                    isDeleting={deletingCategoryId}
                                                                                    deleteConfirmOpen={deleteCategoryConfirmOpen}
                                                                                    onDeleteConfirmOpen={setDeleteCategoryConfirmOpen}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h3 className="text-sm font-semibold text-gray-900">ניהול עמדות עבור {name}</h3>
                                                                            {hasStationRules && hasStationRuleChanges(breed.id) && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        onClick={() => handleCancelStationRules(breed.id)}
                                                                                        disabled={savingStationRules === breed.id}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        <X className="h-3 w-3 ml-1" />
                                                                                        ביטול
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={() => handleSaveStationRules(breed.id)}
                                                                                        disabled={savingStationRules === breed.id}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        {savingStationRules === breed.id ? (
                                                                                            <>
                                                                                                <Loader2 className="h-3 w-3 animate-spin ml-1" />
                                                                                                שומר...
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                <Check className="h-3 w-3 ml-1" />
                                                                                                שמור שינויים
                                                                                            </>
                                                                                        )}
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {hasStationRules && (
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <Label htmlFor={`global-time-${breed.id}`} className="text-xs text-gray-600">
                                                                                    זמן לכל העמדות:
                                                                                </Label>
                                                                                <Input
                                                                                    id={`global-time-${breed.id}`}
                                                                                    type="text"
                                                                                    value={isTypingGlobal[breed.id]
                                                                                        ? (durationInputValues["__global__"]?.[breed.id] ?? "")
                                                                                        : (() => {
                                                                                            // If user set a global value, use it
                                                                                            if (globalDurationValue[breed.id] !== undefined) {
                                                                                                return formatDurationFromMinutes(globalDurationValue[breed.id])
                                                                                            }
                                                                                            // Otherwise, check if all stations have the same time
                                                                                            const commonTime = getGlobalDurationFromStations(breed.id)
                                                                                            if (commonTime !== null) {
                                                                                                return formatDurationFromMinutes(commonTime)
                                                                                            }
                                                                                            return ""
                                                                                        })()}
                                                                                    onChange={(e) => {
                                                                                        const value = e.target.value
                                                                                        // Only allow numbers and colons
                                                                                        const cleaned = value.replace(/[^\d:]/g, "")

                                                                                        // If user was typing and we have a stored value, and the new value is longer, 
                                                                                        // it means they're replacing the selected text (which is the expected behavior)
                                                                                        setDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            __global__: {
                                                                                                ...(prev.__global__ || {}),
                                                                                                [breed.id]: cleaned,
                                                                                            },
                                                                                        }))

                                                                                        // Try to parse while typing (for live updates)
                                                                                        const minutes = parseDurationToMinutes(cleaned)
                                                                                        if (minutes !== null) {
                                                                                            setGlobalDurationValue((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: minutes,
                                                                                            }))
                                                                                        }
                                                                                    }}
                                                                                    onFocus={(e) => {
                                                                                        setIsTypingGlobal((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: true,
                                                                                        }))
                                                                                        // Store current formatted value for editing - when user types, it will replace this
                                                                                        const currentValue = (() => {
                                                                                            if (globalDurationValue[breed.id] !== undefined) {
                                                                                                return formatDurationFromMinutes(globalDurationValue[breed.id])
                                                                                            }
                                                                                            const commonTime = getGlobalDurationFromStations(breed.id)
                                                                                            if (commonTime !== null) {
                                                                                                return formatDurationFromMinutes(commonTime)
                                                                                            }
                                                                                            return ""
                                                                                        })()
                                                                                        setDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            __global__: {
                                                                                                ...(prev.__global__ || {}),
                                                                                                [breed.id]: currentValue,
                                                                                            },
                                                                                        }))
                                                                                        // Select all text - when user types, browser will replace it automatically
                                                                                        setTimeout(() => {
                                                                                            e.target.select()
                                                                                        }, 0)
                                                                                    }}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === "Enter") {
                                                                                            e.preventDefault()
                                                                                            const value = e.target.value
                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (globalDurationValue[breed.id] ?? 0)
                                                                                            const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                            setGlobalDurationValue((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: finalMinutes,
                                                                                            }))

                                                                                            setDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                __global__: {
                                                                                                    ...(prev.__global__ || {}),
                                                                                                    [breed.id]: formatted,
                                                                                                },
                                                                                            }))

                                                                                            setIsTypingGlobal((prev) => ({
                                                                                                ...prev,
                                                                                                [breed.id]: false,
                                                                                            }))

                                                                                            e.target.blur()
                                                                                        }
                                                                                    }}
                                                                                    onBlur={(e) => {
                                                                                        setIsTypingGlobal((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: false,
                                                                                        }))
                                                                                        const value = e.target.value
                                                                                        const minutes = parseDurationToMinutes(value)
                                                                                        const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (globalDurationValue[breed.id] ?? 0)
                                                                                        const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                        setGlobalDurationValue((prev) => ({
                                                                                            ...prev,
                                                                                            [breed.id]: finalMinutes,
                                                                                        }))

                                                                                        setDurationInputValues((prev) => ({
                                                                                            ...prev,
                                                                                            __global__: {
                                                                                                ...(prev.__global__ || {}),
                                                                                                [breed.id]: formatted,
                                                                                            },
                                                                                        }))
                                                                                    }}
                                                                                    className="h-8 w-24 text-xs text-right"
                                                                                    dir="rtl"
                                                                                    placeholder="1:30"
                                                                                />
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() => {
                                                                                        const minutes = globalDurationValue[breed.id]
                                                                                        if (minutes !== undefined && minutes >= 0) {
                                                                                            handleApplyTimeToAll(breed.id, formatDurationFromMinutes(minutes))
                                                                                            // Keep the value, don't clear it
                                                                                        }
                                                                                    }}
                                                                                    className="h-8 px-2 text-xs"
                                                                                    title="החל על כל העמדות"
                                                                                >
                                                                                    <RefreshCw className="h-3 w-3 ml-1" />
                                                                                    החל
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                        {loadingStations === breed.id ? (
                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                                                                {Array.from({ length: allStations.length || 6 }).map((_, index) => (
                                                                                    <div
                                                                                        key={index}
                                                                                        className="bg-gray-50/50 border-gray-200 border rounded-md p-2 space-y-2"
                                                                                    >
                                                                                        <Skeleton className="h-4 w-3/4 mx-auto" />
                                                                                        <div className="space-y-1">
                                                                                            <Skeleton className="h-3 w-12" />
                                                                                            <Skeleton className="h-7 w-full" />
                                                                                        </div>
                                                                                        <div className="flex items-center justify-between text-xs">
                                                                                            <Skeleton className="h-3 w-8" />
                                                                                            <Skeleton className="h-4 w-4 rounded" />
                                                                                        </div>
                                                                                        <div className="flex items-center justify-between text-xs">
                                                                                            <Skeleton className="h-3 w-16" />
                                                                                            <Skeleton className="h-4 w-4 rounded" />
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : allStations.length === 0 ? (
                                                                            <div className="text-center text-gray-500 py-4">
                                                                                אין עמדות במערכת
                                                                            </div>
                                                                        ) : (
                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                                                                {allStations
                                                                                    .filter((station) => station.is_active)
                                                                                    .map((station) => {
                                                                                        const rule = breedStationRules[station.id] || {
                                                                                            station_id: station.id,
                                                                                            breed_id: breed.id,
                                                                                            is_active: true,
                                                                                            remote_booking_allowed: false,
                                                                                            duration_modifier_minutes: 0,
                                                                                        }

                                                                                        const isActive = rule.is_active ?? true
                                                                                        const isRemote = rule.remote_booking_allowed ?? false

                                                                                        const cardColorClass = isActive && isRemote
                                                                                            ? "bg-green-100/60 border-green-400"
                                                                                            : isActive
                                                                                                ? "bg-blue-100/60 border-blue-400"
                                                                                                : "bg-gray-50/50 border-gray-200"

                                                                                        return (
                                                                                            <div
                                                                                                key={station.id}
                                                                                                className={`rounded-md p-2 space-y-2 hover:shadow-sm transition-all ${cardColorClass} border`}
                                                                                            >
                                                                                                <div className="font-medium text-sm text-gray-900 text-center truncate" title={station.name}>
                                                                                                    {station.name}
                                                                                                </div>
                                                                                                <div className="space-y-1">
                                                                                                    <Label htmlFor={`time-${breed.id}-${station.id}`} className="text-xs text-gray-700">
                                                                                                        זמן
                                                                                                    </Label>
                                                                                                    <Input
                                                                                                        id={`time-${breed.id}-${station.id}`}
                                                                                                        type="text"
                                                                                                        disabled={!isActive}
                                                                                                        value={durationInputValues[breed.id]?.[station.id] ?? formatDurationFromMinutes(rule.duration_modifier_minutes ?? 0)}
                                                                                                        onChange={(e) => {
                                                                                                            if (!isActive) return
                                                                                                            const value = e.target.value
                                                                                                            const cleaned = value.replace(/[^\d:]/g, "")

                                                                                                            setDurationInputValues((prev) => ({
                                                                                                                ...prev,
                                                                                                                [breed.id]: {
                                                                                                                    ...(prev[breed.id] || {}),
                                                                                                                    [station.id]: cleaned,
                                                                                                                },
                                                                                                            }))

                                                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                                                            if (minutes !== null) {
                                                                                                                handleStationRuleChange(breed.id, station.id, "duration_modifier_minutes", minutes)
                                                                                                            }
                                                                                                        }}
                                                                                                        onFocus={(e) => {
                                                                                                            if (!isActive) return
                                                                                                            setIsTypingStation((prev) => ({
                                                                                                                ...prev,
                                                                                                                [breed.id]: {
                                                                                                                    ...(prev[breed.id] || {}),
                                                                                                                    [station.id]: true,
                                                                                                                },
                                                                                                            }))
                                                                                                            const currentValue = durationInputValues[breed.id]?.[station.id] ?? formatDurationFromMinutes(rule.duration_modifier_minutes ?? 0)
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
                                                                                                        onKeyDown={(e) => {
                                                                                                            if (e.key === "Enter") {
                                                                                                                e.preventDefault()
                                                                                                                const value = e.target.value
                                                                                                                const minutes = parseDurationToMinutes(value)
                                                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (rule.duration_modifier_minutes ?? 0)
                                                                                                                const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                                                setDurationInputValues((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [breed.id]: {
                                                                                                                        ...(prev[breed.id] || {}),
                                                                                                                        [station.id]: formatted,
                                                                                                                    },
                                                                                                                }))

                                                                                                                setIsTypingStation((prev) => {
                                                                                                                    const newState = { ...prev }
                                                                                                                    if (newState[breed.id]) {
                                                                                                                        newState[breed.id] = { ...newState[breed.id] }
                                                                                                                        delete newState[breed.id][station.id]
                                                                                                                    }
                                                                                                                    return newState
                                                                                                                })

                                                                                                                if (finalMinutes !== (rule.duration_modifier_minutes ?? 0)) {
                                                                                                                    handleStationRuleChange(breed.id, station.id, "duration_modifier_minutes", finalMinutes)
                                                                                                                }

                                                                                                                e.target.blur()
                                                                                                            }
                                                                                                        }}
                                                                                                        onBlur={(e) => {
                                                                                                            if (!isActive) return
                                                                                                            setIsTypingStation((prev) => {
                                                                                                                const newState = { ...prev }
                                                                                                                if (newState[breed.id]) {
                                                                                                                    newState[breed.id] = { ...newState[breed.id] }
                                                                                                                    delete newState[breed.id][station.id]
                                                                                                                }
                                                                                                                return newState
                                                                                                            })
                                                                                                            const value = e.target.value
                                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (rule.duration_modifier_minutes ?? 0)
                                                                                                            const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                                            setDurationInputValues((prev) => ({
                                                                                                                ...prev,
                                                                                                                [breed.id]: {
                                                                                                                    ...(prev[breed.id] || {}),
                                                                                                                    [station.id]: formatted,
                                                                                                                },
                                                                                                            }))

                                                                                                            if (finalMinutes !== (rule.duration_modifier_minutes ?? 0)) {
                                                                                                                handleStationRuleChange(breed.id, station.id, "duration_modifier_minutes", finalMinutes)
                                                                                                            }
                                                                                                        }}
                                                                                                        className="h-7 text-xs text-right"
                                                                                                        dir="rtl"
                                                                                                        placeholder="0:00"
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-xs">
                                                                                                    <Label htmlFor={`active-${breed.id}-${station.id}`} className="text-xs cursor-pointer">
                                                                                                        פעיל
                                                                                                    </Label>
                                                                                                    <Checkbox
                                                                                                        id={`active-${breed.id}-${station.id}`}
                                                                                                        checked={rule.is_active}
                                                                                                        onCheckedChange={(checked) =>
                                                                                                            handleStationRuleChange(breed.id, station.id, "is_active", checked === true)
                                                                                                        }
                                                                                                        className="h-4 w-4"
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-xs">
                                                                                                    <Label htmlFor={`remote-${breed.id}-${station.id}`} className="text-xs cursor-pointer">
                                                                                                        תור מרחוק
                                                                                                    </Label>
                                                                                                    <Checkbox
                                                                                                        id={`remote-${breed.id}-${station.id}`}
                                                                                                        checked={rule.remote_booking_allowed}
                                                                                                        onCheckedChange={(checked) =>
                                                                                                            handleStationRuleChange(breed.id, station.id, "remote_booking_allowed", checked === true)
                                                                                                        }
                                                                                                        className="h-4 w-4"
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-xs">
                                                                                                    <Label htmlFor={`approval-${breed.id}-${station.id}`} className="text-xs cursor-pointer">
                                                                                                        אישור צוות
                                                                                                    </Label>
                                                                                                    <Checkbox
                                                                                                        id={`approval-${breed.id}-${station.id}`}
                                                                                                        checked={rule.requires_staff_approval ?? false}
                                                                                                        onCheckedChange={(checked) =>
                                                                                                            handleStationRuleChange(breed.id, station.id, "requires_staff_approval", checked === true)
                                                                                                        }
                                                                                                        className="h-4 w-4"
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                        )
                                                                                    })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </CollapsibleContent>
                                                            </Collapsible>
                                                        </td>
                                                    </tr>,
                                                ]
                                            })}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Pagination */}
                {filteredBreeds.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">
                            מציג {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredBreeds.length)} מתוך {filteredBreeds.length} גזעים
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                הקודם
                            </Button>
                            <span className="text-sm text-gray-600">
                                עמוד {currentPage} מתוך {Math.ceil(filteredBreeds.length / ITEMS_PER_PAGE)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredBreeds.length / ITEMS_PER_PAGE), p + 1))}
                                disabled={currentPage >= Math.ceil(filteredBreeds.length / ITEMS_PER_PAGE)}
                            >
                                הבא
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <BulkBreedsSizeDialog
                open={isBulkSizeDialogOpen}
                onOpenChange={(open) => {
                    if (!isBulkActionLoading) {
                        setIsBulkSizeDialogOpen(open)
                    }
                }}
                isProcessing={isBulkActionLoading && currentBulkAction === "size"}
                onConfirm={handleBulkSizeConfirm}
            />

            <BulkBreedsCategoriesDialog
                open={isBulkCategoriesDialogOpen}
                onOpenChange={(open) => {
                    if (!isBulkActionLoading) {
                        setIsBulkCategoriesDialogOpen(open)
                    }
                }}
                isProcessing={isBulkActionLoading && currentBulkAction === "categories"}
                dogCategories={dogCategories}
                onConfirm={handleBulkCategoriesConfirm}
            />

            <BulkBreedsDeleteDialog
                open={isBulkDeleteDialogOpen}
                onOpenChange={(open) => {
                    if (!isBulkActionLoading) {
                        setIsBulkDeleteDialogOpen(open)
                    }
                }}
                count={selectedCount}
                isProcessing={isBulkActionLoading && currentBulkAction === "delete"}
                onConfirm={handleBulkDeleteConfirm}
            />

            {/* Add Breed Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                                        confirmAddBreed()
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddDialogOpen(false)
                                setNewBreedName("")
                            }}
                            disabled={isAdding}
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={confirmAddBreed}
                            disabled={isAdding || !newBreedName.trim()}
                        >
                            {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            הוסף
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Duplicate Breed Dialog */}
            <DuplicateBreedDialog
                open={isDuplicateDialogOpen}
                onOpenChange={setIsDuplicateDialogOpen}
                breed={breedToDuplicate}
                breeds={breeds}
                onConfirm={confirmDuplicateBreed}
                isDuplicating={isDuplicating}
            />

            {/* Delete Breed Dialog */}
            <DeleteBreedDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                breed={breedToDelete}
                onConfirm={confirmDeleteBreed}
                isDeleting={isDeleting}
            />
        </div>
    )
}
