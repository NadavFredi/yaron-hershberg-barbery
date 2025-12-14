import React, { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppointmentDetailsSection, type AppointmentStation, type AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { getPersonalAppointmentNames } from "@/integrations/supabase/supabaseService"
import { useDebounce } from "@/hooks/useDebounce"

type ManagerStation = AppointmentStation & { serviceType: 'grooming' | 'garden' }

type FinalizedDragTimes = AppointmentTimes

interface PrivateAppointmentForm {
    name: string
    selectedStations: string[]
    notes: string
}

interface PrivateAppointmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    finalizedDragTimes: FinalizedDragTimes | null
    privateAppointmentForm: PrivateAppointmentForm
    setPrivateAppointmentForm: (form: PrivateAppointmentForm | ((prev: PrivateAppointmentForm) => PrivateAppointmentForm)) => void
    createPrivateAppointmentLoading: boolean
    stations?: ManagerStation[]
    onCancel: () => void
    onConfirm: () => void
    onUpdateTimes?: (times: FinalizedDragTimes) => void
}

export const PrivateAppointmentModal: React.FC<PrivateAppointmentModalProps> = ({
    open,
    onOpenChange,
    finalizedDragTimes,
    privateAppointmentForm,
    setPrivateAppointmentForm,
    createPrivateAppointmentLoading,
    stations = [],
    onCancel,
    onConfirm,
    onUpdateTimes
}) => {
    // Track the last stationId we've processed to avoid duplicate updates
    const lastProcessedStationIdRef = useRef<string | null>(null)
    
    // State for autocomplete
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [autocompleteOpen, setAutocompleteOpen] = useState(false)
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

    // Debounce the search term
    const debouncedSearchTerm = useDebounce(privateAppointmentForm.name.trim(), 300)

    // Fetch appointment names with debounced search
    useEffect(() => {
        if (!open) {
            setSuggestions([])
            return
        }

        setIsLoadingSuggestions(true)
        getPersonalAppointmentNames(debouncedSearchTerm || undefined)
            .then((names) => {
                setSuggestions(names)
                setIsLoadingSuggestions(false)
            })
            .catch((error) => {
                console.error("❌ [PrivateAppointmentModal] Error fetching appointment names:", error)
                setSuggestions([])
                setIsLoadingSuggestions(false)
            })
    }, [open, debouncedSearchTerm])

    // Auto-check the current station when modal opens
    useEffect(() => {
        if (open && finalizedDragTimes?.stationId) {
            const stationId = finalizedDragTimes.stationId
            // Only process if this is a new stationId (modal just opened with different station)
            if (lastProcessedStationIdRef.current !== stationId) {
                // Use functional update to avoid stale closure, but compute value first to avoid Redux serialization warning
                const currentForm = privateAppointmentForm
                if (!currentForm.selectedStations.includes(stationId)) {
                    const uniqueStations = [...new Set([...currentForm.selectedStations, stationId])]
                    setPrivateAppointmentForm({
                        name: currentForm.name,
                        selectedStations: uniqueStations,
                        notes: currentForm.notes
                    })
                }
                lastProcessedStationIdRef.current = stationId
            }
        } else if (!open) {
            // Reset when modal closes
            lastProcessedStationIdRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, finalizedDragTimes?.stationId]) // Intentionally exclude privateAppointmentForm to prevent infinite loop

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">יצירת תור פרטי</DialogTitle>
                    <DialogDescription className="text-right">
                        צור תור פרטי עם הערות אישיות
                    </DialogDescription>
                </DialogHeader>

                {finalizedDragTimes && (
                    <div className="py-4">
                        <AppointmentDetailsSection
                            isOpen={open}
                            finalizedTimes={finalizedDragTimes}
                            stations={stations}
                            onTimesChange={(times) => {
                                if (onUpdateTimes) {
                                    onUpdateTimes(times)
                                }
                            }}
                            theme="purple"
                            stationFilter={(station) => station.serviceType === 'grooming'}
                        />

                        <div className="space-y-4">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                                    שם התור *
                                </label>
                                <input
                                    type="text"
                                    value={privateAppointmentForm.name}
                                    onChange={(e) => {
                                        // Compute new value before dispatching to avoid non-serializable function
                                        setPrivateAppointmentForm({
                                            ...privateAppointmentForm,
                                            name: e.target.value
                                        })
                                        if (!autocompleteOpen && e.target.value) {
                                            setAutocompleteOpen(true)
                                        }
                                    }}
                                    onFocus={() => {
                                        if (suggestions.length > 0 || isLoadingSuggestions) {
                                            setAutocompleteOpen(true)
                                        }
                                    }}
                                    onBlur={() => {
                                        // Delay closing to allow clicking on suggestions
                                        setTimeout(() => {
                                            setAutocompleteOpen(false)
                                        }, 200)
                                    }}
                                    placeholder="הכנס שם לתור הפרטי..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right"
                                />
                                {autocompleteOpen && (suggestions.length > 0 || isLoadingSuggestions) && (
                                    <div 
                                        className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto" 
                                        dir="rtl"
                                        onMouseDown={(e) => {
                                            // Prevent input blur when clicking on dropdown
                                            e.preventDefault()
                                        }}
                                    >
                                        <Command>
                                            <CommandList>
                                                {isLoadingSuggestions ? (
                                                    <div className="py-6 text-center text-sm text-gray-500">
                                                        טוען...
                                                    </div>
                                                ) : suggestions.length > 0 ? (
                                                    <CommandGroup>
                                                        {suggestions.map((name) => (
                                                            <CommandItem
                                                                key={name}
                                                                value={name}
                                                                onSelect={() => {
                                                                    // Compute new value before dispatching to avoid non-serializable function
                                                                    setPrivateAppointmentForm({
                                                                        ...privateAppointmentForm,
                                                                        name
                                                                    })
                                                                    setAutocompleteOpen(false)
                                                                }}
                                                                className="text-right cursor-pointer"
                                                            >
                                                                {name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                ) : null}
                                            </CommandList>
                                        </Command>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                                    הערות (אופציונלי)
                                </label>
                                <textarea
                                    value={privateAppointmentForm.notes || ''}
                                    onChange={(e) => {
                                        // Compute new value before dispatching to avoid non-serializable function
                                        setPrivateAppointmentForm({
                                            ...privateAppointmentForm,
                                            notes: e.target.value
                                        })
                                    }}
                                    placeholder="הכנס הערות על התור הפרטי..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                                    עמדות נוספות (אופציונלי)
                                </label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-between text-right",
                                                privateAppointmentForm.selectedStations.length === 0 && "text-gray-500"
                                            )}
                                        >
                                            {(() => {
                                                const uniqueCount = new Set(privateAppointmentForm.selectedStations).size
                                                return uniqueCount === 0
                                                    ? "בחר עמדות נוספות..."
                                                    : uniqueCount === 1
                                                        ? "עמדה אחת נבחרה"
                                                        : `${uniqueCount} עמדות נבחרו`
                                            })()}
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end" onWheel={(e) => e.stopPropagation()}>
                                        <div className="max-h-60 overflow-y-auto overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
                                            {stations.filter(station => station.serviceType === 'grooming').map(station => (
                                                <div key={station.id} className="flex items-center justify-between p-2 hover:bg-gray-50" dir="rtl">
                                                    <Checkbox
                                                        id={station.id}
                                                        checked={privateAppointmentForm.selectedStations.includes(station.id)}
                                                        onCheckedChange={(checked) => {
                                                            const currentForm = privateAppointmentForm
                                                            if (checked) {
                                                                setPrivateAppointmentForm({
                                                                    name: currentForm.name,
                                                                    selectedStations: [...new Set([...currentForm.selectedStations, station.id])],
                                                                    notes: currentForm.notes
                                                                })
                                                            } else {
                                                                setPrivateAppointmentForm({
                                                                    name: currentForm.name,
                                                                    selectedStations: currentForm.selectedStations.filter(id => id !== station.id),
                                                                    notes: currentForm.notes
                                                                })
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={station.id}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-right flex-1 mr-2"
                                                    >
                                                        {station.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <div className="text-xs text-gray-500 text-right mt-1">
                                    בחר עמדות נוספות אם התור צריך להתבצע במקביל
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter dir="ltr">
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                        disabled={!privateAppointmentForm.name.trim() || createPrivateAppointmentLoading}
                    >
                        {createPrivateAppointmentLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                                יוצר...
                            </>
                        ) : (
                            'צור תור פרטי'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
