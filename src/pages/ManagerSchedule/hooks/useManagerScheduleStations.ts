import { useEffect, useMemo } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setStationOrderIds,
  setStationWindowStart,
  setVisibleStationIds,
} from "@/store/slices/managerScheduleSlice"
import { MAX_VISIBLE_STATIONS } from "../managerSchedule.module"
import type { ManagerScheduleData, ManagerStation } from "../types"

interface UseManagerScheduleStationsParams {
  data: ManagerScheduleData | null
  serviceFilter: "grooming" | "garden" | "both"
  showWaitingListColumn: boolean
  showPinnedAppointmentsColumn: boolean
  showGardenColumn: boolean
  visibleStationIds: string[]
  hasUrlStationsOverride?: boolean
}

/**
 * Hook to manage station ordering, filtering, and window management
 */
export function useManagerScheduleStations({
  data,
  serviceFilter,
  showWaitingListColumn,
  showPinnedAppointmentsColumn,
  showGardenColumn,
  visibleStationIds,
  hasUrlStationsOverride = false,
}: UseManagerScheduleStationsParams) {
  const dispatch = useAppDispatch()
  const stationOrderIds = useAppSelector(
    (state) => state.managerSchedule.stationOrderIds
  )
  const stationWindowStart = useAppSelector(
    (state) => state.managerSchedule.stationWindowStart
  )
  const shouldHideAllStations =
    hasUrlStationsOverride && visibleStationIds.length === 0

  // Initialize station order from data
  useEffect(() => {
    if (!data?.stations) {
      if (stationOrderIds.length > 0) {
        dispatch(setStationOrderIds([]))
      }
      return
    }

    const incoming = data.stations.map((station) => station.id)
    if (stationOrderIds.length === 0) {
      dispatch(setStationOrderIds(incoming))
      return
    }
    const preserved = stationOrderIds.filter((id) => incoming.includes(id))
    const missing = incoming.filter((id) => !preserved.includes(id))
    const next = [...preserved, ...missing]
    const hasChanged =
      next.length !== stationOrderIds.length ||
      next.some((id, index) => id !== stationOrderIds[index])
    if (hasChanged) {
      dispatch(setStationOrderIds(next))
    }
  }, [data?.stations, stationOrderIds, dispatch])

  // Compute ordered stations
  const stations = useMemo(() => {
    if (!data?.stations) {
      return []
    }

    if (!stationOrderIds.length) {
      return [...data.stations].sort((a, b) => {
        const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        if (orderCompare !== 0) return orderCompare
        return a.name.localeCompare(b.name, "he")
      })
    }

    const positions = new Map(stationOrderIds.map((id, index) => [id, index]))
    const fallbackPosition = stationOrderIds.length

    return [...data.stations].sort((a, b) => {
      const posA = positions.has(a.id) ? positions.get(a.id)! : fallbackPosition
      const posB = positions.has(b.id) ? positions.get(b.id)! : fallbackPosition
      if (posA !== posB) return posA - posB
      const orderCompare = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      if (orderCompare !== 0) return orderCompare
      return a.name.localeCompare(b.name, "he")
    })
  }, [data?.stations, stationOrderIds])

  // Initialize visible stations from data
  useEffect(() => {
    if (!data?.stations) {
      return
    }
    const shouldSkipForUrlOverride =
      hasUrlStationsOverride && visibleStationIds.length === 0
    const incoming = data.stations.map((station) => station.id)
    const preserved = visibleStationIds.filter((stationId) =>
      incoming.includes(stationId)
    )
    if (shouldSkipForUrlOverride) {
      return
    }
    const next = preserved.length > 0 ? preserved : incoming
    const hasChanged =
      next.length !== visibleStationIds.length ||
      next.some((id, index) => id !== visibleStationIds[index])
    if (hasChanged) {
      dispatch(setVisibleStationIds(next))
    }
  }, [data?.stations, visibleStationIds, dispatch, hasUrlStationsOverride])

  // Filter stations based on service filter and visibility
  const filteredStations = useMemo(() => {
    if (!stations.length) {
      return []
    }

    // If no stations are selected, show all stations. If stations are selected, show only those.
    let stationsToShow =
      shouldHideAllStations
        ? []
        : visibleStationIds.length > 0
          ? stations.filter((station) => visibleStationIds.includes(station.id))
          : stations

    if (serviceFilter === "grooming") {
      // Show only grooming stations
      stationsToShow = stationsToShow.filter(
        (station) => station.serviceType === "grooming"
      )
    } else if (serviceFilter === "garden") {
      // Show only garden stations (but they'll be handled by garden columns)
      stationsToShow = stationsToShow.filter(
        (station) => station.serviceType === "garden"
      )
    }
    // For "both", show all stations

    // Always filter out garden stations from regular station columns - they'll be handled by separate garden columns
    return stationsToShow.filter((station) => station.serviceType !== "garden")
  }, [stations, visibleStationIds, serviceFilter, shouldHideAllStations])

  // Calculate if we should show garden columns
  // Controlled purely by Redux state (showGardenColumn) from database settings
  const shouldShowGardenColumns = useMemo(() => {
    if (shouldHideAllStations) return false
    if (serviceFilter === "grooming") return false
    // Show garden column if enabled in database settings, regardless of appointments
    return showGardenColumn
  }, [serviceFilter, shouldHideAllStations, showGardenColumn])

  // Calculate column slots
  const gardenColumnCount = shouldShowGardenColumns ? 1 : 0
  const specialColumnCount =
    gardenColumnCount +
    (showWaitingListColumn ? 1 : 0) +
    (showPinnedAppointmentsColumn ? 1 : 0)
  const stationColumnSlots = Math.max(0, MAX_VISIBLE_STATIONS - specialColumnCount)

  // Manage station window
  useEffect(() => {
    const nextSlots =
      stationColumnSlots > 0
        ? Math.max(0, filteredStations.length - stationColumnSlots)
        : 0
    const next = Math.min(stationWindowStart, nextSlots)
    if (next !== stationWindowStart) {
      dispatch(setStationWindowStart(next))
    }
  }, [dispatch, filteredStations.length, stationColumnSlots, stationWindowStart])

  // Reset window start when service filter changes
  useEffect(() => {
    if (stationWindowStart !== 0) {
      dispatch(setStationWindowStart(0))
    }
  }, [dispatch, serviceFilter, stationWindowStart])

  // Compute visible stations window
  const visibleStationsWindow = useMemo(() => {
    if (!filteredStations.length || stationColumnSlots === 0) {
      return []
    }
    return filteredStations.slice(
      stationWindowStart,
      stationWindowStart + stationColumnSlots
    )
  }, [filteredStations, stationWindowStart, stationColumnSlots])

  return {
    stations,
    filteredStations,
    visibleStationsWindow,
    stationColumnSlots,
    gardenColumnCount,
    shouldShowGardenColumns,
  }
}
