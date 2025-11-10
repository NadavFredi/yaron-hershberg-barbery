import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react"

interface Station {
    id: string
    name: string
    is_active: boolean
}

interface DeleteStationDialogProps {
    deleteConfirmOpen: boolean
    onDeleteConfirmChange: (open: boolean) => void
    transferDialogOpen: boolean
    onTransferDialogChange: (open: boolean) => void
    station: Station | null
    stations: Station[]
    onConfirmDelete: () => void
    onTransferAndDelete: (targetStationId: string) => Promise<void>
}

export function DeleteStationDialog({
    deleteConfirmOpen,
    onDeleteConfirmChange,
    transferDialogOpen,
    onTransferDialogChange,
    station,
    stations,
    onConfirmDelete,
    onTransferAndDelete,
}: DeleteStationDialogProps) {
    const [transferTargetStationId, setTransferTargetStationId] = useState<string>("")

    useEffect(() => {
        if (!transferDialogOpen) {
            setTransferTargetStationId("")
        }
    }, [transferDialogOpen])

    const handleTransferAndDelete = async () => {
        if (transferTargetStationId) {
            await onTransferAndDelete(transferTargetStationId)
            setTransferTargetStationId("")
        }
    }

    return (
        <>
            {/* Delete Station Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={onDeleteConfirmChange}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>מחק עמדה?</AlertDialogTitle>
                        <AlertDialogDescription>
                            האם אתה בטוח שברצונך למחוק את העמדה "{station?.name}"?
                            <br />
                            <br />
                            פעולה זו תמחק את העמדה לצמיתות. לפני המחיקה, תצטרך להעביר את כל התורים הקיימים לעמדה אחרת.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => onDeleteConfirmChange(false)}>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={onConfirmDelete}>המשך</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Transfer Appointments Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={(open) => {
                onTransferDialogChange(open)
                if (!open) {
                    setTransferTargetStationId("")
                }
            }}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">העברת תורים</DialogTitle>
                        <DialogDescription className="text-right">
                            בחר עמדה יעד להעברת כל התורים מהעמדה "{station?.name}"
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="transfer-target" className="text-right">עמדה יעד <span className="text-red-500">*</span></Label>
                            <Select value={transferTargetStationId} onValueChange={setTransferTargetStationId}>
                                <SelectTrigger id="transfer-target" className="w-full text-right">
                                    <SelectValue placeholder="בחר עמדה..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {stations
                                        .filter((s) => s.id !== station?.id && s.is_active)
                                        .map((station) => (
                                            <SelectItem key={station.id} value={station.id}>
                                                {station.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-start gap-2">
                        <Button variant="outline" onClick={() => onTransferDialogChange(false)}>
                            ביטול
                        </Button>
                        <Button onClick={handleTransferAndDelete} disabled={!transferTargetStationId}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            מחק והעבר תורים
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

