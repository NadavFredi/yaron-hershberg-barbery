import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { addMinutes } from "date-fns"
import { useCreateManagerAppointmentMutation } from "@/store/services/supabaseApi"
import { AppointmentDetailsSection, type AppointmentStation, type AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import { ServiceSelectInput } from "@/components/ServiceSelectInput"
import type { Treatment } from "@/components/TreatmentSelectInput"
import type { Service } from "@/hooks/useServices"
import { supabase } from "@/integrations/supabase/client"

type ManagerStation = AppointmentStation

type FinalizedDragTimes = AppointmentTimes

type DurationStatus = 'idle' | 'checking' | 'supported' | 'unsupported' | 'error'


interface BusinessAppointmentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    finalizedDragTimes: FinalizedDragTimes | null
    stations?: ManagerStation[]
    onCancel: () => void
    onSuccess?: () => void
    prefillCustomer?: Customer | null
    prefillTreatment?: Treatment | null
}

export const BusinessAppointmentModal: React.FC<BusinessAppointmentModalProps> = ({
    open,
    onOpenChange,
    finalizedDragTimes,
    stations = [],
    onCancel,
    onSuccess,
    prefillCustomer = null,
    prefillTreatment: _prefillTreatment = null
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedService, setSelectedService] = useState<Service | null>(null)
    const [appointmentTimes, setAppointmentTimes] = useState<FinalizedDragTimes | null>(() => finalizedDragTimes ? {
        startTime: finalizedDragTimes.startTime ? new Date(finalizedDragTimes.startTime) : null,
        endTime: finalizedDragTimes.endTime ? new Date(finalizedDragTimes.endTime) : null,
        stationId: finalizedDragTimes.stationId ?? null
    } : null)
    const [durationStatus, setDurationStatus] = useState<DurationStatus>('idle')
    const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
    const [durationMessage, setDurationMessage] = useState<string | null>(null)
    const [isManualOverride, setIsManualOverride] = useState(false)
    const [originalEndTime, setOriginalEndTime] = useState<Date | null>(null)

    const [createManagerAppointment, { isLoading: isCreatingAppointment }] = useCreateManagerAppointmentMutation()
    const { toast } = useToast()

    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedService(null)
            setIsManualOverride(false)
            setOriginalEndTime(null)
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
            // Store the original end time for manual override restoration
            setOriginalEndTime(endTime)
        } else {
            setAppointmentTimes(null)
            setOriginalEndTime(null)
        }
    }, [finalizedDragTimes])

    const activeStation = useMemo(() => {
        if (!appointmentTimes?.stationId) {
            return null
        }
        return stations.find((station) => station.id === appointmentTimes.stationId) ?? null
    }, [stations, appointmentTimes?.stationId])

    useEffect(() => {
        if (!selectedService || !appointmentTimes?.stationId) {
            setDurationStatus('idle')
            setDurationMinutes(null)
            setDurationMessage(null)
            return
        }

        let isCancelled = false

        const fetchServiceConfiguration = async () => {
            setDurationStatus('checking')
            setDurationMinutes(null)
            setDurationMessage(null)

            const { data, error } = await supabase
                .from('service_station_matrix')
                .select('base_time_minutes, is_active')
                .eq('service_id', selectedService.id)
                .eq('station_id', appointmentTimes.stationId)
                .maybeSingle()

            if (isCancelled) {
                return
            }

            if (error) {
                console.error('[BusinessAppointmentModal] Failed to load service configuration:', error)
                setDurationStatus('error')
                setDurationMinutes(null)
                setDurationMessage('לא ניתן לבדוק את משך השירות בעמדה זו.')
                return
            }

            if (!data) {
                const stationLabel = activeStation?.name ?? 'העמדה שנבחרה'
                setDurationStatus('unsupported')
                setDurationMinutes(null)
                setDurationMessage(`השירות "${selectedService.name}" לא מוגדר לעמדה "${stationLabel}".`)
                return
            }

            if (!data.is_active) {
                const stationLabel = activeStation?.name ?? 'העמדה שנבחרה'
                setDurationStatus('unsupported')
                setDurationMinutes(null)
                setDurationMessage(`השירות "${selectedService.name}" אינו פעיל לעמדה "${stationLabel}".`)
                return
            }

            const minutes = typeof data.base_time_minutes === 'number' ? data.base_time_minutes : null
            if (minutes == null) {
                setDurationStatus('error')
                setDurationMinutes(null)
                setDurationMessage('הוגדר משך לא תקין לשירות בעמדה זו.')
                return
            }

            setDurationStatus('supported')
            setDurationMinutes(minutes)
            setDurationMessage(null)
        }

        fetchServiceConfiguration()

        return () => {
            isCancelled = true
        }
    }, [selectedService?.id, selectedService?.name, appointmentTimes?.stationId, activeStation?.name])

    const startTimeKey = appointmentTimes?.startTime ? appointmentTimes.startTime.getTime() : null

    useEffect(() => {
        if (durationStatus !== 'supported' || durationMinutes == null || startTimeKey == null) {
            return
        }

        setAppointmentTimes((prev) => {
            if (!prev?.startTime) {
                return prev
            }

            const expectedEnd = addMinutes(prev.startTime, durationMinutes)
            const prevEnd = prev.endTime?.getTime()

            if (prevEnd === expectedEnd.getTime()) {
                return prev
            }

            return {
                ...prev,
                endTime: expectedEnd
            }
        })
    }, [durationStatus, durationMinutes, startTimeKey])

    useEffect(() => {
        if (durationStatus === 'unsupported' || durationStatus === 'error') {
            setAppointmentTimes((prev) => {
                if (!prev || prev.endTime === null) {
                    return prev
                }
                return {
                    ...prev,
                    endTime: null
                }
            })
        }
    }, [durationStatus])

    // Handle manual override checkbox changes
    useEffect(() => {
        if (isManualOverride && originalEndTime) {
            // Restore the original end time when manual override is enabled
            setAppointmentTimes((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    endTime: new Date(originalEndTime)
                }
            })
        } else if (!isManualOverride && (durationStatus === 'unsupported' || durationStatus === 'error')) {
            // Clear the end time when manual override is disabled and the service is not supported
            setAppointmentTimes((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
                    endTime: null
                }
            })
        }
    }, [isManualOverride, originalEndTime, durationStatus])

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer)
        setSelectedService(null)
    }

    const handleClearCustomer = () => {
        setSelectedCustomer(null)
        setSelectedService(null)
    }

    const handleTimesUpdate = (times: FinalizedDragTimes) => {
        setAppointmentTimes((prev) => {
            const next: FinalizedDragTimes = {
                startTime: times.startTime ? new Date(times.startTime) : prev?.startTime ?? null,
                endTime: times.endTime ? new Date(times.endTime) : prev?.endTime ?? null,
                stationId: times.stationId ?? prev?.stationId ?? null
            }

            if (durationStatus === 'supported' && durationMinutes != null && next.startTime) {
                next.endTime = addMinutes(next.startTime, durationMinutes)
            }

            return next
        })
    }


    const canCreateAppointment = Boolean(
        selectedCustomer &&
        selectedService &&
        (durationStatus === 'supported' || isManualOverride) &&
        (durationMinutes != null || isManualOverride) &&
        appointmentTimes?.startTime &&
        appointmentTimes?.endTime
    )

    const handleCreateBusinessAppointment = async () => {
        if (!canCreateAppointment || !appointmentTimes?.startTime || !appointmentTimes?.endTime || !selectedCustomer || !selectedService) {
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
                serviceId: selectedService.id,
                isManualOverride
            }).unwrap()

            // Close the modal and reset form
            onOpenChange(false)
            setSelectedCustomer(null)
            setSelectedService(null)
            setIsManualOverride(false)
            setOriginalEndTime(null)
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
                        צור תור עסקי עם לקוח ושירות מתאים
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
                            endTimeMode="auto"
                            autoDurationMinutes={durationStatus === 'supported' && durationMinutes != null ? durationMinutes : null}
                            isManualOverride={isManualOverride}
                            onManualOverrideChange={setIsManualOverride}
                        />

                        {durationStatus === 'checking' && (
                            <div className="mb-3 flex items-center justify-end gap-2 text-xs text-blue-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>בודק משך השירות עבור ההגדרות שנבחרו...</span>
                            </div>
                        )}

                        {(durationStatus === 'unsupported' || durationStatus === 'error') && !isManualOverride && (
                            <Alert variant="destructive" className="mb-3 text-right">
                                <AlertDescription>
                                    {durationMessage ?? (durationStatus === 'unsupported'
                                        ? "העמדה שנבחרה אינה תומכת בשירות זה."
                                        : "אירעה שגיאה בבדיקת משך השירות.")}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-4">
                            <CustomerSearchInput
                                selectedCustomer={selectedCustomer}
                                onCustomerSelect={handleCustomerSelect}
                                onCustomerClear={handleClearCustomer}
                            />

                            {selectedCustomer && (
                                <div className="rounded-md border border-blue-100 bg-blue-50/40 p-4 text-right space-y-3">
                                    <div className="text-xs font-medium text-blue-700">
                                        שירות מקושר ללקוח
                                    </div>

                                    <ServiceSelectInput
                                        selectedServiceId={selectedService?.id ?? null}
                                        onServiceSelect={setSelectedService}
                                        onServiceClear={() => setSelectedService(null)}
                                    />

                                    {selectedService && (
                                        <div className="rounded-md border border-blue-200 bg-white/80 p-3 text-right space-y-1">
                                            <div className="text-sm font-medium text-gray-900">
                                                {selectedService.name}
                                            </div>
                                            {selectedService.description && (
                                                <div className="text-xs text-gray-600">
                                                    {selectedService.description}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
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
