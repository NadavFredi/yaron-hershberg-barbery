import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import { Loader2, Search, MoreHorizontal, CalendarClock, CheckCircle2, XCircle, X, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import type { ManagerAppointment } from "./ManagerSchedule/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DatePickerInput } from "@/components/DatePickerInput"
import { AppointmentDetailsSheet, ClientDetailsSheet } from "@/pages/ManagerSchedule/sheets"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedClient, setIsClientDetailsOpen, type ClientDetails } from "@/store/slices/managerScheduleSlice"
import { SettingsStationsPerDaySection } from "@/components/settings/SettingsStationsPerDaySection/SettingsStationsPerDaySection"
import { useStations } from "@/hooks/useStations"
import { MultiSelectDropdown } from "@/components/settings/SettingsServiceStationMatrixSection/components/MultiSelectDropdown"
import { useServices } from "@/hooks/useServices"
import { useServiceCategories } from "@/hooks/useServiceCategories"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination"

type AppointmentStatus = "pending" | "approved" | "cancelled" | "matched"
type DateFilterType = "all" | "before" | "after" | "on" | "range"

type EnrichedAppointment = ManagerAppointment & {
    sourceTable: "grooming_appointments"
    clientCustomerTypeId?: string | null
    clientCustomerTypeName?: string | null
}

type ClientDetailsSheetProps = ComponentProps<typeof ClientDetailsSheet>
type ClientDetailsPayload = ClientDetailsSheetProps["selectedClient"]

interface OptionItem {
    id: string
    name: string
}


interface RawCustomerRecord {
    id?: string
    full_name?: string | null
    phone?: string | null
    email?: string | null
    classification?: string | null
    customer_type_id?: string | null
    customer_type?: {
        id?: string | null
        name?: string | null
    } | null
}

interface RawStationRecord {
    id?: string | null
    name?: string | null
}

interface RawServiceRecord {
    id?: string | null
    name?: string | null
    service_category_id?: string | null
}

interface GroomingAppointmentRow {
    id: string
    status?: string | null
    start_at: string
    end_at: string
    appointment_kind?: string | null
    payment_status?: string | null
    amount_due?: number | null
    customer_notes?: string | null
    internal_notes?: string | null
    station_id?: string | null
    customer_id: string
    customers?: RawCustomerRecord | RawCustomerRecord[] | null
    stations?: RawStationRecord | RawStationRecord[] | null
    services?: RawServiceRecord | RawServiceRecord[] | null
}

const getFirst = <T,>(value: T | T[] | null | undefined): T | null => {
    if (value == null) return null
    return Array.isArray(value) ? value[0] ?? null : value
}

const normalizeOption = (item?: { id?: string | null; name?: string | null } | null): OptionItem | null => {
    if (!item?.id) return null
    return {
        id: item.id,
        name: item.name ?? "ללא שם",
    }
}

const SERVICE_BADGES: Record<string, string> = {
    default: "bg-primary/10 text-primary border border-primary/20",
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
    pending: "ממתין",
    approved: "מאושר",
    cancelled: "בוטל",
    matched: "משובץ",
}

const STATUS_BADGES: Record<AppointmentStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 border border-rose-200",
    matched: "bg-indigo-50 text-primary border border-primary/20",
}

const STATUS_OPTIONS: Array<{ value: AppointmentStatus | "all"; label: string }> = [
    { value: "all", label: "כל הסטטוסים" },
    { value: "pending", label: STATUS_LABELS.pending },
    { value: "approved", label: STATUS_LABELS.approved },
    { value: "matched", label: STATUS_LABELS.matched },
    { value: "cancelled", label: STATUS_LABELS.cancelled },
]

const formatDate = (value?: string, pattern = "dd/MM/yyyy HH:mm") => {
    if (!value) return "-"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return "-"
    }
    return format(parsed, pattern)
}

