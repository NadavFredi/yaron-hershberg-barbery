import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface Option {
    id: string
    name: string
}

interface BulkTreatmentTypesCategoriesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    isProcessing: boolean
    treatmentTypes: Option[]
    treatmentCategories: Option[]
    onConfirm: (params: {
        applyTypes: boolean
        typeIds: string[]
        applyCategories: boolean
        categoryIds: string[]
    }) => void
}

export function BulkTreatmentTypesCategoriesDialog({
    open,
    onOpenChange,
    isProcessing,
    treatmentTypes,
    treatmentCategories,
    onConfirm,
}: BulkTreatmentTypesCategoriesDialogProps) {
    const [applyTypes, setApplyTypes] = useState(true)
    const [applyCategories, setApplyCategories] = useState(true)
    const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

    useEffect(() => {
        if (!open) {
            setApplyTypes(true)
            setApplyCategories(true)
            setSelectedTypeIds([])
            setSelectedCategoryIds([])
        }
    }, [open])

    const toggleTypeId = (id: string, checked: boolean) => {
        setSelectedTypeIds((prev) => {
            if (checked) {
                if (prev.includes(id)) return prev
                return [...prev, id]
            }
            return prev.filter((value) => value !== id)
        })
    }

    const toggleCategoryId = (id: string, checked: boolean) => {
        setSelectedCategoryIds((prev) => {
            if (checked) {
                if (prev.includes(id)) return prev
                return [...prev, id]
            }
            return prev.filter((value) => value !== id)
        })
    }

    const handleConfirm = () => {
        onConfirm({
            applyTypes,
            typeIds: selectedTypeIds,
            applyCategories,
            categoryIds: selectedCategoryIds,
        })
    }

    return (
        <Dialog open={open} onOpenChange={(value) => !isProcessing && onOpenChange(value)}>
            <DialogContent dir="rtl" className="max-w-xl text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">עדכון קטגוריות מרובות</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את קטגוריות 1 וקטגוריות 2 שייושמו על כל הגזעים שנבחרו. השארת הבחירה ריקה תנקה את הקטגוריות.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2 md:grid-cols-2">
                    <div className="space-y-3 border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">קטגוריה 1</Label>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>עדכן</span>
                                <Checkbox
                                    checked={applyTypes}
                                    onCheckedChange={(checked) => setApplyTypes(checked === true)}
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                            {treatmentTypes.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-right">לא קיימות קטגוריות 1 במערכת.</p>
                            ) : (
                                treatmentTypes.map((type) => (
                                    <label
                                        key={type.id}
                                        className="flex items-center justify-between gap-2 cursor-pointer text-sm"
                                    >
                                        <span>{type.name}</span>
                                        <Checkbox
                                            checked={selectedTypeIds.includes(type.id)}
                                            onCheckedChange={(checked) => toggleTypeId(type.id, checked === true)}
                                            disabled={!applyTypes || isProcessing}
                                        />
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTypeIds([])}
                                disabled={!applyTypes || isProcessing || selectedTypeIds.length === 0}
                            >
                                נקה בחירה
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3 border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">קטגוריה 2</Label>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>עדכן</span>
                                <Checkbox
                                    checked={applyCategories}
                                    onCheckedChange={(checked) => setApplyCategories(checked === true)}
                                    disabled={isProcessing}
                                />
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                            {treatmentCategories.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-right">לא קיימות קטגוריות 2 במערכת.</p>
                            ) : (
                                treatmentCategories.map((category) => (
                                    <label
                                        key={category.id}
                                        className="flex items-center justify-between gap-2 cursor-pointer text-sm"
                                    >
                                        <span>{category.name}</span>
                                        <Checkbox
                                            checked={selectedCategoryIds.includes(category.id)}
                                            onCheckedChange={(checked) =>
                                                toggleCategoryId(category.id, checked === true)
                                            }
                                            disabled={!applyCategories || isProcessing}
                                        />
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCategoryIds([])}
                                disabled={!applyCategories || isProcessing || selectedCategoryIds.length === 0}
                            >
                                נקה בחירה
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleConfirm} disabled={isProcessing || (!applyTypes && !applyCategories)}>
                        {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        שמור
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

