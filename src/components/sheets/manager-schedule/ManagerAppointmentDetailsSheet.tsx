import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { AppointmentDetailsSheet } from "@/pages/ManagerSchedule/sheets/AppointmentDetailsSheet"
import { ProposedMeetingSheet } from "@/pages/ManagerSchedule/sheets/ProposedMeetingSheet"
import { useToast } from "@/hooks/use-toast"
import { supabaseApi, useGetManagerScheduleQuery, useSendProposedMeetingWebhookMutation } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import { supabase } from "@/integrations/supabase/client"
import { MANYCHAT_FLOW_IDS } from "@/lib/manychat"
import {
    setIsDetailsOpen,
    setSelectedAppointment,
    setGardenEditOpen,
    setEditingGardenAppointment,
    setGroomingEditOpen,
    setEditingGroomingAppointment,
    setAppointmentToDelete,
    setUpdateCustomer,
    setDeleteConfirmationOpen,
    setAppointmentToCancel,
    setUpdateCustomerCancel,
    setCancelConfirmationOpen,
    setProposedMeetingToDelete,
    setShowDeleteProposedDialog,
    setProposedMeetingMode,
    setEditingProposedMeeting,
    setProposedMeetingTimes,
    setShowProposedMeetingModal,
    setSendingInviteId,
    setSendingAllInvites,
    setSendingCategoryId,
    setSendingCategoriesBatch,
    setSelectedDog,
    setShowAllPastAppointments,
    setIsDogDetailsOpen,
    setSelectedClient,
    setIsClientDetailsOpen,
    setSelectedDogForAppointments,
    setShowDogAppointmentsModal,
    setCustomerCommunicationAppointment,
    setShowCustomerCommunicationModal
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment, ManagerDog } from "@/pages/ManagerSchedule/types"
import type { ProposedMeetingInvite } from "@/pages/ManagerSchedule/sheets/ProposedMeetingSheet"

interface ClientDetails {
    name: string
    classification?: string
    phone?: string
    email?: string
    recordId?: string
    recordNumber?: string
    clientId?: string
    id?: string
}

