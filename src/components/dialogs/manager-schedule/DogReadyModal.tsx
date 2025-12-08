import { useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Send, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import { getManyChatFlowId, getManyChatCustomFieldId } from "@/lib/manychat"
import { RecipientSelector, type RecipientSelection, type CustomPhoneRecipient } from "./RecipientSelector"
import { isValidPhoneNumber } from "libphonenumber-js"

interface DogReadyModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: ManagerAppointment | null
}

export const DogReadyModal: React.FC<DogReadyModalProps> = ({
    open,
    onOpenChange,
    appointment
}) => {
    const { toast } = useToast()
    const [isSending, setIsSending] = useState(false)
    const [minutes, setMinutes] = useState<string>("")
    const [defaultMinutes, setDefaultMinutes] = useState<number | null>(null)
    const [recipientSelection, setRecipientSelection] = useState<RecipientSelection>({
        ownerPhone: null,
        selectedContactIds: [],
        customPhones: [] as CustomPhoneRecipient[]
    })

    // Load default minutes from settings when modal opens
    useEffect(() => {
        if (open && !defaultMinutes) {
            const loadDefaultMinutes = async () => {
                try {
                    const { data, error } = await supabase
                        .from("appointment_reminder_settings")
                        .select("dog_ready_default_minutes")
                        .maybeSingle<{ dog_ready_default_minutes: number | null }>()

                    if (error) {
                        console.error("[DogReadyModal] Error loading default minutes:", error)
                        // Use fallback default
                        setDefaultMinutes(30)
                        setMinutes("30")
                        return
                    }

                    const defaultVal = data?.dog_ready_default_minutes ?? 30
                    setDefaultMinutes(defaultVal)
                    setMinutes(defaultVal.toString())
                } catch (error) {
                    console.error("[DogReadyModal] Failed to load default minutes:", error)
                    // Use fallback default
                    setDefaultMinutes(30)
                    setMinutes("30")
                }
            }

            loadDefaultMinutes()
        }
    }, [open, defaultMinutes])

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            // Reset to empty, will be set when modal opens again
            setMinutes("")
            setDefaultMinutes(null)
            setRecipientSelection({
                ownerPhone: null,
                selectedContactIds: [],
                customPhones: [] as CustomPhoneRecipient[]
            })
        }
    }, [open])

    // Validate custom phones - ALL custom phone entries must be either completely empty OR fully valid
    const isCustomPhonesValid = useMemo(() => {
        // If there are no custom phones, it's valid
        if (recipientSelection.customPhones.length === 0) {
            return true
        }

        // Check each custom phone - if ANY field is filled, ALL fields must be valid
        for (const customPhone of recipientSelection.customPhones) {
            const hasName = customPhone.name.trim().length > 0
            const hasPhone = customPhone.phone.trim().length > 0

            // If both are empty, it's valid (will be filtered out)
            if (!hasName && !hasPhone) {
                continue
            }

            // If either field is filled, both must be filled and valid
            if (!hasName || !hasPhone) {
                return false
            }

            // Both are filled, validate phone number format
            try {
                if (!isValidPhoneNumber(customPhone.phone)) {
                    return false
                }
            } catch {
                return false
            }
        }

        return true
    }, [recipientSelection.customPhones])

    // Check if we have at least one recipient
    const hasRecipients = useMemo(() => {
        return (
            recipientSelection.ownerPhone !== null ||
            recipientSelection.selectedContactIds.length > 0 ||
            recipientSelection.customPhones.some(cp => cp.phone.trim() && cp.name.trim())
        )
    }, [recipientSelection])

    const handleSend = async () => {
        if (!appointment?.clientId) {
            return
        }

        const minutesNum = parseInt(minutes.trim(), 10)
        if (isNaN(minutesNum) || minutesNum <= 0) {
            toast({
                title: "שגיאה",
                description: "יש להזין מספר דקות תקין (גדול מ-0)",
                variant: "destructive",
            })
            return
        }

        // Collect all phone numbers to send to
        const phonesToSend: Array<{ phone: string; name: string }> = []

        // Add owner phone if available
        if (recipientSelection.ownerPhone) {
            phonesToSend.push({
                phone: recipientSelection.ownerPhone,
                name: appointment.clientName || "לקוח"
            })
        }

        // Add selected contacts
        if (recipientSelection.selectedContactIds.length > 0) {
            const { data: contactsData } = await supabase
                .from('customer_contacts')
                .select('id, name, phone')
                .in('id', recipientSelection.selectedContactIds)

            if (contactsData) {
                for (const contact of contactsData) {
                    if (contact.phone) {
                        phonesToSend.push({
                            phone: contact.phone,
                            name: contact.name || "איש קשר"
                        })
                    }
                }
            }
        }

        // Validate custom phones before sending
        if (!isCustomPhonesValid) {
            toast({
                title: "שגיאה באימות",
                description: "יש לוודא שכל המספרים המותאמים אישית כוללים שם תקין ומספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        // Add custom phones
        for (const customPhone of recipientSelection.customPhones) {
            if (customPhone.phone.trim() && customPhone.name.trim()) {
                phonesToSend.push({
                    phone: customPhone.phone.trim(),
                    name: customPhone.name.trim()
                })
            }
        }

        if (phonesToSend.length === 0) {
            toast({
                title: "חסר מספר טלפון",
                description: "יש לבחור או להזין לפחות מספר טלפון אחד לשליחת ההודעה",
                variant: "destructive",
            })
            return
        }

        setIsSending(true)
        try {
            console.log("📱 [DogReadyModal] Sending dog ready notification:", {
                minutes: minutesNum,
                phones: phonesToSend.map(p => p.phone),
                appointmentId: appointment.id,
                customerId: appointment.clientId
            })

            // Get ManyChat flow ID and custom field ID
            const flowId = getManyChatFlowId("YOUR_DOG_IS_READY_IN_X_MINUTES")
            const fieldId = getManyChatCustomFieldId("DOG_READY_IN_X_TIME")

            if (!flowId || !fieldId) {
                throw new Error("ManyChat flow ID or field ID not configured")
            }

            // Prepare users array for set-manychat-fields-and-send-flow
            const users = phonesToSend.map(({ phone, name }) => ({
                phone: phone.replace(/\D/g, ""), // Normalize to digits only
                name: name,
                fields: {
                    [fieldId]: `${minutesNum} דקות`
                }
            }))

            // Call set-manychat-fields-and-send-flow function
            const { data, error } = await supabase.functions.invoke("set-manychat-fields-and-send-flow", {
                body: {
                    users: users,
                    flow_id: flowId
                }
            })

            if (error) {
                console.error("❌ [DogReadyModal] Error sending notification:", error)
                throw error
            }

            console.log("✅ [DogReadyModal] Notification sent successfully:", data)

            // Check if all sends were successful
            const results = data as Record<string, { success?: boolean; error?: string }>
            const failedPhones: string[] = []
            const successfulPhones: string[] = []

            for (const [key, result] of Object.entries(results)) {
                if (result.success) {
                    successfulPhones.push(key)
                } else {
                    failedPhones.push(key)
                }
            }

            if (failedPhones.length > 0) {
                toast({
                    title: "חלק מההודעות נכשלו",
                    description: `נשלחו בהצלחה ל-${successfulPhones.length} מספרים, נכשלו ${failedPhones.length}`,
                    variant: "destructive",
                })
            } else {
                toast({
                    title: "הודעה נשלחה",
                    description: `הודעה נשלחה ל-${successfulPhones.length} מספר(ים)`,
                })
            }

            onOpenChange(false)
        } catch (error: any) {
            console.error("❌ [DogReadyModal] Error sending notification:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשלוח את ההודעה",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }

    const dogName = appointment?.dogs?.[0]?.name || "הכלב"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[60vh]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                        הכלב יהיה מוכן בעוד X דקות
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        הודע ללקוח ש{dogName} יהיה מוכן בקרוב
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Minutes Input */}
                    <div className="space-y-2">
                        <Label htmlFor="minutes-input" className="text-right flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            מספר דקות עד שהכלב יהיה מוכן
                        </Label>
                        <Input
                            id="minutes-input"
                            type="number"
                            min="1"
                            placeholder="הזן מספר דקות"
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Recipient Selection */}
                    <RecipientSelector
                        customerId={appointment?.clientId || null}
                        customerPhone={appointment?.clientPhone || null}
                        customerName={appointment?.clientName || null}
                        forceOwner
                        onSelectionChange={setRecipientSelection}
                    />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse" dir="rtl">
                    <Button
                        onClick={handleSend}
                        disabled={isSending || !minutes.trim() || parseInt(minutes.trim(), 10) <= 0 || !isCustomPhonesValid || !hasRecipients}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                שולח...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 ml-2" />
                                שלח הודעה
                            </>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSending}
                    >
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

