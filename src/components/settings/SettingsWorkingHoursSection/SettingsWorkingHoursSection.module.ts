import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

export interface BusinessHour {
  id?: string
  weekday: string
  open_time: string
  close_time: string
  shift_order: number
}

export interface DayShifts {
  weekday: string
  shifts: BusinessHour[]
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

/**
 * Normalize time format for TimePickerInput
 */
function normalizeTime(time: string): string {
  if (!time) return ""
  return time.substring(0, 5) // Take first 5 characters (HH:mm)
}

/**
 * Process hours data into day shifts format
 */
function processHoursData(existingHours: BusinessHour[]): DayShifts[] {
  // Group by weekday and sort days
  const shiftsByDay = new Map<string, BusinessHour[]>()

  WEEKDAYS.forEach((day) => {
    shiftsByDay.set(day.value, [])
  })

  existingHours.forEach((hour) => {
    if (shiftsByDay.has(hour.weekday)) {
      // Normalize time formats for TimePickerInput
      shiftsByDay.get(hour.weekday)!.push({
        ...hour,
        open_time: normalizeTime(hour.open_time),
        close_time: normalizeTime(hour.close_time),
      })
    }
  })

  // Convert to array of DayShifts, sorted by weekday order
  return WEEKDAYS.map((day) => {
    const shifts = shiftsByDay.get(day.value) || []
    // Sort shifts by shift_order
    shifts.sort((a, b) => (a.shift_order || 0) - (b.shift_order || 0))
    return {
      weekday: day.value,
      shifts: shifts.length > 0 ? shifts : [],
    }
  })
}

/**
 * Fetch all business hours
 */
async function fetchBusinessHours(): Promise<BusinessHour[]> {
  try {
    // Try to fetch with shift_order ordering first (new schema)
    const { data, error } = await supabase
      .from("business_hours")
      .select("*")
      .order("weekday", { ascending: true })
      .order("shift_order", { ascending: true })

    if (error) {
      // If error is about missing shift_order column, fetch without it
      if (error.message?.includes("shift_order") || error.code === "42703") {
        console.log("⚠️ shift_order column doesn't exist yet, fetching without ordering by it")
        const { data: dataWithoutOrder, error: error2 } = await supabase
          .from("business_hours")
          .select("*")
          .order("weekday", { ascending: true })

        if (error2) throw error2

        // Map to include shift_order with default value
        return (dataWithoutOrder || []).map((h: BusinessHour | Record<string, unknown>) => ({
          ...h,
          shift_order: (h as BusinessHour).shift_order ?? 0,
        })) as BusinessHour[]
      } else {
        throw error
      }
    }

    // Process data - ensure shift_order exists
    return (data || []).map((h: BusinessHour | Record<string, unknown>) => ({
      ...h,
      shift_order: (h as BusinessHour).shift_order ?? 0,
    })) as BusinessHour[]
  } catch (error) {
    console.error("Error fetching business hours:", error)
    throw error
  }
}

/**
 * Delete business hours by IDs
 */
async function deleteBusinessHours(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const { error } = await supabase.from("business_hours").delete().in("id", ids)

  if (error) {
    throw new Error(`Failed to delete business hours: ${error.message}`)
  }
}

/**
 * Delete all business hours
 */
async function deleteAllBusinessHours(): Promise<void> {
  // Get all existing IDs first
  const { data: existingShifts } = await supabase.from("business_hours").select("id")
  const existingIds = (existingShifts || []).map((s) => s.id)

  if (existingIds.length > 0) {
    const { error: deleteError } = await supabase.from("business_hours").delete().in("id", existingIds)

    if (deleteError) {
      throw new Error(`Failed to delete all business hours: ${deleteError.message}`)
    }
  }
}

/**
 * Insert business hours
 */
async function insertBusinessHours(hours: Omit<BusinessHour, "id">[]): Promise<void> {
  if (hours.length === 0) return

  const { error } = await supabase.from("business_hours").insert(hours)

  if (error) {
    throw new Error(`Failed to insert business hours: ${error.message}`)
  }
}

/**
 * Hook for managing business hours
 */
export function useBusinessHours() {
  const { toast } = useToast()
  const [dayShifts, setDayShifts] = useState<DayShifts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadHours = useCallback(async () => {
    setIsLoading(true)
    try {
      const existingHours = await fetchBusinessHours()
      const processed = processHoursData(existingHours)
      setDayShifts(processed)
    } catch (error) {
      console.error("Error fetching business hours:", error)
      const errorMessage = error instanceof Error ? error.message : "לא ניתן לטעון את שעות העבודה"

      // Initialize with empty shifts to prevent render errors
      const emptyShifts: DayShifts[] = WEEKDAYS.map((day) => ({
        weekday: day.value,
        shifts: [],
      }))
      setDayShifts(emptyShifts)

      // Show helpful message based on error type
      const errorCode = error && typeof error === "object" && "code" in error ? (error.code as string) : null
      if (errorMessage.includes("shift_order") || errorCode === "42703") {
        toast({
          title: "שגיאה",
          description: "טבלת שעות העבודה לא עודכנה. אנא הפעל את המיגרציה: supabase db reset --local",
          variant: "destructive",
        })
      } else {
        toast({
          title: "שגיאה",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadHours()
  }, [loadHours])

  const saveHours = useCallback(async () => {
    setIsSaving(true)
    try {
      // Collect all shifts with IDs (existing) and without IDs (new)
      const allShifts: BusinessHour[] = []
      dayShifts.forEach((dayShift) => {
        dayShift.shifts.forEach((shift) => {
          allShifts.push({
            ...shift,
            weekday: dayShift.weekday,
          })
        })
      })

      // Delete all existing hours first
      await deleteAllBusinessHours()

      // Insert all new hours
      if (allShifts.length > 0) {
        const shiftsToInsert = allShifts.map((shift) => ({
          weekday: shift.weekday,
          open_time: shift.open_time.length === 5 ? `${shift.open_time}:00` : shift.open_time,
          close_time: shift.close_time.length === 5 ? `${shift.close_time}:00` : shift.close_time,
          shift_order: shift.shift_order,
        }))

        await insertBusinessHours(shiftsToInsert)
      }

      toast({
        title: "הצלחה",
        description: "שעות העבודה נשמרו בהצלחה",
      })

      // Reload to get IDs for newly created shifts
      await loadHours()
    } catch (error) {
      console.error("Error saving business hours:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן לשמור את שעות העבודה",
        variant: "destructive",
      })
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [dayShifts, toast, loadHours])

  const deleteShift = useCallback(
    async (weekday: string, shiftIndex: number) => {
      const dayShift = dayShifts.find((ds) => ds.weekday === weekday)
      if (!dayShift) return

      const shiftToDelete = dayShift.shifts[shiftIndex]
      if (shiftToDelete?.id) {
        try {
          await deleteBusinessHours([shiftToDelete.id])
        } catch (error) {
          console.error("Error deleting shift:", error)
        }
      }

      // Update state
      setDayShifts((prev) =>
        prev.map((dayShift) => {
          if (dayShift.weekday === weekday) {
            const newShifts = dayShift.shifts.filter((_, idx) => idx !== shiftIndex)
            // Reorder remaining shifts
            const reorderedShifts = newShifts.map((shift, idx) => ({
              ...shift,
              shift_order: idx,
            }))
            return { ...dayShift, shifts: reorderedShifts }
          }
          return dayShift
        })
      )
    },
    [dayShifts]
  )

  const deleteDay = useCallback(
    async (weekday: string) => {
      const dayShift = dayShifts.find((ds) => ds.weekday === weekday)
      if (!dayShift) return

      // Delete all shifts for this day from DB
      if (dayShift.shifts.length > 0) {
        const idsToDelete = dayShift.shifts.filter((s) => s.id).map((s) => s.id!)
        if (idsToDelete.length > 0) {
          try {
            await deleteBusinessHours(idsToDelete)
          } catch (error) {
            console.error("Error deleting shifts:", error)
          }
        }
      }

      // Clear from state
      setDayShifts((prev) => prev.map((ds) => (ds.weekday === weekday ? { ...ds, shifts: [] } : ds)))

      toast({
        title: "הצלחה",
        description: "שעות העבודה ליום זה נמחקו",
      })
    },
    [dayShifts, toast]
  )

  return {
    dayShifts,
    setDayShifts,
    isLoading,
    isSaving,
    loadHours,
    saveHours,
    deleteShift,
    deleteDay,
    WEEKDAYS,
  }
}

