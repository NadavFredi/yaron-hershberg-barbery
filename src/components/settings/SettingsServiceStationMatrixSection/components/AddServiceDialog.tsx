import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

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
    isAdding
}: AddServiceDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">הוסף שירות</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>הוסף שירות חדש</DialogTitle>
                    <DialogDescription>הכנס שם שירות חדש להוספה למערכת</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-service-name" className="text-right">שם השירות</Label>
                        <Input
                            id="new-service-name"
                            value={serviceName}
                            onChange={(e) => onServiceNameChange(e.target.value)}
                            placeholder="הכנס שם שירות"
                            dir="rtl"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && serviceName.trim()) {
                                    onAdd()
                                }
                            }}
                        />
                    </div>
                </div>
                <div className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse flex">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>
                        ביטול
                    </Button>
                    <Button onClick={onAdd} disabled={isAdding || !serviceName.trim()}>
                        {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        הוסף
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
