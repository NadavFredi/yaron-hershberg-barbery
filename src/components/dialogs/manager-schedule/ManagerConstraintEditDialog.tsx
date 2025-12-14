import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { ConstraintEditDialog } from "@/components/dialogs/settings/constraints/ConstraintEditDialog"
import { supabase } from "@/integrations/supabase/client"
import { supabaseApi } from "@/store/services/supabaseApi"
import { addHours, startOfDay } from "date-fns"
import {
    setIsConstraintDialogOpen,
    setEditingConstraint,
    setEditingConstraintStationIds,
    setEditingConstraintDefaultTimes,
    setFinalizedDragTimes,
    setConstraintResizingPreview
} from "@/store/slices/managerScheduleSlice"

export function ManagerConstraintEditDialog() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.isConstraintDialogOpen)
    const editingConstraint = useAppSelector((state) => state.managerSchedule.editingConstraint)
    const editingConstraintStationIds = useAppSelector((state) => state.managerSchedule.editingConstraintStationIds)
    const editingConstraintDefaultTimes = useAppSelector((state) => state.managerSchedule.editingConstraintDefaultTimes)
    const finalizedDragTimes = useAppSelector((state) => state.managerSchedule.finalizedDragTimes)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsConstraintDialogOpen(value))
        if (!value) {
            // Clear constraint resizing preview when dialog closes (in case of cancel)
            dispatch(setConstraintResizingPreview(null))
            dispatch(setEditingConstraint(null))
            dispatch(setEditingConstraintStationIds([]))
            dispatch(setEditingConstraintDefaultTimes(null))
            dispatch(setFinalizedDragTimes(null))
        }
    }

    const handleSave = async () => {
        // Invalidate cache to refresh ManagerSchedule data
        await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))

        // Refresh constraints after save
        const dayStart = startOfDay(new Date(selectedDate))
        const dayEnd = addHours(dayStart, 24)
        await supabase
            .from("station_unavailability")
            .select(`
                id,
                station_id,
                reason,
                notes,
                start_time,
                end_time,
                is_active
            `)
            .lt("start_time", dayEnd.toISOString())
            .gt("end_time", dayStart.toISOString())
        
        dispatch(supabaseApi.util.invalidateTags(["Constraints"]))
        dispatch(setFinalizedDragTimes(null))
    }

    // Convert editingConstraintDefaultTimes from Redux (ISO strings) to Date objects
    const defaultStartDate = editingConstraintDefaultTimes?.startDate 
        ? new Date(editingConstraintDefaultTimes.startDate) 
        : (finalizedDragTimes?.startTime ? new Date(finalizedDragTimes.startTime) : null)
    const defaultEndDate = editingConstraintDefaultTimes?.endDate 
        ? new Date(editingConstraintDefaultTimes.endDate) 
        : (finalizedDragTimes?.endTime ? new Date(finalizedDragTimes.endTime) : null)

    // Convert finalizedDragTimes to time strings
    const defaultStartTime = editingConstraintDefaultTimes?.startTime || 
        (finalizedDragTimes?.startTime 
            ? `${String(new Date(finalizedDragTimes.startTime).getHours()).padStart(2, "0")}:${String(new Date(finalizedDragTimes.startTime).getMinutes()).padStart(2, "0")}` 
            : undefined)
    const defaultEndTime = editingConstraintDefaultTimes?.endTime || 
        (finalizedDragTimes?.endTime 
            ? `${String(new Date(finalizedDragTimes.endTime).getHours()).padStart(2, "0")}:${String(new Date(finalizedDragTimes.endTime).getMinutes()).padStart(2, "0")}` 
            : undefined)

    return (
        <ConstraintEditDialog
            open={open}
            onOpenChange={handleOpenChange}
            constraint={editingConstraint ? {
                id: editingConstraint.id,
                station_id: editingConstraint.station_id,
                reason: editingConstraint.reason,
                notes: editingConstraint.notes,
                start_time: editingConstraint.start_time,
                end_time: editingConstraint.end_time,
            } : null}
            stationIds={editingConstraintStationIds}
            defaultStartDate={defaultStartDate}
            defaultEndDate={defaultEndDate}
            defaultStartTime={defaultStartTime}
            defaultEndTime={defaultEndTime}
            defaultIsActive={editingConstraintDefaultTimes?.isActive}
            onSave={handleSave}
        />
    )
}

