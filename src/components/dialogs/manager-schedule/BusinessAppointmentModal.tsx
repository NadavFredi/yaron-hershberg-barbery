import React, { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Info, AlertTriangle } from "lucide-react"
import { addMinutes } from "date-fns"
import { useCreateManagerAppointmentMutation, useLazyGetBreedStationDurationQuery } from "@/store/services/supabaseApi"
import {
    AppointmentDetailsSection,
    type AppointmentStation,
    type AppointmentTimes
} from "@/pages/ManagerSchedule/components/AppointmentDetailsSection"
import { useToast } from "@/hooks/use-toast"
import { type Customer, CustomerSearchInput } from "@/components/CustomerSearchInput"
import { type Dog, DogSelectInput } from "@/components/DogSelectInput"

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
    const [syncMeetingsTimes, setSyncMeetingsTimes] = useState<boolean>(true)
    const hasSetSyncDefaultRef = useRef(false)

    const [triggerBreedDuration, breedDurationResult] = useLazyGetBreedStationDurationQuery()
    const { data: breedDurationData, isError: isBreedDurationError, error: breedDurationError } = breedDurationResult
    const [createManagerAppointment, { isLoading: isCreatingAppointment }] = useCreateManagerAppointmentMutation()
    const { toast } = useToast()



    // Reset states when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedCustomer(null)
            setSelectedDog(null)
            setSyncMeetingsTimes(true)
            hasSetSyncDefaultRef.current = false
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
        } else {
            setAppointmentTimes(null)
        }
    }, [finalizedDragTimes])

    // Set syncMeetingsTimes based on duration when modal opens
    useEffect(() => {
        if (open && appointmentTimes?.startTime && appointmentTimes?.endTime && !hasSetSyncDefaultRef.current) {
            const startTime = appointmentTimes.startTime.getTime()
            const endTime = appointmentTimes.endTime.getTime()
            const durationMinutes = (endTime - startTime) / (1000 * 60)

            // If duration is less than 15 minutes, check sync meetings by default
            // If duration is 15 minutes or longer, uncheck sync meetings by default
            setSyncMeetingsTimes(durationMinutes < 15)
            hasSetSyncDefaultRef.current = true
        }
    }, [open, appointmentTimes?.startTime, appointmentTimes?.endTime])

    useEffect(() => {
        if (!syncMeetingsTimes) {
            setDurationStatus('idle')
            setDurationMinutes(null)
            setDurationMessage(null)
            return
        }

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
    }, [selectedDog?.id, selectedDog?.breed, appointmentTimes?.stationId, syncMeetingsTimes, triggerBreedDuration])

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
        if (!syncMeetingsTimes) {
            return
        }

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
    }, [durationStatus, durationMinutes, startTimeKey, syncMeetingsTimes])



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

            // If sync is enabled, update end time based on start time change
            if (syncMeetingsTimes && next.startTime) {
                // If we have a breed duration, use it
                if (durationStatus === 'supported' && durationMinutes != null) {
                    next.endTime = addMinutes(next.startTime, durationMinutes)
                }
                // Otherwise, maintain the current duration from previous times
                else if (prev?.startTime && prev?.endTime && next.startTime.getTime() !== prev.startTime.getTime()) {
                    const currentDuration = prev.endTime.getTime() - prev.startTime.getTime()
                    next.endTime = new Date(next.startTime.getTime() + currentDuration)
                }
            }

            return next
        })
    }


    const canCreateAppointment = Boolean(
        selectedCustomer &&
        selectedDog &&
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
                isManualOverride: true
            }).unwrap()

            // Close the modal and reset form
            onOpenChange(false)
            setSelectedCustomer(null)
            setSelectedDog(null)
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
                            endTimeMode="editable"
                            autoDurationMinutes={syncMeetingsTimes && durationStatus === 'supported' && durationMinutes != null ? durationMinutes : null}
                            hideSaveCancelButtons={true}
                            disableEndTime={syncMeetingsTimes}
                        >
                            {/* Sync Meetings Times Checkbox */}
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <label htmlFor="sync-meetings-times" className="text-sm text-right cursor-pointer flex items-center gap-2">
                                    <Checkbox
                                        id="sync-meetings-times"
                                        checked={syncMeetingsTimes}
                                        onCheckedChange={(checked) => setSyncMeetingsTimes(checked === true)}
                                    />
                                    <span>סנכרן זמני פגישות</span>
                                </label>
                                {/* Show duration when supported */}
                                {syncMeetingsTimes && durationStatus === 'supported' && durationMinutes != null && (
                                    <span className="text-xs text-green-800">
                                        משך התור: {Math.floor(durationMinutes / 60)}:{String(durationMinutes % 60).padStart(2, '0')}
                                    </span>
                                )}
                            </div>

                            {/* Info message when checkbox is checked but dog not selected */}
                            {syncMeetingsTimes && !selectedDog && (
                                <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-100 px-3 py-2 text-right text-xs text-blue-800">
                                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>זמן הסיום יתעדכן אוטומטית לאחר בחירת כלב</span>
                                </div>
                            )}

                            {/* Loading state */}
                            {syncMeetingsTimes && durationStatus === 'checking' && (
                                <div className="mb-3 flex items-center justify-end gap-2 text-xs text-blue-700">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>בודק משך התספורת עבור הגזע והעמדה שנבחרו...</span>
                                </div>
                            )}

                            {/* Warning when station doesn't support breed */}
                            {syncMeetingsTimes && durationStatus === 'unsupported' && durationMessage && (
                                <div className="mb-3 flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-100 px-3 py-2 text-right text-xs text-yellow-900">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{durationMessage}</span>
                                </div>
                            )}

                            {/* Error state */}
                            {syncMeetingsTimes && durationStatus === 'error' && durationMessage && (
                                <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-right text-xs text-red-900">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{durationMessage}</span>
                                </div>
                            )}
                        </AppointmentDetailsSection>

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
