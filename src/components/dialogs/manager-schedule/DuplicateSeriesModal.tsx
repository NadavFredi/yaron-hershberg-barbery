import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { DatePickerInput } from "@/components/DatePickerInput"
import { format, addDays } from "date-fns"
import { he } from "date-fns/locale"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { getManyChatFlowId } from "@/lib/manychat"
import { supabaseApi } from "@/store/services/supabaseApi"
import {
    setDuplicateSeriesOpen,
    setAppointmentToDuplicate,
    setDuplicateLoading,
    setDuplicateSuccessOpen,
    setCreatedAppointments,
    setSelectedClient,
    setIsClientDetailsOpen,
    setSelectedDog,
    setIsDogDetailsOpen
} from "@/store/slices/managerScheduleSlice"
import type { ClientDetails, DogDetails } from "@/store/slices/managerScheduleSlice"

export function DuplicateSeriesModal() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.duplicateSeriesOpen)
    const appointmentToDuplicate = useAppSelector((state) => state.managerSchedule.appointmentToDuplicate)
    const duplicateLoading = useAppSelector((state) => state.managerSchedule.duplicateLoading)

    const [weeksInterval, setWeeksInterval] = useState(1)
    const [repeatType, setRepeatType] = useState<'count' | 'endDate'>('count')
    const [repeatCount, setRepeatCount] = useState(4)
    const [endDate, setEndDate] = useState<Date | null>(null)
    const [sendRepeatedAppointmentMessage, setSendRepeatedAppointmentMessage] = useState(false)
    const [duplicateClientNotes, setDuplicateClientNotes] = useState(false)
    const [duplicateGroomingNotes, setDuplicateGroomingNotes] = useState(false)
    const [duplicateTeamNotes, setDuplicateTeamNotes] = useState(false)

    const [startDate, setStartDate] = useState<Date | null>(null)

    // Calculate and update start date when modal opens or weeksInterval changes
    // Start date = appointment date + (7 days * weeksInterval)
    // Use UTC methods to avoid timezone issues
    useEffect(() => {
        if (open && appointmentToDuplicate) {
            const appointmentDate = new Date(appointmentToDuplicate.startDateTime)
            // Extract UTC date components to avoid timezone shifts
            const year = appointmentDate.getUTCFullYear()
            const month = appointmentDate.getUTCMonth()
            const day = appointmentDate.getUTCDate()
            // Create date at midnight UTC for the appointment date
            const appointmentDateUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
            const daysToAdd = 7 * weeksInterval
            const calculatedDate = addDays(appointmentDateUTC, daysToAdd)
            setStartDate(calculatedDate)
        }
    }, [open, weeksInterval, appointmentToDuplicate])

    const handleClose = () => {
        dispatch(setDuplicateSeriesOpen(false))
        dispatch(setAppointmentToDuplicate(null))
        // Reset form
        setWeeksInterval(1)
        setRepeatType('count')
        setRepeatCount(4)
        setEndDate(null)
        setStartDate(null)
        setSendRepeatedAppointmentMessage(false)
        setDuplicateClientNotes(false)
        setDuplicateGroomingNotes(false)
        setDuplicateTeamNotes(false)
    }

    const handleConfirm = async () => {
        if (!appointmentToDuplicate) return

        if (!startDate) {
            alert('יש לבחור תאריך התחלה')
            return
        }
        if (repeatType === 'count' && repeatCount < 1) {
            alert('מספר החזרות חייב להיות לפחות 1')
            return
        }
        if (repeatType === 'endDate' && !endDate) {
            alert('יש לבחור תאריך סיום')
            return
        }

        dispatch(setDuplicateLoading(true))
        try {
            // Call the backend function
            const response = await supabase.functions.invoke('duplicate-appointment', {
                body: {
                    appointmentId: appointmentToDuplicate.id,
                    weeksInterval: weeksInterval,
                    repeatType: repeatType,
                    repeatCount: repeatType === 'count' ? repeatCount : undefined,
                    endDate: repeatType === 'endDate' ? endDate?.toISOString() : undefined,
                    startDate: startDate.toISOString(),
                    seriesId: appointmentToDuplicate.seriesId || appointmentToDuplicate.appointmentGroupId || undefined, // Use existing series ID if available, or generate new one
                    startTime: appointmentToDuplicate.startDateTime, // Send original start time
                    endTime: appointmentToDuplicate.endDateTime, // Send original end time
                    duplicateClientNotes: duplicateClientNotes,
                    duplicateGroomingNotes: duplicateGroomingNotes,
                    duplicateTeamNotes: duplicateTeamNotes
                }
            })

            if (response.error) {
                throw response.error
            }

            // Parse the response to get created appointments
            const createdAppts = response.data?.createdAppointments || []

            // Invalidate cache to refresh appointment sheet immediately
            console.log("🔄 [DuplicateSeriesModal] Invalidating cache after creating duplicates", {
                appointmentId: appointmentToDuplicate.id,
                seriesId: appointmentToDuplicate.seriesId || appointmentToDuplicate.appointmentGroupId,
                createdAppointmentsCount: createdAppts.length
            })
            dispatch(supabaseApi.util.invalidateTags(["ManagerSchedule", "Appointment", "GardenAppointment"]))

            // Also invalidate dog-specific appointments cache if we have a dog ID
            if (appointmentToDuplicate.dogs && appointmentToDuplicate.dogs.length > 0) {
                const dogId = appointmentToDuplicate.dogs[0].id
                console.log("🔄 [DuplicateSeriesModal] Invalidating dog-specific appointments cache", { dogId })
                dispatch(supabaseApi.util.invalidateTags([
                    { type: "Appointment", id: dogId },
                    { type: "Appointment", id: `getMergedAppointments-${dogId}` }
                ]))
            }

            // Send ManyChat flow if checkbox is checked and we have customer phone
            if (sendRepeatedAppointmentMessage && appointmentToDuplicate.clientPhone && appointmentToDuplicate.clientName) {
                try {
                    console.log("📱 [DuplicateSeriesModal] Sending repeated appointment message:", {
                        phone: appointmentToDuplicate.clientPhone,
                        name: appointmentToDuplicate.clientName,
                        appointmentId: appointmentToDuplicate.id
                    })

                    const flowId = getManyChatFlowId("SEND_REPEATED_APPOINTMENT_MESSAGE")
                    if (!flowId) {
                        console.error("❌ [DuplicateSeriesModal] ManyChat flow ID not configured")
                    } else {
                        // Prepare user data for set-manychat-fields-and-send-flow
                        const users = [{
                            phone: appointmentToDuplicate.clientPhone.replace(/\D/g, ""), // Normalize to digits only
                            name: appointmentToDuplicate.clientName,
                            fields: {} // No custom fields needed for this flow
                        }]

                        // Call set-manychat-fields-and-send-flow function
                        const { data: manychatData, error: manychatError } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                            body: {
                                users: users,
                                flow_id: flowId
                            }
                        })

                        if (manychatError) {
                            console.error("❌ [DuplicateSeriesModal] Error sending ManyChat flow:", manychatError)
                            // Don't fail the whole operation if ManyChat fails
                            toast({
                                title: "סדרת תורים נוצרה בהצלחה",
                                description: "התורים נוצרו בהצלחה, אך שליחת ההודעה נכשלה.",
                                variant: "default",
                            })
                        } else {
                            console.log("✅ [DuplicateSeriesModal] ManyChat flow sent successfully:", manychatData)
                            // Check if send was successful
                            const results = manychatData as Record<string, { success?: boolean; error?: string }>
                            const phoneKey = appointmentToDuplicate.clientPhone.replace(/\D/g, "")
                            const result = results[phoneKey]

                            if (result?.success) {
                                console.log("✅ [DuplicateSeriesModal] Message sent successfully to customer")
                            } else {
                                console.warn("⚠️ [DuplicateSeriesModal] Message send may have failed:", result?.error)
                            }
                        }
                    }
                } catch (manychatError) {
                    console.error("❌ [DuplicateSeriesModal] Exception sending ManyChat flow:", manychatError)
                    // Don't fail the whole operation if ManyChat fails
                }
            }

            // Close duplicate series modal
            dispatch(setDuplicateSeriesOpen(false))
            dispatch(setAppointmentToDuplicate(null))
            dispatch(setDuplicateLoading(false))

            // Show success modal with created appointments
            if (createdAppts.length > 0) {
                dispatch(setCreatedAppointments(createdAppts))
                dispatch(setDuplicateSuccessOpen(true))
            } else {
                // If no appointments returned, show a simple success message
                toast({
                    title: "סדרת תורים נוצרה בהצלחה",
                    description: "התורים נוצרו בהצלחה במערכת.",
                })
            }
        } catch (error) {
            console.error('Error creating duplicate series:', error)
            dispatch(setDuplicateLoading(false))
            alert('שגיאה ביצירת סדרת התורים החוזרת')
        }
    }

    return (
        <Dialog open={open} onOpenChange={duplicateLoading ? undefined : (value) => {
            if (!value) {
                handleClose()
            } else {
                dispatch(setDuplicateSeriesOpen(true))
            }
        }}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" dir="rtl">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-right">שכפול תור כסדרה חוזרת</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את הפרמטרים לסדרת התורים החוזרת
                    </DialogDescription>
                </DialogHeader>

                {appointmentToDuplicate && (
                    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                        {/* Appointment Details */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">פרטי התור המקורי</h3>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><span className="font-medium">תאריך מקורי:</span> {format(new Date(appointmentToDuplicate.startDateTime), 'dd/MM/yyyy', { locale: he })}</div>
                                <div>
                                    <span className="font-medium">לקוח:</span>{' '}
                                    {appointmentToDuplicate.dogs[0] ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const dog: DogDetails = {
                                                    id: appointmentToDuplicate.dogs[0].id,
                                                    name: appointmentToDuplicate.dogs[0].name || 'לא ידוע',
                                                    breed: appointmentToDuplicate.dogs[0].breed,
                                                    clientClassification: appointmentToDuplicate.dogs[0].clientClassification || appointmentToDuplicate.clientClassification,
                                                    owner: appointmentToDuplicate.clientName ? {
                                                        name: appointmentToDuplicate.clientName,
                                                        classification: appointmentToDuplicate.clientClassification,
                                                        phone: appointmentToDuplicate.clientPhone,
                                                        email: appointmentToDuplicate.clientEmail,
                                                        clientId: appointmentToDuplicate.clientId,
                                                        recordId: appointmentToDuplicate.clientId
                                                    } : undefined,
                                                    customer_id: appointmentToDuplicate.clientId
                                                }
                                                dispatch(setSelectedDog(dog))
                                                dispatch(setIsDogDetailsOpen(true))
                                            }}
                                            className="text-primary hover:text-primary hover:underline cursor-pointer"
                                        >
                                            {appointmentToDuplicate.dogs[0].name || 'לא ידוע'}
                                        </button>
                                    ) : (
                                        'לא ידוע'
                                    )}
                                </div>
                                <div>
                                    <span className="font-medium">לקוח:</span>{' '}
                                    {appointmentToDuplicate.clientName ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const client: ClientDetails = {
                                                    name: appointmentToDuplicate.clientName || 'לא ידוע',
                                                    classification: appointmentToDuplicate.clientClassification,
                                                    phone: appointmentToDuplicate.clientPhone,
                                                    email: appointmentToDuplicate.clientEmail,
                                                    clientId: appointmentToDuplicate.clientId,
                                                    recordId: appointmentToDuplicate.clientId
                                                }
                                                dispatch(setSelectedClient(client))
                                                dispatch(setIsClientDetailsOpen(true))
                                            }}
                                            className="text-primary hover:text-primary hover:underline cursor-pointer"
                                        >
                                            {appointmentToDuplicate.clientName}
                                        </button>
                                    ) : (
                                        'לא ידוע'
                                    )}
                                </div>
                                <div><span className="font-medium">זמן:</span> {format(new Date(appointmentToDuplicate.startDateTime), 'HH:mm')} - {format(new Date(appointmentToDuplicate.endDateTime), 'HH:mm')}</div>
                                <div><span className="font-medium">שירות:</span> {appointmentToDuplicate.serviceType === 'garden' ? '' : 'מספרה'}</div>
                                {(appointmentToDuplicate.seriesId || appointmentToDuplicate.appointmentGroupId) && (
                                    <div className="col-span-2"><span className="font-medium">מזהה סדרה/קבוצה:</span> {appointmentToDuplicate.seriesId || appointmentToDuplicate.appointmentGroupId}</div>
                                )}
                            </div>
                        </div>

                        {/* Recurrence Settings */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium text-gray-700">
                                    החל מ-
                                </Label>
                                <DatePickerInput
                                    value={startDate}
                                    onChange={() => { }} // Non-modifiable
                                    disabled
                                    autoOpenOnFocus={false}
                                    className="w-40"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="weeksInterval" className="text-sm font-medium text-gray-700">
                                    חזור כל כמה שבועות?
                                </Label>
                                <span className="text-sm text-gray-600">שבועות</span>
                                <Input
                                    id="weeksInterval"
                                    type="number"
                                    min="1"
                                    value={weeksInterval}
                                    onChange={(e) => setWeeksInterval(parseInt(e.target.value) || 1)}
                                    className="w-16 text-right"
                                    disabled={duplicateLoading}
                                />

                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700 text-right block">
                                    מתי להפסיק את הסדרה?
                                </Label>
                                <RadioGroup value={repeatType} onValueChange={(value) => setRepeatType(value as 'count' | 'endDate')} disabled={duplicateLoading}>
                                    <div className="flex items-center justify-end gap-2">
                                        <Label htmlFor="count" className="flex items-center gap-2">
                                            <span>פעמים</span>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={repeatCount}
                                                onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
                                                className="w-20 text-right"
                                                disabled={duplicateLoading || repeatType !== 'count'}
                                            />
                                            <span>חזור</span>
                                        </Label>
                                        <RadioGroupItem value="count" id="count" />
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        <Label htmlFor="endDate" className="flex items-center gap-2">
                                            <DatePickerInput
                                                value={endDate}
                                                onChange={setEndDate}
                                                disabled={duplicateLoading || repeatType !== 'endDate'}
                                                autoOpenOnFocus={false}
                                                className="w-40"
                                            />
                                            <span>:עד לתאריך</span>
                                        </Label>
                                        <RadioGroupItem value="endDate" id="endDate" />
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>

                        {/* Duplicate Notes Checkboxes */}
                        <div className="py-3 border-t border-gray-200">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="duplicate-notes" className="border rounded-lg">
                                    <AccordionTrigger className="text-right px-4 py-3 hover:no-underline">
                                        <span className="text-sm font-medium text-gray-700">
                                            העתק הערות לתורים עתידיים:
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <div className="space-y-2">
                                            <div className={`flex items-center gap-2 space-x-2 rtl:space-x-reverse rounded-md p-3 border transition-colors ${duplicateClientNotes
                                                ? 'bg-green-100 border-green-300'
                                                : 'bg-transparent border-green-200'
                                                }`}>
                                                <Checkbox
                                                    id="duplicate-client-notes"
                                                    checked={duplicateClientNotes}
                                                    onCheckedChange={(checked) => setDuplicateClientNotes(checked === true)}
                                                    disabled={duplicateLoading}
                                                />
                                                <Label
                                                    htmlFor="duplicate-client-notes"
                                                    className={`text-sm font-medium cursor-pointer ${duplicateClientNotes
                                                        ? 'text-green-900'
                                                        : 'text-gray-700'
                                                        }`}
                                                >
                                                    העתק הערות לקוח לתורים
                                                </Label>
                                            </div>
                                            {appointmentToDuplicate.serviceType === 'grooming' && (
                                                <div className={`flex items-center gap-2 space-x-2 rtl:space-x-reverse rounded-md p-3 border transition-colors ${duplicateGroomingNotes
                                                    ? 'bg-purple-100 border-purple-300'
                                                    : 'bg-transparent border-purple-200'
                                                    }`}>
                                                    <Checkbox
                                                        id="duplicate-grooming-notes"
                                                        checked={duplicateGroomingNotes}
                                                        onCheckedChange={(checked) => setDuplicateGroomingNotes(checked === true)}
                                                        disabled={duplicateLoading}
                                                    />
                                                    <Label
                                                        htmlFor="duplicate-grooming-notes"
                                                        className={`text-sm font-medium cursor-pointer ${duplicateGroomingNotes
                                                            ? 'text-purple-900'
                                                            : 'text-gray-700'
                                                            }`}
                                                    >
                                                        העתק הערות "מה עשינו היום"
                                                    </Label>
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-2 space-x-2 rtl:space-x-reverse rounded-md p-3 border transition-colors ${duplicateTeamNotes
                                                ? 'bg-primary/20 border-primary/30'
                                                : 'bg-transparent border-primary/20'
                                                }`}>
                                                <Checkbox
                                                    id="duplicate-team-notes"
                                                    checked={duplicateTeamNotes}
                                                    onCheckedChange={(checked) => setDuplicateTeamNotes(checked === true)}
                                                    disabled={duplicateLoading}
                                                />
                                                <Label
                                                    htmlFor="duplicate-team-notes"
                                                    className={`text-sm font-medium cursor-pointer ${duplicateTeamNotes
                                                        ? 'text-primary'
                                                        : 'text-gray-700'
                                                        }`}
                                                >
                                                    העתק הערות צוות לתורים
                                                </Label>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>

                        {/* Send Message Checkbox Banner */}
                        <div className="py-3 border-t border-gray-200">
                            <div className={`flex items-center gap-2 space-x-2 rtl:space-x-reverse rounded-md p-3 border transition-colors ${sendRepeatedAppointmentMessage
                                ? 'bg-primary/20 border-primary/30'
                                : 'bg-transparent border-primary/20'
                                }`}>
                                <Checkbox
                                    id="send-repeated-message"
                                    checked={sendRepeatedAppointmentMessage}
                                    onCheckedChange={(checked) => setSendRepeatedAppointmentMessage(checked === true)}
                                    disabled={duplicateLoading}
                                />
                                <Label
                                    htmlFor="send-repeated-message"
                                    className={`text-sm font-medium cursor-pointer ${sendRepeatedAppointmentMessage
                                        ? 'text-primary'
                                        : 'text-gray-700'
                                        }`}
                                >
                                    שלח הודעת - קבעת תורים חוזרים
                                </Label>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end flex-shrink-0">
                    <Button variant="outline" onClick={handleClose} disabled={duplicateLoading}>
                        ביטול
                    </Button>
                    <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700" disabled={duplicateLoading}>
                        {duplicateLoading ? 'יוצר סדרה...' : 'צור סדרה חוזרת'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
