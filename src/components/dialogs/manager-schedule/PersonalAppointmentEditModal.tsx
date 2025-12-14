import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreHorizontal, Loader2, Trash2, X, ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { AppointmentDetailsSection } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"

interface ManagerAppointment {
    id: string
    startDateTime: string
    endDateTime: string
    stationName?: string
    stationId?: string
    personalAppointmentDescription?: string
    isPersonalAppointment?: boolean
    appointmentType?: string
}

interface ManagerStation {
    id: string
    name: string
    serviceType?: 'grooming' | 'garden'
}

interface PersonalAppointmentEditForm {
    name: string
    selectedStations: string[]
    finalizedTimes: {
        startTime: Date | null
        endTime: Date | null
        stationId: string | null
    } | null
}

interface PersonalAppointmentEditModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingPersonalAppointment: ManagerAppointment | null
    personalAppointmentEditForm: PersonalAppointmentEditForm
    setPersonalAppointmentEditForm: (form: PersonalAppointmentEditForm | ((prev: PersonalAppointmentEditForm) => PersonalAppointmentEditForm)) => void
    personalAppointmentEditLoading: boolean
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

export const PersonalAppointmentEditModal: React.FC<PersonalAppointmentEditModalProps> = ({
    open,
    onOpenChange,
    editingPersonalAppointment,
    personalAppointmentEditForm,
    setPersonalAppointmentEditForm,
    personalAppointmentEditLoading,
    stations = [],
    pendingResizeState,
    onCancel,
    onDelete,
    onConfirm
}) => {
    const groomingStations = stations.filter(station => station.serviceType === 'grooming')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto [&>button:has(svg)]:hidden" dir="rtl">
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
                        {editingPersonalAppointment && (
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
                                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => editingPersonalAppointment && onDelete(editingPersonalAppointment)}
                                        >
                                            <Trash2 className="h-4 w-4 ml-2" />
                                            מחק תור
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        <div className="flex-1">
                            <DialogTitle className="text-right text-purple-800">עריכת תור פרטי</DialogTitle>
                            <DialogDescription className="text-right text-purple-700">
                                עריכת פרטי התור הפרטי - שם, תאריך, שעות ועמדות
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current Appointment Info */}
                    {editingPersonalAppointment && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div
                                className="flex flex-col gap-x-3 gap-y-2 text-sm text-purple-700 flex justify-start"
                                dir="rtl"
                            >
                                <div className="flex gap-2">
                                    <span className="font-semibold text-purple-800 text-right">שם התור:</span>
                                    <span className="text-purple-700">
                                        {editingPersonalAppointment.personalAppointmentDescription || 'תור אישי'}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-purple-800 text-right">תאריך נוכחי:</span>
                                    <span className="text-purple-700">
                                        {new Date(editingPersonalAppointment.startDateTime).toLocaleDateString('he-IL')}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-purple-800 text-right">שעות נוכחיות:</span>
                                    <span className="text-purple-700">
                                        {format(new Date(editingPersonalAppointment.startDateTime), 'HH:mm')} -{' '}
                                        {format(new Date(editingPersonalAppointment.endDateTime), 'HH:mm')}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <span className="font-semibold text-purple-800 text-right">עמדה:</span>
                                    <span className="text-purple-700">
                                        {editingPersonalAppointment.stationName || 'לא זמין'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit Form */}
                    <div className="space-y-4">
                        {/* Appointment Details Section (Date, Time, Station) */}
                        {personalAppointmentEditForm.finalizedTimes && (
                            <AppointmentDetailsSection
                                isOpen={open}
                                finalizedTimes={personalAppointmentEditForm.finalizedTimes}
                                stations={groomingStations}
                                onTimesChange={(times) => {
                                    setPersonalAppointmentEditForm(prev => ({
                                        ...prev,
                                        finalizedTimes: times
                                    }))
                                }}
                                theme="purple"
                                stationFilter={(station) => station.serviceType === 'grooming'}
                            />
                        )}

                        {/* Name/Description */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-purple-700 mb-2 text-right">
                                שם התור *
                            </label>
                            <input
                                type="text"
                                value={personalAppointmentEditForm.name}
                                onChange={(e) => setPersonalAppointmentEditForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="הכנס שם לתור הפרטי..."
                                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right bg-white"
                            />
                        </div>

                        {/* Duration Display */}
                        {editingPersonalAppointment && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-purple-700 text-right block">
                                    משך התור
                                </label>
                                <div className="w-full px-3 py-2 border border-purple-300 rounded-md text-right bg-purple-50 text-purple-700">
                                    {pendingResizeState && pendingResizeState.appointment.id === editingPersonalAppointment.id
                                        ? `${pendingResizeState.newDuration} דקות (שונה מ-${pendingResizeState.originalDuration} דקות)`
                                        : `${Math.round((new Date(editingPersonalAppointment.endDateTime).getTime() - new Date(editingPersonalAppointment.startDateTime).getTime()) / (1000 * 60))} דקות`
                                    }
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-purple-700 mb-2 text-right">
                                הערות (אופציונלי)
                            </label>
                            <textarea
                                value={personalAppointmentEditForm.notes || ''}
                                onChange={(e) => setPersonalAppointmentEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="הכנס הערות על התור הפרטי..."
                                rows={4}
                                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right bg-white resize-none"
                            />
                        </div>

                        {/* Additional Stations Selection */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-purple-700 mb-2 text-right">
                                עמדות נוספות (אופציונלי)
                            </label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-between text-right border-purple-300 hover:bg-purple-50",
                                            personalAppointmentEditForm.selectedStations.length === 0 && "text-gray-500"
                                        )}
                                    >
                                        {personalAppointmentEditForm.selectedStations.length === 0
                                            ? "בחר עמדות נוספות..."
                                            : `${personalAppointmentEditForm.selectedStations.length} עמדות נבחרו`
                                        }
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                                    <div className="max-h-60 overflow-y-auto">
                                        {groomingStations.map(station => (
                                            <div key={station.id} className="flex items-center justify-between p-2 hover:bg-purple-50" dir="rtl">
                                                <Checkbox
                                                    id={station.id}
                                                    checked={personalAppointmentEditForm.selectedStations.includes(station.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setPersonalAppointmentEditForm(prev => ({
                                                                ...prev,
                                                                selectedStations: [...prev.selectedStations, station.id]
                                                            }))
                                                        } else {
                                                            setPersonalAppointmentEditForm(prev => ({
                                                                ...prev,
                                                                selectedStations: prev.selectedStations.filter(id => id !== station.id)
                                                            }))
                                                        }
                                                    }}
                                                />
                                                <label
                                                    htmlFor={station.id}
                                                    className="flex-1 text-right mr-2 text-sm text-purple-700 cursor-pointer"
                                                >
                                                    {station.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={personalAppointmentEditLoading || !personalAppointmentEditForm.name.trim()}
                    >
                        {personalAppointmentEditLoading ? (
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

