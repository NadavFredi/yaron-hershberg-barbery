import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { format } from "date-fns"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useGetGroupAppointmentsQuery, supabaseApi, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import { GroupAppointmentsList } from "@/components/GroupAppointmentsList"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { managerCancelAppointment } from "@/integrations/supabase/supabaseService"
import { supabase } from "@/integrations/supabase/client"
import { MANYCHAT_FLOW_IDS, getManyChatCustomFieldId } from "@/lib/manychat"
import {
    setCancelConfirmationOpen,
    setAppointmentToCancel,
    setUpdateCustomerCancel,
    setIsCancelling,
    setSelectedAppointment,
    setIsDetailsOpen,
    setDeleteConfirmationOpen
} from "@/store/slices/managerScheduleSlice"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import type { CheckedState } from "@radix-ui/react-checkbox"

export function CancelConfirmationDialog() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.cancelConfirmationOpen)
    const appointmentToCancel = useAppSelector((state) => state.managerSchedule.appointmentToCancel)
    const updateCustomerCancel = useAppSelector((state) => state.managerSchedule.updateCustomerCancel)
    const isCancelling = useAppSelector((state) => state.managerSchedule.isCancelling)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { refetch } = useGetManagerScheduleQuery({
        date: format(new Date(selectedDate), 'yyyy-MM-dd'),
        serviceType: serviceFilter
    })

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

    const handleClose = () => {
        dispatch(setCancelConfirmationOpen(false))
    }

    const handleGroupAppointmentClick = (appointment: ManagerAppointment) => {
        // Close any open dialogs
        dispatch(setDeleteConfirmationOpen(false))
        dispatch(setCancelConfirmationOpen(false))

        // Open the appointment drawer
        dispatch(setSelectedAppointment(appointment))
        dispatch(setIsDetailsOpen(true))
    }

    // Helper function to trigger ManyChat flow for cancelled appointments
    const triggerManyChatAppointmentDeletedFlow = async (appointments: ManagerAppointment[]) => {
        if (!updateCustomerCancel) {
            console.log("ℹ️ [CancelConfirmationDialog] updateCustomerCancel is not checked, skipping ManyChat flow")
            return
        }

        const flowId = MANYCHAT_FLOW_IDS.APPOINTMENT_DELETED
        if (!flowId) {
            console.warn("⚠️ [CancelConfirmationDialog] APPOINTMENT_DELETED flow ID not found")
            return
        }

        // Filter appointments that have phone numbers and collect unique clients
        const appointmentsWithPhones = appointments.filter(
            (apt) => apt.clientPhone && apt.clientPhone.trim().length > 0
        )

        if (!appointmentsWithPhones.length) {
            console.log("ℹ️ [CancelConfirmationDialog] No appointments with phone numbers to send ManyChat flow")
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
            const dogNameField = getManyChatCustomFieldId("DOG_NAME")

            // Format appointment date (dd/MM/yyyy)
            const appointmentDate = format(new Date(apt.startDateTime), 'dd/MM/yyyy')
            // Format appointment time (HH:mm)
            const appointmentTime = format(new Date(apt.startDateTime), 'HH:mm')
            // Get dog name
            const dogName = apt.dogs?.[0]?.name || "כלב ללא שם"

            // Build fields object
            const fields: Record<string, string> = {}
            if (dateFieldId) {
                fields[dateFieldId] = appointmentDate
            }
            // For grooming appointments, also set hour and dog name
            if (!isGarden) {
                if (hourFieldId) {
                    fields[hourFieldId] = appointmentTime
                }
                if (dogNameField) {
                    fields[dogNameField] = dogName
                }
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
                if (!isGarden) {
                    if (hourFieldId) {
                        existing.fields[hourFieldId] = appointmentTime
                    }
                    if (dogNameField) {
                        existing.fields[dogNameField] = dogName
                    }
                }
            }
        }

        const users = Array.from(uniqueClients.values())

        try {
            console.log(`📤 [CancelConfirmationDialog] Sending APPOINTMENT_DELETED flow to ${users.length} recipient(s)`)
            const { data, error } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                body: {
                    users,
                    flow_id: flowId,
                },
            })

            if (error) {
                console.error("❌ [CancelConfirmationDialog] Error calling ManyChat function:", error)
                // Don't throw - we don't want to fail the whole operation if ManyChat fails
                return
            }

            const results = data as Record<string, { success: boolean; error?: string }>
            const successCount = Object.values(results).filter((r) => r.success).length
            const failureCount = Object.values(results).filter((r) => !r.success).length

            console.log(
                `✅ [CancelConfirmationDialog] ManyChat flow sent: ${successCount} success, ${failureCount} failures`
            )

            if (failureCount > 0) {
                console.warn("⚠️ [CancelConfirmationDialog] Some ManyChat flows failed:", results)
            }
        } catch (error) {
            console.error("❌ [CancelConfirmationDialog] Error triggering ManyChat flow:", error)
            // Don't throw - we don't want to fail the whole operation if ManyChat fails
        }
    }

    const handleConfirm = async (cancelGroup?: boolean, selectedAppointmentIds?: string[]) => {
        if (!appointmentToCancel) return

        dispatch(setIsCancelling(true))
        try {
            // If canceling group and we have selected appointments, loop through them
            if (cancelGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0) {
                // Cancel all selected appointments in Supabase
                for (const aptId of selectedAppointmentIds) {
                    const result = await managerCancelAppointment({
                        appointmentId: aptId,
                        appointmentTime: appointmentToCancel.startDateTime,
                        serviceType: appointmentToCancel.serviceType,
                        dogId: appointmentToCancel.dogs[0]?.id,
                        stationId: appointmentToCancel.stationId,
                        updateCustomer: updateCustomerCancel,
                        clientName: appointmentToCancel.clientName,
                        dogName: appointmentToCancel.dogs[0]?.name,
                        appointmentDate: new Date(appointmentToCancel.startDateTime).toLocaleDateString('he-IL'),
                        groupId: cancelGroup ? appointmentToCancel.groupAppointmentId : undefined,
                    })

                    if (!result.success) {
                        console.warn(`Failed to cancel appointment ${aptId}:`, result.error)
                    }
                }
            } else {
                // Single appointment cancellation
                const result = await managerCancelAppointment({
                    appointmentId: appointmentToCancel.id,
                    appointmentTime: appointmentToCancel.startDateTime,
                    serviceType: appointmentToCancel.serviceType,
                    dogId: appointmentToCancel.dogs[0]?.id,
                    stationId: appointmentToCancel.stationId,
                    updateCustomer: updateCustomerCancel,
                    clientName: appointmentToCancel.clientName,
                    dogName: appointmentToCancel.dogs[0]?.name,
                    appointmentDate: new Date(appointmentToCancel.startDateTime).toLocaleDateString('he-IL'),
                    groupId: cancelGroup ? appointmentToCancel.groupAppointmentId : undefined,
                })

                if (!result.success) {
                    throw new Error(result.error || "Failed to cancel appointment")
                }
            }

            // Collect all cancelled appointments for ManyChat flow
            const cancelledAppointments: ManagerAppointment[] = []

            // If canceling group, collect all selected appointments
            if (cancelGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0) {
                for (const aptId of selectedAppointmentIds) {
                    const apt = groupData?.appointments.find(a => a.id === aptId) || appointmentToCancel
                    if (apt) {
                        cancelledAppointments.push(apt)
                    }
                }
            }

            // Always include the current appointment being cancelled
            if (!cancelledAppointments.find(apt => apt.id === appointmentToCancel.id)) {
                cancelledAppointments.push(appointmentToCancel)
            }

            // Trigger ManyChat flow if updateCustomerCancel is checked
            await triggerManyChatAppointmentDeletedFlow(cancelledAppointments)

            // Close the confirmation dialog
            dispatch(setCancelConfirmationOpen(false))
            dispatch(setAppointmentToCancel(null))

            // Show success toast
            const isGroupOperation = cancelGroup && selectedAppointmentIds && selectedAppointmentIds.length > 0
            toast({
                title: "התור בוטל בהצלחה",
                description: isGroupOperation
                    ? `${selectedAppointmentIds.length} תורים בוטלו בהצלחה`
                    : `התור של ${appointmentToCancel.dogs[0]?.name || 'הכלב'} בוטל בהצלחה`,
                variant: "default",
            })

            // Invalidate cache to refresh the schedule
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

            // Refresh the data by invalidating the cache and refetching
            await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
            await refetch()

        } catch (error) {
            console.error('Error cancelling appointment:', error)

            // Show error toast
            toast({
                title: "שגיאה בביטול התור",
                description: error instanceof Error ? error.message : "אירעה שגיאה בעת ביטול התור",
                variant: "destructive",
            })

            // Refresh the data even on error to ensure UI is up-to-date
            await dispatch(supabaseApi.util.invalidateTags(['ManagerSchedule']))
            await refetch()
        } finally {
            dispatch(setIsCancelling(false))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                } else {
                    dispatch(setCancelConfirmationOpen(true))
                }
            }}
        >
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
                                            onAppointmentClick={handleGroupAppointmentClick}
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}

                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox
                            id="updateCustomerCancel"
                            checked={updateCustomerCancel}
                            onCheckedChange={(checked) => {
                                dispatch(setUpdateCustomerCancel(checked as boolean))
                            }}
                            className="cursor-pointer"
                        />
                        <label
                            htmlFor="updateCustomerCancel"
                            className="text-sm text-gray-700 cursor-pointer"
                            onClick={(e) => {
                                e.preventDefault()
                                dispatch(setUpdateCustomerCancel(!updateCustomerCancel))
                            }}
                        >
                            עדכן את הלקוח על ביטול התור
                        </label>
                    </div>
                </div>

                <DialogFooter className="flex-row-reverse mt-6" dir="ltr">
                    <Button variant="outline" onClick={handleClose} disabled={isCancelling}>
                        ביטול
                    </Button>
                    <Button
                        onClick={() => handleConfirm(cancelGroup, selectedGroupAppointments)}
                        className="bg-orange-600 hover:bg-orange-700"
                        disabled={isCancelling}
                    >
                        {isCancelling ? (
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
