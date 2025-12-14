import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, Search, X, Calendar } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { normalizePhone } from "@/utils/phone"
import { ManyChatIcon } from "@/components/icons/ManyChatIcon"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedDate, setIsClientDetailsOpen } from "@/store/slices/managerScheduleSlice"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, parse, isValid } from "date-fns"
import { he } from "date-fns/locale"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"

interface SentReminder {
    id: string
    appointment_id: string
    appointment_type: "grooming"
    reminder_id: string
    customer_id: string
    sent_at: string
    flow_id: string
    manychat_subscriber_id: string | null
    success: boolean
    error_message: string | null
    is_manual: boolean
    // Joined data
    customer?: {
        id: string
        full_name: string
        phone: string
        classification: "new" | "vip" | "standard" | "inactive"
        customer_type?: {
            id: string
            name: string
        } | null
    }
    appointment?: {
        id: string
        start_at: string
    }
    reminder?: {
        id: string
        description: string | null
        day_type: "regular" | "sunday" | "manual"
    }
}

interface SentRemindersTableProps {
    customerId?: string // Optional: filter by specific customer
    hideColumns?: {
        breed?: boolean
        flowId?: boolean
        customerCategory?: boolean
    } // Optional: hide specific columns
    onNavigateToAppointment?: () => void // Optional: callback when navigating to appointment
}

