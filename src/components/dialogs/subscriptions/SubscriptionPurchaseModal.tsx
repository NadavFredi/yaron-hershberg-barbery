import React from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { PaymentFlow, type PaymentConfig } from "@/components/payments/PaymentFlow"

interface SubscriptionPurchaseModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subscriptionTypeId: string
    subscriptionTypeName: string
    subscriptionPrice: number
    onSuccess?: () => void
}

export const SubscriptionPurchaseModal: React.FC<SubscriptionPurchaseModalProps> = ({
    open,
    onOpenChange,
    subscriptionTypeId,
    subscriptionTypeName,
    subscriptionPrice,
    onSuccess,
}) => {
    const { toast } = useToast()
    const { clientId } = useSupabaseAuthWithClientId()

    if (!clientId) {
        return null
    }

    const handlePaymentSuccess = async (data?: any) => {
        console.log("✅ [SubscriptionPurchaseModal] Payment success:", data)

        // If payment was made with token, the backend should handle it
        // If payment was made with new card, the callback will handle it
        if (data?.method === "token") {
            try {
                const { data: result, error } = await supabase.functions.invoke("purchase-subscription", {
                    body: {
                        subscriptionTypeId,
                        customerId: clientId,
                        amount: subscriptionPrice,
                        tokenId: data.tokenId,
                        paymentMethod: "saved_card",
                        numPayments: data.numPayments || 1,
                    },
                })

                if (error) throw error

                if (result?.success) {
                    toast({
                        title: "רכישה הושלמה בהצלחה!",
                        description: `המנוי "${subscriptionTypeName}" נוסף לחשבון שלך.`,
                    })
                    onSuccess?.()
                    onOpenChange(false)
                } else {
                    throw new Error(result?.error || "Unknown error")
                }
            } catch (error) {
                console.error("❌ [SubscriptionPurchaseModal] Error processing token payment:", error)
                toast({
                    title: "שגיאה בתשלום",
                    description: error instanceof Error ? error.message : "לא ניתן לבצע את הרכישה כעת",
                    variant: "destructive",
                })
            }
        } else {
            // New card payment - callback will handle the rest
            toast({
                title: "תשלום התקבל",
                description: "התשלום מתעבד, אנא המתן...",
            })
            setTimeout(() => {
                onSuccess?.()
                onOpenChange(false)
            }, 2000)
        }
    }

    const handlePaymentError = (error: string) => {
        console.error("❌ [SubscriptionPurchaseModal] Payment error:", error)
        toast({
            title: "שגיאה בתשלום",
            description: error,
            variant: "destructive",
        })
    }

    // Build notify URL for callback
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || window.location.origin.replace(/:\d+$/, ":54321")
    const notifyUrl = `${supabaseUrl}/functions/v1/purchase-subscription-callback`

    const paymentConfig: PaymentConfig = {
        amount: subscriptionPrice,
        productName: subscriptionTypeName,
        customerId: clientId,
        paymentType: "single",
        notifyUrlAddress: notifyUrl,
        customData: {
            subscription_type_id: subscriptionTypeId,
            customer_id: clientId,
            payment_ref: `sub_${subscriptionTypeId}_${Date.now()}`,
        },
        onSuccess: handlePaymentSuccess,
        onError: handlePaymentError,
    }

    return (
        <PaymentFlow
            open={open}
            onOpenChange={onOpenChange}
            config={paymentConfig}
            allowTokenPayment={true}
            allowNewCardPayment={true}
        />
    )
}

