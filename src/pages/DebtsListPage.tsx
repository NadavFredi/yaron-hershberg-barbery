import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, Loader2, Search, ChevronDown, ChevronUp, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { CreateDebtDialog } from "@/components/dialogs/debts/CreateDebtDialog"
import { EditDebtDialog } from "@/components/dialogs/debts/EditDebtDialog"
import { DeleteDebtDialog } from "@/components/dialogs/debts/DeleteDebtDialog"
import { EditPaymentDialog } from "@/components/dialogs/payments/EditPaymentDialog"
import { PaymentDeleteConfirmationDialog } from "@/components/dialogs/payments/PaymentDeleteConfirmationDialog"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setSelectedAppointmentForPayment, setShowPaymentModal, setDebtIdForPayment } from "@/store/slices/managerScheduleSlice"
import { Badge } from "@/components/ui/badge"

interface Customer {
    id: string
    full_name: string
    phone: string
    email: string | null
}

interface Debt {
    id: string
    customer_id: string
    original_amount: number
    description: string | null
    due_date: string | null
    status: "open" | "partial" | "paid"
    created_at: string
    updated_at: string
    customer: Customer
    paid_amount?: number
    remaining_amount?: number
}

interface Payment {
    id: string
    amount: number
    status: string
    method: string | null
    note: string | null
    created_at: string
}

