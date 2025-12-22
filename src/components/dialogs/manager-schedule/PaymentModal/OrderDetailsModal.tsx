import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, FileText } from "lucide-react"
import { SiWhatsapp } from "react-icons/si"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { CreateInvoiceModal } from "./CreateInvoiceModal.tsx"
import { SendInvoiceWhatsAppDialog } from "./SendInvoiceWhatsAppDialog.tsx"

interface OrderDetailsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cartId: string | null
    appointmentId?: string | null
    serviceType?: "grooming" | "daycare" | null
}

interface Order {
    id: string
    customer_id: string | null
    grooming_appointment_id: string | null
    daycare_appointment_id: string | null
    cart_id: string | null
    status: string | null
    subtotal: number | null
    total: number | null
    invoice_number: string | null
    invoice_retrieval_key: string | null
    invoice_credit_retrieval_key: string | null
    created_at: string
    order_items: Array<{
        id: string
        item_name: string | null
        quantity: number
        unit_price: number | null
        product_id: string | null
    }> | null
    cart_appointments?: Array<{
        id: string
        appointment_price: number | null
        grooming_appointment_id: string | null
        daycare_appointment_id: string | null
    }>
    cart_items?: Array<{
        id: string
        item_name: string | null
        quantity: number
        unit_price: number | null
        product_id: string | null
    }>
}

interface Invoice {
    id: string
    order_id: string
    invoice_type: "debit" | "credit"
    customer_name: string
    customer_email: string | null
    customer_phone: string | null
    amount: number
    invoice_number: string | null
    retrieval_key: string | null
    created_at: string
}

