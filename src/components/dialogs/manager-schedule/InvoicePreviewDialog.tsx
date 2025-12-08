import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, CheckCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import type { ManagerAppointment } from "@/pages/ManagerSchedule/types"

interface CartItem {
    id: string
    name: string
    quantity: number
    unitPrice: number
    total: number
}

interface CartAppointmentDisplay {
    id: string
    appointmentId: string
    serviceType: "grooming" | "garden"
    appointment?: ManagerAppointment
    price: number
}

interface InvoicePreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerName: string
    cartItems: CartItem[]
    cartAppointments: CartAppointmentDisplay[]
    grandTotal: number
    isCreating: boolean
    onCreateInvoice: () => void
}

export const InvoicePreviewDialog: React.FC<InvoicePreviewDialogProps> = ({
    open,
    onOpenChange,
    customerName,
    cartItems,
    cartAppointments,
    grandTotal,
    isCreating,
    onCreateInvoice
}) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("he-IL", {
            style: "currency",
            currency: "ILS",
        }).format(amount)
    }

    const formatAppointmentTime = (appointment: ManagerAppointment) => {
        if (!appointment.startDateTime || !appointment.endDateTime) {
            return ""
        }
        const start = new Date(appointment.startDateTime)
        const end = new Date(appointment.endDateTime)
        return `${format(start, "dd.MM.yyyy HH:mm")} - ${format(end, "HH:mm")}`
    }

    const itemsTotal = cartItems.reduce((sum, item) => sum + item.total, 0)
    const appointmentsTotal = cartAppointments.reduce((sum, apt) => sum + apt.price, 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <FileText className="h-5 w-5 text-green-600" />
                        תצוגה מקדימה של חשבונית
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        פרטי החשבונית שייווצר עבור {customerName}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pl-4" dir="rtl">
                    <div className="space-y-6">
                        {/* Customer Info */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="text-sm font-semibold text-gray-900">פרטי לקוח</div>
                            <div className="text-sm text-gray-600">
                                <div>שם: {customerName}</div>
                            </div>
                        </div>

                        {/* Appointments */}
                        {cartAppointments.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-sm font-semibold text-gray-900">תורים</div>
                                <div className="space-y-2">
                                    {cartAppointments.map((cartApt) => (
                                        <div key={cartApt.id} className="border rounded-lg p-3 bg-white">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {cartApt.appointment?.serviceType === "grooming" ? "תור מספרה" : "תור גן"}
                                                    </div>
                                                    {cartApt.appointment && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {formatAppointmentTime(cartApt.appointment)}
                                                        </div>
                                                    )}
                                                    {cartApt.appointment?.dogs?.[0]?.name && (
                                                        <div className="text-xs text-gray-500">
                                                            כלב: {cartApt.appointment.dogs[0].name}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {formatCurrency(cartApt.price)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Items */}
                        {cartItems.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-sm font-semibold text-gray-900">פריטים</div>
                                <div className="space-y-2">
                                    {cartItems.map((item) => (
                                        <div key={item.id} className="border rounded-lg p-3 bg-white">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        כמות: {item.quantity} × {formatCurrency(item.unitPrice)}
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {formatCurrency(item.total)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Totals */}
                        <Separator />
                        <div className="space-y-2">
                            {cartAppointments.length > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">סה״כ תורים:</span>
                                    <span className="font-medium">{formatCurrency(appointmentsTotal)}</span>
                                </div>
                            )}
                            {cartItems.length > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">סה״כ פריטים:</span>
                                    <span className="font-medium">{formatCurrency(itemsTotal)}</span>
                                </div>
                            )}
                            <Separator />
                            <div className="flex justify-between text-lg font-bold">
                                <span>סה״כ לתשלום:</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                            <div className="font-semibold mb-1">שימו לב:</div>
                            <div>לאחר יצירת החשבונית, לא ניתן יהיה לשנות את המחירים או הפריטים.</div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse" dir="rtl">
                    <Button
                        onClick={onCreateInvoice}
                        disabled={isCreating}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                יוצר חשבונית...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4 ml-2" />
                                צור חשבונית
                            </>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isCreating}
                    >
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


