import { StandaloneServiceTypeSelectionModal } from "./StandaloneServiceTypeSelectionModal"
import { StandaloneNewGardenAppointmentModal } from "./StandaloneNewGardenAppointmentModal"
import { StandaloneDogAppointmentsModal } from "./StandaloneDogAppointmentsModal"
import { StandalonePaymentModal } from "./StandalonePaymentModal"
import { StandaloneAppointmentTypeSelectionModal } from "./StandaloneAppointmentTypeSelectionModal"
import { StandalonePrivateAppointmentModal } from "./StandalonePrivateAppointmentModal"
import { StandaloneBusinessAppointmentModal } from "./StandaloneBusinessAppointmentModal"

export function AppointmentCreationModals() {
  return (
    <>
      <StandaloneServiceTypeSelectionModal />
      <StandaloneNewGardenAppointmentModal />
      <StandaloneDogAppointmentsModal />
      <StandalonePaymentModal />
      <StandaloneAppointmentTypeSelectionModal />
      <StandalonePrivateAppointmentModal />
      <StandaloneBusinessAppointmentModal />
    </>
  )
}

