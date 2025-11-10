import { Fragment, useState, useEffect, useRef, useCallback } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
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
import { DuplicateTreatmentTypeDialog } from "../../dialogs/settings/treatment-types/DuplicateTreatmentTypeDialog"
import { DeleteTreatmentTypeDialog } from "../../dialogs/settings/treatment-types/DeleteTreatmentTypeDialog"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { BulkTreatmentTypesDeleteDialog } from "../../dialogs/settings/treatment-types/BulkTreatmentTypesDeleteDialog"
import { BulkTreatmentTypesDurationDialog } from "../../dialogs/settings/treatment-types/BulkTreatmentTypesDurationDialog"
import { BulkTreatmentTypesCategoriesDialog } from "../../dialogs/settings/treatment-types/BulkTreatmentTypesCategoriesDialog"
import { useTreatmentTypesSettings } from "./SettingsTreatmentTypesSection.module"

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

interface TreatmentType {
    id: string
    name: string
    size_class?: string | null
    min_groom_price?: number | null
    max_groom_price?: number | null
    hourly_price?: number | null
    notes?: string | null
    // Note: is_active and remote_booking_allowed are no longer stored at treatmentType level
    // They are calculated dynamically from station_treatmentType_rules
}

type EditedTreatmentType = Partial<TreatmentType> & { id: string }

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface StationTreatmentTypeRule {
    id?: string
    station_id: string
    treatment_type_id: string
    is_active: boolean
    remote_booking_allowed: boolean
    requires_staff_approval?: boolean
    duration_modifier_minutes?: number | null
}

interface TreatmentType {
    id: string
    name: string
}

interface TreatmentCategory {
    id: string
    name: string
}

interface SettingsTreatmentTypesSectionProps {
    defaultTreatmentTypeId?: string | null
    defaultTreatmentCategoryId?: string | null
}

