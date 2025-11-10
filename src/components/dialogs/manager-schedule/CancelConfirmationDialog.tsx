import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { format } from "date-fns"
import { useGetGroupAppointmentsQuery } from "@/store/services/supabaseApi"
import { GroupAppointmentsList } from "@/components/GroupAppointmentsList"
import { cn } from "@/lib/utils"
import type { ManagerAppointment } from "@/types/managerSchedule"
import type { CheckedState } from "@radix-ui/react-checkbox"

interface CancelConfirmationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointmentToCancel: ManagerAppointment | null
    updateCustomerCancel: boolean
    setUpdateCustomerCancel: (update: boolean) => void
    onConfirm: (cancelGroup?: boolean, selectedAppointmentIds?: string[]) => void
    onCancel: () => void
    isLoading?: boolean
    onAppointmentClick?: (appointment: ManagerAppointment) => void
}

export const CancelConfirmationDialog: React.FC<CancelConfirmationDialogProps> = ({
    open,
    onOpenChange,
    appointmentToCancel,
    updateCustomerCancel,
    setUpdateCustomerCancel,
    onConfirm,
    onCancel,
    isLoading = false,
    onAppointmentClick
}) => {
    const [cancelGroup, setCancelGroup] = useState(false)
    const [selectedGroupAppointments, setSelectedGroupAppointments] = useState<string[]>([])

    // Check if this appointment has a group ID
    const hasGroupId = appointmentToCancel?.groupAppointmentId && appointmentToCancel.groupAppointmentId.trim() !== ''

    // Fetch group appointments if this is a group appointment
    const { data: groupData, isLoading: isLoadingGroup } = useGetGroupAppointmentsQuery(
        { groupId: appointmentToCancel?.groupAppointmentId || '' },
        { skip: !hasGroupId || !appointmentToCancel?.groupAppointmentId }
    )

    const selectableAppointments = React.useMemo(
        () => groupData?.appointments.filter(apt => apt.id !== appointmentToCancel?.id) ?? [],
        [groupData, appointmentToCancel?.id]
    )

    const totalSelectableAppointments = selectableAppointments.length

    // Handle individual appointment selection
    const handleAppointmentSelection = (appointmentId: string, selected: boolean) => {
        const nextSelected = selected
            ? (selectedGroupAppointments.includes(appointmentId)
                ? selectedGroupAppointments
                : [...selectedGroupAppointments, appointmentId])
            : selectedGroupAppointments.filter(id => id !== appointmentId)

        setSelectedGroupAppointments(nextSelected)

        if (totalSelectableAppointments > 0) {
            setCancelGroup(nextSelected.length === totalSelectableAppointments)
        } else {
            setCancelGroup(false)
        }
    }

    // Handle select all
    const handleSelectAll = (selected: boolean) => {
        if (selected && totalSelectableAppointments > 0) {
            const allIds = selectableAppointments.map(apt => apt.id)
            setSelectedGroupAppointments(allIds)
            setCancelGroup(true)
        } else {
            setSelectedGroupAppointments([])
            setCancelGroup(false)
        }
    }

    // Handle cancel group checkbox change
    const handleCancelGroupChange = (checked: boolean) => {
        console.log('Cancel group checkbox changed:', checked)
        setCancelGroup(checked)
        if (checked && totalSelectableAppointments > 0) {
            // When cancel group is checked, select all appointments
            const allIds = selectableAppointments.map(apt => apt.id)
            console.log('Selecting all appointments:', allIds)
            setSelectedGroupAppointments(allIds)
        } else if (!checked) {
            // When cancel group is unchecked, deselect all appointments
            console.log('Deselecting all appointments')
            setSelectedGroupAppointments([])
        }
    }

    // Check if all appointments are selected
    const allSelected = totalSelectableAppointments > 0 && selectedGroupAppointments.length === totalSelectableAppointments
    const hasPartialSelection = selectedGroupAppointments.length > 0 && !allSelected
    const selectAllState: CheckedState = allSelected ? true : hasPartialSelection ? 'indeterminate' : false
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-md", hasGroupId && "max-w-2xl")} dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {hasGroupId ? 'ביטול קבוצת תורים' : 'ביטול תור'}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {hasGroupId
                            ? 'האם אתה בטוח שברצונך לבטל את התור?'
                            : 'האם אתה בטוח שברצונך לבטל את התור?'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {appointmentToCancel && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600">
                                <div><strong>תאריך:</strong> {new Date(appointmentToCancel.startDateTime).toLocaleDateString('he-IL')}</div>
                                <div><strong>שעה:</strong> {format(new Date(appointmentToCancel.startDateTime), 'HH:mm')} - {format(new Date(appointmentToCancel.endDateTime), 'HH:mm')}</div>
                                <div><strong>עמדה:</strong> {appointmentToCancel.stationName || 'לא זמין'}</div>
                                <div><strong>לקוח:</strong> {appointmentToCancel.clientName || 'לא זמין'}</div>
                                <div><strong>כלב:</strong> {appointmentToCancel.dogs[0]?.name || 'לא זמין'}</div>
                                <div><strong>שירות:</strong> {appointmentToCancel.serviceType === 'grooming' ? 'מספרה' : 'גן'}</div>
                                {hasGroupId && (
                                    <div><strong>מזהה קבוצה:</strong> {appointmentToCancel.groupAppointmentId}</div>
                                )}
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                    <div className="text-xs text-gray-500"><strong>מזהה תור:</strong> {appointmentToCancel.id}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasGroupId && groupData && (
                        <div className="w-full">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                    תורים נוספים בקבוצה ({groupData.count} תורים)
                                </span>
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <Checkbox
                                        id="cancelGroup"
                                        checked={cancelGroup}
                                        onCheckedChange={(checked) => {
                                            console.log('Cancel group checkbox clicked:', checked)
                                            handleCancelGroupChange(checked as boolean)
                                        }}
                                        className="cursor-pointer"
                                    />
                                    <label
                                        htmlFor="cancelGroup"
                                        className="text-sm text-gray-700 cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            console.log('Cancel group label clicked')
                                            handleCancelGroupChange(!cancelGroup)
                                        }}
                                    >
                                        בטל את כל התורים בקבוצה
                                    </label>
                                </div>
                            </div>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="group-appointments" className="border rounded-lg">
                                    <AccordionTrigger className="text-right px-4 py-3 hover:no-underline">
                                        <span className="text-sm font-medium text-gray-700">
                                            הצג תורים נוספים
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <GroupAppointmentsList
                                            appointments={selectableAppointments}
                                            groupId={appointmentToCancel?.groupAppointmentId || ''}
                                            className="max-h-48"
                                            selectedAppointments={selectedGroupAppointments}
                                            onSelectionChange={handleAppointmentSelection}
                                            onSelectAll={handleSelectAll}
                                            selectAllChecked={selectAllState}
                                            isLoading={isLoadingGroup}
                                            onAppointmentClick={onAppointmentClick}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}

                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <input
                            type="checkbox"
                            id="updateCustomerCancel"
                            checked={updateCustomerCancel}
                            onChange={(e) => setUpdateCustomerCancel(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="updateCustomerCancel" className="text-sm text-gray-700">
                            עדכן את הלקוח על ביטול התור
                        </label>
                    </div>
                </div>

                <DialogFooter className="flex-row-reverse mt-6" dir="ltr">
                    <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                        ביטול
                    </Button>
                    <Button
                        onClick={() => onConfirm(cancelGroup, selectedGroupAppointments)}
                        className="bg-orange-600 hover:bg-orange-700"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>מבטל...</span>
                            </div>
                        ) : (
                            hasGroupId && cancelGroup ? 'בטל קבוצה' : 'בטל תור'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
