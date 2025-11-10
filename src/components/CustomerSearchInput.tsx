import { useState, useEffect, useMemo, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Loader2, User, Phone, Mail, Sparkles, Pencil } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { useSearchCustomersQuery } from "@/store/services/supabaseApi"
import { cn } from "@/lib/utils"
import { AddCustomerDialog } from "@/components/AddCustomerDialog"
import { EditCustomerDialog } from "@/components/EditCustomerDialog"

export interface Customer {
    id: string
    fullName?: string
    phone?: string
    email?: string
    treatmentNames?: string
    recordId?: string
}

interface CustomerSearchInputProps {
    selectedCustomer: Customer | null
    onCustomerSelect: (customer: Customer) => void
    onCustomerClear: () => void
    disabled?: boolean
    label?: string
    placeholder?: string
    onCustomerCreated?: (customer: Customer) => void
    className?: string
}

export function CustomerSearchInput({
    selectedCustomer,
    onCustomerSelect,
    onCustomerClear,
    disabled = false,
    label = "חיפוש לקוח",
    placeholder = "חיפוש לפי שם, טלפון או אימייל...",
    onCustomerCreated,
    className,
}: CustomerSearchInputProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([])
    const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false)
    const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [isFocused, setIsFocused] = useState(false) // Track focus state
    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionRefs = useRef<(HTMLDivElement | null)[]>([])
    const createButtonRef = useRef<HTMLButtonElement>(null)

    // Debounce search term
    const debouncedSearchTerm = useDebounce(searchTerm.trim(), 300)
    const hasValidSearchTerm = debouncedSearchTerm.length >= 0 // Allow search from first character
    const [shouldSearch, setShouldSearch] = useState(false) // Track if we should trigger search

    // Search customers with debounced term
    const { data: searchData, isLoading: isSearching, refetch: refetchCustomers } = useSearchCustomersQuery(
        { searchTerm: debouncedSearchTerm },
        { skip: !hasValidSearchTerm || !shouldSearch }
    )

    useEffect(() => {
        if (searchData?.customers) {
            setCachedCustomers(searchData.customers)
        }
    }, [searchData])

    useEffect(() => {
        if (!hasValidSearchTerm) {
            setCachedCustomers([])
        }
    }, [hasValidSearchTerm])

    // Extract customers from API responses
    const customers = useMemo(() => {
        const result = searchData?.customers ?? cachedCustomers
        // Reset refs array when customers change
        suggestionRefs.current = []
        return result
    }, [searchData, cachedCustomers])

    // Calculate showResults and showNoResults early so they can be used in handlers
    // Only show results when input is focused (prevents auto-opening)
    const showResults = isFocused && hasValidSearchTerm && !selectedCustomer && customers.length > 0
    const showNoResults = isFocused && hasValidSearchTerm && !selectedCustomer && customers.length === 0 && !isSearching

    // Reset highlighted index when customers change or when switching between results/no-results
    useEffect(() => {
        setHighlightedIndex(-1)
    }, [customers.length, showNoResults])

    const handleSearchChange = (value: string) => {
        setSearchTerm(value)
        // Reset highlighted index when typing
        setHighlightedIndex(-1)
    }

    const handleCustomerSelect = (customer: Customer) => {
        onCustomerSelect(customer)
        setSearchTerm(customer.fullName || '')
        setHighlightedIndex(-1)
        setShouldSearch(false) // Disable search when customer is selected
        setIsFocused(false) // Close suggestions when customer is selected
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Check if we should handle navigation keys
        const hasSuggestions = customers.length > 0
        const hasNoResults = showNoResults
        const shouldHandleNav = hasSuggestions || hasNoResults || isSearching

        // Always prevent default for arrow keys and Enter/Escape when we have suggestions or no results
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') && shouldHandleNav) {
            e.preventDefault()
            e.stopPropagation()
        }

        // If no suggestions, no results, and not searching, allow default behavior
        if (!shouldHandleNav) {
            if (e.key === 'Enter') {
                e.preventDefault()
            }
            return
        }

        // Handle navigation keys
        switch (e.key) {
            case 'ArrowDown':
                // Handle customers list
                if (hasSuggestions) {
                    setHighlightedIndex(prev => {
                        if (prev < 0) {
                            // First press, go to first item
                            const firstIndex = 0
                            requestAnimationFrame(() => {
                                suggestionRefs.current[firstIndex]?.scrollIntoView({
                                    block: 'nearest',
                                    behavior: 'smooth'
                                })
                            })
                            return firstIndex
                        }
                        const nextIndex = prev < customers.length - 1 ? prev + 1 : prev
                        requestAnimationFrame(() => {
                            suggestionRefs.current[nextIndex]?.scrollIntoView({
                                block: 'nearest',
                                behavior: 'smooth'
                            })
                        })
                        return nextIndex
                    })
                }
                // Handle "no results" - highlight create button
                else if (hasNoResults && highlightedIndex < 0) {
                    setHighlightedIndex(0) // Use 0 to represent the create button
                    requestAnimationFrame(() => {
                        createButtonRef.current?.scrollIntoView({
                            block: 'nearest',
                            behavior: 'smooth'
                        })
                    })
                }
                break
            case 'ArrowUp':
                if (hasSuggestions) {
                    setHighlightedIndex(prev => {
                        if (prev <= 0) {
                            // Go back to no selection (index -1)
                            return -1
                        }
                        const nextIndex = prev - 1
                        requestAnimationFrame(() => {
                            suggestionRefs.current[nextIndex]?.scrollIntoView({
                                block: 'nearest',
                                behavior: 'smooth'
                            })
                        })
                        return nextIndex
                    })
                }
                // Handle "no results" - deselect create button
                else if (hasNoResults && highlightedIndex >= 0) {
                    setHighlightedIndex(-1)
                }
                break
            case 'Enter':
                // Select customer from suggestions
                if (hasSuggestions) {
                    const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0
                    if (indexToSelect < customers.length) {
                        handleCustomerSelect(customers[indexToSelect])
                    }
                }
                // Trigger create customer button
                else if (hasNoResults && highlightedIndex >= 0) {
                    setIsAddCustomerDialogOpen(true)
                    setHighlightedIndex(-1)
                }
                break
            case 'Escape':
                setHighlightedIndex(-1)
                inputRef.current?.blur()
                break
            default:
                // Reset highlighted index when typing
                if (highlightedIndex >= 0) {
                    setHighlightedIndex(-1)
                }
                break
        }
    }

    // Prevent page scrolling with arrow keys when input is focused
    useEffect(() => {
        const handleDocumentKeyDown = (e: KeyboardEvent) => {
            if (inputRef.current === document.activeElement && (customers.length > 0 || showNoResults || isSearching)) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault()
                }
            }
        }

        document.addEventListener('keydown', handleDocumentKeyDown, { capture: true, passive: false })
        return () => {
            document.removeEventListener('keydown', handleDocumentKeyDown, { capture: true })
        }
    }, [customers.length, showNoResults, isSearching])

    const handleClearCustomer = () => {
        onCustomerClear()
        setSearchTerm('')
        setShouldSearch(false) // Reset search trigger when clearing
        setIsFocused(false) // Close suggestions when clearing
    }

    // Update search term when selected customer changes externally
    useEffect(() => {
        if (selectedCustomer) {
            setSearchTerm(selectedCustomer.fullName || '')
            setShouldSearch(false) // Disable search when customer is selected
        } else if (!selectedCustomer) {
            setSearchTerm('')
            setShouldSearch(false) // Reset search trigger
        }
    }, [selectedCustomer?.id]) // Only update when customer ID changes

    return (
        <div className={className}>
            <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>
            <div className="relative">
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => {
                        handleSearchChange(e.target.value)
                        setShouldSearch(true) // Enable search once user starts typing
                    }}
                    onFocus={() => {
                        setIsFocused(true)
                        // Trigger search on focus if value is empty
                        if (!searchTerm.trim()) {
                            setShouldSearch(true)
                        }
                    }}
                    onBlur={() => {
                        // Delay setting isFocused to false to allow click events on suggestions
                        setTimeout(() => {
                            setIsFocused(false)
                        }, 200)
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    className={cn(
                        "w-full text-right pr-10 transition-colors",
                        selectedCustomer ? "border-green-300 bg-green-50" : ""
                    )}
                />
                {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                )}
                {selectedCustomer && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 z-10">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                setIsEditCustomerDialogOpen(true)
                            }}
                            className="p-1 hover:bg-green-100 rounded transition-colors"
                            disabled={disabled}
                            title="ערוך לקוח"
                        >
                            <Pencil className="h-4 w-4 text-green-600" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                e.preventDefault()
                                handleClearCustomer()
                            }}
                            className="p-1 hover:bg-green-100 rounded transition-colors"
                            disabled={disabled}
                            title="נקה בחירה"
                        >
                            <X className="h-4 w-4 text-green-600" />
                        </button>
                    </div>
                )}
            </div>

            {/* Search Results */}
            {showResults && (
                <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-lg max-h-48 overflow-hidden">
                    <ScrollArea className="h-48">
                        <div className="p-2">
                            {customers.map((customer, index) => (
                                <div
                                    key={customer.id}
                                    ref={(el) => { suggestionRefs.current[index] = el }}
                                    onClick={() => handleCustomerSelect(customer)}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    className={cn(
                                        "p-3 rounded-md cursor-pointer transition-colors",
                                        "hover:bg-gray-50 border-b border-gray-100 last:border-b-0",
                                        highlightedIndex === index && "bg-blue-100 hover:bg-blue-100"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            <User className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <div className="flex-1 text-right">
                                            <div className="text-sm font-medium text-gray-900 mb-3">
                                                {customer.fullName || 'ללא שם'}
                                            </div>
                                            <div className="mt-1 space-y-1 flex flex-col items-end">
                                                {customer.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                                        <Phone className="h-3 w-3" />
                                                        <span>{customer.phone}</span>
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                                        <Mail className="h-3 w-3" />
                                                        <span>{customer.email}</span>
                                                    </div>
                                                )}
                                                {customer.treatmentNames && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                                        <Sparkles className="h-3 w-3" />
                                                        <span>{customer.treatmentNames}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}

            {/* No Results */}
            {showNoResults && (
                <div className="mt-2 p-4 text-center bg-gray-50 rounded-md border border-gray-200">
                    <div className="text-sm text-gray-500 mb-3">
                        לא נמצאו לקוחות המתאימים לחיפוש
                    </div>
                    <Button
                        ref={createButtonRef}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setIsAddCustomerDialogOpen(true)
                            setHighlightedIndex(-1)
                        }}
                        className={cn(
                            "mt-2",
                            highlightedIndex >= 0 && "bg-blue-100 border-blue-300 hover:bg-blue-200"
                        )}
                    >
                        הוסף לקוח חדש
                    </Button>
                </div>
            )}

            {/* Add Customer Dialog */}
            <AddCustomerDialog
                open={isAddCustomerDialogOpen}
                onOpenChange={setIsAddCustomerDialogOpen}
                onSuccess={(newCustomer) => {
                    console.log("✅ [CustomerSearchInput] Customer created:", newCustomer)
                    // Select the newly created customer immediately
                    onCustomerSelect(newCustomer)
                    // Trigger a refetch to update the search results
                    if (hasValidSearchTerm) {
                        refetchCustomers()
                    }
                    // Notify parent if callback provided
                    onCustomerCreated?.(newCustomer)
                }}
            />

            {/* Edit Customer Dialog */}
            <EditCustomerDialog
                open={isEditCustomerDialogOpen}
                onOpenChange={setIsEditCustomerDialogOpen}
                customerId={selectedCustomer?.id || selectedCustomer?.recordId || null}
                onSuccess={async (updatedCustomer) => {
                    console.log("✅ [CustomerSearchInput] Customer updated:", updatedCustomer)
                    // Update the selected customer with new data if provided
                    if (updatedCustomer && selectedCustomer) {
                        const updatedCustomerObj: Customer = {
                            ...selectedCustomer,
                            fullName: updatedCustomer.fullName || selectedCustomer.fullName,
                            phone: updatedCustomer.phone || selectedCustomer.phone,
                            email: updatedCustomer.email || selectedCustomer.email,
                        }
                        onCustomerSelect(updatedCustomerObj)
                        // Update search term to reflect new name
                        setSearchTerm(updatedCustomer.fullName || selectedCustomer.fullName || "")
                    }
                    // Trigger a refetch to update the search results
                    if (hasValidSearchTerm) {
                        await refetchCustomers()
                    }
                }}
            />
        </div>
    )
}

