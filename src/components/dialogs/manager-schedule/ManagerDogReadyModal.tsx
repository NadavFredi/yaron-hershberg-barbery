import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { DogReadyModal } from "./DogReadyModal"
import {
    setShowDogReadyModal,
    setDogReadyModalAppointment,
} from "@/store/slices/managerScheduleSlice"

export function ManagerDogReadyModal() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.showDogReadyModal)
    const appointment = useAppSelector((state) => state.managerSchedule.dogReadyModalAppointment)

    const handleClose = () => {
        dispatch(setShowDogReadyModal(false))
        dispatch(setDogReadyModalAppointment(null))
    }

    return (
        <DogReadyModal
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                } else {
                    dispatch(setShowDogReadyModal(true))
                }
            }}
            appointment={appointment}
        />
    )
}

