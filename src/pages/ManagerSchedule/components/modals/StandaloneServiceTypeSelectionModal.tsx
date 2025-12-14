import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { format } from "date-fns"
import {
  setShowServiceTypeSelectionModal,
} from "@/store/slices/managerScheduleSlice"
import { supabaseApi, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { useToast } from "@/hooks/use-toast"
import { ServiceTypeSelectionModal } from "@/components/dialogs/manager-schedule/ServiceTypeSelectionModal"

export function StandaloneServiceTypeSelectionModal() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const showServiceTypeSelectionModal = useAppSelector(
    (state) => state.managerSchedule.showServiceTypeSelectionModal
  )
  const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
  const selectedDateObj = new Date(selectedDate)

  const { data } = useGetManagerScheduleQuery({
    date: format(selectedDateObj, "yyyy-MM-dd"),
    serviceType: "grooming",
  })

  const stations = data?.stations || []

  return (
    <ServiceTypeSelectionModal
      open={showServiceTypeSelectionModal}
      onOpenChange={(open) => dispatch(setShowServiceTypeSelectionModal(open))}
      onSelectGrooming={async () => {
        const groomingStations = stations.filter((s) => s.serviceType === "grooming")
        const firstGroomingStation = groomingStations[0]

        if (!firstGroomingStation) {
          toast({
            title: "שגיאה",
            description: "לא נמצאו עמדות מספרה",
            variant: "destructive",
          })
          return
        }

        dispatch(
          supabaseApi.util.updateQueryData(
            "getManagerSchedule",
            { date: format(selectedDateObj, "yyyy-MM-dd"), serviceType: "grooming" },
            (draft) => draft
          )
        )
      }}
    />
  )
}

