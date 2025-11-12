import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TimePickerInput } from "@/components/TimePickerInput"
import { CalendarIcon, Clock, Scissors, Wand2, Droplets, X, MoreHorizontal, Info, Loader2, Trash2 } from "lucide-react"
import { format } from "date-fns"

interface ManagerAppointment {
    id: string
    startDateTime: string
    endDateTime: string
    stationName?: string
    clientName?: string
    clientPhone?: string
    treatments: Array<{ name: string; treatmentType?: string }>
    serviceType: 'grooming' | 'garden'
    gardenAppointmentType?: 'full-day' | 'hourly' | 'trial'
    gardenIsTrial?: boolean
    notes?: string
    internalNotes?: string
    latePickupRequested?: boolean
    latePickupNotes?: string
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
}

interface GardenEditForm {
    date: Date
    startTime: string
    endTime: string
    appointmentType: 'full-day' | 'hourly' | 'trial'
    notes: string
    internalNotes: string
    latePickupRequested: boolean
    latePickupNotes: string
    gardenTrimNails: boolean
    gardenBrush: boolean
    gardenBath: boolean
}

interface GardenEditModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingAppointment: ManagerAppointment | null
    gardenEditForm: GardenEditForm
    setGardenEditForm: (form: GardenEditForm | ((prev: GardenEditForm) => GardenEditForm)) => void
    updateCustomerGarden: boolean
    setUpdateCustomerGarden: (update: boolean) => void
    gardenEditLoading: boolean
    onCancel: () => void
    onDelete: (appointment: ManagerAppointment) => void
    onConfirm: () => void
}

