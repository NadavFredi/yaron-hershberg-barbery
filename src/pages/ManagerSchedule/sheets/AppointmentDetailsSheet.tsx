import { format, differenceInMinutes } from "date-fns"
import { MoreHorizontal, Pencil, Clock, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ManagerAppointment, ManagerTreatment } from "@/types/managerSchedule"

const SERVICE_LABELS: Record<string, string> = {
    grooming: "מספרה",
    garden: "גן",
}

const SERVICE_STYLES: Record<string, { badge: string }> = {
    grooming: {
        badge: "border-blue-200 bg-blue-100 text-blue-800",
    },
    garden: {
        badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    },
}

const STATUS_STYLE_MAP = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-slate-50 text-slate-700",
}

const getStatusStyle = (status: string, appointment?: ManagerAppointment): string => {
    const normalized = status.toLowerCase()

    if (
        normalized.includes("cancel") ||
        normalized.includes("בוטל") ||
        normalized.includes("מבוטל") ||
        normalized.includes("לא הגיע")
    ) {
        return STATUS_STYLE_MAP.danger
    }

    if (
        normalized.includes("pending") ||
        normalized.includes("ממתין") ||
        normalized.includes("בהמתנה") ||
        normalized.includes("מחכה")
    ) {
        return STATUS_STYLE_MAP.warning
    }

    if (
        normalized.includes("confirm") ||
        normalized.includes("מאושר") ||
        normalized.includes("הושלם") ||
        normalized.includes("מאשר")
    ) {
        // For trial garden appointments, use amber colors instead of emerald
        if (appointment?.serviceType === "garden" && appointment?.gardenIsTrial) {
            return "border-amber-200 bg-amber-50 text-amber-700"
        }
        return STATUS_STYLE_MAP.success
    }

    return STATUS_STYLE_MAP.info
}

interface ClientDetails {
    name: string
    classification?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    preferences?: string
    recordId?: string
    recordNumber?: string
}

interface AppointmentDetailsSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedAppointment: ManagerAppointment | null
    onTreatmentClick: (treatment: ManagerTreatment) => void
    onClientClick: (client: ClientDetails) => void
    onEditAppointment: (appointment: ManagerAppointment) => void
    onCancelAppointment: (appointment: ManagerAppointment) => void
    onDeleteAppointment: (appointment: ManagerAppointment) => void
    isLoading?: boolean
}

