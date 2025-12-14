import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Check, X } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export interface SelectOption {
  id: string
  name: string
}

interface AutocompleteSelectWithCreateProps {
  value: string | null
  onChange: (value: string | null) => void
  searchFn: (searchTerm: string) => Promise<SelectOption[]>
  createFn: (name: string) => Promise<SelectOption>
  label?: string
  placeholder?: string
  className?: string
  allowClear?: boolean
  clearLabel?: string
  disabled?: boolean
  minSearchLength?: number
  debounceMs?: number
  helperText?: string
  error?: string
}

export function AutocompleteSelectWithCreate({
  value,
  onChange,
  searchFn,
  createFn,
  label,
  placeholder = "חפש או הוסף חדש...",
  className,
  allowClear = true,
  clearLabel = "ללא בחירה",
  disabled = false,
  minSearchLength = 1,
  debounceMs = 300,
  helperText,
  error,
}: AutocompleteSelectWithCreateProps) {
  const { toast } = useToast()
  const [inputValue, setInputValue] = useState("")
  const [options, setOptions] = useState<SelectOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [showCreateOption, setShowCreateOption] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedOptionRef = useRef<SelectOption | null>(null)
  const allOptionsRef = useRef<SelectOption[]>([])

  const debouncedSearchTerm = useDebounce(inputValue.trim(), debounceMs)
  const hasValidSearchTerm = debouncedSearchTerm.length >= minSearchLength

  // Load selected option name when value changes
  useEffect(() => {
    const loadSelectedOption = async () => {
      if (!value) {
        selectedOptionRef.current = null
        setInputValue("")
        return
      }

      // Check if we already have it in our options
      const existing = allOptionsRef.current.find((opt) => opt.id === value)
      if (existing) {
        selectedOptionRef.current = existing
        setInputValue(existing.name)
        return
      }

      // Search for it
      try {
        const results = await searchFn("")
        const found = results.find((opt) => opt.id === value)
        if (found) {
          selectedOptionRef.current = found
          setInputValue(found.name)
          allOptionsRef.current.push(found)
        } else {
          selectedOptionRef.current = null
          setInputValue("")
        }
      } catch (error) {
        console.error("Error loading selected option:", error)
        selectedOptionRef.current = null
        setInputValue("")
      }
    }

    loadSelectedOption()
  }, [value, searchFn])

  // Search when debounced term changes
  useEffect(() => {
    if (!isOpen) return

    const performSearch = async () => {
      if (!hasValidSearchTerm) {
        // Load initial options
        setIsSearching(true)
        try {
          const results = await searchFn("")
          setOptions(results)
          allOptionsRef.current = results
          setShowCreateOption(false)
        } catch (error) {
          console.error("Error loading options:", error)
          setOptions([])
        } finally {
          setIsSearching(false)
        }
        return
      }

      setIsSearching(true)
      try {
        const results = await searchFn(debouncedSearchTerm)
        setOptions(results)

        // Check if search term doesn't match any result
        const exactMatch = results.find(
          (opt) => opt.name.toLowerCase() === debouncedSearchTerm.toLowerCase()
        )
        setShowCreateOption(!exactMatch && debouncedSearchTerm.length > 0)
      } catch (error) {
        console.error("Error searching:", error)
        setOptions([])
        setShowCreateOption(false)
      } finally {
        setIsSearching(false)
      }
    }

    performSearch()
  }, [debouncedSearchTerm, hasValidSearchTerm, isOpen, searchFn])

  const handleCreate = useCallback(async () => {
    const nameToCreate = inputValue.trim()
    if (!nameToCreate || isCreating) return

    setIsCreating(true)
    try {
      const newOption = await createFn(nameToCreate)
      allOptionsRef.current.push(newOption)
      selectedOptionRef.current = newOption
      setInputValue(newOption.name)
      onChange(newOption.id)
      setIsOpen(false)
      setShowCreateOption(false)
      toast({
        title: "נוצר בהצלחה",
        description: `"${newOption.name}" נוצר ונבחר`,
      })
    } catch (error) {
      console.error("Error creating option:", error)
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ניתן ליצור את הפריט",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }, [inputValue, isCreating, createFn, onChange, toast])

  const handleSelect = useCallback(
    (option: SelectOption) => {
      selectedOptionRef.current = option
      setInputValue(option.name)
      onChange(option.id)
      setIsOpen(false)
      setHighlightedIndex(-1)
    },
    [onChange]
  )

  const handleClear = useCallback(() => {
    selectedOptionRef.current = null
    setInputValue("")
    onChange(null)
    setIsOpen(false)
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)

    // If user clears input, clear selection if we're not just editing
    if (!newValue && selectedOptionRef.current) {
      // Don't auto-clear on input change, let user explicitly clear
    }
  }

  const handleInputFocus = () => {
    setIsOpen(true)
    if (!inputValue && !hasValidSearchTerm) {
      // Load initial options on focus
      setHighlightedIndex(-1)
    }
  }

  const handleInputBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on popover
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    // Restore selected value if user didn't select anything
    if (selectedOptionRef.current) {
      setInputValue(selectedOptionRef.current.name)
    } else {
      setInputValue("")
    }
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    const totalItems = options.length + (showCreateOption ? 1 : 0) + (allowClear ? 1 : 0)
    let newIndex = highlightedIndex

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        newIndex = highlightedIndex < totalItems - 1 ? highlightedIndex + 1 : 0
        setHighlightedIndex(newIndex)
        break
      case "ArrowUp":
        e.preventDefault()
        newIndex = highlightedIndex > 0 ? highlightedIndex - 1 : totalItems - 1
        setHighlightedIndex(newIndex)
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex === -1 && showCreateOption && hasValidSearchTerm) {
          handleCreate()
        } else if (highlightedIndex >= 0) {
          const clearIndex = allowClear ? 1 : 0
          if (highlightedIndex === 0 && allowClear) {
            handleClear()
          } else if (highlightedIndex === clearIndex + options.length && showCreateOption) {
            handleCreate()
          } else {
            const optionIndex = highlightedIndex - clearIndex
            if (optionIndex >= 0 && optionIndex < options.length) {
              handleSelect(options[optionIndex])
            }
          }
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        if (selectedOptionRef.current) {
          setInputValue(selectedOptionRef.current.name)
        } else {
          setInputValue("")
        }
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(inputValue.trim().toLowerCase())
  )

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-right flex items-center gap-2" htmlFor={inputRef.current?.id}>
          {label}
        </Label>
      )}
      <Popover open={isOpen}>
        <PopoverAnchor asChild>
          <div ref={containerRef} className="relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isCreating}
              className={cn("text-right pr-10", error && "border-red-500")}
              dir="rtl"
            />
            {selectedOptionRef.current && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {(isSearching || isCreating) && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          dir="rtl"
        >
          <ScrollArea className="max-h-[300px]">
            <div className="p-1">
              {allowClear && (
                <button
                  type="button"
                  className={cn(
                    "w-full text-right px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center justify-between",
                    highlightedIndex === 0 && "bg-gray-100",
                    !value && "bg-blue-50"
                  )}
                  onClick={handleClear}
                  onMouseEnter={() => setHighlightedIndex(0)}
                >
                  <span className={cn(!value && "font-medium")}>{clearLabel}</span>
                  {!value && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              )}

              {filteredOptions.map((option, index) => {
                const adjustedIndex = (allowClear ? 1 : 0) + index
                const isSelected = value === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "w-full text-right px-3 py-2 text-sm rounded-md hover:bg-gray-100 flex items-center justify-between",
                      highlightedIndex === adjustedIndex && "bg-gray-100",
                      isSelected && "bg-blue-50"
                    )}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(adjustedIndex)}
                  >
                    <span className={cn(isSelected && "font-medium")}>{option.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                )
              })}

              {showCreateOption && hasValidSearchTerm && (
                <button
                  type="button"
                  className={cn(
                    "w-full text-right px-3 py-2 text-sm rounded-md hover:bg-blue-50 flex items-center justify-between text-blue-600 border-t border-gray-200 mt-1 pt-2",
                    highlightedIndex === (allowClear ? 1 : 0) + filteredOptions.length && "bg-blue-50",
                    isCreating && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={handleCreate}
                  disabled={isCreating}
                  onMouseEnter={() => setHighlightedIndex((allowClear ? 1 : 0) + filteredOptions.length)}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    יצירת "{inputValue.trim()}"
                  </span>
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              )}

              {!isSearching && filteredOptions.length === 0 && !showCreateOption && hasValidSearchTerm && (
                <div className="px-3 py-2 text-sm text-gray-500 text-center">לא נמצאו תוצאות</div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-red-500 text-right">{error}</p>}
      {helperText && !error && <p className="text-xs text-gray-500 text-right">{helperText}</p>}
    </div>
  )
}
