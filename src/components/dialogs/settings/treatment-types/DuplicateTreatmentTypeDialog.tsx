import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Loader2, Copy, X, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface TreatmentType {
    id: string
    name: string
}

interface Option {
    id: string
    name: string
}

interface MultiSelectDropdownProps {
    options: Option[]
    selectedIds: string[]
    onSelectionChange: (selectedIds: string[]) => void
    placeholder?: string
    className?: string
}

function MultiSelectDropdown({
    options,
    selectedIds,
    onSelectionChange,
    placeholder = "בחר...",
    className
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false)
    const [searchValue, setSearchValue] = useState<string | undefined>(undefined)
    const anchorRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleToggle = (optionId: string) => {
        if (selectedIds.includes(optionId)) {
            onSelectionChange(selectedIds.filter(id => id !== optionId))
        } else {
            onSelectionChange([...selectedIds, optionId])
        }
    }

    const selectedOptions = options.filter(opt => selectedIds.includes(opt.id))
    const filteredOptions = options.filter(opt => {
        if (!searchValue || searchValue === "") return true
        return opt.name.toLowerCase().includes(searchValue.toLowerCase())
    })

    const showBadges = selectedOptions.length > 0 && (searchValue === undefined || searchValue === "")

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div
                    ref={anchorRef}
                    className={cn(
                        "relative flex-1 min-h-8 border border-input bg-background rounded-md",
                        "flex flex-wrap items-center gap-1 px-2 py-1.5 text-sm",
                        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                        className
                    )}
                    onClick={() => {
                        inputRef.current?.focus()
                        if (!open) {
                            setOpen(true)
                        }
                    }}
                    dir="rtl"
                >
                    {showBadges ? (
                        <>
                            {selectedOptions.map((option) => (
                                <Badge
                                    key={option.id}
                                    variant="secondary"
                                    className="text-xs h-6 px-2 flex items-center gap-1"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggle(option.id)
                                    }}
                                >
                                    <span>{option.name}</span>
                                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" />
                                </Badge>
                            ))}
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchValue || ""}
                                onChange={(e) => {
                                    setSearchValue(e.target.value)
                                    if (!open) {
                                        setOpen(true)
                                    }
                                }}
                                onFocus={() => {
                                    if (searchValue === undefined) {
                                        setSearchValue("")
                                    }
                                    if (!open) {
                                        setOpen(true)
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Backspace" && searchValue === "") {
                                        if (selectedOptions.length > 0) {
                                            const lastOption = selectedOptions[selectedOptions.length - 1]
                                            handleToggle(lastOption.id)
                                        }
                                    }
                                }}
                                placeholder={selectedOptions.length === 0 ? placeholder : ""}
                                className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-right"
                                dir="rtl"
                            />
                        </>
                    ) : (
                        <Input
                            ref={inputRef}
                            value={searchValue || ""}
                            onChange={(e) => {
                                setSearchValue(e.target.value)
                                if (!open) {
                                    setOpen(true)
                                }
                            }}
                            onFocus={() => {
                                if (searchValue === undefined) {
                                    setSearchValue("")
                                }
                                if (!open) {
                                    setOpen(true)
                                }
                            }}
                            placeholder={placeholder}
                            dir="rtl"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto px-0 text-right"
                        />
                    )}
                    <button
                        type="button"
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-500 flex-shrink-0"
                        onMouseDown={(event) => {
                            event.preventDefault()
                            const nextOpen = !open
                            setOpen(nextOpen)
                            if (nextOpen && searchValue === undefined) {
                                setSearchValue("")
                            } else if (!nextOpen) {
                                setSearchValue(undefined)
                            }
                        }}
                    >
                        <ChevronDown className="h-4 w-4" />
                    </button>
                    {selectedOptions.length > 0 && (
                        <button
                            type="button"
                            className="absolute left-10 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                            onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                onSelectionChange([])
                            }}
                            title="נקה את כל הבחירות"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </PopoverAnchor>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                dir="rtl"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onEscapeKeyDown={() => {
                    setOpen(false)
                    setSearchValue(undefined)
                }}
                onInteractOutside={(event) => {
                    if (anchorRef.current?.contains(event.target as Node)) {
                        event.preventDefault()
                        return
                    }
                    setOpen(false)
                    setSearchValue(undefined)
                }}
            >
                <div className="max-h-[300px] overflow-y-auto">
                    {selectedOptions.length > 0 && (
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b">
                            נבחרו: {selectedOptions.map(opt => opt.name).join(", ")}
                        </div>
                    )}
                    <div className="p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => handleToggle(option.id)}
                                    className="flex items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                >
                                    <Check
                                        className={cn(
                                            "ml-2 h-4 w-4 shrink-0",
                                            selectedIds.includes(option.id) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span>{option.name}</span>
                                </div>
                            ))
                        ) : (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                לא נמצאו תוצאות.
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

interface DuplicateTreatmentTypeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    treatmentType: TreatmentType | null
    treatmentTypes: TreatmentType[] // List of all treatmentTypes for selection
    onConfirm: (params: {
        mode: "new" | "existing"
        name?: string // Only for "new" mode
        targetTreatmentTypeIds?: string[] // Only for "existing" mode - multiple treatmentTypes
        copyDetails: boolean
        copyStationRelations: boolean
    }) => Promise<void>
    isDuplicating?: boolean
}

