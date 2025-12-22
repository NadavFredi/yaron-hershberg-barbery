import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { UserCircle, Users, CalendarX, Sparkles } from "lucide-react"
import { format } from "date-fns"

interface ManagerStation {
    id: string
    name: string
}

interface FinalizedDragTimes {
    startTime: Date | null
    endTime: Date | null
    stationId: string | null
}

interface AppointmentTypeSelectionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    finalizedDragTimes: FinalizedDragTimes | null
    stations?: ManagerStation[]
    onSelectPrivate: () => void
    onSelectBusiness: () => void
    onSelectConstraint?: () => void
    onSelectProposed?: () => void
    onCancel: () => void
}

export const AppointmentTypeSelectionModal: React.FC<AppointmentTypeSelectionModalProps> = ({
    open,
    onOpenChange,
    finalizedDragTimes,
    stations = [],
    onSelectPrivate,
    onSelectBusiness,
    onSelectConstraint,
    onSelectProposed,
    onCancel
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">בחירת סוג תור</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר את סוג התור שברצונך ליצור
                    </DialogDescription>
                </DialogHeader>

                {finalizedDragTimes && finalizedDragTimes.startTime && finalizedDragTimes.endTime && (
                    <div className="py-4 space-y-3">
                        <div className="bg-slate-50 rounded-lg p-3">
                            <div className="text-sm text-slate-600 text-right">
                                <div>תאריך: <span className="font-medium">{format(finalizedDragTimes.startTime, 'dd.MM.yyyy')}</span></div>
                                <div>זמן: <span className="font-medium">{format(finalizedDragTimes.startTime, 'HH:mm')} - {format(finalizedDragTimes.endTime, 'HH:mm')}</span></div>
                                <div>עמדה: <span className="font-medium">{stations.find(s => s.id === finalizedDragTimes.stationId)?.name}</span></div>
                            </div>
                        </div>

                        <Button
                            onClick={onSelectBusiness}
                            className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                            variant="outline"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-right flex-1">
                                    <div className="font-semibold">תור עסקי</div>
                                    <div className="text-sm text-gray-500">תור עם לקוח</div>
                                </div>
                            </div>
                        </Button>

                        <div className="space-y-3">
                            <Button
                                onClick={onSelectPrivate}
                                className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                                variant="outline"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
                                        <UserCircle className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="text-right flex-1">
                                        <div className="font-semibold">תור פרטי</div>
                                        <div className="text-sm text-gray-500">תור ידני עם הערות אישיות</div>
                                    </div>
                                </div>
                            </Button>



                            {onSelectProposed && (
                                <Button
                                    onClick={onSelectProposed}
                                    className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                                    variant="outline"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-lime-100">
                                            <Sparkles className="h-5 w-5 text-lime-600" />
                                        </div>
                                        <div className="text-right flex-1">
                                            <div className="font-semibold">מפגש מוצע</div>
                                            <div className="text-sm text-gray-500">שמור חלון זמן והזמן לקוחות</div>
                                        </div>
                                    </div>
                                </Button>
                            )}

                            {onSelectConstraint && (
                                <Button
                                    onClick={onSelectConstraint}
                                    className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                                    variant="outline"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100">
                                            <CalendarX className="h-5 w-5 text-orange-600" />
                                        </div>
                                        <div className="text-right flex-1">
                                            <div className="font-semibold">הוסף אילוץ</div>
                                            <div className="text-sm text-gray-500">צור אילוץ על עמדה</div>
                                        </div>
                                    </div>
                                </Button>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={onCancel}>
                                ביטול
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