export function OrderDetailsModal({
    open,
    onOpenChange,
    cartId,
    appointmentId,
    serviceType,
}: OrderDetailsModalProps) {
    const [orders, setOrders] = useState<Order[]>([])
    const [invoices, setInvoices] = useState<Record<string, Invoice[]>>({}) // order_id -> invoices[]
    const [isLoading, setIsLoading] = useState(false)
    const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null)
    const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false)
    const [pendingInvoiceOrder, setPendingInvoiceOrder] = useState<{ order: Order; type: "debit" | "credit" } | null>(null)
    const [customerData, setCustomerData] = useState<{ name: string; email?: string; phone?: string } | null>(null)
    const [showSendInvoiceDialog, setShowSendInvoiceDialog] = useState(false)
    const [selectedInvoiceForWhatsApp, setSelectedInvoiceForWhatsApp] = useState<{ invoice: Invoice; order: Order } | null>(null)
    const [customerPhoneForInvoice, setCustomerPhoneForInvoice] = useState<string | null>(null)
    const [customerNameForInvoice, setCustomerNameForInvoice] = useState<string | null>(null)
    const { toast } = useToast()

    useEffect(() => {
        if (open && (cartId || appointmentId)) {
            fetchOrders()
        }
    }, [open, cartId, appointmentId])

    const fetchOrders = async () => {
        setIsLoading(true)
        try {
            let query = supabase
                .from("orders")
                .select(
                    `
          *,
          order_items (
            id,
            item_name,
            quantity,
            unit_price,
            product_id
          )
        `
                )
                .order("created_at", { ascending: false })

            if (cartId) {
                query = query.eq("cart_id", cartId)
            } else if (appointmentId && serviceType) {
                // Try to find orders by appointment_id directly
                query = query.eq("grooming_appointment_id", appointmentId)
            }

            const { data, error } = await query

            if (error) {
                throw error
            }

            // If no orders found and we have appointmentId, try to find via cart_appointments
            if ((!data || data.length === 0) && appointmentId && serviceType) {
                const appointmentIdField = "grooming_appointment_id"

                // Find carts linked to this appointment
                const { data: cartAppointments } = await supabase
                    .from("cart_appointments")
                    .select("cart_id")
                    .eq(appointmentIdField, appointmentId)

                if (cartAppointments && cartAppointments.length > 0) {
                    const cartIds = cartAppointments.map(ca => ca.cart_id).filter(Boolean)

                    if (cartIds.length > 0) {
                        const { data: ordersByCart, error: cartError } = await supabase
                            .from("orders")
                            .select(
                                `
                *,
                order_items (
                  id,
                  item_name,
                  quantity,
                  unit_price,
                  product_id
                )
              `
                            )
                            .in("cart_id", cartIds)
                            .order("created_at", { ascending: false })

                        if (!cartError && ordersByCart && ordersByCart.length > 0) {
                            // Fetch cart data for orders with cart_id but no order_items
                            const ordersWithCartData = await Promise.all(
                                ordersByCart.map(async (order) => {
                                    if (order.cart_id && (!order.order_items || order.order_items.length === 0)) {
                                        const [cartAppointmentsResult, cartItemsResult] = await Promise.all([
                                            supabase
                                                .from("cart_appointments")
                                                .select("id, appointment_price, grooming_appointment_id")
                                                .eq("cart_id", order.cart_id),
                                            supabase
                                                .from("cart_items")
                                                .select("id, item_name, quantity, unit_price, product_id")
                                                .eq("cart_id", order.cart_id)
                                        ])

                                        return {
                                            ...order,
                                            cart_appointments: cartAppointmentsResult.data || [],
                                            cart_items: cartItemsResult.data || []
                                        }
                                    }
                                    return order
                                })
                            )

                            setOrders(ordersWithCartData)
                            setIsLoading(false)
                            return
                        }
                    }
                }
            }

            if (error) throw error

            // If orders have cart_id but no order_items, fetch cart data
            if (data && data.length > 0) {
                const ordersWithCartData = await Promise.all(
                    data.map(async (order) => {
                        // If order has cart_id but no order_items, fetch cart data
                        if (order.cart_id && (!order.order_items || order.order_items.length === 0)) {
                            const [cartAppointmentsResult, cartItemsResult] = await Promise.all([
                                supabase
                                    .from("cart_appointments")
                                    .select("id, appointment_price, grooming_appointment_id")
                                    .eq("cart_id", order.cart_id),
                                supabase
                                    .from("cart_items")
                                    .select("id, item_name, quantity, unit_price, product_id")
                                    .eq("cart_id", order.cart_id)
                            ])

                            return {
                                ...order,
                                cart_appointments: cartAppointmentsResult.data || [],
                                cart_items: cartItemsResult.data || []
                            }
                        }
                        return order
                    })
                )

                setOrders(ordersWithCartData)
                // Fetch invoices for all orders
                await fetchInvoicesForOrders(ordersWithCartData.map(o => o.id))
            } else {
                setOrders(data || [])
                await fetchInvoicesForOrders((data || []).map(o => o.id))
            }
        } catch (err) {
            toast({
                title: "שגיאה בטעינת הזמנות",
                description: err instanceof Error ? err.message : "אירעה שגיאה בטעינת ההזמנות",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const fetchInvoicesForOrders = async (orderIds: string[]) => {
        if (orderIds.length === 0) return

        try {
            const { data: invoicesData, error: invoicesError } = await supabase
                .from("invoices")
                .select("*")
                .in("order_id", orderIds)
                .order("created_at", { ascending: true })

            if (invoicesError) {
                console.error("Error fetching invoices:", invoicesError)
                return
            }

            // Group invoices by order_id and sort by created_at (newest first)
            const invoicesByOrder: Record<string, Invoice[]> = {}
            if (invoicesData) {
                invoicesData.forEach((invoice) => {
                    if (!invoicesByOrder[invoice.order_id]) {
                        invoicesByOrder[invoice.order_id] = []
                    }
                    invoicesByOrder[invoice.order_id].push(invoice as Invoice)
                })

                // Sort invoices within each order by created_at (oldest first)
                Object.keys(invoicesByOrder).forEach((orderId) => {
                    invoicesByOrder[orderId].sort((a, b) => {
                        const dateA = new Date(a.created_at).getTime()
                        const dateB = new Date(b.created_at).getTime()
                        return dateA - dateB // Ascending order (oldest first)
                    })
                })
            }

            setInvoices(invoicesByOrder)
        } catch (_err) {
            console.error("Error fetching invoices:", _err)
        }
    }

    const handleCreateInvoiceClick = async (order: Order, type: "debit" | "credit") => {
        if (!order.id || !order.customer_id) {
            toast({
                title: "שגיאה",
                description: "חסרים פרטים נדרשים ליצירת חשבונית",
                variant: "destructive",
            })
            return
        }

        // Fetch customer data for the modal
        try {
            const { data: customer } = await supabase
                .from("customers")
                .select("full_name, email, phone")
                .eq("id", order.customer_id)
                .single()

            setCustomerData({
                name: customer?.full_name || "",
                email: customer?.email || undefined,
                phone: customer?.phone || undefined,
            })
            setPendingInvoiceOrder({ order, type })
            setShowCreateInvoiceModal(true)
        } catch (err) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון פרטי לקוח",
                variant: "destructive",
            })
        }
    }

    const handleCreateInvoice = async (invoiceDetails: { customerName: string; customerEmail?: string; customerPhone?: string; amount: number }) => {
        if (!pendingInvoiceOrder) return

        const { order, type } = pendingInvoiceOrder
        const action = type === "credit" ? "3" : "1"

        setCreatingInvoice(order.id)
        setShowCreateInvoiceModal(false)

        try {
            // Use Supabase client's invoke method which automatically uses the correct URL
            const { data: invoiceResult, error: invoiceError } = await supabase.functions.invoke("tranzila-create-invoice", {
                body: {
                    orderId: order.id,
                    customerId: order.customer_id,
                    action: action,
                    invoiceDetails: invoiceDetails,
                },
            })

            if (invoiceError) {
                throw invoiceError
            }

            const data = invoiceResult as { success: boolean; invoiceId?: string; invoiceNumber?: string; retrievalKey?: string; invoiceType?: string; amount?: number; error?: string }
            if (!data || (typeof data === "object" && "success" in data && !data.success)) {
                throw new Error(data?.error || "Failed to create invoice")
            }

            // Update the order in the local state with the invoice number and retrieval key
            // The backend saves to the correct field based on action (debit vs credit)
            if (data.invoiceNumber || data.retrievalKey) {
                setOrders((prevOrders) =>
                    prevOrders.map((o) => {
                        if (o.id !== order.id) return o

                        const updated: Order = {
                            ...o,
                            invoice_number: data.invoiceNumber || o.invoice_number,
                        }

                        // The backend determines which field to update based on action
                        // If action=1 (debit), it updates invoice_retrieval_key
                        // If action=3 (credit), it updates invoice_credit_retrieval_key
                        // We refresh from the server to get the correct field updated
                        return updated
                    })
                )
            }

            toast({
                title: "החשבונית נוצרה בהצלחה",
                description: data.invoiceNumber
                    ? `מספר חשבונית: ${data.invoiceNumber}`
                    : type === "credit"
                        ? "חשבונית זיכוי נוצרה בהצלחה"
                        : "החשבונית נוצרה",
            })

            // Refresh orders and invoices to get updated data
            await fetchOrders()
        } catch (err) {
            toast({
                title: "שגיאה ביצירת חשבונית",
                description: err instanceof Error ? err.message : "אירעה שגיאה ביצירת חשבונית",
                variant: "destructive",
            })
        } finally {
            setCreatingInvoice(null)
            setPendingInvoiceOrder(null)
            setCustomerData(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-3xl max-h-[80vh] overflow-y-auto"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                onMouseOver={(e) => e.stopPropagation()}
                onMouseMove={(e) => e.stopPropagation()}
            >
                <DialogHeader>
                    <DialogTitle className="text-right">פרטי הזמנות</DialogTitle>
                    <DialogDescription className="text-right">
                        {cartId ? `הזמנות עבור עגלה ${cartId.slice(0, 8)}...` : "הזמנות עבור התור"}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="mr-2 text-gray-600">טוען הזמנות...</span>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">לא נמצאו הזמנות</div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div key={order.id} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-lg">הזמנה #{order.id.slice(0, 8)}</div>
                                        <div className="text-sm text-gray-500">
                                            {new Date(order.created_at).toLocaleDateString("he-IL", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-semibold text-lg">
                                            ₪{order.total?.toFixed(2) || order.subtotal?.toFixed(2) || "0.00"}
                                        </div>
                                        {order.status && (
                                            <div className="text-sm text-gray-500 capitalize">{order.status}</div>
                                        )}
                                    </div>
                                </div>

                                {/* Invoices Section */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium text-sm text-gray-700">חשבוניות:</div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCreateInvoiceClick(order, "debit")}
                                                disabled={creatingInvoice === order.id}
                                            >
                                                {creatingInvoice === order.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                        יוצר...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText className="h-4 w-4 ml-2" />
                                                        צור חשבונית חיוב
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleCreateInvoiceClick(order, "credit")}
                                                disabled={creatingInvoice === order.id}
                                            >
                                                {creatingInvoice === order.id ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                        יוצר...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FileText className="h-4 w-4 ml-2" />
                                                        צור חשבונית זיכוי
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    {invoices[order.id] && invoices[order.id].length > 0 ? (
                                        <div className="space-y-2">
                                            {invoices[order.id].map((invoice) => (
                                                <div key={invoice.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            {invoice.invoice_type === "credit" ? (
                                                                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">זיכוי</span>
                                                            ) : (
                                                                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">חיוב</span>
                                                            )}
                                                            <span className="text-sm font-medium">
                                                                ₪{invoice.amount.toFixed(2)}
                                                            </span>
                                                            {invoice.invoice_number && (
                                                                <span className="text-xs text-gray-500">#{invoice.invoice_number}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {new Date(invoice.created_at).toLocaleDateString("he-IL", {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </div>
                                                    </div>
                                                    {invoice.retrieval_key && (
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    window.open(
                                                                        `https://my.tranzila.com/api/get_financial_document/${invoice.retrieval_key}`,
                                                                        '_blank',
                                                                        'noopener,noreferrer'
                                                                    )
                                                                }}
                                                            >
                                                                <FileText className="h-4 w-4 ml-2" />
                                                                צפה
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    // Fetch customer data
                                                                    if (order.customer_id) {
                                                                        try {
                                                                            const { data: customer } = await supabase
                                                                                .from("customers")
                                                                                .select("phone, full_name")
                                                                                .eq("id", order.customer_id)
                                                                                .single()

                                                                            if (customer) {
                                                                                setCustomerPhoneForInvoice(customer.phone)
                                                                                setCustomerNameForInvoice(customer.full_name)
                                                                            }
                                                                        } catch (err) {
                                                                            console.error("Error fetching customer:", err)
                                                                        }
                                                                    }

                                                                    setSelectedInvoiceForWhatsApp({ invoice, order })
                                                                    setShowSendInvoiceDialog(true)
                                                                }}
                                                            >
                                                                <SiWhatsapp className="h-4 w-4 ml-2 text-green-600" />
                                                                שלח
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500 text-center py-2">אין חשבוניות</div>
                                    )}
                                </div>

                                {/* Order Items */}
                                {order.order_items && order.order_items.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="font-medium text-sm text-gray-700">פריטים:</div>
                                        <div className="space-y-1">
                                            {order.order_items.map((item) => (
                                                <div key={item.id} className="flex justify-between text-sm">
                                                    <span>{item.item_name || "פריט ללא שם"}</span>
                                                    <span className="text-gray-600">
                                                        {item.quantity} x ₪{item.unit_price?.toFixed(2) || "0.00"} = ₪
                                                        {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Cart Items */}
                                        {order.cart_items && order.cart_items.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="font-medium text-sm text-gray-700">מוצרים:</div>
                                                <div className="space-y-1">
                                                    {order.cart_items.map((item) => (
                                                        <div key={item.id} className="flex justify-between text-sm">
                                                            <span>{item.item_name || "פריט ללא שם"}</span>
                                                            <span className="text-gray-600">
                                                                {item.quantity} x ₪{item.unit_price?.toFixed(2) || "0.00"} = ₪
                                                                {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cart Appointments */}
                                        {order.cart_appointments && order.cart_appointments.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="font-medium text-sm text-gray-700">תורים:</div>
                                                <div className="space-y-1">
                                                    {order.cart_appointments.map((ca) => (
                                                        <div key={ca.id} className="flex justify-between text-sm">
                                                            <span>
                                                                {ca.grooming_appointment_id && "תור מספרה"}
                                                                {ca.grooming_appointment_id ? "תור מספרה" : "תור"}
                                                            </span>
                                                            <span className="text-gray-600">
                                                                ₪{ca.appointment_price?.toFixed(2) || "0.00"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Fallback if no cart data and no order items */}
                                        {(!order.cart_items || order.cart_items.length === 0) &&
                                            (!order.cart_appointments || order.cart_appointments.length === 0) &&
                                            order.total && order.total > 0 && (
                                                <div className="space-y-2">
                                                    <div className="font-medium text-sm text-gray-700">פרטי הזמנה:</div>
                                                    <div className="text-sm text-gray-600">
                                                        {order.grooming_appointment_id && "תור מספרה"}
                                                        {order.cart_id && !order.grooming_appointment_id && "עגלת קניות"}
                                                        {!order.grooming_appointment_id && !order.cart_id && "הזמנה"}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        סכום כולל: ₪{order.total.toFixed(2)}
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>

            {/* Create Invoice Modal */}
            {pendingInvoiceOrder && customerData && (
                <CreateInvoiceModal
                    open={showCreateInvoiceModal}
                    onOpenChange={setShowCreateInvoiceModal}
                    onConfirm={handleCreateInvoice}
                    defaultName={customerData.name}
                    defaultEmail={customerData.email}
                    defaultPhone={customerData.phone}
                    defaultAmount={pendingInvoiceOrder.order.total || pendingInvoiceOrder.order.subtotal || 0}
                    invoiceType={pendingInvoiceOrder.type}
                    isLoading={creatingInvoice === pendingInvoiceOrder.order.id}
                />
            )}

            {/* Send Invoice WhatsApp Dialog */}
            {selectedInvoiceForWhatsApp && selectedInvoiceForWhatsApp.invoice.retrieval_key && (
                <SendInvoiceWhatsAppDialog
                    open={showSendInvoiceDialog}
                    onOpenChange={setShowSendInvoiceDialog}
                    invoiceUrl={`https://my.tranzila.com/api/get_financial_document/${selectedInvoiceForWhatsApp.invoice.retrieval_key}`}
                    invoiceNumber={selectedInvoiceForWhatsApp.invoice.invoice_number}
                    invoiceType={selectedInvoiceForWhatsApp.invoice.invoice_type}
                    invoiceAmount={selectedInvoiceForWhatsApp.invoice.amount}
                    customerId={selectedInvoiceForWhatsApp.order.customer_id}
                    customerPhone={customerPhoneForInvoice}
                    customerName={customerNameForInvoice}
                />
            )}
        </Dialog>
    )
}

