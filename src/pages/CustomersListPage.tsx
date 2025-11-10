import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { ClientDetailsSheet, TreatmentDetailsSheet } from "@/pages/ManagerSchedule/sheets/index"
import type { ManagerTreatment } from "@/types/managerSchedule"
import { AddCustomerDialog } from "@/components/AddCustomerDialog"
import { EditCustomerDialog } from "@/components/EditCustomerDialog"
import { BulkCustomersDeleteDialog } from "@/components/dialogs/customers/BulkCustomersDeleteDialog"
import { BulkAssignCustomerTypeDialog } from "@/components/dialogs/customers/BulkAssignCustomerTypeDialog"
import { BulkReceiptPreferenceDialog } from "@/components/dialogs/customers/BulkReceiptPreferenceDialog"
import { CustomerDeleteConfirmationDialog } from "@/components/dialogs/customers/CustomerDeleteConfirmationDialog"

interface CustomerTypeSummary {
    id: string
    name: string
    priority: number
}

interface Customer {
    id: string
    full_name: string
    phone: string
    email: string | null
    classification: 'new' | 'existing' | 'vip' | 'extra_vip'
    address: string | null
    send_invoice: boolean
    created_at: string
    customer_type_id: string | null
    customer_type: CustomerTypeSummary | null
}

type SelectedClientDetails = {
    name: string
    phone?: string
    email?: string
    classification?: string
    customerTypeName?: string
    address?: string
}

type SelectedTreatmentDetails = {
    id: string
    name: string
    treatmentType?: string
    clientClassification?: string
    gender?: string
    healthIssues?: string | null
    vetName?: string | null
    vetPhone?: string | null
    birthDate?: string | null
    internalNotes?: string | null
    owner?: {
        name?: string
        phone?: string
        email?: string
        customerTypeName?: string
    }
}

