import React, { useEffect, useState, useMemo } from 'react'
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
import { useServiceCategories } from "@/hooks/useServiceCategories"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { AutocompleteFilter } from "@/components/AutocompleteFilter"

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
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
    const [serviceInputValue, setServiceInputValue] = useState<string>("")
    const [appointmentTimes, setAppointmentTimes] = useState<FinalizedDragTimes | null>(() => finalizedDragTimes ? {
        startTime: finalizedDragTimes.startTime ? new Date(finalizedDragTimes.startTime) : null,
        endTime: finalizedDragTimes.endTime ? new Date(finalizedDragTimes.endTime) : null,
        stationId: finalizedDragTimes.stationId ?? null
    } : null)
    const [createManagerAppointment, { isLoading: isCreatingAppointment }] = useCreateManagerAppointmentMutation()
    const { toast } = useToast()
    const { data: services = [], isLoading: isLoadingServices } = useServices()
    const { data: categories = [], isLoading: isLoadingCategories } = useServiceCategories()



    // Filter services by selected category
    const filteredServices = useMemo(() => {
        if (!selectedCategoryId) {
            return services
        }
        return services.filter((service) => service.service_category_id === selectedCategoryId)
    }, [services, selectedCategoryId])

    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedServiceId(null)
            setSelectedCategoryId(null)
            setServiceInputValue("")
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

    // Search function for AutocompleteFilter
    const searchServices = (term: string): Promise<string[]> => {
        if (!filteredServices.length) {
            return Promise.resolve([])
        }

        const needle = term.trim().toLowerCase()
        if (!needle) {
            return Promise.resolve(filteredServices.slice(0, 10).map((service) => service.name))
        }

        return Promise.resolve(
            filteredServices
                .filter((service) => service.name.toLowerCase().includes(needle))
                .slice(0, 10)
                .map((service) => service.name)
        )
    }

    const handleServiceSelect = (serviceName: string) => {
        setServiceInputValue(serviceName)
        const service = filteredServices.find((s) => s.name === serviceName)
        if (service) {
            setSelectedServiceId(service.id)
        } else {
            setSelectedServiceId(null)
        }
    }

    const handleCategoryChange = (categoryId: string | null) => {
        setSelectedCategoryId(categoryId)
        // Clear service selection when category changes
        setSelectedServiceId(null)
        setServiceInputValue("")
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
                                <Label htmlFor="service-category-select">קטגוריית שירות (אופציונלי)</Label>
                                <Select
                                    value={selectedCategoryId || "none"}
                                    onValueChange={(value) => handleCategoryChange(value === "none" ? null : value)}
                                    disabled={isLoadingCategories}
                                >
                                    <SelectTrigger id="service-category-select" dir="rtl">
                                        <SelectValue placeholder={isLoadingCategories ? "טוען קטגוריות..." : "כל הקטגוריות"} />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="none">כל הקטגוריות</SelectItem>
                                        {categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="service-select">שירות</Label>
                                <AutocompleteFilter
                                    value={serviceInputValue}
                                    onChange={(value) => {
                                        setServiceInputValue(value)
                                        if (!value.trim()) {
                                            setSelectedServiceId(null)
                                            return
                                        }
                                    }}
                                    onSelect={handleServiceSelect}
                                    placeholder={isLoadingServices ? "טוען שירותים..." : "הקלידו את שם השירות..."}
                                    className="w-full"
                                    searchFn={searchServices}
                                    minSearchLength={1}
                                    debounceMs={150}
                                    initialLoadOnMount
                                    initialResultsLimit={10}
                                />
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
