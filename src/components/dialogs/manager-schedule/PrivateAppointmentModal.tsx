import React, { useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppointmentDetailsSection, type AppointmentStation, type AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"

type ManagerStation = AppointmentStation & { serviceType: 'grooming' | 'garden' }

type FinalizedDragTimes = AppointmentTimes

interface PrivateAppointmentForm {
    name: string
    selectedStations: string[]
}

interface PrivateAppointmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    finalizedDragTimes: FinalizedDragTimes | null
    privateAppointmentForm: PrivateAppointmentForm
    setPrivateAppointmentForm: (form: PrivateAppointmentForm | ((prev: PrivateAppointmentForm) => PrivateAppointmentForm)) => void
    createPrivateAppointmentLoading: boolean
    stations?: ManagerStation[]
    onCancel: () => void
    onConfirm: () => void
    onUpdateTimes?: (times: FinalizedDragTimes) => void
}

export const PrivateAppointmentModal: React.FC<PrivateAppointmentModalProps> = ({
    open,
    onOpenChange,
    finalizedDragTimes,
    privateAppointmentForm,
    setPrivateAppointmentForm,
    createPrivateAppointmentLoading,
    stations = [],
    onCancel,
    onConfirm,
    onUpdateTimes
}) => {
    // Auto-check the current station when modal opens
    useEffect(() => {
        if (open && finalizedDragTimes?.stationId && !privateAppointmentForm.selectedStations.includes(finalizedDragTimes.stationId)) {
            setPrivateAppointmentForm(prev => ({
                ...prev,
                selectedStations: [...prev.selectedStations, finalizedDragTimes.stationId!]
            }))
        }
    }, [open, finalizedDragTimes?.stationId, privateAppointmentForm.selectedStations, setPrivateAppointmentForm])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">יצירת תור פרטי</DialogTitle>
                    <DialogDescription className="text-right">
                        צור תור פרטי עם הערות אישיות
                    </DialogDescription>
                </DialogHeader>

                {finalizedDragTimes && (
                    <div className="py-4">
                        <AppointmentDetailsSection
                            isOpen={open}
                            finalizedTimes={finalizedDragTimes}
                            stations={stations}
                            onTimesChange={(times) => {
                                if (onUpdateTimes) {
                                    onUpdateTimes(times)
                                }
                            }}
                            theme="purple"
                            stationFilter={(station) => station.serviceType === 'grooming'}
                        />

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                                    שם התור *
                                </label>
                                <input
                                    type="text"
                                    value={privateAppointmentForm.name}
                                    onChange={(e) => setPrivateAppointmentForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="הכנס שם לתור הפרטי..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                                    עמדות נוספות (אופציונלי)
                                </label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-between text-right",
                                                privateAppointmentForm.selectedStations.length === 0 && "text-gray-500"
                                            )}
                                        >
                                            {privateAppointmentForm.selectedStations.length === 0
                                                ? "בחר עמדות נוספות..."
                                                : `${privateAppointmentForm.selectedStations.length} עמדות נבחרו`
                                            }
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                                        <div className="max-h-60 overflow-y-auto">
                                            {stations.filter(station => station.serviceType === 'grooming').map(station => (
                                                <div key={station.id} className="flex items-center justify-between p-2 hover:bg-gray-50" dir="rtl">
                                                    <Checkbox
                                                        id={station.id}
                                                        checked={privateAppointmentForm.selectedStations.includes(station.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setPrivateAppointmentForm(prev => ({
                                                                    ...prev,
                                                                    selectedStations: [...prev.selectedStations, station.id]
                                                                }))
                                                            } else {
                                                                setPrivateAppointmentForm(prev => ({
                                                                    ...prev,
                                                                    selectedStations: prev.selectedStations.filter(id => id !== station.id)
                                                                }))
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={station.id}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-right flex-1 mr-2"
                                                    >
                                                        {station.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <div className="text-xs text-gray-500 text-right mt-1">
                                    בחר עמדות נוספות אם התור צריך להתבצע במקביל
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter dir="ltr">
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                        disabled={!privateAppointmentForm.name.trim() || createPrivateAppointmentLoading}
                    >
                        {createPrivateAppointmentLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                                יוצר...
                            </>
                        ) : (
                            'צור תור פרטי'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
