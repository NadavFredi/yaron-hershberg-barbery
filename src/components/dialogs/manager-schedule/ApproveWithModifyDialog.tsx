import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { MANYCHAT_FLOW_IDS, getManyChatCustomFieldId } from "@/lib/manychat"
import {
    setApproveWithModifyDialogOpen,
    setAppointmentToApproveWithModify,
    setGroomingEditOpen,
    setPersonalAppointmentEditOpen,
    setEditingGroomingAppointment,
    setEditingPersonalAppointment,
} from "@/store/slices/managerScheduleSlice"
import { approveAppointmentByManager } from "@/integrations/supabase/supabaseService"
import { extractGroomingAppointmentId } from "@/lib/utils"
import { supabaseApi } from "@/store/services/supabaseApi"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { Loader2 } from "lucide-react"

export function ApproveWithModifyDialog() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.approveWithModifyDialogOpen)
    const appointment = useAppSelector((state) => state.managerSchedule.appointmentToApproveWithModify)
    const [notifyCustomer, setNotifyCustomer] = useState(true)
    const [isSending, setIsSending] = useState(false)

    // Format appointment date (dd/MM/yyyy)
    const appointmentDate = appointment ? format(new Date(appointment.startDateTime), 'dd/MM/yyyy') : ""
    // Format appointment time (HH:mm)
    const appointmentTime = appointment ? format(new Date(appointment.startDateTime), 'HH:mm') : ""
    // Get dog name
    const dogName = appointment?.dogs?.[0]?.name || "כלב ללא שם"

    // Helper function to trigger ManyChat flow
    const triggerManyChatApprovedWithModifyFlow = async () => {
        if (!notifyCustomer || !appointment) {
            console.log("ℹ️ [ApproveWithModifyDialog] notifyCustomer is not checked, skipping ManyChat flow")
            return
        }

        if (!appointment.clientPhone || appointment.clientPhone.trim().length === 0) {
            console.log("ℹ️ [ApproveWithModifyDialog] No phone number available for ManyChat flow")
            return
        }

        const flowId = MANYCHAT_FLOW_IDS.YOUR_APPOINTMENT_APPROVED_WITH_MODIFY
        if (!flowId) {
            console.warn("⚠️ [ApproveWithModifyDialog] YOUR_APPOINTMENT_APPROVED_WITH_MODIFY flow ID not found")
            return
        }

        // Use barber date field for all appointments
        const dateFieldId = getManyChatCustomFieldId("BARBER_DATE_APPOINTMENT")

        // Get hour and dog name fields (send for all appointment types)
        const hourFieldId = getManyChatCustomFieldId("BARBER_HOUR_APPOINTMENT")
        const dogNameFieldId = getManyChatCustomFieldId("DOG_NAME")

        // Build fields object - always send date, hour, and dog name
        const fields: Record<string, string> = {}
        if (dateFieldId) {
            fields[dateFieldId] = appointmentDate
        }
        if (hourFieldId) {
            fields[hourFieldId] = appointmentTime
        }
        if (dogNameFieldId) {
            fields[dogNameFieldId] = dogName
        }

        const normalizedPhone = appointment.clientPhone.replace(/\D/g, "") // Normalize to digits only
        const users = [{
            phone: normalizedPhone,
            name: appointment.clientName || "לקוח",
            fields: fields,
        }]

        try {
            console.log(`📤 [ApproveWithModifyDialog] Sending YOUR_APPOINTMENT_APPROVED_WITH_MODIFY flow`)
            const { data, error } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                body: {
                    users,
                    flow_id: flowId,
                },
            })

            if (error) {
                console.error("❌ [ApproveWithModifyDialog] Error calling ManyChat function:", error)
                throw error
            }

            const results = data as Record<string, { success: boolean; error?: string }>
            const successCount = Object.values(results).filter((r) => r.success).length
            const failureCount = Object.values(results).filter((r) => !r.success).length

            console.log(
                `✅ [ApproveWithModifyDialog] ManyChat flow sent: ${successCount} success, ${failureCount} failures`
            )

            if (failureCount > 0) {
                console.warn("⚠️ [ApproveWithModifyDialog] Some ManyChat flows failed:", results)
                throw new Error("שגיאה בשליחת ההודעה ללקוח")
            }
        } catch (error) {
            console.error("❌ [ApproveWithModifyDialog] Error triggering ManyChat flow:", error)
            throw error
        }
    }

    const handleApproveRequest = async () => {
        if (!appointment) return

        setIsSending(true)
        try {
            // Send ManyChat flow first if checkbox is checked
            if (notifyCustomer) {
                await triggerManyChatApprovedWithModifyFlow()
            }

            // After ManyChat flow succeeds, approve the appointment
            // Only approve grooming appointments (not personal appointments)
            if (!appointment.isPersonalAppointment && appointment.appointmentType !== "private") {
                const appointmentId = extractGroomingAppointmentId(appointment.id, appointment.groomingAppointmentId)
                const approvalResult = await approveAppointmentByManager(appointmentId, "grooming", "scheduled")

                if (!approvalResult.success) {
                    throw new Error(approvalResult.error || "לא ניתן לאשר את התור")
                }

                // Invalidate cache to refresh the schedule immediately
                console.log("🔄 [ApproveWithModifyDialog] Invalidating cache after appointment approval")
                dispatch(
                    supabaseApi.util.invalidateTags([
                        { type: 'ManagerSchedule', id: 'LIST' },
                        'ManagerSchedule',
                        'Appointment'
                    ])
                )
                console.log("✅ [ApproveWithModifyDialog] Cache invalidation dispatched")
            }

            // Close the dialog
            dispatch(setApproveWithModifyDialogOpen(false))
            dispatch(setAppointmentToApproveWithModify(null))

            // Open the appropriate edit modal
            if (appointment.isPersonalAppointment || appointment.appointmentType === "private") {
                dispatch(setEditingPersonalAppointment(appointment))
                dispatch(setPersonalAppointmentEditOpen(true))
            } else {
                dispatch(setEditingGroomingAppointment(appointment))
                dispatch(setGroomingEditOpen(true))
            }

            if (notifyCustomer) {
                toast({
                    title: "הצלחה",
                    description: "ההודעה נשלחה ללקוח והתור אושר, ניתן כעת לערוך את התור",
                })
            } else {
                toast({
                    title: "הצלחה",
                    description: "התור אושר, ניתן כעת לערוך את התור",
                })
            }
        } catch (error) {
            console.error("Error in approve with modify:", error)
            toast({
                title: "שגיאה",
                description: error instanceof Error ? error.message : "אירעה שגיאה בתהליך אישור התור",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }

    const handleClose = () => {
        if (isSending) return
        dispatch(setApproveWithModifyDialogOpen(false))
        dispatch(setAppointmentToApproveWithModify(null))
        setNotifyCustomer(true) // Reset checkbox
    }

    if (!appointment) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">אישור בקשה עם שינויים</DialogTitle>
                    <DialogDescription className="text-right">
                        עדכן את הלקוח כי אתה מאשר את בקשתו אך תשנה אותה
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Display appointment information */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-600">תאריך התור:</span>
                            <span className="text-sm font-semibold text-gray-900">{appointmentDate}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-600">שעת התור:</span>
                            <span className="text-sm font-semibold text-gray-900">{appointmentTime}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-600">שם הכלב:</span>
                            <span className="text-sm font-semibold text-gray-900">{dogName}</span>
                        </div>
                    </div>

                    {/* Checkbox */}
                    <div className="flex items-start space-x-3 space-x-reverse">
                        <Checkbox
                            id="notify-customer"
                            checked={notifyCustomer}
                            onCheckedChange={(checked: CheckedState) => setNotifyCustomer(checked === true)}
                            disabled={isSending}
                        />
                        <label
                            htmlFor="notify-customer"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-right"
                        >
                            עדכן את הלקוח כי אתה מאשר את בקשתו אך תשנה אותה
                        </label>
                    </div>
                </div>

                <DialogFooter className="gap-2 flex sm:justify-start">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isSending}
                    >
                        ביטול
                    </Button>
                    <Button
                        type="button"
                        variant="default"
                        onClick={handleApproveRequest}
                        disabled={isSending}
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                שולח...
                            </>
                        ) : (
                            "אישור בקשה"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

