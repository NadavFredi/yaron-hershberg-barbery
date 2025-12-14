import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { ClientDetailsSheet } from "@/pages/ManagerSchedule/sheets/ClientDetailsSheet"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import {
    setIsClientDetailsOpen,
    setSelectedClient,
    setSelectedDog,
    setIsDogDetailsOpen,
    setShowAllPastAppointments
} from "@/store/slices/managerScheduleSlice"
import type { ManagerDog } from "@/pages/ManagerSchedule/types"

export function ManagerClientDetailsSheet() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.isClientDetailsOpen)
    const selectedClient = useAppSelector((state) => state.managerSchedule.selectedClient)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsClientDetailsOpen(value))
        if (!value) {
            dispatch(setSelectedClient(null))
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
        dispatch(setIsClientDetailsOpen(false))
        dispatch(setSelectedClient(null))
        dispatch(setIsDogDetailsOpen(true))
    }

    return (
        <ClientDetailsSheet
            open={open}
            onOpenChange={handleOpenChange}
            selectedClient={selectedClient}
            data={data}
            onDogClick={handleDogClick}
        />
    )
}

