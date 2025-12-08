import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setShowPinnedAppointmentsColumn,
  setShowWaitingListColumn,
  setShowGardenColumn,
  setVisibleStationIds,
  setStationOrderIds,
  setSelectedDate,
} from "@/store/slices/managerScheduleSlice"
import {
  EMPTY_STATIONS_OVERRIDE_PARAM,
} from "../constants"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"

/**
 * Hook to manage persistence of manager schedule state:
 * - localStorage sync for pinned/waiting list column visibility
 * - URL parameter sync for date, zoom and filter (but NOT stations)
 * - Stations are read from URL only if explicitly passed, otherwise use DB config
 */
export function useManagerSchedulePersistence() {
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const showPinnedAppointmentsColumn = useAppSelector((state) => state.managerSchedule.showPinnedAppointmentsColumn)
  const showWaitingListColumn = useAppSelector((state) => state.managerSchedule.showWaitingListColumn)
  const visibleStationIds = useAppSelector((state) => state.managerSchedule.visibleStationIds)
  const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
  const pixelsPerMinuteScale = useAppSelector((state) => state.managerSchedule.pixelsPerMinuteScale)
  const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)
  const hasInitializedRef = useRef(false)
  const lastInitializedDateRef = useRef<string | null>(null)
  const lastProcessedUrlStationsRef = useRef<string | null>(null)
  const lastInitializedSourceRef = useRef<"url" | "db" | null>(null)
  const dateInitializedRef = useRef(false)
  const lastUrlDateRef = useRef<string | null>(null)
  const lastReduxDateRef = useRef<string | null>(null)

  // Initialize date from URL - URL is always the source of truth on initialization
  // Also handle URL changes (browser back/forward)
  useEffect(() => {
    const dateParam = searchParams.get("date")
    const selectedDateObj = new Date(selectedDate)
    const currentDateStr = !isNaN(selectedDateObj.getTime()) ? format(selectedDateObj, "yyyy-MM-dd") : null
    
    // Track if URL date changed
    const urlDateChanged = dateParam !== lastUrlDateRef.current
    const reduxDateChanged = currentDateStr !== lastReduxDateRef.current
    
    if (dateParam) {
      const parsedDate = new Date(dateParam)
      if (!isNaN(parsedDate.getTime())) {
        const urlDateStr = format(parsedDate, "yyyy-MM-dd")
        
        // If URL date differs from Redux date and URL changed, update Redux to match URL
        // This handles both initial load and browser navigation
        if (urlDateStr !== currentDateStr && urlDateChanged) {
          console.log(`[DateSync] URL date changed to ${urlDateStr}, updating Redux from ${currentDateStr}`)
          dispatch(setSelectedDate(parsedDate.toISOString()))
          lastUrlDateRef.current = dateParam
          lastReduxDateRef.current = urlDateStr
          dateInitializedRef.current = true
        } else if (!dateInitializedRef.current) {
          // First initialization - just track the URL date
          lastUrlDateRef.current = dateParam
          lastReduxDateRef.current = urlDateStr
          dateInitializedRef.current = true
        } else if (!reduxDateChanged && urlDateStr === currentDateStr) {
          // Both are in sync, just update refs
          lastUrlDateRef.current = dateParam
          lastReduxDateRef.current = currentDateStr
        }
        return
      }
    }
    
    // No date in URL on first initialization - set URL to current Redux date
    if (!dateInitializedRef.current && currentDateStr) {
      console.log(`[DateSync] No URL date, setting URL to Redux date: ${currentDateStr}`)
      updateURLParams({ date: currentDateStr })
      lastUrlDateRef.current = currentDateStr
      lastReduxDateRef.current = currentDateStr
      dateInitializedRef.current = true
    } else if (dateParam === null && lastUrlDateRef.current !== null && currentDateStr) {
      // URL date was removed, sync current Redux date to URL
      console.log(`[DateSync] URL date removed, syncing Redux date to URL: ${currentDateStr}`)
      updateURLParams({ date: currentDateStr })
      lastUrlDateRef.current = currentDateStr
      lastReduxDateRef.current = currentDateStr
    }
  }, [searchParams, dispatch, selectedDate])

  // Initialize special items to false on mount
  // Note: Special items (garden, waiting list, pinned appointments) are NOT persisted
  // They default to false on every page load and can only be shown via query params or user interaction during the session
  useEffect(() => {
    dispatch(setShowPinnedAppointmentsColumn(false))
    dispatch(setShowWaitingListColumn(false))
    dispatch(setShowGardenColumn(false))
  }, [dispatch]) // Only run on mount

  // Initialize stations: use URL override if explicitly passed, otherwise load daily config from DB
  // Only react to date or URL changes so the view stays stable while on the page
  useEffect(() => {
    const stationsParam = searchParams.get("stations")
    const isEmptyOverride = stationsParam === EMPTY_STATIONS_OVERRIDE_PARAM
    const stationIdsFromUrl = !isEmptyOverride
      ? stationsParam
          ?.split(",")
          .filter(Boolean)
          .map((id) => decodeURIComponent(id)) ?? []
      : []
    const hasExplicitStationsParam = isEmptyOverride || stationIdsFromUrl.length > 0

    const dateChanged = lastInitializedDateRef.current !== selectedDate
    const urlChanged = lastProcessedUrlStationsRef.current !== stationsParam

    // Only use URL if it was explicitly passed in the URL
    if (hasExplicitStationsParam) {
      const shouldApplyUrl =
        !hasInitializedRef.current || lastInitializedSourceRef.current !== "url" || dateChanged || urlChanged

      if (shouldApplyUrl) {
        const nextStations = isEmptyOverride ? [] : stationIdsFromUrl
        dispatch(setVisibleStationIds(nextStations))
        dispatch(setStationOrderIds(nextStations))
        hasInitializedRef.current = true
        lastInitializedDateRef.current = selectedDate
        lastProcessedUrlStationsRef.current = stationsParam
        lastInitializedSourceRef.current = "url"
      }
      return
    }

    // No URL param: use DB config for the current weekday
    lastProcessedUrlStationsRef.current = null

    const alreadyLoadedDbForDate =
      hasInitializedRef.current && lastInitializedSourceRef.current === "db" && !dateChanged

    if (alreadyLoadedDbForDate) {
      return
    }

    const date = new Date(selectedDate)
    if (Number.isNaN(date.getTime())) {
      console.error("Invalid selected date for manager schedule:", selectedDate)
      return
    }

    const weekdayMap: Record<number, string> = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    }
    const weekday = weekdayMap[date.getDay()]

    const initializeFromDailyConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from("station_daily_configs")
          .select("visible_station_ids, station_order_ids")
          .eq("weekday", weekday)
          .maybeSingle()

        if (error) {
          console.error("Error fetching station daily config:", error)
          return
        }

        if (data) {
          // Set station visibility and order
          if (data.visible_station_ids && data.visible_station_ids.length > 0) {
            dispatch(setVisibleStationIds(data.visible_station_ids))
            if (data.station_order_ids && data.station_order_ids.length > 0) {
              dispatch(setStationOrderIds(data.station_order_ids))
            } else {
              dispatch(setStationOrderIds(data.visible_station_ids))
            }
          }
          // Note: Special items (garden, waiting list, pinned appointments) are no longer loaded from DB config
          // They can only be shown via query params
        }
        // If no config found, stations will default to all (handled by useManagerScheduleStations)
      } catch (error) {
        console.error("Error initializing stations from daily configs:", error)
      } finally {
        hasInitializedRef.current = true
        lastInitializedDateRef.current = selectedDate
        lastInitializedSourceRef.current = "db"
      }
    }

    initializeFromDailyConfigs()
  }, [selectedDate, searchParams, dispatch])

  // Note: Special items (garden, waiting list, pinned appointments) are NOT synced to localStorage
  // They are session-only and reset to false on every page reload

  // Functions to update URL parameters
  const updateURLParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    })

    setSearchParams(newParams, { replace: true })
  }

  // Note: We no longer sync stations to URL when they change manually
  // Stations are only read from URL if explicitly passed, otherwise use DB config

  // Update URL when selectedDate changes (but only if the change came from user action, not URL)
  useEffect(() => {
    if (!dateInitializedRef.current) {
      return
    }
    
    const selectedDateObj = new Date(selectedDate)
    if (isNaN(selectedDateObj.getTime())) {
      return
    }
    
    const currentDateStr = format(selectedDateObj, "yyyy-MM-dd")
    const urlDateStr = searchParams.get("date")
    const reduxDateChanged = currentDateStr !== lastReduxDateRef.current
    
    // Only sync to URL if Redux date changed and differs from URL date
    // This means the user changed the date, not the URL
    if (reduxDateChanged && urlDateStr !== currentDateStr) {
      console.log(`[DateSync] Redux date changed to ${currentDateStr}, updating URL from ${urlDateStr || 'none'}`)
      // Remove highlightAppointment when date changes
      updateURLParams({ date: currentDateStr, highlightAppointment: null })
      lastUrlDateRef.current = currentDateStr
      lastReduxDateRef.current = currentDateStr
    } else if (reduxDateChanged && urlDateStr === currentDateStr) {
      // Redux changed but matches URL - just update ref
      lastReduxDateRef.current = currentDateStr
    }
  }, [selectedDate, searchParams, setSearchParams])

  // Update URL when pixelsPerMinuteScale changes
  useEffect(() => {
    updateURLParams({ zoom: pixelsPerMinuteScale.toString() })
  }, [pixelsPerMinuteScale, searchParams, setSearchParams])

  // Update URL when serviceFilter changes
  useEffect(() => {
    if (serviceFilter !== "both") {
      updateURLParams({ filter: serviceFilter })
    } else {
      updateURLParams({ filter: null })
    }
  }, [serviceFilter, searchParams, setSearchParams])
}
