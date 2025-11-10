import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { CreditCard, Smartphone, Building2, FileText, Receipt, ArrowRight, Plus, Minus, Trash2, ChevronLeft, Info, Loader2, CheckCircle2, X, Search, ChevronDown, Save } from "lucide-react"
import type { ManagerAppointment } from "@/types/managerSchedule"
import { supabase } from "@/integrations/supabase/client"

interface PaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointment: ManagerAppointment | null
    onConfirm: (paymentData: PaymentData) => void
}

export interface PaymentData {
    amount: number
    paymentMethod: 'apps' | 'credit' | 'bank_transfer'
    orderItems: OrderItem[]
    hasReceipt: boolean
    editedAppointmentPrice?: number
}

interface Product {
    id: string
    name: string
    price: number
    description?: string
}

interface OrderItem {
    id: string
    name: string
    amount: number
    price: number
    needsInvoice: boolean
}

interface MockItem {
    id: string
    name: string
    price: number
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    open,
    onOpenChange,
    appointment,
    onConfirm
}) => {
    const [step, setStep] = useState(1) // Step 1: Price + Products, Step 2: Payment method, Step 3: Payment sub-type, Step 4: Confirmation
    const [paymentType, setPaymentType] = useState<'apps' | 'credit' | 'bank_transfer' | null>(null)
    const [paymentSubType, setPaymentSubType] = useState<string | null>(null)
    const [orderItems, setOrderItems] = useState<OrderItem[]>([])
    const [hasReceipt, setHasReceipt] = useState(true)
    const [appointmentPrice, setAppointmentPrice] = useState<string>('')
    const [originalAppointmentPrice, setOriginalAppointmentPrice] = useState<string>('0')
    const [isLoadingTreatmentTypePrices, setIsLoadingTreatmentTypePrices] = useState(false)
    const [treatmentTypePriceRange, setTreatmentTypePriceRange] = useState<{ minPrice: number | null; maxPrice: number | null } | null>(null)
    const [isSavingPrice, setIsSavingPrice] = useState(false)
    const [priceSaved, setPriceSaved] = useState(false)

    // Product search and management
    const [products, setProducts] = useState<Product[]>([])
    const [isLoadingProducts, setIsLoadingProducts] = useState(false)
    const [showCreateProduct, setShowCreateProduct] = useState(false)
    const [newProductName, setNewProductName] = useState('')
    const [newProductPrice, setNewProductPrice] = useState('')
    const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, string>>({})
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)
    const [isProductsListOpen, setIsProductsListOpen] = useState(true)
    const [isAddingNewItem, setIsAddingNewItem] = useState(false)
    const [newItemSearchResults, setNewItemSearchResults] = useState<Product[]>([])
    const [tempNewItem, setTempNewItem] = useState({ name: '', price: '0', quantity: '1' })
    const [hasSearchedProducts, setHasSearchedProducts] = useState(false)

    // Cart management
    const [cartId, setCartId] = useState<string | null>(null)
    const [originalOrderItems, setOriginalOrderItems] = useState<OrderItem[]>([])
    const [isLoadingCart, setIsLoadingCart] = useState(false)
    const [isSavingCart, setIsSavingCart] = useState(false)
    const [cartSaved, setCartSaved] = useState(false)
    const [isSendingPaymentRequest, setIsSendingPaymentRequest] = useState(false)

    // Reset state when modal opens
    useEffect(() => {
        if (open && appointment) {
            setStep(1)
            setPaymentType(null)
            setPaymentSubType(null)
            setHasReceipt(true)
            setProducts([])
            setShowCreateProduct(false)
            setNewProductName('')
            setNewProductPrice('')
            setTreatmentTypePriceRange(null)
            setPriceSaved(false)
            setCartSaved(false)
            // Initialize appointment price from the appointment prop
            const basePrice = appointment?.price || 0
            setAppointmentPrice(basePrice.toString())
            setOriginalAppointmentPrice(basePrice.toString())

            // Fetch active cart for this appointment
            fetchActiveCart()

            // Fetch treatmentType pricing if it's a grooming appointment with a treatment
            if (appointment?.serviceType === 'grooming' && appointment?.treatments && appointment.treatments.length > 0) {
                fetchTreatmentTypePrices(appointment.treatments[0].treatmentType)
            }
        }
    }, [open, appointment])

    // Fetch treatmentType prices from Airtable via Supabase edge function
    const fetchTreatmentTypePrices = async (treatmentTypeName?: string) => {
        if (!treatmentTypeName) {
            setIsLoadingTreatmentTypePrices(false)
            return
        }

        setIsLoadingTreatmentTypePrices(true)
        try {
            // Use Supabase edge function to fetch treatmentType pricing by name
            const { data, error } = await supabase.functions.invoke('get-treatmentType-pricing', {
                body: { treatmentTypeName }
            })

            if (error) throw error

            // Set the treatmentType price range from the response
            if (data?.minPrice || data?.maxPrice) {
                setTreatmentTypePriceRange({
                    minPrice: data.minPrice || null,
                    maxPrice: data.maxPrice || null
                })
            }
        } catch (err) {
            console.error('Error fetching treatmentType prices:', err)
            // Don't block the user if this fails
            setTreatmentTypePriceRange(null)
        } finally {
            setIsLoadingTreatmentTypePrices(false)
        }
    }

    // Get treatmentType info for pricing reference
    const getTreatmentTypePriceInfo = () => {
        return treatmentTypePriceRange
    }

    // Check if price is dirty (modified from original)
    const isPriceDirty = () => {
        return appointmentPrice !== originalAppointmentPrice && appointmentPrice !== '0'
    }

    // Reset price to original value
    const handleCancelPriceChange = () => {
        setAppointmentPrice(originalAppointmentPrice)
        setPriceSaved(false)
    }

    // Save appointment price via Supabase edge function
    const handleSavePrice = async () => {
        if (!appointment?.id || !isPriceDirty()) return

        setIsSavingPrice(true)
        try {
            const { data, error } = await supabase.functions.invoke('save-appointment-price', {
                body: {
                    appointmentId: appointment.id,
                    price: parseFloat(appointmentPrice) || 0,
                    recordId: appointment.recordId,
                    recordNumber: appointment.recordNumber,
                    serviceType: appointment.serviceType, // garden or grooming
                },
            })

            if (error) throw error

            // Update original price to current value
            setOriginalAppointmentPrice(appointmentPrice)
            setPriceSaved(true)

            // Remove the unused data variable by using underscore
            // eslint-disable-line @typescript-eslint/no-unused-vars

            // Reset the saved indicator after 3 seconds
            setTimeout(() => {
                setPriceSaved(false)
            }, 3000)
        } catch (err) {
            console.error('Error saving price:', err)
            // Show error toast or something
        } finally {
            setIsSavingPrice(false)
        }
    }

    // Fetch products from Airtable
    const searchProducts = async (query: string) => {
        if (query.length < 2) {
            setProducts([])
            setNewItemSearchResults([])
            setShowCreateProduct(false)
            setHasSearchedProducts(false)
            return
        }

        setIsLoadingProducts(true)
        setHasSearchedProducts(false)
        try {
            const { data, error } = await supabase.functions.invoke('search-products', {
                body: { query }
            })

            if (error) throw error

            const foundProducts = data?.products || []
            setProducts(foundProducts)
            setNewItemSearchResults(foundProducts)
            setHasSearchedProducts(true)

            // If no products found, show option to create new product
            if (foundProducts.length === 0) {
                setShowCreateProduct(true)
                setNewProductName(query)
            } else {
                setShowCreateProduct(false)
            }
        } catch (err) {
            console.error('Error searching products:', err)
            setProducts([])
            setNewItemSearchResults([])
            setHasSearchedProducts(true)
        } finally {
            setIsLoadingProducts(false)
        }
    }

    // Handle adding new item inline
    const handleStartAddingItem = () => {
        setIsAddingNewItem(true)
        setTempNewItem({ name: '', price: '0', quantity: '1' })
    }

    const handleSelectProductFromSearch = (product: Product, quantity: string) => {
        const newOrderItem: OrderItem = {
            id: product.id,
            name: product.name,
            amount: parseInt(quantity) || 1,
            price: product.price,
            needsInvoice: false
        }

        setOrderItems([...orderItems, newOrderItem])
        setIsAddingNewItem(false)
        setTempNewItem({ name: '', price: '0', quantity: '1' })
        setNewItemSearchResults([])
    }

    const handleConfirmNewItem = () => {
        if (!tempNewItem.name) return

        const newOrderItem: OrderItem = {
            id: `custom_${Date.now()}`,
            name: tempNewItem.name,
            amount: parseInt(tempNewItem.quantity) || 1,
            price: parseFloat(tempNewItem.price) || 0,
            needsInvoice: false
        }

        setOrderItems([...orderItems, newOrderItem])
        setIsAddingNewItem(false)
        setTempNewItem({ name: '', price: '0', quantity: '1' })
        setNewItemSearchResults([])
    }

    const handleCancelAddingItem = () => {
        setIsAddingNewItem(false)
        setTempNewItem({ name: '', price: '0', quantity: '1' })
        setNewItemSearchResults([])
    }

    // Create new product
    const handleCreateProduct = () => {
        if (!newProductName || !newProductPrice) return

        const newProduct: Product = {
            id: `custom_${Date.now()}`,
            name: newProductName,
            price: parseFloat(newProductPrice) || 0,
        }

        const newOrderItem: OrderItem = {
            id: newProduct.id,
            name: newProduct.name,
            amount: 1,
            price: newProduct.price,
            needsInvoice: false
        }

        setOrderItems([...orderItems, newOrderItem])
        setNewProductName('')
        setNewProductPrice('')
        setShowCreateProduct(false)
        setProducts([])
    }

    // Add product with custom price and quantity
    const handleAddProductWithCustomPrice = (product: Product, customPrice: string, quantity: string) => {
        const price = parseFloat(customPrice) || product.price
        const qty = parseInt(quantity) || 1

        const newOrderItem: OrderItem = {
            id: product.id,
            name: product.name,
            amount: qty,
            price: price,
            needsInvoice: false
        }

        setOrderItems([...orderItems, newOrderItem])
        // Don't clear search results - allow adding multiple items
        // Keep the search query but reset quantity for this product
        setSelectedProductQuantities({
            ...selectedProductQuantities,
            [product.id]: '1'
        })
    }

    // Update item price
    const handleUpdateItemPrice = (itemId: string, newPrice: number) => {
        setOrderItems(orderItems.map(item =>
            item.id === itemId ? { ...item, price: newPrice } : item
        ))
    }

    // Add item to order
    const handleAddItem = (item: MockItem) => {
        const existingIndex = orderItems.findIndex(orderItem => orderItem.name === item.name)

        if (existingIndex >= 0) {
            // Update quantity of existing item
            const updated = [...orderItems]
            updated[existingIndex].amount += 1
            setOrderItems(updated)
        } else {
            // Add new item
            const newOrderItem: OrderItem = {
                id: item.id,
                name: item.name,
                amount: 1,
                price: item.price,
                needsInvoice: false
            }
            setOrderItems([...orderItems, newOrderItem])
        }
    }

    // Update item quantity
    const handleUpdateQuantity = (itemId: string, delta: number) => {
        setOrderItems(orderItems.map(item => {
            if (item.id === itemId) {
                const newAmount = item.amount + delta
                if (newAmount <= 0) {
                    return null as OrderItem | null
                }
                return { ...item, amount: newAmount }
            }
            return item
        }).filter((item): item is OrderItem => item !== null))
    }

    // Remove item from order
    const handleRemoveItem = (itemId: string) => {
        setOrderItems(orderItems.filter(item => item.id !== itemId))
    }

    // Toggle invoice requirement for item
    const handleToggleInvoice = (itemId: string) => {
        setOrderItems(orderItems.map(item =>
            item.id === itemId ? { ...item, needsInvoice: !item.needsInvoice } : item
        ))
    }

    // Calculate total amount
    const calculateTotal = () => {
        return orderItems.reduce((total, item) => total + (item.price * item.amount), 0)
    }

    // Check if cart is dirty (modified from original)
    const isCartDirty = () => {
        if (orderItems.length !== originalOrderItems.length) return true

        // Check if any item changed
        for (const item of orderItems) {
            const originalItem = originalOrderItems.find(oi => oi.id === item.id)
            if (!originalItem || originalItem.amount !== item.amount || originalItem.price !== item.price || originalItem.name !== item.name) {
                return true
            }
        }

        // Check if any original item was removed
        for (const originalItem of originalOrderItems) {
            if (!orderItems.find(item => item.id === originalItem.id)) {
                return true
            }
        }

        return false
    }

    // Fetch active cart for appointment
    const fetchActiveCart = async () => {
        if (!appointment?.id || !appointment?.serviceType) return

        setIsLoadingCart(true)
        try {
            const { data, error } = await supabase.functions.invoke('get-active-cart', {
                body: {
                    appointmentId: appointment.id,
                    serviceType: appointment.serviceType,
                },
            })

            if (error) throw error

            if (data?.success && data?.cart) {
                setCartId(data.cart.id)
                const items = data.cart.orderItems || []
                setOrderItems(items)
                setOriginalOrderItems([...items])
            } else {
                // No active cart found
                setCartId(null)
                setOrderItems([])
                setOriginalOrderItems([])
            }
        } catch (err) {
            console.error('Error fetching active cart:', err)
            // Don't block user if this fails - start with empty cart
            setCartId(null)
            setOrderItems([])
            setOriginalOrderItems([])
        } finally {
            setIsLoadingCart(false)
        }
    }

    // Save cart
    const handleSaveCart = async (): Promise<string | null> => {
        if (!appointment?.id || !appointment?.serviceType) return null

        setIsSavingCart(true)
        try {
            const { data, error } = await supabase.functions.invoke('save-cart', {
                body: {
                    appointmentId: appointment.id,
                    orderItems,
                    appointmentPrice,
                    cartId,
                    serviceType: appointment.serviceType,
                },
            })

            if (error) throw error

            // Update cart ID if returned
            const newCartId = data?.cartId || cartId
            if (newCartId) {
                setCartId(newCartId)
            }

            // Update original items to mark cart as saved
            setOriginalOrderItems([...orderItems])
            setCartSaved(true)

            // Reset the saved indicator after 3 seconds
            setTimeout(() => {
                setCartSaved(false)
            }, 3000)

            return newCartId
        } catch (err) {
            console.error('Error saving cart:', err)
            // Show error toast or something
            throw err
        } finally {
            setIsSavingCart(false)
        }
    }

    // Send payment request
    const handleSendPaymentRequest = async () => {
        if (!appointment?.id || (paymentSubType !== 'bit' && paymentSubType !== 'paybox')) return

        setIsSendingPaymentRequest(true)
        try {
            // Check if we have items
            if (orderItems.length === 0) {
                throw new Error('לא ניתן לשלוח בקשת תשלום ללא פריטים בעגלה')
            }

            // First ensure cart is saved to get/create cart ID
            let currentCartId = cartId
            if (isCartDirty() || !currentCartId) {
                const savedCartId = await handleSaveCart()
                if (!savedCartId) {
                    throw new Error('לא הצלחנו לשמור או ליצור עגלה')
                }
                currentCartId = savedCartId
            }

            if (!currentCartId) {
                throw new Error('לא הצלחנו לקבל מזהה עגלה')
            }

            const { data, error } = await supabase.functions.invoke('send-payment-request', {
                body: {
                    cartId: currentCartId,
                    appointmentId: appointment.id,
                    paymentGateway: paymentSubType === 'bit' ? 'bit' : 'paybox',
                },
            })

            if (error) throw error

            // Close modal on success
            handleClose()
        } catch (err) {
            console.error('Error sending payment request:', err)
            // Show error toast or something
        } finally {
            setIsSendingPaymentRequest(false)
        }
    }

    const handleBackStep = () => {
        if (step === 4) {
            // Go back to payment sub-type selection
            setStep(3)
        } else if (step === 3) {
            // Go back to payment method selection
            setStep(2)
            setPaymentSubType(null)
        } else if (step === 2) {
            // Go back to products step
            setStep(1)
            setPaymentType(null)
        }
    }

    const handleContinueFromStep1 = () => {
        // Move to payment method selection
        setStep(2)
    }

    const handleConfirm = () => {
        // Allow confirmation even with no items - user can set price only

        const paymentData: PaymentData = {
            amount: orderItems.length > 0 ? calculateTotal() : parseFloat(appointmentPrice) || 0,
            paymentMethod: paymentType || 'bank_transfer', // Default to bank_transfer if none selected
            orderItems,
            hasReceipt,
            editedAppointmentPrice: parseFloat(appointmentPrice) || 0
        }

        onConfirm(paymentData)
        handleReset()
    }

    const handleReset = () => {
        setStep(1)
        setPaymentType(null)
        setPaymentSubType(null)
        setOrderItems([])
        setOriginalOrderItems([])
        setHasReceipt(true)
        setAppointmentPrice('0')
        setOriginalAppointmentPrice('0')
        setPriceSaved(false)
        setCartId(null)
        setCartSaved(false)
    }

    const handleClose = () => {
        handleReset()
        onOpenChange(false)
    }

    const totalAmount = calculateTotal()
    const treatmentTypePriceInfo = getTreatmentTypePriceInfo()

    // Get step labels for breadcrumbs
    const getStepLabel = () => {
        if (paymentType === 'apps') return 'אפליקציות'
        if (paymentType === 'credit') return 'אשראי'
        if (paymentType === 'bank_transfer') return 'העברה בנקאית ומזומן'
        return ''
    }

    const getSubTypeLabel = () => {
        if (paymentType === 'apps') {
            if (paymentSubType === 'paybox') return 'פייבוקס'
            if (paymentSubType === 'bit') return 'ביט'
        }
        if (paymentType === 'credit') {
            if (paymentSubType === 'saved_card') return 'שמור במערכת'
            if (paymentSubType === 'payment_page') return 'דף סליקה'
            if (paymentSubType === 'terminal') return 'מסופון'
        }
        if (paymentType === 'bank_transfer') {
            if (paymentSubType === 'bank_transfer') return 'העברה בנקאית'
            if (paymentSubType === 'cash') return 'מזומן'
        }
        return ''
    }

    const handleBreadcrumbClick = (targetStep: number) => {
        if (targetStep === 1) {
            setStep(1)
            setPaymentType(null)
            setPaymentSubType(null)
            setOrderItems([])
        } else if (targetStep === 2) {
            setStep(2)
            setPaymentSubType(null)
            setOrderItems([])
        } else if (targetStep === 3) {
            setStep(3)
            setOrderItems([])
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {step === 1 && 'מחיר ומוצרים'}
                        {step === 2 && 'אמצעי תשלום'}
                        {step === 3 && (paymentType === 'apps' ? 'בחר אפליקציה' : paymentType === 'credit' ? 'בחר סוג תשלום' : 'בחר סוג תשלום')}
                        {step === 4 && 'אישור תשלום'}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {appointment?.treatments[0]?.name && `לתור של ${appointment.treatments[0].name}`}
                    </DialogDescription>
                </DialogHeader>

                {/* Breadcrumbs */}
                {(step === 2 || step === 3 || step === 4) && (
                    <div className="flex items-center  gap-2 text-sm text-gray-600 pb-2 border-b">
                        <span
                            className="cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleBreadcrumbClick(1)}
                        >
                            מחיר ומוצרים
                        </span>
                        {(step === 3 || step === 4) && paymentType && (
                            <>
                                <ChevronLeft className="h-4 w-4" />
                                <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleBreadcrumbClick(2)}>
                                    אמצעי תשלום
                                </span>
                            </>
                        )}
                        {step === 4 && paymentSubType && (
                            <>
                                <ChevronLeft className="h-4 w-4" />
                                <span
                                    className="cursor-pointer hover:text-blue-600 transition-colors"
                                    onClick={() => handleBreadcrumbClick(3)}
                                >
                                    {getSubTypeLabel()}
                                </span>
                            </>
                        )}
                    </div>
                )}

                {step === 1 && (
                    // Step 1: Price and Products
                    <div className="space-y-6 py-4">
                        {/* Appointment Price - Editable */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 relative">
                            {/* Loading Overlay */}
                            {isLoadingTreatmentTypePrices && (
                                <div className="absolute inset-0 bg-blue-50/80 flex items-center justify-center rounded-lg">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-sm text-gray-700 text-right">מחיר התור</Label>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">₪</span>

                                    {/* Action buttons inside input - appears when price is modified */}
                                    {isPriceDirty() && !isSavingPrice && (
                                        <div className="absolute left-1 top-1/2 transform -translate-y-1/2 flex gap-1 z-10">
                                            {/* Cancel button (X icon) */}
                                            <button
                                                type="button"
                                                onClick={handleCancelPriceChange}
                                                className="text-red-600 hover:text-red-700"
                                                title="ביטול שינוי"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                            {/* Save button (checkmark) */}
                                            <button
                                                type="button"
                                                onClick={handleSavePrice}
                                                className="text-green-600 hover:text-green-700"
                                                title="שמירה"
                                            >
                                                <CheckCircle2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Loading indicator inside input */}
                                    {isSavingPrice && (
                                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 z-10">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        </div>
                                    )}

                                    {/* Success checkmark inside input */}
                                    {priceSaved && (
                                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 z-10">
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                    )}

                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={appointmentPrice}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            // Only allow numbers
                                            const numericValue = value.replace(/[^0-9]/g, '')

                                            // If result is empty, set to 0
                                            if (numericValue === '') {
                                                setAppointmentPrice('0')
                                            } else if (appointmentPrice === '0' && numericValue !== '0') {
                                                // If field shows "0" and user types a digit, remove the 0 prefix
                                                const newValue = numericValue.replace(/^0+/, '')
                                                setAppointmentPrice(newValue === '' ? '0' : newValue)
                                            } else {
                                                setAppointmentPrice(numericValue)
                                            }
                                        }}
                                        onFocus={(e) => {
                                            // When user focuses on the input, if it's "0", select all for easy replacement
                                            if (appointmentPrice === '0') {
                                                e.target.select()
                                            }
                                        }}
                                        className={`text-right text-2xl font-bold text-blue-900 pr-8 ${(isPriceDirty() || isSavingPrice || priceSaved) ? 'pl-20' : ''
                                            }`}
                                        dir="rtl"
                                        disabled={isSavingPrice}
                                    />
                                </div>
                            </div>

                            {/* TreatmentType Price Range Info - only show for grooming */}
                            {appointment?.serviceType === 'grooming' && treatmentTypePriceInfo && !isLoadingTreatmentTypePrices && (
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                                        <Info className="h-4 w-4" />
                                        <span>טווח מחירים מומלץ לגזע:</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        {treatmentTypePriceInfo.minPrice && (
                                            <div className="text-right">
                                                <span className="text-gray-600">מינימום: </span>
                                                <span className="font-semibold text-green-700">₪{treatmentTypePriceInfo.minPrice}</span>
                                            </div>
                                        )}
                                        {treatmentTypePriceInfo.maxPrice && (
                                            <div className="text-right">
                                                <span className="text-gray-600">מקסימום: </span>
                                                <span className="font-semibold text-green-700">₪{treatmentTypePriceInfo.maxPrice}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Product Search and Management - Hidden Accordion */}
                        {false && (
                            <div className="space-y-3" data-product-search-section>
                                <button
                                    type="button"
                                    onClick={() => setIsProductSearchOpen(!isProductSearchOpen)}
                                    className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <Label className="text-right block text-lg font-semibold cursor-pointer">חיפוש מוצרים</Label>
                                    <ChevronDown className={`h-5 w-5 transition-transform ${isProductSearchOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isProductSearchOpen && (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                                type="text"
                                                value=""
                                                onChange={(e) => {
                                                    searchProducts(e.target.value)
                                                }}
                                                placeholder="חפש מוצר..."
                                                className="text-right pr-10"
                                                dir="rtl"
                                            />
                                        </div>

                                        {/* Search Results */}
                                        {isLoadingProducts && (
                                            <div className="flex items-center justify-center py-4">
                                                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                            </div>
                                        )}

                                        {products.length > 0 && (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {products.map((product) => (
                                                    <div key={product.id} className="border rounded-lg p-2 bg-gray-50">
                                                        <div className="flex items-center gap-2 justify-between">
                                                            <div className="flex-1 text-right">
                                                                <div className="font-medium text-sm">{product.name}</div>
                                                                <div className="text-xs text-gray-500">מוצע: ₪{product.price}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-xs text-gray-700 whitespace-nowrap">כמות:</Label>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={selectedProductQuantities[product.id] || '1'}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value.replace(/[^0-9]/g, '')
                                                                        setSelectedProductQuantities({
                                                                            ...selectedProductQuantities,
                                                                            [product.id]: value || '1'
                                                                        })
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'ArrowUp') {
                                                                            e.preventDefault()
                                                                            const current = parseInt(selectedProductQuantities[product.id] || '1')
                                                                            setSelectedProductQuantities({
                                                                                ...selectedProductQuantities,
                                                                                [product.id]: (current + 1).toString()
                                                                            })
                                                                        } else if (e.key === 'ArrowDown') {
                                                                            e.preventDefault()
                                                                            const current = parseInt(selectedProductQuantities[product.id] || '1')
                                                                            setSelectedProductQuantities({
                                                                                ...selectedProductQuantities,
                                                                                [product.id]: Math.max(1, current - 1).toString()
                                                                            })
                                                                        }
                                                                    }}
                                                                    className="w-16 h-8 text-sm text-center"
                                                                    dir="rtl"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Label className="text-xs text-gray-700 whitespace-nowrap">מחיר:</Label>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    placeholder={product.price.toString()}
                                                                    data-price-input={product.id}
                                                                    className="w-20 h-8 text-sm"
                                                                    dir="rtl"
                                                                />
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                className="h-8 px-3"
                                                                onClick={() => {
                                                                    const customPriceInput = document.querySelector(`[data-price-input="${product.id}"]`) as HTMLInputElement
                                                                    const customPrice = customPriceInput?.value || product.price.toString()
                                                                    const quantity = selectedProductQuantities[product.id] || '1'
                                                                    handleAddProductWithCustomPrice(product, customPrice, quantity)
                                                                }}
                                                            >
                                                                <Plus className="h-3 w-3 ml-1" /> הוסף
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Create New Product Option - Compact Single Line */}
                                        {showCreateProduct && (
                                            <div className="border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50">
                                                <div className="text-right mb-1">
                                                    <Label className="font-semibold text-blue-900 text-xs">יצירת מוצר חדש</Label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="text"
                                                        value={newProductName}
                                                        onChange={(e) => setNewProductName(e.target.value)}
                                                        placeholder="שם המוצר"
                                                        className="flex-1 text-right"
                                                        dir="rtl"
                                                    />
                                                    <Label className="text-xs text-gray-700 whitespace-nowrap">מחיר:</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={newProductPrice}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/[^0-9]/g, '')
                                                            setNewProductPrice(value)
                                                        }}
                                                        placeholder="0"
                                                        className="w-20 text-right"
                                                        dir="rtl"
                                                    />
                                                    <span className="text-gray-500 text-sm">₪</span>
                                                    <Button
                                                        size="sm"
                                                        onClick={handleCreateProduct}
                                                        disabled={!newProductName || !newProductPrice}
                                                        className="flex-shrink-0 h-9"
                                                    >
                                                        <Plus className="h-3 w-3 ml-1" /> הוסף
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Order Items Display - Standalone Container */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <Label className="text-right block text-lg font-semibold">
                                    {orderItems.length > 0 ? `מוצרים שנוספו (${orderItems.length})` : 'מוצרים'}
                                </Label>
                                {orderItems.length > 0 && (
                                    <div className="text-right text-lg font-bold text-green-700">
                                        ₪{calculateTotal()}
                                    </div>
                                )}
                            </div>

                            {/* Loading cart indicator */}
                            {isLoadingCart && (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 ml-2" />
                                    <span className="text-sm text-gray-600">טוען עגלה...</span>
                                </div>
                            )}

                            {/* Content */}
                            {!isLoadingCart && (
                                <div className="space-y-2">
                                    {/* Show add button when no items */}
                                    {orderItems.length === 0 && !isAddingNewItem && (
                                        <button
                                            type="button"
                                            onClick={handleStartAddingItem}
                                            className="w-full border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-900">הוסף מוצר</span>
                                        </button>
                                    )}

                                    <div className="space-y-1.5">
                                        {orderItems.length > 0 && orderItems.map((item, index) => (
                                            <div key={item.id} className="border rounded-lg p-2 bg-white">
                                                <div className="flex items-center gap-2 justify-between w-full">
                                                    {/* Trash icon on left */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 flex-shrink-0"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                    </Button>

                                                    {/* Product name */}
                                                    <div className="text-right flex-shrink-0 min-w-[100px]">
                                                        <div className="font-medium text-sm whitespace-nowrap">{item.name}</div>
                                                    </div>

                                                    {/* Quantity - Editable */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Label className="text-xs text-gray-600 whitespace-nowrap">כמות:</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={item.amount.toString()}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                                if (value) {
                                                                    handleUpdateQuantity(item.id, parseInt(value) - item.amount)
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault()
                                                                    handleUpdateQuantity(item.id, 1)
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault()
                                                                    handleUpdateQuantity(item.id, -1)
                                                                }
                                                            }}
                                                            className="w-16 h-8 text-sm text-center"
                                                            dir="rtl"
                                                        />
                                                    </div>

                                                    {/* Price - Editable */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Label className="text-xs text-gray-600 whitespace-nowrap">מחיר:</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={item.price.toString()}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                                if (value) {
                                                                    handleUpdateItemPrice(item.id, parseFloat(value))
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault()
                                                                    handleUpdateItemPrice(item.id, item.price + 1)
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault()
                                                                    handleUpdateItemPrice(item.id, Math.max(0, item.price - 1))
                                                                }
                                                            }}
                                                            className="w-20 h-8 text-sm text-center"
                                                            dir="rtl"
                                                        />
                                                        <span className="text-sm">₪</span>
                                                    </div>

                                                    {/* Total */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Label className="text-xs text-gray-600 whitespace-nowrap">סה"כ:</Label>
                                                        <span className="text-sm font-semibold min-w-[50px] text-right">₪{item.price * item.amount}</span>
                                                    </div>
                                                </div>

                                                {/* Inline add new item - appears after last item */}
                                                {index === orderItems.length - 1 && isAddingNewItem && (
                                                    <div className="mt-1.5 border-2 border-blue-500 rounded-lg p-2 bg-blue-50">
                                                        <div className="flex items-center gap-2 justify-between w-full">
                                                            {/* Trash icon */}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 flex-shrink-0"
                                                                onClick={handleCancelAddingItem}
                                                            >
                                                                <X className="h-4 w-4 text-red-600" />
                                                            </Button>

                                                            {/* Product name with autocomplete */}
                                                            <div className="flex-1 relative">
                                                                <Input
                                                                    type="text"
                                                                    value={tempNewItem.name}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value
                                                                        setTempNewItem({ ...tempNewItem, name: value })
                                                                        if (value.length >= 2) {
                                                                            searchProducts(value)
                                                                        } else {
                                                                            setNewItemSearchResults([])
                                                                        }
                                                                    }}
                                                                    placeholder="שם מוצר..."
                                                                    className="text-right"
                                                                    dir="rtl"
                                                                    autoFocus
                                                                />
                                                            </div>

                                                            {/* Quantity */}
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <Label className="text-xs text-gray-700 whitespace-nowrap">כמות:</Label>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={tempNewItem.quantity}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value.replace(/[^0-9]/g, '')
                                                                        setTempNewItem({ ...tempNewItem, quantity: value || '1' })
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'ArrowUp') {
                                                                            e.preventDefault()
                                                                            const current = parseInt(tempNewItem.quantity || '1')
                                                                            setTempNewItem({ ...tempNewItem, quantity: (current + 1).toString() })
                                                                        } else if (e.key === 'ArrowDown') {
                                                                            e.preventDefault()
                                                                            const current = parseInt(tempNewItem.quantity || '1')
                                                                            setTempNewItem({ ...tempNewItem, quantity: Math.max(1, current - 1).toString() })
                                                                        }
                                                                    }}
                                                                    className="w-16 h-8 text-sm text-center"
                                                                    dir="rtl"
                                                                />
                                                            </div>

                                                            {/* Price */}
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <Label className="text-xs text-gray-700 whitespace-nowrap">מחיר:</Label>
                                                                <Input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={tempNewItem.price}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value.replace(/[^0-9]/g, '')
                                                                        setTempNewItem({ ...tempNewItem, price: value || '0' })
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'ArrowUp') {
                                                                            e.preventDefault()
                                                                            const current = parseFloat(tempNewItem.price || '0')
                                                                            setTempNewItem({ ...tempNewItem, price: (current + 1).toString() })
                                                                        } else if (e.key === 'ArrowDown') {
                                                                            e.preventDefault()
                                                                            const current = parseFloat(tempNewItem.price || '0')
                                                                            setTempNewItem({ ...tempNewItem, price: Math.max(0, current - 1).toString() })
                                                                        }
                                                                    }}
                                                                    className="w-20 h-8 text-sm text-center"
                                                                    dir="rtl"
                                                                />
                                                                <span className="text-sm">₪</span>
                                                            </div>

                                                            {/* Total */}
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <Label className="text-xs text-gray-700 whitespace-nowrap">סה"כ:</Label>
                                                                <span className="text-sm font-semibold min-w-[50px] text-right">
                                                                    ₪{(parseFloat(tempNewItem.price) * parseInt(tempNewItem.quantity)) || 0}
                                                                </span>
                                                            </div>

                                                            {/* Confirm button */}
                                                            <Button
                                                                size="sm"
                                                                onClick={handleConfirmNewItem}
                                                                className="h-8 px-3"
                                                                disabled={!tempNewItem.name}
                                                            >
                                                                <CheckCircle2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>

                                                        {/* Search results dropdown */}
                                                        {newItemSearchResults.length > 0 && tempNewItem.name.length >= 2 && (
                                                            <div className="mt-2 border rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg z-50">
                                                                {newItemSearchResults.map((product) => (
                                                                    <button
                                                                        key={product.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectProductFromSearch(product, tempNewItem.quantity)}
                                                                        className="w-full p-2 hover:bg-gray-50 text-right text-sm border-b last:border-b-0"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium">{product.name}</span>
                                                                            <span className="text-xs text-gray-600">₪{product.price}</span>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Item not found warning */}
                                                        {hasSearchedProducts && newItemSearchResults.length === 0 && tempNewItem.name.length >= 2 && (
                                                            <div className="mt-2 border-2 border-red-300 rounded-lg bg-red-50 shadow-lg z-50">
                                                                <div className="p-3 text-right">
                                                                    <div className="text-sm font-semibold text-red-900 mb-1">⚠️ המוצר לא קיים במערכת</div>
                                                                    <div className="text-xs text-red-700 mb-2">המוצר "{tempNewItem.name}" לא נמצא במערכת. תוכל להמשיך ולהוסיף אותו בכל זאת.</div>
                                                                    <div className="text-xs text-gray-600">המשך להזין את כמות ומחיר ולחץ על ✓</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Add more products button - after last item */}
                                                {index === orderItems.length - 1 && !isAddingNewItem && (
                                                    <div className="mt-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={handleStartAddingItem}
                                                            className="w-full border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <Plus className="h-4 w-4 text-blue-600" />
                                                            <span className="text-sm font-medium text-blue-900">הוסף מוצר נוסף</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {/* Show add button when no items and not currently adding */}
                                        {orderItems.length === 0 && isAddingNewItem && (
                                            <div className="border-2 border-blue-500 rounded-lg p-2 bg-blue-50">
                                                <div className="flex items-center gap-2 justify-between w-full">
                                                    {/* Trash icon */}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 flex-shrink-0"
                                                        onClick={handleCancelAddingItem}
                                                    >
                                                        <X className="h-4 w-4 text-red-600" />
                                                    </Button>

                                                    {/* Product name with autocomplete */}
                                                    <div className="flex-1 relative">
                                                        <Input
                                                            type="text"
                                                            value={tempNewItem.name}
                                                            onChange={(e) => {
                                                                const value = e.target.value
                                                                setTempNewItem({ ...tempNewItem, name: value })
                                                                if (value.length >= 2) {
                                                                    searchProducts(value)
                                                                } else {
                                                                    setNewItemSearchResults([])
                                                                }
                                                            }}
                                                            placeholder="שם מוצר..."
                                                            className="text-right"
                                                            dir="rtl"
                                                            autoFocus
                                                        />
                                                    </div>

                                                    {/* Quantity */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Label className="text-xs text-gray-700 whitespace-nowrap">כמות:</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={tempNewItem.quantity}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                                setTempNewItem({ ...tempNewItem, quantity: value || '1' })
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault()
                                                                    const current = parseInt(tempNewItem.quantity || '1')
                                                                    setTempNewItem({ ...tempNewItem, quantity: (current + 1).toString() })
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault()
                                                                    const current = parseInt(tempNewItem.quantity || '1')
                                                                    setTempNewItem({ ...tempNewItem, quantity: Math.max(1, current - 1).toString() })
                                                                }
                                                            }}
                                                            className="w-16 h-8 text-sm text-center"
                                                            dir="rtl"
                                                        />
                                                    </div>

                                                    {/* Price */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Label className="text-xs text-gray-700 whitespace-nowrap">מחיר:</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={tempNewItem.price}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                                setTempNewItem({ ...tempNewItem, price: value || '0' })
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault()
                                                                    const current = parseFloat(tempNewItem.price || '0')
                                                                    setTempNewItem({ ...tempNewItem, price: (current + 1).toString() })
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault()
                                                                    const current = parseFloat(tempNewItem.price || '0')
                                                                    setTempNewItem({ ...tempNewItem, price: Math.max(0, current - 1).toString() })
                                                                }
                                                            }}
                                                            className="w-20 h-8 text-sm text-center"
                                                            dir="rtl"
                                                        />
                                                        <span className="text-sm">₪</span>
                                                    </div>

                                                    {/* Total */}
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Label className="text-xs text-gray-700 whitespace-nowrap">סה"כ:</Label>
                                                        <span className="text-sm font-semibold min-w-[50px] text-right">
                                                            ₪{(parseFloat(tempNewItem.price) * parseInt(tempNewItem.quantity)) || 0}
                                                        </span>
                                                    </div>

                                                    {/* Confirm button */}
                                                    <Button
                                                        size="sm"
                                                        onClick={handleConfirmNewItem}
                                                        className="h-8 px-3"
                                                        disabled={!tempNewItem.name}
                                                    >
                                                        <CheckCircle2 className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                {/* Search results dropdown */}
                                                {newItemSearchResults.length > 0 && tempNewItem.name.length >= 2 && (
                                                    <div className="mt-2 border rounded-lg bg-white max-h-40 overflow-y-auto shadow-lg z-50">
                                                        {newItemSearchResults.map((product) => (
                                                            <button
                                                                key={product.id}
                                                                type="button"
                                                                onClick={() => handleSelectProductFromSearch(product, tempNewItem.quantity)}
                                                                className="w-full p-2 hover:bg-gray-50 text-right text-sm border-b last:border-b-0"
                                                            >
                                                                <div className="flex items-center  gap-2">
                                                                    <span className="font-medium">{product.name} -</span>
                                                                    <span className="text-xs text-gray-600">₪{product.price}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Item not found warning */}
                                                {hasSearchedProducts && newItemSearchResults.length === 0 && tempNewItem.name.length >= 2 && (
                                                    <div className="mt-2 border-2 border-red-300 rounded-lg bg-red-50 shadow-lg z-50">
                                                        <div className="p-3 text-right">
                                                            <div className="text-sm font-semibold text-red-900 mb-1">⚠️ המוצר לא קיים במערכת</div>
                                                            <div className="text-xs text-red-700 mb-2">המוצר "{tempNewItem.name}" לא נמצא במערכת. תוכל להמשיך ולהוסיף אותו בכל זאת.</div>
                                                            <div className="text-xs text-gray-600">המשך להזין את כמות ומחיר ולחץ על ✓</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Total Summary - X + Y = Z format */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {/* Appointment Price */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-blue-900">₪{appointmentPrice}</div>
                                    <div className="text-xs text-gray-600 mt-1">מחיר תור</div>
                                </div>

                                {/* Plus sign */}
                                <div className="text-2xl font-bold text-gray-400">+</div>

                                {/* Products Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-green-700">₪{calculateTotal()}</div>
                                    <div className="text-xs text-gray-600 mt-1">מוצרים</div>
                                </div>

                                {/* Equals sign */}
                                <div className="text-2xl font-bold text-gray-400">=</div>

                                {/* Grand Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-3xl font-bold text-green-900">
                                        ₪{(parseFloat(appointmentPrice) || 0) + calculateTotal()}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">סה״כ לתשלום</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 1 Buttons */}
                        <div className="flex flex-col gap-2">
                            {/* Save to cart button - shown when cart is dirty */}
                            {isCartDirty() && (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={handleSaveCart}
                                    disabled={isSavingCart}
                                >
                                    {isSavingCart ? (
                                        <>
                                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                            שומר...
                                        </>
                                    ) : cartSaved ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 ml-2 text-green-600" />
                                            נשמר בהצלחה
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 ml-2" />
                                            שמור עגלה
                                        </>
                                    )}
                                </Button>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={handleClose}
                                >
                                    ביטול
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleContinueFromStep1}
                                    disabled={isPriceDirty()}
                                >
                                    המשך
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    // Payment method selection
                    <div className="space-y-6 py-4">
                        {/* Total Summary - X + Y = Z format */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {/* Appointment Price */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-blue-900">₪{appointmentPrice}</div>
                                    <div className="text-xs text-gray-600 mt-1">מחיר תור</div>
                                </div>

                                {/* Plus sign */}
                                <div className="text-2xl font-bold text-gray-400">+</div>

                                {/* Products Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-green-700">₪{calculateTotal()}</div>
                                    <div className="text-xs text-gray-600 mt-1">מוצרים</div>
                                </div>

                                {/* Equals sign */}
                                <div className="text-2xl font-bold text-gray-400">=</div>

                                {/* Grand Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-3xl font-bold text-green-900">
                                        ₪{(parseFloat(appointmentPrice) || 0) + calculateTotal()}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">סה״כ לתשלום</div>
                                </div>
                            </div>
                        </div>

                        <Label className="text-right block text-lg font-semibold">בחר אמצעי תשלום</Label>
                        <RadioGroup
                            value={paymentType || undefined}
                            onValueChange={(value) => {
                                setPaymentType(value as 'apps' | 'credit' | 'bank_transfer')
                                // Automatically advance to sub-type selection step
                                setTimeout(() => {
                                    setStep(3)
                                }, 100)
                            }}
                            dir="rtl"
                        >
                            <div className="space-y-3">
                                <div
                                    className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                    onClick={() => {
                                        setPaymentType('apps')
                                        setTimeout(() => setStep(3), 100)
                                    }}
                                >
                                    <RadioGroupItem value="apps" id="apps" />
                                    <Smartphone className="h-6 w-6 text-purple-600" />
                                    <Label htmlFor="apps" className="cursor-pointer flex-1 text-lg">אפליקציות</Label>
                                </div>

                                <div
                                    className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                    onClick={() => {
                                        setPaymentType('credit')
                                        setTimeout(() => setStep(3), 100)
                                    }}
                                >
                                    <RadioGroupItem value="credit" id="credit" />
                                    <CreditCard className="h-6 w-6 text-blue-600" />
                                    <Label htmlFor="credit" className="cursor-pointer flex-1 text-lg">אשראי</Label>
                                </div>

                                <div
                                    className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                    onClick={() => {
                                        setPaymentType('bank_transfer')
                                        setTimeout(() => setStep(3), 100)
                                    }}
                                >
                                    <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                                    <Building2 className="h-6 w-6 text-indigo-600" />
                                    <Label htmlFor="bank_transfer" className="cursor-pointer flex-1 text-lg">העברה בנקאית ומזומן</Label>
                                </div>
                            </div>
                        </RadioGroup>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleBackStep}
                            >
                                <ArrowRight className="ml-2 h-4 w-4" /> חזור
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleClose}
                            >
                                ביטול
                            </Button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    // Sub-type selection
                    <div className="space-y-6 py-4">
                        {/* Total Summary - X + Y = Z format */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {/* Appointment Price */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-blue-900">₪{appointmentPrice}</div>
                                    <div className="text-xs text-gray-600 mt-1">מחיר תור</div>
                                </div>

                                {/* Plus sign */}
                                <div className="text-2xl font-bold text-gray-400">+</div>

                                {/* Products Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-green-700">₪{calculateTotal()}</div>
                                    <div className="text-xs text-gray-600 mt-1">מוצרים</div>
                                </div>

                                {/* Equals sign */}
                                <div className="text-2xl font-bold text-gray-400">=</div>

                                {/* Grand Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-3xl font-bold text-green-900">
                                        ₪{(parseFloat(appointmentPrice) || 0) + calculateTotal()}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">סה״כ לתשלום</div>
                                </div>
                            </div>
                        </div>

                        <Label className="text-right block text-lg font-semibold">
                            {paymentType === 'apps' && 'בחר אפליקציה'}
                            {paymentType === 'credit' && 'בחר סוג תשלום'}
                            {paymentType === 'bank_transfer' && 'בחר סוג תשלום'}
                        </Label>
                        <RadioGroup
                            value={paymentSubType || undefined}
                            onValueChange={(value) => {
                                setPaymentSubType(value)
                                setTimeout(() => setStep(4), 100)
                            }}
                            dir="rtl"
                        >
                            <div className="space-y-3">
                                {paymentType === 'apps' && (
                                    <>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('paybox')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="paybox" id="paybox" />
                                            <Smartphone className="h-6 w-6 text-orange-600" />
                                            <Label htmlFor="paybox" className="cursor-pointer flex-1 text-lg">פייבוקס</Label>
                                        </div>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('bit')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="bit" id="bit" />
                                            <Smartphone className="h-6 w-6 text-purple-600" />
                                            <Label htmlFor="bit" className="cursor-pointer flex-1 text-lg">ביט</Label>
                                        </div>
                                    </>
                                )}

                                {paymentType === 'credit' && (
                                    <>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('saved_card')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="saved_card" id="saved_card" />
                                            <CreditCard className="h-6 w-6 text-blue-600" />
                                            <Label htmlFor="saved_card" className="cursor-pointer flex-1 text-lg">תשלום דרך אשראי שמור במערכת</Label>
                                        </div>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('payment_page')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="payment_page" id="payment_page" />
                                            <FileText className="h-6 w-6 text-green-600" />
                                            <Label htmlFor="payment_page" className="cursor-pointer flex-1 text-lg">הזנת פרטי אשראי בדף סליקה</Label>
                                        </div>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('terminal')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="terminal" id="terminal" />
                                            <Smartphone className="h-6 w-6 text-indigo-600" />
                                            <Label htmlFor="terminal" className="cursor-pointer flex-1 text-lg">קריאה ממסופון</Label>
                                        </div>
                                    </>
                                )}

                                {paymentType === 'bank_transfer' && (
                                    <>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('bank_transfer')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="bank_transfer" id="bank_transfer_sub" />
                                            <Building2 className="h-6 w-6 text-blue-600" />
                                            <Label htmlFor="bank_transfer_sub" className="cursor-pointer flex-1 text-lg">העברה בנקאית</Label>
                                        </div>
                                        <div
                                            className="flex items-center justify-start gap-4 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                                            onClick={() => {
                                                setPaymentSubType('cash')
                                                setTimeout(() => setStep(4), 100)
                                            }}
                                        >
                                            <RadioGroupItem value="cash" id="cash" />
                                            <Receipt className="h-6 w-6 text-green-600" />
                                            <Label htmlFor="cash" className="cursor-pointer flex-1 text-lg">מזומן</Label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </RadioGroup>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleBackStep}
                            >
                                <ArrowRight className="ml-2 h-4 w-4" /> חזור
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleClose}
                            >
                                ביטול
                            </Button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
                        {/* Total Summary - X + Y = Z format */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {/* Appointment Price */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-blue-900">₪{appointmentPrice}</div>
                                    <div className="text-xs text-gray-600 mt-1">מחיר תור</div>
                                </div>

                                {/* Plus sign */}
                                <div className="text-2xl font-bold text-gray-400">+</div>

                                {/* Products Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-2xl font-bold text-green-700">₪{calculateTotal()}</div>
                                    <div className="text-xs text-gray-600 mt-1">מוצרים</div>
                                </div>

                                {/* Equals sign */}
                                <div className="text-2xl font-bold text-gray-400">=</div>

                                {/* Grand Total */}
                                <div className="flex flex-col items-center min-w-[100px]">
                                    <div className="text-3xl font-bold text-green-900">
                                        ₪{(parseFloat(appointmentPrice) || 0) + calculateTotal()}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">סה״כ לתשלום</div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Summary */}
                        <div className="space-y-3">
                            <Label className="text-right block text-lg font-semibold">סוג התשלום</Label>
                            {/* Show payment request buttons for Bit and PayBox */}
                            {paymentSubType === 'bit' || paymentSubType === 'paybox' ? (
                                <Button
                                    className="w-full py-6 text-lg font-semibold"
                                    onClick={handleSendPaymentRequest}
                                    disabled={isSendingPaymentRequest || isSavingCart || orderItems.length === 0}
                                >
                                    {isSendingPaymentRequest ? (
                                        <>
                                            <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                            שולח...
                                        </>
                                    ) : paymentSubType === 'bit' ? (
                                        'שליחת בקשת תשלום בביט'
                                    ) : (
                                        'שליחת בקשת תשלום בפייבוקס'
                                    )}
                                </Button>
                            ) : (
                                <div className="text-center text-gray-600 py-4 border rounded-lg bg-blue-50">
                                    {paymentSubType && paymentType && (
                                        <div className="text-lg font-semibold text-blue-900">
                                            תשלום דרך {getSubTypeLabel()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Receipt Checkbox - Only in last step */}
                        <div className="flex items-center justify-start gap-3 border-t pt-4">
                            <Checkbox
                                id="receipt"
                                checked={hasReceipt}
                                onCheckedChange={(checked) => setHasReceipt(checked as boolean)}
                            />
                            <Label htmlFor="receipt" className="cursor-pointer flex items-center gap-2">
                                <Receipt className="h-4 w-4 text-gray-600" />
                                <span>קבלה / חשבונית</span>
                            </Label>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleBackStep}
                            >
                                <ArrowRight className="ml-2 h-4 w-4" /> חזור
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleClose}
                            >
                                ביטול
                            </Button>
                            {paymentSubType !== 'bit' && paymentSubType !== 'paybox' && (
                                <Button
                                    className="flex-1"
                                    onClick={handleConfirm}
                                    disabled={orderItems.length === 0}
                                >
                                    אישור תשלום
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog >
    )
}

