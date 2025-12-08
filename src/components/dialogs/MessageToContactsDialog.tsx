import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { SiWhatsapp } from "react-icons/si"
import { MessageSquare, Loader2, X } from "lucide-react"
import { normalizePhone } from "@/utils/phone"
import { cn } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import type { Database } from "@/integrations/supabase/types"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]

interface MessageToContactsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contacts?: CustomerContact[]
    customerId?: string | null
}

export const MessageToContactsDialog = ({
    open,
    onOpenChange,
    contacts: initialContacts = [],
    customerId,
    defaultPhone,
    defaultName,
}: MessageToContactsDialogProps) => {
    const { toast } = useToast()
    const [messagePhone, setMessagePhone] = useState<string>("")
    const [messageName, setMessageName] = useState<string>("")
    const [selectedContactId, setSelectedContactId] = useState<string>("")
    const [isPhoneValid, setIsPhoneValid] = useState<boolean>(false)
    const [isLoadingManyChat, setIsLoadingManyChat] = useState(false)
    const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false)
    const [contacts, setContacts] = useState<CustomerContact[]>(initialContacts)
    const [isLoadingContacts, setIsLoadingContacts] = useState(false)

    // Update contacts when initialContacts change
    useEffect(() => {
        setContacts(initialContacts)
    }, [initialContacts])


    // Fetch contacts when dialog opens if we have customerId and contacts are empty
    useEffect(() => {
        const fetchContacts = async () => {
            if (!open || !customerId) return
            if (contacts.length > 0) return // Already have contacts

            setIsLoadingContacts(true)
            try {
                console.log("[MessageToContactsDialog] Fetching contacts for customerId:", customerId)
                const { data, error } = await supabase
                    .from("customer_contacts")
                    .select("*")
                    .eq("customer_id", customerId)
                    .order("created_at", { ascending: true })

                if (error) {
                    console.error("[MessageToContactsDialog] Error fetching contacts:", error)
                    throw error
                }

                console.log("[MessageToContactsDialog] Fetched contacts:", data)
                setContacts(data || [])
            } catch (error) {
                console.error("[MessageToContactsDialog] Error fetching contacts:", error)
                setContacts([])
            } finally {
                setIsLoadingContacts(false)
            }
        }

        fetchContacts()
    }, [open, customerId, contacts.length])

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            setMessagePhone("")
            setMessageName("")
            setSelectedContactId("")
            setIsPhoneValid(false)
        }
    }, [open])

    // Handle contact selection
    const handleContactSelect = (contactId: string) => {
        const contact = contacts?.find(c => c.id === contactId)
        if (contact) {
            setSelectedContactId(contactId)
            setMessageName(contact.name)
            setMessagePhone(contact.phone)
            // Phone validation will be triggered by PhoneInput's onValidationChange
        }
    }

    // Handle manual input - clear selected contact
    const handleNameChange = (value: string) => {
        setMessageName(value)
        if (contacts && value !== contacts.find(c => c.id === selectedContactId)?.name) {
            setSelectedContactId("")
        }
    }

    const handlePhoneChange = (value: string) => {
        setMessagePhone(value)
        if (contacts && value !== contacts.find(c => c.id === selectedContactId)?.phone) {
            setSelectedContactId("")
        }
    }

    const handleOpenManyChat = async () => {
        if (!messagePhone || !messageName) {
            toast({
                title: "שגיאה",
                description: "יש למלא שם ומספר טלפון",
                variant: "destructive",
            })
            return
        }

        setIsLoadingManyChat(true)
        try {
            console.info("[MessageToContactsDialog] Fetching ManyChat ID for message", { phone: messagePhone, name: messageName })
            
            const { data, error } = await supabase.functions.invoke("get-manychat-user", {
                body: [{ phone: messagePhone, fullName: messageName }],
            })

            if (error) {
                throw error
            }

            const phoneDigits = normalizePhone(messagePhone) || messagePhone.replace(/\D/g, "")
            const result = data?.[phoneDigits]
            
            if (!result || (result as any).error) {
                const errorMsg = (result as any)?.error || "לא נמצא מזהה ManyChat"
                toast({
                    title: "שגיאה",
                    description: errorMsg,
                    variant: "destructive",
                })
                return
            }

            // Use live_chat_url if available, otherwise construct URL from subscriber ID
            const liveChatUrl = (result as any).live_chat_url
            const subscriberId = (result as any).subscriber_id || (result as any).id
            
            if (!liveChatUrl && !subscriberId) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצא קישור ManyChat",
                    variant: "destructive",
                })
                return
            }

            const manychatUrl = liveChatUrl || `https://manychat.com/subscribers/${subscriberId}`
            window.open(manychatUrl, "_blank", "noopener,noreferrer")
            onOpenChange(false)
        } catch (error) {
            console.error("[MessageToContactsDialog] Error opening ManyChat:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לפתוח שיחת ManyChat",
                variant: "destructive",
            })
        } finally {
            setIsLoadingManyChat(false)
        }
    }

    const handleOpenWhatsApp = () => {
        if (!messagePhone) {
            toast({
                title: "שגיאה",
                description: "יש למלא מספר טלפון",
                variant: "destructive",
            })
            return
        }

        setIsLoadingWhatsApp(true)
        try {
            const phoneNumber = normalizePhone(messagePhone)
            if (phoneNumber) {
                const whatsappUrl = `https://wa.me/${phoneNumber}`
                console.info("[MessageToContactsDialog] Opening WhatsApp conversation", {
                    phone: messagePhone,
                    normalizedPhone: phoneNumber,
                    whatsappUrl,
                })
                window.open(whatsappUrl, "_blank", "noopener,noreferrer")
                onOpenChange(false)
            } else {
                console.warn("[MessageToContactsDialog] Invalid phone number for WhatsApp", {
                    phone: messagePhone,
                })
                toast({
                    title: "שגיאה",
                    description: "מספר טלפון לא תקין",
                    variant: "destructive",
                })
            }
        } finally {
            setIsLoadingWhatsApp(false)
        }
    }

    const isFormValid = messageName.trim() !== "" && isPhoneValid && messagePhone.trim() !== ""

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto [&>button:has(svg)]:hidden" dir="rtl">
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute left-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 !block"
                    tabIndex={-1}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                <DialogHeader>
                    <DialogTitle className="text-right">שלח הודעה</DialogTitle>
                    <DialogDescription className="text-right">
                        הזן שם ומספר טלפון, ואז בחר דרך שליחה
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {isLoadingContacts ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            <span className="mr-2 text-sm text-gray-600">טוען אנשי קשר...</span>
                        </div>
                    ) : contacts && Array.isArray(contacts) && contacts.length > 0 ? (
                        <div className="space-y-2">
                            <Label className="mb-1 block text-right">בחר איש קשר</Label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {contacts.map((contact) => (
                                    <button
                                        key={contact.id}
                                        type="button"
                                        onClick={() => handleContactSelect(contact.id)}
                                        className={cn(
                                            "w-full text-right px-3 py-2 rounded-md border transition-colors",
                                            selectedContactId === contact.id
                                                ? "bg-blue-50 border-blue-300 text-blue-900"
                                                : "bg-white border-gray-200 hover:bg-gray-50 text-gray-900"
                                        )}
                                    >
                                        <div className="font-medium">{contact.name}</div>
                                        <div className="text-sm text-gray-600">{contact.phone}</div>
                                    </button>
                                ))}
                            </div>
                            <Separator className="my-4" />
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <Label htmlFor="message-name" className="mb-1 block text-right">
                                {contacts && contacts.length > 0 ? "או הזן שם ידנית" : "שם *"}
                            </Label>
                            <Input
                                id="message-name"
                                value={messageName}
                                onChange={(e) => handleNameChange(e.target.value)}
                                placeholder="הזן שם"
                                className="text-right"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <Label htmlFor="message-phone" className="mb-1 block text-right">
                                {contacts && contacts.length > 0 ? "או הזן מספר טלפון ידנית" : "מספר טלפון *"}
                            </Label>
                            <PhoneInput
                                value={messagePhone}
                                onChange={handlePhoneChange}
                                onValidationChange={setIsPhoneValid}
                                placeholder="הזן מספר טלפון"
                                showValidation={true}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                        <Button
                            type="button"
                            onClick={handleOpenManyChat}
                            disabled={!isFormValid || isLoadingManyChat || isLoadingWhatsApp}
                            className="w-full bg-black hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            dir="rtl"
                        >
                            {isLoadingManyChat ? (
                                <>
                                    <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                    טוען...
                                </>
                            ) : (
                                <>
                                    <MessageSquare className="h-5 w-5 ml-2" />
                                    פתח שיחת ManyChat
                                </>
                            )}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleOpenWhatsApp}
                            disabled={!isFormValid || isLoadingManyChat || isLoadingWhatsApp}
                            className="w-full bg-green-500 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            dir="rtl"
                        >
                            {isLoadingWhatsApp ? (
                                <>
                                    <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                    טוען...
                                </>
                            ) : (
                                <>
                                    <SiWhatsapp className="h-5 w-5 ml-2" />
                                    פתח שיחת וואטסאפ אישי
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

