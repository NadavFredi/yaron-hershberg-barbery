import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { ChevronDown, Copy, Loader2, Pencil, Plus, Trash2, XCircle } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { ConstraintDeleteDialog } from "../../dialogs/settings/constraints/ConstraintDeleteDialog"
import { ConstraintEditDialog } from "../../dialogs/settings/constraints/ConstraintEditDialog"

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface Constraint {
    id: string
    station_id: string
    station_name?: string
    reason: string | null
    notes: { text?: string } | null
    start_time: string
    end_time: string
    created_at: string
    is_active: boolean
}

interface ConstraintGroup {
    id: string // Use start_time + reason as unique identifier
    reason: string | null
    notes: string | null
    start_time: string
    end_time: string
    is_active: boolean
    stations: Array<{ id: string; name: string }>
    constraintIds: string[] // Store all constraint IDs in this group
}

type FilterType = "all" | "past" | "future" | "custom"

interface ConstraintManagerPanelProps {
    defaultFilterType?: FilterType
    defaultCustomRange?: { start: Date | null; end: Date | null }
    defaultStationIds?: string[]
    autoSyncFilters?: boolean
    showHeader?: boolean
}

export function ConstraintManagerPanel({
    defaultFilterType,
    defaultCustomRange,
    defaultStationIds,
    autoSyncFilters = false,
    showHeader = true,
}: ConstraintManagerPanelProps) {
    const { toast } = useToast()
    const [constraints, setConstraints] = useState<Constraint[]>([])
    const [stations, setStations] = useState<Station[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [filterType, setFilterType] = useState<FilterType>(defaultFilterType ?? "all")
    const [customStartDate, setCustomStartDate] = useState<Date | null>(defaultCustomRange?.start ?? null)
    const [customEndDate, setCustomEndDate] = useState<Date | null>(defaultCustomRange?.end ?? null)
    const [isSaving, setIsSaving] = useState(false)
    const [customReasons, setCustomReasons] = useState<string[]>([])
    const [reasonInputOpen, setReasonInputOpen] = useState(false)
    const [reasonSearchValue, setReasonSearchValue] = useState<string | undefined>(undefined)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null)
    const [isAddingReason, setIsAddingReason] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
    const [editingReason, setEditingReason] = useState<{ oldText: string; newText: string } | null>(null)
    const [isSavingEdit, setIsSavingEdit] = useState(false)
    const popoverContentRef = useRef<HTMLDivElement>(null)
    const reasonAnchorRef = useRef<HTMLDivElement | null>(null)
    const [reasonFilter, setReasonFilter] = useState<string>("all")
    const [availableReasons, setAvailableReasons] = useState<string[]>([])
    const [editingConstraintGroup, setEditingConstraintGroup] = useState<ConstraintGroup | null>(null)
    const [reasonFilterInputOpen, setReasonFilterInputOpen] = useState(false)
    const [reasonFilterSearchValue, setReasonFilterSearchValue] = useState<string>("")
    const reasonFilterAnchorRef = useRef<HTMLDivElement | null>(null)
    const reasonFilterContentRef = useRef<HTMLDivElement | null>(null)
    const [reasonFilterHighlightedIndex, setReasonFilterHighlightedIndex] = useState<number>(-1)
    const [stationFilter, setStationFilter] = useState<string[]>(defaultStationIds ?? [])
    const [stationFilterOpen, setStationFilterOpen] = useState(false)
    const [stationFilterSearch, setStationFilterSearch] = useState("")
    const [customRangeOpen, setCustomRangeOpen] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [constraintGroupToDelete, setConstraintGroupToDelete] = useState<ConstraintGroup | null>(null)
    const [deleteFromAllStations, setDeleteFromAllStations] = useState(true)
    const [isConstraintDialogOpen, setIsConstraintDialogOpen] = useState(false)
    const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null)
    const [editingConstraintStationIds, setEditingConstraintStationIds] = useState<string[]>([])
    const [duplicateDefaultTimes, setDuplicateDefaultTimes] = useState<{ startDate: Date | null; endDate: Date | null; startTime: string; endTime: string; isActive?: boolean } | null>(null)
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
    const [currentBulkAction, setCurrentBulkAction] = useState<"delete" | "activate" | "deactivate" | null>(null)
    const [isBulkStationDialogOpen, setIsBulkStationDialogOpen] = useState(false)
    const [bulkStationSelection, setBulkStationSelection] = useState<string[]>([])
    const [isBulkStationsSaving, setIsBulkStationsSaving] = useState(false)
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const shiftPressedRef = useRef(false)
    const shiftKeyHeldRef = useRef(false)

    const defaultCustomRangeStartMs = defaultCustomRange?.start ? defaultCustomRange.start.getTime() : null
    const defaultCustomRangeEndMs = defaultCustomRange?.end ? defaultCustomRange.end.getTime() : null
    const defaultStationIdsKey = defaultStationIds ? defaultStationIds.join("|") : ""

    // Constraint form data
    const [formData, setFormData] = useState({
        selectedStations: [] as string[],
        startDate: null as Date | null,
        startTime: "",
        endDate: null as Date | null,
        endTime: "",
        reason: "",
        customReason: "",
        notes: "",
        is_active: false,
    })

    useEffect(() => {
        fetchStations()
        fetchConstraints()
        fetchCustomReasons()
    }, [])

    useEffect(() => {
        if (!autoSyncFilters) return

        setFilterType(defaultFilterType ?? "all")
        setCustomStartDate(defaultCustomRange?.start ?? null)
        setCustomEndDate(defaultCustomRange?.end ?? null)
        setStationFilter(defaultStationIds ?? [])
    }, [autoSyncFilters, defaultFilterType, defaultCustomRangeStartMs, defaultCustomRangeEndMs, defaultStationIdsKey])

    const fetchCustomReasons = async () => {
        try {
            const { data, error } = await supabase
                .from("custom_absence_reasons")
                .select("reason_text")
                .order("reason_text")

            if (error) throw error
            setCustomReasons(data?.map((r) => r.reason_text) || [])
        } catch (error) {
            console.error("Error fetching custom reasons:", error)
        }
    }

    useEffect(() => {
        fetchConstraints()
    }, [filterType, customStartDate, customEndDate, reasonFilter, stationFilter])

    useEffect(() => {
        if (filterType !== "custom") {
            setCustomRangeOpen(false)
        }
    }, [filterType])

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

        globalThis.addEventListener("keydown", handleKeyDown)
        globalThis.addEventListener("keyup", handleKeyUp)

        return () => {
            globalThis.removeEventListener("keydown", handleKeyDown)
            globalThis.removeEventListener("keyup", handleKeyUp)
        }
    }, [])

    // Scroll highlighted item into view when index changes
    useEffect(() => {
        if (highlightedIndex >= 0 && popoverContentRef.current) {
            const item = popoverContentRef.current.querySelector(`[data-item-index="${highlightedIndex}"]`)
            if (item) {
                item.scrollIntoView({ block: "nearest", behavior: "smooth" })
            }
        }
    }, [highlightedIndex])

    const extractCustomReason = (notes: { text?: string } | null): string | null => {
        if (!notes?.text) return null
        const match = notes.text.match(/\[CUSTOM_REASON:(.+?)\]/)
        return match ? match[1] : null
    }

    const stationFilterLabel = useMemo(() => {
        if (stationFilter.length === 0) {
            return "כל העמדות"
        }

        if (stationFilter.length === 1) {
            const stationName = stations.find((station) => station.id === stationFilter[0])?.name
            return stationName || "עמדה אחת"
        }

        return `נבחרו ${stationFilter.length} עמדות`
    }, [stationFilter, stations])

    const filteredStations = useMemo(() => {
        const search = stationFilterSearch.trim().toLowerCase()
        if (!search) {
            return stations
        }

        return stations.filter((station) => station.name.toLowerCase().includes(search))
    }, [stationFilterSearch, stations])

    const customRangeValue = useMemo<DateRange | undefined>(() => {
        if (!customStartDate && !customEndDate) {
            return undefined
        }

        const from = customStartDate ?? customEndDate ?? null
        const to = customEndDate ?? customStartDate ?? null

        if (!from) return undefined

        return {
            from,
            to: to ?? undefined,
        }
    }, [customStartDate, customEndDate])

    const customRangeLabel = useMemo(() => {
        const formatDate = (date: Date | null) => (date ? format(date, "dd/MM/yyyy", { locale: he }) : null)
        if (!customStartDate && !customEndDate) {
            return "בחר טווח תאריכים"
        }

        const startLabel = formatDate(customStartDate)
        const endLabel = formatDate(customEndDate) ?? startLabel

        if (!startLabel) {
            return "בחר טווח תאריכים"
        }

        if (startLabel === endLabel) {
            return startLabel
        }

        return `${startLabel} - ${endLabel}`
    }, [customStartDate, customEndDate])

    const fetchStations = async () => {
        try {
            const { data, error } = await supabase
                .from("stations")
                .select("id, name, is_active, display_order")
                .order("display_order", { ascending: true })
                .order("name")

            if (error) throw error
            setStations(data || [])
        } catch (error) {
            console.error("Error fetching stations:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את רשימת העמדות",
                variant: "destructive",
            })
        }
    }

    const fetchConstraints = async () => {
        setIsLoading(true)
        try {
            console.debug("SettingsConstraintsSection::fetchConstraints", {
                filterType,
                customStartDate: customStartDate ? customStartDate.toISOString() : null,
                customEndDate: customEndDate ? customEndDate.toISOString() : null,
                reasonFilter,
                stationFilter,
            })

            let query = supabase
                .from("station_unavailability")
                .select(`
                    id,
                    station_id,
                    reason,
                    notes,
                    start_time,
                    end_time,
                    created_at,
                    is_active,
                    stations!inner(id, name)
                `)
                .order("start_time", { ascending: false })

            // Apply filters
            if (filterType === "past") {
                // Past including today - end_time is before or equal to end of today
                const endOfToday = new Date()
                endOfToday.setHours(23, 59, 59, 999)
                query = query.lte("end_time", endOfToday.toISOString())
            } else if (filterType === "future") {
                // Future - start_time is after end of today (excluding today)
                const endOfToday = new Date()
                endOfToday.setHours(23, 59, 59, 999)
                query = query.gt("start_time", endOfToday.toISOString())
            } else if (filterType === "custom") {
                const startBoundary = (date: Date | null) => {
                    if (!date) return null
                    const result = new Date(date)
                    result.setHours(0, 0, 0, 0)
                    return result
                }

                const endBoundary = (date: Date | null) => {
                    if (!date) return null
                    const result = new Date(date)
                    result.setHours(23, 59, 59, 999)
                    return result
                }

                const rangeStart = startBoundary(customStartDate)
                const rangeEnd = endBoundary(customEndDate ?? customStartDate)

                if (rangeStart && rangeEnd) {
                    query = query
                        .lte("start_time", rangeEnd.toISOString())
                        .gte("end_time", rangeStart.toISOString())
                } else if (rangeStart) {
                    query = query.gte("end_time", rangeStart.toISOString())
                } else if (rangeEnd) {
                    query = query.lte("start_time", rangeEnd.toISOString())
                }
            }

            if (stationFilter.length > 0) {
                query = query.in("station_id", stationFilter)
            }

            const { data, error } = await query

            if (error) throw error

            // Transform data to include station name
            const allConstraints: Constraint[] = (data || []).map((item: {
                id: string
                station_id: string
                reason: string | null
                notes: { text?: string } | null
                start_time: string
                end_time: string
                created_at: string
                is_active: boolean
                stations?: { id: string; name: string } | null
            }) => ({
                id: item.id,
                station_id: item.station_id,
                station_name: item.stations?.name || "",
                reason: item.reason,
                notes: item.notes,
                start_time: item.start_time,
                end_time: item.end_time,
                created_at: item.created_at,
                is_active: item.is_active ?? false,
            }));

            // Update available reasons list from unfiltered constraints
            updateAvailableReasons(allConstraints)

            // Apply reason filter
            let constraintsWithStations = allConstraints
            if (reasonFilter !== "all") {
                constraintsWithStations = constraintsWithStations.filter((constraint) => {
                    if (reasonFilter === "no_reason") {
                        return !constraint.reason && !extractCustomReason(constraint.notes)
                    }
                    // Check if it matches enum reason
                    if (constraint.reason === reasonFilter) {
                        return true
                    }
                    // Check if it matches custom reason
                    const customReason = extractCustomReason(constraint.notes)
                    return customReason === reasonFilter
                })
            }

            setConstraints(constraintsWithStations)
        } catch (error) {
            console.error("Error fetching constraints:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את רשימת האילוצים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Group constraints that have the same start_time, end_time, reason, notes, and is_active
    // These are likely constraints created together for multiple stations
    const groupConstraints = (constraints: Constraint[]): ConstraintGroup[] => {
        const groups = new Map<string, ConstraintGroup>()

        constraints.forEach((constraint) => {
            const key = `${constraint.start_time}-${constraint.end_time}-${constraint.reason || ""}-${JSON.stringify(constraint.notes)}-${constraint.is_active}`

            if (!groups.has(key)) {
                groups.set(key, {
                    id: key,
                    reason: constraint.reason,
                    notes: constraint.notes?.text || null,
                    start_time: constraint.start_time,
                    end_time: constraint.end_time,
                    is_active: constraint.is_active,
                    stations: [],
                    constraintIds: [],
                })
            }

            const group = groups.get(key)!
            if (constraint.station_name) {
                // Check if station already exists in this group to avoid duplicates
                const stationExists = group.stations.some(s => s.id === constraint.station_id)
                if (!stationExists) {
                    group.stations.push({
                        id: constraint.station_id,
                        name: constraint.station_name,
                    })
                }
            }
            group.constraintIds.push(constraint.id)
        })

        return Array.from(groups.values())
    }

    const handleAdd = () => {
        setEditingConstraintGroup(null)
        setFormData({
            selectedStations: [],
            startDate: null,
            startTime: "",
            endDate: null,
            endTime: "",
            reason: "",
            customReason: "",
            notes: "",
            is_active: false,
        })
        setReasonSearchValue(undefined)
        setIsConstraintDialogOpen(true)
    }

    const handleEdit = (group: ConstraintGroup) => {
        const constraintFromGroup = constraints.find(c => group.constraintIds.includes(c.id))

        if (!constraintFromGroup) {
            toast({
                title: "שגיאה",
                description: "לא ניתן למצוא את האילוץ",
                variant: "destructive",
            })
            return
        }

        setEditingConstraint({
            id: constraintFromGroup.id,
            station_id: constraintFromGroup.station_id,
            reason: constraintFromGroup.reason,
            notes: constraintFromGroup.notes,
            start_time: constraintFromGroup.start_time,
            end_time: constraintFromGroup.end_time,
            created_at: constraintFromGroup.created_at,
            is_active: constraintFromGroup.is_active,
        })
        setEditingConstraintStationIds(group.stations.map(s => s.id))
        setDuplicateDefaultTimes(null)
        setIsConstraintDialogOpen(true)
    }

    const getAllReasons = () => {
        // All reasons come from the database
        return customReasons.map((r) => ({ type: "custom" as const, value: r, label: r }))
    }

    const getReasonLabel = (reasonValue: string): string => {
        if (!reasonValue) return ""
        // All reasons are stored as-is from the database
        return reasonValue
    }

    const handleAddCustomReason = async (reasonText: string) => {
        if (!reasonText.trim()) return
        setIsAddingReason(true)
        try {
            const { error } = await supabase.from("custom_absence_reasons").insert({ reason_text: reasonText.trim() })
            if (error && error.code !== "23505") {
                // 23505 is unique violation - ignore if already exists
                throw error
            }
            await fetchCustomReasons()
            setFormData({ ...formData, reason: reasonText.trim() })
            setReasonSearchValue(undefined)
            setReasonInputOpen(false)
            toast({
                title: "הצלחה",
                description: `הסיבה "${reasonText.trim()}" נוספה בהצלחה`,
            })
        } catch (error) {
            console.error("Error adding custom reason:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף סיבה מותאמת אישית",
                variant: "destructive",
            })
        } finally {
            setIsAddingReason(false)
        }
    }

    const handleDeleteCustomReason = async (reasonText: string) => {
        try {
            const { error } = await supabase
                .from("custom_absence_reasons")
                .delete()
                .eq("reason_text", reasonText)
            if (error) throw error
            await fetchCustomReasons()
            if (formData.reason === reasonText) {
                setFormData({ ...formData, reason: "" })
            }
            setDeleteConfirmOpen(null)
            toast({
                title: "הצלחה",
                description: `הסיבה "${reasonText}" נמחקה בהצלחה`,
            })
        } catch (error) {
            console.error("Error deleting custom reason:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק סיבה מותאמת אישית",
                variant: "destructive",
            })
        }
    }

    const handleEditCustomReason = async (oldText: string, newText: string) => {
        if (!newText.trim() || newText.trim() === oldText) {
            setEditingReason(null)
            return
        }

        setIsSavingEdit(true)
        try {
            // Check if new name already exists
            const { data: existing, error: checkError } = await supabase
                .from("custom_absence_reasons")
                .select("id")
                .eq("reason_text", newText.trim())
                .single()

            if (checkError && checkError.code !== "PGRST116") {
                // PGRST116 means no rows found, which is what we want
                throw checkError
            }

            if (existing) {
                toast({
                    title: "שגיאה",
                    description: "סיבה עם שם זה כבר קיימת",
                    variant: "destructive",
                })
                setIsSavingEdit(false)
                return
            }

            // Update the reason in custom_absence_reasons table
            const { error: updateError } = await supabase
                .from("custom_absence_reasons")
                .update({ reason_text: newText.trim() })
                .eq("reason_text", oldText)

            if (updateError) throw updateError

            // Update all constraints that use this reason (in notes field)
            const { data: constraints, error: fetchError } = await supabase
                .from("station_unavailability")
                .select("id, notes")
                .not("notes", "is", null)

            if (!fetchError && constraints) {
                const updates = constraints
                    .filter((c) => {
                        const notesText = typeof c.notes === "string"
                            ? c.notes
                            : (typeof c.notes === "object" && c.notes !== null && "text" in c.notes)
                                ? String((c.notes as { text?: string }).text || "")
                                : ""
                        return notesText.includes(`[CUSTOM_REASON:${oldText}]`)
                    })
                    .map((c) => {
                        const notesText = typeof c.notes === "string"
                            ? c.notes
                            : (typeof c.notes === "object" && c.notes !== null && "text" in c.notes)
                                ? String((c.notes as { text?: string }).text || "")
                                : ""
                        const updatedNotes = notesText.replace(
                            new RegExp(`\\[CUSTOM_REASON:${oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "g"),
                            `[CUSTOM_REASON:${newText.trim()}]`
                        )
                        return {
                            id: c.id,
                            notes: { text: updatedNotes },
                        }
                    })

                if (updates.length > 0) {
                    for (const update of updates) {
                        const { error } = await supabase
                            .from("station_unavailability")
                            .update({ notes: update.notes })
                            .eq("id", update.id)
                        if (error) {
                            console.error("Error updating constraint:", error)
                        }
                    }
                }
            }

            await fetchCustomReasons()

            // Update form if current reason matches
            if (formData.reason === oldText) {
                setFormData({ ...formData, reason: newText.trim() })
            }

            setEditingReason(null)
            toast({
                title: "הצלחה",
                description: `הסיבה "${oldText}" עודכנה ל-"${newText.trim()}" בהצלחה`,
            })
        } catch (error) {
            console.error("Error editing custom reason:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לערוך סיבה מותאמת אישית",
                variant: "destructive",
            })
        } finally {
            setIsSavingEdit(false)
        }
    }

    const searchTextForFilter = reasonSearchValue !== undefined ? reasonSearchValue : ""
    const filteredReasons = getAllReasons().filter((reason) =>
        reason.label.toLowerCase().includes(searchTextForFilter.toLowerCase())
    )

    // Show "add new" option if user has typed something that doesn't exactly match any existing reason
    const searchText = (reasonSearchValue !== undefined && reasonSearchValue !== null) ? reasonSearchValue.trim() : ""
    const allReasons = getAllReasons()
    const exactMatch = searchText.length > 0 ? allReasons.find((r) => r.label.toLowerCase() === searchText.toLowerCase()) : null
    const canAddNewReason = searchText.length > 0 && !exactMatch

    const handleSave = async () => {
        if (formData.selectedStations.length === 0) {
            toast({
                title: "שגיאה",
                description: "יש לבחור לפחות עמדה אחת",
                variant: "destructive",
            })
            return
        }

        if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
            toast({
                title: "שגיאה",
                description: "יש להגדיר תאריך ושעה להתחלה וסיום",
                variant: "destructive",
            })
            return
        }


        // Combine date and time
        const [startHours, startMinutes] = formData.startTime.split(":").map(Number)
        const [endHours, endMinutes] = formData.endTime.split(":").map(Number)

        const start = new Date(formData.startDate)
        start.setHours(startHours, startMinutes, 0, 0)

        const end = new Date(formData.endDate)
        end.setHours(endHours, endMinutes, 0, 0)

        if (end <= start) {
            toast({
                title: "שגיאה",
                description: "תאריך ושעת הסיום חייבים להיות מאוחרים מתאריך ושעת ההתחלה",
                variant: "destructive",
            })
            return
        }

        setIsSaving(true)
        try {
            // All reasons are custom, store them in notes with a marker
            const notesText = formData.notes ? formData.notes : ""
            const customReasonNote = formData.reason
                ? `[CUSTOM_REASON:${formData.reason}]`
                : ""
            const finalNotes = customReasonNote
                ? (notesText ? `${customReasonNote} ${notesText}` : customReasonNote)
                : notesText

            // reason field in DB is enum, so set to null for custom reasons
            const reasonValue = null

            if (editingConstraintGroup) {
                // Update existing constraints
                // First, delete the old constraints
                const { error: deleteError } = await supabase
                    .from("station_unavailability")
                    .delete()
                    .in("id", editingConstraintGroup.constraintIds)

                if (deleteError) throw deleteError

                // Then, insert new constraints with updated data
                const constraintsToInsert = formData.selectedStations.map((stationId) => ({
                    station_id: stationId,
                    reason: reasonValue,
                    notes: finalNotes ? { text: finalNotes } : null,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    is_active: formData.is_active,
                }))

                const { error: insertError } = await supabase.from("station_unavailability").insert(constraintsToInsert)

                if (insertError) throw insertError

                toast({
                    title: "הצלחה",
                    description: "האילוצים עודכנו בהצלחה",
                })
            } else {
                // Insert new constraints
                const constraintsToInsert = formData.selectedStations.map((stationId) => ({
                    station_id: stationId,
                    reason: reasonValue,
                    notes: finalNotes ? { text: finalNotes } : null,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    is_active: formData.is_active,
                }))

                const { error } = await supabase.from("station_unavailability").insert(constraintsToInsert)

                if (error) throw error

                toast({
                    title: "הצלחה",
                    description: "האילוצים נוצרו בהצלחה",
                })
            }

            setIsConstraintDialogOpen(false)
            setEditingConstraintGroup(null)
            fetchConstraints()
        } catch (error: unknown) {
            console.error("Error saving constraints:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את האילוצים"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteClick = (group: ConstraintGroup) => {
        setConstraintGroupToDelete(group)
        setDeleteFromAllStations(group.stations.length > 1)
        setShowDeleteDialog(true)
    }

    const handleDelete = async () => {
        if (!constraintGroupToDelete) return

        try {
            let constraintIdsToDelete: string[] = constraintGroupToDelete.constraintIds

            // If not deleting from all stations and there are multiple stations, delete only one constraint
            if (!deleteFromAllStations && constraintGroupToDelete.stations.length > 1) {
                // Delete only the first constraint (one station)
                constraintIdsToDelete = [constraintGroupToDelete.constraintIds[0]]
            }

            const { error } = await supabase
                .from("station_unavailability")
                .delete()
                .in("id", constraintIdsToDelete)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: deleteFromAllStations && constraintGroupToDelete.stations.length > 1
                    ? `האילוץ נמחק מ-${constraintGroupToDelete.stations.length} עמדות בהצלחה`
                    : "האילוץ נמחק בהצלחה",
            })

            fetchConstraints()
            setShowDeleteDialog(false)
            setConstraintGroupToDelete(null)
        } catch (error: unknown) {
            console.error("Error deleting constraints:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את האילוצים",
                variant: "destructive",
            })
        }
    }

    const handleDuplicate = (group: ConstraintGroup) => {
        const startDate = new Date(group.start_time)
        const endDate = new Date(group.end_time)
        const startTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
        const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`

        // Find the constraint from the group to get its is_active value
        const constraintFromGroup = constraints.find(c => group.constraintIds.includes(c.id))

        setEditingConstraint(null)
        setEditingConstraintStationIds(group.stations.map(s => s.id))
        setDuplicateDefaultTimes({
            startDate: startDate,
            endDate: endDate,
            startTime: startTime,
            endTime: endTime,
            isActive: constraintFromGroup?.is_active,
        })
        setIsConstraintDialogOpen(true)
    }

    const updateAvailableReasons = (constraints: Constraint[]) => {
        const reasons = new Set<string>()

        constraints.forEach((constraint) => {
            if (constraint.reason) {
                reasons.add(constraint.reason)
            }
            const customReason = extractCustomReason(constraint.notes)
            if (customReason) {
                reasons.add(customReason)
            }
        })

        setAvailableReasons(Array.from(reasons).sort())
    }

    const clearSelection = () => {
        setSelectedGroupIds([])
        setLastSelectedIndex(null)
    }

    const handleSelectAllChange = (value: boolean | "indeterminate") => {
        if (value) {
            setSelectedGroupIds(constraintGroups.map((group) => group.id))
            setLastSelectedIndex(constraintGroups.length - 1)
        } else {
            clearSelection()
        }
    }

    const handleGroupSelectionChange = (groupId: string, isChecked: boolean, index: number) => {
        setSelectedGroupIds((prev) => {
            const selectionSet = new Set(prev)
            const applyIds = (ids: string[]) => {
                if (isChecked) {
                    ids.forEach((id) => selectionSet.add(id))
                } else {
                    ids.forEach((id) => selectionSet.delete(id))
                }
            }

            const isShiftSelection = (shiftPressedRef.current || shiftKeyHeldRef.current) && lastSelectedIndex !== null && lastSelectedIndex !== index

            if (isShiftSelection) {
                const start = Math.min(lastSelectedIndex, index)
                const end = Math.max(lastSelectedIndex, index)
                const rangeIds = constraintGroups.slice(start, end + 1).map((group) => group.id)
                applyIds(rangeIds)
            } else {
                applyIds([groupId])
            }

            return constraintGroups.map((group) => group.id).filter((id) => selectionSet.has(id))
        })

        if (isChecked) {
            setLastSelectedIndex(index)
        } else if (!shiftPressedRef.current) {
            setLastSelectedIndex(null)
        }

        shiftPressedRef.current = false
    }

    const handleBulkDeleteSelected = async () => {
        if (selectedGroups.length === 0) return
        const confirmed = globalThis.confirm(`האם למחוק ${selectedGroups.length} אילוצים שנבחרו?`)
        if (!confirmed) return

        try {
            setCurrentBulkAction("delete")
            setIsBulkActionLoading(true)
            const allConstraintIds = selectedConstraintIds

            if (allConstraintIds.length === 0) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצאו אילוצים למחיקה",
                    variant: "destructive",
                })
                return
            }

            const { error } = await supabase
                .from("station_unavailability")
                .delete()
                .in("id", allConstraintIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "האילוצים שנבחרו נמחקו בהצלחה",
            })

            clearSelection()
            fetchConstraints()
        } catch (error) {
            console.error("Error deleting selected constraints:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה למחוק את האילוצים הנבחרים",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const handleBulkUpdateActiveState = async (isActive: boolean) => {
        if (selectedGroups.length === 0) return

        try {
            setCurrentBulkAction(isActive ? "activate" : "deactivate")
            setIsBulkActionLoading(true)

            const allConstraintIds = selectedConstraintIds

            if (allConstraintIds.length === 0) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצאו אילוצים לעדכון",
                    variant: "destructive",
                })
                return
            }

            const { error } = await supabase
                .from("station_unavailability")
                .update({ is_active: isActive })
                .in("id", allConstraintIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: isActive ? "האילוצים סומנו כפעילים" : "האילוצים סומנו כלא פעילים",
            })

            clearSelection()
            fetchConstraints()
        } catch (error) {
            console.error("Error updating active state:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את סטטוס האילוצים",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const prepareBulkStationsDialog = () => {
        if (selectedGroups.length === 0) {
            toast({
                title: "שגיאה",
                description: "בחר אילוצים לפני עדכון עמדות",
                variant: "destructive",
            })
            return
        }

        if (stations.length === 0) {
            toast({
                title: "שגיאה",
                description: "לא קיימות עמדות לעדכון",
                variant: "destructive",
            })
            return
        }

        const defaults = new Set<string>()
        selectedGroups.forEach((group) => {
            group.stations.forEach((station) => defaults.add(station.id))
        })
        setBulkStationSelection(Array.from(defaults))
        setIsBulkStationDialogOpen(true)
    }

    const handleCheckboxPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        shiftPressedRef.current = event.shiftKey || shiftKeyHeldRef.current
    }

    const handleCheckboxPointerUpOrLeave = () => {
        shiftPressedRef.current = false
    }

    const handleBulkStationsCheckboxChange = (stationId: string, isChecked: boolean) => {
        setBulkStationSelection((prev) => {
            if (isChecked) {
                if (prev.includes(stationId)) {
                    return prev
                }
                return [...prev, stationId]
            }
            return prev.filter((id) => id !== stationId)
        })
    }

    const handleBulkStationsSave = async () => {
        if (bulkStationSelection.length === 0) {
            toast({
                title: "שגיאה",
                description: "בחר לפחות עמדה אחת",
                variant: "destructive",
            })
            return
        }

        try {
            setIsBulkStationsSaving(true)

            const selectedGroupsDetails = selectedGroups
            const allConstraintIds = selectedGroupsDetails.flatMap((group) => group.constraintIds)

            if (allConstraintIds.length === 0) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצאו אילוצים לעדכון",
                    variant: "destructive",
                })
                return
            }

            const { error: deleteError } = await supabase
                .from("station_unavailability")
                .delete()
                .in("id", allConstraintIds)

            if (deleteError) throw deleteError

            const constraintsToInsert: Array<{ station_id: string; reason: string | null; notes: { text?: string } | null; start_time: string; end_time: string; is_active: boolean }> = []

            selectedGroupsDetails.forEach((group) => {
                const templateConstraint = constraints.find((constraint) => group.constraintIds.includes(constraint.id))
                if (!templateConstraint) {
                    return
                }

                bulkStationSelection.forEach((stationId) => {
                    constraintsToInsert.push({
                        station_id: stationId,
                        reason: templateConstraint.reason,
                        notes: templateConstraint.notes,
                        start_time: group.start_time,
                        end_time: group.end_time,
                        is_active: templateConstraint.is_active ?? false,
                    })
                })
            })

            if (constraintsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from("station_unavailability")
                    .insert(constraintsToInsert)

                if (insertError) throw insertError
            }

            toast({
                title: "הצלחה",
                description: "העמדות עודכנו עבור כל האילוצים הנבחרים",
            })

            setIsBulkStationDialogOpen(false)
            setBulkStationSelection([])
            clearSelection()
            fetchConstraints()
        } catch (error) {
            console.error("Error updating stations for selected constraints:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את העמדות",
                variant: "destructive",
            })
        } finally {
            setIsBulkStationsSaving(false)
        }
    }

    const getDisplayReason = (reason: string | null, notes: { text?: string } | null): string => {
        if (reason) {
            const reasonLabels: Record<string, string> = {
                sick: "מחלה",
                vacation: "חופשה",
                ad_hoc: "אד-הוק",
            }
            return reasonLabels[reason] || reason
        }
        const customReason = extractCustomReason(notes)
        return customReason || "-"
    }

    const formatDateTime = (dateTimeString: string): string => {
        const date = new Date(dateTimeString)
        return date.toLocaleString("he-IL", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    const constraintGroups = useMemo(() => groupConstraints(constraints), [constraints])
    const selectedGroups = useMemo(() => constraintGroups.filter((group) => selectedGroupIds.includes(group.id)), [constraintGroups, selectedGroupIds])
    const selectedConstraintIds = useMemo(() => selectedGroups.flatMap((group) => group.constraintIds), [selectedGroups])
    const isAllSelected = constraintGroups.length > 0 && selectedGroupIds.length === constraintGroups.length
    const isPartiallySelected = selectedGroupIds.length > 0 && !isAllSelected
    const selectedCount = selectedGroupIds.length
    const disableSelection = isLoading || isBulkActionLoading || isBulkStationsSaving

    useEffect(() => {
        setSelectedGroupIds((prev) => prev.filter((id) => constraintGroups.some((group) => group.id === id)))
    }, [constraintGroups])

    useEffect(() => {
        if (selectedGroupIds.length === 0) {
            setLastSelectedIndex(null)
        }
    }, [selectedGroupIds])

    // Handle constraint ID from URL params (for navigation from manager schedule)
    useEffect(() => {
        const urlParams = new URLSearchParams(globalThis.location.search)
        const constraintId = urlParams.get("constraintId")
        if (constraintId && constraintGroups.length > 0) {
            // Find the constraint group that contains this constraint
            const group = constraintGroups.find(g =>
                g.constraintIds.includes(constraintId)
            )
            if (group) {
                handleEdit(group)
                // Clean up URL param
                urlParams.delete("constraintId")
                globalThis.history.replaceState({}, "", `${globalThis.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`)
            }
        }
    }, [constraintGroups])
    return (
        <div className="space-y-6">
            {showHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">ניהול אילוצים</h2>
                        <p className="text-gray-600 mt-1">נהל אילוצים על עמדות - חופשות, תקלות ואחרים</p>
                    </div>
                    <Button onClick={handleAdd} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        הוסף אילוץ חדש
                    </Button>
                </div>
            )}

            {!showHeader && (
                <div className="flex justify-end">
                    <Button onClick={handleAdd} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        הוסף אילוץ חדש
                    </Button>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm font-semibold">סינון:</Label>
                <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        <SelectItem value="past">עבר (כולל היום)</SelectItem>
                        <SelectItem value="future">עתיד</SelectItem>
                        <SelectItem value="custom">טווח תאריכים</SelectItem>
                    </SelectContent>
                </Select>

                {filterType === "custom" && (
                    <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="min-w-[260px] justify-between text-right"
                            >
                                <span className="truncate">{customRangeLabel}</span>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[360px] p-0 [direction:rtl]">
                            <div className="border-b p-4 flex justify-center">
                                <Calendar
                                    mode="range"
                                    selected={customRangeValue}
                                    onSelect={(range) => {
                                        if (!range) {
                                            setCustomStartDate(null)
                                            setCustomEndDate(null)
                                            return
                                        }

                                        const { from, to } = range
                                        setCustomStartDate(from ?? null)
                                        setCustomEndDate(to ?? from ?? null)
                                    }}
                                    numberOfMonths={1}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2 p-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setCustomStartDate(null)
                                        setCustomEndDate(null)
                                    }}
                                >
                                    אפס טווח
                                </Button>
                                <Button size="sm" onClick={() => setCustomRangeOpen(false)}>
                                    סגור
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                <Popover open={stationFilterOpen} onOpenChange={setStationFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="min-w-[200px] justify-between text-right"
                        >
                            <span className="truncate">{stationFilterLabel}</span>
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-0 [direction:rtl]">
                        <div className="border-b p-3">
                            <Input
                                value={stationFilterSearch}
                                onChange={(event) => setStationFilterSearch(event.target.value)}
                                placeholder="חפש עמדה"
                                className="text-right"
                            />
                        </div>
                        <div className="max-h-64 overflow-y-auto py-2">
                            {filteredStations.length > 0 ? (
                                filteredStations.map((station) => {
                                    const checked = stationFilter.includes(station.id)
                                    return (
                                        <label
                                            key={station.id}
                                            className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(value) => {
                                                    const isChecked = value === true
                                                    setStationFilter((prev) => {
                                                        if (isChecked) {
                                                            if (prev.includes(station.id)) {
                                                                return prev
                                                            }
                                                            return [...prev, station.id]
                                                        }
                                                        return prev.filter((id) => id !== station.id)
                                                    })
                                                }}
                                                className=""
                                            />
                                            <span className="flex-1 text-right">{station.name}</span>
                                        </label>
                                    )
                                })
                            ) : (
                                <p className="px-3 py-4 text-center text-sm text-gray-500">לא נמצאו עמדות</p>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t p-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setStationFilter([])
                                    setStationFilterSearch("")
                                }}
                            >
                                נקה
                            </Button>
                            <Button size="sm" onClick={() => setStationFilterOpen(false)}>
                                סגור
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                <Popover open={reasonFilterInputOpen}>
                    <PopoverAnchor asChild>
                        <div ref={reasonFilterAnchorRef} className="relative w-72">
                            <Input
                                value={
                                    reasonFilterSearchValue !== undefined
                                        ? reasonFilterSearchValue
                                        : reasonFilter === "all"
                                            ? ""
                                            : reasonFilter === "no_reason"
                                                ? "ללא סיבה"
                                                : getDisplayReason(reasonFilter, null)
                                }
                                onChange={(e) => {
                                    setReasonFilterSearchValue(e.target.value)
                                    if (!reasonFilterInputOpen) {
                                        setReasonFilterInputOpen(true)
                                    }
                                    setReasonFilterHighlightedIndex(-1)
                                }}
                                onFocus={() => {
                                    if (reasonFilterSearchValue === undefined) {
                                        setReasonFilterSearchValue("")
                                    }
                                    if (!reasonFilterInputOpen) {
                                        setReasonFilterInputOpen(true)
                                    }
                                    setReasonFilterHighlightedIndex(-1)
                                }}
                                onKeyDown={(e) => {
                                    if (!reasonFilterInputOpen) return

                                    const allReasonsList = ["all", ...availableReasons, "no_reason"]
                                    const searchText = reasonFilterSearchValue.toLowerCase()
                                    const filtered = allReasonsList.filter((r) => {
                                        if (r === "all") return "כל הסיבות".includes(searchText)
                                        if (r === "no_reason") return "ללא סיבה".includes(searchText)
                                        return getDisplayReason(r, null).toLowerCase().includes(searchText)
                                    })
                                    const maxIndex = filtered.length - 1

                                    if (e.key === "ArrowDown") {
                                        e.preventDefault()
                                        setReasonFilterHighlightedIndex((prev) => {
                                            if (prev < maxIndex) {
                                                return prev + 1
                                            }
                                            return 0
                                        })
                                    } else if (e.key === "ArrowUp") {
                                        e.preventDefault()
                                        setReasonFilterHighlightedIndex((prev) => {
                                            if (prev <= 0) {
                                                return maxIndex
                                            }
                                            return prev - 1
                                        })
                                    } else if (e.key === "Enter") {
                                        e.preventDefault()
                                        if (reasonFilterHighlightedIndex >= 0 && reasonFilterHighlightedIndex <= maxIndex) {
                                            const selected = filtered[reasonFilterHighlightedIndex]
                                            setReasonFilter(selected)
                                            setReasonFilterSearchValue(undefined)
                                            setReasonFilterInputOpen(false)
                                            setReasonFilterHighlightedIndex(-1)
                                        }
                                    } else if (e.key === "Escape") {
                                        setReasonFilterInputOpen(false)
                                        setReasonFilterHighlightedIndex(-1)
                                        setReasonFilterSearchValue(undefined)
                                    }
                                }}
                                placeholder="סינון לפי סיבה..."
                                dir="rtl"
                                className="text-right pr-10"
                            />
                            <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-500"
                                onMouseDown={(event) => {
                                    event.preventDefault()
                                    const nextOpen = !reasonFilterInputOpen
                                    setReasonFilterInputOpen(nextOpen)
                                    if (nextOpen && reasonFilterSearchValue === undefined) {
                                        setReasonFilterSearchValue("")
                                    } else if (!nextOpen) {
                                        setReasonFilterSearchValue(undefined)
                                    }
                                }}
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </div>
                    </PopoverAnchor>
                    <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        dir="rtl"
                        align="start"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        onEscapeKeyDown={() => {
                            setReasonFilterInputOpen(false)
                            setReasonFilterHighlightedIndex(-1)
                            setReasonFilterSearchValue(undefined)
                        }}
                        onInteractOutside={(event) => {
                            if (reasonFilterAnchorRef.current?.contains(event.target as Node)) {
                                event.preventDefault()
                                return
                            }
                            setReasonFilterInputOpen(false)
                            setReasonFilterHighlightedIndex(-1)
                            setReasonFilterSearchValue(undefined)
                        }}
                    >
                        <div
                            ref={reasonFilterContentRef}
                            className="max-h-[300px] overflow-y-auto"
                        >
                            {(() => {
                                const allReasonsList = ["all", ...availableReasons, "no_reason"]
                                const searchText = (reasonFilterSearchValue || "").toLowerCase()
                                const filtered = allReasonsList.filter((r) => {
                                    if (r === "all") return "כל הסיבות".includes(searchText)
                                    if (r === "no_reason") return "ללא סיבה".includes(searchText)
                                    return getDisplayReason(r, null).toLowerCase().includes(searchText)
                                })

                                if (filtered.length === 0) {
                                    return (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            לא נמצאו תוצאות
                                        </div>
                                    )
                                }

                                return (
                                    <div className="p-1">
                                        {filtered.map((reason, index) => (
                                            <div
                                                key={reason}
                                                data-item-index={index}
                                                onClick={() => {
                                                    setReasonFilter(reason)
                                                    setReasonFilterSearchValue(undefined)
                                                    setReasonFilterInputOpen(false)
                                                    setReasonFilterHighlightedIndex(-1)
                                                }}
                                                className={`flex items-center cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-right ${reasonFilterHighlightedIndex === index ? "bg-accent text-accent-foreground" : ""
                                                    }`}
                                            >
                                                <span>
                                                    {reason === "all"
                                                        ? "כל הסיבות"
                                                        : reason === "no_reason"
                                                            ? "ללא סיבה"
                                                            : getDisplayReason(reason, null)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>
                    </PopoverContent>
                </Popover>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setFilterType("all")
                        setReasonFilter("all")
                        setCustomStartDate(null)
                        setCustomEndDate(null)
                        setCustomRangeOpen(false)
                        setStationFilter([])
                        setStationFilterSearch("")
                        setReasonFilterSearchValue(undefined)
                    }}
                    className="flex items-center gap-2"
                >
                    <XCircle className="h-4 w-4" />
                    נקה סינונים
                </Button>
            </div>

            {selectedCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col text-right text-blue-900">
                        <span className="text-sm font-semibold">נבחרו {selectedCount} אילוצים</span>
                        <span className="text-xs text-blue-800/80">בצע פעולות מרובות על כל האילוצים שנבחרו</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            disabled={disableSelection}
                        >
                            בטל בחירה
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={prepareBulkStationsDialog}
                            disabled={disableSelection}
                        >
                            עדכן עמדות
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkUpdateActiveState(true)}
                            disabled={disableSelection}
                        >
                            {currentBulkAction === "activate" && isBulkActionLoading && (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                            סמן כפעיל
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkUpdateActiveState(false)}
                            disabled={disableSelection}
                        >
                            {currentBulkAction === "deactivate" && isBulkActionLoading && (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                            סמן כלא פעיל
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDeleteSelected}
                            disabled={disableSelection}
                        >
                            {currentBulkAction === "delete" && isBulkActionLoading && (
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                            מחק אילוצים
                        </Button>
                    </div>
                </div>
            )}

            {/* Constraints Table */}
            <div className="border rounded-lg relative">
                {isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[1px]">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-gray-600">טוען אילוצים...</span>
                    </div>
                )}
                <div
                    className={`transition-opacity ${isLoading ? "pointer-events-none opacity-60" : "opacity-100"}`}
                    aria-busy={isLoading}
                >
                    <Table
                        containerClassName="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar"
                        className="[direction:rtl]"
                    >
                        <TableHeader className="sticky top-0 z-20 bg-background">
                                <TableRow className="bg-[hsl(228_36%_95%)]">
                                    <TableHead className="w-12 p-0 text-center align-middle font-medium bg-[hsl(228_36%_95%)]">
                                        <div className="flex h-full items-center justify-center">
                                            <Checkbox
                                                checked={isAllSelected}
                                                indeterminate={isPartiallySelected}
                                                onPointerDownCapture={handleCheckboxPointerDown}
                                                onPointerUp={handleCheckboxPointerUpOrLeave}
                                                onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                onCheckedChange={handleSelectAllChange}
                                                aria-label="בחר את כל האילוצים בטווח הנוכחי"
                                                disabled={constraintGroups.length === 0 || disableSelection}
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">עמדות</TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">תאריך התחלה</TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">תאריך סיום</TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">סיבה</TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">הערות</TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold bg-[hsl(228_36%_95%)]">פעיל</TableHead>
                                    <TableHead className="h-12 px-2 text-center align-middle font-medium text-primary font-semibold w-24 bg-[hsl(228_36%_95%)]">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {constraintGroups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center text-gray-500 py-8">
                                            אין אילוצים מוגדרים. הוסף אילוץ חדש כדי להתחיל.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    constraintGroups.map((group, index) => (
                                        <TableRow key={group.id}>
                                            <TableCell className="w-12 p-0 align-middle text-center">
                                                <div className="flex h-full items-center justify-center">
                                                    <Checkbox
                                                        checked={selectedGroupIds.includes(group.id)}
                                                        onPointerDownCapture={handleCheckboxPointerDown}
                                                        onPointerUp={handleCheckboxPointerUpOrLeave}
                                                        onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                        onCheckedChange={(value) => handleGroupSelectionChange(group.id, value === true, index)}
                                                        aria-label={`בחר אילוץ עבור ${group.stations.map((station) => station.name).join(", ") || "אילוץ"}`}
                                                        disabled={disableSelection}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 font-medium">
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {group.stations.map((station) => (
                                                        <span
                                                            key={station.id}
                                                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                                                        >
                                                            {station.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center">
                                                {formatDateTime(group.start_time)}
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center">
                                                {formatDateTime(group.end_time)}
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center">
                                                {getDisplayReason(group.reason, { text: group.notes || "" })}
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center">
                                                <div className="max-w-xs truncate mx-auto" title={group.notes?.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "") || ""}>
                                                    {group.notes?.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "") || "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${group.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-orange-100 text-orange-800'
                                                    }`}>
                                                    {group.is_active ? 'פעיל' : 'לא פעיל'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-4 py-1 align-middle [&:has([role=checkbox])]:pr-0">
                                                <div className="flex items-center gap-1 justify-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(group)}
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        title="ערוך"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDuplicate(group)}
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        title="שכפל"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteClick(group)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        title="מחק"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog
                open={isBulkStationDialogOpen}
                onOpenChange={(open) => {
                    setIsBulkStationDialogOpen(open)
                    if (!open) {
                        setBulkStationSelection([])
                    }
                }}
            >
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>עדכון עמדות לאילוצים נבחרים</DialogTitle>
                        <DialogDescription>בחר את העמדות שיחולו על כל האילוצים שסומנו.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground text-right">נבחרו {selectedCount} אילוצים לעדכון.</p>
                        <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 p-2 space-y-1">
                            {stations.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">לא קיימות עמדות זמינות לעדכון.</p>
                            ) : (
                                stations.map((station) => (
                                    <label
                                        key={station.id}
                                        className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                    >
                                        <Checkbox
                                            checked={bulkStationSelection.includes(station.id)}
                                            onCheckedChange={(value) => handleBulkStationsCheckboxChange(station.id, value === true)}
                                        />
                                        <span className="flex-1 text-right">{station.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex flex-row-reverse gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsBulkStationDialogOpen(false)
                                setBulkStationSelection([])
                            }}
                            disabled={isBulkStationsSaving}
                        >
                            ביטול
                        </Button>
                        <Button onClick={handleBulkStationsSave} disabled={isBulkStationsSaving}>
                            {isBulkStationsSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            שמור עמדות
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Constraint Dialog */}
            {constraintGroupToDelete && (
                <ConstraintDeleteDialog
                    open={showDeleteDialog}
                    onOpenChange={(open) => {
                        setShowDeleteDialog(open)
                        if (!open) {
                            setConstraintGroupToDelete(null)
                            setDeleteFromAllStations(true)
                        }
                    }}
                    constraint={{
                        id: constraintGroupToDelete.constraintIds[0],
                        station_id: constraintGroupToDelete.stations[0]?.id || "",
                        reason: constraintGroupToDelete.reason,
                        notes: constraintGroupToDelete.notes ? { text: constraintGroupToDelete.notes } : null,
                        start_time: constraintGroupToDelete.start_time,
                        end_time: constraintGroupToDelete.end_time,
                    }}
                    stationNames={constraintGroupToDelete.stations.map(s => s.name)}
                    deleteFromAllStations={deleteFromAllStations}
                    onDeleteFromAllStationsChange={setDeleteFromAllStations}
                    onConfirm={handleDelete}
                    onCancel={() => {
                        setShowDeleteDialog(false)
                        setConstraintGroupToDelete(null)
                        setDeleteFromAllStations(true)
                    }}
                    isFromSettingsPage={true}
                />
            )}

            <ConstraintEditDialog
                open={isConstraintDialogOpen}
                onOpenChange={(open) => {
                    setIsConstraintDialogOpen(open)
                    if (!open) {
                        setEditingConstraint(null)
                        setEditingConstraintStationIds([])
                    }
                }}
                constraint={editingConstraint ? {
                    id: editingConstraint.id,
                    station_id: editingConstraint.station_id,
                    reason: editingConstraint.reason,
                    notes: editingConstraint.notes,
                    start_time: editingConstraint.start_time,
                    end_time: editingConstraint.end_time,
                    is_active: editingConstraint.is_active,
                } : null}
                stationIds={editingConstraintStationIds}
                defaultStartDate={duplicateDefaultTimes?.startDate || null}
                defaultEndDate={duplicateDefaultTimes?.endDate || null}
                defaultStartTime={duplicateDefaultTimes?.startTime}
                defaultEndTime={duplicateDefaultTimes?.endTime}
                defaultIsActive={duplicateDefaultTimes?.isActive}
                onSave={() => {
                    fetchConstraints()
                }}
            />

        </div>
    )
}

export function SettingsConstraintsSection() {
    return <ConstraintManagerPanel />
}
