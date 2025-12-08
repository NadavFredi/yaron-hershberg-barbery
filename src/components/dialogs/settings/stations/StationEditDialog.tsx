import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Loader2, Save } from "lucide-react"
import { TimePickerInput } from "@/components/TimePickerInput"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { supabaseApi } from "@/store/services/supabaseApi"
import { CustomerTypeMultiSelect, type CustomerTypeOption } from "@/components/customer-types/CustomerTypeMultiSelect"
import { useCreateCustomerType } from "@/hooks/useCreateCustomerType"
import { DogCategoryMultiSelect, type DogCategoryOption } from "@/components/dog-categories/DogCategoryMultiSelect"
import { useCreateDogCategory } from "@/hooks/useCreateDogCategory"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Shield, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ShiftRestrictionsPopover } from "./ShiftRestrictionsPopover"

interface Station {
    id: string
    name: string
    is_active: boolean
    slot_interval_minutes?: number
}

interface StationWorkingHour {
    id?: string
    station_id: string
    weekday: string
    open_time: string
    close_time: string
    shift_order: number
    allowedCustomerTypeIds?: string[]
    allowedDogCategoryIds?: string[]
    blockedCustomerTypeIds?: string[]
    blockedDogCategoryIds?: string[]
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
    autoFilterByCurrentDay?: boolean // If true, auto-filter by current day when opened from manager dashboard
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

        const shifts = (data || []).map((h) => ({
            ...h,
            open_time: h.open_time?.substring(0, 5) || "",
            close_time: h.close_time?.substring(0, 5) || "",
            allowedCustomerTypeIds: [] as string[],
            allowedDogCategoryIds: [] as string[],
            blockedCustomerTypeIds: [] as string[],
            blockedDogCategoryIds: [] as string[],
        }))

        // Fetch shift restrictions
        if (shifts.length > 0) {
            const shiftIds = shifts.map((s) => s.id).filter((id): id is string => Boolean(id))

            if (shiftIds.length > 0) {
                // Fetch allowed customer type restrictions
                const { data: customerTypeRestrictions } = await supabase
                    .from("shift_allowed_customer_types")
                    .select("shift_id, customer_type_id")
                    .in("shift_id", shiftIds)

                // Fetch allowed dog category restrictions
                const { data: dogCategoryRestrictions } = await supabase
                    .from("shift_allowed_dog_categories")
                    .select("shift_id, dog_category_id")
                    .in("shift_id", shiftIds)

                // Fetch blocked customer type restrictions
                const { data: blockedCustomerTypeRestrictions } = await supabase
                    .from("shift_blocked_customer_types")
                    .select("shift_id, customer_type_id")
                    .in("shift_id", shiftIds)

                // Fetch blocked dog category restrictions
                const { data: blockedDogCategoryRestrictions } = await supabase
                    .from("shift_blocked_dog_categories")
                    .select("shift_id, dog_category_id")
                    .in("shift_id", shiftIds)

                // Group restrictions by shift_id
                const customerTypeMap = new Map<string, string[]>()
                const dogCategoryMap = new Map<string, string[]>()
                const blockedCustomerTypeMap = new Map<string, string[]>()
                const blockedDogCategoryMap = new Map<string, string[]>()

                customerTypeRestrictions?.forEach((r) => {
                    if (r.shift_id) {
                        const existing = customerTypeMap.get(r.shift_id) || []
                        customerTypeMap.set(r.shift_id, [...existing, r.customer_type_id])
                    }
                })

                dogCategoryRestrictions?.forEach((r) => {
                    if (r.shift_id) {
                        const existing = dogCategoryMap.get(r.shift_id) || []
                        dogCategoryMap.set(r.shift_id, [...existing, r.dog_category_id])
                    }
                })

                blockedCustomerTypeRestrictions?.forEach((r) => {
                    if (r.shift_id) {
                        const existing = blockedCustomerTypeMap.get(r.shift_id) || []
                        blockedCustomerTypeMap.set(r.shift_id, [...existing, r.customer_type_id])
                    }
                })

                blockedDogCategoryRestrictions?.forEach((r) => {
                    if (r.shift_id) {
                        const existing = blockedDogCategoryMap.get(r.shift_id) || []
                        blockedDogCategoryMap.set(r.shift_id, [...existing, r.dog_category_id])
                    }
                })

                // Apply restrictions to shifts
                shifts.forEach((shift) => {
                    if (shift.id) {
                        shift.allowedCustomerTypeIds = customerTypeMap.get(shift.id) || []
                        shift.allowedDogCategoryIds = dogCategoryMap.get(shift.id) || []
                        shift.blockedCustomerTypeIds = blockedCustomerTypeMap.get(shift.id) || []
                        shift.blockedDogCategoryIds = blockedDogCategoryMap.get(shift.id) || []
                    }
                })
            }
        }

