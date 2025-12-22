import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Clock, MoreHorizontal, Info, Loader2, Trash2, X, Pencil, FileText } from "lucide-react"
import { format, addMinutes } from "date-fns"

interface ManagerAppointment {
    id: string
    startDateTime: string
    endDateTime: string
    stationName?: string
    stationId?: string
    clientName?: string
    dogs: Array<{ name: string }>
    serviceType: 'grooming' | 'garden'
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
    groomingNotes: string
    workerId: string | null
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
    workers?: Array<{ id: string; full_name: string }>
    isLoadingWorkers?: boolean
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
    workers = [],
    isLoadingWorkers = false,
    pendingResizeState,
    onCancel,
    onDelete,
    onConfirm
}) => {
    const [isEditingNotes, setIsEditingNotes] = useState(false)

    // Reset editing state when dialog closes
    React.useEffect(() => {
        if (!open) {
            setIsEditingNotes(false)
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto [&>button:has(svg)]:hidden"
                dir="rtl"
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement
                    if (!target) return

                    // Check the composed path (includes shadow DOM and portals)
                    const path = e.composedPath ? e.composedPath() : []
                    const isInPickerPortal = path.some((node) => {
                        if (node instanceof Element) {
                            return (
                                node.hasAttribute("data-date-picker-portal") ||
                                node.hasAttribute("data-time-picker-portal") ||
                                node.closest("[data-date-picker-portal]") !== null ||
                                node.closest("[data-time-picker-portal]") !== null
                            )
                        }
                        return false
                    })

                    // Also check the target directly
                    const isInDatePicker = target.closest("[data-date-picker-portal]") !== null
                    const isInTimePicker = target.closest("[data-time-picker-portal]") !== null
                    const isDatePickerElement = target.hasAttribute("data-date-picker-portal")
                    const isTimePickerElement = target.hasAttribute("data-time-picker-portal")

                    if (isInPickerPortal || isInDatePicker || isInTimePicker || isDatePickerElement || isTimePickerElement) {
                        e.preventDefault()
                        // Don't stop propagation - let the click reach the picker buttons
                    }
                }}
                onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement
                    if (!target) return

                    // Check the composed path (includes shadow DOM and portals)
                    const path = e.composedPath ? e.composedPath() : []
                    const isInPickerPortal = path.some((node) => {
                        if (node instanceof Element) {
                            return (
                                node.hasAttribute("data-date-picker-portal") ||
                                node.hasAttribute("data-time-picker-portal") ||
                                node.closest("[data-date-picker-portal]") !== null ||
                                node.closest("[data-time-picker-portal]") !== null
                            )
                        }
                        return false
                    })

                    // Also check the target directly
                    const isInDatePicker = target.closest("[data-date-picker-portal]") !== null
                    const isInTimePicker = target.closest("[data-time-picker-portal]") !== null
                    const isDatePickerElement = target.hasAttribute("data-date-picker-portal")
                    const isTimePickerElement = target.hasAttribute("data-time-picker-portal")

                    if (isInPickerPortal || isInDatePicker || isInTimePicker || isDatePickerElement || isTimePickerElement) {
                        e.preventDefault()
                        // Don't stop propagation - let the click reach the picker buttons
                    }
                }}
            >
                {/* Custom close button positioned on the left for RTL */}
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute left-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 !block"
                    tabIndex={-1}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                <DialogHeader className="text-right">
                    <div className="flex items-start justify-between gap-4 mb-2 mt-6 flex-row-reverse">
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

                <div className="space-y-4" dir="rtl">
                    {/* Current Appointment Info */}
                    {editingGroomingAppointment && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                            <div
                                className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700"
                                dir="rtl"
                            >
                                <div className="flex gap-1">
                                    <span className="font-semibold text-gray-800 text-right">לקוח:</span>
                                    <span className="text-gray-700">
                                        {editingGroomingAppointment.dogs[0]?.name || 'לא זמין'}
                                    </span>
                                </div>

                                <div className="flex gap-1">
                                    <span className="font-semibold text-gray-800 text-right">בעלים:</span>
                                    <span className="text-gray-700">
                                        {editingGroomingAppointment.clientName || 'לא זמין'}
                                    </span>
                                </div>

                                <div className="flex gap-1">
                                    <span className="font-semibold text-gray-800 text-right">עמדה:</span>
                                    <span className="text-gray-700">
                                        {editingGroomingAppointment.stationName || 'לא זמין'}
                                    </span>
                                </div>

                                <div className="flex gap-1">
                                    <span className="font-semibold text-gray-800 text-right">תאריך נוכחי:</span>
                                    <span className="text-gray-700">
                                        {new Date(editingGroomingAppointment.startDateTime).toLocaleDateString('he-IL')}
                                    </span>
                                </div>

                                <div className="flex gap-1 col-span-2">
                                    <span className="font-semibold text-gray-800 text-right">שעות נוכחיות:</span>
                                    <span className="text-gray-700">
                                        {format(new Date(editingGroomingAppointment.startDateTime), 'HH:mm')} -{' '}
                                        {format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit Form */}
                    <div className="space-y-4">
                        {/* Date Selection and Station Selection */}
                        <div className="grid grid-cols-2 gap-4" dir="rtl">
                            {/* Date Selection - appears first (right) */}
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
                                    className="px-3 py-2 border border-gray-300 focus-visible:ring-primary focus-visible:border-primary"
                                />
                            </div>

                            {/* Station Selection - appears second (left) */}
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
                        </div>

                        {/* Worker Selection */}
                        <div className="space-y-2" dir="rtl">
                            <label className="text-sm font-medium text-gray-700 text-right block">
                                עובד משויך (אופציונלי)
                            </label>
                            <select
                                value={groomingEditForm.workerId || ""}
                                onChange={(e) => setGroomingEditForm(prev => ({
                                    ...prev,
                                    workerId: e.target.value || null
                                }))}
                                disabled={groomingEditLoading || isLoadingWorkers}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right"
                            >
                                <option value="">ללא עובד</option>
                                {workers.map((worker) => (
                                    <option key={worker.id} value={worker.id}>
                                        {worker.full_name || 'עובד ללא שם'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Time Selection */}
                        <div className="space-y-4" dir="rtl">
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
                                        className="px-3 py-2 border border-gray-300 focus-visible:ring-primary focus-visible:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 text-right block">
                                        שעת סיום
                                    </label>
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-right bg-gray-50 text-gray-600 flex items-center">
                                        {editingGroomingAppointment && (() => {
                                            try {
                                                // Validate inputs
                                                if (!groomingEditForm.startTime || !groomingEditForm.date) {
                                                    // Fallback to original end time
                                                    return format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')
                                                }

                                                // Calculate end time from start time + duration
                                                const timeParts = groomingEditForm.startTime.split(':')
                                                if (timeParts.length !== 2) {
                                                    return format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')
                                                }

                                                const [startHour, startMinute] = timeParts.map(Number)
                                                if (isNaN(startHour) || isNaN(startMinute)) {
                                                    return format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')
                                                }

                                                const startDateTime = new Date(
                                                    groomingEditForm.date.getFullYear(),
                                                    groomingEditForm.date.getMonth(),
                                                    groomingEditForm.date.getDate(),
                                                    startHour,
                                                    startMinute
                                                )

                                                // Validate the date
                                                if (isNaN(startDateTime.getTime())) {
                                                    return format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')
                                                }

                                                let durationMinutes: number
                                                if (pendingResizeState && pendingResizeState.appointment.id === editingGroomingAppointment.id) {
                                                    durationMinutes = pendingResizeState.newDuration
                                                } else {
                                                    durationMinutes = Math.round(
                                                        (new Date(editingGroomingAppointment.endDateTime).getTime() -
                                                            new Date(editingGroomingAppointment.startDateTime).getTime()) / (1000 * 60)
                                                    )
                                                }

                                                const calculatedEndTime = addMinutes(startDateTime, durationMinutes)

                                                // Validate the calculated end time
                                                if (isNaN(calculatedEndTime.getTime())) {
                                                    return format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')
                                                }

                                                return format(calculatedEndTime, 'HH:mm')
                                            } catch (error) {
                                                console.error('Error calculating end time:', error)
                                                // Fallback to original end time
                                                return format(new Date(editingGroomingAppointment.endDateTime), 'HH:mm')
                                            }
                                        })()}
                                    </div>
                                </div>
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

                        {/* Customer Notes - Read-only with edit button */}
                        <div className="space-y-2 border-b pb-4" dir="rtl">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 text-right flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                    משהו שחשוב שנדע
                                </label>
                                {!isEditingNotes && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditingNotes(true)}
                                        className="h-8 px-2"
                                        disabled={groomingEditLoading}
                                    >
                                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                    </Button>
                                )}
                            </div>
                            {isEditingNotes ? (
                                <>
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
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-500 text-right">
                                            הערות אלו נראות גם ללקוח וגם לצוות
                                        </p>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsEditingNotes(false)}
                                            className="h-7 px-2 text-xs"
                                            disabled={groomingEditLoading}
                                        >
                                            סיים עריכה
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-gray-50 rounded-md p-3 min-h-[60px]">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap text-right">
                                        {groomingEditForm.notes || <span className="text-gray-400">אין הערות</span>}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Additional Notes - Collapsible sections */}
                        <Accordion type="multiple" className="w-full" dir="rtl">
                            <AccordionItem value="internal-notes" className="border-b">
                                <AccordionTrigger className="text-right hover:no-underline py-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <FileText className="h-4 w-4 text-primary/60" />
                                        <span className="font-medium">הערות פנימיות</span>
                                        {groomingEditForm.internalNotes ? (
                                            <span className="text-xs text-gray-500 line-clamp-1">
                                                • {groomingEditForm.internalNotes.length > 60
                                                    ? `${groomingEditForm.internalNotes.substring(0, 60)}...`
                                                    : groomingEditForm.internalNotes}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">• אין נתונים</span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2 pt-2">
                                        <textarea
                                            value={groomingEditForm.internalNotes}
                                            onChange={(e) => setGroomingEditForm(prev => ({
                                                ...prev,
                                                internalNotes: e.target.value
                                            }))}
                                            placeholder="הערות פנימיות לצוות..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none min-h-[100px]"
                                        />
                                        <p className="text-xs text-primary text-right">
                                            הערות אלו נראות רק לצוות ולא ללקוח
                                        </p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="grooming-notes" className="border-b">
                                <AccordionTrigger className="text-right hover:no-underline py-3">
                                    <div className="flex items-center gap-2 flex-1">
                                        <FileText className="h-4 w-4 text-purple-400" />
                                        <span className="font-medium">מה עשינו היום</span>
                                        {groomingEditForm.groomingNotes ? (
                                            <span className="text-xs text-gray-500 line-clamp-1">
                                                • {groomingEditForm.groomingNotes.length > 60
                                                    ? `${groomingEditForm.groomingNotes.substring(0, 60)}...`
                                                    : groomingEditForm.groomingNotes}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">• אין נתונים</span>
                                        )}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2 pt-2">
                                        <textarea
                                            value={groomingEditForm.groomingNotes}
                                            onChange={(e) => setGroomingEditForm(prev => ({
                                                ...prev,
                                                groomingNotes: e.target.value
                                            }))}
                                            placeholder="הערות ספציפיות לתספורת של תור זה..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none min-h-[100px]"
                                        />
                                        <p className="text-xs text-purple-600 text-right">
                                            הערות ספציפיות לתספורת של תור זה (שונות מהערות הכלליות של הלקוח)
                                        </p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>

                {/* Update Customer Checkbox */}
                <div className="py-4 border-t border-gray-200" dir="rtl">
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md p-3">
                        <label htmlFor="updateCustomerGrooming" className="text-sm text-primary font-medium text-right cursor-pointer flex-1">
                            עדכן את הלקוח על השינויים בתור
                        </label>
                        <input
                            type="checkbox"
                            id="updateCustomerGrooming"
                            checked={updateCustomerGrooming}
                            onChange={(e) => setUpdateCustomerGrooming(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <Info className="h-4 w-4 text-primary flex-shrink-0" />
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={onConfirm}
                        className="bg-primary hover:bg-primary/90"
                        disabled={groomingEditLoading}
                    >
                        {groomingEditLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                שומר...
                            </>
                        ) : (
                            'שמור שינויים'
                        )}
                    </Button>
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
