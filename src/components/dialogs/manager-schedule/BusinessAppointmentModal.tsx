import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useCreateManagerAppointmentMutation } from "@/store/services/supabaseApi"
import {
    AppointmentDetailsSection,
    type AppointmentStation,
    type AppointmentTimes
} from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { useToast } from "@/hooks/use-toast"
import { type Customer, CustomerSearchInput } from "@/components/CustomerSearchInput"
import { useServices } from "@/hooks/useServices"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type ManagerStation = AppointmentStation

type FinalizedDragTimes = AppointmentTimes



interface BusinessAppointmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    finalizedDragTimes: FinalizedDragTimes | null
    stations?: ManagerStation[]
    onCancel: () => void
    onSuccess?: () => void
    prefillCustomer?: Customer | null
}

export const BusinessAppointmentModal: React.FC<BusinessAppointmentModalProps> = ({
    open,
    onOpenChange,
    finalizedDragTimes,
    stations = [],
    onCancel,
    onSuccess,
    prefillCustomer = null,
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
    const [appointmentTimes, setAppointmentTimes] = useState<FinalizedDragTimes | null>(() => finalizedDragTimes ? {
        startTime: finalizedDragTimes.startTime ? new Date(finalizedDragTimes.startTime) : null,
        endTime: finalizedDragTimes.endTime ? new Date(finalizedDragTimes.endTime) : null,
        stationId: finalizedDragTimes.stationId ?? null
    } : null)
    const [createManagerAppointment, { isLoading: isCreatingAppointment }] = useCreateManagerAppointmentMutation()
    const { toast } = useToast()
    const { data: services = [], isLoading: isLoadingServices } = useServices()



    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedServiceId(null)
        }
    }, [open])

    useEffect(() => {
        if (open && prefillCustomer) {
            setSelectedCustomer(prefillCustomer)
        }
    }, [open, prefillCustomer])


    useEffect(() => {
        if (finalizedDragTimes) {
            const endTime = finalizedDragTimes.endTime ? new Date(finalizedDragTimes.endTime) : null
            setAppointmentTimes({
                startTime: finalizedDragTimes.startTime ? new Date(finalizedDragTimes.startTime) : null,
                endTime: endTime,
                stationId: finalizedDragTimes.stationId ?? null
            })
        } else {
            setAppointmentTimes(null)
        }
    }, [finalizedDragTimes])




    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
    }

    const handleClearCustomer = () => {
        setSelectedCustomer(null)
    }

    const handleTimesUpdate = (times: FinalizedDragTimes) => {
        setAppointmentTimes((prev) => {
            const next: FinalizedDragTimes = {
                startTime: times.startTime ? new Date(times.startTime) : prev?.startTime ?? null,
                endTime: times.endTime ? new Date(times.endTime) : prev?.endTime ?? null,
                stationId: times.stationId ?? prev?.stationId ?? null
            }

            // Maintain current duration when start time changes
            if (prev?.startTime && prev?.endTime && next.startTime && next.startTime.getTime() !== prev.startTime.getTime()) {
                const currentDuration = prev.endTime.getTime() - prev.startTime.getTime()
                next.endTime = new Date(next.startTime.getTime() + currentDuration)
            }

            return next
        })
    }


    const canCreateAppointment = Boolean(
        selectedCustomer &&
        selectedServiceId &&
        appointmentTimes?.startTime &&
        appointmentTimes?.endTime
    )

    const handleCreateBusinessAppointment = async () => {
        if (!canCreateAppointment || !appointmentTimes?.startTime || !appointmentTimes?.endTime || !selectedCustomer || !selectedServiceId) {
            return
        }

        try {
            await createManagerAppointment({
                name: selectedCustomer.fullName || 'Unknown',
                stationId: appointmentTimes.stationId || '',
                selectedStations: appointmentTimes.stationId ? [appointmentTimes.stationId] : [],
                startTime: appointmentTimes.startTime.toISOString(),
                endTime: appointmentTimes.endTime.toISOString(),
                appointmentType: "business",
                customerId: selectedCustomer.id,
                serviceId: selectedServiceId,
                isManualOverride: true
            }).unwrap()

            // Close the modal and reset form
            onOpenChange(false)
            setSelectedCustomer(null)
            setSelectedServiceId(null)
            setAppointmentTimes(null)
            onSuccess?.()

        } catch (error) {
            console.error('Failed to create business appointment:', error)

            // Extract user-friendly error message
            const { getErrorMessage, getErrorDescription } = await import("@/utils/errorMessages")
            const errorMessage = getErrorMessage(error, "אירעה שגיאה בעת יצירת התור העסקי")
            const errorDescription = getErrorDescription(error)

            toast({
                title: "שגיאה ביצירת התור העסקי",
                description: errorDescription || errorMessage,
                variant: "destructive",
            })
        }
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right">יצירת תור עסקי</DialogTitle>
                    <DialogDescription className="text-right">
                        צור תור עסקי עם לקוח
                    </DialogDescription>
                </DialogHeader>

                {appointmentTimes && (
                    <div className="py-4">
                        <AppointmentDetailsSection
                            isOpen={open}
                            finalizedTimes={appointmentTimes}
                            stations={stations}
                            onTimesChange={handleTimesUpdate}
                            theme="blue"
                            endTimeMode="editable"
                            hideSaveCancelButtons={true}
                            disableEndTime={false}
                        >
                        </AppointmentDetailsSection>

                        <div className="space-y-4">
                            <CustomerSearchInput
                                selectedCustomer={selectedCustomer}
                                onCustomerSelect={handleCustomerSelect}
                                onCustomerClear={handleClearCustomer}
                            />

                            <div className="space-y-2">
                                <Label htmlFor="service-select">שירות</Label>
                                <Select
                                    value={selectedServiceId || ""}
                                    onValueChange={(value) => setSelectedServiceId(value || null)}
                                    disabled={isLoadingServices}
                                >
                                    <SelectTrigger id="service-select" dir="rtl">
                                        <SelectValue placeholder={isLoadingServices ? "טוען שירותים..." : "בחר שירות"} />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {services.map((service) => (
                                            <SelectItem key={service.id} value={service.id}>
                                                {service.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}


                <DialogFooter dir="ltr">
                    <Button variant="outline" onClick={onCancel}>
                        ביטול
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={!canCreateAppointment || isCreatingAppointment}
                        onClick={handleCreateBusinessAppointment}
                    >
                        {isCreatingAppointment ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                יוצר תור...
                            </>
                        ) : (
                            "צור תור עסקי"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
