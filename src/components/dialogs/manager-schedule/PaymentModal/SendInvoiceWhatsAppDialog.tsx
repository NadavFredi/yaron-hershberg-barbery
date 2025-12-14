import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SiWhatsapp } from "react-icons/si"
import { Loader2, Send, X } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { MANYCHAT_FLOW_IDS, MANYCHAT_CUSTOM_FIELDS } from "@/lib/manychat"
import { RecipientSelector, type RecipientSelection, type CustomPhoneRecipient } from "../RecipientSelector"
import { isValidPhoneNumber } from "libphonenumber-js"

export const SendInvoiceWhatsAppDialog = ({
    open,
    onOpenChange,
    invoiceUrl,
    invoiceNumber,
    invoiceType,
    invoiceAmount,
    customerId,
    customerPhone,
    customerName,
}: SendInvoiceWhatsAppDialogProps) => {
    const { toast } = useToast()
    const [isSending, setIsSending] = useState(false)
    const [recipientSelection, setRecipientSelection] = useState<RecipientSelection>({
        ownerPhone: null,
        selectedContactIds: [],
        customPhones: [] as CustomPhoneRecipient[]
    })

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
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

    const handleSendInvoice = async () => {
        if (!customerId) {
            return
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

        // Collect all phone numbers to send to
        const phonesToSend: Array<{ phone: string; name: string }> = []

        // Add owner phone if available
        if (recipientSelection.ownerPhone) {
            phonesToSend.push({
                phone: recipientSelection.ownerPhone,
                name: customerName || "לקוח"
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
                description: "יש לבחור או להזין לפחות מספר טלפון אחד לשליחת החשבונית",
                variant: "destructive",
            })
            return
        }

        setIsSending(true)
        try {
            console.log("📱 [SendInvoiceWhatsAppDialog] Sending invoice via ManyChat:", {
                invoiceUrl,
                phones: phonesToSend.map(p => p.phone),
                customerId
            })

            // Get INVOICE_URL field ID
            const invoiceUrlField = MANYCHAT_CUSTOM_FIELDS.INVOICE_URL
            if (!invoiceUrlField) {
                throw new Error("INVOICE_URL field not found in ManyChat configuration")
            }

            // Get SEND_INVOICE_LINK flow ID
            const flowId = MANYCHAT_FLOW_IDS.SEND_INVOICE_LINK
            if (!flowId) {
                throw new Error("SEND_INVOICE_LINK flow not found in ManyChat configuration")
            }

            // Prepare users array for set-manychat-fields-and-send-flow
            const users = phonesToSend.map(({ phone, name }) => ({
                phone: phone.replace(/\D/g, ""), // Normalize to digits only
                name: name,
                fields: {
                    [invoiceUrlField.id]: invoiceUrl
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
                console.error("❌ [SendInvoiceWhatsAppDialog] Error sending invoice:", error)
                throw error
            }

            console.log("✅ [SendInvoiceWhatsAppDialog] Invoice sent successfully:", data)

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
                    title: "החשבונית נשלחה",
                    description: `החשבונית נשלחה ל-${successfulPhones.length} מספר(ים)`,
                })
            }

            onOpenChange(false)
        } catch (error: any) {
            console.error("❌ [SendInvoiceWhatsAppDialog] Error sending invoice:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לשלוח את החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsSending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[60vh]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <SiWhatsapp className="h-5 w-5 text-green-600" />
                        שלח חשבונית בוואטסאפ
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        בחר למי לשלוח את החשבונית
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Recipient Selection */}
                    <RecipientSelector
                        customerId={customerId || null}
                        customerPhone={customerPhone || null}
                        customerName={customerName || null}
                        forceOwner={false}
                        onSelectionChange={setRecipientSelection}
                    />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse" dir="rtl">
                    <Button
                        onClick={handleSendInvoice}
                        disabled={isSending || !isCustomPhonesValid || !hasRecipients}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                שולח...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 ml-2" />
                                שלח בוואטסאפ
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

