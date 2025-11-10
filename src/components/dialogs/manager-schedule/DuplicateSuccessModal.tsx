import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, ChevronLeft } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface CreatedAppointment {
    startTime: string
    endTime: string
    recordID: string
    serviceType: string
    appointmentId: string
    appointmentType: string
}

interface DuplicateSuccessModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointments: CreatedAppointment[]
    onAppointmentClick: (appointment: CreatedAppointment) => void
}

export const DuplicateSuccessModal: React.FC<DuplicateSuccessModalProps> = ({
    open,
    onOpenChange,
    appointments,
    onAppointmentClick
}) => {
    const getServiceLabel = (serviceType: string) => {
        return serviceType === 'garden' ? 'גן' : 'מספרה'
    }

    const getServiceStyle = (serviceType: string) => {
        return serviceType === 'garden'
            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
            : "border-blue-200 bg-blue-100 text-blue-800"
    }

    const getAppointmentTypeLabel = (appointmentType: string) => {
        return appointmentType === 'אישי' ? 'אישי' : 'עסקי'
    }

    return (
        <Dialog open={open} onOpenChange={undefined} modal={true}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" dir="rtl">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                        <DialogTitle className="text-right">סדרת תורים נוצרה בהצלחה!</DialogTitle>
                    </div>
                    <DialogDescription className="text-right">
                        נוצרו {appointments.length} תורים חוזרים. לחץ על תור כדי לפתוח את פרטיו.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-1">
                    <div className="space-y-3">
                        {appointments.map((appointment, index) => {
                            const startDate = new Date(appointment.startTime)
                            const endDate = new Date(appointment.endTime)

                            return (
                                <div
                                    key={appointment.recordID || index}
                                    onClick={() => onAppointmentClick(appointment)}
                                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className={cn("text-xs", getServiceStyle(appointment.serviceType))}>
                                                    {getServiceLabel(appointment.serviceType)}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    {getAppointmentTypeLabel(appointment.appointmentType)}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-4 w-4 text-gray-500" />
                                                    <span className="font-medium">
                                                        {format(startDate, 'dd/MM/yyyy')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-4 w-4 text-gray-500" />
                                                    <span>
                                                        {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <ChevronLeft className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <DialogFooter dir="ltr" className="justify-end">
                    <Button onClick={() => onOpenChange(false)}>
                        סגור
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
