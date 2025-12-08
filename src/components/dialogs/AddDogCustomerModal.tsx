import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import { DogSelectInput, type Dog } from "@/components/DogSelectInput"

interface AddDogCustomerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export const AddDogCustomerModal: React.FC<AddDogCustomerModalProps> = ({
    open,
    onOpenChange,
    onSuccess
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedDog, setSelectedDog] = useState<Dog | null>(null)

    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedDog(null)
        }
    }, [open])

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
        setSelectedDog(null) // Reset dog selection when customer changes
    }

    const handleDogSelect = (dog: Dog) => {
        setSelectedDog(dog)
    }

    const handleClearCustomer = () => {
        setSelectedCustomer(null)
        setSelectedDog(null)
    }

    const handleClearDog = () => {
        setSelectedDog(null)
    }

    const handleDogCreated = (dogId: string) => {
        // When a dog is successfully created via DogSelectInput
        // Close the modal and notify parent
        console.log("✅ [AddDogCustomerModal] Dog created:", dogId)
        onOpenChange(false)
        onSuccess?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} dir="rtl">
            <DialogContent className="sm:max-w-[600px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">הוסף כלב</DialogTitle>
                    <DialogDescription className="text-right">
                        בחר או צור לקוח, ולאחר מכן בחר או צור כלב
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

                    {/* Dog Selection - only shown when customer is selected */}
                    {selectedCustomer && (
                        <div className="space-y-2">
                            <DogSelectInput
                                selectedCustomer={selectedCustomer}
                                selectedDog={selectedDog}
                                onDogSelect={handleDogSelect}
                                onDogClear={handleClearDog}
                                onDogCreated={handleDogCreated}
                                label="בחירת כלב"
                                placeholder="בחר כלב או הוסף חדש"
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
