import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import { BarChart3, DollarSign, Loader2, RefreshCw, Calendar as CalendarIcon, TrendingUp } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Highcharts from "highcharts"
import HighchartsReact from "highcharts-react-official"
import { useStations } from "@/hooks/useStations"
import { MultiSelectDropdown } from "@/components/settings/SettingsBreedStationMatrixSection/components/MultiSelectDropdown"
import { ChartDetailModal } from "@/components/reports/ChartDetailModal"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

interface PaymentData {
    total: number
    count: number
    byClientCategory: Record<string, { total: number; count: number; categoryName: string }>
    byStation: Record<string, { total: number; count: number; stationName: string }>
    byService: { grooming: { total: number; count: number }; garden: { total: number; count: number } }
    byDate: Record<string, { total: number; count: number }>
    allAppointments: Array<{
        id: string
        start_at: string
        amount_due: number
        clientCategoryName?: string
        stationName: string
        serviceType: string
        customerName?: string
    }>
}

export default function PaymentsReport() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
    const initialStartDate = useMemo(() => subDays(new Date(), 30), [])
    const initialEndDate = useMemo(() => new Date(), [])
    const [startDate, setStartDate] = useState<Date | null>(initialStartDate)
    const [endDate, setEndDate] = useState<Date | null>(initialEndDate)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialStartDate,
        to: initialEndDate,
    })
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all")
    const [viewMode, setViewMode] = useState<"byDate" | "byClientCategory" | "byStation" | "byService">("byDate")

    const { data: stations = [], isLoading: isLoadingStations } = useStations()
    const [customerTypes, setCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [detailModalData, setDetailModalData] = useState<any[]>([])
    const [detailModalTitle, setDetailModalTitle] = useState("")
    const [detailModalDescription, setDetailModalDescription] = useState("")

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

    const fetchFilterOptions = useCallback(async () => {
        try {
            const { data: customerTypeData } = await supabase.from("customer_types").select("id, name").order("priority", { ascending: true })
            setCustomerTypes(customerTypeData || [])
        } catch (error) {
            console.error("Failed to fetch filter options:", error)
        }
    }, [])

    useEffect(() => {
        fetchFilterOptions()
    }, [fetchFilterOptions])

    const fetchPaymentData = useCallback(async () => {
        setIsLoading(true)
        try {
            const fromIso = startDate ? startOfDay(startDate).toISOString() : undefined
            const toIso = endDate ? endOfDay(endDate).toISOString() : undefined

            // Only grooming appointments in barbershop
            const shouldFetchGrooming = true

            // Only fetch grooming appointments (no daycare in barbershop)
            const groomingPromise = shouldFetchGrooming
                ? supabase
                    .from("grooming_appointments")
                    .select(
                        `
                          id,
                          amount_due,
                          station_id,
                          start_at,
                          customers (
                              id,
                              full_name,
                              customer_type_id,
                              customer_type:customer_types (
                                  id,
                                  name
                              )
                          ),
                          stations (
                              id,
                              name
                          )
                      `
                    )
                    .gte("start_at", fromIso || "")
                    .lte("start_at", toIso || "")
                : Promise.resolve({ data: [], error: null })

            const groomingResult = await groomingPromise

            if (groomingResult.error) {
                throw groomingResult.error
            }

            const allAppointments = (groomingResult.data || []).map((apt: any) => ({ ...apt, serviceType: "grooming" }))

            // Filter by stations
            let filteredAppointments = allAppointments
            if (selectedStationIds.length > 0) {
                filteredAppointments = filteredAppointments.filter((apt: any) =>
                    selectedStationIds.includes(apt.station_id)
                )
            }

            // Filter by customer type
            if (customerTypeFilter !== "all") {
                filteredAppointments = filteredAppointments.filter(
                    (apt: any) => apt.customers?.customer_type_id === customerTypeFilter
                )
            }

            // No breed filtering in barbershop

            // Aggregate data
            const data: PaymentData = {
                total: 0,
                count: 0,
                byClientCategory: {},
                byStation: {},
                byService: { grooming: { total: 0, count: 0 }, garden: { total: 0, count: 0 } },
                byDate: {},
                allAppointments: [],
            }

            filteredAppointments.forEach((apt: any) => {
                const amount = apt.amount_due ? Number(apt.amount_due) : 0
                if (amount <= 0) return

                data.total += amount
                data.count += 1

                const stationId = apt.station_id
                const stationName = apt.stations?.name || "ללא עמדה"
                const clientCategoryName = apt.customers?.customer_type?.name || "ללא סוג"

                // By service (only grooming in barbershop)
                data.byService.grooming.total += amount
                data.byService.grooming.count += 1

                // By client category
                if (!data.byClientCategory[clientCategoryName]) {
                    data.byClientCategory[clientCategoryName] = { total: 0, count: 0, categoryName: clientCategoryName }
                }
                data.byClientCategory[clientCategoryName].total += amount
                data.byClientCategory[clientCategoryName].count += 1

                // By station
                if (stationId) {
                    if (!data.byStation[stationId]) {
                        data.byStation[stationId] = { total: 0, count: 0, stationName }
                    }
                    data.byStation[stationId].total += amount
                    data.byStation[stationId].count += 1
                }

                // By date
                const dateKey = format(new Date(apt.start_at), "yyyy-MM-dd")
                if (!data.byDate[dateKey]) {
                    data.byDate[dateKey] = { total: 0, count: 0 }
                }
                data.byDate[dateKey].total += amount
                data.byDate[dateKey].count += 1

                // Store enriched appointment for detail modal
                data.allAppointments.push({
                    id: apt.id,
                    start_at: apt.start_at,
                    amount_due: amount,
                    clientCategoryName,
                    stationName,
                    serviceType: apt.serviceType,
                    customerName: apt.customers?.full_name,
                })
            })

            setPaymentData(data)
        } catch (error) {
            console.error("Failed to fetch payment data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לטעון נתוני תשלומים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [startDate, endDate, selectedStationIds, customerTypeFilter, toast])

    useEffect(() => {
        fetchPaymentData()
    }, [fetchPaymentData])


    const chartDataByStation = useMemo(() => {
        if (!paymentData) return []
        return Object.entries(paymentData.byStation).map(([id, data]) => ({
            name: data.stationName,
            total: data.total,
            count: data.count,
        }))
    }, [paymentData])

    const chartDataByDate = useMemo(() => {
        if (!paymentData) return []
        return Object.entries(paymentData.byDate)
            .map(([date, data]) => ({
                date: format(new Date(date), "dd/MM"),
                total: data.total,
                count: data.count,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }, [paymentData])

    const pieDataByService = useMemo(() => {
        if (!paymentData) return []
        return [
            { name: "מספרה", value: paymentData.byService.grooming.total },
        ].filter((item) => item.value > 0)
    }, [paymentData])


    const chartDataByClientCategory = useMemo(() => {
        if (!paymentData) return []
        return Object.entries(paymentData.byClientCategory)
            .map(([name, data]) => ({
                name: data.categoryName,
                total: data.total,
                count: data.count,
            }))
            .sort((a, b) => b.total - a.total)
    }, [paymentData])

    const handleChartClick = (category: string, type: "date" | "clientCategory" | "station" | "service") => {
        if (!paymentData) return

        let filtered: any[] = []
        let title = ""
        let description = ""

        switch (type) {
            case "date":
                const dateKey = category.split("/").reverse().join("-") // Convert dd/MM to yyyy-MM-dd
                filtered = paymentData.allAppointments.filter((apt) => {
                    const aptDate = format(new Date(apt.start_at), "dd/MM")
                    return aptDate === category
                })
                title = `פרטי תשלומים - ${category}`
                description = `סה"כ ${filtered.length} תורים`
                break
            case "clientCategory":
                filtered = paymentData.allAppointments.filter((apt) => apt.clientCategoryName === category)
                title = `פרטי תשלומים - קטגוריית לקוח: ${category}`
                description = `סה"כ ${filtered.length} תורים`
                break
            case "station":
                filtered = paymentData.allAppointments.filter((apt) => apt.stationName === category)
                title = `פרטי תשלומים - ${category}`
                description = `סה"כ ${filtered.length} תורים`
                break
            case "service":
                filtered = paymentData.allAppointments.filter((apt) => apt.serviceType === "grooming")
                title = `פרטי תשלומים - מספרה`
                description = `סה"כ ${filtered.length} תורים`
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
                    <DollarSign className="h-7 w-7 text-primary" />
                    דוח תשלומים
                </h1>
                <p className="text-slate-600">ניתוח מפורט של תשלומים לפי קטגוריות שונות</p>
            </div>

            <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle>מסננים</CardTitle>
                    <CardDescription>התאם את הנתונים לפי הצורך</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                                    <Calendar
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
                            <Label>קטגוריית לקוח</Label>
                            <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">כל הקטגוריות</SelectItem>
                                    {customerTypes.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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

                    <div className="flex gap-2">
                        <Button onClick={fetchPaymentData} disabled={isLoading} variant="outline" size="sm">
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    טוען...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    רענון
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {paymentData && (
                <>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>סה"כ תשלומים</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-600">
                                    ₪{paymentData.total.toLocaleString("he-IL")}
                                </div>
                                <p className="text-sm text-slate-500 mt-1">{paymentData.count} תורים</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>מספרה</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-blue-600">
                                    ₪{paymentData.byService.grooming.total.toLocaleString("he-IL")}
                                </div>
                                <p className="text-sm text-slate-500 mt-1">{paymentData.byService.grooming.count} תורים</p>
                            </CardContent>
                        </Card>

                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>גרפים וניתוח</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} dir="rtl">
                                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                                    <TabsTrigger value="byDate">לפי תאריך</TabsTrigger>
                                    <TabsTrigger value="byClientCategory">לפי קטגוריית לקוח</TabsTrigger>
                                    <TabsTrigger value="byStation">לפי תחנה</TabsTrigger>
                                    <TabsTrigger value="byService">לפי שירות</TabsTrigger>
                                </TabsList>

                                <TabsContent value="byDate" className="mt-6">
                                    <div className="h-80">
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
                                                    categories: chartDataByDate.map((d) => d.date),
                                                    labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                                },
                                                yAxis: {
                                                    title: {
                                                        text: "סכום (₪)",
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    labels: {
                                                        formatter: function (this: any) {
                                                            return `₪${this.value.toLocaleString("he-IL")}`
                                                        },
                                                        style: { fontSize: "12px" },
                                                    },
                                                },
                                                tooltip: {
                                                    formatter: function (this: any) {
                                                        return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                                            <div><span style="color: ${this.color}">●</span> סכום: <strong>₪${this.y.toLocaleString("he-IL")}</strong></div>`
                                                    },
                                                    useHTML: true,
                                                },
                                                legend: { enabled: false },
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
                                                                    handleChartClick(this.category, "date")
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series: [
                                                    {
                                                        name: "סכום",
                                                        data: chartDataByDate.map((d) => d.total),
                                                        color: "#3b82f6",
                                                    },
                                                ],
                                                credits: { enabled: false },
                                            }}
                                        />
                                    </div>
                                </TabsContent>


                                <TabsContent value="byClientCategory" className="mt-6">
                                    <div className="h-80">
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
                                                    categories: chartDataByClientCategory.map((d) => d.name),
                                                    labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                                },
                                                yAxis: {
                                                    title: {
                                                        text: "סכום (₪)",
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    labels: {
                                                        formatter: function (this: any) {
                                                            return `₪${this.value.toLocaleString("he-IL")}`
                                                        },
                                                        style: { fontSize: "12px" },
                                                    },
                                                },
                                                tooltip: {
                                                    formatter: function (this: any) {
                                                        return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                                            <div><span style="color: ${this.color}">●</span> סכום: <strong>₪${this.y.toLocaleString("he-IL")}</strong></div>`
                                                    },
                                                    useHTML: true,
                                                },
                                                legend: { enabled: false },
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
                                                                    handleChartClick(this.category, "clientCategory")
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series: [
                                                    {
                                                        name: "סכום",
                                                        data: chartDataByClientCategory.map((d) => d.total),
                                                        color: "#ec4899",
                                                    },
                                                ],
                                                credits: { enabled: false },
                                            }}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="byStation" className="mt-6">
                                    <div className="h-80">
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
                                                    categories: chartDataByStation.map((d) => d.name),
                                                    labels: { style: { fontSize: "12px", fontWeight: "500" } },
                                                },
                                                yAxis: {
                                                    title: {
                                                        text: "סכום (₪)",
                                                        style: { fontSize: "13px", fontWeight: "600" },
                                                    },
                                                    labels: {
                                                        formatter: function (this: any) {
                                                            return `₪${this.value.toLocaleString("he-IL")}`
                                                        },
                                                        style: { fontSize: "12px" },
                                                    },
                                                },
                                                tooltip: {
                                                    formatter: function (this: any) {
                                                        return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                                            <div><span style="color: ${this.color}">●</span> סכום: <strong>₪${this.y.toLocaleString("he-IL")}</strong></div>`
                                                    },
                                                    useHTML: true,
                                                },
                                                legend: { enabled: false },
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
                                                                    handleChartClick(this.category, "station")
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series: [
                                                    {
                                                        name: "סכום",
                                                        data: chartDataByStation.map((d) => d.total),
                                                        color: "#8b5cf6",
                                                    },
                                                ],
                                                credits: { enabled: false },
                                            }}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="byService" className="mt-6">
                                    <div className="h-80">
                                        <HighchartsReact
                                            highcharts={Highcharts}
                                            options={{
                                                chart: {
                                                    type: "pie",
                                                    backgroundColor: "transparent",
                                                    style: { fontFamily: "inherit" },
                                                },
                                                title: { text: null },
                                                tooltip: {
                                                    formatter: function (this: any) {
                                                        return `<div style="font-weight: 600; margin-bottom: 4px;">${this.point.name}</div>
                                                            <div><span style="color: ${this.point.color}">●</span> סכום: <strong>₪${this.point.y.toLocaleString("he-IL")}</strong></div>
                                                            <div>אחוז: <strong>${this.point.percentage.toFixed(1)}%</strong></div>`
                                                    },
                                                    useHTML: true,
                                                },
                                                plotOptions: {
                                                    pie: {
                                                        allowPointSelect: true,
                                                        cursor: "pointer",
                                                        dataLabels: {
                                                            enabled: true,
                                                            format: "{point.name}: {point.percentage:.1f}%",
                                                            style: {
                                                                fontSize: "13px",
                                                                fontWeight: "500",
                                                            },
                                                        },
                                                        showInLegend: true,
                                                        point: {
                                                            events: {
                                                                click: function (this: any) {
                                                                    handleChartClick(this.name, "service")
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                legend: {
                                                    align: "center",
                                                    verticalAlign: "bottom",
                                                    itemStyle: { fontSize: "13px", fontWeight: "500" },
                                                    margin: 30,
                                                    padding: 15,
                                                    itemMarginBottom: 10,
                                                },
                                                series: [
                                                    {
                                                        name: "סכום",
                                                        data: pieDataByService.map((d, i) => ({
                                                            name: d.name,
                                                            y: d.value,
                                                            color: COLORS[i % COLORS.length],
                                                        })),
                                                    },
                                                ],
                                                credits: { enabled: false },
                                            }}
                                        />
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
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
                        key: "start_at",
                        label: "תאריך",
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
                        key: "clientCategoryName",
                        label: "קטגוריית לקוח",
                    },
                    {
                        key: "amount_due",
                        label: "סכום (₪)",
                        render: (value) => `₪${Number(value || 0).toLocaleString("he-IL")}`,
                    },
                ]}
            />
        </div>
    )
}

