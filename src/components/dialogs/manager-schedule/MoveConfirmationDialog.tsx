import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TimePickerInput } from "@/components/TimePickerInput"
import { Info } from "lucide-react"
import { format } from "date-fns"

interface MoveDetails {
    appointment: {
        id: string
        startDateTime: string
        endDateTime: string
        serviceType: 'grooming' | 'garden'
        gardenAppointmentType?: 'full-day' | 'hourly' | 'trial'
        gardenIsTrial?: boolean
        treatments: Array<{ name: string }>
        clientName?: string
    }
    oldStation: { name: string }
    newStation: { name: string }
    newStartTime: string
    newEndTime: string
    newGardenAppointmentType?: string
    newGardenIsTrial?: boolean
}

interface HourlyTimeSelection {
    start: string
    end: string
}

interface MoveConfirmationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    moveDetails: MoveDetails | null
    hourlyTimeSelection: HourlyTimeSelection | null
    setHourlyTimeSelection: (selection: HourlyTimeSelection | null) => void
    updateCustomerMove: boolean
    setUpdateCustomerMove: (update: boolean) => void
    onConfirm: () => void
    onCancel: () => void
    loading?: boolean
}

export const MoveConfirmationDialog: React.FC<MoveConfirmationDialogProps> = ({
    open,
    onOpenChange,
    moveDetails,
    hourlyTimeSelection,
    setHourlyTimeSelection,
    updateCustomerMove,
    setUpdateCustomerMove,
    onConfirm,
    onCancel,
    loading = false
}) => {
    return (
        <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
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
                                <div><span className="font-medium">כלב:</span> {moveDetails.appointment.treatments[0]?.name || 'לא ידוע'}</div>
                                <div><span className="font-medium">לקוח:</span> {moveDetails.appointment.clientName || 'לא ידוע'}</div>
                                <div><span className="font-medium">עמדה:</span> {moveDetails.oldStation.name}</div>
                                <div><span className="font-medium">זמן נוכחי:</span> {format(new Date(moveDetails.appointment.startDateTime), 'HH:mm')} - {format(new Date(moveDetails.appointment.endDateTime), 'HH:mm')}</div>
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.newGardenAppointmentType === 'hourly' && hourlyTimeSelection && (
                                    <div><span className="font-medium">זמן חדש:</span> {hourlyTimeSelection.start} - {hourlyTimeSelection.end}</div>
                                )}
                                <div><span className="font-medium">שירות:</span> {moveDetails.appointment.serviceType === 'garden' ? 'גן' : 'מספרה'}</div>
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.appointment.gardenAppointmentType && (
                                    <div><span className="font-medium">סוג גן:</span> {moveDetails.appointment.gardenAppointmentType === 'full-day' ? 'יום מלא' : 'שעות ספציפיות'}</div>
                                )}
                                {moveDetails.appointment.serviceType === 'garden' && (
                                    <div><span className="font-medium">תור ניסיון:</span> {moveDetails.appointment.gardenIsTrial ? 'כן' : 'לא'}</div>
                                )}
                            </div>
                        </div>

                        {/* New Details */}
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <h3 className="text-lg font-semibold text-blue-900 mb-3">פרטי התור החדשים</h3>
                            <div className="space-y-2 text-sm">
                                <div><span className="font-medium">כלב:</span> {moveDetails.appointment.treatments[0]?.name || 'לא ידוע'}</div>
                                <div><span className="font-medium">לקוח:</span> {moveDetails.appointment.clientName || 'לא ידוע'}</div>
                                <div><span className="font-medium">עמדה:</span> {moveDetails.newStation.name}</div>
                                <div><span className="font-medium">זמן:</span> {format(new Date(moveDetails.newStartTime), 'HH:mm')} - {format(new Date(moveDetails.newEndTime), 'HH:mm')}</div>
                                <div><span className="font-medium">שירות:</span> {moveDetails.appointment.serviceType === 'garden' ? 'גן' : 'מספרה'}</div>
                                {moveDetails.appointment.serviceType === 'garden' && moveDetails.newGardenAppointmentType && (
                                    <div><span className="font-medium">סוג גן:</span> {moveDetails.newGardenAppointmentType === 'full-day' ? 'יום מלא' : 'שעות ספציפיות'}</div>
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
                                                    setHourlyTimeSelection({ ...hourlyTimeSelection, start: value })
                                                } else {
                                                    setHourlyTimeSelection({ start: value, end: '10:00' })
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
                                                    setHourlyTimeSelection({ ...hourlyTimeSelection, end: value })
                                                } else {
                                                    setHourlyTimeSelection({ start: '09:00', end: value })
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

                {/* Let Customer Know Banner */}
                <div className="py-4 border-t border-gray-200">
                    <div className="flex items-center  gap-2 space-x-2 rtl:space-x-reverse bg-blue-50 border border-blue-200 rounded-md p-3">
                        <Info className="h-4 w-4 text-blue-600" />
                        <input
                            type="checkbox"
                            id="updateCustomerMove"
                            checked={updateCustomerMove}
                            onChange={(e) => setUpdateCustomerMove(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="updateCustomerMove" className="text-sm text-blue-800 font-medium">
                            עדכן את הלקוח על השינויים בתור
                        </label>
                    </div>
                </div>
                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={onCancel} disabled={loading}>
                        ביטול
                    </Button>
                    <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                        {loading ? 'מעביר...' : 'אישור העברה'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
