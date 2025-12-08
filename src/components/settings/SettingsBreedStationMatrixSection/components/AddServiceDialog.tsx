import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface AddServiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    serviceName: string
    onServiceNameChange: (name: string) => void
    onAdd: () => void
    isAdding: boolean
}

export function AddServiceDialog({
    open,
    onOpenChange,
    serviceName,
    onServiceNameChange,
    onAdd,
    isAdding,
}: AddServiceDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>הוסף שירות חדש</DialogTitle>
                    <DialogDescription>הזן את שם השירות החדש</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="service-name">שם השירות</Label>
                        <Input
                            id="service-name"
                            value={serviceName}
                            onChange={(e) => onServiceNameChange(e.target.value)}
                            placeholder="לדוגמה: תספורת גברים"
                            dir="rtl"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && serviceName.trim() && !isAdding) {
                                    onAdd()
                                }
                            }}
                        />
                    </div>
                </div>
                <DialogFooter dir="ltr">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
                        ביטול
                    </Button>
                    <Button onClick={onAdd} disabled={!serviceName.trim() || isAdding}>
                        {isAdding ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                מוסיף...
                            </>
                        ) : (
                            "הוסף"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

