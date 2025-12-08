import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setIsConstraintDialogOpen,
  setProposedMeetingMode,
  setProposedMeetingTimes,
  setShowAppointmentTypeSelection,
  setShowBusinessAppointmentModal,
  setShowProposedMeetingModal,
  setFinalizedDragTimes,
  setEditingConstraint,
  setEditingConstraintDefaultTimes,
  setEditingConstraintStationIds,
  setShowPrivateAppointmentModal,
} from "@/store/slices/managerScheduleSlice"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import { AppointmentTypeSelectionModal } from "@/components/dialogs/manager-schedule/AppointmentTypeSelectionModal"

export function StandaloneAppointmentTypeSelectionModal() {
  const dispatch = useAppDispatch()

  const showAppointmentTypeSelection = useAppSelector(
    (state) => state.managerSchedule.showAppointmentTypeSelection
  )
  const finalizedDragTimes = useAppSelector(
    (state) => state.managerSchedule.finalizedDragTimes
  )
  const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)

  const { data } = useGetManagerScheduleQuery({
    date: format(new Date(selectedDate), "yyyy-MM-dd"),
    serviceType: "both",
  })

  const stations = data?.stations || []

  return (
    <AppointmentTypeSelectionModal
      open={showAppointmentTypeSelection}
      onOpenChange={(open) => dispatch(setShowAppointmentTypeSelection(open))}
      finalizedDragTimes={finalizedDragTimes
        ? {
            startTime: finalizedDragTimes.startTime ? new Date(finalizedDragTimes.startTime) : null,
            endTime: finalizedDragTimes.endTime ? new Date(finalizedDragTimes.endTime) : null,
            stationId: finalizedDragTimes.stationId,
          }
        : null}
      stations={stations}
      onSelectPrivate={() => {
        dispatch(setShowAppointmentTypeSelection(false))
        dispatch(setShowPrivateAppointmentModal(true))
      }}
      onSelectBusiness={() => {
        dispatch(setShowAppointmentTypeSelection(false))
        dispatch(setShowBusinessAppointmentModal(true))
      }}
      onSelectProposed={() => {
        if (!finalizedDragTimes) return
        dispatch(setProposedMeetingMode("create"))
        dispatch(setProposedMeetingTimes(finalizedDragTimes))
        dispatch(setShowAppointmentTypeSelection(false))
        dispatch(setShowProposedMeetingModal(true))
      }}
      onSelectConstraint={() => {
        if (!finalizedDragTimes || !finalizedDragTimes.startTime || !finalizedDragTimes.endTime || !finalizedDragTimes.stationId) return

        const startTime = finalizedDragTimes.startTime instanceof Date
          ? finalizedDragTimes.startTime
          : new Date(finalizedDragTimes.startTime)
        const endTime = finalizedDragTimes.endTime instanceof Date
          ? finalizedDragTimes.endTime
          : new Date(finalizedDragTimes.endTime)

        dispatch(setEditingConstraint(null))
        dispatch(setEditingConstraintStationIds([finalizedDragTimes.stationId]))
        dispatch(setEditingConstraintDefaultTimes({
          startDate: startTime.toISOString(),
          endDate: endTime.toISOString(),
          startTime: `${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}`,
          endTime: `${String(endTime.getHours()).padStart(2, "0")}:${String(endTime.getMinutes()).padStart(2, "0")}`,
        }))

        dispatch(setShowAppointmentTypeSelection(false))
        dispatch(setIsConstraintDialogOpen(true))
        dispatch(setFinalizedDragTimes(null))
      }}
      onCancel={() => {
        dispatch(setShowAppointmentTypeSelection(false))
      }}
    />
  )
}

