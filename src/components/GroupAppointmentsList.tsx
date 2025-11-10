import React from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ManagerAppointment } from '@/types/managerSchedule'
import type { CheckedState } from '@radix-ui/react-checkbox'

interface GroupAppointmentsListProps {
    appointments: ManagerAppointment[]
    groupId: string
    className?: string
    selectedAppointments: string[]
    onSelectionChange: (appointmentId: string, selected: boolean) => void
    onSelectAll: (selected: boolean) => void
    selectAllChecked: CheckedState
    isLoading?: boolean
    onAppointmentClick?: (appointment: ManagerAppointment) => void
}

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'מאושר': return 'bg-green-100 text-green-800'
        case 'ממתין': return 'bg-yellow-100 text-yellow-800'
        case 'בוטל': return 'bg-red-100 text-red-800'
        case 'הושלם': return 'bg-blue-100 text-blue-800'
        default: return 'bg-gray-100 text-gray-800'
    }
}

export const GroupAppointmentsList: React.FC<GroupAppointmentsListProps> = ({
    appointments,
    groupId,
    className,
    selectedAppointments,
    onSelectionChange,
    onSelectAll,
    selectAllChecked,
    isLoading = false,
    onAppointmentClick
}) => {
    console.log(appointments)

    if (isLoading) {
        return (
            <div className={cn("flex items-center justify-center py-8", className)}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (appointments.length === 0) {
        return (
            <div className={cn("text-center py-4 text-gray-500", className)}>
                לא נמצאו תורים בקבוצה זו
            </div>
        )
    }

    return (
        <div className={cn("space-y-3", className)}>
            <div className="text-sm font-medium text-gray-700 text-right">
                קבוצת תורים: {groupId}
            </div>

            <ScrollArea className="h-64 w-full">
                <div className="space-y-2 pr-4">
                    {appointments.map((appointment) => {
                        const startDate = new Date(appointment.startDateTime)
                        const endDate = new Date(appointment.endDateTime)
                        const primaryTreatment = appointment.treatments[0]
                        const treatmentName = primaryTreatment?.name ?? "ללא שיוך לכלב"
                        const isSelected = selectedAppointments.includes(appointment.id)

                        return (
                            <div
                                key={appointment.id}
                                className={cn(
                                    "flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm",
                                    onAppointmentClick && "cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
                                )}
                                onClick={(e) => {
                                    // Don't trigger click if clicking on checkbox or its label
                                    if (onAppointmentClick && !(e.target as HTMLElement).closest('.checkbox-target')) {
                                        onAppointmentClick(appointment)
                                    }
                                }}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="text-center min-w-[120px]">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {format(startDate, 'HH:mm', { locale: he })} - {format(endDate, 'HH:mm', { locale: he })}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {format(startDate, 'dd.MM.yyyy', { locale: he })}
                                        </div>
                                    </div>

                                    <div className="flex-1 text-right">
                                        <div className="text-sm font-medium text-gray-900">
                                            {appointment.isPersonalAppointment
                                                ? (appointment.personalAppointmentDescription || "תור אישי")
                                                : treatmentName
                                            }
                                        </div>

                                        {!appointment.isPersonalAppointment && primaryTreatment?.treatmentType && (
                                            <div className="text-xs text-gray-500">
                                                {primaryTreatment.treatmentType}
                                            </div>
                                        )}

                                        <div className="text-xs text-gray-500 ">
                                            {appointment.stationName}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={cn("text-xs font-medium ml-4", getStatusColor(appointment.status))}
                                    >
                                        {appointment.status}
                                    </Badge>

                                    {appointment.isPersonalAppointment && (
                                        <Badge
                                            variant="outline"
                                            className="text-xs font-medium bg-purple-100 text-purple-800"
                                        >
                                            תור אישי
                                        </Badge>
                                    )}
                                </div>

                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="checkbox-target"
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => onSelectionChange(appointment.id, checked === true)}
                                        className="flex-shrink-0 ml-2"
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>

            <div className="flex items-center space-x-2 rtl:space-x-reverse mb-4">
                <Checkbox
                    checked={selectAllChecked}
                    onCheckedChange={(checked) => onSelectAll(checked === true)}
                    className="rounded border-gray-300"
                />
                <label className="text-sm text-gray-700">
                    בחר הכל ({appointments.length} תורים)
                </label>
            </div>

            <div className="text-xs text-gray-500 text-right mb-4">
                סה"כ {appointments.length} תורים בקבוצה
            </div>
        </div>
    )
}
