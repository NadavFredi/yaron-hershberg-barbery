import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns"
import { Loader2, RefreshCw, Search, MoreHorizontal, CalendarClock, CheckCircle2, XCircle, Calendar as CalendarIcon } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import type { ManagerAppointment, ManagerDog } from "./ManagerSchedule/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { AppointmentDetailsSheet, ClientDetailsSheet } from "@/pages/ManagerSchedule/sheets"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedClient, setIsClientDetailsOpen, type ClientDetails } from "@/store/slices/managerScheduleSlice"
import { SettingsStationsPerDaySection } from "@/components/settings/SettingsStationsPerDaySection/SettingsStationsPerDaySection"
import { useStations } from "@/hooks/useStations"
import { MultiSelectDropdown } from "@/components/settings/SettingsBreedStationMatrixSection/components/MultiSelectDropdown"
import { formatDurationFromMinutes } from "@/lib/duration-utils"

type AppointmentStatus = "pending" | "approved" | "cancelled" | "matched"
type ServiceFilter = "all" | "grooming" | "garden"

type EnrichedAppointment = ManagerAppointment & {
    sourceTable: "grooming_appointments" | "daycare_appointments"
    clientCustomerTypeId?: string | null
    clientCustomerTypeName?: string | null
}

type ClientDetailsSheetProps = ComponentProps<typeof ClientDetailsSheet>
type ClientDetailsPayload = ClientDetailsSheetProps["selectedClient"]

interface OptionItem {
    id: string
    name: string
}

type CategorizedDog = ManagerDog & {
    category1Ids?: string[]
    category1Names?: string[]
    category2Ids?: string[]
    category2Names?: string[]
    customerTypeName?: string
}

interface RawBreedRecord {
    id?: string
    name?: string | null
}

interface RawDogRecord {
    id: string
    name?: string | null
    customer_id?: string | null
    breed_id?: string | null
    breeds?: RawBreedRecord | RawBreedRecord[] | null
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
    dogs?: RawDogRecord | RawDogRecord[] | null
    customers?: RawCustomerRecord | RawCustomerRecord[] | null
    stations?: RawStationRecord | RawStationRecord[] | null
    services?: RawServiceRecord | RawServiceRecord[] | null
}

interface DaycareAppointmentRow {
    id: string
    status?: string | null
    start_at: string
    end_at: string
    payment_status?: string | null
    amount_due?: number | null
    customer_notes?: string | null
    internal_notes?: string | null
    service_type?: string | null
    late_pickup_requested?: boolean | null
    late_pickup_notes?: string | null
    garden_trim_nails?: boolean | null
    garden_brush?: boolean | null
    garden_bath?: boolean | null
    station_id?: string | null
    customer_id: string
    dogs?: RawDogRecord | RawDogRecord[] | null
    customers?: RawCustomerRecord | RawCustomerRecord[] | null
    stations?: RawStationRecord | RawStationRecord[] | null
}

