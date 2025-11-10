import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, X, Trash2, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import { DogSelectInput, type Dog } from "@/components/DogSelectInput"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateRange {
    startDate: Date | null
    endDate: Date | null // null for single date
}

type DateEntryMode = 'single' | 'range'

interface DateEntry {
    id: string
    mode: DateEntryMode
    singleDates: Date[]
    range: DateRange
}

type ServiceScopeValue = 'grooming' | 'daycare' | 'both' | 'garden'
type NormalizedServiceScope = 'grooming' | 'daycare' | 'both'

interface WaitlistSubmissionEntry {
    startDate: string
    endDate: string | null
}

interface WaitlistSubmissionData {
    customer: Customer
    dog: Dog
    entries: WaitlistSubmissionEntry[]
    serviceScope: ServiceScopeValue
    notes: string
    mode: 'create' | 'edit'
    entryId?: string
}

interface ServiceScopeOption {
    value: ServiceScopeValue
    label: string
}

interface AddWaitlistEntryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    defaultCustomer?: Customer | null
    defaultDog?: Dog | null
    disableCustomerSelection?: boolean
    disableDogSelection?: boolean
    title?: string
    description?: string
    submitLabel?: string
    serviceScopeOptions?: ServiceScopeOption[]
    initialServiceScope?: ServiceScopeValue
    initialDateRanges?: Array<{ startDate: string; endDate?: string | null }>
    initialNotes?: string | null
    entryId?: string
    onSubmit?: (data: WaitlistSubmissionData) => Promise<void>
}