export function SettingsTreatmentTypesSection({ defaultTreatmentTypeId, defaultTreatmentCategoryId }: SettingsTreatmentTypesSectionProps = {}) {
    const { toast } = useToast()
    const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([])
    const [filteredTreatmentTypes, setFilteredTreatmentTypes] = useState<TreatmentType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [editedTreatmentTypes, setEditedTreatmentTypes] = useState<Record<string, EditedTreatmentType>>({})
    const [savingTreatmentTypeId, setSavingTreatmentTypeId] = useState<string | null>(null)
    const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
    const [treatmentTypeToDuplicate, setTreatmentTypeToDuplicate] = useState<TreatmentType | null>(null)
    const [isDuplicating, setIsDuplicating] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [treatmentTypeToDelete, setTreatmentTypeToDelete] = useState<TreatmentType | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newTreatmentTypeName, setNewTreatmentTypeName] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 50

    // Station management states
    const [expandedTreatmentTypeId, setExpandedTreatmentTypeId] = useState<string | null>(null)
    const [allStations, setAllStations] = useState<Station[]>([])
    const [stationTreatmentTypeRules, setStationTreatmentTypeRules] = useState<Record<string, Record<string, StationTreatmentTypeRule>>>({})
    const [originalStationTreatmentTypeRules, setOriginalStationTreatmentTypeRules] = useState<Record<string, Record<string, StationTreatmentTypeRule>>>({})
    const [loadingStations, setLoadingStations] = useState<string | null>(null)
    const [savingStationRules, setSavingStationRules] = useState<string | null>(null)
    const [globalDurationValue, setGlobalDurationValue] = useState<Record<string, number>>({})
    const [durationInputValues, setDurationInputValues] = useState<Record<string, Record<string, string>>>({})
    const [isTypingGlobal, setIsTypingGlobal] = useState<Record<string, boolean>>({})
    const [isTypingStation, setIsTypingStation] = useState<Record<string, Record<string, boolean>>>({})

    // Filter states
    const [selectedTreatmentTypeIds, setSelectedTreatmentTypeIds] = useState<string[]>([])
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const shiftPressedRef = useRef(false)
    const shiftKeyHeldRef = useRef(false)
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
    const [currentBulkAction, setCurrentBulkAction] = useState<"size" | "categories" | "delete" | null>(null)
    const [isBulkSizeDialogOpen, setIsBulkSizeDialogOpen] = useState(false)
    const [isBulkCategoriesDialogOpen, setIsBulkCategoriesDialogOpen] = useState(false)
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)

    // Filter states
    const [searchTerm, setSearchTerm] = useState("")
    const [hasNotesFilter, setHasNotesFilter] = useState<"all" | "with" | "without">("all")
    const [remoteBookingFilter, setRemoteBookingFilter] = useState<"all" | "allowed" | "not-allowed">("all")
    const [isActiveFilter, setIsActiveFilter] = useState<"all" | "active" | "inactive">("all")
    const [priceFilterType, setPriceFilterType] = useState<"all" | "has-min" | "has-max" | "has-hourly" | "no-prices" | "min-lt" | "min-gt" | "max-lt" | "max-gt" | "hourly-lt" | "hourly-gt">("all")
    const [priceFilterValue, setPriceFilterValue] = useState<string>("")
    const [treatmentTypeFilter, setTreatmentTypeFilter] = useState<string>("")
    const [treatmentTypeFilterId, setTreatmentTypeFilterId] = useState<string | null>(defaultTreatmentTypeId ?? null)
    const [treatmentCategoryFilter, setTreatmentCategoryFilter] = useState<string>("")
    const [treatmentCategoryFilterId, setTreatmentCategoryFilterId] = useState<string | null>(defaultTreatmentCategoryId ?? null)
    const defaultTreatmentTypeAppliedRef = useRef<string | null>(null)
    const defaultTreatmentCategoryAppliedRef = useRef<string | null>(null)

    // Category states
    const [treatmentCategories, setTreatmentCategories] = useState<TreatmentCategory[]>([])
    const [treatmentTypeTypesMap, setTreatmentTypeTypesMap] = useState<Record<string, string[]>>({})
    const [treatmentTypeCategoriesMap, setTreatmentTypeCategoriesMap] = useState<Record<string, string[]>>({})
    const [editedTypesMap, setEditedTypesMap] = useState<Record<string, string[]>>({})
    const [editedCategoriesMap, setEditedCategoriesMap] = useState<Record<string, string[]>>({})
    const [isCreatingType, setIsCreatingType] = useState(false)
    const [isCreatingCategory, setIsCreatingCategory] = useState(false)
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)
    const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
    const [deleteTypeConfirmOpen, setDeleteTypeConfirmOpen] = useState<string | null>(null)
    const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] = useState<string | null>(null)
    const [isSavingEdit, setIsSavingEdit] = useState(false)

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

    const searchTreatmentTypes = useCallback(
        async (search: string, limit = 10) => {
            const trimmed = search.trim()
            console.log("🔍 [SettingsTreatmentTypesSection] Searching treatment types", { search: trimmed, limit })
            try {
                let query = supabase
                    .from("treatment_types")
                    .select("name")
                    .order("name")
                    .limit(limit)

                if (trimmed) {
                    query = query.ilike("name", `%${trimmed}%`)
                }

                const { data, error } = await query
                if (error) throw error

                const results = (data ?? []).map((item) => item.name)
                console.log("✅ [SettingsTreatmentTypesSection] Found treatment types", { count: results.length })
                return results
            } catch (error) {
                console.error("❌ [SettingsTreatmentTypesSection] Failed searching treatment types", { error })
                return []
            }
        },
        []
    )

    const searchTreatmentCategories = useCallback(
        async (search: string, limit = 10) => {
            const trimmed = search.trim()
            console.log("🔍 [SettingsTreatmentTypesSection] Searching treatment categories", { search: trimmed, limit })
            try {
                let query = supabase
                    .from("treatment_categories")
                    .select("name")
                    .order("name")
                    .limit(limit)

                if (trimmed) {
                    query = query.ilike("name", `%${trimmed}%`)
                }

                const { data, error } = await query
                if (error) throw error

                const results = (data ?? []).map((item) => item.name)
                console.log("✅ [SettingsTreatmentTypesSection] Found treatment categories", { count: results.length })
                return results
            } catch (error) {
                console.error("❌ [SettingsTreatmentTypesSection] Failed searching treatment categories", { error })
                return []
            }
        },
        []
    )

    const handleTreatmentTypeFilterChange = (value: string) => {
        setTreatmentTypeFilter(value)
        if (!value.trim()) {
            setTreatmentTypeFilterId(null)
            return
        }
        const match = treatmentTypes.find((type) => type.name === value.trim())
        setTreatmentTypeFilterId(match ? match.id : null)
    }

    const handleTreatmentCategoryFilterChange = (value: string) => {
        setTreatmentCategoryFilter(value)
        if (!value.trim()) {
            setTreatmentCategoryFilterId(null)
            return
        }
        const match = treatmentCategories.find((category) => category.name === value.trim())
        setTreatmentCategoryFilterId(match ? match.id : null)
    }

    // Handlers for creating new types and categories
    const handleCreateNewType = async (name: string): Promise<string | undefined> => {
        if (!name.trim()) return undefined
        setIsCreatingType(true)
        try {
            const { data, error } = await supabase
                .from("treatment_types")
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
                    .from("treatment_types")
                    .select("*")
                    .eq("name", name.trim())
                    .single()

                if (existing) {
                    setTreatmentTypes(prev => [...prev, existing])
                    toast({
                        title: "הצלחה",
                        description: `הקטגוריה "${name.trim()}" כבר קיימת`,
                    })
                    return existing.id
                }
            }

            if (data) {
                setTreatmentTypes(prev => [...prev, data])
                toast({
                    title: "הצלחה",
                    description: `הקטגוריה "${name.trim()}" נוספה בהצלחה`,
                })
                return data.id
            }
            return undefined
        } catch (error) {
            console.error("Error creating new type:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף קטגוריה ראשית",
                variant: "destructive",
            })
            return undefined
        } finally {
            setIsCreatingType(false)
        }
    }

    const handleCreateNewCategory = async (name: string): Promise<string | undefined> => {
        if (!name.trim()) return undefined
        setIsCreatingCategory(true)
        try {
            const { data, error } = await supabase
                .from("treatment_categories")
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
                    .from("treatment_categories")
                    .select("*")
                    .eq("name", name.trim())
                    .single()

                if (existing) {
                    setTreatmentCategories(prev => [...prev, existing])
                    toast({
                        title: "הצלחה",
                        description: `הקטגוריה "${name.trim()}" כבר קיימת`,
                    })
                    return existing.id
                }
            }

            if (data) {
                setTreatmentCategories(prev => [...prev, data])
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

    // Handlers for editing types and categories
    const handleEditType = async (id: string, newName: string) => {
        if (!newName.trim()) return

        const type = treatmentTypes.find(t => t.id === id)
        if (type && newName.trim() === type.name) {
            setEditingTypeId(null)
            return
        }

        setIsSavingEdit(true)
        try {
            // Check if new name already exists
            const { data: existing, error: checkError } = await supabase
                .from("treatment_types")
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

            // Update the type
            const { error } = await supabase
                .from("treatment_types")
                .update({ name: newName.trim() })
                .eq("id", id)

            if (error) throw error

            // Update local state
            setTreatmentTypes(prev => prev.map(t => t.id === id ? { ...t, name: newName.trim() } : t))

            setEditingTypeId(null)
            toast({
                title: "הצלחה",
                description: `הקטגוריה עודכנה בהצלחה`,
            })
        } catch (error) {
            console.error("Error editing type:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לערוך קטגוריה ראשית",
                variant: "destructive",
            })
        } finally {
            setIsSavingEdit(false)
        }
    }

    const handleEditCategory = async (id: string, newName: string) => {
        if (!newName.trim()) return

        const category = treatmentCategories.find(c => c.id === id)
        if (category && newName.trim() === category.name) {
            setEditingCategoryId(null)
            return
        }

        setIsSavingEdit(true)
        try {
            // Check if new name already exists
            const { data: existing, error: checkError } = await supabase
                .from("treatment_categories")
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
                .from("treatment_categories")
                .update({ name: newName.trim() })
                .eq("id", id)

            if (error) throw error

            // Update local state
            setTreatmentCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName.trim() } : c))

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

    // Handlers for deleting types and categories
    const handleDeleteType = async (id: string) => {
        setDeletingTypeId(id)
        try {
            const type = treatmentTypes.find(t => t.id === id)
            if (!type) return

            // First, delete all relationships
            const { error: relationsError } = await supabase
                .from("treatmentType_treatment_types")
                .delete()
                .eq("treatment_type_id", id)

            if (relationsError) throw relationsError

            // Then delete the type itself
            const { error } = await supabase
                .from("treatment_types")
                .delete()
                .eq("id", id)

            if (error) throw error

            // Update local state
            setTreatmentTypes(prev => prev.filter(t => t.id !== id))

            // Remove from all treatmentType selections
            const updatedTypesMap: Record<string, string[]> = {}
            Object.keys(treatmentTypeTypesMap).forEach(treatmentTypeId => {
                updatedTypesMap[treatmentTypeId] = treatmentTypeTypesMap[treatmentTypeId].filter(typeId => typeId !== id)
            })
            setTreatmentTypeTypesMap(updatedTypesMap)

            // Also remove from edited types
            const updatedEditedTypes: Record<string, string[]> = {}
            Object.keys(editedTypesMap).forEach(treatmentTypeId => {
                updatedEditedTypes[treatmentTypeId] = (editedTypesMap[treatmentTypeId] || []).filter(typeId => typeId !== id)
            })
            setEditedTypesMap(updatedEditedTypes)

            toast({
                title: "הצלחה",
                description: `הקטגוריה "${type.name}" נמחקה בהצלחה`,
            })
        } catch (error) {
            console.error("Error deleting type:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק קטגוריה ראשית",
                variant: "destructive",
            })
        } finally {
            setDeletingTypeId(null)
        }
    }

    const handleDeleteCategory = async (id: string) => {
        setDeletingCategoryId(id)
        try {
            const category = treatmentCategories.find(c => c.id === id)
            if (!category) return

            // First, delete all relationships
            const { error: relationsError } = await supabase
                .from("treatmentType_treatment_categories")
                .delete()
                .eq("treatment_category_id", id)

            if (relationsError) throw relationsError

            // Then delete the category itself
            const { error } = await supabase
                .from("treatment_categories")
                .delete()
                .eq("id", id)

            if (error) throw error

            // Update local state
            setTreatmentCategories(prev => prev.filter(c => c.id !== id))

            // Remove from all treatmentType selections
            const updatedCategoriesMap: Record<string, string[]> = {}
            Object.keys(treatmentTypeCategoriesMap).forEach(treatmentTypeId => {
                updatedCategoriesMap[treatmentTypeId] = treatmentTypeCategoriesMap[treatmentTypeId].filter(categoryId => categoryId !== id)
            })
            setTreatmentTypeCategoriesMap(updatedCategoriesMap)

            // Also remove from edited categories
            const updatedEditedCategories: Record<string, string[]> = {}
            Object.keys(editedCategoriesMap).forEach(treatmentTypeId => {
                updatedEditedCategories[treatmentTypeId] = (editedCategoriesMap[treatmentTypeId] || []).filter(categoryId => categoryId !== id)
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

    // Data loading is handled by useTreatmentTypesSettings hook

    // Load all data using the API module hook
    const { data: settingsData, isLoading: isLoadingSettings, error: settingsError, refetch } = useTreatmentTypesSettings()

    // Sync settings data to component state
    useEffect(() => {
        if (settingsData) {
            setTreatmentTypes(settingsData.treatmentTypes || [])
            setFilteredTreatmentTypes(settingsData.treatmentTypes || [])
            setAllStations(settingsData.stations || [])
            setStationTreatmentTypeRules(settingsData.stationTreatmentTypeRules || {})
            setDurationInputValues(settingsData.durationInputValues || {})
            setTreatmentTypes(settingsData.treatmentTypes || [])
            setTreatmentCategories(settingsData.treatmentCategories || [])
            setTreatmentTypeTypesMap(settingsData.treatmentTypeTypesMap || {})
            setTreatmentTypeCategoriesMap(settingsData.treatmentTypeCategoriesMap || {})

            // Create original rules map for change tracking
            const originalRulesMap: Record<string, Record<string, StationTreatmentTypeRule>> = {}
            Object.keys(settingsData.stationTreatmentTypeRules || {}).forEach((treatmentTypeId) => {
                originalRulesMap[treatmentTypeId] = JSON.parse(JSON.stringify(settingsData.stationTreatmentTypeRules[treatmentTypeId]))
            })
            setOriginalStationTreatmentTypeRules(originalRulesMap)
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

    // Load all station treatmentType rules for all treatmentTypes at once - much more efficient
    const loadAllStationTreatmentTypeRules = async () => {
        if (allStations.length === 0 || treatmentTypes.length === 0) {
            return
        }

        try {
            console.log("[SettingsTreatmentTypesSection] Loading all station treatmentType rules...")

            // Fetch all station treatmentType rules for all treatmentTypes in a single query
            const { data, error } = await supabase
                .from("station_treatmentType_rules")
                .select("*")
                .in("treatment_type_id", treatmentTypes.map(b => b.id))

            if (error) throw error

            console.log("[SettingsTreatmentTypesSection] Fetched", data?.length || 0, "station treatmentType rules")

            // Group rules by treatment_type_id
            const rulesByTreatmentType: Record<string, StationTreatmentTypeRule[]> = {}
            treatmentTypes.forEach(treatmentType => {
                rulesByTreatmentType[treatmentType.id] = data?.filter(r => r.treatment_type_id === treatmentType.id) || []
            })

            // Process each treatmentType's rules
            const allRulesMap: Record<string, Record<string, StationTreatmentTypeRule>> = {}
            const allDurationInputValues: Record<string, Record<string, string>> = {}
            const allOriginalRulesMap: Record<string, Record<string, StationTreatmentTypeRule>> = {}

            treatmentTypes.forEach((treatmentType) => {
                const treatmentTypeRules = rulesByTreatmentType[treatmentType.id] || []
                const rulesMap: Record<string, StationTreatmentTypeRule> = {}
                const inputValuesMap: Record<string, string> = {}

                // Initialize all stations with default values or existing rules
                allStations.forEach((station) => {
                    const existingRule = treatmentTypeRules.find((r) => r.station_id === station.id)
                    if (existingRule) {
                        const minutes = existingRule.duration_modifier_minutes ?? 0
                        rulesMap[station.id] = {
                            id: existingRule.id,
                            station_id: station.id,
                            treatment_type_id: treatmentType.id,
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
                            treatment_type_id: treatmentType.id,
                            is_active: true,
                            remote_booking_allowed: false,
                            requires_staff_approval: false,
                            duration_modifier_minutes: 0,
                        }
                        inputValuesMap[station.id] = formatDurationFromMinutes(0)
                    }
                })

                allRulesMap[treatmentType.id] = rulesMap
                allDurationInputValues[treatmentType.id] = inputValuesMap
                allOriginalRulesMap[treatmentType.id] = JSON.parse(JSON.stringify(rulesMap))
            })

            setStationTreatmentTypeRules(allRulesMap)
            setDurationInputValues(allDurationInputValues)
            setOriginalStationTreatmentTypeRules(allOriginalRulesMap)

            console.log("[SettingsTreatmentTypesSection] Loaded all station treatmentType rules for", treatmentTypes.length, "treatmentTypes")
        } catch (error) {
            console.error("Error loading all station treatmentType rules:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את נתוני העמדות",
                variant: "destructive",
            })
        }
    }

    const loadStationTreatmentTypeRules = async (treatmentTypeId: string) => {
        // If rules are already loaded, don't reload
        if (stationTreatmentTypeRules[treatmentTypeId] && Object.keys(stationTreatmentTypeRules[treatmentTypeId]).length > 0) {
            return
        }
        if (allStations.length === 0) {
            console.log("[SettingsTreatmentTypesSection] Stations not loaded yet, waiting...")
            // Wait a bit and try again (stations should be loading)
            setTimeout(() => {
                if (allStations.length > 0) {
                    loadStationTreatmentTypeRules(treatmentTypeId)
                } else {
                    setLoadingStations(null)
                }
            }, 500)
            return
        }

        setLoadingStations(treatmentTypeId)
        try {
            const { data, error } = await supabase
                .from("station_treatmentType_rules")
                .select("*")
                .eq("treatment_type_id", treatmentTypeId)

            if (error) throw error

            // Create a map of station_id -> rule
            const rulesMap: Record<string, StationTreatmentTypeRule> = {}

            // Initialize all stations with default values
            allStations.forEach((station) => {
                const existingRule = data?.find((r) => r.station_id === station.id)
                if (existingRule) {
                    const minutes = existingRule.duration_modifier_minutes ?? 0
                    rulesMap[station.id] = {
                        id: existingRule.id,
                        station_id: station.id,
                        treatment_type_id: treatmentTypeId,
                        is_active: existingRule.is_active ?? true,
                        remote_booking_allowed: existingRule.remote_booking_allowed ?? false,
                        requires_staff_approval: existingRule.requires_staff_approval ?? false,
                        duration_modifier_minutes: minutes,
                    }
                } else {
                    // Create default rule for stations that don't have one
                    rulesMap[station.id] = {
                        station_id: station.id,
                        treatment_type_id: treatmentTypeId,
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

            setStationTreatmentTypeRules((prev) => ({
                ...prev,
                [treatmentTypeId]: rulesMap,
            }))

            // Initialize duration input values
            setDurationInputValues((prev) => ({
                ...prev,
                [treatmentTypeId]: inputValuesMap,
            }))

            setOriginalStationTreatmentTypeRules((prev) => ({
                ...prev,
                [treatmentTypeId]: originalRulesMap,
            }))

            console.log("[SettingsTreatmentTypesSection] Loaded station rules for treatmentType:", treatmentTypeId, rulesMap)
        } catch (error) {
            console.error("Error loading station treatmentType rules:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את נתוני העמדות",
                variant: "destructive",
            })
        } finally {
            setLoadingStations(null)
        }
    }

    const toggleTreatmentTypeExpand = (treatmentTypeId: string) => {
        setExpandedTreatmentTypeId((prev) => {
            // If clicking the same treatmentType, collapse it
            if (prev === treatmentTypeId) {
                setLoadingStations(null)
                return null
            }
            // Otherwise, expand the new treatmentType (this automatically collapses the previous one)
            // Rules should already be loaded by loadAllDataFromBackend, but if not, load them as fallback
            if (!stationTreatmentTypeRules[treatmentTypeId] || Object.keys(stationTreatmentTypeRules[treatmentTypeId]).length === 0) {
                setLoadingStations(treatmentTypeId)
                loadStationTreatmentTypeRules(treatmentTypeId)
            }
            return treatmentTypeId
        })
    }

    // Calculate parent checkbox state based on child stations
    // Note: TreatmentType-level is_active, remote_booking_allowed, and requires_staff_approval are no longer stored in DB
    // They are always calculated from station rules
    // The parent checkbox should reflect ALL stations, not just active ones
    const getParentCheckboxState = (
        treatmentTypeId: string,
        field: "is_active" | "remote_booking_allowed" | "requires_staff_approval"
    ): { checked: boolean; indeterminate: boolean } => {
        const treatmentTypeRules = stationTreatmentTypeRules[treatmentTypeId]
        if (!treatmentTypeRules || Object.keys(treatmentTypeRules).length === 0) {
            // No station rules loaded yet - return unchecked (not indeterminate)
            return { checked: false, indeterminate: false }
        }

        // Consider ALL stations when calculating parent checkbox state
        // This ensures the parent accurately reflects the status of all its children
        const rulesToCheck = Object.values(treatmentTypeRules)

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
    // Note: This only updates station rules, NOT treatmentType-level fields
    // TreatmentType-level is_active, remote_booking_allowed, and requires_staff_approval are calculated from stations
    const handleParentCheckboxChange = (
        treatmentTypeId: string,
        field: "is_active" | "remote_booking_allowed" | "requires_staff_approval",
        checked: boolean
    ) => {
        const treatmentTypeRules = stationTreatmentTypeRules[treatmentTypeId]
        if (!treatmentTypeRules || Object.keys(treatmentTypeRules).length === 0) {
            // If no station rules loaded, do nothing (can't sync what doesn't exist)
            return
        }

        // Update all station rules for this treatmentType
        // This does NOT mark the treatmentType row as dirty - only station rule changes do
        setStationTreatmentTypeRules((prev) => {
            const treatmentTypeRules = prev[treatmentTypeId] || {}
            const updatedRules: Record<string, StationTreatmentTypeRule> = {}

            Object.keys(treatmentTypeRules).forEach((stationId) => {
                updatedRules[stationId] = {
                    ...treatmentTypeRules[stationId],
                    [field]: checked,
                }
            })

            return {
                ...prev,
                [treatmentTypeId]: updatedRules,
            }
        })
    }

    const handleStationRuleChange = (treatmentTypeId: string, stationId: string, field: "is_active" | "remote_booking_allowed" | "requires_staff_approval" | "duration_modifier_minutes", value: boolean | number | null) => {
        setStationTreatmentTypeRules((prev) => {
            const treatmentTypeRules = prev[treatmentTypeId] || {}
            const updatedRules = { ...treatmentTypeRules }

            // Update the target station
            updatedRules[stationId] = {
                ...treatmentTypeRules[stationId],
                [field]: value,
            }

            return {
                ...prev,
                [treatmentTypeId]: updatedRules,
            }
        })
    }


    // Calculate the global duration value from all station times
    // Returns the common value if all stations have the same time, null otherwise
    const getGlobalDurationFromStations = (treatmentTypeId: string): number | null => {
        const treatmentTypeRules = stationTreatmentTypeRules[treatmentTypeId]
        if (!treatmentTypeRules || Object.keys(treatmentTypeRules).length === 0) {
            return null
        }

        const stationMinutes = Object.values(treatmentTypeRules).map((rule) => rule.duration_modifier_minutes ?? 0)
        if (stationMinutes.length === 0) {
            return null
        }

        // Check if all stations have the same time
        const firstValue = stationMinutes[0]
        const allSame = stationMinutes.every((minutes) => minutes === firstValue)

        return allSame ? firstValue : null
    }

    const handleApplyTimeToAll = (treatmentTypeId: string, durationString: string) => {
        const timeMinutes = parseDurationToMinutes(durationString)

        if (timeMinutes === null || timeMinutes < 0) {
            toast({
                title: "שגיאה",
                description: "אנא הכנס זמן תקין בפורמט שעות:דקות (למשל: 1:30)",
                variant: "destructive",
            })
            return
        }

        const treatmentTypeRules = stationTreatmentTypeRules[treatmentTypeId]
        if (!treatmentTypeRules) return

        // Update time for all stations
        setStationTreatmentTypeRules((prev) => {
            const treatmentTypeRules = prev[treatmentTypeId] || {}
            const updatedRules: Record<string, StationTreatmentTypeRule> = {}

            // Update all stations with the new time
            Object.keys(treatmentTypeRules).forEach((stationId) => {
                updatedRules[stationId] = {
                    ...treatmentTypeRules[stationId],
                    duration_modifier_minutes: timeMinutes,
                }
            })

            // Update duration input values for all stations
            const inputValuesMap: Record<string, string> = {}
            Object.keys(treatmentTypeRules).forEach((stationId) => {
                inputValuesMap[stationId] = formatDurationFromMinutes(timeMinutes)
            })

            setDurationInputValues((prev) => ({
                ...prev,
                [treatmentTypeId]: inputValuesMap,
            }))

            return {
                ...prev,
                [treatmentTypeId]: updatedRules,
            }
        })

        // Update global duration value to match
        setGlobalDurationValue((prev) => ({
            ...prev,
            [treatmentTypeId]: timeMinutes,
        }))

        const durationStr = formatDurationFromMinutes(timeMinutes)
        toast({
            title: "בוצע",
            description: `הוגדר זמן ${durationStr} לכל העמדות`,
        })
    }

    const handleSaveStationRules = async (treatmentTypeId: string) => {
        const treatmentTypeRules = stationTreatmentTypeRules[treatmentTypeId]
        if (!treatmentTypeRules) {
            toast({
                title: "שגיאה",
                description: "אין הגדרות עמדות לשמירה",
                variant: "destructive",
            })
            return
        }

        const treatmentType = treatmentTypes.find((b) => b.id === treatmentTypeId)
        if (!treatmentType) {
            toast({
                title: "שגיאה",
                description: "גזע לא נמצא",
                variant: "destructive",
            })
            return
        }

        setSavingStationRules(treatmentTypeId)
        try {
            const rulesToSave = Object.values(treatmentTypeRules)

            // Prepare data for batch upsert (Supabase upsert uses ON CONFLICT on unique constraint)
            const rulesData = rulesToSave.map((rule) => ({
                station_id: rule.station_id,
                treatment_type_id: rule.treatment_type_id,
                is_active: rule.is_active,
                remote_booking_allowed: rule.remote_booking_allowed,
                requires_staff_approval: rule.requires_staff_approval ?? false,
                duration_modifier_minutes: rule.duration_modifier_minutes ?? 0,
            }))

            // Use upsert with conflict resolution on the unique constraint (station_id, treatment_type_id)
            // This handles both inserts and updates in a single API call
            const { data: upsertedRules, error: upsertError } = await supabase
                .from("station_treatmentType_rules")
                .upsert(rulesData, {
                    onConflict: "station_id,treatment_type_id",
                })
                .select("id,station_id,treatment_type_id")

            if (upsertError) throw upsertError

            console.log("[SettingsTreatmentTypesSection] Batch upserted station rules:", upsertedRules?.length || 0, "rules")
            // Note: We no longer update treatmentType-level is_active or remote_booking_allowed
            // These are now calculated dynamically from station rules

            toast({
                title: "הצלחה",
                description: "הגדרות העמדות נשמרו בהצלחה",
            })

            // Update the original state with the saved rules (including new IDs from upsert)
            const updatedRulesMap = JSON.parse(JSON.stringify(treatmentTypeRules))
            setOriginalStationTreatmentTypeRules((prev) => ({
                ...prev,
                [treatmentTypeId]: updatedRulesMap,
            }))

            // Reload data in the background silently (no loading state, no flicker)
            // This ensures consistency without disrupting the UI
            loadAllDataFromBackend(false).catch((error) => {
                console.error("[SettingsTreatmentTypesSection] Background refresh failed:", error)
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

    const handleCancelStationRules = (treatmentTypeId: string) => {
        const originalRules = originalStationTreatmentTypeRules[treatmentTypeId]
        if (!originalRules) {
            // No original state, just reload all data silently
            loadAllDataFromBackend(false).catch((error) => {
                console.error("[SettingsTreatmentTypesSection] Background refresh failed:", error)
            })
            return
        }

        // Restore original state
        const restoredRules = JSON.parse(JSON.stringify(originalRules))
        setStationTreatmentTypeRules((prev) => ({
            ...prev,
            [treatmentTypeId]: restoredRules,
        }))

        toast({
            title: "בוטל",
            description: "השינויים בוטלו",
        })
    }

    const hasStationRuleChanges = (treatmentTypeId: string): boolean => {
        const currentRules = stationTreatmentTypeRules[treatmentTypeId]
        const originalRules = originalStationTreatmentTypeRules[treatmentTypeId]

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
            const ids = filteredTreatmentTypes.map((treatmentType) => treatmentType.id)
            setSelectedTreatmentTypeIds(ids)
            setLastSelectedIndex(null)
        } else {
            setSelectedTreatmentTypeIds([])
            setLastSelectedIndex(null)
        }
    }

    const handleTreatmentTypeSelectionChange = (treatmentTypeId: string, isChecked: boolean, index: number) => {
        setSelectedTreatmentTypeIds((prev) => {
            const selectionSet = new Set(prev)
            if (isChecked) {
                selectionSet.add(treatmentTypeId)
            } else {
                selectionSet.delete(treatmentTypeId)
            }

            const isShiftSelection =
                (shiftPressedRef.current || shiftKeyHeldRef.current) &&
                lastSelectedIndex !== null &&
                lastSelectedIndex !== index

            if (isShiftSelection) {
                const start = Math.min(lastSelectedIndex!, index)
                const end = Math.max(lastSelectedIndex!, index)
                const rangeIds = filteredTreatmentTypes.slice(start, end + 1).map((treatmentType) => treatmentType.id)

                if (isChecked) {
                    rangeIds.forEach((id) => selectionSet.add(id))
                } else {
                    rangeIds.forEach((id) => selectionSet.delete(id))
                }
            }

            return filteredTreatmentTypes.map((treatmentType) => treatmentType.id).filter((id) => selectionSet.has(id))
        })

        if (isChecked) {
            setLastSelectedIndex(index)
        } else if (!shiftPressedRef.current) {
            setLastSelectedIndex(null)
        }

        shiftPressedRef.current = false
    }

    const clearSelection = () => {
        setSelectedTreatmentTypeIds([])
        setLastSelectedIndex(null)
    }

    const handleBulkSizeConfirm = async (sizeClass: "small" | "medium" | "medium_large" | "large" | null) => {
        if (selectedTreatmentTypeIds.length === 0) return
        console.log("🛠️ [SettingsTreatmentTypesSection] Bulk updating treatmentType size", { selectedTreatmentTypeIds, sizeClass })
        setCurrentBulkAction("size")
        setIsBulkActionLoading(true)
        try {
            const { error } = await supabase
                .from("treatment_types")
                .update({ size_class: sizeClass })
                .in("id", selectedTreatmentTypeIds)

            if (error) throw error

            setTreatmentTypes((prev) =>
                prev.map((treatmentType) =>
                    selectedTreatmentTypeIds.includes(treatmentType.id) ? { ...treatmentType, size_class: sizeClass } : treatmentType
                )
            )
            setFilteredTreatmentTypes((prev) =>
                prev.map((treatmentType) =>
                    selectedTreatmentTypeIds.includes(treatmentType.id) ? { ...treatmentType, size_class: sizeClass } : treatmentType
                )
            )

            toast({
                title: "עודכן בהצלחה",
                description: `גודל הגזע עודכן עבור ${selectedTreatmentTypeIds.length} גזעים`,
            })

            setIsBulkSizeDialogOpen(false)
            clearSelection()
        } catch (error) {
            console.error("❌ [SettingsTreatmentTypesSection] Failed bulk size update", { error })
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
        applyTypes,
        typeIds,
        applyCategories,
        categoryIds,
    }: {
        applyTypes: boolean
        typeIds: string[]
        applyCategories: boolean
        categoryIds: string[]
    }) => {
        if (selectedTreatmentTypeIds.length === 0) return
        if (!applyTypes && !applyCategories) {
            toast({
                title: "לא נבחרו פעולות",
                description: "בחר האם לעדכן קטגוריה 1, קטגוריה 2 או שתיהן.",
            })
            return
        }

        console.log("🛠️ [SettingsTreatmentTypesSection] Bulk updating treatmentType categories", {
            selectedTreatmentTypeIds,
            applyTypes,
            typeIds,
            applyCategories,
            categoryIds,
        })

        setCurrentBulkAction("categories")
        setIsBulkActionLoading(true)

        try {
            if (applyTypes) {
                const { error: deleteTypesError } = await supabase
                    .from("treatmentType_treatment_types")
                    .delete()
                    .in("treatment_type_id", selectedTreatmentTypeIds)
                if (deleteTypesError) throw deleteTypesError

                if (typeIds.length > 0) {
                    const insertRows = selectedTreatmentTypeIds.flatMap((treatmentTypeId) =>
                        typeIds.map((typeId) => ({
                            treatment_type_id: treatmentTypeId,
                            related_treatment_type_id: typeId,
                        }))
                    )
                    const { error: insertTypesError } = await supabase.from("treatmentType_treatment_types").insert(insertRows)
                    if (insertTypesError) throw insertTypesError
                }

                setTreatmentTypeTypesMap((prev) => {
                    const updated = { ...prev }
                    selectedTreatmentTypeIds.forEach((id) => {
                        updated[id] = [...typeIds]
                    })
                    return updated
                })

                setEditedTypesMap((prev) => {
                    const updated = { ...prev }
                    selectedTreatmentTypeIds.forEach((id) => {
                        delete updated[id]
                    })
                    return updated
                })
            }

            if (applyCategories) {
                const { error: deleteCategoriesError } = await supabase
                    .from("treatmentType_treatment_categories")
                    .delete()
                    .in("treatment_type_id", selectedTreatmentTypeIds)
                if (deleteCategoriesError) throw deleteCategoriesError

                if (categoryIds.length > 0) {
                    const insertRows = selectedTreatmentTypeIds.flatMap((treatmentTypeId) =>
                        categoryIds.map((categoryId) => ({
                            treatment_type_id: treatmentTypeId,
                            treatment_category_id: categoryId,
                        }))
                    )
                    const { error: insertCategoriesError } = await supabase
                        .from("treatmentType_treatment_categories")
                        .insert(insertRows)
                    if (insertCategoriesError) throw insertCategoriesError
                }

                setTreatmentTypeCategoriesMap((prev) => {
                    const updated = { ...prev }
                    selectedTreatmentTypeIds.forEach((id) => {
                        updated[id] = [...categoryIds]
                    })
                    return updated
                })

                setEditedCategoriesMap((prev) => {
                    const updated = { ...prev }
                    selectedTreatmentTypeIds.forEach((id) => {
                        delete updated[id]
                    })
                    return updated
                })
            }

            toast({
                title: "עודכן בהצלחה",
                description: `הקטגוריות עודכנו עבור ${selectedTreatmentTypeIds.length} גזעים`,
            })

            setIsBulkCategoriesDialogOpen(false)
            clearSelection()
        } catch (error) {
            console.error("❌ [SettingsTreatmentTypesSection] Failed bulk categories update", { error })
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
        if (selectedTreatmentTypeIds.length === 0) return
        console.log("🗑️ [SettingsTreatmentTypesSection] Bulk deleting treatmentTypes", { selectedTreatmentTypeIds })
        setCurrentBulkAction("delete")
        setIsBulkActionLoading(true)
        try {
            const { error } = await supabase.from("treatment_types").delete().in("id", selectedTreatmentTypeIds)
            if (error) throw error

            setTreatmentTypes((prev) => prev.filter((treatmentType) => !selectedTreatmentTypeIds.includes(treatmentType.id)))
            setFilteredTreatmentTypes((prev) => {
                const updated = prev.filter((treatmentType) => !selectedTreatmentTypeIds.includes(treatmentType.id))
                setCurrentPage((page) => {
                    const maxPage = Math.max(1, Math.ceil(Math.max(updated.length, 1) / ITEMS_PER_PAGE))
                    return Math.min(page, maxPage)
                })
                return updated
            })

            setTreatmentTypeTypesMap((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setTreatmentTypeCategoriesMap((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setEditedTreatmentTypes((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setEditedTypesMap((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setEditedCategoriesMap((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setStationTreatmentTypeRules((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setOriginalStationTreatmentTypeRules((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setDurationInputValues((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setGlobalDurationValue((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setIsTypingStation((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setTogglingRemoteBooking((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })
            setTogglingApproval((prev) => {
                const updated = { ...prev }
                selectedTreatmentTypeIds.forEach((id) => delete updated[id])
                return updated
            })

            toast({
                title: "הצלחה",
                description: `נמחקו ${selectedTreatmentTypeIds.length} גזעים בהצלחה`,
            })

            setIsBulkDeleteDialogOpen(false)
            clearSelection()
        } catch (error) {
            console.error("❌ [SettingsTreatmentTypesSection] Failed bulk delete", { error })
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
        setSelectedTreatmentTypeIds((prev) => prev.filter((id) => treatmentTypes.some((treatmentType) => treatmentType.id === id)))
    }, [treatmentTypes])

    // Filter treatmentTypes based on search and filters
    useEffect(() => {
        let filtered = [...treatmentTypes]

        // Search by name
        if (searchTerm.trim()) {
            filtered = filtered.filter((treatmentType) =>
                treatmentType.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        // Filter by notes
        if (hasNotesFilter === "with") {
            filtered = filtered.filter((treatmentType) => treatmentType.notes && treatmentType.notes.trim().length > 0)
        } else if (hasNotesFilter === "without") {
            filtered = filtered.filter((treatmentType) => !treatmentType.notes || treatmentType.notes.trim().length === 0)
        }

        // Filter by remote booking (calculated from station rules)
        if (remoteBookingFilter === "allowed") {
            filtered = filtered.filter((treatmentType) => {
                const state = getParentCheckboxState(treatmentType.id, "remote_booking_allowed")
                return state.checked === true && !state.indeterminate
            })
        } else if (remoteBookingFilter === "not-allowed") {
            filtered = filtered.filter((treatmentType) => {
                const state = getParentCheckboxState(treatmentType.id, "remote_booking_allowed")
                return state.checked === false && !state.indeterminate
            })
        }

        // Filter by is_active (calculated from station rules)
        if (isActiveFilter === "active") {
            filtered = filtered.filter((treatmentType) => {
                const state = getParentCheckboxState(treatmentType.id, "is_active")
                return state.checked === true && !state.indeterminate
            })
        } else if (isActiveFilter === "inactive") {
            filtered = filtered.filter((treatmentType) => {
                const state = getParentCheckboxState(treatmentType.id, "is_active")
                return state.checked === false && !state.indeterminate
            })
        }

        // Filter by pricing
        if (priceFilterType === "has-min") {
            filtered = filtered.filter((treatmentType) => treatmentType.min_groom_price != null)
        } else if (priceFilterType === "has-max") {
            filtered = filtered.filter((treatmentType) => treatmentType.max_groom_price != null)
        } else if (priceFilterType === "has-hourly") {
            filtered = filtered.filter((treatmentType) => treatmentType.hourly_price != null)
        } else if (priceFilterType === "no-prices") {
            filtered = filtered.filter(
                (treatmentType) =>
                    treatmentType.min_groom_price == null &&
                    treatmentType.max_groom_price == null &&
                    treatmentType.hourly_price == null
            )
        } else if (priceFilterType === "min-lt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((treatmentType) => treatmentType.min_groom_price != null && treatmentType.min_groom_price < value)
            }
        } else if (priceFilterType === "min-gt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((treatmentType) => treatmentType.min_groom_price != null && treatmentType.min_groom_price > value)
            }
        } else if (priceFilterType === "max-lt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((treatmentType) => treatmentType.max_groom_price != null && treatmentType.max_groom_price < value)
            }
        } else if (priceFilterType === "max-gt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((treatmentType) => treatmentType.max_groom_price != null && treatmentType.max_groom_price > value)
            }
        } else if (priceFilterType === "hourly-lt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((treatmentType) => treatmentType.hourly_price != null && treatmentType.hourly_price < value)
            }
        } else if (priceFilterType === "hourly-gt" && priceFilterValue) {
            const value = parseFloat(priceFilterValue)
            if (!isNaN(value)) {
                filtered = filtered.filter((treatmentType) => treatmentType.hourly_price != null && treatmentType.hourly_price > value)
            }
        }

        if (treatmentTypeFilterId) {
            filtered = filtered.filter((treatmentType) => getTreatmentTypeTypes(treatmentType.id).includes(treatmentTypeFilterId))
        } else if (treatmentTypeFilter.trim()) {
            const normalizedType = treatmentTypeFilter.trim().toLowerCase()
            filtered = filtered.filter((treatmentType) => {
                const typeIds = getTreatmentTypeTypes(treatmentType.id)
                return typeIds.some((typeId) => {
                    const typeName = treatmentTypes.find((type) => type.id === typeId)?.name?.toLowerCase() ?? ""
                    return typeName.includes(normalizedType)
                })
            })
        }

        if (treatmentCategoryFilterId) {
            filtered = filtered.filter((treatmentType) => getTreatmentTypeCategories(treatmentType.id).includes(treatmentCategoryFilterId))
        } else if (treatmentCategoryFilter.trim()) {
            const normalizedCategory = treatmentCategoryFilter.trim().toLowerCase()
            filtered = filtered.filter((treatmentType) => {
                const categoryIds = getTreatmentTypeCategories(treatmentType.id)
                return categoryIds.some((categoryId) => {
                    const categoryName = treatmentCategories.find((category) => category.id === categoryId)?.name?.toLowerCase() ?? ""
                    return categoryName.includes(normalizedCategory)
                })
            })
        }

        setFilteredTreatmentTypes(filtered)
        setCurrentPage(1) // Reset to first page when filters change
    }, [
        treatmentTypes,
        searchTerm,
        hasNotesFilter,
        remoteBookingFilter,
        isActiveFilter,
        priceFilterType,
        priceFilterValue,
        stationTreatmentTypeRules,
        treatmentTypeFilter,
        treatmentTypeFilterId,
        treatmentCategoryFilter,
        treatmentCategoryFilterId,
        treatmentTypes,
        treatmentCategories,
        treatmentTypeTypesMap,
        treatmentTypeCategoriesMap,
    ])

    const fetchTreatmentTypes = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from("treatment_types")
                .select("*")
                .order("name")

            if (error) throw error
            const fetchedTreatmentTypes = data || []
            setTreatmentTypes(fetchedTreatmentTypes)
            setFilteredTreatmentTypes(fetchedTreatmentTypes)
            setEditedTreatmentTypes({}) // Clear edited state on fetch
        } catch (error) {
            console.error("Error fetching treatmentTypes:", error)
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

    const confirmAddTreatmentType = () => {
        if (!newTreatmentTypeName.trim()) {
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
            const newTreatmentType: TreatmentType = {
                id: newId,
                name: newTreatmentTypeName.trim(),
                min_groom_price: null,
                max_groom_price: null,
                hourly_price: null,
                notes: null,
                // Note: is_active and remote_booking_allowed are calculated from station_treatmentType_rules
            }
            const updatedTreatmentTypes = [...treatmentTypes, newTreatmentType]
            setTreatmentTypes(updatedTreatmentTypes)
            setEditedTreatmentTypes({ ...editedTreatmentTypes, [newId]: { ...newTreatmentType } })

            setNewTreatmentTypeName("")
            setIsAddDialogOpen(false)

            // Force scroll to the new row after a brief delay to allow rendering
            setTimeout(() => {
                const element = document.querySelector(`[data-treatmentType-id="${newId}"]`)
                element?.scrollIntoView({ behavior: "smooth", block: "nearest" })
            }, 100)
        } catch (error: unknown) {
            console.error("Error adding treatmentType:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף את הגזע",
                variant: "destructive",
            })
        } finally {
            setIsAdding(false)
        }
    }

    const handleDuplicate = (treatmentType: TreatmentType) => {
        setTreatmentTypeToDuplicate(treatmentType)
        setIsDuplicateDialogOpen(true)
    }

    const confirmDuplicateTreatmentType = async (params: {
        mode: "new" | "existing"
        name?: string
        targetTreatmentTypeIds?: string[]
        copyDetails: boolean
        copyStationRelations: boolean
    }) => {
        if (!treatmentTypeToDuplicate) return

        setIsDuplicating(true)
        try {
            const sourceTreatmentTypeId = treatmentTypeToDuplicate.id

            if (params.mode === "new") {
                // Create new treatmentType
                if (!params.name) throw new Error("TreatmentType name is required for new treatmentType")

                const { data: newTreatmentType, error: treatmentTypeError } = await supabase
                    .from("treatment_types")
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
                if (params.copyStationRelations) {
                    const originalRules = stationTreatmentTypeRules[sourceTreatmentTypeId] || {}
                    const rulesToInsert = Object.values(originalRules).map(rule => ({
                        station_id: rule.station_id,
                        treatment_type_id: newTreatmentTypeId,
                        is_active: rule.is_active ?? true,
                        remote_booking_allowed: rule.remote_booking_allowed ?? false,
                        requires_staff_approval: rule.requires_staff_approval ?? false,
                        duration_modifier_minutes: rule.duration_modifier_minutes ?? 0,
                    }))

                    if (rulesToInsert.length > 0) {
                        const { error: rulesError } = await supabase
                            .from("station_treatmentType_rules")
                            .insert(rulesToInsert)
                        if (rulesError) throw rulesError
                    }
                }

                toast({
                    title: "הצלחה",
                    description: "הגזע שוכפל בהצלחה עם כל הערכים",
                })

                setIsDuplicateDialogOpen(false)

                // Reload all data from backend to include the new treatmentType with all its data (silently)
                loadAllDataFromBackend(false).catch((error) => {
                    console.error("[SettingsTreatmentTypesSection] Background refresh failed:", error)
                })
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
                            .from("treatment_types")
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
                    if (params.copyStationRelations) {
                        const originalRules = stationTreatmentTypeRules[sourceTreatmentTypeId] || {}
                        const rulesToInsert = Object.values(originalRules).map(rule => ({
                            station_id: rule.station_id,
                            treatment_type_id: targetId,
                            is_active: rule.is_active ?? true,
                            remote_booking_allowed: rule.remote_booking_allowed ?? false,
                            requires_staff_approval: rule.requires_staff_approval ?? false,
                            duration_modifier_minutes: rule.duration_modifier_minutes ?? 0,
                        }))

                        if (rulesToInsert.length > 0) {
                            // Delete existing rules for this treatmentType first
                            const { error: deleteRulesError } = await supabase
                                .from("station_treatmentType_rules")
                                .delete()
                                .eq("treatment_type_id", targetId)

                            if (deleteRulesError) throw deleteRulesError

                            const { error: rulesError } = await supabase
                                .from("station_treatmentType_rules")
                                .insert(rulesToInsert)
                            if (rulesError) throw rulesError
                        }
                    }
                }

                toast({
                    title: "הצלחה",
                    description: `הנתונים הועתקו ל-${params.targetTreatmentTypeIds.length} גזעים בהצלחה`,
                })

                setIsDuplicateDialogOpen(false)

                // Reload all data from backend
                loadAllDataFromBackend(false).catch((error) => {
                    console.error("[SettingsTreatmentTypesSection] Background refresh failed:", error)
                })
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
            setIsDuplicating(false)
            setTreatmentTypeToDuplicate(null)
        }
    }

    const handleFieldChange = (treatmentTypeId: string, field: keyof TreatmentType, value: string | number | boolean | null) => {
        setEditedTreatmentTypes({
            ...editedTreatmentTypes,
            [treatmentTypeId]: {
                ...editedTreatmentTypes[treatmentTypeId],
                id: treatmentTypeId,
                [field]: value,
            },
        })
    }

    const handleTypesChange = (treatmentTypeId: string, selectedTypeIds: string[]) => {
        setEditedTypesMap({
            ...editedTypesMap,
            [treatmentTypeId]: selectedTypeIds,
        })
        // Also mark the treatmentType as dirty
        setEditedTreatmentTypes({
            ...editedTreatmentTypes,
            [treatmentTypeId]: {
                ...editedTreatmentTypes[treatmentTypeId],
                id: treatmentTypeId,
            },
        })
    }

    const handleCategoriesChange = (treatmentTypeId: string, selectedCategoryIds: string[]) => {
        setEditedCategoriesMap({
            ...editedCategoriesMap,
            [treatmentTypeId]: selectedCategoryIds,
        })
        // Also mark the treatmentType as dirty
        setEditedTreatmentTypes({
            ...editedTreatmentTypes,
            [treatmentTypeId]: {
                ...editedTreatmentTypes[treatmentTypeId],
                id: treatmentTypeId,
            },
        })
    }

    const handleSaveRow = async (treatmentTypeId: string) => {
        const editedTreatmentType = editedTreatmentTypes[treatmentTypeId]
        const hasEditedCategories = editedTypesMap[treatmentTypeId] !== undefined || editedCategoriesMap[treatmentTypeId] !== undefined

        // If no treatmentType data and no category changes, nothing to save
        if (!editedTreatmentType && !hasEditedCategories) return

        // If treatmentType data exists, validate it
        if (editedTreatmentType) {
            const name = editedTreatmentType.name?.trim() || treatmentTypes.find((b) => b.id === treatmentTypeId)?.name?.trim()
            if (!name) {
                toast({
                    title: "שגיאה",
                    description: "שם הגזע נדרש",
                    variant: "destructive",
                })
                return
            }
        }

        setSavingTreatmentTypeId(treatmentTypeId)
        try {
            let updatedTreatmentType: TreatmentType | null = null

            // Only update treatmentType data if there are treatmentType field changes
            if (editedTreatmentType) {
                const name = editedTreatmentType.name?.trim() || treatmentTypes.find((b) => b.id === treatmentTypeId)?.name?.trim()

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

                const treatmentTypeData = {
                    name: name,
                    size_class: editedTreatmentType.size_class !== undefined
                        ? (editedTreatmentType.size_class?.trim() || null)
                        : treatmentTypes.find((b) => b.id === treatmentTypeId)?.size_class ?? null,
                    min_groom_price: getPriceValue(editedTreatmentType.min_groom_price, treatmentTypes.find((b) => b.id === treatmentTypeId)?.min_groom_price),
                    max_groom_price: getPriceValue(editedTreatmentType.max_groom_price, treatmentTypes.find((b) => b.id === treatmentTypeId)?.max_groom_price),
                    hourly_price: getPriceValue(editedTreatmentType.hourly_price, treatmentTypes.find((b) => b.id === treatmentTypeId)?.hourly_price),
                    notes: editedTreatmentType.notes !== undefined
                        ? (editedTreatmentType.notes?.trim() || null)
                        : treatmentTypes.find((b) => b.id === treatmentTypeId)?.notes ?? null,
                    // Note: is_active and remote_booking_allowed are no longer stored at treatmentType level
                    // They are calculated dynamically from station_treatmentType_rules
                }

                const isNewTreatmentType = treatmentTypeId.startsWith("new-")

                if (isNewTreatmentType) {
                    const { data: insertedData, error } = await supabase.from("treatment_types").insert(treatmentTypeData).select().single()
                    if (error) throw error
                    updatedTreatmentType = insertedData
                    toast({
                        title: "הצלחה",
                        description: "הגזע נוצר בהצלחה",
                    })
                } else {
                    const { data: updatedData, error } = await supabase.from("treatment_types").update(treatmentTypeData).eq("id", treatmentTypeId).select().single()
                    if (error) throw error
                    updatedTreatmentType = updatedData
                    toast({
                        title: "הצלחה",
                        description: "הגזע עודכן בהצלחה",
                    })
                }
            }

            // Save categories and types if they were edited
            const editedTypes = editedTypesMap[treatmentTypeId]
            const editedCategories = editedCategoriesMap[treatmentTypeId]

            if (editedTypes !== undefined || editedCategories !== undefined) {
                // Use updated treatmentType ID if treatmentType was just created, otherwise use the original treatmentTypeId
                const finalTreatmentTypeId = (updatedTreatmentType && treatmentTypeId.startsWith("new-")) ? updatedTreatmentType.id : treatmentTypeId

                // Update types
                if (editedTypes !== undefined) {
                    // Delete existing types
                    await supabase
                        .from("treatmentType_treatment_types")
                        .delete()
                        .eq("treatment_type_id", finalTreatmentTypeId)

                    // Insert new types
                    if (editedTypes.length > 0) {
                        const typesToInsert = editedTypes.map(typeId => ({
                            treatment_type_id: finalTreatmentTypeId,
                            related_treatment_type_id: typeId
                        }))
                        await supabase.from("treatmentType_treatment_types").insert(typesToInsert)
                    }

                    // Update local state
                    setTreatmentTypeTypesMap(prev => ({
                        ...prev,
                        [finalTreatmentTypeId]: editedTypes
                    }))
                }

                // Update categories
                if (editedCategories !== undefined) {
                    // Delete existing categories
                    await supabase
                        .from("treatmentType_treatment_categories")
                        .delete()
                        .eq("treatment_type_id", finalTreatmentTypeId)

                    // Insert new categories
                    if (editedCategories.length > 0) {
                        const categoriesToInsert = editedCategories.map(categoryId => ({
                            treatment_type_id: finalTreatmentTypeId,
                            treatment_category_id: categoryId
                        }))
                        await supabase.from("treatmentType_treatment_categories").insert(categoriesToInsert)
                    }

                    // Update local state
                    setTreatmentTypeCategoriesMap(prev => ({
                        ...prev,
                        [finalTreatmentTypeId]: editedCategories
                    }))
                }
            }

            // Optimistically update the local state immediately
            if (updatedTreatmentType) {
                // Update treatmentTypes state immediately with saved data
                setTreatmentTypes((prev) => prev.map((b) => (b.id === treatmentTypeId ? updatedTreatmentType! : b)))
                setFilteredTreatmentTypes((prev) => prev.map((b) => (b.id === treatmentTypeId ? updatedTreatmentType! : b)))
            }

            // Clear edited state immediately - no refetch needed since we updated optimistically
            setEditedTreatmentTypes((prev) => {
                const newEditedTreatmentTypes = { ...prev }
                delete newEditedTreatmentTypes[treatmentTypeId]
                return newEditedTreatmentTypes
            })

            // Clear edited categories/types
            setEditedTypesMap(prev => {
                const newMap = { ...prev }
                delete newMap[treatmentTypeId]
                return newMap
            })
            setEditedCategoriesMap(prev => {
                const newMap = { ...prev }
                delete newMap[treatmentTypeId]
                return newMap
            })
        } catch (error: unknown) {
            console.error("Error saving treatmentType:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את הגזע"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setSavingTreatmentTypeId(null)
        }
    }

    const handleCancelRow = (treatmentTypeId: string) => {
        const isNewTreatmentType = treatmentTypeId.startsWith("new-")
        if (isNewTreatmentType) {
            // Remove new treatmentType from list
            setTreatmentTypes(treatmentTypes.filter((b) => b.id !== treatmentTypeId))
        }
        // Remove from edited treatmentTypes
        const newEditedTreatmentTypes = { ...editedTreatmentTypes }
        delete newEditedTreatmentTypes[treatmentTypeId]
        setEditedTreatmentTypes(newEditedTreatmentTypes)

        // Clear edited categories/types
        setEditedTypesMap(prev => {
            const newMap = { ...prev }
            delete newMap[treatmentTypeId]
            return newMap
        })
        setEditedCategoriesMap(prev => {
            const newMap = { ...prev }
            delete newMap[treatmentTypeId]
            return newMap
        })
    }

    const hasAnyDirtyTreatmentTypes = () => {
        // Check if any treatmentType-level fields are dirty
        const hasDirtyTreatmentTypeFields = Object.keys(editedTreatmentTypes).length > 0

        // Check if any categories/types are dirty
        const hasDirtyCategories = Object.keys(editedTypesMap).length > 0 || Object.keys(editedCategoriesMap).length > 0

        // Check if any station treatmentType rules are dirty
        const hasDirtyStationRules = treatmentTypes.some((treatmentType) => hasStationRuleChanges(treatmentType.id))

        return hasDirtyTreatmentTypeFields || hasDirtyCategories || hasDirtyStationRules
    }

    const handleSaveAll = async () => {
        const dirtyTreatmentTypeIds = Object.keys(editedTreatmentTypes)
        const treatmentTypesWithDirtyCategories = [
            ...Object.keys(editedTypesMap),
            ...Object.keys(editedCategoriesMap)
        ].filter((id, index, self) => self.indexOf(id) === index) // unique IDs
        const treatmentTypesWithDirtyStationRules = treatmentTypes.filter((treatmentType) => hasStationRuleChanges(treatmentType.id))

        if (dirtyTreatmentTypeIds.length === 0 && treatmentTypesWithDirtyCategories.length === 0 && treatmentTypesWithDirtyStationRules.length === 0) return

        // Save all dirty treatmentType-level fields sequentially
        for (const treatmentTypeId of dirtyTreatmentTypeIds) {
            await handleSaveRow(treatmentTypeId)
        }

        // Save treatmentTypes that only have category changes (not in editedTreatmentTypes)
        for (const treatmentTypeId of treatmentTypesWithDirtyCategories) {
            if (!dirtyTreatmentTypeIds.includes(treatmentTypeId)) {
                await handleSaveRow(treatmentTypeId)
            }
        }

        // Save all dirty station rules sequentially
        for (const treatmentType of treatmentTypesWithDirtyStationRules) {
            await handleSaveStationRules(treatmentType.id)
        }

        const totalSaved = dirtyTreatmentTypeIds.length + treatmentTypesWithDirtyCategories.length + treatmentTypesWithDirtyStationRules.length
        toast({
            title: "הצלחה",
            description: `נשמרו ${totalSaved} גזעים והגדרות עמדות בהצלחה`,
        })
    }

    const handleDiscardAll = () => {
        const dirtyTreatmentTypeIds = Object.keys(editedTreatmentTypes)
        const treatmentTypesWithDirtyCategories = [
            ...Object.keys(editedTypesMap),
            ...Object.keys(editedCategoriesMap)
        ].filter((id, index, self) => self.indexOf(id) === index) // unique IDs
        const treatmentTypesWithDirtyStationRules = treatmentTypes.filter((treatmentType) => hasStationRuleChanges(treatmentType.id))

        if (dirtyTreatmentTypeIds.length === 0 && treatmentTypesWithDirtyCategories.length === 0 && treatmentTypesWithDirtyStationRules.length === 0) return

        // Remove all new treatmentTypes
        const newTreatmentTypes = dirtyTreatmentTypeIds.filter((id) => id.startsWith("new-"))
        if (newTreatmentTypes.length > 0) {
            setTreatmentTypes((prev) => prev.filter((b) => !newTreatmentTypes.includes(b.id)))
        }

        // Clear all edited treatmentType-level fields
        setEditedTreatmentTypes({})

        // Clear all edited categories/types
        setEditedTypesMap({})
        setEditedCategoriesMap({})

        // Discard all dirty station rules by restoring original state
        treatmentTypesWithDirtyStationRules.forEach((treatmentType) => {
            const originalRules = originalStationTreatmentTypeRules[treatmentType.id]
            if (originalRules) {
                const restoredRules = JSON.parse(JSON.stringify(originalRules))
                setStationTreatmentTypeRules((prev) => ({
                    ...prev,
                    [treatmentType.id]: restoredRules,
                }))

                // Restore duration input values
                const restoredInputValues: Record<string, string> = {}
                Object.values(restoredRules).forEach((rule: StationTreatmentTypeRule) => {
                    restoredInputValues[rule.station_id] = formatDurationFromMinutes(rule.duration_modifier_minutes ?? 0)
                })
                setDurationInputValues((prev) => ({
                    ...prev,
                    [treatmentType.id]: restoredInputValues,
                }))
            }
        })

        const totalDiscarded = dirtyTreatmentTypeIds.length + treatmentTypesWithDirtyStationRules.length
        toast({
            title: "בוטל",
            description: `בוטלו שינויים ב-${totalDiscarded} גזעים והגדרות עמדות`,
        })
    }

    const handleDelete = (treatmentType: TreatmentType) => {
        setTreatmentTypeToDelete(treatmentType)
        setIsDeleteDialogOpen(true)
    }

    const confirmDeleteTreatmentType = async () => {
        if (!treatmentTypeToDelete) return

        setIsDeleting(true)
        try {
            const { error } = await supabase.from("treatment_types").delete().eq("id", treatmentTypeToDelete.id)
            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הגזע נמחק בהצלחה",
            })

            // Optimistically remove from state
            setTreatmentTypes((prev) => prev.filter((b) => b.id !== treatmentTypeToDelete.id))
            setFilteredTreatmentTypes((prev) => prev.filter((b) => b.id !== treatmentTypeToDelete.id))

            setIsDeleteDialogOpen(false)
            setTreatmentTypeToDelete(null)
        } catch (error: unknown) {
            console.error("Error deleting treatmentType:", error)
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

    const getTreatmentTypeValue = (treatmentType: TreatmentType, field: keyof TreatmentType) => {
        const edited = editedTreatmentTypes[treatmentType.id]
        if (edited && field in edited) {
            return edited[field as keyof EditedTreatmentType]
        }
        return treatmentType[field]
    }

    const getTreatmentTypeTypes = (treatmentTypeId: string): string[] => {
        if (editedTypesMap[treatmentTypeId] !== undefined) {
            return editedTypesMap[treatmentTypeId]
        }
        return treatmentTypeTypesMap[treatmentTypeId] || []
    }

    const getTreatmentTypeCategories = (treatmentTypeId: string): string[] => {
        if (editedCategoriesMap[treatmentTypeId] !== undefined) {
            return editedCategoriesMap[treatmentTypeId]
        }
        return treatmentTypeCategoriesMap[treatmentTypeId] || []
    }

    useEffect(() => {
        if (defaultTreatmentTypeId && treatmentTypes.length > 0) {
            if (defaultTreatmentTypeAppliedRef.current !== defaultTreatmentTypeId) {
                const match = treatmentTypes.find((type) => type.id === defaultTreatmentTypeId)
                if (match) {
                    setTreatmentTypeFilter(match.name)
                    setTreatmentTypeFilterId(match.id)
                    defaultTreatmentTypeAppliedRef.current = defaultTreatmentTypeId
                }
            }
        } else if (!defaultTreatmentTypeId && defaultTreatmentTypeAppliedRef.current) {
            setTreatmentTypeFilter("")
            setTreatmentTypeFilterId(null)
            defaultTreatmentTypeAppliedRef.current = null
        }
    }, [defaultTreatmentTypeId, treatmentTypes])

    useEffect(() => {
        if (defaultTreatmentCategoryId && treatmentCategories.length > 0) {
            if (defaultTreatmentCategoryAppliedRef.current !== defaultTreatmentCategoryId) {
                const match = treatmentCategories.find((category) => category.id === defaultTreatmentCategoryId)
                if (match) {
                    setTreatmentCategoryFilter(match.name)
                    setTreatmentCategoryFilterId(match.id)
                    defaultTreatmentCategoryAppliedRef.current = defaultTreatmentCategoryId
                }
            }
        } else if (!defaultTreatmentCategoryId && defaultTreatmentCategoryAppliedRef.current) {
            setTreatmentCategoryFilter("")
            setTreatmentCategoryFilterId(null)
            defaultTreatmentCategoryAppliedRef.current = null
        }
    }, [defaultTreatmentCategoryId, treatmentCategories])

    const selectedCount = selectedTreatmentTypeIds.length
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedTreatmentTypes = filteredTreatmentTypes.slice(startIndex, endIndex)
    const pageIds = paginatedTreatmentTypes.map((treatmentType) => treatmentType.id)
    const isAllSelected =
        paginatedTreatmentTypes.length > 0 && pageIds.every((id) => selectedTreatmentTypeIds.includes(id))
    const isPartiallySelected =
        pageIds.some((id) => selectedTreatmentTypeIds.includes(id)) && !isAllSelected
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
                    {hasAnyDirtyTreatmentTypes() && (
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
                                    Object.keys(editedTreatmentTypes).some((id) => savingTreatmentTypeId === id) ||
                                    treatmentTypes.some((treatmentType) => savingStationRules === treatmentType.id)
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
                            onValueChange={(value: "all" | "allowed" | "not-allowed") => setRemoteBookingFilter(value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="allowed">מאפשר תור מרחוק</SelectItem>
                                <SelectItem value="not-allowed">לא מאפשר תור מרחוק</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>פעיל</Label>
                        <Select
                            value={isActiveFilter}
                            onValueChange={(value: "all" | "active" | "inactive") => setIsActiveFilter(value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="active">פעיל</SelectItem>
                                <SelectItem value="inactive">לא פעיל</SelectItem>
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
                        <Label>קטגוריה 1</Label>
                        <AutocompleteFilter
                            value={treatmentTypeFilter}
                            onChange={handleTreatmentTypeFilterChange}
                            placeholder="הקלד שם קטגוריה..."
                            searchFn={searchTreatmentTypes}
                            minSearchLength={0}
                            autoSearchOnFocus
                            initialLoadOnMount
                            initialResultsLimit={5}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>קטגוריה 2</Label>
                        <AutocompleteFilter
                            value={treatmentCategoryFilter}
                            onChange={handleTreatmentCategoryFilterChange}
                            placeholder="הקלד שם קטגוריה..."
                            searchFn={searchTreatmentCategories}
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
                    treatmentTypeFilter ||
                    treatmentCategoryFilter ||
                    treatmentTypeFilterId ||
                    treatmentCategoryFilterId) && (
                        <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-gray-600">
                                נמצאו {filteredTreatmentTypes.length} מתוך {treatmentTypes.length} גזעים
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
                                    setTreatmentTypeFilter("")
                                    setTreatmentTypeFilterId(null)
                                    setTreatmentCategoryFilter("")
                                    setTreatmentCategoryFilterId(null)
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
                                                    disabled={filteredTreatmentTypes.length === 0 || disableSelection}
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
                                    {filteredTreatmentTypes.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td colSpan={11} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                                {treatmentTypes.length === 0
                                                    ? "אין גזעים במערכת. הוסף גזע חדש כדי להתחיל."
                                                    : "לא נמצאו גזעים התואמים את המסננים."}
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {paginatedTreatmentTypes.map((treatmentType, index) => {
                                                const globalIndex = startIndex + index
                                                // Check if categories/types have actually changed
                                                const hasTypesChanged =
                                                    editedTypesMap[treatmentType.id] !== undefined &&
                                                    JSON.stringify(editedTypesMap[treatmentType.id].sort()) !==
                                                    JSON.stringify((treatmentTypeTypesMap[treatmentType.id] || []).sort())
                                                const hasCategoriesChanged =
                                                    editedCategoriesMap[treatmentType.id] !== undefined &&
                                                    JSON.stringify(editedCategoriesMap[treatmentType.id].sort()) !==
                                                    JSON.stringify((treatmentTypeCategoriesMap[treatmentType.id] || []).sort())

                                                const isDirty = !!editedTreatmentTypes[treatmentType.id] || hasTypesChanged || hasCategoriesChanged
                                                const isSaving = savingTreatmentTypeId === treatmentType.id
                                                const name = (getTreatmentTypeValue(treatmentType, "name") as string) || ""
                                                const sizeClass = getTreatmentTypeValue(treatmentType, "size_class") as string | null
                                                const minPrice = getTreatmentTypeValue(treatmentType, "min_groom_price") as number | null
                                                const maxPrice = getTreatmentTypeValue(treatmentType, "max_groom_price") as number | null
                                                const hourlyPrice = getTreatmentTypeValue(treatmentType, "hourly_price") as number | null
                                                const notes = getTreatmentTypeValue(treatmentType, "notes") as string | null

                                                const isExpanded = expandedTreatmentTypeId === treatmentType.id
                                                const treatmentTypeStationRules = stationTreatmentTypeRules[treatmentType.id] || {}
                                                const hasStationRules = Object.keys(treatmentTypeStationRules).length > 0

                                                // Get calculated parent checkbox states
                                                const remoteBookingState = getParentCheckboxState(treatmentType.id, "remote_booking_allowed")
                                                const approvalState = getParentCheckboxState(treatmentType.id, "requires_staff_approval")
                                                const isActiveState = getParentCheckboxState(treatmentType.id, "is_active")

                                                return (
                                                    <Fragment key={treatmentType.id}>
                                                        <tr
                                                            data-treatmentType-id={treatmentType.id}
                                                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                        >
                                                            <td className="w-12 p-0 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                                <div
                                                                    className="flex h-full items-center justify-center"
                                                                    onClick={(event) => event.stopPropagation()}
                                                                >
                                                                    <Checkbox
                                                                        checked={selectedTreatmentTypeIds.includes(treatmentType.id)}
                                                                        onPointerDownCapture={handleCheckboxPointerDown}
                                                                        onPointerUp={handleCheckboxPointerUpOrLeave}
                                                                        onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                                        onCheckedChange={(value) =>
                                                                            handleTreatmentTypeSelectionChange(treatmentType.id, value === true, globalIndex)
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
                                                                        onClick={() => toggleTreatmentTypeExpand(treatmentType.id)}
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
                                                                        onChange={(e) => handleFieldChange(treatmentType.id, "name", e.target.value)}
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
                                                                        onValueChange={(value) => handleFieldChange(treatmentType.id, "size_class", value === "__none__" ? null : value)}
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
                                                                        onChange={(e) => handleFieldChange(treatmentType.id, "min_groom_price", e.target.value ? parseFloat(e.target.value) : null)}
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
                                                                        onChange={(e) => handleFieldChange(treatmentType.id, "max_groom_price", e.target.value ? parseFloat(e.target.value) : null)}
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
                                                                        onChange={(e) => handleFieldChange(treatmentType.id, "hourly_price", e.target.value ? parseFloat(e.target.value) : null)}
                                                                        placeholder="-"
                                                                        className="h-8 w-16"
                                                                        dir="rtl"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1 align-middle text-center [&:has([role=checkbox])]:pr-0">
                                                                <Input
                                                                    value={notes || ""}
                                                                    onChange={(e) => handleFieldChange(treatmentType.id, "notes", e.target.value || null)}
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
                                                                            handleParentCheckboxChange(treatmentType.id, "remote_booking_allowed", newValue)
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
                                                                            handleParentCheckboxChange(treatmentType.id, "requires_staff_approval", newValue)
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
                                                                            handleParentCheckboxChange(treatmentType.id, "is_active", newValue)
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
                                                                                onClick={() => handleSaveRow(treatmentType.id)}
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
                                                                                onClick={() => handleCancelRow(treatmentType.id)}
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
                                                                                onClick={() => handleDuplicate(treatmentType)}
                                                                                disabled={isSaving}
                                                                                title="שכפל גזע"
                                                                            >
                                                                                <Copy className="h-4 w-4 text-blue-600" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleDelete(treatmentType)}
                                                                                disabled={isSaving}
                                                                                title="מחק גזע"
                                                                            >
                                                                                <Trash2 className="h-4 w-4 text-red-600" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                                            <td colSpan={11} className="px-4 align-middle [&:has([role=checkbox])]:pr-0 bg-gray-50 p-0">
                                                                <Collapsible open={isExpanded}>
                                                                    <CollapsibleContent>
                                                                        <div className="p-3 border-t-2 border-primary/20">
                                                                            {/* Save/Cancel buttons for categories - shown when categories are modified */}
                                                                            {(hasTypesChanged || hasCategoriesChanged) && (
                                                                                <div className="flex items-center justify-end gap-2 mb-4">
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        onClick={() => handleCancelRow(treatmentType.id)}
                                                                                        disabled={isSaving}
                                                                                        className="h-8 text-xs"
                                                                                    >
                                                                                        <X className="h-3 w-3 ml-1" />
                                                                                        ביטול
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={() => handleSaveRow(treatmentType.id)}
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
                                                                            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                                                <div className="space-y-2">
                                                                                    <Label className="text-xs text-gray-600">קטגוריה ראשית</Label>
                                                                                    <MultiSelectDropdown
                                                                                        options={treatmentTypes.map(type => ({ id: type.id, name: type.name }))}
                                                                                        selectedIds={getTreatmentTypeTypes(treatmentType.id)}
                                                                                        onSelectionChange={(selectedIds) => handleTypesChange(treatmentType.id, selectedIds)}
                                                                                        placeholder="בחר קטגוריות ראשיות..."
                                                                                        className="w-full"
                                                                                        onCreateNew={handleCreateNewType}
                                                                                        isCreating={isCreatingType}
                                                                                        onEdit={handleEditType}
                                                                                        onDelete={handleDeleteType}
                                                                                        isEditing={editingTypeId}
                                                                                        onStartEdit={setEditingTypeId}
                                                                                        onCancelEdit={() => setEditingTypeId(null)}
                                                                                        isDeleting={deletingTypeId}
                                                                                        deleteConfirmOpen={deleteTypeConfirmOpen}
                                                                                        onDeleteConfirmOpen={setDeleteTypeConfirmOpen}
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
                                                                                {hasStationRules && hasStationRuleChanges(treatmentType.id) && (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => handleCancelStationRules(treatmentType.id)}
                                                                                            disabled={savingStationRules === treatmentType.id}
                                                                                            className="h-8 text-xs"
                                                                                        >
                                                                                            <X className="h-3 w-3 ml-1" />
                                                                                            ביטול
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            onClick={() => handleSaveStationRules(treatmentType.id)}
                                                                                            disabled={savingStationRules === treatmentType.id}
                                                                                            className="h-8 text-xs"
                                                                                        >
                                                                                            {savingStationRules === treatmentType.id ? (
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
                                                                                    <Label htmlFor={`global-time-${treatmentType.id}`} className="text-xs text-gray-600">
                                                                                        זמן לכל העמדות:
                                                                                    </Label>
                                                                                    <Input
                                                                                        id={`global-time-${treatmentType.id}`}
                                                                                        type="text"
                                                                                        value={isTypingGlobal[treatmentType.id]
                                                                                            ? (durationInputValues["__global__"]?.[treatmentType.id] ?? "")
                                                                                            : (() => {
                                                                                                // If user set a global value, use it
                                                                                                if (globalDurationValue[treatmentType.id] !== undefined) {
                                                                                                    return formatDurationFromMinutes(globalDurationValue[treatmentType.id])
                                                                                                }
                                                                                                // Otherwise, check if all stations have the same time
                                                                                                const commonTime = getGlobalDurationFromStations(treatmentType.id)
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
                                                                                                    [treatmentType.id]: cleaned,
                                                                                                },
                                                                                            }))

                                                                                            // Try to parse while typing (for live updates)
                                                                                            const minutes = parseDurationToMinutes(cleaned)
                                                                                            if (minutes !== null) {
                                                                                                setGlobalDurationValue((prev) => ({
                                                                                                    ...prev,
                                                                                                    [treatmentType.id]: minutes,
                                                                                                }))
                                                                                            }
                                                                                        }}
                                                                                        onFocus={(e) => {
                                                                                            setIsTypingGlobal((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: true,
                                                                                            }))
                                                                                            // Store current formatted value for editing - when user types, it will replace this
                                                                                            const currentValue = (() => {
                                                                                                if (globalDurationValue[treatmentType.id] !== undefined) {
                                                                                                    return formatDurationFromMinutes(globalDurationValue[treatmentType.id])
                                                                                                }
                                                                                                const commonTime = getGlobalDurationFromStations(treatmentType.id)
                                                                                                if (commonTime !== null) {
                                                                                                    return formatDurationFromMinutes(commonTime)
                                                                                                }
                                                                                                return ""
                                                                                            })()
                                                                                            setDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                __global__: {
                                                                                                    ...(prev.__global__ || {}),
                                                                                                    [treatmentType.id]: currentValue,
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
                                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (globalDurationValue[treatmentType.id] ?? 0)
                                                                                                const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                                setGlobalDurationValue((prev) => ({
                                                                                                    ...prev,
                                                                                                    [treatmentType.id]: finalMinutes,
                                                                                                }))

                                                                                                setDurationInputValues((prev) => ({
                                                                                                    ...prev,
                                                                                                    __global__: {
                                                                                                        ...(prev.__global__ || {}),
                                                                                                        [treatmentType.id]: formatted,
                                                                                                    },
                                                                                                }))

                                                                                                setIsTypingGlobal((prev) => ({
                                                                                                    ...prev,
                                                                                                    [treatmentType.id]: false,
                                                                                                }))

                                                                                                e.target.blur()
                                                                                            }
                                                                                        }}
                                                                                        onBlur={(e) => {
                                                                                            setIsTypingGlobal((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: false,
                                                                                            }))
                                                                                            const value = e.target.value
                                                                                            const minutes = parseDurationToMinutes(value)
                                                                                            const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (globalDurationValue[treatmentType.id] ?? 0)
                                                                                            const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                            setGlobalDurationValue((prev) => ({
                                                                                                ...prev,
                                                                                                [treatmentType.id]: finalMinutes,
                                                                                            }))

                                                                                            setDurationInputValues((prev) => ({
                                                                                                ...prev,
                                                                                                __global__: {
                                                                                                    ...(prev.__global__ || {}),
                                                                                                    [treatmentType.id]: formatted,
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
                                                                                            const minutes = globalDurationValue[treatmentType.id]
                                                                                            if (minutes !== undefined && minutes >= 0) {
                                                                                                handleApplyTimeToAll(treatmentType.id, formatDurationFromMinutes(minutes))
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
                                                                            {loadingStations === treatmentType.id ? (
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
                                                                                            const rule = treatmentTypeStationRules[station.id] || {
                                                                                                station_id: station.id,
                                                                                                treatment_type_id: treatmentType.id,
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
                                                                                                        <Label htmlFor={`time-${treatmentType.id}-${station.id}`} className="text-xs text-gray-700">
                                                                                                            זמן
                                                                                                        </Label>
                                                                                                        <Input
                                                                                                            id={`time-${treatmentType.id}-${station.id}`}
                                                                                                            type="text"
                                                                                                            disabled={!isActive}
                                                                                                            value={durationInputValues[treatmentType.id]?.[station.id] ?? formatDurationFromMinutes(rule.duration_modifier_minutes ?? 0)}
                                                                                                            onChange={(e) => {
                                                                                                                if (!isActive) return
                                                                                                                const value = e.target.value
                                                                                                                const cleaned = value.replace(/[^\d:]/g, "")

                                                                                                                setDurationInputValues((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [treatmentType.id]: {
                                                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                                                        [station.id]: cleaned,
                                                                                                                    },
                                                                                                                }))

                                                                                                                const minutes = parseDurationToMinutes(cleaned)
                                                                                                                if (minutes !== null) {
                                                                                                                    handleStationRuleChange(treatmentType.id, station.id, "duration_modifier_minutes", minutes)
                                                                                                                }
                                                                                                            }}
                                                                                                            onFocus={(e) => {
                                                                                                                if (!isActive) return
                                                                                                                setIsTypingStation((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [treatmentType.id]: {
                                                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                                                        [station.id]: true,
                                                                                                                    },
                                                                                                                }))
                                                                                                                const currentValue = durationInputValues[treatmentType.id]?.[station.id] ?? formatDurationFromMinutes(rule.duration_modifier_minutes ?? 0)
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
                                                                                                            onKeyDown={(e) => {
                                                                                                                if (e.key === "Enter") {
                                                                                                                    e.preventDefault()
                                                                                                                    const value = e.target.value
                                                                                                                    const minutes = parseDurationToMinutes(value)
                                                                                                                    const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (rule.duration_modifier_minutes ?? 0)
                                                                                                                    const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                                                    setDurationInputValues((prev) => ({
                                                                                                                        ...prev,
                                                                                                                        [treatmentType.id]: {
                                                                                                                            ...(prev[treatmentType.id] || {}),
                                                                                                                            [station.id]: formatted,
                                                                                                                        },
                                                                                                                    }))

                                                                                                                    setIsTypingStation((prev) => {
                                                                                                                        const newState = { ...prev }
                                                                                                                        if (newState[treatmentType.id]) {
                                                                                                                            newState[treatmentType.id] = { ...newState[treatmentType.id] }
                                                                                                                            delete newState[treatmentType.id][station.id]
                                                                                                                        }
                                                                                                                        return newState
                                                                                                                    })

                                                                                                                    if (finalMinutes !== (rule.duration_modifier_minutes ?? 0)) {
                                                                                                                        handleStationRuleChange(treatmentType.id, station.id, "duration_modifier_minutes", finalMinutes)
                                                                                                                    }

                                                                                                                    e.target.blur()
                                                                                                                }
                                                                                                            }}
                                                                                                            onBlur={(e) => {
                                                                                                                if (!isActive) return
                                                                                                                setIsTypingStation((prev) => {
                                                                                                                    const newState = { ...prev }
                                                                                                                    if (newState[treatmentType.id]) {
                                                                                                                        newState[treatmentType.id] = { ...newState[treatmentType.id] }
                                                                                                                        delete newState[treatmentType.id][station.id]
                                                                                                                    }
                                                                                                                    return newState
                                                                                                                })
                                                                                                                const value = e.target.value
                                                                                                                const minutes = parseDurationToMinutes(value)
                                                                                                                const finalMinutes = minutes !== null && minutes >= 0 ? minutes : (rule.duration_modifier_minutes ?? 0)
                                                                                                                const formatted = formatDurationFromMinutes(finalMinutes)

                                                                                                                setDurationInputValues((prev) => ({
                                                                                                                    ...prev,
                                                                                                                    [treatmentType.id]: {
                                                                                                                        ...(prev[treatmentType.id] || {}),
                                                                                                                        [station.id]: formatted,
                                                                                                                    },
                                                                                                                }))

                                                                                                                if (finalMinutes !== (rule.duration_modifier_minutes ?? 0)) {
                                                                                                                    handleStationRuleChange(treatmentType.id, station.id, "duration_modifier_minutes", finalMinutes)
                                                                                                                }
                                                                                                            }}
                                                                                                            className="h-7 text-xs text-right"
                                                                                                            dir="rtl"
                                                                                                            placeholder="0:00"
                                                                                                        />
                                                                                                    </div>
                                                                                                    <div className="flex items-center justify-between text-xs">
                                                                                                        <Label htmlFor={`active-${treatmentType.id}-${station.id}`} className="text-xs cursor-pointer">
                                                                                                            פעיל
                                                                                                        </Label>
                                                                                                        <Checkbox
                                                                                                            id={`active-${treatmentType.id}-${station.id}`}
                                                                                                            checked={rule.is_active}
                                                                                                            onCheckedChange={(checked) =>
                                                                                                                handleStationRuleChange(treatmentType.id, station.id, "is_active", checked === true)
                                                                                                            }
                                                                                                            className="h-4 w-4"
                                                                                                        />
                                                                                                    </div>
                                                                                                    <div className="flex items-center justify-between text-xs">
                                                                                                        <Label htmlFor={`remote-${treatmentType.id}-${station.id}`} className="text-xs cursor-pointer">
                                                                                                            תור מרחוק
                                                                                                        </Label>
                                                                                                        <Checkbox
                                                                                                            id={`remote-${treatmentType.id}-${station.id}`}
                                                                                                            checked={rule.remote_booking_allowed}
                                                                                                            onCheckedChange={(checked) =>
                                                                                                                handleStationRuleChange(treatmentType.id, station.id, "remote_booking_allowed", checked === true)
                                                                                                            }
                                                                                                            className="h-4 w-4"
                                                                                                        />
                                                                                                    </div>
                                                                                                    <div className="flex items-center justify-between text-xs">
                                                                                                        <Label htmlFor={`approval-${treatmentType.id}-${station.id}`} className="text-xs cursor-pointer">
                                                                                                            אישור צוות
                                                                                                        </Label>
                                                                                                        <Checkbox
                                                                                                            id={`approval-${treatmentType.id}-${station.id}`}
                                                                                                            checked={rule.requires_staff_approval ?? false}
                                                                                                            onCheckedChange={(checked) =>
                                                                                                                handleStationRuleChange(treatmentType.id, station.id, "requires_staff_approval", checked === true)
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
                                                        </tr>
                                                    </Fragment>
                                                )
                                            })}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Pagination */}
                {filteredTreatmentTypes.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">
                            מציג {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredTreatmentTypes.length)} מתוך {filteredTreatmentTypes.length} גזעים
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
                                עמוד {currentPage} מתוך {Math.ceil(filteredTreatmentTypes.length / ITEMS_PER_PAGE)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredTreatmentTypes.length / ITEMS_PER_PAGE), p + 1))}
                                disabled={currentPage >= Math.ceil(filteredTreatmentTypes.length / ITEMS_PER_PAGE)}
                            >
                                הבא
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <BulkTreatmentTypesDurationDialog
                open={isBulkSizeDialogOpen}
                onOpenChange={(open) => {
                    if (!isBulkActionLoading) {
                        setIsBulkSizeDialogOpen(open)
                    }
                }}
                isProcessing={isBulkActionLoading && currentBulkAction === "size"}
                onConfirm={handleBulkSizeConfirm}
            />

            <BulkTreatmentTypesCategoriesDialog
                open={isBulkCategoriesDialogOpen}
                onOpenChange={(open) => {
                    if (!isBulkActionLoading) {
                        setIsBulkCategoriesDialogOpen(open)
                    }
                }}
                isProcessing={isBulkActionLoading && currentBulkAction === "categories"}
                treatmentTypes={treatmentTypes}
                treatmentCategories={treatmentCategories}
                onConfirm={handleBulkCategoriesConfirm}
            />

            <BulkTreatmentTypesDeleteDialog
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

            {/* Add TreatmentType Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                                        confirmAddTreatmentType()
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
                                setNewTreatmentTypeName("")
                            }}
                            disabled={isAdding}
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={confirmAddTreatmentType}
                            disabled={isAdding || !newTreatmentTypeName.trim()}
                        >
                            {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            הוסף
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Duplicate TreatmentType Dialog */}
            <DuplicateTreatmentTypeDialog
                open={isDuplicateDialogOpen}
                onOpenChange={setIsDuplicateDialogOpen}
                treatmentType={treatmentTypeToDuplicate}
                treatmentTypes={treatmentTypes}
                onConfirm={confirmDuplicateTreatmentType}
                isDuplicating={isDuplicating}
            />

            {/* Delete TreatmentType Dialog */}
            <DeleteTreatmentTypeDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                treatmentType={treatmentTypeToDelete}
                onConfirm={confirmDeleteTreatmentType}
                isDeleting={isDeleting}
            />
        </div>
    )
}
