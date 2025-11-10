import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Loader2, Save, Check, ChevronDown, X } from "lucide-react"
import { TimePickerInput } from "@/components/TimePickerInput"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAppDispatch } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Station {
    id: string
    name: string
    is_active: boolean
    slot_interval_minutes?: number
}

interface CustomerTypeOption {
    id: string
    name: string
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

const WEEKDAYS = [
    { value: "sunday", label: "יום ראשון", order: 0 },
    { value: "monday", label: "יום שני", order: 1 },
    { value: "tuesday", label: "יום שלישי", order: 2 },
    { value: "wednesday", label: "יום רביעי", order: 3 },
    { value: "thursday", label: "יום חמישי", order: 4 },
    { value: "friday", label: "יום שישי", order: 5 },
    { value: "saturday", label: "יום שבת", order: 6 },
]

interface StationEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    station: Station | null
    onSaved: () => Promise<void>
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

const processHoursData = (existingHours: StationWorkingHour[]): DayShifts[] => {
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

    return sortedDays
}

interface CustomerTypeMultiSelectProps {
    options: CustomerTypeOption[]
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
    placeholder?: string
    isLoading?: boolean
}

function CustomerTypeMultiSelect({
    options,
    selectedIds,
    onSelectionChange,
    placeholder = "בחר סוגי לקוחות...",
    isLoading = false,
}: CustomerTypeMultiSelectProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const selectedOptions = useMemo(
        () => options.filter((option) => selectedIds.includes(option.id)),
        [options, selectedIds]
    )

    const filteredOptions = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase()
        if (!normalized) return options
        return options.filter((option) => option.name.toLowerCase().includes(normalized))
    }, [options, searchTerm])

    const handleToggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((optionId) => optionId !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    const handleClear = () => {
        onSelectionChange([])
        setSearchTerm("")
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div
                    className={cn(
                        "relative flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                        "cursor-text"
                    )}
                    onClick={() => setOpen(true)}
                    dir="rtl"
                >
                    {selectedOptions.length > 0 ? (
                        <div className="flex flex-wrap gap-2 flex-1">
                            {selectedOptions.map((option) => (
                                <Badge
                                    key={option.id}
                                    variant="secondary"
                                    className="flex items-center gap-1 text-xs h-7 px-2 cursor-pointer"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        handleToggle(option.id)
                                    }}
                                >
                                    <span>{option.name}</span>
                                    <X className="h-3 w-3 hover:text-destructive" />
                                </Badge>
                            ))}
                            <input
                                className="flex-1 min-w-[120px] border-0 bg-transparent text-right outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setOpen(true)}
                                placeholder={selectedOptions.length === 0 ? placeholder : ""}
                                dir="rtl"
                            />
                        </div>
                    ) : (
                        <input
                            className="flex-1 border-0 bg-transparent text-right outline-none placeholder:text-muted-foreground"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setOpen(true)}
                            placeholder={placeholder}
                            dir="rtl"
                        />
                    )}

                    <div className="flex items-center gap-2 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                        {selectedOptions.length > 0 && (
                            <button
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    handleClear()
                                }}
                                className="rounded p-1 hover:bg-red-50 hover:text-red-500"
                                title="נקה בחירה"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                        <ChevronDown className="h-4 w-4" />
                    </div>
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                dir="rtl"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                <div className="max-h-[280px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>טוען סוגי לקוחות...</span>
                        </div>
                    ) : filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => {
                            const isSelected = selectedIds.includes(option.id)
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleToggle(option.id)}
                                    className={cn(
                                        "flex w-full items-center justify-between px-3 py-2 text-sm text-right transition-colors",
                                        "hover:bg-primary/10",
                                        isSelected && "text-primary"
                                    )}
                                >
                                    <span>{option.name}</span>
                                    <Check className={cn("h-4 w-4 transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
                                </button>
                            )
                        })
                    ) : (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            לא נמצאו סוגי לקוחות תואמים.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export function StationEditDialog({ open, onOpenChange, station, onSaved }: StationEditDialogProps) {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        is_active: true,
        slotIntervalMinutes: "60",
        allowedCustomerTypeIds: [] as string[],
    })
    const [dayShifts, setDayShifts] = useState<DayShifts[]>([])
    const [customerTypes, setCustomerTypes] = useState<CustomerTypeOption[]>([])
    const [isLoadingCustomerTypes, setIsLoadingCustomerTypes] = useState(false)

    const hasFetchedCustomerTypesRef = useRef(false)

    const fetchCustomerTypes = useCallback(async (options?: { force?: boolean }) => {
        if (!options?.force) {
            if (hasFetchedCustomerTypesRef.current) {
                console.log("🔁 [StationEditDialog] Skipping customer types fetch, already loaded for this session")
                return
            }
            hasFetchedCustomerTypesRef.current = true
        } else {
            console.log("♻️ [StationEditDialog] Force refreshing customer types...")
            hasFetchedCustomerTypesRef.current = true
        }

        console.log("🔍 [StationEditDialog] Fetching customer types for restriction selector...")
        setIsLoadingCustomerTypes(true)
        try {
            const { data, error } = await supabase
                .from("customer_types")
                .select("id, name")
                .order("priority", { ascending: true })
                .order("name", { ascending: true })

            if (error) throw error
            const transformed = (data || []).map((item) => ({
                id: item.id,
                name: item.name,
            }))
            setCustomerTypes(transformed)
            console.log("✅ [StationEditDialog] Loaded customer types:", transformed)
        } catch (error) {
            hasFetchedCustomerTypesRef.current = false
            console.error("❌ [StationEditDialog] Failed to load customer types:", error)
            toast({
                title: "שגיאה בטעינת סוגי הלקוחות",
                description: "לא הצלחנו לטעון את סוגי הלקוחות עבור העמדה. נסה שוב מאוחר יותר.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingCustomerTypes(false)
        }
    }, [toast])

    const fetchAllowedCustomerTypes = useCallback(
        async (stationId: string) => {
            console.log("🔍 [StationEditDialog] Fetching allowed customer types for station:", stationId)
            try {
                const { data, error } = await supabase
                    .from("station_allowed_customer_types")
                    .select("customer_type_id, customer_type:customer_types(id, name)")
                    .eq("station_id", stationId)

                if (error) throw error

                type AllowedRow = {
                    customer_type_id: string
                    customer_type: { id: string; name: string } | null
                }

                const rows = (data || []) as AllowedRow[]
                const ids = rows
                    .map((row) => row.customer_type_id)
                    .filter((value): value is string => Boolean(value))

                setFormData((prev) => ({
                    ...prev,
                    allowedCustomerTypeIds: ids,
                }))

                setCustomerTypes((prev) => {
                    const existingIds = new Set(prev.map((item) => item.id))
                    const merged = [...prev]
                    rows.forEach((row) => {
                        const option = row.customer_type
                        if (option && !existingIds.has(option.id)) {
                            merged.push({ id: option.id, name: option.name })
                            existingIds.add(option.id)
                        }
                    })
                    return merged
                })

                console.log("✅ [StationEditDialog] Station allowed customer types:", ids)
            } catch (error) {
                console.error("❌ [StationEditDialog] Failed to fetch allowed customer types:", error)
                toast({
                    title: "שגיאה בטעינת סוגי הלקוחות לעמדה",
                    description: "לא הצלחנו לטעון את סוגי הלקוחות המורשים לעמדה זו.",
                    variant: "destructive",
                })
                setFormData((prev) => ({
                    ...prev,
                    allowedCustomerTypeIds: [],
                }))
            }
        },
        [toast]
    )

    useEffect(() => {
        if (!open) {
            hasFetchedCustomerTypesRef.current = false
            return
        }

        void fetchCustomerTypes()
    }, [open, fetchCustomerTypes])

    useEffect(() => {
        if (open && station) {
            // Editing existing station
            setFormData({
                name: station.name,
                is_active: station.is_active,
                slotIntervalMinutes: String(station.slot_interval_minutes ?? 60),
                allowedCustomerTypeIds: [],
            })
            fetchStationWorkingHours(station.id).then((hours) => {
                setDayShifts(processHoursData(hours))
            })
            void fetchAllowedCustomerTypes(station.id)
        } else if (open && !station) {
            // Adding new station
            setFormData({
                name: "",
                is_active: true,
                slotIntervalMinutes: "60",
                allowedCustomerTypeIds: [],
            })
            const emptyShifts: DayShifts[] = WEEKDAYS.map((day) => ({
                weekday: day.value,
                shifts: [],
            }))
            setDayShifts(emptyShifts)
        }
    }, [open, station, fetchAllowedCustomerTypes])

    const handleTimeChange = (weekday: string, shiftIndex: number, field: "open_time" | "close_time", value: string) => {
        setDayShifts((prev) =>
            prev.map((dayShift) => {
                if (dayShift.weekday === weekday) {
                    const newShifts = [...dayShift.shifts]
                    if (newShifts[shiftIndex]) {
                        newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value }
                    }
                    return { ...dayShift, shifts: newShifts }
                }
                return dayShift
            })
        )
    }

    const handleAddShift = (weekday: string) => {
        setDayShifts((prev) =>
            prev.map((dayShift) => {
                if (dayShift.weekday === weekday) {
                    const maxShiftOrder =
                        dayShift.shifts.length > 0 ? Math.max(...dayShift.shifts.map((s) => s.shift_order || 0)) : -1

                    const newShift: StationWorkingHour = {
                        station_id: station?.id || "",
                        weekday,
                        open_time: "09:00",
                        close_time: "17:00",
                        shift_order: maxShiftOrder + 1,
                    }

                    return { ...dayShift, shifts: [...dayShift.shifts, newShift] }
                }
                return dayShift
            })
        )
    }

    const handleDeleteShift = (weekday: string, shiftIndex: number) => {
        setDayShifts((prev) =>
            prev.map((dayShift) => {
                if (dayShift.weekday === weekday) {
                    const newShifts = dayShift.shifts.filter((_, idx) => idx !== shiftIndex)
                    const reorderedShifts = newShifts.map((shift, idx) => ({
                        ...shift,
                        shift_order: idx,
                    }))

                    return { ...dayShift, shifts: reorderedShifts }
                }
                return dayShift
            })
        )
    }

    const handleDeleteDay = (weekday: string) => {
        setDayShifts((prev) => prev.map((ds) => (ds.weekday === weekday ? { ...ds, shifts: [] } : ds)))
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast({
                title: "שגיאה",
                description: "שם העמדה נדרש",
                variant: "destructive",
            })
            return
        }

        const parsedInterval = parseInt(formData.slotIntervalMinutes, 10)
        if (!Number.isFinite(parsedInterval) || Number.isNaN(parsedInterval)) {
            toast({
                title: "מרווח תורים לא תקין",
                description: "נא להזין מספר תקין עבור מרווח התורים (בדקות).",
                variant: "destructive",
            })
            return
        }

        if (parsedInterval < 5 || parsedInterval > 360) {
            toast({
                title: "מרווח תורים מחוץ לטווח",
                description: "ניתן לבחור מרווח בין 5 ל-360 דקות.",
                variant: "destructive",
            })
            return
        }

        if (!station) {
            // Validate that we have at least one shift for saving new station
            const hasAnyShifts = dayShifts.some((ds) => ds.shifts.length > 0)
            if (!hasAnyShifts) {
                toast({
                    title: "אזהרה",
                    description: "יש להגדיר לפחות משמרת אחת עבור העמדה",
                    variant: "destructive",
                })
                return
            }
        }

        setIsSaving(true)
        try {
            let stationId: string

            if (station) {
                console.log("🛠️ [StationEditDialog] Updating station:", {
                    id: station.id,
                    name: formData.name,
                    is_active: formData.is_active,
                    slot_interval_minutes: parsedInterval,
                    allowedCustomerTypeIds: formData.allowedCustomerTypeIds,
                })
                // Update existing station
                const { data, error } = await supabase
                    .from("stations")
                    .update({
                        name: formData.name.trim(),
                        is_active: formData.is_active,
                        slot_interval_minutes: parsedInterval,
                    })
                    .eq("id", station.id)
                    .select("id")
                    .single()

                if (error) throw error
                stationId = data.id
            } else {
                console.log("🆕 [StationEditDialog] Creating station with data:", {
                    name: formData.name,
                    is_active: formData.is_active,
                    slot_interval_minutes: parsedInterval,
                    allowedCustomerTypeIds: formData.allowedCustomerTypeIds,
                })
                // Create new station
                const { data, error } = await supabase
                    .from("stations")
                    .insert({
                        name: formData.name.trim(),
                        is_active: formData.is_active,
                        slot_interval_minutes: parsedInterval,
                    })
                    .select("id")
                    .single()

                if (error) throw error
                stationId = data.id
            }

            console.log("🔄 [StationEditDialog] Persisting allowed customer types for station:", stationId)
            const { error: deleteAllowedError } = await supabase
                .from("station_allowed_customer_types")
                .delete()
                .eq("station_id", stationId)

            if (deleteAllowedError) throw deleteAllowedError

            if (formData.allowedCustomerTypeIds.length > 0) {
                const payload = formData.allowedCustomerTypeIds.map((customerTypeId) => ({
                    station_id: stationId,
                    customer_type_id: customerTypeId,
                }))

                const { error: insertAllowedError } = await supabase
                    .from("station_allowed_customer_types")
                    .insert(payload)

                if (insertAllowedError) throw insertAllowedError
                console.log("✅ [StationEditDialog] Saved allowed customer types:", payload)
            } else {
                console.log("ℹ️ [StationEditDialog] No customer type restrictions selected. Station open to all customers.")
            }

            // Save working hours
            // Delete all existing shifts first
            const { error: deleteError } = await supabase.from("station_working_hours").delete().eq("station_id", stationId)

            if (deleteError) throw deleteError

            // Collect all shifts to insert
            const shiftsToInsert: Omit<StationWorkingHour, "id">[] = []
            dayShifts.forEach((dayShift) => {
                dayShift.shifts.forEach((shift, index) => {
                    shiftsToInsert.push({
                        station_id: stationId,
                        weekday: shift.weekday,
                        open_time: shift.open_time,
                        close_time: shift.close_time,
                        shift_order: index,
                    })
                })
            })

            // Insert new shifts
            if (shiftsToInsert.length > 0) {
                const { error: insertError } = await supabase.from("station_working_hours").insert(shiftsToInsert)

                if (insertError) throw insertError
            }

            toast({
                title: "הצלחה",
                description: station ? "העמדה עודכנה בהצלחה" : "העמדה נוצרה בהצלחה",
            })

            // Invalidate ManagerSchedule cache so the calendar board reflects the changes immediately
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))

            onOpenChange(false)
            await onSaved()
        } catch (error: unknown) {
            console.error("Error saving station:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן לשמור את העמדה"
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">{station ? "ערוך עמדה" : "הוסף עמדה חדשה"}</DialogTitle>
                    <DialogDescription className="text-right">מלא את הפרטים כדי {station ? "לעדכן" : "להוסיף"} עמדה</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="station-name">שם העמדה <span className="text-red-500">*</span></Label>
                        <Input
                            id="station-name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="הכנס שם עמדה"
                            dir="rtl"
                        />
                    </div>

                    <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
                        />
                        <Label htmlFor="is_active" className="cursor-pointer">
                            העמדה פעילה
                        </Label>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="slot-interval" className="text-right">
                            מרווח תורים (בדקות)
                        </Label>
                        <Input
                            id="slot-interval"
                            type="number"
                            min={5}
                            max={360}
                            value={formData.slotIntervalMinutes}
                            onChange={(e) => setFormData({ ...formData, slotIntervalMinutes: e.target.value })}
                            placeholder="לדוגמה: 60"
                            dir="rtl"
                            className="text-right"
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            המרווח יקבע את נקודות ההתחלה האפשריות של התורים (לדוגמה: 60 דקות יניבו 08:00, 09:00, 10:00).
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-right">
                            רק לקוחות מסוגים אלו יוכלו להזמין תורים לעמדה זו
                        </Label>
                        <CustomerTypeMultiSelect
                            options={customerTypes}
                            selectedIds={formData.allowedCustomerTypeIds}
                            onSelectionChange={(ids) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    allowedCustomerTypeIds: ids,
                                }))
                            }
                            placeholder="בחר סוגי לקוחות..."
                            isLoading={isLoadingCustomerTypes}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                            אם לא ייבחרו סוגי לקוחות — כל הלקוחות יוכלו להזמין תורים לעמדה.
                        </p>
                    </div>

                    {/* Working Hours Section */}
                    <div className="space-y-4 border-t pt-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">שעות עבודה</h3>
                            <p className="text-sm text-gray-600 mb-4">
                                הגדר את שעות העבודה לכל יום. ניתן להוסיף מספר משמרות ליום (למשל: 08:00-14:00, 16:00-20:00)
                            </p>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right w-32 bg-primary/10 text-primary font-semibold">יום בשבוע</TableHead>
                                        <TableHead className="text-right bg-primary/10 text-primary font-semibold">משמרות</TableHead>
                                        <TableHead className="text-right w-24 bg-primary/10 text-primary font-semibold">פעולות</TableHead>
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
                                                        <div className="space-y-3">
                                                            {dayShift.shifts.map((shift, shiftIndex) => (
                                                                <div
                                                                    key={shiftIndex}
                                                                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Label className="text-sm text-gray-600 w-20 text-left">
                                                                            פתיחה:
                                                                        </Label>
                                                                        <TimePickerInput
                                                                            value={shift.open_time}
                                                                            onChange={(value) =>
                                                                                handleTimeChange(
                                                                                    dayShift.weekday,
                                                                                    shiftIndex,
                                                                                    "open_time",
                                                                                    value
                                                                                )
                                                                            }
                                                                            intervalMinutes={15}
                                                                            className="w-32"
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Label className="text-sm text-gray-600 w-20 text-left">
                                                                            סגירה:
                                                                        </Label>
                                                                        <TimePickerInput
                                                                            value={shift.close_time}
                                                                            onChange={(value) =>
                                                                                handleTimeChange(
                                                                                    dayShift.weekday,
                                                                                    shiftIndex,
                                                                                    "close_time",
                                                                                    value
                                                                                )
                                                                            }
                                                                            intervalMinutes={15}
                                                                            className="w-32"
                                                                        />
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDeleteShift(dayShift.weekday, shiftIndex)}
                                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                        title="מחק משמרת"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-gray-400 text-sm py-2">
                                                            אין שעות עבודה עבור יום זה
                                                        </div>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleAddShift(dayShift.weekday)}
                                                        className="mt-2 flex items-center gap-2"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        הוסף משמרת
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="align-top pt-4">
                                                    {hasShifts && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteDay(dayShift.weekday)}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="מחק את כל המשמרות ליום זה"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
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
                    <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
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

