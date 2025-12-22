import React from 'react'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ManagerAppointment } from '@/pages/ManagerSchedule/types'
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
    currentAppointmentId?: string
}

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'מאושר': return 'bg-green-100 text-green-800'
        case 'ממתין': return 'bg-yellow-100 text-yellow-800'
        case 'בוטל': return 'bg-red-100 text-red-800'
        case 'הושלם': return 'bg-primary/20 text-primary'
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
    onAppointmentClick,
    currentAppointmentId
}) => {
    console.log(appointments)

    if (isLoading) {
        return (
            <div className={cn("flex items-center justify-center py-8", className)}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            <ScrollArea className="h-64 w-full">
                <div className="pr-4">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-center py-2 px-4 text-xs font-medium text-gray-700">תאריך ושעה</th>
                                <th className="text-center py-2 px-4 text-xs font-medium text-gray-700">לקוח / תור</th>
                                <th className="text-center py-2 px-4 text-xs font-medium text-gray-700 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map((appointment) => {
                                const startDate = new Date(appointment.startDateTime)
                                const endDate = new Date(appointment.endDateTime)
                                const primaryDog = appointment.dogs[0]
                                const dogName = primaryDog?.name ?? "ללא שיוך ללקוח"
                                const isSelected = selectedAppointments.includes(appointment.id)
                                const isCurrentAppointment = currentAppointmentId === appointment.id

                                return (
                                    <tr
                                        key={appointment.id}
                                        className={cn(
                                            "border-b border-gray-100",
                                            isCurrentAppointment && "bg-red-50",
                                            onAppointmentClick && "cursor-pointer hover:bg-gray-50 transition-colors"
                                        )}
                                        onClick={(e) => {
                                            // Don't trigger click if clicking on checkbox
                                            if (onAppointmentClick && !(e.target as HTMLElement).closest('.checkbox-target')) {
                                                onAppointmentClick(appointment)
                                            }
                                        }}
                                    >
                                        <td className="py-2 px-4 text-sm text-center">
                                            <div className="font-medium text-gray-900 whitespace-nowrap">
                                                {format(startDate, 'dd.MM.yyyy', { locale: he })} {format(startDate, 'HH:mm', { locale: he })} - {format(endDate, 'HH:mm', { locale: he })}
                                            </div>
                                        </td>
                                        <td className="py-2 px-4 text-sm text-center">
                                            <div className="flex items-center gap-2 justify-center">
                                                <div className="text-gray-900 whitespace-nowrap">
                                                    {appointment.isPersonalAppointment
                                                        ? (appointment.personalAppointmentDescription || "תור אישי")
                                                        : dogName
                                                    }
                                                </div>
                                                {isCurrentAppointment && (
                                                    <Badge variant="outline" className="text-xs bg-red-100 text-red-800 border-red-300 whitespace-nowrap">
                                                        התור הנוכחי
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className="checkbox-target flex justify-center"
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => onSelectionChange(appointment.id, checked === true)}
                                                    className="flex-shrink-0"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </ScrollArea>

            <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <Checkbox
                    checked={selectAllChecked}
                    onCheckedChange={(checked) => onSelectAll(checked === true)}
                    className="rounded border-gray-300"
                />
                <label className="text-sm text-gray-700">
                    בחר הכל ({appointments.length} תורים)
                </label>
            </div>
        </div>
    )
}
