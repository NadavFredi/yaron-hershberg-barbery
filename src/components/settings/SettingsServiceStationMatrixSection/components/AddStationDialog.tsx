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

interface AddStationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    stationName: string
    onStationNameChange: (name: string) => void
    onAdd: () => void
    isAdding: boolean
}

export function AddStationDialog({
    open,
    onOpenChange,
    stationName,
    onStationNameChange,
    onAdd,
    isAdding
}: AddStationDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">הוסף עמדה</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>הוסף עמדה חדשה</DialogTitle>
                    <DialogDescription>הכנס שם עמדה חדשה להוספה למערכת</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-station-name" className="text-right">שם העמדה</Label>
                        <Input
                            id="new-station-name"
                            value={stationName}
                            onChange={(e) => onStationNameChange(e.target.value)}
                            placeholder="הכנס שם עמדה"
                            dir="rtl"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && stationName.trim()) {
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
                    <Button onClick={onAdd} disabled={isAdding || !stationName.trim()}>
                        {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        הוסף
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

