import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { ProposedMeetingModal } from "./ProposedMeetingModal"
import { supabaseApi, useGetManagerScheduleQuery, useCreateProposedMeetingMutation, useUpdateProposedMeetingMutation } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import {
    setShowProposedMeetingModal,
    setEditingProposedMeeting,
    setProposedMeetingTimes,
    setFinalizedDragTimes
} from "@/store/slices/managerScheduleSlice"
// ensureValidProposedMeetingRange is defined inline below
import type { ProposedMeetingModalSubmission } from "./ProposedMeetingModal"
import type { AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"

export function ManagerProposedMeetingModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.showProposedMeetingModal)
    const proposedMeetingMode = useAppSelector((state) => state.managerSchedule.proposedMeetingMode)
    const proposedMeetingTimes = useAppSelector((state) => state.managerSchedule.proposedMeetingTimes)
    const editingProposedMeeting = useAppSelector((state) => state.managerSchedule.editingProposedMeeting)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const [createProposedMeeting, { isLoading: creatingProposedMeeting }] = useCreateProposedMeetingMutation()
    const [updateProposedMeeting, { isLoading: updatingProposedMeeting }] = useUpdateProposedMeetingMutation()

    const stations = data?.stations || []

    const handleOpenChange = (value: boolean) => {
        dispatch(setShowProposedMeetingModal(value))
        if (!value) {
            dispatch(setEditingProposedMeeting(null))
            dispatch(setProposedMeetingTimes(null))
        }
    }

    const handleSubmit = async (payload: ProposedMeetingModalSubmission) => {
        try {
            const intervalMinutes = 15 // Default interval
            // Validate proposed meeting range
            const startTime = new Date(payload.startTime)
            const endTime = new Date(payload.endTime)
            const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
            if (durationMinutes < intervalMinutes) {
                throw new Error(`משך הזמן חייב להיות לפחות ${intervalMinutes} דקות`)
            }

            if (proposedMeetingMode === "create") {
                await createProposedMeeting({
                    ...payload,
                    dogIds: payload.dogIds,
                }).unwrap()
                toast({
                    title: "מפגש מוצע נוצר בהצלחה",
                    description: "חלון הזמן נוסף ליומן ונשמר עבור הלקוחות שהוזמנו.",
                })
            } else if (payload.meetingId) {
                const rescheduleMetadata = editingProposedMeeting?.proposedLinkedAppointmentId
                    ? {
                        rescheduleAppointmentId: editingProposedMeeting.proposedLinkedAppointmentId,
                        rescheduleCustomerId: editingProposedMeeting.proposedLinkedCustomerId ?? null,
                        rescheduleDogId: editingProposedMeeting.proposedLinkedDogId ?? null,
                        rescheduleOriginalStartAt: editingProposedMeeting.proposedOriginalStart ?? null,
                        rescheduleOriginalEndAt: editingProposedMeeting.proposedOriginalEnd ?? null,
                    }
                    : {}
                await updateProposedMeeting({
                    meetingId: payload.meetingId,
                    title: payload.title,
                    summary: payload.summary,
                    notes: payload.notes,
                    stationId: payload.stationId,
                    startTime: payload.startTime,
                    endTime: payload.endTime,
                    serviceType: payload.serviceType,
                    customerIds: payload.customerIds,
                    customerTypeIds: payload.customerTypeIds,
                    dogCategoryIds: payload.dogCategoryIds,
                    dogIds: payload.dogIds,
                    ...rescheduleMetadata,
                }).unwrap()
                toast({
                    title: "המפגש עודכן בהצלחה",
                    description: "ההזמנות והחלון נשמרו עם הערכים החדשים.",
                })
            } else {
                throw new Error("חסר מזהה מפגש לעריכה")
            }

            dispatch(setShowProposedMeetingModal(false))
            dispatch(setEditingProposedMeeting(null))
            dispatch(setProposedMeetingTimes(null))
            dispatch(setFinalizedDragTimes(null))
            await refetch()
        } catch (error) {
            console.error("❌ [ManagerSchedule] Failed to save proposed meeting:", error)
            toast({
                title: "שמירת המפגש נכשלה",
                description: error instanceof Error ? error.message : "לא ניתן לשמור את המפגש",
                variant: "destructive",
            })
        }
    }

    // Convert proposedMeetingTimes from Redux (ISO strings) to Date objects
    const defaultTimes: AppointmentTimes | null = proposedMeetingTimes ? {
        startTime: proposedMeetingTimes.startTime ? new Date(proposedMeetingTimes.startTime) : null,
        endTime: proposedMeetingTimes.endTime ? new Date(proposedMeetingTimes.endTime) : null,
        stationId: proposedMeetingTimes.stationId || null
    } : null

    // Build initial data from editingProposedMeeting
    const proposedModalInitialData = editingProposedMeeting ? {
        meetingId: editingProposedMeeting.proposedMeetingId || undefined,
        title: editingProposedMeeting.proposedTitle || editingProposedMeeting.notes || "",
        summary: editingProposedMeeting.proposedSummary || editingProposedMeeting.notes || "",
        notes: editingProposedMeeting.proposedNotes || editingProposedMeeting.internalNotes || "",
        stationId: editingProposedMeeting.stationId || "",
        serviceType: editingProposedMeeting.serviceType || "grooming",
        startDateTime: editingProposedMeeting.startDateTime || "",
        endDateTime: editingProposedMeeting.endDateTime || "",
        manualInvites: editingProposedMeeting.clientId ? [{
            id: editingProposedMeeting.clientId,
            fullName: editingProposedMeeting.clientName || null,
            phone: editingProposedMeeting.clientPhone || null,
            email: editingProposedMeeting.clientEmail || null,
            dogId: editingProposedMeeting.dogs && editingProposedMeeting.dogs.length > 0 
                ? editingProposedMeeting.dogs[0].id 
                : null,
        }] : undefined,
        customerTypeIds: [],
        dogCategoryIds: [],
    } : undefined

    return (
        <ProposedMeetingModal
            open={open}
            onOpenChange={handleOpenChange}
            mode={proposedMeetingMode}
            stations={stations.map((station: any) => ({
                id: station.id,
                name: station.name,
                serviceType: station.serviceType ?? "grooming",
            }))}
            defaultTimes={defaultTimes || undefined}
            initialData={proposedModalInitialData}
            loading={proposedMeetingMode === "create" ? creatingProposedMeeting : updatingProposedMeeting}
            onSubmit={handleSubmit}
        />
    )
}

