import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { ConstraintDetailsSheet } from "@/pages/ManagerSchedule/sheets/ConstraintDetailsSheet"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format } from "date-fns"
import {
    setIsConstraintDetailsOpen
} from "@/store/slices/managerScheduleSlice"

export function ManagerConstraintDetailsSheet() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.isConstraintDetailsOpen)
    const selectedConstraint = useAppSelector((state) => state.managerSchedule.selectedConstraint)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const stations = data?.stations || []
    const stationName = selectedConstraint ? stations.find((s: any) => s.id === selectedConstraint.station_id)?.name : undefined

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsConstraintDetailsOpen(value))
    }

    return (
        <ConstraintDetailsSheet
            open={open}
            onOpenChange={handleOpenChange}
            selectedConstraint={selectedConstraint}
            stationName={stationName}
        />
    )
}

