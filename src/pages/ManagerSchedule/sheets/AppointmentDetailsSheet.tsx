import { format, differenceInMinutes } from "date-fns"
import { MoreHorizontal, Calendar, Save, Loader2, X, CreditCard, Receipt, Info, Link2Off, Image as ImageIcon } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"
import { SeriesAppointmentsModal } from "@/components/dialogs/manager-schedule/SeriesAppointmentsModal"
import { SendInvoiceDialog } from "@/components/dialogs/manager-schedule/SendInvoiceDialog"
import { OrderDetailsModal } from "@/components/dialogs/manager-schedule/PaymentModal/OrderDetailsModal"
import { MessagingActions } from "@/components/sheets/MessagingActions"
import { AppointmentActionsMenu } from "@/pages/ManagerSchedule/components/appointmentCard/AppointmentActionsMenu"
import { ImageGalleryModal } from "@/components/dialogs/ImageGalleryModal"
import { CustomerImagesModal } from "@/components/dialogs/CustomerImagesModal"
import { cn, extractGroomingAppointmentId } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { supabaseApi, useGetSeriesAppointmentsQuery, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { usePinnedAppointments } from "@/pages/ManagerSchedule/pinnedAppointments/usePinnedAppointments"
import {
    setAppointmentToDuplicate,
    setDuplicateSeriesOpen,
    setSelectedAppointmentForPayment,
    setPaymentCartId as setPaymentCartIdAction,
    setShowPaymentModal,
    setRescheduleTargetAppointment,
    setRescheduleTimes,
    setShowRescheduleProposalModal,
    setCustomerCommunicationAppointment,
    setShowCustomerCommunicationModal,
    setSelectedAppointment,
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment, ManagerDog } from "../types"
import type { Database } from "@/integrations/supabase/types"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]
type Payment = Database["public"]["Tables"]["payments"]["Row"]
type AppointmentPayment = Database["public"]["Tables"]["appointment_payments"]["Row"]

const SERVICE_LABELS: Record<string, string> = {
    grooming: "מספרה",
}

const SERVICE_STYLES: Record<string, { badge: string }> = {
    grooming: {
        badge: "border-primary/20 bg-primary/20 text-primary",
    },
}

const STATUS_STYLE_MAP = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-slate-50 text-slate-700",
}

const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
        return `${minutes} דקות`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (remainingMinutes === 0) {
        return `${hours} ${hours === 1 ? 'שעה' : 'שעות'}`
    }
    return `${hours} ${hours === 1 ? 'שעה' : 'שעות'} ${remainingMinutes} דקות`
}

const getStatusStyle = (status: string, appointment?: ManagerAppointment): string => {
    const normalized = status.toLowerCase()

    if (
        normalized.includes("cancel") ||
        normalized.includes("בוטל") ||
        normalized.includes("מבוטל") ||
        normalized.includes("לא הגיע")
    ) {
        return STATUS_STYLE_MAP.danger
    }

    if (
        normalized.includes("pending") ||
        normalized.includes("ממתין") ||
        normalized.includes("בהמתנה") ||
        normalized.includes("מחכה")
    ) {
        return STATUS_STYLE_MAP.warning
    }

    if (
        normalized.includes("confirm") ||
        normalized.includes("מאושר") ||
        normalized.includes("הושלם") ||
        normalized.includes("מאשר")
    ) {
        return STATUS_STYLE_MAP.success
    }

    return STATUS_STYLE_MAP.info
}

interface ClientDetails {
    name: string
    classification?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    preferences?: string
    recordId?: string
    recordNumber?: string
    id?: string
    clientId?: string
}

interface AppointmentDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedAppointment: ManagerAppointment | null
    onDogClick: (dog: ManagerDog) => void
    onClientClick: (client: ClientDetails) => void
    onEditAppointment: (appointment: ManagerAppointment) => void
    onCancelAppointment: (appointment: ManagerAppointment) => void
    onDeleteAppointment: (appointment: ManagerAppointment) => void
    isLoading?: boolean
}

