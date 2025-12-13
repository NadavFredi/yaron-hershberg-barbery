import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronUp, CreditCard } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { CreateDebtDialog } from "@/components/dialogs/debts/CreateDebtDialog"
import { EditDebtDialog } from "@/components/dialogs/debts/EditDebtDialog"
import { DeleteDebtDialog } from "@/components/dialogs/debts/DeleteDebtDialog"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setSelectedAppointmentForPayment, setShowPaymentModal } from "@/store/slices/managerScheduleSlice"
import { Badge } from "@/components/ui/badge"

interface Debt {
    id: string
    customer_id: string
    original_amount: number
    description: string | null
    due_date: string | null
    status: "open" | "partial" | "paid"
    created_at: string
    paid_amount?: number
    remaining_amount?: number
}

interface Payment {
    id: string
    amount: number
    status: string
    method: string | null
    created_at: string
}

interface CustomerDebtsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    customerName: string
}

export const CustomerDebtsModal: React.FC<CustomerDebtsModalProps> = ({
    open,
    onOpenChange,
    customerId,
    customerName
}) => {
    const [debts, setDebts] = useState<Debt[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
    const [debtPayments, setDebtPayments] = useState<Record<string, Payment[]>>({})
    const [expandedDebts, setExpandedDebts] = useState<Set<string>>(new Set())
    const { toast } = useToast()
    const dispatch = useAppDispatch()
    const showPaymentModal = useAppSelector((state) => state.managerSchedule.showPaymentModal)
    const selectedAppointmentForPayment = useAppSelector((state) => state.managerSchedule.selectedAppointmentForPayment)

    const fetchDebts = async () => {
        try {
            setIsLoading(true)
            const { data, error } = await supabase
                .from("debts")
                .select("*")
                .eq("customer_id", customerId)
                .order("created_at", { ascending: false })

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

            setDebts(debtsWithCalculations)
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

    const fetchDebtPayments = async (debtId: string) => {
        try {
            const { data, error } = await supabase
                .from("payments")
                .select("id, amount, status, method, created_at")
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

    useEffect(() => {
        if (!open || !customerId) {
            return
        }
        fetchDebts()
    }, [open, customerId])

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

    const handleAddPayment = (debt: Debt) => {
        // Open payment modal and link to debt
        // Create a minimal appointment-like object for the payment modal
        const appointmentForPayment = {
            id: `debt-${debt.id}`,
            clientId: customerId,
            clientName: customerName,
            serviceType: "grooming" as const,
        }

        // Store debt_id in metadata or pass through Redux
        // We'll need to modify PaymentModal to accept and use debt_id
        // For now, store it in a way that PaymentModal can access
        dispatch(setSelectedAppointmentForPayment({
            ...appointmentForPayment,
            debtId: debt.id, // Add debt_id to the appointment object
        } as any))
        dispatch(setShowPaymentModal(true))

        toast({
            title: "יצירת תשלום",
            description: "לאחר יצירת התשלום, הוא יקושר לחוב זה",
        })
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader className="text-right">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-right">חובות של {customerName}</DialogTitle>
                            <Button
                                onClick={() => setIsCreateDialogOpen(true)}
                                size="sm"
                            >
                                <Plus className="h-4 w-4 ml-2" />
                                הוסף חוב
                            </Button>
                        </div>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="mr-2 text-gray-600">טוען חובות...</span>
                        </div>
                    ) : debts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            אין חובות עבור לקוח זה
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[hsl(228_36%_95%)]">
                                        <TableHead className="w-12"></TableHead>
                                        <TableHead className="text-right">סכום מקורי</TableHead>
                                        <TableHead className="text-right">שולם</TableHead>
                                        <TableHead className="text-right">נותר</TableHead>
                                        <TableHead className="text-right">תאריך יצירה</TableHead>
                                        <TableHead className="text-right">סטטוס</TableHead>
                                        <TableHead className="text-right">פעולות</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {debts.map((debt) => {
                                        const isExpanded = expandedDebts.has(debt.id)
                                        const payments = debtPayments[debt.id] || []

                                        return (
                                            <React.Fragment key={debt.id}>
                                                <TableRow>
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
                                                    <TableCell className="font-semibold">
                                                        ₪{debt.original_amount.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-green-600">
                                                        ₪{(debt.paid_amount || 0).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className={`font-semibold ${debt.remaining_amount && debt.remaining_amount > 0 ? "text-red-600" : "text-green-600"}`}>
                                                        ₪{(debt.remaining_amount || debt.original_amount).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(debt.created_at).toLocaleDateString("he-IL")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={getStatusColor(debt.status)}>
                                                            {getStatusLabel(debt.status)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleEdit(debt)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                                                onClick={() => handleDelete(debt)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="bg-gray-50">
                                                            <div className="p-4 space-y-4">
                                                                {debt.description && (
                                                                    <div>
                                                                        <span className="text-sm font-medium text-gray-700">תיאור: </span>
                                                                        <span className="text-sm text-gray-600">{debt.description}</span>
                                                                    </div>
                                                                )}
                                                                {debt.due_date && (
                                                                    <div>
                                                                        <span className="text-sm font-medium text-gray-700">תאריך יעד: </span>
                                                                        <span className="text-sm text-gray-600">
                                                                            {new Date(debt.due_date).toLocaleDateString("he-IL")}
                                                                        </span>
                                                                    </div>
                                                                )}
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
                                                                                    className="flex items-center justify-between p-2 bg-white rounded border"
                                                                                >
                                                                                    <div className="flex items-center gap-4 text-sm">
                                                                                        <span>₪{payment.amount.toFixed(2)}</span>
                                                                                        <span className="text-gray-500">
                                                                                            {new Date(payment.created_at).toLocaleDateString("he-IL")}
                                                                                        </span>
                                                                                        {payment.method && (
                                                                                            <span className="text-gray-500">{payment.method}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <Badge variant={payment.status === "paid" ? "default" : "secondary"}>
                                                                                        {payment.status === "paid" ? "שולם" : payment.status === "partial" ? "חלקי" : "לא שולם"}
                                                                                    </Badge>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialogs */}
            <CreateDebtDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSuccess={handleCreateSuccess}
                initialCustomerId={customerId}
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

            {/* Payment Modal */}
            {showPaymentModal && selectedAppointmentForPayment && (
                <PaymentModal
                    open={showPaymentModal}
                    onOpenChange={(open) => {
                        dispatch(setShowPaymentModal(open))
                        if (!open) {
                            // Refresh debts when payment modal closes
                            fetchDebts()
                        }
                    }}
                    appointment={selectedAppointmentForPayment as any}
                    customerId={customerId}
                    onConfirm={() => {
                        dispatch(setShowPaymentModal(false))
                        fetchDebts()
                    }}
                />
            )}
        </>
    )
}
