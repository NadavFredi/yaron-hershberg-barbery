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

interface AddBreedDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    breedName: string
    onBreedNameChange: (name: string) => void
    onAdd: () => void
    isAdding: boolean
}

export function AddBreedDialog({
    open,
    onOpenChange,
    breedName,
    onBreedNameChange,
    onAdd,
    isAdding
}: AddBreedDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">הוסף גזע</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader className="items-start text-right">
                    <DialogTitle>הוסף גזע חדש</DialogTitle>
                    <DialogDescription>הכנס שם גזע חדש להוספה למערכת</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-breed-name" className="text-right">שם הגזע</Label>
                        <Input
                            id="new-breed-name"
                            value={breedName}
                            onChange={(e) => onBreedNameChange(e.target.value)}
                            placeholder="הכנס שם גזע"
                            dir="rtl"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && breedName.trim()) {
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
                    <Button onClick={onAdd} disabled={isAdding || !breedName.trim()}>
                        {isAdding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        הוסף
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

