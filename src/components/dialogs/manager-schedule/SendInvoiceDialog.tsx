import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PhoneInput } from "@/components/ui/phone-input"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import type { Database } from "@/integrations/supabase/types"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]

interface SendInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerContacts: CustomerContact[]
    selectedAppointment: ManagerAppointment | null
    onSuccess?: () => void
}

export function SendInvoiceDialog({
    open,
    onOpenChange,
    customerContacts,
    selectedAppointment,
    onSuccess,
}: SendInvoiceDialogProps) {
    const [invoicePhone, setInvoicePhone] = useState<string>("")
    const [invoiceContactType, setInvoiceContactType] = useState<"contact" | "custom">("contact")
    const [selectedContactId, setSelectedContactId] = useState<string>("")
    const [isSendingInvoice, setIsSendingInvoice] = useState(false)
    const { toast } = useToast()

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setInvoicePhone("")
            setSelectedContactId("")
            setInvoiceContactType("contact")
        }
    }, [open])

    const handleSendInvoice = async () => {
        if (!selectedAppointment) return

        let phoneToSend = ""
        if (invoiceContactType === "contact") {
            const contact = customerContacts.find(c => c.id === selectedContactId)
            if (!contact) {
                toast({
                    title: "שגיאה",
                    description: "יש לבחור איש קשר",
                    variant: "destructive",
                })
                return
            }
            phoneToSend = contact.phone
        } else {
            if (!invoicePhone || invoicePhone.trim() === "") {
                toast({
                    title: "שגיאה",
                    description: "יש להזין מספר טלפון",
                    variant: "destructive",
                })
                return
            }
            phoneToSend = invoicePhone.trim()
        }

        setIsSendingInvoice(true)
        try {
            // TODO: Implement actual invoice sending logic
            console.log("Sending invoice to:", phoneToSend)
            // Here you would call your invoice sending API/function
            await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call

            toast({
                title: "חשבונית נשלחה",
                description: `החשבונית נשלחה ל-${phoneToSend}`,
            })
            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Error sending invoice:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשלוח את החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsSendingInvoice(false)
        }
    }

    const handleCancel = () => {
        onOpenChange(false)
        setInvoicePhone("")
        setSelectedContactId("")
        setInvoiceContactType("contact")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle>שלח חשבונית</DialogTitle>
                    <DialogDescription>
                        בחר למי לשלוח את החשבונית
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <RadioGroup value={invoiceContactType} onValueChange={(value) => setInvoiceContactType(value as "contact" | "custom")}>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="contact" id="contact" />
                            <Label htmlFor="contact" className="cursor-pointer">איש קשר</Label>
                        </div>
                        {invoiceContactType === "contact" && customerContacts.length > 0 && (
                            <div className="mr-6 mt-2 space-y-2">
                                <RadioGroup value={selectedContactId} onValueChange={setSelectedContactId}>
                                    {customerContacts.map((contact) => (
                                        <div key={contact.id} className="flex items-center space-x-2 space-x-reverse">
                                            <RadioGroupItem value={contact.id} id={`contact-${contact.id}`} />
                                            <Label htmlFor={`contact-${contact.id}`} className="cursor-pointer">
                                                {contact.name} - {contact.phone}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                        )}
                        {invoiceContactType === "contact" && customerContacts.length === 0 && (
                            <p className="text-sm text-gray-500 mr-6">אין אנשי קשר זמינים</p>
                        )}
                        <div className="flex items-center space-x-2 space-x-reverse mt-4">
                            <RadioGroupItem value="custom" id="custom" />
                            <Label htmlFor="custom" className="cursor-pointer">מספר טלפון חופשי</Label>
                        </div>
                        {invoiceContactType === "custom" && (
                            <div className="mr-6 mt-2">
                                <PhoneInput
                                    value={invoicePhone}
                                    onChange={setInvoicePhone}
                                    placeholder="הזן מספר טלפון"
                                />
                            </div>
                        )}
                    </RadioGroup>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleSendInvoice}
                        disabled={isSendingInvoice || (invoiceContactType === "contact" && !selectedContactId) || (invoiceContactType === "custom" && !invoicePhone)}
                    >
                        {isSendingInvoice ? (
                            <>
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                שולח...
                            </>
                        ) : (
                            "שלח"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