export function ManagerAppointmentDetailsSheet() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.isDetailsOpen)
    const selectedAppointment = useAppSelector((state) => state.managerSchedule.selectedAppointment)
    const isLoadingAppointment = useAppSelector((state) => state.managerSchedule.isLoadingAppointment)
    const sendingInviteId = useAppSelector((state) => state.managerSchedule.sendingInviteId)
    const sendingAllInvites = useAppSelector((state) => state.managerSchedule.sendingAllInvites)
    const sendingCategoryId = useAppSelector((state) => state.managerSchedule.sendingCategoryId)
    const sendingCategoriesBatch = useAppSelector((state) => state.managerSchedule.sendingCategoriesBatch)
    const isDeletingProposed = useAppSelector((state) => state.managerSchedule.isDeletingProposed)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const [sendProposedMeetingWebhook] = useSendProposedMeetingWebhookMutation()

    // Helper function to trigger ManyChat flow for proposed meeting invites
    const triggerManyChatFlow = async (invites: ProposedMeetingInvite[]) => {
        if (!invites.length) return

        const flowId = MANYCHAT_FLOW_IDS.PROPOSE_NEW_TIME
        if (!flowId) {
            console.warn("⚠️ [ManagerAppointmentDetailsSheet] PROPOSE_NEW_TIME flow ID not found")
            return
        }

        // Filter invites that have phone numbers
        const invitesWithPhones = invites.filter(
            (invite) => invite.clientPhone && invite.clientPhone.trim().length > 0
        )

        if (!invitesWithPhones.length) {
            console.log("ℹ️ [ManagerAppointmentDetailsSheet] No invites with phone numbers to send ManyChat flow")
            return
        }

        // Prepare users array for ManyChat
        const users = invitesWithPhones.map((invite) => ({
            phone: invite.clientPhone!,
            name: invite.customerName || "לקוח",
            fields: {},
        }))

        try {
            console.log(`📤 [ManagerAppointmentDetailsSheet] Sending PROPOSE_NEW_TIME flow to ${users.length} recipient(s)`)
            const { data, error } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                body: {
                    users,
                    flow_id: flowId,
                },
            })

            if (error) {
                console.error("❌ [ManagerAppointmentDetailsSheet] Error calling ManyChat function:", error)
                // Don't throw - we don't want to fail the whole operation if ManyChat fails
                return
            }

            const results = data as Record<string, { success: boolean; error?: string }>
            const successCount = Object.values(results).filter((r) => r.success).length
            const failureCount = Object.values(results).filter((r) => !r.success).length

            console.log(
                `✅ [ManagerAppointmentDetailsSheet] ManyChat flow sent to ${successCount} recipient(s), ${failureCount} failed`
            )
        } catch (error) {
            console.error("❌ [ManagerAppointmentDetailsSheet] Exception calling ManyChat function:", error)
            // Don't throw - we don't want to fail the whole operation if ManyChat fails
        }
    }

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsDetailsOpen(value))
        if (!value) {
            dispatch(setSelectedAppointment(null))
        }
    }

    const handleDogClick = (dog: ManagerDog) => {
        dispatch(setSelectedDog({
            id: dog.id,
            name: dog.name,
            breed: dog.breed,
            clientClassification: dog.clientClassification,
            owner: dog.clientName ? {
                name: dog.clientName,
                classification: dog.clientClassification,
            } : undefined,
            gender: dog.gender,
            notes: dog.notes,
            medicalNotes: dog.medicalNotes,
            importantNotes: dog.importantNotes,
            internalNotes: dog.internalNotes,
            vetName: dog.vetName,
            vetPhone: dog.vetPhone,
            healthIssues: dog.healthIssues,
            birthDate: dog.birthDate,
            tendsToBite: dog.tendsToBite,
            aggressiveWithOtherDogs: dog.aggressiveWithOtherDogs,
            hasBeenToGarden: dog.hasBeenToGarden,
            suitableForGardenFromQuestionnaire: dog.suitableForGardenFromQuestionnaire,
            notSuitableForGardenFromQuestionnaire: dog.notSuitableForGardenFromQuestionnaire,
            recordId: dog.recordId,
            recordNumber: dog.recordNumber,
        }))
        dispatch(setShowAllPastAppointments(false))
        dispatch(setIsDetailsOpen(false))
        dispatch(setSelectedAppointment(null))
        dispatch(setIsDogDetailsOpen(true))
    }

    const handleClientClick = (client: ClientDetails) => {
        // Open client sheet when clicking on client name directly
        dispatch(setSelectedClient({
            name: client.name,
            classification: client.classification,
            phone: client.phone,
            email: client.email,
            recordId: client.recordId,
            recordNumber: client.recordNumber,
            clientId: client.clientId || client.id,
        }))
        dispatch(setIsClientDetailsOpen(true))
    }

    const handleShowDogAppointments = (dogId: string, dogName: string) => {
        dispatch(setSelectedDogForAppointments({ id: dogId, name: dogName }))
        dispatch(setShowDogAppointmentsModal(true))
    }

    const handleEditAppointment = (appointment: ManagerAppointment) => {
        if (appointment.serviceType === "garden") {
            dispatch(setEditingGardenAppointment(appointment))
            dispatch(setGardenEditOpen(true))
        } else {
            dispatch(setEditingGroomingAppointment(appointment))
            dispatch(setGroomingEditOpen(true))
        }
    }

    const handleCancelAppointment = (appointment: ManagerAppointment) => {
        if (appointment.isProposedMeeting) {
            return
        }
        dispatch(setAppointmentToCancel(appointment))
        dispatch(setUpdateCustomerCancel(false))
        dispatch(setCancelConfirmationOpen(true))
        dispatch(setGardenEditOpen(false))
        dispatch(setGroomingEditOpen(false))
        dispatch(setEditingGardenAppointment(null))
        dispatch(setEditingGroomingAppointment(null))
    }

    const handleDeleteAppointment = (appointment: ManagerAppointment) => {
        if (appointment.isProposedMeeting) {
            handleDeleteProposedMeeting(appointment)
            return
        }
        dispatch(setAppointmentToDelete(appointment))
        dispatch(setUpdateCustomer(false))
        dispatch(setDeleteConfirmationOpen(true))
        dispatch(setGardenEditOpen(false))
        dispatch(setGroomingEditOpen(false))
        dispatch(setEditingGardenAppointment(null))
        dispatch(setEditingGroomingAppointment(null))
    }

    const handleOpenProposedMeetingEditor = (
        appointment: ManagerAppointment,
        overrides?: { startTime?: Date; endTime?: Date; stationId?: string }
    ) => {
        if (!appointment.proposedMeetingId) {
            return
        }

        const startTime = overrides?.startTime ?? new Date(appointment.startDateTime)
        const endTime = overrides?.endTime ?? new Date(appointment.endDateTime)
        const stationId = overrides?.stationId ?? appointment.stationId

        dispatch(setProposedMeetingMode("edit"))
        dispatch(setEditingProposedMeeting({
            ...appointment,
            startDateTime: startTime.toISOString(),
            endDateTime: endTime.toISOString(),
            stationId,
        }))
        dispatch(setProposedMeetingTimes({
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            stationId,
        }))
        dispatch(setShowProposedMeetingModal(true))
    }

    const handleDeleteProposedMeeting = (appointment: ManagerAppointment) => {
        if (!appointment.proposedMeetingId) {
            return
        }
        dispatch(setProposedMeetingToDelete(appointment))
        dispatch(setShowDeleteProposedDialog(true))
    }

    const handleSendSingleProposedInvite = async (
        invite: ProposedMeetingInvite,
        meeting: ManagerAppointment
    ) => {
        if (!invite.customerId || !meeting.proposedMeetingId) {
            return
        }
        dispatch(setSendingInviteId(invite.id))
        try {
            await sendProposedMeetingWebhook({
                inviteId: invite.id,
                customerId: invite.customerId,
                proposedMeetingId: meeting.proposedMeetingId,
                notificationCount: invite.notificationCount ?? 0,
            }).unwrap()
            
            // Trigger ManyChat flow
            await triggerManyChatFlow([invite])
            
            toast({
                title: "ההזמנה נשלחה",
                description: invite.customerName ? `נשלח קוד ל-${invite.customerName}` : "ההודעה נשלחה בהצלחה",
            })
            await refetch()
        } catch (error) {
            console.error("❌ [ManagerSchedule] Failed to send invite webhook:", error)
            toast({
                title: "השליחה נכשלה",
                description: error instanceof Error ? error.message : "נסו שוב בעוד מספר רגעים.",
                variant: "destructive",
            })
        } finally {
            dispatch(setSendingInviteId(null))
        }
    }

    const getCategoryInvites = (
        meeting: ManagerAppointment,
        categoryId?: string
    ): ProposedMeetingInvite[] => {
        return (
            meeting.proposedInvites?.filter(
                (invite) =>
                    invite.source === "category" &&
                    invite.customerId &&
                    (categoryId ? invite.sourceCategoryId === categoryId : Boolean(invite.sourceCategoryId))
            ) ?? []
        )
    }

    const handleSendAllProposedInvites = async (meeting: ManagerAppointment) => {
        if (!meeting.proposedMeetingId || !(meeting.proposedInvites?.length)) {
            return
        }
        dispatch(setSendingAllInvites(true))
        try {
            for (const invite of meeting.proposedInvites) {
                if (!invite.customerId) continue
                await sendProposedMeetingWebhook({
                    inviteId: invite.id,
                    customerId: invite.customerId,
                    proposedMeetingId: meeting.proposedMeetingId,
                    notificationCount: invite.notificationCount ?? 0,
                }).unwrap()
            }
            
            // Trigger ManyChat flow for all invites
            await triggerManyChatFlow(meeting.proposedInvites || [])
            
            toast({
                title: "ההודעות נשלחו",
                description: "כל הלקוחות קיבלו קישור עם קוד הגישה.",
            })
            await refetch()
        } catch (error) {
            console.error("❌ [ManagerSchedule] Failed to send invites batch:", error)
            toast({
                title: "שליחת ההודעות נכשלה",
                description: error instanceof Error ? error.message : "חלק מההזמנות לא נשלחו",
                variant: "destructive",
            })
        } finally {
            dispatch(setSendingAllInvites(false))
            dispatch(setSendingInviteId(null))
        }
    }

    const handleSendCategoryInvites = async (meeting: ManagerAppointment, categoryId: string) => {
        if (!meeting.proposedMeetingId) return
        const invites = getCategoryInvites(meeting, categoryId)
        if (!invites.length) return

        dispatch(setSendingCategoryId(categoryId))
        try {
            for (const invite of invites) {
                await sendProposedMeetingWebhook({
                    inviteId: invite.id,
                    customerId: invite.customerId!,
                    proposedMeetingId: meeting.proposedMeetingId,
                    notificationCount: invite.notificationCount ?? 0,
                }).unwrap()
            }
            
            // Trigger ManyChat flow for category invites
            await triggerManyChatFlow(invites)
            
            toast({
                title: "ההודעות נשלחו",
                description: `הקטגוריה נשלחה ל-${invites.length} לקוחות.`,
            })
            await refetch()
        } catch (error) {
            console.error("❌ [ManagerSchedule] Failed to send category invites:", error)
            toast({
                title: "שליחת ההודעות נכשלה",
                description: error instanceof Error ? error.message : "חלק מההזמנות לא נשלחו",
                variant: "destructive",
            })
        } finally {
            dispatch(setSendingCategoryId(null))
        }
    }

    const handleSendAllCategoryInvites = async (meeting: ManagerAppointment) => {
        if (!meeting.proposedMeetingId) return
        const invites = getCategoryInvites(meeting)
        if (!invites.length) return

        dispatch(setSendingCategoriesBatch(true))
        try {
            for (const invite of invites) {
                await sendProposedMeetingWebhook({
                    inviteId: invite.id,
                    customerId: invite.customerId!,
                    proposedMeetingId: meeting.proposedMeetingId,
                    notificationCount: invite.notificationCount ?? 0,
                }).unwrap()
            }
            
            // Trigger ManyChat flow for all category invites
            await triggerManyChatFlow(invites)
            
            toast({
                title: "ההודעות נשלחו",
                description: `כל הקטגוריות נשלחו ל-${invites.length} לקוחות.`,
            })
            await refetch()
        } catch (error) {
            console.error("❌ [ManagerSchedule] Failed to send all category invites:", error)
            toast({
                title: "שליחת ההודעות נכשלה",
                description: error instanceof Error ? error.message : "חלק מההזמנות לא נשלחו",
                variant: "destructive",
            })
        } finally {
            dispatch(setSendingCategoriesBatch(false))
        }
    }

    if (!selectedAppointment) {
        return null
    }

    if (selectedAppointment.isProposedMeeting) {
        return (
            <ProposedMeetingSheet
                open={open}
                onOpenChange={handleOpenChange}
                meeting={selectedAppointment}
                onEdit={handleOpenProposedMeetingEditor}
                onDelete={handleDeleteProposedMeeting}
                onSendInvite={(invite) => handleSendSingleProposedInvite(invite, selectedAppointment)}
                onSendAll={handleSendAllProposedInvites}
                onSendCategory={(categoryId) => handleSendCategoryInvites(selectedAppointment, categoryId)}
                onSendAllCategories={() => handleSendAllCategoryInvites(selectedAppointment)}
                sendingInviteId={sendingInviteId}
                sendingAll={sendingAllInvites}
                sendingCategoryId={sendingCategoryId}
                sendingCategoriesBatch={sendingCategoriesBatch}
                deleting={isDeletingProposed}
            />
        )
    }

    return (
        <AppointmentDetailsSheet
            open={open}
            onOpenChange={handleOpenChange}
            selectedAppointment={selectedAppointment}
            onDogClick={handleDogClick}
            onClientClick={handleClientClick}
            onEditAppointment={handleEditAppointment}
            onCancelAppointment={handleCancelAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            isLoading={isLoadingAppointment}
        />
    )
}

