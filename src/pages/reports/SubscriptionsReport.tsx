import { useCallback, useEffect, useMemo, useState } from "react"
import { endOfDay, format, startOfDay, subDays } from "date-fns"
import { Ticket, Loader2, RefreshCw, Calendar as CalendarIcon, TrendingUp } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import Highcharts from "highcharts"
import HighchartsReact from "highcharts-react-official"
import { ChartDetailModal } from "@/components/reports/ChartDetailModal"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

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

interface SubscriptionData {
    total: number
    active: number
    expired: number
    totalRevenue: number
    byType: Array<{ name: string; count: number; totalEntries: number; usedEntries: number; revenue: number }>
    byDate: Array<{ date: string; count: number; revenue: number }>
    byStatus: Array<{ name: string; count: number; revenue: number }>
    byRemainingEntries: Array<{ range: string; count: number }>
    byRemainingDays: Array<{ range: string; count: number }>
    byTypeRevenue: Array<{ name: string; revenue: number; count: number }>
    byDateRevenue: Array<{ date: string; revenue: number; count: number }>
    allSubscriptions: Array<{
        id: string
        purchaseDate: string
        expiresOn: string | null
        ticketTypeName: string
        customerName: string
        totalEntries: number | null
        usedEntries: number
        remainingEntries: number | null
        remainingDays: number | null
        isActive: boolean
        purchasePrice: number
    }>
}

