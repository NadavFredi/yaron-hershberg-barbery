import { useState, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CustomerTypeOption {
    id: string
    name: string
}

export interface CustomerTypeMultiSelectProps {
    options: CustomerTypeOption[]
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
    placeholder?: string
    isLoading?: boolean
    onCreateCustomerType?: (name: string) => Promise<string | null>
    onRefreshOptions?: () => Promise<void>
}

export function CustomerTypeMultiSelect({
    options,
    selectedIds,
    onSelectionChange,
    placeholder = "בחר סוגי לקוחות...",
    isLoading = false,
    onCreateCustomerType,
    onRefreshOptions,
}: CustomerTypeMultiSelectProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [isCreating, setIsCreating] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

    const selectedOptions = useMemo(
        () => options.filter((option) => selectedIds.includes(option.id)),
        [options, selectedIds]
    )

    const filteredOptions = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase()
        if (!normalized) return options
        return options.filter((option) => option.name.toLowerCase().includes(normalized))
    }, [options, searchTerm])

    // Reset highlighted index when options change
    useEffect(() => {
        if (open && filteredOptions.length > 0) {
            setHighlightedIndex(0)
        } else {
            setHighlightedIndex(-1)
        }
        optionRefs.current = []
    }, [filteredOptions, open])

    const handleToggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((optionId) => optionId !== id))
        } else {
            onSelectionChange([...selectedIds, id])
        }
    }

    const handleClear = () => {
        onSelectionChange([])
        setSearchTerm("")
    }

    const handleCreateCustomerType = async () => {
        if (!onCreateCustomerType || !searchTerm.trim()) return

        setIsCreating(true)
        try {
            console.log("🆕 [CustomerTypeMultiSelect] Creating new customer type:", searchTerm.trim())
            const newId = await onCreateCustomerType(searchTerm.trim())
            if (newId) {
                // Add the new customer type to selected items
                onSelectionChange([...selectedIds, newId])
                setSearchTerm("")
                setOpen(false)
                
                // Refresh options to include the new customer type
                if (onRefreshOptions) {
                    await onRefreshOptions()
                }
                console.log("✅ [CustomerTypeMultiSelect] Customer type created and added:", newId)
            }
        } catch (error) {
            console.error("❌ [CustomerTypeMultiSelect] Failed to create customer type:", error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setOpen(true)
                setHighlightedIndex(0)
            }
            return
        }

        const optionsCount = filteredOptions.length
        const hasCreateOption = searchTerm.trim() && onCreateCustomerType

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault()
                setHighlightedIndex((prev) => {
                    const maxIndex = hasCreateOption ? optionsCount : optionsCount - 1
                    const next = prev < maxIndex ? prev + 1 : prev
                    // Scroll into view
                    setTimeout(() => {
                        optionRefs.current[next]?.scrollIntoView({ block: "nearest" })
                    }, 0)
                    return next
                })
                break
            case "ArrowUp":
                event.preventDefault()
                setHighlightedIndex((prev) => {
                    const next = prev > 0 ? prev - 1 : -1
                    // Scroll into view
                    setTimeout(() => {
                        if (next >= 0) {
                            optionRefs.current[next]?.scrollIntoView({ block: "nearest" })
                        }
                    }, 0)
                    return next
                })
                break
            case "Enter":
            case " ":
                event.preventDefault()
                if (highlightedIndex >= 0 && highlightedIndex < optionsCount) {
                    handleToggle(filteredOptions[highlightedIndex].id)
                } else if (hasCreateOption && highlightedIndex === optionsCount) {
                    handleCreateCustomerType()
                }
                break
            case "Escape":
                event.preventDefault()
                setOpen(false)
                setHighlightedIndex(-1)
                break
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div
                    className={cn(
                        "relative flex min-h-11 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                        "cursor-text"
                    )}
                    onClick={() => setOpen(true)}
                    dir="rtl"
                >
                    {selectedOptions.length > 0 ? (
                        <div className="flex flex-wrap gap-2 flex-1">
                            {selectedOptions.map((option) => (
                                <Badge
                                    key={option.id}
                                    variant="secondary"
                                    className="flex items-center gap-1 text-xs h-7 px-2 cursor-pointer"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        handleToggle(option.id)
                                    }}
                                >
                                    <span>{option.name}</span>
                                    <X className="h-3 w-3 hover:text-destructive" />
                                </Badge>
                            ))}
                            <input
                                className="flex-1 min-w-[120px] border-0 bg-transparent text-right outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setOpen(true)}
                                onKeyDown={handleKeyDown}
                                placeholder={selectedOptions.length === 0 ? placeholder : ""}
                                dir="rtl"
                            />
                        </div>
                    ) : (
                        <input
                            className="flex-1 border-0 bg-transparent text-right outline-none placeholder:text-muted-foreground"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setOpen(true)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            dir="rtl"
                        />
                    )}

                    <div className="flex items-center gap-2 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                        {selectedOptions.length > 0 && (
                            <button
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    handleClear()
                                }}
                                className="rounded p-1 hover:bg-red-50 hover:text-red-500"
                                title="נקה בחירה"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                        <ChevronDown className="h-4 w-4" />
                    </div>
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                dir="rtl"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                <div className="max-h-[280px] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>טוען סוגי לקוחות...</span>
                        </div>
                    ) : filteredOptions.length > 0 ? (
                        filteredOptions.map((option, index) => {
                            const isSelected = selectedIds.includes(option.id)
                            const isHighlighted = highlightedIndex === index
                            return (
                                <button
                                    key={option.id}
                                    ref={(el) => (optionRefs.current[index] = el)}
                                    type="button"
                                    onClick={() => handleToggle(option.id)}
                                    className={cn(
                                        "flex w-full items-center justify-between px-3 py-2 text-sm text-right transition-colors",
                                        "hover:bg-primary/10",
                                        isSelected && "text-primary",
                                        isHighlighted && "bg-primary/20"
                                    )}
                                >
                                    <span>{option.name}</span>
                                    <Check className={cn("h-4 w-4 transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
                                </button>
                            )
                        })
                    ) : (
                        <div className="px-3 py-6">
                            {searchTerm.trim() && onCreateCustomerType ? (
                                <div className="flex flex-col items-center gap-3">
                                    <p className="text-sm text-muted-foreground text-center">
                                        לא נמצאו סוגי לקוחות תואמים.
                                    </p>
                                    <Button
                                        ref={(el) => (optionRefs.current[filteredOptions.length] = el)}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCreateCustomerType}
                                        disabled={isCreating}
                                        className={cn(
                                            "flex items-center gap-2",
                                            highlightedIndex === filteredOptions.length && "bg-primary/20"
                                        )}
                                    >
                                        {isCreating ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>יוצר...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                <span>צור סוג לקוח חדש: "{searchTerm.trim()}"</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center text-sm text-muted-foreground">
                                    לא נמצאו סוגי לקוחות תואמים.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

