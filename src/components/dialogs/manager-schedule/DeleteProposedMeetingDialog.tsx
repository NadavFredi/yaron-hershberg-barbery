import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { supabaseApi, useDeleteProposedMeetingMutation } from "@/store/services/supabaseApi"
import {
  setEditingProposedMeeting,
  setIsDeletingProposed,
  setProposedMeetingTimes,
  setSelectedAppointment,
  setShowDeleteProposedDialog,
  setShowProposedMeetingModal,
} from "@/store/slices/managerScheduleSlice"

export function DeleteProposedMeetingDialog() {
  const dispatch = useAppDispatch()
  const { toast } = useToast()

  const open = useAppSelector((state) => state.managerSchedule.showDeleteProposedDialog)
  const meeting = useAppSelector((state) => state.managerSchedule.proposedMeetingToDelete)
  const isDeletingProposed = useAppSelector((state) => state.managerSchedule.isDeletingProposed)
  const selectedAppointment = useAppSelector((state) => state.managerSchedule.selectedAppointment)

  const [deleteProposedMeetingMutation] = useDeleteProposedMeetingMutation()

  const handleClose = () => {
    dispatch(setShowDeleteProposedDialog(false))
    // Keep editingProposedMeeting untouched here; deletion handler already clears it after success
  }

  const handleConfirm = async () => {
    if (!meeting?.proposedMeetingId) {
      handleClose()
      return
    }
    dispatch(setIsDeletingProposed(true))
    try {
      await deleteProposedMeetingMutation(meeting.proposedMeetingId).unwrap()

      toast({
        title: "המפגש נמחק",
        description: "חלון הזמן שוחרר מהיומן וההזמנות בוטלו.",
      })

      dispatch(setShowProposedMeetingModal(false))
      dispatch(setEditingProposedMeeting(null))
      dispatch(setProposedMeetingTimes(null))
      if (selectedAppointment?.id === meeting.id) {
        dispatch(setSelectedAppointment(null))
      }

      dispatch(setShowDeleteProposedDialog(false))
      dispatch(setEditingProposedMeeting(null))

      // Invalidate schedule so RTK Query refetches
      dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule"]))
    } catch (error) {
      toast({
        title: "לא ניתן למחוק את המפגש",
        description: error instanceof Error ? error.message : "בדקו את החיבור ונסו שוב.",
        variant: "destructive",
      })
    } finally {
      dispatch(setIsDeletingProposed(false))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          handleClose()
        } else {
          dispatch(setShowDeleteProposedDialog(true))
        }
      }}
    >
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">מחיקת מפגש מוצע</DialogTitle>
          <DialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את המפגש המוצע? חלון הזמן ישתחרר וההזמנות לאירוע זה יבוטלו.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <span className="font-semibold">
              {meeting?.proposedTitle || "מפגש ללא כותרת"}
            </span>
          </p>
          {meeting && (
            <p>
              <span className="font-semibold">
                {format(new Date(meeting.startDateTime), "dd/MM/yyyy HH:mm")}
              </span>
              {" - "}
              <span className="font-semibold">
                {format(new Date(meeting.endDateTime), "HH:mm")}
              </span>
              {meeting.stationName && <> · עמדה {meeting.stationName}</>}
            </p>
          )}
        </div>
        <DialogFooter dir="ltr">
        <Button variant="outline" onClick={handleClose}>
          ביטול
        </Button>
        <Button variant="destructive" onClick={handleConfirm} disabled={isDeletingProposed}>
          {isDeletingProposed ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              מוחק...
            </>
          ) : (
            "מחק מפגש"
          )}
        </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
