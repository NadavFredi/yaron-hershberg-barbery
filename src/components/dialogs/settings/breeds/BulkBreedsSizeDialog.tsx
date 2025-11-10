import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

type BreedSize = "small" | "medium" | "medium_large" | "large"

interface BulkBreedsSizeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    isProcessing: boolean
    onConfirm: (sizeClass: BreedSize | null) => void
}

const SIZE_OPTIONS: Array<{ value: BreedSize | "none"; label: string }> = [
    { value: "small", label: "קטן" },
    { value: "medium", label: "בינוני" },
    { value: "medium_large", label: "בינוני-גדול" },
    { value: "large", label: "גדול" },
    { value: "none", label: "ללא (נקה גודל)" },
]

export function BulkBreedsSizeDialog({ open, onOpenChange, isProcessing, onConfirm }: BulkBreedsSizeDialogProps) {
    const [selectedSize, setSelectedSize] = useState<BreedSize | "none" | "">("")

    useEffect(() => {
        if (!open) {
            setSelectedSize("")
        }
    }, [open])

    const handleConfirm = () => {
        if (!selectedSize) return
        if (selectedSize === "none") {
            onConfirm(null)
        } else {
            onConfirm(selectedSize)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(value) => !isProcessing && onOpenChange(value)}>
            <DialogContent dir="rtl" className="max-w-sm text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">עדכון גודל גזע מרובה</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את גודל הגזע שיוחל על כל הגזעים שנבחרו. ניתן גם לנקות את הגודל.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label className="text-sm">בחר גודל</Label>
                        <Select value={selectedSize} onValueChange={setSelectedSize} disabled={isProcessing}>
                            <SelectTrigger dir="rtl">
                                <SelectValue placeholder="בחר גודל..." />
                            </SelectTrigger>
                            <SelectContent dir="rtl" className="text-right">
                                {SIZE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleConfirm} disabled={isProcessing || !selectedSize}>
                        {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        עדכן
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

