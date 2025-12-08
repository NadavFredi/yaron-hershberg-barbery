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
    byBreed: Record<string, { total: number; count: number; breedName: string }>
    byBreedCategory: Record<string, { total: number; count: number; categoryName: string }>
    byClientCategory: Record<string, { total: number; count: number; categoryName: string }>
    byStation: Record<string, { total: number; count: number; stationName: string }>
    byService: { grooming: { total: number; count: number }; garden: { total: number; count: number } }
    byDate: Record<string, { total: number; count: number }>
    allAppointments: Array<{
        id: string
        start_at: string
        amount_due: number
        breedName: string
        breedCategoryName?: string
        clientCategoryName?: string
        stationName: string
        serviceType: string
        customerName?: string
        dogName?: string
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
    const [serviceFilter, setServiceFilter] = useState<"all" | "grooming" | "garden">("all")
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all")
    const [breedFilter, setBreedFilter] = useState<string>("all")
    const [viewMode, setViewMode] = useState<"byDate" | "byBreed" | "byBreedCategory" | "byClientCategory" | "byStation" | "byService">("byDate")
    
    const { data: stations = [], isLoading: isLoadingStations } = useStations()
    const [customerTypes, setCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
    const [breeds, setBreeds] = useState<Array<{ id: string; name: string }>>([])
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
            const [{ data: customerTypeData }, { data: breedData }] = await Promise.all([
                supabase.from("customer_types").select("id, name").order("priority", { ascending: true }),
                supabase.from("breeds").select("id, name").order("name"),
            ])
            setCustomerTypes(customerTypeData || [])
            setBreeds(breedData || [])
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

            const shouldFetchGrooming = serviceFilter === "all" || serviceFilter === "grooming"
            const shouldFetchGarden = serviceFilter === "all" || serviceFilter === "garden"

            const groomingPromise = shouldFetchGrooming
                ? supabase
                      .from("grooming_appointments")
                      .select(
                          `
                          id,
                          amount_due,
                          station_id,
                          start_at,
                          dogs (
                              id,
                              name,
                              breed_id,
                              breeds (
                                  id,
                                  name
                              )
                          ),
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

            const gardenPromise = shouldFetchGarden
                ? supabase
                      .from("daycare_appointments")
                      .select(
                          `
                          id,
                          amount_due,
                          station_id,
                          start_at,
                          dogs (
                              id,
                              name,
                              breed_id,
                              breeds (
                                  id,
                                  name
                              )
                          ),
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

            const [groomingResult, gardenResult] = await Promise.all([groomingPromise, gardenPromise])

            if (groomingResult.error || gardenResult.error) {
                throw groomingResult.error || gardenResult.error
            }

            const allAppointments = [
                ...(groomingResult.data || []).map((apt: any) => ({ ...apt, serviceType: "grooming" })),
                ...(gardenResult.data || []).map((apt: any) => ({ ...apt, serviceType: "garden" })),
            ]

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

            // Filter by breed
            if (breedFilter !== "all") {
                filteredAppointments = filteredAppointments.filter(
                    (apt: any) => apt.dogs?.breed_id === breedFilter || apt.dogs?.breeds?.id === breedFilter
                )
            }

            // Fetch breed categories for all breed IDs
            const breedIds = new Set<string>()
            filteredAppointments.forEach((apt: any) => {
                const breedId = apt.dogs?.breed_id || apt.dogs?.breeds?.id
                if (breedId) breedIds.add(breedId)
            })

            const breedCategoryMap: Record<string, string[]> = {}
            if (breedIds.size > 0) {
                const { data: breedCategories } = await supabase
                    .from("breed_dog_categories")
                    .select(
                        `
                        breed_id,
                        dog_category:dog_categories (
                            id,
                            name
                        )
                    `
                    )
                    .in("breed_id", Array.from(breedIds))

                if (breedCategories) {
                    breedCategories.forEach((item: any) => {
                        const breedId = item.breed_id
                        const categoryName = item.dog_category?.name
                        if (breedId && categoryName) {
                            if (!breedCategoryMap[breedId]) {
                                breedCategoryMap[breedId] = []
                            }
                            breedCategoryMap[breedId].push(categoryName)
                        }
                    })
                }
            }

            // Aggregate data
            const data: PaymentData = {
                total: 0,
                count: 0,
                byBreed: {},
                byBreedCategory: {},
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

                const breedId = apt.dogs?.breed_id || apt.dogs?.breeds?.id
                const breedName = apt.dogs?.breeds?.name || "ללא גזע"
                const stationId = apt.station_id
                const stationName = apt.stations?.name || "ללא עמדה"
                const clientCategoryName = apt.customers?.customer_type?.name || "ללא סוג"
                const breedCategories = breedId ? breedCategoryMap[breedId] || [] : []

                // By service
                if (apt.serviceType === "grooming") {
                    data.byService.grooming.total += amount
                    data.byService.grooming.count += 1
                } else {
                    data.byService.garden.total += amount
                    data.byService.garden.count += 1
                }

                // By breed
                if (breedId) {
                    if (!data.byBreed[breedId]) {
                        data.byBreed[breedId] = { total: 0, count: 0, breedName }
                    }
                    data.byBreed[breedId].total += amount
                    data.byBreed[breedId].count += 1
                }

                // By breed category
                breedCategories.forEach((categoryName) => {
                    if (!data.byBreedCategory[categoryName]) {
                        data.byBreedCategory[categoryName] = { total: 0, count: 0, categoryName }
                    }
                    data.byBreedCategory[categoryName].total += amount
                    data.byBreedCategory[categoryName].count += 1
                })

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
                    breedName,
                    breedCategoryName: breedCategories.join(", ") || undefined,
                    clientCategoryName,
                    stationName,
                    serviceType: apt.serviceType,
                    customerName: apt.customers?.full_name,
                    dogName: apt.dogs?.name,
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
    }, [startDate, endDate, serviceFilter, selectedStationIds, customerTypeFilter, breedFilter, toast])

    useEffect(() => {
        fetchPaymentData()
    }, [fetchPaymentData])

    const chartDataByBreed = useMemo(() => {
        if (!paymentData) return []
        return Object.entries(paymentData.byBreed)
            .map(([id, data]) => ({
                name: data.breedName,
                total: data.total,
                count: data.count,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
    }, [paymentData])

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
            { name: "גן", value: paymentData.byService.garden.total },
        ].filter((item) => item.value > 0)
    }, [paymentData])

    const chartDataByBreedCategory = useMemo(() => {
        if (!paymentData) return []
        return Object.entries(paymentData.byBreedCategory)
            .map(([name, data]) => ({
                name: data.categoryName,
                total: data.total,
                count: data.count,
            }))
            .sort((a, b) => b.total - a.total)
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

    const handleChartClick = (category: string, type: "date" | "breed" | "breedCategory" | "clientCategory" | "station" | "service") => {
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
            case "breed":
                filtered = paymentData.allAppointments.filter((apt) => apt.breedName === category)
                title = `פרטי תשלומים - ${category}`
                description = `סה"כ ${filtered.length} תורים`
                break
            case "breedCategory":
                filtered = paymentData.allAppointments.filter((apt) => apt.breedCategoryName?.includes(category))
                title = `פרטי תשלומים - קטגוריית גזע: ${category}`
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
                filtered = paymentData.allAppointments.filter((apt) => apt.serviceType === (category === "מספרה" ? "grooming" : "garden"))
                title = `פרטי תשלומים - ${category}`
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
                            <Label>סוג שירות</Label>
                            <Select value={serviceFilter} onValueChange={(v) => setServiceFilter(v as any)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">כל השירותים</SelectItem>
                                    <SelectItem value="grooming">מספרה</SelectItem>
                                    <SelectItem value="garden">גן</SelectItem>
                                </SelectContent>
                            </Select>
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

                        <div className="space-y-2">
                            <Label>גזע</Label>
                            <Select value={breedFilter} onValueChange={setBreedFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">כל הגזעים</SelectItem>
                                    {breeds.map((breed) => (
                                        <SelectItem key={breed.id} value={breed.id}>
                                            {breed.name}
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
                    <div className="grid gap-4 md:grid-cols-3">
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

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>גן</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-emerald-600">
                                    ₪{paymentData.byService.garden.total.toLocaleString("he-IL")}
                                </div>
                                <p className="text-sm text-slate-500 mt-1">{paymentData.byService.garden.count} תורים</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>גרפים וניתוח</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} dir="rtl">
                                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                                    <TabsTrigger value="byDate">לפי תאריך</TabsTrigger>
                                    <TabsTrigger value="byBreed">לפי גזע</TabsTrigger>
                                    <TabsTrigger value="byBreedCategory">לפי קטגוריית גזע</TabsTrigger>
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

                                <TabsContent value="byBreed" className="mt-6">
                                    <div className="h-80">
                                        <HighchartsReact
                                            highcharts={Highcharts}
                                            options={{
                                                chart: {
                                                    type: "bar",
                                                    backgroundColor: "transparent",
                                                    style: { fontFamily: "inherit" },
                                                },
                                                title: { text: null },
                                                xAxis: {
                                                    categories: chartDataByBreed.map((d) => d.name),
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
                                                    bar: {
                                                        borderRadius: 4,
                                                        dataLabels: {
                                                            enabled: false,
                                                        },
                                                        cursor: "pointer",
                                                        point: {
                                                            events: {
                                                                click: function (this: any) {
                                                                    handleChartClick(this.category, "breed")
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series: [
                                                    {
                                                        name: "סכום",
                                                        data: chartDataByBreed.map((d) => d.total),
                                                        color: "#10b981",
                                                    },
                                                ],
                                                credits: { enabled: false },
                                            }}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="byBreedCategory" className="mt-6">
                                    <div className="h-80">
                                        <HighchartsReact
                                            highcharts={Highcharts}
                                            options={{
                                                chart: {
                                                    type: "bar",
                                                    backgroundColor: "transparent",
                                                    style: { fontFamily: "inherit" },
                                                },
                                                title: { text: null },
                                                xAxis: {
                                                    categories: chartDataByBreedCategory.map((d) => d.name),
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
                                                    bar: {
                                                        borderRadius: 4,
                                                        dataLabels: {
                                                            enabled: false,
                                                        },
                                                        cursor: "pointer",
                                                        point: {
                                                            events: {
                                                                click: function (this: any) {
                                                                    handleChartClick(this.category, "breedCategory")
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                                series: [
                                                    {
                                                        name: "סכום",
                                                        data: chartDataByBreedCategory.map((d) => d.total),
                                                        color: "#f59e0b",
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
                        key: "serviceType",
                        label: "סוג שירות",
                        render: (value) => value === "grooming" ? "מספרה" : "גן",
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
                        key: "dogName",
                        label: "כלב",
                    },
                    {
                        key: "breedName",
                        label: "גזע",
                    },
                    {
                        key: "breedCategoryName",
                        label: "קטגוריית גזע",
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

