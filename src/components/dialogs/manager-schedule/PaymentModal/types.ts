import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

export interface PaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: ManagerAppointment | null // For backward compatibility - if provided, use it
    cartId?: string | null // If provided, fetch cart and its appointments
    customerId?: string | null // If provided, use this customer when creating a new cart
    onConfirm: (paymentData: PaymentData) => void
}

export interface CartAppointment {
    id: string
    cart_id: string
    grooming_appointment_id: string | null
    daycare_appointment_id: string | null
    appointment_price: number
    appointment?: ManagerAppointment // The full appointment data
}

export interface PaymentData {
    amount: number
    paymentMethod: 'apps' | 'credit' | 'bank_transfer'
    orderItems: OrderItem[]
    hasReceipt: boolean
    editedAppointmentPrice?: number
}

export interface Product {
    id: string
    name: string
    price: number
    description?: string
}

export interface OrderItem {
    id: string
    name: string
    amount: number
    price: number
    needsInvoice: boolean
}

export interface BreedPriceRange {
    minPrice: number | null
    maxPrice: number | null
    hourlyPrice: number | null
    notes: string | null
    breedName?: string
}


