import React, { useMemo, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CreditCard, Smartphone, Building2, FileText, Receipt, ArrowRight, ChevronLeft, Loader2, CheckCircle, Copy, Check, Link as LinkIcon, Send } from "lucide-react"
import { BitIcon } from "@/components/icons/BitIcon"
import payboxIcon from "@/assets/icons/paybox.webp"
import { CustomerPaymentsModal } from "@/components/dialogs/payments/CustomerPaymentsModal"
import { ProductEditDialog } from "@/components/dialogs/settings/products/ProductEditDialog"
import { usePaymentModal } from "./usePaymentModal"
import { AppointmentDetailsSection } from "./AppointmentDetailsSection"
import { ProductsSection } from "./ProductsSection"
import { AppointmentsListSection } from "./AppointmentsListSection"
import { TotalSummarySection } from "./TotalSummarySection"
import type { PaymentModalProps, CartAppointment } from "./types"
import { useToast } from "@/hooks/use-toast"
import { PaymentIframe } from "@/components/payments/PaymentIframe"
import { AddGroomingProductDialog } from "./AddGroomingProductDialog"
import { InvoiceModal } from "../InvoiceModal"
import { RecipientSelector } from "../RecipientSelector"
import { OrderDetailsModal } from "./OrderDetailsModal"

