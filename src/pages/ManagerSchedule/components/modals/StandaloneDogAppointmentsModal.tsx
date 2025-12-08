import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setIsDetailsOpen,
  setSelectedAppointment,
  setShowDogAppointmentsModal,
} from "@/store/slices/managerScheduleSlice"
import { DogAppointmentsModal } from "@/components/dialogs/manager-schedule/DogAppointmentsModal"
import type { ManagerAppointment } from "@/types/managerSchedule"

export function StandaloneDogAppointmentsModal() {
  const dispatch = useAppDispatch()

  const showDogAppointmentsModal = useAppSelector(
    (state) => state.managerSchedule.showDogAppointmentsModal
  )
  const selectedDogForAppointments = useAppSelector(
    (state) => state.managerSchedule.selectedDogForAppointments
  )

  if (!selectedDogForAppointments) {
    return null
  }

  return (
    <DogAppointmentsModal
      open={showDogAppointmentsModal}
      onOpenChange={(open) => dispatch(setShowDogAppointmentsModal(open))}
      dogId={selectedDogForAppointments.id}
      dogName={selectedDogForAppointments.name}
      onAppointmentClick={(appointment) => {
        dispatch(setSelectedAppointment(appointment as ManagerAppointment))
        dispatch(setShowDogAppointmentsModal(false))
        dispatch(setIsDetailsOpen(true))
      }}
    />
  )
}

