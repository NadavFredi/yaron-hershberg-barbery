import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CalendarCog, FileText, Clock } from "lucide-react"

interface CustomerCommunicationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuggestNewTime: () => void
    onSendInvoice: () => void
    onReadyInMinutes: () => void
    clientName?: string
}

export const CustomerCommunicationModal: React.FC<CustomerCommunicationModalProps> = ({
    open,
    onOpenChange,
    onSuggestNewTime,
    onSendInvoice,
    onReadyInMinutes,
    clientName
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">תקשורת עם לקוח</DialogTitle>
                    <DialogDescription className="text-right">
                        {clientName ? `בחר פעולה לתקשורת עם ${clientName}` : "בחר פעולה לתקשורת עם הלקוח"}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    <Button
                        onClick={() => {
                            onSuggestNewTime()
                            onOpenChange(false)
                        }}
                        className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right hover:bg-blue-50"
                        variant="outline"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                <CalendarCog className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="text-right flex-1">
                                <div className="font-semibold">הצע זמן חדש</div>
                                <div className="text-sm text-gray-500">שלח ללקוח הצעה לזמן תור חדש</div>
                            </div>
                        </div>
                    </Button>

                    <Button
                        onClick={() => {
                            onSendInvoice()
                            onOpenChange(false)
                        }}
                        className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right hover:bg-green-50"
                        variant="outline"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                <FileText className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-right flex-1">
                                <div className="font-semibold">שלח חשבונית</div>
                                <div className="text-sm text-gray-500">שלח ללקוח חשבונית לתשלום</div>
                            </div>
                        </div>
                    </Button>

                    <Button
                        onClick={() => {
                            onReadyInMinutes()
                            onOpenChange(false)
                        }}
                        className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right hover:bg-amber-50"
                        variant="outline"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="text-right flex-1">
                                <div className="font-semibold">הלקוח יהיה מוכן בעוד X דקות</div>
                                <div className="text-sm text-gray-500">הודע ללקוח שהלקוח יהיה מוכן בקרוב</div>
                            </div>
                        </div>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

