import React, { useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard, Calendar as CalendarIcon, Filter, X, Plus } from "lucide-react"
import { format, startOfDay, endOfDay } from "date-fns"
import { he } from "date-fns/locale"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"

interface Payment {
    id: string
    customer_id: string
    amount: number
    currency: string
    status: "unpaid" | "paid" | "partial"
    method: string | null
    note: string | null
    created_at: string
    updated_at: string
}

interface CustomerPaymentsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    customerName: string
}

export const CustomerPaymentsModal: React.FC<CustomerPaymentsModalProps> = ({
    open,
    onOpenChange,
    customerId,
    customerName
}) => {
    const [payments, setPayments] = useState<Payment[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
    const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false)
    const { toast } = useToast()

    const fetchPayments = async () => {
        try {
            setIsLoading(true)
            console.log("🔍 [CustomerPaymentsModal] Fetching payments for customer:", customerId)

            // Fetch payments directly linked to customer
            const { data: customerPayments, error: customerError } = await supabase
                .from("payments")
                .select("*")
                .eq("customer_id", customerId)
                .order("created_at", { ascending: false })

            if (customerError) throw customerError

            // No dogs in barbershop - only use direct customer payments
            const formattedPayments: Payment[] = (customerPayments || []).map((p: any) => ({
                id: p.id,
                customer_id: p.customer_id,
                amount: p.amount,
                currency: p.currency,
                status: p.status,
                method: p.method,
                note: p.note,
                created_at: p.created_at,
                updated_at: p.updated_at,
            }))

            setPayments(formattedPayments)
            console.log("✅ [CustomerPaymentsModal] Loaded payments:", formattedPayments.length)
        } catch (error: any) {
            console.error("❌ [CustomerPaymentsModal] Failed to fetch payments:", error)
            toast({
                title: "שגיאה",
                description: error.message || "לא ניתן לטעון את התשלומים",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Fetch payments for this customer (including payments for their dogs)
    useEffect(() => {
        if (!open || !customerId) {
            return
        }
        fetchPayments()
    }, [open, customerId, toast])

    // Reset date filters when modal closes
    useEffect(() => {
        if (!open) {
            setDateRange(undefined)
        }
    }, [open])

    // Filter payments by date range
    const filteredPayments = useMemo(() => {
        if (!dateRange?.from) {
            return payments
        }

        return payments.filter(payment => {
            const paymentDate = new Date(payment.created_at)
            const paymentDay = startOfDay(paymentDate)
            const start = startOfDay(dateRange.from!)
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!)

            return paymentDay >= start && paymentDay <= end
        })
    }, [payments, dateRange])

    const dateRangeLabel = useMemo(() => {
        if (!dateRange?.from) {
            return "בחר טווח תאריכים"
        }
        const fromLabel = format(dateRange.from, 'dd/MM/yyyy', { locale: he })
        const toLabel = dateRange.to ? format(dateRange.to, 'dd/MM/yyyy', { locale: he }) : fromLabel
        return dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime()
            ? `${fromLabel} - ${toLabel}`
            : fromLabel
    }, [dateRange])

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'paid':
                return 'default' // green
            case 'unpaid':
                return 'destructive' // red
            case 'partial':
                return 'secondary' // gray
            default:
                return 'outline'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'paid':
                return 'שולם'
            case 'unpaid':
                return 'לא שולם'
            case 'partial':
                return 'חלקי'
            default:
                return status
        }
    }

    const formatCurrency = (amount: number, currency: string) => {
        const symbols: Record<string, string> = {
            ILS: '₪',
            USD: '$',
            EUR: '€',
        }
        return `${symbols[currency] || currency} ${amount.toFixed(2)}`
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader className="text-right">
                    <div className="flex items-center justify-between pl-6">
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            תשלומים של {customerName}
                        </DialogTitle>
                        <Button
                            onClick={() => setIsAddPaymentDialogOpen(true)}
                            size="sm"
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            שלם עכשיו
                        </Button>
                    </div>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Date Range Filter */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-gray-600" />
                                    <Label className="text-sm font-medium text-gray-900">סינון לפי תאריך</Label>
                                </div>
                                {dateRange?.from && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDateRange(undefined)}
                                        className="text-xs h-7"
                                    >
                                        <X className="h-3 w-3 ml-1" />
                                        נקה
                                    </Button>
                                )}
                            </div>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-between text-right",
                                            !dateRange?.from && "text-gray-500"
                                        )}
                                    >
                                        <span>{dateRangeLabel}</span>
                                        <CalendarIcon className="h-4 w-4 mr-2" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={1}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Payments List */}
                        <div className="space-y-3">
                            {filteredPayments.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    {dateRange?.from ? "אין תשלומים בטווח התאריכים שנבחר" : "אין תשלומים עבור לקוח זה"}
                                </div>
                            ) : (
                                filteredPayments.map((payment) => (
                                    <Card key={payment.id}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">
                                                    {formatCurrency(payment.amount, payment.currency)}
                                                </CardTitle>
                                                <Badge variant={getStatusBadgeVariant(payment.status)}>
                                                    {getStatusLabel(payment.status)}
                                                </Badge>
                                            </div>
                                            <CardDescription className="text-right">
                                                <div className="flex items-center gap-2 mt-2">
                                                    <CalendarIcon className="h-4 w-4" />
                                                    {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                                                </div>
                                                {payment.method && (
                                                    <div className="mt-1">אמצעי תשלום: {payment.method}</div>
                                                )}
                                            </CardDescription>
                                        </CardHeader>
                                        {payment.note && (
                                            <CardContent>
                                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{payment.note}</p>
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
            <PaymentModal
                open={isAddPaymentDialogOpen}
                onOpenChange={setIsAddPaymentDialogOpen}
                appointment={null}
                onConfirm={(_paymentData: any) => {
                    fetchPayments()
                }}
            />
        </Dialog>
    )
}

