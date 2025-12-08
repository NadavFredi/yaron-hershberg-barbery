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

interface BulkBreedsCategoriesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    isProcessing: boolean
    dogCategories: Option[]
    onConfirm: (params: {
        categoryIds: string[]
    }) => void
}

export function BulkBreedsCategoriesDialog({
    open,
    onOpenChange,
    isProcessing,
    dogCategories,
    onConfirm,
}: BulkBreedsCategoriesDialogProps) {
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])

    useEffect(() => {
        if (!open) {
            setSelectedCategoryIds([])
        }
    }, [open])

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
            categoryIds: selectedCategoryIds,
        })
    }

    return (
        <Dialog open={open} onOpenChange={(value) => !isProcessing && onOpenChange(value)}>
            <DialogContent dir="rtl" className="max-w-xl text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">עדכון קטגוריות מרובות</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את הקטגוריות שייושמו על כל הגזעים שנבחרו. השארת הבחירה ריקה תנקה את הקטגוריות.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    <div className="space-y-3 border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">קטגוריה</Label>
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                            {dogCategories.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-right">לא קיימות קטגוריות במערכת.</p>
                            ) : (
                                dogCategories.map((category) => (
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
                                            disabled={isProcessing}
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
                                disabled={isProcessing || selectedCategoryIds.length === 0}
                            >
                                נקה בחירה
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleConfirm} disabled={isProcessing}>
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

