import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, Trash2, Loader2, Search, Send, CreditCard, FileText, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"
import { DatePickerInput } from "@/components/DatePickerInput"
import { EditPaymentDialog } from "@/components/dialogs/payments/EditPaymentDialog"
import { PaymentDeleteConfirmationDialog } from "@/components/dialogs/payments/PaymentDeleteConfirmationDialog"
import { SendInvoiceDialog } from "@/components/dialogs/payments/SendInvoiceDialog"
import { getInvoiceForPayment } from "@/services/tranzilaInvoice"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"
import { SelectCustomerForPaymentDialog } from "@/components/dialogs/payments/SelectCustomerForPaymentDialog"
import type { Customer } from "@/components/CustomerSearchInput"

interface Customer {
    id: string
    full_name: string
    phone: string
    email: string | null
}

interface Payment {
    id: string
    customer_id: string
    amount: number
    currency: string
    status: "unpaid" | "paid" | "partial"
    method: string | null
    external_id: string | null
    transaction_id: string | null
    created_at: string
    updated_at: string
    customer: Customer
}

export default function PaymentsListPage() {
    const { toast } = useToast()
    const [payments, setPayments] = useState<Payment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSelectCustomerDialogOpen, setIsSelectCustomerDialogOpen] = useState(false)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null)
    const [selectedDogForPayment, setSelectedDogForPayment] = useState<Dog | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
    const [isSendInvoiceDialogOpen, setIsSendInvoiceDialogOpen] = useState(false)
    const [paymentToInvoice, setPaymentToInvoice] = useState<Payment | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
    const [paymentForInvoice, setPaymentForInvoice] = useState<Payment | null>(null)
    const [invoiceHtml, setInvoiceHtml] = useState<string | null>(null)
    const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)

    // Filter states
    const [searchTerm, setSearchTerm] = useState("")
    const [customerFilter, setCustomerFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [dateFromFilter, setDateFromFilter] = useState<Date | null>(null)
    const [dateToFilter, setDateToFilter] = useState<Date | null>(null)
    const [amountMinFilter, setAmountMinFilter] = useState("")
    const [amountMaxFilter, setAmountMaxFilter] = useState("")

    useEffect(() => {
        fetchPayments()
    }, [])

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchPayments()
        }, 300)

        return () => clearTimeout(debounce)
    }, [searchTerm, customerFilter, statusFilter, dateFromFilter, dateToFilter, amountMinFilter, amountMaxFilter])

    const fetchPayments = async () => {
        try {
            setIsLoading(true)
            console.log("🔍 [PaymentsListPage] Fetching payments...")
            
            let query = supabase
                .from("payments")
                .select(`
                    *,
                    customer:customers(id, full_name, phone, email)
                `)
                .order("created_at", { ascending: false })

            const { data, error } = await query

            if (error) throw error
            
            const paymentsData = (data || []).map((payment: any) => ({
                ...payment,
                customer: payment.customer || null,
            })) as Payment[]
            
            setPayments(paymentsData)
            console.log("✅ [PaymentsListPage] Loaded payments:", paymentsData.length)
        } catch (error) {
            console.error("❌ [PaymentsListPage] Failed to load payments:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן לטעון את התשלומים",
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

    // Filter payments
    const filteredPayments = payments.filter((payment) => {
        // Search term filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            const matchesSearch = 
                payment.customer?.full_name?.toLowerCase().includes(searchLower) ||
                payment.customer?.phone?.includes(searchTerm) ||
                payment.customer?.email?.toLowerCase().includes(searchLower) ||
                payment.external_id?.toLowerCase().includes(searchLower) ||
                payment.id.toLowerCase().includes(searchLower)
            if (!matchesSearch) return false
        }

        // Customer filter
        if (customerFilter && payment.customer?.full_name !== customerFilter) {
            return false
        }

        // Status filter
        if (statusFilter !== "all" && payment.status !== statusFilter) {
            return false
        }

        // Date filters
        if (dateFromFilter) {
            const paymentDate = new Date(payment.created_at)
            const fromDate = new Date(dateFromFilter)
            fromDate.setHours(0, 0, 0, 0) // Start of day
            paymentDate.setHours(0, 0, 0, 0)
            if (paymentDate < fromDate) return false
        }

        if (dateToFilter) {
            const paymentDate = new Date(payment.created_at)
            const toDate = new Date(dateToFilter)
            toDate.setHours(23, 59, 59, 999) // End of day
            if (paymentDate > toDate) return false
        }

        // Amount filters
        if (amountMinFilter) {
            const minAmount = parseFloat(amountMinFilter)
            if (isNaN(minAmount) || payment.amount < minAmount) return false
        }

        if (amountMaxFilter) {
            const maxAmount = parseFloat(amountMaxFilter)
            if (isNaN(maxAmount) || payment.amount > maxAmount) return false
        }

        return true
    })

    const handleAdd = () => {
        setIsSelectCustomerDialogOpen(true)
    }

    const handleCustomerSelected = (customer: Customer, dog: Dog | null) => {
        setSelectedCustomerForPayment(customer)
        setSelectedDogForPayment(dog)
        setIsSelectCustomerDialogOpen(false)
        setIsPaymentModalOpen(true)
    }

    const handleEdit = (payment: Payment) => {
        setEditingPaymentId(payment.id)
        setIsEditDialogOpen(true)
    }

    const handleDelete = (payment: Payment) => {
        setPaymentToDelete(payment)
        setIsDeleteDialogOpen(true)
    }

    const handleSendInvoice = (payment: Payment) => {
        setPaymentToInvoice(payment)
        setIsSendInvoiceDialogOpen(true)
    }

    const handleViewInvoice = async (payment: Payment) => {
        if (!payment.transaction_id) {
            toast({
                title: "שגיאה",
                description: "לא נמצא מזהה עסקה עבור תשלום זה",
                variant: "destructive",
            })
            return
        }

        setPaymentForInvoice(payment)
        setIsInvoiceDialogOpen(true)
        setIsLoadingInvoice(true)
        setInvoiceHtml(null)

        try {
            const invoice = await getInvoiceForPayment(payment.transaction_id)
            setInvoiceHtml(invoice)
        } catch (error: any) {
            console.error("❌ [PaymentsListPage] Error fetching invoice:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לטעון את החשבונית",
                variant: "destructive",
            })
        } finally {
            setIsLoadingInvoice(false)
        }
    }

    const handleDownloadInvoice = () => {
        if (!invoiceHtml || !paymentForInvoice) return

        const blob = new Blob([invoiceHtml], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice-${paymentForInvoice.transaction_id || paymentForInvoice.id}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handlePaymentConfirm = (_paymentData: any) => {
        setIsPaymentModalOpen(false)
        setSelectedCustomerForPayment(null)
        setSelectedDogForPayment(null)
        fetchPayments()
    }

    const handleEditSuccess = () => {
        setIsEditDialogOpen(false)
        setEditingPaymentId(null)
        fetchPayments()
    }

    const handleDeleteConfirm = async () => {
        if (!paymentToDelete) return

        try {
            setIsSaving(true)
            console.log("🗑️ [PaymentsListPage] Deleting payment:", paymentToDelete.id)
            
            const { error } = await supabase
                .from("payments")
                .delete()
                .eq("id", paymentToDelete.id)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: "התשלום נמחק בהצלחה",
            })

            setIsDeleteDialogOpen(false)
            setPaymentToDelete(null)
            fetchPayments()
        } catch (error: any) {
            console.error("❌ [PaymentsListPage] Error deleting payment:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן למחוק את התשלום",
                variant: "destructive",
            })
        } finally {
            setIsSaving(false)
        }
    }

    const getStatusLabel = (status: Payment['status']) => {
        const labels = {
            unpaid: "לא שולם",
            paid: "שולם",
            partial: "חלקי",
        }
        return labels[status]
    }

    const getStatusColor = (status: Payment['status']) => {
        const colors = {
            unpaid: "bg-red-100 text-red-800",
            paid: "bg-green-100 text-green-800",
            partial: "bg-yellow-100 text-yellow-800",
        }
        return colors[status]
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString("he-IL", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
    }

    const formatCurrency = (amount: number, currency: string = "ILS") => {
        return new Intl.NumberFormat("he-IL", {
            style: "currency",
            currency: currency,
        }).format(amount)
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
                            <CardTitle>תשלומים</CardTitle>
                            <CardDescription>ניהול כל התשלומים במערכת</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="חפש תשלומים..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-10 w-64"
                                    dir="rtl"
                                />
                            </div>
                            <Button onClick={handleAdd}>
                                <Plus className="h-4 w-4 ml-2" />
                                חיוב לקוח
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                        <SelectValue placeholder="בחר סטטוס" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="all">הכל</SelectItem>
                                        <SelectItem value="unpaid">לא שולם</SelectItem>
                                        <SelectItem value="paid">שולם</SelectItem>
                                        <SelectItem value="partial">חלקי</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">תאריך מ-</Label>
                                <DatePickerInput
                                    value={dateFromFilter}
                                    onChange={setDateFromFilter}
                                    displayFormat="dd/MM/yyyy"
                                    className="w-full text-right"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label className="text-sm mb-2 block">תאריך עד</Label>
                                <DatePickerInput
                                    value={dateToFilter}
                                    onChange={setDateToFilter}
                                    displayFormat="dd/MM/yyyy"
                                    className="w-full text-right"
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">סכום מינימלי</Label>
                                <Input
                                    type="number"
                                    value={amountMinFilter}
                                    onChange={(e) => setAmountMinFilter(e.target.value)}
                                    placeholder="0"
                                    dir="rtl"
                                />
                            </div>
                            <div>
                                <Label className="text-sm mb-2 block">סכום מקסימלי</Label>
                                <Input
                                    type="number"
                                    value={amountMaxFilter}
                                    onChange={(e) => setAmountMaxFilter(e.target.value)}
                                    placeholder="0"
                                    dir="rtl"
                                />
                            </div>
                        </div>
                        {(customerFilter || statusFilter !== "all" || dateFromFilter || dateToFilter || amountMinFilter || amountMaxFilter) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCustomerFilter("")
                                    setStatusFilter("all")
                                    setDateFromFilter(null)
                                    setDateToFilter(null)
                                    setAmountMinFilter("")
                                    setAmountMaxFilter("")
                                }}
                            >
                                נקה כל הסינונים
                            </Button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="rounded-md border">
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px] [direction:ltr] custom-scrollbar relative">
                            <Table containerClassName="[direction:rtl] !overflow-visible">
                                <TableHeader>
                                    <TableRow className="bg-[hsl(228_36%_95%)] [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[hsl(228_36%_95%)]">
                                        <TableHead className="w-32">תאריך</TableHead>
                                        <TableHead className="w-48">לקוח</TableHead>
                                        <TableHead className="w-32">סכום</TableHead>
                                        <TableHead className="w-32">מטבע</TableHead>
                                        <TableHead className="w-32">סטטוס</TableHead>
                                        <TableHead className="w-32">אמצעי תשלום</TableHead>
                                        <TableHead className="w-32">מזהה חיצוני</TableHead>
                                        <TableHead className="w-48 text-center">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPayments.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                                                לא נמצאו תשלומים
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPayments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>{formatDate(payment.created_at)}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{payment.customer?.full_name || "לא ידוע"}</div>
                                                        {payment.customer?.phone && (
                                                            <div className="text-sm text-gray-500">{payment.customer.phone}</div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">{formatCurrency(payment.amount, payment.currency)}</TableCell>
                                                <TableCell>{payment.currency}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                                                        {getStatusLabel(payment.status)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{payment.method || "-"}</TableCell>
                                                <TableCell className="text-sm text-gray-500">
                                                    {payment.external_id ? (
                                                        <span className="font-mono">{payment.external_id.substring(0, 8)}...</span>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(payment)}
                                                            disabled={isSaving}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        {payment.transaction_id && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleViewInvoice(payment)}
                                                                disabled={isSaving}
                                                                title="הצג חשבונית"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleSendInvoice(payment)}
                                                            disabled={isSaving}
                                                            title="שלח חשבונית"
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(payment)}
                                                            disabled={isSaving}
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

                    <div className="mt-4 text-sm text-gray-500 text-right">
                        סה"כ {filteredPayments.length} תשלומים
                        {filteredPayments.length !== payments.length && ` מתוך ${payments.length}`}
                    </div>
                </CardContent>
            </Card>

            {/* Dialogs */}
            <SelectCustomerForPaymentDialog
                open={isSelectCustomerDialogOpen}
                onOpenChange={setIsSelectCustomerDialogOpen}
                onConfirm={handleCustomerSelected}
            />

            <PaymentModal
                open={isPaymentModalOpen}
                onOpenChange={(open) => {
                    setIsPaymentModalOpen(open)
                    if (!open) {
                        setSelectedCustomerForPayment(null)
                        setSelectedDogForPayment(null)
                    }
                }}
                appointment={null}
                customerId={selectedCustomerForPayment?.id || selectedCustomerForPayment?.recordId || null}
                onConfirm={handlePaymentConfirm}
            />

            {editingPaymentId && (
                <EditPaymentDialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    paymentId={editingPaymentId}
                    onSuccess={handleEditSuccess}
                />
            )}

            {paymentToDelete && (
                <PaymentDeleteConfirmationDialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                    payment={paymentToDelete}
                    onConfirm={handleDeleteConfirm}
                    isDeleting={isSaving}
                />
            )}

            {paymentToInvoice && (
                <SendInvoiceDialog
                    open={isSendInvoiceDialogOpen}
                    onOpenChange={setIsSendInvoiceDialogOpen}
                    payment={paymentToInvoice}
                    onSuccess={() => {
                        setIsSendInvoiceDialogOpen(false)
                        setPaymentToInvoice(null)
                        fetchPayments()
                    }}
                />
            )}

            {/* Invoice View Dialog */}
            <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle>חשבונית</DialogTitle>
                                <DialogDescription>
                                    {paymentForInvoice?.customer?.full_name} - {paymentForInvoice && formatCurrency(paymentForInvoice.amount, paymentForInvoice.currency)}
                                </DialogDescription>
                            </div>
                            {invoiceHtml && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadInvoice}
                                >
                                    <Download className="h-4 w-4 ml-2" />
                                    הורד
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto">
                        {isLoadingInvoice ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="mr-4 text-gray-600">טוען חשבונית...</span>
                            </div>
                        ) : invoiceHtml ? (
                            <div 
                                className="invoice-container"
                                dangerouslySetInnerHTML={{ __html: invoiceHtml }}
                            />
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                לא ניתן לטעון את החשבונית
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

