import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Calendar as CalendarIcon,
    CalendarClock,
    Clock,
    Sparkles,
    CheckCircle,
    XCircle,
    Scissors,
    Bone,
    AlertTriangle,
    Loader2,
    Edit3,
    Trash2,
    PlusCircle,
    History,
    BellRing,
    MessageSquareText,
    CalendarPlus,
} from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import {
    cancelAppointmentWebhook,
    approveAppointment,
    approveGroomingAppointment,
    approveCombinedAppointments,
    cancelCombinedAppointments,
    registerWaitingList,
    updateWaitingListEntry,
    updateAppointmentNotes as updateAppointmentNotesRequest,
    updateLatePickup,
} from "@/integrations/supabase/supabaseService"
import { skipToken } from "@reduxjs/toolkit/query"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
    supabaseApi,
    useDeleteWaitingListEntryMutation,
    useGetWaitingListEntriesQuery,
    useListOwnerTreatmentsQuery,
} from "@/store/services/supabaseApi"
import { extractErrorMessage } from "@/utils/api"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { useToast } from "@/components/ui/use-toast"
import { useWaitingListEntries } from "./Appointments.module"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BothAppointmentCard } from "@/components/BothAppointmentCard"
import { AddWaitlistEntryModal } from "@/components/dialogs/AddWaitlistEntryModal"
import type { Customer as WaitlistCustomer } from "@/components/CustomerSearchInput"
import type { WaitingListEntry } from "@/types"

// Utility function to get service name in Hebrew
const getServiceName = (service: string) => {
    switch (service.toLowerCase()) {
        case "grooming":
            return "תספורת"
        case "garden":
            return "גן"
        case "both":
            return "תספורת וגן"
        default:
            return service
    }
}

