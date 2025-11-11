import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { addMinutes } from "date-fns"
import { useLazyGetTreatmentTypeStationDurationQuery, useCreateManagerAppointmentMutation, useListOwnerTreatmentsQuery } from "@/store/services/supabaseApi"
import { AppointmentDetailsSection, type AppointmentStation, type AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import type { Treatment } from "@/components/TreatmentSelectInput"

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
    prefillTreatment = null
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null)
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

    const [triggerTreatmentTypeDuration, treatmentTypeDurationResult] = useLazyGetTreatmentTypeStationDurationQuery()
    const { data: treatmentTypeDurationData, isError: isTreatmentTypeDurationError, error: treatmentTypeDurationError } = treatmentTypeDurationResult
    const [createManagerAppointment, { isLoading: isCreatingAppointment }] = useCreateManagerAppointmentMutation()
    const { toast } = useToast()

    const ownerId = selectedCustomer?.recordId || selectedCustomer?.id || null
    const {
        data: customerTreatmentsData,
        isLoading: isLoadingTreatments,
        isFetching: isFetchingTreatments
    } = useListOwnerTreatmentsQuery(ownerId ?? "", { skip: !ownerId })


    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedTreatment(null)
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
        if (!ownerId) {
            setSelectedTreatment(null)
            return
        }

        const treatments = customerTreatmentsData?.treatments ?? []

        if (prefillTreatment && treatments.some((t) => t.id === prefillTreatment.id)) {
            setSelectedTreatment(prefillTreatment)
            return
        }

        setSelectedTreatment((previous) => {
            if (previous && treatments.some((t) => t.id === previous.id)) {
                return previous
            }
            return treatments[0] ?? null
        })
    }, [ownerId, customerTreatmentsData?.treatments, prefillTreatment])

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

    useEffect(() => {
        if (selectedTreatment?.id && appointmentTimes?.stationId) {
            setDurationStatus('checking')
            setDurationMinutes(null)
            setDurationMessage(null)
            triggerTreatmentTypeDuration({ treatmentId: selectedTreatment.id, stationId: appointmentTimes.stationId, serviceType: 'grooming' })
        } else {
            setDurationStatus('idle')
            setDurationMinutes(null)
            setDurationMessage(null)
        }
    }, [selectedTreatment?.id, selectedTreatment?.treatmentType, appointmentTimes?.stationId, triggerTreatmentTypeDuration])

    useEffect(() => {
        if (!treatmentTypeDurationData) {
            return
        }

        if (selectedTreatment?.id && treatmentTypeDurationData.treatmentId && treatmentTypeDurationData.treatmentId !== selectedTreatment.id) {
            return
        }

        if (appointmentTimes?.stationId && treatmentTypeDurationData.stationId && treatmentTypeDurationData.stationId !== appointmentTimes.stationId) {
            return
        }

        if (treatmentTypeDurationData.supported) {
            const minutes = typeof treatmentTypeDurationData.durationMinutes === 'number' ? treatmentTypeDurationData.durationMinutes : null
            if (minutes == null) {
                setDurationStatus('error')
                setDurationMinutes(null)
                setDurationMessage('לא התקבל משך שירות תקין עבור ההגדרות שנבחרו.')
                return
            }

            setDurationStatus('supported')
            setDurationMinutes(minutes)
            setDurationMessage(null)
        } else {
            setDurationStatus('unsupported')
            setDurationMinutes(null)
            setDurationMessage(treatmentTypeDurationData.message ?? 'העמדה שנבחרה אינה תומכת בשירות זה.')
        }
    }, [treatmentTypeDurationData, selectedTreatment?.id, appointmentTimes?.stationId])

    useEffect(() => {
        if (!isTreatmentTypeDurationError) {
            return
        }

        const rawMessage = typeof treatmentTypeDurationError === 'object' && treatmentTypeDurationError !== null
            ? (treatmentTypeDurationError as { data?: unknown }).data
            : null

        let message: string | null = null
        if (typeof rawMessage === 'string') {
            message = rawMessage
        } else if (rawMessage && typeof rawMessage === 'object' && 'error' in rawMessage && typeof (rawMessage as { error?: unknown }).error === 'string') {
            message = (rawMessage as { error?: string }).error ?? null
        }

        setDurationStatus('error')
        setDurationMinutes(null)
        setDurationMessage(message ?? 'לא ניתן לבדוק את משך השירות בשלב זה.')
    }, [isTreatmentTypeDurationError, treatmentTypeDurationError])

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
            // Clear the end time when manual override is disabled and treatmentType is not supported
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
        setSelectedTreatment(null) // Reset treatment selection when customer changes
    }

    const handleClearCustomer = () => {
        setSelectedCustomer(null)
        setSelectedTreatment(null)
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
        selectedTreatment &&
        (durationStatus === 'supported' || isManualOverride) &&
        (durationMinutes != null || isManualOverride) &&
        appointmentTimes?.startTime &&
        appointmentTimes?.endTime
    )

    const handleCreateBusinessAppointment = async () => {
        if (!canCreateAppointment || !appointmentTimes?.startTime || !appointmentTimes?.endTime || !selectedCustomer || !selectedTreatment) {
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
                treatmentId: selectedTreatment.id,
                isManualOverride
            }).unwrap()

            // Close the modal and reset form
            onOpenChange(false)
            setSelectedCustomer(null)
            setSelectedTreatment(null)
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
                                <div className="rounded-md border border-blue-100 bg-blue-50/40 p-4 text-right">
                                    <div className="text-xs font-medium text-blue-700 mb-2">
                                        שירות מקושר ללקוח
                                    </div>
                                    {(isLoadingTreatments || isFetchingTreatments) && (
                                        <div className="flex items-center justify-end gap-2 text-xs text-blue-600">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>טוען שירותים זמינים...</span>
                                        </div>
                                    )}
                                    {!isLoadingTreatments && !isFetchingTreatments && selectedTreatment && (
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {selectedTreatment.name}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                {selectedTreatment.treatmentType} • {selectedTreatment.size}
                                            </div>
                                        </div>
                                    )}
                                    {!isLoadingTreatments && !isFetchingTreatments && !selectedTreatment && (
                                        <Alert variant="destructive" className="mt-3 text-right">
                                            <AlertDescription>
                                                ללקוח זה אין שירות מקושר. יש ליצור שירות מתאים לפני יצירת תור עסקי.
                                            </AlertDescription>
                                        </Alert>
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
