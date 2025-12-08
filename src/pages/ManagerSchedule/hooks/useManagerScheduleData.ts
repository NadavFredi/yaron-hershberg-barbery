import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { useAppSelector } from "@/store/hooks"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { supabase } from "@/integrations/supabase/client"
import {
  getManagerScheduleSnapshot,
  INITIAL_LOADER_DELAY_MS,
  setManagerScheduleSnapshot,
} from "../managerSchedule.module"
import type { ManagerScheduleData } from "../types"
import { DEFAULT_END_HOUR } from "../constants"

/**
 * Hook to manage manager schedule data fetching, snapshot management, and initial loader state
 */
export function useManagerScheduleData() {
  const selectedDateStr = useAppSelector(
    (state) => state.managerSchedule.selectedDate
  )
  const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
  const formattedDate = format(selectedDate, "yyyy-MM-dd")

  const snapshotKey = useMemo(() => `date:${formattedDate}`, [formattedDate])
  const initialSnapshot = useMemo(
    () => getManagerScheduleSnapshot(snapshotKey),
    [snapshotKey]
  )
  const [displayData, setDisplayData] = useState<ManagerScheduleData | null>(
    initialSnapshot
  )
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(
    () => initialSnapshot !== null
  )
  const [showInitialLoader, setShowInitialLoader] = useState(false)
  const initialLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const { data: apiData, isLoading } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both", // Always fetch all data, filter on frontend
  })

  useEffect(() => {
    if (apiData) {
      setDisplayData(apiData)
      setManagerScheduleSnapshot(snapshotKey, apiData)
    }
  }, [apiData, snapshotKey])

  const data = displayData

  // Initial loader logic
  useEffect(() => {
    if (typeof setTimeout !== "function" || typeof clearTimeout !== "function") {
      return
    }

    if (!hasLoadedInitialData && isLoading) {
      if (initialLoaderTimerRef.current !== null) {
        clearTimeout(initialLoaderTimerRef.current)
      }

      initialLoaderTimerRef.current = setTimeout(() => {
        setShowInitialLoader(true)
        console.log("[ManagerSchedule] מציג מצב טעינה ראשוני לאחר השהייה", {
          delayMs: INITIAL_LOADER_DELAY_MS,
          selectedDate: formattedDate,
        })
      }, INITIAL_LOADER_DELAY_MS)

      return () => {
        if (initialLoaderTimerRef.current !== null) {
          clearTimeout(initialLoaderTimerRef.current)
          initialLoaderTimerRef.current = null
        }
      }
    }

    if (initialLoaderTimerRef.current !== null) {
      clearTimeout(initialLoaderTimerRef.current)
      initialLoaderTimerRef.current = null
    }

    if (showInitialLoader) {
      setShowInitialLoader(false)
      console.log("[ManagerSchedule] סיום הצגת מצב הטעינה הראשוני", {
        selectedDate: formattedDate,
      })
    }

    if (!isLoading && data && !hasLoadedInitialData) {
      console.log("[ManagerSchedule] הנתונים הראשוניים נטענו בהצלחה", {
        stations: data.stations?.length ?? 0,
        appointments: data.appointments?.length ?? 0,
      })
      setHasLoadedInitialData(true)
    }
  }, [isLoading, data, hasLoadedInitialData, showInitialLoader, formattedDate])

  // Fetch global working hours to determine the latest end time
  const [globalEndHour, setGlobalEndHour] = useState<number | undefined>(
    DEFAULT_END_HOUR
  )

  useEffect(() => {
    const fetchGlobalEndHour = async () => {
      try {
        const { data: businessHours, error } = await supabase
          .from("business_hours")
          .select("close_time")

        if (error) {
          console.error("Error fetching global working hours:", error)
          return
        }

        if (businessHours && businessHours.length > 0) {
          // Find the latest close_time across all days/shifts
          let latestHour = 0
          businessHours.forEach((hour) => {
            if (hour.close_time) {
              const timeStr = hour.close_time.substring(0, 5) // Get HH:mm
              const [hours, minutes] = timeStr.split(":").map(Number)
              // For close_time like "17:00:00", use hour 17
              // For close_time like "17:30:00", use hour 18 (round up)
              const hourValue = minutes > 0 ? hours + 1 : hours
              if (hourValue > latestHour) {
                latestHour = hourValue
              }
            }
          })
          // Only set if we found at least one valid close_time
          if (latestHour > 0) {
            setGlobalEndHour(latestHour)
          }
        }
      } catch (error) {
        console.error("Error fetching global working hours:", error)
      }
    }

    fetchGlobalEndHour()
  }, [])

  return {
    data,
    isLoading,
    hasLoadedInitialData,
    showInitialLoader,
    globalEndHour,
    selectedDate,
    formattedDate,
  }
}

