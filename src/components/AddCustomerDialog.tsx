import { useState, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, User, Phone, Mail } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useCreateCustomerMutation } from "@/store/services/supabaseApi"
import { normalizePhone } from "@/utils/phone"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"

interface Customer {
    id: string
    fullName?: string
    phone?: string
    email?: string
    recordId?: string
    customerTypeId?: string | null
}

interface AddCustomerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: (customer: Customer) => void
}

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
    const { toast } = useToast()
    const [createCustomer, { isLoading: isCreatingCustomer }] = useCreateCustomerMutation()

    const [customerData, setCustomerData] = useState({
        full_name: "",
        phone_number: "",
        email: "",
        customer_type_id: "",
    })
    const [customerTypes, setCustomerTypes] = useState<Array<{ id: string; name: string; priority: number }>>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(false)

    const handleClose = useCallback(() => {
        if (isCreatingCustomer) {
            return
        }
        onOpenChange(false)
        // Reset form after a delay to allow animation to complete
        setTimeout(() => {
            setCustomerData({
                full_name: "",
                phone_number: "",
                email: "",
                customer_type_id: "",
            })
        }, 300)
    }, [isCreatingCustomer, onOpenChange])

    useEffect(() => {
        if (!open) {
            return
        }

        const loadCustomerTypes = async () => {
            try {
                setIsLoadingTypes(true)
                console.log("🔍 [AddCustomerDialog] Loading customer types for selection...")
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
                console.log("✅ [AddCustomerDialog] Customer types loaded:", types)
            } catch (error) {
                console.error("❌ [AddCustomerDialog] Failed to load customer types:", error)
                toast({
                    title: "שגיאה בטעינת סוגי לקוחות",
                    description: "לא ניתן לטעון את סוגי הלקוחות כעת. אנא נסה שוב מאוחר יותר.",
                    variant: "destructive",
                })
            } finally {
                setIsLoadingTypes(false)
            }
        }

        loadCustomerTypes()
    }, [open, toast])

    const handleCreateCustomer = useCallback(async () => {
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
            console.log("🔍 [AddCustomerDialog] Creating customer with data:", {
                full_name: customerData.full_name.trim(),
                phone_number: normalizedPhone,
                email: customerData.email.trim() || undefined,
                customer_type_id: customerData.customer_type_id || null,
            })

            const result = await createCustomer({
                full_name: customerData.full_name.trim(),
                phone_number: normalizedPhone,
                email: customerData.email.trim() || undefined,
                customer_type_id: customerData.customer_type_id ? customerData.customer_type_id : null,
            }).unwrap()

            if (result.success && result.customerId) {
                toast({
                    title: "הלקוח נוסף בהצלחה",
                    description: `${customerData.full_name.trim()} נוסף לרשימת הלקוחות.`,
                })

                // Return customer object for immediate use
                const newCustomer: Customer = {
                    id: result.customerId,
                    fullName: result.customer?.fullName || customerData.full_name.trim(),
                    phone: result.customer?.phone || normalizedPhone,
                    email: result.customer?.email || customerData.email.trim() || undefined,
                    recordId: result.customerId,
                    customerTypeId: result.customerTypeId ?? (customerData.customer_type_id ? customerData.customer_type_id : null),
                }

                handleClose()
                onSuccess?.(newCustomer)
                // Also pass the customer object if there's a way to do it
                // For now, the parent component can refetch/search for this customer
            } else {
                throw new Error(result.error || "שגיאה ביצירת הלקוח")
            }
        } catch (error) {
            console.error("❌ [AddCustomerDialog] Failed to create customer:", error)
            const errorMessage = error instanceof Error ? error.message : "לא ניתן ליצור את הלקוח כעת"
            toast({
                title: "שגיאה ביצירת הלקוח",
                description: errorMessage,
                variant: "destructive",
            })
        }
    }, [customerData, createCustomer, toast, handleClose, onSuccess])

    return (
        <Dialog open={open} onOpenChange={(open) => (open ? null : handleClose())}>
            <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto text-right">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>הוסף לקוח חדש</DialogTitle>
                    <DialogDescription>מלא את הפרטים כדי להוסיף לקוח חדש לרשימה</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-customer-name" className="text-right flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            שם מלא <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="add-customer-name"
                            placeholder="הכנס שם מלא"
                            value={customerData.full_name}
                            onChange={(e) => setCustomerData({ ...customerData, full_name: e.target.value })}
                            className="text-right"
                            dir="rtl"
                            disabled={isCreatingCustomer}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-customer-type" className="text-right flex items-center gap-2">
                            סוג לקוח (אופציונלי)
                        </Label>
                        <Select
                            value={customerData.customer_type_id || "__none__"}
                            onValueChange={(value) =>
                                setCustomerData({
                                    ...customerData,
                                    customer_type_id: value === "__none__" ? "" : value,
                                })
                            }
                            disabled={isCreatingCustomer || isLoadingTypes}
                        >
                            <SelectTrigger id="add-customer-type" dir="rtl" className="text-right">
                                <SelectValue placeholder={isLoadingTypes ? "טוען סוגים..." : "בחר סוג לקוח"} />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="__none__">ללא סוג</SelectItem>
                                {customerTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 text-right">
                            בחר סוג לקוח כדי לשייך אותו לקדימות מוגדרת מראש. ניתן להוסיף סוגים חדשים בלשונית \"סוגי לקוחות\".
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-customer-phone" className="text-right flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            מספר טלפון <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="add-customer-phone"
                            type="tel"
                            placeholder="050-1234567"
                            value={customerData.phone_number}
                            onChange={(e) => setCustomerData({ ...customerData, phone_number: e.target.value })}
                            className="text-right"
                            dir="rtl"
                            disabled={isCreatingCustomer}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="add-customer-email" className="text-right flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-400" />
                            אימייל (אופציונלי)
                        </Label>
                        <Input
                            id="add-customer-email"
                            type="email"
                            placeholder="customer@example.com"
                            value={customerData.email}
                            onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                            className="text-right"
                            dir="rtl"
                            disabled={isCreatingCustomer}
                        />
                        <p className="text-xs text-gray-500 text-right">
                            האימייל אינו חובה. אם לא יוזן, יוצג אימייל זמני
                        </p>
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        onClick={handleCreateCustomer}
                        disabled={isCreatingCustomer || !customerData.full_name.trim() || !customerData.phone_number.trim()}
                        className="inline-flex items-center gap-2"
                    >
                        {isCreatingCustomer && <Loader2 className="h-4 w-4 animate-spin" />}
                        הוסף לקוח
                    </Button>
                    <Button variant="outline" onClick={handleClose} disabled={isCreatingCustomer}>
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

