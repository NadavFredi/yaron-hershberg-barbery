import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Scissors, Wand2, Droplets, Loader2 } from "lucide-react"
import { DatePickerInput } from "@/components/DatePickerInput"
import { TimePickerInput } from "@/components/TimePickerInput"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import { DogSelectInput, type Dog } from "@/components/DogSelectInput"


interface NewGardenAppointmentForm {
    date: Date | null
    startTime: string
    endTime: string
    appointmentType: 'full-day' | 'hourly' | 'trial'
    customer: Customer | null
    dog: Dog | null
    notes: string
    internalNotes: string
    latePickupRequested: boolean
    latePickupNotes: string
    gardenTrimNails: boolean
    gardenBrush: boolean
    gardenBath: boolean
}

interface NewGardenAppointmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    appointmentType: 'full-day' | 'hourly' | 'trial' | null
    loading?: boolean
    defaultDate?: Date
    defaultCustomer?: Customer | null
    defaultDog?: Dog | null
    onConfirm: (data: NewGardenAppointmentForm) => void
}

export const NewGardenAppointmentModal: React.FC<NewGardenAppointmentModalProps> = ({
    open,
    onOpenChange,
    appointmentType,
    loading = false,
    defaultDate,
    defaultCustomer = null,
    defaultDog = null,
    onConfirm
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedDog, setSelectedDog] = useState<Dog | null>(null)
    const [form, setForm] = useState<NewGardenAppointmentForm>({
        date: defaultDate || new Date(),
        startTime: '07:00',
        endTime: '19:00',
        appointmentType: appointmentType || 'hourly',
        customer: null,
        dog: null,
        notes: '',
        internalNotes: '',
        latePickupRequested: false,
        latePickupNotes: '',
        gardenTrimNails: false,
        gardenBrush: false,
        gardenBath: false,
    })



    // Update appointmentType when the prop changes (for switching types after modal opens)
    useEffect(() => {
        if (appointmentType && appointmentType !== form.appointmentType) {
            setForm(prev => ({ ...prev, appointmentType }))
        }
    }, [appointmentType])

    useEffect(() => {
        if (open) {
            // Set default customer and dog if provided, otherwise reset
            setSelectedCustomer(defaultCustomer)
            setSelectedDog(defaultDog)
            setForm({
                date: defaultDate || new Date(),
                startTime: '07:00',
                endTime: '19:00',
                appointmentType: appointmentType || 'hourly',
                customer: null,
                dog: null,
                notes: '',
                internalNotes: '',
                latePickupRequested: false,
                latePickupNotes: '',
                gardenTrimNails: false,
                gardenBrush: false,
                gardenBath: false,
            })
        }
    }, [open, defaultDate, appointmentType, defaultCustomer, defaultDog])

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
        setSelectedDog(null) // Reset dog selection when customer changes
    }

    const handleDogSelect = (dog: Dog) => {
        setSelectedDog(dog)
    }

    const handleClearCustomer = () => {
        setSelectedCustomer(null)
        setSelectedDog(null)
    }

    const handleClearDog = () => {
        setSelectedDog(null)
    }

    const handleConfirm = () => {
        // Validate required fields
        if (!form.date) {
            alert('יש לבחור תאריך')
            return
        }

        if (form.appointmentType !== 'full-day' && (!form.startTime || !form.endTime)) {
            alert('יש לבחור שעות התחלה וסיום')
            return
        }

        if (!selectedCustomer) {
            alert('יש לבחור לקוח')
            return
        }

        if (!selectedDog) {
            alert('יש לבחור כלב')
            return
        }

        onConfirm({
            ...form,
            customer: selectedCustomer,
            dog: selectedDog,
        })
    }

    const isFullDay = form.appointmentType === 'full-day'
    const isTrial = form.appointmentType === 'trial'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto [&>button:has(svg)]:hidden" dir="rtl">
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute left-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 !block"
                    tabIndex={-1}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>

                <DialogHeader>
                    <DialogTitle className="text-right">
                        {form.appointmentType === 'trial' ? 'תור ניסיון גן' :
                            form.appointmentType === 'full-day' ? 'תור יום מלא' : 'תור שעתי גן'}
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        {form.appointmentType === 'trial' ? 'צור תור ניסיון חדש' :
                            form.appointmentType === 'full-day' ? 'צור תור יום מלא חדש' : 'צור תור שעתי חדש'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Appointment Type Selection */}
                    <div>
                        <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">
                            סוג תור
                        </Label>
                        <Select
                            value={form.appointmentType}
                            onValueChange={(value: 'full-day' | 'hourly' | 'trial') => {
                                setForm(prev => ({ ...prev, appointmentType: value }))
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger
                                className="w-full text-right [&>span]:text-right [&>span]:justify-end"
                                dir="rtl"
                            >
                                <SelectValue placeholder="בחר סוג תור" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="full-day" className="text-right">
                                    <div className="flex items-center gap-2 ">
                                        <Badge className="border-green-200 bg-green-100 text-green-700 text-xs">
                                            יום מלא
                                        </Badge>
                                    </div>
                                </SelectItem>
                                <SelectItem value="hourly" className="text-right">
                                    <div className="flex items-center gap-2 ">
                                        <Badge className="border-blue-200 bg-blue-100 text-blue-700 text-xs">
                                            שעתי
                                        </Badge>
                                    </div>
                                </SelectItem>
                                <SelectItem value="trial" className="text-right">
                                    <div className="flex items-center gap-2 ">
                                        <Badge className="border-amber-200 bg-amber-100 text-amber-700 text-xs">
                                            ניסיון
                                        </Badge>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Selection */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <Label className="text-sm font-medium text-gray-700">תאריך התור</Label>
                            <DatePickerInput
                                value={form.date}
                                onChange={(date) => setForm(prev => ({ ...prev, date }))}
                                disabled={loading}
                                autoOpenOnFocus={false}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Time Selection (not for full day) */}
                    {!isFullDay && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-700 text-right block mb-2">שעת התחלה</Label>
                                <TimePickerInput
                                    value={form.startTime}
                                    onChange={(value) => setForm(prev => ({ ...prev, startTime: value }))}
                                    disabled={loading}
                                    intervalMinutes={15}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-700 text-right block mb-2">שעת סיום</Label>
                                <TimePickerInput
                                    value={form.endTime}
                                    onChange={(value) => setForm(prev => ({ ...prev, endTime: value }))}
                                    disabled={loading}
                                    intervalMinutes={15}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Customer and Dog Selection */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 text-right">פרטי לקוח וכלב</h3>

                        {/* Customer Search */}
                        <CustomerSearchInput
                            selectedCustomer={selectedCustomer}
                            onCustomerSelect={handleCustomerSelect}
                            onCustomerClear={handleClearCustomer}
                            disabled={loading}
                        />

                        {/* Dog Selection */}
                        <DogSelectInput
                            selectedCustomer={selectedCustomer}
                            selectedDog={selectedDog}
                            onDogSelect={handleDogSelect}
                            onDogClear={handleClearDog}
                            disabled={loading}
                        />
                    </div>

                    {/* Services */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 text-right">שירותים</h3>

                        <div className="flex gap-4 text-right">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="trim-nails"
                                    checked={form.gardenTrimNails}
                                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, gardenTrimNails: !!checked }))}
                                    disabled={loading}
                                />
                                <Label htmlFor="trim-nails" className="flex items-center gap-2 cursor-pointer">
                                    <div className="flex items-center justify-center w-4 h-4 rounded-full bg-orange-100 text-orange-600">
                                        <Scissors className="h-3 w-3" />
                                    </div>
                                    גזירת ציפורניים
                                </Label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="brush"
                                    checked={form.gardenBrush}
                                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, gardenBrush: !!checked }))}
                                    disabled={loading}
                                />
                                <Label htmlFor="brush" className="flex items-center gap-2 cursor-pointer">
                                    <div className="flex items-center justify-center w-4 h-4 rounded-full bg-pink-100 text-pink-600">
                                        <Wand2 className="h-3 w-3" />
                                    </div>
                                    הברשה
                                </Label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="bath"
                                    checked={form.gardenBath}
                                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, gardenBath: !!checked }))}
                                    disabled={loading}
                                />
                                <Label htmlFor="bath" className="flex items-center gap-2 cursor-pointer">
                                    <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600">
                                        <Droplets className="h-3 w-3" />
                                    </div>
                                    רחצה
                                </Label>
                            </div>
                        </div>
                    </div>

                    {/* Late Pickup */}
                    <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center gap-2 text-right">
                            <Checkbox
                                id="late-pickup"
                                checked={form.latePickupRequested}
                                onCheckedChange={(checked) => setForm(prev => ({ ...prev, latePickupRequested: !!checked }))}
                                disabled={loading}
                            />
                            <Label htmlFor="late-pickup" className="cursor-pointer">מבקש איסוף מאוחר</Label>
                        </div>

                        {form.latePickupRequested && (
                            <div>
                                <Label className="text-sm font-medium text-gray-700">פרטי איסוף מאוחר</Label>
                                <Textarea
                                    value={form.latePickupNotes}
                                    onChange={(e) => setForm(prev => ({ ...prev, latePickupNotes: e.target.value }))}
                                    disabled={loading}
                                    placeholder="פרטי איסוף מאוחר"
                                    className="text-right"
                                    rows={2}
                                />
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2 border-t pt-4">
                        <div>
                            <Label className="text-sm font-medium text-gray-700">הערות לקוח</Label>
                            <Textarea
                                value={form.notes}
                                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                disabled={loading}
                                placeholder="הערות עבור הלקוח..."
                                className="text-right"
                                rows={2}
                            />
                        </div>

                        <div>
                            <Label className="text-sm font-medium text-gray-700">הערות פנימיות לצוות</Label>
                            <Textarea
                                value={form.internalNotes}
                                onChange={(e) => setForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                                disabled={loading}
                                placeholder="הערות פנימיות לצוות בלבד..."
                                className="text-right"
                                rows={2}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter dir="ltr" className="flex-row gap-2 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        ביטול
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                נוצר...
                            </>
                        ) : 'צור תור'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
