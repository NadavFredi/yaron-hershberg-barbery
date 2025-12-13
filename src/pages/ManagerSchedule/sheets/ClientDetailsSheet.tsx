import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { MoreHorizontal, Pencil, Phone, Calendar, CreditCard, Save, Loader2, X, Bell, Image as ImageIcon, Plus, CalendarDays } from "lucide-react"
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
import { DollarSign } from "lucide-react"
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
    const { toast } = useToast()

    // Get clientId from either clientId or id field (for compatibility)
    const clientId = selectedClient?.clientId || (selectedClient as any)?.id
    const hasClientId = clientId && clientId.trim() !== ""

    const handleOpenEditCustomer = () => {
        setIsEditCustomerDialogOpen(true)
    }

    // Fetch full customer data if missing fields (like phone) when client is selected
    useEffect(() => {
        const fetchFullCustomerData = async () => {
            if (!hasClientId || !open || !selectedClient) return

            // Only fetch if we're missing important fields like phone
            if (selectedClient.phone) {
                // Already have phone, no need to fetch
                return
            }

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
                    // Update Redux state with full customer data
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

    // Fetch staff notes and contacts when client is selected
    useEffect(() => {
        const fetchStaffNotes = async () => {
            if (!hasClientId) return

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
            if (!hasClientId) return

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
            if (!hasClientId) return

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
            if (!hasClientId) return

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

        if (open && hasClientId) {
            fetchStaffNotes()
            fetchContacts()
            fetchUnpaidPayments()
            fetchAnyPayments()
        }
    }, [open, hasClientId, clientId])

    const handleCustomerUpdated = () => {
        // Refresh staff notes and contacts after customer is updated
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
                <SheetContent side="right" className="w-full max-w-md overflow-y-auto pt-12" dir="rtl">
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

                    {selectedClient ? (
                        <div className="mt-6 space-y-6 text-right">
                            <div className="space-y-3">
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div>
                                        שם: <span className="font-medium text-gray-900">{selectedClient.name}</span>
                                    </div>
                                    <div>
                                        סיווג: <span className="font-medium text-gray-900">{selectedClient.classification || 'לא ידוע'}</span>
                                    </div>
                                    <div>
                                        סוג מותאם: <span className="font-medium text-gray-900">{selectedClient.customerTypeName || 'ללא סוג'}</span>
                                    </div>
                                    {selectedClient.phone && (
                                        <div>
                                            טלפון: <span className="font-medium text-gray-900">{selectedClient.phone}</span>
                                        </div>
                                    )}
                                    {selectedClient.email && (
                                        <div>
                                            דוא"ל: <span className="font-medium text-gray-900">{selectedClient.email}</span>
                                        </div>
                                    )}
                                    {selectedClient.address && (
                                        <div>
                                            כתובת: <span className="font-medium text-gray-900">{selectedClient.address}</span>
                                        </div>
                                    )}
                                    {hasClientId && showDevId && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
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
                                    )}
                                </div>
                            </div>

                            {/* Customer Images and Appointments Buttons */}
                            {hasClientId && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant="outline"
                                                className="w-full justify-center gap-2"
                                                onClick={() => setIsCustomerImagesModalOpen(true)}
                                            >
                                                <ImageIcon className="h-4 w-4" />
                                                תמונות
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-center gap-2"
                                                onClick={() => setIsCustomerAppointmentsModalOpen(true)}
                                            >
                                                <CalendarDays className="h-4 w-4" />
                                                תורים
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Additional Contacts Section */}
                            {hasClientId && (
                                <>
                                    <Separator />
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-gray-900">אנשי קשר נוספים</h3>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsAddContactDialogOpen(true)}
                                                className="text-xs"
                                            >
                                                <Plus className="h-3 w-3 ml-1" />
                                                הוסף איש קשר
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
                                </>
                            )}

                            {selectedClient.preferences && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-gray-900">העדפות</h3>
                                        <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedClient.preferences}</p>
                                    </div>
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


                            <Separator />
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">תשלומים</h3>
                                <Button
                                    variant="outline"
                                    className="w-full justify-center gap-2"
                                    onClick={() => selectedClient && hasClientId && setIsPaymentsModalOpen(true)}
                                    disabled={!hasClientId}
                                >
                                    <CreditCard className="h-4 w-4" />
                                    הצג תשלומים של {selectedClient.name}
                                </Button>
                                {hasClientId && !hasAnyPayments && (
                                    <p className="text-xs text-gray-500 text-right">
                                        אין תשלומים עבור לקוח זה
                                    </p>
                                )}
                            </div>

                            {/* Customer Debts Section */}
                            {hasClientId && (
                                <CustomerDebtsSection customerId={clientId} customerName={selectedClient.name} />
                            )}

                            <Separator />
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">תזכורות</h3>
                                <Button
                                    variant="outline"
                                    className="w-full justify-center gap-2"
                                    onClick={() => selectedClient && hasClientId && setIsRemindersModalOpen(true)}
                                    disabled={!hasClientId}
                                >
                                    <Bell className="h-4 w-4" />
                                    הצג תזכורות של {selectedClient.name}
                                </Button>
                            </div>

                            {/* Messaging Actions */}
                            <MessagingActions
                                phone={selectedClient.phone}
                                name={selectedClient.name}
                                contacts={contacts}
                                customerId={clientId}
                            />
                            {hasUnpaidPayments && (
                                <p className="text-xs text-amber-600 text-right">
                                    ⚠️ ללקוח זה יש תשלומים שלא שולמו
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-sm text-gray-500">לא נבחר לקוח</div>
                    )}
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
