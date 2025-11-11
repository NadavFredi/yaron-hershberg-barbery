import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Trash2, Loader2, Save, ChevronDown, Pencil, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface ConstraintData {
    id: string
    station_id: string
    reason: string | null
    notes: { text?: string } | null
    start_time: string
    end_time: string
    is_active: boolean
}

interface ConstraintEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    constraint?: ConstraintData | null
    stationIds?: string[] // If editing, which stations this constraint applies to
    defaultStartDate?: Date | null // Default start date for new constraints
    defaultEndDate?: Date | null // Default end date for new constraints
    defaultStartTime?: string // Default start time for new constraints
    defaultEndTime?: string // Default end time for new constraints
    defaultIsActive?: boolean // Default is_active value for new/duplicated constraints
    onSave?: () => void // Callback after successful save
}

const extractCustomReason = (notes: { text?: string } | null): string | null => {
    if (!notes?.text) return null
    const match = notes.text.match(/\[CUSTOM_REASON:(.+?)\]/)
    return match ? match[1] : null
}

export function ConstraintEditDialog({
    open,
    onOpenChange,
    constraint,
    stationIds,
    defaultStartDate,
    defaultEndDate,
    defaultStartTime,
    defaultEndTime,
    defaultIsActive,
    onSave
}: ConstraintEditDialogProps) {
    const { toast } = useToast()
    const [stations, setStations] = useState<Station[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [customReasons, setCustomReasons] = useState<string[]>([])
    const [reasonInputOpen, setReasonInputOpen] = useState(false)
    const [reasonSearchValue, setReasonSearchValue] = useState<string | undefined>(undefined)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null)
    const [isAddingReason, setIsAddingReason] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
    const [editingReason, setEditingReason] = useState<{ oldText: string; newText: string } | null>(null)
    const [isSavingEdit, setIsSavingEdit] = useState(false)
    const popoverContentRef = useRef<HTMLDivElement | null>(null)
    const reasonAnchorRef = useRef<HTMLDivElement | null>(null)

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
        fetchCustomReasons()
    }, [])

    useEffect(() => {
        if (constraint && open) {
            // If we have default times (from drag), use those instead of constraint's original times
            const startDate = defaultStartDate || new Date(constraint.start_time)
            const endDate = defaultEndDate || new Date(constraint.end_time)
            const startTime = defaultStartTime || `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
            const endTime = defaultEndTime || `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`

            // Extract reason (enum or custom)
            const customReason = extractCustomReason(constraint.notes)
            const reasonValue = constraint.reason || customReason || ""

            // Extract notes without the custom reason marker
            const notesText = constraint.notes?.text?.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "") || ""

            setFormData({
                selectedStations: stationIds ? stationIds : [constraint.station_id],
                startDate: startDate,
                startTime: startTime,
                endDate: endDate,
                endTime: endTime,
                reason: reasonValue,
                customReason: "",
                notes: notesText,
                is_active: constraint.is_active ?? false,
            })
        } else if (!constraint && open) {
            // Reset form for new constraint, use defaults if provided
            setFormData({
                selectedStations: stationIds || [],
                startDate: defaultStartDate || null,
                startTime: defaultStartTime || "",
                endDate: defaultEndDate || null,
                endTime: defaultEndTime || "",
                reason: "",
                customReason: "",
                notes: "",
                is_active: defaultIsActive ?? false,
            })
        }
        setReasonSearchValue(undefined)
    }, [constraint, open, stationIds, defaultStartDate, defaultEndDate, defaultStartTime, defaultEndTime, defaultIsActive])

    const fetchStations = async () => {
        try {
            const { data, error } = await supabase
                .from("stations")
                .select("id, name, is_active, display_order")
                .order("display_order", { ascending: true })
                .order("name")

            if (error) throw error
            setStations(data || [])
            setIsLoading(false)
        } catch (error) {
            console.error("Error fetching stations:", error)
            setIsLoading(false)
        }
    }

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
        if (highlightedIndex >= 0 && popoverContentRef.current) {
            const item = popoverContentRef.current.querySelector(`[data-item-index="${highlightedIndex}"]`)
            if (item) {
                item.scrollIntoView({ block: "nearest", behavior: "smooth" })
            }
        }
    }, [highlightedIndex])

    const getAllReasons = () => {
        return customReasons.map((r) => ({ type: "custom" as const, value: r, label: r }))
    }

    const getReasonLabel = (reasonValue: string): string => {
        if (!reasonValue) return ""
        return reasonValue
    }

    const handleAddCustomReason = async (reasonText: string) => {
        if (!reasonText.trim()) return
        setIsAddingReason(true)
        try {
            const { error } = await supabase.from("custom_absence_reasons").insert({ reason_text: reasonText.trim() })
            if (error && error.code !== "23505") {
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
            const { data: existing, error: checkError } = await supabase
                .from("custom_absence_reasons")
                .select("id")
                .eq("reason_text", newText.trim())
                .single()

            if (checkError && checkError.code !== "PGRST116") {
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

            const { error: updateError } = await supabase
                .from("custom_absence_reasons")
                .update({ reason_text: newText.trim() })
                .eq("reason_text", oldText)

            if (updateError) throw updateError

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

    const searchText = (reasonSearchValue !== undefined && reasonSearchValue !== null) ? reasonSearchValue.trim() : ""
    const allReasons = getAllReasons()
    const exactMatch = searchText.length > 0 ? allReasons.find((r) => r.label.toLowerCase() === searchText.toLowerCase()) : null
    const canAddNewReason = searchText.length > 0 && !exactMatch
    const isFormComplete =
        formData.selectedStations.length > 0 &&
        !!formData.startDate &&
        !!formData.startTime &&
        !!formData.endDate &&
        !!formData.endTime

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

            if (constraint) {
                // Update existing constraints
                // First, fetch all constraints in the same group (same time/reason/notes)
                // We need to find all constraints across ALL stations that belong to this group
                let query = supabase
                    .from("station_unavailability")
                    .select("id, station_id, reason, notes")
                    .eq("start_time", constraint.start_time)
                    .eq("end_time", constraint.end_time)

                // Handle reason matching
                if (constraint.reason) {
                    query = query.eq("reason", constraint.reason)
                } else {
                    query = query.is("reason", null)
                }

                const { data: allConstraints, error: fetchError } = await query

                if (fetchError) throw fetchError

                // Filter client-side to find constraints with matching notes
                const constraintNotesJson = constraint.notes ? JSON.stringify(constraint.notes) : null

                const relatedConstraints = (allConstraints || []).filter(c => {
                    const cNotesJson = c.notes ? JSON.stringify(c.notes) : null
                    return constraintNotesJson === cNotesJson || (!constraintNotesJson && !cNotesJson)
                })

                const constraintIds = relatedConstraints.map(c => c.id)

                console.log('Found related constraints to delete:', {
                    originalStationId: constraint.station_id,
                    relatedConstraintIds: constraintIds,
                    relatedStationIds: relatedConstraints.map(c => c.station_id),
                    selectedStations: formData.selectedStations
                })

                // Delete ALL related constraints (from all stations in the group)
                if (constraintIds.length > 0) {
                    const { error: deleteError } = await supabase
                        .from("station_unavailability")
                        .delete()
                        .in("id", constraintIds)

                    if (deleteError) throw deleteError
                }

                // Then, insert new constraints with updated data for the selected stations
                const constraintsToInsert = formData.selectedStations.map((stationId) => ({
                    station_id: stationId,
                    reason: reasonValue,
                    notes: finalNotes ? { text: finalNotes } : null,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    is_active: formData.is_active,
                }))

                console.log('Inserting new constraints:', constraintsToInsert)

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

            onOpenChange(false)
            if (onSave) {
                onSave()
            }
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

    if (isLoading) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {constraint ? "ערוך אילוץ" : "הוסף אילוץ חדש"}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {constraint ? "עדכן את האילוץ הקיים" : "הגדר אילוץ שיחול על אחת או יותר מהעמדות"}
                    </DialogDescription>
                </DialogHeader>

                {/* Active/Inactive Status Banner */}
                <div
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`rounded-md border p-3 cursor-pointer transition-colors ${formData.is_active
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                        }`}
                    dir="rtl"
                >
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="is_active_banner"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <Label htmlFor="is_active_banner" className="cursor-pointer font-medium">
                            {formData.is_active
                                ? "אילוץ פעיל - העמדה זמינה בזמן הזה"
                                : "אילוץ לא פעיל - העמדה לא זמינה בזמן הזה"}
                        </Label>
                    </div>
                </div>

                <div className="space-y-6 pb-4">
                    {/* Station Selection */}
                    <div className="space-y-2">
                        <Label>עמדות <span className="text-red-500">*</span></Label>
                        <div className="border rounded-lg p-4 space-y-3">
                            {/* Select All */}
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <Checkbox
                                    id="select-all-stations"
                                    checked={
                                        stations.filter((s) => s.is_active).length > 0 &&
                                        stations
                                            .filter((s) => s.is_active)
                                            .every((s) => formData.selectedStations.includes(s.id))
                                    }
                                    onCheckedChange={(checked) => {
                                        const activeStationIds = stations.filter((s) => s.is_active).map((s) => s.id)
                                        setFormData({
                                            ...formData,
                                            selectedStations: checked ? activeStationIds : [],
                                        })
                                    }}
                                    className="scale-125"
                                />
                                <Label htmlFor="select-all-stations" className="cursor-pointer text-sm font-semibold">
                                    בחר הכל
                                </Label>
                            </div>

                            {/* Stations List */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                                {stations
                                    .filter((s) => s.is_active)
                                    .map((station) => (
                                        <div key={station.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`station-${station.id}`}
                                                checked={formData.selectedStations.includes(station.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setFormData({
                                                            ...formData,
                                                            selectedStations: [...formData.selectedStations, station.id],
                                                        })
                                                    } else {
                                                        setFormData({
                                                            ...formData,
                                                            selectedStations: formData.selectedStations.filter((id) => id !== station.id),
                                                        })
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`station-${station.id}`} className="cursor-pointer text-sm">
                                                {station.name}
                                            </Label>
                                        </div>
                                    ))}
                            </div>
                        </div>
                        {formData.selectedStations.length === 0 && (
                            <p className="text-sm text-red-500">יש לבחור לפחות עמדה אחת</p>
                        )}
                    </div>

                    {/* Date/Time Selection */}
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-3 block">
                                תאריך ושעה התחלה <span className="text-red-500">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="start_date" className="text-sm text-gray-600">תאריך</Label>
                                    <DatePickerInput
                                        id="start_date"
                                        value={formData.startDate}
                                        onChange={(date) => setFormData({ ...formData, startDate: date })}
                                        displayFormat="dd/MM/yyyy"
                                        className="w-full text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="start_time" className="text-sm text-gray-600">שעה</Label>
                                    <TimePickerInput
                                        id="start_time"
                                        value={formData.startTime}
                                        onChange={(time) => setFormData({ ...formData, startTime: time })}
                                        intervalMinutes={15}
                                        className="w-full text-right"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="mb-3 block">
                                תאריך ושעה סיום <span className="text-red-500">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="end_date" className="text-sm text-gray-600">תאריך</Label>
                                    <DatePickerInput
                                        id="end_date"
                                        value={formData.endDate}
                                        onChange={(date) => setFormData({ ...formData, endDate: date })}
                                        displayFormat="dd/MM/yyyy"
                                        className="w-full text-right"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end_time" className="text-sm text-gray-600">שעה</Label>
                                    <TimePickerInput
                                        id="end_time"
                                        value={formData.endTime}
                                        onChange={(time) => setFormData({ ...formData, endTime: time })}
                                        intervalMinutes={15}
                                        className="w-full text-right"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reason - Autocomplete */}
                    <div className="space-y-2">
                        <Label htmlFor="reason">סיבה (אופציונלי)</Label>
                        <div className="flex gap-2 items-center">
                            <Popover open={reasonInputOpen}>
                                <PopoverAnchor asChild>
                                    <div ref={reasonAnchorRef} className="relative flex-1">
                                        <Input
                                            id="reason"
                                            value={
                                                reasonSearchValue !== undefined
                                                    ? reasonSearchValue
                                                    : formData.reason
                                                        ? getReasonLabel(formData.reason)
                                                        : ""
                                            }
                                            onChange={(e) => {
                                                setReasonSearchValue(e.target.value)
                                                if (!reasonInputOpen) {
                                                    setReasonInputOpen(true)
                                                }
                                                setHighlightedIndex(-1)
                                            }}
                                            onFocus={() => {
                                                if (reasonSearchValue === undefined) {
                                                    setReasonSearchValue("")
                                                }
                                                if (!reasonInputOpen) {
                                                    setReasonInputOpen(true)
                                                }
                                                setHighlightedIndex(-1)
                                            }}
                                            onKeyDown={(e) => {
                                                if (!reasonInputOpen) return

                                                const allItems = [...filteredReasons, ...(canAddNewReason ? [{ type: "add" as const, value: "add", label: searchText }] : [])]
                                                const maxIndex = allItems.length - 1

                                                if (e.key === "ArrowDown") {
                                                    e.preventDefault()
                                                    setHighlightedIndex((prev) => {
                                                        if (prev < maxIndex) {
                                                            return prev + 1
                                                        }
                                                        return 0
                                                    })
                                                } else if (e.key === "ArrowUp") {
                                                    e.preventDefault()
                                                    setHighlightedIndex((prev) => {
                                                        if (prev <= 0) {
                                                            return maxIndex
                                                        }
                                                        return prev - 1
                                                    })
                                                } else if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    if (canAddNewReason && (highlightedIndex < 0 || (highlightedIndex === filteredReasons.length && allItems[highlightedIndex]?.type === "add"))) {
                                                        handleAddCustomReason(searchText)
                                                    } else if (highlightedIndex >= 0 && highlightedIndex <= maxIndex) {
                                                        const selectedItem = allItems[highlightedIndex]
                                                        if (selectedItem && selectedItem.type === "add") {
                                                            handleAddCustomReason(searchText)
                                                        } else if (selectedItem) {
                                                            setFormData({ ...formData, reason: selectedItem.value })
                                                            setReasonSearchValue(undefined)
                                                            setReasonInputOpen(false)
                                                            setHighlightedIndex(-1)
                                                        }
                                                    } else if (canAddNewReason && highlightedIndex < 0) {
                                                        handleAddCustomReason(searchText)
                                                    }
                                                } else if (e.key === "Escape") {
                                                    setReasonInputOpen(false)
                                                    setHighlightedIndex(-1)
                                                }
                                            }}
                                            placeholder="הקלד או בחר סיבה..."
                                            dir="rtl"
                                            className="pr-10 text-right"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-500"
                                            onMouseDown={(event) => {
                                                event.preventDefault()
                                                const nextOpen = !reasonInputOpen
                                                setReasonInputOpen(nextOpen)
                                                if (nextOpen && reasonSearchValue === undefined) {
                                                    setReasonSearchValue("")
                                                } else if (!nextOpen && formData.reason) {
                                                    setReasonSearchValue(undefined)
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
                                        setReasonInputOpen(false)
                                        setHighlightedIndex(-1)
                                        if (formData.reason) {
                                            setReasonSearchValue(undefined)
                                        }
                                    }}
                                    onInteractOutside={(event) => {
                                        if (reasonAnchorRef.current?.contains(event.target as Node)) {
                                            event.preventDefault()
                                            return
                                        }
                                        setReasonInputOpen(false)
                                        setHighlightedIndex(-1)
                                        if (formData.reason) {
                                            setReasonSearchValue(undefined)
                                        }
                                    }}
                                >
                                    <div
                                        ref={popoverContentRef}
                                        className="max-h-[300px] overflow-y-auto"
                                    >
                                        {filteredReasons.length > 0 && (
                                            <div className="p-1">
                                                {filteredReasons.map((reason, index) => (
                                                    <div
                                                        key={reason.value}
                                                        data-item-index={index}
                                                        onClick={() => {
                                                            setFormData({ ...formData, reason: reason.value })
                                                            setReasonSearchValue(undefined)
                                                            setReasonInputOpen(false)
                                                            setHighlightedIndex(-1)
                                                        }}
                                                        className={`flex items-center justify-between cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${highlightedIndex === index ? 'bg-accent text-accent-foreground' : ''
                                                            }`}
                                                    >
                                                        {editingReason?.oldText === reason.value ? (
                                                            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                                                                <Input
                                                                    value={editingReason.newText}
                                                                    onChange={(e) => setEditingReason({ ...editingReason, newText: e.target.value })}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            handleEditCustomReason(editingReason.oldText, editingReason.newText)
                                                                        } else if (e.key === "Escape") {
                                                                            setEditingReason(null)
                                                                        }
                                                                    }}
                                                                    autoFocus
                                                                    className="h-8 text-sm"
                                                                    dir="rtl"
                                                                />
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => handleEditCustomReason(editingReason.oldText, editingReason.newText)}
                                                                    disabled={isSavingEdit}
                                                                >
                                                                    {isSavingEdit ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <Save className="h-3 w-3 text-green-600" />
                                                                    )}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => setEditingReason(null)}
                                                                    disabled={isSavingEdit}
                                                                >
                                                                    <X className="h-3 w-3 text-gray-500" />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span>{reason.label}</span>
                                                                {reason.type === "custom" && (
                                                                    <div className="flex items-center gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 hover:bg-blue-50"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setEditingReason({ oldText: reason.value, newText: reason.value })
                                                                            }}
                                                                        >
                                                                            <Pencil className="h-3 w-3 text-blue-500" />
                                                                        </Button>
                                                                        <Popover open={deleteConfirmOpen === reason.value} onOpenChange={(open) => setDeleteConfirmOpen(open ? reason.value : null)}>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-6 w-6 p-0 hover:bg-red-50"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation()
                                                                                        setDeleteConfirmOpen(reason.value)
                                                                                    }}
                                                                                >
                                                                                    <Trash2 className="h-3 w-3 text-red-500" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-64" dir="rtl">
                                                                                <div className="space-y-3">
                                                                                    <p className="text-sm text-right">
                                                                                        האם אתה בטוח שברצונך למחוק את הסיבה "{reason.label}" מהמסד נתונים?
                                                                                    </p>
                                                                                    <div className="flex justify-end gap-2">
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => setDeleteConfirmOpen(null)}
                                                                                        >
                                                                                            ביטול
                                                                                        </Button>
                                                                                        <Button
                                                                                            variant="destructive"
                                                                                            size="sm"
                                                                                            onClick={() => handleDeleteCustomReason(reason.value)}
                                                                                        >
                                                                                            מחק
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {canAddNewReason && (
                                            <div className={`p-1 ${filteredReasons.length > 0 ? 'border-t' : ''}`}>
                                                <div
                                                    data-item-index={filteredReasons.length}
                                                    onClick={() => !isAddingReason && handleAddCustomReason(searchText)}
                                                    className={`flex items-center justify-between cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground ${isAddingReason ? 'opacity-50 cursor-not-allowed' : ''
                                                        } ${highlightedIndex === filteredReasons.length ? 'bg-accent text-accent-foreground' : ''
                                                        }`}
                                                >
                                                    <span>הוסף "{searchText}"</span>
                                                    {isAddingReason ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Plus className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {filteredReasons.length === 0 && !canAddNewReason && searchText === "" && (
                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                התחל להקליד כדי לחפש או להוסיף סיבה
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {formData.reason && customReasons.includes(formData.reason) && (
                                <Popover open={deleteConfirmOpen === formData.reason} onOpenChange={(open) => setDeleteConfirmOpen(open ? formData.reason : null)}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-10 w-10 p-0 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64" dir="rtl">
                                        <div className="space-y-3">
                                            <p className="text-sm text-right">
                                                האם אתה בטוח שברצונך למחוק את הסיבה "{getReasonLabel(formData.reason)}" מהמסד נתונים?
                                            </p>
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDeleteConfirmOpen(null)}
                                                >
                                                    ביטול
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDeleteCustomReason(formData.reason)}
                                                >
                                                    מחק
                                                </Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes">הערות (אופציונלי)</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="פרטים נוספים על האילוץ..."
                            rows={3}
                            dir="rtl"
                            className="text-right"
                        />
                    </div>


                </div>

                <DialogFooter className="sm:justify-start gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        aria-disabled={!isFormComplete}
                        title={!isFormComplete && !isSaving ? "יש לבחור עמדות, תאריך ושעות לפני השמירה" : undefined}
                    >
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        <Save className="h-4 w-4 ml-2" />
                        שמור
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
