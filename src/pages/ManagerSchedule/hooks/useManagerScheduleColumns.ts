import { useMemo } from "react"
import { useAppSelector } from "@/store/hooks"
import {
  PINNED_APPOINTMENTS_COLUMN_WIDTH,
  WAITLIST_COLUMN_WIDTH,
} from "../constants"
import type { ManagerStation } from "../types"

interface UseManagerScheduleColumnsParams {
  stations: ManagerStation[]
  visibleStationIds: string[]
  serviceFilter: "grooming" | "garden" | "both"
  showWaitingListColumn: boolean
  showPinnedAppointmentsColumn: boolean
  visibleStationsWindow: ManagerStation[]
  gardenColumnCount: number
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
  gardenColumnCount,
}: UseManagerScheduleColumnsParams) {
  // Check if we should show garden columns
  // Use gardenColumnCount which already accounts for Redux state
  const shouldShowGardenColumns = gardenColumnCount > 0

  // Calculate grid template columns
  const timeAxisWidth = 70
  const scheduledColumnCount = gardenColumnCount + visibleStationsWindow.length
  const gridColumnParts: string[] = [`${timeAxisWidth}px`]
  if (showPinnedAppointmentsColumn) {
    gridColumnParts.push(`${PINNED_APPOINTMENTS_COLUMN_WIDTH}px`)
  }
  if (showWaitingListColumn) {
    gridColumnParts.push(
      `minmax(${WAITLIST_COLUMN_WIDTH}px, ${WAITLIST_COLUMN_WIDTH + 80}px)`
    )
  }
  if (scheduledColumnCount > 0) {
    const scheduledTemplate =
      scheduledColumnCount === 1
        ? "minmax(256px, 1fr)"
        : `repeat(${scheduledColumnCount}, minmax(256px, 1fr))`
    gridColumnParts.push(scheduledTemplate)
  }

  const gridTemplateColumns = gridColumnParts.join(" ")

  return {
    shouldShowGardenColumns,
    gridTemplateColumns,
    scheduledColumnCount,
  }
}

