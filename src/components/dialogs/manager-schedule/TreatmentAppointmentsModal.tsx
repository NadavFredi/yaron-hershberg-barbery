import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { format, isSameDay } from "date-fns"
import { useGetMergedAppointmentsQuery } from "@/store/services/supabaseApi"
import type { ManagerAppointment } from "@/types/managerSchedule"

interface MergedAppointmentApiResponse {
    id: string
    treatmentId: string
    treatmentName: string
    date: string
    time: string
    service: "grooming" | "garden" | "both"
    status: string
    stationId: string
    notes: string
    groomingNotes?: string
    gardenNotes?: string
    groomingStatus?: string
    gardenStatus?: string
    startDateTime: string
    endDateTime: string
    groomingAppointmentId?: string
    gardenAppointmentId?: string
    latePickupRequested?: boolean
    latePickupNotes?: string
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
}

interface TreatmentAppointmentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    treatmentId: string
    treatmentName: string
    onAppointmentClick: (appointment: ManagerAppointment) => void
}

export const TreatmentAppointmentsModal: React.FC<TreatmentAppointmentsModalProps> = ({
    open,
    onOpenChange,
    treatmentId,
    treatmentName,
    onAppointmentClick
}) => {
    const [activeTab, setActiveTab] = useState<'today' | 'future' | 'past'>('today')

    // Fetch appointments for this specific treatment
    const { data: treatmentAppointmentsData, isLoading } = useGetMergedAppointmentsQuery(treatmentId, {
        skip: !open, // Only fetch when modal is open
    })

    // Transform merged appointments to ManagerAppointment format
    // The API transform already extracts the appointments array
    const transformedAppointments: ManagerAppointment[] = Array.isArray(treatmentAppointmentsData) ? treatmentAppointmentsData.map((apt: any) => ({
        id: apt.id,
        serviceType: apt.service === 'both' ? 'grooming' : apt.service as 'grooming' | 'garden',
        stationId: apt.stationId || '',
        stationName: apt.stationId || 'Unknown',
        startDateTime: apt.startDateTime,
        endDateTime: apt.endDateTime,
        status: apt.status || 'confirmed',
        notes: apt.notes || '',
        internalNotes: apt.groomingNotes || apt.gardenNotes || '',
        treatments: [{
            id: apt.treatmentId,
            name: apt.treatmentName,
            treatmentType: '',
            size: '',
            isSmall: false,
            ownerId: '',
            clientName: '',
            clientPhone: '',
            clientEmail: '',
            clientClassification: '',
            internalNotes: ''
        }],
        clientId: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        clientClassification: '',
        latePickupRequested: apt.latePickupRequested,
        latePickupNotes: apt.latePickupNotes,
        gardenTrimNails: apt.gardenTrimNails,
        gardenBrush: apt.gardenBrush,
        gardenBath: apt.gardenBath,
    })) : []

    // Reset active tab when modal closes
    useEffect(() => {
        if (!open) {
            setActiveTab('today')
        }
    }, [open])

    // Split into future, past, and today's appointments
    const now = new Date()

    const todayAppointments = transformedAppointments.filter(apt => {
        const aptDate = new Date(apt.startDateTime)
        return isSameDay(aptDate, now)
    }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))

    const futureAppointments = transformedAppointments.filter(apt => {
        const aptDate = new Date(apt.startDateTime)
        return aptDate > now && !isSameDay(aptDate, now)
    }).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))

    const pastAppointments = transformedAppointments.filter(apt => {
        const aptDate = new Date(apt.startDateTime)
        return aptDate < now && !isSameDay(aptDate, now)
    }).sort((a, b) => b.startDateTime.localeCompare(a.startDateTime))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">תורים של {treatmentName}</DialogTitle>
                    <DialogDescription className="text-right">
                        כל התורים (עתידיים וקודמים) של הלקוח
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <span className="mr-2 text-gray-500">טוען תורים...</span>
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'today' | 'future' | 'past')} dir="rtl" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="today" className="text-sm">
                                היום ({todayAppointments.length})
                            </TabsTrigger>
                            <TabsTrigger value="future" className="text-sm">
                                עתידיים ({futureAppointments.length})
                            </TabsTrigger>
                            <TabsTrigger value="past" className="text-sm">
                                קודמים ({pastAppointments.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="today" className="mt-4 space-y-2">
                            {todayAppointments.length > 0 ? (
                                <div className="space-y-2">
                                    {todayAppointments.map((appointment) => (
                                        <button
                                            key={appointment.id}
                                            type="button"
                                            onClick={() => {
                                                onAppointmentClick(appointment)
                                                onOpenChange(false)
                                            }}
                                            className="w-full text-right rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-colors"
                                        >
                                            <div className="text-sm font-semibold text-blue-900">
                                                {format(new Date(appointment.startDateTime), 'HH:mm')} - היום
                                            </div>
                                            <div className="text-xs text-blue-700 mt-1">
                                                {appointment.serviceType === 'garden' ? 'גן' : 'מספרה'} • {appointment.stationName}
                                                {appointment.notes && ` • ${appointment.notes.substring(0, 50)}${appointment.notes.length > 50 ? '...' : ''}`}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-sm text-gray-500 py-12 bg-blue-50 rounded-lg border border-blue-100">
                                    אין תורים היום
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="future" className="mt-4 space-y-2">
                            {futureAppointments.length > 0 ? (
                                <div className="space-y-2">
                                    {futureAppointments.map((appointment) => (
                                        <button
                                            key={appointment.id}
                                            type="button"
                                            onClick={() => {
                                                onAppointmentClick(appointment)
                                                onOpenChange(false)
                                            }}
                                            className="w-full text-right rounded-lg border border-green-200 bg-green-50 px-4 py-3 hover:bg-green-100 transition-colors"
                                        >
                                            <div className="text-sm font-semibold text-green-900">
                                                {format(new Date(appointment.startDateTime), 'HH:mm')} - {format(new Date(appointment.startDateTime), 'dd.MM.yyyy')}
                                            </div>
                                            <div className="text-xs text-green-700 mt-1">
                                                {appointment.serviceType === 'garden' ? 'גן' : 'מספרה'} • {appointment.stationName}
                                                {appointment.notes && ` • ${appointment.notes.substring(0, 50)}${appointment.notes.length > 50 ? '...' : ''}`}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-sm text-gray-500 py-12 bg-green-50 rounded-lg border border-green-100">
                                    אין תורים עתידיים
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="past" className="mt-4 space-y-2">
                            {pastAppointments.length > 0 ? (
                                <div className="space-y-2">
                                    {pastAppointments.map((appointment) => (
                                        <button
                                            key={appointment.id}
                                            type="button"
                                            onClick={() => {
                                                onAppointmentClick(appointment)
                                                onOpenChange(false)
                                            }}
                                            className="w-full text-right rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="text-sm font-semibold text-gray-900">
                                                {format(new Date(appointment.startDateTime), 'HH:mm')} - {format(new Date(appointment.startDateTime), 'dd.MM.yyyy')}
                                            </div>
                                            <div className="text-xs text-gray-700 mt-1">
                                                {appointment.serviceType === 'garden' ? 'גן' : 'מספרה'} • {appointment.stationName}
                                                {appointment.notes && ` • ${appointment.notes.substring(0, 50)}${appointment.notes.length > 50 ? '...' : ''}`}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-sm text-gray-500 py-12 bg-gray-50 rounded-lg border border-gray-100">
                                    אין תורים קודמים
                                </div>
                            )}
                        </TabsContent>

                        {transformedAppointments.length === 0 && activeTab === 'today' && (
                            <div className="text-center text-sm text-gray-500 py-8">
                                אין תורים עבור הלקוח הזה
                            </div>
                        )}
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}

