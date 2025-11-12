import { useState, useEffect, useMemo } from 'react'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, X, Plus, Pencil } from "lucide-react"
import { useListOwnerTreatmentsQuery } from "@/store/services/supabaseApi"
import { cn } from "@/lib/utils"
import { AddTreatmentDialog } from "@/components/AddTreatmentDialog"
import { EditTreatmentDialog } from "@/components/EditTreatmentDialog"

export interface Treatment {
    id: string
    name: string
    treatmentType: string
    size: string
    isSmall: boolean
    ownerId: string
}

interface TreatmentSelectInputProps {
    selectedCustomer: { id: string; recordId?: string } | null
    selectedTreatment: Treatment | null
    onTreatmentSelect: (treatment: Treatment) => void
    onTreatmentClear: () => void
    disabled?: boolean
    label?: string
    placeholder?: string
    onTreatmentCreated?: (treatmentId: string) => void
    className?: string
}

export function TreatmentSelectInput({
    selectedCustomer,
    selectedTreatment,
    onTreatmentSelect,
    onTreatmentClear,
    disabled = false,
    label = "בחירת טיפול",
    placeholder = "בחר טיפול",
    onTreatmentCreated,
    className,
}: TreatmentSelectInputProps) {
    const [cachedTreatments, setCachedTreatments] = useState<Treatment[]>([])
    const [isAddTreatmentDialogOpen, setIsAddTreatmentDialogOpen] = useState(false)
    const [isEditTreatmentDialogOpen, setIsEditTreatmentDialogOpen] = useState(false)

    const ownerId = selectedCustomer?.recordId || selectedCustomer?.id || ""

    // Fetch treatments for selected customer
    const { data: treatmentsData, isLoading: isLoadingTreatments, refetch: refetchTreatments } = useListOwnerTreatmentsQuery(
        ownerId,
        { skip: !ownerId }
    )

    useEffect(() => {
        if (treatmentsData?.treatments) {
            setCachedTreatments(treatmentsData.treatments)
        }
    }, [treatmentsData])

    useEffect(() => {
        if (!ownerId) {
            setCachedTreatments([])
        }
    }, [ownerId])

    // Extract treatments from API responses
    const treatments = useMemo(() => treatmentsData?.treatments ?? cachedTreatments, [treatmentsData, cachedTreatments])

    const handleTreatmentSelect = (treatmentId: string) => {
        if (treatmentId === "__add_new__") {
            setIsAddTreatmentDialogOpen(true)
            return
        }
        const treatment = treatments.find(d => d.id === treatmentId)
        if (treatment) {
            onTreatmentSelect(treatment)
        }
    }

    if (!selectedCustomer) {
        return (
            <div className={className}>
                <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>
                <div className="text-sm text-gray-500 text-right">
                    יש לבחור לקוח תחילה
                </div>
            </div>
        )
    }

    if (isLoadingTreatments) {
        return (
            <div className={className}>
                <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="mr-2 text-sm text-gray-500">טוען טיפולים...</span>
                </div>
            </div>
        )
    }

    return (
        <div className={className}>
            <Label className="text-sm font-medium text-gray-700 mb-2 text-right block">{label}</Label>

            {treatments.length === 0 ? (
                <div className="space-y-2">
                    <div className="text-sm text-gray-500 text-right">
                        ללקוח זה אין טיפולים רשומים
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddTreatmentDialogOpen(true)}
                        className="w-full text-right"
                        disabled={disabled}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        הוסף טיפול חדש
                    </Button>
                </div>
            ) : (
                <div className="relative">
                    <Select
                        dir="rtl"
                        value={selectedTreatment?.id || ""}
                        onValueChange={handleTreatmentSelect}
                        disabled={disabled}
                    >
                        <SelectTrigger
                            dir="rtl"
                            className={cn(
                                "relative w-full text-right transition-colors justify-start  gap-2 pr-4 pl-10 [&>svg:last-of-type]:hidden",
                                selectedTreatment ? "border-green-300 bg-green-50" : "",
                                !selectedTreatment && "pr-10"
                            )}
                        >
                            <SelectValue
                                dir="rtl"
                                className="flex-1 text-right"
                                placeholder={placeholder}
                            />
                            {!selectedTreatment && (
                                <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-4 w-4 text-gray-400"
                                    >
                                        <path fill="none" d="M0 0h24v24H0z" />
                                        <path d="M7 10l5 5 5-5z" />
                                    </svg>
                                </span>
                            )}
                        </SelectTrigger>
                        <SelectContent
                            dir="rtl"
                            align="end"
                            sideOffset={4}
                            className="text-right"
                        >
                            {treatments.map((treatment) => (
                                <SelectItem key={treatment.id} value={treatment.id} className="text-right" dir="rtl">
                                    <div className="flex flex-row-reverse items-center gap-2 justify-between w-full">
                                        <div className="text-right flex-1">
                                            <div className="font-medium">{treatment.name}</div>
                                            <div className="text-xs text-gray-500">{treatment.treatmentType} • {treatment.size}</div>
                                        </div>
                                        <Sparkles className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    </div>
                                </SelectItem>
                            ))}
                            <div className="border-t border-gray-200 my-1" />
                            <SelectItem value="__add_new__" className="text-right">
                                <div className="flex items-center gap-2 justify-end w-full text-blue-600">
                                    <Plus className="h-4 w-4" />
                                    <span className="font-medium">הוסף טיפול חדש</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {selectedTreatment && (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 z-10">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setIsEditTreatmentDialogOpen(true)
                                }}
                                className="p-1 hover:bg-green-100 rounded transition-colors"
                                disabled={disabled}
                                title="ערוך טיפול"
                            >
                                <Pencil className="h-4 w-4 text-green-600" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    onTreatmentClear()
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
            )}

            {/* Add Treatment Dialog */}
            <AddTreatmentDialog
                open={isAddTreatmentDialogOpen}
                onOpenChange={setIsAddTreatmentDialogOpen}
                customerId={ownerId}
                onSuccess={async (treatmentId) => {
                    console.log("✅ [TreatmentSelectInput] Treatment created:", treatmentId)
                    // Refetch treatments list and select the newly created treatment
                    try {
                        const result = await refetchTreatments()
                        if (result.data?.treatments) {
                            const newTreatment = result.data.treatments.find(d => d.id === treatmentId)
                            if (newTreatment) {
                                onTreatmentSelect(newTreatment)
                            }
                        }
                    } catch (error) {
                        console.error("Error refetching treatments:", error)
                    }
                    // Notify parent if callback provided
                    onTreatmentCreated?.(treatmentId)
                }}
            />

            {/* Edit Treatment Dialog */}
            <EditTreatmentDialog
                open={isEditTreatmentDialogOpen}
                onOpenChange={setIsEditTreatmentDialogOpen}
                treatmentId={selectedTreatment?.id || null}
                onSuccess={async () => {
                    console.log("✅ [TreatmentSelectInput] Treatment updated")
                    // Refetch treatments list to get updated data
                    try {
                        const result = await refetchTreatments()
                        if (result.data?.treatments && selectedTreatment) {
                            const updatedTreatment = result.data.treatments.find(d => d.id === selectedTreatment.id)
                            if (updatedTreatment) {
                                onTreatmentSelect(updatedTreatment)
                            }
                        }
                    } catch (error) {
                        console.error("Error refetching treatments:", error)
                    }
                }}
            />
        </div>
    )
}
