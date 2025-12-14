import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { supabaseApi, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { StationEditDialog } from "@/components/dialogs/settings/stations/StationEditDialog"
import { format } from "date-fns"
import {
    setIsStationEditDialogOpen,
    setEditingStation
} from "@/store/slices/managerScheduleSlice"

export function ManagerStationEditDialog() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.isStationEditDialogOpen)
    const editingStation = useAppSelector((state) => state.managerSchedule.editingStation)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsStationEditDialogOpen(value))
        if (!value) {
            dispatch(setEditingStation(null))
        }
    }

    const handleSaved = async () => {
        // Refresh the schedule data after saving
        await refetch()
        dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Station"]))
        // RTK Query will automatically refetch when tags are invalidated
        dispatch(supabaseApi.util.invalidateTags(["StationWorkingHours", "ShiftRestrictions"]))
    }

    return (
        <StationEditDialog
            open={open}
            onOpenChange={handleOpenChange}
            station={editingStation ? {
                id: editingStation.id,
                name: editingStation.name,
                is_active: editingStation.isActive ?? true
            } : null}
            onSaved={handleSaved}
            autoFilterByCurrentDay={true}
        />
    )
}

