import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { CustomerCommunicationModal } from "./CustomerCommunicationModal"
import {
    setShowCustomerCommunicationModal,
    setCustomerCommunicationAppointment,
    setShowRescheduleProposalModal,
    setRescheduleTargetAppointment,
    setRescheduleTimes,
    setShowInvoiceModal,
    setInvoiceModalAppointment,
    setShowDogReadyModal,
    setDogReadyModalAppointment,
} from "@/store/slices/managerScheduleSlice"

export function ManagerCustomerCommunicationModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.showCustomerCommunicationModal)
    const appointment = useAppSelector((state) => state.managerSchedule.customerCommunicationAppointment)

    const handleClose = () => {
        dispatch(setShowCustomerCommunicationModal(false))
        dispatch(setCustomerCommunicationAppointment(null))
    }

    const handleSuggestNewTime = () => {
        if (!appointment) {
            return
        }

        if (!appointment.clientId) {
            toast({
                title: "אין לקוח משויך",
                description: "לא ניתן להציע זמן חדש לתור שאינו משויך ללקוח.",
                variant: "destructive",
            })
            return
        }

        const start = appointment.startDateTime ? new Date(appointment.startDateTime) : null
        const end = appointment.endDateTime ? new Date(appointment.endDateTime) : null
        if (!start || !end) {
            toast({
                title: "תזמון לא תקין",
                description: "לא הצלחנו לקרוא את זמני התור המקורי.",
                variant: "destructive",
            })
            return
        }

        dispatch(setRescheduleTargetAppointment(appointment))
        dispatch(
            setRescheduleTimes({
                startTime: new Date(start.getTime()),
                endTime: new Date(end.getTime()),
                stationId: appointment.stationId,
            })
        )
        dispatch(setShowRescheduleProposalModal(true))
    }

    const handleSendInvoice = () => {
        if (!appointment) {
            return
        }

        if (!appointment.clientId) {
            toast({
                title: "אין לקוח משויך",
                description: "לא ניתן לשלוח חשבונית לתור שאינו משויך ללקוח.",
                variant: "destructive",
            })
            return
        }

        // Open invoice modal for this appointment
        dispatch(setInvoiceModalAppointment(appointment))
        dispatch(setShowInvoiceModal(true))
        // Close communication modal
        handleClose()
    }

    const handleReadyInMinutes = () => {
        if (!appointment) {
            return
        }

        if (!appointment.clientId) {
            toast({
                title: "אין לקוח משויך",
                description: "לא ניתן לשלוח הודעה לתור שאינו משויך ללקוח.",
                variant: "destructive",
            })
            return
        }

        // Open dog ready modal for this appointment
        dispatch(setDogReadyModalAppointment(appointment))
        dispatch(setShowDogReadyModal(true))
        // Close communication modal
        handleClose()
    }

    const clientName = appointment?.clientName ?? appointment?.dogs?.[0]?.clientName

    return (
        <CustomerCommunicationModal
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                } else {
                    dispatch(setShowCustomerCommunicationModal(true))
                }
            }}
            onSuggestNewTime={handleSuggestNewTime}
            onSendInvoice={handleSendInvoice}
            onReadyInMinutes={handleReadyInMinutes}
            clientName={clientName}
        />
    )
}