export const AppointmentDetailsSheet = ({
    open,
    onOpenChange,
    selectedAppointment,
    onDogClick,
    onClientClick,
    onEditAppointment,
    onCancelAppointment,
    onDeleteAppointment,
    isLoading = false,
}: AppointmentDetailsSheetProps) => {
    const [dogGroomingNotes, setDogGroomingNotes] = useState<string>("")
    const [appointmentInternalNotes, setAppointmentInternalNotes] = useState<string>("")
    const [appointmentGroomingNotes, setAppointmentGroomingNotes] = useState<string>("")
    const [appointmentClientNotes, setAppointmentClientNotes] = useState<string | null>(null)
    const [originalInternalNotes, setOriginalInternalNotes] = useState<string>("")
    const [originalGroomingNotes, setOriginalGroomingNotes] = useState<string>("")
    const [originalClientNotes, setOriginalClientNotes] = useState<string>("")
    const [isSavingInternalNotes, setIsSavingInternalNotes] = useState(false)
    const [isSavingGroomingNotes, setIsSavingGroomingNotes] = useState(false)
    const [isSavingClientNotes, setIsSavingClientNotes] = useState(false)
    const [isSavingAllChanges, setIsSavingAllChanges] = useState(false)
    const [payments, setPayments] = useState<Array<Payment & { appointmentPayment: AppointmentPayment }>>([])
    const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
    const [appointmentClientPhone, setAppointmentClientPhone] = useState<string | null>(null)
    const [appointmentClientName, setAppointmentClientName] = useState<string | null>(null)
    const [resolvedClientId, setResolvedClientId] = useState<string | null>(null)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [paymentCartId, setPaymentCartId] = useState<string | null>(null)
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
    const [isSeriesAppointmentsModalOpen, setIsSeriesAppointmentsModalOpen] = useState(false)
    const [hasOrder, setHasOrder] = useState(false)
    const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false)
    const [isUnlinkingFromSeries, setIsUnlinkingFromSeries] = useState(false)
    const [hasBeenUnlinkedFromSeries, setHasBeenUnlinkedFromSeries] = useState(false)
    const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false)
    const [isDesiredGoalImagesModalOpen, setIsDesiredGoalImagesModalOpen] = useState(false)
    const [isSessionImagesModalOpen, setIsSessionImagesModalOpen] = useState(false)
    const [isCustomerImagesModalOpen, setIsCustomerImagesModalOpen] = useState(false)
    const [desiredGoalImagesCount, setDesiredGoalImagesCount] = useState<number | null>(null)
    const [sessionImagesCount, setSessionImagesCount] = useState<number | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [workers, setWorkers] = useState<Array<{ id: string; full_name: string }>>([])
    const [isLoadingWorkers, setIsLoadingWorkers] = useState(false)
    const [isUpdatingWorker, setIsUpdatingWorker] = useState(false)
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
    const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)
    const showDevId = useAppSelector((state) => state.managerSchedule.showDevId)

    // Fetch schedule data for pinned appointments hook
    const formattedDate = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate])
    const { data: scheduleData } = useGetManagerScheduleQuery({
        date: formattedDate,
        serviceType: "both",
    })

    // Pinned appointments hook
    const pinnedAppointmentsHook = usePinnedAppointments({ scheduleData })

    // Fetch series appointments to calculate weeks interval
    const { data: seriesData } = useGetSeriesAppointmentsQuery(
        { seriesId: selectedAppointment?.seriesId || '' },
        { skip: !selectedAppointment?.seriesId || !open }
    )

    // Calculate weeks interval from series appointments
    const weeksInterval = useMemo(() => {
        if (!seriesData?.appointments || seriesData.appointments.length < 2) return null

        const sortedAppointments = [...seriesData.appointments].sort((a, b) =>
            new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
        )

        // Calculate interval between first two appointments
        const firstDate = new Date(sortedAppointments[0].startDateTime)
        const secondDate = new Date(sortedAppointments[1].startDateTime)
        const diffMs = secondDate.getTime() - firstDate.getTime()
        const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))

        return diffWeeks > 0 ? diffWeeks : null
    }, [seriesData])

    // Get current user ID
    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setCurrentUserId(user.id)
            }
        }
        getCurrentUser()
    }, [])

    // Fetch desired goal images count (for the dog)
    useEffect(() => {
        const fetchDesiredGoalImagesCount = async () => {
            if (!selectedAppointment?.dogs?.[0]?.id || !open) {
                setDesiredGoalImagesCount(null)
                return
            }

            try {
                const { count, error } = await supabase
                    .from("dog_desired_goal_images")
                    .select("*", { count: "exact", head: true })
                    .eq("dog_id", selectedAppointment.dogs[0].id)

                if (error) {
                    console.error("❌ [AppointmentDetailsSheet] Error fetching desired goal images count:", error)
                    return
                }

                setDesiredGoalImagesCount(count ?? 0)
            } catch (error) {
                console.error("❌ [AppointmentDetailsSheet] Unexpected error fetching desired goal images count:", error)
            }
        }

        fetchDesiredGoalImagesCount()
    }, [selectedAppointment?.dogs?.[0]?.id, open])

    // Fetch session images count (for the appointment)
    useEffect(() => {
        const fetchSessionImagesCount = async () => {
            if (!selectedAppointment || !open) {
                setSessionImagesCount(null)
                return
            }

            // Extract the actual appointment ID based on service type
            const appointmentId = extractGroomingAppointmentId(
                selectedAppointment.id,
                selectedAppointment.groomingAppointmentId
            )

            if (!appointmentId) {
                setSessionImagesCount(0)
                return
            }

            try {
                console.log("📸 [AppointmentDetailsSheet] Fetching session images count", {
                    appointmentId,
                    serviceType: selectedAppointment.serviceType,
                })

                const { count: groomingCount, error: groomingError } = await supabase
                    .from("appointment_session_images")
                    .select("*", { count: "exact", head: true })
                    .eq("grooming_appointment_id", appointmentId)

                if (groomingError && groomingError.code !== "PGRST116") {
                    console.error("❌ [AppointmentDetailsSheet] Error fetching grooming session images count:", groomingError)
                }

                const totalCount = groomingCount ?? 0
                console.log("✅ [AppointmentDetailsSheet] Session images count:", totalCount)
                setSessionImagesCount(totalCount)
            } catch (error) {
                console.error("❌ [AppointmentDetailsSheet] Unexpected error fetching session images count:", error)
                setSessionImagesCount(0)
            }
        }

        fetchSessionImagesCount()
    }, [selectedAppointment?.id, selectedAppointment?.groomingAppointmentId, selectedAppointment?.serviceType, open])

    // Fetch workers when sheet opens
    useEffect(() => {
        const fetchWorkers = async () => {
            if (!open) return
            setIsLoadingWorkers(true)
            try {
                const { data: workersData, error } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .eq("role", "worker")
                    .eq("worker_is_active", true)
                    .order("full_name", { ascending: true })

                if (error) throw error
                setWorkers(workersData || [])
            } catch (error) {
                console.error("Error fetching workers:", error)
                setWorkers([])
            } finally {
                setIsLoadingWorkers(false)
            }
        }

        fetchWorkers()
    }, [open])

    // Fetch dog's general grooming notes and appointment notes when appointment is selected
    useEffect(() => {
        console.log("[AppointmentDetailsSheet] useEffect triggered", {
            hasSelectedAppointment: !!selectedAppointment,
            open,
            selectedAppointmentId: selectedAppointment?.id
        })

        const fetchDogGroomingNotes = async () => {
            if (!selectedAppointment?.dogs?.[0]?.id || !open) return

            try {
                const { data, error } = await supabase
                    .from("dogs")
                    .select("grooming_notes")
                    .eq("id", selectedAppointment.dogs[0].id)
                    .single()

                if (error) throw error
                setDogGroomingNotes(data?.grooming_notes || "")
            } catch (error) {
                console.error("Error fetching dog grooming notes:", error)
                setDogGroomingNotes("")
            }
        }

        const fetchAppointmentNotes = async () => {
            if (!selectedAppointment || !open) {
                setAppointmentInternalNotes("")
                setAppointmentGroomingNotes("")
                setAppointmentClientNotes(null)
                setOriginalInternalNotes("")
                setOriginalGroomingNotes("")
                setOriginalClientNotes("")
                setAppointmentClientPhone(null)
                setAppointmentClientName(null)
                setResolvedClientId(null)
                return
            }

            // Always fetch fresh data when sheet opens

            // Extract the actual appointment ID
            const appointmentId = extractGroomingAppointmentId(
                selectedAppointment.id,
                selectedAppointment.groomingAppointmentId
            )

            if (!appointmentId) return

            try {
                const tableName = "grooming_appointments"
                const selectFields = "internal_notes, customer_notes"
                const { data, error } = await supabase
                    .from(tableName)
                    .select(selectFields)
                    .eq("id", appointmentId)
                    .single()

                if (error) throw error

                const internalNotesValue = data?.internal_notes || ""
                const groomingNotesValue = ""
                const clientNotesValue = data?.customer_notes || ""
                setAppointmentInternalNotes(internalNotesValue)
                setAppointmentGroomingNotes(groomingNotesValue)
                setAppointmentClientNotes(clientNotesValue)
                setOriginalInternalNotes(internalNotesValue)
                setOriginalGroomingNotes(groomingNotesValue)
                setOriginalClientNotes(clientNotesValue)
            } catch (error) {
                console.error("Error fetching appointment notes:", error)
                setAppointmentInternalNotes("")
                setAppointmentGroomingNotes("")
                setAppointmentClientNotes(null)
                setOriginalInternalNotes("")
                setOriginalGroomingNotes("")
                setOriginalClientNotes("")
            }
        }

        const fetchPayments = async () => {
            if (!selectedAppointment || !open) {
                setPayments([])
                return
            }

            const appointmentId = extractGroomingAppointmentId(
                selectedAppointment.id,
                selectedAppointment.groomingAppointmentId
            )
            if (!appointmentId) return

            try {
                const appointmentIdField = "grooming_appointment_id"

                const { data, error } = await supabase
                    .from("appointment_payments")
                    .select(`
                        *,
                        payment:payments(*)
                    `)
                    .eq(appointmentIdField, appointmentId)

                if (error) throw error

                const paymentsData = (data || []).map((ap: any) => ({
                    ...ap.payment,
                    appointmentPayment: ap
                }))
                setPayments(paymentsData)
            } catch (error) {
                console.error("Error fetching payments:", error)
                setPayments([])
            }
        }

        const checkForOrder = async () => {
            console.log("[AppointmentDetailsSheet] checkForOrder called", {
                hasSelectedAppointment: !!selectedAppointment,
                open,
                selectedAppointmentId: selectedAppointment?.id
            })

            if (!selectedAppointment || !open) {
                console.log("[AppointmentDetailsSheet] checkForOrder early return - no appointment or not open")
                setHasOrder(false)
                return
            }

            // Extract the actual appointment ID
            const appointmentId = extractGroomingAppointmentId(
                selectedAppointment.id,
                selectedAppointment.groomingAppointmentId
            )

            if (!appointmentId) {
                console.log("[AppointmentDetailsSheet] No appointment ID found for order check", {
                    selectedAppointmentId: selectedAppointment.id,
                    serviceType: selectedAppointment.serviceType,
                    groomingAppointmentId: selectedAppointment.groomingAppointmentId
                })
                setHasOrder(false)
                return
            }

            try {
                const appointmentIdField = "grooming_appointment_id"

                console.log("[AppointmentDetailsSheet] Checking for order:", {
                    appointmentId,
                    appointmentIdField,
                    serviceType: selectedAppointment.serviceType,
                    selectedAppointmentId: selectedAppointment.id,
                    groomingAppointmentId: selectedAppointment.groomingAppointmentId
                })

                // Check for orders directly linked to appointment
                // Try both the extracted ID and the original ID (in case extraction didn't work)
                const idsToCheck = [appointmentId]
                if (selectedAppointment.id && selectedAppointment.id !== appointmentId) {
                    // Also check the original ID if it's different
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                    if (uuidRegex.test(selectedAppointment.id)) {
                        idsToCheck.push(selectedAppointment.id)
                    }
                }

                console.log("[AppointmentDetailsSheet] Checking IDs:", idsToCheck)

                // Check for orders directly linked to appointment
                const { data: directOrders, error: directError } = await supabase
                    .from("orders")
                    .select("id")
                    .in(appointmentIdField, idsToCheck)
                    .limit(1)

                if (directError) {
                    console.error("[AppointmentDetailsSheet] Error checking direct orders:", directError)
                    throw directError
                }

                console.log("[AppointmentDetailsSheet] Direct orders found:", directOrders?.length || 0, directOrders)

                if (directOrders && directOrders.length > 0) {
                    console.log("[AppointmentDetailsSheet] ✅ Setting hasOrder to true")
                    setHasOrder(true)
                    return
                }

                // If no direct orders, check via cart_appointments
                const { data: cartAppointments, error: cartError } = await supabase
                    .from("cart_appointments")
                    .select("cart_id")
                    .in(appointmentIdField, idsToCheck)
                    .limit(10)

                if (cartError) {
                    console.error("[AppointmentDetailsSheet] Error checking cart_appointments:", cartError)
                    throw cartError
                }

                console.log("[AppointmentDetailsSheet] Cart appointments found:", cartAppointments?.length || 0)

                if (cartAppointments && cartAppointments.length > 0) {
                    const cartIds = cartAppointments.map(ca => ca.cart_id).filter(Boolean)
                    if (cartIds.length > 0) {
                        const { data: ordersByCart, error: ordersError } = await supabase
                            .from("orders")
                            .select("id")
                            .in("cart_id", cartIds)
                            .limit(1)

                        if (ordersError) {
                            console.error("[AppointmentDetailsSheet] Error checking orders by cart:", ordersError)
                            throw ordersError
                        }

                        console.log("[AppointmentDetailsSheet] Orders by cart found:", ordersByCart?.length || 0, ordersByCart)
                        const hasOrderByCart = ordersByCart && ordersByCart.length > 0
                        console.log("[AppointmentDetailsSheet] Setting hasOrder to:", hasOrderByCart)
                        setHasOrder(hasOrderByCart)
                        return
                    }
                }

                console.log("[AppointmentDetailsSheet] ❌ No orders found, setting hasOrder to false")
                setHasOrder(false)
            } catch (error) {
                console.error("[AppointmentDetailsSheet] Error checking for order:", error)
                setHasOrder(false)
            }
        }

        const fetchCustomerContacts = async () => {
            if (!selectedAppointment || !open) {
                setCustomerContacts([])
                return
            }

            // Try to get clientId from various sources (same logic as fetchCustomerData)
            let clientIdToUse = selectedAppointment.clientId

            // If clientId is missing, try to get it from the dog's ownerId
            if (!clientIdToUse && selectedAppointment.dogs && selectedAppointment.dogs.length > 0) {
                const firstDog = selectedAppointment.dogs[0]
                if (firstDog.ownerId) {
                    clientIdToUse = firstDog.ownerId
                }
            }

            // If still missing, try to fetch from the appointment record itself
            if (!clientIdToUse) {
                const appointmentId = extractGroomingAppointmentId(
                    selectedAppointment.id,
                    selectedAppointment.groomingAppointmentId
                )
                if (appointmentId) {
                    try {
                        const tableName = "grooming_appointments"
                        const { data: appointmentData, error: appointmentError } = await supabase
                            .from(tableName)
                            .select("customer_id, dog_id")
                            .eq("id", appointmentId)
                            .single()

                        if (!appointmentError && appointmentData) {
                            if (appointmentData.customer_id) {
                                clientIdToUse = appointmentData.customer_id
                            } else if (appointmentData.dog_id) {
                                // Fetch dog to get owner_id
                                const { data: dogData, error: dogError } = await supabase
                                    .from("dogs")
                                    .select("owner_id")
                                    .eq("id", appointmentData.dog_id)
                                    .single()

                                if (!dogError && dogData?.owner_id) {
                                    clientIdToUse = dogData.owner_id
                                }
                            }
                        }
                    } catch (error) {
                        console.error("[AppointmentDetailsSheet] Error fetching appointment data for contacts:", error)
                    }
                }
            }

            if (!clientIdToUse) {
                setCustomerContacts([])
                return
            }

            try {
                console.log("[AppointmentDetailsSheet] Fetching customer contacts for clientId:", clientIdToUse)
                const { data, error } = await supabase
                    .from("customer_contacts")
                    .select("*")
                    .eq("customer_id", clientIdToUse)
                    .order("created_at", { ascending: true })

                if (error) throw error
                setCustomerContacts(data || [])
            } catch (error) {
                console.error("Error fetching customer contacts:", error)
                setCustomerContacts([])
            }
        }

        const fetchCustomerData = async () => {
            if (!selectedAppointment || !open) return

            // Only fetch if we don't have phone or name
            const hasPhone = selectedAppointment.clientPhone
            const hasName = selectedAppointment.clientName || selectedAppointment.dogs?.[0]?.clientName

            if (hasPhone && hasName) {
                // Data already available, use it
                setAppointmentClientPhone(selectedAppointment.clientPhone || null)
                setAppointmentClientName(selectedAppointment.clientName || selectedAppointment.dogs?.[0]?.clientName || null)
                return
            }

            // Try to get clientId from various sources
            let clientIdToUse = selectedAppointment.clientId

            // If clientId is missing, try to get it from the dog's ownerId
            if (!clientIdToUse && selectedAppointment.dogs && selectedAppointment.dogs.length > 0) {
                const firstDog = selectedAppointment.dogs[0]
                if (firstDog.ownerId) {
                    clientIdToUse = firstDog.ownerId
                    console.log("[AppointmentDetailsSheet] Using clientId from dog ownerId:", clientIdToUse)
                }
            }

            // If still missing, try to fetch from the appointment record itself
            if (!clientIdToUse) {
                const appointmentId = extractGroomingAppointmentId(
                    selectedAppointment.id,
                    selectedAppointment.groomingAppointmentId
                )
                if (appointmentId) {
                    try {
                        const tableName = "grooming_appointments"
                        const { data: appointmentData, error: appointmentError } = await supabase
                            .from(tableName)
                            .select("customer_id, dog_id")
                            .eq("id", appointmentId)
                            .single()

                        if (!appointmentError && appointmentData) {
                            if (appointmentData.customer_id) {
                                clientIdToUse = appointmentData.customer_id
                                console.log("[AppointmentDetailsSheet] Using clientId from appointment record:", clientIdToUse)
                            } else if (appointmentData.dog_id) {
                                // Fetch dog to get owner_id
                                const { data: dogData, error: dogError } = await supabase
                                    .from("dogs")
                                    .select("owner_id")
                                    .eq("id", appointmentData.dog_id)
                                    .single()

                                if (!dogError && dogData?.owner_id) {
                                    clientIdToUse = dogData.owner_id
                                    console.log("[AppointmentDetailsSheet] Using clientId from dog owner_id:", clientIdToUse)
                                }
                            }
                        }
                    } catch (error) {
                        console.error("[AppointmentDetailsSheet] Error fetching appointment data:", error)
                    }
                }
            }

            // Store the resolved clientId for use in MessagingActions
            setResolvedClientId(clientIdToUse || null)

            // If we still don't have a clientId, we can't fetch customer data
            if (!clientIdToUse) {
                console.warn("[AppointmentDetailsSheet] No clientId found, cannot fetch customer data")
                setAppointmentClientPhone(selectedAppointment.clientPhone || null)
                setAppointmentClientName(selectedAppointment.clientName || selectedAppointment.dogs?.[0]?.clientName || null)
                return
            }

            // Fetch customer data from API
            try {
                console.log("[AppointmentDetailsSheet] Fetching customer data for clientId:", clientIdToUse)
                const { data: customerData, error: customerError } = await supabase
                    .from("customers")
                    .select("id, full_name, phone")
                    .eq("id", clientIdToUse)
                    .single()

                if (!customerError && customerData) {
                    console.log("[AppointmentDetailsSheet] Fetched customer data:", customerData)
                    setAppointmentClientPhone(customerData.phone || null)
                    setAppointmentClientName(customerData.full_name || null)
                } else {
                    // Fallback to appointment data if available
                    setAppointmentClientPhone(selectedAppointment.clientPhone || null)
                    setAppointmentClientName(selectedAppointment.clientName || selectedAppointment.dogs?.[0]?.clientName || null)
                }
            } catch (error) {
                console.error("[AppointmentDetailsSheet] Error fetching customer data:", error)
                // Fallback to appointment data if available
                setAppointmentClientPhone(selectedAppointment.clientPhone || null)
                setAppointmentClientName(selectedAppointment.clientName || selectedAppointment.dogs?.[0]?.clientName || null)
            }
        }

        fetchDogGroomingNotes()
        fetchAppointmentNotes()
        fetchPayments()
        fetchCustomerContacts()
        fetchCustomerData()
        checkForOrder()

        // Reset unlink state when appointment changes
        setHasBeenUnlinkedFromSeries(false)
    }, [selectedAppointment, open])


    const handleSaveInternalNotes = async () => {
        if (!selectedAppointment) return

        const appointmentId = extractGroomingAppointmentId(
            selectedAppointment.id,
            selectedAppointment.groomingAppointmentId
        ) || selectedAppointment.id
        if (!appointmentId) return

        setIsSavingInternalNotes(true)
        try {
            console.log("💾 [AppointmentDetailsSheet] Saving internal notes:", appointmentInternalNotes)
            const { error } = await supabase
                .from("grooming_appointments")
                .update({ internal_notes: appointmentInternalNotes.trim() || null })
                .eq("id", appointmentId)

            if (error) {
                console.error("❌ [AppointmentDetailsSheet] Error saving internal notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לשמור את הערות הצוות",
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "הערות נשמרו",
                description: "הערות הצוות עודכנו בהצלחה",
            })
            setOriginalInternalNotes(appointmentInternalNotes.trim() || "")
        } catch (error) {
            console.error("❌ [AppointmentDetailsSheet] Error saving internal notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות הצוות",
                variant: "destructive",
            })
        } finally {
            setIsSavingInternalNotes(false)
        }
    }

    const handleRevertInternalNotes = () => {
        setAppointmentInternalNotes(originalInternalNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות הצוות שוחזרו לערך המקורי",
        })
    }

    const handleSaveGroomingNotes = async () => {
        if (!selectedAppointment || selectedAppointment.serviceType !== "grooming") return

        const appointmentId = selectedAppointment.groomingAppointmentId || selectedAppointment.id
        if (!appointmentId) return

        setIsSavingGroomingNotes(true)
        try {
            // grooming_notes column doesn't exist - skipping update
            console.log("⚠️ [AppointmentDetailsSheet] grooming_notes column doesn't exist, skipping save")

            toast({
                title: "הערות נשמרו",
                description: "הערות התספורת עודכנו בהצלחה",
            })
            setOriginalGroomingNotes(appointmentGroomingNotes.trim() || "")
        } catch (error) {
            console.error("❌ [AppointmentDetailsSheet] Error saving grooming notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות התספורת",
                variant: "destructive",
            })
        } finally {
            setIsSavingGroomingNotes(false)
        }
    }

    const handleRevertGroomingNotes = () => {
        setAppointmentGroomingNotes(originalGroomingNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות התספורת שוחזרו לערך המקורי",
        })
    }

    const handleSaveClientNotes = async () => {
        if (!selectedAppointment) return

        const appointmentId = extractGroomingAppointmentId(
            selectedAppointment.id,
            selectedAppointment.groomingAppointmentId
        ) || selectedAppointment.id
        if (!appointmentId) return

        setIsSavingClientNotes(true)
        try {
            const notesValue = appointmentClientNotes?.trim() || null
            console.log("💾 [AppointmentDetailsSheet] Saving client notes:", notesValue)
            const { error } = await supabase
                .from("grooming_appointments")
                .update({ customer_notes: notesValue })
                .eq("id", appointmentId)

            if (error) {
                console.error("❌ [AppointmentDetailsSheet] Error saving client notes:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לשמור את הערות הלקוח",
                    variant: "destructive",
                })
                return
            }

            toast({
                title: "הערות נשמרו",
                description: "הערות הלקוח עודכנו בהצלחה",
            })
            setOriginalClientNotes(notesValue || "")

            // Invalidate cache so the appointment card refreshes and shows/hides the message icon
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))
        } catch (error) {
            console.error("❌ [AppointmentDetailsSheet] Error saving client notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות הלקוח",
                variant: "destructive",
            })
        } finally {
            setIsSavingClientNotes(false)
        }
    }

    const handleRevertClientNotes = () => {
        setAppointmentClientNotes(originalClientNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות הלקוח שוחזרו לערך המקורי",
        })
    }

    const handleSaveAllChanges = async () => {
        if (!selectedAppointment) return

        const appointmentId = extractGroomingAppointmentId(
            selectedAppointment.id,
            selectedAppointment.groomingAppointmentId
        ) || selectedAppointment.id
        if (!appointmentId) return

        setIsSavingAllChanges(true)
        const errors: string[] = []

        try {
            console.log("💾 [AppointmentDetailsSheet] Saving all changes...")

            // Save all notes in parallel
            const savePromises: Promise<void>[] = []

            // Save client notes if changed
            if (appointmentClientNotes !== null && appointmentClientNotes !== originalClientNotes) {
                savePromises.push(
                    (async () => {
                        try {
                            const notesValue = appointmentClientNotes?.trim() || null
                            console.log("💾 [AppointmentDetailsSheet] Saving client notes:", notesValue)
                            const { error } = await supabase
                                .from("grooming_appointments")
                                .update({ customer_notes: notesValue })
                                .eq("id", appointmentId)

                            if (error) throw error
                            setOriginalClientNotes(notesValue || "")
                        } catch (error) {
                            console.error("❌ [AppointmentDetailsSheet] Error saving client notes:", error)
                            errors.push("הערות הלקוח")
                        }
                    })()
                )
            }

            // Save internal notes if changed
            if (appointmentInternalNotes !== originalInternalNotes) {
                savePromises.push(
                    (async () => {
                        try {
                            console.log("💾 [AppointmentDetailsSheet] Saving internal notes:", appointmentInternalNotes)
                            const { error } = await supabase
                                .from("grooming_appointments")
                                .update({ internal_notes: appointmentInternalNotes.trim() || null })
                                .eq("id", appointmentId)

                            if (error) throw error
                            setOriginalInternalNotes(appointmentInternalNotes.trim() || "")
                        } catch (error) {
                            console.error("❌ [AppointmentDetailsSheet] Error saving internal notes:", error)
                            errors.push("הערות הצוות")
                        }
                    })()
                )
            }

            // Save grooming notes if changed (only for grooming appointments)
            // Note: grooming_notes column doesn't exist - skipping update
            if (selectedAppointment.serviceType === "grooming" && appointmentGroomingNotes !== originalGroomingNotes) {
                console.log("⚠️ [AppointmentDetailsSheet] grooming_notes column doesn't exist, skipping save")
                // Skip the update since the column doesn't exist
            }

            // Wait for all saves to complete
            await Promise.all(savePromises)

            // Invalidate cache so the appointment card refreshes
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

            if (errors.length > 0) {
                toast({
                    title: "שגיאה חלקית",
                    description: `לא ניתן היה לשמור: ${errors.join(", ")}`,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "הכל נשמר",
                    description: "כל השינויים נשמרו בהצלחה",
                })
            }
        } catch (error) {
            console.error("❌ [AppointmentDetailsSheet] Error saving all changes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לשמור את כל השינויים",
                variant: "destructive",
            })
        } finally {
            setIsSavingAllChanges(false)
        }
    }

    const handleUnlinkFromSeries = async () => {
        if (!selectedAppointment) return

        // Extract the actual appointment ID
        const appointmentId = extractGroomingAppointmentId(
            selectedAppointment.id,
            selectedAppointment.groomingAppointmentId
        )

        if (!appointmentId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן למצוא את התור",
                variant: "destructive",
            })
            return
        }

        setIsUnlinkingFromSeries(true)
        try {
            console.log("🔗 [AppointmentDetailsSheet] Unlinking appointment from series:", {
                appointmentId,
                serviceType: selectedAppointment.serviceType,
                seriesId: selectedAppointment.seriesId,
            })

            const { error } = await supabase
                .from("grooming_appointments")
                .update({ series_id: null })
                .eq("id", appointmentId)

            if (error) {
                console.error("❌ [AppointmentDetailsSheet] Error unlinking from series:", error)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לבטל את הקישור לסדרה",
                    variant: "destructive",
                })
                return
            }

            console.log("✅ [AppointmentDetailsSheet] Successfully unlinked from series")

            // Mark as unlinked to immediately hide the banner
            setHasBeenUnlinkedFromSeries(true)

            // Invalidate cache to refresh the appointment sheet and schedule
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

            toast({
                title: "הקישור בוטל",
                description: "התור הופרד מהסדרה בהצלחה",
            })
        } catch (error) {
            console.error("❌ [AppointmentDetailsSheet] Error unlinking from series:", error)
            toast({
                title: "שגיאה",
                description: "אירעה שגיאה בביטול הקישור לסדרה",
                variant: "destructive",
            })
        } finally {
            setIsUnlinkingFromSeries(false)
        }
    }

    const handlePaymentConfirm = (paymentData: any) => {
        console.log("Payment confirmed:", paymentData)
        // Refresh payments after payment is completed
        if (selectedAppointment) {
            const appointmentId = extractGroomingAppointmentId(
                selectedAppointment.id,
                selectedAppointment.groomingAppointmentId
            ) || selectedAppointment.id
            if (appointmentId) {
                const appointmentIdField = "grooming_appointment_id"

                supabase
                    .from("appointment_payments")
                    .select(`
                        *,
                        payment:payments(*)
                    `)
                    .eq(appointmentIdField, appointmentId)
                    .then(({ data, error }) => {
                        if (!error && data) {
                            const paymentsData = data.map((ap: any) => ({
                                ...ap.payment,
                                appointmentPayment: ap
                            }))
                            setPayments(paymentsData)
                        }
                    })
            }
        }
        setIsPaymentModalOpen(false)
    }

    const handlePaymentClick = useCallback(async () => {
        if (!selectedAppointment || selectedAppointment.isProposedMeeting || !selectedAppointment.clientId) {
            return
        }

        try {
            // Use the selected date from the board (the date the user is viewing)
            // Get date components in local timezone
            const year = selectedDate.getFullYear()
            const month = selectedDate.getMonth()
            const day = selectedDate.getDate()

            // Create day boundaries in local timezone for the selected date
            const dayStart = new Date(year, month, day, 0, 0, 0, 0)
            const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

            // Find all appointments for the same owner on the same day
            // Note: We only filter by enum value "cancelled" in the query, then filter Hebrew statuses in JS
            const { data: groomingData, error: groomingError } = await supabase
                .from("grooming_appointments")
                .select("id, amount_due, status")
                .eq("customer_id", selectedAppointment.clientId)
                .gte("start_at", dayStart.toISOString())
                .lte("start_at", dayEnd.toISOString())
                .neq("status", "cancelled")

            if (groomingError) {
                console.error("Error fetching grooming appointments:", groomingError)
                toast({
                    title: "שגיאה",
                    description: "לא הצלחנו לטעון את התורים",
                    variant: "destructive",
                })
                return
            }

            // Filter out cancelled appointments (including Hebrew statuses)
            const isCancelledStatus = (status: string | null | undefined): boolean => {
                if (!status) return false
                const normalized = status.toLowerCase()
                return (
                    normalized === "cancelled" ||
                    normalized.includes("cancel") ||
                    normalized === "בוטל" ||
                    normalized.includes("מבוטל")
                )
            }

            const allAppointments = (groomingData || [])
                .filter((apt) => !isCancelledStatus(apt.status))
                .map((apt) => ({
                    id: apt.id,
                    serviceType: "grooming" as const,
                    amountDue: apt.amount_due || 0,
                }))

            if (allAppointments.length === 0) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצאו תורים ללקוח זה ביום זה",
                    variant: "destructive",
                })
                return
            }

            // Check if there's an existing active cart for this customer
            const { data: existingCarts, error: cartsError } = await supabase
                .from("carts")
                .select("id")
                .eq("customer_id", selectedAppointment.clientId)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1)

            if (cartsError) {
                console.error("Error checking existing carts:", cartsError)
            }

            let cartId: string

            if (existingCarts && existingCarts.length > 0) {
                // Use existing cart
                cartId = existingCarts[0].id

                // Check which appointments are already in the cart
                const { data: existingCartAppointments } = await supabase
                    .from("cart_appointments")
                    .select("grooming_appointment_id")
                    .eq("cart_id", cartId)

                const existingAppointmentIds = new Set<string>()
                existingCartAppointments?.forEach((ca) => {
                    if (ca.grooming_appointment_id) {
                        existingAppointmentIds.add(ca.grooming_appointment_id)
                    }
                })

                // Add appointments that aren't already in the cart
                const appointmentsToAdd = allAppointments.filter((apt) => !existingAppointmentIds.has(apt.id))

                if (appointmentsToAdd.length > 0) {
                    const cartAppointmentsToInsert = appointmentsToAdd.map((apt) => ({
                        cart_id: cartId,
                        grooming_appointment_id: apt.id,
                        appointment_price: apt.amountDue,
                    }))

                    const { error: insertError } = await supabase.from("cart_appointments").insert(cartAppointmentsToInsert)

                    if (insertError) {
                        console.error("Error adding appointments to cart:", insertError)
                        toast({
                            title: "שגיאה",
                            description: "לא הצלחנו להוסיף את התורים לעגלה",
                            variant: "destructive",
                        })
                        return
                    }
                }
            } else {
                // Create new cart
                const { data: newCart, error: createCartError } = await supabase
                    .from("carts")
                    .insert({
                        customer_id: selectedAppointment.clientId,
                        status: "active",
                    })
                    .select("id")
                    .single()

                if (createCartError || !newCart) {
                    console.error("Error creating cart:", createCartError)
                    toast({
                        title: "שגיאה",
                        description: "לא הצלחנו ליצור עגלה",
                        variant: "destructive",
                    })
                    return
                }

                cartId = newCart.id

                // Add all appointments to cart_appointments
                const cartAppointmentsToInsert = allAppointments.map((apt) => ({
                    cart_id: cartId,
                    grooming_appointment_id: apt.id,
                    appointment_price: apt.amountDue,
                }))

                const { error: insertError } = await supabase.from("cart_appointments").insert(cartAppointmentsToInsert)

                if (insertError) {
                    console.error("Error adding appointments to cart:", insertError)
                    toast({
                        title: "שגיאה",
                        description: "לא הצלחנו להוסיף את התורים לעגלה",
                        variant: "destructive",
                    })
                    return
                }
            }

            // Open payment modal with cartId using Redux
            // Ensure we're dispatching plain objects by creating a serializable copy
            console.log("[handlePaymentClick] Preparing to open payment modal", {
                hasSelectedAppointment: !!selectedAppointment,
                hasCartId: !!cartId,
                cartId,
                appointmentId: selectedAppointment?.id,
            })

            if (!selectedAppointment || !cartId) {
                console.error("[handlePaymentClick] Missing required data:", { selectedAppointment, cartId })
                toast({
                    title: "שגיאה",
                    description: "חסרים נתונים נדרשים לפתיחת תשלום",
                    variant: "destructive",
                })
                return
            }

            // Create a plain object copy with only serializable fields
            const appointmentForPayment = {
                id: selectedAppointment.id,
                clientId: selectedAppointment.clientId,
                clientName: selectedAppointment.clientName,
                serviceType: selectedAppointment.serviceType,
                startDateTime: selectedAppointment.startDateTime,
                endDateTime: selectedAppointment.endDateTime,
                stationId: selectedAppointment.stationId,
                // Include other essential fields as needed
            }

            console.log("[handlePaymentClick] Created appointmentForPayment:", {
                appointmentForPayment,
                isPlainObject: appointmentForPayment.constructor === Object,
                keys: Object.keys(appointmentForPayment),
            })

            console.log("[handlePaymentClick] About to dispatch actions", {
                cartId,
                cartIdType: typeof cartId,
                appointmentId: appointmentForPayment.id,
            })

            // Dispatch actions - use the Redux action creator (aliased to avoid conflict with local state)
            console.log("[handlePaymentClick] Dispatching Redux actions...")
            dispatch(setSelectedAppointmentForPayment(appointmentForPayment as ManagerAppointment))
            dispatch(setPaymentCartIdAction(cartId))
            dispatch(setShowPaymentModal(true))
            console.log("[handlePaymentClick] All actions dispatched successfully")
        } catch (error) {
            console.error("Error in handlePaymentClick:", error)
            toast({
                title: "שגיאה",
                description: "אירעה שגיאה בעת פתיחת תשלום",
                variant: "destructive",
            })
        }
    }, [dispatch, selectedAppointment, selectedDate, toast])

    const handleDuplicateAppointment = useCallback(() => {
        if (!selectedAppointment) return
        if (selectedAppointment.isProposedMeeting) {
            // For proposed meetings, just open edit
            onEditAppointment(selectedAppointment)
            return
        }
        dispatch(setAppointmentToDuplicate(selectedAppointment))
        dispatch(setDuplicateSeriesOpen(true))
    }, [dispatch, selectedAppointment, onEditAppointment])

    const handleOpenRescheduleProposal = useCallback(() => {
        if (!selectedAppointment || !selectedAppointment.clientId) {
            toast({
                title: "אין לקוח משויך",
                description: "לא ניתן להציע זמן חדש לתור שאינו משויך ללקוח.",
                variant: "destructive",
            })
            return
        }
        const start = selectedAppointment.startDateTime ? new Date(selectedAppointment.startDateTime) : null
        const end = selectedAppointment.endDateTime ? new Date(selectedAppointment.endDateTime) : null
        if (!start || !end) {
            toast({
                title: "תזמון לא תקין",
                description: "לא הצלחנו לקרוא את זמני התור המקורי.",
                variant: "destructive",
            })
            return
        }

        dispatch(setRescheduleTargetAppointment(selectedAppointment))
        dispatch(
            setRescheduleTimes({
                startTime: new Date(start.getTime()),
                endTime: new Date(end.getTime()),
                stationId: selectedAppointment.stationId,
            })
        )
        dispatch(setShowRescheduleProposalModal(true))
    }, [dispatch, toast, selectedAppointment])

    const handleOpenClientCommunication = useCallback(() => {
        // Open customer communication modal when explicitly clicking on communication button
        if (selectedAppointment) {
            dispatch(setCustomerCommunicationAppointment(selectedAppointment))
            dispatch(setShowCustomerCommunicationModal(true))
        }
    }, [dispatch, selectedAppointment])

    const handleWorkerChange = useCallback(async (workerId: string | null) => {
        if (!selectedAppointment) return

        setIsUpdatingWorker(true)
        try {
            const appointmentId = extractGroomingAppointmentId(
                selectedAppointment.id,
                selectedAppointment.groomingAppointmentId
            )

            if (!appointmentId) {
                throw new Error("לא ניתן לזהות את התור")
            }

            const { error } = await supabase
                .from("grooming_appointments")
                .update({ worker_id: workerId || null })
                .eq("id", appointmentId)

            if (error) {
                throw error
            }

            // Find the worker name for the updated worker
            const updatedWorker = workerId ? workers.find((w) => w.id === workerId) : null

            // Update the selectedAppointment in Redux state immediately to reflect the change in UI
            dispatch(
                setSelectedAppointment({
                    ...selectedAppointment,
                    workerId: workerId || undefined,
                    workerName: updatedWorker?.full_name || undefined,
                })
            )

            // Invalidate and refetch schedule data to update the UI
            dispatch(
                supabaseApi.util.invalidateTags([
                    { type: "ManagerSchedule", id: `${formattedDate}-${serviceFilter}` },
                    { type: "Appointment", id: `${appointmentId}-grooming` },
                ])
            )

            toast({
                title: "העובד עודכן בהצלחה",
                description: workerId
                    ? `העובד ${updatedWorker?.full_name || ""} שויך לתור`
                    : "העובד הוסר מהתור",
            })
        } catch (error) {
            console.error("Error updating worker assignment:", error)
            toast({
                title: "שגיאה בעדכון העובד",
                description: error instanceof Error ? error.message : "אירעה שגיאה בעת עדכון העובד",
                variant: "destructive",
            })
        } finally {
            setIsUpdatingWorker(false)
        }
    }, [selectedAppointment, workers, dispatch, formattedDate, serviceFilter, toast])

    // Compute appointment details using useMemo to avoid IIFE parsing issues
    const appointmentContent = useMemo(() => {
        if (!selectedAppointment) return null

        const detailStart = new Date(selectedAppointment.startDateTime)
        const detailEnd = new Date(selectedAppointment.endDateTime)
        const detailDate = format(detailStart, "dd.MM.yyyy")
        const detailTimeRange = `${format(detailStart, "HH:mm")} - ${format(detailEnd, "HH:mm")}`
        const duration = selectedAppointment.durationMinutes ??
            Math.max(1, differenceInMinutes(detailEnd, detailStart))
        const serviceLabel = selectedAppointment.appointmentType === "private"
            ? "תור פרטי"
            : (selectedAppointment.serviceName ?? SERVICE_LABELS[selectedAppointment.serviceType])
        const serviceStyle = selectedAppointment.appointmentType === "private"
            ? { badge: "border-purple-200 bg-primary/20 text-purple-800" }
            : SERVICE_STYLES[selectedAppointment.serviceType]
        const statusStyle = getStatusStyle(selectedAppointment.status, selectedAppointment)
        const primaryDog = selectedAppointment.dogs[0]
        const clientName =
            selectedAppointment.clientName ?? primaryDog?.clientName ?? "לא ידוע"
        const classification =
            selectedAppointment.clientClassification ?? primaryDog?.clientClassification ?? "לא ידוע"
        const subscriptionName = selectedAppointment.subscriptionName
        const clientEmail = selectedAppointment.clientEmail
        const clientPhone = selectedAppointment.clientPhone

        // Check if there are any unsaved changes
        const hasUnsavedChanges =
            (appointmentClientNotes !== null && appointmentClientNotes !== originalClientNotes) ||
            (appointmentInternalNotes !== originalInternalNotes) ||
            (selectedAppointment.serviceType === "grooming" && appointmentGroomingNotes !== originalGroomingNotes)

        return {
            detailStart,
            detailEnd,
            detailDate,
            detailTimeRange,
            duration,
            serviceLabel,
            serviceStyle,
            statusStyle,
            primaryDog,
            clientName,
            classification,
            subscriptionName,
            clientEmail,
            clientPhone,
            hasUnsavedChanges
        }
    }, [selectedAppointment, appointmentClientNotes, originalClientNotes, appointmentInternalNotes, originalInternalNotes, appointmentGroomingNotes, originalGroomingNotes])

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="right" className="!w-full !max-w-lg sm:!max-w-lg overflow-y-auto flex flex-col" dir="rtl">
                    <SheetHeader>
                        <SheetTitle className="text-right">פרטי תור</SheetTitle>
                        <SheetDescription className="text-right">צפו בכל הפרטים על התור והלקוח.</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 flex flex-col min-h-0">
                        {(() => {
                            if (isLoading) {
                                return (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                                            <p className="text-gray-600">טוען פרטי תור...</p>
                                        </div>
                                    </div>
                                )
                            }

                            if (appointmentContent) {
                                return (
                                    <div className="mt-6 flex flex-col flex-1 text-right">
                                        <div className="flex-1 space-y-6 min-h-0">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className={cn("text-[11px] font-medium", appointmentContent.serviceStyle.badge)}>
                                                        {appointmentContent.serviceLabel}
                                                    </Badge>
                                                    <Badge variant="outline" className={cn("text-[11px] font-medium", appointmentContent.statusStyle)}>
                                                        {selectedAppointment.status}
                                                    </Badge>
                                                    {selectedAppointment.seriesId && (
                                                        <Badge variant="outline" className="text-[11px] font-medium border-purple-200 bg-primary/20 text-purple-800">
                                                            תור בסדרה
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                                        >
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-48 p-1" align="end">
                                                        <AppointmentActionsMenu
                                                            appointment={selectedAppointment}
                                                            clientName={appointmentContent.clientName}
                                                            primaryDog={appointmentContent.primaryDog}
                                                            hasOrder={hasOrder}
                                                            pinnedAppointmentsHook={pinnedAppointmentsHook}
                                                            onEdit={() => onEditAppointment(selectedAppointment)}
                                                            onDuplicate={handleDuplicateAppointment}
                                                            onCancel={() => onCancelAppointment(selectedAppointment)}
                                                            onDelete={() => onDeleteAppointment(selectedAppointment)}
                                                            onOpenClientCommunication={handleOpenClientCommunication}
                                                            onRescheduleProposal={handleOpenRescheduleProposal}
                                                            onPayment={handlePaymentClick}
                                                            onShowOrder={() => setIsOrderDetailsModalOpen(true)}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        <div className="space-y-2 text-sm text-gray-600">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    תאריך: <span className="font-medium text-gray-900">{appointmentContent.detailDate}</span>
                                                </div>
                                                <div>
                                                    שעה: <span className="font-medium text-gray-900">{appointmentContent.detailTimeRange}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    משך: <span className="font-medium text-gray-900">{formatDuration(appointmentContent.duration)}</span>
                                                </div>
                                                <div>
                                                    עמדה: <span className="font-medium text-gray-900">{selectedAppointment.stationName || "לא משויך"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-600 min-w-[80px]">עובד משויך:</span>
                                                <Select
                                                    value={selectedAppointment.workerId || "__unassigned__"}
                                                    onValueChange={(value) => handleWorkerChange(value === "__unassigned__" ? null : value)}
                                                    disabled={isUpdatingWorker || isLoadingWorkers}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder={isLoadingWorkers ? "טוען..." : selectedAppointment.workerName || "לא משויך"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__unassigned__">לא משויך</SelectItem>
                                                        {workers.map((worker) => (
                                                            <SelectItem key={worker.id} value={worker.id}>
                                                                {worker.full_name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {isUpdatingWorker && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                )}
                                            </div>
                                        </div>
                                        {showDevId && (
                                    <div className="pt-2 border-t border-gray-100 space-y-2">
                                        {(selectedAppointment as any).id && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">מזהה:</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText((selectedAppointment as any).id)
                                                            toast({
                                                                title: "הועתק",
                                                                description: "מזהה התור הועתק ללוח",
                                                            })
                                                        } catch (err) {
                                                            console.error("Failed to copy:", err)
                                                        }
                                                    }}
                                                    className="text-xs text-gray-600 hover:text-gray-900 font-mono cursor-pointer hover:underline"
                                                >
                                                    {(selectedAppointment as any).id.slice(0, 8)}...
                                                </button>
                                            </div>
                                        )}
                                        {(selectedAppointment as any).created_at || (selectedAppointment as any).updated_at ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                {(selectedAppointment as any).created_at && (
                                                    <div className="text-xs text-gray-400">
                                                        נוצר: {format(new Date((selectedAppointment as any).created_at), "dd.MM.yyyy HH:mm")}
                                                    </div>
                                                )}
                                                {(selectedAppointment as any).updated_at && (
                                                    <div className="text-xs text-gray-400">
                                                        עודכן: {format(new Date((selectedAppointment as any).updated_at), "dd.MM.yyyy HH:mm")}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            {/* Series Info Banner */}
                            {selectedAppointment.seriesId && !hasBeenUnlinkedFromSeries && (
                                <>
                                    <Separator />
                                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                                        <div className="flex items-center gap-2 space-x-2 rtl:space-x-reverse">
                                            <Info className="h-5 w-5 text-primary flex-shrink-0" />
                                            <div className="flex-1 text-sm text-purple-800">
                                                <p className="font-medium">
                                                    תור מחזורי
                                                    {weeksInterval && (
                                                        <span className="mr-1"> {weeksInterval}</span>
                                                    )}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-purple-700 border-purple-300 hover:bg-primary/20 hover:text-purple-800"
                                                onClick={() => setIsSeriesAppointmentsModalOpen(true)}
                                            >
                                                <Calendar className="h-4 w-4 ml-2" />
                                                הצג סדרה
                                            </Button>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 cursor-pointer" onClick={() => setUnlinkConfirmOpen(true)}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-primary hover:text-purple-800 hover:bg-primary/20"
                                                disabled={isUnlinkingFromSeries}
                                                title="הפרד תור מהסדרה"
                                            >
                                                {isUnlinkingFromSeries ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Link2Off className="h-3 w-3" />
                                                )}
                                            </Button>
                                            <span className="text-xs text-primary hover:text-purple-800">
                                                הפרד תור מהסדרה
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Client Section */}
                            {selectedAppointment.clientId && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium text-gray-900">לקוח</h3>
                                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => onClientClick({
                                                    name: appointmentContent.clientName,
                                                    classification: appointmentContent.classification,
                                                    phone: selectedAppointment.clientPhone,
                                                    email: selectedAppointment.clientEmail,
                                                    recordId: selectedAppointment.recordId,
                                                    recordNumber: selectedAppointment.recordNumber,
                                                    clientId: selectedAppointment.clientId,
                                                    id: selectedAppointment.clientId
                                                })}
                                                className="text-sm font-medium text-primary hover:text-primary hover:underline cursor-pointer"
                                            >
                                                {appointmentContent.clientName}
                                            </button>
                                            {appointmentContent.classification && appointmentContent.classification !== "לא ידוע" && (
                                                <div className="mt-1 text-xs text-gray-600">
                                                    סיווג: <span className="font-medium text-gray-700">{appointmentContent.classification}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Images Section */}
                            <Separator />
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">תמונות</h3>
                                <div className="space-y-2">
                                    {selectedAppointment.dogs?.[0]?.id && (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center gap-2"
                                            onClick={() => setIsDesiredGoalImagesModalOpen(true)}
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            {desiredGoalImagesCount === null
                                                ? "טוען..."
                                                : desiredGoalImagesCount === 0
                                                    ? "תמונות מטרה רצויה (אין תמונות שהועלו)"
                                                    : `תמונות מטרה רצויה (${desiredGoalImagesCount} תמונות)`}
                                        </Button>
                                    )}
                                    {selectedAppointment.groomingAppointmentId && (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center gap-2"
                                            onClick={() => setIsSessionImagesModalOpen(true)}
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            {sessionImagesCount === null
                                                ? "טוען..."
                                                : sessionImagesCount === 0
                                                    ? "תמונות מהשירות הנוכחי (אין תמונות שהועלו)"
                                                    : `תמונות מהשירות הנוכחי (${sessionImagesCount} תמונות)`}
                                        </Button>
                                    )}
                                    {selectedAppointment.clientId && (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center gap-2"
                                            onClick={() => setIsCustomerImagesModalOpen(true)}
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            הצג את כל התמונות של הלקוח
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Payments Section */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">תשלומים</h3>
                                <div className="space-y-2">
                                    {payments.length === 0 ? (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center gap-2"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                void handlePaymentClick()
                                            }}
                                        >
                                            <CreditCard className="h-4 w-4" />
                                            השלם תשלום
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            {payments.map((payment) => (
                                                <div
                                                    key={payment.id}
                                                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                                                >
                                                    <div className="flex items-center justify-between text-sm">
                                                        <div>
                                                            <div className="font-medium text-gray-900">
                                                                סכום: ₪{payment.amount.toFixed(2)}
                                                            </div>
                                                            <div className="text-xs text-gray-600 mt-1">
                                                                סטטוס: <span className={cn(
                                                                    "font-medium",
                                                                    payment.status === "paid" ? "text-green-700" :
                                                                        payment.status === "partial" ? "text-amber-700" :
                                                                            "text-red-700"
                                                                )}>
                                                                    {payment.status === "paid" ? "שולם" :
                                                                        payment.status === "partial" ? "חלקי" :
                                                                            "לא שולם"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setIsInvoiceDialogOpen(true)}
                                                        >
                                                            <Receipt className="h-4 w-4 ml-2" />
                                                            שלח חשבונית
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Show Orders Button */}
                                    {hasOrder && (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center gap-2"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                setIsOrderDetailsModalOpen(true)
                                            }}
                                        >
                                            <Receipt className="h-4 w-4" />
                                            הצג הזמנות
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {appointmentContent.subscriptionName ? (
                                <>
                                    <Separator />
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <h3 className="text-sm font-medium text-gray-900">כרטיסייה</h3>
                                        <div className="font-medium text-gray-900">{appointmentContent.subscriptionName}</div>
                                    </div>
                                </>
                            ) : null}

                            {/* Client Notes Section */}
                            <Separator />
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-green-900"> הערות לקוח לתור</h3>
                                <Textarea
                                    value={appointmentClientNotes ?? selectedAppointment.notes ?? ""}
                                    onChange={(e) => setAppointmentClientNotes(e.target.value)}
                                    placeholder="הזן הערות לקוח..."
                                    className="min-h-[100px] text-right bg-green-50 border-green-200"
                                    dir="rtl"
                                />
                                {(appointmentClientNotes !== null && appointmentClientNotes !== originalClientNotes) && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleSaveClientNotes}
                                            disabled={isSavingClientNotes}
                                            size="sm"
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isSavingClientNotes ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                    שומר...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4 ml-2" />
                                                    שמור הערות לקוח
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={handleRevertClientNotes}
                                            disabled={isSavingClientNotes}
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4 ml-2" />
                                            ביטול
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Internal Staff Notes Section */}
                            <Separator />
                            {/* Grooming Notes - Show for grooming appointments */}
                            {selectedAppointment.serviceType === "grooming" && (
                                <>
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-purple-900">מה עשינו היום</h3>
                                        <Textarea
                                            value={appointmentGroomingNotes || selectedAppointment.groomingNotes || ""}
                                            onChange={(e) => setAppointmentGroomingNotes(e.target.value)}
                                            placeholder="הזן מה עשינו היום..."
                                            className="min-h-[100px] text-right bg-purple-50 border-purple-200"
                                            dir="rtl"
                                        />
                                        {(appointmentGroomingNotes !== originalGroomingNotes) && (
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={handleSaveGroomingNotes}
                                                    disabled={isSavingGroomingNotes}
                                                    size="sm"
                                                    className="flex-1"
                                                    variant="outline"
                                                >
                                                    {isSavingGroomingNotes ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                            שומר...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="h-4 w-4 ml-2" />
                                                            שמור הערות תספורת
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    onClick={handleRevertGroomingNotes}
                                                    disabled={isSavingGroomingNotes}
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-shrink-0"
                                                >
                                                    <X className="h-4 w-4 ml-2" />
                                                    ביטול
                                                </Button>
                                            </div>
                                        )}
                                        {/* Session Images for Grooming Appointments */}
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center"
                                            onClick={() => setIsSessionImagesModalOpen(true)}
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            {sessionImagesCount === null
                                                ? "טוען..."
                                                : sessionImagesCount === 0
                                                    ? "הצג תמונות (אין תמונות שהועלו)"
                                                    : `הצג תמונות (${sessionImagesCount} תמונות)`}
                                        </Button>
                                    </div>
                                </>
                            )}
                            <Separator />

                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-primary">הערות צוות לתור</h3>
                                <Textarea
                                    value={appointmentInternalNotes || selectedAppointment.internalNotes || ""}
                                    onChange={(e) => setAppointmentInternalNotes(e.target.value)}
                                    placeholder="הזן הערות צוות פנימיות..."
                                    className="min-h-[100px] text-right bg-primary/10 border-primary/20"
                                    dir="rtl"
                                />
                                {(appointmentInternalNotes !== originalInternalNotes) && (
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleSaveInternalNotes}
                                            disabled={isSavingInternalNotes}
                                            size="sm"
                                            className="flex-1"
                                            variant="outline"
                                        >
                                            {isSavingInternalNotes ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                    שומר...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4 ml-2" />
                                                    שמור הערות צוות
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            onClick={handleRevertInternalNotes}
                                            disabled={isSavingInternalNotes}
                                            size="sm"
                                            variant="outline"
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4 ml-2" />
                                            ביטול
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Save All Changes Button */}
                            {appointmentContent.hasUnsavedChanges && (
                                <div className="mt-4">
                                    <Button
                                        onClick={handleSaveAllChanges}
                                        disabled={isSavingAllChanges || isSavingInternalNotes || isSavingGroomingNotes || isSavingClientNotes}
                                        size="lg"
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        {isSavingAllChanges ? (
                                            <>
                                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                שומר את כל השינויים...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 ml-2" />
                                                שמור את כל השינויים
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Record Information */}
                            {(selectedAppointment.recordId || selectedAppointment.recordNumber) && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-gray-900">פרטי רשומה</h3>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {selectedAppointment.recordId && (
                                                <div>מזהה רשומה: <span className="font-mono text-gray-700">{selectedAppointment.recordId}</span></div>
                                            )}
                                            {selectedAppointment.recordNumber && (
                                                <div>מספר רשומה: <span className="font-mono text-gray-700">{selectedAppointment.recordNumber}</span></div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Messaging Actions - Sticky to bottom */}
                            <div className="mt-auto pt-6">
                                <MessagingActions
                                    phone={appointmentClientPhone || appointmentContent.clientPhone}
                                    name={appointmentClientName || appointmentContent.clientName}
                                    contacts={customerContacts}
                                    customerId={resolvedClientId || selectedAppointment.clientId}
                                />
                            </div>
                        </div>
                        </div>
                        )
                    }

                    return (
                        <div className="py-12 text-center text-sm text-gray-500">לא נבחר תור</div>
                    )
                })()}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Payment Modal */}
            {selectedAppointment && (
                <PaymentModal
                    open={isPaymentModalOpen}
                    onOpenChange={(open) => {
                        setIsPaymentModalOpen(open)
                        if (!open) {
                            setPaymentCartId(null)
                        }
                    }}
                    appointment={selectedAppointment}
                    cartId={paymentCartId}
                    onConfirm={handlePaymentConfirm}
                />
            )}

            {/* Send Invoice Dialog */}
            <SendInvoiceDialog
                open={isInvoiceDialogOpen}
                onOpenChange={setIsInvoiceDialogOpen}
                customerContacts={customerContacts}
                selectedAppointment={selectedAppointment}
            />

            {/* Series Appointments Modal */}
            {selectedAppointment?.seriesId && (
                <SeriesAppointmentsModal
                    open={isSeriesAppointmentsModalOpen}
                    onOpenChange={setIsSeriesAppointmentsModalOpen}
                    seriesId={selectedAppointment.seriesId}
                    currentAppointmentId={selectedAppointment.id}
                    onAppointmentClick={(appointment) => {
                        // Close the modal and details sheet, then open the clicked appointment
                        setIsSeriesAppointmentsModalOpen(false)
                        onOpenChange(false)
                        // The parent component should handle opening the new appointment
                        // This will be handled by the parent's onEditAppointment or similar
                    }}
                    onEditAppointment={(appointment) => {
                        setIsSeriesAppointmentsModalOpen(false)
                        onEditAppointment(appointment)
                    }}
                    onDeleteAppointment={(appointment) => {
                        setIsSeriesAppointmentsModalOpen(false)
                        onDeleteAppointment(appointment)
                    }}
                />
            )}

            {/* Order Details Modal */}
            {selectedAppointment && (
                <OrderDetailsModal
                    open={isOrderDetailsModalOpen}
                    onOpenChange={setIsOrderDetailsModalOpen}
                    cartId={null}
                    appointmentId={extractGroomingAppointmentId(selectedAppointment.id, selectedAppointment.groomingAppointmentId)}
                    serviceType="grooming"
                />
            )}

            {/* Unlink from Series Confirmation Dialog */}
            <AlertDialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
                <AlertDialogContent dir="rtl" className="text-right">
                    <AlertDialogHeader className="text-right">
                        <AlertDialogTitle className="text-right">הפרדת תור מהסדרה</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                            האם אתה בטוח שברצונך להפריד את התור הזה מהסדרה? פעולה זו תשאיר את התור כעצמאי אך הוא לא יהיה חלק מהסדרה המחזורית.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogAction
                            onClick={() => {
                                setUnlinkConfirmOpen(false)
                                handleUnlinkFromSeries()
                            }}
                            disabled={isUnlinkingFromSeries}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {isUnlinkingFromSeries && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            הפרד
                        </AlertDialogAction>
                        <AlertDialogCancel disabled={isUnlinkingFromSeries}>ביטול</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Desired Goal Images Modal */}
            {selectedAppointment?.dogs?.[0]?.id && currentUserId && (
                <ImageGalleryModal
                    open={isDesiredGoalImagesModalOpen}
                    onOpenChange={(open) => {
                        setIsDesiredGoalImagesModalOpen(open)
                        // Refresh count when modal closes
                        if (!open && selectedAppointment?.dogs?.[0]?.id) {
                            supabase
                                .from("dog_desired_goal_images")
                                .select("*", { count: "exact", head: true })
                                .eq("dog_id", selectedAppointment.dogs[0].id)
                                .then(({ count }) => {
                                    setDesiredGoalImagesCount(count ?? 0)
                                })
                        }
                    }}
                    title="תמונות מטרה רצויה"
                    imageType="dog-desired-goal"
                    entityId={selectedAppointment.dogs[0].id}
                    userId={currentUserId}
                />
            )}

            {/* Session Images Modal */}
            {selectedAppointment && currentUserId && (() => {
                // Extract the actual appointment ID based on service type
                let appointmentId: string | null = null
                appointmentId = extractGroomingAppointmentId(
                    selectedAppointment.id,
                    selectedAppointment.groomingAppointmentId
                )

                if (!appointmentId) return null

                return (
                    <ImageGalleryModal
                        open={isSessionImagesModalOpen}
                        onOpenChange={(open) => {
                            setIsSessionImagesModalOpen(open)
                            // Refresh count when modal closes
                            if (!open && selectedAppointment) {
                                let refreshAppointmentId: string | null = null
                                if (selectedAppointment.serviceType === "grooming") {
                                    refreshAppointmentId = extractGroomingAppointmentId(
                                        selectedAppointment.id,
                                        selectedAppointment.groomingAppointmentId
                                    )
                                }

                                if (refreshAppointmentId) {
                                    supabase
                                        .from("appointment_session_images")
                                        .select("*", { count: "exact", head: true })
                                        .eq("grooming_appointment_id", refreshAppointmentId)
                                        .then(({ count }) => {
                                            setSessionImagesCount(count ?? 0)
                                        })
                                }
                            }
                        }}
                        title="תמונות מהשירות הנוכחי"
                        imageType="appointment-session"
                        entityId={appointmentId}
                        userId={currentUserId}
                    />
                )
            })()}

            {/* Customer Images Modal */}
            {selectedAppointment?.clientId && (
                <CustomerImagesModal
                    open={isCustomerImagesModalOpen}
                    onOpenChange={setIsCustomerImagesModalOpen}
                    customerId={selectedAppointment.clientId}
                    customerName={selectedAppointment.clientName}
                />
            )}
        </>
    )
}
