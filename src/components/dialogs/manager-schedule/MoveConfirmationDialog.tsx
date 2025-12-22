import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TimePickerInput } from "@/components/TimePickerInput"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info } from "lucide-react"
import { format } from "date-fns"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { supabaseApi, useGetManagerScheduleQuery, useMoveAppointmentMutation } from "@/store/services/supabaseApi"
import {
    setMoveConfirmationOpen,
    setMoveDetails,
    setHourlyTimeSelection,
    setUpdateCustomer,
    setMoveLoading
} from "@/store/slices/managerScheduleSlice"
import { getManyChatFlowId, getManyChatCustomFieldId } from "@/lib/manychat"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export function MoveConfirmationDialog() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.moveConfirmationOpen)
    const moveDetails = useAppSelector((state) => state.managerSchedule.moveDetails)
    const hourlyTimeSelection = useAppSelector((state) => state.managerSchedule.hourlyTimeSelection)
    const updateCustomer = useAppSelector((state) => state.managerSchedule.updateCustomer)
    const moveLoading = useAppSelector((state) => state.managerSchedule.moveLoading)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    // Local state for editable times and station
    const [editableStartTime, setEditableStartTime] = useState<string>('')
    const [editableEndTime, setEditableEndTime] = useState<string>('')
    const [selectedStationId, setSelectedStationId] = useState<string>('')

    // Track original times to calculate delta when start time changes
    const originalTimesRef = useRef<{ start: string; end: string } | null>(null)

    // Initialize editable times and station when moveDetails changes
    useEffect(() => {
        if (moveDetails) {
            const startTimeStr = format(new Date(moveDetails.newStartTime), 'HH:mm')
            const endTimeStr = format(new Date(moveDetails.newEndTime), 'HH:mm')
            setEditableStartTime(startTimeStr)
            setEditableEndTime(endTimeStr)
            setSelectedStationId(moveDetails.newStation.id)
            // Store original times for delta calculation
            originalTimesRef.current = { start: startTimeStr, end: endTimeStr }
        }
    }, [moveDetails])

    const { data } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

    const [moveAppointment] = useMoveAppointmentMutation()

    // Helper function to convert time string to minutes
    const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(':').map(Number)
        return hours * 60 + minutes
    }

    // Helper function to convert minutes to time string
    const minutesToTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
    }

    // Handle start time change - adjust end time by delta
    const handleStartTimeChange = (newStartTime: string) => {
        if (!originalTimesRef.current) return

        setEditableStartTime(newStartTime)

        // Calculate delta from original start time
        const originalStartMinutes = timeToMinutes(originalTimesRef.current.start)
        const newStartMinutes = timeToMinutes(newStartTime)
        const delta = newStartMinutes - originalStartMinutes

        // Adjust end time by the same delta
        const originalEndMinutes = timeToMinutes(originalTimesRef.current.end)
        const newEndMinutes = originalEndMinutes + delta

        // Ensure end time is at least 15 minutes after start time
        const minEndMinutes = newStartMinutes + 15
        const finalEndMinutes = Math.max(newEndMinutes, minEndMinutes)

        setEditableEndTime(minutesToTime(finalEndMinutes))
    }

    // Handle end time change - ensure it's after start time
    const handleEndTimeChange = (newEndTime: string) => {
        const startMinutes = timeToMinutes(editableStartTime)
        const endMinutes = timeToMinutes(newEndTime)

        // Ensure end time is at least 15 minutes after start time
        if (endMinutes <= startMinutes) {
            setEditableEndTime(minutesToTime(startMinutes + 15))
        } else {
            setEditableEndTime(newEndTime)
        }
    }

    const handleClose = () => {
        dispatch(setMoveConfirmationOpen(false))
        dispatch(setMoveDetails(null))
        dispatch(setHourlyTimeSelection(null))
    }

    const handleConfirm = async () => {
        if (!moveDetails) return

        dispatch(setMoveLoading(true))
        try {
            // Calculate final times based on selected hours if applicable
            let finalStartTime = moveDetails.newStartTime
            let finalEndTime = moveDetails.newEndTime

            // For garden appointments that are hourly (either in hourly section or trial section with hourly type)
            if (moveDetails.appointment.serviceType === 'garden' &&
                moveDetails.newGardenAppointmentType === 'hourly' &&
                hourlyTimeSelection) {
                // Parse the selected hours
                const [startHour, startMinute] = hourlyTimeSelection.start.split(':').map(Number)
                const [endHour, endMinute] = hourlyTimeSelection.end.split(':').map(Number)

                // Get the date from the original appointment
                const originalDate = new Date(moveDetails.newStartTime)

                // Create new start and end times with the selected hours
                finalStartTime = new Date(
                    originalDate.getFullYear(),
                    originalDate.getMonth(),
                    originalDate.getDate(),
                    startHour,
                    startMinute
                )
                finalEndTime = new Date(
                    originalDate.getFullYear(),
                    originalDate.getMonth(),
                    originalDate.getDate(),
                    endHour,
                    endMinute
                )
            } else {
                // Use editable times for non-hourly appointments or when hourly selection is not used
                // Parse the editable time strings and combine with the date from moveDetails
                const [startHour, startMinute] = editableStartTime.split(':').map(Number)
                const [endHour, endMinute] = editableEndTime.split(':').map(Number)

                // Get the date from the original newStartTime
                const originalDate = new Date(moveDetails.newStartTime)

                // Create new start and end times with the editable hours
                finalStartTime = new Date(
                    originalDate.getFullYear(),
                    originalDate.getMonth(),
                    originalDate.getDate(),
                    startHour,
                    startMinute
                )
                finalEndTime = new Date(
                    originalDate.getFullYear(),
                    originalDate.getMonth(),
                    originalDate.getDate(),
                    endHour,
                    endMinute
                )
            }

            // First, update the cache immediately for instant UI feedback
            if (data) {
                // Manually update the cache to reflect the appointment's new position
                dispatch(
                    supabaseApi.util.updateQueryData(
                        'getManagerSchedule',
                        {
                            date: format(new Date(selectedDate), 'yyyy-MM-dd'),
                            serviceType: serviceFilter
                        },
                        (draft) => {
                            if (draft) {
                                // Find and update the moved appointment
                                const appointmentIndex = draft.appointments.findIndex(
                                    apt => apt.id === moveDetails.appointment.id
                                )

                                if (appointmentIndex !== -1) {
                                    draft.appointments[appointmentIndex] = {
                                        ...draft.appointments[appointmentIndex],
                                        stationId: selectedStationId,
                                        startDateTime: finalStartTime.toISOString(),
                                        endDateTime: finalEndTime.toISOString(),
                                        // Update garden appointment type if it's a garden type change
                                        ...(moveDetails.newGardenAppointmentType && {
                                            gardenAppointmentType: moveDetails.newGardenAppointmentType
                                        }),
                                        ...(moveDetails.newGardenIsTrial !== undefined && {
                                            gardenIsTrial: moveDetails.newGardenIsTrial
                                        })
                                    }
                                }
                            }
                        }
                    )
                )
            }

            // Then make the API call to update the backend
            await moveAppointment({
                appointmentId: moveDetails.appointment.id,
                newStationId: selectedStationId,
                newStartTime: finalStartTime,
                newEndTime: finalEndTime,
                oldStationId: moveDetails.oldStation.id,
                oldStartTime: moveDetails.appointment.startDateTime,
                oldEndTime: moveDetails.appointment.endDateTime,
                appointmentType: moveDetails.appointment.serviceType,
                ...(moveDetails.newGardenAppointmentType && { newGardenAppointmentType: moveDetails.newGardenAppointmentType }),
                ...(moveDetails.newGardenIsTrial !== undefined && { newGardenIsTrial: moveDetails.newGardenIsTrial }),
                ...(hourlyTimeSelection && { selectedHours: hourlyTimeSelection }),
            }).unwrap()

            // Send ManyChat flow if customer checkbox is checked
            // Skip for personal/private appointments as they don't have real customers
            if (updateCustomer &&
                !moveDetails.appointment.isPersonalAppointment &&
                moveDetails.appointment.appointmentType !== "private" &&
                moveDetails.appointment.clientPhone &&
                moveDetails.appointment.clientName) {
                try {
                    console.log("📱 [MoveConfirmationDialog] Sending appointment updated notification:", {
                        phone: moveDetails.appointment.clientPhone,
                        name: moveDetails.appointment.clientName,
                        appointmentId: moveDetails.appointment.id
                    })

                    const flowId = getManyChatFlowId("APPIONTMENT_UPDATED")
                    if (!flowId) {
                        console.error("❌ [MoveConfirmationDialog] ManyChat flow ID not configured for APPIONTMENT_UPDATED")
                    } else {
                        // Use barber fields for all appointments
                        const dateFieldId = getManyChatCustomFieldId("BARBER_DATE_APPOINTMENT")
                        const hourFieldId = getManyChatCustomFieldId("BARBER_HOUR_APPOINTMENT")

                        // Format date and time for ManyChat
                        const appointmentDate = format(finalStartTime, 'dd/MM/yyyy')
                        const appointmentTime = format(finalStartTime, 'HH:mm')

                        // Build fields object
                        const fields: Record<string, string> = {}
                        if (dateFieldId) {
                            fields[dateFieldId] = appointmentDate
                        }
                        if (hourFieldId) {
                            fields[hourFieldId] = appointmentTime
                        }

                        // Prepare user data for set-manychat-fields-and-send-flow
                        const users = [{
                            phone: moveDetails.appointment.clientPhone.replace(/\D/g, ""), // Normalize to digits only
                            name: moveDetails.appointment.clientName,
                            fields: fields
                        }]

                        // Call set-manychat-fields-and-send-flow function
                        const { data: manychatData, error: manychatError } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                            body: {
                                users: users,
                                flow_id: flowId
                            }
                        })

                        if (manychatError) {
                            console.error("❌ [MoveConfirmationDialog] Error sending ManyChat flow:", manychatError)
                            // Don't fail the whole operation if ManyChat fails
                            toast({
                                title: "התור הועבר בהצלחה",
                                description: "התור הועבר בהצלחה, אך שליחת ההודעה ללקוח נכשלה.",
                                variant: "default",
                            })
                        } else {
                            console.log("✅ [MoveConfirmationDialog] ManyChat flow sent successfully:", manychatData)
                            // Check if send was successful
                            const results = manychatData as Record<string, { success?: boolean; error?: string }>
                            const phoneKey = moveDetails.appointment.clientPhone.replace(/\D/g, "")
                            const result = results[phoneKey]

                            if (result?.success) {
                                console.log("✅ [MoveConfirmationDialog] Appointment update notification sent successfully to customer")
                            } else {
                                console.warn("⚠️ [MoveConfirmationDialog] Notification send may have failed:", result?.error)
                                toast({
                                    title: "התור הועבר בהצלחה",
                                    description: "התור הועבר בהצלחה, אך שליחת ההודעה ללקוח נכשלה.",
                                    variant: "default",
                                })
                            }
                        }
                    }
                } catch (manychatError) {
                    console.error("❌ [MoveConfirmationDialog] Exception sending ManyChat flow:", manychatError)
                    // Don't fail the whole operation if ManyChat fails
                    toast({
                        title: "התור הועבר בהצלחה",
                        description: "התור הועבר בהצלחה, אך שליחת ההודעה ללקוח נכשלה.",
                        variant: "default",
                    })
                }
            }

            // Close modal
            dispatch(setMoveConfirmationOpen(false))
            dispatch(setMoveDetails(null))
            dispatch(setHourlyTimeSelection(null))
            dispatch(setMoveLoading(false))
        } catch (error) {
            console.error('Error moving appointment:', error)

            // If the API call failed, we should revert the cache update
            if (data) {
                dispatch(
                    supabaseApi.util.updateQueryData(
                        'getManagerSchedule',
                        {
                            date: format(new Date(selectedDate), 'yyyy-MM-dd'),
                            serviceType: serviceFilter
                        },
                        (draft) => {
                            if (draft) {
                                // Revert the appointment to its original position
                                const appointmentIndex = draft.appointments.findIndex(
                                    apt => apt.id === moveDetails.appointment.id
                                )

                                if (appointmentIndex !== -1) {
                                    draft.appointments[appointmentIndex] = {
                                        ...draft.appointments[appointmentIndex],
                                        stationId: moveDetails.oldStation.id,
                                        startDateTime: moveDetails.oldStartTime,
                                        endDateTime: moveDetails.oldEndTime,
                                        ...(moveDetails.newGardenAppointmentType && {
                                            gardenAppointmentType: moveDetails.appointment.gardenAppointmentType
                                        }),
                                        ...(moveDetails.newGardenIsTrial !== undefined && {
                                            gardenIsTrial: moveDetails.appointment.gardenIsTrial
                                        })
                                    }
                                }
                            }
                        }
                    )
                )
            }

            dispatch(setMoveLoading(false))
        }
    }

    return (
        <Dialog open={open} onOpenChange={moveLoading ? undefined : (value) => {
            if (!value) {
                handleClose()
            } else {
                dispatch(setMoveConfirmationOpen(true))
            }
        }}>
            <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">אישור העברת תור</DialogTitle>
                    <DialogDescription className="text-right">
                        האם אתה בטוח שברצונך להעביר את התור? פרטי השינוי מוצגים להלן:
                    </DialogDescription>
                </DialogHeader>

                {moveDetails && (
                    <div className="space-y-6">
                        {/* Current Details */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">פרטי התור הנוכחיים</h3>
                            <div className="space-y-2 text-sm">
                                <div><span className="font-medium">לקוח:</span> {moveDetails.appointment.dogs[0]?.name || 'לא ידוע'}</div>
                                <div><span className="font-medium">לקוח:</span> {moveDetails.appointment.clientName || 'לא ידוע'}</div>
                                <div><span className="font-medium">עמדה:</span> {moveDetails.oldStation.name}</div>
                                <div><span className="font-medium">זמן נוכחי:</span> {format(new Date(moveDetails.appointment.startDateTime), 'HH:mm')} - {format(new Date(moveDetails.appointment.endDateTime), 'HH:mm')}</div>
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.newGardenAppointmentType === 'hourly' && hourlyTimeSelection && (
                                    <div><span className="font-medium">זמן חדש:</span> {hourlyTimeSelection.start} - {hourlyTimeSelection.end}</div>
                                )}
                                <div><span className="font-medium">שירות:</span> {moveDetails.appointment.serviceType === 'garden' ? '' : 'מספרה'}</div>
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.appointment.gardenAppointmentType && (
                                    <div><span className="font-medium">סוג:</span> {moveDetails.appointment.gardenAppointmentType === 'full-day' ? 'יום מלא' : 'שעות ספציפיות'}</div>
                                )}
                                {moveDetails.appointment.serviceType === 'garden' && (
                                    <div><span className="font-medium">תור ניסיון:</span> {moveDetails.appointment.gardenIsTrial ? 'כן' : 'לא'}</div>
                                )}
                            </div>
                        </div>

                        {/* New Details */}
                        <div className={moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                            ? "rounded-lg border border-purple-200 bg-purple-50 p-4"
                            : "rounded-lg border border-primary/20 bg-primary/10 p-4"}>
                            <h3 className={moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                ? "text-lg font-semibold text-purple-900 mb-3"
                                : "text-lg font-semibold text-primary mb-3"}>פרטי התור החדשים</h3>
                            <div className="space-y-2 text-sm">
                                <div><span className="font-medium">לקוח:</span> {moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                    ? (moveDetails.appointment.personalAppointmentDescription || 'תור אישי')
                                    : (moveDetails.appointment.dogs[0]?.name || 'לא ידוע')}</div>
                                <div><span className="font-medium">לקוח:</span> {moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                    ? 'צוות פנימי'
                                    : (moveDetails.appointment.clientName || 'לא ידוע')}</div>
                                <div className="flex items-center gap-3">
                                    <span className="font-medium">עמדה:</span>
                                    <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                                        <SelectTrigger className="w-48 text-right">
                                            <SelectValue placeholder="בחר עמדה" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {data?.stations?.map((station) => (
                                                <SelectItem key={station.id} value={station.id}>
                                                    {station.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-medium">זמן:</span>
                                    <div className="flex items-center gap-3">
                                        <TimePickerInput
                                            value={editableStartTime}
                                            onChange={handleStartTimeChange}
                                            intervalMinutes={15}
                                            className="w-50"
                                        />
                                        <span>-</span>
                                        <TimePickerInput
                                            value={editableEndTime}
                                            onChange={handleEndTimeChange}
                                            intervalMinutes={15}
                                            className="w-50"
                                        />
                                    </div>
                                </div>
                                <div><span className="font-medium">שירות:</span> {moveDetails.appointment.serviceType === 'garden' ? '' : 'מספרה'}</div>
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.newGardenAppointmentType && (
                                    <div><span className="font-medium">סוג:</span> {moveDetails.newGardenAppointmentType === 'full-day' ? 'יום מלא' : 'שעות ספציפיות'}</div>
                                )}
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.newGardenIsTrial !== undefined && (
                                    <div><span className="font-medium">תור ניסיון:</span> {moveDetails.newGardenIsTrial ? 'כן' : 'לא'}</div>
                                )}
                            </div>
                        </div>

                        {/* Hourly Time Selection */}
                        {moveDetails.appointment.serviceType === 'garden' && moveDetails.newGardenAppointmentType === 'hourly' && (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                <h3 className="text-lg font-semibold text-green-900 mb-3">בחירת שעות לתור שעתי</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">שעת התחלה</label>
                                        <TimePickerInput
                                            value={hourlyTimeSelection?.start || '09:00'}
                                            onChange={(value: string) => {
                                                if (hourlyTimeSelection) {
                                                    dispatch(setHourlyTimeSelection({ ...hourlyTimeSelection, start: value }))
                                                } else {
                                                    dispatch(setHourlyTimeSelection({ start: value, end: '10:00' }))
                                                }
                                            }}
                                            intervalMinutes={15}
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">שעת סיום</label>
                                        <TimePickerInput
                                            value={hourlyTimeSelection?.end || '10:00'}
                                            onChange={(value: string) => {
                                                if (hourlyTimeSelection) {
                                                    dispatch(setHourlyTimeSelection({ ...hourlyTimeSelection, end: value }))
                                                } else {
                                                    dispatch(setHourlyTimeSelection({ start: '09:00', end: value }))
                                                }
                                            }}
                                            intervalMinutes={15}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">
                                    בחר את השעות שבהן הלקוח רוצה את התור השעתי
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {moveDetails && (
                    <>
                        {/* Let Customer Know Banner */}
                        <div className="py-4 border-t border-gray-200">
                            <div className={moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                ? "flex items-center  gap-2 space-x-2 rtl:space-x-reverse bg-purple-50 border border-purple-200 rounded-md p-3"
                                : "flex items-center  gap-2 space-x-2 rtl:space-x-reverse bg-primary/10 border border-primary/20 rounded-md p-3"}>
                                <Info className={moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                    ? "h-4 w-4 text-primary"
                                    : "h-4 w-4 text-primary"} />
                                <input
                                    type="checkbox"
                                    id="updateCustomerMove"
                                    checked={updateCustomer}
                                    onChange={(e) => dispatch(setUpdateCustomer(e.target.checked))}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="updateCustomerMove" className={moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                    ? "text-sm text-purple-800 font-medium"
                                    : "text-sm text-primary font-medium"}>
                                    עדכן את הלקוח על השינויים בתור
                                </label>
                            </div>
                        </div>
                        <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                            <Button variant="outline" onClick={handleClose} disabled={moveLoading}>
                                ביטול
                            </Button>
                            <Button onClick={handleConfirm} className={moveDetails.appointment.isPersonalAppointment || moveDetails.appointment.appointmentType === "private"
                                ? "bg-purple-600 hover:bg-purple-700"
                                : "bg-primary hover:bg-primary/90"} disabled={moveLoading}>
                                {moveLoading ? 'מעביר...' : 'אישור העברה'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
