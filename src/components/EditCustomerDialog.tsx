import { useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, Phone, Mail, MapPin } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useUpdateCustomerMutation } from "@/store/services/supabaseApi"
import { supabase } from "@/integrations/supabase/client"
import { normalizePhone } from "@/utils/phone"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const NO_TYPE_VALUE = "__NONE__"

interface CustomerFormData {
    full_name: string
    phone_number: string
    email: string
    address: string
    customer_type_id: string | null
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
    })
    const [customerTypes, setCustomerTypes] = useState<Array<{ id: string; name: string; priority: number }>>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(false)

    // Load customer data when dialog opens
    useEffect(() => {
        if (open && customerId) {
            setIsLoadingCustomerData(true)
            // Fetch customer data directly from Supabase
            supabase
                .from("customers")
                .select("id, full_name, phone, email, address, customer_type_id")
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
            })
        }, 300)
    }, [isUpdatingCustomer, isLoadingCustomerData, onOpenChange])

    useEffect(() => {
        if (!open) {
            return
        }

        const loadCustomerTypes = async () => {
            try {
                setIsLoadingTypes(true)
                console.log("🔍 [EditCustomerDialog] Loading customer types...")
                const { data, error } = await supabase
                    .from("customer_types")
                    .select("id, name, priority")
                    .order("priority", { ascending: true })

                if (error) throw error

                const types = (data || []).map((type) => ({
                    id: type.id,
                    name: type.name,
                    priority: type.priority,
                }))

                setCustomerTypes(types)
                console.log("✅ [EditCustomerDialog] Customer types loaded:", types)
            } catch (error) {
                console.error("❌ [EditCustomerDialog] Failed to load customer types:", error)
                toast({
                    title: "שגיאה בטעינת סוגי לקוחות",
                    description: "לא ניתן לטעון את סוגי הלקוחות כעת",
                    variant: "destructive",
                })
            } finally {
                setIsLoadingTypes(false)
            }
        }

        loadCustomerTypes()
    }, [open, toast])

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
            })
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

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>ערוך פרטי לקוח</DialogTitle>
                    <DialogDescription>עדכן את הפרטים של הלקוח</DialogDescription>
                </DialogHeader>
                {isLoadingCustomerData ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        <span className="mr-2 text-sm text-gray-500">טוען פרטי לקוח...</span>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
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

                        <div className="space-y-2">
                            <Label htmlFor="edit-customer-phone" className="text-right flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                מספר טלפון <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="edit-customer-phone"
                                type="tel"
                                placeholder="050-1234567"
                                value={customerData.phone_number}
                                onChange={(e) => setCustomerData({ ...customerData, phone_number: e.target.value })}
                                className="text-right"
                                dir="rtl"
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

                        <div className="space-y-2">
                            <Label htmlFor="edit-customer-type" className="text-right flex items-center gap-2">
                                סוג לקוח (אופציונלי)
                            </Label>
                            <Select
                                value={customerData.customer_type_id ?? NO_TYPE_VALUE}
                                onValueChange={(value) =>
                                    setCustomerData({
                                        ...customerData,
                                        customer_type_id: value === NO_TYPE_VALUE ? null : value,
                                    })
                                }
                                disabled={isUpdatingCustomer || isLoadingTypes}
                            >
                                <SelectTrigger id="edit-customer-type" dir="rtl" className="text-right">
                                    <SelectValue placeholder={isLoadingTypes ? "טוען סוגים..." : "בחר סוג"} />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value={NO_TYPE_VALUE}>ללא סוג</SelectItem>
                                    {customerTypes.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 text-right">
                                רק מנהלים יכולים לשנות סוגי לקוחות. השינוי משפיע על קדימויות בתורים.
                            </p>
                        </div>

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
                    </div>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
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