interface BreedDogCategoryRow {
    breed_id: string
    dog_category?: { id?: string | null; name?: string | null } | null
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

const SERVICE_LABELS: Record<"grooming" | "garden", string> = {
    grooming: "מספרה",
    garden: "גן",
}

const SERVICE_BADGES: Record<"grooming" | "garden", string> = {
    grooming: "bg-blue-50 text-blue-700 border border-blue-200",
    garden: "bg-emerald-50 text-emerald-700 border border-emerald-200",
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
    matched: "bg-indigo-50 text-indigo-700 border border-indigo-200",
}

const STATUS_OPTIONS: Array<{ value: AppointmentStatus | "all"; label: string }> = [
    { value: "all", label: "כל הסטטוסים" },
    { value: "pending", label: STATUS_LABELS.pending },
    { value: "approved", label: STATUS_LABELS.approved },
    { value: "matched", label: STATUS_LABELS.matched },
    { value: "cancelled", label: STATUS_LABELS.cancelled },
]

const SERVICE_OPTIONS: Array<{ value: ServiceFilter; label: string }> = [
    { value: "all", label: "כל השירותים" },
    { value: "grooming", label: "מספרה" },
    { value: "garden", label: "גן" },
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
    const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all")
    const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all")
    const [searchTerm, setSearchTerm] = useState("")
    const initialStartDate = useMemo(() => subDays(new Date(), 3), [])
    const initialEndDate = useMemo(() => addDays(new Date(), 14), [])
    const [startDate, setStartDate] = useState<Date | null>(initialStartDate)
    const [endDate, setEndDate] = useState<Date | null>(initialEndDate)
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: initialStartDate,
        to: initialEndDate,
    })
    const [showOnlyFuture, setShowOnlyFuture] = useState(true)
    const [rowActionLoading, setRowActionLoading] = useState<string | null>(null)
    const [selectedAppointment, setSelectedAppointment] = useState<EnrichedAppointment | null>(null)
    const [customerTypes, setCustomerTypes] = useState<OptionItem[]>([])
    const [dogCategory1Options, setDogCategory1Options] = useState<OptionItem[]>([])
    const [dogCategory2Options, setDogCategory2Options] = useState<OptionItem[]>([])
    const [customerCategoryFilter, setCustomerCategoryFilter] = useState<string>("all")
    const [dogCategory1Filter, setDogCategory1Filter] = useState<string>("all")
    const [dogCategory2Filter, setDogCategory2Filter] = useState<string>("all")
    const [selectedStationIds, setSelectedStationIds] = useState<string[]>([])
    const [isAppointmentSheetOpen, setIsAppointmentSheetOpen] = useState(false)
    const [showAllDogAppointments, setShowAllDogAppointments] = useState(false)
    const appliedModeRef = useRef<string | null>(null)
    
    const { data: stations = [], isLoading: isLoadingStations } = useStations()

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
            setStatusFilter("all")
            appliedModeRef.current = modeParam
            return
        }

        const allowedModes: AppointmentStatus[] = ["pending", "approved", "cancelled", "matched"]
        if (allowedModes.includes(modeParam as AppointmentStatus)) {
            setStatusFilter(modeParam as AppointmentStatus)
            appliedModeRef.current = modeParam
        }
    }, [searchParams])

    useEffect(() => {
        setDateRange({
            from: startDate ?? undefined,
            to: endDate ?? undefined,
        })
    }, [startDate, endDate])

    const fetchFilterOptions = useCallback(async () => {
        try {
            const [{ data: customerTypeData, error: customerTypeError }, { data: dogCategoryData, error: dogCategoryError }] =
                await Promise.all([
                    supabase.from("customer_types").select("id, name").order("priority", { ascending: true }),
                    supabase.from("dog_categories").select("id, name").order("name"),
                ])

            if (customerTypeError || dogCategoryError) {
                throw customerTypeError || dogCategoryError
            }

            setCustomerTypes(customerTypeData || [])
            setDogCategory1Options([]) // dog_types was consolidated into dog_categories
            setDogCategory2Options(dogCategoryData || [])
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
            const shouldFetchGrooming = serviceFilter === "all" || serviceFilter === "grooming"
            const shouldFetchGarden = serviceFilter === "all" || serviceFilter === "garden"
            const fromIso = startDate ? startOfDay(startDate).toISOString() : undefined
            const toIso = endDate ? endOfDay(endDate).toISOString() : undefined

            const groomingPromise = async (): Promise<GroomingAppointmentRow[]> => {
                if (!shouldFetchGrooming) return []
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
                        customer_id,
                        dogs (
                            id,
                            name,
                            customer_id,
                            breed_id,
                            breeds (
                                id,
                                name
                            )
                        ),
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
                            name
                        )
                    `
                    )
                    .order("start_at", { ascending: false })

                if (fromIso) {
                    query = query.gte("start_at", fromIso)
                }
                if (toIso) {
                    query = query.lte("start_at", toIso)
                }
                if (statusFilter !== "all") {
                    query = query.eq("status", statusFilter)
                }

                const { data, error: groomingError } = await query
                if (groomingError) {
                    throw groomingError
                }
                return (data ?? []) as GroomingAppointmentRow[]
            }

            const daycarePromise = async (): Promise<DaycareAppointmentRow[]> => {
                // Daycare appointments don't exist in this system - return empty array
                return []
            }

            const [groomingData, daycareData] = await Promise.all([groomingPromise(), daycarePromise()])

            const breedIdSet = new Set<string>()
            const collectBreedIds = (rows: Array<{ dogs?: RawDogRecord | RawDogRecord[] | null }>) => {
                rows.forEach((row) => {
                    const dog = getFirst<RawDogRecord>(row.dogs)
                    const breed = getFirst<RawBreedRecord>(dog?.breeds)
                    const breedId = dog?.breed_id ?? breed?.id
                    if (breedId) {
                        breedIdSet.add(breedId)
                    }
                })
            }

            collectBreedIds(groomingData)
            collectBreedIds(daycareData)

            const breedIdList = Array.from(breedIdSet)
            const typesByBreed = new Map<string, OptionItem[]>()
            const categoriesByBreed = new Map<string, OptionItem[]>()

            if (breedIdList.length > 0) {
                const { data: categoriesData, error: categoriesError } = await supabase
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
                    .in("breed_id", breedIdList)

                if (categoriesError) {
                    console.error("Failed to fetch breed categories", { categoriesError })
                } else {
                    const typedCategoriesData = (categoriesData ?? []) as BreedDogCategoryRow[]
                    typedCategoriesData.forEach((row) => {
                        if (!row?.breed_id) return
                        const normalizedCategory = normalizeOption(row.dog_category)
                        if (!normalizedCategory) return
                        if (!categoriesByBreed.has(row.breed_id)) {
                            categoriesByBreed.set(row.breed_id, [])
                        }
                        categoriesByBreed.get(row.breed_id)!.push(normalizedCategory)
                    })
                }
            }

            const enhanceDog = (dogRecord: RawDogRecord | null, customerRecord: RawCustomerRecord | null) => {
                if (!dogRecord) return null
                const breed = getFirst<RawBreedRecord>(dogRecord.breeds)
                const breedId = dogRecord.breed_id ?? breed?.id
                const typeEntries = breedId ? typesByBreed.get(breedId) ?? [] : []
                const categoryEntries = breedId ? categoriesByBreed.get(breedId) ?? [] : []

                const managerDog: CategorizedDog = {
                    id: dogRecord.id,
                    name: dogRecord.name || "",
                    ownerId: dogRecord.customer_id || undefined,
                    breed: breed?.name ?? undefined,
                    clientClassification: customerRecord?.classification || undefined,
                    clientName: customerRecord?.full_name || undefined,
                }

                managerDog.category1Ids = typeEntries.map((item) => item.id)
                managerDog.category1Names = typeEntries.map((item) => item.name)
                managerDog.category2Ids = categoryEntries.map((item) => item.id)
                managerDog.category2Names = categoryEntries.map((item) => item.name)
                managerDog.customerTypeName = customerRecord?.customer_type?.name ?? undefined

                return managerDog
            }

            const mappedGrooming: EnrichedAppointment[] = groomingData.map((apt) => {
                const dog = getFirst<RawDogRecord>(apt.dogs)
                const customer = getFirst<RawCustomerRecord>(apt.customers)
                const station = getFirst<RawStationRecord>(apt.stations)
                const service = getFirst<RawServiceRecord>(apt.services)
                const managerDog = enhanceDog(dog, customer)

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
                    dogs: managerDog ? [managerDog] : [],
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

            const mappedDaycare: EnrichedAppointment[] = daycareData.map((apt) => {
                const dog = getFirst<RawDogRecord>(apt.dogs)
                const customer = getFirst<RawCustomerRecord>(apt.customers)
                const station = getFirst<RawStationRecord>(apt.stations)
                const managerDog = enhanceDog(dog, customer)

                const serviceLabel = (() => {
                    switch (apt.service_type) {
                        case "hourly":
                            return "גן - לפי שעה"
                        case "trial":
                            return "גן - ניסיון"
                        default:
                            return "גן - יום שלם"
                    }
                })()

                return {
                    id: apt.id,
                    sourceTable: "daycare_appointments",
                    serviceType: "garden",
                    stationId: apt.station_id || station?.id || "garden",
                    stationName: station?.name || "גן הכלבים",
                    startDateTime: apt.start_at,
                    endDateTime: apt.end_at,
                    status: apt.status || "pending",
                    paymentStatus: apt.payment_status || undefined,
                    notes: apt.customer_notes || "",
                    internalNotes: apt.internal_notes || undefined,
                    price: apt.amount_due ? Number(apt.amount_due) : undefined,
                    gardenAppointmentType:
                        apt.service_type === "hourly" ? "hourly" : ("full-day" as "full-day" | "hourly"),
                    gardenIsTrial: apt.service_type === "trial",
                    latePickupRequested: apt.late_pickup_requested ?? undefined,
                    latePickupNotes: apt.late_pickup_notes ?? undefined,
                    gardenTrimNails: apt.garden_trim_nails ?? undefined,
                    gardenBrush: apt.garden_brush ?? undefined,
                    gardenBath: apt.garden_bath ?? undefined,
                    dogs: managerDog ? [managerDog] : [],
                    clientId: apt.customer_id,
                    clientName: customer?.full_name || undefined,
                    clientClassification: customer?.classification || undefined,
                    clientEmail: customer?.email || undefined,
                    clientPhone: customer?.phone || undefined,
                    serviceName: serviceLabel,
                    clientCustomerTypeId: customer?.customer_type?.id ?? customer?.customer_type_id ?? null,
                    clientCustomerTypeName: customer?.customer_type?.name ?? undefined,
                }
            })

            setAppointments([...mappedGrooming, ...mappedDaycare].sort((a, b) => {
                return new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()
            }))
        } catch (fetchError) {
            console.error("Failed to load appointments:", fetchError)
            const message = fetchError instanceof Error ? fetchError.message : "נכשלה הטעינה של התורים"
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [serviceFilter, statusFilter, startDate, endDate])

    useEffect(() => {
        fetchAppointments()
    }, [fetchAppointments])

    const filteredAppointments = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase()
        const todayStart = startOfDay(new Date())

        return appointments.filter((appointment) => {
            if (showOnlyFuture) {
                const start = new Date(appointment.startDateTime)
                if (start < todayStart) {
                    return false
                }
            }

            if (customerCategoryFilter !== "all") {
                if (appointment.clientCustomerTypeId !== customerCategoryFilter) {
                    return false
                }
            }

            const matchesDogCategory = (selectedId: string, key: "category1Ids" | "category2Ids") => {
                if (selectedId === "all") return true
                return appointment.dogs?.some((dog) => {
                    const typedDog = dog as CategorizedDog
                    const ids = key === "category1Ids" ? typedDog.category1Ids : typedDog.category2Ids
                    return Array.isArray(ids) && ids.includes(selectedId)
                })
            }

            if (dogCategory1Filter !== "all" && !matchesDogCategory(dogCategory1Filter, "category1Ids")) {
                return false
            }

            if (dogCategory2Filter !== "all" && !matchesDogCategory(dogCategory2Filter, "category2Ids")) {
                return false
            }

            if (selectedStationIds.length > 0) {
                if (!appointment.stationId || !selectedStationIds.includes(appointment.stationId)) {
                    return false
                }
            }

            if (!normalized) {
                return true
            }

            const haystack = [
                appointment.clientName,
                appointment.clientPhone,
                appointment.serviceName,
                appointment.stationName,
                appointment.notes,
                appointment.internalNotes,
                appointment.dogs?.[0]?.name,
                appointment.dogs?.[0]?.breed,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()

            return haystack.includes(normalized)
        })
    }, [appointments, searchTerm, showOnlyFuture, customerCategoryFilter, dogCategory1Filter, dogCategory2Filter, selectedStationIds])

    const stats = useMemo(() => {
        return filteredAppointments.reduce(
            (acc, appointment) => {
                acc.total += 1
                if (appointment.status in acc.byStatus) {
                    acc.byStatus[appointment.status as AppointmentStatus] += 1
                }
                
                // Calculate duration in minutes
                let durationMinutes = 0
                try {
                    const start = new Date(appointment.startDateTime)
                    const end = new Date(appointment.endDateTime)
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                        durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
                    }
                } catch (e) {
                    // Ignore invalid dates
                }
                
                // Calculate payment
                const payment = appointment.price != null && appointment.price > 0 ? appointment.price : 0
                
                if (appointment.serviceType === "grooming") {
                    acc.grooming.count += 1
                    acc.grooming.payments += payment
                    acc.grooming.durationMinutes += durationMinutes
                } else {
                    acc.garden.count += 1
                    acc.garden.payments += payment
                    acc.garden.durationMinutes += durationMinutes
                }
                
                return acc
            },
            {
                total: 0,
                grooming: {
                    count: 0,
                    payments: 0,
                    durationMinutes: 0,
                },
                garden: {
                    count: 0,
                    payments: 0,
                    durationMinutes: 0,
                },
                byStatus: {
                    pending: 0,
                    approved: 0,
                    cancelled: 0,
                    matched: 0,
                },
            },
        )
    }, [filteredAppointments])

    const handleRefresh = () => {
        fetchAppointments()
    }

    const handleRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range)
        setStartDate(range?.from ?? null)
        setEndDate(range?.to ?? range?.from ?? null)
    }

    const dateRangeLabel = useMemo(() => {
        if (!dateRange?.from && !dateRange?.to) {
            return "בחר טווח תאריכים"
        }
        const fromLabel = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : ""
        const toLabel = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : fromLabel
        return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`
    }, [dateRange])

    const handleToggleStatusCard = (targetStatus: AppointmentStatus) => {
        setStatusFilter((prev) => (prev === targetStatus ? "all" : targetStatus))
    }

    const handleToggleServiceCard = (targetService: Extract<ServiceFilter, "grooming" | "garden">) => {
        setServiceFilter((prev) => (prev === targetService ? "all" : targetService))
    }

    const handleResetStatFilters = () => {
        setServiceFilter("all")
        setStatusFilter("all")
    }

    const handleClearAllFilters = () => {
        setServiceFilter("all")
        setStatusFilter("all")
        setSearchTerm("")
        const resetStart = new Date(initialStartDate)
        const resetEnd = new Date(initialEndDate)
        setStartDate(resetStart)
        setEndDate(resetEnd)
        setDateRange({
            from: resetStart,
            to: resetEnd,
        })
        setShowOnlyFuture(true)
        setCustomerCategoryFilter("all")
        setDogCategory1Filter("all")
        setDogCategory2Filter("all")
        setSelectedStationIds([])
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

    const handleShowDogAppointments = (_dogId: string, dogName: string) => {
        setSearchTerm(dogName)
        toast({
            title: "סינון לפי כלב",
            description: `מציג נתונים עבור ${dogName}`,
        })
    }

    const groomingCards = [
        {
            id: "grooming-count",
            label: "מספרה - כמות",
            value: stats.grooming.count,
            accent: "text-blue-600",
            border: "border-blue-300",
            hoverBg: "hover:bg-blue-50",
            activeContainer: "bg-blue-500 border-blue-500 shadow-lg",
            activeText: "text-white",
            isActive: serviceFilter === "grooming",
            onClick: () => handleToggleServiceCard("grooming"),
        },
        {
            id: "grooming-hours",
            label: "מספרה - שעות",
            value: formatDurationFromMinutes(stats.grooming.durationMinutes),
            accent: "text-blue-600",
            border: "border-blue-300",
            hoverBg: "hover:bg-blue-50",
            activeContainer: "bg-blue-500 border-blue-500 shadow-lg",
            activeText: "text-white",
            isActive: false,
            onClick: () => {},
        },
        {
            id: "grooming-payments",
            label: "מספרה - תשלומים",
            value: `₪${stats.grooming.payments.toLocaleString("he-IL")}`,
            accent: "text-blue-600",
            border: "border-blue-300",
            hoverBg: "hover:bg-blue-50",
            activeContainer: "bg-blue-500 border-blue-500 shadow-lg",
            activeText: "text-white",
            isActive: false,
            onClick: () => {},
        },
    ]

    const gardenCards = [
        {
            id: "garden-count",
            label: "גן - כמות",
            value: stats.garden.count,
            accent: "text-emerald-600",
            border: "border-emerald-300",
            hoverBg: "hover:bg-emerald-50",
            activeContainer: "bg-emerald-500 border-emerald-500 shadow-lg",
            activeText: "text-white",
            isActive: serviceFilter === "garden",
            onClick: () => handleToggleServiceCard("garden"),
        },
        {
            id: "garden-hours",
            label: "גן - שעות",
            value: formatDurationFromMinutes(stats.garden.durationMinutes),
            accent: "text-emerald-600",
            border: "border-emerald-300",
            hoverBg: "hover:bg-emerald-50",
            activeContainer: "bg-emerald-500 border-emerald-500 shadow-lg",
            activeText: "text-white",
            isActive: false,
            onClick: () => {},
        },
        {
            id: "garden-payments",
            label: "גן - תשלומים",
            value: `₪${stats.garden.payments.toLocaleString("he-IL")}`,
            accent: "text-emerald-600",
            border: "border-emerald-300",
            hoverBg: "hover:bg-emerald-50",
            activeContainer: "bg-emerald-500 border-emerald-500 shadow-lg",
            activeText: "text-white",
            isActive: false,
            onClick: () => {},
        },
    ]

    const statusCards = [
        {
            id: "pending",
            label: "ממתינים",
            value: stats.byStatus.pending,
            accent: "text-amber-600",
            border: "border-amber-300",
            hoverBg: "hover:bg-amber-50",
            activeContainer: "bg-amber-500 border-amber-500 shadow-lg",
            activeText: "text-white",
            isActive: statusFilter === "pending",
            onClick: () => handleToggleStatusCard("pending"),
        },
        {
            id: "approved",
            label: "מאושרים",
            value: stats.byStatus.approved,
            accent: "text-emerald-600",
            border: "border-emerald-300",
            hoverBg: "hover:bg-emerald-50",
            activeContainer: "bg-emerald-500 border-emerald-500 shadow-lg",
            activeText: "text-white",
            isActive: statusFilter === "approved",
            onClick: () => handleToggleStatusCard("approved"),
        },
        {
            id: "matched",
            label: "משובצים",
            value: stats.byStatus.matched,
            accent: "text-indigo-600",
            border: "border-indigo-300",
            hoverBg: "hover:bg-indigo-50",
            activeContainer: "bg-indigo-500 border-indigo-500 shadow-lg",
            activeText: "text-white",
            isActive: statusFilter === "matched",
            onClick: () => handleToggleStatusCard("matched"),
        },
        {
            id: "cancelled",
            label: "בוטלו",
            value: stats.byStatus.cancelled,
            accent: "text-rose-600",
            border: "border-rose-300",
            hoverBg: "hover:bg-rose-50",
            activeContainer: "bg-rose-500 border-rose-500 shadow-lg",
            activeText: "text-white",
            isActive: statusFilter === "cancelled",
            onClick: () => handleToggleStatusCard("cancelled"),
        },
        {
            id: "total",
            label: "סה\"כ תורים",
            value: stats.total,
            accent: "text-slate-900",
            border: "border-slate-300",
            hoverBg: "hover:bg-slate-50",
            activeContainer: "bg-slate-900 border-slate-900 shadow-lg",
            activeText: "text-white",
            isActive: serviceFilter === "all" && statusFilter === "all",
            onClick: handleResetStatFilters,
        },
    ]

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
            <div className="mx-auto w-full max-w-7xl px-2 sm:px-4 lg:px-8 py-6 space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <CalendarClock className="h-7 w-7 text-primary" />
                        תורים
                    </h1>
                    <p className="text-slate-600">
                        ניהול מרוכז של כל התורים במספרה ובגן – חיפוש, סינון וביצוע פעולות מהירות.
                    </p>
                </div>

                <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl">סינון מהיר</CardTitle>
                                    <CardDescription>סננו לפי טווח תאריכים, שירות, קטגוריות או חיפוש חופשי.</CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 flex-row-reverse">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleRefresh}
                                        disabled={isLoading}
                                        className="gap-2 shadow-sm"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        רענון נתונים
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearAllFilters}
                                        className="text-slate-600 hover:text-slate-900"
                                    >
                                        נקה את כל המסננים
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="service-filter">סוג שירות</Label>
                                <Select value={serviceFilter} onValueChange={(value) => setServiceFilter(value as ServiceFilter)}>
                                    <SelectTrigger id="service-filter">
                                        <SelectValue placeholder="בחר שירות" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {SERVICE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="status-filter">סטטוס</Label>
                                <Select
                                    value={statusFilter}
                                    onValueChange={(value) => setStatusFilter(value as AppointmentStatus | "all")}
                                >
                                    <SelectTrigger id="status-filter">
                                        <SelectValue placeholder="בחר סטטוס" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {STATUS_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="date-range">טווח תאריכים</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date-range"
                                            variant="outline"
                                            className="w-full justify-between border-slate-300 text-right font-normal"
                                        >
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
                        </div>

                        <div className="grid gap-4 md:grid-cols-[1fr,auto] items-end">
                            <div className="space-y-2">
                                <Label htmlFor="search">חיפוש</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        id="search"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="חיפוש לפי שם כלב, לקוח, תחנה או הערות"
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-start">
                                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                                    <Checkbox
                                        id="future-only"
                                        checked={showOnlyFuture}
                                        onCheckedChange={(value) => setShowOnlyFuture(value === true)}
                                        className="h-5 w-5 border-2 border-slate-400 transition-all duration-150 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                                    />
                                    <Label htmlFor="future-only" className="cursor-pointer text-sm font-semibold text-slate-700">
                                        הצג רק תורים עתידיים
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="customer-category">קטגוריית לקוח</Label>
                                <Select
                                    value={customerCategoryFilter}
                                    onValueChange={(value) => setCustomerCategoryFilter(value)}
                                >
                                    <SelectTrigger id="customer-category">
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
                            <div className="space-y-2">
                                <Label htmlFor="dog-cat1">קטגוריית כלב 1</Label>
                                <Select value={dogCategory1Filter} onValueChange={setDogCategory1Filter}>
                                    <SelectTrigger id="dog-cat1">
                                        <SelectValue placeholder="כל הקטגוריות" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">כל הקטגוריות</SelectItem>
                                        {dogCategory1Options.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                                {item.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dog-cat2">קטגוריית כלב 2</Label>
                                <Select value={dogCategory2Filter} onValueChange={setDogCategory2Filter}>
                                    <SelectTrigger id="dog-cat2">
                                        <SelectValue placeholder="כל הקטגוריות" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">כל הקטגוריות</SelectItem>
                                        {dogCategory2Options.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                                {item.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="station-filter">תחנות</Label>
                                {isLoadingStations ? (
                                    <div className="flex items-center justify-center h-10 text-sm text-slate-500">
                                        טוען תחנות...
                                    </div>
                                ) : (
                                    <MultiSelectDropdown
                                        options={stations.map(s => ({ id: s.id, name: s.name }))}
                                        selectedIds={selectedStationIds}
                                        onSelectionChange={setSelectedStationIds}
                                        placeholder="בחר תחנות..."
                                    />
                                )}
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

                <div className="space-y-4">
                    {/* Grooming Stats */}
                    {(serviceFilter === "all" || serviceFilter === "grooming") && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">מספרה</h3>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {groomingCards.map((card) => (
                                    <button
                                        key={card.id}
                                        type="button"
                                        onClick={card.onClick}
                                        className={cn(
                                            "rounded-2xl px-4 py-3 text-right transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                                            card.isActive
                                                ? cn("border-2 text-white", card.activeContainer)
                                                : cn("border-2 bg-white opacity-95", card.border, card.hoverBg)
                                        )}
                                    >
                                        <p
                                            className={cn(
                                                "text-sm font-medium transition-colors duration-200",
                                                card.isActive ? card.activeText : card.accent,
                                            )}
                                        >
                                            {card.label}
                                        </p>
                                        <p
                                            className={cn(
                                                "text-2xl font-bold transition-colors duration-200",
                                                card.isActive ? card.activeText : card.accent,
                                            )}
                                        >
                                            {card.value}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Garden Stats */}
                    {(serviceFilter === "all" || serviceFilter === "garden") && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">גן</h3>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {gardenCards.map((card) => (
                                    <button
                                        key={card.id}
                                        type="button"
                                        onClick={card.onClick}
                                        className={cn(
                                            "rounded-2xl px-4 py-3 text-right transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                                            card.isActive
                                                ? cn("border-2 text-white", card.activeContainer)
                                                : cn("border-2 bg-white opacity-95", card.border, card.hoverBg)
                                        )}
                                    >
                                        <p
                                            className={cn(
                                                "text-sm font-medium transition-colors duration-200",
                                                card.isActive ? card.activeText : card.accent,
                                            )}
                                        >
                                            {card.label}
                                        </p>
                                        <p
                                            className={cn(
                                                "text-2xl font-bold transition-colors duration-200",
                                                card.isActive ? card.activeText : card.accent,
                                            )}
                                        >
                                            {card.value}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Stats */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">סטטוסים</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {statusCards.map((card) => (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={card.onClick}
                                    className={cn(
                                        "rounded-2xl px-4 py-3 text-right transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                                        card.isActive
                                            ? cn("border-2 text-white", card.activeContainer)
                                            : cn("border-2 bg-white opacity-95", card.border, card.hoverBg)
                                    )}
                                >
                                    <p
                                        className={cn(
                                            "text-sm font-medium transition-colors duration-200",
                                            card.isActive ? card.activeText : card.accent,
                                        )}
                                    >
                                        {card.label}
                                    </p>
                                    <p
                                        className={cn(
                                            "text-2xl font-bold transition-colors duration-200",
                                            card.isActive ? card.activeText : card.accent,
                                        )}
                                    >
                                        {card.value}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="px-6 py-5 border-b border-slate-100 space-y-1">
                        <h2 className="text-lg font-semibold text-slate-900">רשימת תורים</h2>
                        <p className="text-sm text-slate-500">לחץ על שורה כדי לפתוח את גיליון פרטי התור.</p>
                        <p className="text-xs text-slate-500">
                            נמצאו {filteredAppointments.length} תורים {showOnlyFuture && "(כולל עתידיים בלבד)"}
                        </p>
                    </div>
                    <div className="overflow-x-auto overflow-y-auto max-h-[65vh] custom-scrollbar [direction:ltr] relative">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                                טוען תורים...
                            </div>
                        ) : filteredAppointments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <FilterEmptyState />
                            </div>
                        ) : (
                            <Table className="min-w-[900px]" containerClassName="!overflow-visible">
                                <TableHeader>
                                    <TableRow className="bg-slate-50 [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-slate-50">
                                        <TableHead className="text-right text-slate-600 font-semibold">תאריך ושעה</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">סוג שירות</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">לקוח</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">כלב</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold">סטטוס</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold hidden lg:table-cell">תחנה / הערות</TableHead>
                                        <TableHead className="text-right text-slate-600 font-semibold w-[60px]">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAppointments.map((appointment) => {
                                        const primaryDog = appointment.dogs?.[0] as ManagerDog | undefined
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
                                                        <Badge className={cn("w-fit", SERVICE_BADGES[appointment.serviceType])}>
                                                            {SERVICE_LABELS[appointment.serviceType]}
                                                        </Badge>
                                                        <span className="text-xs text-slate-500">
                                                            {appointment.serviceName || "—"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => handleCustomerCellClick(event, appointment)}
                                                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {appointment.clientName || "—"}
                                                    </button>
                                                    <div className="text-xs text-slate-500">{appointment.clientPhone || appointment.clientEmail || "—"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {primaryDog ? (
                                                        <span className="font-medium">
                                                            {primaryDog.name || "—"}
                                                        </span>
                                                    ) : (
                                                        <div className="font-medium text-slate-500">—</div>
                                                    )}
                                                    <div className="text-xs text-slate-500">
                                                        {primaryDog?.breed || "ללא ציון"}
                                                    </div>
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
