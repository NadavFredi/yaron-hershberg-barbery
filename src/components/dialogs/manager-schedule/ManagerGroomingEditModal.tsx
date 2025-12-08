import { useState, useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { GroomingEditModal } from "./GroomingEditModal"
import { supabaseApi, useGetManagerScheduleQuery, useMoveAppointmentMutation } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import {
    setGroomingEditOpen,
    setEditingGroomingAppointment,
    setGroomingEditLoading,
    setUpdateCustomerGrooming,
    setPendingResizeState,
    setAppointmentToDelete,
    setUpdateCustomer,
    setDeleteConfirmationOpen
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface GroomingEditForm {
    date: Date
    startTime: string
    stationId: string
    notes: string
    internalNotes: string
    groomingNotes: string
}

export function ManagerGroomingEditModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.groomingEditOpen)
    const editingGroomingAppointment = useAppSelector((state) => state.managerSchedule.editingGroomingAppointment)
    const updateCustomerGrooming = useAppSelector((state) => state.managerSchedule.updateCustomerGrooming)
    const groomingEditLoading = useAppSelector((state) => state.managerSchedule.groomingEditLoading)
    const pendingResizeState = useAppSelector((state) => state.managerSchedule.pendingResizeState)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const stations = data?.stations || []

    const [moveAppointment] = useMoveAppointmentMutation()

    const [groomingEditForm, setGroomingEditForm] = useState<GroomingEditForm>({
        date: new Date(),
        startTime: '',
        stationId: '',
        notes: '',
        internalNotes: '',
        groomingNotes: ''
    })

    // Initialize form when appointment changes
    useEffect(() => {
        if (editingGroomingAppointment && open) {
            const startDate = new Date(editingGroomingAppointment.startDateTime)
            setGroomingEditForm({
                date: startDate,
                startTime: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
                stationId: editingGroomingAppointment.stationId,
                notes: editingGroomingAppointment.notes || '',
                internalNotes: editingGroomingAppointment.internalNotes || '',
                groomingNotes: (editingGroomingAppointment as any).groomingNotes || '',
            })
        }
    }, [editingGroomingAppointment, open])

    const handleCancel = () => {
        // If this was a resize operation, revert the changes
        if (pendingResizeState) {
            // Revert the frontend changes by updating the cache
            dispatch(
                supabaseApi.util.updateQueryData(
                    'getManagerSchedule',
                    {
                        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
                        serviceType: serviceFilter
                    },
                    (draft) => {
                        if (!draft) return
                        const appointmentIndex = draft.appointments.findIndex(
                            (apt) => apt.id === pendingResizeState.appointment.id
                        )
                        if (appointmentIndex === -1) return

                        // Revert to the original appointment state before resize
                        // Use the original appointment as the base and only update the endDateTime/duration
                        const originalAppointment = pendingResizeState.appointment
                        draft.appointments[appointmentIndex] = {
                            ...originalAppointment,
                            endDateTime: pendingResizeState.originalEndTime,
                            durationMinutes: pendingResizeState.originalDuration,
                        }
                    }
                )
            )

            dispatch(setPendingResizeState(null))
        }

        dispatch(setGroomingEditOpen(false))
        dispatch(setEditingGroomingAppointment(null))
    }

    const handleOpenChange = (value: boolean) => {
        if (!value) {
            handleCancel()
            return
        }
        dispatch(setGroomingEditOpen(true))
    }

    const handleDelete = (appointment: ManagerAppointment) => {
        if (appointment.isProposedMeeting) {
            // Handle proposed meeting deletion separately if needed
            return
        }
        dispatch(setAppointmentToDelete(appointment))
        dispatch(setUpdateCustomer(false))
        dispatch(setDeleteConfirmationOpen(true))
        dispatch(setGroomingEditOpen(false))
        dispatch(setEditingGroomingAppointment(null))
    }

    const handleConfirm = async () => {
        if (!editingGroomingAppointment) return

        dispatch(setGroomingEditLoading(true))

        try {
            // Calculate new start and end times
            const [startHour, startMinute] = groomingEditForm.startTime.split(':').map(Number)

            // If this is a resize operation, use the new duration from pendingResizeState
            let durationToUse: number
            if (pendingResizeState && pendingResizeState.appointment.id === editingGroomingAppointment.id) {
                durationToUse = pendingResizeState.newDuration * 60 * 1000 // Convert minutes to milliseconds
            } else {
                durationToUse = new Date(editingGroomingAppointment.endDateTime).getTime() - new Date(editingGroomingAppointment.startDateTime).getTime()
            }

            const newStartTime = new Date(
                groomingEditForm.date.getFullYear(),
                groomingEditForm.date.getMonth(),
                groomingEditForm.date.getDate(),
                startHour,
                startMinute
            )
            const newEndTime = new Date(newStartTime.getTime() + durationToUse)

            // Call the move appointment API (which handles updates)
            const moveResult = await moveAppointment({
                appointmentId: editingGroomingAppointment.id,
                appointmentType: 'grooming',
                oldStationId: editingGroomingAppointment.stationId,
                oldStartTime: editingGroomingAppointment.startDateTime,
                oldEndTime: editingGroomingAppointment.endDateTime,
                newStationId: groomingEditForm.stationId,
                newStartTime: newStartTime.toISOString(),
                newEndTime: newEndTime.toISOString(),
                internalNotes: groomingEditForm.internalNotes,
                customerNotes: groomingEditForm.notes,
                groomingNotes: groomingEditForm.groomingNotes
            }).unwrap()

            if (!moveResult.success) {
                throw new Error(moveResult.error || 'Failed to update appointment')
            }

            // Show success toast
            toast({
                title: "התור עודכן בהצלחה",
                description: `התור של ${editingGroomingAppointment.dogs[0]?.name || 'הכלב'} עודכן בהצלחה`,
            })

            // Close modal and clear pending state
            dispatch(setGroomingEditOpen(false))
            dispatch(setEditingGroomingAppointment(null))
            dispatch(setPendingResizeState(null))

        } catch (error) {
            console.error('Error updating grooming appointment:', error)

            // If this was a resize operation, revert the optimistic update
            if (pendingResizeState) {
                dispatch(
                    supabaseApi.util.updateQueryData(
                        'getManagerSchedule',
                        {
                            date: format(new Date(selectedDate), 'yyyy-MM-dd'),
                            serviceType: serviceFilter
                        },
                        (draft) => {
                            if (!draft) return
                            const appointmentIndex = draft.appointments.findIndex(
                                (apt) => apt.id === pendingResizeState.appointment.id
                            )
                            if (appointmentIndex === -1) return

                            draft.appointments[appointmentIndex] = {
                                ...draft.appointments[appointmentIndex],
                                endDateTime: pendingResizeState.originalEndTime,
                                durationMinutes: pendingResizeState.originalDuration,
                            }
                        }
                    )
                )
            }

            toast({
                title: "שגיאה בעדכון התור",
                description: error instanceof Error ? error.message : "אירעה שגיאה בעת עדכון התור",
                variant: "destructive",
            })
        } finally {
            dispatch(setGroomingEditLoading(false))
        }
    }

    // Convert pendingResizeState from Redux (ISO strings) to Date objects
    const pendingResizeStateWithDates = pendingResizeState ? {
        appointment: pendingResizeState.appointment,
        originalEndTime: new Date(pendingResizeState.originalEndTime),
        newEndTime: new Date(pendingResizeState.newEndTime),
        originalDuration: pendingResizeState.originalDuration,
        newDuration: pendingResizeState.newDuration,
    } : null

    return (
        <GroomingEditModal
            open={open}
            onOpenChange={handleOpenChange}
            editingGroomingAppointment={editingGroomingAppointment}
            groomingEditForm={groomingEditForm}
            setGroomingEditForm={setGroomingEditForm}
            updateCustomerGrooming={updateCustomerGrooming}
            setUpdateCustomerGrooming={(value) => dispatch(setUpdateCustomerGrooming(value))}
            groomingEditLoading={groomingEditLoading}
            stations={stations.map((s: any) => ({ id: s.id, name: s.name }))}
            pendingResizeState={pendingResizeStateWithDates}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onConfirm={handleConfirm}
        />
    )
}
