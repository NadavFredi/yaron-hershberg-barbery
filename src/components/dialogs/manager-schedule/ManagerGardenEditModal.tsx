import { useState, useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { GardenEditModal } from "./GardenEditModal"
import { supabaseApi, useGetManagerScheduleQuery, useMoveAppointmentMutation } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import { extractGardenAppointmentId } from "@/lib/utils"
import {
    setGardenEditOpen,
    setEditingGardenAppointment,
    setGardenEditLoading,
    setUpdateCustomerGarden,
    setAppointmentToDelete,
    setUpdateCustomer,
    setDeleteConfirmationOpen,
    setPendingResizeState
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface GardenEditForm {
    date: Date
    startTime: string
    endTime: string
    appointmentType: 'full-day' | 'hourly' | 'trial'
    notes: string
    internalNotes: string
    latePickupRequested: boolean
    latePickupNotes: string
    gardenTrimNails: boolean
    gardenBrush: boolean
    gardenBath: boolean
}

export function ManagerGardenEditModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.gardenEditOpen)
    const editingAppointment = useAppSelector((state) => state.managerSchedule.editingGardenAppointment)
    const updateCustomerGarden = useAppSelector((state) => state.managerSchedule.updateCustomerGarden)
    const gardenEditLoading = useAppSelector((state) => state.managerSchedule.gardenEditLoading)
    const pendingResizeState = useAppSelector((state) => state.managerSchedule.pendingResizeState)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data, refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const [moveAppointment] = useMoveAppointmentMutation()

    const [gardenEditForm, setGardenEditForm] = useState<GardenEditForm>({
        date: new Date(),
        startTime: '09:00',
        endTime: '10:00',
        appointmentType: 'hourly',
        notes: '',
        internalNotes: '',
        latePickupRequested: false,
        latePickupNotes: '',
        gardenTrimNails: false,
        gardenBrush: false,
        gardenBath: false,
    })

    // Initialize form when appointment changes
    useEffect(() => {
        if (editingAppointment && open) {
            const startDate = new Date(editingAppointment.startDateTime)
            const endDate = new Date(editingAppointment.endDateTime)
            
            // Determine appointment type: if gardenIsTrial is true, it's a trial (even though gardenAppointmentType is 'hourly')
            let appointmentType: 'full-day' | 'hourly' | 'trial' = 'hourly'
            if (editingAppointment.gardenIsTrial) {
                appointmentType = 'trial'
            } else if (editingAppointment.gardenAppointmentType === 'full-day') {
                appointmentType = 'full-day'
            } else {
                appointmentType = 'hourly'
            }
            
            setGardenEditForm({
                date: startDate,
                startTime: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
                endTime: `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`,
                appointmentType: appointmentType,
                notes: editingAppointment.notes || '',
                internalNotes: editingAppointment.internalNotes || '',
                latePickupRequested: editingAppointment.latePickupRequested || false,
                latePickupNotes: editingAppointment.latePickupNotes || '',
                gardenTrimNails: editingAppointment.gardenTrimNails || false,
                gardenBrush: editingAppointment.gardenBrush || false,
                gardenBath: editingAppointment.gardenBath || false,
            })
        }
    }, [editingAppointment, open])

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
        } else if (editingAppointment) {
            // Even if not a resize, revert any optimistic updates by refetching
            // This ensures the UI shows the correct state
            void refetch()
        }

        dispatch(setGardenEditOpen(false))
        dispatch(setEditingGardenAppointment(null))
    }

    const handleOpenChange = (value: boolean) => {
        if (!value) {
            handleCancel()
            return
        }
        dispatch(setGardenEditOpen(true))
    }

    const handleDelete = (appointment: ManagerAppointment) => {
        if (appointment.isProposedMeeting) {
            // Handle proposed meeting deletion separately if needed
            return
        }
        dispatch(setAppointmentToDelete(appointment))
        dispatch(setUpdateCustomer(false))
        dispatch(setDeleteConfirmationOpen(true))
        dispatch(setGardenEditOpen(false))
        dispatch(setEditingGardenAppointment(null))
    }

    const handleConfirm = async () => {
        if (!editingAppointment) return

        dispatch(setGardenEditLoading(true))

        try {
            // Extract the actual garden appointment ID if it's a combined appointment
            const actualGardenAppointmentId = extractGardenAppointmentId(
                editingAppointment.id,
                (editingAppointment as any).gardenAppointmentId
            )

            // Calculate new start and end times
            const [startHour, startMinute] = gardenEditForm.startTime.split(':').map(Number)
            const [endHour, endMinute] = gardenEditForm.endTime.split(':').map(Number)

            const newStartTime = new Date(
                gardenEditForm.date.getFullYear(),
                gardenEditForm.date.getMonth(),
                gardenEditForm.date.getDate(),
                startHour,
                startMinute
            )
            const newEndTime = new Date(
                gardenEditForm.date.getFullYear(),
                gardenEditForm.date.getMonth(),
                gardenEditForm.date.getDate(),
                endHour,
                endMinute
            )

            // Determine the target station and appointment type based on the selected type
            let targetStationId = 'garden-station'
            let targetStationName = 'גן הכלבים'
            let finalGardenAppointmentType: 'full-day' | 'hourly' = 'hourly'
            let finalGardenIsTrial = false

            switch (gardenEditForm.appointmentType) {
                case 'full-day':
                    targetStationId = 'garden-full-day'
                    targetStationName = 'גן - יום מלא'
                    finalGardenAppointmentType = 'full-day'
                    finalGardenIsTrial = false
                    break
                case 'trial':
                    targetStationId = 'garden-trial'
                    targetStationName = 'גן - ניסיון'
                    finalGardenAppointmentType = 'hourly'
                    finalGardenIsTrial = true
                    break
                case 'hourly':
                default:
                    targetStationId = 'garden-hourly'
                    targetStationName = 'גן - שעתי'
                    finalGardenAppointmentType = 'hourly'
                    finalGardenIsTrial = false
                    break
            }

            // Update the cache immediately
            if (data) {
                dispatch(
                    supabaseApi.util.updateQueryData(
                        'getManagerSchedule',
                        {
                            date: format(new Date(selectedDate), 'yyyy-MM-dd'),
                            serviceType: serviceFilter
                        },
                        (draft) => {
                            if (draft) {
                                const appointmentIndex = draft.appointments.findIndex(
                                    apt => apt.id === editingAppointment.id
                                )

                                if (appointmentIndex !== -1) {
                                    draft.appointments[appointmentIndex] = {
                                        ...draft.appointments[appointmentIndex],
                                        startDateTime: newStartTime.toISOString(),
                                        endDateTime: newEndTime.toISOString(),
                                        stationId: targetStationId,
                                        stationName: targetStationName,
                                        gardenAppointmentType: finalGardenAppointmentType,
                                        gardenIsTrial: finalGardenIsTrial,
                                        notes: gardenEditForm.notes,
                                        internalNotes: gardenEditForm.internalNotes,
                                        latePickupRequested: gardenEditForm.latePickupRequested,
                                        latePickupNotes: gardenEditForm.latePickupNotes,
                                        gardenTrimNails: gardenEditForm.gardenTrimNails,
                                        gardenBrush: gardenEditForm.gardenBrush,
                                        gardenBath: gardenEditForm.gardenBath,
                                    }
                                }
                            }
                        }
                    )
                )
            }

            await moveAppointment({
                appointmentId: actualGardenAppointmentId,
                newStationId: targetStationId,
                newStartTime: newStartTime.toISOString(),
                newEndTime: newEndTime.toISOString(),
                oldStationId: editingAppointment.stationId,
                oldStartTime: editingAppointment.startDateTime,
                oldEndTime: editingAppointment.endDateTime,
                appointmentType: 'garden',
                newGardenAppointmentType: finalGardenAppointmentType,
                newGardenIsTrial: finalGardenIsTrial,
                selectedHours: {
                    start: gardenEditForm.startTime,
                    end: gardenEditForm.endTime
                },
                gardenTrimNails: gardenEditForm.gardenTrimNails,
                gardenBrush: gardenEditForm.gardenBrush,
                gardenBath: gardenEditForm.gardenBath,
                latePickupRequested: gardenEditForm.latePickupRequested,
                latePickupNotes: gardenEditForm.latePickupNotes,
                internalNotes: gardenEditForm.internalNotes
            }).unwrap()

            // Close the modal after successful update
            dispatch(setGardenEditOpen(false))
            dispatch(setEditingGardenAppointment(null))

        } catch (error) {
            console.error('❌ Error updating garden appointment:', error)

            // Show user-friendly error message
            if (error && typeof error === 'object' && 'data' in error) {
                const apiError = error as { data?: { error?: string } }
                console.error('API Error details:', apiError.data)
                toast({
                    title: "שגיאה בעדכון התור",
                    description: apiError.data?.error || 'שגיאה לא ידועה',
                    variant: "destructive",
                })
            } else {
                console.error('Unexpected error:', error)
                toast({
                    title: "שגיאה בעדכון התור",
                    description: "אירעה שגיאה בעת עדכון התור. אנא נסה שוב.",
                    variant: "destructive",
                })
            }
        } finally {
            dispatch(setGardenEditLoading(false))
        }
    }

    return (
        <GardenEditModal
            open={open}
            onOpenChange={handleOpenChange}
            editingAppointment={editingAppointment}
            gardenEditForm={gardenEditForm}
            setGardenEditForm={setGardenEditForm}
            updateCustomerGarden={updateCustomerGarden}
            setUpdateCustomerGarden={(value) => dispatch(setUpdateCustomerGarden(value))}
            gardenEditLoading={gardenEditLoading}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onConfirm={handleConfirm}
        />
    )
}
