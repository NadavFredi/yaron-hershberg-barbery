import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import { Clock, Loader2, RefreshCw, CalendarIcon, UserCog } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Highcharts from "highcharts"
import HighchartsReact from "highcharts-react-official"
import { formatDurationFromMinutes, formatDurationForChart, getDurationLabel } from "@/lib/duration-utils"
import { ChartDetailModal } from "@/components/reports/ChartDetailModal"
import { MultiSelectDropdown } from "@/components/settings/SettingsBreedStationMatrixSection/components/MultiSelectDropdown"

interface EmployeeShiftData {
    employeeId: string
    employeeName: string
    totalShifts: number
    totalHours: number // minutes
    shiftsByDate: Array<{ date: string; shifts: number; totalDuration: number }>
}

interface ShiftsData {
    totalShifts: number
    totalHours: number
    byEmployee: EmployeeShiftData[]
    uniqueDates: string[]
}

interface RawShift {
    id: string
    worker_id: string
    clock_in: string
    clock_out: string
    worker?: {
        id: string
        full_name: string
    }
}

export default function EmployeeShiftsReport() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [shiftsData, setShiftsData] = useState<ShiftsData | null>(null)
    const initialStartDate = useMemo(() => subDays(new Date(), 30), [])
    const initialEndDate = useMemo(() => new Date(), [])
    const [startDate, setStartDate] = useState<Date | null>(initialStartDate)
    const [endDate, setEndDate] = useState<Date | null>(initialEndDate)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialStartDate,
        to: initialEndDate,
    })
    const [lineChartViewMode, setLineChartViewMode] = useState<"shifts" | "duration">("shifts")
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [detailModalData, setDetailModalData] = useState<RawShift[]>([])
    const [detailModalTitle, setDetailModalTitle] = useState("")
    const [detailModalDescription, setDetailModalDescription] = useState("")
    const [rawShifts, setRawShifts] = useState<RawShift[]>([])
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([])
    const [workerStatusFilter, setWorkerStatusFilter] = useState<"all" | "active" | "inactive">("all")
    const [workers, setWorkers] = useState<Array<{ id: string; name: string; isActive: boolean }>>([])
    const [isLoadingWorkers, setIsLoadingWorkers] = useState(false)

    useEffect(() => {
        setDateRange({
            from: startDate ?? undefined,
            to: endDate ?? undefined,
        })
    }, [startDate, endDate])

    const dateRangeLabel = useMemo(() => {
        if (!dateRange?.from && !dateRange?.to) {
            return "בחר טווח תאריכים"
        }
        const fromLabel = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : ""
        const toLabel = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : fromLabel
        return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`
    }, [dateRange])

    const handleRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range)
        setStartDate(range?.from ?? null)
        setEndDate(range?.to ?? range?.from ?? null)
    }

    const fetchShiftsData = useCallback(async () => {
        setIsLoading(true)
        try {
            const fromIso = startDate ? startOfDay(startDate).toISOString() : undefined
            const toIso = endDate ? endOfDay(endDate).toISOString() : undefined

            // First, get worker IDs based on status filter if needed
            let workerIdsByStatus: string[] | null = null
            if (workerStatusFilter !== "all") {
                const { data: workersData } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("role", "worker")
                    .eq("worker_is_active", workerStatusFilter === "active")
                
                if (workersData) {
                    workerIdsByStatus = workersData.map((w: any) => w.id)
                    // If no workers match the status, return empty result
                    if (workerIdsByStatus.length === 0) {
                        setShiftsData({
                            totalShifts: 0,
                            totalHours: 0,
                            byEmployee: [],
                            uniqueDates: [],
                        })
                        setRawShifts([])
                        setIsLoading(false)
                        return
                    }
                }
            }

            // Combine worker filters
            let finalWorkerIds: string[] | null = null
            if (selectedWorkerIds.length > 0 && workerIdsByStatus) {
                // Intersect selected workers with status filter
                finalWorkerIds = selectedWorkerIds.filter((id) => workerIdsByStatus!.includes(id))
                if (finalWorkerIds.length === 0) {
                    setShiftsData({
                        totalShifts: 0,
                        totalHours: 0,
                        byEmployee: [],
                        uniqueDates: [],
                    })
                    setRawShifts([])
                    setIsLoading(false)
                    return
                }
            } else if (selectedWorkerIds.length > 0) {
                finalWorkerIds = selectedWorkerIds
            } else if (workerIdsByStatus) {
                finalWorkerIds = workerIdsByStatus
            }

            // Build worker filter query
            let shiftsQuery = supabase
                .from("worker_attendance_logs")
                .select(`
                    id,
                    worker_id,
                    clock_in,
                    clock_out,
                    worker:worker_id!inner (
                        id,
                        full_name,
                        worker_is_active
                    )
                `)
                .gte("clock_in", fromIso || "")
                .lte("clock_in", toIso || "")

            // Apply worker filter
            if (finalWorkerIds) {
                shiftsQuery = shiftsQuery.in("worker_id", finalWorkerIds)
            }

            const { data: shifts, error: shiftsError } = await shiftsQuery.order("clock_in", { ascending: false })

            if (shiftsError) {
                throw shiftsError
            }

            // Aggregate data
            const employeeMap: Record<string, EmployeeShiftData> = {}
            const allDatesSet = new Set<string>()

            shifts?.forEach((shift: any) => {
                const employeeId = shift.worker_id
                const employeeName = shift.worker?.full_name || "עובד לא מזוהה"
                
                // Calculate duration from clock_in and clock_out
                let duration = 0
                if (shift.clock_in && shift.clock_out) {
                    const start = new Date(shift.clock_in)
                    const end = new Date(shift.clock_out)
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                        duration = Math.round((end.getTime() - start.getTime()) / 60000)
                    }
                }

                if (!employeeMap[employeeId]) {
                    employeeMap[employeeId] = {
                        employeeId,
                        employeeName,
                        totalShifts: 0,
                        totalHours: 0,
                        shiftsByDate: [],
                    }
                }

                employeeMap[employeeId].totalShifts += 1
                employeeMap[employeeId].totalHours += duration

                const dateKey = format(new Date(shift.clock_in), "yyyy-MM-dd")
                const dateLabel = format(new Date(shift.clock_in), "dd/MM")
                allDatesSet.add(dateKey)

                // Find or create entry for this date
                let dateEntry = employeeMap[employeeId].shiftsByDate.find((d) => d.date === dateLabel)
                if (!dateEntry) {
                    dateEntry = { date: dateLabel, shifts: 0, totalDuration: 0 }
                    employeeMap[employeeId].shiftsByDate.push(dateEntry)
                }
                dateEntry.shifts += 1
                dateEntry.totalDuration += duration
            })

            // Sort shifts by date for each employee
            Object.values(employeeMap).forEach((emp) => {
                emp.shiftsByDate.sort((a, b) => {
                    const dateA = new Date(a.date.split("/").reverse().join("-"))
                    const dateB = new Date(b.date.split("/").reverse().join("-"))
                    return dateA.getTime() - dateB.getTime()
                })
            })

            // Get all unique dates sorted
            const uniqueDates = Array.from(allDatesSet)
                .sort()
                .map((date) => format(new Date(date), "dd/MM"))

            const totalShifts = shifts?.length || 0
            const totalHours = Object.values(employeeMap).reduce((sum, emp) => sum + emp.totalHours, 0)

            // Store raw shifts for detail modal
            setRawShifts(shifts || [])

            setShiftsData({
                totalShifts,
                totalHours,
                byEmployee: Object.values(employeeMap).sort((a, b) => b.totalHours - a.totalHours),
                uniqueDates,
            })
        } catch (error) {
            console.error("Failed to fetch shifts data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לטעון נתוני משמרות. ודא שיש טבלת worker_attendance במערכת.",
                variant: "destructive",
            })
            // Set empty data on error
            setShiftsData({
                totalShifts: 0,
                totalHours: 0,
                byEmployee: [],
                uniqueDates: [],
            })
        } finally {
            setIsLoading(false)
        }
    }, [startDate, endDate, selectedWorkerIds, workerStatusFilter, toast])

    // Fetch workers list (from profiles table)
    const fetchWorkers = useCallback(async () => {
        setIsLoadingWorkers(true)
        try {
            const { data: workersData, error } = await supabase
                .from("profiles")
                .select("id, full_name, worker_is_active")
                .eq("role", "worker")
                .order("full_name", { ascending: true })

            if (error) {
                console.error("Failed to fetch workers:", error)
                return
            }

            setWorkers(
                (workersData || []).map((w: any) => ({
                    id: w.id,
                    name: w.full_name || "עובד לא מזוהה",
                    isActive: w.worker_is_active ?? true,
                }))
            )
        } catch (error) {
            console.error("Failed to fetch workers:", error)
        } finally {
            setIsLoadingWorkers(false)
        }
    }, [])

    useEffect(() => {
        fetchWorkers()
    }, [fetchWorkers])

    useEffect(() => {
        fetchShiftsData()
    }, [fetchShiftsData])

    // Helper function to format duration as "x hours, n minutes"
    const formatDurationHoursMinutes = (minutes: number): string => {
        if (isNaN(minutes) || minutes < 0) return "0 דקות"
        if (minutes < 60) {
            return `${Math.round(minutes)} דקות`
        }
        const hours = Math.floor(minutes / 60)
        const mins = Math.round(minutes % 60)
        if (mins === 0) {
            return `${hours} שעות`
        }
        return `${hours} שעות, ${mins} דקות`
    }

    // Helper function to format duration for chart labels (rounded to 2 decimals in hours)
    const formatDurationForChartLabel = (minutes: number): string => {
        if (isNaN(minutes) || minutes < 0) return "0 דקות"
        if (minutes < 60) {
            return `${Math.round(minutes)} דקות`
        }
        const hours = minutes / 60
        const roundedHours = Math.round(hours * 100) / 100
        const hoursInt = Math.floor(roundedHours)
        const minutesRemainder = Math.round((roundedHours - hoursInt) * 60)
        
        if (minutesRemainder === 0) {
            return `${hoursInt} שעות`
        }
        return `${hoursInt} שעות, ${minutesRemainder} דקות`
    }

    const handleEmployeeClick = (employeeName: string) => {
        if (!rawShifts) return
        const filtered = rawShifts.filter((shift) => shift.worker?.full_name === employeeName)
        setDetailModalTitle(`פרטי משמרות - ${employeeName}`)
        setDetailModalDescription(`סה"כ ${filtered.length} משמרות`)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    const handleDateEmployeeClick = (employeeName: string, date: string) => {
        if (!rawShifts) return
        // Convert dd/MM to match format used in shifts
        const dateLabel = date // Already in dd/MM format
        
        const filtered = rawShifts.filter((shift) => {
            const shiftDateLabel = format(new Date(shift.clock_in), "dd/MM")
            return shift.worker?.full_name === employeeName && shiftDateLabel === dateLabel
        })
        setDetailModalTitle(`פרטי משמרות - ${employeeName} - ${date}`)
        setDetailModalDescription(`סה"כ ${filtered.length} משמרות`)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Clock className="h-7 w-7 text-primary" />
                    דוח משמרות עובדים
                </h1>
                <p className="text-slate-600">ניתוח מפורט של משמרות ושעות עבודה</p>
            </div>

            <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>מסננים</CardTitle>
                        <Button onClick={fetchShiftsData} disabled={isLoading} variant="outline" size="sm">
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                    טוען...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 ml-2" />
                                    רענון
                                </>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>טווח תאריכים</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between text-right font-normal">
                                        <span>{dateRangeLabel}</span>
                                        <CalendarIcon className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                        initialFocus
                                        mode="range"
                                        numberOfMonths={2}
                                        dir="rtl"
                                        selected={dateRange}
                                        onSelect={handleRangeSelect}
                                        defaultMonth={dateRange?.from ?? new Date()}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>עובדים</Label>
                            {isLoadingWorkers ? (
                                <div className="flex items-center justify-center h-10 text-sm text-slate-500">
                                    טוען עובדים...
                                </div>
                            ) : (
                                <MultiSelectDropdown
                                    options={workers.map((w) => ({ id: w.id, name: w.name }))}
                                    selectedIds={selectedWorkerIds}
                                    onSelectionChange={setSelectedWorkerIds}
                                    placeholder="בחר עובדים..."
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>סטטוס עובד</Label>
                            <Select value={workerStatusFilter} onValueChange={(v) => setWorkerStatusFilter(v as "all" | "active" | "inactive")}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">כל העובדים</SelectItem>
                                    <SelectItem value="active">עובדים פעילים</SelectItem>
                                    <SelectItem value="inactive">עובדים לא פעילים</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {shiftsData && (
                <>
                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card 
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                                setDetailModalTitle("כל המשמרות")
                                setDetailModalDescription(`סה"כ ${rawShifts.length} משמרות`)
                                setDetailModalData(rawShifts)
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>סה"כ משמרות</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-600">{shiftsData.totalShifts}</div>
                            </CardContent>
                        </Card>

                        <Card 
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                                setDetailModalTitle("כל המשמרות")
                                setDetailModalDescription(`סה"כ ${rawShifts.length} משמרות`)
                                setDetailModalData(rawShifts)
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>סה"כ שעות</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-emerald-600">
                                    {formatDurationFromMinutes(shiftsData.totalHours)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Total Time Per Worker Bar Chart */}
                    {shiftsData.byEmployee.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>סה"כ זמן לעובד</CardTitle>
                                <CardDescription>סה"כ שעות עבודה לכל עובד בתקופה הנבחרת</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96">
                                    <HighchartsReact
                                        highcharts={Highcharts}
                                        options={{
                                            chart: {
                                                type: "column",
                                                backgroundColor: "transparent",
                                                style: {
                                                    fontFamily: "inherit",
                                                },
                                            },
                                            title: { text: null },
                                            xAxis: {
                                                categories: shiftsData.byEmployee.map((e) => e.employeeName),
                                                labels: {
                                                    style: {
                                                        fontSize: "13px",
                                                        fontWeight: "500",
                                                    },
                                                },
                                            },
                                            yAxis: {
                                                title: {
                                                    text: "סה״כ שעות",
                                                    style: { fontSize: "13px", fontWeight: "600" },
                                                },
                                                labels: {
                                                    formatter: function (this: any) {
                                                        return formatDurationForChartLabel(this.value * 60)
                                                    },
                                                    style: { fontSize: "12px" },
                                                },
                                            },
                                            tooltip: {
                                                useHTML: true,
                                                formatter: function (this: any) {
                                                    const employee = shiftsData.byEmployee.find((e) => e.employeeName === this.x)
                                                    if (employee) {
                                                        return `<div style="font-weight: 600; margin-bottom: 8px;">${this.x}</div>
                                                            <div style="margin: 4px 0;">
                                                                <span style="color: ${this.color}">●</span>
                                                                <span style="font-weight: 500;">סה״כ שעות:</span>
                                                                <span style="font-weight: 600; margin-right: 8px;">${formatDurationHoursMinutes(employee.totalHours)}</span>
                                                            </div>
                                                            <div style="margin: 4px 0;">
                                                                <span style="font-weight: 500;">סה״כ משמרות:</span>
                                                                <span style="font-weight: 600; margin-right: 8px;">${employee.totalShifts}</span>
                                                            </div>`
                                                    }
                                                    return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                                        <div><span style="color: ${this.color}">●</span> סה״כ שעות: <strong>${formatDurationHoursMinutes(this.y * 60)}</strong></div>`
                                                },
                                            },
                                            legend: { enabled: false },
                                            plotOptions: {
                                                column: {
                                                    dataLabels: {
                                                        enabled: true,
                                                        formatter: function (this: any) {
                                                            return formatDurationForChartLabel(this.y * 60)
                                                        },
                                                        style: { fontSize: "12px", fontWeight: "600" },
                                                    },
                                                    borderRadius: 4,
                                                    colorByPoint: true,
                                                    cursor: "pointer",
                                                    point: {
                                                        events: {
                                                            click: function (this: any) {
                                                                handleEmployeeClick(this.category)
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            colors: [
                                                "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
                                                "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
                                            ],
                                            series: [
                                                {
                                                    name: "סה״כ שעות",
                                                    data: shiftsData.byEmployee.map((e) => formatDurationForChart(e.totalHours)),
                                                },
                                            ],
                                            credits: { enabled: false },
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Line Chart Per Employee Per Day */}
                    {shiftsData.byEmployee.length > 0 && shiftsData.uniqueDates.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>ניתוח לפי עובד ותאריך</CardTitle>
                                        <CardDescription>קו נפרד לכל עובד - בחר מה להציג</CardDescription>
                                    </div>
                                    <div className="w-48">
                                        <Select value={lineChartViewMode} onValueChange={(v) => setLineChartViewMode(v as "shifts" | "duration")}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="shifts">לפי כמות משמרות</SelectItem>
                                                <SelectItem value="duration">לפי משך משמרת (יום)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96">
                                    <HighchartsReact
                                        highcharts={Highcharts}
                                        options={(() => {
                                            const yAxisTitle = lineChartViewMode === "shifts" ? "כמות משמרות" : "משך משמרת"
                                            
                                            // Generate colors for employees
                                            const colors = [
                                                "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
                                                "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
                                            ]

                                            const series = shiftsData.byEmployee.map((employee, index) => {
                                                const data = shiftsData.uniqueDates.map((date) => {
                                                    const dateEntry = employee.shiftsByDate.find((d) => d.date === date)
                                                    if (!dateEntry) return 0
                                                    
                                                    if (lineChartViewMode === "shifts") {
                                                        return dateEntry.shifts
                                                    } else {
                                                        // Duration per day (total duration for that day)
                                                        return formatDurationForChart(dateEntry.totalDuration)
                                                    }
                                                })
                                                
                                                return {
                                                    name: employee.employeeName,
                                                    data,
                                                    color: colors[index % colors.length],
                                                }
                                            })

                                            return {
                                                chart: {
                                                    type: "line",
                                                    backgroundColor: "transparent",
                                                    style: { fontFamily: "inherit" },
                                                },
                                                title: { text: null },
                                                xAxis: {
                                                    categories: shiftsData.uniqueDates,
                                                    labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                                },
                                                yAxis: {
                                                    title: {
                                                        text: yAxisTitle,
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    labels: {
                                                        formatter: function (this: any) {
                                                            if (lineChartViewMode === "duration") {
                                                                return formatDurationForChartLabel(this.value * 60)
                                                            }
                                                            return this.value.toLocaleString("he-IL")
                                                        },
                                                        style: { fontSize: "12px" },
                                                    },
                                                },
                                                tooltip: {
                                                    shared: true,
                                                    useHTML: true,
                                                    formatter: function (this: any) {
                                                        let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${this.x}</div>`
                                                        this.points?.forEach((point: any) => {
                                                            if (point.y > 0) {
                                                                let value = point.y
                                                                if (lineChartViewMode === "duration") {
                                                                    value = formatDurationForChartLabel(value * 60)
                                                                } else {
                                                                    value = `${value} משמרות`
                                                                }
                                                                tooltip += `<div style="margin: 4px 0;">
                                                                    <span style="color: ${point.color}">●</span>
                                                                    <span style="font-weight: 500;">${point.series.name}:</span>
                                                                    <span style="font-weight: 600; margin-right: 8px;">${value}</span>
                                                                </div>`
                                                            }
                                                        })
                                                        return tooltip
                                                    },
                                                },
                                                legend: {
                                                    enabled: true,
                                                    align: "center",
                                                    verticalAlign: "bottom",
                                                    itemStyle: { fontSize: "13px", fontWeight: "500" },
                                                    margin: 30,
                                                    padding: 15,
                                                    itemMarginBottom: 10,
                                                },
                                                plotOptions: {
                                                    line: {
                                                        marker: {
                                                            radius: 4,
                                                            lineWidth: 2,
                                                        },
                                                        lineWidth: 3,
                                                        cursor: "pointer",
                                                        point: {
                                                            events: {
                                                                click: function (this: any) {
                                                                    const point = this
                                                                    const series = point.series
                                                                    const employeeName = series.name
                                                                    const date = point.category
                                                                    handleDateEmployeeClick(employeeName, date)
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series,
                                                credits: { enabled: false },
                                            }
                                        })()}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {shiftsData.totalShifts === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-slate-500">אין נתוני משמרות זמינים</p>
                                <p className="text-sm text-slate-400 mt-2">
                                    ודא שיש טבלת worker_attendance_logs במערכת ושהיא מכילה נתונים
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            <ChartDetailModal
                open={detailModalOpen}
                onOpenChange={setDetailModalOpen}
                title={detailModalTitle}
                description={detailModalDescription}
                data={detailModalData}
                columns={[
                    {
                        key: "clock_in",
                        label: "כניסה",
                        render: (value) => format(new Date(value), "dd/MM/yyyy HH:mm"),
                    },
                    {
                        key: "clock_out",
                        label: "יציאה",
                        render: (value) => value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "לא יצא",
                    },
                    {
                        key: "worker",
                        label: "עובד",
                        render: (value) => value?.full_name || "עובד לא מזוהה",
                    },
                    {
                        key: "duration",
                        label: "משך",
                        render: (value, item) => {
                            if (!item.clock_in || !item.clock_out) return "לא זמין"
                            const start = new Date(item.clock_in)
                            const end = new Date(item.clock_out)
                            if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return "לא תקין"
                            const duration = Math.round((end.getTime() - start.getTime()) / 60000)
                            return formatDurationHoursMinutes(duration)
                        },
                    },
                ]}
            />
        </div>
    )
}


