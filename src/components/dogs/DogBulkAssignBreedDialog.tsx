import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"

interface DogBulkAssignBreedDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    isSubmitting: boolean
    onConfirm: (breedName: string) => void
    searchBreeds: (searchTerm: string) => Promise<string[]>
}

export function DogBulkAssignBreedDialog({
    open,
    onOpenChange,
    isSubmitting,
    onConfirm,
    searchBreeds,
}: DogBulkAssignBreedDialogProps) {
    const [breedName, setBreedName] = useState("")

    const handleConfirm = () => {
        const trimmed = breedName.trim()
        if (!trimmed) return
        onConfirm(trimmed)
    }

    useEffect(() => {
        if (!open) {
            setBreedName("")
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!isSubmitting) {
                onOpenChange(next)
            }
        }}>
            <DialogContent dir="rtl" className="max-w-sm text-right">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-right">שינוי גזע לכלבים שנבחרו</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר גזע חדש שיוחל על כל הכלבים שסומנו. הפעולה תשנה את הגזע של הכלב ותעדכן את הקטגוריות שלו בהתאם.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-right">
                    <label className="flex flex-col gap-2 text-sm text-gray-700">
                        <span>בחר גזע</span>
                        <AutocompleteFilter
                            value={breedName}
                            onChange={setBreedName}
                            placeholder="הקלד שם גזע..."
                            searchFn={searchBreeds}
                            minSearchLength={0}
                            autoSearchOnFocus
                            initialLoadOnMount
                            initialResultsLimit={5}
                            className="text-right"
                        />
                    </label>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse">
                    <Button onClick={handleConfirm} disabled={isSubmitting || !breedName.trim()}>
                        {isSubmitting ? "מעדכן..." : "עדכן גזע"}
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

