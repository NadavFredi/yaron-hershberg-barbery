import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setFinalizedDragTimes,
  setShowBusinessAppointmentModal,
} from "@/store/slices/managerScheduleSlice"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import { BusinessAppointmentModal } from "@/components/dialogs/manager-schedule/BusinessAppointmentModal"

export function StandaloneBusinessAppointmentModal() {
  const dispatch = useAppDispatch()

  const showBusinessAppointmentModal = useAppSelector(
    (state) => state.managerSchedule.showBusinessAppointmentModal
  )
  const finalizedDragTimes = useAppSelector(
    (state) => state.managerSchedule.finalizedDragTimes
  )
  const prefillBusinessCustomer = useAppSelector(
    (state) => state.managerSchedule.prefillBusinessCustomer
  )
  const prefillBusinessDog = useAppSelector(
    (state) => state.managerSchedule.prefillBusinessDog
  )
  const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)

  const { data, refetch } = useGetManagerScheduleQuery({
    date: format(new Date(selectedDate), "yyyy-MM-dd"),
    serviceType: "both",
  })

  const stations = data?.stations || []

  // Convert prefillBusinessCustomer to Customer type if needed
  const prefillCustomer = prefillBusinessCustomer ? {
    id: prefillBusinessCustomer.id,
    fullName: prefillBusinessCustomer.fullName || '',
    phone: prefillBusinessCustomer.phone || '',
    email: prefillBusinessCustomer.email || '',
  } : null

  // Convert prefillBusinessDog to Dog type if needed
  const prefillDog = prefillBusinessDog ? {
    id: prefillBusinessDog.id,
    name: prefillBusinessDog.name,
    breed: prefillBusinessDog.breed,
    isSmall: prefillBusinessDog.isSmall,
  } : null

  return (
    <BusinessAppointmentModal
      open={showBusinessAppointmentModal}
      onOpenChange={(open) => {
        dispatch(setShowBusinessAppointmentModal(open))
        if (!open) {
          dispatch(setFinalizedDragTimes(null))
        }
      }}
      finalizedDragTimes={finalizedDragTimes
        ? {
            startTime: finalizedDragTimes.startTime ? new Date(finalizedDragTimes.startTime) : null,
            endTime: finalizedDragTimes.endTime ? new Date(finalizedDragTimes.endTime) : null,
            stationId: finalizedDragTimes.stationId,
          }
        : null}
      stations={stations}
      prefillCustomer={prefillCustomer as any}
      prefillDog={prefillDog as any}
      onCancel={() => {
        dispatch(setShowBusinessAppointmentModal(false))
        dispatch(setFinalizedDragTimes(null))
      }}
      onSuccess={async () => {
        dispatch(setShowBusinessAppointmentModal(false))
        dispatch(setFinalizedDragTimes(null))
        await refetch()
      }}
    />
  )
}