export const AppointmentDetailsSheet = ({
    open,
    onOpenChange,
    selectedAppointment,
    onTreatmentClick,
    onClientClick,
    onEditAppointment,
    onCancelAppointment,
    onDeleteAppointment,
    isLoading = false,
}: AppointmentDetailsSheetProps) => {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full max-w-md overflow-y-auto" dir="rtl">
                <SheetHeader>
                    <SheetTitle className="text-right">פרטי תור</SheetTitle>
                    <SheetDescription className="text-right">צפו בכל הפרטים על התור, הלקוח והפרופיל המשויך.</SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">טוען פרטי תור...</p>
                        </div>
                    </div>
                ) : selectedAppointment ? (() => {
                    const detailStart = new Date(selectedAppointment.startDateTime)
                    const detailEnd = new Date(selectedAppointment.endDateTime)
                    const detailDate = format(detailStart, "dd.MM.yyyy")
                    const detailTimeRange = `${format(detailStart, "HH:mm")} - ${format(detailEnd, "HH:mm")}`
                    const duration = selectedAppointment.durationMinutes ??
                        Math.max(1, differenceInMinutes(detailEnd, detailStart))
                    const serviceLabel = selectedAppointment.appointmentType === "private"
                        ? "תור פרטי"
                        : (selectedAppointment.serviceName ?? SERVICE_LABELS[selectedAppointment.serviceType])
                    const serviceStyle = selectedAppointment.appointmentType === "private"
                        ? { badge: "border-purple-200 bg-purple-100 text-purple-800" }
                        : SERVICE_STYLES[selectedAppointment.serviceType]
                    const statusStyle = getStatusStyle(selectedAppointment.status, selectedAppointment)
                    const primaryTreatment = selectedAppointment.treatments[0]
                    const clientName =
                        selectedAppointment.clientName ?? primaryTreatment?.clientName ?? "לא ידוע"
                    const classification =
                        selectedAppointment.clientClassification ?? primaryTreatment?.clientClassification ?? "לא ידוע"
                    const subscriptionName = selectedAppointment.subscriptionName
                    const clientEmail = selectedAppointment.clientEmail
                    const clientPhone = selectedAppointment.clientPhone

                    return (
                        <div className="mt-6 space-y-6 text-right">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className={cn("text-[11px] font-medium", serviceStyle.badge)}>
                                            {serviceLabel}
                                        </Badge>
                                        {selectedAppointment.serviceType !== "garden" && (
                                            <Badge variant="outline" className={cn("text-[11px] font-medium", statusStyle)}>
                                                {selectedAppointment.status}
                                            </Badge>
                                        )}
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-1" align="end">
                                            <div className="space-y-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => onEditAppointment(selectedAppointment)}
                                                >
                                                    <Pencil className="h-4 w-4 ml-2" />
                                                    ערוך תור
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                    onClick={() => onCancelAppointment(selectedAppointment)}
                                                >
                                                    <Clock className="h-4 w-4 ml-2" />
                                                    בטל תור
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => onDeleteAppointment(selectedAppointment)}
                                                >
                                                    <Trash2 className="h-4 w-4 ml-2" />
                                                    מחק תור
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <div>
                                        תאריך: <span className="font-medium text-gray-900">{detailDate}</span>
                                    </div>
                                    <div>
                                        שעה: <span className="font-medium text-gray-900">{detailTimeRange}</span>
                                    </div>
                                    <div>
                                        משך: <span className="font-medium text-gray-900">{duration} דקות</span>
                                    </div>
                                    <div>
                                        עמדה: <span className="font-medium text-gray-900">{selectedAppointment.stationName || "לא משויך"}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-900">פרופילים בתור</h3>
                                <div className="space-y-3">
                                    {selectedAppointment.treatments.map((treatment) => (
                                        <div
                                            key={treatment.id}
                                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                                        >
                                            <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                                                <button
                                                    type="button"
                                                    onClick={() => onTreatmentClick(treatment)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                >
                                                    {treatment.name}
                                                </button>
                                                {treatment.treatmentType ? <span className="text-xs text-gray-600">{treatment.treatmentType}</span> : null}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-600">
                                                סיווג: <span className="font-medium text-gray-700">{treatment.clientClassification ?? classification}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2 text-sm text-gray-600">
                                <h3 className="text-sm font-medium text-gray-900">פרטי לקוח</h3>
                                <div>
                                    שם: <button
                                        type="button"
                                        onClick={() => onClientClick({
                                            name: clientName,
                                            classification: classification,
                                            phone: selectedAppointment.clientPhone,
                                            email: selectedAppointment.clientEmail,
                                            recordId: selectedAppointment.recordId,
                                            recordNumber: selectedAppointment.recordNumber
                                        })}
                                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                    >
                                        {clientName}
                                    </button>
                                </div>
                                <div>
                                    סיווג: <span className="font-medium text-gray-900">{classification}</span>
                                </div>
                                {clientEmail ? (
                                    <div>
                                        דוא"ל: <span className="font-medium text-gray-900">{clientEmail}</span>
                                    </div>
                                ) : null}
                                {clientPhone ? (
                                    <div>
                                        טלפון: <span className="font-medium text-gray-900">{clientPhone}</span>
                                    </div>
                                ) : null}
                            </div>

                            {subscriptionName ? (
                                <>
                                    <Separator />
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <h3 className="text-sm font-medium text-gray-900">כרטיסייה</h3>
                                        <div className="font-medium text-gray-900">{subscriptionName}</div>
                                    </div>
                                </>
                            ) : null}

                            {selectedAppointment.notes ? (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-gray-900">הערות ובקשות לתור</h3>
                                        <p className="whitespace-pre-wrap text-sm text-gray-600">{selectedAppointment.notes}</p>
                                    </div>
                                </>
                            ) : null}

                            {selectedAppointment.internalNotes ? (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-blue-900">הערות צוות פנימי</h3>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <p className="whitespace-pre-wrap text-sm text-blue-800">{selectedAppointment.internalNotes}</p>
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {selectedAppointment.serviceType === "garden" ? (
                                <>
                                    <Separator />
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <h3 className="text-sm font-medium text-gray-900">פרטי גן</h3>
                                        <div>
                                            איסוף מאוחר: {" "}
                                            <span className="font-medium text-gray-900">
                                                {selectedAppointment.latePickupRequested ? "כן" : "לא"}
                                            </span>
                                        </div>
                                        {selectedAppointment.latePickupNotes ? (
                                            <div>
                                                הערות איסוף: {" "}
                                                <span className="font-medium text-gray-900">{selectedAppointment.latePickupNotes}</span>
                                            </div>
                                        ) : null}
                                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-slate-200",
                                                    selectedAppointment.gardenTrimNails
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-slate-100 text-slate-600"
                                                )}
                                            >
                                                גזירת ציפורניים {selectedAppointment.gardenTrimNails ? "✓" : "✕"}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-slate-200",
                                                    selectedAppointment.gardenBrush
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-slate-100 text-slate-600"
                                                )}
                                            >
                                                סירוק {selectedAppointment.gardenBrush ? "✓" : "✕"}
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-slate-200",
                                                    selectedAppointment.gardenBath
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-slate-100 text-slate-600"
                                                )}
                                            >
                                                רחצה {selectedAppointment.gardenBath ? "✓" : "✕"}
                                            </Badge>
                                        </div>
                                    </div>
                                </>
                            ) : null}

                            {/* Record Information */}
                            {(selectedAppointment.recordId || selectedAppointment.recordNumber) && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-medium text-gray-900">פרטי רשומה</h3>
                                        <div className="text-xs text-gray-500 space-y-1">
                                            {selectedAppointment.recordId && (
                                                <div>מזהה רשומה: <span className="font-mono text-gray-700">{selectedAppointment.recordId}</span></div>
                                            )}
                                            {selectedAppointment.recordNumber && (
                                                <div>מספר רשומה: <span className="font-mono text-gray-700">{selectedAppointment.recordNumber}</span></div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })() : null}
            </SheetContent>
        </Sheet>
    )
}
