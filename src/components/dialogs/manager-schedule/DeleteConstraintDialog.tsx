import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { format, addHours, startOfDay } from "date-fns"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { supabaseApi, useGetStationConstraintsQuery, useGetManagerScheduleQuery } from "@/store/services/supabaseApi"
import {
    setShowDeleteConstraintDialog,
    setConstraintToDelete,
    setConstraintToDeleteDetails,
    setDeleteFromAllStations
} from "@/store/slices/managerScheduleSlice"
import { parseISODate } from "@/pages/ManagerSchedule/managerSchedule.module"

const extractCustomReason = (notes: { text?: string } | null): string | null => {
    if (!notes?.text) return null
    const match = notes.text.match(/\[CUSTOM_REASON:([^\]]+)\]/)
    return match ? match[1] : null
}

const getConstraintDisplayReason = (reason: string | null, notes: { text?: string } | null): string => {
    if (reason) {
        const reasonLabels: Record<string, string> = {
            sick: "מחלה",
            vacation: "חופשה",
            ad_hoc: "אד-הוק",
        }
        return reasonLabels[reason] || reason
    }
    const customReason = extractCustomReason(notes)
    return customReason || "אילוץ"
}

export function DeleteConstraintDialog() {
    const dispatch = useAppDispatch()
    const { toast } = useToast()

    const open = useAppSelector((state) => state.managerSchedule.showDeleteConstraintDialog)
    const constraintToDelete = useAppSelector((state) => state.managerSchedule.constraintToDelete)
    const constraintToDeleteDetails = useAppSelector((state) => state.managerSchedule.constraintToDeleteDetails)
    const deleteFromAllStations = useAppSelector((state) => state.managerSchedule.deleteFromAllStations)
    const selectedDate = useAppSelector((state) => state.managerSchedule.selectedDate)
    const selectedDateStr = format(new Date(selectedDate), 'yyyy-MM-dd')
    const serviceFilter = useAppSelector((state) => state.managerSchedule.serviceFilter)

    const { data: scheduleData } = useGetManagerScheduleQuery({
        date: selectedDateStr,
        serviceType: serviceFilter
    }, { skip: !selectedDateStr })

    const stations = scheduleData?.stations || []

    const { data: constraints = [] } = useGetStationConstraintsQuery(
        { date: selectedDateStr },
        { skip: !selectedDateStr }
    )

    const handleClose = () => {
        dispatch(setShowDeleteConstraintDialog(false))
        dispatch(setConstraintToDelete(null))
        dispatch(setConstraintToDeleteDetails(null))
        dispatch(setDeleteFromAllStations(true))
    }

    const handleDelete = async () => {
        if (!constraintToDelete) return

        try {
            let constraintIdsToDelete: string[] = [constraintToDelete]

            // If deleting from all stations and there are related constraints
            if (deleteFromAllStations && constraintToDeleteDetails && constraintToDeleteDetails.relatedConstraints.length > 1) {
                constraintIdsToDelete = constraintToDeleteDetails.relatedConstraints.map(c => c.id)
            }

            const { error } = await supabase
                .from("station_unavailability")
                .delete()
                .in("id", constraintIdsToDelete)

            if (error) throw error

            toast({
                title: "הצלחה",
                description: deleteFromAllStations && constraintIdsToDelete.length > 1
                    ? `האילוץ נמחק מ-${constraintIdsToDelete.length} עמדות בהצלחה`
                    : "האילוץ נמחק בהצלחה",
            })

            // RTK Query will automatically refetch constraints and manager schedule when tags are invalidated
            dispatch(supabaseApi.util.invalidateTags(["Constraints", "ManagerSchedule"]))
            dispatch(setConstraintToDelete(null))
            dispatch(setConstraintToDeleteDetails(null))
            dispatch(setShowDeleteConstraintDialog(false))
            dispatch(setDeleteFromAllStations(true))
        } catch (error) {
            console.error("Error deleting constraint:", error)
            toast({
                title: "שגיאה",
                description: "לא ניתן למחוק את האילוץ",
                variant: "destructive",
            })
        }
    }

    // Get constraint details - either from details or from constraints list
    const constraint = constraintToDeleteDetails?.constraint || constraints.find(c => c.id === constraintToDelete)
    
    if (!open || !constraint) {
        return null
    }

    const stationNames = constraintToDeleteDetails?.stationNames ||
        [stations.find((s: any) => s.id === constraint.station_id)?.name].filter((n): n is string => Boolean(n))
    const startDate = parseISODate(constraint.start_time)
    const endDate = parseISODate(constraint.end_time)
    const reasonText = getConstraintDisplayReason(constraint.reason, constraint.notes)
    const notesText = constraint.notes?.text?.replace(/\[CUSTOM_REASON:[^\]]+\]\s?/, "") || ""

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    handleClose()
                } else {
                    dispatch(setShowDeleteConstraintDialog(true))
                }
            }}
        >
            <DialogContent className="max-w-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">מחיקת אילוץ</DialogTitle>
                    <DialogDescription className="text-right">
                        האם אתה בטוח שברצונך למחוק את האילוץ?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Constraint Details */}
                    <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-gray-600">עמדות:</Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {stationNames.map((name, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm text-gray-600">סיבה:</Label>
                                <p className="text-sm font-medium mt-1">{reasonText || "-"}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm text-gray-600">תאריך ושעה התחלה:</Label>
                                <p className="text-sm font-medium mt-1">
                                    {startDate ? format(startDate, "dd/MM/yyyy HH:mm") : "-"}
                                </p>
                            </div>
                            <div>
                                <Label className="text-sm text-gray-600">תאריך ושעה סיום:</Label>
                                <p className="text-sm font-medium mt-1">
                                    {endDate ? format(endDate, "dd/MM/yyyy HH:mm") : "-"}
                                </p>
                            </div>
                        </div>

                        {notesText && (
                            <div>
                                <Label className="text-sm text-gray-600">הערות:</Label>
                                <p className="text-sm mt-1">{notesText}</p>
                            </div>
                        )}
                    </div>

                    {/* Multi-station selection */}
                    {stationNames.length > 1 && (
                        <div className="space-y-3 border rounded-lg p-4">
                            <Label className="text-base font-semibold">אפשרויות מחיקה:</Label>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="delete-all"
                                        checked={deleteFromAllStations}
                                        onCheckedChange={(checked) => dispatch(setDeleteFromAllStations(checked === true))}
                                    />
                                    <Label htmlFor="delete-all" className="cursor-pointer text-sm">
                                        מחק מכל העמדות ({stationNames.length} עמדות)
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="delete-current"
                                        checked={!deleteFromAllStations}
                                        onCheckedChange={(checked) => dispatch(setDeleteFromAllStations(checked !== true))}
                                    />
                                    <Label htmlFor="delete-current" className="cursor-pointer text-sm">
                                        מחק רק מהעמדה הנוכחית ({stations.find((s: any) => s.id === constraint.station_id)?.name || stationNames[0]})
                                    </Label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-start gap-2">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                    >
                        מחק
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                    >
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

