import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { StationConstraintsModal } from "./StationConstraintsModal"
import {
    setIsStationConstraintsModalOpen,
    setStationConstraintsContext
} from "@/store/slices/managerScheduleSlice"

export function ManagerStationConstraintsModal() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.isStationConstraintsModalOpen)
    const context = useAppSelector((state) => state.managerSchedule.stationConstraintsContext)

    const handleOpenChange = (value: boolean) => {
        dispatch(setIsStationConstraintsModalOpen(value))
        if (!value) {
            dispatch(setStationConstraintsContext(null))
        }
    }

    // Convert context from Redux (ISO strings) to Date objects
    const contextWithDate = context ? {
        ...context,
        date: new Date(context.date)
    } : null

    return (
        <StationConstraintsModal
            open={open}
            onOpenChange={handleOpenChange}
            context={contextWithDate}
        />
    )
}

