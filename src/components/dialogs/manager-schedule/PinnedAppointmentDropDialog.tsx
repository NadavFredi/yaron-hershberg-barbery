import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setShowPinnedAppointmentDropDialog,
  setPinnedAppointmentDropDetails,
  setPinnedAppointmentDropAction,
  setPinnedAppointmentDropRemoveFromPinned,
} from "@/store/slices/managerScheduleSlice"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Sparkles, Move, CalendarPlus } from "lucide-react"
import { useGetManagerScheduleQuery } from "@/store/services/supabaseApi"

type DropAction = "proposal" | "move" | "new"

export function PinnedAppointmentDropDialog() {
  const dispatch = useAppDispatch()
  const open = useAppSelector((state) => state.managerSchedule.showPinnedAppointmentDropDialog)
  const dropDetails = useAppSelector((state) => state.managerSchedule.pinnedAppointmentDropDetails)
  const selectedDateStr = useAppSelector((state) => state.managerSchedule.selectedDate)

  const [removeFromPinned, setRemoveFromPinned] = useState(true)

  // Get schedule data to access stations
  const formattedDate = useMemo(() => {
    const date = new Date(selectedDateStr)
    return format(date, "yyyy-MM-dd")
  }, [selectedDateStr])

  const { data: scheduleData } = useGetManagerScheduleQuery({
    date: formattedDate,
    serviceType: "both",
  })

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRemoveFromPinned(true)
    }
  }, [open])

  // Get station name - must be before early return to follow Rules of Hooks
  const stationName = useMemo(() => {
    if (!dropDetails || !scheduleData?.stations) return ""
    const station = scheduleData.stations.find(s => s.id === dropDetails.targetStationId)
    if (station) return station.name

    // Handle garden columns
    if (dropDetails.targetStationId === "garden-full-day") return "יום מלא"
    if (dropDetails.targetStationId === "garden-trial") return "ניסיון"
    if (dropDetails.targetStationId?.startsWith("garden-")) return ""

    return ""
  }, [scheduleData?.stations, dropDetails?.targetStationId])

  if (!dropDetails) return null

  const { pin, appointment, targetStationId, targetStartTime, targetEndTime } = dropDetails

  const handleClose = () => {
    dispatch(setShowPinnedAppointmentDropDialog(false))
    dispatch(setPinnedAppointmentDropDetails(null))
    dispatch(setPinnedAppointmentDropAction(null))
    dispatch(setPinnedAppointmentDropRemoveFromPinned(false))
    setRemoveFromPinned(false)
  }

  const handleAction = (action: DropAction) => {
    // Store the action and removeFromPinned in Redux
    dispatch(setPinnedAppointmentDropAction(action))
    dispatch(setPinnedAppointmentDropRemoveFromPinned(removeFromPinned))
    // Close the dialog only - don't clear the action/details yet, let the useEffect handle it
    dispatch(setShowPinnedAppointmentDropDialog(false))
  }

  const targetDate = new Date(targetStartTime)
  const targetEndDate = new Date(targetEndTime)
  const targetTime = format(targetDate, "HH:mm", { locale: he })
  const targetEndTimeStr = format(targetEndDate, "HH:mm", { locale: he })
  const targetDateStr = format(targetDate, "dd.MM.yyyy", { locale: he })

  const dogNames = appointment.dogs.map(d => d.name).join(", ")

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">מה תרצה לעשות עם התור המסומן?</DialogTitle>
          <DialogDescription className="text-right">
            בחר את הפעולה שברצונך לבצע
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Appointment info section */}
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-sm text-slate-600 text-right">
              <div>{dogNames} - {appointment.clientName}</div>
              <div>תאריך: <span className="font-medium">{targetDateStr}</span></div>
              <div>זמן: <span className="font-medium">{targetTime} - {targetEndTimeStr}</span></div>
              {appointment.serviceName && (
                <div>סוג שירות: <span className="font-medium">{appointment.serviceName}</span></div>
              )}
              {stationName && <div>עמדה: <span className="font-medium">{stationName}</span></div>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => handleAction("move")}
              className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
              variant="outline"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                  <Move className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-right flex-1">
                  <div className="font-semibold">העבר תור</div>
                  <div className="text-sm text-gray-500">העברת התור הקיים למיקום החדש</div>
                </div>
              </div>
            </Button>

            <Button
              onClick={() => handleAction("new")}
              className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
              variant="outline"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                  <CalendarPlus className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-right flex-1">
                  <div className="font-semibold">צור תור חדש</div>
                  <div className="text-sm text-gray-500">יצירת תור חדש במיקום זה</div>
                </div>
              </div>
            </Button>

            <Button
              onClick={() => handleAction("proposal")}
              className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
              variant="outline"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-lime-100">
                  <Sparkles className="h-5 w-5 text-lime-600" />
                </div>
                <div className="text-right flex-1">
                  <div className="font-semibold">צור הצעה</div>
                  <div className="text-sm text-gray-500">יצירת הצעת פגישה חדשה</div>
                </div>
              </div>
            </Button>
          </div>

          {/* Remove from pinned checkbox */}
          <div className="flex items-center space-x-2 space-x-reverse pt-3 border-t">
            <Checkbox
              id="removeFromPinned"
              checked={removeFromPinned}
              onCheckedChange={(checked) => setRemoveFromPinned(checked === true)}
            />
            <Label htmlFor="removeFromPinned" className="flex-1 cursor-pointer text-sm text-right">
              הסר מהתורים המסומנים לאחר הפעולה
            </Label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

