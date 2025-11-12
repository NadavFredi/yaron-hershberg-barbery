import React, { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarCheck, CreditCard, ShoppingCart, Loader2, RefreshCw, AlertCircle } from "lucide-react"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { skipToken } from "@reduxjs/toolkit/query"
import { useGetClientSubscriptionsQuery, useGetCardUsageQuery, useGetSubscriptionTypesQuery } from "@/store/services/supabaseApi"

interface SubscriptionPlan {
    id: string
    name: string
    description: string
    price: string
    highlight?: string
    checkoutUrl: string
}

interface SubscriptionType {
    id: string
    name: string
    description: string
    price: string
    order: number
}

interface SubscriptionCardResponse {
    id: string
    planName: string | null
    purchasedAt: string | null
    status: string | null
    remainingUses: number | null
    totalUses: number | null
    nextBooking: string | null
    notes: string | null
}

interface SubscriptionUsageResponse {
    id: string
    date: string | null
    createdAt: string | null
    treatmentName: string | null
    service: string | null
    planName: string | null
    staffMember: string | null
    status: string | null
}

// Hardcoded checkout URLs - these should eventually be moved to Airtable as well
const checkoutUrls: Record<string, string> = {
    "bundle-6": "https://pay.tranzila.com",
    "bundle-12": "https://pay.tranzila.com",
    "monthly-pass": "https://pay.tranzila.com",
}

function formatDate(value?: string | null): string {
    if (!value) {
        return "לא זמין"
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return value
    }
    return parsed.toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" })
}

