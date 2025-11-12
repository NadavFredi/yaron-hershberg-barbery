import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import { TreatmentSelectInput, type Treatment } from "@/components/TreatmentSelectInput"

interface AddTreatmentCustomerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export const AddTreatmentCustomerModal: React.FC<AddTreatmentCustomerModalProps> = ({
    open,
    onOpenChange,
    onSuccess
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null)

    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedTreatment(null)
        }
    }, [open])

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
        setSelectedTreatment(null) // Reset treatment selection when customer changes
    }

    const handleTreatmentSelect = (treatment: Treatment) => {
        setSelectedTreatment(treatment)
    }

    const handleClearCustomer = () => {
        setSelectedCustomer(null)
        setSelectedTreatment(null)
    }

    const handleClearTreatment = () => {
        setSelectedTreatment(null)
    }

    const handleTreatmentCreated = (treatmentId: string) => {
        // When a treatment is successfully created via TreatmentSelectInput
        // Close the modal and notify parent
        console.log("✅ [AddTreatmentCustomerModal] Treatment created:", treatmentId)
        onOpenChange(false)
        onSuccess?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="sm:max-w-[600px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">הוסף לקוח</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר או צור לקוח, ולאחר מכן בחר או צור פרופיל שירות
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Customer Selection */}
                    <div className="space-y-2">
                        <CustomerSearchInput
                            selectedCustomer={selectedCustomer}
                            onCustomerSelect={handleCustomerSelect}
                            onCustomerClear={handleClearCustomer}
                            label="חיפוש לקוח"
                            placeholder="חיפוש לפי שם, טלפון או אימייל..."
                        />
                    </div>

                    {/* Treatment Selection - only shown when customer is selected */}
                    {selectedCustomer && (
                        <div className="space-y-2">
                            <TreatmentSelectInput
                                selectedCustomer={selectedCustomer}
                                selectedTreatment={selectedTreatment}
                                onTreatmentSelect={handleTreatmentSelect}
                                onTreatmentClear={handleClearTreatment}
                                onTreatmentCreated={handleTreatmentCreated}
                                label="בחירת לקוח"
                                placeholder="בחר לקוח או הוסף חדש"
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
