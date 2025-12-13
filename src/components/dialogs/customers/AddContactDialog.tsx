import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { PhoneInput } from "@/components/ui/phone-input"
import { normalizePhone } from "@/utils/phone"

interface AddContactDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    onSuccess?: () => void
}

export function AddContactDialog({ open, onOpenChange, customerId, onSuccess }: AddContactDialogProps) {
    const { toast } = useToast()
    const [contactName, setContactName] = useState("")
    const [contactPhone, setContactPhone] = useState("")
    const [isPhoneValid, setIsPhoneValid] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            setContactName("")
            setContactPhone("")
            setIsPhoneValid(true)
        }
    }, [open])

    const handleAddContact = async () => {
        if (!contactName.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם איש קשר נדרש",
                variant: "destructive",
            })
            return
        }

        if (!contactPhone.trim()) {
            toast({
                title: "שדה חובה",
                description: "מספר טלפון נדרש",
                variant: "destructive",
            })
            return
        }

        if (!isPhoneValid) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        const normalizedPhone = normalizePhone(contactPhone.trim())
        if (!normalizedPhone) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        try {
            setIsSaving(true)
            const { data, error } = await supabase
                .from("customer_contacts")
                .insert({
                    customer_id: customerId,
                    name: contactName.trim(),
                    phone: normalizedPhone,
                })
                .select()
                .single()

            if (error) throw error

            toast({
                title: "איש קשר נוסף בהצלחה",
                description: `${data.name} נוסף לרשימת אנשי הקשר.`,
            })

            // Reset form
            setContactName("")
            setContactPhone("")
            setIsPhoneValid(true)

            // Close dialog and call success callback
            onOpenChange(false)
            onSuccess?.()
        } catch (error) {
            console.error("Error adding contact:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף את איש הקשר",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>הוסף איש קשר חדש</DialogTitle>
                    <DialogDescription>
                        הוסף איש קשר נוסף ללקוח זה
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="contact-name">שם איש קשר</Label>
                        <Input
                            id="contact-name"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="שם איש קשר"
                            className="text-right"
                            dir="rtl"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contact-phone">מספר טלפון</Label>
                        <PhoneInput
                            id="contact-phone"
                            value={contactPhone}
                            onChange={(value) => setContactPhone(value)}
                            onValidationChange={(isValid) => setIsPhoneValid(isValid)}
                            placeholder="מספר טלפון"
                            defaultCountry="il"
                            disabled={isSaving}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        ביטול
                    </Button>
                    <Button
                        onClick={handleAddContact}
                        disabled={isSaving || !contactName.trim() || !contactPhone.trim() || !isPhoneValid}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                מוסיף...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 ml-2" />
                                הוסף איש קשר
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
