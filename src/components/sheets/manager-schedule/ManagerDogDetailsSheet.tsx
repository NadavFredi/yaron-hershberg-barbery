import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { DogDetailsSheet } from "@/pages/ManagerSchedule/sheets/DogDetailsSheet"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import {
    setIsDogDetailsOpen,
    setSelectedDog,
    setShowAllPastAppointments,
    setSelectedAppointment,
    setIsDetailsOpen,
    setSelectedDogForAppointments,
    setShowDogAppointmentsModal,
    setIsClientDetailsOpen,
    setSelectedClient
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment, ManagerDog } from "@/pages/ManagerSchedule/types"

interface ClientDetails {
    name: string
    classification?: string
    phone?: string
    email?: string
    recordId?: string
    recordNumber?: string
}

export function ManagerDogDetailsSheet() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.isDogDetailsOpen)
    const selectedDog = useAppSelector((state) => state.managerSchedule.selectedDog)
    const showAllPastAppointments = useAppSelector((state) => state.managerSchedule.showAllPastAppointments)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsDogDetailsOpen(value))
        if (!value) {
            dispatch(setSelectedDog(null))
        }
    }

    const handleClientClick = (client: ClientDetails) => {
        dispatch(setSelectedClient(client))
        dispatch(setIsDogDetailsOpen(false))
        dispatch(setSelectedDog(null))
        dispatch(setIsClientDetailsOpen(true))
    }

    const handleAppointmentClick = (appointment: ManagerAppointment) => {
        dispatch(setSelectedAppointment(appointment))
        dispatch(setIsDogDetailsOpen(false))
        dispatch(setIsDetailsOpen(true))
    }

    const handleShowDogAppointments = (dogId: string, dogName: string) => {
        dispatch(setSelectedDogForAppointments({ id: dogId, name: dogName }))
        dispatch(setShowDogAppointmentsModal(true))
    }

    return (
        <DogDetailsSheet
            open={open}
            onOpenChange={handleOpenChange}
            selectedDog={selectedDog}
            showAllPastAppointments={showAllPastAppointments}
            setShowAllPastAppointments={(value) => dispatch(setShowAllPastAppointments(value))}
            data={data}
            onClientClick={handleClientClick}
            onAppointmentClick={handleAppointmentClick}
            onShowDogAppointments={handleShowDogAppointments}
        />
    )
}

