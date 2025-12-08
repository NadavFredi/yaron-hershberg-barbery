import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { ClientDetailsSheet, DogDetailsSheet } from "@/pages/ManagerSchedule/sheets/index"
import type { ManagerDog } from "./ManagerSchedule/types"
import { AddCustomerDialog } from "@/components/AddCustomerDialog"
import { EditCustomerDialog } from "@/components/EditCustomerDialog"
import { BulkCustomersDeleteDialog } from "@/components/dialogs/customers/BulkCustomersDeleteDialog"
import { BulkAssignCustomerTypeDialog } from "@/components/dialogs/customers/BulkAssignCustomerTypeDialog"
import { BulkReceiptPreferenceDialog } from "@/components/dialogs/customers/BulkReceiptPreferenceDialog"
import { CustomerDeleteConfirmationDialog } from "@/components/dialogs/customers/CustomerDeleteConfirmationDialog"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { SiWhatsapp } from "react-icons/si"
import { WhatsAppBroadcastDialog } from "@/components/dialogs/customers/WhatsAppBroadcastDialog"

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

type SelectedDogDetails = {
    id: string
    name: string
    breed?: string
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

// Customer Type MultiSelect Component
function CustomerTypeMultiSelect({
    options,
    selectedIds,
    onSelectionChange,
    placeholder = "בחר...",
    disabled = false,
}: {
    options: CustomerTypeSummary[]
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
    placeholder?: string
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState<string>("")
    const anchorRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleToggle = (optionId: string) => {
        if (selectedIds.includes(optionId)) {
            onSelectionChange(selectedIds.filter(id => id !== optionId))
        } else {
            onSelectionChange([...selectedIds, optionId])
        }
    }

    const selectedOptions = options.filter(opt => selectedIds.includes(opt.id))
    const filteredOptions = options.filter(opt => {
        if (!searchValue || searchValue === "") return true
        return opt.name.toLowerCase().includes(searchValue.toLowerCase())
    })

    const showBadges = selectedOptions.length > 0 && (searchValue === "" || searchValue === undefined)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div
                    ref={anchorRef}
                    className={`relative flex-1 min-h-10 border border-input bg-background rounded-md flex flex-wrap items-center gap-1 px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
                    onClick={() => {
                        if (!disabled) {
                            inputRef.current?.focus()
                            if (!open) {
                                setOpen(true)
                            }
                        }
                    }}
                    dir="rtl"
                >
                    {showBadges ? (
                        <>
                            {selectedOptions.map((option) => (
                                <Badge
                                    key={option.id}
                                    variant="secondary"
                                    className="text-xs h-6 px-2 flex items-center gap-1"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (!disabled) {
                                            handleToggle(option.id)
                                        }
                                    }}
                                >
                                    <span>{option.name}</span>
                                    {!disabled && <X className="h-3 w-3 cursor-pointer hover:text-destructive" />}
                                </Badge>
                            ))}
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchValue || ""}
                                onChange={(e) => {
                                    setSearchValue(e.target.value)
                                    if (!open) {
                                        setOpen(true)
                                    }
                                }}
                                onFocus={() => {
                                    if (searchValue === undefined) {
                                        setSearchValue("")
                                    }
                                    if (!open) {
                                        setOpen(true)
                                    }
                                }}
                                placeholder={selectedOptions.length === 0 ? placeholder : ""}
                                className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-right"
                                dir="rtl"
                                disabled={disabled}
                            />
                        </>
                    ) : (
                        <Input
                            ref={inputRef}
                            value={searchValue || ""}
                            onChange={(e) => {
                                setSearchValue(e.target.value)
                                if (!open) {
                                    setOpen(true)
                                }
                            }}
                            onFocus={() => {
                                if (searchValue === undefined) {
                                    setSearchValue("")
                                }
                                if (!open) {
                                    setOpen(true)
                                }
                            }}
                            placeholder={placeholder}
                            dir="rtl"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto px-0 text-right"
                            disabled={disabled}
                        />
                    )}
                </div>
            </PopoverAnchor>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" dir="rtl" align="start">
                <div className="max-h-[300px] overflow-y-auto">
                    <div
                        className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent flex items-center gap-2"
                        onClick={() => {
                            if (selectedIds.includes("none")) {
                                onSelectionChange(selectedIds.filter(id => id !== "none"))
                            } else {
                                onSelectionChange([...selectedIds, "none"])
                            }
                        }}
                    >
                        <Checkbox
                            checked={selectedIds.includes("none")}
                            onCheckedChange={() => {
                                if (selectedIds.includes("none")) {
                                    onSelectionChange(selectedIds.filter(id => id !== "none"))
                                } else {
                                    onSelectionChange([...selectedIds, "none"])
                                }
                            }}
                        />
                        <span>ללא סוג</span>
                    </div>
                    {filteredOptions.map((option) => (
                        <div
                            key={option.id}
                            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent flex items-center gap-2"
                            onClick={() => handleToggle(option.id)}
                        >
                            <Checkbox
                                checked={selectedIds.includes(option.id)}
                                onCheckedChange={() => handleToggle(option.id)}
                            />
                            <span>{option.name}</span>
                        </div>
                    ))}
                    {filteredOptions.length === 0 && searchValue && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                            לא נמצאו תוצאות
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default function CustomersListPage() {
    const { toast } = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const customerTypeParam = searchParams.get("type")
    // Parse comma-separated types from URL
    const customerTypeParams = customerTypeParam ? customerTypeParam.split(",").filter(Boolean) : []
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
    const [customerTypeFilter, setCustomerTypeFilter] = useState<string[]>(customerTypeParams)
    const [phoneFilter, setPhoneFilter] = useState("")
    const [emailFilter, setEmailFilter] = useState("")
    const [nameFilter, setNameFilter] = useState("")
    const [dogNameFilter, setDogNameFilter] = useState("")
    const [breedFilter, setBreedFilter] = useState("")
    const [isWhatsAppBroadcastDialogOpen, setIsWhatsAppBroadcastDialogOpen] = useState(false)
    
    // Appointment filter states - using recursive nested structure
    type AppointmentFilterCondition = {
        id: string
        type: "had_appointment" | "no_appointment"
        dateRangeType: "before" | "after" | "on" | "range"
        startDate: Date | null
        endDate: Date | null
    }

    type AppointmentFilterNode = 
        | { type: "condition"; condition: AppointmentFilterCondition }
        | { type: "group"; id: string; operator: "AND" | "OR"; children: AppointmentFilterNode[] }

    const [appointmentFilterEnabled, setAppointmentFilterEnabled] = useState(false)
    const [appointmentFilterRoot, setAppointmentFilterRoot] = useState<AppointmentFilterNode>({
        type: "group",
        id: "root",
        operator: "AND",
        children: [
            { type: "condition", condition: { id: "1", type: "had_appointment", dateRangeType: "range", startDate: null, endDate: null } }
        ]
    })
    const [customersWithAppointments, setCustomersWithAppointments] = useState<Set<string>>(new Set())
    const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)

    useEffect(() => {
        const currentParams = customerTypeParam ? customerTypeParam.split(",").filter(Boolean) : []
        if (currentParams.length > 0) {
            // Check if the current filter matches the URL params
            const paramsMatch = currentParams.length === customerTypeFilter.length &&
                currentParams.every(param => customerTypeFilter.includes(param))
            if (!paramsMatch) {
                setCustomerTypeFilter(currentParams)
            }
        } else if (customerTypeFilter.length > 0) {
            setCustomerTypeFilter([])
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerTypeParam])

    const handleCustomerTypeFilterChange = (typeIds: string[]) => {
        setCustomerTypeFilter(typeIds)
        const params = new URLSearchParams(searchParams.toString())
        if (typeIds.length === 0) {
            params.delete("type")
        } else if (typeIds.length === 1) {
            params.set("type", typeIds[0])
        } else {
            // For multiple types, we'll use comma-separated values
            params.set("type", typeIds.join(","))
        }
        setSearchParams(params, { replace: true })
    }

    // Sheet states
    const [isClientDetailsOpen, setIsClientDetailsOpen] = useState(false)
    const [isDogDetailsOpen, setIsDogDetailsOpen] = useState(false)
    const [selectedClientForSheet, setSelectedClientForSheet] = useState<SelectedClientDetails | null>(null)
    const [selectedDogForSheet, setSelectedDogForSheet] = useState<SelectedDogDetails | null>(null)
    const [clientDogs, setClientDogs] = useState<ManagerDog[]>([])

    useEffect(() => {
        fetchCustomers()
        fetchCustomerTypes()
    }, [])

    // Helper function to check if a node has valid dates
    const hasValidDates = (node: AppointmentFilterNode): boolean => {
        if (node.type === "condition") {
            const cond = node.condition
            if (cond.dateRangeType === "range") {
                return cond.startDate !== null || cond.endDate !== null
            }
            return cond.startDate !== null
        }
        return node.children.some(child => hasValidDates(child))
    }

    // Fetch customers with appointments when appointment filter is enabled
    useEffect(() => {
        if (appointmentFilterEnabled) {
            if (hasValidDates(appointmentFilterRoot)) {
                fetchCustomersWithAppointments()
            } else {
                setCustomersWithAppointments(new Set())
            }
        } else {
            setCustomersWithAppointments(new Set())
        }
    }, [appointmentFilterEnabled, appointmentFilterRoot])

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
                    dogs:dogs(id, name, breed_id, breed:breeds(id, name))
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

    // Helper function to fetch customers for a single condition
    const fetchCustomersForCondition = async (condition: AppointmentFilterCondition): Promise<Set<string>> => {
        // Skip if no valid dates
        if (condition.dateRangeType === "range" && !condition.startDate && !condition.endDate) {
            return new Set()
        }
        if (condition.dateRangeType !== "range" && !condition.startDate) {
            return new Set()
        }

        // Build queries
        let groomingQuery = supabase
            .from("grooming_appointments")
            .select("customer_id")
            .neq("status", "cancelled")

        let daycareQuery = supabase
            .from("daycare_appointments")
            .select("customer_id")
            .neq("status", "cancelled")

        // Apply date filters
        if (condition.dateRangeType === "before" && condition.startDate) {
            const endOfDay = new Date(condition.startDate)
            endOfDay.setHours(23, 59, 59, 999)
            const isoString = endOfDay.toISOString()
            groomingQuery = groomingQuery.lte("start_at", isoString)
            daycareQuery = daycareQuery.lte("start_at", isoString)
        } else if (condition.dateRangeType === "after" && condition.startDate) {
            const startOfDay = new Date(condition.startDate)
            startOfDay.setHours(0, 0, 0, 0)
            const isoString = startOfDay.toISOString()
            groomingQuery = groomingQuery.gte("start_at", isoString)
            daycareQuery = daycareQuery.gte("start_at", isoString)
        } else if (condition.dateRangeType === "on" && condition.startDate) {
            const startOfDay = new Date(condition.startDate)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(condition.startDate)
            endOfDay.setHours(23, 59, 59, 999)
            groomingQuery = groomingQuery.gte("start_at", startOfDay.toISOString()).lte("start_at", endOfDay.toISOString())
            daycareQuery = daycareQuery.gte("start_at", startOfDay.toISOString()).lte("start_at", endOfDay.toISOString())
        } else if (condition.dateRangeType === "range") {
            if (condition.startDate) {
                const startOfDay = new Date(condition.startDate)
                startOfDay.setHours(0, 0, 0, 0)
                groomingQuery = groomingQuery.gte("start_at", startOfDay.toISOString())
                daycareQuery = daycareQuery.gte("start_at", startOfDay.toISOString())
            }
            if (condition.endDate) {
                const endOfDay = new Date(condition.endDate)
                endOfDay.setHours(23, 59, 59, 999)
                groomingQuery = groomingQuery.lte("start_at", endOfDay.toISOString())
                daycareQuery = daycareQuery.lte("start_at", endOfDay.toISOString())
            }
        }

        // Execute queries
        const [groomingResult, daycareResult] = await Promise.all([
            groomingQuery,
            daycareQuery,
        ])

        if (groomingResult.error) throw groomingResult.error
        if (daycareResult.error) throw daycareResult.error

        // Combine customer IDs
        const customerIds = new Set<string>()
        ;(groomingResult.data || []).forEach((apt: any) => {
            if (apt.customer_id) customerIds.add(apt.customer_id)
        })
        ;(daycareResult.data || []).forEach((apt: any) => {
            if (apt.customer_id) customerIds.add(apt.customer_id)
        })

        return customerIds
    }

    // Recursive function to evaluate the filter tree
    const evaluateFilterNode = async (node: AppointmentFilterNode, allCustomerIds: Set<string>): Promise<Set<string>> => {
        if (node.type === "condition") {
            const customerIds = await fetchCustomersForCondition(node.condition)
            if (node.condition.type === "had_appointment") {
                return customerIds
            } else {
                // no_appointment: all customers minus those with appointments
                return new Set(Array.from(allCustomerIds).filter(id => !customerIds.has(id)))
            }
        } else {
            // Group node: evaluate children and combine with operator
            const childResults = await Promise.all(
                node.children.map(child => evaluateFilterNode(child, allCustomerIds))
            )

            if (childResults.length === 0) return new Set()

            let result = childResults[0]
            for (let i = 1; i < childResults.length; i++) {
                if (node.operator === "AND") {
                    result = new Set(Array.from(result).filter(id => childResults[i].has(id)))
                } else {
                    // OR: union
                    childResults[i].forEach(id => result.add(id))
                }
            }
            return result
        }
    }

    const fetchCustomersWithAppointments = async () => {
        if (!appointmentFilterEnabled) return

        try {
            setIsLoadingAppointments(true)
            console.log("🔍 [CustomersListPage] Fetching customers with appointments filter (recursive tree):", {
                root: appointmentFilterRoot,
            })

            // Get all customer IDs for "no_appointment" logic
            const { data: allCustomers } = await supabase
                .from("customers")
                .select("id")
            
            const allCustomerIds = new Set<string>((allCustomers || []).map((c: any) => c.id))

            // Evaluate the filter tree recursively
            const finalCustomerIds = await evaluateFilterNode(appointmentFilterRoot, allCustomerIds)

            console.log("✅ [CustomersListPage] Found customers with appointments (recursive):", finalCustomerIds.size)
            setCustomersWithAppointments(finalCustomerIds)
        } catch (error) {
            console.error("❌ [CustomersListPage] Error fetching customers with appointments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את נתוני התורים",
                variant: "destructive",
            })
        } finally {
            setIsLoadingAppointments(false)
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

    const searchDogNames = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("dogs")
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

    // Filter customers based on all criteria
    const filteredCustomers = customers.filter((customer) => {
        // Customer type filter (multiselect)
        if (customerTypeFilter.length > 0) {
            const hasNoneType = customerTypeFilter.includes("none")
            const hasMatchingType = customer.customer_type_id && customerTypeFilter.includes(customer.customer_type_id)
            
            // Include if: (none is selected AND customer has no type) OR (customer has matching type)
            if (!((hasNoneType && !customer.customer_type_id) || hasMatchingType)) {
                return false
            }
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

        // Dog name filter
        if (dogNameFilter) {
            const hasMatchingDog = customer.dogs?.some((dog: any) =>
                dog.name?.toLowerCase().includes(dogNameFilter.toLowerCase())
            )
            if (!hasMatchingDog) return false
        }

        // Breed filter
        if (breedFilter) {
            const hasMatchingBreed = customer.dogs?.some((dog: any) =>
                dog.breed?.name?.toLowerCase().includes(breedFilter.toLowerCase())
            )
            if (!hasMatchingBreed) return false
        }

        // Appointment filter (already combined in customersWithAppointments set)
        if (appointmentFilterEnabled) {
            if (!customersWithAppointments.has(customer.id)) {
                return false
            }
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
        // Fetch all dogs for this customer
        const { data: dogsData, error } = await supabase
            .from("dogs")
            .select(`
                *,
                breed:breeds(id, name)
            `)
            .eq("customer_id", customer.id)

        if (error) {
            console.error("Error fetching customer dogs:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את כלבי הלקוח",
                variant: "destructive",
            })
            return
        }

        // Transform dogs to ManagerDog format
        const managerDogs: ManagerDog[] = (dogsData || []).map((dog: any) => ({
            id: dog.id,
            name: dog.name,
            breed: dog.breed?.name,
            clientName: customer.full_name,
            clientClassification: customer.classification,
            gender: dog.gender === 'male' ? 'זכר' : 'נקבה',
            healthIssues: dog.health_notes,
            vetName: dog.vet_name,
            vetPhone: dog.vet_phone,
            birthDate: dog.birth_date,
            internalNotes: dog.staff_notes,
        }))

        setClientDogs(managerDogs)

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

    // Handle dog click from client sheet
    const handleDogClick = (dog: ManagerDog) => {
        const dogDetails = {
            id: dog.id,
            name: dog.name,
            breed: dog.breed,
            clientClassification: dog.clientClassification,
            owner: selectedClientForSheet ? {
                name: selectedClientForSheet.name,
                phone: selectedClientForSheet.phone,
                email: selectedClientForSheet.email,
                customerTypeName: selectedClientForSheet.customerTypeName,
            } : undefined,
            gender: dog.gender,
            healthIssues: dog.healthIssues,
            vetName: dog.vetName,
            vetPhone: dog.vetPhone,
            birthDate: dog.birthDate,
            internalNotes: dog.internalNotes,
        }
        setSelectedDogForSheet(dogDetails)
        setIsDogDetailsOpen(true)
        setIsClientDetailsOpen(false)
    }

    // Handle client click from dog sheet
    const handleClientClickFromDog = (client: {
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
        setIsDogDetailsOpen(false)
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

    // Helper functions to manipulate the filter tree
    const updateNodeInTree = (node: AppointmentFilterNode, targetId: string, updater: (node: AppointmentFilterNode) => AppointmentFilterNode): AppointmentFilterNode => {
        if (node.type === "condition" && node.condition.id === targetId) {
            return updater(node)
        }
        if (node.type === "group") {
            if (node.id === targetId) {
                return updater(node)
            }
            const updatedChildren = node.children.map(child => updateNodeInTree(child, targetId, updater))
            return { ...node, children: updatedChildren }
        }
        return node
    }

    const addChildToNode = (node: AppointmentFilterNode, targetId: string, newChild: AppointmentFilterNode): AppointmentFilterNode => {
        if (node.type === "group" && node.id === targetId) {
            return { ...node, children: [...node.children, newChild] }
        }
        if (node.type === "group") {
            return { ...node, children: node.children.map(child => addChildToNode(child, targetId, newChild)) }
        }
        return node
    }

    const removeNodeFromTree = (node: AppointmentFilterNode, targetId: string, parentId?: string): AppointmentFilterNode | null => {
        if (node.type === "group" && node.id === targetId && parentId) {
            // Don't allow removing root, but allow removing its children
            return null
        }
        if (node.type === "group") {
            const updatedChildren = node.children
                .map(child => removeNodeFromTree(child, targetId, node.id))
                .filter((n): n is AppointmentFilterNode => n !== null)
            
            if (updatedChildren.length === 0 && node.id !== "root") {
                return null
            }
            return { ...node, children: updatedChildren }
        }
        if (node.type === "condition" && node.condition.id === targetId) {
            return null
        }
        return node
    }

    // Recursive component to render filter tree
    const FilterNodeComponent = ({ 
        node, 
        depth = 0, 
        isFirst = true, 
        parentOperator,
        parentGroupId 
    }: { 
        node: AppointmentFilterNode
        depth?: number
        isFirst?: boolean
        parentOperator?: "AND" | "OR"
        parentGroupId?: string
    }) => {
        if (node.type === "condition") {
            return (
                <div className="flex items-center gap-2 flex-wrap" style={{ paddingRight: `${depth * 24}px` }}>
                    {!isFirst && parentOperator && (
                        <span className="text-xs font-semibold text-blue-600 px-1">{parentOperator === "AND" ? "וגם" : "או"}</span>
                    )}
                    <Select
                        value={node.condition.type}
                        onValueChange={(value: "had_appointment" | "no_appointment") => {
                            const updated = updateNodeInTree(appointmentFilterRoot, node.condition.id, () => ({
                                type: "condition",
                                condition: { ...node.condition, type: value }
                            }))
                            if (updated) setAppointmentFilterRoot(updated)
                        }}
                    >
                        <SelectTrigger className="w-[100px] h-8 text-xs" dir="rtl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="had_appointment">היה תור</SelectItem>
                            <SelectItem value="no_appointment">לא היה תור</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={node.condition.dateRangeType}
                        onValueChange={(value: "before" | "after" | "on" | "range") => {
                            const updated = updateNodeInTree(appointmentFilterRoot, node.condition.id, () => ({
                                type: "condition",
                                condition: { 
                                    ...node.condition, 
                                    dateRangeType: value,
                                    endDate: value !== "range" ? null : node.condition.endDate
                                }
                            }))
                            if (updated) setAppointmentFilterRoot(updated)
                        }}
                    >
                        <SelectTrigger className="w-[110px] h-8 text-xs" dir="rtl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="before">לפני</SelectItem>
                            <SelectItem value="after">אחרי</SelectItem>
                            <SelectItem value="on">בתאריך</SelectItem>
                            <SelectItem value="range">טווח</SelectItem>
                        </SelectContent>
                    </Select>
                    <DatePickerInput
                        value={node.condition.startDate}
                        onChange={(date) => {
                            const updated = updateNodeInTree(appointmentFilterRoot, node.condition.id, () => ({
                                type: "condition",
                                condition: { ...node.condition, startDate: date }
                            }))
                            if (updated) setAppointmentFilterRoot(updated)
                        }}
                        placeholder="תאריך..."
                        wrapperClassName="w-[180px]"
                        displayFormat="dd/MM/yyyy"
                    />
                    {node.condition.dateRangeType === "range" && (
                        <DatePickerInput
                            value={node.condition.endDate}
                            onChange={(date) => {
                                const updated = updateNodeInTree(appointmentFilterRoot, node.condition.id, () => ({
                                    type: "condition",
                                    condition: { ...node.condition, endDate: date }
                                }))
                                if (updated) setAppointmentFilterRoot(updated)
                            }}
                            placeholder="עד..."
                            wrapperClassName="w-[180px]"
                            displayFormat="dd/MM/yyyy"
                        />
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            const updated = removeNodeFromTree(appointmentFilterRoot, node.condition.id)
                            if (updated) setAppointmentFilterRoot(updated)
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )
        } else {
            // Group node
            return (
                <div className="space-y-2" style={{ paddingRight: `${depth * 24}px` }}>
                    <div className="flex items-center gap-2 flex-wrap border-r-2 border-blue-300 pr-3 rounded bg-blue-50/30">
                        {!isFirst && parentOperator && (
                            <span className="text-xs font-semibold text-blue-600 px-1">{parentOperator === "AND" ? "וגם" : "או"}</span>
                        )}
                        <span className="text-lg font-bold text-blue-600">(</span>
                        <Select
                            value={node.operator}
                            onValueChange={(value: "AND" | "OR") => {
                                const updated = updateNodeInTree(appointmentFilterRoot, node.id, () => ({
                                    ...node,
                                    operator: value
                                }))
                                setAppointmentFilterRoot(updated)
                            }}
                        >
                            <SelectTrigger className="w-[80px] h-8 text-xs font-semibold" dir="rtl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="AND">וגם (AND)</SelectItem>
                                <SelectItem value="OR">או (OR)</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">בין כל התנאים כאן</span>
                        {node.id !== "root" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    const updated = removeNodeFromTree(appointmentFilterRoot, node.id)
                                    if (updated) setAppointmentFilterRoot(updated)
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                        <span className="text-lg font-bold text-blue-600">)</span>
                    </div>
                    <div className="space-y-2 pr-6">
                        {node.children.map((child, index) => (
                            <FilterNodeComponent
                                key={child.type === "condition" ? child.condition.id : child.id}
                                node={child}
                                depth={depth + 1}
                                isFirst={index === 0}
                                parentOperator={node.operator}
                                parentGroupId={node.id}
                            />
                        ))}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                    const newId = String(Date.now())
                                    const newCondition: AppointmentFilterNode = {
                                        type: "condition",
                                        condition: { id: newId, type: "had_appointment", dateRangeType: "range", startDate: null, endDate: null }
                                    }
                                    const updated = addChildToNode(appointmentFilterRoot, node.id, newCondition)
                                    setAppointmentFilterRoot(updated)
                                }}
                            >
                                + הוסף תנאי
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                    const newId = String(Date.now())
                                    const newGroup: AppointmentFilterNode = {
                                        type: "group",
                                        id: newId,
                                        operator: "AND",
                                        children: [{
                                            type: "condition",
                                            condition: { id: String(Date.now() + 1), type: "had_appointment", dateRangeType: "range", startDate: null, endDate: null }
                                        }]
                                    }
                                    const updated = addChildToNode(appointmentFilterRoot, node.id, newGroup)
                                    setAppointmentFilterRoot(updated)
                                }}
                            >
                                + הוסף קבוצה מקוננת ( )
                            </Button>
                        </div>
                    </div>
                </div>
            )
        }
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
                            <CardDescription>
                                {filteredCustomers.length > 0 
                                    ? `נמצאו ${filteredCustomers.length} לקוחות${customers.length !== filteredCustomers.length ? ` מתוך ${customers.length} סה"כ` : ''}`
                                    : customers.length > 0 
                                        ? `לא נמצאו תוצאות מתוך ${customers.length} לקוחות`
                                        : "רשימת כל הלקוחות במערכת"}
                            </CardDescription>
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
                                <CustomerTypeMultiSelect
                                    options={customerTypes}
                                    selectedIds={customerTypeFilter}
                                    onSelectionChange={handleCustomerTypeFilterChange}
                                    placeholder={isLoadingTypes ? "טוען..." : "בחר סוגים..."}
                                    disabled={isLoadingTypes}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">שם כלב</Label>
                                <AutocompleteFilter
                                    value={dogNameFilter}
                                    onChange={setDogNameFilter}
                                    placeholder="שם כלב..."
                                    searchFn={searchDogNames}
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
                        {/* Appointment Filter - Each Group on Its Own Line */}
                        <div className="border rounded-lg p-3 bg-gray-50">
                            <div className="flex items-center gap-2 mb-3">
                                <Checkbox
                                    checked={appointmentFilterEnabled}
                                    onCheckedChange={(checked) => {
                                        setAppointmentFilterEnabled(checked === true)
                                        if (!checked) {
                                            setAppointmentFilterGroups([{ id: "1", type: "had_appointment", dateRangeType: "range", startDate: null, endDate: null }])
                                            setAppointmentGroupOperators([])
                                            setCustomersWithAppointments(new Set())
                                        }
                                    }}
                                />
                                <Label className="text-sm font-semibold cursor-pointer whitespace-nowrap" onClick={() => setAppointmentFilterEnabled(!appointmentFilterEnabled)}>
                                    סינון לפי תורים:
                                </Label>
                                {!isLoadingAppointments && appointmentFilterEnabled && customersWithAppointments.size > 0 && (
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        ({customersWithAppointments.size} לקוחות)
                                    </span>
                                )}
                                {isLoadingAppointments && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span>טוען...</span>
                                    </div>
                                )}
                            </div>
                            {appointmentFilterEnabled && (
                                <div className="space-y-2">
                                    <FilterNodeComponent 
                                        node={appointmentFilterRoot} 
                                        depth={0} 
                                        isFirst={true}
                                    />
                                </div>
                            )}
                        </div>
                        {(customerTypeFilter.length > 0 || phoneFilter || emailFilter || nameFilter || dogNameFilter || breedFilter || appointmentFilterEnabled) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCustomerTypeFilter([])
                                    setPhoneFilter("")
                                    setEmailFilter("")
                                    setNameFilter("")
                                    setDogNameFilter("")
                                    setBreedFilter("")
                                    setAppointmentFilterEnabled(false)
                                    setAppointmentFilterRoot({
                                        type: "group",
                                        id: "root",
                                        operator: "AND",
                                        children: [
                                            { type: "condition", condition: { id: "1", type: "had_appointment", dateRangeType: "range", startDate: null, endDate: null } }
                                        ]
                                    })
                                    setCustomersWithAppointments(new Set())
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
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsWhatsAppBroadcastDialogOpen(true)}
                                        disabled={disableBulkButtons}
                                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                    >
                                        <SiWhatsapp className="ml-2 h-4 w-4" />
                                        שידור WhatsApp
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

            <WhatsAppBroadcastDialog
                open={isWhatsAppBroadcastDialogOpen}
                onOpenChange={setIsWhatsAppBroadcastDialogOpen}
                selectedCustomerIds={selectedCustomerIds}
                onSuccess={() => {
                    setIsWhatsAppBroadcastDialogOpen(false)
                    clearSelection()
                }}
            />

            {/* Client Details Sheet */}
            <ClientDetailsSheet
                open={isClientDetailsOpen}
                onOpenChange={setIsClientDetailsOpen}
                selectedClient={selectedClientForSheet}
                data={{
                    appointments: clientDogs.map(dog => ({
                        id: `dummy-${dog.id}`,
                        dogs: [dog],
                        clientName: selectedClientForSheet?.name,
                        clientClassification: selectedClientForSheet?.classification,
                    })),
                }}
                onDogClick={handleDogClick}
            />

            {/* Dog Details Sheet */}
            <DogDetailsSheet
                open={isDogDetailsOpen}
                onOpenChange={setIsDogDetailsOpen}
                selectedDog={selectedDogForSheet}
                showAllPastAppointments={false}
                setShowAllPastAppointments={() => { }}
                data={{}}
                onClientClick={handleClientClickFromDog}
                onAppointmentClick={() => { }}
                onShowDogAppointments={() => { }}
            />
        </div>
    )
}
