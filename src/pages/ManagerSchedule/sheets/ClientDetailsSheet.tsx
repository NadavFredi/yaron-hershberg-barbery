import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { MoreHorizontal, Pencil, Phone, CreditCard, Save, Loader2, X, Bell, Image as ImageIcon, Plus, CalendarDays, Ban } from "lucide-react"
import { EditCustomerDialog } from "@/components/EditCustomerDialog"
import { CustomerPaymentsModal } from "@/components/dialogs/payments/CustomerPaymentsModal"
import { CustomerRemindersModal } from "@/components/dialogs/reminders/CustomerRemindersModal"
import { CustomerImagesModal } from "@/components/dialogs/CustomerImagesModal"
import { CustomerAppointmentsModal } from "@/components/dialogs/CustomerAppointmentsModal"
import { AddContactDialog } from "@/components/dialogs/customers/AddContactDialog"
import { CustomerDebtsSection } from "@/components/sheets/CustomerDebtsSection"
import { MessagingActions } from "@/components/sheets/MessagingActions"
import { supabase } from "@/integrations/supabase/client"
import type { ManagerAppointment, ManagerDog } from "../types"
import type { Database } from "@/integrations/supabase/types"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { setSelectedDog, setIsDogDetailsOpen, setIsClientDetailsOpen, setSelectedClient, setSelectedAppointmentForPayment, setPaymentCartId, setShowPaymentModal } from "@/store/slices/managerScheduleSlice"
import { useToast } from "@/components/ui/use-toast"
import { useMemo } from "react"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]

interface ClientDetails {
    name: string
    classification?: string
    customerTypeName?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    preferences?: string
    recordId?: string
    recordNumber?: string
    clientId?: string
    staffNotes?: string
}

interface ClientDetailsSheetProps {
    data?: { appointments?: ManagerAppointment[] }
}