export default function CustomersListPage() {
    const { toast } = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const customerTypeParam = searchParams.get("type")
    const [customers, setCustomers] = useState<Customer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [customerTypes, setCustomerTypes] = useState<CustomerTypeSummary[]>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const shiftPressedRef = useRef(false)
    const shiftKeyHeldRef = useRef(false)
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
    const [currentBulkAction, setCurrentBulkAction] = useState<"delete" | "assignType" | "enableReceipt" | "disableReceipt" | null>(null)
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
    const [isAssignTypeDialogOpen, setIsAssignTypeDialogOpen] = useState(false)
    const [selectedTypeForBulk, setSelectedTypeForBulk] = useState<string | "none" | null>(null)
    const [pendingReceiptUpdate, setPendingReceiptUpdate] = useState<null | boolean>(null)

    // Filter states
    const [customerTypeFilter, setCustomerTypeFilter] = useState<string>(customerTypeParam ?? "all")
    const [phoneFilter, setPhoneFilter] = useState("")
    const [emailFilter, setEmailFilter] = useState("")
    const [nameFilter, setNameFilter] = useState("")
    const [treatmentNameFilter, setTreatmentNameFilter] = useState("")
    const [treatmentTypeFilter, setTreatmentTypeFilter] = useState("")

    useEffect(() => {
        if (customerTypeParam && customerTypeParam !== customerTypeFilter) {
            setCustomerTypeFilter(customerTypeParam)
        }
        if (!customerTypeParam && customerTypeFilter !== "all") {
            setCustomerTypeFilter("all")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerTypeParam])

    const handleCustomerTypeFilterChange = (value: string) => {
        setCustomerTypeFilter(value)
        const params = new URLSearchParams(searchParams.toString())
        if (!value || value === "all") {
            params.delete("type")
        } else {
            params.set("type", value)
        }
        setSearchParams(params, { replace: true })
    }

    // Sheet states
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false)
    const [isTreatmentDetailsOpen, setIsTreatmentDetailsOpen] = useState(false)
    const [selectedClientForSheet, setSelectedClientForSheet] = useState<SelectedClientDetails | null>(null)
    const [selectedTreatmentForSheet, setSelectedTreatmentForSheet] = useState<SelectedTreatmentDetails | null>(null)
    const [clientTreatments, setClientTreatments] = useState<ManagerTreatment[]>([])

    useEffect(() => {
        fetchCustomers()
        fetchCustomerTypes()
    }, [])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Shift") {
                shiftKeyHeldRef.current = true
            }
        }

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Shift") {
                shiftKeyHeldRef.current = false
            }
        }

        const handleWindowBlur = () => {
            shiftKeyHeldRef.current = false
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)
        window.addEventListener("blur", handleWindowBlur)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
            window.removeEventListener("blur", handleWindowBlur)
        }
    }, [])

    useEffect(() => {
        setSelectedCustomerIds((prev) => prev.filter((id) => customers.some((customer) => customer.id === id)))
    }, [customers])

    useEffect(() => {
        if (selectedCustomerIds.length === 0) {
            setLastSelectedIndex(null)
        }
    }, [selectedCustomerIds])

    const fetchCustomerTypes = async () => {
        try {
            setIsLoadingTypes(true)
            console.log("🔍 [CustomersListPage] Fetching customer types...")
            const { data, error } = await supabase
                .from("customer_types")
                .select("id, name, priority")
                .order("priority", { ascending: true })

            if (error) throw error
            const types = (data || []).map((type) => ({
                id: type.id,
                name: type.name,
                priority: type.priority,
            })) as CustomerTypeSummary[]
            setCustomerTypes(types)
            console.log("✅ [CustomersListPage] Loaded customer types:", types)
        } catch (error) {
            console.error("❌ [CustomersListPage] Failed to load customer types:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את סוגי הלקוחות",
                variant: "destructive",
            })
        } finally {
            setIsLoadingTypes(false)
        }
    }

    const fetchCustomers = async () => {
        try {
            setIsLoading(true)
            console.log("🔍 [CustomersListPage] Fetching customers with filters:", { searchTerm })
            let query = supabase
                .from("customers")
                .select(`
                    *,
                    customer_type:customer_types(id, name, priority),
                    treatments:treatments(id, name, treatment_type_id, treatmentType:treatmentTypes(id, name))
                `)
                .order("created_at", { ascending: false })

            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
            }

            const { data, error } = await query

            if (error) throw error
            setCustomers(data || [])
        } catch (error) {
            console.error("Error fetching customers:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את הלקוחות",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Search functions for autocomplete
    const searchCustomerNames = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("customers")
            .select("full_name")
            .not("full_name", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("full_name", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("full_name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.full_name).filter(Boolean))] as string[]
    }

    const searchCustomerPhones = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("customers")
            .select("phone")
            .not("phone", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("phone", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("phone", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.phone).filter(Boolean))] as string[]
    }

    const searchCustomerEmails = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("customers")
            .select("email")
            .not("email", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("email", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("email", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.email).filter(Boolean))] as string[]
    }

    const searchTreatmentNames = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("treatments")
            .select("name")
            .not("name", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("name", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(d => d.name).filter(Boolean))] as string[]
    }

    const searchTreatmentTypes = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("treatmentTypes")
            .select("name")
            .not("name", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("name", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(b => b.name).filter(Boolean))] as string[]
    }

    // Filter customers based on all criteria
    const filteredCustomers = customers.filter((customer) => {
        // Customer type filter
        if (customerTypeFilter === "none") {
            if (customer.customer_type_id) {
                return false
            }
        } else if (customerTypeFilter !== "all" && customer.customer_type_id !== customerTypeFilter) {
            return false
        }

        // Phone filter
        if (phoneFilter && !customer.phone?.includes(phoneFilter)) {
            return false
        }

        // Email filter
        if (emailFilter && !customer.email?.toLowerCase().includes(emailFilter.toLowerCase())) {
            return false
        }

        // Name filter
        if (nameFilter && !customer.full_name?.toLowerCase().includes(nameFilter.toLowerCase())) {
            return false
        }

        // Treatment name filter
        if (treatmentNameFilter) {
            const hasMatchingTreatment = customer.treatments?.some((treatment: any) =>
                treatment.name?.toLowerCase().includes(treatmentNameFilter.toLowerCase())
            )
            if (!hasMatchingTreatment) return false
        }

        // TreatmentType filter
        if (treatmentTypeFilter) {
            const hasMatchingTreatmentType = customer.treatments?.some((treatment: any) =>
                treatment.treatmentType?.name?.toLowerCase().includes(treatmentTypeFilter.toLowerCase())
            )
            if (!hasMatchingTreatmentType) return false
        }

        return true
    })

    const selectedCount = selectedCustomerIds.length
    const isAllSelected = filteredCustomers.length > 0 && selectedCount === filteredCustomers.length
    const isPartiallySelected = selectedCount > 0 && !isAllSelected
    const disableSelection = isLoading || isBulkActionLoading || isSaving
    const disableBulkButtons = selectedCount === 0 || isBulkActionLoading

    const clearSelection = () => {
        setSelectedCustomerIds([])
        setLastSelectedIndex(null)
    }

    const handleSelectAllChange = (value: boolean | "indeterminate") => {
        const isChecked = value === true
        if (isChecked) {
            const ids = filteredCustomers.map((customer) => customer.id)
            setSelectedCustomerIds(ids)
            if (ids.length > 0) {
                setLastSelectedIndex(ids.length - 1)
            }
        } else {
            clearSelection()
        }
    }

    const handleCheckboxPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        shiftPressedRef.current = event.shiftKey || shiftKeyHeldRef.current
    }

    const handleCheckboxPointerUpOrLeave = () => {
        shiftPressedRef.current = false
    }

    const handleCustomerSelectionChange = (customerId: string, isChecked: boolean, index: number) => {
        setSelectedCustomerIds((prev) => {
            const selectionSet = new Set(prev)
            const applyIds = (ids: string[]) => {
                if (isChecked) {
                    ids.forEach((id) => selectionSet.add(id))
                } else {
                    ids.forEach((id) => selectionSet.delete(id))
                }
            }

            const isShiftSelection = (shiftPressedRef.current || shiftKeyHeldRef.current) && lastSelectedIndex !== null && lastSelectedIndex !== index

            if (isShiftSelection) {
                const start = Math.min(lastSelectedIndex!, index)
                const end = Math.max(lastSelectedIndex!, index)
                const rangeIds = filteredCustomers.slice(start, end + 1).map((customer) => customer.id)
                applyIds(rangeIds)
            } else {
                applyIds([customerId])
            }

            return filteredCustomers.map((customer) => customer.id).filter((id) => selectionSet.has(id))
        })

        if (isChecked) {
            setLastSelectedIndex(index)
        } else if (!shiftPressedRef.current) {
            setLastSelectedIndex(null)
        }

        shiftPressedRef.current = false
    }

    const prepareAssignTypeDialog = () => {
        if (selectedCount === 0) return
        console.log("🪪 [CustomersListPage] Opening bulk assign type dialog", {
            selectedCount,
            selectedCustomerIds,
        })
        const selectedCustomers = customers.filter((customer) => selectedCustomerIds.includes(customer.id))
        const firstTypeId = selectedCustomers[0]?.customer_type_id ?? null
        const allSameType = selectedCustomers.every((customer) => customer.customer_type_id === firstTypeId)
        const defaultTypeValue = allSameType ? (firstTypeId ?? "none") : null

        setSelectedTypeForBulk(defaultTypeValue)
        setIsAssignTypeDialogOpen(true)
    }

    const handleBulkAssignType = async () => {
        if (selectedCount === 0) return
        if (!selectedTypeForBulk) {
            toast({
                title: "שגיאה",
                description: "בחר סוג לקוח לפני המשך העדכון",
                variant: "destructive",
            })
            return
        }

        const targetTypeId = selectedTypeForBulk === "none" ? null : selectedTypeForBulk
        console.log("🪪 [CustomersListPage] Bulk assign customer type initiated", {
            selectedCount,
            selectedCustomerIds,
            targetTypeId,
        })

        try {
            setCurrentBulkAction("assignType")
            setIsBulkActionLoading(true)

            const { error } = await supabase
                .from("customers")
                .update({ customer_type_id: targetTypeId })
                .in("id", selectedCustomerIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: targetTypeId
                    ? "סוג הלקוח עודכן לכל הבחירות"
                    : "הסוג הוסר מכל הלקוחות שנבחרו",
            })

            setIsAssignTypeDialogOpen(false)
            clearSelection()
            fetchCustomers()
        } catch (error) {
            console.error("❌ [CustomersListPage] Bulk assign customer type failed:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את סוג הלקוחות",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const handleBulkDelete = async () => {
        if (selectedCount === 0) return

        console.log("🗑️ [CustomersListPage] Bulk delete initiated", {
            selectedCount,
            selectedCustomerIds,
        })

        try {
            setCurrentBulkAction("delete")
            setIsBulkActionLoading(true)

            const { error } = await supabase
                .from("customers")
                .delete()
                .in("id", selectedCustomerIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `${selectedCount} לקוחות נמחקו בהצלחה`,
            })

            clearSelection()
            fetchCustomers()
        } catch (error) {
            console.error("❌ [CustomersListPage] Bulk delete failed:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה למחוק את הלקוחות הנבחרים",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
            setIsBulkDeleteDialogOpen(false)
        }
    }

    const prepareReceiptUpdate = (shouldSend: boolean) => {
        if (selectedCount === 0) return
        console.log("🧾 [CustomersListPage] Preparing bulk receipt update dialog", {
            selectedCount,
            selectedCustomerIds,
            shouldSend,
        })
        setPendingReceiptUpdate(shouldSend)
    }

    const openBulkDeleteDialog = () => {
        if (selectedCount === 0) return
        console.log("🗑️ [CustomersListPage] Opening bulk delete confirmation dialog", {
            selectedCount,
            selectedCustomerIds,
        })
        setIsBulkDeleteDialogOpen(true)
    }

    const handleBulkUpdateReceipt = async (shouldSend: boolean) => {
        if (selectedCount === 0) return

        console.log("🧾 [CustomersListPage] Bulk update receipt preference initiated", {
            selectedCount,
            selectedCustomerIds,
            shouldSend,
        })

        try {
            setCurrentBulkAction(shouldSend ? "enableReceipt" : "disableReceipt")
            setIsBulkActionLoading(true)

            const { error } = await supabase
                .from("customers")
                .update({ send_invoice: shouldSend })
                .in("id", selectedCustomerIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: shouldSend
                    ? "כל הלקוחות שנבחרו יסומנו לשליחת חשבונית"
                    : "שליחת החשבונית בוטלה לכל הלקוחות שנבחרו",
            })

            clearSelection()
            fetchCustomers()
        } catch (error) {
            console.error("❌ [CustomersListPage] Bulk update receipt preference failed:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את העדפת שליחת החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
            setPendingReceiptUpdate(null)
        }
    }

    // Handle customer click to open sheet
    const handleCustomerClick = async (customer: Customer) => {
        // Fetch all treatments for this customer
        const { data: treatmentsData, error } = await supabase
            .from("treatments")
            .select(`
                *,
                treatmentType:treatmentTypes(id, name)
            `)
            .eq("customer_id", customer.id)

        if (error) {
            console.error("Error fetching customer treatments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את כלבי הלקוח",
                variant: "destructive",
            })
            return
        }

        // Transform treatments to ManagerTreatment format
        const managerTreatments: ManagerTreatment[] = (treatmentsData || []).map((treatment: any) => ({
            id: treatment.id,
            name: treatment.name,
            treatmentType: treatment.treatmentType?.name,
            clientName: customer.full_name,
            clientClassification: customer.classification,
            gender: treatment.gender === 'male' ? 'זכר' : 'נקבה',
            healthIssues: treatment.health_notes,
            vetName: treatment.vet_name,
            vetPhone: treatment.vet_phone,
            birthDate: treatment.birth_date,
            internalNotes: treatment.staff_notes,
        }))

        setClientTreatments(managerTreatments)

        const clientDetails = {
            name: customer.full_name,
            phone: customer.phone,
            email: customer.email || undefined,
            classification: customer.classification,
            customerTypeName: customer.customer_type?.name,
            address: customer.address || undefined,
        }
        setSelectedClientForSheet(clientDetails)
        setIsClientDetailsOpen(true)
    }

    // Handle treatment click from client sheet
    const handleTreatmentClick = (treatment: ManagerTreatment) => {
        const treatmentDetails = {
            id: treatment.id,
            name: treatment.name,
            treatmentType: treatment.treatmentType,
            clientClassification: treatment.clientClassification,
            owner: selectedClientForSheet ? {
                name: selectedClientForSheet.name,
                phone: selectedClientForSheet.phone,
                email: selectedClientForSheet.email,
                customerTypeName: selectedClientForSheet.customerTypeName,
            } : undefined,
            gender: treatment.gender,
            healthIssues: treatment.healthIssues,
            vetName: treatment.vetName,
            vetPhone: treatment.vetPhone,
            birthDate: treatment.birthDate,
            internalNotes: treatment.internalNotes,
        }
        setSelectedTreatmentForSheet(treatmentDetails)
        setIsTreatmentDetailsOpen(true)
        setIsClientDetailsOpen(false)
    }

    // Handle client click from treatment sheet
    const handleClientClickFromTreatment = (client: {
        name?: string
        phone?: string
        email?: string
        customerTypeName?: string
    }) => {
        // Reopen client sheet
        const clientDetails = {
            name: client.name,
            phone: client.phone,
            email: client.email,
            classification: "existing",
            customerTypeName: client.customerTypeName,
        }
        setSelectedClientForSheet(clientDetails)
        setIsClientDetailsOpen(true)
        setIsTreatmentDetailsOpen(false)
    }

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchCustomers()
        }, 300)

        return () => clearTimeout(debounce)
    }, [searchTerm])

    const handleAdd = () => {
        setIsAddDialogOpen(true)
    }

    const handleEdit = (customer: Customer) => {
        setEditingCustomerId(customer.id)
        setIsEditDialogOpen(true)
    }

    const handleAddSuccess = () => {
        setIsAddDialogOpen(false)
        fetchCustomers()
    }

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false)
        setEditingCustomerId(null)
        fetchCustomers()
    }

    const handleDelete = async () => {
        if (!customerToDelete) return

        try {
            setIsSaving(true)
            const { error } = await supabase
                .from("customers")
                .delete()
                .eq("id", customerToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הלקוח נמחק בהצלחה",
            })

            setIsDeleteDialogOpen(false)
            setCustomerToDelete(null)
            fetchCustomers()
        } catch (error: any) {
            console.error("Error deleting customer:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן למחוק את הלקוח",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const getClassificationLabel = (classification: Customer['classification']) => {
        const labels = {
            new: "חדש",
            existing: "קיים",
            vip: "VIP",
            extra_vip: "VIP מועדף",
        }
        return labels[classification]
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>לקוחות</CardTitle>
                            <CardDescription>רשימת כל הלקוחות במערכת</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="חפש לקוחות..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-10 w-64"
                                    dir="rtl"
                                />
                            </div>
                            <Button onClick={handleAdd}>
                                <Plus className="h-4 w-4 ml-2" />
                                הוסף לקוח
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">שם לקוח</Label>
                                <AutocompleteFilter
                                    value={nameFilter}
                                    onChange={setNameFilter}
                                    placeholder="שם לקוח..."
                                    searchFn={searchCustomerNames}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">טלפון</Label>
                                <AutocompleteFilter
                                    value={phoneFilter}
                                    onChange={setPhoneFilter}
                                    placeholder="טלפון..."
                                    searchFn={searchCustomerPhones}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">אימייל</Label>
                                <AutocompleteFilter
                                    value={emailFilter}
                                    onChange={setEmailFilter}
                                    placeholder="אימייל..."
                                    searchFn={searchCustomerEmails}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">סוג לקוח (מותאם)</Label>
                                <Select value={customerTypeFilter} onValueChange={handleCustomerTypeFilterChange} disabled={isLoadingTypes}>
                                    <SelectTrigger dir="rtl">
                                        <SelectValue placeholder={isLoadingTypes ? "טוען..." : "בחר סוג"} />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">הכל</SelectItem>
                                        <SelectItem value="none">ללא סוג</SelectItem>
                                        {customerTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">שם כלב</Label>
                                <AutocompleteFilter
                                    value={treatmentNameFilter}
                                    onChange={setTreatmentNameFilter}
                                    placeholder="שם כלב..."
                                    searchFn={searchTreatmentNames}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">גזע</Label>
                                <AutocompleteFilter
                                    value={treatmentTypeFilter}
                                    onChange={setTreatmentTypeFilter}
                                    placeholder="גזע..."
                                    searchFn={searchTreatmentTypes}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                        </div>
                        {(customerTypeFilter !== "all" || phoneFilter || emailFilter || nameFilter || treatmentNameFilter || treatmentTypeFilter) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCustomerTypeFilter("all")
                                    setPhoneFilter("")
                                    setEmailFilter("")
                                    setNameFilter("")
                                    setTreatmentNameFilter("")
                                    setTreatmentTypeFilter("")
                                }}
                            >
                                נקה כל הסינונים
                            </Button>
                        )}
                        {(selectedCount > 0) && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="flex flex-col text-right text-blue-900">
                                    <span className="text-sm font-semibold">נבחרו {selectedCount} לקוחות</span>
                                    <span className="text-xs text-blue-800/80">באפשרותך לבצע פעולות מרובות על כל הלקוחות שנבחרו</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSelection}
                                        disabled={disableSelection}
                                    >
                                        בטל בחירה
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={prepareAssignTypeDialog}
                                        disabled={disableBulkButtons}
                                    >
                                        {currentBulkAction === "assignType" && isBulkActionLoading && (
                                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        )}
                                        הקצה סוג לקוח
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => prepareReceiptUpdate(true)}
                                        disabled={disableBulkButtons}
                                    >
                                        {currentBulkAction === "enableReceipt" && isBulkActionLoading && (
                                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        )}
                                        סמן לשליחת חשבונית
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => prepareReceiptUpdate(false)}
                                        disabled={disableBulkButtons}
                                    >
                                        {currentBulkAction === "disableReceipt" && isBulkActionLoading && (
                                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        )}
                                        בטל שליחת חשבונית
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={openBulkDeleteDialog}
                                        disabled={disableBulkButtons}
                                    >
                                        {currentBulkAction === "delete" && isBulkActionLoading && (
                                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        )}
                                        מחק לקוחות
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="rounded-md border">
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar relative">
                            <Table containerClassName="[direction:rtl] !overflow-visible">
                                <TableHeader>
                                    <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[hsl(228_36%_95%)]">
                                    <TableHead className="w-12 p-0 text-center align-middle font-medium text-primary font-semibold">
                                        <div className="flex h-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                checked={isAllSelected}
                                                indeterminate={isPartiallySelected}
                                                onPointerDownCapture={handleCheckboxPointerDown}
                                                onPointerUp={handleCheckboxPointerUpOrLeave}
                                                onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                onCheckedChange={handleSelectAllChange}
                                                aria-label="בחר את כל הלקוחות במסך הנוכחי"
                                                disabled={filteredCustomers.length === 0 || disableSelection}
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">שם מלא</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">טלפון</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">אימייל</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">סיווג</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">סוג מותאם</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">כתובת</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">שלח חשבונית</TableHead>
                                    <TableHead className="text-right align-middle font-medium text-primary font-semibold">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                            לא נמצאו לקוחות
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCustomers.map((customer, index) => (
                                        <TableRow
                                            key={customer.id}
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => handleCustomerClick(customer)}
                                        >
                                            <TableCell className="w-12 p-0 align-middle text-center" onClick={(event) => event.stopPropagation()}>
                                                <div className="flex h-full items-center justify-center">
                                                    <Checkbox
                                                        checked={selectedCustomerIds.includes(customer.id)}
                                                        onPointerDownCapture={handleCheckboxPointerDown}
                                                        onPointerUp={handleCheckboxPointerUpOrLeave}
                                                        onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onCheckedChange={(value) => handleCustomerSelectionChange(customer.id, value === true, index)}
                                                        aria-label={`בחר את הלקוח ${customer.full_name || ""}`}
                                                        disabled={disableSelection}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>{customer.full_name}</TableCell>
                                            <TableCell>{customer.phone}</TableCell>
                                            <TableCell>{customer.email || "-"}</TableCell>
                                            <TableCell>{getClassificationLabel(customer.classification)}</TableCell>
                                            <TableCell>{customer.customer_type?.name || "ללא סוג"}</TableCell>
                                            <TableCell>{customer.address || "-"}</TableCell>
                                            <TableCell>{customer.send_invoice ? "כן" : "לא"}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEdit(customer)
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setCustomerToDelete(customer)
                                                            setIsDeleteDialogOpen(true)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Add Customer Dialog */}
            <AddCustomerDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onSuccess={handleAddSuccess}
            />

            {/* Edit Customer Dialog */}
            <EditCustomerDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                customerId={editingCustomerId}
                onSuccess={handleEditSuccess}
            />

            <BulkCustomersDeleteDialog
                open={isBulkDeleteDialogOpen}
                onOpenChange={setIsBulkDeleteDialogOpen}
                count={selectedCount}
                isProcessing={isBulkActionLoading && currentBulkAction === "delete"}
                onConfirm={handleBulkDelete}
            />

            <BulkAssignCustomerTypeDialog
                open={isAssignTypeDialogOpen}
                onOpenChange={(open) => {
                    setIsAssignTypeDialogOpen(open)
                    if (!open) {
                        setSelectedTypeForBulk(null)
                    }
                }}
                selectedType={selectedTypeForBulk}
                onSelectedTypeChange={setSelectedTypeForBulk}
                customerTypes={customerTypes}
                isProcessing={isBulkActionLoading && currentBulkAction === "assignType"}
                onConfirm={handleBulkAssignType}
            />

            <BulkReceiptPreferenceDialog
                open={pendingReceiptUpdate !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingReceiptUpdate(null)
                    }
                }}
                count={selectedCount}
                shouldSend={pendingReceiptUpdate ?? false}
                isProcessing={
                    isBulkActionLoading &&
                    (currentBulkAction === "enableReceipt" || currentBulkAction === "disableReceipt")
                }
                onConfirm={() => {
                    if (pendingReceiptUpdate !== null) {
                        handleBulkUpdateReceipt(pendingReceiptUpdate)
                    }
                }}
            />

            <CustomerDeleteConfirmationDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                customerName={customerToDelete?.full_name}
                isProcessing={isSaving}
                onConfirm={handleDelete}
            />

            {/* Client Details Sheet */}
            <ClientDetailsSheet
                open={isClientDetailsOpen}
                onOpenChange={setIsClientDetailsOpen}
                selectedClient={selectedClientForSheet}
                data={{
                    appointments: clientTreatments.map(treatment => ({
                        id: `dummy-${treatment.id}`,
                        treatments: [treatment],
                        clientName: selectedClientForSheet?.name,
                        clientClassification: selectedClientForSheet?.classification,
                    })),
                }}
                onTreatmentClick={handleTreatmentClick}
            />

            {/* Treatment Details Sheet */}
            <TreatmentDetailsSheet
                open={isTreatmentDetailsOpen}
                onOpenChange={setIsTreatmentDetailsOpen}
                selectedTreatment={selectedTreatmentForSheet}
                showAllPastAppointments={false}
                setShowAllPastAppointments={() => { }}
                data={{}}
                onClientClick={handleClientClickFromTreatment}
                onAppointmentClick={() => { }}
                onShowTreatmentAppointments={() => { }}
            />
        </div>
    )
}