export default function SentRemindersTable({ customerId, hideColumns = {}, onNavigateToAppointment }: SentRemindersTableProps = {}) {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(true)
    const [sentReminders, setSentReminders] = useState<SentReminder[]>([])
    const [loadingSubscriberId, setLoadingSubscriberId] = useState<string | null>(null)

    // Search filters
    const [searchDate, setSearchDate] = useState<Date | null>(null)
    const [searchStartTime, setSearchStartTime] = useState<string>("")
    const [searchEndTime, setSearchEndTime] = useState<string>("")
    const [searchCustomer, setSearchCustomer] = useState<string>("")
    const [searchCustomerCategory, setSearchCustomerCategory] = useState<string>("all")
    const [searchAppointmentType, setSearchAppointmentType] = useState<string>("all")
    const [searchSuccess, setSearchSuccess] = useState<string>("all")
    const [searchReminderType, setSearchReminderType] = useState<string>("all") // "all" | "manual" | "automatic"

    // Filter options
    const [customerCategories, setCustomerCategories] = useState<Array<{ id: string; name: string }>>([])

    useEffect(() => {
        loadData()
        loadFilterOptions()
    }, [customerId])

    const loadFilterOptions = async () => {
        try {
            console.log("[SentRemindersTable] Loading filter options...")

            // Load customer types
            const { data: customerTypesData, error: customerTypesError } = await supabase
                .from("customer_types")
                .select("id, name")
                .order("name")

            if (customerTypesError) {
                console.error("[SentRemindersTable] Error loading customer types:", customerTypesError)
            } else {
                console.log("[SentRemindersTable] Loaded customer types:", customerTypesData?.length || 0)
                setCustomerCategories(customerTypesData || [])
            }
        } catch (error) {
            console.error("[SentRemindersTable] Failed to load filter options:", error)
        }
    }

    const loadData = async () => {
        setIsLoading(true)
        try {
            console.log("[SentRemindersTable] Loading sent reminders...")

            // Query sent reminders with all related data
            let query = supabase
                .from("appointment_reminder_sent")
                .select(`
                    id,
                    appointment_id,
                    appointment_type,
                    reminder_id,
                    customer_id,
                    sent_at,
                    flow_id,
                    manychat_subscriber_id,
                    success,
                    error_message,
                    is_manual,
                    customer:customers (
                        id,
                        full_name,
                        phone,
                        classification,
                        customer_type:customer_types (
                            id,
                            name
                        )
                    ),
                    reminder:appointment_reminders (
                        id,
                        description,
                        day_type
                    )
                `)

            // Filter by customer if provided
            if (customerId) {
                query = query.eq("customer_id", customerId)
            }

            query = query.order("sent_at", { ascending: false })

            const { data, error } = await query

            if (error) {
                console.error("[SentRemindersTable] Error loading sent reminders:", error)
                throw error
            }

            console.log("[SentRemindersTable] Loaded sent reminders:", data?.length || 0)

            // Now we need to fetch appointment data separately since we can't join across different tables easily
            const remindersWithAppointments = await Promise.all(
                (data || []).map(async (reminder) => {
                    let appointmentData = null

                    if (reminder.appointment_type === "grooming") {
                        const { data: groomingData } = await supabase
                            .from("grooming_appointments")
                            .select(`
                                id,
                                start_at
                            `)
                            .eq("id", reminder.appointment_id)
                            .single()

                        appointmentData = groomingData
                    }

                    return {
                        ...reminder,
                        appointment: appointmentData,
                    } as SentReminder
                })
            )

            setSentReminders(remindersWithAppointments)
            console.log("[SentRemindersTable] Data loaded successfully")
        } catch (error) {
            console.error("[SentRemindersTable] Failed to load data:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את התזכורות שנשלחו",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Filter reminders based on search criteria
    const filteredReminders = useMemo(() => {
        return sentReminders.filter((reminder) => {
            // Date filter
            if (searchDate) {
                const reminderDate = new Date(reminder.sent_at)
                const searchDateOnly = new Date(searchDate)
                searchDateOnly.setHours(0, 0, 0, 0)
                const reminderDateOnly = new Date(reminderDate)
                reminderDateOnly.setHours(0, 0, 0, 0)

                if (reminderDateOnly.getTime() !== searchDateOnly.getTime()) {
                    return false
                }
            }

            // Time range filter
            if (searchStartTime || searchEndTime) {
                const reminderTime = format(new Date(reminder.sent_at), "HH:mm")

                if (searchStartTime && reminderTime < searchStartTime) {
                    return false
                }

                if (searchEndTime && reminderTime > searchEndTime) {
                    return false
                }
            }

            // Reminder type filter (manual vs automatic)
            if (searchReminderType !== "all") {
                if (searchReminderType === "manual" && !reminder.is_manual) {
                    return false
                }
                if (searchReminderType === "automatic" && reminder.is_manual) {
                    return false
                }
            }

            // Customer name/phone filter
            if (searchCustomer) {
                const customerName = reminder.customer?.full_name?.toLowerCase() || ""
                const customerPhone = reminder.customer?.phone?.toLowerCase() || ""
                const searchLower = searchCustomer.toLowerCase()
                if (!customerName.includes(searchLower) && !customerPhone.includes(searchLower)) {
                    return false
                }
            }

            // Customer category filter
            if (searchCustomerCategory !== "all") {
                if (searchCustomerCategory === "classification") {
                    // Filter by classification (new, vip, standard, inactive)
                    // This would need additional UI, for now we'll skip
                } else {
                    const customerTypeId = reminder.customer?.customer_type?.id
                    if (customerTypeId !== searchCustomerCategory) {
                        return false
                    }
                }
            }

            // Appointment type filter
            if (searchAppointmentType !== "all") {
                if (reminder.appointment_type !== searchAppointmentType) {
                    return false
                }
            }

            // Success filter
            if (searchSuccess !== "all") {
                const shouldBeSuccess = searchSuccess === "success"
                if (reminder.success !== shouldBeSuccess) {
                    return false
                }
            }

            return true
        })
    }, [sentReminders, searchDate, searchStartTime, searchEndTime, searchCustomer, searchCustomerCategory, searchAppointmentType, searchSuccess, searchReminderType])

    const clearFilters = () => {
        setSearchDate(null)
        setSearchStartTime("")
        setSearchEndTime("")
        setSearchCustomer("")
        setSearchCustomerCategory("all")
        setSearchAppointmentType("all")
        setSearchSuccess("all")
        setSearchReminderType("all")
    }

    const hasActiveFilters = searchDate || searchStartTime || searchEndTime || searchCustomer ||
        searchCustomerCategory !== "all" ||
        searchAppointmentType !== "all" || searchSuccess !== "all" || searchReminderType !== "all"

    const getClassificationLabel = (classification: string) => {
        const labels: Record<string, string> = {
            new: "חדש",
            vip: "VIP",
            standard: "רגיל",
            inactive: "לא פעיל",
        }
        return labels[classification] || classification
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
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>חיפוש וסינון</CardTitle>
                    <CardDescription>סנן תזכורות לפי קריטריונים שונים</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">תאריך שליחה</label>
                            <DatePickerInput
                                value={searchDate}
                                onChange={(date) => setSearchDate(date)}
                                displayFormat="dd/MM/yyyy"
                                className="w-full text-right"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">שעת התחלה</label>
                            <div className="relative">
                                <TimePickerInput
                                    value={searchStartTime}
                                    onChange={(time) => setSearchStartTime(time)}
                                    className="w-full text-right pr-8"
                                />
                                {searchStartTime && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchStartTime("")}
                                        className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        title="נקה"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">שעת סיום</label>
                            <div className="relative">
                                <TimePickerInput
                                    value={searchEndTime}
                                    onChange={(time) => setSearchEndTime(time)}
                                    className="w-full text-right pr-8"
                                />
                                {searchEndTime && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchEndTime("")}
                                        className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        title="נקה"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">סוג תזכורת</label>
                            <Select value={searchReminderType} onValueChange={setSearchReminderType}>
                                <SelectTrigger className="text-right" dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="manual">ידנית</SelectItem>
                                    <SelectItem value="automatic">אוטומטית</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">לקוח (שם/טלפון)</label>
                            <div className="relative">
                                <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    value={searchCustomer}
                                    onChange={(e) => setSearchCustomer(e.target.value)}
                                    placeholder="חפש לקוח..."
                                    dir="rtl"
                                    className="text-right pr-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">קטגוריית לקוח</label>
                            <Select value={searchCustomerCategory} onValueChange={setSearchCustomerCategory}>
                                <SelectTrigger className="text-right" dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all">הכל</SelectItem>
                                    {customerCategories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">סוג תור</label>
                            <Select value={searchAppointmentType} onValueChange={setSearchAppointmentType}>
                                <SelectTrigger className="text-right" dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="grooming">תספורת</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">סטטוס</label>
                            <Select value={searchSuccess} onValueChange={setSearchSuccess}>
                                <SelectTrigger className="text-right" dir="rtl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="success">הצליח</SelectItem>
                                    <SelectItem value="failed">נכשל</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {hasActiveFilters && (
                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    className="w-full"
                                >
                                    <X className="h-4 w-4 ml-2" />
                                    נקה סינון
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>
                        תזכורות שנשלחו ({filteredReminders.length})
                    </CardTitle>
                    <CardDescription>
                        רשימת כל התזכורות שנשלחו ללקוחות
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">תאריך שליחה</TableHead>
                                    <TableHead className="text-right">לקוח</TableHead>
                                    <TableHead className="text-right">טלפון</TableHead>
                                    {!hideColumns.customerCategory && (
                                        <TableHead className="text-right">קטגוריית לקוח</TableHead>
                                    )}
                                    <TableHead className="text-right">סוג תור</TableHead>
                                    <TableHead className="text-right">תאריך תור</TableHead>
                                    <TableHead className="text-right">תיאור תזכורת</TableHead>
                                    {!hideColumns.flowId && (
                                        <TableHead className="text-right">Flow ID</TableHead>
                                    )}
                                    <TableHead className="text-center">סטטוס</TableHead>
                                    <TableHead className="text-center">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReminders.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={
                                                9 -
                                                (hideColumns.customerCategory ? 1 : 0) -
                                                (hideColumns.flowId ? 1 : 0)
                                            }
                                            className="text-center text-slate-500 py-8"
                                        >
                                            {hasActiveFilters
                                                ? "לא נמצאו תזכורות התואמות את הסינון"
                                                : "אין תזכורות שנשלחו"}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReminders.map((reminder) => (
                                        <TableRow key={reminder.id}>
                                            <TableCell className="text-right">
                                                {format(new Date(reminder.sent_at), "dd/MM/yyyy HH:mm", { locale: he })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {reminder.customer?.full_name || "לא זמין"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {reminder.customer?.phone || "לא זמין"}
                                            </TableCell>
                                            {!hideColumns.customerCategory && (
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col gap-1">
                                                        {reminder.customer?.customer_type?.name && (
                                                            <Badge variant="outline">
                                                                {reminder.customer.customer_type.name}
                                                            </Badge>
                                                        )}
                                                        <Badge variant="secondary" className="text-xs">
                                                            {getClassificationLabel(reminder.customer?.classification || "")}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <Badge variant="default">
                                                    תספורת
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {reminder.appointment?.start_at
                                                    ? format(new Date(reminder.appointment.start_at), "dd/MM/yyyy HH:mm", { locale: he })
                                                    : "לא זמין"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {reminder.reminder?.description || "ללא תיאור"}
                                            </TableCell>
                                            {!hideColumns.flowId && (
                                                <TableCell className="text-right font-mono text-xs">
                                                    {reminder.flow_id}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-center">
                                                {reminder.success ? (
                                                    <Badge variant="default" className="bg-green-500">
                                                        הצליח
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive">
                                                        נכשל
                                                    </Badge>
                                                )}
                                                {reminder.error_message && (
                                                    <div className="text-xs text-red-600 mt-1" title={reminder.error_message}>
                                                        {reminder.error_message.substring(0, 50)}...
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {(() => {
                                                    const handleOpenConversation = async () => {
                                                        const customerPhone = reminder.customer?.phone
                                                        const customerName = reminder.customer?.full_name || "לקוח"

                                                        if (!customerPhone) {
                                                            toast({
                                                                title: "שגיאה",
                                                                description: "חסר מספר טלפון",
                                                                variant: "destructive",
                                                            })
                                                            return
                                                        }

                                                        setLoadingSubscriberId(reminder.id)
                                                        try {
                                                            console.info("[SentRemindersTable] Fetching ManyChat ID", {
                                                                phone: customerPhone,
                                                                name: customerName
                                                            })

                                                            const { data, error } = await supabase.functions.invoke("get-manychat-user", {
                                                                body: [{ phone: customerPhone, fullName: customerName }],
                                                            })

                                                            if (error) {
                                                                console.error("[SentRemindersTable] Error fetching ManyChat ID:", error)
                                                                throw error
                                                            }

                                                            const phoneDigits = normalizePhone(customerPhone) || customerPhone.replace(/\D/g, "")
                                                            const result = data?.[phoneDigits]

                                                            if (!result || (result as any).error) {
                                                                const errorMsg = (result as any)?.error || "לא נמצא מזהה ManyChat"
                                                                console.error("[SentRemindersTable] ManyChat user not found:", errorMsg)
                                                                toast({
                                                                    title: "שגיאה",
                                                                    description: errorMsg,
                                                                    variant: "destructive",
                                                                })
                                                                return
                                                            }

                                                            // Use live_chat_url if available, otherwise construct URL from subscriber ID
                                                            const liveChatUrl = (result as any).live_chat_url
                                                            const subscriberId = (result as any).subscriber_id || (result as any).id

                                                            if (!liveChatUrl && !subscriberId) {
                                                                console.error("[SentRemindersTable] No live_chat_url or subscriber ID in result:", result)
                                                                toast({
                                                                    title: "שגיאה",
                                                                    description: "לא נמצא קישור ManyChat",
                                                                    variant: "destructive",
                                                                })
                                                                return
                                                            }

                                                            const manychatUrl = liveChatUrl || `https://manychat.com/subscribers/${subscriberId}`
                                                            console.info("[SentRemindersTable] Opening ManyChat conversation", {
                                                                subscriberId,
                                                                liveChatUrl,
                                                                manychatUrl,
                                                            })
                                                            window.open(manychatUrl, "_blank", "noopener,noreferrer")
                                                        } catch (error) {
                                                            console.error("[SentRemindersTable] Error opening ManyChat:", error)
                                                            toast({
                                                                title: "שגיאה",
                                                                description: "לא ניתן לפתוח שיחת ManyChat",
                                                                variant: "destructive",
                                                            })
                                                        } finally {
                                                            setLoadingSubscriberId(null)
                                                        }
                                                    }

                                                    const handleOpenAppointment = () => {
                                                        if (!reminder.appointment?.start_at) {
                                                            toast({
                                                                title: "שגיאה",
                                                                description: "חסר מידע על תאריך התור",
                                                                variant: "destructive",
                                                            })
                                                            return
                                                        }

                                                        // Get appointment date
                                                        const appointmentDate = new Date(reminder.appointment.start_at)
                                                        const dateStr = format(appointmentDate, "yyyy-MM-dd")

                                                        // Set the date in Redux
                                                        dispatch(setSelectedDate(appointmentDate.toISOString()))

                                                        // Close the client details sheet
                                                        dispatch(setIsClientDetailsOpen(false))

                                                        // Call the callback to close the modal if provided
                                                        onNavigateToAppointment?.()

                                                        // Navigate to manager schedule with date parameter
                                                        // The schedule will load and find the appointment automatically
                                                        navigate(`/manager?date=${dateStr}&highlightAppointment=${reminder.appointment_id}`)
                                                    }

                                                    const isLoadingChat = loadingSubscriberId === reminder.id
                                                    const hasPhone = reminder.customer?.phone
                                                    const hasAppointment = reminder.appointment_id && reminder.appointment_type && reminder.appointment?.start_at

                                                    if (!hasPhone && !hasAppointment) {
                                                        return <span className="text-xs text-gray-400">לא זמין</span>
                                                    }

                                                    return (
                                                        <div className="flex items-center justify-center gap-2">
                                                            {hasPhone && (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleOpenConversation}
                                                                    disabled={isLoadingChat}
                                                                    className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                                                                    title="צפה בשיחה עם הלקוח"
                                                                >
                                                                    {isLoadingChat ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                                                                    ) : (
                                                                        <ManyChatIcon width={16} height={16} fill="currentColor" className="text-gray-700" />
                                                                    )}
                                                                </button>
                                                            )}
                                                            {hasAppointment && (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleOpenAppointment}
                                                                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                                                                    title="פתח את התור בלוח הזמנים"
                                                                >
                                                                    <Calendar className="h-4 w-4 text-gray-700" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

