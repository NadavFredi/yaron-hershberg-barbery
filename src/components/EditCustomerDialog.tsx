import { useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, User, Phone, Mail, MapPin, FileText, Plus, Trash2, Pencil } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useUpdateCustomerMutation } from "@/store/services/supabaseApi"
import { supabase } from "@/integrations/supabase/client"
import { normalizePhone } from "@/utils/phone"
import { AutocompleteSelectWithCreate, type SelectOption } from "@/components/ui/AutocompleteSelectWithCreate"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhoneInput } from "@/components/ui/phone-input"
import { Checkbox } from "@/components/ui/checkbox"
import type { Database } from "@/integrations/supabase/types"

const NO_TYPE_VALUE = "__NONE__"

type CustomerContact = Database["public"]["Tables"]["customer_contacts"]["Row"]
type CustomerContactInsert = Database["public"]["Tables"]["customer_contacts"]["Insert"]


interface CustomerFormData {
    full_name: string
    phone_number: string
    email: string
    address: string
    customer_type_id: string | null
    lead_source_id: string | null
    staff_notes: string
    gender: string | null
    date_of_birth: string
    external_id: string
    city: string
    is_banned: boolean
}

interface EditCustomerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string | null
    onSuccess?: (updatedCustomer?: {
        id: string
        fullName: string
        phone: string
        email?: string | null
        address?: string | null
    }) => void
}

