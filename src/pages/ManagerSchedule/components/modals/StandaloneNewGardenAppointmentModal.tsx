import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { format } from "date-fns"
import {
  setNewGardenAppointmentModalOpen,
  setNewGardenAppointmentType,
  setSelectedAppointment,
} from "@/store/slices/managerScheduleSlice"
import { useCreateManagerAppointmentMutation, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { useToast } from "@/hooks/use-toast"
import { NewGardenAppointmentModal } from "@/components/dialogs/manager-schedule/NewGardenAppointmentModal"
import type { ManagerAppointment } from "@/types/managerSchedule"

export function StandaloneNewGardenAppointmentModal() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const newGardenAppointmentModalOpen = useAppSelector(
    (state) => state.managerSchedule.newGardenAppointmentModalOpen
  )
  const newGardenAppointmentType = useAppSelector(
    (state) => state.managerSchedule.newGardenAppointmentType
  )
  const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDateObj = new Date(selectedDate)

  const { data, refetch } = useGetManagerScheduleQuery({
    date: format(selectedDateObj, "yyyy-MM-dd"),
    serviceType: "both",
  })

  const stations = data?.stations || []
  const [createManagerAppointment, { isLoading: createManagerAppointmentLoading }] =
    useCreateManagerAppointmentMutation()

  return (
    <NewGardenAppointmentModal
      open={newGardenAppointmentModalOpen}
      onOpenChange={(open) => dispatch(setNewGardenAppointmentModalOpen(open))}
      appointmentType={newGardenAppointmentType}
      loading={createManagerAppointmentLoading}
      defaultDate={selectedDateObj}
      onConfirm={async (appointmentData) => {
        try {
          const dateStr = appointmentData.date?.toISOString().split("T")[0]
          const startDateTime = `${dateStr}T${appointmentData.startTime}:00`
          const endDateTime = `${dateStr}T${appointmentData.endTime}:00`

          const gardenStations = stations.filter((s) => s.serviceType === "garden")
          let stationId: string | undefined
          if (gardenStations.length > 0) {
            const smallDogStation = gardenStations.find((s: any) =>
              s.name?.toLowerCase().includes("קטן") || s.name?.toLowerCase().includes("small")
            )
            const regularStation = gardenStations.find(
              (s: any) =>
                !s.name?.toLowerCase().includes("קטן") &&
                !s.name?.toLowerCase().includes("small")
            )

            if (appointmentData.dog?.isSmall === true && smallDogStation) {
              stationId = smallDogStation.id
            } else if (regularStation) {
              stationId = regularStation.id
            } else {
              stationId = gardenStations[0].id
            }
          }

          if (!stationId) {
            throw new Error("לא נמצאה עמדה זמינה לגן")
          }

          const result = await createManagerAppointment({
            name: `${appointmentData.customer?.fullName || ""} - ${appointmentData.dog?.name || ""}`,
            stationId,
            selectedStations: [stationId],
            startTime: new Date(startDateTime).toISOString(),
            endTime: new Date(endDateTime).toISOString(),
            appointmentType: "garden",
            customerId: appointmentData.customer?.recordId || appointmentData.customer?.id,
            dogId: appointmentData.dog?.id,
            gardenAppointmentType: appointmentData.appointmentType,
            services: {
              gardenTrimNails: appointmentData.gardenTrimNails,
              gardenBrush: appointmentData.gardenBrush,
              gardenBath: appointmentData.gardenBath,
            },
            latePickupRequested: appointmentData.latePickupRequested,
            latePickupNotes: appointmentData.latePickupNotes,
            notes: appointmentData.notes,
            internalNotes: appointmentData.internalNotes,
          }).unwrap()

          toast({
            title: "תור גן נוצר בהצלחה!",
            description: `התור של ${result?.appointment?.dogs?.[0]?.name ?? "הכלב"} נוסף ללוח הזמנים`,
          })

          if (dateStr && format(selectedDateObj, "yyyy-MM-dd") !== dateStr) {
            dispatch(setSelectedAppointment(null as unknown as ManagerAppointment))
          }

          dispatch(setNewGardenAppointmentModalOpen(false))
          await refetch()
        } catch (error) {
          console.error("Error creating garden appointment:", error)
          toast({
            title: "שגיאה ביצירת התור",
            description: "אירעה שגיאה בעת יצירת תור הגן",
            variant: "destructive",
          })
        }
      }}
    />
  )
}

