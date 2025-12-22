import { CalendarCog, Clock, Copy, DollarSign, MessageSquare, Pencil, Pin, PinOff, Receipt, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ManagerAppointment, ManagerDog } from "../../types"

interface ClientDetails {
    name: string
    classification?: string
    phone?: string
    email?: string
    recordId?: string
    recordNumber?: string
    clientId?: string
}

interface PinnedAppointmentsHook {
    isAppointmentPinned: (appointment: ManagerAppointment) => boolean
    handlePinAppointment: (appointment: ManagerAppointment) => void
    handleUnpinAppointment: (appointment: ManagerAppointment) => void
}

interface AppointmentActionsMenuProps {
    appointment: ManagerAppointment
    isProposedMeeting?: boolean
    clientName?: string | null
    primaryDog?: ManagerDog | null
    hasOrder?: boolean
    pinnedAppointmentsHook?: PinnedAppointmentsHook | null
    onEdit: () => void
    onDuplicate?: () => void
    onCancel: () => void
    onDelete: () => void
    onClientClick?: (client: ClientDetails) => void
    onOpenClientCommunication?: () => void
    onRescheduleProposal?: () => void
    onPayment?: () => void
    onShowOrder?: () => void
    onEditProposedMeeting?: () => void
    onDeleteProposedMeeting?: () => void
}

export function AppointmentActionsMenu({
    appointment,
    isProposedMeeting = false,
    clientName,
    primaryDog,
    hasOrder = false,
    pinnedAppointmentsHook,
    onEdit,
    onDuplicate,
    onCancel,
    onDelete,
    onClientClick,
    onOpenClientCommunication,
    onRescheduleProposal,
    onPayment,
    onShowOrder,
    onEditProposedMeeting,
    onDeleteProposedMeeting,
}: AppointmentActionsMenuProps) {
    const handleClick = (e: React.MouseEvent, callback?: () => void) => {
        e.stopPropagation()
        callback?.()
    }

    if (isProposedMeeting) {
        return (
            <div className="space-y-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-lime-700 hover:text-lime-800 hover:bg-lime-50"
                    onClick={(e) => handleClick(e, onEditProposedMeeting)}
                >
                    <Pencil className="h-4 w-4 ml-2" />
                    ערוך מפגש
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => handleClick(e, onDeleteProposedMeeting)}
                >
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק מפגש
                </Button>
            </div>
        )
    }

    const isPinned = pinnedAppointmentsHook?.isAppointmentPinned(appointment) ?? false

    return (
        <div className="space-y-1">
            {/* Edit & Actions Group */}
            <div className="space-y-1 pb-2 border-b border-gray-200">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-primary hover:text-purple-700 hover:bg-purple-50"
                    onClick={(e) => handleClick(e, onEdit)}
                >
                    <Pencil className="h-4 w-4 ml-2" />
                    ערוך תור
                </Button>
                {onDuplicate && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={(e) => handleClick(e, onDuplicate)}
                    >
                        <Copy className="h-4 w-4 ml-2" />
                        שכפל תור
                    </Button>
                )}
                {pinnedAppointmentsHook && (
                    isPinned ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={(e) => handleClick(e, () => pinnedAppointmentsHook.handleUnpinAppointment(appointment))}
                        >
                            <PinOff className="h-4 w-4 ml-2" />
                            הסר מסימון
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={(e) => handleClick(e, () => pinnedAppointmentsHook.handlePinAppointment(appointment))}
                        >
                            <Pin className="h-4 w-4 ml-2" />
                            סמן תור
                        </Button>
                    )
                )}
            </div>

            {/* Communication Group */}
            {clientName && onOpenClientCommunication && (
                <div className="space-y-1 pb-2 border-b border-gray-200">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                        onClick={(e) => handleClick(e, onOpenClientCommunication)}
                    >
                        <MessageSquare className="h-4 w-4 ml-2" />
                        תקשורת עם לקוח
                    </Button>
                    {(appointment.serviceType === "grooming" || appointment.serviceType === "garden") &&
                        (appointment.appointmentType === "business" || appointment.appointmentType === "private") &&
                        !appointment.isPersonalAppointment &&
                        onRescheduleProposal && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
                                onClick={(e) => handleClick(e, onRescheduleProposal)}
                            >
                                <CalendarCog className="h-4 w-4 ml-2" />
                                הצע זמן חדש
                            </Button>
                        )}
                </div>
            )}

            {/* Status & Organization Group */}
            {appointment.appointmentType !== "private" && !appointment.isPersonalAppointment && (
                <div className="space-y-1 pb-2 border-b border-gray-200">
                    {onPayment && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(e) => handleClick(e, onPayment)}
                        >
                            <DollarSign className="h-4 w-4 ml-2" />
                            תשלום
                        </Button>
                    )}
                    {hasOrder && onShowOrder && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={(e) => handleClick(e, onShowOrder)}
                        >
                            <Receipt className="h-4 w-4 ml-2" />
                            הצג הזמנה
                        </Button>
                    )}
                </div>
            )}

            {/* Destructive Actions Group */}
            <div className="space-y-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    onClick={(e) => handleClick(e, onCancel)}
                >
                    <Clock className="h-4 w-4 ml-2" />
                    בטל תור
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => handleClick(e, onDelete)}
                >
                    <Trash2 className="h-4 w-4 ml-2" />
                    מחק תור
                </Button>
            </div>
        </div>
    )
}

