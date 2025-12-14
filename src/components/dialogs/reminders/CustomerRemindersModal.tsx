import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import SentRemindersTable from "@/components/reminders/SentRemindersTable"

interface CustomerRemindersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    customerName: string
}

export const CustomerRemindersModal: React.FC<CustomerRemindersModalProps> = ({
    open,
    onOpenChange,
    customerId,
    customerName
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[75vw] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">תזכורות של {customerName}</DialogTitle>
                    <DialogDescription className="text-right">
                        צפה בכל התזכורות שנשלחו ללקוח זה
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <SentRemindersTable
                        customerId={customerId}
                        hideColumns={{
                            breed: true,
                            flowId: true,
                            customerCategory: true
                        }}
                        onNavigateToAppointment={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}

