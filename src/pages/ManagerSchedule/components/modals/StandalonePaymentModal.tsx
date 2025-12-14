import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setShowPaymentModal } from "@/store/slices/managerScheduleSlice"
import { useToast } from "@/hooks/use-toast"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"
import type { ManagerAppointment } from "@/types/managerSchedule"

export function StandalonePaymentModal() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const showPaymentModal = useAppSelector((state) => state.managerSchedule.showPaymentModal)
  const selectedAppointmentForPayment = useAppSelector(
    (state) => state.managerSchedule.selectedAppointmentForPayment
  )
  const paymentCartId = useAppSelector((state) => state.managerSchedule.paymentCartId)

  return (
    <PaymentModal
      open={showPaymentModal}
      onOpenChange={(open) => dispatch(setShowPaymentModal(open))}
      appointment={selectedAppointmentForPayment as ManagerAppointment | null}
      cartId={paymentCartId}
      onConfirm={(paymentData) => {
        toast({
          title: "תשלום נקלט בהצלחה",
          description: `תשלום בסך ₪${paymentData.amount} נרשם בהצלחה`,
        })
        dispatch(setShowPaymentModal(false))
      }}
    />
  )
}

