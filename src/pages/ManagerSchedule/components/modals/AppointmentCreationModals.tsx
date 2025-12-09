import { StandaloneServiceTypeSelectionModal } from "./StandaloneServiceTypeSelectionModal"
import { StandalonePaymentModal } from "./StandalonePaymentModal"
import { StandaloneAppointmentTypeSelectionModal } from "./StandaloneAppointmentTypeSelectionModal"
import { StandalonePrivateAppointmentModal } from "./StandalonePrivateAppointmentModal"
import { StandaloneBusinessAppointmentModal } from "./StandaloneBusinessAppointmentModal"

export function AppointmentCreationModals() {
  return (
    <>
      <StandaloneServiceTypeSelectionModal />
      <StandalonePaymentModal />
      <StandaloneAppointmentTypeSelectionModal />
      <StandalonePrivateAppointmentModal />
      <StandaloneBusinessAppointmentModal />
    </>
  )
}

