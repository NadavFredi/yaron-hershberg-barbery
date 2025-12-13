import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { format } from "date-fns"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useGetGroupAppointmentsQuery, useGetSeriesAppointmentsQuery, supabaseApi, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { GroupAppointmentsList } from "@/components/GroupAppointmentsList"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { managerDeleteAppointment } from "@/integrations/supabase/supabaseService"
import { supabase } from "@/integrations/supabase/client"
import { MANYCHAT_FLOW_IDS, getManyChatCustomFieldId } from "@/lib/manychat"
import {
    setDeleteConfirmationOpen,
    setAppointmentToDelete,
    setUpdateCustomer,
    setIsDeleting,
    setSelectedAppointment,
    setIsDetailsOpen,
    setCancelConfirmationOpen
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import type { CheckedState } from "@radix-ui/react-checkbox"

export function DeleteConfirmationDialog() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.deleteConfirmationOpen)
    const appointmentToDelete = useAppSelector((state) => state.managerSchedule.appointmentToDelete)
    const updateCustomer = useAppSelector((state) => state.managerSchedule.updateCustomer)
    const isDeleting = useAppSelector((state) => state.managerSchedule.isDeleting)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })
    const [deleteGroup, setDeleteGroup] = useState(false)
    const [selectedGroupAppointments, setSelectedGroupAppointments] = useState<string[]>([])
    const [deleteSeries, setDeleteSeries] = useState(false)
    const [selectedSeriesAppointments, setSelectedSeriesAppointments] = useState<string[]>([])

    // Check if this appointment has a group ID or series ID
    const hasGroupId = appointmentToDelete?.groupAppointmentId && appointmentToDelete.groupAppointmentId.trim() !== ''
    const hasSeriesId = appointmentToDelete?.seriesId && appointmentToDelete.seriesId.trim() !== ''

    // Fetch group appointments if this is a group appointment
    const { data: groupData, isLoading: isLoadingGroup } = useGetGroupAppointmentsQuery(
        { groupId: appointmentToDelete?.groupAppointmentId || '' },
        { skip: !hasGroupId || !appointmentToDelete?.groupAppointmentId }
    )

    // Fetch series appointments if this is a series appointment
    const { data: seriesData, isLoading: isLoadingSeries } = useGetSeriesAppointmentsQuery(
        { seriesId: appointmentToDelete?.seriesId || '' },
        { skip: !hasSeriesId || !appointmentToDelete?.seriesId }
    )

    // Show ALL appointments including the one being deleted, so user can see the full series
    const allGroupAppointments = React.useMemo(
        () => groupData?.appointments ?? [],
        [groupData]
    )

    const allSeriesAppointments = React.useMemo(
        () => seriesData?.appointments ?? [],
        [seriesData]
    )

    // All appointments are selectable, including the current one
    const selectableGroupAppointments = allGroupAppointments
    const selectableSeriesAppointments = allSeriesAppointments

    const totalSelectableGroupAppointments = selectableGroupAppointments.length
    const totalSelectableSeriesAppointments = selectableSeriesAppointments.length

    // Handle individual group appointment selection
    const handleGroupAppointmentSelection = (appointmentId: string, selected: boolean) => {
        const nextSelected = selected
            ? (selectedGroupAppointments.includes(appointmentId)
                ? selectedGroupAppointments
                : [...selectedGroupAppointments, appointmentId])
            : selectedGroupAppointments.filter(id => id !== appointmentId)

        setSelectedGroupAppointments(nextSelected)

        // Check if all appointments (including current) are selected
        if (totalSelectableGroupAppointments > 0) {
            setDeleteGroup(nextSelected.length === totalSelectableGroupAppointments)
        } else {
            setDeleteGroup(false)
        }
    }

    // Handle individual series appointment selection
    const handleSeriesAppointmentSelection = (appointmentId: string, selected: boolean) => {
        const nextSelected = selected
            ? (selectedSeriesAppointments.includes(appointmentId)
                ? selectedSeriesAppointments
                : [...selectedSeriesAppointments, appointmentId])
            : selectedSeriesAppointments.filter(id => id !== appointmentId)

        setSelectedSeriesAppointments(nextSelected)

        // Check if all appointments (including current) are selected
        if (totalSelectableSeriesAppointments > 0) {
            setDeleteSeries(nextSelected.length === totalSelectableSeriesAppointments)
        } else {
            setDeleteSeries(false)
        }
    }

    // Handle select all for group (includes all appointments including current)
    const handleSelectAllGroup = (selected: boolean) => {
        if (selected && totalSelectableGroupAppointments > 0) {
            const allIds = selectableGroupAppointments.map(apt => apt.id)
            setSelectedGroupAppointments(allIds)
            setDeleteGroup(true)
        } else {
            setSelectedGroupAppointments([])
            setDeleteGroup(false)
        }
    }

    // Handle select all for series (includes all appointments including current)
    const handleSelectAllSeries = (selected: boolean) => {
        if (selected && totalSelectableSeriesAppointments > 0) {
            const allIds = selectableSeriesAppointments.map(apt => apt.id)
            setSelectedSeriesAppointments(allIds)
            setDeleteSeries(true)
        } else {
            setSelectedSeriesAppointments([])
            setDeleteSeries(false)
        }
    }

    // Handle delete group checkbox change
    const handleDeleteGroupChange = (checked: boolean) => {
        setDeleteGroup(checked)
        if (checked && totalSelectableGroupAppointments > 0) {
            // Select all appointments including current
            const allIds = selectableGroupAppointments.map(apt => apt.id)
            setSelectedGroupAppointments(allIds)
        } else if (!checked) {
            // Deselect all
            setSelectedGroupAppointments([])
        }
    }

    // Handle delete series checkbox change
    const handleDeleteSeriesChange = (checked: boolean) => {
        setDeleteSeries(checked)
        if (checked && totalSelectableSeriesAppointments > 0) {
            // Select all appointments including current
            const allIds = selectableSeriesAppointments.map(apt => apt.id)
            setSelectedSeriesAppointments(allIds)
        } else if (!checked) {
            // Deselect all
            setSelectedSeriesAppointments([])
        }
    }

    // Check if all group appointments are selected
    const allGroupSelected = totalSelectableGroupAppointments > 0 && selectedGroupAppointments.length === totalSelectableGroupAppointments
    const hasPartialGroupSelection = selectedGroupAppointments.length > 0 && !allGroupSelected
    const selectAllGroupState: CheckedState = allGroupSelected ? true : hasPartialGroupSelection ? 'indeterminate' : false

    // Check if all series appointments are selected
    const allSeriesSelected = totalSelectableSeriesAppointments > 0 && selectedSeriesAppointments.length === totalSelectableSeriesAppointments
    const hasPartialSeriesSelection = selectedSeriesAppointments.length > 0 && !allSeriesSelected
    const selectAllSeriesState: CheckedState = allSeriesSelected ? true : hasPartialSeriesSelection ? 'indeterminate' : false

    const handleClose = () => {
        dispatch(setDeleteConfirmationOpen(false))
    }

    const handleGroupAppointmentClick = (appointment: ManagerAppointment) => {
        // Close any open dialogs
        dispatch(setDeleteConfirmationOpen(false))
        dispatch(setCancelConfirmationOpen(false))

        // Open the appointment drawer
        dispatch(setSelectedAppointment(appointment))
        dispatch(setIsDetailsOpen(true))
    }

    // Helper function to trigger ManyChat flow for deleted appointments
    const triggerManyChatAppointmentDeletedFlow = async (appointments: ManagerAppointment[]) => {
        if (!updateCustomer) {
            console.log("ℹ️ [DeleteConfirmationDialog] updateCustomer is not checked, skipping ManyChat flow")
            return
        }

        const flowId = MANYCHAT_FLOW_IDS.APPOINTMENT_DELETED
        if (!flowId) {
            console.warn("⚠️ [DeleteConfirmationDialog] APPOINTMENT_DELETED flow ID not found")
            return
        }

        // Filter appointments that have phone numbers and collect unique clients
        const appointmentsWithPhones = appointments.filter(
            (apt) => apt.clientPhone && apt.clientPhone.trim().length > 0
        )

        if (!appointmentsWithPhones.length) {
            console.log("ℹ️ [DeleteConfirmationDialog] No appointments with phone numbers to send ManyChat flow")
            return
        }

        // Create a map to avoid sending duplicate flows to the same phone number
        // Use appointment data to set fields for each unique client
        const uniqueClients = new Map<string, { phone: string; name: string; fields: Record<string, string> }>()
        for (const apt of appointmentsWithPhones) {
            const normalizedPhone = apt.clientPhone!.replace(/\D/g, "") // Normalize to digits only

            // Use barber fields for all appointments
            const dateFieldId = getManyChatCustomFieldId("BARBER_DATE_APPOINTMENT")
            const hourFieldId = getManyChatCustomFieldId("BARBER_HOUR_APPOINTMENT")

            // Format appointment date (dd/MM/yyyy)
            const appointmentDate = format(new Date(apt.startDateTime), 'dd/MM/yyyy')
            // Format appointment time (HH:mm)
            const appointmentTime = format(new Date(apt.startDateTime), 'HH:mm')

            // Build fields object
            const fields: Record<string, string> = {}
            if (dateFieldId) {
                fields[dateFieldId] = appointmentDate
            }
            if (hourFieldId) {
                fields[hourFieldId] = appointmentTime
            }

            if (!uniqueClients.has(normalizedPhone)) {
                uniqueClients.set(normalizedPhone, {
                    phone: normalizedPhone,
                    name: apt.clientName || "לקוח",
                    fields: fields,
                })
            } else {
                // If multiple appointments for same client, merge fields (use most recent appointment data)
                const existing = uniqueClients.get(normalizedPhone)!
                if (dateFieldId) {
                    existing.fields[dateFieldId] = appointmentDate
                }
                if (hourFieldId) {
                    existing.fields[hourFieldId] = appointmentTime
                }
            }
        }

        const users = Array.from(uniqueClients.values())

        try {
            console.log(`📤 [DeleteConfirmationDialog] Sending APPOINTMENT_DELETED flow to ${users.length} recipient(s)`)
            const { data, error } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                body: {
                    users,
                    flow_id: flowId,
                },
            })

            if (error) {
                console.error("❌ [DeleteConfirmationDialog] Error calling ManyChat function:", error)
                // Don't throw - we don't want to fail the whole operation if ManyChat fails
                return
            }

            const results = data as Record<string, { success: boolean; error?: string }>
            const successCount = Object.values(results).filter((r) => r.success).length
            const failureCount = Object.values(results).filter((r) => !r.success).length

            console.log(
                `✅ [DeleteConfirmationDialog] ManyChat flow sent: ${successCount} success, ${failureCount} failures`
            )

            if (failureCount > 0) {
                console.warn("⚠️ [DeleteConfirmationDialog] Some ManyChat flows failed:", results)
            }
        } catch (error) {
            console.error("❌ [DeleteConfirmationDialog] Error triggering ManyChat flow:", error)
            // Don't throw - we don't want to fail the whole operation if ManyChat fails
        }
    }

    const handleConfirm = async () => {
        if (!appointmentToDelete) return

        dispatch(setIsDeleting(true))
        try {
            // Collect appointment IDs to delete based on selections
            const appointmentIdsToDelete: string[] = []

            // If deleting group, use selected group appointments (which may include current)
            if (hasGroupId && deleteGroup) {
                if (selectedGroupAppointments.length > 0) {
                    appointmentIdsToDelete.push(...selectedGroupAppointments)
                } else {
                    // If delete group is checked but nothing selected, delete all including current
                    appointmentIdsToDelete.push(...allGroupAppointments.map(apt => apt.id))
                }
            }
            // If deleting series, use selected series appointments (which may include current)
            else if (hasSeriesId && deleteSeries) {
                if (selectedSeriesAppointments.length > 0) {
                    appointmentIdsToDelete.push(...selectedSeriesAppointments)
                } else {
                    // If delete series is checked but nothing selected, delete all including current
                    appointmentIdsToDelete.push(...allSeriesAppointments.map(apt => apt.id))
                }
            }
            // If there are selected appointments (from manual selection), use those
            else if (selectedGroupAppointments.length > 0 || selectedSeriesAppointments.length > 0) {
                appointmentIdsToDelete.push(...selectedGroupAppointments, ...selectedSeriesAppointments)
            }
            // Default: delete only the current appointment
            else {
                appointmentIdsToDelete.push(appointmentToDelete.id)
            }

            // Remove duplicates
            const uniqueAppointmentIds = [...new Set(appointmentIdsToDelete)]

            // If no appointments selected, don't proceed
            if (uniqueAppointmentIds.length === 0) {
                toast({
                    title: "לא נבחרו תורים למחיקה",
                    description: "אנא בחר תורים למחיקה",
                    variant: "destructive",
                })
                dispatch(setIsDeleting(false))
                return
            }

            // Delete all appointments
            if (uniqueAppointmentIds.length > 1) {
                // Multiple appointments deletion
                for (const aptId of uniqueAppointmentIds) {
                    // Find the appointment details for this ID (check all lists including current appointment)
                    const apt =
                        allGroupAppointments.find(a => a.id === aptId) ||
                        allSeriesAppointments.find(a => a.id === aptId) ||
                        selectableGroupAppointments.find(a => a.id === aptId) ||
                        selectableSeriesAppointments.find(a => a.id === aptId) ||
                        appointmentToDelete

                    const result = await managerDeleteAppointment({
                        appointmentId: aptId,
                        appointmentTime: apt.startDateTime,
                        serviceType: apt.serviceType,
                        stationId: apt.stationId,
                        updateCustomer: updateCustomer,
                        clientName: apt.clientName,
                        appointmentDate: new Date(apt.startDateTime).toLocaleDateString('he-IL'),
                        groupId: deleteGroup ? appointmentToDelete.groupAppointmentId : undefined,
                    })

                    if (!result.success) {
                        console.warn(`Failed to delete appointment ${aptId}:`, result.error)
                    }
                }
            } else {
                // Single appointment deletion
                const result = await managerDeleteAppointment({
                    appointmentId: appointmentToDelete.id,
                    appointmentTime: appointmentToDelete.startDateTime,
                    serviceType: appointmentToDelete.serviceType,
                    stationId: appointmentToDelete.stationId,
                    updateCustomer: updateCustomer,
                    clientName: appointmentToDelete.clientName,
                    appointmentDate: new Date(appointmentToDelete.startDateTime).toLocaleDateString('he-IL'),
                    groupId: deleteGroup ? appointmentToDelete.groupAppointmentId : undefined,
                })

                if (!result.success) {
                    throw new Error(result.error || "Failed to delete appointment")
                }
            }

            // Collect all deleted appointments for ManyChat flow
            const deletedAppointments: ManagerAppointment[] = []
            for (const aptId of uniqueAppointmentIds) {
                const apt =
                    allGroupAppointments.find(a => a.id === aptId) ||
                    allSeriesAppointments.find(a => a.id === aptId) ||
                    selectableGroupAppointments.find(a => a.id === aptId) ||
                    selectableSeriesAppointments.find(a => a.id === aptId) ||
                    appointmentToDelete
                if (apt) {
                    deletedAppointments.push(apt)
                }
            }

            // Trigger ManyChat flow if updateCustomer is checked
            await triggerManyChatAppointmentDeletedFlow(deletedAppointments)

            // Close the confirmation dialog first
            dispatch(setDeleteConfirmationOpen(false))
            dispatch(setAppointmentToDelete(null))

            // Show success toast
            const totalDeleted = uniqueAppointmentIds.length
            const isMultipleOperation = totalDeleted > 1
            toast({
                title: "התור נמחק בהצלחה",
                description: isMultipleOperation
                    ? `${totalDeleted} תורים נמחקו בהצלחה`
                    : `התור נמחק בהצלחה`,
                variant: "default",
            })

            // Collect all dog IDs from deleted appointments to invalidate their specific caches
            const dogIdsToInvalidate = new Set<string>()
            if (appointmentToDelete?.dogs?.[0]?.id) {
                dogIdsToInvalidate.add(appointmentToDelete.dogs[0].id)
            }
            // Also collect from all deleted appointments if multiple
            for (const aptId of uniqueAppointmentIds) {
                const apt =
                    allGroupAppointments.find(a => a.id === aptId) ||
                    allSeriesAppointments.find(a => a.id === aptId) ||
                    selectableGroupAppointments.find(a => a.id === aptId) ||
                    selectableSeriesAppointments.find(a => a.id === aptId) ||
                    appointmentToDelete
                if (apt?.dogs?.[0]?.id) {
                    dogIdsToInvalidate.add(apt.dogs[0].id)
                }
            }

            // Invalidate cache to refresh the schedule - comprehensive invalidation
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

            // Invalidate dog-specific appointment caches
            for (const dogId of dogIdsToInvalidate) {
                dispatch(
                    supabaseApi.util.invalidateTags([
                        { type: "Appointment", id: dogId },
                        { type: "Appointment", id: `getMergedAppointments-${dogId}` },
                    ])
                )
            }

            // Refresh the data by invalidating the cache and refetching
            await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
            await refetch()

        } catch (error) {
            console.error('Error deleting appointment:', error)

            // Show error toast
            toast({
                title: "שגיאה במחיקת התור",
                description: error instanceof Error ? error.message : "אירעה שגיאה בעת מחיקת התור",
                variant: "destructive",
            })

            // Refresh the data even on error to ensure UI is up-to-date
            // Invalidate comprehensive cache tags
            await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule', 'Appointment', 'GardenAppointment']))

            await refetch()
        } finally {
            dispatch(setIsDeleting(false))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                } else {
                    dispatch(setDeleteConfirmationOpen(true))
                }
            }}
        >
            <DialogContent className={cn("max-w-md", (hasGroupId || hasSeriesId) && "max-w-5xl")} dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {hasGroupId || hasSeriesId ? 'מחיקת תור/סדרת תורים' : 'מחיקת תור'}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {hasGroupId || hasSeriesId
                            ? 'בחר אילו תורים למחוק מהקבוצה/סדרה'
                            : 'האם אתה בטוח שברצונך למחוק את התור?'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {appointmentToDelete && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                    <div><strong>תאריך:</strong> {new Date(appointmentToDelete.startDateTime).toLocaleDateString('he-IL')}</div>
                                    <div><strong>שעה:</strong> {format(new Date(appointmentToDelete.startDateTime), 'HH:mm')} - {format(new Date(appointmentToDelete.endDateTime), 'HH:mm')}</div>
                                    <div><strong>עמדה:</strong> {appointmentToDelete.stationName || 'לא זמין'}</div>
                                </div>
                                <div>
                                    <div><strong>לקוח:</strong> {appointmentToDelete.clientName || 'לא זמין'}</div>
                                    <div><strong>שירות:</strong> {appointmentToDelete.serviceType === 'grooming' ? 'מספרה' : ''}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasGroupId && groupData && (
                        <div className="w-full">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                    תורים בקבוצה ({allGroupAppointments.length} תורים)
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
                                            appointments={allGroupAppointments}
                                            groupId={appointmentToDelete?.groupAppointmentId || ''}
                                            className="max-h-48"
                                            selectedAppointments={selectedGroupAppointments}
                                            onSelectionChange={handleGroupAppointmentSelection}
                                            onSelectAll={handleSelectAllGroup}
                                            selectAllChecked={selectAllGroupState}
                                            isLoading={isLoadingGroup}
                                            onAppointmentClick={handleGroupAppointmentClick}
                                            currentAppointmentId={appointmentToDelete?.id}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}

                    {hasSeriesId && seriesData && (
                        <div className="w-full">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                    תורים בסדרה ({allSeriesAppointments.length} תורים)
                                </span>
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <Checkbox
                                        id="deleteSeries"
                                        checked={deleteSeries}
                                        onCheckedChange={(checked) => {
                                            handleDeleteSeriesChange(checked as boolean)
                                        }}
                                        className="cursor-pointer"
                                    />
                                    <label
                                        htmlFor="deleteSeries"
                                        className="text-sm text-gray-700 cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            handleDeleteSeriesChange(!deleteSeries)
                                        }}
                                    >
                                        מחק את כל התורים בסדרה
                                    </label>
                                </div>
                            </div>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="series-appointments" className="border rounded-lg">
                                    <AccordionTrigger className="text-right px-4 py-3 hover:no-underline">
                                        <span className="text-sm font-medium text-gray-700">
                                            הצג תורים נוספים בסדרה
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <GroupAppointmentsList
                                            appointments={allSeriesAppointments}
                                            groupId={appointmentToDelete?.seriesId || ''}
                                            className="max-h-48"
                                            selectedAppointments={selectedSeriesAppointments}
                                            onSelectionChange={handleSeriesAppointmentSelection}
                                            onSelectAll={handleSelectAllSeries}
                                            selectAllChecked={selectAllSeriesState}
                                            isLoading={isLoadingSeries}
                                            onAppointmentClick={handleGroupAppointmentClick}
                                            currentAppointmentId={appointmentToDelete?.id}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}

                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox
                            id="updateCustomer"
                            checked={updateCustomer}
                            onCheckedChange={(checked) => {
                                dispatch(setUpdateCustomer(checked as boolean))
                            }}
                            className="cursor-pointer"
                        />
                        <label
                            htmlFor="updateCustomer"
                            className="text-sm text-gray-700 cursor-pointer"
                            onClick={(e) => {
                                e.preventDefault()
                                dispatch(setUpdateCustomer(!updateCustomer))
                            }}
                        >
                            עדכן את הלקוח על ביטול התור
                        </label>
                    </div>
                </div>

                <DialogFooter dir="ltr" className="mt-6">
                    <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
                        ביטול
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>מוחק...</span>
                            </div>
                        ) : (
                            (hasGroupId && deleteGroup) || (hasSeriesId && deleteSeries)
                                ? 'מחק תורים נבחרים'
                                : 'מחק תור'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
