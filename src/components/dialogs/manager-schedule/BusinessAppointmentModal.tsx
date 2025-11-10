import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, X } from "lucide-react"
import { addMinutes } from "date-fns"
import { useLazyGetBreedStationDurationQuery, useCreateManagerAppointmentMutation } from "@/store/services/supabaseApi"
import { cn } from "@/lib/utils"
import { AppointmentDetailsSection, type AppointmentStation, type AppointmentTimes } from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { CustomerSearchInput, type Customer } from "@/components/CustomerSearchInput"
import { DogSelectInput, type Dog } from "@/components/DogSelectInput"

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
    prefillDog?: Dog | null
}

export const BusinessAppointmentModal: React.FC<BusinessAppointmentModalProps> = ({
    open,
    onOpenChange,
    finalizedDragTimes,
    stations = [],
    onCancel,
    onSuccess,
    prefillCustomer = null,
    prefillDog = null
}) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [selectedDog, setSelectedDog] = useState<Dog | null>(null)
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

    const [triggerBreedDuration, breedDurationResult] = useLazyGetBreedStationDurationQuery()
    const { data: breedDurationData, isError: isBreedDurationError, error: breedDurationError } = breedDurationResult
    const [createManagerAppointment, { isLoading: isCreatingAppointment }] = useCreateManagerAppointmentMutation()
    const { toast } = useToast()



    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedDog(null)
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
        if (open && prefillDog) {
            setSelectedDog(prefillDog)
        }
    }, [open, prefillDog])

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
        if (selectedDog?.id && appointmentTimes?.stationId) {
            setDurationStatus('checking')
            setDurationMinutes(null)
            setDurationMessage(null)
            triggerBreedDuration({ dogId: selectedDog.id, stationId: appointmentTimes.stationId, serviceType: 'grooming' })
        } else {
            setDurationStatus('idle')
            setDurationMinutes(null)
            setDurationMessage(null)
        }
    }, [selectedDog?.id, selectedDog?.breed, appointmentTimes?.stationId, triggerBreedDuration])

    useEffect(() => {
        if (!breedDurationData) {
            return
        }

        if (selectedDog?.id && breedDurationData.dogId && breedDurationData.dogId !== selectedDog.id) {
            return
        }

        if (appointmentTimes?.stationId && breedDurationData.stationId && breedDurationData.stationId !== appointmentTimes.stationId) {
            return
        }

        if (breedDurationData.supported) {
            const minutes = typeof breedDurationData.durationMinutes === 'number' ? breedDurationData.durationMinutes : null
            if (minutes == null) {
                setDurationStatus('error')
                setDurationMinutes(null)
                setDurationMessage('לא התקבל משך תספורת תקין עבור הגזע והעמדה שנבחרו.')
                return
            }

            setDurationStatus('supported')
            setDurationMinutes(minutes)
            setDurationMessage(null)
        } else {
            setDurationStatus('unsupported')
            setDurationMinutes(null)
            setDurationMessage(breedDurationData.message ?? 'העמדה שנבחרה אינה תומכת בגזע זה.')
        }
    }, [breedDurationData, selectedDog?.id, appointmentTimes?.stationId])

    useEffect(() => {
        if (!isBreedDurationError) {
            return
        }

        const rawMessage = typeof breedDurationError === 'object' && breedDurationError !== null
            ? (breedDurationError as { data?: unknown }).data
            : null

        let message: string | null = null
        if (typeof rawMessage === 'string') {
            message = rawMessage
        } else if (rawMessage && typeof rawMessage === 'object' && 'error' in rawMessage && typeof (rawMessage as { error?: unknown }).error === 'string') {
            message = (rawMessage as { error?: string }).error ?? null
        }

        setDurationStatus('error')
        setDurationMinutes(null)
        setDurationMessage(message ?? 'לא ניתן לבדוק את משך התספורת בשלב זה.')
    }, [isBreedDurationError, breedDurationError])

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
            // Clear the end time when manual override is disabled and breed is not supported
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
        selectedDog &&
        (durationStatus === 'supported' || isManualOverride) &&
        (durationMinutes != null || isManualOverride) &&
        appointmentTimes?.startTime &&
        appointmentTimes?.endTime
    )

    const handleCreateBusinessAppointment = async () => {
        if (!canCreateAppointment || !appointmentTimes?.startTime || !appointmentTimes?.endTime || !selectedCustomer || !selectedDog) {
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
                dogId: selectedDog.id,
                isManualOverride
            }).unwrap()

            // Close the modal and reset form
            onOpenChange(false)
            setSelectedCustomer(null)
            setSelectedDog(null)
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
                        צור תור עסקי עם לקוח וכלב
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
                                <span>בודק משך התספורת עבור הגזע והעמדה שנבחרו...</span>
                            </div>
                        )}

                        {(durationStatus === 'unsupported' || durationStatus === 'error') && !isManualOverride && (
                            <Alert variant="destructive" className="mb-3 text-right">
                                <AlertDescription>
                                    {durationMessage ?? (durationStatus === 'unsupported'
                                        ? "העמדה שנבחרה אינה תומכת בגזע זה."
                                        : "אירעה שגיאה בבדיקת משך התספורת.")}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-4">
                            <CustomerSearchInput
                                selectedCustomer={selectedCustomer}
                                onCustomerSelect={handleCustomerSelect}
                                onCustomerClear={handleClearCustomer}
                            />

                            {/* Dog Selection */}
                            <DogSelectInput
                                selectedCustomer={selectedCustomer}
                                selectedDog={selectedDog}
                                onDogSelect={handleDogSelect}
                                onDogClear={handleClearDog}
                            />
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
