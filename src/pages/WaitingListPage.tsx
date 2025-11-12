import { useState, useEffect, useMemo, Fragment } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import {
    Loader2,
    CheckCircle,
    XCircle,
    MessageSquare,
    Calendar,
    Search,
    Sparkles,
    User,
    ShieldCheck,
    Globe,
    Scissors,
    Bone,
    ChevronDown,
    ChevronUp,
    Clock,
    Phone,
    Mail,
    AlertCircle,
    CalendarCheck,
    X,
    MoreHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { useCreateManagerAppointmentMutation } from "@/store/services/supabaseApi"
import { DatePickerInput } from "@/components/DatePickerInput"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { AddWaitlistEntryModal } from "@/components/dialogs/AddWaitlistEntryModal"
import { Plus } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface WaitlistEntry {
    id: string
    customer_id: string
    treatment_id: string | null
    service_scope: 'grooming' | 'daycare' | 'both'
    status: 'active' | 'fulfilled' | 'cancelled'
    start_date: string
    end_date: string | null
    notes: string | null
    created_at: string
    updated_at: string
    customer?: {
        id: string
        full_name: string
        phone: string
        email: string | null
    }
    treatment?: {
        id: string
        name: string
        treatment_type_id: string | null
        treatmentType?: {
            id: string
            name: string
            size_class: string | null
        }
        treatment_types?: Array<{ id: string; name: string }>
        treatment_categories?: Array<{ id: string; name: string }>
    }
}

interface SuggestionData {
    suggestedDate: Date | null
    suggestedTime: string
    notes: string
}

export default function WaitingListPage() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'fulfilled' | 'cancelled'>('active')
    const [serviceFilter, setServiceFilter] = useState<'all' | 'grooming' | 'daycare' | 'both'>('all')

    // New filters
    const [phoneFilter, setPhoneFilter] = useState("")
    const [customerNameFilter, setCustomerNameFilter] = useState("")
    const [treatmentNameFilter, setTreatmentNameFilter] = useState("")
    const [emailFilter, setEmailFilter] = useState("")
    const [treatmentTypeFilter, setTreatmentTypeFilter] = useState<string>("all")
    const [category1Filter, setCategory1Filter] = useState<string>("all") // treatment_types
    const [category2Filter, setCategory2Filter] = useState<string>("all") // treatment_categories
    const [startDateFilter, setStartDateFilter] = useState<Date | null>(null)
    const [endDateFilter, setEndDateFilter] = useState<Date | null>(null)
    const [singleDateFilter, setSingleDateFilter] = useState<Date | null>(null)

    // Filter options
    const [treatmentTypes, setTreatmentTypes] = useState<Array<{ id: string; name: string }>>([])
    const [treatmentCategories, setTreatmentCategories] = useState<Array<{ id: string; name: string }>>([])
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
    const [suggestDialogOpen, setSuggestDialogOpen] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)
    const [approveDate, setApproveDate] = useState<Date | null>(null)
    const [approveTime, setApproveTime] = useState<string>("")
    const [approveNotes, setApproveNotes] = useState<string>("")
    const [declineReason, setDeclineReason] = useState<string>("")
    const [suggestion, setSuggestion] = useState<SuggestionData>({ suggestedDate: null, suggestedTime: "", notes: "" })
    const [isProcessing, setIsProcessing] = useState(false)
    const [createAppointment] = useCreateManagerAppointmentMutation()
    const [isAddWaitlistModalOpen, setIsAddWaitlistModalOpen] = useState(false)

    useEffect(() => {
        loadWaitlistEntries()
        loadFilterOptions()
    }, [])

    const loadFilterOptions = async () => {
        try {
            // Load treatment types (category 1)
            const { data: typesData } = await supabase
                .from("treatment_types")
                .select("id, name")
                .order("name")

            if (typesData) setTreatmentTypes(typesData)

            // Load treatment categories (category 2)
            const { data: categoriesData } = await supabase
                .from("treatment_categories")
                .select("id, name")
                .order("name")

            if (categoriesData) setTreatmentCategories(categoriesData)
        } catch (error) {
            console.error("Error loading filter options:", error)
        }
    }

    // Search functions for autocomplete filters
    const searchPhoneNumbers = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("customers")
            .select("phone")
            .not("phone", "is", null)

        if (trimmedTerm.length >= 2) {
            const pattern = "%" + trimmedTerm + "%"
            query = query.ilike("phone", pattern).limit(10)
        } else {
            query = query.order("phone", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.phone).filter(Boolean))] as string[]
    }

    const searchCustomerNames = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("customers")
            .select("full_name")
            .not("full_name", "is", null)

        if (trimmedTerm.length >= 2) {
            const pattern = "%" + trimmedTerm + "%"
            query = query.ilike("full_name", pattern).limit(10)
        } else {
            query = query.order("full_name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.full_name).filter(Boolean))] as string[]
    }

    const searchTreatmentNames = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("services")
            .select("name")
            .not("name", "is", null)

        if (trimmedTerm.length >= 2) {
            const pattern = "%" + trimmedTerm + "%"
            query = query.ilike("name", pattern).limit(10)
        } else {
            query = query.order("name", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(d => d.name).filter(Boolean))] as string[]
    }

    const searchEmails = async (searchTerm: string): Promise<string[]> => {
        const trimmedTerm = searchTerm.trim()
        let query = supabase
            .from("customers")
            .select("email")
            .not("email", "is", null)

        if (trimmedTerm.length >= 2) {
            const pattern = "%" + trimmedTerm + "%"
            query = query.ilike("email", pattern).limit(10)
        } else {
            query = query.order("email", { ascending: true }).limit(5)
        }

        const { data, error } = await query

        if (error) throw error
        return [...new Set((data || []).map(c => c.email).filter(Boolean))] as string[]
    }

    const loadWaitlistEntries = async () => {
        setIsLoading(true)
        try {
            // First, get all waitlist entries
            const { data: waitlistData, error: waitlistError } = await supabase
                .from("waitlist")
                .select("*")
                .order("created_at", { ascending: false })

            if (waitlistError) throw waitlistError

            if (!waitlistData || waitlistData.length === 0) {
                setWaitlistEntries([])
                setIsLoading(false)
                return
            }

            // Get unique customer and service IDs
            const customerIds = [...new Set(waitlistData.map(e => e.customer_id))]
            const serviceIds = [...new Set(waitlistData.map(e => e.service_id).filter((id): id is string => Boolean(id)))]

            // Fetch customers
            const { data: customersData } = await supabase
                .from("customers")
                .select("id, full_name, phone, email")
                .in("id", customerIds)

            // Fetch services (treatments table no longer exists)
            let servicesData: any[] = []
            if (serviceIds.length > 0) {
                const { data: fetchedServices } = await supabase
                    .from("services")
                    .select(
                        "id, name, description, category"
                    )
                    .in("id", serviceIds)
                servicesData = fetchedServices || []
            }

            // Build lookup maps
            const customersMap = new Map((customersData || []).map(c => [c.id, c]))
            const servicesMap = new Map((servicesData || []).map(d => [d.id, d]))

            // Transform the data
            const transformedData: WaitlistEntry[] = waitlistData.map((entry: any) => {
                const service = servicesMap.get(entry.service_id)

                return {
                    ...entry,
                    customer: customersMap.get(entry.customer_id) || undefined,
                    treatment: service ? {
                        id: service.id,
                        name: service.name,
                        treatment_type_id: null, // Services don't have treatment_type_id
                        treatmentType: service.category ? { id: "", name: service.category } : null,
                        treatment_types: [],
                        treatment_categories: []
                    } : undefined
                }
            })

            setWaitlistEntries(transformedData)
        } catch (error) {
            console.error("Error loading waitlist entries:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את רשימת ההמתנה",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const filteredEntries = useMemo(() => {
        return waitlistEntries.filter(entry => {
            // Status filter
            if (statusFilter !== 'all' && entry.status !== statusFilter) return false

            // Service filter
            if (serviceFilter !== 'all' && entry.service_scope !== serviceFilter) return false

            // Phone filter
            if (phoneFilter) {
                const phone = entry.customer?.phone?.toLowerCase() || ""
                if (!phone.includes(phoneFilter.toLowerCase())) return false
            }

            // Customer name filter
            if (customerNameFilter) {
                const customerName = entry.customer?.full_name?.toLowerCase() || ""
                if (!customerName.includes(customerNameFilter.toLowerCase())) return false
            }

            // Treatment name filter
            if (treatmentNameFilter) {
                const treatmentName = entry.treatment?.name?.toLowerCase() || ""
                if (!treatmentName.includes(treatmentNameFilter.toLowerCase())) return false
            }

            // Email filter
            if (emailFilter) {
                const email = entry.customer?.email?.toLowerCase() || ""
                if (!email.includes(emailFilter.toLowerCase())) return false
            }

            // TreatmentType filter
            if (treatmentTypeFilter !== "all") {
                if (entry.treatment?.treatment_type_id !== treatmentTypeFilter) return false
            }

            // Category 1 filter (treatment_types)
            if (category1Filter !== "all") {
                const hasCategory1 = entry.treatment?.treatment_types?.some(
                    type => type.id === category1Filter
                )
                if (!hasCategory1) return false
            }

            // Category 2 filter (treatment_categories)
            if (category2Filter !== "all") {
                const hasCategory2 = entry.treatment?.treatment_categories?.some(
                    category => category.id === category2Filter
                )
                if (!hasCategory2) return false
            }

            // Single date filter (show all waiting treatments on this date)
            if (singleDateFilter) {
                const filterDate = format(singleDateFilter, 'yyyy-MM-dd')
                const startDate = format(new Date(entry.start_date), 'yyyy-MM-dd')
                const endDate = entry.end_date ? format(new Date(entry.end_date), 'yyyy-MM-dd') : null

                // Check if filterDate falls within the waitlist entry's date range
                if (filterDate < startDate) return false
                if (endDate && filterDate > endDate) return false
            }

            // Start date filter
            if (startDateFilter) {
                const filterStartDate = format(startDateFilter, 'yyyy-MM-dd')
                const entryStartDate = format(new Date(entry.start_date), 'yyyy-MM-dd')
                if (entryStartDate < filterStartDate) return false
            }

            // End date filter
            if (endDateFilter) {
                const filterEndDate = format(endDateFilter, 'yyyy-MM-dd')
                const entryEndDate = entry.end_date
                    ? format(new Date(entry.end_date), 'yyyy-MM-dd')
                    : '9999-12-31' // If no end_date, treat as infinite
                if (entryEndDate > filterEndDate) return false
            }

            // Search filter (general search)
            if (searchTerm) {
                const term = searchTerm.toLowerCase()
                const customerName = entry.customer?.full_name?.toLowerCase() || ""
                const treatmentName = entry.treatment?.name?.toLowerCase() || ""
                const treatmentTypeName = entry.treatment?.treatmentType?.name?.toLowerCase() || ""
                const phone = entry.customer?.phone?.toLowerCase() || ""

                if (!customerName.includes(term) &&
                    !treatmentName.includes(term) &&
                    !treatmentTypeName.includes(term) &&
                    !phone.includes(term)) {
                    return false
                }
            }

            return true
        })
    }, [
        waitlistEntries,
        statusFilter,
        serviceFilter,
        searchTerm,
        phoneFilter,
        customerNameFilter,
        treatmentNameFilter,
        emailFilter,
        treatmentTypeFilter,
        category1Filter,
        category2Filter,
        startDateFilter,
        endDateFilter,
        singleDateFilter
    ])

    const handleApprove = async () => {
        if (!selectedEntry || !approveDate || !approveTime) {
            toast({
                title: "שגיאה",
                description: "יש לבחור תאריך ושעה",
                variant: "destructive",
            })
            return
        }

        setIsProcessing(true)
        try {
            // Combine date and time
            const [hours, minutes] = approveTime.split(':').map(Number)
            const startTime = new Date(approveDate)
            startTime.setHours(hours, minutes, 0, 0)

            // Calculate end time based on service type and treatmentType (default 60 minutes for grooming, 480 for daycare)
            const endTime = new Date(startTime)
            const durationMinutes = selectedEntry.service_scope === 'daycare' ? 480 : 60
            endTime.setMinutes(endTime.getMinutes() + durationMinutes)

            // Create appointment using the mutation
            const serviceType = selectedEntry.service_scope === 'grooming' ? 'grooming' :
                selectedEntry.service_scope === 'daycare' ? 'daycare' : 'grooming'

            await createAppointment({
                customerId: selectedEntry.customer_id,
                treatmentId: selectedEntry.treatment_id,
                serviceType,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                notes: approveNotes || undefined,
                internalNotes: "נוצר מרשימת המתנה (" + selectedEntry.id + ")"
            }).unwrap()

            // Update waitlist entry status
            await supabase
                .from("waitlist")
                .update({ status: 'fulfilled' })
                .eq("id", selectedEntry.id)

            toast({
                title: "הצלחה",
                description: "התור נוצר ואושר בהצלחה",
            })

            setApproveDialogOpen(false)
            setSelectedEntry(null)
            setApproveDate(null)
            setApproveTime("")
            setApproveNotes("")
            loadWaitlistEntries()
        } catch (error) {
            console.error("Error approving waitlist entry:", error)
            toast({
                title: "שגיאה",
                description: error instanceof Error ? error.message : "לא ניתן ליצור את התור",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDecline = async () => {
        if (!selectedEntry) return

        setIsProcessing(true)
        try {
            const existingNotes = selectedEntry.notes || ""
            let updatedNotes = existingNotes
            if (declineReason) {
                const prefix = existingNotes ? existingNotes + "\n" : ""
                updatedNotes = prefix + "סיבה לדחייה: " + declineReason
            }

            await supabase
                .from("waitlist")
                .update({
                    status: 'cancelled',
                    notes: updatedNotes.trim()
                })
                .eq("id", selectedEntry.id)

            toast({
                title: "הצלחה",
                description: "הבקשה נדחתה",
            })

            setDeclineDialogOpen(false)
            setSelectedEntry(null)
            setDeclineReason("")
            loadWaitlistEntries()
        } catch (error) {
            console.error("Error declining waitlist entry:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לדחות את הבקשה",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSuggest = async () => {
        if (!selectedEntry || !suggestion.suggestedDate || !suggestion.suggestedTime) {
            toast({
                title: "שגיאה",
                description: "יש לבחור תאריך ושעה מוצעים",
                variant: "destructive",
            })
            return
        }

        setIsProcessing(true)
        try {
            const formattedDate = format(suggestion.suggestedDate, "dd/MM/yyyy", { locale: he })
            const baseSuggestionText = "הצעה: " + formattedDate + " בשעה " + suggestion.suggestedTime
            const suggestionText = suggestion.notes ? baseSuggestionText + "\n" + suggestion.notes : baseSuggestionText

            await supabase
                .from("waitlist")
                .update({
                    notes: selectedEntry.notes ? selectedEntry.notes + "\n\n" + suggestionText : suggestionText
                })
                .eq("id", selectedEntry.id)

            toast({
                title: "הצלחה",
                description: "ההצעה נשמרה בהערות",
            })

            setSuggestDialogOpen(false)
            setSelectedEntry(null)
            setSuggestion({ suggestedDate: null, suggestedTime: "", notes: "" })
            loadWaitlistEntries()
        } catch (error) {
            console.error("Error suggesting waitlist entry:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לשמור את ההצעה",
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleViewInCalendar = (entry: WaitlistEntry) => {
        // Navigate to ManagerSchedule with waitlist preview context
        const previewDate = entry.start_date ? new Date(entry.start_date) : new Date()
        navigate(
            "/manager?previewWaitlist=" +
            entry.id +
            "&date=" +
            format(previewDate, "yyyy-MM-dd")
        )
    }

    const getServiceBadge = (service: string) => {
        const badges = {
            grooming: { label: "מספרה", icon: Scissors, color: "bg-blue-100 text-blue-800 border-blue-200" },
            daycare: { label: "גן", icon: Bone, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
            both: { label: "שניהם", icon: CalendarCheck, color: "bg-purple-100 text-purple-800 border-purple-200" }
        }
        const badge = badges[service as keyof typeof badges] || badges.grooming
        const Icon = badge.icon
        return (
            <Badge variant="outline" className={cn("flex items-center gap-1", badge.color)}>
                <Icon className="h-3 w-3" />
                {badge.label}
            </Badge>
        )
    }

    const getSizeLabel = (size: string | null) => {
        const sizes: Record<string, string> = {
            small: "קטן",
            medium: "בינוני",
            medium_large: "בינוני-גדול",
            large: "גדול"
        }
        return sizes[size || ''] || "-"
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען רשימת המתנה...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6" dir="rtl">

            {/* Filters and Search */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>רשימת המתנה</CardTitle>
                            <CardDescription>סנן את רשימת ההמתנה לפי קריטריונים שונים</CardDescription>
                        </div>
                        <Button
                            onClick={() => setIsAddWaitlistModalOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            הוסף לרשימת המתנה
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Basic Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="חיפוש כללי..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pr-10"
                                dir="rtl"
                            />
                        </div>

                        <Select value={serviceFilter} onValueChange={(v: any) => setServiceFilter(v)}>
                            <SelectTrigger dir="rtl">
                                <SelectValue placeholder="סוג שירות" />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="grooming">מספרה</SelectItem>
                                <SelectItem value="daycare">גן</SelectItem>
                                <SelectItem value="both">שניהם</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Customer/Treatment Details Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label className="text-sm mb-2 block">שם לקוח</Label>
                            <AutocompleteFilter
                                value={customerNameFilter}
                                onChange={setCustomerNameFilter}
                                placeholder="שם לקוח..."
                                searchFn={searchCustomerNames}
                                minSearchLength={0}
                                autoSearchOnFocus
                                initialLoadOnMount
                                initialResultsLimit={5}
                            />
                        </div>
                        <div>
                            <Label className="text-sm mb-2 block">שם לקוח</Label>
                            <AutocompleteFilter
                                value={treatmentNameFilter}
                                onChange={setTreatmentNameFilter}
                                placeholder="שם לקוח..."
                                searchFn={searchTreatmentNames}
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
                                searchFn={searchPhoneNumbers}
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
                                searchFn={searchEmails}
                                minSearchLength={0}
                                autoSearchOnFocus
                                initialLoadOnMount
                                initialResultsLimit={5}
                            />
                        </div>
                    </div>

                    {/* TreatmentType and Categories Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label className="text-sm mb-2 block">גזע</Label>
                            <Select value={treatmentTypeFilter} onValueChange={setTreatmentTypeFilter}>
                                <SelectTrigger dir="rtl">
                                    <SelectValue placeholder="בחר גזע" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">הכל</SelectItem>
                                    {treatmentTypes.map(treatmentType => (
                                        <SelectItem key={treatmentType.id} value={treatmentType.id}>{treatmentType.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-sm mb-2 block">קטגוריה 1</Label>
                            <Select value={category1Filter} onValueChange={setCategory1Filter}>
                                <SelectTrigger dir="rtl">
                                    <SelectValue placeholder="בחר קטגוריה 1" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">הכל</SelectItem>
                                    {treatmentTypes.map(type => (
                                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-sm mb-2 block">קטגוריה 2</Label>
                            <Select value={category2Filter} onValueChange={setCategory2Filter}>
                                <SelectTrigger dir="rtl">
                                    <SelectValue placeholder="בחר קטגוריה 2" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">הכל</SelectItem>
                                    {treatmentCategories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Date Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label className="text-sm mb-2 block">תאריך התחלה מינימום</Label>
                            <DatePickerInput
                                value={startDateFilter}
                                onChange={setStartDateFilter}
                                displayFormat="dd/MM/yyyy"
                                className="w-full text-right"
                            />
                        </div>
                        <div>
                            <Label className="text-sm mb-2 block">תאריך סיום מקסימום</Label>
                            <DatePickerInput
                                value={endDateFilter}
                                onChange={setEndDateFilter}
                                displayFormat="dd/MM/yyyy"
                                className="w-full text-right"
                            />
                        </div>
                        <div>
                            <Label className="text-sm mb-2 block">הצג לקוחות ממתינים בתאריך זה</Label>
                            <DatePickerInput
                                value={singleDateFilter}
                                onChange={setSingleDateFilter}
                                displayFormat="dd/MM/yyyy"
                                className="w-full text-right"
                            />
                            {singleDateFilter && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSingleDateFilter(null)}
                                    className="mt-2"
                                >
                                    <X className="h-3 w-3 ml-1" />
                                    נקה תאריך
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(phoneFilter || customerNameFilter || treatmentNameFilter || emailFilter ||
                        treatmentTypeFilter !== "all" || category1Filter !== "all" || category2Filter !== "all" ||
                        startDateFilter || endDateFilter || singleDateFilter) && (
                            <div className="flex justify-start pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setPhoneFilter("")
                                        setCustomerNameFilter("")
                                        setTreatmentNameFilter("")
                                        setEmailFilter("")
                                        setTreatmentTypeFilter("all")
                                        setCategory1Filter("all")
                                        setCategory2Filter("all")
                                        setStartDateFilter(null)
                                        setEndDateFilter(null)
                                        setSingleDateFilter(null)
                                    }}
                                >
                                    <X className="h-4 w-4 ml-2" />
                                    נקה כל הסינונים
                                </Button>
                            </div>
                        )}
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>סה"כ בקשות</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{waitlistEntries.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>פעיל</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {waitlistEntries.filter(e => e.status === 'active').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>מבוצע</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {waitlistEntries.filter(e => e.status === 'fulfilled').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>בוטל</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-600">
                            {waitlistEntries.filter(e => e.status === 'cancelled').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Waitlist Entries */}
            {filteredEntries.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">לא נמצאו בקשות ברשימת ההמתנה</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="border rounded-lg bg-white shadow-sm">
                    <div className="overflow-x-auto overflow-y-auto max-h-[700px] [direction:ltr] custom-scrollbar">
                        <div className="[direction:rtl]">
                            <table className="w-full caption-bottom text-sm">
                                <thead>
                                    <tr className="border-b bg-[hsl(228_36%_95%)] text-right text-primary [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[hsl(228_36%_95%)]">
                                        <th className="h-12 w-12 text-center align-middle font-semibold"></th>
                                        <th className="h-12 px-3 align-middle font-semibold">שם הלקוח</th>
                                        <th className="h-12 px-3 align-middle font-semibold">גזע</th>
                                        <th className="h-12 px-3 align-middle font-semibold">קטגוריות</th>
                                        <th className="h-12 px-3 align-middle font-semibold">גודל</th>
                                        <th className="h-12 px-3 align-middle font-semibold text-center">טווח המתנה</th>
                                        <th className="h-12 px-3 align-middle font-semibold text-center w-32">סטטוס</th>
                                        <th className="h-12 px-3 align-middle font-semibold text-center w-16">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {filteredEntries.map((entry) => (
                                        <WaitlistEntryRow
                                            key={entry.id}
                                            entry={entry}
                                            isExpanded={expandedEntryId === entry.id}
                                            onExpand={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                                            onApprove={() => {
                                                setSelectedEntry(entry)
                                                setApproveDialogOpen(true)
                                            }}
                                            onDecline={() => {
                                                setSelectedEntry(entry)
                                                setDeclineDialogOpen(true)
                                            }}
                                            onSuggest={() => {
                                                setSelectedEntry(entry)
                                                setSuggestDialogOpen(true)
                                            }}
                                            onViewInCalendar={() => handleViewInCalendar(entry)}
                                            getSizeLabel={getSizeLabel}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Dialog */}
            <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogContent className="sm:max-w-[500px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>אשר בקשה מרשימת המתנה</DialogTitle>
                        <DialogDescription>
                            צור תור חדש עבור {selectedEntry?.treatment?.name} ({selectedEntry?.customer?.full_name})
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>תאריך</Label>
                            <Input
                                type="date"
                                value={approveDate ? format(approveDate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setApproveDate(e.target.value ? new Date(e.target.value) : null)}
                                dir="rtl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>שעה</Label>
                            <Input
                                type="time"
                                value={approveTime}
                                onChange={(e) => setApproveTime(e.target.value)}
                                dir="rtl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>הערות (אופציונלי)</Label>
                            <Textarea
                                value={approveNotes}
                                onChange={(e) => setApproveNotes(e.target.value)}
                                placeholder="הוסף הערות..."
                                dir="rtl"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                            ביטול
                        </Button>
                        <Button onClick={handleApprove} disabled={isProcessing || !approveDate || !approveTime}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                    יוצר תור...
                                </>
                            ) : (
                                "אשר ויצור תור"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Decline Dialog */}
            <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
                <DialogContent className="sm:max-w-[500px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>דחה בקשה מרשימת המתנה</DialogTitle>
                        <DialogDescription>
                            האם אתה בטוח שברצונך לדחות את הבקשה עבור {selectedEntry?.treatment?.name}?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>סיבת הדחייה (אופציונלי)</Label>
                            <Textarea
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="הסבר את סיבת הדחייה..."
                                dir="rtl"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                            ביטול
                        </Button>
                        <Button variant="destructive" onClick={handleDecline} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                    דוחה...
                                </>
                            ) : (
                                "דחה"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Suggest Dialog */}
            <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
                <DialogContent className="sm:max-w-[500px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>הצע זמן חלופי</DialogTitle>
                        <DialogDescription>
                            הצע תאריך ושעה חלופיים עבור {selectedEntry?.treatment?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>תאריך מוצע</Label>
                            <Input
                                type="date"
                                value={suggestion.suggestedDate ? format(suggestion.suggestedDate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setSuggestion(prev => ({
                                    ...prev,
                                    suggestedDate: e.target.value ? new Date(e.target.value) : null
                                }))}
                                dir="rtl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>שעה מוצעת</Label>
                            <Input
                                type="time"
                                value={suggestion.suggestedTime}
                                onChange={(e) => setSuggestion(prev => ({ ...prev, suggestedTime: e.target.value }))}
                                dir="rtl"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>הערות (אופציונלי)</Label>
                            <Textarea
                                value={suggestion.notes}
                                onChange={(e) => setSuggestion(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="הוסף הערות..."
                                dir="rtl"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSuggestDialogOpen(false)}>
                            ביטול
                        </Button>
                        <Button onClick={handleSuggest} disabled={isProcessing || !suggestion.suggestedDate || !suggestion.suggestedTime}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                    שומר...
                                </>
                            ) : (
                                "שמור הצעה"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Waitlist Entry Modal */}
            <AddWaitlistEntryModal
                open={isAddWaitlistModalOpen}
                onOpenChange={setIsAddWaitlistModalOpen}
                onSuccess={() => {
                    loadWaitlistEntries()
                }}
            />
        </div>
    )
}

interface WaitlistEntryRowProps {
    entry: WaitlistEntry
    isExpanded: boolean
    onExpand: () => void
    onApprove: () => void
    onDecline: () => void
    onSuggest: () => void
    onViewInCalendar: () => void
    getSizeLabel: (size: string | null) => string
}

function WaitlistEntryRow({
    entry,
    isExpanded,
    onExpand,
    onApprove,
    onDecline,
    onSuggest,
    onViewInCalendar,
    getSizeLabel
}: WaitlistEntryRowProps) {
    const statusBadges = {
        active: { label: "פעיל", color: "bg-blue-100 text-blue-800 border-blue-200" },
        fulfilled: { label: "מבוצע", color: "bg-green-100 text-green-800 border-green-200" },
        cancelled: { label: "בוטל", color: "bg-gray-100 text-gray-800 border-gray-200" }
    }
    const statusBadge = statusBadges[entry.status]
    const canModify = entry.status === 'active'
    const serviceLabelMap: Record<WaitlistEntry['service_scope'], string> = {
        grooming: "תספורת",
        daycare: "גן",
        both: "תספורת + גן",
    }
    const serviceLabel = serviceLabelMap[entry.service_scope] || entry.service_scope

    const formatDateValue = (value?: string | null, withTime = false) => {
        if (!value) return "-"
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return "-"
        return format(date, withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: he })
    }

    const startDateLabel = formatDateValue(entry.start_date)
    const endDateLabel = entry.end_date ? formatDateValue(entry.end_date) : null
    const createdLabel = formatDateValue(entry.created_at, true)
    let dateSummary = startDateLabel
    if (endDateLabel && endDateLabel !== startDateLabel) {
        dateSummary = startDateLabel + " - " + endDateLabel
    }

    return (
        <Fragment>
            <tr
                className={cn(
                    "border-b text-right transition-colors",
                    entry.status === 'active'
                        ? "bg-[hsl(228_36%_99%)] hover:bg-[hsl(228_36%_97%)]"
                        : "bg-white hover:bg-muted/40"
                )}
            >
                <td className="px-2 py-2 text-center align-middle">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onExpand}
                        className="h-8 w-8 p-0"
                        title={isExpanded ? "צמצם" : "הרחב"}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </Button>
                </td>
                <td className="px-3 py-3 align-middle text-right">
                    <span className="text-sm text-gray-900">{entry.treatment?.name || "ללא שם"}</span>
                </td>
                <td className="px-3 py-3 align-middle text-right text-sm text-gray-700">
                    {entry.treatment?.treatmentType?.name || "-"}
                </td>
                <td className="px-3 py-3 align-middle text-right text-xs text-gray-600">
                    {[
                        ...(entry.treatment?.treatment_types?.map((type) => type.name) ?? []),
                        ...(entry.treatment?.treatment_categories?.map((category) => category.name) ?? []),
                    ]
                        .filter(Boolean)
                        .join(", ") || "-"}
                </td>
                <td className="px-3 py-3 align-middle text-center text-sm text-gray-700">
                    {getSizeLabel(entry.treatment?.treatmentType?.size_class || null)}
                </td>
                <td className="px-3 py-3 align-middle text-center text-sm text-gray-700">
                    <div className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{dateSummary}</span>
                    </div>
                </td>
                <td className="px-3 py-3 align-middle text-center">
                    <Badge variant="outline" className={cn("px-3", statusBadge.color)}>
                        {statusBadge.label}
                    </Badge>
                </td>
                <td className="px-3 py-3 align-middle text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-right">
                            {canModify && (
                                <>
                                    <DropdownMenuItem onClick={onApprove} className="flex items-center justify-between gap-2">
                                        <span>אשר</span>
                                        <CheckCircle className="h-4 w-4 text-blue-600" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onSuggest} className="flex items-center justify-between gap-2">
                                        <span>הצע זמן חלופי</span>
                                        <MessageSquare className="h-4 w-4 text-primary" />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onDecline} className="flex items-center justify-between gap-2 text-red-600 focus:text-red-600">
                                        <span>דחה בקשה</span>
                                        <XCircle className="h-4 w-4" />
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem onClick={onViewInCalendar} className="flex items-center justify-between gap-2">
                                <span>פתח בלוח שנה</span>
                                <Calendar className="h-4 w-4 text-gray-500" />
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-[hsl(228_36%_98%)]">
                    <td className="border-b-0" />
                    <td colSpan={7} className="border-b px-6 py-6">
                        <div className="space-y-6">
                            <div className="grid gap-8 lg:grid-cols-3">
                                <InfoSection
                                    icon={<Sparkles className="h-4 w-4" />}
                                    title="פרטי הלקוח"
                                    rows={[
                                        { label: "שם", value: entry.treatment?.name || "-" },
                                        { label: "גזע", value: entry.treatment?.treatmentType?.name || "-" },
                                        { label: "גודל", value: getSizeLabel(entry.treatment?.treatmentType?.size_class || null) },
                                        entry.treatment?.treatment_types?.length
                                            ? {
                                                label: "קטגוריות ראשיות",
                                                value: entry.treatment.treatment_types.map((type) => type.name).join(", "),
                                            }
                                            : null,
                                        entry.treatment?.treatment_categories?.length
                                            ? {
                                                label: "קטגוריות משנה",
                                                value: entry.treatment.treatment_categories.map((category) => category.name).join(", "),
                                            }
                                            : null,
                                    ].filter(Boolean) as DetailRowProps[]}
                                />
                                <InfoSection
                                    icon={<User className="h-4 w-4" />}
                                    title="פרטי הלקוח"
                                    rows={[
                                        { label: "שם", value: entry.customer?.full_name || "-" },
                                        { label: "טלפון", value: entry.customer?.phone || "-" },
                                        { label: "אימייל", value: entry.customer?.email || "-" },
                                    ]}
                                />
                                <InfoSection
                                    icon={<Clock className="h-4 w-4" />}
                                    title="פרטי הבקשה"
                                    rows={[
                                        { label: "סוג שירות", value: serviceLabel },
                                        { label: "תאריך התחלה", value: startDateLabel },
                                        { label: "תאריך סיום", value: endDateLabel || "-" },
                                        { label: "נוצר ב", value: createdLabel },
                                    ]}
                                />
                            </div>
                            {entry.notes && (
                                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-4 text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">הערות:</span> {entry.notes}
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </Fragment>
    )
}

interface DetailRowProps {
    label: string
    value: string
}

const DetailRow = ({ label, value }: DetailRowProps) => (
    <div className="flex items-center  gap-3 text-right">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
    </div>
)

interface InfoSectionProps {
    icon: React.ReactNode
    title: string
    rows: DetailRowProps[]
}

const InfoSection = ({ icon, title, rows }: InfoSectionProps) => (
    <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            {icon}
            {title}
        </h4>
        <div className="rounded-2xl border border-blue-100 bg-white px-4 py-4 shadow-sm">
            <dl className="space-y-3 text-sm text-gray-700">
                {rows.map((row, index) => (
                    <DetailRow
                        key={title + "-" + row.label + "-" + index}
                        label={row.label}
                        value={row.value}
                    />
                ))}
            </dl>
        </div>
    </div>
)