export const AddWaitlistEntryModal: React.FC<AddWaitlistEntryModalProps> = ({
    open,
    onOpenChange,
    onSuccess,
    defaultCustomer = null,
    defaultDog = null,
    disableCustomerSelection = false,
    disableDogSelection = false,
    title = "הוסף כלב לרשימת ההמתנה",
    description = "בחר לקוח, כלב, ותאריכים להמתנה",
    submitLabel = "הוסף לרשימת המתנה",
    serviceScopeOptions,
    initialServiceScope,
    initialDateRanges,
    initialNotes = "",
    entryId,
    onSubmit
}) => {
    const createDateEntry = (mode: DateEntryMode = 'single'): DateEntry => ({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        mode,
        singleDates: [],
        range: { startDate: null, endDate: null }
    })

    const [dateSelectionMode, setDateSelectionMode] = useState<DateEntryMode>('single')
    const [dateEntries, setDateEntries] = useState<DateEntry[]>([createDateEntry('single')])
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(defaultCustomer)
    const [selectedDog, setSelectedDog] = useState<Dog | null>(defaultDog)
    const [notes, setNotes] = useState(initialNotes || "")
    const [serviceScope, setServiceScope] = useState<ServiceScopeValue>(
        initialServiceScope ??
        serviceScopeOptions?.[0]?.value ??
        'grooming'
    )
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { toast } = useToast()
    const wasOpenRef = useRef(false)

    const normalizeServiceScope = (value: ServiceScopeValue): NormalizedServiceScope => {
        return value === 'garden' ? 'daycare' : value
    }

    const buildEntriesFromRanges = useCallback((ranges?: Array<{ startDate: string; endDate?: string | null }>): DateEntry[] => {
        if (!ranges || ranges.length === 0) {
            return [createDateEntry('single')]
        }

        return ranges
            .map((range) => {
                const startDate = range.startDate ? new Date(range.startDate) : null
                const endDate = range.endDate ? new Date(range.endDate) : null

                if (!startDate || Number.isNaN(startDate.getTime())) {
                    return null
                }

                const sameDay = !endDate || Number.isNaN(endDate.getTime()) || startDate.toDateString() === endDate.toDateString()

                if (sameDay) {
                    return {
                        ...createDateEntry('single'),
                        singleDates: [startDate],
                    }
                }

                return {
                    ...createDateEntry('range'),
                    mode: 'range',
                    range: { startDate, endDate },
                }
            })
            .filter((entry): entry is DateEntry => Boolean(entry))
    }, [])

    const determineInitialMode = useCallback((entries: DateEntry[]) => {
        return entries.some((entry) => entry.mode === 'range') ? 'range' : 'single'
    }, [])

    const resetFormState = useCallback(() => {
        setDateEntries([createDateEntry('single')])
        setDateSelectionMode('single')
        setSelectedCustomer(defaultCustomer ?? null)
        setSelectedDog(defaultDog ?? null)
        setNotes(initialNotes || "")
        setServiceScope(
            initialServiceScope ??
            serviceScopeOptions?.[0]?.value ??
            'grooming'
        )
    }, [defaultCustomer, defaultDog, initialNotes, initialServiceScope, serviceScopeOptions])

    const initializeFormState = useCallback(() => {
        const entries = buildEntriesFromRanges(initialDateRanges)
        setDateEntries(entries)
        setDateSelectionMode(determineInitialMode(entries))
        setSelectedCustomer(defaultCustomer ?? null)
        setSelectedDog(defaultDog ?? null)
        setNotes(initialNotes || "")
        setServiceScope(
            initialServiceScope ??
            serviceScopeOptions?.[0]?.value ??
            'grooming'
        )
    }, [
        buildEntriesFromRanges,
        determineInitialMode,
        defaultCustomer,
        defaultDog,
        initialDateRanges,
        initialNotes,
        initialServiceScope,
        serviceScopeOptions
    ])

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            initializeFormState()
        } else if (!open && wasOpenRef.current) {
            resetFormState()
        }
        wasOpenRef.current = open
    }, [open, initializeFormState, resetFormState])

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
        setSelectedDog(null) // Reset dog when customer changes
    }

    const handleDogSelect = (dog: Dog) => {
        setSelectedDog(dog)
    }

    const addDateEntry = () => {
        setDateEntries(prev => [...prev, createDateEntry(dateSelectionMode)])
    }

    const removeDateEntry = (id: string) => {
        setDateEntries(prev => (prev.length > 1 ? prev.filter(entry => entry.id !== id) : prev))
    }

    const updateDateEntry = (id: string, updater: (entry: DateEntry) => DateEntry) => {
        setDateEntries(prev => prev.map(entry => (entry.id === id ? updater(entry) : entry)))
    }

    const handleEntryModeChange = (id: string, mode: DateEntryMode) => {
        updateDateEntry(id, entry => ({ ...entry, mode }))
    }

    const handleSingleDatesChange = (id: string, dates: Date[]) => {
        updateDateEntry(id, entry => ({ ...entry, singleDates: dates }))
    }

    const handleRangeChange = (id: string, range: DateRange) => {
        updateDateEntry(id, entry => ({ ...entry, range }))
    }

    const handleSubmit = async () => {
        // Validation
        if (!selectedCustomer) {
            toast({
                title: "שגיאה",
                description: "יש לבחור לקוח",
                variant: "destructive"
            })
            return
        }

        if (!selectedDog) {
            toast({
                title: "שגיאה",
                description: "יש לבחור כלב",
                variant: "destructive"
            })
            return
        }

        if (dateEntries.length === 0) {
            toast({
                title: "שגיאה",
                description: "יש להוסיף לפחות בחירת תאריכים אחת",
                variant: "destructive"
            })
            return
        }

        const supabaseEntries: {
            customer_id: string
            dog_id: string
            service_scope: NormalizedServiceScope
            status: 'active'
            start_date: string
            end_date: string | null
            notes: string | null
        }[] = []

        for (let i = 0; i < dateEntries.length; i++) {
            const entry = dateEntries[i]

            if (entry.mode === 'single') {
                if (entry.singleDates.length === 0) {
                    toast({
                        title: "שגיאה",
                        description: `בחר לפחות תאריך אחד בבחירה מספר ${i + 1}`,
                        variant: "destructive"
                    })
                    return
                }

                entry.singleDates.forEach(date => {
                    supabaseEntries.push({
                        customer_id: selectedCustomer.id,
                        dog_id: selectedDog.id,
                        service_scope: normalizeServiceScope(serviceScope),
                        status: 'active',
                        start_date: format(date, 'yyyy-MM-dd'),
                        end_date: null,
                        notes: notes.trim() || null
                    })
                })
            } else {
                const { startDate, endDate } = entry.range

                if (!startDate) {
                    toast({
                        title: "שגיאה",
                        description: `בחר תאריך התחלה בטווח בבחירה מספר ${i + 1}`,
                        variant: "destructive"
                    })
                    return
                }

                if (endDate && endDate < startDate) {
                    toast({
                        title: "שגיאה",
                        description: `תאריך הסיום חייב להיות אחרי תאריך ההתחלה בבחירה מספר ${i + 1}`,
                        variant: "destructive"
                    })
                    return
                }

                supabaseEntries.push({
                    customer_id: selectedCustomer.id,
                    dog_id: selectedDog.id,
                    service_scope: normalizeServiceScope(serviceScope),
                    status: 'active',
                    start_date: format(startDate, 'yyyy-MM-dd'),
                    end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
                    notes: notes.trim() || null
                })
            }
        }

        setIsSubmitting(true)

        try {
            if (onSubmit) {
                const submissionEntries: WaitlistSubmissionEntry[] = supabaseEntries.map((entry) => ({
                    startDate: entry.start_date,
                    endDate: entry.end_date
                }))

                await onSubmit({
                    customer: selectedCustomer,
                    dog: selectedDog,
                    entries: submissionEntries,
                    serviceScope: serviceScope,
                    notes: notes.trim(),
                    mode: entryId ? 'edit' : 'create',
                    entryId
                })
            } else {
                const { error } = await supabase
                    .from('daycare_waitlist')
                    .insert(supabaseEntries)

                if (error) throw error
            }

            toast({
                title: entryId ? "בקשת ההמתנה עודכנה" : "הצלחה",
                description: entryId
                    ? "בקשת ההמתנה עודכנה בהצלחה"
                    : `נוספו ${supabaseEntries.length} רשומות לרשימת ההמתנה`
            })

            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            console.error("Error adding waitlist entries:", error)
            toast({
                title: "שגיאה",
                description: error.message || "אירעה שגיאה בעת הוספת רשומות לרשימת ההמתנה",
                variant: "destructive"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent
                className="sm:max-w-[700px]"
                dir="rtl"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-right">{title}</DialogTitle>
                    <DialogDescription className="text-right">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[65vh] overflow-y-auto pr-1">
                    <div className="space-y-6 py-4">
                        {/* Customer Selection */}
                        <div className="space-y-2">
                            <Label>לקוח <span className="text-red-500">*</span></Label>
                            <CustomerSearchInput
                                selectedCustomer={selectedCustomer}
                                onCustomerSelect={handleCustomerSelect}
                                onCustomerClear={() => {
                                    if (disableCustomerSelection) return
                                    setSelectedCustomer(null)
                                    setSelectedDog(null)
                                }}
                                placeholder="חיפוש לקוח..."
                                disabled={disableCustomerSelection}
                            />
                        </div>

                        {/* Dog Selection - only shown when customer is selected */}
                        {selectedCustomer && (
                            <div className="space-y-2">
                                <Label>כלב <span className="text-red-500">*</span></Label>
                                <DogSelectInput
                                    selectedCustomer={selectedCustomer}
                                    selectedDog={selectedDog}
                                    onDogSelect={handleDogSelect}
                                    onDogClear={() => setSelectedDog(null)}
                                    placeholder="בחר כלב..."
                                    disabled={disableDogSelection}
                                />
                            </div>
                        )}

                        {serviceScopeOptions && serviceScopeOptions.length > 0 && (
                            <div className="space-y-2">
                                <Label>סוג שירות <span className="text-red-500">*</span></Label>
                                <Select
                                    value={serviceScope}
                                    onValueChange={(value) => setServiceScope(value as ServiceScopeValue)}
                                >
                                    <SelectTrigger dir="rtl" className="text-right">
                                        <SelectValue placeholder="בחר סוג שירות" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {serviceScopeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="text-right">
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Date Ranges */}
                        <div className="space-y-4">
                            <Label>איך תרצו לבחור תאריכים? <span className="text-red-500">*</span></Label>


                            <div className="space-y-3">
                                {dateEntries.map((entry, index) => (
                                    <DateEntryCard
                                        key={entry.id}
                                        index={index}
                                        entry={entry}
                                        onModeChange={(mode) => handleEntryModeChange(entry.id, mode)}
                                        onSingleDatesChange={(dates) => handleSingleDatesChange(entry.id, dates)}
                                        onRangeChange={(range) => handleRangeChange(entry.id, range)}
                                        onRemove={() => removeDateEntry(entry.id)}
                                        canRemove={dateEntries.length > 1}
                                    />
                                ))}

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addDateEntry}
                                    className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-50"
                                >
                                    <Plus className="h-4 w-4 ml-2" />
                                    הוסף בחירת תאריכים {dateSelectionMode === 'single' ? "בבודדים" : "כטווח"}
                                </Button>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>הערות (אופציונלי)</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="הערות נוספות..."
                                className="min-h-[100px]"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                מוסיף...
                            </>
                        ) : (
                            submitLabel
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        בטל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface DateEntryCardProps {
    index: number
    entry: DateEntry
    onModeChange: (mode: DateEntryMode) => void
    onSingleDatesChange: (dates: Date[]) => void
    onRangeChange: (range: DateRange) => void
    onRemove: () => void
    canRemove: boolean
}

const DateEntryCard: React.FC<DateEntryCardProps> = ({
    index,
    entry,
    onModeChange,
    onSingleDatesChange,
    onRangeChange,
    onRemove,
    canRemove
}) => {
    return (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-2.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-blue-900">
                {canRemove && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRemove}
                        className="text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span>הסר</span>
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {[
                    { label: "תאריכים בודדים", mode: "single" as DateEntryMode },
                    { label: "טווחי תאריכים", mode: "range" as DateEntryMode },
                ].map(({ label, mode }) => {
                    const active = entry.mode === mode
                    return (
                        <Button
                            key={mode}
                            type="button"
                            variant={active ? "default" : "outline"}
                            onClick={() => onModeChange(mode)}
                            className={cn(
                                "text-sm font-semibold",
                                active
                                    ? "bg-primary text-white hover:bg-primary"
                                    : "border-blue-200 bg-white text-blue-900 hover:bg-blue-50"
                            )}
                        >
                            {label}
                        </Button>
                    )
                })}
            </div>

            {entry.mode === 'single' ? (
                <SingleDatesPicker dates={entry.singleDates} onChange={onSingleDatesChange} />
            ) : (
                <RangePickerInput range={entry.range} onChange={onRangeChange} />
            )}
        </div>
    )
}

interface SingleDatesPickerProps {
    dates: Date[]
    onChange: (dates: Date[]) => void
}

const SingleDatesPicker: React.FC<SingleDatesPickerProps> = ({ dates, onChange }) => {
    const [open, setOpen] = useState(false)

    const removeDate = (dateToRemove: Date) => {
        onChange(dates.filter(date => date.getTime() !== dateToRemove.getTime()))
    }

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        className={cn(
                            "w-full justify-between rounded-xl border-2 border-primary bg-white text-primary shadow-sm hover:bg-primary/10"
                        )}
                    >
                        <span className="text-sm font-medium text-primary">
                            {dates.length > 0
                                ? `נבחרו ${dates.length} תאריכים`
                                : "לחצו לבחירת תאריכים מרובים"}
                        </span>
                        <CalendarIcon className="h-4 w-4 ml-2 text-primary" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] max-w-[90vw] p-0" align="end">
                    <Calendar
                        mode="multiple"
                        selected={dates}
                        onSelect={(selected) => onChange(selected ?? [])}
                        numberOfMonths={1}
                        className="w-full"
                    />
                    <div className="flex items-center justify-between flex-col border-t px-4 py-2 text-xs text-gray-500">
                        <span className="text-right">לחיצה על תאריך תוסיף אותו, לחיצה נוספת תסיר אותו</span>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => setOpen(false)}
                        >
                            סגור
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            {dates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {dates.map(date => (
                        <Badge
                            key={date.toISOString()}
                            variant="secondary"
                            className="flex items-center gap-1 bg-blue-100 text-blue-900 hover:bg-blue-100"
                        >
                            {format(date, 'dd/MM/yyyy')}
                            <button
                                type="button"
                                onClick={() => removeDate(date)}
                                className="text-blue-500 hover:text-red-500"
                                aria-label="הסר תאריך"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}

const RangePickerInput: React.FC<{ range: DateRange; onChange: (value: DateRange) => void }> = ({ range, onChange }) => {
    const [open, setOpen] = useState(false)

    const displayValue = range.startDate
        ? range.endDate
            ? `${format(range.startDate, 'dd/MM/yyyy')} - ${format(range.endDate, 'dd/MM/yyyy')}`
            : `${format(range.startDate, 'dd/MM/yyyy')} (תאריך בודד)`
        : "לחצו כדי לבחור טווח"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    className={cn(
                        "w-full justify-between rounded-xl border-2 border-primary bg-white text-right text-primary shadow-sm hover:bg-primary/10",
                        !range.startDate && "opacity-90"
                    )}
                >
                    <span className="flex flex-col items-start">
                        <span className="text-xs text-primary/80">טווח המתנה</span>
                        <span className="text-sm font-medium text-primary">{displayValue}</span>
                    </span>
                    <CalendarIcon className="h-4 w-4 ml-2 text-primary" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] max-w-[90vw] p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={range.startDate ?? undefined}
                    selected={{
                        from: range.startDate ?? undefined,
                        to: range.endDate ?? undefined
                    }}
                    onSelect={(selectedRange) =>
                        onChange({
                            startDate: selectedRange?.from ?? null,
                            endDate: selectedRange?.to ?? null
                        })
                    }
                    numberOfMonths={1}
                    className="w-full"
                />
                <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-gray-500 flex-col">
                    <span>בחרו תאריך התחלה ואז תאריך סיום. אפשר להשאיר את תאריך הסיום ריק.</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => setOpen(false)}
                    >
                        סגור
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
