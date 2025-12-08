import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { supabaseApi, useGetManagerScheduleQuery, useCreateProposedMeetingMutation } from "@/store/services/supabaseApi"
import { ProposeRescheduleModal } from "./ProposeRescheduleModal"
import { format } from "date-fns"
import {
    setShowRescheduleProposalModal,
    setRescheduleTargetAppointment,
    setRescheduleTimes,
    setRescheduleSubmitting
} from "@/store/slices/managerScheduleSlice"
import type { AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { ensureValidProposedMeetingRange } from "@/pages/ManagerSchedule/managerSchedule.module"
import type { RecipientSelection } from "./RecipientSelector"

export function ManagerProposeRescheduleModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.showRescheduleProposalModal)
    const rescheduleTargetAppointment = useAppSelector((state) => state.managerSchedule.rescheduleTargetAppointment)
    const rescheduleTimes = useAppSelector((state) => state.managerSchedule.rescheduleTimes)
    const rescheduleSubmitting = useAppSelector((state) => state.managerSchedule.rescheduleSubmitting)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const [createProposedMeeting] = useCreateProposedMeetingMutation()

    const stations = data?.stations || []

    const handleClose = () => {
        dispatch(setShowRescheduleProposalModal(false))
        dispatch(setRescheduleTargetAppointment(null))
        dispatch(setRescheduleTimes(null))
    }

    const handleSubmit = async ({ times, summary, sendWhatsApp, recipientSelection }: { times: AppointmentTimes; summary: string; sendWhatsApp: boolean; recipientSelection?: RecipientSelection }) => {
        if (!rescheduleTargetAppointment) {
            return
        }
        if (!times.startTime || !times.endTime || !times.stationId) {
            toast({
                title: "חסר מידע",
                description: "בחרו תאריך, שעת התחלה, שעת סיום ועמדה להצעה.",
                variant: "destructive",
            })
            return
        }

        const customerId = rescheduleTargetAppointment.clientId
        if (!customerId) {
            toast({
                title: "אין לקוח משויך",
                description: "לא ניתן לשלוח ההצעה ללא זיהוי הלקוח.",
                variant: "destructive",
            })
            return
        }

        const startIso = times.startTime.toISOString()
        const endIso = times.endTime.toISOString()

        try {
            const intervalMinutes = 15 // Default interval
            ensureValidProposedMeetingRange(startIso, endIso, intervalMinutes)
            dispatch(setRescheduleSubmitting(true))
            dispatch(setRescheduleTimes(times))

            const sanitizedSummary = summary.trim() || "הצעת זמן חדש עבור התור הקיים"
            // TODO: Implement WhatsApp sending when sendWhatsApp is true
            // recipientSelection can be used to send additional messages to selected contacts
            console.log("📱 [ManagerProposeRescheduleModal] Send WhatsApp:", sendWhatsApp, "Recipient selection:", recipientSelection)
            const payload = {
                stationId: times.stationId,
                startTime: startIso,
                endTime: endIso,
                serviceType: rescheduleTargetAppointment.serviceType,
                title: sanitizedSummary,
                summary: sanitizedSummary,
                notes: undefined,
                customerIds: [customerId],
                customerTypeIds: [],
                rescheduleAppointmentId: rescheduleTargetAppointment.id,
                rescheduleCustomerId: customerId,
                rescheduleDogId: rescheduleTargetAppointment.dogs?.[0]?.id ?? null,
                rescheduleOriginalStartAt: rescheduleTargetAppointment.startDateTime,
                rescheduleOriginalEndAt: rescheduleTargetAppointment.endDateTime,
            }

            await createProposedMeeting(payload).unwrap()

            toast({
                title: "הצעה נוצרה",
                description: "ההצעה נשלחה ללקוח בהצלחה",
            })

            handleClose()
            await refetch()
        } catch (error) {
            console.error("❌ [ManagerSchedule] Failed to create reschedule proposal:", error)
            const message =
                error instanceof Error
                    ? error.message
                    : typeof error === "object" && error && "data" in error
                        ? String((error as { data?: unknown }).data)
                        : "לא ניתן ליצור את ההצעה"
            toast({
                title: "שמירת ההצעה נכשלה",
                description: message,
                variant: "destructive",
            })
        } finally {
            dispatch(setRescheduleSubmitting(false))
        }
    }

    // Convert rescheduleTimes from Redux (ISO strings) to Date objects
    const initialTimes: AppointmentTimes | null = rescheduleTimes ? {
        startTime: rescheduleTimes.startTime ? new Date(rescheduleTimes.startTime) : null,
        endTime: rescheduleTimes.endTime ? new Date(rescheduleTimes.endTime) : null,
        stationId: rescheduleTimes.stationId || null
    } : null

    return (
        <ProposeRescheduleModal
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                } else {
                    dispatch(setShowRescheduleProposalModal(true))
                }
            }}
            appointment={rescheduleTargetAppointment}
            stations={stations.map((s) => ({ id: s.id, name: s.name }))}
            initialTimes={initialTimes}
            submitting={rescheduleSubmitting}
            onSubmit={handleSubmit}
        />
    )
}

