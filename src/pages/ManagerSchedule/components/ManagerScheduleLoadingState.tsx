import { useMemo, useEffect, useState, useRef } from "react"
import { useAppSelector } from "@/store/hooks"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { getErrorMessage, getManagerScheduleSnapshot, INITIAL_LOADER_DELAY_MS, setManagerScheduleSnapshot } from "../managerSchedule.module"
import type { ManagerScheduleData } from "../types"

export function ManagerScheduleLoadingState() {
    const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
    const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
    const formattedDate = format(selectedDate, "yyyy-MM-dd")
    const visibleStationIds = useAppSelector((state) => state.managerSchedule.visibleStationIds)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const snapshotKey = useMemo(() => `date:${formattedDate}`, [formattedDate])
    const initialSnapshot = useMemo(() => getManagerScheduleSnapshot(snapshotKey), [snapshotKey])
    const [displayData, setDisplayData] = useState<ManagerScheduleData | null>(initialSnapshot)
    const [hasLoadedInitialData, setHasLoadedInitialData] = useState(() => initialSnapshot !== null)
    const [showInitialLoader, setShowInitialLoader] = useState(false)
    const initialLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { data: apiData, error, isLoading } = useGetManagerScheduleQuery({
        date: formattedDate,
        serviceType: "both",
    })

    const scheduleErrorMessage = useMemo(() => getErrorMessage(error), [error])

    useEffect(() => {
        if (apiData) {
            setDisplayData(apiData)
            setManagerScheduleSnapshot(snapshotKey, apiData)
        }
    }, [apiData, snapshotKey])

    const data = displayData

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
        }

        if (!isLoading && data && !hasLoadedInitialData) {
            setHasLoadedInitialData(true)
        }
    }, [isLoading, data, hasLoadedInitialData, showInitialLoader])

    // Compute filtered stations
    const stations = useMemo(() => data?.stations ?? [], [data?.stations])
    const filteredStations = useMemo(() => {
        if (!stations.length) {
            return []
        }

        let stationsToShow = visibleStationIds.length > 0
            ? stations.filter((station) => visibleStationIds.includes(station.id))
            : stations

        if (serviceFilter === "grooming") {
            stationsToShow = stationsToShow.filter(station => station.serviceType === "grooming")
        }

        return stationsToShow
    }, [stations, visibleStationIds, serviceFilter])


    const isInitialLoading = !hasLoadedInitialData && (isLoading || !data)
    const shouldShowInitialError = !hasLoadedInitialData && !!error && !isLoading
    const shouldShowInitialLoader = isInitialLoading && showInitialLoader && !shouldShowInitialError

    if (shouldShowInitialError) {
        return (
            <Alert variant="destructive" className="border border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>שגיאה בטעינת הלוח</AlertTitle>
                <AlertDescription>{scheduleErrorMessage}</AlertDescription>
            </Alert>
        )
    }

    if (shouldShowInitialLoader) {
        return (
            <div
                className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm"
                aria-busy="true"
                aria-live="polite"
            >
                <div className="flex w-full max-w-3xl flex-col gap-4 px-10 py-8">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col items-end gap-2 text-right">
                            <span className="text-base font-semibold text-gray-900">מכין את לוח הניהול...</span>
                            <span className="text-sm text-gray-500">טוען את העמדות, התורים וההגדרות המעודכנות.</span>
                        </div>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                    <div className="grid grid-cols-6 gap-3">
                        <div className="col-span-6 h-3 rounded-full bg-slate-100 animate-pulse" />
                        <div className="col-span-2 h-24 rounded-lg bg-slate-50 animate-pulse" />
                        <div className="col-span-2 h-24 rounded-lg bg-slate-50 animate-pulse" />
                        <div className="col-span-2 h-24 rounded-lg bg-slate-50 animate-pulse" />
                        <div className="col-span-6 h-3 rounded-full bg-slate-100 animate-pulse" />
                        <div className="col-span-6 h-3 rounded-full bg-slate-100 animate-pulse" />
                    </div>
                </div>
            </div>
        )
    }

    if (isInitialLoading) {
        return <div className="h-64 rounded-lg border border-transparent" aria-hidden="true" />
    }

    if (error) {
        return (
            <Alert variant="destructive" className="border border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle>שגיאה בטעינת הלוח</AlertTitle>
                <AlertDescription>{scheduleErrorMessage}</AlertDescription>
            </Alert>
        )
    }

    if (!filteredStations.length) {
        return (
            <Alert className="border border-amber-200 bg-amber-50">
                <AlertTitle>אין עמדות להצגה</AlertTitle>
                <AlertDescription>
                    בחר עמדות להצגה או בדוק אם קיימות עמדות פעילות עבור התאריך והשירות שנבחרו.
                </AlertDescription>
            </Alert>
        )
    }

    return null
}