export default function SubscriptionsReport() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(false)
    const [subscriptionsData, setSubscriptionsData] = useState<SubscriptionData | null>(null)
    const initialStartDate = useMemo(() => subDays(new Date(), 30), [])
    const initialEndDate = useMemo(() => new Date(), [])
    const [startDate, setStartDate] = useState<Date | null>(initialStartDate)
    const [endDate, setEndDate] = useState<Date | null>(initialEndDate)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialStartDate,
        to: initialEndDate,
    })
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

    const fetchSubscriptionsData = useCallback(async () => {
        setIsLoading(true)
        try {
            const fromIso = startDate ? startOfDay(startDate).toISOString() : undefined
            const toIso = endDate ? endOfDay(endDate).toISOString() : undefined

            console.log("🔍 [SubscriptionsReport] Fetching subscriptions data...", { fromIso, toIso })

            // Fetch tickets with their types and customers
            let ticketsQuery = supabase
                .from("tickets")
                .select(
                    `
                    id,
                    customer_id,
                    ticket_type_id,
                    expires_on,
                    total_entries,
                    purchase_date,
                    purchase_price,
                    created_at,
                    ticket_types:ticket_type_id (
                        id,
                        name,
                        type,
                        total_entries,
                        days_duration
                    ),
                    customers (
                        id,
                        full_name
                    )
                `
                )
                .order("purchase_date", { ascending: false })

            // Filter by purchase date range
            if (fromIso) {
                ticketsQuery = ticketsQuery.gte("purchase_date", fromIso.split("T")[0])
            }
            if (toIso) {
                ticketsQuery = ticketsQuery.lte("purchase_date", toIso.split("T")[0])
            }

            const { data: tickets, error: ticketsError } = await ticketsQuery

            if (ticketsError) {
                console.error("❌ [SubscriptionsReport] Error fetching tickets:", ticketsError)
                throw ticketsError
            }

            console.log(`✅ [SubscriptionsReport] Found ${tickets?.length ?? 0} tickets`)
            if (tickets && tickets.length > 0) {
                console.log("🔍 [SubscriptionsReport] Sample ticket:", JSON.stringify(tickets[0], null, 2))
            }

            // If customers aren't in the response, fetch them separately
            const customerIds = tickets ? [...new Set(tickets.map((t: any) => t.customer_id).filter(Boolean))] : []
            let customerMap = new Map<string, { id: string; full_name: string }>()
            
            if (customerIds.length > 0) {
                const { data: customersData, error: customersError } = await supabase
                    .from("customers")
                    .select("id, full_name")
                    .in("id", customerIds)
                
                if (customersError) {
                    console.error("❌ [SubscriptionsReport] Error fetching customers:", customersError)
                } else if (customersData) {
                    customersData.forEach((c: any) => {
                        customerMap.set(c.id, c)
                    })
                    console.log(`✅ [SubscriptionsReport] Fetched ${customersData.length} customers`)
                }
            }

            if (!tickets || tickets.length === 0) {
                setSubscriptionsData({
                    total: 0,
                    active: 0,
                    expired: 0,
                    totalRevenue: 0,
                    byType: [],
                    byDate: [],
                    byStatus: [],
                    byRemainingEntries: [],
                    byRemainingDays: [],
                    byTypeRevenue: [],
                    byDateRevenue: [],
                    allSubscriptions: [],
                })
                return
            }

            // Fetch all usages for these tickets
            const ticketIds = tickets.map((t: any) => t.id)
            const { data: usages, error: usagesError } = await supabase
                .from("ticket_usages")
                .select("ticket_id, units_used")
                .in("ticket_id", ticketIds)

            if (usagesError) {
                console.error("❌ [SubscriptionsReport] Error fetching usages:", usagesError)
                // Continue without usages - we'll assume 0 usage
            }

            // Calculate usage per ticket
            const usageMap = new Map<string, number>()
            if (usages) {
                usages.forEach((usage: any) => {
                    const current = usageMap.get(usage.ticket_id) || 0
                    usageMap.set(usage.ticket_id, current + Number(usage.units_used || 0))
                })
            }

            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Process tickets
            const byTypeMap = new Map<string, { count: number; totalEntries: number; usedEntries: number; revenue: number }>()
            const byDateMap = new Map<string, { count: number; revenue: number }>()
            let activeCount = 0
            let expiredCount = 0
            let totalRevenue = 0
            const allSubscriptions: SubscriptionData["allSubscriptions"] = []

            tickets.forEach((ticket: any) => {
                const ticketType = Array.isArray(ticket.ticket_types) ? ticket.ticket_types[0] : ticket.ticket_types
                const ticketTypeName = ticketType?.name || "ללא סוג"
                
                // Handle customer data - try from nested query first, then fallback to manual lookup
                let customerName = "ללא שם"
                if (ticket.customers) {
                    if (Array.isArray(ticket.customers)) {
                        customerName = ticket.customers[0]?.full_name || "ללא שם"
                    } else {
                        customerName = ticket.customers.full_name || "ללא שם"
                    }
                } else if (ticket.customer_id && customerMap.has(ticket.customer_id)) {
                    // Fallback to manual lookup if nested query didn't work
                    customerName = customerMap.get(ticket.customer_id)!.full_name
                }

                const usedEntries = usageMap.get(ticket.id) || 0
                const totalEntries = ticket.total_entries
                const remainingEntries = totalEntries !== null ? totalEntries - usedEntries : null
                const purchasePrice = Number(ticket.purchase_price || 0)
                totalRevenue += purchasePrice

                // Calculate remaining days
                let remainingDays: number | null = null
                if (ticket.expires_on) {
                    const expiryDate = new Date(ticket.expires_on)
                    expiryDate.setHours(0, 0, 0, 0)
                    const diffTime = expiryDate.getTime() - today.getTime()
                    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                }

                // Determine if active
                const isExpired = ticket.expires_on ? new Date(ticket.expires_on) < today : false
                const hasRemaining = totalEntries === null || remainingEntries! > 0
                const isActive = !isExpired && hasRemaining

                if (isActive) {
                    activeCount++
                } else {
                    expiredCount++
                }

                // By type
                if (!byTypeMap.has(ticketTypeName)) {
                    byTypeMap.set(ticketTypeName, { count: 0, totalEntries: 0, usedEntries: 0, revenue: 0 })
                }
                const typeData = byTypeMap.get(ticketTypeName)!
                typeData.count += 1
                typeData.totalEntries += totalEntries || 0
                typeData.usedEntries += usedEntries
                typeData.revenue += purchasePrice

                // By date
                const purchaseDate = ticket.purchase_date || ticket.created_at.split("T")[0]
                const dateKey = purchaseDate
                if (!byDateMap.has(dateKey)) {
                    byDateMap.set(dateKey, { count: 0, revenue: 0 })
                }
                const dateData = byDateMap.get(dateKey)!
                dateData.count += 1
                dateData.revenue += purchasePrice

                // Store for detail modal
                allSubscriptions.push({
                    id: ticket.id,
                    purchaseDate,
                    expiresOn: ticket.expires_on,
                    ticketTypeName,
                    customerName,
                    totalEntries,
                    usedEntries,
                    remainingEntries,
                    remainingDays,
                    isActive,
                    purchasePrice,
                })
            })

            // Build byType array
            const byTypeArray = Array.from(byTypeMap.entries())
                .map(([name, data]) => ({
                    name,
                    count: data.count,
                    totalEntries: data.totalEntries,
                    usedEntries: data.usedEntries,
                    revenue: data.revenue,
                }))
                .sort((a, b) => b.count - a.count)

            // Build byDate array
            const byDateArray = Array.from(byDateMap.entries())
                .map(([date, data]) => {
                    const formattedDate = formatDateSafe(date, "dd/MM")
                    return {
                        date: formattedDate,
                        count: data.count,
                        revenue: data.revenue,
                        sortKey: date, // Keep original for sorting
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
                .map(({ sortKey, ...item }) => item) // Remove sortKey from final result

            // Build byStatus array with revenue
            const activeRevenue = allSubscriptions.filter((s) => s.isActive).reduce((sum, s) => sum + s.purchasePrice, 0)
            const expiredRevenue = allSubscriptions.filter((s) => !s.isActive).reduce((sum, s) => sum + s.purchasePrice, 0)
            const byStatusArray = [
                { name: "פעיל", count: activeCount, revenue: activeRevenue },
                { name: "פג תוקף", count: expiredCount, revenue: expiredRevenue },
            ]

            // Build byTypeRevenue array (sorted by revenue)
            const byTypeRevenueArray = Array.from(byTypeMap.entries())
                .map(([name, data]) => ({
                    name,
                    revenue: data.revenue,
                    count: data.count,
                }))
                .sort((a, b) => b.revenue - a.revenue)

            // Build byDateRevenue array (sorted by date)
            const byDateRevenueArray = Array.from(byDateMap.entries())
                .map(([date, data]) => {
                    const formattedDate = formatDateSafe(date, "dd/MM")
                    return {
                        date: formattedDate,
                        revenue: data.revenue,
                        count: data.count,
                        sortKey: date, // Keep original for sorting
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
                .map(({ sortKey, ...item }) => item) // Remove sortKey from final result

            // Build byRemainingEntries array
            const remainingEntriesRanges = [
                { range: "0 (ריק)", min: 0, max: 0 },
                { range: "1-3", min: 1, max: 3 },
                { range: "4-10", min: 4, max: 10 },
                { range: "11-20", min: 11, max: 20 },
                { range: "21+", min: 21, max: Infinity },
                { range: "ללא הגבלה", min: null, max: null },
            ]

            const byRemainingEntriesMap = new Map<string, number>()
            allSubscriptions.forEach((sub) => {
                if (sub.totalEntries === null) {
                    byRemainingEntriesMap.set("ללא הגבלה", (byRemainingEntriesMap.get("ללא הגבלה") || 0) + 1)
                } else if (sub.remainingEntries !== null) {
                    const range = remainingEntriesRanges.find(
                        (r) => r.min !== null && sub.remainingEntries! >= r.min && sub.remainingEntries! <= (r.max === Infinity ? 999999 : r.max)
                    )
                    if (range) {
                        byRemainingEntriesMap.set(range.range, (byRemainingEntriesMap.get(range.range) || 0) + 1)
                    }
                }
            })

            const byRemainingEntriesArray = remainingEntriesRanges
                .filter((r) => byRemainingEntriesMap.has(r.range))
                .map((r) => ({
                    range: r.range,
                    count: byRemainingEntriesMap.get(r.range) || 0,
                }))

            // Build byRemainingDays array
            const remainingDaysRanges = [
                { range: "פג תוקף", min: -Infinity, max: -1 },
                { range: "0-7 ימים", min: 0, max: 7 },
                { range: "8-30 ימים", min: 8, max: 30 },
                { range: "31-90 ימים", min: 31, max: 90 },
                { range: "91+ ימים", min: 91, max: Infinity },
                { range: "ללא תאריך תפוגה", min: null, max: null },
            ]

            const byRemainingDaysMap = new Map<string, number>()
            allSubscriptions.forEach((sub) => {
                if (sub.remainingDays === null) {
                    byRemainingDaysMap.set("ללא תאריך תפוגה", (byRemainingDaysMap.get("ללא תאריך תפוגה") || 0) + 1)
                } else {
                    const range = remainingDaysRanges.find(
                        (r) => r.min !== null && sub.remainingDays! >= r.min && sub.remainingDays! <= (r.max === Infinity ? 999999 : r.max)
                    )
                    if (range) {
                        byRemainingDaysMap.set(range.range, (byRemainingDaysMap.get(range.range) || 0) + 1)
                    }
                }
            })

            const byRemainingDaysArray = remainingDaysRanges
                .filter((r) => byRemainingDaysMap.has(r.range))
                .map((r) => ({
                    range: r.range,
                    count: byRemainingDaysMap.get(r.range) || 0,
                }))

            setSubscriptionsData({
                total: tickets.length,
                active: activeCount,
                expired: expiredCount,
                totalRevenue,
                byType: byTypeArray,
                byDate: byDateArray,
                byStatus: byStatusArray,
                byRemainingEntries: byRemainingEntriesArray,
                byRemainingDays: byRemainingDaysArray,
                byTypeRevenue: byTypeRevenueArray,
                byDateRevenue: byDateRevenueArray,
                allSubscriptions,
            })
        } catch (error) {
            console.error("❌ [SubscriptionsReport] Failed to fetch subscriptions data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לטעון נתוני מנויים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }, [startDate, endDate, toast])

    useEffect(() => {
        fetchSubscriptionsData()
    }, [fetchSubscriptionsData])

    const handleChartClick = (category: string, chartType: string) => {
        if (!subscriptionsData) return

        let filtered: any[] = []
        let title = ""
        let description = ""

        switch (chartType) {
            case "byType":
                filtered = subscriptionsData.allSubscriptions.filter((s) => s.ticketTypeName === category)
                title = `פרטי מנויים - ${category}`
                description = `סה"כ ${filtered.length} מנויים`
                break
            case "byDate":
                // Convert dd/MM back to date for filtering
                const [day, month] = category.split("/")
                const year = new Date().getFullYear()
                const dateStr = `${year}-${month}-${day}`
                filtered = subscriptionsData.allSubscriptions.filter((s) => {
                    if (!s.purchaseDate) return false
                    try {
                        const purchaseDate = s.purchaseDate.split("T")[0]
                        const date = new Date(purchaseDate)
                        if (isNaN(date.getTime())) return false
                        return format(date, "dd/MM") === category
                    } catch {
                        return false
                    }
                })
                title = `פרטי מנויים - ${category}`
                description = `סה"כ ${filtered.length} מנויים`
                break
            case "byStatus":
                const isActiveStatus = category === "פעיל"
                filtered = subscriptionsData.allSubscriptions.filter((s) => s.isActive === isActiveStatus)
                title = `פרטי מנויים - ${category}`
                description = `סה"כ ${filtered.length} מנויים`
                break
            case "byRemainingEntries":
                // Parse range
                if (category === "ללא הגבלה") {
                    filtered = subscriptionsData.allSubscriptions.filter((s) => s.totalEntries === null)
                } else if (category === "0 (ריק)") {
                    filtered = subscriptionsData.allSubscriptions.filter((s) => s.remainingEntries === 0)
                } else {
                    const [min, max] = category.split("-").map((n) => (n.includes("+") ? Infinity : parseInt(n)))
                    filtered = subscriptionsData.allSubscriptions.filter((s) => {
                        if (s.remainingEntries === null) return false
                        return s.remainingEntries >= min && s.remainingEntries <= max
                    })
                }
                title = `פרטי מנויים - יתרה ${category}`
                description = `סה"כ ${filtered.length} מנויים`
                break
            case "byRemainingDays":
                // Parse range
                if (category === "ללא תאריך תפוגה") {
                    filtered = subscriptionsData.allSubscriptions.filter((s) => s.remainingDays === null)
                } else if (category === "פג תוקף") {
                    filtered = subscriptionsData.allSubscriptions.filter((s) => s.remainingDays !== null && s.remainingDays < 0)
                } else {
                    const match = category.match(/(\d+)-(\d+)/)
                    if (match) {
                        const min = parseInt(match[1])
                        const max = match[2] === "+" ? Infinity : parseInt(match[2])
                        filtered = subscriptionsData.allSubscriptions.filter((s) => {
                            if (s.remainingDays === null) return false
                            return s.remainingDays >= min && s.remainingDays <= max
                        })
                    }
                }
                title = `פרטי מנויים - ${category}`
                description = `סה"כ ${filtered.length} מנויים`
                break
        }

        setDetailModalTitle(title)
        setDetailModalDescription(description)
        setDetailModalData(filtered)
        setDetailModalOpen(true)
    }

    const getChartOptions = (type: string) => {
        if (!subscriptionsData) return null

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
            legend: {
                align: "center",
                verticalAlign: "bottom",
                itemStyle: { fontSize: "13px", fontWeight: "500" },
                margin: 30,
                padding: 15,
                itemMarginBottom: 10,
            },
        }

        switch (type) {
            case "byType":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "column" },
                    xAxis: {
                        categories: subscriptionsData.byType.map((d) => d.name),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "כמות מנויים",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: { style: { fontSize: "12px" } },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            const data = subscriptionsData.byType[this.point.index]
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> כמות מנויים: <strong>${this.y}</strong></div>
                                <div>סה"כ כניסות: <strong>${data.totalEntries}</strong></div>
                                <div>כניסות משומשות: <strong>${data.usedEntries}</strong></div>
                                <div>הכנסות: <strong>₪${data.revenue.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>`
                        },
                    },
                    plotOptions: {
                        column: {
                            borderRadius: 4,
                            dataLabels: { enabled: false },
                            cursor: "pointer",
                            point: {
                                events: {
                                    click: function (this: any) {
                                        handleChartClick(this.category, "byType")
                                    },
                                },
                            },
                        },
                    },
                    series: [
                        {
                            name: "כמות מנויים",
                            data: subscriptionsData.byType.map((d, i) => ({
                                y: d.count,
                                color: COLORS[i % COLORS.length],
                            })),
                        },
                    ],
                }

            case "byDate":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "line" },
                    xAxis: {
                        categories: subscriptionsData.byDate.map((d) => d.date),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "כמות מנויים",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: { style: { fontSize: "12px" } },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            const data = subscriptionsData.byDate[this.point.index]
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> כמות מנויים: <strong>${this.y}</strong></div>
                                <div>הכנסות: <strong>₪${data.revenue.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>`
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
                            name: "כמות מנויים",
                            data: subscriptionsData.byDate.map((d) => d.count),
                            color: COLORS[0],
                        },
                    ],
                }

            case "byStatus":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "pie" },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            const statusData = subscriptionsData.byStatus.find((s) => s.name === this.point.name)
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.point.name}</div>
                                <div><span style="color: ${this.point.color}">●</span> כמות: <strong>${this.point.y}</strong></div>
                                <div>אחוז: <strong>${this.point.percentage.toFixed(1)}%</strong></div>
                                ${statusData ? `<div>הכנסות: <strong>₪${statusData.revenue.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>` : ""}`
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
                                        handleChartClick(this.name, "byStatus")
                                    },
                                },
                            },
                        },
                    },
                    series: [
                        {
                            name: "מנויים",
                            data: subscriptionsData.byStatus.map((d, i) => ({
                                name: d.name,
                                y: d.count,
                                color: COLORS[i % COLORS.length],
                            })),
                        },
                    ],
                }

            case "byRemainingEntries":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "column" },
                    xAxis: {
                        categories: subscriptionsData.byRemainingEntries.map((d) => d.range),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "כמות מנויים",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: { style: { fontSize: "12px" } },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> כמות מנויים: <strong>${this.y}</strong></div>`
                        },
                    },
                    plotOptions: {
                        column: {
                            borderRadius: 4,
                            dataLabels: { enabled: false },
                            cursor: "pointer",
                            point: {
                                events: {
                                    click: function (this: any) {
                                        handleChartClick(this.category, "byRemainingEntries")
                                    },
                                },
                            },
                        },
                    },
                    series: [
                        {
                            name: "כמות מנויים",
                            data: subscriptionsData.byRemainingEntries.map((d) => d.count),
                            color: COLORS[2],
                        },
                    ],
                }

            case "byRemainingDays":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "column" },
                    xAxis: {
                        categories: subscriptionsData.byRemainingDays.map((d) => d.range),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "כמות מנויים",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: { style: { fontSize: "12px" } },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> כמות מנויים: <strong>${this.y}</strong></div>`
                        },
                    },
                    plotOptions: {
                        column: {
                            borderRadius: 4,
                            dataLabels: { enabled: false },
                            cursor: "pointer",
                            point: {
                                events: {
                                    click: function (this: any) {
                                        handleChartClick(this.category, "byRemainingDays")
                                    },
                                },
                            },
                        },
                    },
                    series: [
                        {
                            name: "כמות מנויים",
                            data: subscriptionsData.byRemainingDays.map((d) => d.count),
                            color: COLORS[4],
                        },
                    ],
                }

            case "byTypeRevenue":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "column" },
                    xAxis: {
                        categories: subscriptionsData.byTypeRevenue.map((d) => d.name),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "הכנסות (₪)",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: {
                            style: { fontSize: "12px" },
                            formatter: function (this: any) {
                                return `₪${this.value.toLocaleString("he-IL")}`
                            },
                        },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            const data = subscriptionsData.byTypeRevenue[this.point.index]
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> הכנסות: <strong>₪${this.y.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                                <div>כמות מנויים: <strong>${data.count}</strong></div>`
                        },
                    },
                    plotOptions: {
                        column: {
                            borderRadius: 4,
                            dataLabels: { enabled: false },
                            cursor: "pointer",
                            point: {
                                events: {
                                    click: function (this: any) {
                                        handleChartClick(this.category, "byType")
                                    },
                                },
                            },
                        },
                    },
                    series: [
                        {
                            name: "הכנסות",
                            data: subscriptionsData.byTypeRevenue.map((d, i) => ({
                                y: d.revenue,
                                color: COLORS[i % COLORS.length],
                            })),
                        },
                    ],
                }

            case "byDateRevenue":
                return {
                    ...commonOptions,
                    chart: { ...commonOptions.chart, type: "column" },
                    xAxis: {
                        categories: subscriptionsData.byDateRevenue.map((d) => d.date),
                        labels: { style: { fontSize: "12px", fontWeight: "500" } },
                    },
                    yAxis: {
                        title: {
                            text: "הכנסות (₪)",
                            style: { fontSize: "13px", fontWeight: "600" },
                        },
                        labels: {
                            style: { fontSize: "12px" },
                            formatter: function (this: any) {
                                return `₪${this.value.toLocaleString("he-IL")}`
                            },
                        },
                    },
                    tooltip: {
                        ...commonOptions.tooltip,
                        formatter: function (this: any) {
                            const data = subscriptionsData.byDateRevenue[this.point.index]
                            return `<div style="font-weight: 600; margin-bottom: 4px;">${this.x}</div>
                                <div><span style="color: ${this.color}">●</span> הכנסות: <strong>₪${this.y.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                                <div>כמות מנויים: <strong>${data.count}</strong></div>`
                        },
                    },
                    plotOptions: {
                        column: {
                            borderRadius: 4,
                            dataLabels: { enabled: false },
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
                            name: "הכנסות",
                            data: subscriptionsData.byDateRevenue.map((d) => d.revenue),
                            color: COLORS[5],
                        },
                    ],
                }

            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Ticket className="h-7 w-7 text-primary" />
                    דוח מנויים
                </h1>
                <p className="text-slate-600">ניתוח מפורט של מנויים והתפלגותם</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-2">
                    <Label>טווח תאריכים</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-[280px] justify-start text-right font-normal",
                                    !dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {dateRangeLabel}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={handleRangeSelect}
                                numberOfMonths={2}
                                dir="rtl"
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <Button onClick={fetchSubscriptionsData} disabled={isLoading} variant="outline" size="sm">
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

            {subscriptionsData && (
                <>
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                                setDetailModalTitle("כל המנויים")
                                setDetailModalDescription(`סה"כ ${subscriptionsData.total} מנויים`)
                                setDetailModalData(subscriptionsData.allSubscriptions.map((sub) => ({
                                    id: sub.id,
                                    "סוג מנוי": sub.ticketTypeName,
                                    "לקוח": sub.customerName,
                                    "תאריך רכישה": formatDateSafe(sub.purchaseDate, "dd/MM/yyyy"),
                                    "תאריך תפוגה": formatDateSafe(sub.expiresOn, "dd/MM/yyyy"),
                                    "מחיר רכישה": Number(sub.purchasePrice ?? 0),
                                    "סה\"כ כניסות": sub.totalEntries != null ? String(sub.totalEntries) : "ללא הגבלה",
                                    "כניסות משומשות": sub.usedEntries != null ? String(sub.usedEntries) : "0",
                                    "יתרה": sub.remainingEntries != null ? String(sub.remainingEntries) : "ללא הגבלה",
                                    "יתרת ימים": sub.remainingDays != null ? String(sub.remainingDays) : "ללא תאריך תפוגה",
                                    "סטטוס": sub.isActive ? "פעיל" : "פג תוקף",
                                })))
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>סה"כ מנויים</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-primary">{subscriptionsData.total}</div>
                            </CardContent>
                        </Card>

                        <Card
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                                const activeSubs = subscriptionsData.allSubscriptions.filter((s) => s.isActive)
                                setDetailModalTitle("מנויים פעילים")
                                setDetailModalDescription(`סה"כ ${activeSubs.length} מנויים פעילים`)
                                setDetailModalData(activeSubs.map((sub) => ({
                                    id: sub.id,
                                    "סוג מנוי": sub.ticketTypeName,
                                    "לקוח": sub.customerName,
                                    "תאריך רכישה": formatDateSafe(sub.purchaseDate, "dd/MM/yyyy"),
                                    "תאריך תפוגה": formatDateSafe(sub.expiresOn, "dd/MM/yyyy"),
                                    "מחיר רכישה": Number(sub.purchasePrice ?? 0),
                                    "סה\"כ כניסות": sub.totalEntries != null ? String(sub.totalEntries) : "ללא הגבלה",
                                    "כניסות משומשות": sub.usedEntries != null ? String(sub.usedEntries) : "0",
                                    "יתרה": sub.remainingEntries != null ? String(sub.remainingEntries) : "ללא הגבלה",
                                    "יתרת ימים": sub.remainingDays != null ? String(sub.remainingDays) : "ללא תאריך תפוגה",
                                    "סטטוס": "פעיל",
                                })))
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>מנויים פעילים</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-emerald-600">{subscriptionsData.active}</div>
                            </CardContent>
                        </Card>

                        <Card
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                                const expiredSubs = subscriptionsData.allSubscriptions.filter((s) => !s.isActive)
                                setDetailModalTitle("מנויים פגי תוקף")
                                setDetailModalDescription(`סה"כ ${expiredSubs.length} מנויים פגי תוקף`)
                                setDetailModalData(expiredSubs.map((sub) => ({
                                    id: sub.id,
                                    "סוג מנוי": sub.ticketTypeName,
                                    "לקוח": sub.customerName,
                                    "תאריך רכישה": formatDateSafe(sub.purchaseDate, "dd/MM/yyyy"),
                                    "תאריך תפוגה": formatDateSafe(sub.expiresOn, "dd/MM/yyyy"),
                                    "מחיר רכישה": Number(sub.purchasePrice ?? 0),
                                    "סה\"כ כניסות": sub.totalEntries != null ? String(sub.totalEntries) : "ללא הגבלה",
                                    "כניסות משומשות": sub.usedEntries != null ? String(sub.usedEntries) : "0",
                                    "יתרה": sub.remainingEntries != null ? String(sub.remainingEntries) : "ללא הגבלה",
                                    "יתרת ימים": sub.remainingDays != null ? String(sub.remainingDays) : "ללא תאריך תפוגה",
                                    "סטטוס": "פג תוקף",
                                })))
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>מנויים פגי תוקף</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-rose-600">{subscriptionsData.expired}</div>
                            </CardContent>
                        </Card>

                        <Card
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                                setDetailModalTitle("סה\"כ הכנסות")
                                setDetailModalDescription(`סה"כ הכנסות: ₪${subscriptionsData.totalRevenue.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                                setDetailModalData(subscriptionsData.allSubscriptions.map((sub) => ({
                                    id: sub.id,
                                    "סוג מנוי": sub.ticketTypeName,
                                    "לקוח": sub.customerName,
                                    "תאריך רכישה": formatDateSafe(sub.purchaseDate, "dd/MM/yyyy"),
                                    "תאריך תפוגה": formatDateSafe(sub.expiresOn, "dd/MM/yyyy"),
                                    "מחיר רכישה": Number(sub.purchasePrice ?? 0),
                                    "סה\"כ כניסות": sub.totalEntries != null ? String(sub.totalEntries) : "ללא הגבלה",
                                    "כניסות משומשות": sub.usedEntries != null ? String(sub.usedEntries) : "0",
                                    "יתרה": sub.remainingEntries != null ? String(sub.remainingEntries) : "ללא הגבלה",
                                    "יתרת ימים": sub.remainingDays != null ? String(sub.remainingDays) : "ללא תאריך תפוגה",
                                    "סטטוס": sub.isActive ? "פעיל" : "פג תוקף",
                                })))
                                setDetailModalOpen(true)
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardDescription>סה"כ הכנסות</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold text-primary">
                                    ₪{subscriptionsData.totalRevenue.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts - All graphs displayed in grid */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* By Purchase Date */}
                        {subscriptionsData.byDate.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>מנויים לפי תאריך רכישה</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byDate") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byDate")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* By Type */}
                        {subscriptionsData.byType.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>מנויים לפי סוג</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byType") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byType")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* By Status */}
                        {subscriptionsData.byStatus.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>מנויים לפי סטטוס</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byStatus") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byStatus")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* By Remaining Entries */}
                        {subscriptionsData.byRemainingEntries.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>מנויים לפי יתרת כניסות</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byRemainingEntries") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byRemainingEntries")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* By Remaining Days - Full width if odd number */}
                        {subscriptionsData.byRemainingDays.length > 0 && (
                            <Card className={subscriptionsData.byRemainingEntries.length > 0 ? "md:col-span-2" : ""}>
                                <CardHeader>
                                    <CardTitle>מנויים לפי יתרת ימים</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byRemainingDays") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byRemainingDays")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Revenue by Type */}
                        {subscriptionsData.byTypeRevenue.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>הכנסות לפי סוג מנוי</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byTypeRevenue") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byTypeRevenue")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Revenue by Date */}
                        {subscriptionsData.byDateRevenue.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>הכנסות לפי תאריך רכישה</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        {getChartOptions("byDateRevenue") && (
                                            <HighchartsReact highcharts={Highcharts} options={getChartOptions("byDateRevenue")} />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {subscriptionsData.total === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-slate-500">אין נתוני מנויים זמינים בתאריכים שנבחרו</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}

            {/* Detail Modal */}
            <ChartDetailModal
                open={detailModalOpen}
                onOpenChange={setDetailModalOpen}
                title={detailModalTitle}
                description={detailModalDescription}
                data={detailModalData.map((sub) => {
                    // Check if data is already in Hebrew key format (from summary cards)
                    if ("מחיר רכישה" in sub) {
                        return sub
                    }
                    // Otherwise, transform from subscription object format
                    return {
                        id: sub.id,
                        "סוג מנוי": sub.ticketTypeName || "",
                        "לקוח": sub.customerName || "",
                        "תאריך רכישה": formatDateSafe(sub.purchaseDate, "dd/MM/yyyy"),
                        "תאריך תפוגה": formatDateSafe(sub.expiresOn, "dd/MM/yyyy"),
                        "מחיר רכישה": Number(sub.purchasePrice ?? 0),
                        "סה\"כ כניסות": sub.totalEntries != null ? String(sub.totalEntries) : "ללא הגבלה",
                        "כניסות משומשות": sub.usedEntries != null ? String(sub.usedEntries) : "0",
                        "יתרה": sub.remainingEntries != null ? String(sub.remainingEntries) : "ללא הגבלה",
                        "יתרת ימים": sub.remainingDays != null ? String(sub.remainingDays) : "ללא תאריך תפוגה",
                        "סטטוס": sub.isActive ? "פעיל" : "פג תוקף",
                    }
                })}
                columns={[
                    { key: "סוג מנוי", label: "סוג מנוי" },
                    { key: "לקוח", label: "לקוח" },
                    { key: "תאריך רכישה", label: "תאריך רכישה" },
                    { key: "תאריך תפוגה", label: "תאריך תפוגה" },
                    {
                        key: "מחיר רכישה",
                        label: "מחיר רכישה (₪)",
                        isNumeric: true,
                        render: (value) => `₪${typeof value === "string" ? parseFloat(value.replace(/[₪,\s]/g, "") || "0").toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Number(value || 0).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    },
                    { key: "סה\"כ כניסות", label: "סה\"כ כניסות" },
                    { key: "כניסות משומשות", label: "כניסות משומשות" },
                    { key: "יתרה", label: "יתרה" },
                    { key: "יתרת ימים", label: "יתרת ימים" },
                    { key: "סטטוס", label: "סטטוס" },
                ]}
            />
        </div>
    )
}