// Utility function to generate Google Calendar link
const generateGoogleCalendarLink = (appointment: Appointment) => {
    const formatForGoogleCalendar = (date: Date) => {
        const pad = (value: number) => value.toString().padStart(2, '0')

        return (
            `${date.getFullYear()}` +
            `${pad(date.getMonth() + 1)}` +
            `${pad(date.getDate())}` +
            `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
        )
    }

    const parseDateTime = (rawDateTime?: string) => {
        if (!rawDateTime) {
            return undefined
        }

        const parsed = new Date(rawDateTime)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    const buildDateFromPieces = (date?: string, time?: string) => {
        if (!date || !time) {
            return undefined
        }

        const normalizedTime = time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time
        const parsed = new Date(`${date}T${normalizedTime}`)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    const appointmentStart =
        buildDateFromPieces(appointment.date, appointment.time) ??
        parseDateTime(appointment.startDateTime) ??
        new Date()

    const appointmentEnd =
        parseDateTime(appointment.endDateTime) ??
        new Date(appointmentStart.getTime() + 60 * 60 * 1000)

    const title = `${getServiceName(appointment.service)} - ${appointment.treatmentName || "לקוח"}`
    const details = appointment.notes ? `הערות: ${appointment.notes}` : ""

    const formattedStart = formatForGoogleCalendar(appointmentStart)
    const formattedEnd = formatForGoogleCalendar(appointmentEnd)

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formattedStart}/${formattedEnd}`,
        details,
        location: 'WagTime - מספרת בוטיק',
        trp: 'false',
    })

    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

interface Treatment {
    id: string
    name: string
    treatmentType: string
    size: string
    isSmall: boolean
    ownerId: string
    groomingMinPrice?: number | null
    groomingMaxPrice?: number | null
}

interface Appointment {
    id: string
    treatmentId: string
    date: string
    time: string
    service: "grooming" | "garden" | "both"
    status: string
    treatmentName?: string
    startDateTime?: string
    endDateTime?: string
    stationId?: string
    notes?: string
    groomingNotes?: string
    gardenNotes?: string
    groomingStatus?: string
    gardenStatus?: string
    groomingAppointmentId?: string
    gardenAppointmentId?: string
    latePickupRequested?: boolean
    latePickupNotes?: string
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
}

type WaitlistServiceScopeValue = 'grooming' | 'garden' | 'both' | 'daycare'

interface WaitlistModalSubmission {
    customer: WaitlistCustomer
    entries: Array<{ startDate: string; endDate: string | null }>
    serviceScope: WaitlistServiceScopeValue
    notes: string
    mode: 'create' | 'edit'
    entryId?: string
}

type ListOwnerTreatmentsResponse = { treatments: Treatment[] }
type TreatmentAppointmentsResponse = { appointments: Appointment[] }

const CANCELLED_STATUS_KEYWORDS = ["cancelled", "canceled", "מבוטל", "בוטל"]

function isCancelledStatus(status?: string | null): boolean {
    if (!status) {
        return false
    }
    const normalized = status.trim().toLowerCase()
    return CANCELLED_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function isAppointmentInPast(appointment: Appointment): boolean {
    const dateTimeSource = appointment.startDateTime || (appointment.date && appointment.time ? `${appointment.date}T${appointment.time}` : null)
    if (!dateTimeSource) {
        return false
    }
    const start = new Date(dateTimeSource)
    if (Number.isNaN(start.getTime())) {
        return false
    }
    return start.getTime() < Date.now()
}

export default function Appointments() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const dispatch = useAppDispatch()
    const { user, clientId, clientIdError, isLoading: isAuthLoading } = useSupabaseAuthWithClientId()
    const { toast } = useToast()

    const [appointmentPendingCancellation, setAppointmentPendingCancellation] = useState<Appointment | null>(null)
    const [isCancellingAppointment, setIsCancellingAppointment] = useState(false)
    const [approvingAppointmentId, setApprovingAppointmentId] = useState<string | null>(null)
    const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null)
    const [isWaitingListDialogOpen, setIsWaitingListDialogOpen] = useState(false)
    const [editingWaitingListEntry, setEditingWaitingListEntry] = useState<WaitingListEntry | null>(null)
    const [waitlistModalServiceScope, setWaitlistModalServiceScope] = useState<WaitlistServiceScopeValue>('grooming')
    const [waitlistModalDateRanges, setWaitlistModalDateRanges] = useState<Array<{ startDate: string; endDate?: string | null }> | undefined>(undefined)
    const [waitlistModalNotes, setWaitlistModalNotes] = useState<string | null>(null)
    const [deletingWaitingListEntryId, setDeletingWaitingListEntryId] = useState<string | null>(null)
    const [notesDialogAppointment, setNotesDialogAppointment] = useState<Appointment | null>(null)
    const [notesDialogValue, setNotesDialogValue] = useState<string>("")
    const [isSavingNotes, setIsSavingNotes] = useState(false)
    const [latePickupDialogState, setLatePickupDialogState] = useState<{ appointment: Appointment; appointmentId: string } | null>(null)
    const [latePickupDialogRequested, setLatePickupDialogRequested] = useState<boolean>(false)
    const [latePickupDialogNotes, setLatePickupDialogNotes] = useState<string>("")
    const [isSavingLatePickup, setIsSavingLatePickup] = useState(false)
    const initialTab = (() => {
        const tabParam = searchParams.get('tab')
        if (tabParam === 'waitingList' || tabParam === 'past' || tabParam === 'upcoming') {
            return tabParam
        }
        return 'upcoming'
    })()
    const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past' | 'waitingList'>(initialTab as 'upcoming' | 'past' | 'waitingList')
    const [serviceFilter, setServiceFilter] = useState<'all' | 'grooming' | 'garden'>('all')

    // Get the filter ID from query parameters
    const filterId = searchParams.get('id')

    const ownerId = useMemo(() => {
        if (clientId) {
            return clientId
        }

        if (!user) {
            return null
        }

        return user.user_metadata?.client_id || null
    }, [clientId, user])

    const canEditAppointmentNotes = useCallback((appointment: Appointment | null | undefined) => {
        if (!appointment) {
            return false
        }
        if (isCancelledStatus(appointment.status)) {
            return false
        }
        if (isAppointmentInPast(appointment)) {
            return false
        }
        return true
    }, [])

    const openNotesDialog = useCallback(
        (appointment: Appointment) => {
            if (!canEditAppointmentNotes(appointment)) {
                return
            }
            setNotesDialogAppointment(appointment)
            setNotesDialogValue(appointment.notes ?? "")
        },
        [canEditAppointmentNotes]
    )

    const closeNotesDialog = useCallback((force = false) => {
        if (!force && isSavingNotes) {
            return
        }
        setNotesDialogAppointment(null)
        setNotesDialogValue("")
    }, [isSavingNotes])

    const appointmentIncludesGarden = (appointment: Appointment) => appointment.service === 'garden' || appointment.service === 'both'

    const gardenOptionDefinitions: Array<{
        key: keyof Pick<Appointment, "gardenTrimNails" | "gardenBrush" | "gardenBath">
        label: string
    }> = [
            { key: "gardenTrimNails", label: "גזירת ציפורניים" },
            { key: "gardenBrush", label: "סירוק" },
            { key: "gardenBath", label: "מקלחת" },
        ]

    const getSelectedGardenOptions = (appointment: Appointment) =>
        gardenOptionDefinitions
            .filter(({ key }) => Boolean(appointment[key]))
            .map(({ label }) => label)

    const getGardenAppointmentId = (appointment: Appointment) => {
        if (appointment.service === 'garden') {
            return appointment.id
        }
        if (appointment.service === 'both') {
            return appointment.gardenAppointmentId ?? null
        }
        return null
    }

    const canManageLatePickup = useCallback((appointment: Appointment) => {
        if (!appointmentIncludesGarden(appointment)) {
            return false
        }
        if (isCancelledStatus(appointment.status)) {
            return false
        }
        if (isAppointmentInPast(appointment)) {
            return false
        }
        const targetId = getGardenAppointmentId(appointment)
        return Boolean(targetId)
    }, [])

    const saveNotesForAppointment = useCallback(async () => {
        if (!notesDialogAppointment) {
            return
        }

        if (!canEditAppointmentNotes(notesDialogAppointment)) {
            toast({
                title: "לא ניתן לעדכן",
                description: "לא ניתן לערוך הערות לתור שכבר הסתיים או שבוטל.",
                variant: "destructive",
            })
            return
        }

        const trimmedNote = notesDialogValue.trim()
        setIsSavingNotes(true)

        try {
            const result = await updateAppointmentNotesRequest(
                notesDialogAppointment.id,
                notesDialogAppointment.service,
                trimmedNote
            )

            if (!result.success) {
                throw new Error(result.error || "שגיאה בשליחת העדכון")
            }

            toast({
                title: "הערות עודכנו",
                description: "ההערות לתור נשלחו לצוות שלנו.",
            })

            dispatch(supabaseApi.util.invalidateTags(["Appointment", "GardenAppointment"]))
            closeNotesDialog(true)
        } catch (error) {
            console.error("Failed to update appointment notes", error)
            toast({
                title: "עדכון הערות נכשל",
                description: error instanceof Error ? error.message : "לא ניתן לעדכן את ההערות כעת",
                variant: "destructive",
            })
        } finally {
            setIsSavingNotes(false)
        }
    }, [canEditAppointmentNotes, closeNotesDialog, dispatch, notesDialogAppointment, notesDialogValue, toast])

    const openLatePickupDialog = useCallback((appointment: Appointment) => {
        const appointmentId = getGardenAppointmentId(appointment)
        if (!appointmentId) {
            toast({
                title: "לא ניתן לעדכן",
                description: "לא נמצאה רשומת גן לעדכון.",
                variant: "destructive",
            })
            return
        }

        setLatePickupDialogState({ appointment, appointmentId })
        setLatePickupDialogRequested(appointment.latePickupRequested ?? false)
        setLatePickupDialogNotes(appointment.latePickupNotes ?? "")
    }, [toast])

    const closeLatePickupDialog = useCallback((force = false) => {
        if (!force && isSavingLatePickup) {
            return
        }
        setLatePickupDialogState(null)
        setLatePickupDialogRequested(false)
        setLatePickupDialogNotes("")
    }, [isSavingLatePickup])

    const saveLatePickupPreference = useCallback(async () => {
        if (!latePickupDialogState) {
            return
        }

        setIsSavingLatePickup(true)
        const trimmedNotes = latePickupDialogNotes.trim()

        try {
            const result = await updateLatePickup(
                latePickupDialogState.appointmentId,
                latePickupDialogRequested,
                trimmedNotes || undefined
            )

            if (!result.success) {
                throw new Error(result.error || "שגיאה בעדכון האיסוף המאוחר")
            }

            dispatch(
                supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                    'getMergedAppointments',
                    latePickupDialogState.appointment.treatmentId,
                    (draft) => {
                        const target = draft.appointments?.find((apt) =>
                            apt.id === latePickupDialogState.appointment.id ||
                            apt.gardenAppointmentId === latePickupDialogState.appointmentId
                        )

                        if (target) {
                            target.latePickupRequested = latePickupDialogRequested
                            target.latePickupNotes = trimmedNotes
                        }
                    }
                )
            )

            try {
                dispatch(
                    supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                        'getTreatmentGardenAppointments',
                        latePickupDialogState.appointment.treatmentId,
                        (draft) => {
                            const target = draft.appointments?.find((apt) => apt.id === latePickupDialogState.appointmentId)

                            if (target) {
                                target.latePickupRequested = latePickupDialogRequested
                                target.latePickupNotes = trimmedNotes
                            }
                        }
                    )
                )
            } catch (error) {
                console.warn("Skipping garden appointments cache update", error)
            }

            dispatch(supabaseApi.util.invalidateTags(["Appointment", "GardenAppointment"]))

            toast({
                title: "האיסוף המאוחר עודכן",
                description: latePickupDialogRequested ? "סימנו שתאספו מאוחר" : "עודכן שהאיסוף יהיה בשעה הרגילה",
            })

            closeLatePickupDialog(true)
        } catch (error) {
            const message = error instanceof Error ? error.message : "שגיאה בעדכון האיסוף המאוחר"
            toast({
                title: "שגיאה בעדכון",
                description: message,
                variant: "destructive",
            })
        } finally {
            setIsSavingLatePickup(false)
        }
    }, [closeLatePickupDialog, dispatch, latePickupDialogNotes, latePickupDialogRequested, latePickupDialogState, toast])

    const invalidateAppointmentsCache = useCallback(() => {
        dispatch(supabaseApi.util.invalidateTags(["Appointment", "GardenAppointment"]))
    }, [dispatch])

    const renderLatePickupBadge = (latePickupRequested?: boolean, size: 'sm' | 'xs' = 'sm') => {
        if (latePickupRequested === undefined) {
            return null
        }
        const baseClasses = size === 'xs' ? 'text-xs' : 'text-sm'
        const stateClasses = latePickupRequested
            ? 'bg-blue-100 text-blue-800 border-blue-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        const label = latePickupRequested ? 'איסוף מאוחר' : 'איסוף רגיל'

        return (
            <Badge className={`border ${baseClasses} ${stateClasses}`}>
                {label}
            </Badge>
        )
    }

    const latePickupDialogAppointment = latePickupDialogState?.appointment
    const latePickupDialogDateTime = latePickupDialogAppointment
        ? (() => {
            if (latePickupDialogAppointment.startDateTime) {
                const parsed = new Date(latePickupDialogAppointment.startDateTime)
                return Number.isNaN(parsed.getTime()) ? null : parsed
            }
            if (latePickupDialogAppointment.date) {
                const timePortion = latePickupDialogAppointment.time || "09:00"
                const parsed = new Date(`${latePickupDialogAppointment.date}T${timePortion}`)
                return Number.isNaN(parsed.getTime()) ? null : parsed
            }
            return null
        })()
        : null
    const latePickupDialogDateLabel = latePickupDialogDateTime ? formatDateLabel(latePickupDialogDateTime) : ""
    const latePickupDialogTimeLabel = latePickupDialogDateTime ? format(latePickupDialogDateTime, "HH:mm") : (latePickupDialogAppointment?.time ?? "")

    const {
        data: treatmentsQueryData,
        isFetching: isFetchingTreatments,
        isLoading: isLoadingTreatments,
        error: treatmentsQueryError,
        refetch: refetchTreatments,
    } = useListOwnerTreatmentsQuery(ownerId ?? skipToken, {
        skip: !ownerId,
    })

    const treatments = useMemo<Treatment[]>(() => {
        const response = treatmentsQueryData as ListOwnerTreatmentsResponse | undefined
        return response?.treatments ?? []
    }, [treatmentsQueryData])

    const waitlistModalCustomer = useMemo<WaitlistCustomer | null>(() => {
        if (!ownerId) {
            return null
        }
        const fullName =
            typeof user?.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
                ? user.user_metadata.full_name
                : user?.email ?? "לקוח"
        const phone =
            (typeof user?.user_metadata?.phone_number === "string" && user.user_metadata.phone_number.trim().length > 0
                ? user.user_metadata.phone_number
                : typeof user?.phone === "string"
                    ? user.phone
                    : undefined)

        return {
            id: ownerId,
            fullName,
            phone,
            email: typeof user?.email === "string" ? user.email : undefined,
            recordId: ownerId,
        }
    }, [ownerId, user])

    const { data: waitingListData, isFetching: isFetchingWaitingList } = useGetWaitingListEntriesQuery(
        ownerId ? { customerId: ownerId } : skipToken,
        {
            skip: !ownerId,
        }
    )

    const [deleteWaitingListEntry] = useDeleteWaitingListEntryMutation()

    const treatmentIdsKey = useMemo(() => (treatments.length ? treatments.map((treatment) => treatment.id).sort().join("|") : ""), [treatments])

    useEffect(() => {
        if (!treatmentIdsKey) {
            return
        }

        // Fetch merged appointments for all treatments
        const subscriptions = treatments.map((treatment) =>
            dispatch(
                supabaseApi.endpoints.getMergedAppointments.initiate(treatment.id, {
                    forceRefetch: false,
                })
            )
        )

        return () => {
            subscriptions.forEach((subscription) => subscription.unsubscribe())
        }
    }, [dispatch, treatmentIdsKey, treatments])

    const mergedAppointmentsByTreatment = useAppSelector((state) => {
        if (!treatments.length) {
            return [] as Array<{
                treatment: Treatment
                appointments: Appointment[]
                isFetching: boolean
                isLoading: boolean
                error: FetchBaseQueryError | undefined
            }>
        }

        return treatments.map((treatment) => {
            const queryState = supabaseApi.endpoints.getMergedAppointments.select(treatment.id)(state)
            // The API returns the appointments array directly, not an object with 'appointments' property
            const responseData = queryState?.data

            // Handle both array format (current) and object format (legacy)
            const appointments: Appointment[] = Array.isArray(responseData)
                ? responseData
                : (responseData as TreatmentAppointmentsResponse | undefined)?.appointments ?? []

            return {
                treatment,
                appointments,
                isFetching: queryState?.isFetching ?? false,
                isLoading: queryState?.isLoading ?? false,
                error: queryState?.error as FetchBaseQueryError | undefined,
            }
        })
    })

    const allAppointments = useMemo<Appointment[]>(() => {
        return mergedAppointmentsByTreatment.flatMap(({ treatment, appointments }) =>
            appointments.map((appointment) => ({
                ...appointment,
                treatmentId: appointment.treatmentId || treatment.id,
                treatmentName: appointment.treatmentName || treatment.name,
                // Service type is already set correctly by the merged endpoint
            }))
        )
    }, [mergedAppointmentsByTreatment])

    const waitingListEntries = useWaitingListEntries(waitingListData)

    const waitingListEntryGroups = useMemo(() => {
        const grouped = new Map<
            string,
            { id: string; label: string; treatment?: Treatment; entries: WaitingListEntry[] }
        >()

        treatments.forEach((treatment) => {
            grouped.set(treatment.id, {
                id: treatment.id,
                label: treatment.name,
                treatment,
                entries: [],
            })
        })

        const GENERAL_GROUP_KEY = "general"

        waitingListEntries.forEach((entry) => {
            if (entry.treatmentId) {
                const treatment = treatments.find((d) => d.id === entry.treatmentId)
                const key = entry.treatmentId

                if (!grouped.has(key)) {
                    grouped.set(key, {
                        id: key,
                        label: entry.treatmentName ?? "בקשות ללקוח",
                        entries: [],
                    })
                }

                const group = grouped.get(key)!
                if (!group.treatment && treatment) {
                    group.treatment = treatment
                    group.label = treatment.name
                } else if (!group.label) {
                    group.label = entry.treatmentName ?? "בקשות ללקוח"
                }

                group.entries.push(entry)
            } else {
                if (!grouped.has(GENERAL_GROUP_KEY)) {
                    grouped.set(GENERAL_GROUP_KEY, {
                        id: GENERAL_GROUP_KEY,
                        label: "בקשות ללא שיוך ללקוח",
                        entries: [],
                    })
                }

                grouped.get(GENERAL_GROUP_KEY)!.entries.push(entry)
            }
        })

        return Array.from(grouped.values())
            .filter((group) => group.entries.length > 0)
            .map((group) => ({
                ...group,
                entries: group.entries.sort((a, b) => {
                    const aDate = safeParseDate(a.startDate) ?? new Date(a.createdAt)
                    const bDate = safeParseDate(b.startDate) ?? new Date(b.createdAt)
                    return aDate.getTime() - bDate.getTime()
                }),
            }))
    }, [waitingListEntries, treatments])

    const isFetchingAppointments = useMemo(() => {
        return mergedAppointmentsByTreatment.some(
            ({ isFetching, isLoading, appointments }) => (isFetching || isLoading) && (!appointments || appointments.length === 0)
        )
    }, [mergedAppointmentsByTreatment])

    const appointmentErrorMessages = useMemo(() => {
        return mergedAppointmentsByTreatment
            .filter(({ error }) => error)
            .map(({ treatment, error }) => {
                const message = extractErrorMessage(error, "שגיאה בלתי ידועה")
                return `שגיאה בטעינת תורים עבור ${treatment.name}: ${message}`
            })
    }, [mergedAppointmentsByTreatment])

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam === 'waitingList' || tabParam === 'past' || tabParam === 'upcoming') {
            if (tabParam !== selectedTab) {
                setSelectedTab(tabParam as 'upcoming' | 'past' | 'waitingList')
            }
        }
    }, [searchParams])

    const treatmentsErrorMessage = useMemo(
        () => extractErrorMessage(treatmentsQueryError, "שגיאה בטעינת רשימת הלקוחות"),
        [treatmentsQueryError]
    )

    const combinedError = treatmentsErrorMessage || appointmentErrorMessages[0] || null

    const isInitialLoading =
        isAuthLoading ||
        (!ownerId && isAuthLoading) ||
        (ownerId && (isLoadingTreatments || (isFetchingTreatments && !treatments.length))) ||
        (treatments.length > 0 && isFetchingAppointments)

    const handleRetry = async () => {
        if (!ownerId) {
            return
        }

        await refetchTreatments()

        await Promise.all(
            treatments.map(async (treatment) => {
                const result = dispatch(
                    supabaseApi.endpoints.getMergedAppointments.initiate(treatment.id, {
                        forceRefetch: true,
                    })
                )

                try {
                    await result.unwrap()
                } catch (err) {
                    console.error("Failed to refetch appointments for", treatment.name, err)
                } finally {
                    result.unsubscribe()
                }
            })
        )
    }

    // Filter appointments by ID if provided, otherwise show all
    const treatmentFilteredAppointments = filterId
        ? allAppointments.filter(apt => apt.treatmentId === filterId || apt.id === filterId)
        : allAppointments

    const serviceFilteredAppointments = useMemo(() => {
        if (serviceFilter === 'all') {
            return treatmentFilteredAppointments
        }
        return treatmentFilteredAppointments.filter((apt) => {
            if (serviceFilter === 'grooming') {
                return apt.service === 'grooming' || apt.service === 'both'
            }
            if (serviceFilter === 'garden') {
                return apt.service === 'garden' || apt.service === 'both'
            }
            return apt.service === serviceFilter
        })
    }, [treatmentFilteredAppointments, serviceFilter])

    // Separate appointments by status and date
    const now = new Date()
    const upcomingAppointments = serviceFilteredAppointments.filter(apt => {
        const appointmentDate = new Date(`${apt.date}T${apt.time}`)
        return appointmentDate > now && apt.status !== "cancelled"
    }).sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`)
        const dateB = new Date(`${b.date}T${b.time}`)
        return dateA.getTime() - dateB.getTime()
    })

    const pastAppointments = serviceFilteredAppointments.filter(apt => {
        const appointmentDate = new Date(`${apt.date}T${apt.time}`)
        return appointmentDate <= now || apt.status === "cancelled"
    }).sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`)
        const dateB = new Date(`${b.date}T${b.time}`)
        return dateB.getTime() - dateA.getTime() // Most recent first
    })

    const getStatusBadge = (appointment: Appointment) => {
        const status = appointment.status
        const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
        const isPast = appointmentDate <= new Date()

        if (!status) {
            return null
        }

        if (status === "cancelled" || status === "בוטל") {
            return <Badge className="bg-red-100 text-red-800 border-red-200">בוטל</Badge>
        }

        if (status === "approved" || status === "מאושר") {
            if (isPast) {
                return <Badge className="bg-green-100 text-green-800 border-green-200">הושלם</Badge>
            }
            return <Badge className="bg-green-200 text-green-900 border-green-300">מאושר</Badge>
        }

        if (status === "confirmed" || status === "תואם") {
            return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">תואם</Badge>
        }

        if (status === "pending" || status === "ממתין") {
            return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">ממתין</Badge>
        }

        if (status === "completed" || status === "הושלם" || (isPast && status !== "")) {
            return <Badge className="bg-green-100 text-green-800 border-green-200">הושלם</Badge>
        }

        // Fallback for unknown status values
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>
    }

    const getServiceIcon = (service: string) => {
        switch (service.toLowerCase()) {
            case "grooming":
                return <Scissors className="h-4 w-4 text-blue-600" />
            case "garden":
                return <Bone className="h-4 w-4 text-amber-600" />
            case "both":
                return (
                    <div className="flex items-center gap-1">
                        <Scissors className="h-3 w-3 text-blue-600" />
                        <Bone className="h-3 w-3 text-amber-600" />
                    </div>
                )
            default:
                return <Clock className="h-4 w-4 text-gray-600" />
        }
    }


    const getWaitingListStatusBadge = (status: string | null) => {
        if (!status) {
            return <Badge className="bg-amber-100 text-amber-700 border-amber-200">ממתין</Badge>
        }

        const normalized = status.toLowerCase()

        if (normalized.includes("cancel") || normalized.includes("בוטל")) {
            return <Badge className="bg-red-100 text-red-700 border-red-200">בוטל</Badge>
        }

        if (normalized.includes("notify") || normalized.includes("notified")) {
            return <Badge className="bg-blue-100 text-blue-700 border-blue-200">הודעה נשלחה</Badge>
        }

        if (normalized.includes("approve") || normalized.includes("confirmed") || normalized.includes("מאושר")) {
            return <Badge className="bg-emerald-200 text-emerald-800 border-emerald-300">מאושר</Badge>
        }

        if (normalized.includes("pending") || normalized.includes("wait") || normalized.includes("ממתין")) {
            return <Badge className="bg-amber-100 text-amber-700 border-amber-200">ממתין</Badge>
        }

        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{status}</Badge>
    }

    const getServiceTypeBadge = (serviceType: string | null) => {
        const normalized = serviceType?.toLowerCase() ?? "grooming"

        if (normalized === "garden") {
            return (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                    <Bone className="h-3 w-3" />
                    <span>גן</span>
                </Badge>
            )
        }

        if (normalized === "both") {
            return (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 flex items-center gap-1">
                    <Scissors className="h-3 w-3" />
                    <Bone className="h-3 w-3" />
                    <span>תספורת+גן</span>
                </Badge>
            )
        }

        return (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1">
                <Scissors className="h-3 w-3" />
                <span>תספורת</span>
            </Badge>
        )
    }

    function safeParseDate(value?: string | null) {
        if (!value) return undefined
        const date = new Date(value)
        if (isNaN(date.getTime())) {
            return undefined
        }
        date.setHours(0, 0, 0, 0)
        return date
    }



    const formatDateDisplay = (value?: string | null) => {
        if (!value) return null
        const date = new Date(value)
        if (isNaN(date.getTime())) return null
        return format(date, "dd MMM yyyy", { locale: he })
    }

    const formatWaitingListDateRanges = (ranges: Array<{ startDate: string; endDate: string }>) => {
        if (!ranges || ranges.length === 0) {
            return "לא הוגדר טווח תאריכים"
        }

        return ranges
            .map((range) => {
                const start = formatDateDisplay(range.startDate) ?? range.startDate
                const end = formatDateDisplay(range.endDate) ?? range.endDate

                if (!start && !end) {
                    return "תאריך לא תקין"
                }

                if (start === end || !end) {
                    return start || end || ""
                }

                return `${start} - ${end}`
            })
            .join(" • ")
    }

    function formatDateLabel(date: Date) {
        return format(date, "dd MMM yyyy", { locale: he })
    }

    const normalizeServiceScopeFromEntry = (serviceType?: string | null): WaitlistServiceScopeValue => {
        if (!serviceType) {
            return 'grooming'
        }
        const normalized = serviceType.toLowerCase()
        if (normalized === 'daycare') {
            return 'garden'
        }
        if (normalized === 'garden') {
            return 'garden'
        }
        if (normalized === 'both') {
            return 'both'
        }
        return 'grooming'
    }

    const mapServiceScopeToApi = (scope: WaitlistServiceScopeValue): 'grooming' | 'daycare' | 'both' => {
        if (scope === 'garden' || scope === 'daycare') {
            return 'daycare'
        }
        return scope
    }

    const getEntryDateRanges = (entry: WaitingListEntry): Array<{ startDate: string; endDate: string | null }> => {
        if (entry.dateRanges && entry.dateRanges.length > 0) {
            return entry.dateRanges.map((range) => ({
                startDate: range.startDate,
                endDate: range.endDate ?? range.startDate,
            }))
        }

        if (entry.startDate) {
            return [{
                startDate: entry.startDate,
                endDate: entry.endDate ?? entry.startDate,
            }]
        }

        return []
    }

    // Check if appointment can be cancelled (more than 24 hours remaining)
    const canCancelAppointment = (appointment: Appointment) => {
        if (appointment.status === 'cancelled' || appointment.status === 'בוטל') return false

        // Use startDateTime if available, otherwise construct from date and time
        const appointmentDateTime = appointment.startDateTime
            ? new Date(appointment.startDateTime)
            : new Date(`${appointment.date}T${appointment.time}:00`)

        const now = new Date()
        const timeDifferenceHours = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

        return timeDifferenceHours > 24
    }

    const isApprovedStatus = (status?: string | null) => status === 'approved' || status === 'מאושר'
    const isCancelledStatus = (status?: string | null) => status === 'cancelled' || status === 'בוטל'

    const needsApproval = (appointment: Appointment) => {
        const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
        const now = new Date()
        const isFuture = appointmentDate > now
        const status = appointment.status
        const isApproved = isApprovedStatus(status)
        const isCancelled = isCancelledStatus(status)

        return isFuture && !isApproved && !isCancelled
    }

    const getApprovalBadge = (appointment: Appointment) => {
        const status = appointment.status
        if (status === 'pending' || status === 'ממתין') {
            return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">ממתין לאישור</Badge>
        }

        return null
    }

    const handleCancelAppointment = (appointment: Appointment) => {
        setAppointmentPendingCancellation(appointment)
    }

    const closeCancelDialog = () => {
        if (isCancellingAppointment) {
            return
        }
        setAppointmentPendingCancellation(null)
    }

    const confirmCancelAppointment = async () => {
        if (!appointmentPendingCancellation) {
            return
        }

        const appointment = appointmentPendingCancellation
        setIsCancellingAppointment(true)

        try {
            // Handle "both" appointments by cancelling both grooming and garden appointments
            if (appointment.service === 'both' && appointment.groomingAppointmentId && appointment.gardenAppointmentId) {
                const result = await cancelCombinedAppointments({
                    groomingAppointmentId: appointment.groomingAppointmentId,
                    gardenAppointmentId: appointment.gardenAppointmentId,
                })

                if (result.success) {
                    // Update the merged appointments cache
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            appointment.treatmentId,
                            (draft) => {
                                const target = draft.appointments?.find((apt) => apt.id === appointment.id)
                                if (target) {
                                    target.status = "cancelled"
                                    target.groomingStatus = "cancelled"
                                    target.gardenStatus = "cancelled"
                                }
                            }
                        )
                    )

                    setAppointmentPendingCancellation(null)

                    toast({
                        title: "התורים בוטלו",
                        description:
                            result.message || `התורים (תספורת וגן) ל${appointment.treatmentName} בוטלו בהצלחה`,
                    })
                    invalidateAppointmentsCache()
                } else {
                    console.error(`Failed to cancel both appointments:`, result.error)
                    toast({
                        title: "לא ניתן לבטל את התורים",
                        description: result.error || "שגיאה בביטול התורים",
                        variant: "destructive",
                    })
                }
            } else {
                // Handle single appointments (grooming or garden only)
                const appointmentTime =
                    appointment.startDateTime ||
                    (appointment.date && appointment.time ? `${appointment.date}T${appointment.time}` : undefined)

                const result = await cancelAppointmentWebhook(appointment.id, {
                    serviceType: appointment.service,
                    appointmentTime,
                    treatmentId: appointment.treatmentId,
                    stationId: appointment.stationId,
                })

                if (result.success) {
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            appointment.treatmentId,
                            (draft) => {
                                const target = draft.appointments?.find((apt) => apt.id === appointment.id)
                                if (target) {
                                    target.status = "cancelled"
                                }
                            }
                        )
                    )

                    setAppointmentPendingCancellation(null)

                    const successMessage = result.message || "התור בוטל בהצלחה"
                    toast({
                        title: "התור בוטל",
                        description: successMessage,
                    })
                    invalidateAppointmentsCache()
                } else {
                    const errorMessage = result.error || "שגיאה בביטול התור"
                    console.error("Failed to cancel appointment:", errorMessage)
                    toast({
                        title: "לא ניתן לבטל את התור",
                        description: errorMessage,
                        variant: "destructive",
                    })
                }
            }
        } catch (err) {
            console.error("Failed to cancel appointment:", err)
            const errorMessage = err instanceof Error ? err.message : "שגיאה בביטול התור"
            toast({
                title: "שגיאה בביטול התור",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsCancellingAppointment(false)
        }
    }

    // Individual appointment handlers for "both" type appointments
    const handleIndividualApproval = async (appointmentId: string, service: 'grooming' | 'garden') => {
        setApprovingAppointmentId(appointmentId)

        try {
            const result = service === 'grooming'
                ? await approveGroomingAppointment(appointmentId, 'approved')
                : await approveAppointment(appointmentId, 'approved')

            if (result.success) {
                // Update the merged appointments cache for all treatments
                treatments.forEach(treatment => {
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            treatment.id,
                            (draft) => {
                                const target = draft.appointments?.find((apt) =>
                                    apt.groomingAppointmentId === appointmentId ||
                                    apt.gardenAppointmentId === appointmentId
                                )
                                if (target) {
                                    if (service === 'grooming') {
                                        target.groomingStatus = 'approved'
                                    } else {
                                        target.gardenStatus = 'approved'
                                    }
                                    if (target.service === 'both') {
                                        const otherStatus = service === 'grooming'
                                            ? target.gardenStatus
                                            : target.groomingStatus
                                        if (otherStatus === 'approved') {
                                            target.status = 'approved'
                                        }
                                    } else {
                                        target.status = 'approved'
                                    }
                                }
                            }
                        )
                    )
                })

                toast({
                    title: "התור אושר",
                    description: "התור אושר בהצלחה",
                })
                invalidateAppointmentsCache()
            } else {
                console.error(`Failed to approve individual appointment:`, result.error)
                toast({
                    title: "שגיאה באישור התור",
                    description: result.error || "שגיאה באישור התור",
                    variant: "destructive",
                })
            }
        } catch (err) {
            console.error(`Error approving individual appointment:`, err)
            const errorMessage = err instanceof Error ? err.message : "שגיאה באישור התור"
            toast({
                title: "שגיאה באישור התור",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setApprovingAppointmentId(null)
        }
    }

    const handleIndividualCancellation = async (appointmentId: string, service: 'grooming' | 'garden') => {
        setCancellingAppointmentId(appointmentId)

        try {

            const appointmentDetails = allAppointments.find((apt) =>
                apt.id === appointmentId ||
                apt.groomingAppointmentId === appointmentId ||
                apt.gardenAppointmentId === appointmentId
            )

            const appointmentTime = appointmentDetails?.startDateTime ||
                (appointmentDetails?.date && appointmentDetails?.time
                    ? `${appointmentDetails.date}T${appointmentDetails.time}`
                    : undefined)

            const result = await cancelAppointmentWebhook(appointmentId, {
                serviceType: service,
                appointmentTime,
                treatmentId: appointmentDetails?.treatmentId,
                stationId: appointmentDetails?.stationId,
            })

            if (result.success) {
                // Update the merged appointments cache for all treatments
                treatments.forEach(treatment => {
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            treatment.id,
                            (draft) => {
                                const target = draft.appointments?.find((apt) =>
                                    apt.groomingAppointmentId === appointmentId ||
                                    apt.gardenAppointmentId === appointmentId
                                )
                                if (target) {
                                    if (service === 'grooming') {
                                        target.groomingStatus = 'cancelled'
                                    } else {
                                        target.gardenStatus = 'cancelled'
                                    }
                                    target.status = "cancelled"
                                }
                            }
                        )
                    )
                })

                toast({
                    title: "התור בוטל",
                    description: "התור בוטל בהצלחה",
                })
                invalidateAppointmentsCache()
            } else {
                console.error(`Failed to cancel individual appointment:`, result.error)
                toast({
                    title: "לא ניתן לבטל את התור",
                    description: result.error || "שגיאה בביטול התור",
                    variant: "destructive",
                })
            }
        } catch (err) {
            console.error(`Failed to cancel individual appointment:`, err)
            const errorMessage = err instanceof Error ? err.message : "שגיאה בביטול התור"
            toast({
                title: "שגיאה בביטול התור",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setCancellingAppointmentId(null)
        }
    }

    const handleIndividualNotesUpdate = async (appointmentId: string, service: 'grooming' | 'garden', notes: string) => {
        try {
            const result = await updateAppointmentNotesRequest(appointmentId, service, notes)

            if (result.success) {
                toast({
                    title: "הערות עודכנו",
                    description: "הערות התור עודכנו בהצלחה",
                })

                treatments.forEach(treatment => {
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            treatment.id,
                            (draft) => {
                                const target = draft.appointments?.find((apt) =>
                                    apt.groomingAppointmentId === appointmentId ||
                                    apt.gardenAppointmentId === appointmentId
                                )
                                if (target) {
                                    if (service === 'grooming') {
                                        target.groomingNotes = notes
                                    } else {
                                        target.gardenNotes = notes
                                    }

                                    if (target.service === service) {
                                        target.notes = notes
                                    } else if (target.service === 'both') {
                                        const combinedNotes = [
                                            target.groomingNotes?.trim(),
                                            target.gardenNotes?.trim(),
                                        ]
                                            .filter(Boolean)
                                            .join(' | ')
                                        target.notes = combinedNotes
                                    }
                                }
                            }
                        )
                    )
                })
            } else {
                console.error(`Failed to update notes for appointment ${appointmentId}:`, result.error)
                toast({
                    title: "שגיאה בעדכון ההערות",
                    description: result.error || "שגיאה בעדכון ההערות",
                    variant: "destructive",
                })
            }
        } catch (err) {
            console.error(`Error updating notes for appointment ${appointmentId}:`, err)
            const errorMessage = err instanceof Error ? err.message : "שגיאה בעדכון ההערות"
            toast({
                title: "שגיאה בעדכון ההערות",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }

    const handleApproval = async (appointment: Appointment) => {
        setApprovingAppointmentId(appointment.id)

        try {
            // Handle "both" appointments by approving both grooming and garden appointments
            if (appointment.service === 'both' && appointment.groomingAppointmentId && appointment.gardenAppointmentId) {
                const result = await approveCombinedAppointments({
                    groomingAppointmentId: appointment.groomingAppointmentId,
                    gardenAppointmentId: appointment.gardenAppointmentId,
                })

                if (result.success) {
                    // Update the merged appointments cache
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            appointment.treatmentId,
                            (draft) => {
                                const target = draft.appointments?.find((apt) => apt.id === appointment.id)
                                if (target) {
                                    target.status = 'approved'
                                    target.groomingStatus = 'approved'
                                    target.gardenStatus = 'approved'
                                }
                            }
                        )
                    )

                    toast({
                        title: "התורים אושרו",
                        description:
                            result.message || `התורים (תספורת וגן) ל${appointment.treatmentName} אושרו בהצלחה`,
                    })
                    invalidateAppointmentsCache()
                } else {
                    console.error(`Failed to approve both appointments:`, result.error)
                    toast({
                        title: "שגיאה באישור התורים",
                        description: result.error || "שגיאה באישור התורים",
                        variant: "destructive",
                    })
                }
            } else {
                // Handle single appointments (grooming or garden only)
                const result = appointment.service === 'grooming'
                    ? await approveGroomingAppointment(appointment.id, 'approved')
                    : await approveAppointment(appointment.id, 'approved')

                if (result.success) {
                    dispatch(
                        supabaseApi.util.updateQueryData<TreatmentAppointmentsResponse>(
                            'getMergedAppointments',
                            appointment.treatmentId,
                            (draft) => {
                                const target = draft.appointments?.find((apt) => apt.id === appointment.id)
                                if (target) {
                                    target.status = 'approved'
                                }
                            }
                        )
                    )

                    const successMessage = result.message || "התור אושר בהצלחה"
                    toast({
                        title: "התור אושר",
                        description: successMessage,
                    })
                    invalidateAppointmentsCache()
                } else {
                    console.error(`Failed to approve appointment:`, result.error)
                    const errorMessage = result.error || "שגיאה באישור התור"
                    toast({
                        title: "שגיאה באישור התור",
                        description: errorMessage,
                        variant: "destructive",
                    })
                }
            }
        } catch (err) {
            console.error(`Error approving appointment:`, err)
            const errorMessage = err instanceof Error ? err.message : "שגיאה באישור התור"
            toast({
                title: "שגיאה באישור התור",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setApprovingAppointmentId(null)
        }
    }

    const handleTabChange = (value: string) => {
        if (value !== 'upcoming' && value !== 'past' && value !== 'waitingList') {
            return
        }

        setSelectedTab(value)

        const params = new URLSearchParams(searchParams)
        params.set('tab', value)
        params.delete('action')
        params.delete('treatmentId')
        params.delete('serviceType')
        setSearchParams(params, { replace: true })
    }

    const openWaitingListDialog = (entry?: WaitingListEntry, options?: { serviceType?: string }) => {
        if (entry) {
            setEditingWaitingListEntry(entry)
            setWaitlistModalServiceScope(normalizeServiceScopeFromEntry(entry.serviceType))
            setWaitlistModalDateRanges(getEntryDateRanges(entry))
            setWaitlistModalNotes(entry.notes ?? "")
        } else {
            setEditingWaitingListEntry(null)
            setWaitlistModalServiceScope(
                options?.serviceType ? normalizeServiceScopeFromEntry(options.serviceType) : 'grooming'
            )
            setWaitlistModalDateRanges(undefined)
            setWaitlistModalNotes(null)
        }

        setIsWaitingListDialogOpen(true)
    }

    useEffect(() => {
        const tabParam = searchParams.get('tab')
        const actionParam = searchParams.get('action')
        if (tabParam === 'waitingList' && actionParam === 'new') {
            const serviceTypeParam = searchParams.get('serviceType')
            const validServiceTypes = new Set(['grooming', 'garden', 'both'])
            const chosenService = serviceTypeParam && validServiceTypes.has(serviceTypeParam) ? serviceTypeParam : 'grooming'

            openWaitingListDialog(undefined, { serviceType: chosenService })

            const params = new URLSearchParams(searchParams)
            params.set('tab', 'waitingList')
            params.delete('action')
            params.delete('serviceType')
            params.delete('treatmentId')
            setSearchParams(params, { replace: true })
        }
    }, [openWaitingListDialog, searchParams])

    const closeWaitingListDialog = () => {
        setIsWaitingListDialogOpen(false)
        setEditingWaitingListEntry(null)
        setWaitlistModalDateRanges(undefined)
        setWaitlistModalNotes(null)
    }







    const handleDeleteWaitingListEntry = async (entry: WaitingListEntry) => {
        try {
            setDeletingWaitingListEntryId(entry.id)
            const result = await deleteWaitingListEntry(entry.id).unwrap()
            toast({ title: "הפריט הוסר", description: result?.message || "בקשת ההמתנה הוסרה בהצלחה" })
            dispatch(supabaseApi.util.invalidateTags(["WaitingList"]))
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : (error as any)?.data ?? "שגיאה בהסרת בקשת ההמתנה"
            toast({ title: "שגיאה", description: String(errorMessage), variant: "destructive" })
        } finally {
            setDeletingWaitingListEntryId(null)
        }
    }

    const handleWaitlistSubmit = useCallback(
        async (submission: WaitlistModalSubmission) => {
            const customerId = submission.customer.id
            if (!customerId) {
                throw new Error("יש לבחור לקוח עבור בקשת ההמתנה")
            }

            const dateRanges = submission.entries.map(({ startDate, endDate }) => ({
                startDate,
                endDate: endDate ?? startDate,
            }))

            const serviceScope = mapServiceScopeToApi(submission.serviceScope)

            const apiResult =
                submission.mode === 'edit' && submission.entryId
                    ? await updateWaitingListEntry(submission.entryId, serviceScope, dateRanges)
                    : await registerWaitingList(customerId, serviceScope, dateRanges, user?.id)

            if (!apiResult?.success) {
                throw new Error(apiResult?.error || "שגיאה בשמירת בקשת ההמתנה")
            }

            dispatch(supabaseApi.util.invalidateTags(["WaitingList"]))
        },
        [dispatch, user?.id]
    )

    if (isInitialLoading) {
        return (
            <div className="min-h-screen container mx-auto px-4 py-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">טוען תורים...</p>
                    <div className="mt-4 space-y-2">
                        <p className="text-sm text-gray-500">טוען רשימת הלקוחות</p>
                        <p className="text-sm text-gray-500">טוען תורים עבור כל לקוח</p>
                    </div>
                </div>
            </div>
        )
    }

    if (combinedError) {
        return (
            <div className="min-h-screen container mx-auto px-4 py-8">
                <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-12 text-center">
                        <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-red-800 mb-2">שגיאה בטעינת התורים</h3>
                        <p className="text-red-600 mb-4">{combinedError}</p>
                        <Button
                            onClick={handleRetry}
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-100"
                        >
                            נסה שוב
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen container mx-auto px-4 py-8">
                <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-12 text-center">
                        <CheckCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">יש להתחבר תחילה</h3>
                        <p className="text-gray-600">יש להתחבר לחשבון שלך כדי לראות את התורים שלך.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!ownerId) {
        return (
            <div className="min-h-screen container mx-auto px-4 py-8">
                <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-12 text-center">
                        <AlertTriangle className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">חשבון לא מוגדר</h3>
                        <p className="text-gray-600 mb-4">
                            {clientIdError
                                ? `החשבון שלך לא הוגדר כראוי: ${clientIdError.message}`
                                : "החשבון שלך לא מוגדר כראוי. אנא פנה לתמיכה."}
                        </p>
                        <Button asChild className="w-full">
                            <a href="/profile-settings">הגדר חשבון</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <>
            <Dialog
                open={Boolean(appointmentPendingCancellation)}
                onOpenChange={(open) => {
                    if (!open) {
                        closeCancelDialog()
                    }
                }}
            >
                <DialogContent dir="rtl" className="max-w-lg sm:max-w-xl text-right">
                    {appointmentPendingCancellation && (
                        <div className="space-y-5">
                            <DialogHeader className="space-y-4 text-right">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                </div>
                                <DialogTitle className="text-2xl font-semibold text-right">בטוחים שרוצים לבטל?</DialogTitle>
                                <DialogDescription className="text-sm leading-6 text-gray-600 text-right">
                                    אנחנו נבטל את התור ונעדכן את הצוות. ניתן תמיד לקבוע תור חדש בכל זמן.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-right space-y-3">
                                <div className="text-base font-semibold text-red-800">
                                    {appointmentPendingCancellation.treatmentName || "לקוח לא ידוע"}
                                </div>
                                <div className="flex items-center  gap-2 text-sm text-red-700">
                                    <CalendarIcon className="h-4 w-4" />
                                    <span>{format(new Date(appointmentPendingCancellation.date), "dd MMM yyyy", { locale: he })}</span>
                                </div>
                                <div className="flex items-center  gap-2 text-sm text-red-700">
                                    <Clock className="h-4 w-4" />
                                    <span>{appointmentPendingCancellation.time}</span>
                                </div>
                                <div className="flex items-center  gap-2 text-sm text-red-700">
                                    {getServiceIcon(appointmentPendingCancellation.service)}
                                    <span>{getServiceName(appointmentPendingCancellation.service)}</span>
                                </div>
                            </div>

                            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse sm:space-x-reverse sm:space-x-2">
                                <Button
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={confirmCancelAppointment}
                                    disabled={isCancellingAppointment}
                                >
                                    {isCancellingAppointment ? "מבטל..." : "בטל תור"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={closeCancelDialog}
                                    disabled={isCancellingAppointment}
                                >
                                    השאר את התור
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(notesDialogAppointment)}
                onOpenChange={(open) => {
                    if (!open) {
                        closeNotesDialog()
                    }
                }}
            >
                <DialogContent dir="rtl" className="max-w-lg text-right space-y-5">
                    <DialogHeader className="space-y-2 text-right">
                        <DialogTitle className="flex items-center justify-start gap-2 text-right">
                            <MessageSquareText className="h-5 w-5 text-blue-600" />
                            <span className="text-lg font-bold text-gray-900">עריכת הערות לתור</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-gray-600 leading-6 text-right">
                            עדכון ההערות יישלח לצוות שלנו שיטפל בתור הזה עבורכם.
                        </DialogDescription>
                    </DialogHeader>
                    {notesDialogAppointment && (
                        <div className="space-y-5">
                            <div className="space-y-3 text-sm text-gray-600 text-right">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                        <CalendarIcon className="h-4 w-4 text-gray-500" />
                                        <span>{format(new Date(notesDialogAppointment.date), "dd MMM yyyy", { locale: he })}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-row-reverse">
                                        <Clock className="h-4 w-4 text-gray-500" />
                                        <span>{notesDialogAppointment.time}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-row-reverse justify-end">
                                    {getServiceIcon(notesDialogAppointment.service)}
                                    <span>{getServiceName(notesDialogAppointment.service)}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 text-right block">הערות לתור</label>
                                <Textarea
                                    value={notesDialogValue}
                                    onChange={(event) => setNotesDialogValue(event.target.value)}
                                    rows={5}
                                    dir="rtl"
                                    placeholder="הוסיפו כאן בקשות או מידע שחשוב לצוות שלנו לדעת..."
                                    className="text-right"
                                />
                                <p className="text-xs text-gray-500 text-right">ניתן להשאיר ריק אם ברצונכם להסיר את ההערות הקיימות.</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex gap-2 ml-auto">
                        <Button
                            variant="outline"
                            onClick={() => closeNotesDialog()}
                            disabled={isSavingNotes}
                            className="min-w-[96px]"
                        >
                            בטל
                        </Button>
                        <Button
                            onClick={saveNotesForAppointment}
                            disabled={isSavingNotes}
                            className="bg-blue-600 hover:bg-blue-700 min-w-[120px] flex items-center gap-2"
                        >
                            {isSavingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            שמור הערות
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(latePickupDialogState)} onOpenChange={(open) => (!open ? closeLatePickupDialog() : null)}>
                <DialogContent dir="rtl" className="max-w-lg text-right space-y-5">
                    <DialogHeader className="space-y-2 text-right">
                        <div className="flex items-center justify-start gap-3">
                            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                                <Clock className="h-5 w-5 text-blue-600" />
                            </div>
                            <DialogTitle className="text-xl font-semibold text-gray-900">עדכון איסוף מאוחר</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-gray-600 leading-relaxed text-right">
                            ספרו לנו אם תרצו להאריך את השהות במספרה ביום הזה. זמינות מאוחרת פתוחה עד 17:30.
                        </DialogDescription>
                    </DialogHeader>

                    {latePickupDialogAppointment && (
                        <div className="space-y-4">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
                                <div className="font-semibold">{latePickupDialogAppointment.treatmentName || "לקוח"}</div>
                                <div className="flex flex-wrap items-center gap-3  text-xs text-gray-500">
                                    {latePickupDialogDateLabel && (
                                        <div className="flex items-center gap-1">
                                            <CalendarIcon className="h-3 w-3" />
                                            <span>{latePickupDialogDateLabel}</span>
                                        </div>
                                    )}
                                    {latePickupDialogTimeLabel && (
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>{latePickupDialogTimeLabel}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                                <input
                                    type="checkbox"
                                    id="late-pickup-toggle"
                                    checked={latePickupDialogRequested}
                                    onChange={(event) => {
                                        const checked = event.target.checked
                                        setLatePickupDialogRequested(checked)
                                        if (!checked) {
                                            setLatePickupDialogNotes("")
                                        }
                                    }}
                                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="text-right space-y-1" dir="rtl">
                                    <label htmlFor="late-pickup-toggle" className="text-sm font-medium text-blue-900 cursor-pointer">
                                        כן, אני רוצה איסוף מאוחר עד 17:30
                                    </label>
                                    <p className="text-xs text-blue-700">
                                        אם לא תבחרו באפשרות זו, נניח שהאיסוף יהיה בשעה הרגילה (עד 15:30).
                                    </p>
                                </div>
                            </div>

                            {latePickupDialogRequested && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 text-right block" htmlFor="late-pickup-details">
                                        פרטי האיסוף המאוחר (אופציונלי)
                                    </label>
                                    <Textarea
                                        id="late-pickup-details"
                                        value={latePickupDialogNotes}
                                        onChange={(event) => setLatePickupDialogNotes(event.target.value)}
                                        rows={4}
                                        dir="rtl"
                                        placeholder="מתי תרצו לאסוף? האם יש פרטים נוספים שכדאי שנדע?"
                                        className="text-right focus-visible:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 text-right">נעדכן את הצוות שלנו בפרטים שתרשמו כאן.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 ml-auto">
                        <Button
                            variant="outline"
                            onClick={() => closeLatePickupDialog()}
                            disabled={isSavingLatePickup}
                            className="min-w-[96px]"
                        >
                            בטל
                        </Button>
                        <Button
                            onClick={saveLatePickupPreference}
                            disabled={isSavingLatePickup || !latePickupDialogState}
                            className="bg-blue-600 hover:bg-blue-700 min-w-[140px] flex items-center gap-2"
                        >
                            {isSavingLatePickup ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            שמור עדכון
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AddWaitlistEntryModal
                open={isWaitingListDialogOpen}
                onOpenChange={(open) => {
                    if (open) {
                        setIsWaitingListDialogOpen(true)
                    } else {
                        closeWaitingListDialog()
                    }
                }}
                onSubmit={handleWaitlistSubmit}
                defaultCustomer={waitlistModalCustomer}
                disableCustomerSelection={Boolean(waitlistModalCustomer)}
                title={editingWaitingListEntry ? "עריכת בקשת המתנה" : "בקשת המתנה חדשה"}
                description="בחר את פרטי הלקוח וסוג השירות כדי לקבל התראה כאשר יפתח תור פנוי."
                submitLabel={editingWaitingListEntry ? "עדכן בקשה" : "הוסף לרשימת המתנה"}
                serviceScopeOptions={[
                    { value: 'grooming', label: 'תספורת' },
                    { value: 'garden', label: 'גן' },
                    { value: 'both', label: 'תספורת וגן' },
                ]}
                initialServiceScope={waitlistModalServiceScope}
                initialDateRanges={waitlistModalDateRanges}
                initialNotes={waitlistModalNotes}
                entryId={editingWaitingListEntry?.id}
            />

            <div className="min-h-screen container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">התורים שלי</h1>
                    <p className="text-gray-600">
                        {filterId
                            ? `תורים מסוננים לפי מזהה: ${filterId}`
                            : "ניהול התורים שלך"
                        }
                    </p>
                </div>

                {allAppointments.length === 0 ? (
                    <Card className="bg-gray-50 border-gray-200">
                        <CardContent className="p-12 text-center">
                            <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">אין תורים</h3>
                            <p className="text-gray-600 mb-4">עדיין לא קבעת תורים עבור הלקוחות שלך.</p>
                            <Button
                                onClick={() => navigate('/setup-appointment')}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                קבע תור חדש
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Tabs value={selectedTab} onValueChange={handleTabChange} className="space-y-6">
                        <TabsList dir="rtl" className="grid w-full grid-cols-3 rounded-xl bg-white/80 border border-white/80 shadow-sm overflow-hidden">
                            <TabsTrigger
                                value="past"
                                className="flex flex-row-reverse items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-blue-100/90 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-400 data-[state=inactive]:hover:bg-white data-[state=inactive]:hover:text-gray-700 transition-colors"
                            >
                                <History className="h-4 w-4" />
                                <span>תורי עבר</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="upcoming"
                                className="flex flex-row-reverse items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-blue-100/90 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-400 data-[state=inactive]:hover:bg-white data-[state=inactive]:hover:text-gray-700 transition-colors"
                            >
                                <CalendarClock className="h-4 w-4" />
                                <span>תורים עתידיים</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="waitingList"
                                className="flex flex-row-reverse items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-blue-100/90 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-400 data-[state=inactive]:hover:bg-white data-[state=inactive]:hover:text-gray-700 transition-colors"
                            >
                                <BellRing className="h-4 w-4" />
                                <span>רשימת המתנה</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="upcoming" className="space-y-4">
                            <div className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-2" dir="rtl">
                                <span className="text-sm font-medium text-gray-700 text-right">סינון לפי שירות</span>
                                <Select
                                    value={serviceFilter}
                                    onValueChange={(value) => setServiceFilter(value as 'all' | 'grooming' | 'garden')}
                                    dir="rtl"
                                >
                                    <SelectTrigger className="w-full sm:w-56 text-right">
                                        <SelectValue
                                            placeholder="בחר שירות"
                                            className="text-right"
                                        />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all" className="text-right">כל השירותים</SelectItem>
                                        <SelectItem value="grooming" className="text-right">תספורת</SelectItem>
                                        <SelectItem value="garden" className="text-right">גן</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {upcomingAppointments.length === 0 ? (
                                <Card className="bg-gray-50 border-gray-200">
                                    <CardContent className="p-12 text-center">
                                        <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">אין תורים קרובים</h3>
                                        <p className="text-gray-600">התורים הקרובים שלך יופיעו כאן.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {upcomingAppointments.map((appointment) => {
                                        const latePickupDetails = appointment.latePickupNotes?.trim() ?? ""
                                        const gardenExtras = appointmentIncludesGarden(appointment)
                                            ? getSelectedGardenOptions(appointment)
                                            : []
                                        // Use BothAppointmentCard for "both" type appointments
                                        if (appointment.service === 'both') {
                                            return (
                                                <BothAppointmentCard
                                                    key={appointment.id}
                                                    appointment={appointment}
                                                    onApprove={handleIndividualApproval}
                                                    onCancel={handleIndividualCancellation}
                                                    onUpdateNotes={handleIndividualNotesUpdate}
                                                    onBulkApprove={async ({ groomingAppointmentId, gardenAppointmentId }) => {
                                                        if (!groomingAppointmentId || !gardenAppointmentId) {
                                                            return
                                                        }
                                                        await handleApproval(appointment)
                                                    }}
                                                    onBulkCancel={async ({ groomingAppointmentId, gardenAppointmentId }) => {
                                                        if (!groomingAppointmentId || !gardenAppointmentId) {
                                                            return
                                                        }
                                                        setAppointmentPendingCancellation(appointment)
                                                    }}
                                                    isApproving={approvingAppointmentId === appointment.groomingAppointmentId || approvingAppointmentId === appointment.gardenAppointmentId}
                                                    isCancelling={cancellingAppointmentId === appointment.groomingAppointmentId || cancellingAppointmentId === appointment.gardenAppointmentId}
                                                    canCancelAppointment={canCancelAppointment}
                                                    canEditAppointmentNotes={canEditAppointmentNotes}
                                                    onManageLatePickup={openLatePickupDialog}
                                                    canManageLatePickup={canManageLatePickup}
                                                    latePickupDialogTargetId={latePickupDialogState?.appointment.id}
                                                    isSavingLatePickup={isSavingLatePickup}
                                                />
                                            )
                                        }

                                        // Regular appointment card for single appointments
                                        return (
                                            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-6">
                                                    <div className="flex items-start justify-between flex-row-reverse">
                                                        {/* Right side - Treatment icon */}
                                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <Sparkles className="h-6 w-6 text-blue-600" />
                                                        </div>
                                                        {/* Center - Content */}
                                                        <div className="flex-1 space-y-2 text-right mr-2 ml-6">
                                                            {/* Name and status badge row */}
                                                            <div className="flex items-center gap-2 justify-end">
                                                                {getStatusBadge(appointment)}

                                                                <h3 className="text-lg font-semibold">{appointment.treatmentName || "לקוח לא ידוע"}</h3>
                                                                {getApprovalBadge(appointment)}
                                                            </div>
                                                            {/* Details row */}
                                                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 justify-end">
                                                                <div className="flex items-center gap-1">
                                                                    <CalendarIcon className="h-4 w-4" />
                                                                    <span>{format(new Date(appointment.date), "dd MMM yyyy", { locale: he })}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="h-4 w-4" />
                                                                    <span>{appointment.time}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-1">
                                                                        {getServiceIcon(appointment.service)}
                                                                        <span>{getServiceName(appointment.service)}</span>
                                                                    </div>
                                                                    {appointmentIncludesGarden(appointment) ? renderLatePickupBadge(appointment.latePickupRequested, 'xs') : null}
                                                                </div>
                                                            </div>
                                                            {appointment.notes?.trim() && (
                                                                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-gray-700 text-right whitespace-pre-wrap">
                                                                    <div className="flex items-center justify-end gap-1  text-blue-700 text-xs font-semibold mb-1">
                                                                        <span>הערות לתור</span>
                                                                        <MessageSquareText className="h-4 w-4" />
                                                                    </div>
                                                                    {appointment.notes}
                                                                </div>
                                                            )}
                                                            {gardenExtras.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 justify-end">
                                                                    {gardenExtras.map((label) => (
                                                                        <Badge key={`${appointment.id}-${label}`} className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                                                            {label}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {appointmentIncludesGarden(appointment) && appointment.latePickupRequested && latePickupDetails && (
                                                                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800 text-right whitespace-pre-wrap">
                                                                    <div className="font-semibold mb-1">פרטי איסוף מאוחר</div>
                                                                    {latePickupDetails}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Left side - Buttons */}
                                                        <div className="flex flex-wrap gap-2 justify-end">
                                                            {/* Add to Calendar button */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50 flex flex-row-reverse items-center gap-1"
                                                                onClick={() => globalThis.open(generateGoogleCalendarLink(appointment), '_blank')}
                                                            >
                                                                <CalendarPlus className="h-4 w-4" />
                                                                הוסף ללוח השנה
                                                            </Button>
                                                            {canManageLatePickup(appointment) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-blue-700 hover:text-blue-800 border-blue-200 hover:bg-blue-50 flex flex-row-reverse items-center gap-1"
                                                                    onClick={() => openLatePickupDialog(appointment)}
                                                                    disabled={isSavingLatePickup && latePickupDialogState?.appointment.id === appointment.id}
                                                                >
                                                                    <Clock className="h-4 w-4 text-blue-600" />
                                                                    עדכן איסוף מאוחר
                                                                </Button>
                                                            )}
                                                            {canEditAppointmentNotes(appointment) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 flex flex-row-reverse items-center gap-1"
                                                                    onClick={() => openNotesDialog(appointment)}
                                                                    disabled={isSavingNotes && notesDialogAppointment?.id === appointment.id}
                                                                >
                                                                    <Edit3 className="h-4 w-4" />
                                                                    ערוך הערות
                                                                </Button>
                                                            )}
                                                            {/* Approval button */}
                                                            {needsApproval(appointment) ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50"
                                                                    onClick={() => handleApproval(appointment)}
                                                                    disabled={approvingAppointmentId === appointment.id}
                                                                >
                                                                    {approvingAppointmentId === appointment.id ? "מאשר הגעה..." : "אשר הגעה"}
                                                                </Button>
                                                            ) : isApprovedStatus(appointment.status) ? (
                                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                                    ההגעה אושרה
                                                                </Badge>
                                                            ) : null}

                                                            {/* Cancel button */}
                                                            {canCancelAppointment(appointment) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                                                                    onClick={() => handleCancelAppointment(appointment)}
                                                                >
                                                                    בטל
                                                                </Button>
                                                            )}
                                                            {!canCancelAppointment(appointment) && appointment.status !== 'cancelled' && (
                                                                <span className="text-sm text-gray-500 text-right">
                                                                    לא ניתן לבטל (פחות מ-24 שעות)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="waitingList" className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" dir="rtl">
                                <div className="space-y-1 text-right">
                                    <h3 className="text-lg font-semibold text-gray-800">בקשות רשימת המתנה</h3>
                                    <p className="text-sm text-gray-500">נהל כאן את הבקשות להודעה על תורים פנויים עבור הלקוחות שלך.</p>
                                </div>
                                <Button
                                    onClick={() => {
                                        handleTabChange('waitingList')
                                        openWaitingListDialog(undefined, { serviceType: 'grooming' })
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 self-start sm:self-auto"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    בקשה חדשה
                                </Button>
                            </div>

                            {isFetchingWaitingList ? (
                                <Card className="bg-gray-50 border-gray-200">
                                    <CardContent className="p-8 flex items-center justify-center gap-3 text-gray-600">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>טוען את רשימת ההמתנה...</span>
                                    </CardContent>
                                </Card>
                            ) : waitingListEntryGroups.length === 0 ? (
                                <Card className="bg-gray-50 border-gray-200">
                                    <CardContent className="p-12 text-center space-y-3">
                                        <CalendarIcon className="h-16 w-16 text-gray-300 mx-auto" />
                                        <h3 className="text-lg font-semibold text-gray-800">אין בקשות רשומות</h3>
                                        <p className="text-sm text-gray-500">ניתן להוסיף בקשת המתנה חדשה כדי לקבל התראה על תור פנוי.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                waitingListEntryGroups.map(({ id, label, treatment, entries }) => (
                                    <Card key={id} className="border border-emerald-200 shadow-sm" dir="rtl">
                                        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center ml-2">
                                                    <Sparkles className="h-6 w-6 text-emerald-700" />
                                                </div>
                                                <div className="text-right">
                                                    <CardTitle className="text-right">{label}</CardTitle>
                                                    <CardDescription className="text-right text-gray-500">סה"כ בקשות: {entries.length}</CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 text-right">
                                            {entries.map((entry) => (
                                                <div
                                                    key={entry.id}
                                                    className="border border-emerald-100 rounded-lg p-4 bg-white shadow-sm space-y-3 text-right"
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-3 flex-row-reverse">
                                                        <div className="flex items-center gap-2 flex-wrap justify-end flex-row-reverse">
                                                            {getWaitingListStatusBadge(entry.status)}
                                                            {getServiceTypeBadge(entry.serviceType)}
                                                        </div>
                                                        <span className="text-xs text-gray-400 text-right">
                                                            נוצר ב־{formatDateDisplay(entry.createdAt) ?? entry.createdAt}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2 text-sm text-gray-700">
                                                        <div className="flex items-start gap-2 justify-end flex-row-reverse">
                                                            <CalendarIcon className="h-4 w-4 text-emerald-600 mt-0.5" />
                                                            <span>{formatWaitingListDateRanges(entry.dateRanges)}</span>
                                                        </div>
                                                        {entry.notes && (
                                                            <div className="text-gray-500 text-sm">
                                                                {entry.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-row-reverse items-center gap-2 justify-start sm:justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 flex flex-row-reverse items-center gap-1"
                                                            onClick={() => openWaitingListDialog(entry)}
                                                        >
                                                            <Edit3 className="h-4 w-4" />
                                                            ערוך
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex flex-row-reverse items-center gap-1"
                                                            onClick={() => handleDeleteWaitingListEntry(entry)}
                                                            disabled={deletingWaitingListEntryId === entry.id}
                                                        >
                                                            {deletingWaitingListEntryId === entry.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                            הסר
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="past" className="space-y-4">
                            <div className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-2" dir="rtl">
                                <span className="text-sm font-medium text-gray-700 text-right">סינון לפי שירות</span>
                                <Select
                                    value={serviceFilter}
                                    onValueChange={(value) => setServiceFilter(value as 'all' | 'grooming' | 'garden')}
                                    dir="rtl"
                                >
                                    <SelectTrigger className="w-full sm:w-56 text-right">
                                        <SelectValue placeholder="בחר שירות" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all" className="text-right">כל השירותים</SelectItem>
                                        <SelectItem value="grooming" className="text-right">תספורת</SelectItem>
                                        <SelectItem value="garden" className="text-right">גן</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {pastAppointments.length === 0 ? (
                                <Card className="bg-gray-50 border-gray-200">
                                    <CardContent className="p-12 text-center">
                                        <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-xl font-semibold text-gray-800 mb-2">אין תורים בעבר</h3>
                                        <p className="text-gray-600">היסטוריית התורים שלך תופיע כאן.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {pastAppointments.map((appointment) => {
                                        const latePickupDetails = appointment.latePickupNotes?.trim() ?? ""
                                        const gardenExtras = appointmentIncludesGarden(appointment)
                                            ? getSelectedGardenOptions(appointment)
                                            : []
                                        // Use BothAppointmentCard for "both" type appointments
                                        if (appointment.service === 'both') {
                                            return (
                                                <BothAppointmentCard
                                                    key={appointment.id}
                                                    appointment={appointment}
                                                    onApprove={handleIndividualApproval}
                                                    onCancel={handleIndividualCancellation}
                                                    onUpdateNotes={handleIndividualNotesUpdate}
                                                    onBulkApprove={async ({ groomingAppointmentId, gardenAppointmentId }) => {
                                                        if (!groomingAppointmentId || !gardenAppointmentId) {
                                                            return
                                                        }
                                                        await handleApproval(appointment)
                                                    }}
                                                    onBulkCancel={async ({ groomingAppointmentId, gardenAppointmentId }) => {
                                                        if (!groomingAppointmentId || !gardenAppointmentId) {
                                                            return
                                                        }
                                                        setAppointmentPendingCancellation(appointment)
                                                    }}
                                                    isApproving={approvingAppointmentId === appointment.groomingAppointmentId || approvingAppointmentId === appointment.gardenAppointmentId}
                                                    isCancelling={cancellingAppointmentId === appointment.groomingAppointmentId || cancellingAppointmentId === appointment.gardenAppointmentId}
                                                    canCancelAppointment={canCancelAppointment}
                                                    canEditAppointmentNotes={canEditAppointmentNotes}
                                                    onManageLatePickup={openLatePickupDialog}
                                                    canManageLatePickup={canManageLatePickup}
                                                    latePickupDialogTargetId={latePickupDialogState?.appointment.id}
                                                    isSavingLatePickup={isSavingLatePickup}
                                                />
                                            )
                                        }

                                        // Regular appointment card for single appointments
                                        return (
                                            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-6">
                                                    <div className="flex items-start justify-between flex-row-reverse">
                                                        {/* Right side - Treatment icon */}
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <Sparkles className="h-6 w-6 text-gray-600" />
                                                        </div>
                                                        {/* Center - Content */}
                                                        <div className="flex-1 space-y-2 text-right mr-2 ml-6">
                                                            {/* Name and status badge row */}
                                                            <div className="flex items-center gap-2 justify-end">
                                                                {getStatusBadge(appointment)}
                                                                {appointmentIncludesGarden(appointment) ? renderLatePickupBadge(appointment.latePickupRequested) : null}
                                                                <h3 className="text-lg font-semibold">{appointment.treatmentName || "לקוח לא ידוע"}</h3>
                                                                {getApprovalBadge(appointment)}
                                                            </div>
                                                            {/* Details row */}
                                                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 justify-end">
                                                                <div className="flex items-center gap-1">
                                                                    <CalendarIcon className="h-4 w-4" />
                                                                    <span>{format(new Date(appointment.date), "dd MMM yyyy", { locale: he })}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="h-4 w-4" />
                                                                    <span>{appointment.time}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-1">
                                                                        {getServiceIcon(appointment.service)}
                                                                        <span>{getServiceName(appointment.service)}</span>
                                                                    </div>
                                                                    {appointmentIncludesGarden(appointment) ? renderLatePickupBadge(appointment.latePickupRequested, 'xs') : null}
                                                                </div>
                                                            </div>
                                                            {appointment.notes?.trim() && (
                                                                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-gray-700 text-right whitespace-pre-wrap">
                                                                    <div className="flex items-center justify-end gap-1 flex-row-reverse text-blue-700 text-xs font-semibold mb-1">
                                                                        <MessageSquareText className="h-4 w-4" />
                                                                        <span>הערות לתור</span>
                                                                    </div>
                                                                    {appointment.notes}
                                                                </div>
                                                            )}
                                                            {gardenExtras.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 justify-end">
                                                                    {gardenExtras.map((label) => (
                                                                        <Badge key={`${appointment.id}-${label}`} className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                                                                            {label}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {appointmentIncludesGarden(appointment) && appointment.latePickupRequested && latePickupDetails && (
                                                                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800 text-right whitespace-pre-wrap">
                                                                    <div className="font-semibold mb-1">פרטי איסוף מאוחר</div>
                                                                    {latePickupDetails}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Left side - Buttons */}
                                                        <div className="flex flex-col gap-2 items-end">
                                                            {/* Add to Calendar button */}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50 flex flex-row-reverse items-center gap-1"
                                                                onClick={() => globalThis.open(generateGoogleCalendarLink(appointment), '_blank')}
                                                            >
                                                                <CalendarPlus className="h-4 w-4" />
                                                                הוסף ללוח השנה
                                                            </Button>
                                                            {canEditAppointmentNotes(appointment) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 flex flex-row-reverse items-center gap-1"
                                                                    onClick={() => openNotesDialog(appointment)}
                                                                    disabled={isSavingNotes && notesDialogAppointment?.id === appointment.id}
                                                                >
                                                                    <Edit3 className="h-4 w-4" />
                                                                    ערוך הערות
                                                                </Button>
                                                            )}
                                                            {/* Show approval badge for past appointments if they were approved */}
                                                            {(appointment.status === 'approved' || appointment.status === 'מאושר') && (
                                                                <div className="text-center">
                                                                    {getApprovalBadge(appointment)}
                                                                </div>
                                                            )}

                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const params = new URLSearchParams()
                                                                    params.set('treatmentId', appointment.treatmentId)
                                                                    if (appointment.service) {
                                                                        params.set('serviceType', appointment.service.toLowerCase())
                                                                    }
                                                                    navigate(`/setup-appointment?${params.toString()}`)
                                                                }}
                                                            >
                                                                קבע שוב
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </>
    )
}