export default function DebtsListPage() {
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const showPaymentModal = useAppSelector((state) => state.managerSchedule.showPaymentModal)
    const selectedAppointmentForPayment = useAppSelector((state) => state.managerSchedule.selectedAppointmentForPayment)

    const [debts, setDebts] = useState<Debt[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
    const [debtPayments, setDebtPayments] = useState<Record<string, Payment[]>>({})
    const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set())
    const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false)
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
    const [isDeletePaymentDialogOpen, setIsDeletePaymentDialogOpen] = useState(false)
    const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
    const [isDeletingPayment, setIsDeletingPayment] = useState(false)

    // Filter states
    const [searchTerm, setSearchTerm] = useState("")
    const [customerFilter, setCustomerFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [dateFromFilter, setDateFromFilter] = useState<Date | null>(null)
    const [dateToFilter, setDateToFilter] = useState<Date | null>(null)

    useEffect(() => {
        fetchDebts()
    }, [])

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchDebts()
        }, 300)

        return () => clearTimeout(debounce)
    }, [searchTerm, customerFilter, statusFilter, dateFromFilter, dateToFilter])

    const fetchDebts = async () => {
        try {
            setIsLoading(true)
            console.log("🔍 [DebtsListPage] Fetching debts...")

            let query = supabase
                .from("debts")
                .select(`
                    *,
                    customer:customers(id, full_name, phone, email)
                `)
                .order("created_at", { ascending: false })

            // Apply filters
            if (statusFilter !== "all") {
                query = query.eq("status", statusFilter)
            }

            if (dateFromFilter) {
                const startOfDay = new Date(dateFromFilter)
                startOfDay.setHours(0, 0, 0, 0)
                query = query.gte("created_at", startOfDay.toISOString())
            }

            if (dateToFilter) {
                const endOfDay = new Date(dateToFilter)
                endOfDay.setHours(23, 59, 59, 999)
                query = query.lte("created_at", endOfDay.toISOString())
            }

            const { data, error } = await query

            if (error) throw error

            // Calculate paid and remaining amounts for each debt
            const debtsWithCalculations = await Promise.all(
                (data || []).map(async (debt: any) => {
                    const paidAmount = await calculatePaidAmount(debt.id)
                    const remainingAmount = debt.original_amount - paidAmount

                    return {
                        ...debt,
                        paid_amount: paidAmount,
                        remaining_amount: remainingAmount,
                    }
                })
            )

            // Apply customer and search filters
            let filteredDebts = debtsWithCalculations

            if (customerFilter) {
                filteredDebts = filteredDebts.filter((debt) =>
                    debt.customer?.full_name?.toLowerCase().includes(customerFilter.toLowerCase()) ||
                    debt.customer?.phone?.includes(customerFilter)
                )
            }

            if (searchTerm) {
                filteredDebts = filteredDebts.filter((debt) =>
                    debt.customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    debt.customer?.phone?.includes(searchTerm) ||
                    debt.description?.toLowerCase().includes(searchTerm.toLowerCase())
                )
            }

            setDebts(filteredDebts)
        } catch (error) {
            console.error("Error fetching debts:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את החובות",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const calculatePaidAmount = async (debtId: string): Promise<number> => {
        try {
            const { data, error } = await supabase
                .from("payments")
                .select("amount")
                .eq("debt_id", debtId)
                .in("status", ["paid", "partial"])

            if (error) throw error

            return (data || []).reduce((sum, payment) => sum + (payment.amount || 0), 0)
        } catch (error) {
            console.error("Error calculating paid amount:", error)
            return 0
        }
    }

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

    const getStatusLabel = (status: string) => {
        const labels = {
            open: "פתוח",
            partial: "חלקי",
            paid: "שולם",
        }
        return labels[status as keyof typeof labels] || status
    }

    const getStatusColor = (status: string) => {
        const colors = {
            open: "bg-red-100 text-red-800",
            partial: "bg-yellow-100 text-yellow-800",
            paid: "bg-green-100 text-green-800",
        }
        return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"
    }

    const handleCreateSuccess = () => {
        setIsCreateDialogOpen(false)
        fetchDebts()
    }

    const handleEdit = (debt: Debt) => {
        setEditingDebtId(debt.id)
        setIsEditDialogOpen(true)
    }

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false)
        setEditingDebtId(null)
        fetchDebts()
    }

    const handleDelete = (debt: Debt) => {
        setDebtToDelete(debt)
        setIsDeleteDialogOpen(true)
    }

    const handleDeleteSuccess = () => {
        setIsDeleteDialogOpen(false)
        setDebtToDelete(null)
        fetchDebts()
    }

    const fetchDebtPayments = async (debtId: string) => {
        try {
            const { data, error } = await supabase
                .from("payments")
                .select("id, amount, status, method, note, created_at")
                .eq("debt_id", debtId)
                .order("created_at", { ascending: false })

            if (error) throw error

            setDebtPayments(prev => ({
                ...prev,
                [debtId]: data || []
            }))
        } catch (error) {
            console.error("Error fetching debt payments:", error)
        }
    }

    const handleExpandDebt = (debtId: string) => {
        const isExpanded = expandedDebts.has(debtId)
        if (isExpanded) {
            setExpandedDebts(prev => {
                const newSet = new Set(prev)
                newSet.delete(debtId)
                return newSet
            })
        } else {
            setExpandedDebts(prev => new Set(prev).add(debtId))
            fetchDebtPayments(debtId)
        }
    }

    const handleAddPayment = (debt: Debt) => {
        // Open payment modal and link to debt
        const appointmentForPayment = {
            id: `00000000-0000-0000-0000-000000000000`, // Dummy UUID that won't match any real appointment
            clientId: debt.customer_id,
            clientName: debt.customer?.full_name || "",
            serviceType: "grooming" as const,
        }

        // Store debt_id separately in Redux - this is what we'll use to link the payment
        dispatch(setDebtIdForPayment(debt.id))
        dispatch(setSelectedAppointmentForPayment(appointmentForPayment as any))
        dispatch(setShowPaymentModal(true))
    }

    const handleEditPayment = (payment: Payment) => {
        setEditingPaymentId(payment.id)
        setIsEditPaymentDialogOpen(true)
    }

    const handleEditPaymentSuccess = () => {
        setIsEditPaymentDialogOpen(false)
        setEditingPaymentId(null)
        // Refresh payments for all expanded debts
        expandedDebts.forEach(debtId => {
            fetchDebtPayments(debtId)
        })
        fetchDebts() // Also refresh debt totals
    }

    const handleDeletePayment = (payment: Payment) => {
        setPaymentToDelete(payment)
        setIsDeletePaymentDialogOpen(true)
    }

    const handleDeletePaymentConfirm = async () => {
        if (!paymentToDelete) return

        try {
            setIsDeletingPayment(true)
            const { error } = await supabase
                .from("payments")
                .delete()
                .eq("id", paymentToDelete.id)

            if (error) throw error

            toast({
                title: "תשלום נמחק",
                description: "התשלום נמחק בהצלחה",
            })

            setIsDeletePaymentDialogOpen(false)
            setPaymentToDelete(null)

            // Refresh payments for all expanded debts
            expandedDebts.forEach(debtId => {
                fetchDebtPayments(debtId)
            })
            fetchDebts() // Also refresh debt totals
        } catch (error) {
            console.error("Error deleting payment:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את התשלום",
                variant: "destructive",
            })
        } finally {
            setIsDeletingPayment(false)
        }
    }

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString("he-IL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
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
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>חובות</CardTitle>
                            <CardDescription>
                                {debts.length > 0
                                    ? `נמצאו ${debts.length} חובות`
                                    : "רשימת כל החובות"}
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="h-4 w-4 ml-2" />
                            הוסף חוב
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">חיפוש</Label>
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        placeholder="חפש לפי לקוח, תיאור..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pr-10"
                                        dir="rtl"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">לקוח</Label>
                                <AutocompleteFilter
                                    value={customerFilter}
                                    onChange={setCustomerFilter}
                                    placeholder="שם לקוח..."
                                    searchFn={searchCustomerNames}
                                    minSearchLength={0}
                                    autoSearchOnFocus
                                    initialLoadOnMount
                                    initialResultsLimit={5}
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">סטטוס</Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger dir="rtl">
                                        <SelectValue placeholder="כל הסטטוסים" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">כל הסטטוסים</SelectItem>
                                        <SelectItem value="open">פתוח</SelectItem>
                                        <SelectItem value="partial">חלקי</SelectItem>
                                        <SelectItem value="paid">שולם</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">מתאריך</Label>
                                <DatePickerInput
                                    value={dateFromFilter}
                                    onChange={setDateFromFilter}
                                    placeholder="בחר תאריך..."
                                    wrapperClassName="w-full"
                                    displayFormat="dd/MM/yyyy"
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">עד תאריך</Label>
                                <DatePickerInput
                                    value={dateToFilter}
                                    onChange={setDateToFilter}
                                    placeholder="בחר תאריך..."
                                    wrapperClassName="w-full"
                                    displayFormat="dd/MM/yyyy"
                                />
                            </div>
                        </div>
                        {(customerFilter || statusFilter !== "all" || dateFromFilter || dateToFilter || searchTerm) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCustomerFilter("")
                                    setStatusFilter("all")
                                    setDateFromFilter(null)
                                    setDateToFilter(null)
                                    setSearchTerm("")
                                }}
                            >
                                נקה סינונים
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar">
                            <Table containerClassName="[direction:rtl] !overflow-visible">
                                <TableHeader>
                                    <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[hsl(228_36%_95%)]">
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead className="text-right">לקוח</TableHead>
                                        <TableHead className="text-right">סכום מקורי</TableHead>
                                        <TableHead className="text-right">שולם</TableHead>
                                        <TableHead className="text-right">נותר</TableHead>
                                        <TableHead className="text-right">סטטוס</TableHead>
                                        <TableHead className="text-right">תיאור</TableHead>
                                        <TableHead className="text-right">תאריך יצירה</TableHead>
                                        <TableHead className="text-right">תאריך יעד</TableHead>
                                        <TableHead className="text-right">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {debts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                                לא נמצאו חובות
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        debts.map((debt) => {
                                            const isExpanded = expandedDebts.has(debt.id)
                                            const payments = debtPayments[debt.id] || []

                                            return (
                                                <>
                                                    <TableRow key={debt.id}>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={() => handleExpandDebt(debt.id)}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronUp className="h-4 w-4" />
                                                                ) : (
                                                                    <ChevronDown className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell>{debt.customer?.full_name || "-"}</TableCell>
                                                        <TableCell>₪{debt.original_amount.toFixed(2)}</TableCell>
                                                        <TableCell>
                                                            ₪{(debt.paid_amount || 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className={debt.remaining_amount && debt.remaining_amount > 0 ? "text-red-600 font-semibold" : ""}>
                                                            ₪{(debt.remaining_amount || debt.original_amount).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(debt.status)}`}>
                                                                {getStatusLabel(debt.status)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>{debt.description || "-"}</TableCell>
                                                        <TableCell>
                                                            {new Date(debt.created_at).toLocaleDateString("he-IL")}
                                                        </TableCell>
                                                        <TableCell>
                                                            {debt.due_date ? new Date(debt.due_date).toLocaleDateString("he-IL") : "-"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleEdit(debt)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDelete(debt)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && (
                                                        <TableRow>
                                                            <TableCell colSpan={10} className="bg-gray-50">
                                                                <div className="p-4">
                                                                    <div className="border-t pt-4">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <h4 className="text-sm font-semibold text-gray-900">תשלומים</h4>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleAddPayment(debt)}
                                                                            >
                                                                                <CreditCard className="h-3 w-3 ml-1" />
                                                                                הוסף תשלום
                                                                            </Button>
                                                                        </div>
                                                                        {payments.length === 0 ? (
                                                                            <p className="text-sm text-gray-500">אין תשלומים עבור חוב זה</p>
                                                                        ) : (
                                                                            <div className="space-y-2">
                                                                                {payments.map((payment) => (
                                                                                    <div
                                                                                        key={payment.id}
                                                                                        className="flex items-start justify-between p-3 bg-white rounded border"
                                                                                    >
                                                                                        <div className="flex-1 space-y-2">
                                                                                            <div className="flex items-center gap-4 text-sm">
                                                                                                <span className="font-semibold">₪{payment.amount.toFixed(2)}</span>
                                                                                                <span className="text-gray-500">
                                                                                                    {formatDateTime(payment.created_at)}
                                                                                                </span>
                                                                                                {payment.method && (
                                                                                                    <span className="text-gray-500">{payment.method}</span>
                                                                                                )}
                                                                                            </div>
                                                                                            {payment.note && (
                                                                                                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                                                                                    <span className="font-medium">הערה: </span>
                                                                                                    {payment.note}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 mr-4">
                                                                                            <Badge variant={payment.status === "paid" ? "default" : "secondary"} className="ml-2">
                                                                                                {payment.status === "paid" ? "שולם" : payment.status === "partial" ? "חלקי" : "לא שולם"}
                                                                                            </Badge>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-7 w-7"
                                                                                                onClick={() => handleEditPayment(payment)}
                                                                                            >
                                                                                                <Pencil className="h-3 w-3" />
                                                                                            </Button>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="h-7 w-7 text-red-600 hover:text-red-700"
                                                                                                onClick={() => handleDeletePayment(payment)}
                                                                                            >
                                                                                                <Trash2 className="h-3 w-3" />
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dialogs */}
            <CreateDebtDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSuccess={handleCreateSuccess}
            />

            <EditDebtDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                debtId={editingDebtId}
                onSuccess={handleEditSuccess}
            />

            <DeleteDebtDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                debt={debtToDelete}
                onConfirm={handleDeleteSuccess}
            />

            {/* Edit Payment Dialog */}
            <EditPaymentDialog
                open={isEditPaymentDialogOpen}
                onOpenChange={setIsEditPaymentDialogOpen}
                paymentId={editingPaymentId || ""}
                onSuccess={handleEditPaymentSuccess}
            />

            {/* Delete Payment Dialog */}
            {paymentToDelete && (() => {
                // Find the debt that contains this payment
                const debtWithPayment = debts.find(d =>
                    debtPayments[d.id]?.some(p => p.id === paymentToDelete.id)
                )

                return (
                    <PaymentDeleteConfirmationDialog
                        open={isDeletePaymentDialogOpen}
                        onOpenChange={setIsDeletePaymentDialogOpen}
                        payment={{
                            id: paymentToDelete.id,
                            amount: paymentToDelete.amount,
                            currency: "ILS",
                            customer: {
                                full_name: debtWithPayment?.customer?.full_name || "",
                            },
                        }}
                        onConfirm={handleDeletePaymentConfirm}
                        isDeleting={isDeletingPayment}
                    />
                )
            })()}

            {/* Payment Modal */}
            {showPaymentModal && selectedAppointmentForPayment && (
                <PaymentModal
                    open={showPaymentModal}
                    onOpenChange={(open) => {
                        dispatch(setShowPaymentModal(open))
                        if (!open) {
                            // Clear debt_id when modal closes
                            dispatch(setDebtIdForPayment(null))
                            // Refresh debts when payment modal closes
                            fetchDebts()
                        }
                    }}
                    appointment={selectedAppointmentForPayment as any}
                    customerId={selectedAppointmentForPayment.clientId}
                    onConfirm={() => {
                        dispatch(setShowPaymentModal(false))
                        dispatch(setDebtIdForPayment(null))
                        fetchDebts()
                    }}
                />
            )}
        </div>
    )
}
