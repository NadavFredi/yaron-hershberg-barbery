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
import { DogDetailsSheet, ClientDetailsSheet } from "@/pages/ManagerSchedule/sheets/index"
import type { ManagerDog } from "@/types/managerSchedule"
import { AddDogDialog } from "@/components/AddDogDialog"
import { EditDogDialog } from "@/components/EditDogDialog"
import { AddDogCustomerModal } from "@/components/dialogs/AddDogCustomerModal"
import { DogBulkAssignBreedDialog } from "@/components/dogs/DogBulkAssignBreedDialog"
import { DogBulkAssignGenderDialog } from "@/components/dogs/DogBulkAssignGenderDialog"
import { DogBulkAssignCustomerDialog } from "@/components/dogs/DogBulkAssignCustomerDialog"

interface Dog {
    id: string
    name: string
    customer_id: string
    breed_id: string | null
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
    breed?: {
        id: string
        name: string
        size_class: string | null
    }
    dog_types?: Array<{ id: string; name: string }>
    dog_categories?: Array<{ id: string; name: string }>
}

interface Customer {
    id: string
    full_name: string
    phone?: string | null
}

interface Breed {
    id: string
    name: string
}

export default function DogsListPage() {
    const { toast } = useToast()
    const [searchParams] = useSearchParams()
    const [dogs, setDogs] = useState<Dog[]>([])
    const [customers, setCustomers] = useState<Customer[]>([])
    const [breeds, setBreeds] = useState<Breed[]>([])
    const [dogTypes, setDogTypes] = useState<Array<{ id: string; name: string }>>([])
    const [dogCategories, setDogCategories] = useState<Array<{ id: string; name: string }>>([])
    const [customerTypes, setCustomerTypes] = useState<Array<{ id: string; name: string }>>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingDogId, setEditingDogId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [dogToDelete, setDogToDelete] = useState<Dog | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedDogIds, setSelectedDogIds] = useState<string[]>([])
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
    const shiftPressedRef = useRef(false)
    const shiftKeyHeldRef = useRef(false)
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
    const [currentBulkAction, setCurrentBulkAction] = useState<"assignBreed" | "assignGender" | "assignCustomer" | null>(null)
    const [isBreedDialogOpen, setIsBreedDialogOpen] = useState(false)
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
    const [breedFilter, setBreedFilter] = useState("")
    const [sizeFilter, setSizeFilter] = useState<string>("all")
    const [category1Filter, setCategory1Filter] = useState("")
    const [category2Filter, setCategory2Filter] = useState("")
    const [ownerCategoryFilter, setOwnerCategoryFilter] = useState<string>("all")

    // Sheet states
    const [isDogDetailsOpen, setIsDogDetailsOpen] = useState(false)
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false)
    const [selectedDogForSheet, setSelectedDogForSheet] = useState<any>(null)
    const [selectedClientForSheet, setSelectedClientForSheet] = useState<any>(null)
    const [showAllPastAppointments, setShowAllPastAppointments] = useState(false)

    useEffect(() => {
        fetchDogs()
        fetchCustomers()
        fetchBreeds()
        fetchDogTypes()
        fetchDogCategories()
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

    const fetchDogTypes = async () => {
        try {
            const { data, error } = await supabase
                .from("dog_types")
                .select("id, name")
                .order("name")

            if (error) throw error
            setDogTypes(data || [])
        } catch (error) {
            console.error("Error fetching dog types:", error)
        }
    }

    const fetchDogCategories = async () => {
        try {
            const { data, error } = await supabase
                .from("dog_categories")
                .select("id, name")
                .order("name")

            if (error) throw error
            setDogCategories(data || [])
        } catch (error) {
            console.error("Error fetching dog categories:", error)
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
        if (!dogTypes.length || !category1IdParam || appliedCategoryFromUrlRef.current.category1) {
            return
        }
        const match = dogTypes.find((type) => type.id === category1IdParam)
        if (match) {
            setCategory1Filter(match.name)
            appliedCategoryFromUrlRef.current.category1 = true
        }
    }, [category1IdParam, dogTypes])

    useEffect(() => {
        if (!dogCategories.length || !category2IdParam || appliedCategoryFromUrlRef.current.category2) {
            return
        }
        const match = dogCategories.find((category) => category.id === category2IdParam)
        if (match) {
            setCategory2Filter(match.name)
            appliedCategoryFromUrlRef.current.category2 = true
        }
    }, [category2IdParam, dogCategories])

    useEffect(() => {
        setSelectedDogIds((prev) => prev.filter((id) => dogs.some((dog) => dog.id === id)))
    }, [dogs])

    useEffect(() => {
        if (selectedDogIds.length === 0) {
            setLastSelectedIndex(null)
        }
    }, [selectedDogIds])

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

    const fetchBreeds = async () => {
        try {
            const { data, error } = await supabase
                .from("breeds")
                .select("id, name")
                .order("name")

            if (error) throw error
            setBreeds(data || [])
        } catch (error) {
            console.error("Error fetching breeds:", error)
        }
    }

    const fetchDogs = async () => {
        try {
            setIsLoading(true)
            let query = supabase
                .from("dogs")
                .select(`
                    *,
                    customer:customers(id, full_name, phone, email, customer_type:customer_types(id, name)),
                    breed:breeds(id, name, size_class)
                `)
                .order("created_at", { ascending: false })

            if (searchTerm) {
                query = query.ilike("name", `%${searchTerm}%`)
            }

            const { data, error } = await query

            if (error) throw error

            // Fetch category relationships for filtering
            const dogIds = (data || []).map(d => d.id)
            const [typesData, categoriesData] = await Promise.all([
                dogIds.length > 0
                    ? supabase
                        .from("breed_dog_types")
                        .select(`
                            breed_id,
                            dog_type_id,
                            dog_type:dog_types(id, name)
                        `)
                        .in("breed_id", (data || []).filter(d => d.breed_id).map(d => d.breed_id))
                    : { data: [], error: null },
                dogIds.length > 0
                    ? supabase
                        .from("breed_dog_categories")
                        .select(`
                            breed_id,
                            dog_category_id,
                            dog_category:dog_categories(id, name)
                        `)
                        .in("breed_id", (data || []).filter(d => d.breed_id).map(d => d.breed_id))
                    : { data: [], error: null }
            ])

            // Build category maps
            const typesByBreed = new Map<string, any[]>()
            const categoriesByBreed = new Map<string, any[]>()

                ; (typesData.data || []).forEach((row: any) => {
                    if (!typesByBreed.has(row.breed_id)) typesByBreed.set(row.breed_id, [])
                    if (row.dog_type) typesByBreed.get(row.breed_id)!.push(row.dog_type)
                })

                ; (categoriesData.data || []).forEach((row: any) => {
                    if (!categoriesByBreed.has(row.breed_id)) categoriesByBreed.set(row.breed_id, [])
                    if (row.dog_category) categoriesByBreed.get(row.breed_id)!.push(row.dog_category)
                })

            // Attach categories to dogs
            const dogsWithCategories = (data || []).map((dog: any) => ({
                ...dog,
                dog_types: dog.breed_id ? (typesByBreed.get(dog.breed_id) || []) : [],
                dog_categories: dog.breed_id ? (categoriesByBreed.get(dog.breed_id) || []) : [],
            }))

            setDogs(dogsWithCategories)
        } catch (error) {
            console.error("Error fetching dogs:", error)
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

    const searchBreeds = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("breeds")
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

    const searchDogTypes = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("dog_types")
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

    const searchDogCategories = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("dog_categories")
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

    // Filter dogs based on all criteria
    const filteredDogs = dogs.filter((dog) => {
        // Owner name filter
        if (ownerNameFilter && !dog.customer?.full_name?.toLowerCase().includes(ownerNameFilter.toLowerCase())) {
            return false
        }

        // Owner phone filter
        if (ownerPhoneFilter && !dog.customer?.phone?.includes(ownerPhoneFilter)) {
            return false
        }

        // Owner email filter
        if (ownerEmailFilter && !dog.customer?.email?.toLowerCase().includes(ownerEmailFilter.toLowerCase())) {
            return false
        }

        // Breed filter
        if (breedFilter && !dog.breed?.name?.toLowerCase().includes(breedFilter.toLowerCase())) {
            return false
        }

        if (ownerCategoryFilter !== "all") {
            const ownerTypeId = dog.customer?.customer_type?.id
            if (!ownerTypeId || ownerTypeId !== ownerCategoryFilter) {
                return false
            }
        }

        // Size filter
        if (sizeFilter !== "all") {
            const breedSize = dog.breed?.size_class
            if (sizeFilter === "none") {
                if (breedSize !== null && breedSize !== undefined) {
                    return false
                }
            } else if (breedSize !== sizeFilter) {
                return false
            }
        }

        // Category 1 filter (dog_types)
        if (category1Filter) {
            const hasCategory1 = dog.dog_types?.some((type: any) =>
                type.name?.toLowerCase().includes(category1Filter.toLowerCase())
            )
            if (!hasCategory1) return false
        }

        // Category 2 filter (dog_categories)
        if (category2Filter) {
            const hasCategory2 = dog.dog_categories?.some((category: any) =>
                category.name?.toLowerCase().includes(category2Filter.toLowerCase())
            )
            if (!hasCategory2) return false
        }

        return true
    })

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, ownerNameFilter, ownerPhoneFilter, ownerEmailFilter, breedFilter, sizeFilter, category1Filter, category2Filter, ownerCategoryFilter])

    useEffect(() => {
        const newTotalPages = Math.max(1, Math.ceil(filteredDogs.length / pageSize)) || 1
        setCurrentPage((prev) => Math.min(prev, newTotalPages))
    }, [filteredDogs.length, pageSize])

    const hasDogs = filteredDogs.length > 0
    const totalPages = hasDogs ? Math.ceil(filteredDogs.length / pageSize) : 1
    const safeCurrentPage = hasDogs ? Math.min(currentPage, totalPages) : 1
    const pageStartIndex = hasDogs ? (safeCurrentPage - 1) * pageSize : 0
    const paginatedDogs = filteredDogs.slice(pageStartIndex, pageStartIndex + pageSize)
    const pageDisplayStart = hasDogs ? pageStartIndex + 1 : 0
    const pageDisplayEnd = hasDogs ? pageStartIndex + paginatedDogs.length : 0

    useEffect(() => {
        setSelectedDogIds((prev) => {
            const filteredIds = new Set(filteredDogs.map((dog) => dog.id))
            const next = prev.filter((id) => filteredIds.has(id))
            return next.length === prev.length ? prev : next
        })
    }, [filteredDogs])

    const selectedDogs = useMemo(() => dogs.filter((dog) => selectedDogIds.includes(dog.id)), [dogs, selectedDogIds])
    const selectedCount = selectedDogs.length
    const isAllSelected = filteredDogs.length > 0 && selectedCount === filteredDogs.length
    const isPartiallySelected = selectedCount > 0 && !isAllSelected
    const disableSelection = isLoading || isSaving || isBulkActionLoading

    const clearSelection = () => {
        setSelectedDogIds([])
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
            const ids = filteredDogs.map((dog) => dog.id)
            setSelectedDogIds(ids)
            if (ids.length > 0) {
                setLastSelectedIndex(ids.length - 1)
            }
        } else {
            clearSelection()
        }
    }

    const handleDogSelectionChange = (dogId: string, isChecked: boolean, index: number) => {
        setSelectedDogIds((prev) => {
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
                const rangeIds = filteredDogs.slice(start, end + 1).map((dog) => dog.id)
                applyIds(rangeIds)
            } else {
                applyIds([dogId])
            }

            return filteredDogs.map((dog) => dog.id).filter((id) => selectionSet.has(id))
        })

        if (isChecked) {
            setLastSelectedIndex(index)
        } else if (!shiftPressedRef.current) {
            setLastSelectedIndex(null)
        }

        shiftPressedRef.current = false
    }

    const handleBulkAssignBreedConfirm = async (breedName: string) => {
        if (selectedDogIds.length === 0) return
        const trimmedName = breedName.trim()
        if (!trimmedName) {
            toast({
                title: "שגיאה",
                description: "יש לבחור גזע תקין לפני העדכון.",
                variant: "destructive",
            })
            return
        }
        let breedId = breeds.find((breed) => breed.name === trimmedName)?.id
        if (!breedId) {
            const { data, error } = await supabase
                .from("breeds")
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

            breedId = data.id
            setBreeds((prev) => {
                if (prev.some((breed) => breed.id === data.id)) {
                    return prev
                }
                return [...prev, { id: data.id, name: trimmedName }]
            })
        }

        console.log("🐾 [DogsListPage] Bulk assign breed", { breedId, breedName: trimmedName, selectedDogIds, selectedCount })
        try {
            setCurrentBulkAction("assignBreed")
            setIsBulkActionLoading(true)
            const { error } = await supabase
                .from("dogs")
                .update({ breed_id: breedId })
                .in("id", selectedDogIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `הגזע עודכן עבור ${selectedCount} כלבים.`,
            })
            setIsBreedDialogOpen(false)
            clearSelection()
            await fetchDogs()
        } catch (error) {
            console.error("❌ [DogsListPage] Failed bulk assigning breed", error)
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
        if (selectedDogIds.length === 0) return
        console.log("🐾 [DogsListPage] Bulk assign gender", { gender, selectedDogIds, selectedCount })
        try {
            setCurrentBulkAction("assignGender")
            setIsBulkActionLoading(true)
            const { error } = await supabase
                .from("dogs")
                .update({ gender })
                .in("id", selectedDogIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `המין עודכן עבור ${selectedCount} כלבים.`,
            })
            setIsGenderDialogOpen(false)
            clearSelection()
            await fetchDogs()
        } catch (error) {
            console.error("❌ [DogsListPage] Failed bulk assigning gender", error)
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
        if (selectedDogIds.length === 0) return
        console.log("🐾 [DogsListPage] Bulk assign customer", { customerId, selectedDogIds, selectedCount })
        try {
            setCurrentBulkAction("assignCustomer")
            setIsBulkActionLoading(true)
            const { error } = await supabase
                .from("dogs")
                .update({ customer_id: customerId })
                .in("id", selectedDogIds)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: `הלקוח עודכן עבור ${selectedCount} כלבים.`,
            })
            setIsCustomerDialogOpen(false)
            clearSelection()
            await fetchDogs()
        } catch (error) {
            console.error("❌ [DogsListPage] Failed bulk assigning customer", error)
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
            fetchDogs()
        }, 300)

        return () => clearTimeout(debounce)
    }, [searchTerm])

    // Handle dog click to open sheet
    const handleDogClick = (dog: Dog) => {
        const dogDetails = {
            id: dog.id,
            name: dog.name,
            breed: dog.breed?.name,
            clientClassification: dog.customer ? "existing" : undefined,
            owner: dog.customer ? {
                name: dog.customer.full_name,
                phone: dog.customer.phone,
                email: dog.customer.email || undefined,
            } : undefined,
            gender: dog.gender === 'male' ? 'זכר' : 'נקבה',
            healthIssues: dog.health_notes || undefined,
            vetName: dog.vet_name || undefined,
            vetPhone: dog.vet_phone || undefined,
            birthDate: dog.birth_date || undefined,
            internalNotes: dog.staff_notes || undefined,
        }
        setSelectedDogForSheet(dogDetails)
        setIsDogDetailsOpen(true)
    }

    // Handle client click from dog sheet
    const handleClientClick = (client: any) => {
        const clientDetails = {
            name: client.name,
            phone: client.phone,
            email: client.email,
            classification: "existing",
        }
        setSelectedClientForSheet(clientDetails)
        setIsClientDetailsOpen(true)
        setIsDogDetailsOpen(false)
    }

    const handleAdd = () => {
        // Open the customer selection modal first
        setIsCustomerModalOpen(true)
    }

    const handleEdit = (dog: Dog) => {
        setEditingDogId(dog.id)
        setIsEditDialogOpen(true)
    }

    const handleCustomerModalSuccess = () => {
        // Refresh the dogs list after a dog is created via the customer modal
        fetchDogs()
    }

    const handleAddSuccess = () => {
        setIsAddDialogOpen(false)
        setSelectedCustomerId(null)
        fetchDogs()
    }

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false)
        setEditingDogId(null)
        fetchDogs()
    }

    const handleDelete = async () => {
        if (!dogToDelete) return

        try {
            setIsSaving(true)
            const { error } = await supabase
                .from("dogs")
                .delete()
                .eq("id", dogToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "הכלב נמחק בהצלחה",
            })

            setIsDeleteDialogOpen(false)
            setDogToDelete(null)
            await fetchDogs()
        } catch (error: any) {
            console.error("Error deleting dog:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן למחוק את הכלב",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const getGenderLabel = (gender: Dog['gender']) => {
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
                                    value={breedFilter}
                                    onChange={setBreedFilter}
                                    placeholder="גזע..."
                                    searchFn={searchBreeds}
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
                                    searchFn={searchDogTypes}
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
                                    searchFn={searchDogCategories}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                        </div>
                        {(ownerNameFilter || ownerPhoneFilter || ownerEmailFilter || breedFilter || sizeFilter !== "all" || category1Filter || category2Filter || ownerCategoryFilter !== "all") && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setOwnerNameFilter("")
                                    setOwnerPhoneFilter("")
                                    setOwnerEmailFilter("")
                                    setBreedFilter("")
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
                                    onClick={() => setIsBreedDialogOpen(true)}
                                    disabled={disableSelection}
                                >
                                    {currentBulkAction === "assignBreed" && isBulkActionLoading && (
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
                                                        disabled={filteredDogs.length === 0 || disableSelection}
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
                                        {filteredDogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                                    לא נמצאו כלבים
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedDogs.map((dog, index) => {
                                                const globalIndex = pageStartIndex + index
                                                return (
                                                    <TableRow
                                                        key={dog.id}
                                                        className="cursor-pointer hover:bg-gray-50"
                                                        onClick={() => handleDogClick(dog)}
                                                    >
                                                        <TableCell className="w-12 p-0 align-middle text-center" onClick={(event) => event.stopPropagation()}>
                                                            <div className="flex h-full items-center justify-center">
                                                                <Checkbox
                                                                    checked={selectedDogIds.includes(dog.id)}
                                                                    onPointerDownCapture={handleCheckboxPointerDown}
                                                                    onPointerUp={handleCheckboxPointerUpOrLeave}
                                                                    onPointerLeave={handleCheckboxPointerUpOrLeave}
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    onCheckedChange={(value) => handleDogSelectionChange(dog.id, value === true, globalIndex)}
                                                                    aria-label={`בחר את הכלב ${dog.name}`}
                                                                    disabled={disableSelection}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-medium text-right w-[200px] truncate">{dog.name}</TableCell>
                                                        <TableCell className="text-right align-middle w-[130px]">
                                                            <span
                                                                className="font-medium text-gray-900 truncate block"
                                                                title={dog.customer?.phone
                                                                    ? `${dog.customer?.full_name || ""} • ${dog.customer.phone}`
                                                                    : dog.customer?.full_name || "-"}
                                                            >
                                                                {dog.customer?.full_name || "-"}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right w-[150px] truncate">{dog.breed?.name || "-"}</TableCell>
                                                        <TableCell className="w-[140px]">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                {dog.dog_types && dog.dog_types.length > 0 ? (
                                                                    dog.dog_types.map((type) => (
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
                                                                {dog.dog_categories && dog.dog_categories.length > 0 ? (
                                                                    dog.dog_categories.map((category) => (
                                                                        <Badge key={category.id} variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">
                                                                            {category.name}
                                                                        </Badge>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-sm text-gray-500">-</span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right w-[110px]">{getSizeLabel(dog.breed?.size_class)}</TableCell>
                                                        <TableCell className="text-right w-[90px]">{getGenderLabel(dog.gender)}</TableCell>
                                                        <TableCell className="text-right w-[130px]">
                                                            {dog.birth_date ? format(new Date(dog.birth_date), "dd/MM/yyyy") : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleEdit(dog)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setDogToDelete(dog)
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
                                {hasDogs
                                    ? `מציג ${pageDisplayStart}-${pageDisplayEnd} מתוך ${filteredDogs.length} כלבים`
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
                                    <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={!hasDogs || safeCurrentPage === 1}>
                                        הקודם
                                    </Button>
                                    <span className="text-sm text-gray-600">
                                        עמוד {hasDogs ? safeCurrentPage : 0} מתוך {hasDogs ? totalPages : 0}
                                    </span>
                                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasDogs || safeCurrentPage === totalPages}>
                                        הבא
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Customer/Dog Selection Modal */}
            <AddDogCustomerModal
                open={isCustomerModalOpen}
                onOpenChange={setIsCustomerModalOpen}
                onSuccess={handleCustomerModalSuccess}
            />

            {/* Add Dog Dialog */}
            <AddDogDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                customerId={selectedCustomerId}
                onSuccess={handleAddSuccess}
            />

            {/* Edit Dog Dialog */}
            <EditDogDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                dogId={editingDogId}
                onSuccess={handleEditSuccess}
            />

            <DogBulkAssignBreedDialog
                open={isBreedDialogOpen}
                onOpenChange={setIsBreedDialogOpen}
                isSubmitting={isBulkActionLoading && currentBulkAction === "assignBreed"}
                onConfirm={handleBulkAssignBreedConfirm}
                searchBreeds={searchBreeds}
            />

            <DogBulkAssignGenderDialog
                open={isGenderDialogOpen}
                onOpenChange={setIsGenderDialogOpen}
                isSubmitting={isBulkActionLoading && currentBulkAction === "assignGender"}
                onConfirm={handleBulkAssignGenderConfirm}
            />

            <DogBulkAssignCustomerDialog
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
                            האם אתה בטוח שברצונך למחוק את הכלב "{dogToDelete?.name}"? פעולה זו אינה ברת ביטול ותמחק גם את כל התורים המשויכים לכלב זה.
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

            {/* Dog Details Sheet */}
            <DogDetailsSheet
                open={isDogDetailsOpen}
                onOpenChange={setIsDogDetailsOpen}
                selectedDog={selectedDogForSheet}
                showAllPastAppointments={showAllPastAppointments}
                setShowAllPastAppointments={setShowAllPastAppointments}
                data={{}}
                onClientClick={handleClientClick}
                onAppointmentClick={() => { }}
                onShowDogAppointments={() => { }}
            />

            {/* Client Details Sheet */}
            <ClientDetailsSheet
                open={isClientDetailsOpen}
                onOpenChange={setIsClientDetailsOpen}
                selectedClient={selectedClientForSheet}
                data={{}}
                onDogClick={(dog: ManagerDog) => {
                    // Find the dog from our list and open its sheet
                    const foundDog = dogs.find(d => d.id === dog.id)
                    if (foundDog) {
                        handleDogClick(foundDog)
                        setIsClientDetailsOpen(false)
                    }
                }}
            />
        </div>
    )
}
