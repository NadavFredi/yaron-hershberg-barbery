import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { InvoiceModal } from "./InvoiceModal"
import {
    setShowInvoiceModal,
    setInvoiceModalAppointment,
    setShowPaymentModal,
    setSelectedAppointmentForPayment,
    setPaymentCartId,
} from "@/store/slices/managerScheduleSlice"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export function ManagerInvoiceModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.showInvoiceModal)
    const appointment = useAppSelector((state) => state.managerSchedule.invoiceModalAppointment)
    const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)
    const selectedDate = new Date(selectedDateStr)

    const handleClose = () => {
        dispatch(setShowInvoiceModal(false))
        dispatch(setInvoiceModalAppointment(null))
    }

    const handleGoToCart = async () => {
        if (!appointment?.clientId) {
            return
        }

        try {
            // Find active cart for this customer
            const { data: cartData, error: cartError } = await supabase
                .from('carts')
                .select('id')
                .eq('customer_id', appointment.clientId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (cartError) {
                console.error("Error finding cart:", cartError)
            }

            // If no cart exists, we need to create one or use the payment modal's logic
            // For now, let's use the existing payment modal logic
            const year = selectedDate.getFullYear()
            const month = selectedDate.getMonth()
            const day = selectedDate.getDate()

            const dayStart = new Date(year, month, day, 0, 0, 0, 0)
            const dayEnd = new Date(year, month, day, 23, 59, 59, 999)

            const [groomingResult, daycareResult] = await Promise.all([
                supabase
                    .from("grooming_appointments")
                    .select("id, amount_due, status")
                    .eq("customer_id", appointment.clientId)
                    .gte("start_at", dayStart.toISOString())
                    .lte("start_at", dayEnd.toISOString())
                    .neq("status", "cancelled"),
                supabase
                    .from("daycare_appointments")
                    .select("id, amount_due, status")
                    .eq("customer_id", appointment.clientId)
                    .gte("start_at", dayStart.toISOString())
                    .lte("start_at", dayEnd.toISOString())
                    .neq("status", "cancelled"),
            ])

            if (groomingResult.error || daycareResult.error) {
                toast({
                    title: "שגיאה",
                    description: "לא הצלחנו לטעון את התורים",
                    variant: "destructive",
                })
                return
            }

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

            const allAppointments = [
                ...(groomingResult.data || [])
                    .filter((apt) => !isCancelledStatus(apt.status))
                    .map((apt) => ({
                        id: apt.id,
                        serviceType: "grooming" as const,
                        amountDue: apt.amount_due || 0,
                    })),
                ...(daycareResult.data || [])
                    .filter((apt) => !isCancelledStatus(apt.status))
                    .map((apt) => ({
                        id: apt.id,
                        serviceType: "garden" as const,
                        amountDue: apt.amount_due || 0,
                    })),
            ]

            if (allAppointments.length === 0) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצאו תורים ללקוח זה ביום זה",
                    variant: "destructive",
                })
                return
            }

            let cartId: string

            if (cartData?.id) {
                cartId = cartData.id
            } else {
                // Create new cart
                const { data: newCart, error: createCartError } = await supabase
                    .from("carts")
                    .insert({
                        customer_id: appointment.clientId,
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
                    grooming_appointment_id: apt.serviceType === "grooming" ? apt.id : null,
                    daycare_appointment_id: apt.serviceType === "garden" ? apt.id : null,
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

            // Open payment modal with cartId
            dispatch(setSelectedAppointmentForPayment(appointment))
            dispatch(setPaymentCartId(cartId))
            dispatch(setShowPaymentModal(true))
        } catch (error) {
            console.error("Error in handleGoToCart:", error)
            toast({
                title: "שגיאה",
                description: "אירעה שגיאה בעת פתיחת עגלה",
                variant: "destructive",
            })
        }
    }

    // Only show invoice modal if we're in invoice mode
    // We'll use a separate state for this, but for now let's check if appointment exists
    if (!appointment) {
        return null
    }

    return (
        <InvoiceModal
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                }
            }}
            appointment={appointment}
            onGoToCart={handleGoToCart}
        />
    )
}

