import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
    useGetWorkersQuery,
    useManagerClockInWorkerMutation,
    useManagerClockOutWorkerMutation,
} from "@/store/services/supabaseApi"
import type { WorkerSummary } from "@/types/worker"
import { Clock, Loader2, PlayCircle, Square, Search, SquareStop } from "lucide-react"
import { cn } from "@/lib/utils"

const buildRangeStartFromPreset = (preset: "week" | "month" | "quarter" | "year"): string => {
    const now = new Date()
    const rangeStart = new Date(now)

    switch (preset) {
        case "week": {
            const day = rangeStart.getDay()
            const diff = day === 0 ? 0 : day
            rangeStart.setDate(rangeStart.getDate() - diff)
            break
        }
        case "month": {
            rangeStart.setDate(rangeStart.getDate() - 30)
            break
        }
        case "quarter": {
            rangeStart.setDate(rangeStart.getDate() - 90)
            break
        }
        case "year": {
            rangeStart.setDate(rangeStart.getDate() - 365)
            break
        }
        default:
            break
    }

    rangeStart.setHours(0, 0, 0, 0)
    return rangeStart.toISOString()
}

type StatusFilter = "all" | "working" | "paused"

export default function PresenceReportingTab() {
    const { toast } = useToast()
    const [processingWorkerId, setProcessingWorkerId] = useState<string | null>(null)
    const [isStoppingAll, setIsStoppingAll] = useState(false)
    const [nameFilter, setNameFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

    const {
        data: workersData,
        isLoading: isLoadingWorkers,
        refetch: refetchWorkers,
    } = useGetWorkersQuery({
        includeInactive: false,
        rangeStart: buildRangeStartFromPreset("week"),
        recentLimit: 5,
    })

    const [clockInWorker] = useManagerClockInWorkerMutation()
    const [clockOutWorker] = useManagerClockOutWorkerMutation()

    const workers = workersData?.workers ?? []
    const activeWorkers = workers.filter((w) => w.isActive)

    // Filter and sort workers
    const filteredAndSortedWorkers = useMemo(() => {
        let filtered = activeWorkers

        // Filter by name
        if (nameFilter.trim()) {
            const searchTerm = nameFilter.trim().toLowerCase()
            filtered = filtered.filter(
                (worker) =>
                    worker.fullName?.toLowerCase().includes(searchTerm) ||
                    worker.phoneNumber?.includes(searchTerm)
            )
        }

        // Filter by status
        if (statusFilter === "working") {
            filtered = filtered.filter((worker) => Boolean(worker.currentShift))
        } else if (statusFilter === "paused") {
            filtered = filtered.filter((worker) => !Boolean(worker.currentShift))
        }

        // Sort: working first, then by name
        return filtered.sort((a, b) => {
            const aHasShift = Boolean(a.currentShift)
            const bHasShift = Boolean(b.currentShift)
            if (aHasShift && !bHasShift) return -1
            if (!aHasShift && bHasShift) return 1
            return (a.fullName || "").localeCompare(b.fullName || "", "he")
        })
    }, [activeWorkers, nameFilter, statusFilter])

    const handleStartStopClick = async (worker: WorkerSummary) => {
        if (processingWorkerId) return

        const hasOpenShift = Boolean(worker.currentShift)
        setProcessingWorkerId(worker.id)

        try {
            if (hasOpenShift) {
                console.log("🛑 [PresenceReportingTab] Stopping shift for worker", { workerId: worker.id })
                await clockOutWorker({ workerId: worker.id }).unwrap()
                toast({
                    title: "משמרת נסגרה",
                    description: `המשמרת של ${worker.fullName || "העובד"} נסגרה בהצלחה.`,
                })
            } else {
                console.log("▶️ [PresenceReportingTab] Starting shift for worker", { workerId: worker.id })
                await clockInWorker({ workerId: worker.id }).unwrap()
                toast({
                    title: "משמרת נפתחה",
                    description: `המשמרת של ${worker.fullName || "העובד"} נפתחה בהצלחה.`,
                })
            }
            await refetchWorkers()
        } catch (error) {
            console.error("❌ [PresenceReportingTab] Failed to toggle shift", error)
            const errorMessage =
                error && typeof error === "object" && "data" in error && typeof error.data === "string"
                    ? error.data
                    : "נסה שוב או פנה לתמיכה."
            toast({
                title: hasOpenShift ? "לא ניתן לסגור את המשמרת" : "לא ניתן לפתוח את המשמרת",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setProcessingWorkerId(null)
        }
    }

    const handleStopAllShifts = async () => {
        const workersWithOpenShifts = activeWorkers.filter((w) => Boolean(w.currentShift))
        if (workersWithOpenShifts.length === 0) {
            toast({
                title: "אין משמרות פעילות",
                description: "אין עובדים עם משמרות פתוחות כרגע.",
            })
            return
        }

        setIsStoppingAll(true)

        try {
            console.log("🛑 [PresenceReportingTab] Stopping all shifts", {
                count: workersWithOpenShifts.length,
            })

            const promises = workersWithOpenShifts.map((worker) =>
                clockOutWorker({ workerId: worker.id }).unwrap()
            )

            await Promise.all(promises)

            toast({
                title: "כל המשמרות נסגרו",
                description: `${workersWithOpenShifts.length} משמרות נסגרו בהצלחה.`,
            })

            await refetchWorkers()
        } catch (error) {
            console.error("❌ [PresenceReportingTab] Failed to stop all shifts", error)
            toast({
                title: "שגיאה בסגירת משמרות",
                description: "חלק מהמשמרות לא נסגרו. נסה שוב.",
                variant: "destructive",
            })
        } finally {
            setIsStoppingAll(false)
        }
    }

    const workersWithOpenShifts = activeWorkers.filter((w) => Boolean(w.currentShift)).length

    return (
        <div className="flex flex-col gap-6 pt-12 px-1 sm:px-3 lg:px-6" dir="rtl">
            <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 text-right sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <Clock className="h-6 w-6 text-primary" />
                        דיווח נוכחות
                    </h1>
                    <p className="text-sm text-slate-600">
                        ניהול וצפייה במצב המשמרות של כל העובדים בזמן אמת.
                    </p>
                </div>
            </header>

            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="name-filter" className="text-sm text-slate-700">
                                חיפוש לפי שם או טלפון
                            </Label>
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    id="name-filter"
                                    value={nameFilter}
                                    onChange={(e) => setNameFilter(e.target.value)}
                                    placeholder="חפש עובד..."
                                    className="pr-10 text-right"
                                />
                            </div>
                        </div>
                        <div className="space-y-2 sm:w-48">
                            <Label htmlFor="status-filter" className="text-sm text-slate-700">
                                סינון לפי סטטוס
                            </Label>
                            <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                                <SelectTrigger id="status-filter" className="text-right">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="working">בעבודה</SelectItem>
                                    <SelectItem value="paused">לא בעבודה</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button
                        onClick={handleStopAllShifts}
                        variant="destructive"
                        size="sm"
                        disabled={isStoppingAll || workersWithOpenShifts === 0}
                        className="sm:w-auto"
                    >
                        {isStoppingAll ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                סוגר...
                            </>
                        ) : (
                            <>
                                <SquareStop className="ml-2 h-4 w-4" />
                                עצור כל המשמרות ({workersWithOpenShifts})
                            </>
                        )}
                    </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:font-semibold [&>th]:text-primary [&>th]:text-right">
                                <TableHead className="w-16 text-center">סטטוס</TableHead>
                                <TableHead>מצב נוכחי</TableHead>
                                <TableHead>שם</TableHead>
                                <TableHead>טלפון</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingWorkers ? (
                                [...Array(5)].map((_, idx) => (
                                    <TableRow key={`skeleton-${idx}`} className="border-b">
                                        <TableCell colSpan={4} className="text-center">
                                            <Skeleton className="h-12 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : filteredAndSortedWorkers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                                            <p className="font-medium">
                                                {nameFilter || statusFilter !== "all"
                                                    ? "לא נמצאו עובדים התואמים לסינון"
                                                    : "לא נמצאו עובדים פעילים"}
                                            </p>
                                            <p className="text-sm">
                                                {nameFilter || statusFilter !== "all"
                                                    ? "נסה לשנות את הסינון"
                                                    : "הוסף עובדים פעילים כדי לנהל את משמרותיהם."}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedWorkers.map((worker) => {
                                    const hasOpenShift = Boolean(worker.currentShift)
                                    const isWorkerProcessing = processingWorkerId === worker.id

                                    return (
                                        <TableRow
                                            key={worker.id}
                                            className={cn(
                                                "border-b transition-colors",
                                                hasOpenShift
                                                    ? "bg-amber-50/50 hover:bg-amber-50"
                                                    : "hover:bg-muted/40",
                                            )}
                                        >
                                            <TableCell className="text-center">
                                                {hasOpenShift ? (
                                                    <Button
                                                        onClick={() => handleStartStopClick(worker)}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                        disabled={isWorkerProcessing || isStoppingAll}
                                                        title="עצור משמרת"
                                                    >
                                                        {isWorkerProcessing ? (
                                                            <Loader2 className="h-5 w-5 animate-spin" />
                                                        ) : (
                                                            <Square className="h-5 w-5" />
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={() => handleStartStopClick(worker)}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-primary hover:bg-primary/10 hover:text-primary"
                                                        disabled={isWorkerProcessing || isStoppingAll}
                                                        title="התחל משמרת"
                                                    >
                                                        {isWorkerProcessing ? (
                                                            <Loader2 className="h-5 w-5 animate-spin" />
                                                        ) : (
                                                            <PlayCircle className="h-5 w-5" />
                                                        )}
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span
                                                    className={cn(
                                                        "text-sm font-medium",
                                                        hasOpenShift ? "text-amber-700" : "text-slate-600",
                                                    )}
                                                >
                                                    {hasOpenShift ? "משמרת פתוחה" : "לא במשמרת"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-sm font-semibold text-slate-900">
                                                    {worker.fullName || "עובד ללא שם"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-sm text-slate-600">
                                                    {worker.phoneNumber || "-"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    )
}