export default function Subscriptions() {
    const {
        user,
        clientId,
        clientIdError,
        isLoading: isAuthLoading,
        isFetchingClientId,
    } = useSupabaseAuthWithClientId()

    const effectiveClientId = useMemo(() => {
        if (clientId) {
            return clientId
        }

        if (!user) {
            return null
        }

        return user.user_metadata?.client_id || null
    }, [clientId, user])

    const {
        data: subscriptionData,
        isLoading: isDataLoading,
        isFetching,
        error: dataError,
        refetch,
    } = useGetClientSubscriptionsQuery(effectiveClientId ?? skipToken)

    const {
        data: subscriptionTypesData,
        isLoading: isSubscriptionTypesLoading,
        error: subscriptionTypesError,
        refetch: refetchSubscriptionTypes,
    } = useGetSubscriptionTypesQuery()

    const subscriptions: SubscriptionCardResponse[] = subscriptionData?.subscriptions ?? []
    const subscriptionTypes: SubscriptionType[] = subscriptionTypesData ?? []

    const [expandedCardId, setExpandedCardId] = useState<string>("")

    const {
        data: expandedUsage,
        isFetching: isUsageLoading,
        error: usageError,
    } = useGetCardUsageQuery(expandedCardId ? expandedCardId : skipToken)

    const usageRecordsForExpandedCard: SubscriptionUsageResponse[] = Array.isArray(expandedUsage)
        ? expandedUsage
        : []

    const isLoadingState = isAuthLoading || isFetchingClientId || isDataLoading || isFetching || isSubscriptionTypesLoading
    const hasError = Boolean(dataError) || Boolean(subscriptionTypesError)

    if (isAuthLoading || isFetchingClientId) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <div className="flex flex-col items-center gap-2 text-gray-600">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>{isFetchingClientId ? "מאמת פרטי חשבון..." : "טוען נתוני משתמש..."}</p>
                </div>
            </div>
        )
    }

    if (!user || !effectiveClientId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>נדרש להתחבר</CardTitle>
                        <CardDescription>
                            {clientIdError
                                ? `לא ניתן היה לזהות את פרטי החשבון: ${clientIdError.message}`
                                : "אנא התחברו כדי לצפות בכרטיסיות ובמנויים שלכם."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                            <a href="/login">כניסה לחשבון</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen py-8" dir="rtl">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <header className="space-y-3">
                    <Badge variant="outline" className="px-3 py-1 text-sm bg-blue-50 text-blue-700 border-blue-200 w-fit">
                        הכרטיסיות שלי
                    </Badge>
                    <h1 className="text-3xl font-bold text-gray-900">ניהול מנויים וכרטיסיות</h1>
                    <p className="text-gray-600 max-w-3xl">
                        כאן תמצאו את כל הכרטיסיות והחבילות שרכשתם, את היתרה שנותרה ואת האפשרות לרכוש בקלות חבילות חדשות.
                        ניהול פשוט ונוח של טיפולי שיער וקרקפת לכל אחד ואחת מכם.
                    </p>
                </header>

                <section>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <ShoppingCart className="h-5 w-5 text-orange-500" />
                                <div>
                                    <CardTitle className="text-xl">רכישת כרטיסיות חדשות</CardTitle>
                                    <CardDescription>בחרו את החבילה שמתאימה לשיער ולקרקפת שלכם</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {subscriptionTypesError ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-right space-y-3">
                                    <div className="flex items-center gap-2 text-red-600">
                                        <AlertCircle className="h-5 w-5" />
                                        <span>שגיאה בטעינת סוגי הכרטיסיות</span>
                                    </div>
                                    <p className="text-sm text-red-500">נסו לרענן את הדף או לחצו על הכפתור הבא.</p>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex items-center gap-2"
                                            onClick={() => refetchSubscriptionTypes()}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            רענן נתונים
                                        </Button>
                                    </div>
                                </div>
                            ) : subscriptionTypes.length === 0 && !isSubscriptionTypesLoading ? (
                                <div className="text-center text-gray-500 py-6">
                                    לא נמצאו סוגי כרטיסיות זמינים כרגע.
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-3">
                                    {subscriptionTypes.map((subscriptionType) => {
                                        const checkoutUrl = checkoutUrls[subscriptionType.id] || "#"
                                        return (
                                            <div
                                                key={subscriptionType.id}
                                                className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                                            >
                                                <div className="space-y-3 flex-grow">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-lg font-semibold text-gray-900">{subscriptionType.name}</h3>
                                                    </div>
                                                    <p className="text-sm text-gray-600 leading-6">{subscriptionType.description}</p>
                                                </div>
                                                <div className="mt-auto pt-4">
                                                    <div className="text-2xl font-bold text-gray-900 mb-4">₪{subscriptionType.price}</div>
                                                    <Button
                                                        type="button"
                                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                                        onClick={() => window.open(checkoutUrl, "_blank", "noopener,noreferrer")}
                                                    >
                                                        המשך לרכישה
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            {isSubscriptionTypesLoading && (
                                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    טוען סוגי כרטיסיות...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <CreditCard className="h-5 w-5 text-blue-500" />
                                <div>
                                    <CardTitle className="text-xl">הכרטיסיות שלי</CardTitle>
                                    <CardDescription>מעקב אחר כל החבילות והכרטיסיות שרכשתם</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {hasError ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-right space-y-3">
                                    <div className="flex items-center gap-2 text-red-600">
                                        <AlertCircle className="h-5 w-5" />
                                        <span>שגיאה בטעינת הכרטיסיות</span>
                                    </div>
                                    <p className="text-sm text-red-500">נסו לרענן את הדף או לחצו על הכפתור הבא.</p>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="flex items-center gap-2"
                                            onClick={() => refetch()}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            רענן נתונים
                                        </Button>
                                    </div>
                                </div>
                            ) : subscriptions.length === 0 && !isLoadingState ? (
                                <div className="text-center text-gray-500 py-6">
                                    לא נמצאו כרטיסיות פעילות כרגע.
                                </div>
                            ) : (
                                <Accordion
                                    type="single"
                                    collapsible
                                    className="w-full"
                                    value={expandedCardId}
                                    onValueChange={(value) => setExpandedCardId(value || "")}
                                >
                                    {subscriptions.map((subscription) => {
                                        const isExpanded = expandedCardId === subscription.id
                                        const usageRecords = isExpanded ? usageRecordsForExpandedCard : []
                                        const showUsageError = isExpanded && usageError
                                        const showUsageLoading = isExpanded && isUsageLoading

                                        return (
                                            <AccordionItem value={subscription.id} key={subscription.id}>
                                                <AccordionTrigger className="text-right">
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-semibold text-gray-900">
                                                                {subscription.planName ?? "כרטיסייה ללא שם"}
                                                            </span>
                                                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                                                <span>נוצר בתאריך: {formatDate(subscription.purchasedAt)}</span>
                                                                <span>יתרה: <span className="font-semibold text-blue-600">{subscription.remainingUses ?? "—"}</span></span>
                                                                <span>סה"כ: {subscription.totalUses ?? "—"}</span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary" className="ml-3">
                                                            {subscription.remainingUses != null
                                                                ? `${subscription.remainingUses} שימושים`
                                                                : "שימושים"}
                                                        </Badge>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    {showUsageError ? (
                                                        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-right space-y-2">
                                                            <div className="flex items-center gap-2 text-red-600">
                                                                <AlertCircle className="h-4 w-4" />
                                                                <span>שגיאה בטעינת ניצול הכרטיסייה</span>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="flex items-center gap-2 self-end"
                                                                onClick={() => {
                                                                    setExpandedCardId("")
                                                                    setTimeout(() => setExpandedCardId(subscription.id), 0)
                                                                }}
                                                            >
                                                                <RefreshCw className="h-4 w-4" />
                                                                נסה שוב
                                                            </Button>
                                                        </div>
                                                    ) : usageRecords.length === 0 && !showUsageLoading ? (
                                                        <div className="text-sm text-gray-500 py-4 text-center">
                                                            עדיין לא בוצעו שימושים בכרטיסייה הזו.
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="text-right">תאריך שימוש</TableHead>
                                                                        <TableHead className="text-right">שם הטיפול</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {usageRecords.map((usageRecord) => (
                                                                        <TableRow key={usageRecord.id}>
                                                                            <TableCell className="text-right text-gray-600">{formatDate(usageRecord.createdAt || usageRecord.date)}</TableCell>
                                                                            <TableCell className="text-right text-gray-900">{usageRecord.treatmentName ?? ""}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    )}
                                                    {showUsageLoading && (
                                                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            טוען ניצול כרטיסייה...
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                </Accordion>
                            )}
                            {isLoadingState && (
                                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    טוען כרטיסיות...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    )
}
