import { useState, useEffect, useMemo, useRef } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { TreatmentDetailsSheet, ClientDetailsSheet } from "@/pages/ManagerSchedule/sheets/index"
import type { ManagerTreatment } from "@/types/managerSchedule"
import { AddTreatmentDialog } from "@/components/AddTreatmentDialog"
import { EditTreatmentDialog } from "@/components/EditTreatmentDialog"
import { AddTreatmentCustomerModal } from "@/components/dialogs/AddTreatmentCustomerModal"
import { TreatmentBulkAssignTreatmentTypeDialog } from "@/components/treatments/TreatmentBulkAssignTypeDialog"
import { TreatmentBulkAssignGenderDialog } from "@/components/treatments/TreatmentBulkAssignPreferenceDialog"
import { TreatmentBulkAssignCustomerDialog } from "@/components/treatments/TreatmentBulkAssignClientDialog"

interface Treatment {
    id: string
    name: string
    customer_id: string
    treatment_type_id: string | null
    gender: 'male' | 'female'
    birth_date: string | null
    health_notes: string | null
    vet_name: string | null
    vet_phone: string | null
    staff_notes: string | null

    aggression_risk: boolean | null
    people_anxious: boolean | null
    created_at: string
    customer?: {
        id: string
        full_name: string
        phone?: string | null
        email?: string | null
        customer_type?: {
            id: string
            name: string
        } | null
    }
    treatmentType?: {
        id: string
        name: string
        size_class: string | null
    }
    treatment_types?: Array<{ id: string; name: string }>
    treatment_categories?: Array<{ id: string; name: string }>
}

interface Customer {
    id: string
    full_name: string
    phone?: string | null
}

interface TreatmentType {
    id: string
    name: string
}