export default function AppointmentsSection() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()
    const [searchParams] = useSearchParams()
    const modeParam = searchParams.get("mode")

    // Handle stations-per-day mode
    if (modeParam === "stations-per-day") {
        return <SettingsStationsPerDaySection />
    }

    const [appointments, setAppointments] = useState<EnrichedAppointment[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
    const [selectedServiceCategoryIds, setSelectedServiceCategoryIds] = useState<string[]>([])
    const [statusFilter, setStatusFilter] = useState<AppointmentStatus[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [dateFilterType, setDateFilterType] = useState<DateFilterType>("range")
    const [singleDate, setSingleDate] = useState<Date | null>(null) // For before/after/on
    const [startDate, setStartDate] = useState<Date | null>(subDays(new Date(), 30)) // For range
    const [endDate, setEndDate] = useState<Date | null>(new Date()) // For range
    const [showOnlyFuture, setShowOnlyFuture] = useState(false) // Now handled on backend
    const [customerCategoryFilter, setCustomerCategoryFilter] = useState<string>("all")
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(50)
    const [totalCount, setTotalCount] = useState(0)
    const [rowActionLoading, setRowActionLoading] = useState<string | null>(null)
    const [selectedAppointment, setSelectedAppointment] = useState<EnrichedAppointment | null>(null)
    const [customerTypes, setCustomerTypes] = useState<OptionItem[]>([])
    const [isAppointmentSheetOpen, setIsAppointmentSheetOpen] = useState(false)
    const appliedModeRef = useRef<string | null>(null)

    const { data: stations = [], isLoading: isLoadingStations } = useStations()
    const { data: services = [], isLoading: isLoadingServices } = useServices()
    const { data: serviceCategories = [], isLoading: isLoadingServiceCategories } = useServiceCategories()

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "auto" })
        }
    }, [])

    useEffect(() => {
        const modeParam = searchParams.get("mode")
        if (!modeParam) {
            appliedModeRef.current = null
            return
        }

        if (appliedModeRef.current === modeParam) {
            return
        }

        if (modeParam === "all") {
            setStatusFilter([])
            appliedModeRef.current = modeParam
            return
        }

        const allowedModes: AppointmentStatus[] = ["pending", "approved", "cancelled", "matched"]
        if (allowedModes.includes(modeParam as AppointmentStatus)) {
            setStatusFilter([modeParam as AppointmentStatus])
            appliedModeRef.current = modeParam
        }
    }, [searchParams])

    // Validate that from date is always less than to date (for range filter)
    useEffect(() => {
        if (dateFilterType === "range" && startDate && endDate && startDate > endDate) {
            setEndDate(addDays(startDate, 1))
        }
    }, [startDate, endDate, dateFilterType])

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [selectedServiceIds, selectedServiceCategoryIds, statusFilter, dateFilterType, singleDate, startDate, endDate, showOnlyFuture, customerCategoryFilter, selectedStationIds, searchTerm])

    const fetchFilterOptions = useCallback(async () => {
        try {
            const { data: customerTypeData, error: customerTypeError } =
                await supabase.from("customer_types").select("id, name").order("priority", { ascending: true })

            if (customerTypeError) {
                throw customerTypeError
            }

            setCustomerTypes(customerTypeData || [])
        } catch (fetchError) {
            console.error("Failed to fetch filter options:", fetchError)
            toast({
                title: "שגיאה בטעינת מסננים",
                description: "לא ניתן היה לטעון קטגוריות. נסה לרענן שוב מאוחר יותר.",
                variant: "destructive",
            })
        }
    }, [toast])

    useEffect(() => {
        fetchFilterOptions()
    }, [fetchFilterOptions])

    const fetchAppointments = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            // Calculate date filters based on dateFilterType
            let dateFilter: { gte?: string; lte?: string } | null = null
            const todayStart = startOfDay(new Date())

            if (dateFilterType === "before" && singleDate) {
                dateFilter = { lte: endOfDay(singleDate).toISOString() }
            } else if (dateFilterType === "after" && singleDate) {
                dateFilter = { gte: startOfDay(singleDate).toISOString() }
            } else if (dateFilterType === "on" && singleDate) {
                const dayStart = startOfDay(singleDate)
                const dayEnd = endOfDay(singleDate)
                dateFilter = { gte: dayStart.toISOString(), lte: dayEnd.toISOString() }
            } else if (dateFilterType === "range") {
                if (startDate && endDate) {
                    dateFilter = {
                        gte: startOfDay(startDate).toISOString(),
                        lte: endOfDay(endDate).toISOString(),
                    }
                }
            }

            // If showOnlyFuture is true, ensure we only get future appointments
            if (showOnlyFuture && (!dateFilter || !dateFilter.gte)) {
                dateFilter = { ...dateFilter, gte: todayStart.toISOString() }
            }

            // Get service IDs to filter by
            let serviceIdsToFilter: string[] = []
            if (selectedServiceIds.length > 0 && selectedServiceCategoryIds.length > 0) {
                const servicesInCategories = services
                    .filter((s) => s.service_category_id && selectedServiceCategoryIds.includes(s.service_category_id))
                    .map((s) => s.id)
                serviceIdsToFilter = selectedServiceIds.filter((id) => servicesInCategories.includes(id))
            } else if (selectedServiceIds.length > 0) {
                serviceIdsToFilter = selectedServiceIds
            } else if (selectedServiceCategoryIds.length > 0) {
                serviceIdsToFilter = services
                    .filter((s) => s.service_category_id && selectedServiceCategoryIds.includes(s.service_category_id))
                    .map((s) => s.id)
            }

            // When search is active, fetch all results and paginate client-side
            // Otherwise, use backend pagination
            const hasSearch = searchTerm.trim().length > 0
            const from = hasSearch ? 0 : (currentPage - 1) * pageSize
            const to = hasSearch ? 999999 : from + pageSize - 1

            const groomingPromise = async (): Promise<{ data: GroomingAppointmentRow[]; count: number }> => {
                let query = supabase
                    .from("grooming_appointments")
                    .select(
                        `
                        id,
                        status,
                        start_at,
                        end_at,
                        appointment_kind,
                        payment_status,
                        amount_due,
                        customer_notes,
                        internal_notes,
                        station_id,
                        service_id,
                        customer_id,
                        customers (
                            id,
                            full_name,
                            phone,
                            email,
                            classification,
                            customer_type_id,
                            customer_type:customer_types (
                                id,
                                name
                            )
                        ),
                        stations (
                            id,
                            name
                        ),
                        services (
                            id,
                            name,
                            service_category_id
                        )
                    `,
                        { count: "exact" }
                    )
                    .order("start_at", { ascending: false })

                // Only apply range if not searching (search will paginate client-side)
                if (!hasSearch) {
                    query = query.range(from, to)
                }

                // Apply date filters
                if (dateFilter?.gte) {
                    query = query.gte("start_at", dateFilter.gte)
                }
                if (dateFilter?.lte) {
                    query = query.lte("start_at", dateFilter.lte)
                }

                // Apply status filter
                if (statusFilter.length > 0) {
                    query = query.in("status", statusFilter)
                }

                // Apply service filter
                if (serviceIdsToFilter.length > 0) {
                    query = query.in("service_id", serviceIdsToFilter)
                }

                // Apply station filter
                if (selectedStationIds.length > 0) {
                    query = query.in("station_id", selectedStationIds)
                }

                // Apply customer category filter
                if (customerCategoryFilter !== "all") {
                    query = query.eq("customers.customer_type_id", customerCategoryFilter)
                }

                // Note: Search filtering will be done client-side after fetching due to Supabase limitations
                // with nested OR conditions across multiple relations

                const { data, error: groomingError, count } = await query
                if (groomingError) {
                    throw groomingError
                }
                return { data: (data ?? []) as GroomingAppointmentRow[], count: count ?? 0 }
            }

            const { data: groomingData, count } = await groomingPromise()

            // Client-side filtering for search
            let filteredData = groomingData
            if (hasSearch) {
                const normalized = searchTerm.trim().toLowerCase()
                filteredData = groomingData.filter((apt) => {
                    const customer = getFirst<RawCustomerRecord>(apt.customers)
                    const station = getFirst<RawStationRecord>(apt.stations)
                    const service = getFirst<RawServiceRecord>(apt.services)

                    const haystack = [
                        customer?.full_name,
                        customer?.phone,
                        service?.name,
                        station?.name,
                        apt.customer_notes,
                        apt.internal_notes,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()

                    return haystack.includes(normalized)
                })
            }

            // Apply client-side pagination if search is active
            let paginatedData = filteredData
            let finalCount = count
            if (hasSearch) {
                finalCount = filteredData.length
                const paginationFrom = (currentPage - 1) * pageSize
                const paginationTo = paginationFrom + pageSize
                paginatedData = filteredData.slice(paginationFrom, paginationTo)
            }

            const mappedGrooming: EnrichedAppointment[] = paginatedData.map((apt) => {
                const customer = getFirst<RawCustomerRecord>(apt.customers)
                const station = getFirst<RawStationRecord>(apt.stations)
                const service = getFirst<RawServiceRecord>(apt.services)

                return {
                    id: apt.id,
                    sourceTable: "grooming_appointments",
                    serviceType: "grooming",
                    stationId: apt.station_id || station?.id || "",
                    stationName: station?.name || "מספרה",
                    startDateTime: apt.start_at,
                    endDateTime: apt.end_at,
                    status: apt.status || "pending",
                    paymentStatus: apt.payment_status || undefined,
                    notes: apt.customer_notes || "",
                    internalNotes: apt.internal_notes || undefined,
                    appointmentType: apt.appointment_kind === "personal" ? "private" : "business",
                    price: apt.amount_due ? Number(apt.amount_due) : undefined,
                    dogs: [], // No dogs in barbershop
                    clientId: apt.customer_id,
                    clientName: customer?.full_name || undefined,
                    clientClassification: customer?.classification || undefined,
                    clientEmail: customer?.email || undefined,
                    clientPhone: customer?.phone || undefined,
                    serviceName: service?.name || "מספרה",
                    clientCustomerTypeId: customer?.customer_type?.id ?? customer?.customer_type_id ?? null,
                    clientCustomerTypeName: customer?.customer_type?.name ?? undefined,
                }
            })

            setAppointments(mappedGrooming)
            setTotalCount(finalCount)
        } catch (fetchError) {
            console.error("Failed to load appointments:", fetchError)
            const message = fetchError instanceof Error ? fetchError.message : "נכשלה הטעינה של התורים"
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [
        selectedServiceIds,
        selectedServiceCategoryIds,
        statusFilter,
        dateFilterType,
        singleDate,
        startDate,
        endDate,
        showOnlyFuture,
        selectedStationIds,
        customerCategoryFilter,
        searchTerm,
        currentPage,
        pageSize,
        services,
    ])

    useEffect(() => {
        fetchAppointments()
    }, [fetchAppointments])

    // Appointments are already filtered and paginated from backend
    const filteredAppointments = appointments

    const totalPages = Math.ceil(totalCount / pageSize)


    const handleRefresh = () => {
        fetchAppointments()
    }

    // Handle Enter key in search input
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            setCurrentPage(1) // Reset to first page on search
        }
    }

    const handleClearAllFilters = () => {
        setSelectedServiceIds([])
        setSelectedServiceCategoryIds([])
        setStatusFilter([])
        setSearchTerm("")
        setDateFilterType("range")
        setSingleDate(null)
        setStartDate(subDays(new Date(), 30))
        setEndDate(new Date())
        setShowOnlyFuture(false)
        setCustomerCategoryFilter("all")
        setSelectedStationIds([])
        setCurrentPage(1)
    }

    const buildClientDetailsFromAppointment = (appointment: EnrichedAppointment): ClientDetails => ({
        name: appointment.clientName || "ללא שם",
        classification: appointment.clientClassification || undefined,
        customerTypeName: appointment.clientCustomerTypeName || undefined,
        phone: appointment.clientPhone || undefined,
        email: appointment.clientEmail || undefined,
        clientId: appointment.clientId,
        recordId: appointment.clientId,
    })

    const openClientSheet = (client: ClientDetails) => {
        dispatch(setSelectedClient(client))
        dispatch(setIsClientDetailsOpen(true))
    }


    const openAppointmentSheet = (appointment: EnrichedAppointment) => {
        setSelectedAppointment(appointment)
        setIsAppointmentSheetOpen(true)
    }

    const handleCustomerCellClick = (event: MouseEvent<HTMLButtonElement>, appointment: EnrichedAppointment) => {
        event.stopPropagation()
        openClientSheet(buildClientDetailsFromAppointment(appointment))
    }


    const handleAppointmentClientClick = (client: ClientDetailsPayload) => {
        openClientSheet(client)
    }

    const handleSheetStatusUpdate = (appointment: ManagerAppointment, nextStatus: AppointmentStatus) => {
        const fullAppointment =
            appointments.find((item) => item.id === appointment.id) ||
            (selectedAppointment && selectedAppointment.id === appointment.id ? selectedAppointment : null)
        if (fullAppointment) {
            updateAppointmentStatus(fullAppointment, nextStatus)
        }
    }


    const updateAppointmentStatus = async (appointment: EnrichedAppointment, nextStatus: AppointmentStatus) => {
        setRowActionLoading(appointment.id)
        try {
            const { error: updateError } = await supabase
                .from(appointment.sourceTable)
                .update({ status: nextStatus })
                .eq("id", appointment.id)

            if (updateError) {
                throw updateError
            }

            toast({
                title: "הסטטוס עודכן",
                description: `התור עודכן לסטטוס "${STATUS_LABELS[nextStatus]}"`,
            })
            fetchAppointments()
        } catch (actionError) {
            const errorMessage = actionError instanceof Error ? actionError.message : "אנא נסה שוב בעוד רגע"
            console.error("Failed to update appointment:", actionError)
            toast({
                title: "שגיאה בעדכון הסטטוס",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setRowActionLoading(null)
        }
    }

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">


                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                            <div>
                                <CardTitle className="text-lg sm:text-xl">תורים</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    {totalCount > 0
                                        ? `נמצאו ${totalCount} תורים${currentPage > 1 ? ` (דף ${currentPage} מתוך ${totalPages})` : ""}`
                                        : "לא נמצאו תורים התואמים לסינונים"}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearAllFilters}
                                    className="text-slate-600 hover:text-slate-900 text-xs sm:text-sm"
                                >
                                    נקה מסננים
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        {/* Filters */}
                        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
                            {/* First Row - 4 filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div>
                                    <Label className="text-sm mb-2 block">קטגוריית שירות</Label>
                                    {isLoadingServiceCategories ? (
                                        <div className="flex items-center justify-center h-10 text-sm text-slate-500">
                                            טוען קטגוריות...
                                        </div>
                                    ) : (
                                        <MultiSelectDropdown
                                            options={serviceCategories.map(cat => ({ id: cat.id, name: cat.name }))}
                                            selectedIds={selectedServiceCategoryIds}
                                            onSelectionChange={setSelectedServiceCategoryIds}
                                            placeholder="בחר קטגוריות שירות..."
                                        />
                                    )}
                                </div>
                                <div>
                                    <Label className="text-sm mb-2 block">שירות</Label>
                                    {isLoadingServices ? (
                                        <div className="flex items-center justify-center h-10 text-sm text-slate-500">
                                            טוען שירותים...
                                        </div>
                                    ) : (
                                        <MultiSelectDropdown
                                            options={services.filter(s => s.is_active).map(s => ({ id: s.id, name: s.name }))}
                                            selectedIds={selectedServiceIds}
                                            onSelectionChange={(ids) => {
                                                setSelectedServiceIds(ids)
                                                setCurrentPage(1)
                                            }}
                                            placeholder="בחר שירותים..."
                                        />
                                    )}
                                </div>
                                <div>
                                    <Label className="text-sm mb-2 block">סוג סינון תאריך</Label>
                                    <Select
                                        value={dateFilterType}
                                        onValueChange={(value) => {
                                            setDateFilterType(value as DateFilterType)
                                            setCurrentPage(1)
                                        }}
                                    >
                                        <SelectTrigger dir="rtl" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="all">הכל</SelectItem>
                                            <SelectItem value="before">לפני תאריך</SelectItem>
                                            <SelectItem value="after">אחרי תאריך</SelectItem>
                                            <SelectItem value="on">בתאריך</SelectItem>
                                            <SelectItem value="range">טווח תאריכים</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    {dateFilterType === "all" && (
                                        <Label className="text-sm mb-2 block">תאריך</Label>
                                    )}
                                    {dateFilterType === "before" && (
                                        <>
                                            <Label className="text-sm mb-2 block">לפני תאריך</Label>
                                            <DatePickerInput
                                                value={singleDate}
                                                onChange={(date) => {
                                                    setSingleDate(date)
                                                    setCurrentPage(1)
                                                }}
                                                displayFormat="dd/MM/yyyy"
                                                className="w-full text-right"
                                            />
                                        </>
                                    )}
                                    {dateFilterType === "after" && (
                                        <>
                                            <Label className="text-sm mb-2 block">אחרי תאריך</Label>
                                            <DatePickerInput
                                                value={singleDate}
                                                onChange={(date) => {
                                                    setSingleDate(date)
                                                    setCurrentPage(1)
                                                }}
                                                displayFormat="dd/MM/yyyy"
                                                className="w-full text-right"
                                            />
                                        </>
                                    )}
                                    {dateFilterType === "on" && (
                                        <>
                                            <Label className="text-sm mb-2 block">בתאריך</Label>
                                            <DatePickerInput
                                                value={singleDate}
                                                onChange={(date) => {
                                                    setSingleDate(date)
                                                    setCurrentPage(1)
                                                }}
                                                displayFormat="dd/MM/yyyy"
                                                className="w-full text-right"
                                            />
                                        </>
                                    )}
                                    {dateFilterType === "range" && (
                                        <>
                                            <Label className="text-sm mb-2 block">מתאריך</Label>
                                            <DatePickerInput
                                                value={startDate}
                                                onChange={(date) => {
                                                    setStartDate(date)
                                                    setCurrentPage(1)
                                                }}
                                                displayFormat="dd/MM/yyyy"
                                                className="w-full text-right"
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* Second Row - 4 filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                {dateFilterType === "range" && (
                                    <div>
                                        <Label className="text-sm mb-2 block">עד תאריך</Label>
                                        <DatePickerInput
                                            value={endDate}
                                            onChange={(date) => {
                                                setEndDate(date)
                                                setCurrentPage(1)
                                            }}
                                            displayFormat="dd/MM/yyyy"
                                            className="w-full text-right"
                                        />
                                    </div>
                                )}
                                {dateFilterType !== "range" && (
                                    <div>
                                        <Label className="text-sm mb-2 block">קטגוריית לקוח</Label>
                                        <Select
                                            value={customerCategoryFilter}
                                            onValueChange={(value) => {
                                                setCustomerCategoryFilter(value)
                                                setCurrentPage(1)
                                            }}
                                        >
                                            <SelectTrigger dir="rtl" className="w-full">
                                                <SelectValue placeholder="כל הקטגוריות" />
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
                                )}
                                {dateFilterType === "range" && (
                                    <div>
                                        <Label className="text-sm mb-2 block">קטגוריית לקוח</Label>
                                        <Select
                                            value={customerCategoryFilter}
                                            onValueChange={(value) => {
                                                setCustomerCategoryFilter(value)
                                                setCurrentPage(1)
                                            }}
                                        >
                                            <SelectTrigger dir="rtl" className="w-full">
                                                <SelectValue placeholder="כל הקטגוריות" />
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
                                )}
                                <div>
                                    <Label className="text-sm mb-2 block">תחנות</Label>
                                    {isLoadingStations ? (
                                        <div className="flex items-center justify-center h-10 text-sm text-slate-500">
                                            טוען תחנות...
                                        </div>
                                    ) : (
                                        <MultiSelectDropdown
                                            options={stations.map(s => ({ id: s.id, name: s.name }))}
                                            selectedIds={selectedStationIds}
                                            onSelectionChange={(ids) => {
                                                setSelectedStationIds(ids)
                                                setCurrentPage(1)
                                            }}
                                            placeholder="בחר תחנות..."
                                        />
                                    )}
                                </div>
                                <div>
                                    <Label className="text-sm mb-2 block">סטטוס</Label>
                                    <MultiSelectDropdown
                                        options={STATUS_OPTIONS.filter(opt => opt.value !== "all").map(opt => ({
                                            id: opt.value as string,
                                            name: opt.label
                                        }))}
                                        selectedIds={statusFilter}
                                        onSelectionChange={(ids) => {
                                            setStatusFilter(ids as AppointmentStatus[])
                                            setCurrentPage(1)
                                        }}
                                        placeholder="בחר סטטוסים..."
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm mb-2 block">חיפוש</Label>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <Input
                                                placeholder="חפש תורים..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                onKeyDown={handleSearchKeyDown}
                                                className="pr-10 w-full text-sm"
                                                dir="rtl"
                                            />
                                        </div>
                                        {searchTerm && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 shrink-0"
                                                onClick={() => {
                                                    setSearchTerm("")
                                                    setCurrentPage(1)
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Checkbox
                                            id="future-only"
                                            checked={showOnlyFuture}
                                            onCheckedChange={(value) => {
                                                setShowOnlyFuture(value === true)
                                                setCurrentPage(1)
                                            }}
                                            className="h-4 w-4"
                                        />
                                        <Label htmlFor="future-only" className="cursor-pointer text-xs font-medium">
                                            הצג רק תורים עתידיים
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>שגיאה בטעינה</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-[65vh] custom-scrollbar [direction:rtl] relative">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-slate-500">
                                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mb-2 sm:mb-3" />
                                <span className="text-sm sm:text-base">טוען תורים...</span>
                            </div>
                        ) : filteredAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-slate-500">
                                <FilterEmptyState />
                            </div>
                        ) : (
                            <Table className="min-w-[900px]" containerClassName="!overflow-visible">
                                <TableHeader>
                                    <TableRow className="bg-slate-50 [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-slate-50">
                                        <TableHead className="text-right text-slate-600 font-semibold">תאריך ושעה</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">סוג שירות</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">לקוח</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">סטטוס</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold hidden lg:table-cell">תחנה / הערות</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold w-[60px]">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAppointments.map((appointment) => {
                                        return (
                                            <TableRow
                                                key={`${appointment.sourceTable}-${appointment.id}`}
                                                className="cursor-pointer hover:bg-slate-50"
                                                onClick={() => openAppointmentSheet(appointment)}
                                            >
                                                <TableCell>
                                                    <div className="font-medium">
                                                        {formatDate(appointment.startDateTime, "dd/MM/yyyy")}
                                                    </div>
                                                    <div className="text-sm text-slate-500">
                                                        {formatDate(appointment.startDateTime, "HH:mm")} -{" "}
                                                        {formatDate(appointment.endDateTime, "HH:mm")}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <Badge className={cn("w-fit", SERVICE_BADGES.default)}>
                                                            {appointment.serviceName || "מספרה"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => handleCustomerCellClick(event, appointment)}
                                                        className="font-medium text-primary hover:text-primary hover:underline"
                                                    >
                                                        {appointment.clientName || "—"}
                                                    </button>
                                                    <div className="text-xs text-slate-500">{appointment.clientPhone || appointment.clientEmail || "—"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={cn(
                                                            "w-fit",
                                                            STATUS_BADGES[(appointment.status as AppointmentStatus) || "pending"] ||
                                                            STATUS_BADGES.pending,
                                                        )}
                                                    >
                                                        {STATUS_LABELS[(appointment.status as AppointmentStatus) || "pending"] || appointment.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    <div className="text-sm text-slate-600">{appointment.stationName}</div>
                                                    {appointment.notes && (
                                                        <div className="text-xs text-slate-500 line-clamp-2 max-w-xs">{appointment.notes}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-left">
                                                    <ActionsMenu
                                                        appointment={appointment}
                                                        onView={() => openAppointmentSheet(appointment)}
                                                        onApprove={() => updateAppointmentStatus(appointment, "approved")}
                                                        onPending={() => updateAppointmentStatus(appointment, "pending")}
                                                        onCancel={() => updateAppointmentStatus(appointment, "cancelled")}
                                                        isLoading={rowActionLoading === appointment.id}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <Button
                                        variant="ghost"
                                        size="default"
                                        onClick={() => {
                                            if (currentPage > 1) {
                                                setCurrentPage(currentPage - 1)
                                                window.scrollTo({ top: 0, behavior: "smooth" })
                                            }
                                        }}
                                        disabled={currentPage === 1}
                                        className="gap-1"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                        <span>הקודם</span>
                                    </Button>
                                </PaginationItem>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum: number
                                    if (totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i
                                    } else {
                                        pageNum = currentPage - 2 + i
                                    }

                                    return (
                                        <PaginationItem key={pageNum}>
                                            <PaginationLink
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    setCurrentPage(pageNum)
                                                }}
                                                isActive={currentPage === pageNum}
                                            >
                                                {pageNum}
                                            </PaginationLink>
                                        </PaginationItem>
                                    )
                                })}
                                {totalPages > 5 && currentPage < totalPages - 2 && (
                                    <PaginationItem>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                )}
                                <PaginationItem>
                                    <Button
                                        variant="ghost"
                                        size="default"
                                        onClick={() => {
                                            if (currentPage < totalPages) {
                                                setCurrentPage(currentPage + 1)
                                                window.scrollTo({ top: 0, behavior: "smooth" })
                                            }
                                        }}
                                        disabled={currentPage === totalPages}
                                        className="gap-1"
                                    >
                                        <span>הבא</span>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}

                <AppointmentDetailsSheet
                    open={isAppointmentSheetOpen}
                    onOpenChange={setIsAppointmentSheetOpen}
                    selectedAppointment={selectedAppointment}
                    onClientClick={handleAppointmentClientClick}
                    onEditAppointment={(appointment) =>
                        toast({ title: "עריכת תור", description: `עריכת תורים תתאפשר בקרוב עבור ${appointment?.clientName ?? "לקוח"}.` })
                    }
                    onCancelAppointment={(appointment) => handleSheetStatusUpdate(appointment, "cancelled")}
                    onDeleteAppointment={(appointment) => handleSheetStatusUpdate(appointment, "cancelled")}
                    isLoading={isLoading}
                />

                <ClientDetailsSheet
                    data={{ appointments }}
                />
            </div>
        </div>
    )
}

interface ActionsMenuProps {
    appointment: EnrichedAppointment
    onView: () => void
    onApprove: () => void
    onPending: () => void
    onCancel: () => void
    isLoading: boolean
}

const ActionsMenu = ({ appointment, onView, onApprove, onPending, onCancel, isLoading }: ActionsMenuProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(event) => event.stopPropagation()}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                    <span className="sr-only">פתיחת תפריט פעולות</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl">
                <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                <DropdownMenuItem
                    onClick={(event) => {
                        event.stopPropagation()
                        onView()
                    }}
                >
                    צפייה בפרטים
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={(event) => {
                        event.stopPropagation()
                        onApprove()
                    }}
                >
                    <CheckCircle2 className="h-4 w-4 ml-2 text-emerald-600" />
                    אשר תור
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={(event) => {
                        event.stopPropagation()
                        onPending()
                    }}
                >
                    החזר לסטטוס ממתין
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    onClick={(event) => {
                        event.stopPropagation()
                        onCancel()
                    }}
                >
                    <XCircle className="h-4 w-4 ml-2" />
                    בטל תור
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

const FilterEmptyState = () => (
    <div className="text-center space-y-3">
        <FilterIcon />
        <p className="font-medium text-slate-700">לא נמצאו תורים מתאימים</p>
        <p className="text-sm text-slate-500">נסו לשנות את מסנני החיפוש או את טווח התאריכים.</p>
    </div>
)

const FilterIcon = () => (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <CalendarClock className="h-6 w-6" />
    </div>
)
