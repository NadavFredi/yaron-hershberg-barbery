import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DatePickerInput } from "@/components/DatePickerInput"
import { Info } from "lucide-react"
import { format, addWeeks, startOfDay } from "date-fns"

interface ManagerAppointment {
    id: string
    startDateTime: string
    endDateTime: string
    serviceType: 'grooming' | 'garden'
    dogs: Array<{ name: string }>
    clientName?: string
    appointmentGroupId?: string
}

interface DuplicateSeriesModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: ManagerAppointment | null
    onConfirm: (data: {
        weeksInterval: number
        repeatType: 'count' | 'endDate'
        repeatCount?: number
        endDate?: string
        startDate?: string
    }) => void
    onCancel: () => void
    loading?: boolean
}

export const DuplicateSeriesModal: React.FC<DuplicateSeriesModalProps> = ({
    open,
    onOpenChange,
    appointment,
    onConfirm,
    onCancel,
    loading = false
}) => {
    const [weeksInterval, setWeeksInterval] = useState(1)
    const [repeatType, setRepeatType] = useState<'count' | 'endDate'>('count')
    const [repeatCount, setRepeatCount] = useState(4)
    const [endDate, setEndDate] = useState<Date | null>(null)

    // Default start date is next week from today
    const getDefaultStartDate = () => {
        const nextWeek = addWeeks(startOfDay(new Date()), 1)
        return nextWeek
    }
    const [startDate, setStartDate] = useState<Date | null>(getDefaultStartDate())

    // Reset start date when modal opens
    useEffect(() => {
        if (open) {
            setStartDate(getDefaultStartDate())
        }
    }, [open])

    const handleConfirm = () => {
        if (!startDate) {
            alert('יש לבחור תאריך התחלה')
            return
        }
        if (repeatType === 'count' && repeatCount < 1) {
            alert('מספר החזרות חייב להיות לפחות 1')
            return
        }
        if (repeatType === 'endDate' && !endDate) {
            alert('יש לבחור תאריך סיום')
            return
        }

        onConfirm({
            weeksInterval,
            repeatType,
            repeatCount: repeatType === 'count' ? repeatCount : undefined,
            endDate: repeatType === 'endDate' ? endDate?.toISOString() : undefined,
            startDate: startDate.toISOString()
        })
    }

    const handleCancel = () => {
        // Reset form
        setWeeksInterval(1)
        setRepeatType('count')
        setRepeatCount(4)
        setEndDate(null)
        setStartDate(getDefaultStartDate())
        onCancel()
    }

    return (
        <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
            <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">שכפול תור כסדרה חוזרת</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את הפרמטרים לסדרת התורים החוזרת
                    </DialogDescription>
                </DialogHeader>

                {appointment && (
                    <div className="space-y-6">
                        {/* Appointment Details */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">פרטי התור המקורי</h3>
                            <div className="space-y-2 text-sm">
                                <div><span className="font-medium">כלב:</span> {appointment.dogs[0]?.name || 'לא ידוע'}</div>
                                <div><span className="font-medium">לקוח:</span> {appointment.clientName || 'לא ידוע'}</div>
                                <div><span className="font-medium">זמן:</span> {format(new Date(appointment.startDateTime), 'HH:mm')} - {format(new Date(appointment.endDateTime), 'HH:mm')}</div>
                                <div><span className="font-medium">שירות:</span> {appointment.serviceType === 'garden' ? 'גן' : 'מספרה'}</div>
                                {appointment.appointmentGroupId && (
                                    <div><span className="font-medium">מזהה קבוצת תורים:</span> {appointment.appointmentGroupId}</div>
                                )}
                            </div>
                        </div>

                        {/* Recurrence Settings */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium text-gray-700">
                                    החל מ-
                                </Label>
                                <DatePickerInput
                                    value={startDate}
                                    onChange={setStartDate}
                                    disabled={loading}
                                    autoOpenOnFocus={false}
                                    className="w-40"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="weeksInterval" className="text-sm font-medium text-gray-700">
                                    חזור כל כמה שבועות?
                                </Label>
                                <span className="text-sm text-gray-600">שבועות</span>
                                <Input
                                    id="weeksInterval"
                                    type="number"
                                    min="1"
                                    value={weeksInterval}
                                    onChange={(e) => setWeeksInterval(parseInt(e.target.value) || 1)}
                                    className="w-16 text-right"
                                    disabled={loading}
                                />

                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700 text-right block">
                                    מתי להפסיק את הסדרה?
                                </Label>
                                <RadioGroup value={repeatType} onValueChange={(value) => setRepeatType(value as 'count' | 'endDate')} disabled={loading}>
                                    <div className="flex items-center justify-end gap-2">
                                        <Label htmlFor="count" className="flex items-center gap-2">
                                            <span>פעמים</span>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={repeatCount}
                                                onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                                                className="w-12 text-right"
                                                disabled={loading || repeatType !== 'count'}
                                            />
                                            <span>חזור</span>
                                        </Label>
                                        <RadioGroupItem value="count" id="count" />
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        <Label htmlFor="endDate" className="flex items-center gap-2">
                                            <DatePickerInput
                                                value={endDate}
                                                onChange={setEndDate}
                                                disabled={loading || repeatType !== 'endDate'}
                                                autoOpenOnFocus={false}
                                                className="w-40"
                                            />
                                            <span>:עד לתאריך</span>
                                        </Label>
                                        <RadioGroupItem value="endDate" id="endDate" />
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        {/* Info Banner */}
                        <div className="py-3 border-t border-gray-200">
                            <div className="flex items-center gap-2 space-x-2 rtl:space-x-reverse bg-blue-50 border border-blue-200 rounded-md p-3">
                                <Info className="h-5 w-5 text-blue-600" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium">מידע חשוב:</p>
                                    <p>התורים החוזרים ייווצרו עם אותם פרטים כמו התור המקורי. אם התור כבר שייך לקבוצה, התורים החדשים יצורפו לאותה קבוצה.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancel} disabled={loading}>
                        ביטול
                    </Button>
                    <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700" disabled={loading}>
                        {loading ? 'יוצר סדרה...' : 'צור סדרה חוזרת'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
