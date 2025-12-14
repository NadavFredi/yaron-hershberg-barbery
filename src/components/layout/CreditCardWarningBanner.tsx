import React, { useEffect, useState, useRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { AlertCircle, X } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { Button } from "@/components/ui/button"

export function CreditCardWarningBanner() {
    const location = useLocation()
    const { clientId, user } = useSupabaseAuthWithClientId()
    const [hasCreditToken, setHasCreditToken] = useState<boolean | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isDismissed, setIsDismissed] = useState(false)
    const [topOffset, setTopOffset] = useState(0)
    const bannerRef = useRef<HTMLDivElement>(null)

    // Don't show on manager pages
    const isManagerRoute = location.pathname.startsWith("/manager") ||
        location.pathname.startsWith("/settings") ||
        location.pathname === "/manager-screens"

    const checkCreditToken = React.useCallback(async () => {
        if (!clientId || !user) {
            setHasCreditToken(null)
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)
            const { data, error } = await supabase
                .from("credit_tokens")
                .select("id")
                .eq("customer_id", clientId)
                .maybeSingle()

            if (error) {
                // On error, assume no token (show warning)
                setHasCreditToken(false)
            } else {
                const hasToken = !!data
                setHasCreditToken(hasToken)
            }
        } catch (error) {
            // On exception, assume no token (show warning)
            setHasCreditToken(false)
        } finally {
            setIsLoading(false)
        }
    }, [clientId, user])

    useEffect(() => {
        checkCreditToken()
    }, [checkCreditToken])

    // Listen for credit card saved event to refresh
    useEffect(() => {
        const handleCreditCardSaved = () => {
            console.log("🔄 [CreditCardWarningBanner] Credit card saved event received, refreshing...")
            checkCreditToken()
        }

        window.addEventListener("creditCardSaved", handleCreditCardSaved)
        return () => {
            window.removeEventListener("creditCardSaved", handleCreditCardSaved)
        }
    }, [checkCreditToken])

    // Calculate top offset based on navbar and subnav heights
    useEffect(() => {
        const calculateOffset = () => {
            const navbar = document.querySelector('nav[class*="sticky"]')
            const subnav = document.querySelector('[class*="ManagerSubnav"]')

            let offset = 0
            if (navbar) {
                offset += navbar.getBoundingClientRect().height
            }
            if (subnav && subnav.getBoundingClientRect().height > 0) {
                offset += subnav.getBoundingClientRect().height
            }

            setTopOffset(offset)
        }

        calculateOffset()
        window.addEventListener('resize', calculateOffset)
        window.addEventListener('scroll', calculateOffset)

        return () => {
            window.removeEventListener('resize', calculateOffset)
            window.removeEventListener('scroll', calculateOffset)
        }
    }, [])

    // Don't show if loading, dismissed, has credit token, no user, or on manager pages
    // Only show if we explicitly know there's no credit token (hasCreditToken === false)
    if (isLoading || isDismissed || hasCreditToken !== false || !user || isManagerRoute) {
        return null
    }

    return (
        <div
            ref={bannerRef}
            className="sticky bg-yellow-50 border-b border-yellow-200 shadow-sm z-40"
            dir="rtl"
            style={{ top: `${topOffset}px` }}
        >
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center gap-3 py-3 relative">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
                        <p className="text-sm font-medium text-yellow-900 leading-tight">
                            לא הגדרת את פרטי כרטיס האשראי שלך. לא תוכל לקבוע תורים עד שתגדיר אותם.{" "}
                            <Link
                                to="/profile?mode=billing"
                                className="underline hover:text-yellow-900 font-semibold"
                            >
                                אנא הגדר כאן
                            </Link>
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDismissed(true)}
                        className="absolute left-4 h-8 w-8 p-0 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 shrink-0"
                        aria-label="סגור"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