        return shifts
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

// Helper function to convert date to weekday
const getWeekdayFromDate = (dateString: string): string => {
    const date = new Date(dateString)
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    return WEEKDAYS[dayOfWeek]?.value || "sunday"
}

export function StationEditDialog({ open, onOpenChange, station, onSaved, autoFilterByCurrentDay = false }: StationEditDialogProps) {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedDayFilters, setSelectedDayFilters] = useState<string[]>([])
    const [formData, setFormData] = useState({
        name: "",
        is_active: true,
        slotIntervalMinutes: "60",
        allowedCustomerTypeIds: [] as string[],
        allowedDogCategoryIds: [] as string[],
    })
    const [dayShifts, setDayShifts] = useState<DayShifts[]>([])
    const [customerTypes, setCustomerTypes] = useState<CustomerTypeOption[]>([])
    const [isLoadingCustomerTypes, setIsLoadingCustomerTypes] = useState(false)
    const [dogCategories, setDogCategories] = useState<DogCategoryOption[]>([])
    const [isLoadingDogCategories, setIsLoadingDogCategories] = useState(false)

    const hasFetchedCustomerTypesRef = useRef(false)
    const { createCustomerType } = useCreateCustomerType({
        onSuccess: (id, name) => {
            // Add to local state immediately
            const newCustomerType: CustomerTypeOption = {
                id,
                name,
            }
            setCustomerTypes((prev) => [...prev, newCustomerType])
        },
    })
    const { createDogCategory } = useCreateDogCategory({
        onSuccess: (id, name) => {
            // Add to local state immediately
            const newDogCategory: DogCategoryOption = {
                id,
                name,
            }
            setDogCategories((prev) => [...prev, newDogCategory])
        },
    })

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

    const fetchDogCategories = useCallback(async () => {
        console.log("🔍 [StationEditDialog] Fetching dog categories...")
        setIsLoadingDogCategories(true)
        try {
            const { data, error } = await supabase
                .from("dog_categories")
                .select("id, name")
                .order("name", { ascending: true })

            if (error) throw error
            const transformed = (data || []).map((item) => ({
                id: item.id,
                name: item.name,
            }))
            setDogCategories(transformed)
            console.log("✅ [StationEditDialog] Loaded dog categories:", transformed)
        } catch (error) {
            console.error("❌ [StationEditDialog] Failed to load dog categories:", error)
            toast({
                title: "שגיאה בטעינת קטגוריות הכלבים",
                description: "לא הצלחנו לטעון את קטגוריות הכלבים. נסה שוב מאוחר יותר.",
                variant: "destructive",
            })
        } finally {
            setIsLoadingDogCategories(false)
        }
    }, [toast])

