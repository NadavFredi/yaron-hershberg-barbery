import { useCallback, useEffect, useMemo, useState } from "react"
import { endOfDay, format, startOfDay, subDays } from "date-fns"
import { Calendar, Loader2, RefreshCw, CalendarIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Highcharts from "highcharts"
import HighchartsReact from "highcharts-react-official"
import { useStations } from "@/hooks/useStations"
import { MultiSelectDropdown } from "@/components/settings/SettingsBreedStationMatrixSection/components/MultiSelectDropdown"
import { formatDurationFromMinutes, formatDurationForChart, getDurationLabel } from "@/lib/duration-utils"
import { ChartDetailModal } from "@/components/reports/ChartDetailModal"

interface StationStats {
    stationId: string
    stationName: string
    totalAppointments: number
    activeHours: number // minutes
    inactiveHours: number // minutes
    totalHours: number // minutes
    totalWorth: number
    totalPaid: number
}

interface AppointmentsData {
    totalAppointments: number
    totalActiveHours: number
    totalWorth: number
    totalPaid: number
    grooming: {
        totalAppointments: number
        totalActiveHours: number
        totalWorth: number
        totalPaid: number
        cartItemsWorth: number
    }
    garden: {
        totalAppointments: number
        totalActiveHours: number
        totalWorth: number
        totalPaid: number
    }
    byStation: StationStats[]
    byDate: Array<{ date: string; count: number; activeHours: number; worth: number; paid: number }>
    byCreationDate: Array<{ date: string; count: number }>
    byModifyDate: Array<{ date: string; count: number }>
    byStationByDate: Array<{
        stationId: string
        stationName: string
        date: string
        count: number
        worth: number
        paid: number
        activeHours: number
    }>
    byGardenByDate: Array<{
        date: string
        serviceType: string
        count: number
        worth: number
        paid: number
    }>
    byGardenServiceType: Array<{
        serviceType: string
        count: number
    }>
    allAppointments: Array<{
        id: string
        start_at: string
        end_at: string
        created_at: string
        updated_at: string
        stationName: string
        stationId: string
        amount_due: number
        paid: number
        durationMinutes: number
        serviceType: string
        sourceTable: string
        customerName?: string
    }>
}

export default function AppointmentsReport() {
    const { toast } = useToast()
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [appointmentsData, setAppointmentsData] = useState<AppointmentsData | null>(null)
    const initialStartDate = useMemo(() => subDays(new Date(), 30), [])
    const initialEndDate = useMemo(() => new Date(), [])
    const [startDate, setStartDate] = useState<Date | null>(initialStartDate)
    const [endDate, setEndDate] = useState<Date | null>(initialEndDate)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialStartDate,
        to: initialEndDate,
    })
    // No service filter needed - only grooming in barbershop
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    const { data: stations = [], isLoading: isLoadingStations } = useStations()
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [detailModalData, setDetailModalData] = useState<any[]>([])
    const [detailModalTitle, setDetailModalTitle] = useState("")
    const [detailModalDescription, setDetailModalDescription] = useState("")
    const [stationByDateViewMode, setStationByDateViewMode] = useState<"count" | "worth" | "time" | "paid">("count")

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

    const fetchAppointmentsData = useCallback(async () => {
        setIsLoading(true)
        try {
            const fromIso = startDate ? startOfDay(startDate).toISOString() : undefined
            const toIso = endDate ? endOfDay(endDate).toISOString() : undefined

            // Only fetch grooming appointments (no daycare in barbershop)
            const groomingPromise = supabase
                .from("grooming_appointments")
                .select(
                    `
                      id,
                      start_at,
                      end_at,
                      created_at,
                      updated_at,
                      status,
                      station_id,
                      amount_due,
                      customer_id,
                      stations (
                          id,
                          name
                      ),
                      customers (
                          id,
                          full_name
                      )
                  `
                )
                .gte("start_at", fromIso || "")
                .lte("start_at", toIso || "")

            const groomingResult = await groomingPromise

            if (groomingResult.error) {
                throw groomingResult.error
            }

            let allAppointments = (groomingResult.data || []).map((apt: any) => ({ ...apt, serviceType: "grooming", sourceTable: "grooming_appointments" }))

            // Filter by stations - only filter if stations are selected
            // If no stations selected, show all appointments grouped by their actual stations
            if (selectedStationIds.length > 0) {
                allAppointments = allAppointments.filter((apt: any) => {
                    // Convert station_id to string for comparison
                    const aptStationId = apt.station_id ? String(apt.station_id) : null
                    // Check if this appointment's station is in the selected list
                    return aptStationId ? selectedStationIds.includes(aptStationId) : false
                })
            }

            // Fetch actual payments for appointments (only grooming in barbershop)
            const appointmentIds = allAppointments.map((apt: any) => apt.id)
            const paymentMap: Record<string, number> = {}

            if (appointmentIds.length > 0) {
                const { data: paymentData } = await supabase
                    .from("appointment_payments")
                    .select("grooming_appointment_id, amount")
                    .in("grooming_appointment_id", appointmentIds)

                if (paymentData) {
                    paymentData.forEach((payment: any) => {
                        const aptId = payment.grooming_appointment_id
                        if (aptId) {
                            paymentMap[aptId] = (paymentMap[aptId] || 0) + Number(payment.amount || 0)
                        }
                    })
                }
            }

            // Calculate station working hours (assuming 8 hours per day for simplicity)
            const daysDiff = Math.ceil(
                ((endDate?.getTime() || Date.now()) - (startDate?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)
            )
            const totalAvailableMinutes = daysDiff * 8 * 60 // 8 hours per day

            // Aggregate by station (only for grooming - gardens don't have stations)
            const stationMap: Record<string, StationStats> = {}
            const byDateMap: Record<string, { count: number; activeHours: number; worth: number; paid: number }> = {}
            const byCreationDateMap: Record<string, number> = {}
            const byModifyDateMap: Record<string, number> = {}
            const byStationByDateMap: Record<string, Record<string, { count: number; worth: number; paid: number; activeHours: number }>> = {}
            const enrichedAppointments: AppointmentsData["allAppointments"] = []

            // Stats for grooming (only service in barbershop)
            const groomingStats = {
                totalAppointments: 0,
                totalActiveHours: 0,
                totalWorth: 0,
                totalPaid: 0,
                cartItemsWorth: 0,
            }

            allAppointments.forEach((apt: any) => {
                // Calculate amount due (no dogs/breeds in barbershop)
                const amountDue = apt.amount_due ? Number(apt.amount_due) : 0
                const paid = paymentMap[apt.id] || 0

                // Calculate appointment duration
                let durationMinutes = 0
                try {
                    const start = new Date(apt.start_at)
                    const end = new Date(apt.end_at)
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                        durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
                    }
                } catch (e) {
                    // Ignore invalid dates
                }

                // Update service-specific stats (only grooming in barbershop)
                groomingStats.totalAppointments += 1
                groomingStats.totalActiveHours += durationMinutes
                groomingStats.totalWorth += amountDue
                groomingStats.totalPaid += paid

                // Group by station (only grooming in barbershop)
                const stationId = apt.station_id ? String(apt.station_id) : "no-station"
                const stationName = apt.stations?.name || "ללא עמדה"

                if (!stationMap[stationId]) {
                    stationMap[stationId] = {
                        stationId,
                        stationName,
                        totalAppointments: 0,
                        activeHours: 0,
                        inactiveHours: 0,
                        totalHours: totalAvailableMinutes,
                        totalWorth: 0,
                        totalPaid: 0,
                    }
                }

                stationMap[stationId].totalAppointments += 1
                stationMap[stationId].totalWorth += amountDue
                stationMap[stationId].totalPaid += paid
                stationMap[stationId].activeHours += durationMinutes

                // By date
                const dateKey = format(new Date(apt.start_at), "yyyy-MM-dd")
                if (!byDateMap[dateKey]) {
                    byDateMap[dateKey] = { count: 0, activeHours: 0, worth: 0, paid: 0 }
                }
                byDateMap[dateKey].count += 1
                byDateMap[dateKey].worth += amountDue
                byDateMap[dateKey].paid += paid
                byDateMap[dateKey].activeHours += durationMinutes

                // By creation date
                if (apt.created_at) {
                    const creationDateKey = format(new Date(apt.created_at), "yyyy-MM-dd")
                    if (!byCreationDateMap[creationDateKey]) {
                        byCreationDateMap[creationDateKey] = 0
                    }
                    byCreationDateMap[creationDateKey] += 1
                }

                // By modify date
                if (apt.updated_at) {
                    const modifyDateKey = format(new Date(apt.updated_at), "yyyy-MM-dd")
                    if (!byModifyDateMap[modifyDateKey]) {
                        byModifyDateMap[modifyDateKey] = 0
                    }
                    byModifyDateMap[modifyDateKey] += 1
                }

                // By station by date (only grooming in barbershop)
                if (!byStationByDateMap[stationId]) {
                    byStationByDateMap[stationId] = {}
                }
                if (!byStationByDateMap[stationId][dateKey]) {
                    byStationByDateMap[stationId][dateKey] = { count: 0, worth: 0, paid: 0, activeHours: 0 }
                }
                byStationByDateMap[stationId][dateKey].count += 1
                byStationByDateMap[stationId][dateKey].worth += amountDue
                byStationByDateMap[stationId][dateKey].paid += paid
                byStationByDateMap[stationId][dateKey].activeHours += durationMinutes

                // Store enriched appointment for detail modal
                enrichedAppointments.push({
                    id: apt.id,
                    start_at: apt.start_at,
                    end_at: apt.end_at,
                    created_at: apt.created_at || apt.start_at, // Fallback to start_at if created_at not available
                    updated_at: apt.updated_at || apt.created_at || apt.start_at, // Fallback to created_at or start_at if updated_at not available
                    stationName,
                    stationId,
                    amount_due: amountDue,
                    paid,
                    durationMinutes,
                    serviceType: apt.serviceType,
                    sourceTable: apt.sourceTable,
                    customerName: apt.customers?.full_name,
                })
            })

            // Calculate inactive hours for stations
            Object.values(stationMap).forEach((stat) => {
                stat.inactiveHours = Math.max(0, stat.totalHours - stat.activeHours)
            })

            // Fetch cart items worth for appointments
            let cartItemsWorth: number = 0
            const appointmentIdsForOrders = allAppointments.map((apt: any) => apt.id)
            if (appointmentIdsForOrders.length > 0) {
                const { data: ordersData } = await supabase
                    .from("orders")
                    .select(`
                        id,
                        total,
                        order_items (
                            quantity,
                            unit_price
                        )
                    `)
                    .in("grooming_appointment_id", appointmentIdsForOrders)
                    .not("grooming_appointment_id", "is", null)

                if (ordersData) {
                    ordersData.forEach((order: any) => {
                        if (order.order_items && Array.isArray(order.order_items)) {
                            order.order_items.forEach((item: any) => {
                                const itemWorth = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                                cartItemsWorth += itemWorth
                            })
                        } else if (order.total) {
                            // Fallback to order total if order_items not available
                            cartItemsWorth += Number(order.total) || 0
                        }
                    })
                }
            }

            // Calculate totals (only grooming in barbershop)
            const totalActiveHours = groomingStats.totalActiveHours
            const totalWorth = groomingStats.totalWorth
            const totalPaid = groomingStats.totalPaid

            // Build byStationByDate array
            const byStationByDateArray: AppointmentsData["byStationByDate"] = []
            Object.entries(byStationByDateMap).forEach(([stationId, dates]) => {
                const station = Object.values(stationMap).find((s) => s.stationId === stationId)
                const stationName = station?.stationName || "ללא עמדה"
                Object.entries(dates).forEach(([date, data]) => {
                    byStationByDateArray.push({
                        stationId,
                        stationName,
                        date: format(new Date(date), "dd/MM"),
                        count: data.count,
                        worth: data.worth,
                        paid: data.paid,
                        activeHours: data.activeHours,
                    })
                })
            })

            setAppointmentsData({
                totalAppointments: allAppointments.length,
                totalActiveHours,
                totalWorth,
                totalPaid,
                grooming: {
                    ...groomingStats,
                    cartItemsWorth,
                },
                garden: {
                    totalAppointments: 0,
                    totalActiveHours: 0,
                    totalWorth: 0,
                    totalPaid: 0,
                },
                byStation: Object.values(stationMap).sort((a, b) => b.totalAppointments - a.totalAppointments),
                byDate: Object.entries(byDateMap)
                    .map(([date, data]) => ({
                        date: format(new Date(date), "dd/MM"),
                        count: data.count,
                        activeHours: data.activeHours,
                        worth: data.worth,
                        paid: data.paid,
                    }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
                byCreationDate: Object.entries(byCreationDateMap)
                    .map(([date, count]) => ({
                        date: format(new Date(date), "dd/MM"),
                        count,
                    }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
                byModifyDate: Object.entries(byModifyDateMap)
                    .map(([date, count]) => ({
                        date: format(new Date(date), "dd/MM"),
                        count,
                    }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
                byStationByDate: byStationByDateArray,
                byGardenByDate: [], // No daycare in barbershop
                byGardenServiceType: [], // No daycare in barbershop
                allAppointments: enrichedAppointments,
            })
        } catch (error) {
            console.error("Failed to fetch appointments data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לטעון נתוני תורים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [startDate, endDate, selectedStationIds, toast])

    useEffect(() => {
        fetchAppointmentsData()
    }, [fetchAppointmentsData])

    const handleStationClick = (stationName: string) => {
        if (!appointmentsData) return
        const station = appointmentsData.byStation.find((s) => s.stationName === stationName)
        if (!station) return

        const filtered = appointmentsData.allAppointments.filter(
            (apt) => apt.stationName === stationName
        )

        setDetailModalTitle(`פרטי תורים - ${stationName}`)
        setDetailModalDescription(`סה"כ ${filtered.length} תורים`)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    const handleDateClick = (date: string) => {
        if (!appointmentsData) return
        const dateData = appointmentsData.byDate.find((d) => d.date === date)
        if (!dateData) return

        // Find appointments for this date
        const dateKey = date.split("/").reverse().join("-") // Convert dd/MM to yyyy-MM-dd format
        const filtered = appointmentsData.allAppointments.filter((apt) => {
            const aptDate = format(new Date(apt.start_at), "dd/MM")
            return aptDate === date
        })

        setDetailModalTitle(`פרטי תורים - ${date}`)
        setDetailModalDescription(`סה"כ ${filtered.length} תורים`)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    const handleAppointmentClick = (appointment: any) => {
        const appointmentDate = new Date(appointment.start_at)
        const dateStr = format(appointmentDate, "yyyy-MM-dd")
        navigate(`/manager?date=${dateStr}&appointmentId=${appointment.id}&serviceType=${appointment.serviceType}`)
    }

    const handleStatClick = (type: "total" | "active" | "inactive" | "worth" | "paid") => {
        if (!appointmentsData) return

        let filtered: any[] = []
        let title = ""
        let description = ""

        switch (type) {
            case "total":
                filtered = appointmentsData.allAppointments
                title = "כל התורים"
                description = `סה"כ ${filtered.length} תורים`
                break
            case "active":
                // Filter appointments that have duration > 0
                filtered = appointmentsData.allAppointments.filter((apt) => {
                    try {
                        const start = new Date(apt.start_at)
                        const end = new Date(apt.end_at)
                        return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start
                    } catch {
                        return false
                    }
                })
                title = "תורים פעילים"
                description = `סה"כ ${filtered.length} תורים פעילים`
                break
            case "inactive":
                // This would need more logic, but for now show all
                filtered = appointmentsData.allAppointments
                title = "תורים לא פעילים"
                description = `סה"כ ${filtered.length} תורים`
                break
            case "worth":
                filtered = appointmentsData.allAppointments.filter((apt) => apt.amount_due > 0)
                title = "תורים עם שווי"
                description = `סה"כ ${filtered.length} תורים עם שווי`
                break
            case "paid":
                filtered = appointmentsData.allAppointments.filter((apt) => apt.paid > 0)
                title = "תורים ששולמו"
                description = `סה"כ ${filtered.length} תורים ששולמו`
                break
        }

        setDetailModalTitle(title)
        setDetailModalDescription(description)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Calendar className="h-7 w-7 text-primary" />
                    דוח תורים
                </h1>
                <p className="text-slate-600">ניתוח מפורט של תורים ועמדות</p>
            </div>

            <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>מסננים</CardTitle>
                        <Button onClick={fetchAppointmentsData} disabled={isLoading} variant="outline" size="sm">
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
                            <Label>תחנות</Label>
                            {isLoadingStations ? (
                                <div className="flex items-center justify-center h-10 text-sm text-slate-500">
                                    טוען תחנות...
                                </div>
                            ) : (
                                <MultiSelectDropdown
                                    options={stations.map((s) => ({ id: s.id, name: s.name }))}
                                    selectedIds={selectedStationIds}
                                    onSelectionChange={setSelectedStationIds}
                                    placeholder="בחר תחנות..."
                                />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {appointmentsData && (
                <>
                    {/* Grooming Stats */}
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                            const filtered = appointmentsData.allAppointments.filter((apt) => apt.serviceType === "grooming")
                            setDetailModalTitle("תורים - מספרה")
                            setDetailModalDescription(`סה"כ ${filtered.length} תורים`)
                            setDetailModalData(filtered)
                            setDetailModalOpen(true)
                        }}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-blue-700 text-lg">מספרה</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 justify-center items-stretch">
                                    <Card className="flex-1 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 flex items-center justify-center">
                                        <CardContent className="pt-3 pb-3 text-center">
                                            <p className="text-[10px] text-slate-500 mb-0.5">סה"כ תורים</p>
                                            <p className="text-xl font-bold text-blue-600 leading-tight">{appointmentsData.grooming.totalAppointments}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="flex-1 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 flex items-center justify-center">
                                        <CardContent className="pt-3 pb-3 text-center">
                                            <p className="text-[10px] text-slate-500 mb-0.5">שעות פעילות</p>
                                            <p className="text-xl font-bold text-blue-600 leading-tight">
                                                {formatDurationFromMinutes(appointmentsData.grooming.totalActiveHours)}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="flex-1 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 flex items-center justify-center">
                                        <CardContent className="pt-3 pb-3 text-center">
                                            <p className="text-[10px] text-slate-500 mb-0.5">שווי תורים</p>
                                            <p className="text-xl font-bold text-blue-600 leading-tight">
                                                ₪{appointmentsData.grooming.totalWorth.toLocaleString("he-IL")}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="flex-1 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 flex items-center justify-center">
                                        <CardContent className="pt-3 pb-3 text-center">
                                            <p className="text-[10px] text-slate-500 mb-0.5">שולם בפועל</p>
                                            <p className="text-xl font-bold text-blue-600 leading-tight">
                                                ₪{appointmentsData.grooming.totalPaid.toLocaleString("he-IL")}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card className="flex-1 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 flex items-center justify-center">
                                        <CardContent className="pt-3 pb-3 text-center">
                                            <p className="text-[10px] text-slate-500 mb-0.5">שווי פריטי עגלה</p>
                                            <p className="text-xl font-bold text-blue-600 leading-tight">
                                                ₪{appointmentsData.grooming.cartItemsWorth.toLocaleString("he-IL")}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Station Analysis */}
                    {appointmentsData.byStation.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>ניתוח לפי תחנה</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96">
                                    <HighchartsReact
                                        highcharts={Highcharts}
                                        options={{
                                            chart: {
                                                type: "column",
                                                backgroundColor: "transparent",
                                                style: { fontFamily: "inherit" },
                                            },
                                            title: { text: null },
                                            xAxis: {
                                                categories: appointmentsData.byStation.map((s) => s.stationName),
                                                labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                            },
                                            yAxis: [
                                                {
                                                    title: {
                                                        text: "כמות תורים",
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    labels: { style: { fontSize: "12px" } },
                                                },
                                                {
                                                    title: {
                                                        text: "שעות פעילות",
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    opposite: true,
                                                    labels: {
                                                        formatter: function (this: any) {
                                                            return getDurationLabel(this.value * 60)
                                                        },
                                                        style: { fontSize: "12px" },
                                                    },
                                                },
                                            ],
                                            tooltip: {
                                                shared: true,
                                                useHTML: true,
                                                formatter: function (this: any) {
                                                    let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${this.x}</div>`
                                                    this.points?.forEach((point: any) => {
                                                        let value = point.y
                                                        if (point.series.name === "שעות פעילות") {
                                                            value = formatDurationFromMinutes(value * 60)
                                                        } else if (point.series.name.includes("₪")) {
                                                            value = `₪${value.toLocaleString("he-IL")}`
                                                        } else {
                                                            value = `${value} תורים`
                                                        }
                                                        tooltip += `<div style="margin: 4px 0;">
                                                        <span style="color: ${point.color}">●</span>
                                                        <span style="font-weight: 500;">${point.series.name}:</span>
                                                        <span style="font-weight: 600; margin-right: 8px;">${value}</span>
                                                    </div>`
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
                                                column: {
                                                    borderRadius: 4,
                                                    dataLabels: {
                                                        enabled: false,
                                                    },
                                                    cursor: "pointer",
                                                    point: {
                                                        events: {
                                                            click: function (this: any) {
                                                                handleStationClick(this.category)
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                            series: [
                                                {
                                                    name: "כמות תורים",
                                                    data: appointmentsData.byStation.map((s) => s.totalAppointments),
                                                    color: "#3b82f6",
                                                    yAxis: 0,
                                                },
                                                {
                                                    name: "שעות פעילות",
                                                    data: appointmentsData.byStation.map((s) => formatDurationForChart(s.activeHours)),
                                                    color: "#10b981",
                                                    yAxis: 1,
                                                },
                                                {
                                                    name: "שווי תורים (₪)",
                                                    data: appointmentsData.byStation.map((s) => s.totalWorth),
                                                    color: "#8b5cf6",
                                                    yAxis: 0,
                                                },
                                                {
                                                    name: "שולם בפועל (₪)",
                                                    data: appointmentsData.byStation.map((s) => s.totalPaid),
                                                    color: "#f59e0b",
                                                    yAxis: 0,
                                                },
                                            ],
                                            credits: { enabled: false },
                                        }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Station by Date Line Chart */}
                    {appointmentsData.byStationByDate.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>ניתוח תחנות לפי תאריך</CardTitle>
                                        <CardDescription>לכל תחנה קו נפרד - בחר מה להציג על ציר ה-Y</CardDescription>
                                    </div>
                                    <div className="w-48">
                                        <Select value={stationByDateViewMode} onValueChange={(v) => setStationByDateViewMode(v as any)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="count">לפי כמות תורים</SelectItem>
                                                <SelectItem value="worth">לפי שווי</SelectItem>
                                                <SelectItem value="time">לפי זמן</SelectItem>
                                                <SelectItem value="paid">לפי שולם</SelectItem>
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
                                            const stations = Array.from(new Set(appointmentsData.byStationByDate.map((d) => d.stationName)))
                                            const dates = Array.from(new Set(appointmentsData.byStationByDate.map((d) => d.date))).sort()

                                            const yAxisTitle = stationByDateViewMode === "count"
                                                ? "כמות תורים"
                                                : stationByDateViewMode === "worth"
                                                    ? "שווי (₪)"
                                                    : stationByDateViewMode === "time"
                                                        ? "שעות פעילות"
                                                        : "שולם (₪)"

                                            const statLabel = stationByDateViewMode === "count"
                                                ? "כמות תורים"
                                                : stationByDateViewMode === "worth"
                                                    ? "שווי"
                                                    : stationByDateViewMode === "time"
                                                        ? "שעות פעילות"
                                                        : "שולם"

                                            const series = stations.map((stationName, index) => {
                                                const data = dates.map((date) => {
                                                    const item = appointmentsData.byStationByDate.find(
                                                        (d) => d.stationName === stationName && d.date === date
                                                    )
                                                    if (!item) return 0

                                                    switch (stationByDateViewMode) {
                                                        case "count":
                                                            return item.count
                                                        case "worth":
                                                            return item.worth
                                                        case "time":
                                                            return formatDurationForChart(item.activeHours)
                                                        case "paid":
                                                            return item.paid
                                                        default:
                                                            return item.count
                                                    }
                                                })

                                                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#a855f7"]
                                                return {
                                                    name: `${stationName} - ${statLabel}`,
                                                    data,
                                                    color: colors[index % colors.length],
                                                    yAxis: (stationByDateViewMode === "worth" || stationByDateViewMode === "paid") ? 1 : 0,
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
                                                    categories: dates,
                                                    labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                                },
                                                yAxis: [
                                                    {
                                                        title: {
                                                            text: yAxisTitle,
                                                            style: { fontSize: "13px", fontWeight: "600" },
                                                        },
                                                        labels: {
                                                            formatter: function (this: any) {
                                                                if (stationByDateViewMode === "time") {
                                                                    return getDurationLabel(this.value * 60)
                                                                }
                                                                return this.value.toLocaleString("he-IL")
                                                            },
                                                            style: { fontSize: "12px" },
                                                        },
                                                    },
                                                    {
                                                        title: {
                                                            text: yAxisTitle,
                                                            style: { fontSize: "13px", fontWeight: "600" },
                                                        },
                                                        opposite: true,
                                                        labels: {
                                                            formatter: function (this: any) {
                                                                if (stationByDateViewMode === "worth" || stationByDateViewMode === "paid") {
                                                                    return `₪${this.value.toLocaleString("he-IL")}`
                                                                }
                                                                return this.value.toLocaleString("he-IL")
                                                            },
                                                            style: { fontSize: "12px" },
                                                        },
                                                    },
                                                ],
                                                tooltip: {
                                                    shared: true,
                                                    useHTML: true,
                                                    formatter: function (this: any) {
                                                        const getStationName = (seriesName: string) => {
                                                            const lastDashIndex = seriesName.lastIndexOf(" - ")
                                                            return lastDashIndex === -1 ? seriesName : seriesName.slice(0, lastDashIndex)
                                                        }

                                                        let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${this.x}</div>`
                                                        this.points?.forEach((point: any) => {
                                                            const stationName = getStationName(point.series.name)
                                                            const item = appointmentsData.byStationByDate.find(
                                                                (d) => d.stationName === stationName && d.date === this.x
                                                            )
                                                            const fallbackValue = typeof point.y === "number" ? point.y : 0
                                                            const stats = {
                                                                count: item?.count ?? (stationByDateViewMode === "count" ? fallbackValue : 0),
                                                                worth: item?.worth ?? (stationByDateViewMode === "worth" ? fallbackValue : 0),
                                                                paid: item?.paid ?? (stationByDateViewMode === "paid" ? fallbackValue : 0),
                                                                activeMinutes: item?.activeHours ?? (stationByDateViewMode === "time" ? fallbackValue * 60 : 0),
                                                            }

                                                            const valueLabel = (() => {
                                                                switch (stationByDateViewMode) {
                                                                    case "count":
                                                                        return `${statLabel}: ${stats.count.toLocaleString("he-IL")}`
                                                                    case "worth":
                                                                        return `${statLabel}: ₪${stats.worth.toLocaleString("he-IL")}`
                                                                    case "time":
                                                                        return `${statLabel}: ${formatDurationFromMinutes(stats.activeMinutes)}`
                                                                    case "paid":
                                                                        return `${statLabel}: ₪${stats.paid.toLocaleString("he-IL")}`
                                                                    default:
                                                                        return `${statLabel}: ${stats.count.toLocaleString("he-IL")}`
                                                                }
                                                            })()

                                                            tooltip += `<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 4px 0; direction: rtl;">
                                                                <span style="display: inline-flex; align-items: center; gap: 6px; color: ${point.color}; font-weight: 600;">
                                                                    <span style="color: ${point.color};">●</span>
                                                                    <span>${stationName}</span>
                                                                </span>
                                                                <span style="font-weight: 600; color: #111827;">${valueLabel}</span>
                                                            </div>`
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
                                                                    const getStationName = (seriesName: string) => {
                                                                        const lastDashIndex = seriesName.lastIndexOf(" - ")
                                                                        return lastDashIndex === -1 ? seriesName : seriesName.slice(0, lastDashIndex)
                                                                    }
                                                                    const stationName = getStationName(this.series.name)
                                                                    const date = this.category
                                                                    if (!appointmentsData) return

                                                                    // Filter appointments by station and date
                                                                    const filtered = appointmentsData.allAppointments.filter((apt) => {
                                                                        const aptDate = format(new Date(apt.start_at), "dd/MM")
                                                                        return apt.stationName === stationName && aptDate === date
                                                                    })

                                                                    setDetailModalTitle(`פרטי תורים - ${stationName} - ${date}`)
                                                                    setDetailModalDescription(`סה"כ ${filtered.length} תורים`)
                                                                    setDetailModalData(filtered)
                                                                    setDetailModalOpen(true)
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


                    {/* Appointments by Creation Date and Modify Date - Combined Chart */}
                    {(appointmentsData.byCreationDate.length > 0 || appointmentsData.byModifyDate.length > 0) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>תורים לפי תאריך יצירה ושינוי</CardTitle>
                                <CardDescription>השוואה בין כמות תורים שנוצרו לעומת כמות תורים שעודכנו בכל יום</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96">
                                    <HighchartsReact
                                        highcharts={Highcharts}
                                        options={(() => {
                                            // Combine all unique dates from both arrays
                                            const allDates = new Set([
                                                ...appointmentsData.byCreationDate.map((d) => d.date),
                                                ...appointmentsData.byModifyDate.map((d) => d.date),
                                            ])
                                            // Sort dates properly (dd/MM format)
                                            // Since both arrays are already sorted chronologically, we can merge them
                                            // But to be safe, we'll parse and sort them properly
                                            const sortedDates = Array.from(allDates).sort((a, b) => {
                                                const [dayA, monthA] = a.split("/").map(Number)
                                                const [dayB, monthB] = b.split("/").map(Number)
                                                // Use current year for comparison (or we could use a reference year)
                                                const currentYear = new Date().getFullYear()
                                                const dateA = new Date(currentYear, monthA - 1, dayA)
                                                const dateB = new Date(currentYear, monthB - 1, dayB)
                                                return dateA.getTime() - dateB.getTime()
                                            })

                                            // Create data arrays for both series, matching dates
                                            const creationData = sortedDates.map((date) => {
                                                const item = appointmentsData.byCreationDate.find((d) => d.date === date)
                                                return item ? item.count : 0
                                            })

                                            const modifyData = sortedDates.map((date) => {
                                                const item = appointmentsData.byModifyDate.find((d) => d.date === date)
                                                return item ? item.count : 0
                                            })

                                            return {
                                                chart: {
                                                    type: "line",
                                                    backgroundColor: "transparent",
                                                    style: { fontFamily: "inherit" },
                                                },
                                                title: { text: null },
                                                xAxis: {
                                                    categories: sortedDates,
                                                    labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                                },
                                                yAxis: {
                                                    title: {
                                                        text: "כמות תורים",
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    labels: { style: { fontSize: "12px" } },
                                                },
                                                tooltip: {
                                                    shared: true,
                                                    useHTML: true,
                                                    formatter: function (this: any) {
                                                        let tooltip = `<div style="font-weight: 600; margin-bottom: 8px;">${this.x}</div>`
                                                        this.points?.forEach((point: any) => {
                                                            const value = point.y || 0
                                                            tooltip += `<div style="margin: 4px 0;">
                                                                <span style="color: ${point.color}">●</span>
                                                                <span style="font-weight: 500;">${point.series.name}:</span>
                                                                <span style="font-weight: 600; margin-right: 8px;">${value.toLocaleString("he-IL")}</span>
                                                            </div>`
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
                                                                    const date = this.category
                                                                    const seriesName = this.series.name
                                                                    if (!appointmentsData) return

                                                                    let filtered: any[] = []
                                                                    let title = ""

                                                                    if (seriesName === "תאריך יצירה") {
                                                                        filtered = appointmentsData.allAppointments.filter((apt) => {
                                                                            if (!apt.created_at) return false
                                                                            const aptCreationDate = format(new Date(apt.created_at), "dd/MM")
                                                                            return aptCreationDate === date
                                                                        })
                                                                        title = `פרטי תורים - תאריך יצירה: ${date}`
                                                                    } else if (seriesName === "תאריך שינוי") {
                                                                        filtered = appointmentsData.allAppointments.filter((apt) => {
                                                                            if (!apt.updated_at) return false
                                                                            const aptModifyDate = format(new Date(apt.updated_at), "dd/MM")
                                                                            return aptModifyDate === date
                                                                        })
                                                                        title = `פרטי תורים - תאריך שינוי: ${date}`
                                                                    }

                                                                    if (filtered.length > 0) {
                                                                        setDetailModalTitle(title)
                                                                        setDetailModalDescription(`סה"כ ${filtered.length} תורים`)
                                                                        setDetailModalData(filtered)
                                                                        setDetailModalOpen(true)
                                                                    }
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series: [
                                                    {
                                                        name: "תאריך יצירה",
                                                        data: creationData,
                                                        color: "#10b981",
                                                    },
                                                    {
                                                        name: "תאריך שינוי",
                                                        data: modifyData,
                                                        color: "#f59e0b",
                                                    },
                                                ],
                                                credits: { enabled: false },
                                            }
                                        })()}
                                    />
                                </div>
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
                onRowClick={handleAppointmentClick}
                columns={[
                    {
                        key: "start_at",
                        label: "תאריך ושעה",
                        render: (value) => format(new Date(value), "dd/MM/yyyy HH:mm"),
                    },
                    {
                        key: "stationName",
                        label: "תחנה",
                    },
                    {
                        key: "customerName",
                        label: "לקוח",
                    },
                    {
                        key: "durationMinutes",
                        label: "משך (דקות)",
                        render: (value) => formatDurationFromMinutes(value || 0),
                        isNumeric: true,
                    },
                    {
                        key: "amount_due",
                        label: "שווי (₪)",
                        render: (value) => `₪${Number(value || 0).toLocaleString("he-IL")}`,
                        isNumeric: true,
                    },
                    {
                        key: "paid",
                        label: "שולם (₪)",
                        render: (value) => `₪${Number(value || 0).toLocaleString("he-IL")}`,
                        isNumeric: true,
                    },
                ]}
            />
        </div>
    )
}