export function EditCustomerDialog({ open, onOpenChange, customerId, onSuccess }: EditCustomerDialogProps) {
    const { toast } = useToast()
    const [updateCustomer, { isLoading: isUpdatingCustomer }] = useUpdateCustomerMutation()
    const [isLoadingCustomerData, setIsLoadingCustomerData] = useState(false)

    const [customerData, setCustomerData] = useState<CustomerFormData>({
        full_name: "",
        phone_number: "",
        email: "",
        address: "",
        customer_type_id: null,
        lead_source_id: null,
        staff_notes: "",
        gender: null,
        date_of_birth: "",
        external_id: "",
        city: "",
        is_banned: false,
    })
    const [contacts, setContacts] = useState<CustomerContact[]>([])
    const [isLoadingContacts, setIsLoadingContacts] = useState(false)
    const [newContactName, setNewContactName] = useState("")
    const [newContactPhone, setNewContactPhone] = useState("")
    const [editingContactId, setEditingContactId] = useState<string | null>(null)
    const [editingContactName, setEditingContactName] = useState("")
    const [editingContactPhone, setEditingContactPhone] = useState("")

    // Load customer data and contacts when dialog opens
    useEffect(() => {
        if (open && customerId) {
            setIsLoadingCustomerData(true)
            // Fetch customer data directly from Supabase
            supabase
                .from("customers")
                .select("id, full_name, phone, email, address, customer_type_id, lead_source_id, staff_notes, gender, date_of_birth, external_id, city, is_banned")
                .eq("id", customerId)
                .single()
                .then(({ data, error }) => {
                    if (error || !data) {
                        toast({
                            title: "שגיאה",
                            description: error?.message || "לא ניתן לטעון את פרטי הלקוח",
                            variant: "destructive",
                        })
                        onOpenChange(false)
                    } else {
                        setCustomerData({
                            full_name: data.full_name || "",
                            phone_number: data.phone || "",
                            email: data.email || "",
                            address: data.address || "",
                            customer_type_id: data.customer_type_id ?? null,
                            lead_source_id: (data as any).lead_source_id ?? null,
                            staff_notes: data.staff_notes || "",
                            gender: (data as any).gender || null,
                            date_of_birth: (data as any).date_of_birth ? new Date((data as any).date_of_birth).toISOString().split('T')[0] : "",
                            external_id: (data as any).external_id || "",
                            city: (data as any).city || "",
                            is_banned: (data as any).is_banned || false,
                        })
                    }
                })
                .catch((error) => {
                    console.error("Failed to load customer data:", error)
                    toast({
                        title: "שגיאה",
                        description: "לא ניתן לטעון את פרטי הלקוח",
                        variant: "destructive",
                    })
                    onOpenChange(false)
                })
                .finally(() => {
                    setIsLoadingCustomerData(false)
                })

            // Fetch contacts
            setIsLoadingContacts(true)
            supabase
                .from("customer_contacts")
                .select("*")
                .eq("customer_id", customerId)
                .order("created_at", { ascending: true })
                .then(({ data, error }) => {
                    if (error) {
                        console.error("Error fetching contacts:", error)
                        setContacts([])
                    } else {
                        setContacts(data || [])
                    }
                })
                .finally(() => {
                    setIsLoadingContacts(false)
                })
        } else {
            // Reset contacts when dialog closes
            setContacts([])
            setNewContactName("")
            setNewContactPhone("")
            setEditingContactId(null)
            setEditingContactName("")
            setEditingContactPhone("")
        }
    }, [open, customerId, toast, onOpenChange])

    const handleClose = useCallback(() => {
        if (isUpdatingCustomer || isLoadingCustomerData) {
            return
        }
        onOpenChange(false)
        // Reset form after a delay to allow animation to complete
        setTimeout(() => {
            setCustomerData({
                full_name: "",
                phone_number: "",
                email: "",
                address: "",
                customer_type_id: null,
                lead_source_id: null,
                staff_notes: "",
                gender: null,
                date_of_birth: "",
                external_id: "",
                city: "",
                is_banned: false,
            })
            setContacts([])
            setNewContactName("")
            setNewContactPhone("")
            setEditingContactId(null)
            setEditingContactName("")
            setEditingContactPhone("")
        }, 300)
    }, [isUpdatingCustomer, isLoadingCustomerData, onOpenChange])

    // Search functions for autocomplete
    const searchCustomerTypes = useCallback(async (searchTerm: string): Promise<SelectOption[]> => {
        const { data, error } = await supabase
            .from("customer_types")
            .select("id, name")
            .order("priority", { ascending: true })

        if (error) throw error

        const allTypes = (data || []).map((type) => ({
            id: type.id,
            name: type.name,
        }))

        if (!searchTerm.trim()) {
            return allTypes
        }

        const lowerSearch = searchTerm.toLowerCase()
        return allTypes.filter((type) => type.name.toLowerCase().includes(lowerSearch))
    }, [])

    const createCustomerType = useCallback(async (name: string): Promise<SelectOption> => {
        // Get max priority to set new one
        const { data: existingTypes } = await supabase
            .from("customer_types")
            .select("priority")
            .order("priority", { ascending: false })
            .limit(1)

        const maxPriority = existingTypes && existingTypes.length > 0 ? existingTypes[0].priority : 0
        const nextPriority = maxPriority + 1

        const { data, error } = await supabase
            .from("customer_types")
            .insert({ name: name.trim(), priority: nextPriority, description: null })
            .select("id, name")
            .single()

        if (error) throw error

        return { id: data.id, name: data.name }
    }, [])

    const searchLeadSources = useCallback(async (searchTerm: string): Promise<SelectOption[]> => {
        const { data, error } = await supabase
            .from("lead_sources")
            .select("id, name")
            .order("name", { ascending: true })

        if (error) throw error

        const allSources = (data || []).map((source) => ({
            id: source.id,
            name: source.name,
        }))

        if (!searchTerm.trim()) {
            return allSources
        }

        const lowerSearch = searchTerm.toLowerCase()
        return allSources.filter((source) => source.name.toLowerCase().includes(lowerSearch))
    }, [])

    const createLeadSource = useCallback(async (name: string): Promise<SelectOption> => {
        const { data, error } = await supabase
            .from("lead_sources")
            .insert({ name: name.trim() })
            .select("id, name")
            .single()

        if (error) throw error

        return { id: data.id, name: data.name }
    }, [])

    const handleUpdateCustomer = useCallback(async () => {
        if (!customerId) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לעדכן לקוח ללא זיהוי",
                variant: "destructive",
            })
            return
        }

        if (!customerData.full_name.trim()) {
            toast({
                title: "שדה חובה",
                description: "שם מלא נדרש",
                variant: "destructive",
            })
            return
        }

        if (!customerData.phone_number.trim()) {
            toast({
                title: "שדה חובה",
                description: "מספר טלפון נדרש",
                variant: "destructive",
            })
            return
        }

        // Normalize phone number
        const normalizedPhone = normalizePhone(customerData.phone_number.trim())
        if (!normalizedPhone) {
            toast({
                title: "מספר טלפון לא תקין",
                description: "אנא הכנס מספר טלפון תקין",
                variant: "destructive",
            })
            return
        }

        try {
            console.log("🔍 [EditCustomerDialog] Updating customer with data:", {
                customerId,
                full_name: customerData.full_name.trim(),
                phone_number: normalizedPhone,
                email: customerData.email.trim() || undefined,
                address: customerData.address.trim() || undefined,
                customer_type_id: customerData.customer_type_id,
                lead_source_id: customerData.lead_source_id,
                staff_notes: customerData.staff_notes.trim() || undefined,
            })

            // Update staff_notes, lead_source_id, and additional fields directly via Supabase since updateCustomer might not support them
            const { error: additionalFieldsError } = await supabase
                .from("customers")
                .update({
                    staff_notes: customerData.staff_notes.trim() || null,
                    lead_source_id: customerData.lead_source_id,
                    gender: customerData.gender || null,
                    date_of_birth: customerData.date_of_birth ? customerData.date_of_birth : null,
                    external_id: customerData.external_id.trim() || null,
                    city: customerData.city.trim() || null,
                    is_banned: customerData.is_banned,
                })
                .eq("id", customerId)

            if (additionalFieldsError) {
                console.error("Error updating additional fields:", additionalFieldsError)
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לעדכן את כל השדות",
                    variant: "destructive",
                })
                return
            }

            const result = await updateCustomer({
                customerId,
                full_name: customerData.full_name.trim(),
                phone_number: normalizedPhone,
                email: customerData.email.trim() || undefined,
                address: customerData.address.trim() || undefined,
                customer_type_id: customerData.customer_type_id,
            }).unwrap()

            if (result.success) {
                toast({
                    title: "הלקוח עודכן בהצלחה",
                    description: `פרטי ${customerData.full_name.trim()} עודכנו בהצלחה.`,
                })
                handleClose()
                // Pass updated customer data to callback
                onSuccess?.(result.customer)
            } else {
                throw new Error(result.error || "שגיאה בעדכון הלקוח")
            }
        } catch (error) {
            console.error("Failed to update customer:", error)
            toast({
                title: "שגיאה בעדכון הלקוח",
                description: error instanceof Error ? error.message : "לא ניתן לעדכן את הלקוח כעת",
                variant: "destructive",
            })
        }
    }, [customerId, customerData, updateCustomer, toast, handleClose, onSuccess])

    const handleAddContact = useCallback(async () => {
        if (!customerId) return

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
                    customer_id: customerId,
                    name: newContactName.trim(),
                    phone: normalizedPhone,
                })
                .select()
                .single()

            if (error) throw error

            setContacts([...contacts, data])
            setNewContactName("")
            setNewContactPhone("")
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
    }, [customerId, newContactName, newContactPhone, contacts, toast])

    const handleStartEditContact = useCallback((contact: CustomerContact) => {
        setEditingContactId(contact.id)
        setEditingContactName(contact.name)
        setEditingContactPhone(contact.phone)
    }, [])

    const handleCancelEditContact = useCallback(() => {
        setEditingContactId(null)
        setEditingContactName("")
        setEditingContactPhone("")
    }, [])

    const handleSaveEditContact = useCallback(async () => {
        if (!editingContactId) return

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
    }, [editingContactId, editingContactName, editingContactPhone, contacts, toast, handleCancelEditContact])

    const handleDeleteContact = useCallback(async (contactId: string, contactName: string) => {
        if (!confirm(`האם אתה בטוח שברצונך למחוק את ${contactName}?`)) {
            return
        }

        try {
            const { error } = await supabase
                .from("customer_contacts")
                .delete()
                .eq("id", contactId)

            if (error) throw error

            setContacts(contacts.filter(c => c.id !== contactId))
            toast({
                title: "איש קשר נמחק",
                description: `${contactName} נמחק מרשימת אנשי הקשר.`,
            })
        } catch (error) {
            console.error("Error deleting contact:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את איש הקשר",
                variant: "destructive",
            })
        }
    }, [contacts, toast])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-lg max-h-[70vh] flex flex-col text-right">
                <DialogHeader className="items-start text-right flex-shrink-0">
                    <DialogTitle>ערוך פרטי לקוח</DialogTitle>
                    <DialogDescription>עדכן את הפרטים של הלקוח</DialogDescription>
                </DialogHeader>
                {isLoadingCustomerData ? (
                    <div className="flex items-center justify-center p-8 flex-1">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="mr-2 text-sm text-gray-500">טוען פרטי לקוח...</span>
                    </div>
                ) : (
                    <div className="space-y-4 py-4 px-2 overflow-y-auto flex-1 min-h-0" dir="ltr" style={{ direction: 'ltr' }}>
                        <div dir="rtl" className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-name" className="text-right flex items-center gap-2">
                                    <User className="h-4 w-4 text-gray-400" />
                                    שם מלא <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="edit-customer-name"
                                    placeholder="הכנס שם מלא"
                                    value={customerData.full_name}
                                    onChange={(e) => setCustomerData({ ...customerData, full_name: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <div className="space-y-2 ">
                                <Label htmlFor="edit-customer-phone" className="text-right flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    מספר טלפון <span className="text-red-500">*</span>
                                </Label>
                                <PhoneInput
                                    id="edit-customer-phone"
                                    placeholder="050-1234567"
                                    value={customerData.phone_number}
                                    onChange={(value) => setCustomerData({ ...customerData, phone_number: value })}
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-email" className="text-right flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    אימייל
                                </Label>
                                <Input
                                    id="edit-customer-email"
                                    type="email"
                                    placeholder="customer@example.com"
                                    value={customerData.email}
                                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <AutocompleteSelectWithCreate
                                value={customerData.customer_type_id}
                                onChange={(value) =>
                                    setCustomerData({
                                        ...customerData,
                                        customer_type_id: value,
                                    })
                                }
                                searchFn={searchCustomerTypes}
                                createFn={createCustomerType}
                                label="סוג לקוח (אופציונלי)"
                                placeholder="חפש סוג לקוח או הוסף חדש..."
                                allowClear={true}
                                clearLabel="ללא סוג"
                                disabled={isUpdatingCustomer}
                                helperText="רק מנהלים יכולים לשנות סוגי לקוחות. השינוי משפיע על קדימויות בתורים."
                            />

                            <AutocompleteSelectWithCreate
                                value={customerData.lead_source_id}
                                onChange={(value) =>
                                    setCustomerData({
                                        ...customerData,
                                        lead_source_id: value,
                                    })
                                }
                                searchFn={searchLeadSources}
                                createFn={createLeadSource}
                                label="מקור הגעה (אופציונלי)"
                                placeholder="חפש מקור הגעה או הוסף חדש..."
                                allowClear={true}
                                clearLabel="ללא מקור"
                                disabled={isUpdatingCustomer}
                            />

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-address" className="text-right flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-gray-400" />
                                    כתובת
                                </Label>
                                <Input
                                    id="edit-customer-address"
                                    placeholder="הכנס כתובת"
                                    value={customerData.address}
                                    onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-city" className="text-right flex items-center gap-2">
                                    עיר
                                </Label>
                                <Input
                                    id="edit-customer-city"
                                    placeholder="הכנס עיר"
                                    value={customerData.city}
                                    onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-gender" className="text-right flex items-center gap-2">
                                    מין
                                </Label>
                                <Select
                                    value={customerData.gender ?? NO_TYPE_VALUE}
                                    onValueChange={(value) =>
                                        setCustomerData({
                                            ...customerData,
                                            gender: value === NO_TYPE_VALUE ? null : value,
                                        })
                                    }
                                    disabled={isUpdatingCustomer}
                                >
                                    <SelectTrigger id="edit-customer-gender" dir="rtl" className="text-right">
                                        <SelectValue placeholder="בחר מין" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value={NO_TYPE_VALUE}>ללא מין</SelectItem>
                                        <SelectItem value="male">זכר</SelectItem>
                                        <SelectItem value="female">נקבה</SelectItem>
                                        <SelectItem value="other">אחר</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-date-of-birth" className="text-right flex items-center gap-2">
                                    תאריך לידה
                                </Label>
                                <Input
                                    id="edit-customer-date-of-birth"
                                    type="date"
                                    value={customerData.date_of_birth}
                                    onChange={(e) => setCustomerData({ ...customerData, date_of_birth: e.target.value })}
                                    className="text-right"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-external-id" className="text-right flex items-center gap-2">
                                    מזהה חיצוני
                                </Label>
                                <Input
                                    id="edit-customer-external-id"
                                    placeholder="הכנס מזהה חיצוני"
                                    value={customerData.external_id}
                                    onChange={(e) => setCustomerData({ ...customerData, external_id: e.target.value })}
                                    className="text-right font-mono"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                            </div>

                            <div className="flex items-center space-x-2 space-x-reverse">
                                <Checkbox
                                    id="edit-customer-is-banned"
                                    checked={customerData.is_banned}
                                    onCheckedChange={(checked) => setCustomerData({ ...customerData, is_banned: checked === true })}
                                    disabled={isUpdatingCustomer}
                                />
                                <Label htmlFor="edit-customer-is-banned" className="text-right cursor-pointer">
                                    לקוח חסום
                                </Label>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-customer-staff-notes" className="text-right flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-400" />
                                    הערות צוות פנימי
                                </Label>
                                <Textarea
                                    id="edit-customer-staff-notes"
                                    placeholder="הערות פנימיות על הלקוח (לא נראות ללקוח)"
                                    value={customerData.staff_notes}
                                    onChange={(e) => setCustomerData({ ...customerData, staff_notes: e.target.value })}
                                    className="text-right min-h-[100px] resize-none"
                                    dir="rtl"
                                    disabled={isUpdatingCustomer}
                                />
                                <p className="text-xs text-blue-600 text-right">
                                    הערות אלו נראות רק לצוות ולא ללקוח
                                </p>
                            </div>

                            {/* Additional Contacts Section */}
                            <div className="space-y-3 pt-2 border-t">
                                <div className="flex items-center justify-between">
                                    <Label className="text-right flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-gray-400" />
                                        אנשי קשר נוספים
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
                                                    <div key={contact.id} className="flex items-center gap-2 p-2 border rounded-md bg-gray-50">
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
                                                                    placeholder="מספר טלפון"
                                                                    className="text-sm"
                                                                />
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={handleSaveEditContact}
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
                                                                        disabled={isUpdatingCustomer}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => handleDeleteContact(contact.id, contact.name)}
                                                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                                                        disabled={isUpdatingCustomer}
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
                                        <div className="space-y-2 p-2 border rounded-md bg-gray-50">
                                            <div className="text-xs font-medium text-gray-700 mb-2">הוסף איש קשר חדש</div>
                                            <Input
                                                value={newContactName}
                                                onChange={(e) => setNewContactName(e.target.value)}
                                                placeholder="שם איש קשר"
                                                className="text-right text-sm"
                                                dir="rtl"
                                                disabled={isUpdatingCustomer}
                                            />
                                            <PhoneInput
                                                value={newContactPhone}
                                                onChange={(value) => setNewContactPhone(value)}
                                                placeholder="מספר טלפון"
                                                className="text-sm"
                                                disabled={isUpdatingCustomer}
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleAddContact}
                                                disabled={isUpdatingCustomer || !newContactName.trim() || !newContactPhone.trim()}
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
                    </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex-shrink-0">
                    <Button
                        onClick={handleUpdateCustomer}
                        disabled={isUpdatingCustomer || isLoadingCustomerData || !customerData.full_name.trim() || !customerData.phone_number.trim()}
                        className="inline-flex items-center gap-2"
                    >
                        {isUpdatingCustomer && <Loader2 className="h-4 w-4 animate-spin" />}
                        עדכן לקוח
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isUpdatingCustomer || isLoadingCustomerData}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

