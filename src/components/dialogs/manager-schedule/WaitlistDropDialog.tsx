import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import {
    setShowWaitlistDropDialog,
    setPendingWaitlistPlacement,
    setShouldRemoveFromWaitlist,
    setPrefillBusinessCustomer,
    setPrefillBusinessDog,
    setPendingWaitlistEntryId,
    setFinalizedDragTimes,
    setShowBusinessAppointmentModal
} from "@/store/slices/managerScheduleSlice"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { format as dateFormat } from "date-fns"

export function WaitlistDropDialog() {
    const dispatch = useAppDispatch()

    const open = useAppSelector((state) => state.managerSchedule.showWaitlistDropDialog)
    const pendingWaitlistPlacement = useAppSelector((state) => state.managerSchedule.pendingWaitlistPlacement)
    const shouldRemoveFromWaitlist = useAppSelector((state) => state.managerSchedule.shouldRemoveFromWaitlist)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data } = useGetManagerScheduleQuery({
        date: dateFormat(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const stations = data?.stations || []
    const pendingPlacementStation = stations.find((s: any) => s.id === pendingWaitlistPlacement?.stationId)

    const handleCancel = () => {
        dispatch(setShowWaitlistDropDialog(false))
        dispatch(setPendingWaitlistPlacement(null))
        dispatch(setShouldRemoveFromWaitlist(true))
    }

    const handleConfirm = () => {
        if (!pendingWaitlistPlacement) {
            return
        }

        const { entry, stationId, startTime, endTime } = pendingWaitlistPlacement

        dispatch(setPrefillBusinessCustomer({
            id: entry.customerId,
            fullName: entry.customerName ?? undefined,
            phone: entry.customerPhone ?? undefined,
            email: entry.customerEmail ?? undefined,
        }))
        dispatch(setPrefillBusinessDog({
            id: entry.dogId,
            name: entry.dogName,
            breed: entry.breedName ?? "",
            size: "medium",
            isSmall: false,
            ownerId: entry.customerId,
        }))
        dispatch(setPendingWaitlistEntryId(entry.id))
        dispatch(setFinalizedDragTimes({
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            stationId,
        }))
        dispatch(setShowWaitlistDropDialog(false))
        dispatch(setPendingWaitlistPlacement(null))
        dispatch(setShowBusinessAppointmentModal(true))
    }

    if (!pendingWaitlistPlacement) {
        return null
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleCancel()
                } else {
                    dispatch(setShowWaitlistDropDialog(true))
                }
            }}
        >
            <DialogContent dir="rtl">
                <DialogHeader>
                    <DialogTitle>שיבוץ לקוח מרשימת ההמתנה</DialogTitle>
                    <DialogDescription>
                        נפתח עבורך שמירת תור עסקי עם הפרטים שנגררו.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm text-gray-600">
                    <div>
                        <p className="mb-1">
                            להוסיף את{" "}
                            <span className="font-semibold">{pendingWaitlistPlacement.entry.dogName}</span>
                            {pendingWaitlistPlacement.entry.customerName && (
                                <>
                                    {" "}
                                    <span className="text-gray-400">/</span>{" "}
                                    <span className="font-semibold">{pendingWaitlistPlacement.entry.customerName}</span>
                                </>
                            )}
                        </p>
                        <p>
                            לעמדה{" "}
                            <span className="font-semibold">
                                {pendingPlacementStation?.name || pendingWaitlistPlacement.stationId}
                            </span>{" "}
                            בשעות{" "}
                            <span className="font-semibold">
                                {format(pendingWaitlistPlacement.startTime, "HH:mm")} -{" "}
                                {format(pendingWaitlistPlacement.endTime, "HH:mm")}
                            </span>
                            ?
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="remove-waitlist"
                            checked={shouldRemoveFromWaitlist}
                            onCheckedChange={(checked) => dispatch(setShouldRemoveFromWaitlist(Boolean(checked)))}
                        />
                        <Label htmlFor="remove-waitlist" className="text-xs text-gray-700">
                            הסר את הלקוח מרשימת ההמתנה לאחר יצירת התור
                        </Label>
                    </div>
                </div>
                <DialogFooter dir="ltr">
                    <Button variant="outline" onClick={handleCancel}>
                        ביטול
                    </Button>
                    <Button onClick={handleConfirm} disabled={!pendingWaitlistPlacement}>
                        המשך ליצירת תור
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

