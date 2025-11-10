import { type JSX, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
    CheckCircle,
    XCircle,
    Scissors,
    Bone,
    MessageSquareText,
    Clock,
    Calendar,
    Loader2,
    Edit3,
    CalendarPlus,
} from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { getAppointmentStatusBadgeConfig, type AppointmentStatusSource } from "@/utils/appointmentStatus"

// Utility function to get service name in Hebrew
const getServiceName = (service: string) => {
    switch (service.toLowerCase()) {
        case "grooming":
            return "תספורת"
        case "garden":
            return "גן"
        case "both":
            return "תספורת וגן"
        default:
            return service
    }
}

// Utility function to generate Google Calendar link
const generateGoogleCalendarLink = (appointment: CombinedAppointment) => {
    const pad = (value: number) => value.toString().padStart(2, '0')

    const formatForGoogleCalendar = (date: Date) =>
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

    const buildDateFromPieces = (date?: string, time?: string) => {
        if (!date || !time) {
            return undefined
        }

        const normalizedTime = time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time
        const parsed = new Date(`${date}T${normalizedTime}`)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    const parseDateTime = (rawDateTime?: string) => {
        if (!rawDateTime) {
            return undefined
        }

        const parsed = new Date(rawDateTime)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    const appointmentStart =
        buildDateFromPieces(appointment.date, appointment.time) ??
        parseDateTime(appointment.startDateTime) ??
        new Date()

    const appointmentEnd =
        parseDateTime(appointment.endDateTime) ??
        new Date(appointmentStart.getTime() + 60 * 60 * 1000)

    const title = `${getServiceName(appointment.service)} - ${appointment.treatmentName || "כלב"}`
    const details = appointment.notes ? `הערות: ${appointment.notes}` : ""

    const formattedStart = formatForGoogleCalendar(appointmentStart)
    const formattedEnd = formatForGoogleCalendar(appointmentEnd)

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formattedStart}/${formattedEnd}`,
        details,
        location: 'WagTime - מרכז טיפוח כלבים',
        trp: 'false',
    })

    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

interface CombinedAppointment {
    id: string
    treatmentId: string
    treatmentName: string
    date: string
    time: string
    status: string
    service: "grooming" | "garden" | "both"
    startDateTime?: string
    endDateTime?: string
    notes?: string
    groomingNotes?: string
    gardenNotes?: string
    groomingStatus?: string
    gardenStatus?: string
    stationId?: string
    groomingAppointmentId?: string
    gardenAppointmentId?: string
    latePickupRequested?: boolean
    latePickupNotes?: string
    gardenTrimNails?: boolean
    gardenBrush?: boolean
    gardenBath?: boolean
}

interface BothAppointmentCardProps {
    appointment: CombinedAppointment
    onApprove: (appointmentId: string, service: "grooming" | "garden") => Promise<void>
    onCancel: (appointmentId: string, service: "grooming" | "garden") => Promise<void>
    onUpdateNotes: (appointmentId: string, service: "grooming" | "garden", notes: string) => Promise<void>
    onBulkApprove: (params: { groomingAppointmentId: string; gardenAppointmentId: string }) => Promise<void>
    onBulkCancel: (params: { groomingAppointmentId: string; gardenAppointmentId: string }) => Promise<void>
    isApproving?: boolean
    isCancelling?: boolean
    canCancelAppointment: (appointment: CombinedAppointment) => boolean
    canEditAppointmentNotes: (appointment: CombinedAppointment) => boolean
    onManageLatePickup?: (appointment: CombinedAppointment) => void
    canManageLatePickup?: (appointment: CombinedAppointment) => boolean
    latePickupDialogTargetId?: string
    isSavingLatePickup?: boolean
}

interface ServiceDetails {
    id: string
    label: string
    icon: JSX.Element
    iconBg: string
    context: CombinedAppointment
    service: "grooming" | "garden"
    canCancel: boolean
    canEditNotes: boolean
}

export function BothAppointmentCard({
    appointment,
    onApprove,
    onCancel,
    onUpdateNotes,
    onBulkApprove,
    onBulkCancel,
    isApproving = false,
    isCancelling = false,
    canCancelAppointment,
    canEditAppointmentNotes,
    onManageLatePickup,
    canManageLatePickup,
    latePickupDialogTargetId,
    isSavingLatePickup = false,
}: BothAppointmentCardProps) {
    const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
    const [notesValue, setNotesValue] = useState<string>("")
    const [isSavingNotes, setIsSavingNotes] = useState(false)
    const [mainSection, setMainSection] = useState<string | null>(null)
    const [serviceSections, setServiceSections] = useState<string[]>([])
    const [editingNotesService, setEditingNotesService] = useState<"grooming" | "garden" | null>(null)

    useEffect(() => {
        if (mainSection !== "main") {
            setServiceSections([])
        }
    }, [mainSection])

    const statusBadgeConfig = useMemo(
        () => getAppointmentStatusBadgeConfig(appointment),
        [appointment]
    )

    const latePickupDetails = appointment.latePickupNotes?.trim() ?? ""

    const gardenExtras = useMemo(() => {
        const extras: string[] = []
        if (appointment.gardenTrimNails) {
            extras.push("גזירת ציפורניים")
        }
        if (appointment.gardenBrush) {
            extras.push("סירוק")
        }
        if (appointment.gardenBath) {
            extras.push("מקלחת")
        }
        return extras
    }, [appointment.gardenTrimNails, appointment.gardenBrush, appointment.gardenBath])

    const renderLatePickupBadge = (size: "sm" | "xs" = "sm") => {
        if (appointment.latePickupRequested === undefined) {
            return null
        }

        const className = cn(
            "border",
            size === "xs" ? "text-xs" : "text-sm",
            appointment.latePickupRequested
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
        )

        return (
            <Badge className={className}>
                {appointment.latePickupRequested ? "איסוף מאוחר" : "איסוף רגיל"}
            </Badge>
        )
    }

    const renderStatusBadge = (size: "sm" | "xs" = "sm", source?: AppointmentStatusSource) => {
        const config = source ? getAppointmentStatusBadgeConfig(source) : statusBadgeConfig
        if (!config) {
            return null
        }
        return (
            <Badge className={cn("border", size === "xs" ? "text-xs" : "text-sm", config.className)}>
                {config.label}
            </Badge>
        )
    }

    const hasBothAppointments = Boolean(appointment.groomingAppointmentId && appointment.gardenAppointmentId)

    const isApprovedStatus = (status?: string | null) => {
        if (!status) {
            return false
        }
        const normalized = status.trim().toLowerCase()
        return normalized.includes("approve") || normalized === "מאושר"
    }

    const groomingDetails = useMemo<ServiceDetails>(() => {
        const id = appointment.groomingAppointmentId ?? ""
        const context: CombinedAppointment = {
            ...appointment,
            id: id || appointment.id,
            service: "grooming",
            status: appointment.groomingStatus ?? appointment.status,
            notes: appointment.groomingNotes ?? "",
            groomingNotes: appointment.groomingNotes ?? "",
        }

        return {
            id,
            label: "תספורת",
            icon: <Scissors className="h-4 w-4 text-blue-600" />,
            iconBg: "bg-blue-100",
            context,
            service: "grooming",
            canCancel: canCancelAppointment(context),
            canEditNotes: canEditAppointmentNotes(context),
        }
    }, [appointment, canCancelAppointment, canEditAppointmentNotes])

    const gardenDetails = useMemo<ServiceDetails>(() => {
        const id = appointment.gardenAppointmentId ?? ""
        const context: CombinedAppointment = {
            ...appointment,
            id: id || appointment.id,
            service: "garden",
            status: appointment.gardenStatus ?? appointment.status,
            notes: appointment.gardenNotes ?? "",
            gardenNotes: appointment.gardenNotes ?? "",
        }

        return {
            id,
            label: "גן",
            icon: <Bone className="h-4 w-4 text-amber-600" />,
            iconBg: "bg-amber-100",
            context,
            service: "garden",
            canCancel: canCancelAppointment(context),
            canEditNotes: canEditAppointmentNotes(context),
        }
    }, [appointment, canCancelAppointment, canEditAppointmentNotes])

    const openNotesDialog = (target: CombinedAppointment, currentNotes: string) => {
        if (!target.id) {
            return
        }

        if (!canEditAppointmentNotes(target)) {
            return
        }

        if (target.service === "both") {
            console.warn("Cannot edit notes for combined appointment without specific service")
            return
        }

        setEditingNotesId(target.id)
        setEditingNotesService(target.service)
        setNotesValue(currentNotes || "")
    }

    const closeNotesDialog = () => {
        if (isSavingNotes) return
        setEditingNotesId(null)
        setEditingNotesService(null)
        setNotesValue("")
    }

    const saveNotes = async () => {
        if (!editingNotesId || !editingNotesService) return

        setIsSavingNotes(true)
        try {
            await onUpdateNotes(editingNotesId, editingNotesService, notesValue.trim())
            closeNotesDialog()
        } catch (error) {
            console.error("Failed to save notes:", error)
        } finally {
            setIsSavingNotes(false)
        }
    }

    const handleBulkApprove = async () => {
        if (!hasBothAppointments || !appointment.groomingAppointmentId || !appointment.gardenAppointmentId) {
            return
        }
        await onBulkApprove({
            groomingAppointmentId: appointment.groomingAppointmentId,
            gardenAppointmentId: appointment.gardenAppointmentId,
        })
    }

    const handleBulkCancel = async () => {
        if (!hasBothAppointments || !appointment.groomingAppointmentId || !appointment.gardenAppointmentId) {
            return
        }
        await onBulkCancel({
            groomingAppointmentId: appointment.groomingAppointmentId,
            gardenAppointmentId: appointment.gardenAppointmentId,
        })
    }

    const getServiceNotes = (service: "grooming" | "garden") => {
        if (service === "grooming") {
            return appointment.groomingNotes ?? ""
        }
        return appointment.gardenNotes ?? ""
    }

    const isBulkApproved = hasBothAppointments
        ? isApprovedStatus(appointment.groomingStatus ?? appointment.status) &&
        isApprovedStatus(appointment.gardenStatus ?? appointment.status)
        : isApprovedStatus(appointment.status)

    const renderServiceSection = (value: string, details: ServiceDetails) => {
        const service = details.service
        const serviceStatus = service === "grooming"
            ? appointment.groomingStatus ?? appointment.status
            : appointment.gardenStatus ?? appointment.status
        const isServiceApproved = isApprovedStatus(serviceStatus)
        const serviceStatusSource: AppointmentStatusSource = {
            status: serviceStatus,
            date: appointment.date,
            time: appointment.time,
            startDateTime: appointment.startDateTime,
        }
        const actionButtons = (
            <>
                {details.canCancel && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                            if (!details.id) return
                            onCancel(details.id, service)
                        }}
                        disabled={
                            !details.id ||
                            isCancelling ||
                            appointment.status === 'בוטל' ||
                            appointment.status === 'cancelled'
                        }
                    >
                        {isCancelling ? 'מבטל...' : 'בטל'}
                    </Button>
                )}

                {isServiceApproved ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        ההגעה אושרה
                    </Badge>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => {
                            if (!details.id) return
                            onApprove(details.id, service)
                        }}
                        disabled={!details.id || isApproving}
                    >
                        {isApproving ? 'מאשר הגעה...' : 'אשר הגעה'}
                    </Button>
                )}

                {details.canEditNotes && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50 flex e items-center gap-1"
                        onClick={() => openNotesDialog(details.context, getServiceNotes(service))}
                    >
                        <Edit3 className="h-4 w-4" />


                        ערוך הערות
                    </Button>
                )}

                {service === "garden" && onManageLatePickup && (!canManageLatePickup || canManageLatePickup(appointment)) && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 flex flex-row-reverse items-center gap-1"
                        onClick={() => onManageLatePickup(appointment)}
                        disabled={isSavingLatePickup && latePickupDialogTargetId === appointment.id}
                    >
                        <Clock className="h-4 w-4 text-blue-600" />
                        עדכן איסוף מאוחר
                    </Button>
                )}
            </>
        )

        return (
            <AccordionItem value={value} key={value} className="border-none">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <AccordionTrigger className="px-4 py-3 text-right text-sm font-medium hover:no-underline">
                        <div >

                            <div className="flex w-full items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {details.icon}
                                    <span className="font-medium">{details.label}</span>
                                </div>
                                {renderStatusBadge("xs", serviceStatusSource)}
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-slate-200 px-4 py-4">
                        <div className="flex items-start justify-between ">
                            <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", details.iconBg)}>
                                {details.icon}
                            </div>
                            <div className="flex-1 space-y-2 text-right mr-2 ml-4">
                                <div className="flex items-center gap-2 ">
                                    <span className="text-sm font-semibold">{details.label}</span>
                                    {renderStatusBadge("xs", serviceStatusSource)}
                                    {service === "garden" ? renderLatePickupBadge("xs") : null}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600 ">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        <span>{format(new Date(appointment.date), "dd MMM yyyy", { locale: he })}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{appointment.time}</span>
                                    </div>
                                </div>
                                {service === "garden" && gardenExtras.length > 0 && (
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        {gardenExtras.map((label) => (
                                            <Badge
                                                key={`${details.id || appointment.id}-${label}`}
                                                className="bg-amber-100 text-amber-800 border-amber-200 text-xs"
                                            >
                                                {label}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {getServiceNotes(service).trim() && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-gray-700 text-right whitespace-pre-wrap">
                                        <div className="flex items-center  gap-1  text-blue-700 text-xs font-semibold mb-1">
                                            <MessageSquareText className="h-3 w-3" />
                                            <span>הערות לתור</span>
                                        </div>
                                        {getServiceNotes(service)}
                                    </div>
                                )}
                                {service === "garden" && appointment.latePickupRequested && latePickupDetails && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800 text-right whitespace-pre-wrap">
                                        <div className="font-semibold mb-1">פרטי איסוף מאוחר</div>
                                        {latePickupDetails}
                                    </div>
                                )}
                            </div>
                            <div className="hidden flex-shrink-0 items-center gap-2 sm:flex">
                                {actionButtons}
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 sm:hidden">
                            {actionButtons}
                        </div>
                    </AccordionContent>
                </div>
            </AccordionItem>
        )
    }

    return (
        <>
            <Card className="hover:shadow-md transition-shadow bg-white" dir="rtl">
                <CardContent className="space-y-4 p-6 ">
                    <Accordion
                        type="single"
                        collapsible
                        value={mainSection ?? undefined}
                        onValueChange={(value) => setMainSection((value as string | undefined) ?? null)}
                        dir="rtl"
                    >
                        <AccordionItem value="main" className="border-none">
                            <AccordionTrigger className=" py-0 text-right hover:no-underline">
                                <div className="flex items-start justify-between w-full  ">

                                    {/* Right side - Combined service icon and content */}
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                            <div className="flex items-center gap-1">
                                                <Scissors className="h-4 w-4 text-blue-600" />
                                                <Bone className="h-4 w-4 text-amber-600" />
                                            </div>
                                        </div>
                                        {/* Content */}
                                        <div className="space-y-2 text-right mr-2 ml-6">
                                            {/* Name and status badge row */}
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-semibold">תספורת וגן - {appointment.treatmentName}</h3>
                                                {renderStatusBadge()}
                                                {renderLatePickupBadge()}
                                            </div>
                                            {/* Details row */}
                                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                <span>{format(new Date(appointment.date), "dd MMM yyyy", { locale: he })}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                <span>{appointment.time}</span>
                                            </div>
                                        </div>
                                        {gardenExtras.length > 0 && (
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                {gardenExtras.map((label) => (
                                                    <Badge
                                                        key={`${appointment.id}-main-${label}`}
                                                        className="bg-amber-100 text-amber-800 border-amber-200 text-xs"
                                                    >
                                                        {label}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                    {/* Left side - Buttons */}
                                    <div className="hidden flex-shrink-0 items-center gap-2 sm:flex px-1 ml-2">


                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                handleBulkCancel()
                                            }}
                                            disabled={
                                                !hasBothAppointments ||
                                                isCancelling ||
                                                appointment.status === 'בוטל' ||
                                                appointment.status === 'cancelled'
                                            }
                                        >
                                            {isCancelling ? 'מבטל הכל...' : 'בטל הכל'}
                                        </Button>
                                        {isBulkApproved ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                כל המפגש אושר
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                                                onClick={(event) => {
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    handleBulkApprove()
                                                }}
                                                disabled={!hasBothAppointments || isApproving}
                                            >
                                                {isApproving ? 'מאשר הגעה לכולם...' : 'אשר הגעה לכולם'}
                                            </Button>
                                        )}
                                        {/* Add to Calendar button */}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50 flex flex-row-reverse items-center gap-1"
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                globalThis.open(generateGoogleCalendarLink(appointment), '_blank')
                                            }}
                                        >
                                            הוסף ללוח השנה
                                            <CalendarPlus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                </div>
                            </AccordionTrigger>
                            <div className="mt-3 flex flex-wrap items-center  gap-2 sm:hidden">
                                {/* Add to Calendar button */}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-purple-600 hover:text-purple-700 border-purple-200 hover:bg-purple-50 flex flex-row-reverse items-center gap-1"
                                    onClick={() => window.open(generateGoogleCalendarLink(appointment), '_blank')}
                                >
                                    <CalendarPlus className="h-4 w-4" />
                                    הוסף ללוח השנה
                                </Button>
                                {isBulkApproved ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                        כל המפגש אושר
                                    </Badge>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                                        onClick={handleBulkApprove}
                                        disabled={!hasBothAppointments || isApproving}
                                    >
                                        <CheckCircle className="h-4 w-4" />
                                        {isApproving ? 'מאשר הגעה לכולם...' : 'אשר הגעה לכולם'}
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={handleBulkCancel}
                                    disabled={
                                        !hasBothAppointments ||
                                        isCancelling ||
                                        appointment.status === 'בוטל' ||
                                        appointment.status === 'cancelled'
                                    }
                                >
                                    <XCircle className="h-4 w-4" />
                                    {isCancelling ? 'מבטל הכל...' : 'בטל הכל'}
                                </Button>
                            </div>
                            <AccordionContent className="pt-4">
                                <Accordion
                                    type="multiple"
                                    value={serviceSections}
                                    onValueChange={(value) => setServiceSections(value as string[])}
                                    className="space-y-3"
                                    dir="rtl"
                                >
                                    {renderServiceSection("grooming", groomingDetails)}
                                    {renderServiceSection("garden", gardenDetails)}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Dialog open={!!editingNotesId} onOpenChange={closeNotesDialog}>
                <DialogContent dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>ערוך הערות</DialogTitle>
                        <DialogDescription>
                            הוסף או ערוך הערות עבור התור
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Textarea
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            placeholder="הכנס הערות כאן..."
                            className="min-h-[100px]"
                            dir="rtl"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={closeNotesDialog}
                            disabled={isSavingNotes}
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={saveNotes}
                            disabled={isSavingNotes}
                        >
                            {isSavingNotes ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    שומר...
                                </>
                            ) : (
                                'שמור'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
