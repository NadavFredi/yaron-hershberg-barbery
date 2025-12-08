import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useEffect } from "react"
import {
  setFinalizedDragTimes,
  setPrivateAppointmentForm,
  setShowPrivateAppointmentModal,
} from "@/store/slices/managerScheduleSlice"
import { useCreateManagerAppointmentMutation, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { PrivateAppointmentModal } from "@/components/dialogs/manager-schedule/PrivateAppointmentModal"

export function StandalonePrivateAppointmentModal() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const showPrivateAppointmentModal = useAppSelector(
    (state) => state.managerSchedule.showPrivateAppointmentModal
  )
  const privateAppointmentForm = useAppSelector(
    (state) => state.managerSchedule.privateAppointmentForm
  )
  const finalizedDragTimes = useAppSelector(
    (state) => state.managerSchedule.finalizedDragTimes
  )
  const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)

  const { data, refetch } = useGetManagerScheduleQuery({
    date: format(new Date(selectedDate), "yyyy-MM-dd"),
    serviceType: "both",
  })

  const stations = data?.stations || []
  const [createManagerAppointment, { isLoading: createManagerAppointmentLoading }] =
    useCreateManagerAppointmentMutation()

  return (
    <PrivateAppointmentModal
      open={showPrivateAppointmentModal}
      onOpenChange={(open) => {
        dispatch(setShowPrivateAppointmentModal(open))
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
      privateAppointmentForm={privateAppointmentForm}
      setPrivateAppointmentForm={(form) => dispatch(setPrivateAppointmentForm(form))}
      createPrivateAppointmentLoading={createManagerAppointmentLoading}
      stations={stations}
      onCancel={() => {
        dispatch(setShowPrivateAppointmentModal(false))
        dispatch(setFinalizedDragTimes(null))
      }}
      onConfirm={async () => {
        if (!finalizedDragTimes || !privateAppointmentForm.name.trim()) {
          toast({
            title: "שגיאה",
            description: "אנא הכנס שם לתור",
            variant: "destructive",
          })
          return
        }

        try {
          const groupId = privateAppointmentForm.selectedStations.length > 1
            ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            : undefined

          await createManagerAppointment({
            name: privateAppointmentForm.name,
            stationId: finalizedDragTimes.stationId || '',
            selectedStations: privateAppointmentForm.selectedStations.length > 0
              ? privateAppointmentForm.selectedStations
              : (finalizedDragTimes.stationId ? [finalizedDragTimes.stationId] : []),
            startTime: finalizedDragTimes.startTime || '',
            endTime: finalizedDragTimes.endTime || '',
            groupId,
            appointmentType: "private",
            internalNotes: privateAppointmentForm.notes.trim() || undefined,
          }).unwrap()

          toast({
            title: "תור פרטי נוצר בהצלחה!",
            description: "התור הפרטי נוסף ללוח הזמנים",
          })

          dispatch(setShowPrivateAppointmentModal(false))
          dispatch(setFinalizedDragTimes(null))
          await refetch()
        } catch (error) {
          console.error('Error creating private appointment:', error)
          toast({
            title: "שגיאה ביצירת התור הפרטי",
            description: "אירעה שגיאה בעת יצירת התור הפרטי",
            variant: "destructive",
          })
        }
      }}
      onUpdateTimes={(times) => {
        if (times.startTime && times.endTime && times.stationId) {
          dispatch(setFinalizedDragTimes({
            startTime: times.startTime.toISOString(),
            endTime: times.endTime.toISOString(),
            stationId: times.stationId
          }))
        }
      }}
    />
  )
}

