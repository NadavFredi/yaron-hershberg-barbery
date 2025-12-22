import React, { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TimePickerInput } from "@/components/TimePickerInput"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Loader2, X, FileText, Info } from "lucide-react"
import { format, addMinutes } from "date-fns"
import { he } from "date-fns/locale"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { extractGroomingAppointmentId } from "@/lib/utils"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface ManagerStation {
    id: string
    name: string
}

interface BulkEditForm {
    startTime: string
    endTime: string
    stationId: string
    notes: string
    internalNotes: string
    groomingNotes: string
}

interface BulkEditAppointmentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointments: ManagerAppointment[]
    stations: ManagerStation[]
    onSuccess: () => void
}

export const BulkEditAppointmentsModal: React.FC<BulkEditAppointmentsModalProps> = ({
    open,
    onOpenChange,
    appointments,
    stations,
    onSuccess
}) => {
    const { toast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
    const [updateCustomer, setUpdateCustomer] = useState(false)
    const [dialogContentElement, setDialogContentElement] = useState<HTMLDivElement | null>(null)

    // Initialize form with first appointment's values
    const initialForm = useMemo(() => {
        if (appointments.length === 0) {
            return {
                startTime: "",
                endTime: "",
                stationId: "",
                notes: "",
                internalNotes: "",
                groomingNotes: ""
            }
        }

        const firstAppointment = appointments[0]
        const startDate = new Date(firstAppointment.startDateTime)
        const endDate = new Date(firstAppointment.endDateTime)

        return {
            startTime: format(startDate, "HH:mm"),
            endTime: format(endDate, "HH:mm"),
            stationId: firstAppointment.stationId || "",
            notes: (firstAppointment as any).customerNotes || "",
            internalNotes: (firstAppointment as any).internalNotes || "",
            groomingNotes: (firstAppointment as any).groomingNotes || ""
        }
    }, [appointments])

    const [form, setForm] = useState<BulkEditForm>(initialForm)

    // Reset form when appointments change
    useEffect(() => {
        setForm(initialForm)
    }, [initialForm])

    // Calculate duration from start and end time
    const duration = useMemo(() => {
        if (!form.startTime || !form.endTime) return 0
        try {
            const [startHours, startMinutes] = form.startTime.split(':').map(Number)
            const [endHours, endMinutes] = form.endTime.split(':').map(Number)
            const start = new Date(2000, 0, 1, startHours, startMinutes)
            const end = new Date(2000, 0, 1, endHours, endMinutes)
            if (end < start) {
                // Handle overnight case
                end.setDate(end.getDate() + 1)
            }
            return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
        } catch {
            return 0
        }
    }, [form.startTime, form.endTime])

    const handleSave = async () => {
        if (!form.startTime || !form.endTime) {
            toast({
                title: "שגיאה",
                description: "יש להזין שעת התחלה ושעת סיום",
                variant: "destructive",
            })
            return
        }

        if (duration <= 0) {
            toast({
                title: "שגיאה",
                description: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
                variant: "destructive",
            })
            return
        }

        setIsSaving(true)
        try {
            // Update each appointment
            for (const appointment of appointments) {
                const appointmentDate = new Date(appointment.startDateTime)
                const [startHours, startMinutes] = form.startTime.split(':').map(Number)
                const [endHours, endMinutes] = form.endTime.split(':').map(Number)

                // Create new start and end times with the same date
                const newStartTime = new Date(appointmentDate)
                newStartTime.setHours(startHours, startMinutes, 0, 0)

                const newEndTime = new Date(appointmentDate)
                newEndTime.setHours(endHours, endMinutes, 0, 0)

                // If end time is before start time, add a day
                if (newEndTime < newStartTime) {
                    newEndTime.setDate(newEndTime.getDate() + 1)
                }

                const tableName = "grooming_appointments"
                const appointmentId = extractGroomingAppointmentId(appointment.id, (appointment as any).groomingAppointmentId)

                // Prepare update data
                const updateData: any = {
                    start_at: newStartTime.toISOString(),
                    end_at: newEndTime.toISOString(),
                }

                // Update station if provided (empty string means keep existing, "none" means remove)
                if (form.stationId === "none") {
                    updateData.station_id = null
                } else if (form.stationId) {
                    updateData.station_id = form.stationId
                }

                // Update notes if provided
                if (form.notes !== undefined) {
                    updateData.customer_notes = form.notes.trim() || null
                }

                if (form.internalNotes !== undefined) {
                    updateData.internal_notes = form.internalNotes.trim() || null
                }

                // Note: grooming_notes column doesn't exist - skipping update
                // if (appointment.serviceType === "grooming" && form.groomingNotes !== undefined) {
                //     updateData.grooming_notes = form.groomingNotes.trim() || null
                // }

                const { error } = await supabase
                    .from(tableName)
                    .update(updateData)
                    .eq("id", appointmentId)

                if (error) {
                    console.error(`Error updating appointment ${appointment.id}:`, error)
                    throw error
                }
            }

            toast({
                title: "הצלחה",
                description: `${appointments.length} תורים עודכנו בהצלחה`,
            })

            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error("Error updating appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את התורים",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    // Group appointments by service type
    const groomingAppointments = appointments.filter(apt => apt.serviceType === "grooming")
    const gardenAppointments = appointments.filter(apt => apt.serviceType === "garden")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-6"
                dir="rtl"
                ref={setDialogContentElement}
                onInteractOutside={(e) => {
                    // Prevent closing when clicking on TimePickerInput portal
                    const target = e.target as HTMLElement
                    if (!target) return

                    // Check if click is inside the time picker portal
                    const timePickerPortal = target.closest('[data-time-picker-portal]')
                    if (timePickerPortal) {
                        e.preventDefault()
                        return
                    }

                    // Also check if the target itself is the portal
                    if (target.hasAttribute('data-time-picker-portal')) {
                        e.preventDefault()
                        return
                    }
                }}
                onPointerDownOutside={(e) => {
                    // Also prevent on pointer down to catch all interaction types
                    const target = e.target as HTMLElement
                    if (!target) return

                    const timePickerPortal = target.closest('[data-time-picker-portal]')
                    if (timePickerPortal || target.hasAttribute('data-time-picker-portal')) {
                        e.preventDefault()
                    }
                }}
            >
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute left-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 !block"
                    tabIndex={-1}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                <DialogHeader className="text-right flex-shrink-0">
                    <DialogTitle className="text-right">עריכת תורים מרובים</DialogTitle>
                    <DialogDescription className="text-right">
                        עריכת {appointments.length} תורים - שעות, עמדה והערות
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 pl-2">
                        <div className="space-y-4" dir="rtl">
                            {/* Station Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 text-right block">
                                    עמדה
                                </label>
                                <select
                                    value={form.stationId}
                                    onChange={(e) => setForm(prev => ({ ...prev, stationId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-right bg-white focus:ring-primary focus:border-primary"
                                    disabled={isSaving}
                                >
                                    <option value="">שמור עמדה קיימת</option>
                                    <option value="none">הסר עמדה</option>
                                    {stations.map((station) => (
                                        <option key={station.id} value={station.id}>
                                            {station.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Time Selection */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 text-right block">
                                        שעת התחלה
                                    </label>
                                    <TimePickerInput
                                        value={form.startTime}
                                        onChange={(time) => setForm(prev => ({ ...prev, startTime: time }))}
                                        intervalMinutes={15}
                                        wrapperClassName="w-full"
                                        className="px-3 py-2 border border-gray-300 focus-visible:ring-primary focus-visible:border-primary"
                                        portalContainer={dialogContentElement}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 text-right block">
                                        שעת סיום
                                    </label>
                                    <TimePickerInput
                                        value={form.endTime}
                                        onChange={(time) => setForm(prev => ({ ...prev, endTime: time }))}
                                        intervalMinutes={15}
                                        wrapperClassName="w-full"
                                        className="px-3 py-2 border border-gray-300 focus-visible:ring-primary focus-visible:border-primary"
                                        portalContainer={dialogContentElement}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 text-right block">
                                        משך התור
                                    </label>
                                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-right bg-gray-50 text-gray-600">
                                        {duration > 0 ? `${duration} דקות` : "-"}
                                    </div>
                                </div>
                            </div>

                            {/* Customer Notes */}
                            <div className="space-y-2 border-b pb-4">
                                <label className="text-sm font-medium text-gray-700 text-right flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                    משהו שחשוב שנדע
                                </label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="הערות שיוצגו ללקוח..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none"
                                    rows={2}
                                    disabled={isSaving}
                                />
                                <p className="text-xs text-gray-500 text-right">
                                    הערות אלו נראות גם ללקוח וגם לצוות
                                </p>
                            </div>

                            {/* Additional Notes - Collapsible sections */}
                            <Accordion type="multiple" className="w-full">
                                <AccordionItem value="internal-notes" className="border-b">
                                    <AccordionTrigger className="text-right hover:no-underline py-3">
                                        <div className="flex items-center gap-2 flex-1">
                                            <FileText className="h-4 w-4 text-primary/60" />
                                            <span className="font-medium">הערות פנימיות</span>
                                            {form.internalNotes ? (
                                                <span className="text-xs text-gray-500 line-clamp-1">
                                                    • {form.internalNotes.length > 60
                                                        ? `${form.internalNotes.substring(0, 60)}...`
                                                        : form.internalNotes}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">• אין נתונים</span>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-2 pt-2">
                                            <textarea
                                                value={form.internalNotes}
                                                onChange={(e) => setForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                                                placeholder="הערות פנימיות לצוות..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none min-h-[100px]"
                                                disabled={isSaving}
                                            />
                                            <p className="text-xs text-primary text-right">
                                                הערות אלו נראות רק לצוות ולא ללקוח
                                            </p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {groomingAppointments.length > 0 && (
                                    <AccordionItem value="grooming-notes" className="border-b">
                                        <AccordionTrigger className="text-right hover:no-underline py-3">
                                            <div className="flex items-center gap-2 flex-1">
                                                <FileText className="h-4 w-4 text-purple-400" />
                                                <span className="font-medium">מה עשינו היום</span>
                                                {form.groomingNotes ? (
                                                    <span className="text-xs text-gray-500 line-clamp-1">
                                                        • {form.groomingNotes.length > 60
                                                            ? `${form.groomingNotes.substring(0, 60)}...`
                                                            : form.groomingNotes}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">• אין נתונים</span>
                                                )}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-2 pt-2">
                                                <textarea
                                                    value={form.groomingNotes}
                                                    onChange={(e) => setForm(prev => ({ ...prev, groomingNotes: e.target.value }))}
                                                    placeholder="הערות ספציפיות לתספורת של תור זה..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-right resize-none min-h-[100px]"
                                                    disabled={isSaving}
                                                />
                                                <p className="text-xs text-primary text-right">
                                                    הערות ספציפיות לתספורת (רק עבור תורי מספרה)
                                                </p>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                            </Accordion>

                            {/* Appointments List */}
                            <div className="space-y-2 border-t pt-4">
                                <label className="text-sm font-medium text-gray-700 text-right block">
                                    תורים שיעודכנו ({appointments.length})
                                </label>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                                    <div className="space-y-2">
                                        {appointments.map((appointment) => {
                                            const startDate = new Date(appointment.startDateTime)
                                            return (
                                                <div key={appointment.id} className="text-sm text-gray-700 text-right">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <span className="font-medium">
                                                            {format(startDate, "dd.MM.yyyy", { locale: he })} - {format(startDate, "HH:mm", { locale: he })}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            ({appointment.serviceType === "grooming" ? "מספרה" : ""})
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Update Customer Checkbox */}
                <div className="py-4 border-t border-gray-200 flex-shrink-0" dir="rtl">
                    <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md p-3">
                        <label htmlFor="updateCustomer" className="text-sm text-primary font-medium text-right cursor-pointer flex-1">
                            עדכן את הלקוח על השינויים בתור
                        </label>
                        <input
                            type="checkbox"
                            id="updateCustomer"
                            checked={updateCustomer}
                            onChange={(e) => setUpdateCustomer(e.target.checked)}
                            className="rounded border-gray-300"
                            disabled={isSaving}
                        />
                        <Info className="h-4 w-4 text-primary flex-shrink-0" />
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex-shrink-0">
                    <Button
                        onClick={handleSave}
                        className="bg-primary hover:bg-primary/90"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                שומר...
                            </>
                        ) : (
                            `שמור שינויים (${appointments.length})`
                        )}
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
