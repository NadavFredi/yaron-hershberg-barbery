import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Loader2, Search, ShoppingCart, Scissors, Home, Calendar, ExternalLink, CreditCard, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { useNavigate } from "react-router-dom"
import { DatePickerInput } from "@/components/DatePickerInput"
import { PaymentModal } from "@/components/dialogs/manager-schedule/PaymentModal"
import { SelectCustomerForPaymentDialog } from "@/components/dialogs/payments/SelectCustomerForPaymentDialog"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"
import type { PaymentData } from "@/components/dialogs/manager-schedule/PaymentModal/types"
import type { Customer } from "@/components/CustomerSearchInput"

interface CartItem {
    id: string
    cart_id: string
    product_id: string | null
    item_name: string | null
    quantity: number
    unit_price: number
    products?: {
        id: string
        name: string
    } | null
}

interface Cart {
    id: string
    cart_number: number
    customer_id: string | null
    grooming_appointment_id: string | null
    daycare_appointment_id: string | null
    appointment_price: number
    status: string
    created_at: string
    updated_at: string
    customers?: {
        id: string
        full_name: string
    } | null
    grooming_appointments?: {
        id: string
        start_at: string
        dogs?: {
            id: string
            name: string
        }[] | {
            id: string
            name: string
        } | null
    } | null
    daycare_appointments?: {
        id: string
        start_at: string
        dogs?: {
            id: string
            name: string
        }[] | {
            id: string
            name: string
        } | null
    } | null
    cart_items?: CartItem[]
}

