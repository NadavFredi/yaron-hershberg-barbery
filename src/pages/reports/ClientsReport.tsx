import { useCallback, useEffect, useMemo, useState } from "react"
import { Users, Loader2, RefreshCw, CalendarIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Highcharts from "highcharts"
import HighchartsReact from "highcharts-react-official"
import { ChartDetailModal } from "@/components/reports/ChartDetailModal"
import { format, startOfDay, endOfDay, subDays } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

interface ClientDetail {
    id: string
    fullName: string
    customerTypeName: string
    createdAt: string
}

interface ClientsData {
    totalClients: number
    byCustomerType: Array<{ name: string; count: number }>
    byDate: Array<{ date: string; count: number }>
    allClients: ClientDetail[]
}

// Helper function to safely format dates
const formatDateSafe = (dateString: string | null | undefined, formatStr: string = "dd/MM/yyyy"): string => {
    if (!dateString) return "ללא"
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return "ללא"
        return format(date, formatStr)
    } catch {
        return "ללא"
    }
}

export default function ClientsReport() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [clientsData, setClientsData] = useState<ClientsData | null>(null)
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [detailModalData, setDetailModalData] = useState<any[]>([])
    const [detailModalTitle, setDetailModalTitle] = useState("")
    const [detailModalDescription, setDetailModalDescription] = useState("")

    // Date range filter for the "byDate" chart
    const initialStartDate = useMemo(() => subDays(new Date(), 30), [])
    const initialEndDate = useMemo(() => new Date(), [])
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialStartDate,
        to: initialEndDate,
    })


    const fetchClientsData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Fetch ALL customers (date range filter only applies to byDate chart)
            const { data: customers, error: customersError } = await supabase
                .from("customers")
                .select(`
                    id,
                    full_name,
                    customer_type_id,
                    created_at,
                    customer_type:customer_types (
                        id,
                        name
                    )
                `)
                .order("created_at", { ascending: false })

            if (customersError) throw customersError

            // Aggregate data (no dogs in barbershop)
            const byCustomerType: Record<string, number> = {}
            const byDate: Record<string, number> = {}

            // Build all clients detail array
            const allClients: ClientDetail[] = []
            customers?.forEach((customer) => {
                const typeName = customer.customer_type?.name || "ללא סוג"
                byCustomerType[typeName] = (byCustomerType[typeName] || 0) + 1

                // Count by date (for all customers - filtering happens later)
                if (customer.created_at) {
                    const dateKey = customer.created_at.split("T")[0]
                    byDate[dateKey] = (byDate[dateKey] || 0) + 1
                }

                allClients.push({
                    id: customer.id,
                    fullName: customer.full_name || "ללא שם",
                    customerTypeName: typeName,
                    createdAt: customer.created_at || "",
                })
            })

            // Build byDate array
            const byDateArray = Object.entries(byDate)
                .map(([date, count]) => {
                    const formattedDate = formatDateSafe(date, "dd/MM")
                    return {
                        date: formattedDate,
                        count,
                        sortKey: date,
                    }
                })
                .filter((item) => item.date !== "ללא")
                .sort((a, b) => {
                    try {
                        const dateA = new Date(a.sortKey)
                        const dateB = new Date(b.sortKey)
                        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0
                        return dateA.getTime() - dateB.getTime()
                    } catch {
                        return 0
                    }
                })
                .map(({ sortKey, ...item }) => item)

            setClientsData({
                totalClients: customers?.length || 0,
                byCustomerType: Object.entries(byCustomerType)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count),
                byDate: byDateArray, // This contains all dates, will be filtered in useMemo
                allClients,
            })
        } catch (error) {
            console.error("Failed to fetch clients data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לטעון נתוני לקוחות",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [toast])

    useEffect(() => {
        fetchClientsData()
    }, [fetchClientsData])

    const handleRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range)
    }

    const dateRangeLabel = useMemo(() => {
        if (!dateRange?.from && !dateRange?.to) {
            return "בחר טווח תאריכים"
        }
        const fromLabel = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : ""
        const toLabel = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : fromLabel
        return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`
    }, [dateRange])

    // Filter byDate array based on date range and calculate totals
    const filteredByDate = useMemo(() => {
        if (!clientsData) return []

        if (!dateRange?.from && !dateRange?.to) {
            // No date range selected, return all dates
            return clientsData.byDate
        }

        return clientsData.byDate.filter((item) => {
            // Parse the date from the formatted string (dd/MM format)
            try {
                const [day, month] = item.date.split("/")
                const currentYear = new Date().getFullYear()
                const itemDate = new Date(currentYear, parseInt(month) - 1, parseInt(day))

                if (isNaN(itemDate.getTime())) return false

                const isInRange =
                    (!dateRange.from || itemDate >= startOfDay(dateRange.from)) &&
                    (!dateRange.to || itemDate <= endOfDay(dateRange.to))

                return isInRange
            } catch {
                return false
            }
        })
    }, [clientsData, dateRange])

    // Calculate total customers in the selected date range and filter clients
    const { totalCustomersInRange, clientsInRange } = useMemo(() => {
        if (!clientsData || !dateRange?.from) {
            return { totalCustomersInRange: 0, clientsInRange: [] }
        }

        const filteredClients = clientsData.allClients.filter((client) => {
            if (!client.createdAt) return false
            const clientDate = new Date(client.createdAt)
            const isInRange =
                (!dateRange.from || clientDate >= startOfDay(dateRange.from)) &&
                (!dateRange.to || clientDate <= endOfDay(dateRange.to))
            return isInRange
        })

        return {
            totalCustomersInRange: filteredClients.length,
            clientsInRange: filteredClients,
        }
    }, [clientsData, dateRange])

    const handleTotalCustomersClick = () => {
        if (clientsInRange.length === 0) return

        setDetailModalTitle(`לקוחות שנוצרו בטווח ${dateRangeLabel}`)
        setDetailModalDescription(`סה"כ ${clientsInRange.length} לקוחות`)
        setDetailModalData(clientsInRange.map((client) => ({
            id: client.id,
            "שם לקוח": client.fullName,
            "סוג לקוח": client.customerTypeName,
            "תאריך יצירה": formatDateSafe(client.createdAt, "dd/MM/yyyy"),
        })))
        setDetailModalOpen(true)
    }

    const handleChartClick = (category: string, chartType: string) => {
        if (!clientsData) return

        let filtered: any[] = []
        let title = ""
        let description = ""

        switch (chartType) {
            case "byCustomerType":
                filtered = clientsData.allClients.filter((c) => c.customerTypeName === category)
                title = `פרטי לקוחות - ${category}`
                description = `סה"כ ${filtered.length} לקוחות`
                break
            case "byDate":
                // Convert dd/MM back to date for filtering
                const [day, month] = category.split("/")
                filtered = clientsData.allClients.filter((c) => {
                    if (!c.createdAt) return false
                    try {
                        const createdDate = c.createdAt.split("T")[0]
                        const date = new Date(createdDate)
                        if (isNaN(date.getTime())) return false
                        return format(date, "dd/MM") === category
                    } catch {
                        return false
                    }
                })
                title = `פרטי לקוחות - ${category}`
                description = `סה"כ ${filtered.length} לקוחות שנוצרו בתאריך זה`
                break
        }

        setDetailModalTitle(title)
        setDetailModalDescription(description)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    const getChartOptions = (type: string, filteredByDateData?: Array<{ date: string; count: number }>) => {
        if (!clientsData) return null

        const commonOptions: any = {
            chart: {
                backgroundColor: "transparent",
                style: { fontFamily: "inherit" },
            },
            title: { text: null },
            credits: { enabled: false },
            tooltip: {
                useHTML: true,
                style: { direction: "rtl" },
            },
        }

        switch (type) {
            case "byCustomerType":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "pie" },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.point.name}</div>
                                <div><span style="color: ${this.point.color}">●</span> כמות: <strong>${this.point.y}</strong></div>
                                <div>אחוז: <strong>${this.point.percentage.toFixed(1)}%</strong></div>`
                        },
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
                                        handleChartClick(this.name, "byCustomerType")
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
                            name: "לקוחות",
                            data: clientsData.byCustomerType.map((d, i) => ({
                                name: d.name,
                                y: d.count,
                                color: COLORS[i % COLORS.length],
                            })),
                        },
                    ],
                }

            case "byDate":
                const byDateData = filteredByDateData || clientsData.byDate
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "line" },
                    xAxis: {
                        categories: byDateData.map((d) => d.date),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "כמות לקוחות",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: { style: { fontSize: "12px" } },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> כמות לקוחות: <strong>${this.y}</strong></div>`
                        },
                    },
                    plotOptions: {
                        line: {
                            marker: { enabled: true, radius: 4 },
                            cursor: "pointer",
                            point: {
                                events: {
                                    click: function (this: any) {
                                        handleChartClick(this.category, "byDate")
                                    },
                                },
                            },
                        },
                    },
                    series: [
                        {
                            name: "כמות לקוחות",
                            data: byDateData.map((d) => d.count),
                            color: COLORS[0],
                        },
                    ],
                }

            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <Users className="h-7 w-7 text-primary" />
                        דוח לקוחות
                    </h1>
                    <p className="text-slate-600">סטטיסטיקות מפורטות על לקוחות</p>
                </div>
                <Button onClick={fetchClientsData} disabled={isLoading} variant="outline" size="sm">
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

            {clientsData && (
                <>
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                                setDetailModalTitle("כל הלקוחות")
                                setDetailModalDescription(`סה"כ ${clientsData.totalClients} לקוחות`)
                                setDetailModalData(clientsData.allClients.map((client) => ({
                                    id: client.id,
                                    "שם לקוח": client.fullName,
                                    "סוג לקוח": client.customerTypeName,
                                    "תאריך יצירה": formatDateSafe(client.createdAt, "dd/MM/yyyy"),
                                })))
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>סה"כ לקוחות</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-primary">{clientsData.totalClients}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-1 mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>התפלגות לפי סוג לקוח</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80">
                                    {getChartOptions("byCustomerType") && (
                                        <HighchartsReact highcharts={Highcharts} options={getChartOptions("byCustomerType")} />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-1 mt-6">
                        <Card>
                            <CardHeader className="relative">
                                <div className="flex items-center justify-between mb-2">
                                    <CardTitle>לקוחות שנוצרו לפי תאריך</CardTitle>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs justify-between gap-2 min-w-[180px]"
                                            >
                                                <span className="truncate">{dateRangeLabel}</span>
                                                <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                numberOfMonths={1}
                                                dir="rtl"
                                                selected={dateRange}
                                                onSelect={handleRangeSelect}
                                                defaultMonth={dateRange?.from ?? new Date()}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                    <button
                                        type="button"
                                        onClick={handleTotalCustomersClick}
                                        disabled={totalCustomersInRange === 0}
                                        className="flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="text-sm text-slate-600">סה"כ נרשמו בטווח:</div>
                                        <div className="text-lg font-bold text-primary underline decoration-dotted">
                                            {totalCustomersInRange}
                                        </div>
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80">
                                    {filteredByDate.length > 0 && getChartOptions("byDate", filteredByDate) && (
                                        <HighchartsReact highcharts={Highcharts} options={getChartOptions("byDate", filteredByDate)} />
                                    )}
                                    {filteredByDate.length === 0 && (
                                        <div className="flex items-center justify-center h-full text-slate-500">
                                            אין נתונים בטווח התאריכים שנבחר
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detail Modal */}
                    <ChartDetailModal
                        open={detailModalOpen}
                        onOpenChange={setDetailModalOpen}
                        title={detailModalTitle}
                        description={detailModalDescription}
                        data={detailModalData.map((item) => {
                            // Check if data is already in Hebrew key format (from summary cards or chart clicks)
                            if ("שם לקוח" in item && "סוג לקוח" in item) {
                                // Already formatted for clients
                                return item
                            }

                            // Check if it's a client detail (raw format)
                            if ("fullName" in item) {
                                return {
                                    id: item.id,
                                    "שם לקוח": item.fullName,
                                    "סוג לקוח": item.customerTypeName,
                                    "תאריך יצירה": formatDateSafe(item.createdAt, "dd/MM/yyyy"),
                                }
                            }
                            // Fallback
                            return item
                        })}
                        columns={[
                            { key: "שם לקוח", label: "שם לקוח" },
                            { key: "סוג לקוח", label: "סוג לקוח" },
                            { key: "תאריך יצירה", label: "תאריך יצירה" },
                        ]}
                    />
                </>
            )}
        </div>
    )
}