export const GardenEditModal: React.FC<GardenEditModalProps> = ({
    open,
    onOpenChange,
    editingAppointment,
    gardenEditForm,
    setGardenEditForm,
    updateCustomerGarden,
    setUpdateCustomerGarden,
    gardenEditLoading,
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
                        {editingAppointment && (
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
                                            onClick={() => editingAppointment && onDelete(editingAppointment)}
                                        >
                                            <Trash2 className="h-4 w-4 ml-2" />
                                            מחק תור
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        <div className="flex-1">
                            <DialogTitle className="text-right">עריכת תור גן</DialogTitle>
                            <DialogDescription className="text-right">
                                עריכת פרטי התור - תאריך, שעות, סוג תור ושירותים
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Current Appointment Info */}
                    {editingAppointment && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3 text-right">פרטי התור הנוכחיים</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">לקוח:</span> {editingAppointment.treatments[0]?.name || 'לא ידוע'}
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">גזע:</span> {editingAppointment.treatments[0]?.treatmentType || 'לא ידוע'}
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">בעלים:</span> {editingAppointment.clientName || 'לא ידוע'}
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">טלפון:</span> {editingAppointment.clientPhone || 'לא ידוע'}
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">תאריך נוכחי:</span> {format(new Date(editingAppointment.startDateTime), 'dd/MM/yyyy')}
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">שעות נוכחיות:</span> {
                                        editingAppointment.gardenAppointmentType === 'full-day'
                                            ? 'יום מלא'
                                            : `${format(new Date(editingAppointment.startDateTime), 'HH:mm')} - ${format(new Date(editingAppointment.endDateTime), 'HH:mm')}`
                                    }
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">סוג תור:</span> {
                                        editingAppointment.gardenAppointmentType === 'full-day' ? 'יום מלא' : 'שעתי'
                                    }
                                    {editingAppointment.gardenIsTrial && ' (ניסיון)'}
                                </div>
                                <div className="text-right">
                                    <span className="font-medium text-gray-600">שירותים:</span> {
                                        [
                                            editingAppointment.latePickupRequested && 'איסוף מאוחר',
                                            editingAppointment.gardenTrimNails && 'גזירת ציפורניים',
                                            editingAppointment.gardenBrush && 'סירוק',
                                            editingAppointment.gardenBath && 'רחצה'
                                        ].filter(Boolean).join(', ') || 'אין שירותים נוספים'
                                    }
                                </div>
                                {editingAppointment.notes && (
                                    <div className="md:col-span-2">
                                        <span className="font-medium text-gray-600 text-right block">הערות לקוח נוכחיות:</span>
                                        <div className="mt-1 p-2 bg-white border border-gray-200 rounded text-gray-700 text-right">
                                            {editingAppointment.notes}
                                        </div>
                                    </div>
                                )}
                                {editingAppointment.internalNotes && (
                                    <div className="md:col-span-2">
                                        <span className="font-medium text-gray-600 text-right block">הערות צוות נוכחיות:</span>
                                        <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800 text-right">
                                            {editingAppointment.internalNotes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Modify Section */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-right">עריכת פרטי התור</h3>

                        {/* Date and Time */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">תאריך</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full justify-end text-right font-normal"
                                        >
                                            {format(gardenEditForm.date, "dd/MM/yyyy")}
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={gardenEditForm.date}
                                            onSelect={(date) => date && setGardenEditForm(prev => ({ ...prev, date }))}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">סוג תור</label>
                                <Select
                                    value={gardenEditForm.appointmentType}
                                    onValueChange={(value: 'full-day' | 'hourly' | 'trial') =>
                                        setGardenEditForm(prev => ({ ...prev, appointmentType: value }))
                                    }
                                >
                                    <SelectTrigger className="text-right justify-end gap-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hourly">שעתי</SelectItem>
                                        <SelectItem value="full-day">יומי</SelectItem>
                                        <SelectItem value="trial">ניסיון</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Time Selection - For hourly and trial appointments */}
                        {(gardenEditForm.appointmentType === 'hourly' || gardenEditForm.appointmentType === 'trial') && (
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 text-right">שעת התחלה</label>
                                    <TimePickerInput
                                        value={gardenEditForm.startTime}
                                        onChange={(value) => setGardenEditForm(prev => ({ ...prev, startTime: value }))}
                                        intervalMinutes={15}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2 text-right">שעת סיום</label>
                                    <TimePickerInput
                                        value={gardenEditForm.endTime}
                                        onChange={(value) => setGardenEditForm(prev => ({ ...prev, endTime: value }))}
                                        intervalMinutes={15}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Garden Services */}
                        <div className="space-y-4 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 text-right">שירותי גן</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center justify-end gap-2">
                                    <label htmlFor="latePickup" className="text-sm font-medium text-gray-700 text-right flex items-center gap-2">
                                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-yellow-100 text-yellow-600">
                                            <Clock className="h-3 w-3" />
                                        </div>
                                        איסוף מאוחר
                                    </label>
                                    <Checkbox
                                        id="latePickup"
                                        checked={gardenEditForm.latePickupRequested}
                                        onCheckedChange={(checked) =>
                                            setGardenEditForm(prev => ({ ...prev, latePickupRequested: !!checked }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <label htmlFor="trimNails" className="text-sm font-medium text-gray-700 text-right flex items-center gap-2">
                                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-600">
                                            <Scissors className="h-3 w-3" />
                                        </div>
                                        גזירת ציפורניים
                                    </label>
                                    <Checkbox
                                        id="trimNails"
                                        checked={gardenEditForm.gardenTrimNails}
                                        onCheckedChange={(checked) =>
                                            setGardenEditForm(prev => ({ ...prev, gardenTrimNails: !!checked }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <label htmlFor="brush" className="text-sm font-medium text-gray-700 text-right flex items-center gap-2">
                                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-600">
                                            <Wand2 className="h-3 w-3" />
                                        </div>
                                        סירוק
                                    </label>
                                    <Checkbox
                                        id="brush"
                                        checked={gardenEditForm.gardenBrush}
                                        onCheckedChange={(checked) =>
                                            setGardenEditForm(prev => ({ ...prev, gardenBrush: !!checked }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                    <label htmlFor="bath" className="text-sm font-medium text-gray-700 text-right flex items-center gap-2">
                                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600">
                                            <Droplets className="h-3 w-3" />
                                        </div>
                                        רחצה
                                    </label>
                                    <Checkbox
                                        id="bath"
                                        checked={gardenEditForm.gardenBath}
                                        onCheckedChange={(checked) =>
                                            setGardenEditForm(prev => ({ ...prev, gardenBath: !!checked }))
                                        }
                                    />
                                </div>
                            </div>

                            {/* Late Pickup Details */}
                            {gardenEditForm.latePickupRequested && (
                                <div className="mt-4">
                                    <label htmlFor="latePickupNotes" className="block text-sm font-medium text-gray-700 mb-2 text-right">
                                        פרטים על איסוף מאוחר
                                    </label>
                                    <input
                                        id="latePickupNotes"
                                        type="text"
                                        value={gardenEditForm.latePickupNotes}
                                        onChange={(e) => setGardenEditForm(prev => ({ ...prev, latePickupNotes: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                                        placeholder="פרטים על איסוף מאוחר..."
                                    />
                                </div>
                            )}
                        </div>

                        {/* Comments */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">הערות צוות פנימי</label>
                                <textarea
                                    value={gardenEditForm.internalNotes}
                                    onChange={(e) => setGardenEditForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                                    rows={3}
                                    placeholder="הערות פנימיות לצוות..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Update Customer Checkbox */}
                <div className="py-4 border-t border-gray-200">
                    <div className="flex items-center flex-row-reverse gap-2 space-x-2 rtl:space-x-reverse bg-blue-50 border border-blue-200 rounded-md p-3">
                        <Info className="h-4 w-4 text-blue-600" />
                        <input
                            type="checkbox"
                            id="updateCustomerGarden"
                            checked={updateCustomerGarden}
                            onChange={(e) => setUpdateCustomerGarden(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="updateCustomerGarden" className="text-sm text-blue-800 font-medium">
                            עדכן את הלקוח על השינויים בתור
                        </label>
                    </div>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={gardenEditLoading}
                    >
                        {gardenEditLoading ? (
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