    const fetchAllowedDogCategories = useCallback(
        async (stationId: string) => {
            console.log("🔍 [StationEditDialog] Fetching allowed dog categories for station:", stationId)
            try {
                const { data, error } = await supabase
                    .from("station_allowed_dog_categories")
                    .select("dog_category_id, dog_category:dog_categories(id, name)")
                    .eq("station_id", stationId)

                if (error) throw error

                type AllowedRow = {
                    dog_category_id: string
                    dog_category: { id: string; name: string } | null
                }

                const rows = (data || []) as AllowedRow[]
                const ids = rows
                    .map((row) => row.dog_category_id)
                    .filter((value): value is string => Boolean(value))

                setFormData((prev) => ({
                    ...prev,
                    allowedDogCategoryIds: ids,
                }))

                setDogCategories((prev) => {
                    const existingIds = new Set(prev.map((item) => item.id))
                    const merged = [...prev]
                    rows.forEach((row) => {
                        const option = row.dog_category
                        if (option && !existingIds.has(option.id)) {
                            merged.push({ id: option.id, name: option.name })
                            existingIds.add(option.id)
                        }
                    })
                    return merged
                })

                console.log("✅ [StationEditDialog] Station allowed dog categories:", ids)
            } catch (error) {
                console.error("❌ [StationEditDialog] Failed to fetch allowed dog categories:", error)
                toast({
                    title: "שגיאה בטעינת קטגוריות הכלבים לעמדה",
                    description: "לא הצלחנו לטעון את קטגוריות הכלבים המורשות לעמדה זו.",
                    variant: "destructive",
                })
                setFormData((prev) => ({
                    ...prev,
                    allowedDogCategoryIds: [],
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
        void fetchDogCategories()
    }, [open, fetchCustomerTypes, fetchDogCategories])

    // Auto-select current day when modal opens (only if autoFilterByCurrentDay is true)
    useEffect(() => {
        if (open && autoFilterByCurrentDay && selectedDate) {
            const currentWeekday = getWeekdayFromDate(selectedDate)
            setSelectedDayFilters([currentWeekday])
        } else if (!open) {
            // Clear filter when modal closes
            setSelectedDayFilters([])
        }
    }, [open, selectedDate, autoFilterByCurrentDay])

    useEffect(() => {
        if (open && station) {
            // Editing existing station
            setFormData({
                name: station.name,
                is_active: station.is_active,
                slotIntervalMinutes: String(station.slot_interval_minutes ?? 60),
                allowedCustomerTypeIds: [],
                allowedDogCategoryIds: [],
            })
            fetchStationWorkingHours(station.id).then((hours) => {
                setDayShifts(processHoursData(hours))
            })
            void fetchAllowedCustomerTypes(station.id)
            void fetchAllowedDogCategories(station.id)
        } else if (open && !station) {
            // Adding new station
            setFormData({
                name: "",
                is_active: true,
                slotIntervalMinutes: "60",
                allowedCustomerTypeIds: [],
                allowedDogCategoryIds: [],
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
                        allowedCustomerTypeIds: [],
                        allowedDogCategoryIds: [],
                        blockedCustomerTypeIds: [],
                        blockedDogCategoryIds: [],
                    }

                    return { ...dayShift, shifts: [...dayShift.shifts, newShift] }
                }
                return dayShift
            })
        )
    }

    const handleShiftRestrictionChange = (
        weekday: string,
        shiftIndex: number,
        type: "customerTypes" | "dogCategories" | "blockedCustomerTypes" | "blockedDogCategories",
        ids: string[]
    ) => {
        setDayShifts((prev) =>
            prev.map((dayShift) => {
                if (dayShift.weekday === weekday) {
                    const newShifts = [...dayShift.shifts]
                    if (newShifts[shiftIndex]) {
                        let fieldName: string
                        if (type === "customerTypes") {
                            fieldName = "allowedCustomerTypeIds"
                        } else if (type === "dogCategories") {
                            fieldName = "allowedDogCategoryIds"
                        } else if (type === "blockedCustomerTypes") {
                            fieldName = "blockedCustomerTypeIds"
                        } else {
                            fieldName = "blockedDogCategoryIds"
                        }
                        newShifts[shiftIndex] = {
                            ...newShifts[shiftIndex],
                            [fieldName]: ids,
                        }
                    }
                    return { ...dayShift, shifts: newShifts }
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

            // Save station-level customer type restrictions
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

            // Save station-level dog category restrictions
            console.log("🔄 [StationEditDialog] Persisting allowed dog categories for station:", stationId)
            const { error: deleteDogCategoryError } = await supabase
                .from("station_allowed_dog_categories")
                .delete()
                .eq("station_id", stationId)

            if (deleteDogCategoryError) throw deleteDogCategoryError

            if (formData.allowedDogCategoryIds.length > 0) {
                const payload = formData.allowedDogCategoryIds.map((dogCategoryId) => ({
                    station_id: stationId,
                    dog_category_id: dogCategoryId,
                }))

                const { error: insertDogCategoryError } = await supabase
                    .from("station_allowed_dog_categories")
                    .insert(payload)

                if (insertDogCategoryError) throw insertDogCategoryError
                console.log("✅ [StationEditDialog] Saved allowed dog categories:", payload)
            } else {
                console.log("ℹ️ [StationEditDialog] No dog category restrictions selected. Station open to all dog categories.")
            }

            // Save working hours
            // Delete all existing shifts first (this will cascade delete shift restrictions)
            const { error: deleteError } = await supabase.from("station_working_hours").delete().eq("station_id", stationId)

            if (deleteError) throw deleteError

            // Collect all shifts to insert
            const shiftsToInsert: Omit<StationWorkingHour, "id" | "allowedCustomerTypeIds" | "allowedDogCategoryIds" | "blockedCustomerTypeIds" | "blockedDogCategoryIds">[] = []
            const shiftRestrictions: Array<{
                shiftId: string
                customerTypeIds: string[]
                dogCategoryIds: string[]
                blockedCustomerTypeIds: string[]
                blockedDogCategoryIds: string[]
            }> = []

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

            // Insert new shifts and get their IDs
            if (shiftsToInsert.length > 0) {
                const { data: insertedShifts, error: insertError } = await supabase
                    .from("station_working_hours")
                    .insert(shiftsToInsert)
                    .select("id, weekday, shift_order")

                if (insertError) throw insertError

                // Map shifts back to their restrictions
                if (insertedShifts) {
                    dayShifts.forEach((dayShift) => {
                        dayShift.shifts.forEach((shift, index) => {
                            const insertedShift = insertedShifts.find(
                                (s) => s.weekday === shift.weekday && s.shift_order === index
                            )
                            if (insertedShift?.id) {
                                shiftRestrictions.push({
                                    shiftId: insertedShift.id,
                                    customerTypeIds: shift.allowedCustomerTypeIds || [],
                                    dogCategoryIds: shift.allowedDogCategoryIds || [],
                                    blockedCustomerTypeIds: shift.blockedCustomerTypeIds || [],
                                    blockedDogCategoryIds: shift.blockedDogCategoryIds || [],
                                })
                            }
                        })
                    })

                    // Save shift-level restrictions
                    const customerTypeRestrictions: Array<{ shift_id: string; customer_type_id: string }> = []
                    const dogCategoryRestrictions: Array<{ shift_id: string; dog_category_id: string }> = []
                    const blockedCustomerTypeRestrictions: Array<{ shift_id: string; customer_type_id: string }> = []
                    const blockedDogCategoryRestrictions: Array<{ shift_id: string; dog_category_id: string }> = []

                    shiftRestrictions.forEach((restriction) => {
                        restriction.customerTypeIds.forEach((customerTypeId) => {
                            customerTypeRestrictions.push({
                                shift_id: restriction.shiftId,
                                customer_type_id: customerTypeId,
                            })
                        })
                        restriction.dogCategoryIds.forEach((dogCategoryId) => {
                            dogCategoryRestrictions.push({
                                shift_id: restriction.shiftId,
                                dog_category_id: dogCategoryId,
                            })
                        })
                        restriction.blockedCustomerTypeIds.forEach((customerTypeId) => {
                            blockedCustomerTypeRestrictions.push({
                                shift_id: restriction.shiftId,
                                customer_type_id: customerTypeId,
                            })
                        })
                        restriction.blockedDogCategoryIds.forEach((dogCategoryId) => {
                            blockedDogCategoryRestrictions.push({
                                shift_id: restriction.shiftId,
                                dog_category_id: dogCategoryId,
                            })
                        })
                    })

                    if (customerTypeRestrictions.length > 0) {
                        const { error: insertCustomerTypeError } = await supabase
                            .from("shift_allowed_customer_types")
                            .insert(customerTypeRestrictions)
                        if (insertCustomerTypeError) throw insertCustomerTypeError
                        console.log("✅ [StationEditDialog] Saved shift customer type restrictions:", customerTypeRestrictions.length)
                    }

                    if (dogCategoryRestrictions.length > 0) {
                        const { error: insertDogCategoryError } = await supabase
                            .from("shift_allowed_dog_categories")
                            .insert(dogCategoryRestrictions)
                        if (insertDogCategoryError) throw insertDogCategoryError
                        console.log("✅ [StationEditDialog] Saved shift dog category restrictions:", dogCategoryRestrictions.length)
                    }

                    if (blockedCustomerTypeRestrictions.length > 0) {
                        const { error: insertBlockedCustomerTypeError } = await supabase
                            .from("shift_blocked_customer_types")
                            .insert(blockedCustomerTypeRestrictions)
                        if (insertBlockedCustomerTypeError) throw insertBlockedCustomerTypeError
                        console.log("✅ [StationEditDialog] Saved shift blocked customer type restrictions:", blockedCustomerTypeRestrictions.length)
                    }

                    if (blockedDogCategoryRestrictions.length > 0) {
                        const { error: insertBlockedDogCategoryError } = await supabase
                            .from("shift_blocked_dog_categories")
                            .insert(blockedDogCategoryRestrictions)
                        if (insertBlockedDogCategoryError) throw insertBlockedDogCategoryError
                        console.log("✅ [StationEditDialog] Saved shift blocked dog category restrictions:", blockedDogCategoryRestrictions.length)
                    }
                }
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

                    <Accordion type="single" collapsible className="w-full" dir="rtl">
                        <AccordionItem value="restrictions" className="border border-gray-200 rounded-lg px-4 bg-gray-50/50">
                            <AccordionTrigger className="hover:no-underline py-4 [&>svg]:mr-auto [&>svg]:ml-0">
                                <div className="flex items-center gap-2 text-right flex-1">
                                    <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span className="font-semibold text-gray-900">
                                        הגבל את התורים שניתן לתזמן לעמדה זו
                                    </span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                                <div className="space-y-6 pt-2">
                                    <div className="space-y-2">
                                        <Label className="text-right font-medium">
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
                                            onCreateCustomerType={createCustomerType}
                                            onRefreshOptions={() => fetchCustomerTypes({ force: true })}
                                        />
                                        <p className="text-xs text-muted-foreground text-right">
                                            אם לא ייבחרו סוגי לקוחות — כל הלקוחות יוכלו להזמין תורים לעמדה.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-right font-medium">
                                            רק כלבים מקטגוריות אלו יוכלו להזמין תורים לעמדה זו
                                        </Label>
                                        <DogCategoryMultiSelect
                                            options={dogCategories}
                                            selectedIds={formData.allowedDogCategoryIds}
                                            onSelectionChange={(ids) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    allowedDogCategoryIds: ids,
                                                }))
                                            }
                                            placeholder="בחר קטגוריות כלבים..."
                                            isLoading={isLoadingDogCategories}
                                            onCreateDogCategory={createDogCategory}
                                            onRefreshOptions={fetchDogCategories}
                                        />
                                        <p className="text-xs text-muted-foreground text-right">
                                            אם לא ייבחרו קטגוריות כלבים — כל הקטגוריות יוכלו להזמין תורים לעמדה.
                                        </p>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>

                    {/* Working Hours Section */}
                    <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">שעות עבודה</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    הגדר את שעות העבודה לכל יום. ניתן להוסיף מספר משמרות ליום (למשל: 08:00-14:00, 16:00-20:00)
                                </p>
                            </div>
                            {/* Day Filter */}
                            <div className="flex items-center gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "text-right",
                                                selectedDayFilters.length > 0 && "bg-primary/10 border-primary"
                                            )}
                                        >
                                            {selectedDayFilters.length === 0
                                                ? "הצג כל הימים"
                                                : selectedDayFilters.length === 1
                                                ? WEEKDAYS.find(d => d.value === selectedDayFilters[0])?.label || "יום נבחר"
                                                : `${selectedDayFilters.length} ימים נבחרו`}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="end" dir="rtl">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-2 py-1.5 border-b">
                                                <span className="text-sm font-semibold">סינון לפי ימים</span>
                                                {selectedDayFilters.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-xs"
                                                        onClick={() => setSelectedDayFilters([])}
                                                    >
                                                        נקה הכל
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {WEEKDAYS.map((day) => (
                                                    <div
                                                        key={day.value}
                                                        className="flex items-center space-x-2 space-x-reverse p-2 hover:bg-gray-50 rounded cursor-pointer"
                                                        onClick={() => {
                                                            if (selectedDayFilters.includes(day.value)) {
                                                                setSelectedDayFilters(selectedDayFilters.filter(d => d !== day.value))
                                                            } else {
                                                                setSelectedDayFilters([...selectedDayFilters, day.value])
                                                            }
                                                        }}
                                                    >
                                                        <Checkbox
                                                            checked={selectedDayFilters.includes(day.value)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedDayFilters([...selectedDayFilters, day.value])
                                                                } else {
                                                                    setSelectedDayFilters(selectedDayFilters.filter(d => d !== day.value))
                                                                }
                                                            }}
                                                        />
                                                        <label className="text-sm font-medium leading-none cursor-pointer flex-1 text-right">
                                                            {day.label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                {selectedDayFilters.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setSelectedDayFilters([])}
                                        title="נקה סינון"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
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
                                    {dayShifts
                                        .filter((dayShift) => {
                                            // If no filter selected, show all days
                                            if (selectedDayFilters.length === 0) return true
                                            // Otherwise, only show selected days
                                            return selectedDayFilters.includes(dayShift.weekday)
                                        })
                                        .map((dayShift) => {
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
                                                                    className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
                                                                >
                                                                    <div className="flex items-center gap-2 flex-nowrap">
                                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                            <Label className="text-xs text-gray-600 w-14 text-left whitespace-nowrap">
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
                                                                                className="w-24"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                            <Label className="text-xs text-gray-600 w-14 text-left whitespace-nowrap">
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
                                                                                className="w-24"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-shrink-0">
                                                                            <ShiftRestrictionsPopover
                                                                                shift={shift}
                                                                                customerTypes={customerTypes}
                                                                                dogCategories={dogCategories}
                                                                                isLoadingCustomerTypes={isLoadingCustomerTypes}
                                                                                isLoadingDogCategories={isLoadingDogCategories}
                                                                                onCreateCustomerType={createCustomerType}
                                                                                onCreateDogCategory={createDogCategory}
                                                                                onRefreshCustomerTypes={() => fetchCustomerTypes({ force: true })}
                                                                                onRefreshDogCategories={fetchDogCategories}
                                                                                onRestrictionChange={(type, ids) =>
                                                                                    handleShiftRestrictionChange(
                                                                                        dayShift.weekday,
                                                                                        shiftIndex,
                                                                                        type,
                                                                                        ids
                                                                                    )
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteShift(dayShift.weekday, shiftIndex)}
                                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 h-8 w-8 p-0"
                                                                            title="מחק משמרת"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
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