export default function TreatmentsListPage() {
    const { toast } = useToast()
    const [searchParams] = useSearchParams()
    const [treatments, setTreatments] = useState<Treatment[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([])
    const [treatmentCategories, setTreatmentCategories] = useState<Array<{ id: string; name: string }>>([])
    const [customerTypes, setCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [treatmentToDelete, setTreatmentToDelete] = useState<Treatment | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<string[]>([])
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const shiftPressedRef = useRef(false)
    const shiftKeyHeldRef = useRef(false)
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
    const [currentBulkAction, setCurrentBulkAction] = useState<"assignTreatmentType" | "assignGender" | "assignCustomer" | null>(null)
    const [isTreatmentTypeDialogOpen, setIsTreatmentTypeDialogOpen] = useState(false)
    const [isGenderDialogOpen, setIsGenderDialogOpen] = useState(false)
    const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
    const [pageSize, setPageSize] = useState(50)
    const [currentPage, setCurrentPage] = useState(1)
    const appliedCategoryFromUrlRef = useRef({ category1: false, category2: false })
    const pageSizeOptions = [25, 50, 100]

    // Filter states
    const [ownerNameFilter, setOwnerNameFilter] = useState("")
    const [ownerPhoneFilter, setOwnerPhoneFilter] = useState("")
    const [ownerEmailFilter, setOwnerEmailFilter] = useState("")
    const [treatmentTypeFilter, setTreatmentTypeFilter] = useState("")
    const [sizeFilter, setSizeFilter] = useState<string>("all")
    const [category1Filter, setCategory1Filter] = useState("")
    const [category2Filter, setCategory2Filter] = useState("")
    const [ownerCategoryFilter, setOwnerCategoryFilter] = useState<string>("all")

    // Sheet states
    const [isTreatmentDetailsOpen, setIsTreatmentDetailsOpen] = useState(false)
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false)
    const [selectedTreatmentForSheet, setSelectedTreatmentForSheet] = useState<any>(null)
    const [selectedClientForSheet, setSelectedClientForSheet] = useState<any>(null)
    const [showAllPastAppointments, setShowAllPastAppointments] = useState(false)

    useEffect(() => {
        fetchTreatments()
        fetchCustomers()
        fetchTreatmentTypes()
        fetchTreatmentCategories()
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

    const fetchTreatmentTypes = async () => {
        try {
            const { data, error } = await supabase
                .from("treatment_types")
                .select("id, name")
                .order("name")

            if (error) throw error
            setTreatmentTypes(data || [])
        } catch (error) {
            console.error("Error fetching treatment types:", error)
        }
    }

    const fetchTreatmentCategories = async () => {
        try {
            const { data, error } = await supabase
                .from("treatment_categories")
                .select("id, name")
                .order("name")

            if (error) throw error
            setTreatmentCategories(data || [])
        } catch (error) {
            console.error("Error fetching treatment categories:", error)
        }
    }

    const fetchCustomerTypes = async () => {
        try {
            const { data, error } = await supabase
                .from("customer_types")
                .select("id, name")
                .order("priority")

            if (error) throw error
            setCustomerTypes(data || [])
        } catch (error) {
            console.error("Error fetching customer types:", error)
        }
    }

    const category1IdParam = searchParams.get("category1Id")
    const category2IdParam = searchParams.get("category2Id")

    useEffect(() => {
        if (!treatmentTypes.length || !category1IdParam || appliedCategoryFromUrlRef.current.category1) {
            return
        }
        const match = treatmentTypes.find((type) => type.id === category1IdParam)
        if (match) {
            setCategory1Filter(match.name)
            appliedCategoryFromUrlRef.current.category1 = true
        }
    }, [category1IdParam, treatmentTypes])

    useEffect(() => {
        if (!treatmentCategories.length || !category2IdParam || appliedCategoryFromUrlRef.current.category2) {
            return
        }
        const match = treatmentCategories.find((category) => category.id === category2IdParam)
        if (match) {
            setCategory2Filter(match.name)
            appliedCategoryFromUrlRef.current.category2 = true
        }
    }, [category2IdParam, treatmentCategories])

    useEffect(() => {
        setSelectedTreatmentIds((prev) => prev.filter((id) => treatments.some((treatment) => treatment.id === id)))
    }, [treatments])

    useEffect(() => {
        if (selectedTreatmentIds.length === 0) {
            setLastSelectedIndex(null)
        }
    }, [selectedTreatmentIds])

    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from("customers")
                .select("id, full_name, phone")
                .order("full_name")

            if (error) throw error
            setCustomers(data || [])
        } catch (error) {
            console.error("Error fetching customers:", error)
        }
    }

    const fetchTreatments = async () => {
        try {
            setIsLoading(true)
            let query = supabase
                .from("treatments")
                .select(`
                    *,
                    customer:customers(id, full_name, phone, email, customer_type:customer_types(id, name)),
                    treatmentType:treatment_types(id, name, size_class)
                `)
                .order("created_at", { ascending: false })

            if (searchTerm) {
                query = query.ilike("name", `%${searchTerm}%`)
            }

            const { data, error } = await query

            if (error) throw error

            // Fetch category relationships for filtering
            const treatmentIds = (data || []).map(d => d.id)
            const [typesData, categoriesData] = await Promise.all([
                treatmentIds.length > 0
                    ? supabase
                        .from("treatmentType_treatment_types")
                        .select(`
                            treatment_type_id,
                            treatment_type_id,
                            treatment_type:treatment_types(id, name)
                        `)
                        .in("treatment_type_id", (data || []).filter(d => d.treatment_type_id).map(d => d.treatment_type_id))
                    : { data: [], error: null },
                treatmentIds.length > 0
                    ? supabase
                        .from("treatmentType_treatment_categories")
                        .select(`
                            treatment_type_id,
                            treatment_category_id,
                            treatment_category:treatment_categories(id, name)
                        `)
                        .in("treatment_type_id", (data || []).filter(d => d.treatment_type_id).map(d => d.treatment_type_id))
                    : { data: [], error: null }
            ])

            // Build category maps
            const typesByTreatmentType = new Map<string, any[]>()
            const categoriesByTreatmentType = new Map<string, any[]>()

                ; (typesData.data || []).forEach((row: any) => {
                    if (!typesByTreatmentType.has(row.treatment_type_id)) typesByTreatmentType.set(row.treatment_type_id, [])
                    if (row.treatment_type) typesByTreatmentType.get(row.treatment_type_id)!.push(row.treatment_type)
                })

                ; (categoriesData.data || []).forEach((row: any) => {
                    if (!categoriesByTreatmentType.has(row.treatment_type_id)) categoriesByTreatmentType.set(row.treatment_type_id, [])
                    if (row.treatment_category) categoriesByTreatmentType.get(row.treatment_type_id)!.push(row.treatment_category)
                })

            // Attach categories to treatments
            const treatmentsWithCategories = (data || []).map((treatment: any) => ({
                ...treatment,
                treatment_types: treatment.treatment_type_id ? (typesByTreatmentType.get(treatment.treatment_type_id) || []) : [],
                treatment_categories: treatment.treatment_type_id ? (categoriesByTreatmentType.get(treatment.treatment_type_id) || []) : [],
            }))

            setTreatments(treatmentsWithCategories)
        } catch (error) {
            console.error("Error fetching treatments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את הכלבים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Search functions for autocomplete
    const searchOwnerNames = async (searchTerm: string): Promise<string[]> => {
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

    const searchOwnerPhones = async (searchTerm: string): Promise<string[]> => {
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

    const searchOwnerEmails = async (searchTerm: string): Promise<string[]> => {
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

    const searchTreatmentTypes = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("treatment_types")
            .select("name")
            .not("name", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("name", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(t => t.name).filter(Boolean))] as string[]
    }

    const searchTreatmentCategories = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("treatment_categories")
            .select("name")
            .not("name", "is", null)

        if (trimmedTerm.length >= 2) {
            query = query.ilike("name", `%${trimmedTerm}%`).limit(10)
        } else {
            query = query.order("name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.name).filter(Boolean))] as string[]
    }

    // Filter treatments based on all criteria
    const filteredTreatments = treatments.filter((treatment) => {
        // Owner name filter
        if (ownerNameFilter && !treatment.customer?.full_name?.toLowerCase().includes(ownerNameFilter.toLowerCase())) {
            return false
        }

        // Owner phone filter
        if (ownerPhoneFilter && !treatment.customer?.phone?.includes(ownerPhoneFilter)) {
            return false
        }

        // Owner email filter
        if (ownerEmailFilter && !treatment.customer?.email?.toLowerCase().includes(ownerEmailFilter.toLowerCase())) {
            return false
        }

        // TreatmentType filter
        if (treatmentTypeFilter && !treatment.treatmentType?.name?.toLowerCase().includes(treatmentTypeFilter.toLowerCase())) {
            return false
        }

        if (ownerCategoryFilter !== "all") {
            const ownerTypeId = treatment.customer?.customer_type?.id
            if (!ownerTypeId || ownerTypeId !== ownerCategoryFilter) {
                return false
            }
        }

        // Size filter
        if (sizeFilter !== "all") {
            const treatmentTypeSize = treatment.treatmentType?.size_class
            if (sizeFilter === "none") {
                if (treatmentTypeSize !== null && treatmentTypeSize !== undefined) {
                    return false
                }
            } else if (treatmentTypeSize !== sizeFilter) {
                return false
            }
        }

        // Category 1 filter (treatment_types)
        if (category1Filter) {
            const hasCategory1 = treatment.treatment_types?.some((type: any) =>
                type.name?.toLowerCase().includes(category1Filter.toLowerCase())
            )
            if (!hasCategory1) return false
        }

        // Category 2 filter (treatment_categories)
        if (category2Filter) {
            const hasCategory2 = treatment.treatment_categories?.some((category: any) =>
                category.name?.toLowerCase().includes(category2Filter.toLowerCase())
            )
            if (!hasCategory2) return false
        }

        return true
    })

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, ownerNameFilter, ownerPhoneFilter, ownerEmailFilter, treatmentTypeFilter, sizeFilter, category1Filter, category2Filter, ownerCategoryFilter])

    useEffect(() => {
        const newTotalPages = Math.max(1, Math.ceil(filteredTreatments.length / pageSize)) || 1
        setCurrentPage((prev) => Math.min(prev, newTotalPages))
    }, [filteredTreatments.length, pageSize])

    const hasTreatments = filteredTreatments.length > 0
    const totalPages = hasTreatments ? Math.ceil(filteredTreatments.length / pageSize) : 1
    const safeCurrentPage = hasTreatments ? Math.min(currentPage, totalPages) : 1
    const pageStartIndex = hasTreatments ? (safeCurrentPage - 1) * pageSize : 0
    const paginatedTreatments = filteredTreatments.slice(pageStartIndex, pageStartIndex + pageSize)
    const pageDisplayStart = hasTreatments ? pageStartIndex + 1 : 0
    const pageDisplayEnd = hasTreatments ? pageStartIndex + paginatedTreatments.length : 0

    useEffect(() => {
        setSelectedTreatmentIds((prev) => {
            const filteredIds = new Set(filteredTreatments.map((treatment) => treatment.id))
            const next = prev.filter((id) => filteredIds.has(id))
            return next.length === prev.length ? prev : next
        })
    }, [filteredTreatments])

    const selectedTreatments = useMemo(() => treatments.filter((treatment) => selectedTreatmentIds.includes(treatment.id)), [treatments, selectedTreatmentIds])
    const selectedCount = selectedTreatments.length
    const isAllSelected = filteredTreatments.length > 0 && selectedCount === filteredTreatments.length
    const isPartiallySelected = selectedCount > 0 && !isAllSelected
    const disableSelection = isLoading || isSaving || isBulkActionLoading

    const clearSelection = () => {
        setSelectedTreatmentIds([])
        setLastSelectedIndex(null)
    }

    const handlePageSizeChange = (value: string) => {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) {
            setPageSize(parsed)
            setCurrentPage(1)
        }
    }

    const handlePreviousPage = () => {
        if (safeCurrentPage > 1) {
            setCurrentPage(safeCurrentPage - 1)
        }
    }

    const handleNextPage = () => {
        if (safeCurrentPage < totalPages) {
            setCurrentPage(safeCurrentPage + 1)
        }
    }

    const handleCheckboxPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        shiftPressedRef.current = event.shiftKey || shiftKeyHeldRef.current
    }

    const handleCheckboxPointerUpOrLeave = () => {
        shiftPressedRef.current = false
    }

    const handleSelectAllChange = (value: boolean | "indeterminate") => {
        if (value) {
            const ids = filteredTreatments.map((treatment) => treatment.id)
            setSelectedTreatmentIds(ids)
            if (ids.length > 0) {
                setLastSelectedIndex(ids.length - 1)
            }
        } else {
            clearSelection()
        }
    }

    const handleTreatmentSelectionChange = (treatmentId: string, isChecked: boolean, index: number) => {
        setSelectedTreatmentIds((prev) => {
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
                const rangeIds = filteredTreatments.slice(start, end + 1).map((treatment) => treatment.id)
                applyIds(rangeIds)
            } else {
                applyIds([treatmentId])
            }

            return filteredTreatments.map((treatment) => treatment.id).filter((id) => selectionSet.has(id))
        })

        if (isChecked) {
            setLastSelectedIndex(index)
        } else if (!shiftPressedRef.current) {
            setLastSelectedIndex(null)
        }

        shiftPressedRef.current = false
    }

    const handleBulkAssignTreatmentTypeConfirm = async (treatmentTypeName: string) => {
        if (selectedTreatmentIds.length === 0) return
        const trimmedName = treatmentTypeName.trim()
        if (!trimmedName) {
            toast({
                title: "שגיאה",
                description: "יש לבחור גזע תקין לפני העדכון.",
                variant: "destructive",
            })
            return
        }
        let treatmentTypeId = treatmentTypes.find((treatmentType) => treatmentType.name === trimmedName)?.id
        if (!treatmentTypeId) {
            const { data, error } = await supabase
                .from("treatment_types")
                .select("id, name")
                .eq("name", trimmedName)
                .maybeSingle()

            if (error || !data) {
                toast({
                    title: "שגיאה",
                    description: "לא נמצא גזע תואם לשם הנבחר.",
                    variant: "destructive",
                })
                return
            }

            treatmentTypeId = data.id
            setTreatmentTypes((prev) => {
                if (prev.some((treatmentType) => treatmentType.id === data.id)) {
                    return prev
                }
                return [...prev, { id: data.id, name: trimmedName }]
            })
        }

        console.log("🐾 [TreatmentsListPage] Bulk assign treatmentType", { treatmentTypeId, treatmentTypeName: trimmedName, selectedTreatmentIds, selectedCount })
        try {
            setCurrentBulkAction("assignTreatmentType")
            setIsBulkActionLoading(true)
            const { error } = await supabase
                .from("treatments")
                .update({ treatment_type_id: treatmentTypeId })
                .in("id", selectedTreatmentIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `הגזע עודכן עבור ${selectedCount} כלבים.`,
            })
            setIsTreatmentTypeDialogOpen(false)
            clearSelection()
            await fetchTreatments()
        } catch (error) {
            console.error("❌ [TreatmentsListPage] Failed bulk assigning treatmentType", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את הגזע לכלבים שנבחרו.",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const handleBulkAssignGenderConfirm = async (gender: "male" | "female") => {
        if (selectedTreatmentIds.length === 0) return
        console.log("🐾 [TreatmentsListPage] Bulk assign gender", { gender, selectedTreatmentIds, selectedCount })
        try {
            setCurrentBulkAction("assignGender")
            setIsBulkActionLoading(true)
            const { error } = await supabase
                .from("treatments")
                .update({ gender })
                .in("id", selectedTreatmentIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `המין עודכן עבור ${selectedCount} כלבים.`,
            })
            setIsGenderDialogOpen(false)
            clearSelection()
            await fetchTreatments()
        } catch (error) {
            console.error("❌ [TreatmentsListPage] Failed bulk assigning gender", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את המין לכלבים שנבחרו.",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    const handleBulkAssignCustomerConfirm = async (customerId: string) => {
        if (selectedTreatmentIds.length === 0) return
        console.log("🐾 [TreatmentsListPage] Bulk assign customer", { customerId, selectedTreatmentIds, selectedCount })
        try {
            setCurrentBulkAction("assignCustomer")
            setIsBulkActionLoading(true)
            const { error } = await supabase
                .from("treatments")
                .update({ customer_id: customerId })
                .in("id", selectedTreatmentIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `הלקוח עודכן עבור ${selectedCount} כלבים.`,
            })
            setIsCustomerDialogOpen(false)
            clearSelection()
            await fetchTreatments()
        } catch (error) {
            console.error("❌ [TreatmentsListPage] Failed bulk assigning customer", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן היה לעדכן את הלקוח לכלבים שנבחרו.",
                variant: "destructive",
            })
        } finally {
            setIsBulkActionLoading(false)
            setCurrentBulkAction(null)
        }
    }

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchTreatments()
        }, 300)

        return () => clearTimeout(debounce)
    }, [searchTerm])

    // Handle treatment click to open sheet
    const handleTreatmentClick = (treatment: Treatment) => {
        const treatmentDetails = {
            id: treatment.id,
            name: treatment.name,
            treatmentType: treatment.treatmentType?.name,
            clientClassification: treatment.customer ? "existing" : undefined,
            owner: treatment.customer ? {
                name: treatment.customer.full_name,
                phone: treatment.customer.phone,
                email: treatment.customer.email || undefined,
            } : undefined,
            gender: treatment.gender === 'male' ? 'זכר' : 'נקבה',
            healthIssues: treatment.health_notes || undefined,
            vetName: treatment.vet_name || undefined,
            vetPhone: treatment.vet_phone || undefined,
            birthDate: treatment.birth_date || undefined,
            internalNotes: treatment.staff_notes || undefined,
        }
        setSelectedTreatmentForSheet(treatmentDetails)
        setIsTreatmentDetailsOpen(true)
    }

    // Handle client click from treatment sheet
    const handleClientClick = (client: any) => {
        const clientDetails = {
            name: client.name,
            phone: client.phone,
            email: client.email,
            classification: "existing",
        }
        setSelectedClientForSheet(clientDetails)
        setIsClientDetailsOpen(true)
        setIsTreatmentDetailsOpen(false)
    }

    const handleAdd = () => {
        // Open the customer selection modal first
        setIsCustomerModalOpen(true)
    }

    const handleEdit = (treatment: Treatment) => {
        setEditingTreatmentId(treatment.id)
        setIsEditDialogOpen(true)
    }

    const handleCustomerModalSuccess = () => {
        // Refresh the treatments list after a treatment is created via the customer modal
        fetchTreatments()
    }

    const handleAddSuccess = () => {
        setIsAddDialogOpen(false)
        setSelectedCustomerId(null)
        fetchTreatments()
    }

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false)
        setEditingTreatmentId(null)
        fetchTreatments()
    }

    const handleDelete = async () => {
        if (!treatmentToDelete) return

        try {
            setIsSaving(true)
            const { error } = await supabase
                .from("treatments")
                .delete()
                .eq("id", treatmentToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הכלב נמחק בהצלחה",
            })

            setIsDeleteDialogOpen(false)
            setTreatmentToDelete(null)
            await fetchTreatments()
        } catch (error: any) {
            console.error("Error deleting treatment:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן למחוק את הכלב",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const getGenderLabel = (gender: Treatment['gender']) => {
        return gender === 'male' ? 'זכר' : 'נקבה'
    }

    const getSizeLabel = (sizeClass: string | null | undefined) => {
        if (!sizeClass) return 'לא צוין'
        const sizeMap: Record<string, string> = {
            'small': 'קטן',
            'medium': 'בינוני',
            'medium_large': 'בינוני-גדול',
            'large': 'גדול'
        }
        return sizeMap[sizeClass] || sizeClass
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
                            <CardTitle>כלבים</CardTitle>
                            <CardDescription>רשימת כל הכלבים במערכת</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="חפש כלבים..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-10 w-64"
                                    dir="rtl"
                                />
                            </div>
                            <Button onClick={handleAdd}>
                                <Plus className="h-4 w-4 ml-2" />
                                הוסף כלב
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">שם בעלים</Label>
                                <AutocompleteFilter
                                    value={ownerNameFilter}
                                    onChange={setOwnerNameFilter}
                                    placeholder="שם בעלים..."
                                    searchFn={searchOwnerNames}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">טלפון בעלים</Label>
                                <AutocompleteFilter
                                    value={ownerPhoneFilter}
                                    onChange={setOwnerPhoneFilter}
                                    placeholder="טלפון בעלים..."
                                    searchFn={searchOwnerPhones}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">אימייל בעלים</Label>
                                <AutocompleteFilter
                                    value={ownerEmailFilter}
                                    onChange={setOwnerEmailFilter}
                                    placeholder="אימייל בעלים..."
                                    searchFn={searchOwnerEmails}
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">קטגוריית בעלים</Label>
                                <Select value={ownerCategoryFilter} onValueChange={setOwnerCategoryFilter}>
                                    <SelectTrigger dir="rtl">
                                        <SelectValue placeholder="בחר קטגוריה" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">הכל</SelectItem>
                                        {customerTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">גודל</Label>
                                <div className="relative">
                                    <Select value={sizeFilter} onValueChange={setSizeFilter}>
                                        <SelectTrigger dir="rtl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent dir="rtl">
                                            <SelectItem value="all">הכל</SelectItem>
                                            <SelectItem value="small">קטן</SelectItem>
                                            <SelectItem value="medium">בינוני</SelectItem>
                                            <SelectItem value="medium_large">בינוני-גדול</SelectItem>
                                            <SelectItem value="large">גדול</SelectItem>
                                            <SelectItem value="none">לא צוין</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {sizeFilter !== "all" && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                e.preventDefault()
                                                setSizeFilter("all")
                                            }}
                                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                                            title="נקה בחירה"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">קטגוריה 1</Label>
                                <AutocompleteFilter
                                    value={category1Filter}
                                    onChange={setCategory1Filter}
                                    placeholder="קטגוריה 1..."
                                    searchFn={searchTreatmentTypes}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">קטגוריה 2</Label>
                                <AutocompleteFilter
                                    value={category2Filter}
                                    onChange={setCategory2Filter}
                                    placeholder="קטגוריה 2..."
                                    searchFn={searchTreatmentCategories}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                        </div>
                        {(ownerNameFilter || ownerPhoneFilter || ownerEmailFilter || treatmentTypeFilter || sizeFilter !== "all" || category1Filter || category2Filter || ownerCategoryFilter !== "all") && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setOwnerNameFilter("")
                                    setOwnerPhoneFilter("")
                                    setOwnerEmailFilter("")
                                    setTreatmentTypeFilter("")
                                    setSizeFilter("all")
                                    setCategory1Filter("")
                                    setCategory2Filter("")
                                    setOwnerCategoryFilter("all")
                                }}
                            >
                                נקה כל הסינונים
                            </Button>
                        )}
                    </div>
                    {selectedCount > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <div className="flex flex-col text-right text-blue-900">
                                <span className="text-sm font-semibold">נבחרו {selectedCount} כלבים</span>
                                <span className="text-xs text-blue-800/80">בצע פעולות מרובות על כל הכלבים שנבחרו</span>
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
                                    onClick={() => setIsTreatmentTypeDialogOpen(true)}
                                    disabled={disableSelection}
                                >
                                    {currentBulkAction === "assignTreatmentType" && isBulkActionLoading && (
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    )}
                                    הקצה גזע
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsGenderDialogOpen(true)}
                                    disabled={disableSelection}
                                >
                                    {currentBulkAction === "assignGender" && isBulkActionLoading && (
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    )}
                                    עדכן מין
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsCustomerDialogOpen(true)}
                                    disabled={disableSelection}
                                >
                                    {currentBulkAction === "assignCustomer" && isBulkActionLoading && (
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                    )}
                                    שיוך לקוח
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="rounded-md border">
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar relative">
                            <div className="[direction:rtl]">
                                <Table className="w-full table-fixed" containerClassName="!overflow-visible">
                                    <TableHeader>
                                        <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[hsl(228_36%_95%)]">
                                            <TableHead className="w-12 p-0 text-center align-middle font-medium">
                                                <div className="flex h-full items-center justify-center">
                                                    <Checkbox
                                                        checked={isAllSelected}
                                                        indeterminate={isPartiallySelected}
                                                        onPointerDownCapture={handleCheckboxPointerDown}
                                                        onPointerUp={handleCheckboxPointerUpOrLeave}
                                                        onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                        onCheckedChange={handleSelectAllChange}
                                                        aria-label="בחר את כל הכלבים בטבלה"
                                                        disabled={filteredTreatments.length === 0 || disableSelection}
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[200px]">שם הכלב</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[130px]">לקוח</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[150px]">גזע</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[140px]">קטגוריה 1</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[140px]">קטגוריה 2</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[110px]">גודל</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[90px]">מין</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold w-[130px]">תאריך לידה</TableHead>
                                            <TableHead className="text-right align-middle font-medium text-primary font-semibold">פעולות</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTreatments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                                    לא נמצאו כלבים
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedTreatments.map((treatment, index) => {
                                                const globalIndex = pageStartIndex + index
                                                return (
                                                    <TableRow
                                                        key={treatment.id}
                                                        className="cursor-pointer hover:bg-gray-50"
                                                        onClick={() => handleTreatmentClick(treatment)}
                                                    >
                                                        <TableCell className="w-12 p-0 align-middle text-center" onClick={(event) => event.stopPropagation()}>
                                                            <div className="flex h-full items-center justify-center">
                                                                <Checkbox
                                                                    checked={selectedTreatmentIds.includes(treatment.id)}
                                                                    onPointerDownCapture={handleCheckboxPointerDown}
                                                                    onPointerUp={handleCheckboxPointerUpOrLeave}
                                                                    onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    onCheckedChange={(value) => handleTreatmentSelectionChange(treatment.id, value === true, globalIndex)}
                                                                    aria-label={`בחר את הכלב ${treatment.name}`}
                                                                    disabled={disableSelection}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-medium text-right w-[200px] truncate">{treatment.name}</TableCell>
                                                        <TableCell className="text-right align-middle w-[130px]">
                                                            <span
                                                                className="font-medium text-gray-900 truncate block"
                                                                title={treatment.customer?.phone
                                                                    ? `${treatment.customer?.full_name || ""} • ${treatment.customer.phone}`
                                                                    : treatment.customer?.full_name || "-"}
                                                            >
                                                                {treatment.customer?.full_name || "-"}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right w-[150px] truncate">{treatment.treatmentType?.name || "-"}</TableCell>
                                                        <TableCell className="w-[140px]">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                {treatment.treatment_types && treatment.treatment_types.length > 0 ? (
                                                                    treatment.treatment_types.map((type) => (
                                                                        <Badge key={type.id} variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                                                                            {type.name}
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-sm text-gray-500">-</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="w-[140px]">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                {treatment.treatment_categories && treatment.treatment_categories.length > 0 ? (
                                                                    treatment.treatment_categories.map((category) => (
                                                                        <Badge key={category.id} variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">
                                                                            {category.name}
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-sm text-gray-500">-</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right w-[110px]">{getSizeLabel(treatment.treatmentType?.size_class)}</TableCell>
                                                        <TableCell className="text-right w-[90px]">{getGenderLabel(treatment.gender)}</TableCell>
                                                        <TableCell className="text-right w-[130px]">
                                                            {treatment.birth_date ? format(new Date(treatment.birth_date), "dd/MM/yyyy") : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleEdit(treatment)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setTreatmentToDelete(treatment)
                                                                        setIsDeleteDialogOpen(true)
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 border-t bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-gray-700">
                                {hasTreatments
                                    ? `מציג ${pageDisplayStart}-${pageDisplayEnd} מתוך ${filteredTreatments.length} כלבים`
                                    : "אין כלבים להצגה"}
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="page-size" className="text-sm text-gray-600">
                                        גודל עמוד
                                    </Label>
                                    <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                                        <SelectTrigger id="page-size" className="w-[120px]">
                                            <SelectValue placeholder="בחר גודל" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pageSizeOptions.map((option) => (
                                                <SelectItem key={option} value={String(option)}>
                                                    {option} רשומות
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!hasTreatments || safeCurrentPage === 1}>
                                        הקודם
                                    </Button>
                                    <span className="text-sm text-gray-600">
                                        עמוד {hasTreatments ? safeCurrentPage : 0} מתוך {hasTreatments ? totalPages : 0}
                                    </span>
                                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasTreatments || safeCurrentPage === totalPages}>
                                        הבא
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Customer/Treatment Selection Modal */}
            <AddTreatmentCustomerModal
                open={isCustomerModalOpen}
                onOpenChange={setIsCustomerModalOpen}
                onSuccess={handleCustomerModalSuccess}
            />

            {/* Add Treatment Dialog */}
            <AddTreatmentDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                customerId={selectedCustomerId}
                onSuccess={handleAddSuccess}
            />

            {/* Edit Treatment Dialog */}
            <EditTreatmentDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                treatmentId={editingTreatmentId}
                onSuccess={handleEditSuccess}
            />

            <TreatmentBulkAssignTreatmentTypeDialog
                open={isTreatmentTypeDialogOpen}
                onOpenChange={setIsTreatmentTypeDialogOpen}
                isSubmitting={isBulkActionLoading && currentBulkAction === "assignTreatmentType"}
                onConfirm={handleBulkAssignTreatmentTypeConfirm}
                searchTreatmentTypes={searchTreatmentTypes}
            />

            <TreatmentBulkAssignGenderDialog
                open={isGenderDialogOpen}
                onOpenChange={setIsGenderDialogOpen}
                isSubmitting={isBulkActionLoading && currentBulkAction === "assignGender"}
                onConfirm={handleBulkAssignGenderConfirm}
            />

            <TreatmentBulkAssignCustomerDialog
                open={isCustomerDialogOpen}
                onOpenChange={setIsCustomerDialogOpen}
                customers={customers.map((customer) => ({
                    id: customer.id,
                    name: customer.full_name,
                    phone: customer.phone ?? undefined,
                }))}
                isSubmitting={isBulkActionLoading && currentBulkAction === "assignCustomer"}
                onConfirm={handleBulkAssignCustomerConfirm}
            />


            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>מחיקת כלב</AlertDialogTitle>
                        <AlertDialogDescription>
                            האם אתה בטוח שברצונך למחוק את הכלב "{treatmentToDelete?.name}"? פעולה זו אינה ברת ביטול ותמחק גם את כל התורים המשויכים לכלב זה.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                    מוחק...
                                </>
                            ) : (
                                "מחק"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Treatment Details Sheet */}
            <TreatmentDetailsSheet
                open={isTreatmentDetailsOpen}
                onOpenChange={setIsTreatmentDetailsOpen}
                selectedTreatment={selectedTreatmentForSheet}
                showAllPastAppointments={showAllPastAppointments}
                setShowAllPastAppointments={setShowAllPastAppointments}
                data={{}}
                onClientClick={handleClientClick}
                onAppointmentClick={() => { }}
                onShowTreatmentAppointments={() => { }}
            />

            {/* Client Details Sheet */}
            <ClientDetailsSheet
                open={isClientDetailsOpen}
                onOpenChange={setIsClientDetailsOpen}
                selectedClient={selectedClientForSheet}
                data={{}}
                onTreatmentClick={(treatment: ManagerTreatment) => {
                    // Find the treatment from our list and open its sheet
                    const foundTreatment = treatments.find(d => d.id === treatment.id)
                    if (foundTreatment) {
                        handleTreatmentClick(foundTreatment)
                        setIsClientDetailsOpen(false)
                    }
                }}
            />
        </div>
    )
}