export function DuplicateTreatmentTypeDialog({
    open,
    onOpenChange,
    treatmentType,
    treatmentTypes,
    onConfirm,
    isDuplicating = false,
}: DuplicateTreatmentTypeDialogProps) {
    const [mode, setMode] = useState<"new" | "existing">("new")
    const [duplicateTreatmentTypeName, setDuplicateTreatmentTypeName] = useState("")
    const [targetTreatmentTypeIds, setTargetTreatmentTypeIds] = useState<string[]>([])
    const [copyDetails, setCopyDetails] = useState(true)
    const [copyStationRelations, setCopyStationRelations] = useState(true)

    // Filter out the treatmentType being duplicated from the list
    const availableTreatmentTypes = treatmentTypes.filter(b => b.id !== treatmentType?.id).map(b => ({ id: b.id, name: b.name }))

    useEffect(() => {
        if (open && treatmentType) {
            setDuplicateTreatmentTypeName(`${treatmentType.name} (עותק)`)
            setMode("new")
            setTargetTreatmentTypeIds([])
            setCopyDetails(true)
            setCopyStationRelations(true)
        }
    }, [open, treatmentType])

    const handleClose = () => {
        if (!isDuplicating) {
            setDuplicateTreatmentTypeName("")
            setTargetTreatmentTypeIds([])
            setCopyDetails(true)
            setCopyStationRelations(true)
            setMode("new")
            onOpenChange(false)
        }
    }

    const handleConfirm = async () => {
        if (mode === "new" && !duplicateTreatmentTypeName.trim()) {
            return
        }
        if (mode === "existing" && targetTreatmentTypeIds.length === 0) {
            return
        }

        await onConfirm({
            mode,
            name: mode === "new" ? duplicateTreatmentTypeName.trim() : undefined,
            targetTreatmentTypeIds: mode === "existing" ? targetTreatmentTypeIds : undefined,
            copyDetails,
            copyStationRelations,
        })

        setDuplicateTreatmentTypeName("")
        setTargetTreatmentTypeIds([])
        setCopyDetails(true)
        setCopyStationRelations(true)
        setMode("new")
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>שכפל גזע?</DialogTitle>
                    <DialogDescription className="text-right">
                        האם אתה בטוח שברצונך לשכפל את הגזע "{treatmentType?.name}"?
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Mode Selection */}
                    <div className="space-y-3">
                        <Label className="text-right font-semibold">איך ברצונך לשכפל?</Label>
                        <RadioGroup value={mode} onValueChange={(value) => setMode(value as "new" | "existing")} dir="rtl">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="new" id="mode-new" />
                                <Label htmlFor="mode-new" className="cursor-pointer">
                                    יצירת גזע חדש
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="existing" id="mode-existing" />
                                <Label htmlFor="mode-existing" className="cursor-pointer">
                                    העתק לגזע קיים
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* New TreatmentType Name (only for "new" mode) */}
                    {mode === "new" && (
                        <div className="space-y-2">
                            <Label htmlFor="duplicate-treatmentType-name" className="text-right">שם הגזע החדש</Label>
                            <Input
                                id="duplicate-treatmentType-name"
                                value={duplicateTreatmentTypeName}
                                onChange={(e) => setDuplicateTreatmentTypeName(e.target.value)}
                                placeholder="הכנס שם גזע"
                                dir="rtl"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && duplicateTreatmentTypeName.trim()) {
                                        handleConfirm()
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Existing TreatmentType Selection (only for "existing" mode) */}
                    {mode === "existing" && (
                        <div className="space-y-2">
                            <Label htmlFor="target-treatmentTypes" className="text-right">בחר גזעים קיימים</Label>
                            <MultiSelectDropdown
                                options={availableTreatmentTypes}
                                selectedIds={targetTreatmentTypeIds}
                                onSelectionChange={setTargetTreatmentTypeIds}
                                placeholder="בחר גזעים..."
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Copy Options (only for "existing" mode) */}
                    {mode === "existing" && (
                        <div className="space-y-3 border-t pt-3">
                            <Label className="text-right font-semibold">מה להעתיק?</Label>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <Checkbox
                                    id="copy-details"
                                    checked={copyDetails}
                                    onCheckedChange={(checked) => setCopyDetails(checked === true)}
                                />
                                <Label htmlFor="copy-details" className="cursor-pointer text-sm">
                                    העתק פרטי גזע בלבד (מחירים, הערות, סיווג, קטגוריות)
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <Checkbox
                                    id="copy-station-relations"
                                    checked={copyStationRelations}
                                    onCheckedChange={(checked) => setCopyStationRelations(checked === true)}
                                />
                                <Label htmlFor="copy-station-relations" className="cursor-pointer text-sm">
                                    העתק גם קשרים עם עמדות
                                </Label>
                            </div>
                        </div>
                    )}

                    {/* Station Relations Checkbox (only for "new" mode) */}
                    {mode === "new" && (
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox
                                id="duplicate-station-relations"
                                checked={copyStationRelations}
                                onCheckedChange={(checked) => setCopyStationRelations(checked === true)}
                            />
                            <Label htmlFor="duplicate-station-relations" className="cursor-pointer text-sm">
                                אני רוצה לשכפל גם את הקשרים עם העמדות
                            </Label>
                        </div>
                    )}
                </div>
                <DialogFooter className="sm:justify-start gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={isDuplicating}>
                        ביטול
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={
                            isDuplicating ||
                            (mode === "new" && !duplicateTreatmentTypeName.trim()) ||
                            (mode === "existing" && targetTreatmentTypeIds.length === 0)
                        }
                    >
                        {isDuplicating && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        <Copy className="h-4 w-4 ml-2" />
                        שכפל
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

