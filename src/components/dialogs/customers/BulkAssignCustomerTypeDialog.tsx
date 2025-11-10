import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface CustomerTypeOption {
    id: string
    name: string
}

interface BulkAssignCustomerTypeDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedType: string | "none" | null
    onSelectedTypeChange: (value: string | "none" | null) => void
    customerTypes: CustomerTypeOption[]
    isProcessing: boolean
    onConfirm: () => void
}

export function BulkAssignCustomerTypeDialog({
    open,
    onOpenChange,
    selectedType,
    onSelectedTypeChange,
    customerTypes,
    isProcessing,
    onConfirm,
}: BulkAssignCustomerTypeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="max-w-sm text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">עדכון סוג לקוח מרובה</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את סוג הלקוח שיוקצה לכל הלקוחות שנבחרו.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-right">
                    <Label className="text-sm text-right">סוג לקוח</Label>
                    <Select
                        value={selectedType ?? undefined}
                        onValueChange={(value) => onSelectedTypeChange((value ?? null) as "none" | string | null)}
                    >
                        <SelectTrigger dir="rtl" className="text-right">
                            <SelectValue placeholder="בחר סוג לקוח" />
                        </SelectTrigger>
                        <SelectContent dir="rtl" className="text-right">
                            <SelectItem value="none">ללא סוג</SelectItem>
                            {customerTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                    {type.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={onConfirm} disabled={isProcessing || selectedType === null}>
                        {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        שמור
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (!isProcessing) {
                                onOpenChange(false)
                            }
                        }}
                        disabled={isProcessing}
                    >
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

