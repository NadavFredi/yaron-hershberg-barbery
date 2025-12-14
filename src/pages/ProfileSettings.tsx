import React, { useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Mail, Phone, MapPin, User as UserIcon, RefreshCw, Plus, Trash2, Pencil, CreditCard, CheckCircle2, AlertCircle, Settings, Lock, Eye, EyeOff } from "lucide-react"
import { useSupabaseAuthWithClientId } from "@/hooks/useSupabaseAuthWithClientId"
import { useToast } from "@/components/ui/use-toast"
import { skipToken } from "@reduxjs/toolkit/query"
import {
    useGetClientProfileQuery,
    useUpdateClientProfileMutation,
    useGetManyChatUserQuery,
} from "@/store/services/supabaseApi"
import { PhoneInput } from "@/components/ui/phone-input"
import { supabase } from "@/integrations/supabase/client"
import { normalizePhone } from "@/utils/phone"
import type { Database } from "@/integrations/supabase/types"
import { CreditCardSetupModal } from "@/components/dialogs/billing/CreditCardSetupModal"
import { ContactDeleteConfirmationDialog } from "@/components/dialogs/customers/ContactDeleteConfirmationDialog"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]


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
    const [searchParams, setSearchParams] = useSearchParams()
    const {
        user,
        clientId,
        clientIdError,
        isLoading: isAuthLoading,
        isFetchingClientId,
    } = useSupabaseAuthWithClientId()
    const { toast } = useToast()

    // Get initial tab from URL params (use ?mode=billing, ?mode=security, or ?mode=general)
    const modeParam = searchParams.get("mode")
    const initialTab = modeParam === "billing" ? "payment" : modeParam === "security" ? "security" : "general"
    const [activeTab, setActiveTab] = useState<string>(initialTab)

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

    // Build ManyChat query request from profile data
    const manychatQueryRequest = useMemo(() => {
        if (!profile || !profile.phone || !profile.fullName) {
            return skipToken
        }

        // Normalize phone for ManyChat (remove + and use digits only)
        const phoneDigits = profile.phone.replace(/\D/g, "")

        return [
            {
                phone: phoneDigits,
                fullName: profile.fullName,
            },
        ]
    }, [profile])

    // Sync user with ManyChat when page loads
    const {
        data: manychatData,
        error: manychatError,
        isLoading: isManyChatLoading,
        isFetching: isManyChatFetching,
    } = useGetManyChatUserQuery(manychatQueryRequest)

    // Log when ManyChat query is triggered
    useEffect(() => {
        console.log("🔍 [ProfileSettings] ManyChat query state:", {
            manychatQueryRequest,
            willSkip: manychatQueryRequest === skipToken,
            isManyChatLoading,
            isManyChatFetching,
            hasData: !!manychatData,
            hasError: !!manychatError,
        })
    }, [manychatQueryRequest, isManyChatLoading, isManyChatFetching, manychatData, manychatError])

    useEffect(() => {
        if (manychatData && profile?.phone) {
            const phoneDigits = profile.phone.replace(/\D/g, "")
            const subscriberData = manychatData[phoneDigits]

            if (subscriberData && typeof subscriberData === "object" && !("error" in subscriberData)) {
                const manychatId = (subscriberData as { id?: string; subscriber_id?: string }).id ||
                    (subscriberData as { id?: string; subscriber_id?: string }).subscriber_id
                console.log("✅ [ProfileSettings] ManyChat user synced:", {
                    manychat_id: manychatId,
                    phone: phoneDigits,
                })
                console.log("📋 [ProfileSettings] Full ManyChat response:", subscriberData)
                if (manychatId) {
                    console.log(`🎯 [ProfileSettings] ManyChat ID: ${manychatId}`)
                }
            } else if (subscriberData && typeof subscriberData === "object" && "error" in subscriberData) {
                console.warn("⚠️ [ProfileSettings] ManyChat error:", (subscriberData as { error: string }).error)
            }
        }
        if (manychatError) {
            console.error("❌ [ProfileSettings] ManyChat sync error:", manychatError)
        }
    }, [manychatData, manychatError, profile])

    const [formState, setFormState] = useState<ProfileFormState>(initialState)
    const [isDirty, setIsDirty] = useState(false)
    const [contacts, setContacts] = useState<CustomerContact[]>([])
    const [isLoadingContacts, setIsLoadingContacts] = useState(false)
    const [deleteContactDialogOpen, setDeleteContactDialogOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<{ id: string; name: string } | null>(null)
    const [isDeletingContact, setIsDeletingContact] = useState(false)
    const [newContactName, setNewContactName] = useState("")
    const [newContactPhone, setNewContactPhone] = useState("")
    const [isNewContactPhoneValid, setIsNewContactPhoneValid] = useState(true)
    const [editingContactId, setEditingContactId] = useState<string | null>(null)
    const [editingContactName, setEditingContactName] = useState("")
    const [editingContactPhone, setEditingContactPhone] = useState("")
    const [isEditingContactPhoneValid, setIsEditingContactPhoneValid] = useState(true)
    const [creditToken, setCreditToken] = useState<Database["public"]["Tables"]["credit_tokens"]["Row"] | null>(null)
    const [isLoadingCreditToken, setIsLoadingCreditToken] = useState(false)
    const [showCreditCardModal, setShowCreditCardModal] = useState(false)
    const [isClearingCard, setIsClearingCard] = useState(false)
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
    const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null)
    const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState<string | null>(null)

    // Check if running locally (dev mode)
    const isLocalDev = () => {
        // Check browser location
        if (typeof window !== "undefined") {
            const hostname = window.location.hostname
            if (hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.startsWith("127.0.0.1")) {
                return false
            }
        }

        // Check Supabase URL environment variable
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PROD_SUPABASE_URL || ""
        const isLocalUrl = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1:54321")

        return isLocalUrl
    }

    // Clear credit card (only in dev mode)
    const handleClearCard = async () => {
        // Double-check we're in dev mode - prevent execution in production
        if (!isLocalDev()) {
            console.error("❌ [ProfileSettings] Clear card attempted in production - blocked!", {
                hostname: typeof window !== "undefined" ? window.location.hostname : "unknown",
                supabaseUrl: import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PROD_SUPABASE_URL || "unknown",
            })
            toast({
                title: "חסום",
                description: "פונקציה זו זמינה רק בסביבת פיתוח (localhost)",
                variant: "destructive",
            })
            return
        }

        if (!creditToken || !effectiveClientId) {
            console.warn("⚠️ [ProfileSettings] Cannot clear card: missing creditToken or effectiveClientId")
            return
        }

        if (!creditToken.id) {
            console.error("❌ [ProfileSettings] Credit token missing ID:", creditToken)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק - חסר מזהה כרטיס",
                variant: "destructive",
            })
            return
        }

        try {
            setIsClearingCard(true)
            console.log("🧪 [ProfileSettings] Clearing credit card:", {
                tokenId: creditToken.id,
                customerId: effectiveClientId,
                last4: creditToken.last4,
            })

            // Call edge function to delete (only works in local dev)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_PROD_SUPABASE_URL
            if (!supabaseUrl) {
                throw new Error("לא נמצא URL של Supabase")
            }

            // Get JWT token for authentication
            const { data: { session } } = await supabase.auth.getSession()
            const jwtToken = session?.access_token

            if (!jwtToken) {
                throw new Error("לא ניתן לקבל את אסימון ההתחברות. אנא התחבר מחדש.")
            }

            const functionUrl = `${supabaseUrl}/functions/v1/clear-credit-token`

            console.log("🧪 [ProfileSettings] Calling clear-credit-token function:", functionUrl)

            const response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${jwtToken}`,
                },
                body: JSON.stringify({
                    tokenId: creditToken.id,
                    customerId: effectiveClientId,
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                console.error("❌ [ProfileSettings] Edge function error:", result)
                throw new Error(result.error || "שגיאה במחיקת כרטיס האשראי")
            }

            console.log("✅ [ProfileSettings] Credit card cleared successfully:", result)

            // Update local state
            setCreditToken(null)

            toast({
                title: "הצלחה",
                description: "פרטי כרטיס האשראי נמחקו בהצלחה מהמסד נתונים",
            })
        } catch (error) {
            console.error("❌ [ProfileSettings] Error clearing credit card:", error)

            const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'object' && error !== null && 'message' in error
                    ? String(error.message)
                    : "לא הצלחנו למחוק את פרטי כרטיס האשראי"

            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsClearingCard(false)
        }
    }

    useEffect(() => {
        if (profile) {
            // Convert phone to E.164 format if it's not already
            let phoneValue = profile.phone ?? ""
            if (phoneValue && !phoneValue.startsWith("+")) {
                // If phone doesn't start with +, convert it to E.164 format
                const digits = phoneValue.replace(/\D/g, "")
                if (digits.startsWith("0") && digits.length === 10) {
                    // Israeli number starting with 0 (e.g., 0528393372)
                    phoneValue = `+972${digits.slice(1)}`
                } else if (digits.startsWith("972") && digits.length >= 11) {
                    // Already has country code without +
                    phoneValue = `+${digits}`
                } else if (digits.length >= 9) {
                    // Assume it's an Israeli number and add country code
                    phoneValue = `+972${digits}`
                }
            }

            setFormState({
                fullName: profile.fullName ?? "",
                phone: phoneValue,
                email: profile.email ?? "",
                address: profile.address ?? "",
            })
            setIsDirty(false)
        }
    }, [profile])

    // Fetch contacts when clientId is available
    useEffect(() => {
        const fetchContacts = async () => {
            if (!effectiveClientId) {
                setContacts([])
                return
            }

            try {
                setIsLoadingContacts(true)
                const { data, error } = await supabase
                    .from("customer_contacts")
                    .select("*")
                    .eq("customer_id", effectiveClientId)
                    .order("created_at", { ascending: true })

                if (error) throw error

                setContacts(data || [])
            } catch (error) {
                console.error("Error fetching contacts:", error)
                setContacts([])
            } finally {
                setIsLoadingContacts(false)
            }
        }

        if (effectiveClientId) {
            fetchContacts()
        }
    }, [effectiveClientId])

    // Fetch credit token when clientId is available
    useEffect(() => {
        const fetchCreditToken = async () => {
            if (!effectiveClientId) {
                setCreditToken(null)
                return
            }

            try {
                setIsLoadingCreditToken(true)
                console.log("🔍 [ProfileSettings] Fetching credit token for customer:", effectiveClientId)
                const { data, error } = await supabase
                    .from("credit_tokens")
                    .select("*")
                    .eq("customer_id", effectiveClientId)
                    .maybeSingle()

                if (error) {
                    console.error("❌ [ProfileSettings] Error fetching credit token:", error)
                    throw error
                }

                console.log("✅ [ProfileSettings] Credit token fetched:", data ? "exists" : "not found")
                setCreditToken(data)
            } catch (error) {
                console.error("Error fetching credit token:", error)
                setCreditToken(null)
            } finally {
                setIsLoadingCreditToken(false)
            }
        }

        if (effectiveClientId) {
            fetchCreditToken()
        }
    }, [effectiveClientId])

    // Sync tab with URL params when URL changes (e.g., browser back/forward)
    useEffect(() => {
        const modeParam = searchParams.get("mode")
        const urlTab = modeParam === "billing" ? "payment" : modeParam === "security" ? "security" : "general"

        if (urlTab !== activeTab) {
            setActiveTab(urlTab)
        }
    }, [searchParams, activeTab])

    // Handle tab change - update URL
    const handleTabChange = (value: string) => {
        setActiveTab(value)
        const params = new URLSearchParams(searchParams)

        if (value === "payment") {
            params.set("mode", "billing")
        } else if (value === "security") {
            params.set("mode", "security")
        } else {
            params.set("mode", "general")
        }

        setSearchParams(params, { replace: true })
    }

    // Handle password update
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!user) {
            setPasswordUpdateError("נדרשת התחברות כדי לשנות את הסיסמה.")
            return
        }

        // Validate passwords
        if (!newPassword || newPassword.length < 6) {
            setPasswordUpdateError("הסיסמה חייבת להכיל לפחות 6 תווים.")
            return
        }

        if (newPassword !== confirmPassword) {
            setPasswordUpdateError("הסיסמאות אינן תואמות.")
            return
        }

        setIsUpdatingPassword(true)
        setPasswordUpdateError(null)
        setPasswordUpdateSuccess(null)

        try {
            console.log("🔐 [ProfileSettings] Updating password for user:", user.id)
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            })

            if (error) {
                console.error("❌ [ProfileSettings] Password update error:", error)
                throw error
            }

            console.log("✅ [ProfileSettings] Password updated successfully")
            setPasswordUpdateSuccess("הסיסמה עודכנה בהצלחה!")
            setNewPassword("")
            setConfirmPassword("")
            toast({
                title: "הצלחה",
                description: "הסיסמה עודכנה בהצלחה.",
            })
        } catch (err) {
            console.error("❌ [ProfileSettings] Failed to update password:", err)
            const errorMessage = err instanceof Error ? err.message : "שגיאה בעדכון הסיסמה"
            setPasswordUpdateError(errorMessage)
            toast({
                title: "שגיאה",
                description: errorMessage,
                variant: "destructive",
            })
        } finally {
            setIsUpdatingPassword(false)
        }
    }

    const handleChange = (field: keyof ProfileFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
        setFormState((prev) => ({ ...prev, [field]: value }))
        setIsDirty(true)
    }

    const handlePhoneChange = (value: string) => {
        setFormState((prev) => ({ ...prev, phone: value }))
        setIsDirty(true)
    }

    const handleAddContact = useCallback(async () => {
        if (!effectiveClientId) return

        if (!newContactName.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם איש קשר נדרש",
                variant: "destructive",
            })
            return
        }

        if (!newContactPhone.trim()) {
            toast({
                title: "שדה חובה",
                description: "מספר טלפון נדרש",
                variant: "destructive",
            })
            return
        }

        if (!isNewContactPhoneValid) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        const normalizedPhone = normalizePhone(newContactPhone.trim())
        if (!normalizedPhone) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        try {
            const { data, error } = await supabase
                .from("customer_contacts")
                .insert({
                    customer_id: effectiveClientId,
                    name: newContactName.trim(),
                    phone: normalizedPhone,
                })
                .select()
                .single()

            if (error) throw error

            setContacts([...contacts, data])
            setNewContactName("")
            setNewContactPhone("")
            setIsNewContactPhoneValid(true)
            toast({
                title: "איש קשר נוסף בהצלחה",
                description: `${data.name} נוסף לרשימת אנשי הקשר.`,
            })
        } catch (error) {
            console.error("Error adding contact:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן להוסיף את איש הקשר",
                variant: "destructive",
            })
        }
    }, [effectiveClientId, newContactName, newContactPhone, isNewContactPhoneValid, contacts, toast])

    const handleStartEditContact = useCallback((contact: CustomerContact) => {
        setEditingContactId(contact.id)
        setEditingContactName(contact.name)
        setEditingContactPhone(contact.phone)
        setIsEditingContactPhoneValid(true) // Assume existing phone is valid
    }, [])

    const handleCancelEditContact = useCallback(() => {
        setEditingContactId(null)
        setEditingContactName("")
        setEditingContactPhone("")
        setIsEditingContactPhoneValid(true)
    }, [])

    const handleSaveEditContact = useCallback(async () => {
        if (!editingContactId || !effectiveClientId) return

        if (!editingContactName.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם איש קשר נדרש",
                variant: "destructive",
            })
            return
        }

        if (!editingContactPhone.trim()) {
            toast({
                title: "שדה חובה",
                description: "מספר טלפון נדרש",
                variant: "destructive",
            })
            return
        }

        if (!isEditingContactPhoneValid) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        const normalizedPhone = normalizePhone(editingContactPhone.trim())
        if (!normalizedPhone) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        try {
            const { data, error } = await supabase
                .from("customer_contacts")
                .update({
                    name: editingContactName.trim(),
                    phone: normalizedPhone,
                })
                .eq("id", editingContactId)
                .select()
                .single()

            if (error) throw error

            setContacts(contacts.map(c => c.id === editingContactId ? data : c))
            handleCancelEditContact()
            toast({
                title: "איש קשר עודכן בהצלחה",
                description: `פרטי ${data.name} עודכנו בהצלחה.`,
            })
        } catch (error) {
            console.error("Error updating contact:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן את איש הקשר",
                variant: "destructive",
            })
        }
    }, [editingContactId, editingContactName, editingContactPhone, isEditingContactPhoneValid, effectiveClientId, contacts, toast, handleCancelEditContact])

    const handleDeleteContact = useCallback((contactId: string, contactName: string) => {
        setContactToDelete({ id: contactId, name: contactName })
        setDeleteContactDialogOpen(true)
    }, [])

    const confirmDeleteContact = useCallback(async () => {
        if (!contactToDelete) return

        setIsDeletingContact(true)
        try {
            const { error } = await supabase
                .from("customer_contacts")
                .delete()
                .eq("id", contactToDelete.id)

            if (error) throw error

            setContacts(contacts.filter(c => c.id !== contactToDelete.id))
            toast({
                title: "איש קשר נמחק",
                description: `${contactToDelete.name} נמחק מרשימת אנשי הקשר.`,
            })
            setDeleteContactDialogOpen(false)
            setContactToDelete(null)
        } catch (error) {
            console.error("Error deleting contact:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את איש הקשר",
                variant: "destructive",
            })
        } finally {
            setIsDeletingContact(false)
        }
    }, [contactToDelete, contacts, toast])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!effectiveClientId || !user) {
            toast({
                title: "משתמש לא מזוהה",
                description: clientIdError?.message ?? "אנא התחברו מחדש ונסו שוב.",
                variant: "destructive",
            })
            return
        }

        try {
            const trimmedEmail = formState.email.trim()
            const trimmedPhone = formState.phone.trim()

            // Check phone availability first (before updating profile)
            if (trimmedPhone) {
                const currentAuthPhone = user.phone || user.user_metadata?.phone_number_e164 || ""
                const phoneChanged = trimmedPhone !== currentAuthPhone

                if (phoneChanged) {
                    console.log("📱 [ProfileSettings] Checking phone availability before update:", trimmedPhone)

                    const { data: phoneCheckResult, error: phoneCheckError } = await supabase.functions.invoke("update-user-phone", {
                        body: {
                            user_id: user.id,
                            phone: trimmedPhone,
                            full_name: formState.fullName.trim() || undefined,
                        },
                    })

                    if (phoneCheckError) {
                        const errorMessage = phoneCheckError.message || ""
                        if (errorMessage.includes("already") || errorMessage.includes("בשימוש")) {
                            throw new Error("מספר הטלפון כבר בשימוש על ידי משתמש אחר")
                        }
                        throw new Error(`שגיאה בבדיקת מספר הטלפון: ${errorMessage}`)
                    }

                    if (!phoneCheckResult?.success) {
                        const errorMsg = phoneCheckResult.error || ""
                        if (errorMsg.includes("בשימוש") || errorMsg.includes("already")) {
                            throw new Error(errorMsg.includes("מספר") ? errorMsg : "מספר הטלפון כבר בשימוש על ידי משתמש אחר")
                        }
                        throw new Error(`שגיאה בעדכון מספר הטלפון: ${errorMsg}`)
                    }

                    console.log("✅ [ProfileSettings] Phone validated and updated successfully")
                }
            }

            // Update customer profile (only if phone check passed)
            const result = await updateProfile({
                clientId: effectiveClientId,
                fullName: formState.fullName.trim() || undefined,
                phone: trimmedPhone || undefined,
                email: trimmedEmail || undefined,
                address: formState.address.trim() || undefined,
            }).unwrap()

            if (!result?.success) {
                throw new Error(result?.error || "שגיאה בשמירת הפרופיל")
            }

            // Update authentication details if email changed (phone already updated above)
            let authUpdateErrors: string[] = []
            let authUpdateSuccess = true // Phone was already updated above if it changed

            // Refresh user session to get updated phone if it changed
            if (trimmedPhone) {
                const currentAuthPhone = user.phone || user.user_metadata?.phone_number_e164 || ""
                const phoneChanged = trimmedPhone !== currentAuthPhone

                if (phoneChanged) {
                    // Refresh user session to get updated phone
                    try {
                        const { data: refreshedUser } = await supabase.auth.getUser()
                        if (refreshedUser?.user) {
                            console.log("✅ [ProfileSettings] User session refreshed with updated phone:", refreshedUser.user.phone)
                        }
                    } catch (refreshError) {
                        console.warn("⚠️ [ProfileSettings] Failed to refresh user session:", refreshError)
                        // Non-critical - user will see update on next page load
                    }
                }
            }

            // Update email if changed (can use regular updateUser)
            if (trimmedEmail && trimmedEmail !== user.email) {
                console.log("📧 [ProfileSettings] Email changed, updating auth:", { old: user.email, new: trimmedEmail })

                try {
                    const { error: emailUpdateError } = await supabase.auth.updateUser({
                        email: trimmedEmail,
                        data: {
                            ...user.user_metadata,
                            email: trimmedEmail,
                            full_name: formState.fullName.trim() || user.user_metadata?.full_name,
                        },
                    })

                    if (emailUpdateError) {
                        console.error("❌ [ProfileSettings] Failed to update email:", emailUpdateError)
                        authUpdateErrors.push(`עדכון אימייל: ${emailUpdateError.message}`)
                    } else {
                        console.log("✅ [ProfileSettings] Email updated successfully")
                        authUpdateSuccess = true
                    }
                } catch (error) {
                    console.error("❌ [ProfileSettings] Exception updating email:", error)
                    authUpdateErrors.push(`עדכון אימייל: ${error instanceof Error ? error.message : "שגיאה לא ידועה"}`)
                }
            } else if (!trimmedPhone && formState.fullName.trim() && formState.fullName.trim() !== user.user_metadata?.full_name) {
                // Update only full_name if phone and email didn't change
                try {
                    const { error: nameUpdateError } = await supabase.auth.updateUser({
                        data: {
                            ...user.user_metadata,
                            full_name: formState.fullName.trim(),
                        },
                    })

                    if (nameUpdateError) {
                        console.error("❌ [ProfileSettings] Failed to update full_name:", nameUpdateError)
                        authUpdateErrors.push(`עדכון שם: ${nameUpdateError.message}`)
                    } else {
                        console.log("✅ [ProfileSettings] Full name updated successfully")
                        authUpdateSuccess = true
                    }
                } catch (error) {
                    console.error("❌ [ProfileSettings] Exception updating full_name:", error)
                    authUpdateErrors.push(`עדכון שם: ${error instanceof Error ? error.message : "שגיאה לא ידועה"}`)
                }
            }

            // Show appropriate toast message
            if (authUpdateErrors.length > 0) {
                toast({
                    title: "הפרופיל עודכן",
                    description: `הפרופיל עודכן בהצלחה, אך עדכון פרטי האימות נכשל: ${authUpdateErrors.join(", ")}. ייתכן שתצטרך להתחבר מחדש.`,
                    variant: "default",
                })
            } else if (authUpdateSuccess || trimmedPhone || (trimmedEmail && trimmedEmail !== user.email)) {
                toast({
                    title: "הפרופיל עודכן",
                    description: "העדכונים נשלחו לצוות שלנו בהצלחה ופרטי האימות עודכנו.",
                })
            } else {
                toast({
                    title: "הפרופיל עודכן",
                    description: "העדכונים נשלחו לצוות שלנו בהצלחה.",
                })
            }

            setIsDirty(false)
            refetchProfile()
        } catch (error) {
            console.error("❌ [ProfileSettings] Failed to update profile", error)
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
        <div className="py-4" dir="rtl">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
                <div className="space-y-1 text-right">
                    <h1 className="text-2xl font-bold text-gray-900">הגדרות פרופיל</h1>
                    <p className="text-sm text-gray-600">עדכנו את הפרטים האישיים שלכם כדי שנמשיך לשרת אתכם בצורה הטובה ביותר.</p>
                </div>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4" dir="rtl">
                    <TabsList className="grid w-full grid-cols-3 rounded-xl bg-white/80 border border-gray-200 shadow-sm overflow-hidden">
                        <TabsTrigger
                            value="general"
                            className="flex flex-row-reverse items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-blue-100/90 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-700 transition-colors"
                        >
                            <Settings className="h-4 w-4" />
                            <span>כללי</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="payment"
                            className="flex flex-row-reverse items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-blue-100/90 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-700 transition-colors"
                        >
                            <CreditCard className="h-4 w-4" />
                            <span>תשלום</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="flex flex-row-reverse items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-blue-100/90 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-gray-50 data-[state=inactive]:hover:text-gray-700 transition-colors"
                        >
                            <Lock className="h-4 w-4" />
                            <span>אבטחה</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* General Tab */}
                    <TabsContent value="general" className="space-y-4">
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
                                    <>

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
                                                    <PhoneInput
                                                        id="phone"
                                                        value={formState.phone}
                                                        onChange={handlePhoneChange}
                                                        placeholder="הקלידו מספר טלפון לעדכון"
                                                        disabled={isLoadingProfile || isUpdatingProfile}
                                                        defaultCountry="il"
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

                                            </div>
                                        </form>

                                        {/* Additional Contacts Section */}
                                        <div className="mt-8 pt-6 border-t">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-right flex items-center gap-2">
                                                        <Phone className="h-4 w-4 text-gray-400" />
                                                        <span className="text-lg font-medium">אנשי קשר נוספים</span>
                                                    </Label>
                                                </div>

                                                {isLoadingContacts ? (
                                                    <div className="flex items-center justify-center py-4">
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                        <span className="mr-2 text-xs text-gray-500">טוען אנשי קשר...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Existing Contacts */}
                                                        {contacts.length > 0 && (
                                                            <div className="space-y-2">
                                                                {contacts.map((contact) => (
                                                                    <div key={contact.id} className="flex items-center gap-2 p-3 border rounded-md bg-gray-50">
                                                                        {editingContactId === contact.id ? (
                                                                            <div className="flex-1 space-y-2">
                                                                                <Input
                                                                                    value={editingContactName}
                                                                                    onChange={(e) => setEditingContactName(e.target.value)}
                                                                                    placeholder="שם איש קשר"
                                                                                    className="text-right text-sm"
                                                                                    dir="rtl"
                                                                                />
                                                                                <PhoneInput
                                                                                    value={editingContactPhone}
                                                                                    onChange={(value) => setEditingContactPhone(value)}
                                                                                    onValidationChange={(isValid) => setIsEditingContactPhoneValid(isValid)}
                                                                                    placeholder="מספר טלפון"
                                                                                    className="text-sm"
                                                                                    defaultCountry="il"
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        onClick={handleSaveEditContact}
                                                                                        disabled={!isEditingContactPhoneValid}
                                                                                        className="text-xs"
                                                                                    >
                                                                                        שמור
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        onClick={handleCancelEditContact}
                                                                                        className="text-xs"
                                                                                    >
                                                                                        בטל
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex-1 text-right">
                                                                                    <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                                                                                    <div className="text-xs text-gray-600">{contact.phone}</div>
                                                                                </div>
                                                                                <div className="flex gap-1">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        onClick={() => handleStartEditContact(contact)}
                                                                                        className="h-7 w-7 p-0"
                                                                                        disabled={isLoadingProfile || isUpdatingProfile}
                                                                                    >
                                                                                        <Pencil className="h-3 w-3" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        onClick={() => handleDeleteContact(contact.id, contact.name)}
                                                                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                                                                        disabled={isLoadingProfile || isUpdatingProfile}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                    </Button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Add New Contact */}
                                                        <div className="space-y-2 p-3 border rounded-md bg-gray-50">
                                                            <div className="text-sm font-medium text-gray-700 mb-2">הוסף איש קשר חדש</div>
                                                            <Input
                                                                value={newContactName}
                                                                onChange={(e) => setNewContactName(e.target.value)}
                                                                placeholder="שם איש קשר"
                                                                className="text-right text-sm"
                                                                dir="rtl"
                                                                disabled={isLoadingProfile || isUpdatingProfile}
                                                            />
                                                            <PhoneInput
                                                                value={newContactPhone}
                                                                onChange={(value) => setNewContactPhone(value)}
                                                                onValidationChange={(isValid) => setIsNewContactPhoneValid(isValid)}
                                                                placeholder="מספר טלפון"
                                                                className="text-sm"
                                                                disabled={isLoadingProfile || isUpdatingProfile}
                                                                defaultCountry="il"
                                                            />
                                                            <Button
                                                                size="sm"
                                                                onClick={handleAddContact}
                                                                disabled={isLoadingProfile || isUpdatingProfile || !newContactName.trim() || !newContactPhone.trim() || !isNewContactPhoneValid}
                                                                className="w-full text-xs"
                                                            >
                                                                <Plus className="h-3 w-3 ml-1" />
                                                                הוסף איש קשר
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                                {isLoadingProfile && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        טוען פרטי פרופיל...
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Payment Tab */}
                    <TabsContent value="payment" className="space-y-4">
                        <Card className="shadow-sm">
                            <CardHeader className="text-right">
                                <CardTitle className="flex items-center justify-start gap-2">
                                    <CreditCard className="h-5 w-5 text-blue-600" />
                                    <span>פרטי אשראי</span>
                                </CardTitle>
                                <CardDescription>
                                    הגדר את פרטי כרטיס האשראי שלך לתשלומים עתידיים
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingCreditToken ? (
                                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        טוען פרטי אשראי...
                                    </div>
                                ) : creditToken ? (
                                    <div className="space-y-4">
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-right">
                                            <div className="flex items-center justify-start gap-2 mb-2">
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                <span className="font-medium text-green-900">כרטיס אשראי מוגדר</span>
                                            </div>
                                            <div className="space-y-1 text-sm text-green-800">
                                                <p>
                                                    <span className="font-medium">ספרות אחרונות:</span> {creditToken.last4 || "לא זמין"}
                                                </p>
                                                <p>
                                                    <span className="font-medium">ספק:</span> {creditToken.provider || "Tranzila"}
                                                </p>
                                                {creditToken.created_at && (
                                                    <p className="text-xs text-green-700 mt-2">
                                                        עודכן לאחרונה: {new Date(creditToken.created_at).toLocaleDateString("he-IL", {
                                                            day: "2-digit",
                                                            month: "long",
                                                            year: "numeric",
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => setShowCreditCardModal(true)}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <CreditCard className="h-4 w-4 ml-2" />
                                            עדכן פרטי אשראי
                                        </Button>
                                        {isLocalDev() && (
                                            <Button
                                                onClick={handleClearCard}
                                                disabled={isClearingCard}
                                                variant="outline"
                                                className="w-full border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600"
                                            >
                                                {isClearingCard ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                        מוחק...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Trash2 className="h-4 w-4 ml-2" />
                                                        נקה כרטיס טסט
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-right">
                                            <div className="flex items-center justify-start gap-2 mb-2">
                                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                                <span className="font-medium text-yellow-900">פרטי אשראי לא הוגדרו</span>
                                            </div>
                                            <p className="text-sm text-yellow-800">
                                                לא הגדרת פרטי כרטיס אשראי. אנא הגדר את פרטי הכרטיס שלך כדי לאפשר תשלומים עתידיים.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => setShowCreditCardModal(true)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            <CreditCard className="h-4 w-4 ml-2" />
                                            הגדר פרטי אשראי
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Security Tab */}
                    <TabsContent value="security" className="space-y-4">
                        <Card className="shadow-sm">
                            <CardHeader className="text-right">
                                <CardTitle className="flex items-center justify-start gap-2">
                                    <Lock className="h-5 w-5 text-blue-600" />
                                    <span>אבטחה וסיסמה</span>
                                </CardTitle>
                                <CardDescription>
                                    שנה את הסיסמה שלך
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <form onSubmit={handleUpdatePassword} className="space-y-4">
                                    <div className="space-y-2 text-right">
                                        <Label htmlFor="newPassword" className="flex items-center justify-start gap-2">
                                            <Lock className="h-4 w-4 text-gray-400" />
                                            <span>סיסמה חדשה</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="newPassword"
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="הכנס סיסמה חדשה (לפחות 6 תווים)"
                                                dir="rtl"
                                                className="text-right pr-10"
                                                disabled={isUpdatingPassword}
                                                required
                                                minLength={6}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                            >
                                                {showNewPassword ? (
                                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-gray-400" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-right">
                                        <Label htmlFor="confirmPassword" className="flex items-center justify-start gap-2">
                                            <Lock className="h-4 w-4 text-gray-400" />
                                            <span>אישור סיסמה</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="הכנס שוב את הסיסמה החדשה"
                                                dir="rtl"
                                                className="text-right pr-10"
                                                disabled={isUpdatingPassword}
                                                required
                                                minLength={6}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                                ) : (
                                                    <Eye className="h-4 w-4 text-gray-400" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {passwordUpdateError && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{passwordUpdateError}</AlertDescription>
                                        </Alert>
                                    )}

                                    {passwordUpdateSuccess && (
                                        <Alert>
                                            <CheckCircle2 className="h-4 w-4" />
                                            <AlertDescription>{passwordUpdateSuccess}</AlertDescription>
                                        </Alert>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                        {isUpdatingPassword ? (
                                            <>
                                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                                מעדכן סיסמה...
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="h-4 w-4 ml-2" />
                                                עדכן סיסמה
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Credit Card Setup Modal */}
            {effectiveClientId && (
                <CreditCardSetupModal
                    open={showCreditCardModal}
                    onOpenChange={setShowCreditCardModal}
                    customerId={effectiveClientId}
                    onSuccess={() => {
                        // Refetch credit token after successful setup
                        const fetchCreditToken = async () => {
                            try {
                                setIsLoadingCreditToken(true)
                                const { data, error } = await supabase
                                    .from("credit_tokens")
                                    .select("*")
                                    .eq("customer_id", effectiveClientId)
                                    .maybeSingle()

                                if (error) throw error
                                setCreditToken(data)

                                // Dispatch event to notify banner to refresh
                                console.log("📢 [ProfileSettings] Dispatching creditCardSaved event")
                                window.dispatchEvent(new CustomEvent("creditCardSaved"))
                            } catch (error) {
                                console.error("Error fetching credit token:", error)
                            } finally {
                                setIsLoadingCreditToken(false)
                            }
                        }
                        fetchCreditToken()
                    }}
                />
            )}

            {/* Contact Delete Confirmation Dialog */}
            <ContactDeleteConfirmationDialog
                open={deleteContactDialogOpen}
                onOpenChange={setDeleteContactDialogOpen}
                contactName={contactToDelete?.name}
                isProcessing={isDeletingContact}
                onConfirm={confirmDeleteContact}
            />
        </div>
    )
}