export const ClientDetailsSheet = ({
    data,
}: ClientDetailsSheetProps) => {
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const selectedClient = useAppSelector((state) => state.managerSchedule.selectedClient)
    const open = useAppSelector((state) => state.managerSchedule.isClientDetailsOpen)
    const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
    const selectedDate = useMemo(() => new Date(selectedDateStr), [selectedDateStr])
    const showDevId = useAppSelector((state) => state.managerSchedule.showDevId)

    const handleOpenChange = (isOpen: boolean) => {
        dispatch(setIsClientDetailsOpen(isOpen))
        if (!isOpen) {
            dispatch(setSelectedClient(null))
        }
    }
    const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false)
    const [staffNotes, setStaffNotes] = useState("")
    const [originalStaffNotes, setOriginalStaffNotes] = useState("")
    const [isSavingStaffNotes, setIsSavingStaffNotes] = useState(false)
    const [contacts, setContacts] = useState<CustomerContact[]>([])
    const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false)
    const [hasUnpaidPayments, setHasUnpaidPayments] = useState(false)
    const [hasAnyPayments, setHasAnyPayments] = useState(false)
    const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false)
    const [isCustomerImagesModalOpen, setIsCustomerImagesModalOpen] = useState(false)
    const [isCustomerAppointmentsModalOpen, setIsCustomerAppointmentsModalOpen] = useState(false)
    const [isAddContactDialogOpen, setIsAddContactDialogOpen] = useState(false)
    const [additionalCustomerData, setAdditionalCustomerData] = useState<{
        gender?: string | null
        date_of_birth?: string | null
        external_id?: string | null
        city?: string | null
        is_banned?: boolean
    } | null>(null)
    const { toast } = useToast()

    // Get clientId from either clientId or id field (for compatibility)
    const clientId = selectedClient?.clientId || (selectedClient as any)?.id
    const hasClientId = clientId && clientId.trim() !== ""

    const handleOpenEditCustomer = () => {
        setIsEditCustomerDialogOpen(true)
    }

    // Always fetch fresh customer data when sheet opens
    useEffect(() => {
        const fetchFullCustomerData = async () => {
            if (!hasClientId || !open || !selectedClient) return

            try {
                const { data, error } = await supabase
                    .from("customers")
                    .select(`
                        id,
                        full_name,
                        phone,
                        email,
                        address,
                        classification,
                        customer_type_id,
                        customer_type:customer_types (
                            id,
                            name
                        )
                    `)
                    .eq("id", clientId)
                    .single()

                if (error) throw error

                if (data) {
                    // Update Redux state with fresh customer data
                    const updatedClient: ClientDetails = {
                        name: data.full_name || selectedClient.name || "",
                        classification: data.classification || selectedClient.classification,
                        customerTypeName: (data.customer_type as any)?.name || selectedClient.customerTypeName,
                        phone: data.phone || selectedClient.phone,
                        email: data.email || selectedClient.email,
                        address: data.address || selectedClient.address,
                        notes: selectedClient.notes,
                        preferences: selectedClient.preferences,
                        recordId: selectedClient.recordId || data.id,
                        recordNumber: selectedClient.recordNumber,
                        clientId: data.id,
                        staffNotes: selectedClient.staffNotes,
                    }
                    dispatch(setSelectedClient(updatedClient))
                }
            } catch (error) {
                console.error("Error fetching full customer data:", error)
            }
        }

        fetchFullCustomerData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, hasClientId, clientId])

    // Fetch fresh staff notes, contacts, and additional data when sheet opens
    useEffect(() => {
        const fetchStaffNotes = async () => {
            if (!hasClientId || !open) return

            try {
                const { data, error } = await supabase
                    .from("customers")
                    .select("staff_notes")
                    .eq("id", clientId)
                    .single()

                if (error) throw error

                const staffNotesValue = data?.staff_notes || ""
                setStaffNotes(staffNotesValue)
                setOriginalStaffNotes(staffNotesValue)
            } catch (error) {
                console.error("Error fetching staff notes:", error)
            }
        }

        const fetchContacts = async () => {
            if (!hasClientId || !open) return

            try {
                const { data, error } = await supabase
                    .from("customer_contacts")
                    .select("*")
                    .eq("customer_id", clientId)
                    .order("created_at", { ascending: true })

                if (error) throw error

                setContacts(data || [])
            } catch (error) {
                console.error("Error fetching contacts:", error)
                setContacts([])
            }
        }

        const fetchUnpaidPayments = async () => {
            if (!hasClientId || !open) return

            try {
                // Check for unpaid payments directly linked to customer
                const { data: customerPayments } = await supabase
                    .from("payments")
                    .select("id")
                    .eq("customer_id", clientId)
                    .in("status", ["unpaid", "partial"])
                    .limit(1)

                if (customerPayments && customerPayments.length > 0) {
                    setHasUnpaidPayments(true)
                } else {
                    setHasUnpaidPayments(false)
                }
            } catch (error) {
                console.error("Error fetching unpaid payments:", error)
                setHasUnpaidPayments(false)
            }
        }

        const fetchAnyPayments = async () => {
            if (!hasClientId || !open) return

            try {
                // Check for any payments directly linked to customer
                const { data: customerPayments } = await supabase
                    .from("payments")
                    .select("id")
                    .eq("customer_id", clientId)
                    .limit(1)

                if (customerPayments && customerPayments.length > 0) {
                    setHasAnyPayments(true)
                } else {
                    setHasAnyPayments(false)
                }
            } catch (error) {
                console.error("Error fetching payments:", error)
                setHasAnyPayments(false)
            }
        }

        const fetchAdditionalData = async () => {
            if (!hasClientId || !open) return

            try {
                const { data, error } = await supabase
                    .from("customers")
                    .select("gender, date_of_birth, external_id, city, is_banned")
                    .eq("id", clientId)
                    .single()

                if (error) throw error

                setAdditionalCustomerData({
                    gender: data?.gender || null,
                    date_of_birth: data?.date_of_birth || null,
                    external_id: data?.external_id || null,
                    city: data?.city || null,
                    is_banned: data?.is_banned || false,
                })
            } catch (error) {
                console.error("Error fetching additional customer data:", error)
                setAdditionalCustomerData(null)
            }
        }

        if (open && hasClientId) {
            fetchStaffNotes()
            fetchContacts()
            fetchUnpaidPayments()
            fetchAnyPayments()
            fetchAdditionalData()
        }
    }, [open, hasClientId, clientId])

    const handleCustomerUpdated = () => {
        // Refresh staff notes, contacts, and additional data after customer is updated
        if (hasClientId) {
            supabase
                .from("customers")
                .select("staff_notes")
                .eq("id", clientId)
                .single()
                .then(({ data }) => {
                    const staffNotesValue = data?.staff_notes || ""
                    setStaffNotes(staffNotesValue)
                    setOriginalStaffNotes(staffNotesValue)
                })

            // Refresh contacts
            supabase
                .from("customer_contacts")
                .select("*")
                .eq("customer_id", clientId)
                .order("created_at", { ascending: true })
                .then(({ data, error }) => {
                    if (!error && data) {
                        setContacts(data)
                    }
                })

            // Refresh additional data
            supabase
                .from("customers")
                .select("gender, date_of_birth, external_id, city, is_banned")
                .eq("id", clientId)
                .single()
                .then(({ data, error }) => {
                    if (!error && data) {
                        setAdditionalCustomerData({
                            gender: data?.gender || null,
                            date_of_birth: data?.date_of_birth || null,
                            external_id: data?.external_id || null,
                            city: data?.city || null,
                            is_banned: data?.is_banned || false,
                        })
                    }
                })
        }
    }

    const handleSaveStaffNotes = async () => {
        if (!hasClientId) return

        setIsSavingStaffNotes(true)
        try {
            console.log("💾 [ClientDetailsSheet] Saving staff notes:", staffNotes)
            const { error } = await supabase
                .from("customers")
                .update({ staff_notes: staffNotes.trim() || null })
                .eq("id", clientId)

            if (error) {
                console.error("❌ [ClientDetailsSheet] Error saving staff notes:", error)
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
            setOriginalStaffNotes(staffNotes.trim() || "")
        } catch (error) {
            console.error("❌ [ClientDetailsSheet] Error saving staff notes:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את הערות הצוות",
                variant: "destructive",
            })
        } finally {
            setIsSavingStaffNotes(false)
        }
    }

    const handleRevertStaffNotes = () => {
        setStaffNotes(originalStaffNotes)
        toast({
            title: "הערות שוחזרו",
            description: "הערות הצוות שוחזרו לערך המקורי",
        })
    }



    const handlePaymentClick = async () => {
        if (!hasClientId || !clientId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לפתוח תשלום ללא לקוח",
                variant: "destructive",
            })
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
                .eq("customer_id", clientId)
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
                .eq("customer_id", clientId)
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
                        customer_id: clientId,
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

            // Create a minimal appointment object for the payment modal
            // Use the first appointment from the list to get basic info
            const firstAppointmentId = allAppointments[0].id
            const firstServiceType = allAppointments[0].serviceType

            // Create a minimal ManagerAppointment-like object
            // The payment modal mainly needs clientId and serviceType, and will load cart details
            const appointmentForPayment: Partial<ManagerAppointment> = {
                id: firstAppointmentId,
                clientId: clientId,
                clientName: selectedClient?.name,
                serviceType: firstServiceType,
            }

            // Open payment modal with cartId
            dispatch(setSelectedAppointmentForPayment(appointmentForPayment as ManagerAppointment))
            dispatch(setPaymentCartId(cartId))
            dispatch(setShowPaymentModal(true))
        } catch (error) {
            console.error("Error in handlePaymentClick:", error)
            toast({
                title: "שגיאה",
                description: "אירעה שגיאה בעת פתיחת תשלום",
                variant: "destructive",
            })
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetContent side="right" className="!w-full !max-w-lg sm:!max-w-lg overflow-y-auto pt-12 flex flex-col" dir="rtl">
                    <SheetHeader>
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                                <SheetTitle className="text-right">פרטי לקוח</SheetTitle>
                                <SheetDescription className="text-right">צפו בכל הפרטים על הלקוח.</SheetDescription>
                            </div>
                            {hasClientId && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex-shrink-0"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-1" align="end">
                                        <div className="space-y-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={handleOpenEditCustomer}
                                            >
                                                <Pencil className="h-4 w-4 ml-2" />
                                                ערוך פרטי לקוח
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </SheetHeader>

                    <div className="flex-1 flex flex-col min-h-0">
                    {selectedClient ? (
                        <div className="mt-6 flex flex-col flex-1 text-right">
                            <div className="flex-1 space-y-6 min-h-0">
                            {/* Action Buttons Section - Sticky */}
                            <div className="sticky top-[-24px] z-10 bg-white pb-3 pt-2 -mx-6 px-6 border-b border-gray-200">
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                    {/* Payments Button */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-[11px]"
                                        onClick={() => selectedClient && hasClientId && setIsPaymentsModalOpen(true)}
                                        disabled={!hasClientId}
                                        title={`הצג תשלומים של ${selectedClient.name}`}
                                    >
                                        <CreditCard className="h-3.5 w-3.5" />
                                        <span>תשלומים</span>
                                    </Button>
                                    {/* Reminders Button */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-[11px]"
                                        onClick={() => selectedClient && hasClientId && setIsRemindersModalOpen(true)}
                                        disabled={!hasClientId}
                                        title={`הצג תזכורות של ${selectedClient.name}`}
                                    >
                                        <Bell className="h-3.5 w-3.5" />
                                        <span>תזכורות</span>
                                    </Button>
                                    {/* Images Button */}
                                    {hasClientId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-[11px]"
                                            onClick={() => setIsCustomerImagesModalOpen(true)}
                                        >
                                            <ImageIcon className="h-3.5 w-3.5" />
                                            <span>תמונות</span>
                                        </Button>
                                    )}
                                    {/* Appointments Button */}
                                    {hasClientId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-[11px]"
                                            onClick={() => setIsCustomerAppointmentsModalOpen(true)}
                                        >
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            <span>תורים</span>
                                        </Button>
                                    )}
                                    {/* Additional Contacts Button */}
                                    {hasClientId && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-[11px]"
                                                >
                                                    <Phone className="h-3.5 w-3.5" />
                                                    <span>אנשי קשר</span>
                                                    {contacts.length > 0 && (
                                                        <span className="text-[10px] bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5">
                                                            {contacts.length}
                                                        </span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-3" dir="rtl" align="start">
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-sm font-medium">אנשי קשר נוספים</h4>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setIsAddContactDialogOpen(true)}
                                                            className="text-xs h-6"
                                                        >
                                                            <Plus className="h-3 w-3 ml-1" />
                                                            הוסף
                                                        </Button>
                                                    </div>
                                                    {contacts.length === 0 ? (
                                                        <p className="text-sm text-gray-500">אין אנשי קשר נוספים</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {contacts.map((contact) => (
                                                                <div
                                                                    key={contact.id}
                                                                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                                                                >
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <div className="flex items-center gap-2">
                                                                            <Phone className="h-4 w-4 text-gray-400" />
                                                                            <span className="font-medium text-gray-900">{contact.name}</span>
                                                                        </div>
                                                                        <a
                                                                            href={`tel:${contact.phone}`}
                                                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                                                        >
                                                                            {contact.phone}
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>
                            {/* Client Info Section */}
                            <div className="pb-3 pt-2">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
                                    <div
                                        className="group relative cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors"
                                        onClick={handleOpenEditCustomer}
                                    >
                                        <span className="text-sm text-gray-600">שם: </span>
                                        <span className="text-sm font-medium text-gray-900">{selectedClient.name}</span>
                                        <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute left-0 top-0 transition-opacity" />
                                    </div>
                                    <div
                                        className="group relative cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors text-sm text-gray-600"
                                        onClick={handleOpenEditCustomer}
                                    >
                                        סיווג: <span className="font-medium text-gray-900">{selectedClient.classification || 'לא ידוע'}</span>
                                        <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute left-0 top-0 transition-opacity" />
                                    </div>
                                    <div
                                        className="group relative cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors text-sm text-gray-600"
                                        onClick={handleOpenEditCustomer}
                                    >
                                        סוג מותאם: <span className="font-medium text-gray-900">{selectedClient.customerTypeName || 'ללא סוג'}</span>
                                        <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute left-0 top-0 transition-opacity" />
                                    </div>
                                    {selectedClient.phone && (
                                        <div
                                            className="group relative cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors text-sm text-gray-600"
                                            onClick={handleOpenEditCustomer}
                                        >
                                            טלפון: <span className="font-medium text-gray-900">{selectedClient.phone}</span>
                                            <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute left-0 top-0 transition-opacity" />
                                        </div>
                                    )}
                                    {selectedClient.email && (
                                        <div
                                            className="group relative cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors text-sm text-gray-600"
                                            onClick={handleOpenEditCustomer}
                                        >
                                            דוא"ל: <span className="font-medium text-gray-900">{selectedClient.email}</span>
                                            <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute left-0 top-0 transition-opacity" />
                                        </div>
                                    )}
                                    {selectedClient.address && (
                                        <div
                                            className="group relative cursor-pointer hover:bg-gray-50 rounded-md p-1 -m-1 transition-colors text-sm text-gray-600"
                                            onClick={handleOpenEditCustomer}
                                        >
                                            כתובת: <span className="font-medium text-gray-900">{selectedClient.address}</span>
                                            <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 absolute left-0 top-0 transition-opacity" />
                                        </div>
                                    )}
                                    {additionalCustomerData?.is_banned && (
                                        <div className="col-span-2 flex items-center gap-2 pt-2 border-t border-red-200 bg-red-50 rounded-md px-2 py-1.5">
                                            <Ban className="h-4 w-4 text-red-600" />
                                            <span className="text-sm font-medium text-red-700">לקוח חסום</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-2 text-sm text-gray-600">
                                    {showDevId && hasClientId && (
                                        <div className="pt-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">מזהה:</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText(clientId)
                                                            toast({
                                                                title: "הועתק",
                                                                description: "מזהה הלקוח הועתק ללוח",
                                                            })
                                                        } catch (err) {
                                                            console.error("Failed to copy:", err)
                                                        }
                                                    }}
                                                    className="text-xs text-gray-600 hover:text-gray-900 font-mono cursor-pointer hover:underline"
                                                >
                                                    {clientId.slice(0, 8)}...
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>


                            {selectedClient.preferences && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-gray-900">העדפות</h3>
                                        <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedClient.preferences}</p>
                                    </div>
                                </>
                            )}

                            {/* Customer Debts Section */}
                            {hasClientId && (
                                <>
                                    <Separator />
                                    <CustomerDebtsSection customerId={clientId} customerName={selectedClient.name} />
                                </>
                            )}

                            {/* Staff Notes Section */}
                            {hasClientId && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-blue-900">הערות צוות פנימי</h3>
                                        <Textarea
                                            value={staffNotes || ""}
                                            onChange={(e) => setStaffNotes(e.target.value)}
                                            placeholder="הזן הערות צוות פנימיות..."
                                            className="min-h-[100px] text-right bg-blue-50 border-blue-200"
                                            dir="rtl"
                                        />
                                        {(staffNotes !== originalStaffNotes) && (
                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={handleSaveStaffNotes}
                                                    disabled={isSavingStaffNotes}
                                                    size="sm"
                                                    className="flex-1"
                                                    variant="outline"
                                                >
                                                    {isSavingStaffNotes ? (
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
                                                    onClick={handleRevertStaffNotes}
                                                    disabled={isSavingStaffNotes}
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
                                </>
                            )}
                            </div>
                            
                            {/* Messaging Actions - Sticky to bottom */}
                            <div className="mt-auto pt-6">
                                <MessagingActions
                                    phone={selectedClient.phone}
                                    name={selectedClient.name}
                                    contacts={contacts}
                                    customerId={clientId}
                                />
                                {hasUnpaidPayments && (
                                    <p className="text-xs text-amber-600 text-right mt-2">
                                        ⚠️ ללקוח זה יש תשלומים שלא שולמו
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center text-sm text-gray-500">לא נבחר לקוח</div>
                    )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Edit Customer Dialog */}
            <EditCustomerDialog
                open={isEditCustomerDialogOpen}
                onOpenChange={setIsEditCustomerDialogOpen}
                customerId={clientId || null}
                onSuccess={handleCustomerUpdated}
            />

            {/* Customer Payments Modal */}
            {selectedClient && hasClientId && (
                <CustomerPaymentsModal
                    open={isPaymentsModalOpen}
                    onOpenChange={setIsPaymentsModalOpen}
                    customerId={clientId}
                    customerName={selectedClient.name}
                />
            )}

            {/* Customer Reminders Modal */}
            {selectedClient && hasClientId && (
                <CustomerRemindersModal
                    open={isRemindersModalOpen}
                    onOpenChange={setIsRemindersModalOpen}
                    customerId={clientId}
                    customerName={selectedClient.name}
                />
            )}

            {/* Customer Images Modal */}
            {selectedClient && hasClientId && (
                <CustomerImagesModal
                    open={isCustomerImagesModalOpen}
                    onOpenChange={setIsCustomerImagesModalOpen}
                    customerId={clientId}
                    customerName={selectedClient.name}
                />
            )}

            {/* Customer Appointments Modal */}
            {selectedClient && hasClientId && (
                <CustomerAppointmentsModal
                    open={isCustomerAppointmentsModalOpen}
                    onOpenChange={setIsCustomerAppointmentsModalOpen}
                    customerId={clientId}
                    customerName={selectedClient.name}
                />
            )}

            {/* Add Contact Dialog */}
            {hasClientId && (
                <AddContactDialog
                    open={isAddContactDialogOpen}
                    onOpenChange={setIsAddContactDialogOpen}
                    customerId={clientId}
                    onSuccess={() => {
                        // Refresh contacts list
                        if (hasClientId) {
                            supabase
                                .from("customer_contacts")
                                .select("*")
                                .eq("customer_id", clientId)
                                .order("created_at", { ascending: true })
                                .then(({ data, error }) => {
                                    if (!error && data) {
                                        setContacts(data)
                                    }
                                })
                        }
                    }}
                />
            )}
        </>
    )
}
