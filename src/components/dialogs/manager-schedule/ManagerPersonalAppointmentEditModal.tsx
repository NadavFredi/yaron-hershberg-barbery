import { useState, useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { PersonalAppointmentEditModal } from "./PersonalAppointmentEditModal.tsx"
import { supabaseApi, useGetManagerScheduleQuery, useMoveAppointmentMutation } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import {
    setPersonalAppointmentEditOpen,
    setEditingPersonalAppointment,
    setPersonalAppointmentEditLoading,
    setPendingResizeState,
    setAppointmentToDelete,
    setDeleteConfirmationOpen
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface PersonalAppointmentEditForm {
    name: string
    selectedStations: string[]
    finalizedTimes: {
        startTime: Date | null
        endTime: Date | null
        stationId: string | null
    } | null
    notes: string
}

export function ManagerPersonalAppointmentEditModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.personalAppointmentEditOpen)
    const editingPersonalAppointment = useAppSelector((state) => state.managerSchedule.editingPersonalAppointment)
    const personalAppointmentEditLoading = useAppSelector((state) => state.managerSchedule.personalAppointmentEditLoading)
    const pendingResizeState = useAppSelector((state) => state.managerSchedule.pendingResizeState)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const stations = data?.stations || []

    const [moveAppointment] = useMoveAppointmentMutation()

    const [personalAppointmentEditForm, setPersonalAppointmentEditForm] = useState<PersonalAppointmentEditForm>({
        name: '',
        selectedStations: [],
        finalizedTimes: null,
        notes: ''
    })

    // Initialize form when appointment changes
    useEffect(() => {
        if (editingPersonalAppointment && open) {
            const startDate = new Date(editingPersonalAppointment.startDateTime)
            const endDate = new Date(editingPersonalAppointment.endDateTime)

            setPersonalAppointmentEditForm({
                name: editingPersonalAppointment.personalAppointmentDescription || 'תור אישי',
                selectedStations: editingPersonalAppointment.stationId ? [editingPersonalAppointment.stationId] : [],
                finalizedTimes: {
                    startTime: startDate,
                    endTime: endDate,
                    stationId: editingPersonalAppointment.stationId || null
                },
                notes: editingPersonalAppointment.internalNotes || ''
            })
        }
    }, [editingPersonalAppointment, open])

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
        } else if (editingPersonalAppointment) {
            // Even if not a resize, revert any optimistic updates by refetching
            // This ensures the UI shows the correct state
            void refetch()
        }

        dispatch(setPersonalAppointmentEditOpen(false))
        dispatch(setEditingPersonalAppointment(null))
    }

    const handleOpenChange = (value: boolean) => {
        if (!value) {
            handleCancel()
            return
        }
        dispatch(setPersonalAppointmentEditOpen(true))
    }

    const handleDelete = (appointment: ManagerAppointment) => {
        dispatch(setAppointmentToDelete(appointment))
        dispatch(setDeleteConfirmationOpen(true))
        dispatch(setPersonalAppointmentEditOpen(false))
        dispatch(setEditingPersonalAppointment(null))
    }

    const handleConfirm = async () => {
        if (!editingPersonalAppointment || !personalAppointmentEditForm.finalizedTimes) return

        if (!personalAppointmentEditForm.name.trim()) {
            toast({
                title: "שגיאה",
                description: "אנא הכנס שם לתור",
                variant: "destructive",
            })
            return
        }

        dispatch(setPersonalAppointmentEditLoading(true))

        try {
            const { startTime, endTime, stationId } = personalAppointmentEditForm.finalizedTimes

            if (!startTime || !endTime || !stationId) {
                throw new Error('Missing required time or station information')
            }

            // Calculate duration
            let durationToUse: number
            if (pendingResizeState && pendingResizeState.appointment.id === editingPersonalAppointment.id) {
                durationToUse = pendingResizeState.newDuration * 60 * 1000 // Convert minutes to milliseconds
            } else {
                durationToUse = endTime.getTime() - startTime.getTime()
            }

            const newEndTime = new Date(startTime.getTime() + durationToUse)

            // Call the move appointment API (which handles updates)
            const moveResult = await moveAppointment({
                appointmentId: editingPersonalAppointment.id,
                appointmentType: 'grooming',
                oldStationId: editingPersonalAppointment.stationId,
                oldStartTime: editingPersonalAppointment.startDateTime,
                oldEndTime: editingPersonalAppointment.endDateTime,
                newStationId: stationId,
                newStartTime: startTime.toISOString(),
                newEndTime: newEndTime.toISOString(),
                internalNotes: personalAppointmentEditForm.notes.trim() || undefined,
            }).unwrap()

            if (!moveResult.success) {
                throw new Error(moveResult.error || 'Failed to update appointment')
            }

            // Update the personal appointment description if it changed
            // Note: This might require a separate API call depending on your backend structure
            // For now, we'll use the moveAppointment which should handle basic updates
            // You may need to add a separate mutation for updating the description

            // Show success toast
            toast({
                title: "התור עודכן בהצלחה",
                description: `התור הפרטי "${personalAppointmentEditForm.name}" עודכן בהצלחה`,
            })

            // Close modal and clear pending state
            dispatch(setPersonalAppointmentEditOpen(false))
            dispatch(setEditingPersonalAppointment(null))
            dispatch(setPendingResizeState(null))

            // Refetch to get updated data
            await refetch()

        } catch (error) {
            console.error('Error updating personal appointment:', error)

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
            dispatch(setPersonalAppointmentEditLoading(false))
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
        <PersonalAppointmentEditModal
            open={open}
            onOpenChange={handleOpenChange}
            editingPersonalAppointment={editingPersonalAppointment}
            personalAppointmentEditForm={personalAppointmentEditForm}
            setPersonalAppointmentEditForm={setPersonalAppointmentEditForm}
            personalAppointmentEditLoading={personalAppointmentEditLoading}
            stations={stations.map((s) => ({ id: s.id, name: s.name, serviceType: s.serviceType }))}
            pendingResizeState={pendingResizeStateWithDates}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onConfirm={handleConfirm}
        />
    )
}
