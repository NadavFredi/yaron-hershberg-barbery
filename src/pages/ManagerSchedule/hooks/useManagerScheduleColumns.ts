import { useMemo } from "react"
import { useAppSelector } from "@/store/hooks"
import { PINNED_APPOINTMENTS_COLUMN_WIDTH, WAITLIST_COLUMN_WIDTH } from "../constants"
import type { ManagerStation } from "../types"

interface UseManagerScheduleColumnsParams {
  stations: ManagerStation[]
  visibleStationIds: string[]
  serviceFilter: "grooming"
  showWaitingListColumn: boolean
  showPinnedAppointmentsColumn: boolean
  visibleStationsWindow: ManagerStation[]
}

/**
 * Hook to compute column visibility and grid template columns
 */
export function useManagerScheduleColumns({
  stations,
  visibleStationIds,
  serviceFilter,
  showWaitingListColumn,
  showPinnedAppointmentsColumn,
  visibleStationsWindow,
}: UseManagerScheduleColumnsParams) {
  // Calculate grid template columns
  const timeAxisWidth = 70
  const scheduledColumnCount = visibleStationsWindow.length
  const gridColumnParts: string[] = [`${timeAxisWidth}px`]
  if (showPinnedAppointmentsColumn) {
    // Use a fixed width that accommodates the content (search bar, filters, cards)
    gridColumnParts.push(`${Math.max(PINNED_APPOINTMENTS_COLUMN_WIDTH, 320)}px`)
  }
  if (showWaitingListColumn) {
    gridColumnParts.push(`minmax(${WAITLIST_COLUMN_WIDTH}px, ${WAITLIST_COLUMN_WIDTH + 80}px)`)
  }
  if (scheduledColumnCount > 0) {
    const scheduledTemplate =
      scheduledColumnCount === 1 ? "minmax(256px, 1fr)" : `repeat(${scheduledColumnCount}, minmax(256px, 1fr))`
    gridColumnParts.push(scheduledTemplate)
  }

  const gridTemplateColumns = gridColumnParts.join(" ")

  return {
    gridTemplateColumns,
    scheduledColumnCount,
  }
}
