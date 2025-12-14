import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SiWhatsapp } from "react-icons/si"
import { MessageSquare, Loader2 } from "lucide-react"
import { normalizePhone } from "@/utils/phone"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { MessageToContactsDialog } from "@/components/dialogs/MessageToContactsDialog"
import type { Database } from "@/integrations/supabase/types"
import { ManyChatIcon } from "@/components/icons/ManyChatIcon"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]

interface MessagingActionsProps {
    phone?: string | null
    name?: string | null
    contacts?: CustomerContact[]
    customerId?: string | null
    className?: string
}

export const MessagingActions = ({
    phone,
    name,
    contacts = [],
    customerId,
    className = "",
}: MessagingActionsProps) => {
    const { toast } = useToast()
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false)
    const [isLoadingManyChat, setIsLoadingManyChat] = useState(false)

    const handleWhatsAppClick = (targetPhone: string) => {
        const phoneNumber = normalizePhone(targetPhone)
        if (phoneNumber) {
            const whatsappUrl = `https://wa.me/${phoneNumber}`
            console.info("[MessagingActions] Opening WhatsApp conversation", {
                phone: targetPhone,
                normalizedPhone: phoneNumber,
                whatsappUrl,
            })
            window.open(whatsappUrl, "_blank", "noopener,noreferrer")
        } else {
            console.warn("[MessagingActions] Invalid phone number for WhatsApp", {
                phone: targetPhone,
            })
            toast({
                title: "שגיאה",
                description: "מספר טלפון לא תקין",
                variant: "destructive",
            })
        }
    }

    const handleManyChatClick = async () => {
        if (!phone) {
            toast({
                title: "שגיאה",
                description: "חסר מספר טלפון",
                variant: "destructive",
            })
            return
        }

        const displayName = name || "לקוח"

        setIsLoadingManyChat(true)
        try {
            console.info("[MessagingActions] Fetching ManyChat ID", { phone, name: displayName })

            const { data, error } = await supabase.functions.invoke("get-manychat-user", {
                body: [{ phone, fullName: displayName }],
            })

            if (error) {
                console.error("[MessagingActions] Error fetching ManyChat ID:", error)
                throw error
            }

            const result = data?.[normalizePhone(phone) || phone.replace(/\D/g, "")]

            if (!result || (result as any).error) {
                const errorMsg = (result as any)?.error || "לא נמצא מזהה ManyChat"
                console.error("[MessagingActions] ManyChat user not found:", errorMsg)
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
                console.error("[MessagingActions] No live_chat_url or subscriber ID in result:", result)
                toast({
                    title: "שגיאה",
                    description: "לא נמצא קישור ManyChat",
                    variant: "destructive",
                })
                return
            }

            const manychatUrl = liveChatUrl || `https://manychat.com/subscribers/${subscriberId}`
            console.info("[MessagingActions] Opening ManyChat conversation", {
                subscriberId,
                liveChatUrl,
                manychatUrl,
            })
            window.open(manychatUrl, "_blank", "noopener,noreferrer")
        } catch (error) {
            console.error("[MessagingActions] Error opening ManyChat:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לפתוח שיחת ManyChat",
                variant: "destructive",
            })
        } finally {
            setIsLoadingManyChat(false)
        }
    }

    const handleMessageToContacts = () => {
        setIsMessageDialogOpen(true)
    }

    const hasPhone = phone && phone.trim() !== ""
    const hasContacts = contacts.length > 0

    if (!hasPhone && !hasContacts) {
        return null
    }

    return (
        <>
            <Separator />
            <div className={`pt-2 space-y-2 ${className}`}>
                {hasPhone && (
                    <Button
                        type="button"
                        onClick={handleManyChatClick}
                        disabled={isLoadingManyChat}
                        className="w-full bg-black hover:bg-gray-800 text-white"
                        dir="rtl"
                    >
                        {isLoadingManyChat ? (
                            <>
                                <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                טוען...
                            </>
                        ) : (
                            <>
                                <ManyChatIcon width={22} height={16} fill="white" className="ml-2" />
                                פתח שיחת ManyChat
                            </>
                        )}
                    </Button>
                )}

                {hasPhone && (
                    <Button
                        type="button"
                        onClick={() => handleWhatsAppClick(phone!)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                        dir="rtl"
                    >
                        <SiWhatsapp className="h-5 w-5 ml-2" />
                        פתח שיחת וואטסאפ
                    </Button>
                )}



                {(hasPhone || hasContacts) && (
                    <Button
                        type="button"
                        onClick={handleMessageToContacts}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                        dir="rtl"
                    >
                        <MessageSquare className="h-5 w-5 ml-2" />
                        שלח הודעה לאנשי קשר
                    </Button>
                )}
            </div>

            {/* Message to Contacts Dialog */}
            <MessageToContactsDialog
                open={isMessageDialogOpen}
                onOpenChange={setIsMessageDialogOpen}
                contacts={contacts}
                customerId={customerId}
            />
        </>
    )
}
