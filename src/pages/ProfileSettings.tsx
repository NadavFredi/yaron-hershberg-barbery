import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail, Phone, MapPin, User as UserIcon, RefreshCw } from "lucide-react"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { useToast } from "@/components/ui/use-toast"
import { skipToken } from "@reduxjs/toolkit/query"
import {
    useGetClientProfileQuery,
    useUpdateClientProfileMutation,
} from "@/store/services/supabaseApi"


type ProfileFormState = {
    fullName: string
    phone: string
    email: string
    address: string
}

const initialState: ProfileFormState = {
    fullName: "",
    phone: "",
    email: "",
    address: "",
}

export default function ProfileSettings() {
    const {
        user,
        clientId,
        clientIdError,
        isLoading: isAuthLoading,
        isFetchingClientId,
    } = useSupabaseAuthWithClientId()
    const { toast } = useToast()

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
        data: profile,
        isLoading: isProfileLoading,
        isFetching: isProfileFetching,
        error: profileError,
        refetch: refetchProfile,
    } = useGetClientProfileQuery(effectiveClientId ?? skipToken)

    const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateClientProfileMutation()

    const [formState, setFormState] = useState<ProfileFormState>(initialState)
    const [isDirty, setIsDirty] = useState(false)

    useEffect(() => {
        if (profile) {
            setFormState({
                fullName: profile.fullName ?? "",
                phone: profile.phone ?? "",
                email: profile.email ?? "",
                address: profile.address ?? "",
            })
            setIsDirty(false)
        }
    }, [profile])

    const handleChange = (field: keyof ProfileFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
        setFormState((prev) => ({ ...prev, [field]: value }))
        setIsDirty(true)
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!effectiveClientId) {
            toast({
                title: "משתמש לא מזוהה",
                description: clientIdError?.message ?? "אנא התחברו מחדש ונסו שוב.",
                variant: "destructive",
            })
            return
        }

        try {
            const result = await updateProfile({
                clientId: effectiveClientId,
                fullName: formState.fullName.trim() || undefined,
                phone: formState.phone.trim() || undefined,
                email: formState.email.trim() || undefined,
                address: formState.address.trim() || undefined,
            }).unwrap()

            if (!result?.success) {
                throw new Error(result?.error || "שגיאה בשמירת הפרופיל")
            }

            toast({
                title: "הפרופיל עודכן",
                description: "העדכונים נשלחו לצוות שלנו בהצלחה.",
            })
            setIsDirty(false)
            refetchProfile()
        } catch (error) {
            console.error("Failed to update profile", error)
            toast({
                title: "שגיאה בעדכון",
                description: error instanceof Error ? error.message : "לא ניתן לעדכן את הפרופיל כעת",
                variant: "destructive",
            })
        }
    }

    if (isAuthLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir="rtl">
                <div className="flex flex-col items-center gap-3 text-gray-600">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>טוען נתוני משתמש...</p>
                </div>
            </div>
        )
    }

    if (!user || !effectiveClientId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>נדרשת התחברות</CardTitle>
                        <CardDescription>
                            {clientIdError
                                ? `המערכת לא הצליחה לאמת את החשבון שלך: ${clientIdError.message}`
                                : "אנא התחברו כדי לצפות ולעדכן את פרטי הפרופיל שלכם."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                            <a href="/login">עבור למסך ההתחברות</a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isLoadingProfile = isProfileLoading || isProfileFetching
    const hasError = Boolean(profileError)

    return (
        <div className="min-h-screen py-10" dir="rtl">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="space-y-2 text-right">
                    <h1 className="text-3xl font-bold text-gray-900">הגדרות פרופיל</h1>
                    <p className="text-gray-600">עדכנו את הפרטים האישיים שלכם כדי שנמשיך לשרת אתכם בצורה הטובה ביותר.</p>
                </div>

                <Card className="shadow-sm">
                    <CardHeader className="text-right">
                        <CardTitle className="flex items-center justify-start gap-2">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                            <span>פרטים אישיים</span>
                        </CardTitle>
                        <CardDescription>
                            נשתמש בפרטים האלו כדי ליצור איתכם קשר ולוודא שהשירות מותאם אליכם.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {hasError ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-right space-y-3">
                                <p className="text-red-600 font-medium">שגיאה בטעינת הפרופיל</p>
                                <p className="text-sm text-red-500">ייתכן שיש בעיה זמנית בחיבור לשרת. נסו לרענן את הפרטים.</p>
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex items-center gap-2"
                                        onClick={() => refetchProfile()}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        רענן
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <form className="space-y-6" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 text-right">
                                        <Label htmlFor="fullName" className="flex items-center justify-start gap-2">
                                            <UserIcon className="h-4 w-4 text-gray-400" />
                                            <span>שם מלא</span>
                                        </Label>
                                        <Input
                                            id="fullName"
                                            value={formState.fullName}
                                            onChange={handleChange("fullName")}
                                            placeholder="הקלידו את שמכם המלא"
                                            dir="rtl"
                                            className="text-right"
                                            disabled={isLoadingProfile || isUpdatingProfile}
                                        />
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <Label htmlFor="phone" className="flex items-center justify-start gap-2">
                                            <Phone className="h-4 w-4 text-gray-400" />
                                            <span>טלפון</span>
                                        </Label>
                                        <Input
                                            id="phone"
                                            value={formState.phone}
                                            onChange={handleChange("phone")}
                                            placeholder="הקלידו מספר טלפון לעדכון"
                                            dir="rtl"
                                            className="text-right"
                                            disabled={isLoadingProfile || isUpdatingProfile}
                                        />
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <Label htmlFor="email" className="flex items-center justify-start gap-2">
                                            <Mail className="h-4 w-4 text-gray-400" />
                                            <span>אימייל</span>
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formState.email}
                                            onChange={handleChange("email")}
                                            placeholder="name@example.com"
                                            dir="rtl"
                                            className="text-right"
                                            disabled={isLoadingProfile || isUpdatingProfile}
                                        />
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <Label htmlFor="address" className="flex items-center justify-start gap-2">
                                            <MapPin className="h-4 w-4 text-gray-400" />
                                            <span>כתובת</span>
                                        </Label>
                                        <Input
                                            id="address"
                                            value={formState.address}
                                            onChange={handleChange("address")}
                                            placeholder="הקלידו כתובת למשלוח"
                                            dir="rtl"
                                            className="text-right"
                                            disabled={isLoadingProfile || isUpdatingProfile}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3">
                                    <Button
                                        type="submit"
                                        disabled={isLoadingProfile || isUpdatingProfile || !isDirty}
                                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        {isUpdatingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                                        שמור פרטים
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isLoadingProfile || isUpdatingProfile}
                                        onClick={() => refetchProfile()}
                                        className="flex items-center gap-2"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        רענן נתונים
                                    </Button>
                                </div>
                            </form>
                        )}
                        {isLoadingProfile && (
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                טוען פרטי פרופיל...
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
