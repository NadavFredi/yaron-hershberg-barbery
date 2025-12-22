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
import { ClientDetailsSheet } from "@/pages/ManagerSchedule/sheets/index"
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
import { useAppDispatch } from "@/store/hooks"
import { setSelectedClient, setIsClientDetailsOpen } from "@/store/slices/managerScheduleSlice"
import type { ClientDetails } from "@/store/slices/managerScheduleSlice"

// Keep a short-lived cache so navigating away and back doesn't refetch
const CUSTOMERS_CACHE_TTL_MS = 5 * 60 * 1000
type CustomersListCache = {
    timestamp: number
    customers: Customer[]
    totalCount: number
    currentPage: number
    customerTypes: CustomerTypeSummary[]
    leadSources: LeadSourceSummary[]
    searchTerm: string
    customerTypeFilter: string[]
    leadSourceFilter: string | null
    appointmentFilterEnabled: boolean
    customersWithAppointments: Set<string>
}
let customersListCache: CustomersListCache | null = null

interface CustomerTypeSummary {
    id: string
    name: string
    priority: number
}

interface LeadSourceSummary {
    id: string
    name: string
}

interface Customer {
    id: string
    full_name: string
    phone: string
    email: string | null
    classification: 'new' | 'vip' | 'standard' | 'inactive'
    address: string | null
    send_invoice: boolean
    created_at: string
    customer_type_id: string | null
    customer_type: CustomerTypeSummary | null
    lead_source_id: string | null
    lead_source: LeadSourceSummary | null
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
    const dispatch = useAppDispatch()
    const [searchParams, setSearchParams] = useSearchParams()
    const customerTypeParam = searchParams.get("type")
    const leadSourceParam = searchParams.get("leadSource")
    // Parse comma-separated types from URL
    const customerTypeParams = customerTypeParam ? customerTypeParam.split(",").filter(Boolean) : []
    const [customers, setCustomers] = useState<Customer[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const PAGE_SIZE = 100
    const [customerTypes, setCustomerTypes] = useState<CustomerTypeSummary[]>([])
    const [isLoadingTypes, setIsLoadingTypes] = useState(false)
    const [leadSources, setLeadSources] = useState<LeadSourceSummary[]>([])
    const [isLoadingLeadSources, setIsLoadingLeadSources] = useState(false)
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
    const [leadSourceFilter, setLeadSourceFilter] = useState<string | null>(leadSourceParam)
    const [phoneFilter, setPhoneFilter] = useState("")
    const [emailFilter, setEmailFilter] = useState("")
    const [nameFilter, setNameFilter] = useState("")
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

    useEffect(() => {
        if (leadSourceParam) {
            setLeadSourceFilter(leadSourceParam)
        } else {
            setLeadSourceFilter(null)
        }
    }, [leadSourceParam])

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

    const handleLeadSourceFilterChange = (sourceId: string | null) => {
        setLeadSourceFilter(sourceId)
        const params = new URLSearchParams(searchParams.toString())
        if (sourceId) {
            params.set("leadSource", sourceId)
        } else {
            params.delete("leadSource")
        }
        setSearchParams(params, { replace: true })
    }


    const isInitialMount = useRef(true)
    const isRestoringFromCache = useRef(false)
    useEffect(() => {
        const cached = customersListCache
        const isCacheFresh = cached && Date.now() - cached.timestamp < CUSTOMERS_CACHE_TTL_MS

        if (isCacheFresh && cached) {
            isRestoringFromCache.current = true
            setCustomers(cached.customers)
            setTotalCount(cached.totalCount)
            setCurrentPage(cached.currentPage)
            setCustomerTypes(cached.customerTypes)
            setLeadSources(cached.leadSources)
            setSearchTerm(cached.searchTerm)
            setCustomerTypeFilter(cached.customerTypeFilter)
            setLeadSourceFilter(cached.leadSourceFilter)
            setAppointmentFilterEnabled(cached.appointmentFilterEnabled)
            setCustomersWithAppointments(new Set(cached.customersWithAppointments))
            setIsLoading(false)
            setIsLoadingTypes(false)
            setIsLoadingLeadSources(false)
            isInitialMount.current = false
            // Release the guard on the next tick so user actions still work
            queueMicrotask(() => {
                isRestoringFromCache.current = false
            })
            return
        }

        fetchCustomerTypes()
        fetchLeadSources()
        if (isInitialMount.current) {
            isInitialMount.current = false
            fetchCustomers(1)
        }
    }, [])

    // Track active filters (selects/autocompletes that trigger immediately)
    const [activeFilters, setActiveFilters] = useState({
        customerTypeFilter: customerTypeFilter,
        leadSourceFilter: leadSourceFilter,
        appointmentFilterEnabled: appointmentFilterEnabled,
        customersWithAppointments: customersWithAppointments,
    })

    // Reset to page 1 when active filters change (selects/autocompletes)
    useEffect(() => {
        if (isRestoringFromCache.current) return

        const filtersChanged =
            JSON.stringify(activeFilters.customerTypeFilter) !== JSON.stringify(customerTypeFilter) ||
            activeFilters.leadSourceFilter !== leadSourceFilter ||
            activeFilters.appointmentFilterEnabled !== appointmentFilterEnabled ||
            activeFilters.customersWithAppointments.size !== customersWithAppointments.size

        if (filtersChanged) {
            setActiveFilters({
                customerTypeFilter: customerTypeFilter,
                leadSourceFilter: leadSourceFilter,
                appointmentFilterEnabled: appointmentFilterEnabled,
                customersWithAppointments: customersWithAppointments,
            })
            setCurrentPage(1)
            fetchCustomers(1)
        }
    }, [customerTypeFilter, leadSourceFilter, appointmentFilterEnabled, customersWithAppointments])

    // Fetch customers when page changes
    useEffect(() => {
        // Skip initial mount - handled separately
        if (isInitialMount.current || isRestoringFromCache.current) return

        fetchCustomers(currentPage)
    }, [currentPage])

    // Function to trigger search manually (called on Enter or Search button click)
    const triggerSearch = () => {
        setCurrentPage(1)
        fetchCustomers(1)
    }

    // Handle Enter key in text inputs
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            triggerSearch()
        }
    }

    const fetchLeadSources = async () => {
        try {
            setIsLoadingLeadSources(true)
            console.log("🔍 [CustomersListPage] Fetching lead sources...")
            const { data, error } = await supabase
                .from("lead_sources")
                .select("id, name")
                .order("name", { ascending: true })

            if (error) throw error
            const sources = (data || []).map((source) => ({
                id: source.id,
                name: source.name,
            })) as LeadSourceSummary[]
            setLeadSources(sources)
            console.log("✅ [CustomersListPage] Loaded lead sources:", sources)
        } catch (error) {
            console.error("❌ [CustomersListPage] Failed to load lead sources:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את מקורות ההגעה",
                variant: "destructive",
            })
        } finally {
            setIsLoadingLeadSources(false)
        }
    }

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

    // Cache the latest state on unmount so returning to this tab won't refetch
    useEffect(() => {
        return () => {
            customersListCache = {
                timestamp: Date.now(),
                customers,
                totalCount,
                currentPage,
                customerTypes,
                leadSources,
                searchTerm,
                customerTypeFilter,
                leadSourceFilter,
                appointmentFilterEnabled,
                customersWithAppointments,
            }
        }
    }, [
        customers,
        totalCount,
        currentPage,
        customerTypes,
        leadSources,
        searchTerm,
        customerTypeFilter,
        leadSourceFilter,
        appointmentFilterEnabled,
        customersWithAppointments,
    ])

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

    const fetchCustomers = async (page: number) => {
        try {
            setIsLoading(true)
            console.log("🔍 [CustomersListPage] Fetching customers with filters:", {
                searchTerm,
                customerTypeFilter,
                leadSourceFilter,
                phoneFilter,
                emailFilter,
                nameFilter,
                appointmentFilterEnabled,
                page
            })

            let query = supabase
                .from("customers")
                .select(`
                    *,
                    customer_type:customer_types(id, name, priority),
                    lead_source:lead_sources(id, name)
                `, { count: 'exact' })
                .order("created_at", { ascending: false })

            // Search term filter (searches across name, phone, email)
            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
            }

            // Name filter
            if (nameFilter) {
                query = query.ilike("full_name", `%${nameFilter}%`)
            }

            // Phone filter
            if (phoneFilter) {
                query = query.ilike("phone", `%${phoneFilter}%`)
            }

            // Email filter
            if (emailFilter) {
                query = query.ilike("email", `%${emailFilter}%`)
            }

            // Customer type filter (multiselect)
            if (customerTypeFilter.length > 0) {
                const hasNoneType = customerTypeFilter.includes("none")
                const typeIds = customerTypeFilter.filter(id => id !== "none")

                if (hasNoneType && typeIds.length > 0) {
                    // Include customers with no type OR with matching types
                    // Use PostgREST OR syntax: field1.op1.val1,field2.op2.val2
                    query = query.or(`customer_type_id.is.null,customer_type_id.in.(${typeIds.join(",")})`)
                } else if (hasNoneType) {
                    // Only customers with no type
                    query = query.is("customer_type_id", null)
                } else if (typeIds.length > 0) {
                    // Only customers with matching types
                    query = query.in("customer_type_id", typeIds)
                }
            }

            // Lead source filter
            if (leadSourceFilter) {
                if (leadSourceFilter === "none") {
                    query = query.is("lead_source_id", null)
                } else {
                    query = query.eq("lead_source_id", leadSourceFilter)
                }
            }

            // Appointment filter (filter by customer IDs from appointments)
            if (appointmentFilterEnabled) {
                if (customersWithAppointments.size > 0) {
                    query = query.in("id", Array.from(customersWithAppointments))
                } else {
                    // If appointment filter is enabled but no matching customers, return empty result
                    // Use a condition that will never match
                    query = query.eq("id", "00000000-0000-0000-0000-000000000000")
                }
            }

            // Apply pagination
            const from = (page - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1
            query = query.range(from, to)

            const { data, error, count } = await query

            if (error) throw error
            setCustomers(data || [])
            setTotalCount(count || 0)
            setCurrentPage(page)
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
            ; (groomingResult.data || []).forEach((apt: any) => {
                if (apt.customer_id) customerIds.add(apt.customer_id)
            })
            ; (daycareResult.data || []).forEach((apt: any) => {
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



    const selectedCount = selectedCustomerIds.length
    const isAllSelected = customers.length > 0 && selectedCount === customers.length
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
            const ids = customers.map((customer) => customer.id)
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
                const rangeIds = customers.slice(start, end + 1).map((customer) => customer.id)
                applyIds(rangeIds)
            } else {
                applyIds([customerId])
            }

            return customers.map((customer) => customer.id).filter((id) => selectionSet.has(id))
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
            fetchCustomers(currentPage)
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
            fetchCustomers(currentPage)
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
            fetchCustomers(currentPage)
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
        try {
            // Fetch the most updated customer data from the API
            const { data: freshCustomerData, error } = await supabase
                .from("customers")
                .select(`
                    id,
                    full_name,
                    phone,
                    email,
                    address,
                    classification,
                    customer_type_id,
                    customer_type:customer_types (
                        id,
                        name
                    )
                `)
                .eq("id", customer.id)
                .single()

            if (error) throw error

            if (!freshCustomerData) {
                toast({
                    title: "שגיאה",
                    description: "לא ניתן לטעון את פרטי הלקוח",
                    variant: "destructive",
                })
                return
            }

            // Create ClientDetails object with fresh data
            const clientDetails: ClientDetails = {
                name: freshCustomerData.full_name || customer.full_name,
                phone: freshCustomerData.phone || customer.phone,
                email: freshCustomerData.email || customer.email || undefined,
                classification: freshCustomerData.classification || customer.classification,
                customerTypeName: (freshCustomerData.customer_type as any)?.name || customer.customer_type?.name || undefined,
                address: freshCustomerData.address || customer.address || undefined,
                clientId: freshCustomerData.id,
                recordId: freshCustomerData.id,
            }

            // Set the selected client in Redux and open the sheet
            dispatch(setSelectedClient(clientDetails))
            dispatch(setIsClientDetailsOpen(true))
        } catch (error) {
            console.error("Error fetching customer data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את פרטי הלקוח",
                variant: "destructive",
            })
        }
    }


    const handleAdd = () => {
        setIsAddDialogOpen(true)
    }

    const handleEdit = (customer: Customer) => {
        setEditingCustomerId(customer.id)
        setIsEditDialogOpen(true)
    }

    const handleAddSuccess = () => {
        setIsAddDialogOpen(false)
        fetchCustomers(currentPage)
    }

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false)
        setEditingCustomerId(null)
        fetchCustomers(currentPage)
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
            fetchCustomers(currentPage)
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
            vip: "VIP",
            standard: "רגיל",
            inactive: "לא פעיל",
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
                        <span className="text-xs font-semibold text-primary px-1">{parentOperator === "AND" ? "וגם" : "או"}</span>
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
                    <div className="flex items-center gap-2 flex-wrap border-r-2 border-primary/30 pr-3 rounded bg-primary/10/30">
                        {!isFirst && parentOperator && (
                            <span className="text-xs font-semibold text-primary px-1">{parentOperator === "AND" ? "וגם" : "או"}</span>
                        )}
                        <span className="text-lg font-bold text-primary">(</span>
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
                        <span className="text-lg font-bold text-primary">)</span>
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
                                {totalCount > 0
                                    ? `נמצאו ${totalCount} לקוחות${customers.length < totalCount ? ` (מציג ${customers.length} מתוכם)` : ''}`
                                    : "לא נמצאו לקוחות"}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        placeholder="חפש לקוחות..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={handleSearchKeyDown}
                                        className="pr-10 w-64"
                                        dir="rtl"
                                    />
                                </div>
                                {searchTerm && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10"
                                        onClick={() => {
                                            setSearchTerm("")
                                            triggerSearch()
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button onClick={triggerSearch} variant="outline" size="icon">
                                    <Search className="h-4 w-4" />
                                </Button>
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
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <AutocompleteFilter
                                            value={nameFilter}
                                            onChange={setNameFilter}
                                            onSelect={(value) => {
                                                setNameFilter(value)
                                            }}
                                            onEnter={triggerSearch}
                                            placeholder="שם לקוח..."
                                            searchFn={searchCustomerNames}
                                            minSearchLength={0}
                                            autoSearchOnFocus
                                            initialLoadOnMount
                                            initialResultsLimit={5}
                                        />
                                    </div>
                                    {nameFilter && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10"
                                            onClick={() => {
                                                setNameFilter("")
                                                triggerSearch()
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10"
                                        onClick={triggerSearch}
                                    >
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">טלפון</Label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <AutocompleteFilter
                                            value={phoneFilter}
                                            onChange={setPhoneFilter}
                                            onSelect={(value) => {
                                                setPhoneFilter(value)
                                            }}
                                            onEnter={triggerSearch}
                                            placeholder="טלפון..."
                                            searchFn={searchCustomerPhones}
                                            minSearchLength={0}
                                            autoSearchOnFocus
                                            initialLoadOnMount
                                            initialResultsLimit={5}
                                        />
                                    </div>
                                    {phoneFilter && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10"
                                            onClick={() => {
                                                setPhoneFilter("")
                                                triggerSearch()
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10"
                                        onClick={triggerSearch}
                                    >
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">אימייל</Label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <AutocompleteFilter
                                            value={emailFilter}
                                            onChange={setEmailFilter}
                                            onSelect={(value) => {
                                                setEmailFilter(value)
                                            }}
                                            onEnter={triggerSearch}
                                            placeholder="אימייל..."
                                            searchFn={searchCustomerEmails}
                                            minSearchLength={0}
                                            autoSearchOnFocus
                                            initialLoadOnMount
                                            initialResultsLimit={5}
                                        />
                                    </div>
                                    {emailFilter && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10"
                                            onClick={() => {
                                                setEmailFilter("")
                                                triggerSearch()
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10"
                                        onClick={triggerSearch}
                                    >
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </div>
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
                                <Label className="text-sm mb-2 block">מקור הגעה</Label>
                                <Select
                                    value={leadSourceFilter || "all"}
                                    onValueChange={(value) => handleLeadSourceFilterChange(value === "all" ? null : value === "none" ? "none" : value)}
                                    disabled={isLoadingLeadSources}
                                >
                                    <SelectTrigger dir="rtl" className="text-right">
                                        <SelectValue placeholder={isLoadingLeadSources ? "טוען..." : "כל המקורות"} />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">כל המקורות</SelectItem>
                                        <SelectItem value="none">ללא מקור</SelectItem>
                                        {leadSources.map((source) => (
                                            <SelectItem key={source.id} value={source.id}>
                                                {source.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                            setAppointmentFilterRoot({
                                                type: "group",
                                                id: "root",
                                                operator: "AND",
                                                children: [
                                                    { type: "condition", condition: { id: "1", type: "had_appointment", dateRangeType: "range", startDate: null, endDate: null } }
                                                ]
                                            })
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
                        {(customerTypeFilter.length > 0 || leadSourceFilter || phoneFilter || emailFilter || nameFilter || searchTerm || appointmentFilterEnabled) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCustomerTypeFilter([])
                                    setLeadSourceFilter(null)
                                    setPhoneFilter("")
                                    setEmailFilter("")
                                    setNameFilter("")
                                    setSearchTerm("")
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
                                    const params = new URLSearchParams(searchParams.toString())
                                    params.delete("type")
                                    params.delete("leadSource")
                                    setSearchParams(params, { replace: true })
                                    // Trigger search after clearing filters
                                    triggerSearch()
                                }}
                            >
                                נקה כל הסינונים
                            </Button>
                        )}
                        {(selectedCount > 0) && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4">
                                <div className="flex flex-col text-right text-primary">
                                    <span className="text-sm font-semibold">נבחרו {selectedCount} לקוחות</span>
                                    <span className="text-xs text-primary/80">באפשרותך לבצע פעולות מרובות על כל הלקוחות שנבחרו</span>
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
                                                    disabled={customers.length === 0 || disableSelection}
                                                />
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">שם מלא</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">טלפון</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">אימייל</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">סיווג</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">סוג מותאם</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">מקור הגעה</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">כתובת</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">שלח חשבונית</TableHead>
                                        <TableHead className="text-right align-middle font-medium text-primary font-semibold">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                                לא נמצאו לקוחות
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        customers.map((customer, index) => (
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
                                                <TableCell>{(customer as any).lead_source?.name || "ללא מקור"}</TableCell>
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
                    {/* Pagination Controls */}
                    {totalCount > PAGE_SIZE && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                                מציג {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} מתוך {totalCount} לקוחות
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1 || isLoading}
                                >
                                    הקודם
                                </Button>
                                <div className="text-sm">
                                    עמוד {currentPage} מתוך {Math.ceil(totalCount / PAGE_SIZE)}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / PAGE_SIZE), prev + 1))}
                                    disabled={currentPage >= Math.ceil(totalCount / PAGE_SIZE) || isLoading}
                                >
                                    הבא
                                </Button>
                            </div>
                        </div>
                    )}
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
                data={{
                    appointments: [],
                }}
            />

        </div>
    )
}