export default function CartsSection() {
    const { toast } = useToast()
    const navigate = useNavigate()
    const [carts, setCarts] = useState<Cart[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<"all" | "grooming" | "daycare" | "both">("all")
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "abandoned">("all")
    const [minPriceFilter, setMinPriceFilter] = useState("")
    const [maxPriceFilter, setMaxPriceFilter] = useState("")
    const [cartCreatedFromDate, setCartCreatedFromDate] = useState<Date | null>(null)
    const [cartCreatedToDate, setCartCreatedToDate] = useState<Date | null>(null)
    const [appointmentFromDate, setAppointmentFromDate] = useState<Date | null>(null)
    const [appointmentToDate, setAppointmentToDate] = useState<Date | null>(null)
    const [expandedCarts, setExpandedCarts] = useState<Set<string>>(new Set())
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [selectedCartForPayment, setSelectedCartForPayment] = useState<Cart | null>(null)
    const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState<ManagerAppointment | null>(null)
    const [isLoadingAppointment, setIsLoadingAppointment] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [cartToDelete, setCartToDelete] = useState<Cart | null>(null)
    const [isDeletingCart, setIsDeletingCart] = useState(false)
    const [isSelectCustomerDialogOpen, setIsSelectCustomerDialogOpen] = useState(false)

    useEffect(() => {
        fetchCarts()
    }, [])

    const fetchCarts = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('carts')
                .select(`
                    id,
                    cart_number,
                    customer_id,
                    status,
                    created_at,
                    updated_at,
                    customers (
                        id,
                        full_name
                    ),
                    cart_appointments (
                        id,
                        grooming_appointment_id,
                        daycare_appointment_id,
                        appointment_price,
                        grooming_appointments (
                            id,
                            start_at,
                            dogs (
                                id,
                                name
                            )
                        ),
                        daycare_appointments (
                            id,
                            start_at,
                            dogs (
                                id,
                                name
                            )
                        )
                    ),
                    cart_items (
                        id,
                        cart_id,
                        product_id,
                        item_name,
                        quantity,
                        unit_price,
                        products (
                            id,
                            name
                        )
                    )
                `)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Transform data to match Cart interface (for backward compatibility)
            interface CartWithAppointments {
                cart_appointments?: Array<{
                    grooming_appointment_id?: string | null
                    daycare_appointment_id?: string | null
                    appointment_price?: number
                    grooming_appointments?: { id: string; start_at: string; dogs?: Array<{ id: string; name: string }> | { id: string; name: string } | null }
                    daycare_appointments?: { id: string; start_at: string; dogs?: Array<{ id: string; name: string }> | { id: string; name: string } | null }
                }>
            }

            const transformedCarts = (data || []).map((cart: CartWithAppointments & Cart) => {
                const cartAppointments = cart.cart_appointments || []
                const firstGrooming = cartAppointments.find((ca) => ca.grooming_appointment_id)
                const firstDaycare = cartAppointments.find((ca) => ca.daycare_appointment_id)

                // Calculate total appointment price
                const totalAppointmentPrice = cartAppointments.reduce((sum: number, ca) =>
                    sum + (ca.appointment_price || 0), 0)

                return {
                    ...cart,
                    grooming_appointment_id: firstGrooming?.grooming_appointment_id || null,
                    daycare_appointment_id: firstDaycare?.daycare_appointment_id || null,
                    appointment_price: totalAppointmentPrice,
                    grooming_appointments: firstGrooming?.grooming_appointments || null,
                    daycare_appointments: firstDaycare?.daycare_appointments || null,
                }
            })

            setCarts(transformedCarts)
        } catch (err) {
            console.error('Error fetching carts:', err)
            toast({
                title: "שגיאה",
                description: "לא הצלחנו לטעון את העגלות",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const calculateCartTotal = (cart: Cart): number => {
        const itemsTotal = (cart.cart_items || []).reduce((sum, item) => {
            return sum + (item.unit_price * item.quantity)
        }, 0)
        return itemsTotal + (cart.appointment_price || 0)
    }

    const getAppointmentType = (cart: Cart): "grooming" | "daycare" | "both" | null => {
        const hasGrooming = !!cart.grooming_appointment_id
        const hasDaycare = !!cart.daycare_appointment_id

        if (hasGrooming && hasDaycare) return "both"
        if (hasGrooming) return "grooming"
        if (hasDaycare) return "daycare"
        return null
    }

    // Helper function to safely extract dog names from appointments
    const getDogNames = (cart: Cart): string[] => {
        const dogNames: string[] = []

        // Handle grooming appointments
        if (cart.grooming_appointments) {
            const dogs = cart.grooming_appointments.dogs
            if (Array.isArray(dogs)) {
                dogNames.push(...dogs.map(d => d.name).filter(Boolean))
            } else if (dogs && typeof dogs === 'object' && 'name' in dogs) {
                // Handle single dog object
                dogNames.push(dogs.name)
            }
        }

        // Handle daycare appointments
        if (cart.daycare_appointments) {
            const dogs = cart.daycare_appointments.dogs
            if (Array.isArray(dogs)) {
                dogNames.push(...dogs.map(d => d.name).filter(Boolean))
            } else if (dogs && typeof dogs === 'object' && 'name' in dogs) {
                // Handle single dog object
                dogNames.push(dogs.name)
            }
        }

        return dogNames
    }

    const filteredCarts = useMemo(() => {
        return carts.filter((cart) => {
            // Status filter
            if (statusFilter !== "all" && cart.status !== statusFilter) {
                return false
            }

            // Appointment type filter
            if (appointmentTypeFilter !== "all") {
                const cartType = getAppointmentType(cart)
                if (appointmentTypeFilter === "both" && cartType !== "both") return false
                if (appointmentTypeFilter === "grooming" && cartType !== "grooming") return false
                if (appointmentTypeFilter === "daycare" && cartType !== "daycare") return false
            }

            // Price filter
            const total = calculateCartTotal(cart)
            if (minPriceFilter) {
                const minPrice = parseFloat(minPriceFilter)
                if (!isNaN(minPrice) && total < minPrice) return false
            }
            if (maxPriceFilter) {
                const maxPrice = parseFloat(maxPriceFilter)
                if (!isNaN(maxPrice) && total > maxPrice) return false
            }

            // Cart creation date filter
            if (cartCreatedFromDate) {
                const cartDate = new Date(cart.created_at)
                const fromDate = new Date(cartCreatedFromDate)
                fromDate.setHours(0, 0, 0, 0)
                if (cartDate < fromDate) return false
            }
            if (cartCreatedToDate) {
                const cartDate = new Date(cart.created_at)
                const toDate = new Date(cartCreatedToDate)
                toDate.setHours(23, 59, 59, 999)
                if (cartDate > toDate) return false
            }

            // Appointment date filter
            const appointmentDate = cart.grooming_appointments?.start_at || cart.daycare_appointments?.start_at
            if (appointmentDate) {
                if (appointmentFromDate) {
                    const apptDate = new Date(appointmentDate)
                    const fromDate = new Date(appointmentFromDate)
                    fromDate.setHours(0, 0, 0, 0)
                    if (apptDate < fromDate) return false
                }
                if (appointmentToDate) {
                    const apptDate = new Date(appointmentDate)
                    const toDate = new Date(appointmentToDate)
                    toDate.setHours(23, 59, 59, 999)
                    if (apptDate > toDate) return false
                }
            } else if (appointmentFromDate || appointmentToDate) {
                // If there's a date filter but no appointment date, exclude this cart
                return false
            }

            // Search filter
            if (searchTerm) {
                const normalized = searchTerm.toLowerCase()
                const customerName = cart.customers?.full_name?.toLowerCase() || ""
                const dogNames = getDogNames(cart).join(" ").toLowerCase()
                const itemNames = (cart.cart_items || []).map(item =>
                    (item.item_name || item.products?.name || "").toLowerCase()
                ).join(" ")
                const cartId = cart.id.toLowerCase()

                if (!customerName.includes(normalized) &&
                    !dogNames.includes(normalized) &&
                    !itemNames.includes(normalized) &&
                    !cartId.includes(normalized)) {
                    return false
                }
            }

            return true
        })
    }, [carts, statusFilter, appointmentTypeFilter, minPriceFilter, maxPriceFilter, cartCreatedFromDate, cartCreatedToDate, appointmentFromDate, appointmentToDate, searchTerm])

    const toggleCartExpansion = (cartId: string) => {
        setExpandedCarts(prev => {
            const newSet = new Set(prev)
            if (newSet.has(cartId)) {
                newSet.delete(cartId)
            } else {
                newSet.add(cartId)
            }
            return newSet
        })
    }

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
            active: { label: "פעיל", variant: "default" },
            completed: { label: "הושלם", variant: "secondary" },
            abandoned: { label: "ננטש", variant: "outline" }
        }
        const statusInfo = statusMap[status] || { label: status, variant: "outline" as const }
        return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
    }

    const handleNavigateToAppointment = (cart: Cart) => {
        const appointmentId = cart.grooming_appointment_id || cart.daycare_appointment_id
        const appointmentDate = cart.grooming_appointments?.start_at || cart.daycare_appointments?.start_at

        if (!appointmentId || !appointmentDate) {
            toast({
                title: "שגיאה",
                description: "לא ניתן לנווט לתור - חסרים פרטים",
                variant: "destructive"
            })
            return
        }

        const date = format(new Date(appointmentDate), 'yyyy-MM-dd')
        navigate(`/manager?appointmentId=${appointmentId}&date=${date}`)
    }

    const handleCompletePayment = (cart: Cart) => {
        if (cart.status === 'completed') {
            toast({
                title: "שגיאה",
                description: "העגלה כבר הושלמה",
                variant: "destructive"
            })
            return
        }

        setIsLoadingAppointment(true)
        try {
            // Use cartId to open payment modal with multiple appointments support
            setSelectedCartForPayment(cart)
            setSelectedAppointmentForPayment(null) // Clear single appointment mode
            setShowPaymentModal(true)
        } catch (err) {
            console.error('Error opening payment modal:', err)
            toast({
                title: "שגיאה",
                description: "לא ניתן לפתוח את חלון התשלום",
                variant: "destructive"
            })
        } finally {
            setIsLoadingAppointment(false)
        }
    }

    const handleDeleteCart = (cart: Cart) => {
        setCartToDelete(cart)
        setDeleteConfirmOpen(true)
    }

    const confirmDeleteCart = async () => {
        if (!cartToDelete) return

        setIsDeletingCart(true)
        try {
            const { error } = await supabase
                .from('carts')
                .delete()
                .eq('id', cartToDelete.id)

            if (error) {
                throw error
            }

            toast({
                title: "העגלה נמחקה",
                description: `עגלה מס' ${cartToDelete.cart_number} נמחקה בהצלחה`,
            })

            // Refresh carts list
            await fetchCarts()
            setDeleteConfirmOpen(false)
            setCartToDelete(null)
        } catch (error) {
            console.error('Error deleting cart:', error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את העגלה",
                variant: "destructive"
            })
        } finally {
            setIsDeletingCart(false)
        }
    }

    const handleCreateStandaloneCart = () => {
        // First open customer selection dialog
        setIsSelectCustomerDialogOpen(true)
    }

    const handleCustomerSelected = async (customer: Customer, dog: Dog | null) => {
        try {
            // Create a new cart with the selected customer
            const { data: newCart, error } = await supabase
                .from('carts')
                .insert({
                    status: 'active',
                    customer_id: customer.id
                })
                .select('id')
                .single()

            if (error) throw error

            // Refresh carts list
            await fetchCarts()

            // Close customer selection dialog
            setIsSelectCustomerDialogOpen(false)

            // Open payment modal with the new cart
            setSelectedCartForPayment({ ...newCart, customer_id: customer.id } as Cart)
            setSelectedAppointmentForPayment(null)
            setShowPaymentModal(true)
        } catch (err) {
            console.error('Error creating standalone cart:', err)
            toast({
                title: "שגיאה",
                description: "לא ניתן ליצור עגלה חדשה",
                variant: "destructive"
            })
        }
    }

    const handlePaymentConfirm = (paymentData: PaymentData) => {
        toast({
            title: "תשלום נקלט בהצלחה",
            description: `תשלום בסך ₪${paymentData.amount} נרשם בהצלחה`,
        })
        setShowPaymentModal(false)
        setSelectedCartForPayment(null)
        setSelectedAppointmentForPayment(null)
        fetchCarts() // Refresh carts list
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-4 text-gray-600">טוען עגלות...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Customer Selection Dialog */}
            <SelectCustomerForPaymentDialog
                open={isSelectCustomerDialogOpen}
                onOpenChange={setIsSelectCustomerDialogOpen}
                onConfirm={handleCustomerSelected}
            />

            {/* Payment Modal */}
            <PaymentModal
                open={showPaymentModal}
                onOpenChange={setShowPaymentModal}
                appointment={selectedAppointmentForPayment}
                cartId={selectedCartForPayment?.id || null}
                onConfirm={handlePaymentConfirm}
            />

            {/* Delete Cart Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>מחק עגלה?</AlertDialogTitle>
                        <AlertDialogDescription className="text-right">
                            האם אתה בטוח שברצונך למחוק את עגלה מס' {cartToDelete?.cart_number}?
                            <br />
                            <br />
                            פעולה זו תמחק את העגלה לצמיתות. אם יש תורים משויכים לעגלה זו, הם לא יימחקו.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                        <AlertDialogCancel disabled={isDeletingCart}>ביטול</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeleteCart}
                            disabled={isDeletingCart}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeletingCart ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    מוחק...
                                </>
                            ) : (
                                'מחק'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            עגלות קניות
                        </CardTitle>
                        <Button
                            onClick={handleCreateStandaloneCart}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            צור עגלה עצמאית
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="חיפוש לפי לקוח, כלב, מוצר..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-10"
                                    dir="rtl"
                                />
                            </div>

                            {/* Status Filter */}
                            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "completed" | "abandoned") => setStatusFilter(value)}>
                                <SelectTrigger dir="rtl">
                                    <SelectValue>
                                        {statusFilter === "all" ? "סטטוס: הכל" :
                                            statusFilter === "active" ? "סטטוס: פעיל" :
                                                statusFilter === "completed" ? "סטטוס: הושלם" :
                                                    "סטטוס: ננטש"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="active">פעיל</SelectItem>
                                    <SelectItem value="completed">הושלם</SelectItem>
                                    <SelectItem value="abandoned">ננטש</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Appointment Type Filter */}
                            <Select value={appointmentTypeFilter} onValueChange={(value: "all" | "grooming" | "daycare" | "both") => setAppointmentTypeFilter(value)}>
                                <SelectTrigger dir="rtl">
                                    <SelectValue>
                                        {appointmentTypeFilter === "all" ? "סוג תור: הכל" :
                                            appointmentTypeFilter === "grooming" ? "סוג תור: מספרה" :
                                                appointmentTypeFilter === "daycare" ? "סוג תור: גן" :
                                                    "סוג תור: שניהם"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">הכל</SelectItem>
                                    <SelectItem value="grooming">
                                        <div className="flex items-center gap-2">
                                            <Scissors className="h-4 w-4" />
                                            מספרה
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="daycare">
                                        <div className="flex items-center gap-2">
                                            <Home className="h-4 w-4" />
                                            גן
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="both">שניהם</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Min Price */}
                            <Input
                                type="number"
                                placeholder="מחיר מינימלי"
                                value={minPriceFilter}
                                onChange={(e) => setMinPriceFilter(e.target.value)}
                                dir="rtl"
                            />

                            {/* Max Price */}
                            <Input
                                type="number"
                                placeholder="מחיר מקסימלי"
                                value={maxPriceFilter}
                                onChange={(e) => setMaxPriceFilter(e.target.value)}
                                dir="rtl"
                            />
                        </div>

                        {/* Date Range Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    תאריך יצירת עגלה מ:
                                </Label>
                                <DatePickerInput
                                    value={cartCreatedFromDate}
                                    onChange={setCartCreatedFromDate}
                                    displayFormat="dd/MM/yyyy"
                                    className="w-full text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    תאריך יצירת עגלה עד:
                                </Label>
                                <DatePickerInput
                                    value={cartCreatedToDate}
                                    onChange={setCartCreatedToDate}
                                    displayFormat="dd/MM/yyyy"
                                    className="w-full text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    תאריך תור מ:
                                </Label>
                                <DatePickerInput
                                    value={appointmentFromDate}
                                    onChange={setAppointmentFromDate}
                                    displayFormat="dd/MM/yyyy"
                                    className="w-full text-right"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    תאריך תור עד:
                                </Label>
                                <DatePickerInput
                                    value={appointmentToDate}
                                    onChange={setAppointmentToDate}
                                    displayFormat="dd/MM/yyyy"
                                    className="w-full text-right"
                                />
                            </div>
                        </div>

                        {/* Results count */}
                        <div className="text-sm text-gray-600">
                            נמצאו {filteredCarts.length} עגלות
                        </div>
                    </div>

                    {/* Carts Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right w-16">מס'</TableHead>
                                    <TableHead className="text-right">תאריך יצירה</TableHead>
                                    <TableHead className="text-right">לקוח</TableHead>
                                    <TableHead className="text-right">סוג תור</TableHead>
                                    <TableHead className="text-right">פריטים</TableHead>
                                    <TableHead className="text-right">מחיר תור</TableHead>
                                    <TableHead className="text-right">סה"כ</TableHead>
                                    <TableHead className="text-right">סטטוס</TableHead>
                                    <TableHead className="text-right">פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCarts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                                            לא נמצאו עגלות
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCarts.map((cart) => {
                                        const isExpanded = expandedCarts.has(cart.id)
                                        const total = calculateCartTotal(cart)
                                        const appointmentType = getAppointmentType(cart)
                                        const dogNames = getDogNames(cart).join(", ")

                                        return (
                                            <React.Fragment key={cart.id}>
                                                <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleCartExpansion(cart.id)}>
                                                    <TableCell className="font-semibold text-gray-700">
                                                        {cart.cart_number}
                                                    </TableCell>
                                                    <TableCell>
                                                        {format(new Date(cart.created_at), "dd/MM/yyyy HH:mm", { locale: he })}
                                                    </TableCell>
                                                    <TableCell>
                                                        {cart.customers?.full_name || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {appointmentType === "grooming" && (
                                                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                                                <Scissors className="h-3 w-3" />
                                                                מספרה
                                                            </Badge>
                                                        )}
                                                        {appointmentType === "daycare" && (
                                                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                                                <Home className="h-3 w-3" />
                                                                גן
                                                            </Badge>
                                                        )}
                                                        {appointmentType === "both" && (
                                                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                                                <Scissors className="h-3 w-3" />
                                                                <Home className="h-3 w-3" />
                                                                שניהם
                                                            </Badge>
                                                        )}
                                                        {!appointmentType && "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {cart.cart_items?.length || 0} פריטים
                                                        {dogNames && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                כלבים: {dogNames}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        ₪{cart.appointment_price?.toFixed(2) || "0.00"}
                                                    </TableCell>
                                                    <TableCell className="font-semibold">
                                                        ₪{total.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(cart.status)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    toggleCartExpansion(cart.id)
                                                                }}
                                                            >
                                                                {isExpanded ? "הסתר" : "פרטים"}
                                                            </Button>
                                                            {cart.status !== 'completed' && (
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCompletePayment(cart)
                                                                    }}
                                                                    className="flex items-center gap-1"
                                                                    disabled={isLoadingAppointment}
                                                                >
                                                                    <CreditCard className="h-3 w-3" />
                                                                    השלם תשלום
                                                                </Button>
                                                            )}
                                                            {(cart.grooming_appointment_id || cart.daycare_appointment_id) && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleNavigateToAppointment(cart)
                                                                    }}
                                                                    className="flex items-center gap-1"
                                                                >
                                                                    <ExternalLink className="h-3 w-3" />
                                                                    לתור
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDeleteCart(cart)
                                                                }}
                                                                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                                מחק
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="bg-gray-50">
                                                            <div className="space-y-4 p-4">
                                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                                    <div>
                                                                        <span className="font-semibold">מזהה עגלה:</span> {cart.id}
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-semibold">עודכן לאחרונה:</span>{" "}
                                                                        {format(new Date(cart.updated_at), "dd/MM/yyyy HH:mm", { locale: he })}
                                                                    </div>
                                                                </div>
                                                                {cart.cart_items && cart.cart_items.length > 0 && (
                                                                    <div>
                                                                        <h4 className="font-semibold mb-2">פריטים בעגלה:</h4>
                                                                        <Table>
                                                                            <TableHeader>
                                                                                <TableRow>
                                                                                    <TableHead className="text-right">מוצר</TableHead>
                                                                                    <TableHead className="text-right">כמות</TableHead>
                                                                                    <TableHead className="text-right">מחיר יחידה</TableHead>
                                                                                    <TableHead className="text-right">סה"כ</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {cart.cart_items.map((item) => {
                                                                                    const itemTotal = item.unit_price * item.quantity
                                                                                    const itemName = item.item_name || item.products?.name || "פריט ללא שם"
                                                                                    return (
                                                                                        <TableRow key={item.id}>
                                                                                            <TableCell>{itemName}</TableCell>
                                                                                            <TableCell>{item.quantity}</TableCell>
                                                                                            <TableCell>₪{item.unit_price.toFixed(2)}</TableCell>
                                                                                            <TableCell className="font-semibold">₪{itemTotal.toFixed(2)}</TableCell>
                                                                                        </TableRow>
                                                                                    )
                                                                                })}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