export const PaymentModal: React.FC<PaymentModalProps> = ({
    open,
    onOpenChange,
    appointment,
    cartId: providedCartId,
    customerId: providedCustomerId,
    onConfirm
}) => {
    const { toast } = useToast()
    const {
        // State
        step,
        paymentType,
        paymentSubType,
        hasReceipt,
        appointmentPrice,
        isLoadingBreedPrices,
        breedPriceInfo,
        isSavingPrice,
        priceSaved,
        showPreviousPayments,
        orderItems,
        isLoadingCart,
        isSavingCart,
        cartSaved,
        isSendingPaymentRequest,
        recipientSelection,
        setRecipientSelection,
        paymentLinkRecipientSelection,
        setPaymentLinkRecipientSelection,
        receivedAmount,
        setReceivedAmount,
        isMarkingAsReceived,
        handleMarkAsReceived,
        isAddingNewItem,
        tempNewItem,
        showProductSuggestions,
        isInputFocused,
        isLoadingInitialProducts,
        isLoadingProducts,
        hasSearchedProducts,
        filteredSearchResults,
        showProductCreateDialog,
        productToCreateName,
        setProductToCreateName,
        setShowProductCreateDialog,
        brands,

        // Computed
        isPriceDirty,
        isCartDirty,

        // Handlers
        setStep,
        setPaymentType,
        setPaymentSubType,
        setHasReceipt,
        setPaidSum,
        paidSum,
        setAppointmentPrice,
        setShowPreviousPayments,
        handleCancelPriceChange,
        handleSavePrice,
        handleRemoveItem,
        handleUpdateQuantity,
        handleUpdateItemPrice,
        handleStartAddingItem,
        handleCancelAddingItem,
        handleSelectProductFromSearch,
        handleUseAsTempItem,
        handleOpenCreateProductDialog,
        handleProductCreated,
        handleSaveCart,
        handleSendPaymentRequest,
        handleBackStep,
        handleContinueFromStep1,
        handleConfirm,
        handleClose,
        handleInputFocus,
        handleInputBlur,
        handleTempItemNameChange,
        handleTempItemQuantityChange,
        handleTempItemPriceChange,
        fetchInitialProducts,
        cartAppointments,
        originalCartAppointments,
        isLoadingAppointments,
        handleUpdateAppointmentPrice,
        handleRemoveAppointment,
        setCartAppointments,
        handleSaveAppointments,
        handleSaveProducts,
        handleSaveProductsAndGarden,
        isAppointmentsDirty,
        isGardenAppointmentsDirty,
        isProductsDirty,
        originalOrderItems,
        products,
        showPaymentIframe,
        paymentPostData,
        isLoadingHandshake,
        isConfirming,
        handlePaymentIframeSuccess,
        handlePaymentIframeError,
        isCartPaid,
        paidOrderId,
        hasSavedCard,
        isCheckingSavedCard,
        savedCardAmount,
        setSavedCardAmount,
        isLoadingSavedCardPayment,
        handleChargeSavedCard,
        // Payment link
        paymentLink,
        copyLinkSuccess,
        isPollingPayment,
        generatePaymentLink,
        copyPaymentLink,
        sendPaymentLink,
        startPollingPayment,
    } = usePaymentModal({ open, appointment, cartId: providedCartId, customerId: providedCustomerId, onConfirm, onOpenChange })

    const [showAddGroomingProductDialog, setShowAddGroomingProductDialog] = useState(false)
    const [showInvoiceModal, setShowInvoiceModal] = useState(false)
    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false)


    const handleAddGroomingProduct = (data: { dogId: string; dogName: string; breed: string; price: number }) => {
        // Create a temporary cart appointment for the grooming product
        // These will be saved as cart_items, not cart_appointments
        const tempId = `temp_grooming_${Date.now()}`
        const newCartAppointment: CartAppointment = {
            id: tempId,
            cart_id: providedCartId || '',
            grooming_appointment_id: null, // null indicates it's a temporary item
            daycare_appointment_id: null,
            appointment_price: data.price,
            appointment: {
                id: tempId,
                serviceType: 'grooming',
                stationId: '',
                stationName: 'מספרה',
                startDateTime: new Date().toISOString(),
                endDateTime: new Date().toISOString(),
                status: 'pending',
                notes: '',
                dogs: [{
                    id: data.dogId,
                    name: data.dogName,
                    breed: data.breed,
                }],
                // Store metadata for saving as cart_item
                _isTempGroomingProduct: true,
                _tempItemName: data.dogName ? `מספרה: ${data.dogName} (${data.breed})` : `מספרה: ${data.breed}`,
            } as any,
        }

        // Add to cart appointments
        setCartAppointments([...cartAppointments, newCartAppointment])
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
        } else if (targetStep === 2) {
            setStep(2)
            setPaymentSubType(null)
        } else if (targetStep === 3) {
            setStep(3)
        }
    }

    // Grooming total for summaries (includes temporary grooming products)
    // Note: This calculates without quantities since quantities are UI-only in AppointmentsListSection
    // The actual total shown in AppointmentsListSection may differ if quantities > 1
    const groomingSummaryTotal = useMemo(() => {
        // Always check cartAppointments first (works for both providedCartId and newly created carts)
        if (cartAppointments.length > 0) {
            const groomingAppts = cartAppointments.filter(ca =>
                ca.grooming_appointment_id ||
                (ca.appointment?.serviceType === 'grooming' && !ca.daycare_appointment_id && !ca.grooming_appointment_id)
            )

            return groomingAppts.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
        }

        // Fallback to appointmentPrice for legacy single appointment mode (when appointment exists and no cart)
        if (appointment) {
            return parseFloat(appointmentPrice) || 0
        }

        // Default to 0 if no appointments
        return 0
    }, [cartAppointments, appointment, appointmentPrice])

    // Show payment iframe if needed
    if (showPaymentIframe && paymentPostData) {
        // Calculate products total (excluding temporary grooming products)
        const productsTotal = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0) +
            (providedCartId ? cartAppointments.filter(ca =>
                ca.daycare_appointment_id &&
                !(ca.appointment as any)?._isTempGroomingProduct
            ).reduce((sum, ca) => sum + (ca.appointment_price || 0), 0) : 0)

        let appointmentPriceValue = 0

        if (providedCartId && cartAppointments.length > 0) {
            // Calculate grooming appointments total (including temporary grooming products)
            const groomingAppts = cartAppointments.filter(ca =>
                ca.grooming_appointment_id ||
                (ca.appointment?.serviceType === 'grooming' && !ca.daycare_appointment_id && !ca.grooming_appointment_id)
            )
            appointmentPriceValue = groomingAppts.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
        } else if (appointment) {
            appointmentPriceValue = parseFloat(appointmentPrice) || 0
        }

        const totalAmount = productsTotal + appointmentPriceValue
        const firstDog = appointment?.dogs?.[0]
        const productName = providedCartId && cartAppointments.length > 0
            ? `תורים ומוצרים`
            : firstDog?.name
                ? `תור של ${firstDog.name}`
                : 'תשלום'

        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0" dir="rtl">
                    <div className="flex items-center justify-start p-4 border-b sticky top-0 bg-white z-10">
                        <Button
                            variant="ghost"
                            onClick={() => handlePaymentIframeError('בוטל על ידי המשתמש')}
                            className="flex items-center gap-2 text-right"
                            dir="rtl"
                        >
                            <ArrowRight className="h-4 w-4" />
                            חזרה
                        </Button>
                    </div>
                    <div className="p-4">
                        <PaymentIframe
                            postData={paymentPostData}
                            onSuccess={handlePaymentIframeSuccess}
                            onError={handlePaymentIframeError}
                            productName={productName}
                            amount={totalAmount}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-4xl max-h-[75vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">
                        {step === 1 && 'מחיר ומוצרים'}
                        {step === 2 && 'אמצעי תשלום'}
                        {step === 3 && (paymentType === 'apps' ? 'בחר אפליקציה' : paymentType === 'credit' ? 'בחר סוג תשלום' : 'בחר סוג תשלום')}
                        {step === 4 && (paymentSubType && paymentType ? `אישור תשלום - ${getSubTypeLabel()}` : 'אישור תשלום')}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {(() => {
                            if (providedCartId && cartAppointments.length > 0) {
                                const firstAppointment = cartAppointments[0]?.appointment
                                const customerName = firstAppointment?.clientName
                                const dogNames = firstAppointment?.dogs?.map(d => d.name).join(', ') || ''
                                return dogNames ? `לתור של ${dogNames}${customerName ? ` - ${customerName}` : ''}` : ''
                            }
                            const firstDog = appointment?.dogs?.[0]
                            return firstDog?.name ? `לתור של ${firstDog.name}${appointment.clientName ? ` - ${appointment.clientName}` : ''}` : ''
                        })()}
                    </DialogDescription>
                </DialogHeader>
                {isCartPaid && providedCartId && (
                    <div className="mt-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">העגלה כבר שולמה</span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-green-700 border-green-300 hover:bg-green-100"
                                onClick={() => setShowOrderDetailsModal(true)}
                            >
                                <FileText className="h-4 w-4 ml-2" />
                                צפה בפרטי הזמנות
                            </Button>
                            {appointment && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-700 border-green-300 hover:bg-green-100"
                                    onClick={() => setShowInvoiceModal(true)}
                                >
                                    <FileText className="h-4 w-4 ml-2" />
                                    הצג חשבונית
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Breadcrumbs */}
                {(step === 2 || step === 3 || step === 4) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 pb-2 border-b">
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
                    <div className="space-y-4 py-3">
                        {/* Appointments List Section (for multiple appointments - only grooming) */}
                        {/* Show when we have a cart (providedCartId) or when we're in cart mode (no single appointment) */}
                        {(providedCartId || !appointment) && (
                            <AppointmentsListSection
                                cartAppointments={cartAppointments}
                                isLoadingAppointments={isLoadingAppointments}
                                isSavingCart={isSavingCart}
                                cartSaved={cartSaved}
                                isCartDirty={isAppointmentsDirty}
                                onUpdateAppointmentPrice={handleUpdateAppointmentPrice}
                                onRemoveAppointment={handleRemoveAppointment}
                                onSaveCart={async () => {
                                    try {
                                        await handleSaveAppointments()
                                        toast({
                                            title: "נשמר בהצלחה",
                                            description: "התורים נשמרו בהצלחה",
                                        })
                                    } catch (error) {
                                        console.error('Failed to save appointments:', error)
                                        toast({
                                            title: "שגיאה",
                                            description: "לא הצלחנו לשמור את התורים",
                                            variant: "destructive",
                                        })
                                    }
                                }}
                                originalCartAppointments={originalCartAppointments}
                                onAddNewGroomingProduct={() => setShowAddGroomingProductDialog(true)}
                            />
                        )}

                        {/* Appointment Details Section (for single appointment legacy mode) */}
                        {!providedCartId && appointment && (
                            <AppointmentDetailsSection
                                appointment={appointment}
                                appointmentPrice={appointmentPrice}
                                isLoadingBreedPrices={isLoadingBreedPrices}
                                breedPriceInfo={breedPriceInfo}
                                isPriceDirty={isPriceDirty}
                                isSavingPrice={isSavingPrice}
                                priceSaved={priceSaved}
                                onPriceChange={setAppointmentPrice}
                                onCancelPriceChange={handleCancelPriceChange}
                                onSavePrice={handleSavePrice}
                                onShowPreviousPayments={() => setShowPreviousPayments(true)}
                            />
                        )}

                        {/* Products and Garden Section */}
                        <ProductsSection
                            orderItems={orderItems}
                            originalOrderItems={originalOrderItems}
                            gardenAppointments={providedCartId ? cartAppointments.filter(ca =>
                                ca.daycare_appointment_id &&
                                !(ca.appointment as any)?._isTempGroomingProduct
                            ) : []}
                            originalGardenAppointments={providedCartId ? originalCartAppointments.filter(ca =>
                                ca.daycare_appointment_id &&
                                !(ca.appointment as any)?._isTempGroomingProduct
                            ) : []}
                            products={products}
                            isLoadingCart={isLoadingCart}
                            isSavingCart={isSavingCart}
                            cartSaved={cartSaved}
                            isCartDirty={isProductsDirty || isGardenAppointmentsDirty}
                            isAddingNewItem={isAddingNewItem}
                            tempNewItem={tempNewItem}
                            showProductSuggestions={showProductSuggestions}
                            isInputFocused={isInputFocused}
                            isLoadingInitialProducts={isLoadingInitialProducts}
                            isLoadingProducts={isLoadingProducts}
                            hasSearchedProducts={hasSearchedProducts}
                            filteredSearchResults={filteredSearchResults}
                            onStartAddingItem={handleStartAddingItem}
                            onCancelAddingItem={handleCancelAddingItem}
                            onRemoveItem={handleRemoveItem}
                            onUpdateQuantity={handleUpdateQuantity}
                            onUpdateItemPrice={handleUpdateItemPrice}
                            onTempItemNameChange={handleTempItemNameChange}
                            onTempItemQuantityChange={handleTempItemQuantityChange}
                            onTempItemPriceChange={handleTempItemPriceChange}
                            onInputFocus={handleInputFocus}
                            onInputBlur={handleInputBlur}
                            onSelectProductFromSearch={handleSelectProductFromSearch}
                            onOpenCreateProductDialog={handleOpenCreateProductDialog}
                            onUseAsTempItem={handleUseAsTempItem}
                            onSaveCart={async () => {
                                try {
                                    // Save both products and garden appointments together
                                    await handleSaveProductsAndGarden()
                                    toast({
                                        title: "נשמר בהצלחה",
                                        description: "המוצרים והגן נשמרו בהצלחה",
                                    })
                                } catch (error) {
                                    console.error('Failed to save products and garden:', error)
                                    toast({
                                        title: "שגיאה",
                                        description: "לא הצלחנו לשמור את המוצרים והגן",
                                        variant: "destructive",
                                    })
                                }
                            }}
                            onFetchInitialProducts={fetchInitialProducts}
                            onUpdateGardenAppointmentPrice={handleUpdateAppointmentPrice}
                            onRemoveGardenAppointment={handleRemoveAppointment}
                        />

                        {/* Total Summary Section */}
                        <TotalSummarySection
                            appointmentPrice={groomingSummaryTotal.toString()}
                            productsTotal={(() => {
                                // Calculate products total (orderItems)
                                const productsSum = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)

                                // Calculate garden appointments total (only daycare appointments, exclude grooming)
                                const gardenAppts = cartAppointments.filter(ca => {
                                    // Must have daycare_appointment_id (garden appointment)
                                    if (!ca.daycare_appointment_id) return false
                                    // Must NOT be a temporary grooming product
                                    if ((ca.appointment as any)?._isTempGroomingProduct) return false
                                    // Must NOT be a grooming service type
                                    if (ca.appointment?.serviceType === 'grooming') return false
                                    // Must be garden service type or have daycare_appointment_id
                                    return ca.appointment?.serviceType === 'garden' || ca.daycare_appointment_id !== null
                                })
                                const gardenSum = gardenAppts.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)

                                return productsSum + gardenSum
                            })()}
                        />

                        {/* Step 1 Buttons */}
                        <div className="flex flex-col gap-2">
                            <div className="space-y-2">
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
                                        disabled={orderItems.length === 0 && (!appointment && (!providedCartId || cartAppointments.length === 0))}
                                    >
                                        המשך
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6 py-4">
                        {/* Total Summary */}
                        <TotalSummarySection
                            appointmentPrice={groomingSummaryTotal.toString()}
                            productsTotal={(() => {
                                // Calculate products total (orderItems)
                                const productsSum = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)

                                // Calculate garden appointments total (only daycare appointments, exclude grooming)
                                const gardenAppts = cartAppointments.filter(ca => {
                                    // Must have daycare_appointment_id (garden appointment)
                                    if (!ca.daycare_appointment_id) return false
                                    // Must NOT be a temporary grooming product
                                    if ((ca.appointment as any)?._isTempGroomingProduct) return false
                                    // Must NOT be a grooming service type
                                    if (ca.appointment?.serviceType === 'grooming') return false
                                    // Must be garden service type or have daycare_appointment_id
                                    return ca.appointment?.serviceType === 'garden' || ca.daycare_appointment_id !== null
                                })
                                const gardenSum = gardenAppts.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)

                                return productsSum + gardenSum
                            })()}
                        />

                        <Label className="text-right block text-lg font-semibold">בחר אמצעי תשלום</Label>
                        <div className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                onClick={() => {
                                    setPaymentType('apps')
                                    setTimeout(() => setStep(3), 100)
                                }}
                            >
                                <Smartphone className="h-6 w-6 text-purple-600" />
                                <span className="flex-1 text-right">אפליקציות</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                onClick={() => {
                                    setPaymentType('credit')
                                    setTimeout(() => setStep(3), 100)
                                }}
                            >
                                <CreditCard className="h-6 w-6 text-blue-600" />
                                <span className="flex-1 text-right">אשראי</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                onClick={() => {
                                    setPaymentType('bank_transfer')
                                    setTimeout(() => setStep(3), 100)
                                }}
                            >
                                <Building2 className="h-6 w-6 text-indigo-600" />
                                <span className="flex-1 text-right">העברה בנקאית ומזומן</span>
                            </Button>
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

                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 py-4">
                        {/* Total Summary */}
                        <TotalSummarySection
                            appointmentPrice={groomingSummaryTotal.toString()}
                            productsTotal={(() => {
                                // Calculate products total (orderItems)
                                const productsSum = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)

                                // Calculate garden appointments total (only daycare appointments, exclude grooming)
                                const gardenAppts = cartAppointments.filter(ca => {
                                    // Must have daycare_appointment_id (garden appointment)
                                    if (!ca.daycare_appointment_id) return false
                                    // Must NOT be a temporary grooming product
                                    if ((ca.appointment as any)?._isTempGroomingProduct) return false
                                    // Must NOT be a grooming service type
                                    if (ca.appointment?.serviceType === 'grooming') return false
                                    // Must be garden service type or have daycare_appointment_id
                                    return ca.appointment?.serviceType === 'garden' || ca.daycare_appointment_id !== null
                                })
                                const gardenSum = gardenAppts.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)

                                return productsSum + gardenSum
                            })()}
                        />

                        <Label className="text-right block text-lg font-semibold">
                            {paymentType === 'apps' && 'בחר אפליקציה'}
                            {paymentType === 'credit' && 'בחר סוג תשלום'}
                            {paymentType === 'bank_transfer' && 'בחר סוג תשלום'}
                        </Label>
                        <div className="space-y-3">
                            {paymentType === 'apps' && (
                                <div className="flex gap-4 justify-center">
                                    <Button
                                        variant="outline"
                                        className="flex-1 justify-center p-6 h-auto min-h-[200px]"
                                        onClick={() => {
                                            setPaymentSubType('paybox')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                    >
                                        <img src={payboxIcon} alt="Paybox" className="h-full w-full max-h-[160px] max-w-[160px] object-contain" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 justify-center p-6 h-auto"
                                        onClick={() => {
                                            setPaymentSubType('bit')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                    >
                                        <BitIcon className="h-40 w-40" />
                                    </Button>
                                </div>
                            )}

                            {paymentType === 'credit' && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                        onClick={() => {
                                            setPaymentSubType('saved_card')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                        disabled={!hasSavedCard || isCheckingSavedCard}
                                    >
                                        <CreditCard className="h-6 w-6 text-blue-600" />
                                        <span className="flex-1 text-right">תשלום דרך אשראי שמור במערכת</span>
                                        {isCheckingSavedCard && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                        onClick={() => {
                                            setPaymentSubType('payment_page')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                    >
                                        <FileText className="h-6 w-6 text-green-600" />
                                        <span className="flex-1 text-right">הזנת פרטי אשראי בדף סליקה</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                        onClick={() => {
                                            setPaymentSubType('terminal')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                    >
                                        <Smartphone className="h-6 w-6 text-indigo-600" />
                                        <span className="flex-1 text-right">קריאה ממסופון</span>
                                    </Button>
                                </>
                            )}

                            {paymentType === 'bank_transfer' && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                        onClick={() => {
                                            setPaymentSubType('bank_transfer')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                    >
                                        <Building2 className="h-6 w-6 text-indigo-600" />
                                        <span className="flex-1 text-right">העברה בנקאית</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-4 p-4 h-auto text-lg"
                                        onClick={() => {
                                            setPaymentSubType('cash')
                                            setTimeout(() => setStep(4), 100)
                                        }}
                                    >
                                        <Receipt className="h-6 w-6 text-green-600" />
                                        <span className="flex-1 text-right">מזומן</span>
                                    </Button>
                                </>
                            )}
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
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-6 py-4">
                        {/* Total Summary */}
                        <TotalSummarySection
                            appointmentPrice={groomingSummaryTotal.toString()}
                            productsTotal={(() => {
                                // Calculate products total (orderItems)
                                const productsSum = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)

                                // Calculate garden appointments total (only daycare appointments, exclude grooming)
                                const gardenAppts = cartAppointments.filter(ca => {
                                    // Must have daycare_appointment_id (garden appointment)
                                    if (!ca.daycare_appointment_id) return false
                                    // Must NOT be a temporary grooming product
                                    if ((ca.appointment as any)?._isTempGroomingProduct) return false
                                    // Must NOT be a grooming service type
                                    if (ca.appointment?.serviceType === 'grooming') return false
                                    // Must be garden service type or have daycare_appointment_id
                                    return ca.appointment?.serviceType === 'garden' || ca.daycare_appointment_id !== null
                                })
                                const gardenSum = gardenAppts.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)

                                return productsSum + gardenSum
                            })()}
                        />

                        {/* Payment Method Summary */}
                        <div className="space-y-3">
                            {paymentSubType === 'payment_page' ? (
                                <div className="space-y-4">
                                    {/* Payment Link Section for payment_page */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium">קישור תשלום</Label>
                                            {paymentLink && (
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={copyPaymentLink}
                                                    >
                                                        {copyLinkSuccess ? (
                                                            <Check className="h-4 w-4 ml-2 text-green-600" />
                                                        ) : (
                                                            <Copy className="h-4 w-4 ml-2" />
                                                        )}
                                                        העתק
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={async () => {
                                                            await sendPaymentLink()
                                                        }}
                                                        disabled={
                                                            !paymentLinkRecipientSelection.ownerPhone &&
                                                            paymentLinkRecipientSelection.selectedContactIds.length === 0 &&
                                                            paymentLinkRecipientSelection.customPhones.filter(
                                                                (cp) => cp.phone && cp.name
                                                            ).length === 0
                                                        }
                                                    >
                                                        <Send className="h-4 w-4 ml-2" />
                                                        שלח
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {paymentLink && (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 p-2 bg-white border rounded text-sm">
                                                    <LinkIcon className="h-4 w-4 flex-shrink-0 text-blue-600" />
                                                    <a
                                                        href={paymentLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 text-blue-600 hover:underline truncate"
                                                        dir="ltr"
                                                        style={{ textAlign: "left" }}
                                                    >
                                                        {paymentLink}
                                                    </a>
                                                </div>

                                                {/* Recipient Selector for Payment Link */}
                                                <RecipientSelector
                                                    customerId={appointment?.clientId || null}
                                                    customerPhone={appointment?.clientPhone || null}
                                                    customerName={appointment?.clientName || null}
                                                    forceOwner={false}
                                                    onSelectionChange={setPaymentLinkRecipientSelection}
                                                />

                                                {isPollingPayment && (
                                                    <div className="flex items-center gap-2 text-sm text-blue-600">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span>ממתין לתשלום...</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : paymentSubType === 'bit' || paymentSubType === 'paybox' ? (
                                <div className="space-y-4">
                                    {/* Recipient Selector */}
                                    <RecipientSelector
                                        customerId={appointment?.clientId || null}
                                        customerPhone={appointment?.clientPhone || null}
                                        customerName={appointment?.clientName || null}
                                        forceOwner={true}
                                        onSelectionChange={setRecipientSelection}
                                    />

                                    {/* Send Payment Request Button */}
                                    <Button
                                        className="w-full py-6 text-lg font-semibold"
                                        onClick={handleSendPaymentRequest}
                                        disabled={isSendingPaymentRequest || isSavingCart || (orderItems.length === 0 && (!providedCartId || cartAppointments.length === 0))}
                                    >
                                        {isSendingPaymentRequest ? (
                                            <>
                                                <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                                שולח...
                                            </>
                                        ) : paymentSubType === 'bit' ? (
                                            'שלח בקשת תשלום בביט'
                                        ) : (
                                            'שלח בקשת תשלום בפייבוקס'
                                        )}
                                    </Button>


                                    {/* Mark as Received Section */}
                                    <div className="space-y-3">
                                        <Label htmlFor="received-amount" className="text-right block text-sm font-medium">
                                            סכום שהתקבל
                                        </Label>
                                        <Input
                                            id="received-amount"
                                            type="number"
                                            value={receivedAmount}
                                            onChange={(e) => setReceivedAmount(e.target.value)}
                                            placeholder={(() => {
                                                const productsSum = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)
                                                const appointmentsSum = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
                                                const total = productsSum + appointmentsSum + (appointment ? parseFloat(appointmentPrice) || 0 : 0)
                                                return total > 0 ? total.toFixed(2) : "הזן סכום תשלום"
                                            })()}
                                            className="text-right"
                                            dir="rtl"
                                            min="0"
                                            step="0.01"
                                            onFocus={(e) => {
                                                if (!receivedAmount) {
                                                    const productsSum = orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)
                                                    const appointmentsSum = cartAppointments.reduce((sum, ca) => sum + (ca.appointment_price || 0), 0)
                                                    const total = productsSum + appointmentsSum + (appointment ? parseFloat(appointmentPrice) || 0 : 0)
                                                    if (total > 0) {
                                                        setReceivedAmount(total.toFixed(2))
                                                    }
                                                }
                                            }}
                                        />
                                        <Button
                                            className="w-full py-6 text-lg font-semibold bg-green-600 hover:bg-green-700"
                                            onClick={handleMarkAsReceived}
                                            disabled={isMarkingAsReceived || isSavingCart || !receivedAmount || parseFloat(receivedAmount) <= 0}
                                        >
                                            {isMarkingAsReceived ? (
                                                <>
                                                    <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                                    מסמן...
                                                </>
                                            ) : (
                                                'סמן כקיבל תשלום'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : paymentSubType === 'saved_card' ? (
                                <div className="space-y-4">
                                    {/* Amount Input */}
                                    <div className="space-y-2">
                                        <Label htmlFor="saved-card-amount" className="text-right block text-sm font-medium">
                                            סכום לתשלום
                                        </Label>
                                        <Input
                                            id="saved-card-amount"
                                            type="number"
                                            value={savedCardAmount}
                                            onChange={(e) => setSavedCardAmount(e.target.value)}
                                            placeholder="הזן סכום תשלום"
                                            className="text-right"
                                            dir="rtl"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>

                                    {/* Charge Button */}
                                    <Button
                                        className="w-full py-6 text-lg font-semibold"
                                        onClick={handleChargeSavedCard}
                                        disabled={isLoadingSavedCardPayment || !savedCardAmount || parseFloat(savedCardAmount) <= 0}
                                    >
                                        {isLoadingSavedCardPayment ? (
                                            <>
                                                <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                                טוען...
                                            </>
                                        ) : (
                                            'חיוב'
                                        )}
                                    </Button>
                                </div>
                            ) : null}
                        </div>

                        {/* Paid Sum Input for Wire/Cash */}
                        {(paymentSubType === 'bank_transfer' || paymentSubType === 'cash') && (
                            <div className="space-y-2">
                                <Label htmlFor="paid-sum" className="text-right block text-sm font-medium">
                                    סכום שהתקבל
                                </Label>
                                <Input
                                    id="paid-sum"
                                    type="number"
                                    value={paidSum}
                                    onChange={(e) => setPaidSum(e.target.value)}
                                    placeholder="הזן סכום תשלום"
                                    className="text-right"
                                    dir="rtl"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        )}

                        {/* Receipt Checkbox */}
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
                            {paymentSubType !== 'bit' && paymentSubType !== 'paybox' && paymentSubType !== 'saved_card' && (
                                <Button
                                    className="flex-1"
                                    onClick={async () => {
                                        try {
                                            await handleConfirm()
                                        } catch (error) {
                                            console.error("❌ [PaymentModal] Error in handleConfirm:", error)
                                            toast({
                                                title: "שגיאה",
                                                description: error instanceof Error ? error.message : "לא ניתן לבצע תשלום. נסה שוב.",
                                                variant: "destructive",
                                            })
                                        }
                                    }}
                                    disabled={
                                        isLoadingHandshake ||
                                        isConfirming ||
                                        (orderItems.length === 0 &&
                                            (!appointment || parseFloat(appointmentPrice) <= 0) &&
                                            (!providedCartId || cartAppointments.length === 0))
                                    }
                                >
                                    {isLoadingHandshake || isConfirming ? (
                                        <>
                                            <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                                            טוען...
                                        </>
                                    ) : paymentSubType === 'payment_page' ? (
                                        'פתיחת דף תשלום'
                                    ) : (
                                        'אישור תשלום'
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            {/* Previous Payments Dialog */}
            {appointment?.clientId && appointment?.clientName && (
                <CustomerPaymentsModal
                    open={showPreviousPayments}
                    onOpenChange={setShowPreviousPayments}
                    customerId={appointment.clientId}
                    customerName={appointment.clientName}
                />
            )}

            {/* Product Creation Dialog */}
            <ProductEditDialog
                open={showProductCreateDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowProductCreateDialog(false)
                        setProductToCreateName('')
                    }
                }}
                product={productToCreateName ? {
                    id: 'new',
                    name: productToCreateName,
                    brand_id: null,
                    category: null,
                    stock_quantity: null,
                    cost_price: null,
                    bundle_price: null,
                    retail_price: null
                } : null}
                brands={brands}
                onSaved={async () => {
                    await handleProductCreated()
                }}
            />

            {/* Add Grooming Product Dialog */}
            <AddGroomingProductDialog
                open={showAddGroomingProductDialog}
                onOpenChange={setShowAddGroomingProductDialog}
                onAdd={handleAddGroomingProduct}
            />

            {/* Invoice Modal */}
            {appointment && (
                <InvoiceModal
                    open={showInvoiceModal}
                    onOpenChange={setShowInvoiceModal}
                    appointment={appointment}
                    onGoToCart={() => {
                        setShowInvoiceModal(false)
                        // Stay in payment modal
                    }}
                />
            )}

            {/* Order Details Modal */}
            <OrderDetailsModal
                open={showOrderDetailsModal}
                onOpenChange={setShowOrderDetailsModal}
                cartId={providedCartId || null}
                appointmentId={appointment?.id || null}
                serviceType={appointment?.serviceType || null}
            />
        </Dialog>
    )
}

// Export types
export type { PaymentModalProps, PaymentData } from "./types"
