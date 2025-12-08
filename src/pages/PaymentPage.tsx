import { useEffect, useState, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard, CheckCircle, AlertCircle, Calendar, User, Dog, Clock } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { PaymentIframe } from "@/components/payments/PaymentIframe"

interface CartItem {
    id: string
    item_name: string | null
    quantity: number
    unit_price: number
    product_id: string | null
}

interface CartAppointment {
    id: string
    appointment_price: number
    grooming_appointment_id: string | null
    daycare_appointment_id: string | null
    appointment?: {
        id: string
        start_at: string
        end_at: string
        dogs?: Array<{ name: string }>
        clientName?: string
    }
}

interface CartData {
    id: string
    customer_id: string
    customer?: {
        full_name: string | null
        phone: string | null
        email: string | null
    }
    items: CartItem[]
    appointments: CartAppointment[]
}

export default function PaymentPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const cartId = searchParams.get("cartId")
    const [cartData, setCartData] = useState<CartData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isPaid, setIsPaid] = useState(false)
    const [showPaymentIframe, setShowPaymentIframe] = useState(false)
    const [paymentPostData, setPaymentPostData] = useState<Record<string, string | number> | undefined>(undefined)

    // Calculate total
    const totalAmount = useMemo(() => {
        if (!cartData) return 0
        const itemsTotal = cartData.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
        const appointmentsTotal = cartData.appointments.reduce((sum, apt) => sum + (apt.appointment_price || 0), 0)
        return itemsTotal + appointmentsTotal
    }, [cartData])

    // Fetch cart data
    useEffect(() => {
        if (!cartId) {
            setError("חסר מזהה עגלה")
            setIsLoading(false)
            return
        }

        const fetchCartData = async () => {
            try {
                setIsLoading(true)
                setError(null)

                // Fetch cart with customer
                const { data: cart, error: cartError } = await supabase
                    .from("carts")
                    .select(`
                        id,
                        customer_id,
                        customers (
                            id,
                            full_name,
                            phone,
                            email
                        )
                    `)
                    .eq("id", cartId)
                    .single()

                if (cartError) throw cartError
                if (!cart) {
                    throw new Error("עגלה לא נמצאה")
                }

                // Fetch cart items
                const { data: items, error: itemsError } = await supabase
                    .from("cart_items")
                    .select("*")
                    .eq("cart_id", cartId)

                if (itemsError) throw itemsError

                // Fetch cart appointments
                const { data: cartAppointments, error: appointmentsError } = await supabase
                    .from("cart_appointments")
                    .select(`
                        id,
                        appointment_price,
                        grooming_appointment_id,
                        daycare_appointment_id
                    `)
                    .eq("cart_id", cartId)

                if (appointmentsError) throw appointmentsError

                // Fetch appointment details
                const groomingAppointmentIds = cartAppointments
                    ?.filter((ca) => ca.grooming_appointment_id)
                    .map((ca) => ca.grooming_appointment_id)
                    .filter(Boolean) || []

                const daycareAppointmentIds = cartAppointments
                    ?.filter((ca) => ca.daycare_appointment_id)
                    .map((ca) => ca.daycare_appointment_id)
                    .filter(Boolean) || []

                let appointmentsData: any[] = []
                
                // Fetch grooming appointments
                let groomingApps: any[] = []
                if (groomingAppointmentIds.length > 0) {
                    const { data: groomingData } = await supabase
                        .from("grooming_appointments")
                        .select(`
                            id,
                            start_at,
                            end_at,
                            dogs (
                                name
                            ),
                            customers (
                                full_name
                            )
                        `)
                        .in("id", groomingAppointmentIds)
                    groomingApps = groomingData || []
                }

                // Fetch daycare appointments
                let daycareApps: any[] = []
                if (daycareAppointmentIds.length > 0) {
                    const { data: daycareData } = await supabase
                        .from("daycare_appointments")
                        .select(`
                            id,
                            start_at,
                            end_at,
                            dogs (
                                name
                            ),
                            customers (
                                full_name
                            )
                        `)
                        .in("id", daycareAppointmentIds)
                    daycareApps = daycareData || []
                }

                const allApps = [...groomingApps, ...daycareApps]
                appointmentsData = cartAppointments?.map((ca) => {
                    const appt = allApps.find(
                        (a) => a.id === (ca.grooming_appointment_id || ca.daycare_appointment_id)
                    )
                    return {
                        ...ca,
                        appointment: appt
                            ? {
                                  ...appt,
                                  clientName: Array.isArray(appt.customers) 
                                      ? appt.customers[0]?.full_name || null
                                      : appt.customers?.full_name || null,
                                  dogs: Array.isArray(appt.dogs) ? appt.dogs : (appt.dogs ? [appt.dogs] : []),
                              }
                            : null,
                    }
                }) || []

                // Check if cart is already paid
                const { data: orderData } = await supabase
                    .from("orders")
                    .select("id, status")
                    .eq("cart_id", cartId)
                    .maybeSingle()

                if (orderData) {
                    const status = (orderData.status || "").toLowerCase()
                    const paid = status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")
                    setIsPaid(paid)
                }

                setCartData({
                    id: cart.id,
                    customer_id: cart.customer_id,
                    customer: Array.isArray(cart.customers) ? cart.customers[0] : cart.customers,
                    items: items || [],
                    appointments: appointmentsData,
                })
            } catch (err) {
                console.error("Error fetching cart:", err)
                setError(err instanceof Error ? err.message : "שגיאה בטעינת העגלה")
            } finally {
                setIsLoading(false)
            }
        }

        fetchCartData()
    }, [cartId])

    // Poll for payment status
    useEffect(() => {
        if (!cartId || isPaid) return

        const pollInterval = setInterval(async () => {
            const { data: orderData } = await supabase
                .from("orders")
                .select("id, status")
                .eq("cart_id", cartId)
                .maybeSingle()

            if (orderData) {
                const status = (orderData.status || "").toLowerCase()
                const paid = status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")
                if (paid) {
                    setIsPaid(true)
                    clearInterval(pollInterval)
                }
            }
        }, 3000)

        return () => clearInterval(pollInterval)
    }, [cartId, isPaid])

    const handlePayment = async () => {
        if (!cartData || !cartId) return

        try {
            // Get Tranzila handshake token
            const { data: handshakeData, error: handshakeError } = await supabase.functions.invoke("tranzila-handshake", {
                body: { sum: totalAmount },
            })

            if (handshakeError || !handshakeData?.success || !handshakeData?.thtk) {
                throw new Error(handshakeError?.message || "לא ניתן להתחבר למערכת התשלומים")
            }

            const thtk = handshakeData.thtk

            // Build POST data for Tranzila iframe
            const postData: Record<string, string | number> = {
                supplier: "bloved29",
                thtk,
                new_process: 1,
                lang: "il",
                sum: totalAmount,
                currency: 1,
                tranmode: "AK",
                cred_type: 1, // Single payment
            }

            // Add customer information
            if (cartData.customer?.full_name) {
                postData.contact = cartData.customer.full_name
                postData.customer_name = cartData.customer.full_name
            }
            if (cartData.customer?.phone) {
                postData.phone = cartData.customer.phone.replace(/\D/g, "")
            }
            if (cartData.customer?.email) {
                postData.email = cartData.customer.email
            }
            if (cartData.customer_id) {
                postData.record_id = cartData.customer_id
            }

            // Add custom data with cart ID
            postData.mymore = JSON.stringify({
                cart_id: cartId,
            })

            // Add product list as JSON
            const productList = [
                ...cartData.items.map((item) => ({
                    product_name: item.item_name || "פריט",
                    product_quantity: item.quantity,
                    product_price: item.unit_price,
                })),
                ...cartData.appointments.map((apt) => {
                    // Get dog names from appointment
                    const dogNames = apt.appointment?.dogs
                        ?.map((d) => d.name)
                        .filter((name): name is string => !!name)
                        .join(", ")
                    const productName = dogNames ? `תספורת - ${dogNames}` : "תור"
                    return {
                        product_name: productName,
                        product_quantity: 1,
                        product_price: apt.appointment_price,
                    }
                }),
            ]
            postData.json_purchase_data = JSON.stringify(productList)
            postData.u71 = 1

            // Add notify_url_address for callback
            const supabaseUrl = import.meta.env.VITE_PROD_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
            if (supabaseUrl) {
                postData.notify_url_address = `${supabaseUrl}/functions/v1/payment-received-callback`
            }

            setPaymentPostData(postData)
            setShowPaymentIframe(true)
        } catch (err) {
            console.error("Error initiating payment:", err)
            alert(`שגיאה בפתיחת דף התשלום: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`)
        }
    }

    const handlePaymentSuccess = async () => {
        setShowPaymentIframe(false)
        setPaymentPostData(undefined)
        
        // Poll for payment confirmation
        const pollInterval = setInterval(async () => {
            if (!cartId) {
                clearInterval(pollInterval)
                return
            }
            
            const { data: orderData } = await supabase
                .from("orders")
                .select("id, status")
                .eq("cart_id", cartId)
                .maybeSingle()

            if (orderData) {
                const status = (orderData.status || "").toLowerCase()
                const paid = status === "completed" || status === "paid" || status.includes("שולם") || status.includes("הושלם")
                if (paid) {
                    clearInterval(pollInterval)
                    setIsPaid(true)
                }
            }
        }, 2000)

        // Stop polling after 2 minutes
        setTimeout(() => {
            clearInterval(pollInterval)
        }, 120000)
    }

    const handlePaymentError = (error: string) => {
        console.error("Payment error:", error)
        setShowPaymentIframe(false)
        setPaymentPostData(undefined)
        alert(`שגיאה בתשלום: ${error}`)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#4f60a8" }} />
                    <p className="text-gray-600">טוען פרטי תשלום...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                <Card className="max-w-md w-full mx-4">
                    <CardHeader>
                        <CardTitle className="text-right flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            שגיאה
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-right">
                        <p className="text-gray-700 mb-4">{error}</p>
                        <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                            חזרה לדף הבית
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (isPaid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                <Card className="max-w-md w-full mx-4">
                    <CardHeader>
                        <CardTitle className="text-right flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            תשלום הושלם בהצלחה
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-right">
                        <p className="text-gray-700 mb-4">תודה על התשלום! העגלה שולמה בהצלחה.</p>
                        <Button onClick={() => navigate("/")} className="w-full">
                            חזרה לדף הבית
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (showPaymentIframe && paymentPostData) {
        return (
            <div className="min-h-screen bg-gray-50" dir="rtl">
                <div className="container mx-auto py-8 px-4">
                    <PaymentIframe
                        postData={paymentPostData}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        productName="תשלום עגלה"
                        amount={totalAmount}
                    />
                </div>
            </div>
        )
    }

    if (!cartData) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
            <div className="max-w-2xl mx-auto">
                <Card className="shadow-lg">
                    <CardHeader 
                        className="text-white rounded-t-lg"
                        style={{ backgroundColor: "#4f60a8" }}
                    >
                        <CardTitle className="text-2xl text-right flex items-center gap-2">
                            <CreditCard className="h-6 w-6" />
                            תשלום עגלה
                        </CardTitle>
                        <CardDescription className="text-white/90 text-right">
                            {cartData.customer?.full_name && (
                                <div className="flex items-center gap-2 mt-2">
                                    <User className="h-4 w-4" />
                                    {cartData.customer.full_name}
                                </div>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* Appointments */}
                        {cartData.appointments.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-right">תורים</h3>
                                {cartData.appointments.map((apt) => (
                                    <div key={apt.id} className="border rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-right">
                                                <Calendar className="h-4 w-4 text-blue-600" />
                                                {apt.appointment && (
                                                    <span className="font-medium">
                                                        {format(new Date(apt.appointment.start_at), "dd/MM/yyyy", { locale: he })}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-left font-bold text-lg">
                                                ₪{apt.appointment_price.toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        {apt.appointment && (
                                            <>
                                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                                    <Clock className="h-4 w-4" />
                                                    {format(new Date(apt.appointment.start_at), "HH:mm")} -{" "}
                                                    {format(new Date(apt.appointment.end_at), "HH:mm")}
                                                </div>
                                                {apt.appointment.dogs && apt.appointment.dogs.length > 0 && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <Dog className="h-4 w-4" />
                                                        {apt.appointment.dogs.map((d) => d.name).join(", ")}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Products */}
                        {cartData.items.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-right">מוצרים</h3>
                                {cartData.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between border rounded-lg p-4 bg-gray-50">
                                        <div className="text-right">
                                            <div className="font-medium">{item.item_name || "פריט"}</div>
                                            <div className="text-sm text-gray-600">כמות: {item.quantity}</div>
                                        </div>
                                        <div className="text-left font-bold">
                                            ₪{(item.unit_price * item.quantity).toLocaleString("he-IL", { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}


                        {/* Total */}
                        <div className="border-t-2 pt-4" style={{ borderColor: "#4f60a8" }}>
                            <div className="flex items-center justify-between">
                                <div className="text-right text-xl font-bold">סה"כ לתשלום</div>
                                <div className="text-left text-2xl font-bold" style={{ color: "#4f60a8" }}>
                                    ₪{totalAmount.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Payment Button */}
                        <Button
                            onClick={handlePayment}
                            className="w-full py-6 text-lg font-semibold text-white hover:opacity-90"
                            style={{ backgroundColor: "#4f60a8" }}
                            size="lg"
                        >
                            <CreditCard className="h-5 w-5 ml-2" />
                            המשך לתשלום
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

