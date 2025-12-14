import { useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Send, ShoppingCart, FileText, Phone } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import { useLazyGetManagerAppointmentQuery } from "@/store/services/supabaseApi"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Database } from "@/integrations/supabase/types"
import { InvoicePreviewDialog } from "./InvoicePreviewDialog"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]

interface CartItem {
    id: string
    name: string
    quantity: number
    unitPrice: number
    total: number
}

interface CartAppointmentDisplay {
    id: string
    appointmentId: string
    serviceType: "grooming" | "garden"
    appointment?: ManagerAppointment
    price: number
}

interface InvoiceModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: ManagerAppointment | null
    onGoToCart: () => void
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
    open,
    onOpenChange,
    appointment,
    onGoToCart
}) => {
    const { toast } = useToast()
    const [fetchManagerAppointment] = useLazyGetManagerAppointmentQuery()
    const [isLoading, setIsLoading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [cartAppointments, setCartAppointments] = useState<CartAppointmentDisplay[]>([])
    const [customerName, setCustomerName] = useState<string>("")
    const [customerPhone, setCustomerPhone] = useState<string>("")
    const [customerEmail, setCustomerEmail] = useState<string>("")
    const [cartId, setCartId] = useState<string | null>(null)
    const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("")
    const [phoneNumberType, setPhoneNumberType] = useState<"customer" | "contact" | "custom">("customer")
    const [customPhoneNumber, setCustomPhoneNumber] = useState<string>("")
    const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null)
    const [showInvoicePreview, setShowInvoicePreview] = useState(false)
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
    const [orderId, setOrderId] = useState<string | null>(null)

    // Calculate totals
    const itemsTotal = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + item.total, 0)
    }, [cartItems])

    const appointmentsTotal = useMemo(() => {
        return cartAppointments.reduce((sum, apt) => sum + apt.price, 0)
    }, [cartAppointments])

    const grandTotal = useMemo(() => {
        return itemsTotal + appointmentsTotal
    }, [itemsTotal, appointmentsTotal])

    // Fetch cart data
    useEffect(() => {
        if (!open || !appointment?.clientId) {
            return
        }

        const fetchCartData = async () => {
            setIsLoading(true)
            try {
                // Find active cart for this customer
                const { data: cartData, error: cartError } = await supabase
                    .from('carts')
                    .select('id, customer_id, customers(full_name, phone, email)')
                    .eq('customer_id', appointment.clientId)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (cartError) throw cartError

                if (!cartData) {
                    toast({
                        title: "אין עגלה פעילה",
                        description: "לא נמצאה עגלה פעילה ללקוח זה",
                        variant: "destructive",
                    })
                    onOpenChange(false)
                    return
                }

                const foundCartId = cartData.id
                setCartId(foundCartId)

                // Get customer info
                const customer = cartData.customers as any
                const customerPhoneValue = customer?.phone || appointment.clientPhone || ""
                setCustomerName(customer?.full_name || appointment.clientName || "")
                setCustomerPhone(customerPhoneValue)
                setCustomerEmail(customer?.email || appointment.clientEmail || "")
                setSelectedPhoneNumber(customerPhoneValue)

                // Fetch customer contacts
                const { data: contactsData, error: contactsError } = await supabase
                    .from('customer_contacts')
                    .select('*')
                    .eq('customer_id', appointment.clientId)
                    .order('created_at', { ascending: true })

                if (!contactsError && contactsData) {
                    setCustomerContacts(contactsData)
                }

                // Fetch cart items
                const { data: itemsData, error: itemsError } = await supabase
                    .from('cart_items')
                    .select(`
                        id,
                        quantity,
                        unit_price,
                        item_name,
                        product_id,
                        products (
                            id,
                            name
                        )
                    `)
                    .eq('cart_id', foundCartId)
                    .order('created_at')

                if (itemsError) throw itemsError

                const mappedItems: CartItem[] = (itemsData || []).map((item: any) => {
                    const product = item.products
                    const productName = item.item_name || product?.name || 'פריט ללא שם'
                    const quantity = Number(item.quantity) || 1
                    const unitPrice = Number(item.unit_price) || 0

                    return {
                        id: item.id,
                        name: productName,
                        quantity,
                        unitPrice,
                        total: quantity * unitPrice
                    }
                })

                setCartItems(mappedItems)

                // Fetch cart appointments
                const { data: cartApptsData, error: cartApptsError } = await supabase
                    .from('cart_appointments')
                    .select(`
                        id,
                        grooming_appointment_id,
                        daycare_appointment_id,
                        appointment_price
                    `)
                    .eq('cart_id', foundCartId)

                if (cartApptsError) throw cartApptsError

                const appointmentsWithData: CartAppointmentDisplay[] = []
                for (const cartApt of cartApptsData || []) {
                    const appointmentId = cartApt.grooming_appointment_id || cartApt.daycare_appointment_id
                    const serviceType = cartApt.grooming_appointment_id ? "grooming" : "garden"

                    if (appointmentId) {
                        const appointment = await fetchManagerAppointment(
                            { appointmentId, serviceType },
                            true
                        ).unwrap()

                        if (appointment) {
                            appointmentsWithData.push({
                                id: cartApt.id,
                                appointmentId,
                                serviceType,
                                appointment,
                                price: cartApt.appointment_price || appointment.price || 0
                            })
                        }
                    }
                }

                setCartAppointments(appointmentsWithData)

                // Check if invoice already exists for this cart
                // First, check if there's an order for this cart
                const { data: existingOrder, error: orderCheckError } = await supabase
                    .from('orders')
                    .select('id, invoice_number')
                    .eq('customer_id', appointment.clientId)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (!orderCheckError && existingOrder) {
                    setOrderId(existingOrder.id)

                    // Check if invoice_number exists
                    if (existingOrder.invoice_number) {
                        setExistingInvoiceNumber(existingOrder.invoice_number)
                    }
                }
            } catch (error: any) {
                console.error("Error fetching cart data:", error)
                toast({
                    title: "שגיאה",
                    description: error.message || "לא ניתן לטעון את נתוני העגלה",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }

        fetchCartData()
    }, [open, appointment, toast, onOpenChange, fetchManagerAppointment])

    const handleCreateInvoice = async () => {
        if (!cartId || !appointment?.clientId) {
            return
        }

        setIsCreatingInvoice(true)
        try {
            // Create or get order
            let finalOrderId = orderId

            if (!finalOrderId) {
                // Create new order
                const { data: newOrder, error: orderError } = await supabase
                    .from('orders')
                    .insert({
                        customer_id: appointment.clientId,
                        status: 'pending',
                        total: grandTotal,
                        subtotal: grandTotal,
                    })
                    .select('id')
                    .single()

                if (orderError) throw orderError
                finalOrderId = newOrder.id
                setOrderId(finalOrderId)
            }

            // TODO: Call Tranzila API to create invoice
            // For now, we'll use a placeholder
            // const invoiceResponse = await supabase.functions.invoke("create-tranzila-invoice", {
            //     body: {
            //         orderId: finalOrderId,
            //         customerId: appointment.clientId,
            //         amount: grandTotal,
            //         items: cartItems,
            //         appointments: cartAppointments,
            //     },
            // })

            // Placeholder invoice number (will be replaced with actual Tranzila invoice number)
            const invoiceNumber = `INV-${Date.now()}`

            // Save invoice number to order
            // Also store invoice details in metadata for reference
            const invoiceMetadata = {
                cart_id: cartId,
                appointment_ids: cartAppointments.map(apt => apt.appointmentId),
                created_at: new Date().toISOString(),
                items: cartItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total: item.total
                })),
                appointments: cartAppointments.map(apt => ({
                    id: apt.appointmentId,
                    service_type: apt.serviceType,
                    price: apt.price
                }))
            }

            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    invoice_number: invoiceNumber,
                    metadata: invoiceMetadata
                })
                .eq('id', finalOrderId)

            if (updateError) {
                console.error("Could not save invoice number:", updateError)
                throw updateError
            }

            // Also update cart to link it to the invoice
            const { error: cartUpdateError } = await supabase
                .from('carts')
                .update({
                    metadata: { invoice_number: invoiceNumber, order_id: finalOrderId }
                })
                .eq('id', cartId)

            if (cartUpdateError) {
                console.warn("Could not link invoice to cart:", cartUpdateError)
                // Non-critical, continue anyway
            }

            setExistingInvoiceNumber(invoiceNumber)
            setShowInvoicePreview(false)

            toast({
                title: "חשבונית נוצרה",
                description: `חשבונית מספר ${invoiceNumber} נוצרה בהצלחה`,
            })
        } catch (error: any) {
            console.error("Error creating invoice:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן ליצור את החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsCreatingInvoice(false)
        }
    }

    const handleSendInvoice = async () => {
        if (!cartId || !appointment?.clientId) {
            return
        }

        // Check if invoice exists
        if (!existingInvoiceNumber) {
            // Show preview dialog
            setShowInvoicePreview(true)
            return
        }

        // Determine which phone number to use
        let phoneToSend = ""
        if (phoneNumberType === "customer") {
            phoneToSend = customerPhone
        } else if (phoneNumberType === "contact") {
            phoneToSend = selectedPhoneNumber
        } else {
            phoneToSend = customPhoneNumber.trim()
        }

        if (!phoneToSend) {
            toast({
                title: "חסר מספר טלפון",
                description: "יש לבחור או להזין מספר טלפון לשליחת החשבונית",
                variant: "destructive",
            })
            return
        }

        setIsSending(true)
        try {
            // Call send-invoice function
            try {
                const { error: invoiceError } = await supabase.functions.invoke("send-invoice", {
                    body: {
                        paymentId: orderId,
                        email: customerEmail || undefined,
                        customerId: appointment.clientId,
                        phone: phoneToSend,
                        invoiceNumber: existingInvoiceNumber,
                    },
                })

                if (invoiceError) {
                    console.warn("Invoice sending function not available:", invoiceError)
                }
            } catch (invoiceError) {
                console.warn("Invoice sending function not available:", invoiceError)
            }

            toast({
                title: "חשבונית נשלחה",
                description: `חשבונית נשלחה ל-${phoneToSend}`,
            })

            onOpenChange(false)
        } catch (error: any) {
            console.error("Error sending invoice:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשלוח את החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("he-IL", {
            style: "currency",
            currency: "ILS",
        }).format(amount)
    }

    const formatAppointmentTime = (appointment: ManagerAppointment) => {
        if (!appointment.startDateTime || !appointment.endDateTime) {
            return ""
        }
        const start = new Date(appointment.startDateTime)
        const end = new Date(appointment.endDateTime)
        return `${format(start, "dd.MM.yyyy HH:mm")} - ${format(end, "HH:mm")}`
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <FileText className="h-5 w-5 text-green-600" />
                        חשבונית
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {customerName && `חשבונית עבור ${customerName}`}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12" dir="rtl">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <span className="mr-3 text-gray-600">טוען נתוני עגלה...</span>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[60vh] pl-4" dir="rtl">
                        <div className="space-y-6">
                            {/* Customer Info */}
                            {customerName && (
                                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <div className="text-sm font-semibold text-gray-900">פרטי לקוח</div>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <div>שם: {customerName}</div>
                                        {customerPhone && <div>טלפון: {customerPhone}</div>}
                                        {customerEmail && <div>אימייל: {customerEmail}</div>}
                                    </div>
                                </div>
                            )}

                            {/* Phone Number Selection */}
                            <div className="space-y-2 px-2">
                                <Label htmlFor="phone-select" className="text-right flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    מספר טלפון לשליחת חשבונית
                                </Label>
                                <Select
                                    value={phoneNumberType}
                                    onValueChange={(value: "customer" | "contact" | "custom") => {
                                        setPhoneNumberType(value)
                                        if (value === "customer") {
                                            setSelectedPhoneNumber(customerPhone)
                                        } else if (value === "contact") {
                                            // Keep selectedPhoneNumber if already set, otherwise use first contact
                                            if (!selectedPhoneNumber && customerContacts.length > 0) {
                                                setSelectedPhoneNumber(customerContacts[0].phone || "")
                                            }
                                        }
                                    }}
                                    dir="rtl"
                                >
                                    <SelectTrigger id="phone-select" className="text-right" dir="rtl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="customer">
                                            {customerPhone ? `לקוח (${customerPhone})` : "לקוח"}
                                        </SelectItem>
                                        {customerContacts.length > 0 && (
                                            <SelectItem value="contact">אנשי קשר</SelectItem>
                                        )}
                                        <SelectItem value="custom">מספר מותאם אישית</SelectItem>
                                    </SelectContent>
                                </Select>

                                {phoneNumberType === "contact" && customerContacts.length > 0 && (
                                    <Select
                                        value={selectedPhoneNumber}
                                        onValueChange={setSelectedPhoneNumber}
                                        dir="rtl"
                                    >
                                        <SelectTrigger className="text-right" dir="rtl">
                                            <SelectValue placeholder="בחר איש קשר" />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            {customerContacts.map((contact) => (
                                                <SelectItem key={contact.id} value={contact.phone || ""}>
                                                    {contact.name || "ללא שם"} - {contact.phone}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {phoneNumberType === "custom" && (
                                    <Input
                                        type="tel"
                                        placeholder="הזן מספר טלפון"
                                        value={customPhoneNumber}
                                        onChange={(e) => setCustomPhoneNumber(e.target.value)}
                                        className="text-right"
                                        dir="rtl"
                                    />
                                )}
                            </div>

                            {/* Appointments */}
                            {cartAppointments.length > 0 && (
                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-gray-900">תורים</div>
                                    <div className="space-y-2">
                                        {cartAppointments.map((cartApt) => (
                                            <div key={cartApt.id} className="border rounded-lg p-3 bg-white">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {cartApt.appointment?.serviceType === "grooming" ? "תור מספרה" : "תור"}
                                                        </div>
                                                        {cartApt.appointment && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {formatAppointmentTime(cartApt.appointment)}
                                                            </div>
                                                        )}
                                                        {cartApt.appointment?.dogs?.[0]?.name && (
                                                            <div className="text-xs text-gray-500">
                                                                לקוח: {cartApt.appointment.dogs[0].name}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {formatCurrency(cartApt.price)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            {cartItems.length > 0 && (
                                <div className="space-y-3">
                                    <div className="text-sm font-semibold text-gray-900">פריטים</div>
                                    <div className="space-y-2">
                                        {cartItems.map((item) => (
                                            <div key={item.id} className="border rounded-lg p-3 bg-white">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {item.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            כמות: {item.quantity} × {formatCurrency(item.unitPrice)}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {formatCurrency(item.total)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {cartAppointments.length === 0 && cartItems.length === 0 && (
                                <div className="text-center py-8 text-gray-500" dir="rtl">
                                    העגלה ריקה
                                </div>
                            )}

                            {/* Totals */}
                            {(cartAppointments.length > 0 || cartItems.length > 0) && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        {cartAppointments.length > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">סה״כ תורים:</span>
                                                <span className="font-medium">{formatCurrency(appointmentsTotal)}</span>
                                            </div>
                                        )}
                                        {cartItems.length > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">סה״כ פריטים:</span>
                                                <span className="font-medium">{formatCurrency(itemsTotal)}</span>
                                            </div>
                                        )}
                                        <Separator />
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>סה״כ לתשלום:</span>
                                            <span>{formatCurrency(grandTotal)}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </ScrollArea>
                )}

                {/* Invoice Status */}
                {existingInvoiceNumber && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800" dir="rtl">
                        <div className="font-semibold">חשבונית קיימת:</div>
                        <div>מספר חשבונית: {existingInvoiceNumber}</div>
                    </div>
                )}

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse" dir="rtl">
                    <Button
                        onClick={handleSendInvoice}
                        disabled={isLoading || isSending || grandTotal === 0}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                שולח...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 ml-2" />
                                {existingInvoiceNumber ? "שלח חשבונית" : "צור ושלח חשבונית"}
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={() => {
                            onGoToCart()
                            onOpenChange(false)
                        }}
                        variant="outline"
                        disabled={isLoading || isSending}
                    >
                        <ShoppingCart className="h-4 w-4 ml-2" />
                        עבור לעגלה
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading || isSending}
                    >
                        סגור
                    </Button>
                </DialogFooter>
            </DialogContent>

            {/* Invoice Preview Dialog */}
            <InvoicePreviewDialog
                open={showInvoicePreview}
                onOpenChange={setShowInvoicePreview}
                customerName={customerName}
                cartItems={cartItems}
                cartAppointments={cartAppointments}
                grandTotal={grandTotal}
                isCreating={isCreatingInvoice}
                onCreateInvoice={handleCreateInvoice}
            />
        </Dialog>
    )
}
