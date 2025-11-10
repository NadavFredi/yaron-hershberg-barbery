import { useState, useEffect, useRef } from 'react'
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, X } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

interface AutocompleteFilterProps {
    value: string
    onChange: (value: string) => void
    onSelect?: (value: string) => void
    placeholder?: string
    className?: string
    searchFn: (searchTerm: string) => Promise<string[]>
    minSearchLength?: number
    debounceMs?: number
    autoSearchOnFocus?: boolean // If true, trigger search on focus when value is empty
    initialLoadOnMount?: boolean
    initialResultsLimit?: number
}

export function AutocompleteFilter({
    value,
    onChange,
    onSelect,
    placeholder = "חפש...",
    className,
    searchFn,
    minSearchLength = 2,
    debounceMs = 300,
    autoSearchOnFocus = false,
    initialLoadOnMount = false,
    initialResultsLimit = 5,
}: AutocompleteFilterProps) {
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [defaultSuggestions, setDefaultSuggestions] = useState<string[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [isFocused, setIsFocused] = useState(false) // Track focus state
    const [noResultsFound, setNoResultsFound] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionRefs = useRef<(HTMLDivElement | null)[]>([])
    const justSelectedRef = useRef(false)
    const selectedValueRef = useRef<string | null>(null)
    const latestSearchFnRef = useRef(searchFn)
    const lastResultRef = useRef<{ term: string; resultCount: number } | null>(null)
    const activeFetchTermRef = useRef<string | null>(null)
    const isFocusedRef = useRef(false)

    const trimmedValue = value.trim()
    const debouncedSearchTerm = useDebounce(trimmedValue, debounceMs)
    const hasValidSearchTerm = debouncedSearchTerm.length >= minSearchLength && debouncedSearchTerm !== ""

    useEffect(() => {
        latestSearchFnRef.current = searchFn
    }, [searchFn])

    useEffect(() => {
        if (!initialLoadOnMount) {
            return
        }

        let isActive = true
        const loadInitialSuggestions = async () => {
            setIsSearching(true)
            try {
                console.log("🔁 [AutocompleteFilter] Loading initial suggestions")
                const results = await latestSearchFnRef.current("")
                if (!isActive) {
                    return
                }
                const limitedResults = initialResultsLimit > 0 ? results.slice(0, initialResultsLimit) : results
                setDefaultSuggestions(limitedResults)
                if (!trimmedValue) {
                    setSuggestions(limitedResults)
                    setNoResultsFound(limitedResults.length === 0)
                }
                lastResultRef.current = { term: "", resultCount: limitedResults.length }
            } catch (error) {
                if (isActive) {
                    console.error("❌ [AutocompleteFilter] Error fetching default suggestions:", error)
                    setDefaultSuggestions([])
                    setNoResultsFound(false)
                    lastResultRef.current = null
                }
            } finally {
                if (isActive) {
                    setIsSearching(false)
                }
            }
        }

        loadInitialSuggestions()

        return () => {
            isActive = false
        }
    }, [initialLoadOnMount, initialResultsLimit])

    useEffect(() => {
        const shouldSkipSearch =
            justSelectedRef.current ||
            (selectedValueRef.current && debouncedSearchTerm === selectedValueRef.current)

        if (shouldSkipSearch) {
            console.log("⏭️ [AutocompleteFilter] Skipping search because of recent selection", {
                debouncedSearchTerm
            })
            setTimeout(() => {
                justSelectedRef.current = false
            }, debounceMs + 100)
            return
        }

        if (!hasValidSearchTerm) {
            const focusedNow = isFocusedRef.current
            if (!trimmedValue) {
                setSuggestions(defaultSuggestions)
                setNoResultsFound(defaultSuggestions.length === 0 && focusedNow)
                if (focusedNow && defaultSuggestions.length > 0) {
                    setIsOpen(true)
                }
            } else {
                setSuggestions([])
                setNoResultsFound(false)
                setIsOpen(false)
            }
            selectedValueRef.current = null
            lastResultRef.current = null
            return
        }

        if (
            lastResultRef.current &&
            lastResultRef.current.term === debouncedSearchTerm &&
            lastResultRef.current.resultCount === 0
        ) {
            console.log("♻️ [AutocompleteFilter] Reusing cached empty result", { debouncedSearchTerm })
            setSuggestions([])
            setNoResultsFound(true)
            setIsOpen(isFocusedRef.current)
            return
        }

        if (activeFetchTermRef.current === debouncedSearchTerm) {
            console.log("⏳ [AutocompleteFilter] Fetch already in progress, skipping duplicate", {
                debouncedSearchTerm
            })
            return
        }

        let isActive = true
        const fetchSuggestions = async () => {
            activeFetchTermRef.current = debouncedSearchTerm
            setIsSearching(true)
            try {
                console.log("🔎 [AutocompleteFilter] Fetching suggestions", { term: debouncedSearchTerm })
                const results = await latestSearchFnRef.current(debouncedSearchTerm)
                if (!isActive) {
                    return
                }
                lastResultRef.current = { term: debouncedSearchTerm, resultCount: results.length }
                if (results.length === 0) {
                    console.log("ℹ️ [AutocompleteFilter] No results found", { term: debouncedSearchTerm })
                    setSuggestions([])
                    setNoResultsFound(true)
                    setIsOpen(isFocusedRef.current)
                    setHighlightedIndex(-1)
                    suggestionRefs.current = []
                } else {
                    setSuggestions(results)
                    setNoResultsFound(false)
                    setIsOpen(isFocusedRef.current)
                    setHighlightedIndex(-1)
                    suggestionRefs.current = []
                }
            } catch (error) {
                if (isActive) {
                    console.error("❌ [AutocompleteFilter] Error fetching suggestions:", error)
                    setSuggestions([])
                    setIsOpen(false)
                    setNoResultsFound(false)
                    lastResultRef.current = null
                }
            } finally {
                if (isActive) {
                    setIsSearching(false)
                }
                if (activeFetchTermRef.current === debouncedSearchTerm) {
                    activeFetchTermRef.current = null
                }
            }
        }

        fetchSuggestions()

        return () => {
            isActive = false
        }
    }, [debouncedSearchTerm, hasValidSearchTerm, debounceMs, defaultSuggestions, trimmedValue])

    useEffect(() => {
        if (!trimmedValue && defaultSuggestions.length > 0) {
            setSuggestions(defaultSuggestions)
            setNoResultsFound(false)
        }
    }, [defaultSuggestions, trimmedValue])

    const handleSelect = (suggestion: string) => {
        // Mark that we just selected an item to prevent reopening popover
        justSelectedRef.current = true
        selectedValueRef.current = suggestion
        onChange(suggestion)
        onSelect?.(suggestion)
        setIsOpen(false)
        setSuggestions([])
        setNoResultsFound(false)
        lastResultRef.current = null
        setHighlightedIndex(-1)
        inputRef.current?.blur()

        // Clear the selection flag after enough time for debounce to settle
        // This prevents the popover from reopening when the debounced value updates
        setTimeout(() => {
            justSelectedRef.current = false
            // Keep selectedValueRef a bit longer to catch any delayed debounce updates
            setTimeout(() => {
                // Only clear if the value still matches (user hasn't changed it)
                if (selectedValueRef.current === suggestion) {
                    selectedValueRef.current = null
                }
            }, 500)
        }, debounceMs + 200)
    }

    const handleClear = () => {
        justSelectedRef.current = false
        selectedValueRef.current = null
        onChange("")
        setIsOpen(false)
        setSuggestions([])
        setNoResultsFound(false)
        lastResultRef.current = null
        inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Check if we should handle navigation keys
        const hasSuggestions = suggestions.length > 0
        const shouldHandleNav = hasSuggestions || isSearching

        // Always prevent default for arrow keys and Enter/Escape when we have suggestions
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') && shouldHandleNav) {
            e.preventDefault()
            e.stopPropagation()
        }

        // If no suggestions and not searching, allow default behavior
        if (!shouldHandleNav) {
            if (e.key === 'Enter') {
                e.preventDefault()
            }
            return
        }

        // Handle navigation keys
        switch (e.key) {
            case 'ArrowDown':
                // Always open popover if we have suggestions
                if (hasSuggestions && !isOpen) {
                    setIsOpen(true)
                }
                // Navigate to next item (or first item if none selected)
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
                    const nextIndex = prev < suggestions.length - 1 ? prev + 1 : prev
                    requestAnimationFrame(() => {
                        suggestionRefs.current[nextIndex]?.scrollIntoView({
                            block: 'nearest',
                            behavior: 'smooth'
                        })
                    })
                    return nextIndex
                })
                break
            case 'ArrowUp':
                setHighlightedIndex(prev => {
                    if (prev <= 0) {
                        // Go back to no selection (index -1) or stay at 0
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
                break
            case 'Enter':
                if (hasSuggestions) {
                    const indexToSelect = highlightedIndex >= 0 ? highlightedIndex : 0
                    if (indexToSelect < suggestions.length) {
                        handleSelect(suggestions[indexToSelect])
                    }
                }
                break
            case 'Escape':
                setIsOpen(false)
                setHighlightedIndex(-1)
                inputRef.current?.blur()
                break
            default:
                // Keep popover open while typing if we have suggestions
                if (hasValidSearchTerm && hasSuggestions) {
                    setIsOpen(true)
                }
                break
        }
    }

    // Add event listener to prevent default arrow key behavior on window level
    useEffect(() => {
        const handleWindowKeyDown = (e: KeyboardEvent) => {
            // Only prevent default (to stop page scroll) if our input is focused and we have suggestions
            // Don't stop propagation so the input handler can still process it
            if (
                inputRef.current &&
                inputRef.current === document.activeElement &&
                (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
                (suggestions.length > 0 || isSearching)
            ) {
                e.preventDefault()
                // Don't stop propagation - let it bubble to the input handler
            }
        }

        // Use capture phase to catch events early - before they cause page scroll
        document.addEventListener('keydown', handleWindowKeyDown, { capture: true, passive: false })
        return () => {
            document.removeEventListener('keydown', handleWindowKeyDown, { capture: true })
        }
    }, [isOpen, suggestions.length, isSearching])

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <Popover open={isOpen && (suggestions.length > 0 || isSearching || noResultsFound)}>
                <PopoverAnchor asChild>
                    <div className="relative">
                        <Input
                            ref={inputRef}
                            type="text"
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) => {
                                const newValue = e.target.value
                                // Reset selection flag when user types something different
                                if (newValue !== selectedValueRef.current) {
                                    justSelectedRef.current = false
                                    selectedValueRef.current = null
                                }
                                onChange(newValue)
                                setHighlightedIndex(-1)
                                // Don't close if we have valid search term and suggestions
                                // The useEffect will handle opening/closing based on suggestions
                            }}
                            onFocus={async () => {
                                setIsFocused(true)
                                isFocusedRef.current = true
                                // If autoSearchOnFocus is enabled and value is empty, trigger a search
                                if (!trimmedValue) {
                                    const cachedEmptyDefault =
                                        lastResultRef.current &&
                                        lastResultRef.current.term === "" &&
                                        lastResultRef.current.resultCount === 0

                                    if (defaultSuggestions.length > 0) {
                                        setSuggestions(defaultSuggestions)
                                        setIsOpen(true)
                                        setNoResultsFound(false)
                                        setHighlightedIndex(-1)
                                    } else if (cachedEmptyDefault) {
                                        console.log("♻️ [AutocompleteFilter] Using cached empty default suggestions")
                                        setSuggestions([])
                                        setIsOpen(true)
                                        setNoResultsFound(true)
                                        setHighlightedIndex(-1)
                                    } else if (autoSearchOnFocus) {
                                        setIsSearching(true)
                                        try {
                                            console.log("🔁 [AutocompleteFilter] Auto searching on focus")
                                            const results = await latestSearchFnRef.current("")
                                            const limitedResults = initialResultsLimit > 0 ? results.slice(0, initialResultsLimit) : results
                                            setDefaultSuggestions(limitedResults)
                                            setSuggestions(limitedResults)
                                            const hasResults = limitedResults.length > 0
                                            setIsOpen(hasResults)
                                            setNoResultsFound(!hasResults)
                                            setHighlightedIndex(-1)
                                            suggestionRefs.current = []
                                            lastResultRef.current = { term: "", resultCount: limitedResults.length }
                                        } catch (error) {
                                            console.error("❌ [AutocompleteFilter] Error fetching suggestions on focus:", error)
                                            setSuggestions([])
                                            setIsOpen(false)
                                            setNoResultsFound(false)
                                            lastResultRef.current = null
                                        } finally {
                                            setIsSearching(false)
                                        }
                                    } else {
                                        setIsOpen(false)
                                        setNoResultsFound(false)
                                    }
                                } else if (suggestions.length > 0 && hasValidSearchTerm) {
                                    setIsOpen(true)
                                    setNoResultsFound(false)
                                } else if (hasValidSearchTerm && suggestions.length === 0 && noResultsFound) {
                                    setIsOpen(true)
                                }
                            }}
                            onBlur={() => {
                                setIsFocused(false)
                                isFocusedRef.current = false
                            }}
                            onKeyDown={(e) => {
                                handleKeyDown(e)
                            }}
                            className={cn("text-right pr-10", className)}
                            dir="rtl"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                        )}
                        {value && !isSearching && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </PopoverAnchor>
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onInteractOutside={(e) => {
                        // Prevent closing when clicking on the input
                        if (containerRef.current?.contains(e.target as Node)) {
                            e.preventDefault()
                        }
                    }}
                >
                    <ScrollArea className="h-[200px]">
                        <div className="p-1">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={index}
                                    ref={(el) => {
                                        suggestionRefs.current[index] = el
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleSelect(suggestion)
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={cn(
                                        "px-3 py-2 text-sm cursor-pointer rounded-md transition-colors text-right",
                                        highlightedIndex === index
                                            ? "bg-gray-100"
                                            : "hover:bg-gray-50"
                                    )}
                                    dir="rtl"
                                >
                                    {suggestion}
                                </div>
                            ))}
                            {!isSearching && suggestions.length === 0 && noResultsFound && (
                                <div className="px-3 py-2 text-sm text-gray-500 text-right" dir="rtl">
                                    לא נמצאו תוצאות
                                </div>
                            )}
                            {isSearching && suggestions.length === 0 && !noResultsFound && (
                                <div className="px-3 py-2 text-sm text-gray-500 text-right" dir="rtl">
                                    טוען תוצאות...
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
        </div>
    )
}
