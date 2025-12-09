import React, { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Loader2, Save, CheckCircle2, CalendarClock, Scissors, Home, Plus, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { CartAppointment } from "./types"
import { format } from "date-fns"
import { he } from "date-fns/locale"

interface AppointmentsListSectionProps {
    cartAppointments: CartAppointment[]
    isLoadingAppointments: boolean
    isSavingCart: boolean
    cartSaved: boolean
    isCartDirty: boolean
    onUpdateAppointmentPrice: (cartAppointmentId: string, newPrice: number) => void
    onRemoveAppointment: (cartAppointmentId: string) => void
    onSaveCart: () => void
    onAddNewGroomingProduct?: () => void
    originalCartAppointments?: CartAppointment[]
}

export const AppointmentsListSection: React.FC<AppointmentsListSectionProps> = ({
    cartAppointments,
    isLoadingAppointments,
    isSavingCart,
    cartSaved,
    isCartDirty,
    onUpdateAppointmentPrice,
    onRemoveAppointment,
    onSaveCart,
    onAddNewGroomingProduct,
    originalCartAppointments = [],
}) => {
    // Filter to only grooming appointments (including temporary grooming products)
    const groomingAppointments = useMemo(() =>
        cartAppointments.filter(ca =>
            ca.grooming_appointment_id ||
            (ca.appointment?.serviceType === 'grooming' && !ca.grooming_appointment_id)
        ),
        [cartAppointments]
    )

    // Track quantity for each grooming appointment (default 1)
    const [groomingQuantities, setGroomingQuantities] = useState<Record<string, number>>({})

    // Get stable list of appointment IDs for dependency
    const appointmentIds = useMemo(() =>
        groomingAppointments.map(apt => apt.id).sort().join(','),
        [groomingAppointments]
    )

    // Initialize quantities when grooming appointments change
    useEffect(() => {
        const currentIds = new Set(groomingAppointments.map(apt => apt.id))

        setGroomingQuantities(prev => {
            const newQuantities: Record<string, number> = {}
            let hasChanges = false

            // Add default quantity for new appointments
            groomingAppointments.forEach(apt => {
                if (!(apt.id in prev)) {
                    newQuantities[apt.id] = 1
                    hasChanges = true
                }
            })

            // Clean up quantities for removed appointments
            const cleaned: Record<string, number> = {}
            const prevIds = new Set(Object.keys(prev))
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
    }, [appointmentIds])

    const calculateAppointmentsTotal = () => {
        return groomingAppointments.reduce((total, ca) => {
            const quantity = groomingQuantities[ca.id] || 1
            return total + ((ca.appointment_price || 0) * quantity)
        }, 0)
    }

    if (isLoadingAppointments) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary ml-2" />
                    <span className="text-gray-600">טוען תורים...</span>
                </div>
            </div>
        )
    }

    // Always show the section, even when empty, so users can add appointments

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Label className="text-right block text-base font-semibold">
                    תורים בעגלה ({groomingAppointments.length})
                </Label>
                <div className="flex items-center gap-2">
                    {groomingAppointments.length > 0 && (
                        <div className="text-right text-base font-bold text-blue-700">
                            ₪{calculateAppointmentsTotal().toFixed(2)}
                        </div>
                    )}
                    {isCartDirty && (
                        <Button
                            size="sm"
                            onClick={onSaveCart}
                            disabled={isSavingCart}
                            className="h-7 text-xs px-2"
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
                                    שמור
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Appointments List - Only show grooming appointments */}
            <div className="space-y-1.5">
                {groomingAppointments.length > 0 && (
                    <table className="w-full border-collapse">
                        <colgroup>
                            <col className="w-10" />
                            <col className="w-auto" />
                            <col className="w-32" />
                            <col className="w-32" />
                            <col className="w-32" />
                        </colgroup>
                        <tbody>
                            {groomingAppointments.map((cartAppt) => {
                                const appointment = cartAppt.appointment
                                if (!appointment) return null

                                const startDate = appointment.startDateTime ? new Date(appointment.startDateTime) : null
                                const endDate = appointment.endDateTime ? new Date(appointment.endDateTime) : null
                                const quantity = groomingQuantities[cartAppt.id] || 1
                                const price = cartAppt.appointment_price || 0
                                const total = price * quantity

                                return (
                                    <tr className="border rounded-lg bg-white" key={cartAppt.id}>
                                        <td className="p-2 align-middle">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                onClick={() => onRemoveAppointment(cartAppt.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </td>
                                        <td className="p-2 align-middle text-right">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Scissors className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                                                            מספרה
                                                        </Badge>
                                                        {appointment.dogs && appointment.dogs.length > 0 && (
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {appointment.dogs.map(d => {
                                                                    const nameWithBreed = d.breed
                                                                        ? `${d.name} (${d.breed})`
                                                                        : d.name
                                                                    return nameWithBreed
                                                                }).join(', ')}
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
                                                            setGroomingQuantities(prev => ({
                                                                ...prev,
                                                                [cartAppt.id]: Math.max(1, parseInt(value) || 1)
                                                            }))
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'ArrowUp') {
                                                            e.preventDefault()
                                                            setGroomingQuantities(prev => ({
                                                                ...prev,
                                                                [cartAppt.id]: (prev[cartAppt.id] || 1) + 1
                                                            }))
                                                        } else if (e.key === 'ArrowDown') {
                                                            e.preventDefault()
                                                            setGroomingQuantities(prev => ({
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
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        step="1"
                                                        value={price.toString()}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            // Allow numbers and decimal point
                                                            // Remove any characters that aren't digits or decimal point
                                                            let numericValue = value.replace(/[^0-9.]/g, '')

                                                            // Ensure only one decimal point
                                                            const parts = numericValue.split('.')
                                                            if (parts.length > 2) {
                                                                // If more than one decimal point, keep only the first one
                                                                numericValue = parts[0] + '.' + parts.slice(1).join('')
                                                            }

                                                            if (numericValue === '' || numericValue === '.') {
                                                                onUpdateAppointmentPrice(cartAppt.id, 0)
                                                            } else {
                                                                onUpdateAppointmentPrice(cartAppt.id, parseFloat(numericValue) || 0)
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'ArrowUp') {
                                                                e.preventDefault()
                                                                onUpdateAppointmentPrice(cartAppt.id, price + 1)
                                                            } else if (e.key === 'ArrowDown') {
                                                                e.preventDefault()
                                                                onUpdateAppointmentPrice(cartAppt.id, Math.max(0, price - 1))
                                                            }
                                                        }}
                                                        className="w-20 h-8 text-sm text-center"
                                                        dir="rtl"
                                                    />
                                                    <span className="text-sm">₪</span>
                                                    {(() => {
                                                        const originalAppt = originalCartAppointments.find(oca => oca.id === cartAppt.id)
                                                        const originalPrice = originalAppt?.appointment_price || (appointment?.dogs?.[0]?.minGroomingPrice ?? appointment?.price ?? 0)
                                                        if (originalPrice > 0 && Math.abs(price - originalPrice) > 0.01) {
                                                            return (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => onUpdateAppointmentPrice(cartAppt.id, originalPrice)}
                                                                    title="איפוס למחיר המקורי"
                                                                >
                                                                    <RotateCcw className="h-3 w-3 text-blue-600" />
                                                                </Button>
                                                            )
                                                        }
                                                        return null
                                                    })()}
                                                </div>
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
                        </tbody>
                    </table>
                )}

                {/* Add new product button */}
                <div className={groomingAppointments.length > 0 ? "mt-2" : ""}>
                    {onAddNewGroomingProduct && (
                        <button
                            type="button"
                            onClick={onAddNewGroomingProduct}
                            className="w-full border-2 border-dashed border-blue-300 rounded-lg p-2 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">הוסף מוצר חדש</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

