import { useMemo } from "react"
import { useAppSelector } from "@/store/hooks"
import { buildTimeline } from "../managerSchedule.module"
import type { ManagerAppointment, ManagerScheduleData } from "../types"

interface UseManagerScheduleTimelineParams {
  selectedDate: Date
  data: ManagerScheduleData | null
  intervalMinutes: number
  pixelsPerMinuteScale: number
  globalEndHour: number | undefined
}

/**
 * Hook to compute the timeline configuration for the schedule
 */
export function useManagerScheduleTimeline({
  selectedDate,
  data,
  intervalMinutes,
  pixelsPerMinuteScale,
  globalEndHour,
}: UseManagerScheduleTimelineParams) {
  // Optimistic appointments are now handled in ManagerScheduleContent
  const optimisticAppointments = useMemo<ManagerAppointment[]>(() => [], [])

  const timeline = useMemo(
    () =>
      buildTimeline(
        selectedDate,
        data,
        intervalMinutes,
        pixelsPerMinuteScale,
        optimisticAppointments,
        globalEndHour
      ),
    [
      selectedDate,
      data,
      intervalMinutes,
      pixelsPerMinuteScale,
      optimisticAppointments,
      globalEndHour,
    ]
  )

  return { timeline }
}

