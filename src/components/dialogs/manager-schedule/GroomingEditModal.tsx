import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"
import { Clock, MoreHorizontal, Info, Loader2, Trash2, X } from "lucide-react"
import { format } from "date-fns"

interface ManagerAppointment {
    id: string
    startDateTime: string
    endDateTime: string
    stationName?: string
    stationId?: string
    clientName?: string
    treatments: Array<{ name: string }>
    serviceType: 'grooming'
}

interface ManagerStation {
    id: string
    name: string
}

interface GroomingEditForm {
    date: Date
    startTime: string
    stationId: string
    notes: string
    internalNotes: string
}

interface GroomingEditModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingGroomingAppointment: ManagerAppointment | null
    groomingEditForm: GroomingEditForm
    setGroomingEditForm: (form: GroomingEditForm | ((prev: GroomingEditForm) => GroomingEditForm)) => void
    updateCustomerGrooming: boolean
    setUpdateCustomerGrooming: (update: boolean) => void
    groomingEditLoading: boolean
    stations?: ManagerStation[]
    pendingResizeState?: {
        appointment: ManagerAppointment
        originalEndTime: Date
        newEndTime: Date
        originalDuration: number
        newDuration: number
    } | null
    onCancel: () => void
    onDelete: (appointment: ManagerAppointment) => void
    onConfirm: () => void
}

export const GroomingEditModal: React.FC<GroomingEditModalProps> = ({
    open,
    onOpenChange,
    editingGroomingAppointment,
    groomingEditForm,
    setGroomingEditForm,
    updateCustomerGrooming,
    setUpdateCustomerGrooming,
    groomingEditLoading,
    stations = [],
    pendingResizeState,
    onCancel,
    onDelete,
    onConfirm
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto [&>button:has(svg)]:hidden">
                {/* Custom close button positioned on the left */}
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute left-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 !block"
                    tabIndex={-1}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                <DialogHeader>
                    <div className="flex items-start justify-between gap-4 mb-2 mt-6">
                        {editingGroomingAppointment && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 flex-shrink-0"
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-1" align="end">
                                    <div className="space-y-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => {/* Handle cancel appointment */ }}
                                        >
                                            <Clock className="h-4 w-4 ml-2" />
                                            בטל תור
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => editingGroomingAppointment && onDelete(editingGroomingAppointment)}
                                        >
                                            <Trash2 className="h-4 w-4 ml-2" />
                                            מחק תור
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        <div className="flex-1">
                            <DialogTitle className="text-right">עריכת תור מספרה</DialogTitle>
                            <DialogDescription className="text-right">
                                עריכת פרטי התור - תאריך, שעות ושירותים
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current Appointment Info */}
                    {editingGroomingAppointment && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div
                                className="flex flex-col gap-x-3 gap-y-2 text-sm text-gray-700 flex justify-start"
                                dir="rtl"
                            >
                                <div className="flex gap-2">
                                    <span className="font-semibold text-gray-800 text-right">לקוח:</span>
                                    <span className="text-gray-700">
                                        {editingGroomingAppointment.treatments[0]?.name || 'לא זמין'}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-gray-800 text-right">בעלים:</span>
                                    <span className="text-gray-700">
                                        {editingGroomingAppointment.clientName || 'לא זמין'}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-gray-800 text-right">תאריך נוכחי:</span>
                                    <span className="text-gray-700">
                                        {new Date(editingGroomingAppointment.startDateTime).toLocaleDateString('he-IL')}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-gray-800 text-right">שעות נוכחיות:</span>
                                    <span className="text-gray-700">
                                        {format(new Date(editingGroomingAppointment.startDateTime), 'HH:mm')} -{' '}
                                        {format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-gray-800 text-right">עמדה:</span>
                                    <span className="text-gray-700">
                                        {editingGroomingAppointment.stationName || 'לא זמין'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit Form */}
                    <div className="space-y-4">
                        {/* Date Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 text-right block">
                                תאריך התור
                            </label>
                            <DatePickerInput
                                value={groomingEditForm.date}
                                onChange={(selectedDate) =>
                                    setGroomingEditForm(prev => ({
                                        ...prev,
                                        date: selectedDate ?? prev.date
                                    }))
                                }
                                wrapperClassName="w-full"
                                className="px-3 py-2 border border-gray-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                            />
                        </div>

                        {/* Time Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 text-right block">
                                    שעת התחלה
                                </label>
                                <TimePickerInput
                                    value={groomingEditForm.startTime}
                                    onChange={(time) => setGroomingEditForm(prev => ({
                                        ...prev,
                                        startTime: time
                                    }))}
                                    intervalMinutes={15}
                                    wrapperClassName="w-full"
                                    className="px-3 py-2 border border-gray-300 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 text-right block">
                                    משך התור
                                </label>
                                <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-right bg-gray-50 text-gray-600">
                                    {editingGroomingAppointment && (
                                        pendingResizeState && pendingResizeState.appointment.id === editingGroomingAppointment.id
                                            ? `${pendingResizeState.newDuration} דקות (שונה מ-${pendingResizeState.originalDuration} דקות)`
                                            : `${Math.round((new Date(editingGroomingAppointment.endDateTime).getTime() - new Date(editingGroomingAppointment.startDateTime).getTime()) / (1000 * 60))} דקות`
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Station Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 text-right block">
                                עמדה
                            </label>
                            <select
                                value={groomingEditForm.stationId}
                                onChange={(e) => setGroomingEditForm(prev => ({
                                    ...prev,
                                    stationId: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right"
                            >
                                <option value="">בחר עמדה</option>
                                {stations?.map((station) => (
                                    <option key={station.id} value={station.id}>
                                        {station.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 text-right block">
                                הערות ללקוח
                            </label>
                            <textarea
                                value={groomingEditForm.notes}
                                onChange={(e) => setGroomingEditForm(prev => ({
                                    ...prev,
                                    notes: e.target.value
                                }))}
                                placeholder="הערות שיוצגו ללקוח..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none"
                                rows={2}
                            />
                        </div>

                        {/* Internal Notes */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 text-right block">
                                הערות פנימיות
                            </label>
                            <textarea
                                value={groomingEditForm.internalNotes}
                                onChange={(e) => setGroomingEditForm(prev => ({
                                    ...prev,
                                    internalNotes: e.target.value
                                }))}
                                placeholder="הערות פנימיות לצוות..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none"
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                {/* Update Customer Checkbox */}
                <div className="py-4 border-t border-gray-200">
                    <div className="flex items-center flex-row-reverse gap-2 space-x-2 rtl:space-x-reverse bg-blue-50 border border-blue-200 rounded-md p-3">
                        <Info className="h-4 w-4 text-blue-600" />
                        <input
                            type="checkbox"
                            id="updateCustomerGrooming"
                            checked={updateCustomerGrooming}
                            onChange={(e) => setUpdateCustomerGrooming(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="updateCustomerGrooming" className="text-sm text-blue-800 font-medium">
                            עדכן את הלקוח על השינויים בתור
                        </label>
                    </div>
                </div>

                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={groomingEditLoading}
                    >
                        {groomingEditLoading ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                שומר...
                            </>
                        ) : (
                            'שמור שינויים'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
