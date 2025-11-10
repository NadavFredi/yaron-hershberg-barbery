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

interface DeleteConfirmationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointmentToDelete: ManagerAppointment | null
    updateCustomer: boolean
    setUpdateCustomer: (update: boolean) => void
    onConfirm: (deleteGroup?: boolean, selectedAppointmentIds?: string[]) => void
    onCancel: () => void
    isLoading?: boolean
    onAppointmentClick?: (appointment: ManagerAppointment) => void
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
    open,
    onOpenChange,
    appointmentToDelete,
    updateCustomer,
    setUpdateCustomer,
    onConfirm,
    onCancel,
    isLoading = false,
    onAppointmentClick
}) => {
    const [deleteGroup, setDeleteGroup] = useState(false)
    const [selectedGroupAppointments, setSelectedGroupAppointments] = useState<string[]>([])

    // Check if this appointment has a group ID
    const hasGroupId = appointmentToDelete?.groupAppointmentId && appointmentToDelete.groupAppointmentId.trim() !== ''

    // Fetch group appointments if this is a group appointment
    const { data: groupData, isLoading: isLoadingGroup } = useGetGroupAppointmentsQuery(
        { groupId: appointmentToDelete?.groupAppointmentId || '' },
        { skip: !hasGroupId || !appointmentToDelete?.groupAppointmentId }
    )

    const selectableAppointments = React.useMemo(
        () => groupData?.appointments.filter(apt => apt.id !== appointmentToDelete?.id) ?? [],
        [groupData, appointmentToDelete?.id]
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
            setDeleteGroup(nextSelected.length === totalSelectableAppointments)
        } else {
            setDeleteGroup(false)
        }
    }

    // Handle select all
    const handleSelectAll = (selected: boolean) => {
        if (selected && totalSelectableAppointments > 0) {
            const allIds = selectableAppointments.map(apt => apt.id)
            setSelectedGroupAppointments(allIds)
            setDeleteGroup(true)
        } else {
            setSelectedGroupAppointments([])
            setDeleteGroup(false)
        }
    }

    // Handle delete group checkbox change
    const handleDeleteGroupChange = (checked: boolean) => {
        console.log('Delete group checkbox changed:', checked)
        setDeleteGroup(checked)
        if (checked && totalSelectableAppointments > 0) {
            // When delete group is checked, select all appointments
            const allIds = selectableAppointments.map(apt => apt.id)
            console.log('Selecting all appointments:', allIds)
            setSelectedGroupAppointments(allIds)
        } else if (!checked) {
            // When delete group is unchecked, deselect all appointments
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
                        {hasGroupId ? 'מחיקת קבוצת תורים' : 'מחיקת תור'}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {hasGroupId
                            ? 'האם אתה בטוח שברצונך למחוק את התור?'
                            : 'האם אתה בטוח שברצונך למחוק את התור?'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {appointmentToDelete && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600">
                                <div><strong>תאריך:</strong> {new Date(appointmentToDelete.startDateTime).toLocaleDateString('he-IL')}</div>
                                <div><strong>שעה:</strong> {format(new Date(appointmentToDelete.startDateTime), 'HH:mm')} - {format(new Date(appointmentToDelete.endDateTime), 'HH:mm')}</div>
                                <div><strong>עמדה:</strong> {appointmentToDelete.stationName || 'לא זמין'}</div>
                                <div><strong>לקוח:</strong> {appointmentToDelete.clientName || 'לא זמין'}</div>
                                <div><strong>כלב:</strong> {appointmentToDelete.dogs[0]?.name || 'לא זמין'}</div>
                                <div><strong>שירות:</strong> {appointmentToDelete.serviceType === 'grooming' ? 'מספרה' : 'גן'}</div>
                                {hasGroupId && (
                                    <div><strong>מזהה קבוצה:</strong> {appointmentToDelete.groupAppointmentId}</div>
                                )}
                                <div className="mt-3 pt-2 border-t border-gray-200">
                                    <div className="text-xs text-gray-500"><strong>מזהה תור:</strong> {appointmentToDelete.id}</div>
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
                                        id="deleteGroup"
                                        checked={deleteGroup}
                                        onCheckedChange={(checked) => {
                                            console.log('Delete group checkbox clicked:', checked)
                                            handleDeleteGroupChange(checked as boolean)
                                        }}
                                        className="cursor-pointer"
                                    />
                                    <label
                                        htmlFor="deleteGroup"
                                        className="text-sm text-gray-700 cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            console.log('Delete group label clicked')
                                            handleDeleteGroupChange(!deleteGroup)
                                        }}
                                    >
                                        מחק את כל התורים בקבוצה
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
                                            groupId={appointmentToDelete?.groupAppointmentId || ''}
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
                            id="updateCustomer"
                            checked={updateCustomer}
                            onChange={(e) => setUpdateCustomer(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        <label htmlFor="updateCustomer" className="text-sm text-gray-700">
                            עדכן את הלקוח על ביטול התור
                        </label>
                    </div>
                </div>

                <DialogFooter dir="ltr" className="mt-6">
                    <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                        ביטול
                    </Button>
                    <Button
                        onClick={() => onConfirm(deleteGroup, selectedGroupAppointments)}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>מוחק...</span>
                            </div>
                        ) : (
                            hasGroupId && deleteGroup ? 'מחק קבוצה' : 'מחק תור'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
