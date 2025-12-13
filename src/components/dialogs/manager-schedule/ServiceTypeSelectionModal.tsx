import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Scissors, Flower2 } from "lucide-react"

interface ServiceTypeSelectionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelectGrooming: () => void
    onSelectGarden: () => void
}

export const ServiceTypeSelectionModal: React.FC<ServiceTypeSelectionModalProps> = ({
    open,
    onOpenChange,
    onSelectGrooming,
    onSelectGarden
}) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">בחר סוג שירות</DialogTitle>
                    <DialogDescription className="text-right">
                        לאיזה סוג שירות ברצונך ליצור תור?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    <Button
                        onClick={() => {
                            onSelectGrooming()
                            onOpenChange(false)
                        }}
                        className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                        variant="outline"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                <Scissors className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="text-right flex-1">
                                <div className="font-semibold">תור מספרה</div>
                                <div className="text-sm text-gray-500">ניהול תור למספרת לקוחות</div>
                            </div>
                        </div>
                    </Button>

                    <Button
                        onClick={() => {
                            onSelectGarden()
                            onOpenChange(false)
                        }}
                        className="w-full h-auto p-4 flex items-center justify-start gap-3 text-right"
                        variant="outline"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                <Flower2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-right flex-1">
                                <div className="font-semibold">תור</div>
                                <div className="text-sm text-gray-500">ניהול תור</div>
                            </div>
                        </div>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

