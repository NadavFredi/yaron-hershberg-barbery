import React, { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, Loader2, Save, CheckCircle2, Home, CalendarClock, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import type { OrderItem, Product, CartAppointment } from "./types"

interface ProductsSectionProps {
    orderItems: OrderItem[]
    originalOrderItems?: OrderItem[]
    gardenAppointments: CartAppointment[] // Garden appointments to display in this section
    originalGardenAppointments?: CartAppointment[]
    isLoadingCart: boolean
    isSavingCart: boolean
    cartSaved: boolean
    isCartDirty: boolean
    isAddingNewItem: boolean
    tempNewItem: { name: string; price: string; quantity: string }
    showProductSuggestions: boolean
    isInputFocused: boolean
    isLoadingInitialProducts: boolean
    isLoadingProducts: boolean
    hasSearchedProducts: boolean
    filteredSearchResults: Product[]
    onStartAddingItem: () => void
    onCancelAddingItem: () => void
    onRemoveItem: (id: string) => void
    onUpdateQuantity: (id: string, delta: number) => void
    onUpdateItemPrice: (id: string, price: number) => void
    onTempItemNameChange: (name: string) => void
    onTempItemQuantityChange: (quantity: string) => void
    onTempItemPriceChange: (price: string) => void
    onInputFocus: () => void
    onInputBlur: () => void
    onSelectProductFromSearch: (product: Product, quantity: string) => void
    onOpenCreateProductDialog: () => void
    onUseAsTempItem: () => void
    onSaveCart: () => void
    onFetchInitialProducts: () => void
    onUpdateGardenAppointmentPrice?: (cartAppointmentId: string, newPrice: number) => void
    onRemoveGardenAppointment?: (cartAppointmentId: string) => void
    products?: Product[] // For getting original product prices
}

export const ProductsSection: React.FC<ProductsSectionProps> = ({
    orderItems,
    originalOrderItems = [],
    gardenAppointments = [],
    originalGardenAppointments = [],
    isLoadingCart,
    isSavingCart,
    cartSaved,
    isCartDirty,
    isAddingNewItem,
    tempNewItem,
    showProductSuggestions,
    isInputFocused,
    isLoadingInitialProducts,
    isLoadingProducts,
    hasSearchedProducts,
    filteredSearchResults,
    onStartAddingItem,
    onCancelAddingItem,
    onRemoveItem,
    onUpdateQuantity,
    onUpdateItemPrice,
    onTempItemNameChange,
    onTempItemQuantityChange,
    onTempItemPriceChange,
    onInputFocus,
    onInputBlur,
    onSelectProductFromSearch,
    onOpenCreateProductDialog,
    onUseAsTempItem,
    onSaveCart,
    onFetchInitialProducts,
    onUpdateGardenAppointmentPrice,
    onRemoveGardenAppointment,
    products = [],
}) => {
    const handleTempInputFocus = () => {
        onInputFocus()
        if (filteredSearchResults.length === 0 && tempNewItem.name.length === 0) {
            onFetchInitialProducts()
        }
    }

    const renderNewItemRow = (key: string) => (
        <tr className="border rounded-lg bg-white" key={key}>
            <td className="p-2 align-middle">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={onCancelAddingItem}
                >
                    <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
            </td>
            <td className="p-2 align-middle text-right relative">
                <Input
                    type="text"
                    value={tempNewItem.name}
                    onChange={(e) => onTempItemNameChange(e.target.value)}
                    onFocus={handleTempInputFocus}
                    onBlur={onInputBlur}
                    placeholder="שם מוצר..."
                    className="!h-auto !min-h-0 !p-0 !px-0 !py-0 text-right font-medium text-sm whitespace-nowrap !border-0 bg-transparent !shadow-none !rounded-none focus-visible:!ring-0 focus-visible:!ring-offset-0 hover:bg-gray-50 hover:!rounded focus:!border focus:!border-gray-300 focus:!bg-white focus:!px-2 focus:!py-1 focus:!rounded focus:!shadow-sm w-full"
                    dir="rtl"
                />

                {showProductSuggestions && isInputFocused && (
                    <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-h-[60px] max-h-60 overflow-y-auto">
                        {isLoadingInitialProducts || isLoadingProducts ? (
                            <div className="p-3 text-center text-sm text-gray-500 min-h-[60px] flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin inline ml-2" />
                                טוען...
                            </div>
                        ) : filteredSearchResults.length > 0 ? (
                            <div className="py-1">
                                {filteredSearchResults.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onSelectProductFromSearch(product, tempNewItem.quantity)
                                        }}
                                        className="w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors flex items-center justify-between"
                                    >
                                        <span className="text-xs text-gray-500">₪{product.price}</span>
                                        <span className="text-sm font-medium">{product.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : hasSearchedProducts && tempNewItem.name.length >= 2 ? (
                            <div className="py-2 min-h-[60px]">
                                <div className="px-3 py-2 text-sm text-gray-500 text-center border-b border-gray-200">
                                    אין תוצאות עבור "{tempNewItem.name}"
                                </div>
                                <div className="flex flex-col gap-1 p-2">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onOpenCreateProductDialog()
                                        }}
                                        className="w-full text-right px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors flex items-center gap-2 text-sm font-medium text-blue-900"
                                        dir="rtl"
                                    >
                                        <span>צור מוצר חדש</span>
                                        <Plus className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onUseAsTempItem()
                                        }}
                                        className="w-full text-right px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded transition-colors flex items-center justify-between text-sm font-medium text-gray-700"
                                    >
                                        <span>השתמש כמוצר זמני</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 text-center text-sm text-gray-500 min-h-[60px] flex items-center justify-center">
                                אין תוצאות
                            </div>
                        )}
                    </div>
                )}
            </td>
            <td className="p-2 align-middle">
                <div className="flex items-center gap-1 justify-end">
                    <Label className="text-xs text-gray-600 whitespace-nowrap">כמות:</Label>
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={tempNewItem.quantity}
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '')
                            onTempItemQuantityChange(value || '1')
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                const current = parseInt(tempNewItem.quantity || '1')
                                onTempItemQuantityChange((current + 1).toString())
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                const current = parseInt(tempNewItem.quantity || '1')
                                onTempItemQuantityChange(Math.max(1, current - 1).toString())
                            }
                        }}
                        className="w-16 h-8 text-sm text-center"
                        dir="rtl"
                    />
                </div>
            </td>
            <td className="p-2 align-middle">
                <div className="flex items-center gap-1 justify-end">
                    <Label className="text-xs text-gray-600 whitespace-nowrap">מחיר:</Label>
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={tempNewItem.price}
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '')
                            onTempItemPriceChange(value || '0')
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                const current = parseFloat(tempNewItem.price || '0')
                                onTempItemPriceChange((current + 1).toString())
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                const current = parseFloat(tempNewItem.price || '0')
                                onTempItemPriceChange(Math.max(0, current - 1).toString())
                            }
                        }}
                        className="w-20 h-8 text-sm text-center"
                        dir="rtl"
                    />
                    <span className="text-sm">₪</span>
                </div>
            </td>
            <td className="p-2 align-middle text-right">
                <div className="flex justify-between">
                    <Label className="text-xs text-gray-600 whitespace-nowrap">סה"כ:</Label>
                    <span className="text-sm font-semibold">
                        ₪{(parseFloat(tempNewItem.price) * parseInt(tempNewItem.quantity)) || 0}
                    </span>
                </div>
            </td>
        </tr>
    )

    // Track quantity for each garden appointment (default 1)
    const [gardenQuantities, setGardenQuantities] = useState<Record<string, number>>({})

    // Filter out temporary grooming products from garden appointments
    const filteredGardenAppointments = useMemo(() =>
        gardenAppointments.filter(apt => !(apt.appointment as any)?._isTempGroomingProduct),
        [gardenAppointments]
    )

    // Get stable list of garden appointment IDs for dependency
    const gardenAppointmentIds = useMemo(() =>
        filteredGardenAppointments.map(apt => apt.id).sort().join(','),
        [filteredGardenAppointments]
    )

    // Initialize quantities when garden appointments change
    useEffect(() => {
        const currentIds = new Set(filteredGardenAppointments.map(apt => apt.id))

        setGardenQuantities(prev => {
            const newQuantities: Record<string, number> = {}
            let hasChanges = false

            // Add default quantity for new appointments
            filteredGardenAppointments.forEach(apt => {
                if (!(apt.id in prev)) {
                    newQuantities[apt.id] = 1
                    hasChanges = true
                }
            })

            // Clean up quantities for removed appointments
            const cleaned: Record<string, number> = {}
            Object.keys(prev).forEach(id => {
                if (currentIds.has(id)) {
                    cleaned[id] = prev[id]
                } else {
                    hasChanges = true
                }
            })

            // Only update if there are actual changes
            if (!hasChanges && Object.keys(newQuantities).length === 0) {
                return prev
            }

            return { ...cleaned, ...newQuantities }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gardenAppointmentIds])

    const gardenAppointmentsTotal = useMemo(() => {
        return filteredGardenAppointments.reduce((sum, apt) => {
            const quantity = gardenQuantities[apt.id] || 1
            return sum + ((apt.appointment_price || 0) * quantity)
        }, 0)
    }, [filteredGardenAppointments, gardenQuantities])

    const productsSum = useMemo(() => {
        return orderItems.reduce((sum, item) => sum + (item.price * item.amount), 0)
    }, [orderItems])

    // Products + garden appointments (exclude grooming/temp grooming)
    const productsAndGardenTotal = useMemo(() => {
        return productsSum + gardenAppointmentsTotal
    }, [productsSum, gardenAppointmentsTotal])

    const totalItems = orderItems.length + filteredGardenAppointments.length

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-right block text-lg font-semibold">
                    {totalItems > 0 ? `מוצרים וגן (${totalItems})` : 'מוצרים וגן'}
                </Label>
                <div className="flex items-center gap-2">
                    {totalItems > 0 && (
                        <div className="text-right text-lg font-bold text-green-700">
                            ₪{productsAndGardenTotal.toFixed(2)}
                        </div>
                    )}
                    {isCartDirty && (
                        <Button
                            size="sm"
                            onClick={onSaveCart}
                            disabled={isSavingCart}
                            className="h-8"
                        >
                            {isSavingCart ? (
                                <>
                                    <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                                    שומר...
                                </>
                            ) : cartSaved ? (
                                <>
                                    <CheckCircle2 className="h-3 w-3 ml-1" />
                                    נשמר
                                </>
                            ) : (
                                <>
                                    <Save className="h-3 w-3 ml-1" />
                                    שמור עגלה
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {isLoadingCart && (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600 ml-2" />
                    <span className="text-sm text-gray-600">טוען עגלה...</span>
                </div>
            )}

            {!isLoadingCart && (
                <div className="space-y-2">
                    {orderItems.length === 0 && filteredGardenAppointments.length === 0 && !isAddingNewItem && (
                        <button
                            type="button"
                            onClick={onStartAddingItem}
                            className="w-full border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">הוסף מוצר</span>
                        </button>
                    )}

                    {(orderItems.length > 0 || filteredGardenAppointments.length > 0 || isAddingNewItem) && (
                        <div className="space-y-1.5">
                            <table className="w-full border-collapse">
                                <colgroup>
                                    <col className="w-10" />
                                    <col className="w-auto" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                </colgroup>
                                <tbody>
                                    {/* Garden Appointments */}
                                    {filteredGardenAppointments.map((cartAppt) => {
                                        const appointment = cartAppt.appointment
                                        if (!appointment) return null

                                        const startDate = appointment.startDateTime ? new Date(appointment.startDateTime) : null
                                        const endDate = appointment.endDateTime ? new Date(appointment.endDateTime) : null
                                        const quantity = gardenQuantities[cartAppt.id] || 1
                                        const price = cartAppt.appointment_price || 0
                                        const total = price * quantity

                                        return (
                                            <tr className="border rounded-lg bg-white" key={cartAppt.id}>
                                                <td className="p-2 align-middle">
                                                    {onRemoveGardenAppointment && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => onRemoveGardenAppointment(cartAppt.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                        </Button>
                                                    )}
                                                </td>
                                                <td className="p-2 align-middle text-right">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Home className="h-4 w-4 text-green-600 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Badge variant="outline" className="text-xs px-2 py-0.5">
                                                                    {appointment.gardenAppointmentType === 'hourly' ? 'גן שעתי' :
                                                                        appointment.gardenIsTrial ? 'גן ניסיון' : 'גן יום מלא'}
                                                                </Badge>
                                                                {appointment.dogs && appointment.dogs.length > 0 && (
                                                                    <span className="text-sm font-medium text-gray-900">
                                                                        {appointment.dogs.map(d => d.name).join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {startDate && (
                                                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                                    <CalendarClock className="h-3 w-3" />
                                                                    {format(startDate, "dd/MM/yyyy HH:mm", { locale: he })}
                                                                    {endDate && ` - ${format(endDate, "HH:mm", { locale: he })}`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-2 align-middle">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Label className="text-xs text-gray-600 whitespace-nowrap">כמות:</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={quantity.toString()}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                                if (value) {
                                                                    setGardenQuantities(prev => ({
                                                                        ...prev,
                                                                        [cartAppt.id]: Math.max(1, parseInt(value) || 1)
                                                                    }))
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault()
                                                                    setGardenQuantities(prev => ({
                                                                        ...prev,
                                                                        [cartAppt.id]: (prev[cartAppt.id] || 1) + 1
                                                                    }))
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault()
                                                                    setGardenQuantities(prev => ({
                                                                        ...prev,
                                                                        [cartAppt.id]: Math.max(1, (prev[cartAppt.id] || 1) - 1)
                                                                    }))
                                                                }
                                                            }}
                                                            className="w-16 h-8 text-sm text-center"
                                                            dir="rtl"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-2 align-middle">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Label className="text-xs text-gray-600 whitespace-nowrap">מחיר:</Label>
                                                        <Input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={price.toString()}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                                if (value) {
                                                                    onUpdateGardenAppointmentPrice?.(cartAppt.id, parseFloat(value) || 0)
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault()
                                                                    onUpdateGardenAppointmentPrice?.(cartAppt.id, price + 1)
                                                                } else if (e.key === 'ArrowDown') {
                                                                    e.preventDefault()
                                                                    onUpdateGardenAppointmentPrice?.(cartAppt.id, Math.max(0, price - 1))
                                                                }
                                                            }}
                                                            className="w-20 h-8 text-sm text-center"
                                                            dir="rtl"
                                                        />
                                                        <span className="text-sm">₪</span>
                                                        {(() => {
                                                            const originalGardenAppt = originalGardenAppointments.find(oga => oga.id === cartAppt.id)
                                                            const originalPrice = originalGardenAppt?.appointment_price || (appointment?.price ?? 0)
                                                            if (originalPrice > 0 && Math.abs(price - originalPrice) > 0.01) {
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-6 w-6 p-0"
                                                                        onClick={() => onUpdateGardenAppointmentPrice?.(cartAppt.id, originalPrice)}
                                                                        title="איפוס למחיר המקורי"
                                                                    >
                                                                        <RotateCcw className="h-3 w-3 text-blue-600" />
                                                                    </Button>
                                                                )
                                                            }
                                                            return null
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-right">
                                                    <div className="flex justify-between">
                                                        <Label className="text-xs text-gray-600 whitespace-nowrap">סה"כ:</Label>
                                                        <span className="text-sm font-semibold">₪{total.toFixed(2)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}

                                    {/* Products */}
                                    {orderItems.length > 0 && orderItems.map((item) => (
                                        <tr className="border rounded-lg bg-white" key={item.id}>
                                            <td className="p-2 align-middle">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => onRemoveItem(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </td>
                                            <td className="p-2 align-middle text-right">
                                                <div className="font-medium text-sm whitespace-nowrap">{item.name}</div>
                                            </td>
                                            <td className="p-2 align-middle">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Label className="text-xs text-gray-600 whitespace-nowrap">כמות:</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={item.amount.toString()}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/[^0-9]/g, '')
                                                            if (value) {
                                                                onUpdateQuantity(item.id, parseInt(value) - item.amount)
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowUp') {
                                                                e.preventDefault()
                                                                onUpdateQuantity(item.id, 1)
                                                            } else if (e.key === 'ArrowDown') {
                                                                e.preventDefault()
                                                                onUpdateQuantity(item.id, -1)
                                                            }
                                                        }}
                                                        className="w-16 h-8 text-sm text-center"
                                                        dir="rtl"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-2 align-middle">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <Label className="text-xs text-gray-600 whitespace-nowrap">מחיר:</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={item.price.toString()}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/[^0-9]/g, '')
                                                            if (value) {
                                                                onUpdateItemPrice(item.id, parseFloat(value))
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowUp') {
                                                                e.preventDefault()
                                                                onUpdateItemPrice(item.id, item.price + 1)
                                                            } else if (e.key === 'ArrowDown') {
                                                                e.preventDefault()
                                                                onUpdateItemPrice(item.id, Math.max(0, item.price - 1))
                                                            }
                                                        }}
                                                        className="w-20 h-8 text-sm text-center"
                                                        dir="rtl"
                                                    />
                                                    <span className="text-sm">₪</span>
                                                    {(() => {
                                                        const originalItem = originalOrderItems.find(oi => oi.id === item.id)
                                                        const product = products.find(p => p.id === item.id)
                                                        const originalPrice = originalItem?.price || product?.price || 0
                                                        if (originalPrice > 0 && Math.abs(item.price - originalPrice) > 0.01) {
                                                            return (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => onUpdateItemPrice(item.id, originalPrice)}
                                                                    title="איפוס למחיר המקורי"
                                                                >
                                                                    <RotateCcw className="h-3 w-3 text-blue-600" />
                                                                </Button>
                                                            )
                                                        }
                                                        return null
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="p-2 text-right">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs text-gray-600 whitespace-nowrap">סה"כ:</Label>
                                                    <span className="text-sm font-semibold">₪{item.price * item.amount}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {isAddingNewItem && renderNewItemRow('new-item-row')}

                                    {(orderItems.length > 0 || gardenAppointments.length > 0) && !isAddingNewItem && (
                                        <tr key="add-more-row">
                                            <td colSpan={5} className="pt-1.5">
                                                <button
                                                    type="button"
                                                    onClick={onStartAddingItem}
                                                    className="w-full border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Plus className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-medium text-blue-900">הוסף מוצר נוסף</span>
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
